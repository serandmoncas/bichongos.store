import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

test("un usuario con rol pendiente ve la pantalla de cuenta pendiente", async ({ page }) => {
  const user = await createTestUser("pendiente");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin`
  );

  await expect(page).toHaveURL(/\/pendiente$/);
  await expect(
    page.getByRole("heading", { name: /cuenta pendiente de aprobación/i })
  ).toBeVisible();
});

test("un usuario con rol admin accede al panel", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin`
  );

  await expect(page).toHaveURL(/\/admin\/usuarios$/);
  await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
});
