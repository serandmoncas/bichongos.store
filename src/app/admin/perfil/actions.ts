"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnNombre(nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nombre: trimmed })
    .eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el nombre: ${error.message}`);
  }

  revalidatePath("/admin/perfil");
  revalidatePath("/admin");
}
