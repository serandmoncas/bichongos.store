"use client"

import { createClient } from "@/lib/supabase/client"

export function LoginButton() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button
      onClick={handleLogin}
      className="inline-flex items-center justify-center rounded bg-musgo-oscuro px-6 py-3 font-mono text-sm font-medium uppercase tracking-wide text-crema-claro transition-opacity hover:opacity-90"
    >
      Iniciar sesión con Google
    </button>
  );
}
