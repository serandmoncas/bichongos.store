"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RegistroTipo } from "../lotes/registros-actions";

export async function asignarTarea(loteId: string, asignadoA: string, tipo: RegistroTipo) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("tareas_asignadas").insert({
    lote_id: loteId,
    asignado_a: asignadoA,
    asignado_por: userId,
    tipo,
  });
  if (error) {
    throw new Error(`No se pudo asignar la tarea: ${error.message}`);
  }

  revalidatePath("/admin/tareas");
}
