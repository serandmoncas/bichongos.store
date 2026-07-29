import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { createLote } from "../actions";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function NuevoLotePage() {
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
    redirect("/admin/lotes");
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Nuevo lote</h1>
      <div className="mt-8">
        <LoteForm
          initialValues={{
            nombre: "",
            especie: "",
            sustrato: "",
            fecha_inicio: new Date().toISOString().slice(0, 10),
            estado: "incubacion",
            notas: "",
          }}
          onSubmit={createLote}
        />
      </div>
    </main>
  );
}
