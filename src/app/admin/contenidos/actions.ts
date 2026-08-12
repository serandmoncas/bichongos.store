"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ContenidoCategoria = "ficha_especie" | "sop";

export interface ContenidoFormValues {
  titulo: string;
  categoria: ContenidoCategoria;
  nivel: string;
  cuerpo: string;
}

export async function createContenido(values: ContenidoFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("contenidos").insert({
    titulo: values.titulo,
    categoria: values.categoria,
    nivel: values.nivel || null,
    cuerpo: values.cuerpo,
    created_by: userId,
  });
  if (error) {
    throw new Error(`No se pudo crear el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
}

export async function updateContenido(id: string, values: ContenidoFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("contenidos")
    .update({
      titulo: values.titulo,
      categoria: values.categoria,
      nivel: values.nivel || null,
      cuerpo: values.cuerpo,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`No se pudo actualizar el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${id}`);
}

export async function deleteContenido(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("contenidos").delete().eq("id", id);
  if (error) {
    throw new Error(`No se pudo eliminar el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
}
