import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContenidoForm } from "../../contenido-form";
import { updateContenido } from "../../actions";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

export default async function EditarContenidoPage({
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

  if (!profile || !ROLES_QUE_EDITAN.includes(profile.role)) {
    redirect(`/admin/contenidos/${id}`);
  }

  const { data: contenido } = await supabase
    .from("contenidos")
    .select("id, titulo, categoria, nivel, cuerpo")
    .eq("id", id)
    .single();

  if (!contenido) {
    notFound();
  }

  const updateContenidoBound = updateContenido.bind(null, contenido.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Editar contenido</h1>
      <div className="mt-8">
        <ContenidoForm
          initialValues={{
            titulo: contenido.titulo,
            categoria: contenido.categoria,
            nivel: contenido.nivel ?? "",
            cuerpo: contenido.cuerpo,
          }}
          onSubmit={updateContenidoBound}
        />
      </div>
    </main>
  );
}
