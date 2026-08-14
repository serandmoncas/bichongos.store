import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { EliminarContenidoButton } from "./eliminar-contenido-button";
import { CATEGORIA_LABELS } from "../categorias";

const ROLES_QUE_GESTIONAN_CONTENIDOS = ["profesor", "admin"];

export default async function ContenidoDetallePage({
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

  const canEdit = ROLES_QUE_GESTIONAN_CONTENIDOS.includes(profile?.role ?? "");

  const { data: contenido } = await supabase
    .from("contenidos")
    .select("id, titulo, categoria, nivel, cuerpo")
    .eq("id", id)
    .single();

  if (!contenido) {
    notFound();
  }

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{contenido.titulo}</h1>
          <p className="mt-1 font-mono text-sm text-tinta/60">
            {CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria}
            {contenido.nivel && ` · ${contenido.nivel}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-4">
            <Link
              href={`/admin/contenidos/${contenido.id}/editar`}
              className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
            >
              Editar
            </Link>
            <EliminarContenidoButton id={contenido.id} />
          </div>
        )}
      </div>
      <article className="markdown-body mt-8 max-w-2xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenido.cuerpo}</ReactMarkdown>
      </article>
    </main>
  );
}
