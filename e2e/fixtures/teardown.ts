import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Los usuarios de prueba son los que crea `createTestUser` en test-users.ts. */
const EMAIL_DE_PRUEBA = "e2e-%@bichongos.test";

/**
 * Borra todo lo que dejó la corrida de tests.
 *
 * Sin esto los datos se acumulan sin límite en la base local, que sobrevive
 * entre corridas. No es solo desorden: los formularios que listan personas
 * (asignar tarea, validar competencia) renderizan un `<option>` por usuario
 * aprobado, así que con mil usuarios acumulados la página se vuelve tan
 * pesada que `selectOption` alcanza el timeout y tests correctos empiezan a
 * fallar por una razón que no tiene nada que ver con lo que verifican.
 *
 * En CI no cambia nada —cada job levanta un Supabase limpio— pero es lo que
 * hace que la suite se pueda correr dos veces seguidas en local.
 *
 * **Cuidado:** borra *todos* los usuarios `e2e-*`, no solo los de esta
 * corrida. Dos procesos de Playwright a la vez contra la misma base se
 * pisarían: el teardown del primero en terminar le borra los usuarios al
 * otro. No pasa en CI (un job por base) ni corriendo la suite normal.
 *
 * **El orden importa.** Casi todas las FK hacia `auth.users` son NO ACTION
 * (solo `profiles` y `activity_log.actor_id` son CASCADE), así que borrar los
 * usuarios de una no funciona: hay que vaciar antes lo que los referencia.
 * Y `tareas_asignadas.registro_id` es NO ACTION hacia `registros`, así que
 * las tareas van antes que los registros.
 */
async function limpiarDatosDePrueba(): Promise<void> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ id: string }>(
      "select id from auth.users where email like $1",
      [EMAIL_DE_PRUEBA]
    );
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      return;
    }

    await db.query("begin");

    // `updated_by` puede apuntar a un usuario de prueba desde una fila que
    // creó alguien real (un test que edita contenido sembrado). Esa fila no
    // se borra: solo se suelta la referencia.
    await db.query("update public.contenidos set updated_by = null where updated_by = any($1)", [
      ids,
    ]);
    await db.query("update public.competencias set updated_by = null where updated_by = any($1)", [
      ids,
    ]);

    // Tareas antes que registros y lotes: es la única FK NO ACTION entre
    // tablas de datos.
    await db.query(
      `delete from public.tareas_asignadas
        where asignado_a = any($1)
           or asignado_por = any($1)
           or registro_id in (select id from public.registros where user_id = any($1))`,
      [ids]
    );

    // Los lotes arrastran en cascada sus registros y sus tareas.
    await db.query("delete from public.lotes where created_by = any($1)", [ids]);
    await db.query("delete from public.registros where user_id = any($1)", [ids]);

    await db.query(
      `delete from public.competencias_validadas
        where user_id = any($1) or validado_por = any($1)`,
      [ids]
    );
    await db.query("delete from public.competencias where created_by = any($1)", [ids]);

    // Los contenidos arrastran en cascada sus lecturas.
    await db.query("delete from public.lecturas where user_id = any($1)", [ids]);
    await db.query("delete from public.contenidos where created_by = any($1)", [ids]);

    // profiles y activity_log.actor_id sí son CASCADE desde auth.users.
    await db.query("delete from auth.users where id = any($1)", [ids]);

    await db.query("commit");
    console.log(`[teardown] ${ids.length} usuarios de prueba y sus datos eliminados`);
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

export default limpiarDatosDePrueba;
