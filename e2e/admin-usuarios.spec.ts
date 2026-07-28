import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

async function loginAs(page: import("@playwright/test").Page, user: { email: string; password: string }) {
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/usuarios`
  );
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
}

test("un admin ve la lista de usuarios y aprueba a un pendiente como operador", async ({ page }) => {
  const admin = await createTestUser("admin");
  const pendiente = await createTestUser("pendiente");

  await loginAs(page, admin);

  await expect(page.locator("header")).toContainText(admin.email);
  await expect(page.locator("header")).toContainText(/admin/i);

  const row = page.locator("tbody tr", { hasText: pendiente.email });
  await expect(row).toBeVisible();

  const select = row.locator("select");
  await select.selectOption("operador");
  await expect(select).toBeDisabled();
  await expect(select).toBeEnabled();
  await page.reload();

  const updatedRow = page.locator("tbody tr", { hasText: pendiente.email });
  await expect(updatedRow.locator("select")).toHaveValue("operador");
});

test("un profesor no puede ver /admin/usuarios", async ({ page }) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/usuarios`
  );

  await expect(
    page.getByRole("heading", { name: "Esta sección aún no existe para tu rol" })
  ).toBeVisible();
});

test("un admin no puede modificar su propio rol ni estado", async ({ page }) => {
  const admin = await createTestUser("admin");

  await loginAs(page, admin);

  const ownRow = page.locator("tbody tr", { hasText: admin.email });
  await expect(ownRow.locator("select")).toBeDisabled();
  await expect(ownRow.locator("button")).toBeDisabled();
});
