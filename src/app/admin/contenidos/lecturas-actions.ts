"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarLeido(contenidoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("lecturas")
    .insert({ contenido_id: contenidoId, user_id: userId })
    .select("id");
  if (error) {
    throw new Error(`No se pudo marcar como leído: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo marcar como leído: sin permisos.");
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${contenidoId}`);
}

export async function desmarcarLeido(contenidoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("lecturas")
    .delete()
    .eq("contenido_id", contenidoId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw new Error(`No se pudo desmarcar: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo desmarcar: no estaba marcado o sin permisos.");
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${contenidoId}`);
}
