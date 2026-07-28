import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

test("un usuario aprobado edita y persiste su propio nombre", async ({ page }) => {
  const user = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  const input = page.getByLabel("Nombre");
  await input.fill("Nombre de Prueba");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nombre")).toHaveValue("Nombre de Prueba");
});

test("no se puede guardar un nombre vacío", async ({ page }) => {
  const user = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  const input = page.getByLabel("Nombre");
  await input.fill("   ");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();
});

test("un no-admin no ve el link Usuarios pero sí Mi perfil", async ({ page }) => {
  const user = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  await expect(page.getByRole("link", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
});
