import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

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
  await expect(page.getByRole("heading", { name: "Editar lote" })).toBeVisible();

  await page.getByLabel("Estado").selectOption("fructificacion");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("heading", { name: "Lotes" })).toBeVisible();
  const row = page.locator("tbody tr", { hasText: "Lote a editar" });
  await expect(row).toContainText("fructificacion");
});
