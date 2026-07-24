"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function E2ELoginForm() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Iniciando sesión de prueba...");

  useEffect(() => {
    const email = searchParams.get("email");
    const password = searchParams.get("password");
    const next = searchParams.get("next") ?? "/admin";

    if (!email || !password) {
      setStatus("Faltan email o password en la URL");
      return;
    }

    const supabase = createClient();
    supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }
      window.location.href = next;
    });
  }, [searchParams]);

  return <p>{status}</p>;
}
