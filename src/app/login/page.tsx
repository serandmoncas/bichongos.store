import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { LoginButton } from "./login-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Logo variant="horizontal" />
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-semibold">Iniciar sesión</h1>
        <p className="font-serif text-lg italic text-tinta/80">
          Accedé con tu cuenta de Google para gestionar el cultivo.
        </p>
      </div>
      <LoginButton />
    </main>
  );
}
