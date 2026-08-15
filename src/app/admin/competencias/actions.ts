"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompetenciaFormValues {
  nombre: string;
  descripcion: string;
  habilita_operar: boolean;
}

export async function createCompetencia(values: CompetenciaFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias")
    .insert({
      nombre: values.nombre,
      descripcion: values.descripcion || null,
      habilita_operar: values.habilita_operar,
      created_by: userId,
    })
    .select("id");
  if (error) {
    throw new Error(`No se pudo crear la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo crear la competencia: sin permisos.");
  }

  revalidatePath("/admin/competencias");
}

export async function updateCompetencia(id: string, values: CompetenciaFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias")
    .update({
      nombre: values.nombre,
      descripcion: values.descripcion || null,
      habilita_operar: values.habilita_operar,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(`No se pudo actualizar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo actualizar la competencia: sin permisos o ya no existe.");
  }

  revalidatePath("/admin/competencias");
}

export async function deleteCompetencia(id: string) {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("competencias")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(`No se pudo eliminar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo eliminar la competencia: sin permisos o ya no existe.");
  }

  revalidatePath("/admin/competencias");
}

export async function validarCompetencia(competenciaId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const validadorId = data?.claims?.sub;
  if (!validadorId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias_validadas")
    .insert({
      competencia_id: competenciaId,
      user_id: userId,
      validado_por: validadorId,
    })
    .select("id");
  if (error) {
    // 23505 = ya estaba validada. Validar es idempotente: el estado
    // deseado ya es cierto, así que no es un error del usuario.
    if (error.code === "23505") {
      revalidatePath("/admin/competencias");
      return;
    }
    throw new Error(`No se pudo validar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo validar la competencia: sin permisos.");
  }

  revalidatePath("/admin/competencias");
}

export async function revocarCompetencia(competenciaId: string, userId: string) {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("competencias_validadas")
    .delete()
    .eq("competencia_id", competenciaId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw new Error(`No se pudo revocar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo revocar la competencia: sin permisos o no estaba validada.");
  }

  revalidatePath("/admin/competencias");
}
