import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";
import { nombreUnico } from "./fixtures/nombres";
// Import de tipo puro (se borra al compilar, no acopla el test al runtime de
// la app): agregar una categoría al catálogo no obliga a tocar este archivo.
import type { ContenidoCategoria } from "../src/app/admin/contenidos/categorias";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearContenidoDePrueba(
  titulo: string,
  categoria: ContenidoCategoria,
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
  const titulo = nombreUnico("Ficha de prueba");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/nuevo`
  );
  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Categoría").selectOption("ficha_especie");
  await page.getByLabel("Nivel").fill("N1");
  await page
    .getByLabel("Cuerpo (Markdown)")
    .fill("# Encabezado\n\n| Columna A | Columna B |\n| --- | --- |\n| 1 | 2 |\n");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await page.getByRole("link", { name: titulo }).click();

  await expect(page.getByRole("heading", { name: "Encabezado" })).toBeVisible();
  const celda = page.locator("table td", { hasText: "2" });
  await expect(celda).toBeVisible();
});

test("un estudiante ve el contenido pero no los controles de crear/editar/eliminar", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const titulo = nombreUnico("Contenido solo lectura");
  const contenidoId = await crearContenidoDePrueba(titulo, "sop", "N2", profesor.id);
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
  // CA3 dice "ve la lista completa": no basta con probar la ausencia de
  // controles de gestión, hay que probar que el contenido sembrado
  // realmente aparece listado (la lectura del detalle más abajo ya prueba
  // el SELECT, pero no prueba que la lista lo incluya).
  await expect(page.getByRole("link", { name: titulo })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo contenido" })).toHaveCount(0);

  await page.goto(`/admin/contenidos/${contenidoId}`);
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("un estudiante no puede escribir contenido directamente (INSERT/UPDATE/DELETE), RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    nombreUnico("Contenido protegido"),
    "sop",
    null,
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: estudiante.id, role: "authenticated" })}'`
    );

    // INSERT: una policy denegada en INSERT lanza (WITH CHECK falla). Un
    // error dentro de una transacción la deja abortada — cualquier
    // sentencia posterior fallaría con "current transaction is aborted"
    // aunque sea válida — así que el intento va envuelto en un savepoint
    // y se vuelve a él tras el error, para poder seguir usando la misma
    // transacción (y el mismo role/claims ya seteados) para UPDATE/DELETE.
    await db.query("savepoint before_insert");
    await expect(
      db.query(
        "insert into public.contenidos (titulo, categoria, cuerpo, created_by) values ($1, $2, $3, $4)",
        [nombreUnico("Intento estudiante"), "sop", "cuerpo", estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback to savepoint before_insert");

    // UPDATE/DELETE denegados por RLS NO lanzan: Postgres simplemente no
    // encuentra filas visibles para esa policy y devuelve 0 filas
    // afectadas. Si alguien ampliara la policy de UPDATE o DELETE a
    // estudiante, este test es el único que lo detectaría.
    const upd = await db.query(
      "update public.contenidos set titulo = 'x', updated_by = $1 where id = $2",
      [estudiante.id, contenidoId]
    );
    expect(upd.rowCount).toBe(0);

    const del = await db.query("delete from public.contenidos where id = $1", [contenidoId]);
    expect(del.rowCount).toBe(0);

    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un profesor distinto puede editar el contenido de otro, y queda registrado quién lo editó y cuándo", async ({
  page,
}) => {
  const profesorA = await createTestUser("profesor");
  const profesorB = await createTestUser("profesor");
  const tituloOriginal = nombreUnico("Contenido editado por otro");
  const tituloEditado = nombreUnico("Título editado por B");
  const contenidoId = await crearContenidoDePrueba(
    tituloOriginal,
    "ficha_especie",
    "N1",
    profesorA.id
  );

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesorB.email)}&password=${encodeURIComponent(profesorB.password)}&next=/admin/contenidos/${contenidoId}/editar`
  );
  await page.getByLabel("Título").fill(tituloEditado);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: tituloEditado })).toBeVisible();

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "select updated_by, created_at, updated_at from public.contenidos where id = $1",
      [contenidoId]
    );
    expect(result.rows[0].updated_by).toBe(profesorB.id);
    // CA6 es "queda registrado quién hizo el último cambio Y CUÁNDO": no
    // basta con updated_by, updated_at tiene que haber avanzado más allá
    // del created_at original.
    expect(new Date(result.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(result.rows[0].created_at).getTime()
    );
  } finally {
    await db.end();
  }
});

test("un profesor puede eliminar un contenido", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const titulo = nombreUnico("Contenido a eliminar");
  const contenidoId = await crearContenidoDePrueba(titulo, "sop", null, profesor.id);

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: titulo })).toHaveCount(0);
});

test("el nivel es metadata visible pero no restringe el acceso de un estudiante", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const titulo = nombreUnico("Contenido nivel avanzado");
  const contenidoId = await crearContenidoDePrueba(titulo, "sop", "N4", profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  await expect(page.getByText("N4")).toBeVisible();
});

test("un estudiante que visita /admin/contenidos/nuevo es redirigido a /admin/contenidos", async ({
  page,
}) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/nuevo`
  );
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
});

test("un estudiante que visita /admin/contenidos/[id]/editar es redirigido al detalle", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    nombreUnico("Contenido con guard de edición"),
    "sop",
    null,
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos`
  );
  // Mismo motivo que en el test de "solo lectura" más arriba: la primera
  // aserción tras /e2e-login tiene que ser positiva para garantizar que la
  // cookie de sesión ya existe antes del próximo page.goto().
  await expect(page.getByRole("heading", { name: "Contenidos" })).toBeVisible();

  await page.goto(`/admin/contenidos/${contenidoId}/editar`);
  await expect(page).toHaveURL(new RegExp(`/admin/contenidos/${contenidoId}$`));
});

test("un profesor publica un contenido administrativo sin nivel y el filtro lo aísla", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const tituloAdmin = nombreUnico("Acuerdos de reunión");
  // Un SOP sembrado sirve de control: si el filtro no filtrara nada, este
  // también aparecería en la lista de «Administrativas».
  const tituloSop = nombreUnico("SOP que no debe aparecer");
  await crearContenidoDePrueba(tituloSop, "sop", "N2", profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/nuevo`
  );
  await page.getByLabel("Título").fill(tituloAdmin);
  await page.getByLabel("Categoría").selectOption("administrativa");
  // CA3: el nivel se deja deliberadamente en blanco.
  await page.getByLabel("Cuerpo (Markdown)").fill("Acuerdos del kickoff.");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  const fila = page.locator("tr", { has: page.getByRole("link", { name: tituloAdmin }) });
  await expect(fila.getByText("Administrativa")).toBeVisible();
  await expect(fila.getByText("—")).toBeVisible();

  await page.goto("/admin/contenidos?categoria=administrativa");
  await expect(page.getByRole("link", { name: tituloAdmin })).toBeVisible();
  await expect(page.getByRole("link", { name: tituloSop })).toHaveCount(0);

  // CA4: los contenidos que ya existían siguen filtrándose igual.
  await page.goto("/admin/contenidos?categoria=sop");
  await expect(page.getByRole("link", { name: tituloSop })).toBeVisible();
  await expect(page.getByRole("link", { name: tituloAdmin })).toHaveCount(0);

  // Una categoría que no existe cae de vuelta a «Todas» en vez de filtrar por
  // un valor inválido. "constructor" en particular es el caso que un
  // `esCategoria` habría dado por bueno si usara `in` en vez de
  // `Object.hasOwn`, porque `in` también ve Object.prototype.
  await page.goto("/admin/contenidos?categoria=constructor");
  await expect(page.getByRole("link", { name: tituloAdmin })).toBeVisible();
  await expect(page.getByRole("link", { name: tituloSop })).toBeVisible();
});
