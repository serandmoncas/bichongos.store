import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACCION_LABELS: Record<string, string> = {
  cambio_rol: "Cambio de rol",
  cambio_estado: "Cambio de estado",
};

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    notFound();
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  if (!currentProfile || currentProfile.role !== "admin") {
    notFound();
  }

  const { data: entries } = await supabase
    .from("activity_log")
    .select("id, actor_id, target_id, accion, valor_anterior, valor_nuevo, created_at")
    .order("created_at", { ascending: false });

  const userIds = Array.from(
    new Set(
      (entries ?? [])
        .flatMap((e) => [e.actor_id, e.target_id])
        .filter((id): id is string => !!id)
    )
  );

  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, nombre, email").in("id", userIds)
    : { data: [] as { id: string; nombre: string | null; email: string }[] };

  const nombreDe = (id: string | null) => {
    if (!id) return "—";
    const p = profiles?.find((p) => p.id === id);
    return p?.nombre ?? p?.email ?? id;
  };

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Auditoría</h1>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Quién</th>
            <th className="py-2 pr-4">A quién</th>
            <th className="py-2 pr-4">Qué cambió</th>
            <th className="py-2 pr-4">Anterior → Nuevo</th>
            <th className="py-2">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((entry) => (
            <tr key={entry.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">{nombreDe(entry.actor_id)}</td>
              <td className="py-2 pr-4">{nombreDe(entry.target_id)}</td>
              <td className="py-2 pr-4">{ACCION_LABELS[entry.accion] ?? entry.accion}</td>
              <td className="py-2 pr-4">
                {entry.valor_anterior} → {entry.valor_nuevo}
              </td>
              <td className="py-2">{new Date(entry.created_at).toLocaleString("es")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
