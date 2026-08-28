import { test, expect } from "@playwright/test";

// La página /growbox es pública y estática: no toca Supabase ni necesita sesión.
// Estos tests cubren los criterios de aceptación de la spec de la página.

test("cualquiera puede abrir /growbox sin sesión y ver la cápsula", async ({
  page,
}) => {
  await page.goto("/growbox");

  await expect(page).toHaveURL(/\/growbox$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Una caja que sabe/ })
  ).toBeVisible();
  await expect(page.locator(".hero-img")).toBeVisible();
});

test("desde la landing se llega a /growbox en un clic", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: /Ver la cápsula por dentro/ }).click();

  await expect(page).toHaveURL(/\/growbox$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Una caja que sabe/ })
  ).toBeVisible();
});

test("cada pestaña muestra contenido distinto", async ({ page }) => {
  await page.goto("/growbox");

  const sistema = page.getByRole("tab", { name: "El sistema" });
  const panel = page.getByRole("tab", { name: "El panel de control" });
  const app = page.getByRole("tab", { name: "La app móvil" });
  const ha = page.getByRole("tab", { name: "Home Assistant" });

  // Al entrar manda la primera pestaña.
  await expect(sistema).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Cada fase pide un clima distinto" })
  ).toBeVisible();

  await panel.click();
  await expect(panel).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Una pantalla que mira la cápsula por dentro" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cada fase pide un clima distinto" })
  ).toBeHidden();

  await app.click();
  await expect(
    page.getByRole("heading", { name: "La cápsula en el bolsillo" })
  ).toBeVisible();

  await ha.click();
  await expect(
    page.getByRole("heading", { name: "La cápsula, dentro de una casa inteligente" })
  ).toBeVisible();
});

test("las pestañas se recorren con el teclado", async ({ page }) => {
  await page.goto("/growbox");

  await page.getByRole("tab", { name: "El sistema" }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("tab", { name: "El panel de control" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(
    page.getByRole("heading", { name: "Una pantalla que mira la cápsula por dentro" })
  ).toBeVisible();
});

test("al terminar la página está el CTA de contacto de Bichongos", async ({
  page,
}) => {
  await page.goto("/growbox");

  await expect(
    page.getByRole("heading", {
      name: /¿Restaurante, tienda o querés probar Bichongos\?/,
    })
  ).toBeVisible();
});
