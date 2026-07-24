"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditRow } from "@/lib/admin/can-edit-own-row";

export type UserRole = "pendiente" | "estudiante" | "operador" | "profesor" | "admin";

async function assertCanEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase.auth.getClaims();
  const currentUserId = data?.claims?.sub;
  if (!currentUserId || !canEditRow(currentUserId, userId)) {
    throw new Error("No puedes modificar tu propio perfil desde este panel");
  }
}

export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  await assertCanEdit(supabase, userId);

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el rol: ${error.message}`);
  }

  revalidatePath("/admin/usuarios");
}

export async function updateUserEstado(userId: string, estado: "activo" | "inactivo") {
  const supabase = await createClient();
  await assertCanEdit(supabase, userId);

  const { error } = await supabase.from("profiles").update({ estado }).eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el estado: ${error.message}`);
  }

  revalidatePath("/admin/usuarios");
}
