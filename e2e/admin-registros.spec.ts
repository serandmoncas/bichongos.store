import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearLoteDePrueba(nombre: string): Promise<string> {
  const operador = await createTestUser("operador");
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4) returning id",
      [nombre, "Orellana", "2026-07-29", operador.id]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un estudiante registra una tarea y la ve en la bitácora sin recargar", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote bitácora estudiante");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await expect(page.getByRole("heading", { name: "Bitácora", exact: true })).toBeVisible();

  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();

  const row = page.locator("tbody tr", { hasText: "Riego" });
  await expect(row).toContainText("200ml");
});

test("un estudiante ve el lote de solo lectura, sin el formulario de editar", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote solo lectura");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );

  await expect(page.getByLabel("Estado")).toHaveCount(0);
  await expect(page.getByText("Orellana")).toBeVisible();
});

test("un operador sigue pudiendo editar el lote desde la misma página", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote editable");
  const operador = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(operador.email)}&password=${encodeURIComponent(operador.password)}&next=/admin/lotes/${loteId}`
  );

  const select = page.getByLabel("Estado");
  await select.selectOption("fructificacion");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/lotes$/);
});

test("un usuario no puede registrar una tarea a nombre de otro, RLS lo rechaza", async () => {
  const loteId = await crearLoteDePrueba("Lote suplantación");
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
      db.query(
        "insert into public.registros (lote_id, user_id, tipo, valor) values ($1, $2, $3, $4)",
        [loteId, estudianteB.id, "observacion", "suplantando a otro"]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});
