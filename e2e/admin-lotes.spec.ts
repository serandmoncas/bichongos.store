import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

test("un operador crea un lote y lo ve en la lista", async ({ page }) => {
  const operador = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(operador.email)}&password=${encodeURIComponent(operador.password)}&next=/admin/lotes`
  );
  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();

  await page.getByRole("link", { name: "Nuevo lote" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo lote" })).toBeVisible();

  await page.getByLabel("Nombre").fill("Lote de prueba");
  await page.getByLabel("Especie").fill("Orellana");
  await page.getByLabel("Fecha de inicio").fill("2026-07-29");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lote de prueba" })).toBeVisible();
});

test("un estudiante ve la lista de lotes pero no el botón Nuevo lote", async ({ page }) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes`
  );
  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo lote" })).toHaveCount(0);
});

test("un profesor edita el estado de un lote existente", async ({ page }) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/lotes/nuevo`
  );
  await page.getByLabel("Nombre").fill("Lote a editar");
  await page.getByLabel("Especie").fill("Shiitake");
  await page.getByLabel("Fecha de inicio").fill("2026-07-01");
  await page.getByRole("button", { name: "Guardar" }).click();

  await page.getByRole("link", { name: "Lote a editar" }).click();
  await expect(page.getByRole("heading", { name: "Lote a editar", exact: true })).toBeVisible();

  await page.getByLabel("Estado").selectOption("fructificacion");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();
  const row = page.locator("tbody tr", { hasText: "Lote a editar" });
  await expect(row).toContainText("fructificacion");
});

test("un estudiante no puede crear un lote directamente, RLS lo rechaza", async () => {
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: estudiante.id, role: "authenticated" })}'`
    );
    await expect(
      db.query(
        "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4)",
        ["Intento no autorizado", "Orellana", "2026-07-29", estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un estudiante que visita /admin/lotes/nuevo es redirigido a /admin/lotes", async ({
  page,
}) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/nuevo`
  );
  await expect(page).toHaveURL(/\/admin\/lotes$/);
});

test("un estudiante que visita /admin/lotes/[id] entra al detalle sin ser redirigido", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/lotes/nuevo`
  );
  await page.getByLabel("Nombre").fill("Lote para guard de edición");
  await page.getByLabel("Especie").fill("Shiitake");
  await page.getByLabel("Fecha de inicio").fill("2026-07-01");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  let loteId: string;
  try {
    const result = await db.query("select id from public.lotes where nombre = $1", [
      "Lote para guard de edición",
    ]);
    loteId = result.rows[0].id;
  } finally {
    await db.end();
  }

  const estudiante = await createTestUser("estudiante");
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await expect(page).toHaveURL(new RegExp(`/admin/lotes/${loteId}$`));
  await expect(
    page.getByRole("heading", { name: "Lote para guard de edición", exact: true })
  ).toBeVisible();
});
