import { test, expect } from "@playwright/test";

test("la landing pública carga", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Bichongos/i);
});

test("acceder a /admin sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("acceder a /pendiente sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/pendiente");
  await expect(page).toHaveURL(/\/login$/);
});
