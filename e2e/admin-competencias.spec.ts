import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";
import { nombreUnico } from "./fixtures/nombres";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearLoteDePrueba(nombre: string, creadoPorId: string): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4) returning id",
      [nombre, "Orellana", "2026-08-14", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

async function crearCompetenciaDePrueba(
  nombre: string,
  habilitaOperar: boolean,
  creadaPorId: string
): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.competencias (nombre, habilita_operar, created_by) values ($1, $2, $3) returning id",
      [nombre, habilitaOperar, creadaPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un profesor crea una competencia y se la valida a un estudiante", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  const nombre = nombreUnico("Esteriliza sustrato");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/competencias`
  );
  await expect(page.getByRole("heading", { name: "Competencias", exact: true })).toBeVisible();

  await page.getByLabel("Nombre").fill(nombre);
  await page.getByLabel("Habilita operar").check();
  await page.getByRole("button", { name: "Guardar" }).click();

  const item = page.locator("li", { hasText: nombre });
  await expect(item).toBeVisible();

  await item.getByLabel("Persona").selectOption({ label: estudiante.email });
  await item.getByRole("button", { name: "Validar" }).click();
  await expect(item.getByRole("button", { name: "Revocar" })).toBeVisible();
});

test("un estudiante sin competencia habilitante no ve el formulario de registrar", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote sin competencia"), profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await expect(page.getByRole("heading", { name: "Bitácora", exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver mis competencias" })).toBeVisible();
});

test("validar una competencia habilitante desbloquea el registro, y revocarla lo vuelve a bloquear", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote gate"), profesor.id);
  const competenciaId = await crearCompetenciaDePrueba(
    nombreUnico("Opera cultivo"),
    true,
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      "insert into public.competencias_validadas (competencia_id, user_id, validado_por) values ($1, $2, $3)",
      [competenciaId, estudiante.id, profesor.id]
    );
  } finally {
    await db.end();
  }

  // Con la competencia validada, el estudiante registra normalmente.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("200ml");

  // Se le revoca y el formulario desaparece.
  const db2 = new Client({ connectionString: DB_URL });
  await db2.connect();
  try {
    await db2.query("delete from public.competencias_validadas where user_id = $1", [
      estudiante.id,
    ]);
  } finally {
    await db2.end();
  }

  await page.goto(`/admin/lotes/${loteId}`);
  await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
});

test("un operador sin ninguna competencia validada registra normalmente", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote operador"), profesor.id);
  const operador = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(operador.email)}&password=${encodeURIComponent(operador.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("humedad");
  await page.getByLabel("Valor").fill("85%");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Humedad" })).toContainText("85%");
});

test("un estudiante sin competencia no puede insertar un registro directamente, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote RLS"), profesor.id);
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
        "insert into public.registros (lote_id, user_id, tipo, valor) values ($1, $2, $3, $4)",
        [loteId, estudiante.id, "riego", "sin competencia"]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un estudiante no puede validarse una competencia a sí mismo, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const competenciaId = await crearCompetenciaDePrueba(
    nombreUnico("Autovalidada"),
    true,
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
    await expect(
      db.query(
        "insert into public.competencias_validadas (competencia_id, user_id, validado_por) values ($1, $2, $3)",
        [competenciaId, estudiante.id, estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un estudiante ve el catálogo pero no el formulario de crear competencias", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const nombre = nombreUnico("Visible para todos");
  await crearCompetenciaDePrueba(nombre, false, profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/competencias`
  );
  await expect(page.getByRole("heading", { name: "Competencias", exact: true })).toBeVisible();

  // Ve la competencia en su checklist...
  await expect(page.locator("tbody tr", { hasText: nombre })).toBeVisible();
  // ...pero no la sección de catálogo ni su formulario.
  await expect(page.getByRole("heading", { name: "Catálogo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
});

test("un profesor edita una competencia del catálogo", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const nombreOriginal = nombreUnico("Competencia a editar");
  const competenciaId = await crearCompetenciaDePrueba(nombreOriginal, false, profesor.id);
  const nombreNuevo = nombreUnico("Competencia ya editada");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/competencias/${competenciaId}/editar`
  );
  await expect(page.getByRole("heading", { name: "Editar competencia" })).toBeVisible();

  await page.getByLabel("Nombre").fill(nombreNuevo);
  await page.getByLabel("Habilita operar").check();
  await page.getByRole("button", { name: "Guardar" }).click();

  // El cambio quedó persistido: se ve al volver al catálogo.
  await page.goto("/admin/competencias");
  await expect(page.locator("li", { hasText: nombreNuevo })).toBeVisible();
  await expect(page.locator("li", { hasText: nombreOriginal })).toHaveCount(0);
});

test("un profesor elimina una competencia del catálogo", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const nombre = nombreUnico("Competencia a eliminar");
  await crearCompetenciaDePrueba(nombre, false, profesor.id);

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/competencias`
  );
  const item = page.locator("li", { hasText: nombre });
  await expect(item).toBeVisible();

  await item.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.locator("li", { hasText: nombre })).toHaveCount(0);
});

test("un estudiante que visita la ruta de editar es redirigido al catálogo", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const competenciaId = await crearCompetenciaDePrueba(
    nombreUnico("No editable por estudiante"),
    false,
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  // Primero se entra a una página cualquiera del admin para que el login por
  // cliente termine su redirect; recién después se navega a la ruta bajo
  // prueba. Sin esa espera, el segundo goto sale sin sesión y el test pasaría
  // por el motivo equivocado.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/competencias`
  );
  await expect(page.getByRole("heading", { name: "Competencias", exact: true })).toBeVisible();

  await page.goto(`/admin/competencias/${competenciaId}/editar`);
  await expect(page).toHaveURL(/\/admin\/competencias$/);
});
