import { randomUUID } from "node:crypto";

/**
 * Sufija el nombre de un dato de prueba para que sea único.
 *
 * Los tests corren contra una base que **persiste entre corridas** —en local
 * es la misma instancia de `supabase start`, que sigue viva de una corrida a
 * la siguiente— y ninguno limpia lo que crea. Un nombre fijo se acumula, y a
 * la segunda corrida rompe de dos maneras:
 *
 * 1. `getByRole("link", { name: "Lote de prueba" })` encuentra varios
 *    elementos y Playwright falla con «strict mode violation».
 * 2. `select id from lotes where nombre = $1` deja de identificar una fila
 *    concreta: sin `order by`, `rows[0]` es la que Postgres devuelva de
 *    primera, que puede ser la de una corrida vieja.
 *
 * En CI nunca se vio porque cada corrida levanta un Supabase limpio
 * (`supabase start` en el job de PR), así que la primera corrida es siempre
 * la única corrida.
 *
 * El sufijo son 8 caracteres de un uuid v4: suficiente para no colisionar
 * entre tests en paralelo y corto para que los mensajes de error sigan
 * siendo legibles.
 */
export function nombreUnico(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}
