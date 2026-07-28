import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NombreForm } from "./nombre-form";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, nombre, role, created_at")
    .eq("id", user.sub)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const createdAt = new Date(profile.created_at).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Mi perfil</h1>
      <dl className="mt-8 space-y-4 font-mono text-sm">
        <div>
          <dt className="text-tinta/50">Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div>
          <dt className="text-tinta/50">Rol</dt>
          <dd className="uppercase text-musgo-oscuro">{profile.role}</dd>
        </div>
        <div>
          <dt className="text-tinta/50">Cuenta creada</dt>
          <dd>{createdAt}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <NombreForm nombre={profile.nombre} />
      </div>
    </main>
  );
}
