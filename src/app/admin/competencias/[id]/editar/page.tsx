import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetenciaForm } from "../../competencia-form";
import { updateCompetencia } from "../../actions";

const ROLES_QUE_GESTIONAN_COMPETENCIAS = ["profesor", "admin"];

export default async function EditarCompetenciaPage({
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

  if (!profile || !ROLES_QUE_GESTIONAN_COMPETENCIAS.includes(profile.role)) {
    redirect("/admin/competencias");
  }

  const { data: competencia } = await supabase
    .from("competencias")
    .select("id, nombre, descripcion, habilita_operar")
    .eq("id", id)
    .single();

  if (!competencia) {
    notFound();
  }

  const updateCompetenciaBound = updateCompetencia.bind(null, competencia.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Editar competencia</h1>
      <CompetenciaForm
        initialValues={{
          nombre: competencia.nombre,
          descripcion: competencia.descripcion ?? "",
          habilita_operar: competencia.habilita_operar,
        }}
        onSubmit={updateCompetenciaBound}
        mode="edit"
      />
    </main>
  );
}
