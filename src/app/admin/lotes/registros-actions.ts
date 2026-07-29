"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RegistroTipo = "riego" | "humedad" | "temperatura" | "observacion";

export async function createRegistro(loteId: string, tipo: RegistroTipo, valor: string) {
  const trimmed = valor.trim();
  if (!trimmed) {
    throw new Error("El valor no puede estar vacío");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("registros").insert({
    lote_id: loteId,
    user_id: userId,
    tipo,
    valor: trimmed,
  });
  if (error) {
    throw new Error(`No se pudo registrar la tarea: ${error.message}`);
  }

  revalidatePath(`/admin/lotes/${loteId}`);
}
