"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LoteEstado = "incubacion" | "fructificacion" | "cosechado" | "finalizado";

export interface LoteFormValues {
  nombre: string;
  especie: string;
  sustrato: string;
  fecha_inicio: string;
  estado: LoteEstado;
  notas: string;
}

export async function createLote(values: LoteFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("lotes").insert({
    nombre: values.nombre,
    especie: values.especie,
    sustrato: values.sustrato || null,
    fecha_inicio: values.fecha_inicio,
    estado: values.estado,
    notas: values.notas || null,
    created_by: userId,
  });
  if (error) {
    throw new Error(`No se pudo crear el lote: ${error.message}`);
  }

  revalidatePath("/admin/lotes");
}

export async function updateLote(id: string, values: LoteFormValues) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lotes")
    .update({
      nombre: values.nombre,
      especie: values.especie,
      sustrato: values.sustrato || null,
      fecha_inicio: values.fecha_inicio,
      estado: values.estado,
      notas: values.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`No se pudo actualizar el lote: ${error.message}`);
  }

  revalidatePath("/admin/lotes");
  revalidatePath(`/admin/lotes/${id}`);
}
