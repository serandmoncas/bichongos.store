import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserRowControls } from "./user-row-controls";
import type { UserRole } from "./actions";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    notFound();
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  if (!currentProfile || currentProfile.role !== "admin") {
    notFound();
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nombre, email, role, estado, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Usuarios</h1>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Nombre</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Rol</th>
            <th className="py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((profile) => (
            <tr key={profile.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">{profile.nombre ?? "—"}</td>
              <td className="py-2 pr-4">{profile.email}</td>
              <UserRowControls
                profile={{
                  id: profile.id,
                  role: profile.role as UserRole,
                  estado: profile.estado,
                }}
                currentUserId={user.sub}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
