"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function E2ELoginForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const next = searchParams.get("next") ?? "/admin";
  const [status, setStatus] = useState("Iniciando sesión de prueba...");

  useEffect(() => {
    if (!email || !password) {
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
  }, [email, password, next]);

  if (!email || !password) {
    return <p>Faltan email o password en la URL</p>;
  }

  return <p>{status}</p>;
}
