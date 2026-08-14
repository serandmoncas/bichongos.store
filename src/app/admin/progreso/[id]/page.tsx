import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABELS } from "../../contenidos/categorias";

const ROLES_QUE_SUPERVISAN = ["profesor", "admin"];

export default async function ProgresoPersonaPage({
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

  if (!profile || !ROLES_QUE_SUPERVISAN.includes(profile.role)) {
    redirect("/admin/contenidos");
  }

  type Perfil = { id: string; nombre: string | null; email: string };

  const { data: perfiles }: { data: Perfil[] | null } = await supabase.rpc(
    "nombres_de_usuarios",
    { ids: [id] }
  );
  const persona = perfiles?.[0];

  const { data: lecturas } = await supabase
    .from("lecturas")
    .select("id, contenido_id, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  type Contenido = { id: string; titulo: string; categoria: string; nivel: string | null };

  const contenidoIds = (lecturas ?? []).map((l) => l.contenido_id);
  const { data: contenidos }: { data: Contenido[] | null } = contenidoIds.length
    ? await supabase
        .from("contenidos")
        .select("id, titulo, categoria, nivel")
        .in("id", contenidoIds)
    : { data: [] };

  const contenidoDe = (contenidoId: string) =>
    contenidos?.find((c) => c.id === contenidoId);

  return (
    <main className="px-6 py-12">
      <Link
        href="/admin/progreso"
        className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
      >
        ← Progreso
      </Link>
      <h1 className="mt-4 font-serif text-2xl font-semibold">
        {persona?.nombre ?? persona?.email ?? id}
      </h1>
      <p className="mt-1 font-mono text-sm text-tinta/60">
        {(lecturas ?? []).length} contenidos leídos
      </p>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Contenido</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Nivel</th>
            <th className="py-2">Leído</th>
          </tr>
        </thead>
        <tbody>
          {(lecturas ?? []).map((lectura) => {
            const contenido = contenidoDe(lectura.contenido_id);
            return (
              <tr key={lectura.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/contenidos/${lectura.contenido_id}`}
                    className="text-musgo-oscuro underline"
                  >
                    {contenido?.titulo ?? lectura.contenido_id}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {contenido ? (CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria) : "—"}
                </td>
                <td className="py-2 pr-4">{contenido?.nivel ?? "—"}</td>
                <td className="py-2">
                  {new Date(lectura.created_at).toLocaleDateString("es")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
