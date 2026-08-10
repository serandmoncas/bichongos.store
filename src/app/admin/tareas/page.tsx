import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AsignarTareaForm } from "./asignar-tarea-form";

const ROLES_QUE_ASIGNAN = ["profesor", "admin"];

const TIPO_LABELS: Record<string, string> = {
  riego: "Riego",
  humedad: "Humedad",
  temperatura: "Temperatura",
  observacion: "Observación",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
};

export default async function TareasPage() {
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

  const puedeAsignar = ROLES_QUE_ASIGNAN.includes(profile?.role ?? "");

  const COLUMNAS = "id, lote_id, tipo, asignado_a, asignado_por, estado, created_at";
  const { data: tareas } = puedeAsignar
    ? await supabase
        .from("tareas_asignadas")
        .select(COLUMNAS)
        .order("created_at", { ascending: false })
    : await supabase
        .from("tareas_asignadas")
        .select(COLUMNAS)
        .eq("asignado_a", user.sub)
        .order("created_at", { ascending: false });

  type Perfil = { id: string; nombre: string | null; email: string };
  type Lote = { id: string; nombre: string };

  const userIds = Array.from(
    new Set((tareas ?? []).flatMap((t) => [t.asignado_a, t.asignado_por]))
  );
  const { data: perfiles }: { data: Perfil[] | null } = userIds.length
    ? await supabase.rpc("nombres_de_usuarios", { ids: userIds })
    : { data: [] };

  const nombreDe = (userId: string) => {
    const p = perfiles?.find((p: Perfil) => p.id === userId);
    return p?.nombre ?? p?.email ?? userId;
  };

  const loteIds = Array.from(new Set((tareas ?? []).map((t) => t.lote_id)));
  const { data: lotesDeLasTareas }: { data: Lote[] | null } = loteIds.length
    ? await supabase.from("lotes").select("id, nombre").in("id", loteIds)
    : { data: [] };

  const nombreDeLote = (loteId: string) =>
    lotesDeLasTareas?.find((l) => l.id === loteId)?.nombre ?? loteId;

  let lotesParaAsignar: Lote[] = [];
  let personasParaAsignar: Perfil[] = [];

  if (puedeAsignar) {
    const [{ data: lotes }, { data: personas }] = await Promise.all([
      supabase.from("lotes").select("id, nombre").order("nombre"),
      supabase.rpc("listar_usuarios_aprobados"),
    ]);
    lotesParaAsignar = lotes ?? [];
    personasParaAsignar = personas ?? [];
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Tareas</h1>

      {puedeAsignar && (
        <div className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Asignar tarea</h2>
          <AsignarTareaForm lotes={lotesParaAsignar} personas={personasParaAsignar} />
        </div>
      )}

      <div className="mt-12">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Lote</th>
              <th className="py-2 pr-4">Tipo</th>
              {puedeAsignar && <th className="py-2 pr-4">Asignado a</th>}
              <th className="py-2 pr-4">Asignado por</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(tareas ?? []).map((tarea) => (
              <tr key={tarea.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">{nombreDeLote(tarea.lote_id)}</td>
                <td className="py-2 pr-4">{TIPO_LABELS[tarea.tipo] ?? tarea.tipo}</td>
                {puedeAsignar && <td className="py-2 pr-4">{nombreDe(tarea.asignado_a)}</td>}
                <td className="py-2 pr-4">{nombreDe(tarea.asignado_por)}</td>
                <td className="py-2 pr-4 uppercase text-musgo-oscuro">
                  {ESTADO_LABELS[tarea.estado] ?? tarea.estado}
                </td>
                <td className="py-2">{new Date(tarea.created_at).toLocaleString("es")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
