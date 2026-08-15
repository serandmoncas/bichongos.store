import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function tituloUnico(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}

async function crearContenidoDePrueba(titulo: string, creadoPorId: string): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.contenidos (titulo, categoria, nivel, cuerpo, created_by) values ($1, $2, $3, $4, $5) returning id",
      [titulo, "sop", "N1", "Cuerpo de prueba", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un estudiante marca y desmarca un contenido, y su avance se refleja en la lista", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const titulo = tituloUnico("Contenido para marcar");
  const contenidoId = await crearContenidoDePrueba(titulo, profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como no leído" })).toBeVisible();

  // En la lista debe aparecer la marca en la fila de ese contenido.
  await page.goto("/admin/contenidos");
  const fila = page.locator("tbody tr", { hasText: titulo });
  await expect(fila).toContainText("✓");
  // El estudiante es recién creado, así que su conteo propio es determinístico (1);
  // el total no lo es (otros tests crean contenidos en paralelo), de ahí el patrón.
  await expect(page.getByText(/^1 de \d+ leídos en total$/)).toBeVisible();

  // Desmarcar lo revierte.
  await page.goto(`/admin/contenidos/${contenidoId}`);
  await page.getByRole("button", { name: "Marcar como no leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como leído" })).toBeVisible();

  await page.goto("/admin/contenidos");
  const filaSinMarca = page.locator("tbody tr", { hasText: titulo });
  await expect(filaSinMarca).not.toContainText("✓");
  await expect(page.getByText(/^0 de \d+ leídos en total$/)).toBeVisible();
});

test("un profesor ve en /admin/progreso lo que marcó el estudiante", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const titulo = tituloUnico("Contenido supervisado");
  const contenidoId = await crearContenidoDePrueba(titulo, profesor.id);
  const estudiante = await createTestUser("estudiante");

  // El estudiante marca el contenido por la UI.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await page.getByRole("button", { name: "Marcar como leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como no leído" })).toBeVisible();

  // El profesor entra a la vista de supervisión y ve a esa persona.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/progreso`
  );
  await expect(page.getByRole("heading", { name: "Progreso" })).toBeVisible();

  const filaEstudiante = page.locator("tbody tr", { hasText: estudiante.email });
  await expect(filaEstudiante).toBeVisible();

  // Y en su detalle ve el contenido específico que leyó.
  await filaEstudiante.getByRole("link", { name: estudiante.email }).click();
  await expect(page.getByRole("link", { name: titulo })).toBeVisible();
});

test("un estudiante no ve el link Progreso y es redirigido si entra directo", async ({ page }) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos`
  );
  await expect(page.getByRole("heading", { name: "Contenidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Progreso" })).toHaveCount(0);

  await page.goto("/admin/progreso");
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
});

test("un estudiante no puede marcar una lectura a nombre de otro, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(tituloUnico("Contenido RLS"), profesor.id);
  const estudianteA = await createTestUser("estudiante");
  const estudianteB = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: estudianteA.id, role: "authenticated" })}'`
    );
    await expect(
      db.query("insert into public.lecturas (contenido_id, user_id) values ($1, $2)", [
        contenidoId,
        estudianteB.id,
      ])
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un profesor no puede borrar la lectura de otra persona (afecta cero filas)", async () => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(tituloUnico("Contenido CA6"), profesor.id);
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    // El estudiante marca su lectura (insertada directo, sin pasar por la UI).
    await db.query("insert into public.lecturas (contenido_id, user_id) values ($1, $2)", [
      contenidoId,
      estudiante.id,
    ]);

    // El profesor intenta borrarla. RLS no lanza error en un DELETE denegado:
    // simplemente no afecta filas. Por eso se verifica rowCount, no una excepción.
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: profesor.id, role: "authenticated" })}'`
    );
    const resultado = await db.query("delete from public.lecturas where contenido_id = $1", [
      contenidoId,
    ]);
    expect(resultado.rowCount).toBe(0);

    // La lectura del estudiante sigue existiendo (verificado dentro de la misma
    // transacción, antes del rollback, para que realmente refleje el efecto del DELETE).
    const quedan = await db.query(
      "select count(*)::int as n from public.lecturas where contenido_id = $1",
      [contenidoId]
    );
    expect(quedan.rows[0].n).toBe(1);

    await db.query("rollback");
  } finally {
    await db.end();
  }
});
