import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS, esCategoria, etiquetaCategoria } from "./categorias";

const ROLES_QUE_GESTIONAN_CONTENIDOS = ["profesor", "admin"];

export default async function ContenidosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
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

  const canEdit = ROLES_QUE_GESTIONAN_CONTENIDOS.includes(profile?.role ?? "");

  const COLUMNAS = "id, titulo, categoria, nivel, created_at";
  const categoriaValida = categoria && esCategoria(categoria) ? categoria : null;

  const { data: contenidos } = categoriaValida
    ? await supabase
        .from("contenidos")
        .select(COLUMNAS)
        .eq("categoria", categoriaValida)
        .order("created_at", { ascending: false })
    : await supabase
        .from("contenidos")
        .select(COLUMNAS)
        .order("created_at", { ascending: false });

  const { data: lecturas } = await supabase
    .from("lecturas")
    .select("contenido_id")
    .eq("user_id", user.sub);
  const leidos = new Set((lecturas ?? []).map((l) => l.contenido_id));

  const { count: totalContenidos } = await supabase
    .from("contenidos")
    .select("id", { count: "exact", head: true });

  const filtroClase = (activo: boolean) =>
    activo ? "text-musgo-oscuro underline" : "text-tinta/60";

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Contenidos</h1>
          <p className="mt-1 font-mono text-sm text-tinta/60">
            {leidos.size} de {totalContenidos ?? 0} leídos en total
          </p>
        </div>
        {canEdit && (
          <Link
            href="/admin/contenidos/nuevo"
            className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
          >
            Nuevo contenido
          </Link>
        )}
      </div>
      <div className="mt-4 flex gap-4 font-mono text-sm">
        <Link href="/admin/contenidos" className={filtroClase(!categoriaValida)}>
          Todas
        </Link>
        {CATEGORIAS.map((c) => (
          <Link
            key={c.value}
            href={`/admin/contenidos?categoria=${c.value}`}
            className={filtroClase(categoriaValida === c.value)}
          >
            {c.plural}
          </Link>
        ))}
      </div>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4 w-8" aria-label="Leído"></th>
            <th className="py-2 pr-4">Título</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Nivel</th>
            <th className="py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {(contenidos ?? []).map((contenido) => (
            <tr key={contenido.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4 text-musgo-oscuro">
                {leidos.has(contenido.id) ? (
                  <span aria-label="Leído" title="Leído">✓</span>
                ) : (
                  <span aria-hidden="true"> </span>
                )}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/contenidos/${contenido.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {contenido.titulo}
                </Link>
              </td>
              <td className="py-2 pr-4">
                {etiquetaCategoria(contenido.categoria)}
              </td>
              <td className="py-2 pr-4">{contenido.nivel ?? "—"}</td>
              <td className="py-2">
                {new Date(contenido.created_at).toLocaleDateString("es")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
