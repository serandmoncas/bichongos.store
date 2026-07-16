import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function PendientePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        Cuenta pendiente de aprobación
      </h1>
      <p className="max-w-md font-mono text-sm text-tinta/70">
        Tu cuenta ({user?.email}) fue creada correctamente, pero todavía no
        tiene acceso al panel. Un administrador necesita aprobarla y
        asignarte un rol antes de que puedas continuar.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
