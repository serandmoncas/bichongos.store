import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContenidoForm } from "../contenido-form";
import { createContenido } from "../actions";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

export default async function NuevoContenidoPage() {
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
    redirect("/admin/contenidos");
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Nuevo contenido</h1>
      <div className="mt-8">
        <ContenidoForm
          initialValues={{ titulo: "", categoria: "ficha_especie", nivel: "", cuerpo: "" }}
          onSubmit={createContenido}
        />
      </div>
    </main>
  );
}
