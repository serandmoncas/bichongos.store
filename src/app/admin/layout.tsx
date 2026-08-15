import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, nombre")
    .eq("id", user.sub)
    .single();

  if (!profile || profile.role === "pendiente") {
    redirect("/pendiente");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-tinta/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Logo variant="inline" />
          <nav className="flex gap-4 font-mono text-sm uppercase tracking-wide">
            {profile.role === "admin" && (
              <>
                <Link href="/admin/usuarios" className="text-tinta/70 hover:text-tinta">
                  Usuarios
                </Link>
                <Link href="/admin/auditoria" className="text-tinta/70 hover:text-tinta">
                  Auditoría
                </Link>
              </>
            )}
            {(profile.role === "profesor" || profile.role === "admin") && (
              <Link href="/admin/progreso" className="text-tinta/70 hover:text-tinta">
                Progreso
              </Link>
            )}
            <Link href="/admin/lotes" className="text-tinta/70 hover:text-tinta">
              Lotes
            </Link>
            <Link href="/admin/tareas" className="text-tinta/70 hover:text-tinta">
              Tareas
            </Link>
            <Link href="/admin/contenidos" className="text-tinta/70 hover:text-tinta">
              Contenidos
            </Link>
            <Link href="/admin/competencias" className="text-tinta/70 hover:text-tinta">
              Competencias
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span className="text-tinta/70">
            {profile.nombre ?? profile.email}{" "}
            <span className="uppercase text-musgo-oscuro">({profile.role})</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="uppercase tracking-wide text-musgo-oscuro underline"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
