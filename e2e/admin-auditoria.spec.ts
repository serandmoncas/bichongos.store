import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

async function loginAs(page: import("@playwright/test").Page, user: { email: string; password: string }, next: string) {
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=${next}`
  );
}

test("un cambio de rol queda registrado y visible en /admin/auditoria", async ({ page }) => {
  const admin = await createTestUser("admin");
  const pendiente = await createTestUser("pendiente");

  await loginAs(page, admin, "/admin/usuarios");
  await expect(page).toHaveURL(/\/admin\/usuarios$/);

  const row = page.locator("tbody tr", { hasText: pendiente.email });
  const select = row.locator("select");
  await select.selectOption("operador");
  await expect(select).toBeEnabled();
  await expect(select).toHaveValue("operador");

  // El <select> es un componente no controlado (defaultValue): toHaveValue
  // arriba confirma lo que el usuario seleccionó en el DOM, no que la
  // escritura en el servidor ya haya terminado — startTransition aquí no
  // devuelve la promesa de la Server Action, así que "isPending" (y por lo
  // tanto "enabled") no es garantía de que el UPDATE ya se aplicó. Se
  // reintenta navegar + revisar hasta que la fila de auditoría aparezca, en
  // vez de asumir que ya está lista apenas navegamos una vez.
  const logRow = page.locator("tbody tr", { hasText: "Cambio de rol" }).first();
  await expect(async () => {
    await page.goto("/admin/auditoria");
    await expect(logRow).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
  await expect(logRow).toContainText("pendiente");
  await expect(logRow).toContainText("operador");
});

test("un no-admin no puede ver /admin/auditoria", async ({ page }) => {
  const profesor = await createTestUser("profesor");

  await loginAs(page, profesor, "/admin/auditoria");

  await expect(
    page.getByRole("heading", { name: "Esta sección aún no existe para tu rol" })
  ).toBeVisible();
});

test("editar el propio nombre no genera un registro de auditoría", async ({ page }) => {
  const admin = await createTestUser("admin");

  await loginAs(page, admin, "/admin/auditoria");
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  // Se acota a las filas donde ESTE admin aparece (como "Quién" o "A quién",
  // ambas columnas muestran nombre o, a falta de nombre, el email) en vez de
  // contar TODAS las filas de la tabla. /admin/auditoria corre con
  // fullyParallel, y otros tests de este mismo archivo (p.ej. "un cambio de
  // rol...") insertan filas de auditoría propias en paralelo — un conteo
  // global de before/after es una carrera contra esos otros tests y falla
  // por una razón que no tiene nada que ver con lo que este test verifica.
  const filasDeEsteAdmin = page.locator("tbody tr", { hasText: admin.email });
  const before = await filasDeEsteAdmin.count();

  await page.goto("/admin/perfil");
  await page.getByLabel("Nombre").fill("Nombre Sin Auditar");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.goto("/admin/auditoria");
  const after = await filasDeEsteAdmin.count();
  expect(after).toBe(before);
});
