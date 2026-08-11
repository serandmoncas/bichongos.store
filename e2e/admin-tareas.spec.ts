import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearLoteDePrueba(nombre: string): Promise<string> {
  const operador = await createTestUser("operador");
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4) returning id",
      [nombre, "Orellana", "2026-08-08", operador.id]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

async function asignarTareaDirecto(
  loteId: string,
  tipo: string,
  asignadoA: string,
  asignadoPor: string
) {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      "insert into public.tareas_asignadas (lote_id, tipo, asignado_a, asignado_por) values ($1, $2, $3, $4)",
      [loteId, tipo, asignadoA, asignadoPor]
    );
  } finally {
    await db.end();
  }
}

test("un profesor asigna una tarea y el estudiante la ve pendiente en /admin/tareas", async ({
  page,
}) => {
  await crearLoteDePrueba("Lote asignación básica");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/tareas`
  );
  await expect(page.getByRole("heading", { name: "Asignar tarea" })).toBeVisible();

  await page.getByLabel("Lote").selectOption({ label: "Lote asignación básica" });
  await page.getByLabel("Persona").selectOption({ label: estudiante.email });
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByRole("button", { name: "Asignar" }).click();

  // /admin/tareas para profesor/admin muestra TODAS las tareas del sistema
  // (CA4), no solo las de este test — bajo ejecución en paralelo puede
  // haber otras filas "Riego" de otros tests corriendo al mismo tiempo.
  // Se acota primero por el nombre del lote, único por test.
  const filaProfesor = page.locator("tbody tr").filter({ hasText: "Lote asignación básica" });
  await expect(filaProfesor).toContainText("Riego");
  await expect(filaProfesor).toContainText("Pendiente");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/tareas`
  );
  const filaEstudiante = page.locator("tbody tr", { hasText: "Riego" });
  await expect(filaEstudiante).toContainText("Pendiente");

  // CA4 dice que profesor/admin ven TODAS las tareas del sistema, no solo
  // las que ellos mismos asignaron. Lo anterior solo probó que el primer
  // profesor ve la tarea que él mismo acaba de crear — eso también sería
  // cierto con una policy más restrictiva de "veo lo que yo asigné". Para
  // probar la diferencia de verdad, un SEGUNDO profesor asigna una tarea
  // (vía SQL directo) a un tercer usuario, y confirmamos que el PRIMER
  // profesor la ve igual en su propio /admin/tareas.
  const otroLoteId = await crearLoteDePrueba("Lote asignado por otro profesor");
  const otroProfesor = await createTestUser("profesor");
  const otroEstudiante = await createTestUser("estudiante");
  await asignarTareaDirecto(otroLoteId, "humedad", otroEstudiante.id, otroProfesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/tareas`
  );
  const filaDeOtroProfesor = page
    .locator("tbody tr")
    .filter({ hasText: "Lote asignado por otro profesor" });
  await expect(filaDeOtroProfesor).toContainText("Humedad");
  await expect(filaDeOtroProfesor).toContainText("Pendiente");
});

test("un estudiante no ve el formulario de asignar tarea", async ({ page }) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/tareas`
  );

  await expect(page.getByRole("heading", { name: "Tareas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asignar tarea" })).toHaveCount(0);
});

test("un estudiante no puede asignar tareas directamente, RLS lo rechaza", async () => {
  const loteId = await crearLoteDePrueba("Lote RLS asignar");
  const estudiante = await createTestUser("estudiante");
  const otro = await createTestUser("estudiante");

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
        "insert into public.tareas_asignadas (lote_id, tipo, asignado_a, asignado_por) values ($1, $2, $3, $4)",
        [loteId, "riego", otro.id, estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("registrar la tarea correcta la completa automáticamente", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote autocompletado");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudiante.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("200ml");

  await page.goto("/admin/tareas");
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("Completada");
});

test("registrar un tipo distinto no completa la tarea asignada", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote sin autocompletar");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudiante.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("observacion");
  await page.getByLabel("Valor").fill("todo normal");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Observación" })).toContainText("todo normal");

  await page.goto("/admin/tareas");
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("Pendiente");
});

test("si otra persona registra la tarea, la tarea asignada no se completa (CA6)", async ({
  page,
}) => {
  const loteId = await crearLoteDePrueba("Lote otra persona registra");
  const profesor = await createTestUser("profesor");
  const estudianteAsignado = await createTestUser("estudiante");
  const otraPersona = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudianteAsignado.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(otraPersona.email)}&password=${encodeURIComponent(otraPersona.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("otra persona registra esto");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText(
    "otra persona registra esto"
  );

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudianteAsignado.email)}&password=${encodeURIComponent(estudianteAsignado.password)}&next=/admin/tareas`
  );
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("Pendiente");
});

test("un estudiante en /admin/tareas solo ve sus propias tareas, no las de otros", async ({
  page,
}) => {
  const loteId = await crearLoteDePrueba("Lote visibilidad cruzada");
  const profesor = await createTestUser("profesor");
  const estudianteA = await createTestUser("estudiante");
  const estudianteB = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudianteA.id, profesor.id);
  await asignarTareaDirecto(loteId, "humedad", estudianteB.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudianteA.email)}&password=${encodeURIComponent(estudianteA.password)}&next=/admin/tareas`
  );

  await expect(page.locator("tbody tr", { hasText: "Riego" })).toBeVisible();
  await expect(page.locator("tbody tr", { hasText: "Humedad" })).toHaveCount(0);
});
