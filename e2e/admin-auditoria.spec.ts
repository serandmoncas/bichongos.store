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
  await expect(select).toBeDisabled();
  await expect(select).toBeEnabled();

  await page.goto("/admin/auditoria");
  const logRow = page.locator("tbody tr", { hasText: "Cambio de rol" }).first();
  await expect(logRow).toBeVisible();
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
  const before = await page.locator("tbody tr").count();

  await page.goto("/admin/perfil");
  await page.getByLabel("Nombre").fill("Nombre Sin Auditar");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.goto("/admin/auditoria");
  const after = await page.locator("tbody tr").count();
  expect(after).toBe(before);
});
