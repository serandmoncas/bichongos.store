import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

const CATEGORIA_LABELS: Record<string, string> = {
  ficha_especie: "Ficha de especie",
  sop: "SOP",
};

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

  const canEdit = ROLES_QUE_EDITAN.includes(profile?.role ?? "");

  const COLUMNAS = "id, titulo, categoria, nivel, created_at";
  const categoriaValida =
    categoria === "ficha_especie" || categoria === "sop" ? categoria : null;

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

  const filtroClase = (activo: boolean) =>
    activo ? "text-musgo-oscuro underline" : "text-tinta/60";

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Contenidos</h1>
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
        <Link
          href="/admin/contenidos?categoria=ficha_especie"
          className={filtroClase(categoriaValida === "ficha_especie")}
        >
          Fichas de especie
        </Link>
        <Link
          href="/admin/contenidos?categoria=sop"
          className={filtroClase(categoriaValida === "sop")}
        >
          SOPs
        </Link>
      </div>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Título</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Nivel</th>
            <th className="py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {(contenidos ?? []).map((contenido) => (
            <tr key={contenido.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/contenidos/${contenido.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {contenido.titulo}
                </Link>
              </td>
              <td className="py-2 pr-4">
                {CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria}
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
