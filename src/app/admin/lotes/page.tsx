import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function LotesPage() {
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

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, nombre, especie, estado, fecha_inicio")
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Lotes</h1>
        {canEdit && (
          <Link
            href="/admin/lotes/nuevo"
            className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
          >
            Nuevo lote
          </Link>
        )}
      </div>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Nombre</th>
            <th className="py-2 pr-4">Especie</th>
            <th className="py-2 pr-4">Estado</th>
            <th className="py-2">Fecha de inicio</th>
          </tr>
        </thead>
        <tbody>
          {(lotes ?? []).map((lote) => (
            <tr key={lote.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                {canEdit ? (
                  <Link
                    href={`/admin/lotes/${lote.id}`}
                    className="text-musgo-oscuro underline"
                  >
                    {lote.nombre}
                  </Link>
                ) : (
                  lote.nombre
                )}
              </td>
              <td className="py-2 pr-4">{lote.especie}</td>
              <td className="py-2 pr-4">{lote.estado}</td>
              <td className="py-2">{lote.fecha_inicio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
