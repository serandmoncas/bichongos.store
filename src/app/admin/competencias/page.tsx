import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompetenciaForm } from "./competencia-form";
import { ValidarCompetenciaForm } from "./validar-competencia-form";
import { createCompetencia } from "./actions";
import { EliminarCompetenciaButton } from "./eliminar-competencia-button";

const ROLES_QUE_GESTIONAN_COMPETENCIAS = ["profesor", "admin"];

export default async function CompetenciasPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  const canEdit = ROLES_QUE_GESTIONAN_COMPETENCIAS.includes(profile?.role ?? "");

  type Competencia = {
    id: string;
    nombre: string;
    descripcion: string | null;
    habilita_operar: boolean;
  };
  type Validada = {
    competencia_id: string;
    user_id: string;
    validado_por: string;
    created_at: string;
  };
  type Persona = { id: string; nombre: string | null; email: string };

  const { data: competencias }: { data: Competencia[] | null } = await supabase
    .from("competencias")
    .select("id, nombre, descripcion, habilita_operar")
    .order("nombre");

  const { data: validadas }: { data: Validada[] | null } = await supabase
    .from("competencias_validadas")
    .select("competencia_id, user_id, validado_por, created_at");

  const mias = (validadas ?? []).filter((v) => v.user_id === user.sub);
  const validadorIds = Array.from(new Set(mias.map((v) => v.validado_por)));
  const { data: validadores }: { data: Persona[] | null } = validadorIds.length
    ? await supabase.rpc("nombres_de_usuarios", { ids: validadorIds })
    : { data: [] };

  const nombreDe = (id: string) => {
    const p = validadores?.find((v) => v.id === id);
    return p?.nombre ?? p?.email ?? id;
  };

  const miaPorCompetencia = new Map(mias.map((v) => [v.competencia_id, v]));
  const tengoHabilitante = (competencias ?? []).some(
    (c) => c.habilita_operar && miaPorCompetencia.has(c.id)
  );

  let personas: Persona[] = [];
  if (canEdit) {
    const { data: aprobados }: { data: Persona[] | null } = await supabase.rpc(
      "listar_usuarios_aprobados"
    );
    personas = aprobados ?? [];
  }

  const validadasDe = (competenciaId: string) =>
    (validadas ?? []).filter((v) => v.competencia_id === competenciaId).map((v) => v.user_id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Competencias</h1>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">Mis competencias</h2>
        {!tengoHabilitante && (
          <p className="mt-2 max-w-xl font-mono text-sm text-terracota">
            Todavía no tenés ninguna competencia que habilite operar, así que no podés
            registrar tareas en la bitácora de un lote. Un profesor tiene que validártela.
          </p>
        )}
        <table className="mt-4 w-full max-w-3xl font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Competencia</th>
              <th className="py-2 pr-4">Habilita operar</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2">Validada por</th>
            </tr>
          </thead>
          <tbody>
            {(competencias ?? []).map((competencia) => {
              const mia = miaPorCompetencia.get(competencia.id);
              return (
                <tr key={competencia.id} className="border-b border-tinta/5">
                  <td className="py-2 pr-4">{competencia.nombre}</td>
                  <td className="py-2 pr-4">{competencia.habilita_operar ? "Sí" : "No"}</td>
                  <td className="py-2 pr-4 text-musgo-oscuro">
                    {mia ? "Lograda" : "Pendiente"}
                  </td>
                  <td className="py-2">
                    {mia
                      ? `${nombreDe(mia.validado_por)} · ${new Date(
                          mia.created_at
                        ).toLocaleDateString("es")}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canEdit && (
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold">Catálogo</h2>
          <CompetenciaForm
            initialValues={{ nombre: "", descripcion: "", habilita_operar: false }}
            onSubmit={createCompetencia}
          />
          <ul className="mt-8 flex max-w-3xl flex-col gap-6">
            {(competencias ?? []).map((competencia) => (
              <li key={competencia.id} className="border-b border-tinta/5 pb-4">
                <p className="font-mono text-sm">
                  {competencia.nombre}
                  {competencia.habilita_operar && (
                    <span className="ml-2 uppercase text-musgo-oscuro">habilita operar</span>
                  )}
                </p>
                {competencia.descripcion && (
                  <p className="mt-1 font-mono text-sm text-tinta/60">
                    {competencia.descripcion}
                  </p>
                )}
                <div className="mt-1 flex gap-4">
                  <Link
                    href={`/admin/competencias/${competencia.id}/editar`}
                    className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
                  >
                    Editar
                  </Link>
                  <EliminarCompetenciaButton id={competencia.id} />
                </div>
                <ValidarCompetenciaForm
                  competenciaId={competencia.id}
                  personas={personas}
                  validadas={validadasDe(competencia.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
