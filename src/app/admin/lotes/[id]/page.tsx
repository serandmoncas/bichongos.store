import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { updateLote } from "../actions";
import { RegistroForm } from "./registro-form";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

const TIPO_LABELS: Record<string, string> = {
  riego: "Riego",
  humedad: "Humedad",
  temperatura: "Temperatura",
  observacion: "Observación",
};

export default async function LoteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const canEdit = ROLES_QUE_EDITAN.includes(profile?.role ?? "");

  const { data: lote } = await supabase
    .from("lotes")
    .select("id, nombre, especie, sustrato, fecha_inicio, estado, notas")
    .eq("id", id)
    .single();

  if (!lote) {
    notFound();
  }

  const { data: registros } = await supabase
    .from("registros")
    .select("id, user_id, tipo, valor, created_at")
    .eq("lote_id", id)
    .order("created_at", { ascending: false });

  type Perfil = { id: string; nombre: string | null; email: string };

  const userIds = Array.from(new Set((registros ?? []).map((r) => r.user_id)));
  const { data: perfiles }: { data: Perfil[] | null } = userIds.length
    ? await supabase.rpc("nombres_de_usuarios", { ids: userIds })
    : { data: [] };

  const nombreDe = (userId: string) => {
    const p = perfiles?.find((p: Perfil) => p.id === userId);
    return p?.nombre ?? p?.email ?? userId;
  };

  const { data: puedeRegistrar } = await supabase.rpc("puede_registrar");

  const updateLoteBound = updateLote.bind(null, lote.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">{lote.nombre}</h1>

      <div className="mt-8">
        {canEdit ? (
          <LoteForm
            initialValues={{
              nombre: lote.nombre,
              especie: lote.especie,
              sustrato: lote.sustrato ?? "",
              fecha_inicio: lote.fecha_inicio,
              estado: lote.estado,
              notas: lote.notas ?? "",
            }}
            onSubmit={updateLoteBound}
          />
        ) : (
          <dl className="max-w-md space-y-2 font-mono text-sm">
            <div>
              <dt className="text-tinta/50">Especie</dt>
              <dd>{lote.especie}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Sustrato</dt>
              <dd>{lote.sustrato ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Fecha de inicio</dt>
              <dd>{lote.fecha_inicio}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Estado</dt>
              <dd className="uppercase text-musgo-oscuro">{lote.estado}</dd>
            </div>
            {lote.notas && (
              <div>
                <dt className="text-tinta/50">Notas</dt>
                <dd>{lote.notas}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-xl font-semibold">Bitácora</h2>
        <table className="mt-4 w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Quién</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Valor</th>
              <th className="py-2">Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {(registros ?? []).map((registro) => (
              <tr key={registro.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">{nombreDe(registro.user_id)}</td>
                <td className="py-2 pr-4">{TIPO_LABELS[registro.tipo] ?? registro.tipo}</td>
                <td className="py-2 pr-4">{registro.valor}</td>
                <td className="py-2">{new Date(registro.created_at).toLocaleString("es")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {puedeRegistrar ? (
          <RegistroForm loteId={lote.id} />
        ) : (
          <p className="mt-4 max-w-xl font-mono text-sm text-terracota">
            No podés registrar tareas todavía: necesitás que un profesor te valide una
            competencia que habilite operar.{" "}
            <Link href="/admin/competencias" className="underline">
              Ver mis competencias
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
