import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { updateLote } from "../actions";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function EditarLotePage({
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
    redirect("/admin/lotes");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("id, nombre, especie, sustrato, fecha_inicio, estado, notas")
    .eq("id", id)
    .single();

  if (!lote) {
    notFound();
  }

  const updateLoteBound = updateLote.bind(null, lote.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Editar lote</h1>
      <div className="mt-8">
        <LoteForm
          initialValues={{
            nombre: lote.nombre,
            especie: lote.especie,
            sustrato: lote.sustrato ?? "",
            fecha_inicio: lote.fecha_inicio,
            estado: lote.estado,
            notas: lote.notas ?? "",
          }}
          onSubmit={updateLoteBound}
        />
      </div>
    </main>
  );
}
