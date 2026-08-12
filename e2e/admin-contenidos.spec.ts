import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearContenidoDePrueba(
  titulo: string,
  categoria: "ficha_especie" | "sop",
  nivel: string | null,
  creadoPorId: string
): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.contenidos (titulo, categoria, nivel, cuerpo, created_by) values ($1, $2, $3, $4, $5) returning id",
      [titulo, categoria, nivel, "Cuerpo de prueba", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un profesor crea un contenido y el detalle lo renderiza como markdown, no texto plano", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/nuevo`
  );
  await page.getByLabel("Título").fill("Ficha de prueba");
  await page.getByLabel("Categoría").selectOption("ficha_especie");
  await page.getByLabel("Nivel").fill("N1");
  await page
    .getByLabel("Cuerpo (Markdown)")
    .fill("# Encabezado\n\n| Columna A | Columna B |\n| --- | --- |\n| 1 | 2 |\n");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await page.getByRole("link", { name: "Ficha de prueba" }).click();

  await expect(page.getByRole("heading", { name: "Encabezado" })).toBeVisible();
  const celda = page.locator("table td", { hasText: "2" });
  await expect(celda).toBeVisible();
});

test("un estudiante ve el contenido pero no los controles de crear/editar/eliminar", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido solo lectura",
    "sop",
    "N2",
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos`
  );
  // /e2e-login inicia sesión del lado del cliente (signInWithPassword) y solo
  // después redirige con window.location.href — eso pasa DESPUÉS de que
  // page.goto() ya se resolvió. Si la primera aserción tras el login es
  // negativa (que un elemento NO exista), es trivialmente cierta también en
  // la propia página de login a medio cargar, así que no fuerza ninguna
  // espera real. Sin una espera explícita acá, el próximo page.goto() de
  // abajo puede llegar al servidor antes de que la cookie de sesión exista,
  // y termina viendo /login en vez del contenido. Por eso la primera
  // aserción tiene que ser POSITIVA (algo que solo es cierto una vez que la
  // redirección a /admin/contenidos ya ocurrió), igual que hace el test del
  // "nivel" más abajo.
  await expect(page.getByRole("heading", { name: "Contenidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo contenido" })).toHaveCount(0);

  await page.goto(`/admin/contenidos/${contenidoId}`);
  await expect(page.getByRole("heading", { name: "Contenido solo lectura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("un estudiante no puede crear contenido directamente, RLS lo rechaza", async () => {
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
        "insert into public.contenidos (titulo, categoria, cuerpo, created_by) values ($1, $2, $3, $4)",
        ["Intento estudiante", "sop", "cuerpo", estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un profesor distinto puede editar el contenido de otro, y queda registrado quién lo editó", async ({
  page,
}) => {
  const profesorA = await createTestUser("profesor");
  const profesorB = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido editado por otro",
    "ficha_especie",
    "N1",
    profesorA.id
  );

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesorB.email)}&password=${encodeURIComponent(profesorB.password)}&next=/admin/contenidos/${contenidoId}/editar`
  );
  await page.getByLabel("Título").fill("Título editado por B");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: "Título editado por B" })).toBeVisible();

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query("select updated_by from public.contenidos where id = $1", [
      contenidoId,
    ]);
    expect(result.rows[0].updated_by).toBe(profesorB.id);
  } finally {
    await db.end();
  }
});

test("un profesor puede eliminar un contenido", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido a eliminar",
    "sop",
    null,
    profesor.id
  );

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: "Contenido a eliminar" })).toHaveCount(0);
});

test("el nivel es metadata visible pero no restringe el acceso de un estudiante", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido nivel avanzado",
    "sop",
    "N4",
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await expect(page.getByRole("heading", { name: "Contenido nivel avanzado" })).toBeVisible();
  await expect(page.getByText("N4")).toBeVisible();
});
