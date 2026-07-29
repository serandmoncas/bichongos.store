# Épica 5 — Registro de tareas y bitácora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier rol aprobado (estudiante incluido) puede registrar una tarea sobre un lote y ver su bitácora completa desde `/admin/lotes/[id]`, que pasa de ser una página exclusiva de edición a una página de detalle abierta a todos — el formulario de editar el lote se sigue mostrando solo a operador/profesor/admin, ahora como sección condicional.

**Architecture:** Misma disciplina que `lotes`: RLS es la frontera real (un usuario solo puede insertar registros con su propio `user_id`, verificado por policy — no por la Server Action), registros son inmutables (sin UPDATE/DELETE), y `/admin/lotes/[id]` se reescribe para combinar detalle + bitácora + formulario de registro en una sola página condicional por rol.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (`@supabase/ssr`), Playwright.

## Global Constraints

- `user_id` de un registro sale exclusivamente de la sesión autenticada (`getClaims().claims.sub`), nunca de un parámetro de la Server Action — la garantía real de que nadie registra a nombre de otro vive en RLS (`user_id = auth.uid()` en el `with check`).
- Los registros son inmutables: sin Server Action de editar ni eliminar, sin policy de UPDATE/DELETE.
- Componentes de servidor por defecto; client components solo donde haya interactividad.
- Commits en español, imperativo, prefijo `cultivo:`.
- Idioma de la UI: español.

---

### Task 1: Migración — tabla `registros` y RLS

**Files:**
- Create: `supabase/migrations/00000000000008_registros.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/00000000000008_registros.sql`:

```sql
create type public.registro_tipo as enum ('riego', 'humedad', 'temperatura', 'observacion');

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  tipo public.registro_tipo not null,
  valor text not null,
  foto_url text,
  created_at timestamptz not null default now()
);

alter table public.registros enable row level security;

grant select on public.registros to authenticated;
grant insert on public.registros to authenticated;

create policy "cualquier rol aprobado lee registros"
  on public.registros for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "cualquier rol aprobado crea sus propios registros"
  on public.registros for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

-- Sin policy de UPDATE ni DELETE: un registro es una entrada de bitácora
-- de un momento específico, inmutable — mismo principio que lotes (nunca
-- se borra) y activity_log (solo el trigger escribe).
```

- [ ] **Step 2: Aplicar localmente y verificar el comportamiento real**

```bash
npx supabase start
npx supabase db reset
```

Expected: las 8 migraciones aplican sin error.

Verificar RLS de verdad (mismo método de simulación de sesión vía `request.jwt.claims` usado en las tareas de `lotes` y `activity_log`):

1. Crear dos perfiles de prueba con `role = 'estudiante'` (usuario A y usuario B) y un lote de prueba (insertado directamente, o vía un perfil `operador`).
2. Simulando la sesión de A, insertar un registro con `user_id = A` sobre ese lote — debe funcionar.
3. Simulando la sesión de A, intentar insertar un registro con `user_id = B` — debe fallar por RLS.
4. Confirmar que tanto A como B pueden hacer `select` sobre `registros` (ven todos los registros, no solo los propios).
5. Confirmar que no existe forma de hacer `update` ni `delete` sobre un registro (ningún rol, ninguna policy lo permite).

- [ ] **Step 3: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000008_registros.sql
git commit -m "cultivo: agrega la tabla registros con RLS (cualquier rol aprobado crea los suyos, inmutables)"
```

---

### Task 2: Server Action y formulario de registrar tarea

**Files:**
- Create: `src/app/admin/lotes/registros-actions.ts`
- Create: `src/app/admin/lotes/[id]/registro-form.tsx`

**Interfaces:**
- Produces: `createRegistro(loteId: string, tipo: RegistroTipo, valor: string): Promise<void>` y el tipo `RegistroTipo`, usados por `RegistroForm` (este mismo task) y por la Task 3 (página de detalle, para el tipo).
- Produces: `RegistroForm`, componente usado por la Task 3.

- [ ] **Step 1: Escribir la Server Action**

Crear `src/app/admin/lotes/registros-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RegistroTipo = "riego" | "humedad" | "temperatura" | "observacion";

export async function createRegistro(loteId: string, tipo: RegistroTipo, valor: string) {
  const trimmed = valor.trim();
  if (!trimmed) {
    throw new Error("El valor no puede estar vacío");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("registros").insert({
    lote_id: loteId,
    user_id: userId,
    tipo,
    valor: trimmed,
  });
  if (error) {
    throw new Error(`No se pudo registrar la tarea: ${error.message}`);
  }

  revalidatePath(`/admin/lotes/${loteId}`);
}
```

- [ ] **Step 2: Escribir el formulario**

Crear `src/app/admin/lotes/[id]/registro-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRegistro, type RegistroTipo } from "../registros-actions";

const TIPOS: { value: RegistroTipo; label: string }[] = [
  { value: "riego", label: "Riego" },
  { value: "humedad", label: "Humedad" },
  { value: "temperatura", label: "Temperatura" },
  { value: "observacion", label: "Observación" },
];

export function RegistroForm({ loteId }: { loteId: string }) {
  const [tipo, setTipo] = useState<RegistroTipo>("observacion");
  const [valor, setValor] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const trimmed = valor.trim();

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setError(null);
        startTransition(async () => {
          try {
            await createRegistro(loteId, tipo, trimmed);
            setValor("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo registrar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as RegistroTipo)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Valor
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={!trimmed || isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Registrar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
```

Nota: el formulario usa `router.refresh()` (no `router.push`) porque el objetivo es quedarse en la misma página de detalle y ver la bitácora actualizada, a diferencia de `LoteForm` que navega de vuelta a la lista tras guardar.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sin errores (este formulario todavía no se usa desde ninguna página — eso es la Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/lotes/registros-actions.ts src/app/admin/lotes/[id]/registro-form.tsx
git commit -m "cultivo: agrega Server Action y formulario para registrar tareas"
```

---

### Task 3: Reescribir `/admin/lotes/[id]` como página de detalle

**Files:**
- Modify: `src/app/admin/lotes/[id]/page.tsx`

**Interfaces:**
- Consumes: `RegistroForm` de `./registro-form` (Task 2); `LoteForm`/`updateLote` de `../lote-form`/`../actions` (ya existen).

- [ ] **Step 1: Reescribir la página**

Reemplazar el contenido completo de `src/app/admin/lotes/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { updateLote } from "../actions";
import { RegistroForm } from "./registro-form";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

const TIPO_LABELS: Record<string, string> = {
  riego: "Riego",
  humedad: "Humedad",
  temperatura: "Temperatura",
  observacion: "Observación",
};

export default async function LoteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  const canEdit = ROLES_QUE_EDITAN.includes(profile?.role ?? "");

  const { data: lote } = await supabase
    .from("lotes")
    .select("id, nombre, especie, sustrato, fecha_inicio, estado, notas")
    .eq("id", id)
    .single();

  if (!lote) {
    notFound();
  }

  const { data: registros } = await supabase
    .from("registros")
    .select("id, user_id, tipo, valor, created_at")
    .eq("lote_id", id)
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((registros ?? []).map((r) => r.user_id)));
  const { data: perfiles } = userIds.length
    ? await supabase.from("profiles").select("id, nombre, email").in("id", userIds)
    : { data: [] as { id: string; nombre: string | null; email: string }[] };

  const nombreDe = (userId: string) => {
    const p = perfiles?.find((p) => p.id === userId);
    return p?.nombre ?? p?.email ?? userId;
  };

  const updateLoteBound = updateLote.bind(null, lote.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">{lote.nombre}</h1>

      <div className="mt-8">
        {canEdit ? (
          <LoteForm
            initialValues={{
              nombre: lote.nombre,
              especie: lote.especie,
              sustrato: lote.sustrato ?? "",
              fecha_inicio: lote.fecha_inicio,
              estado: lote.estado,
              notas: lote.notas ?? "",
            }}
            onSubmit={updateLoteBound}
          />
        ) : (
          <dl className="max-w-md space-y-2 font-mono text-sm">
            <div>
              <dt className="text-tinta/50">Especie</dt>
              <dd>{lote.especie}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Sustrato</dt>
              <dd>{lote.sustrato ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Fecha de inicio</dt>
              <dd>{lote.fecha_inicio}</dd>
            </div>
            <div>
              <dt className="text-tinta/50">Estado</dt>
              <dd className="uppercase text-musgo-oscuro">{lote.estado}</dd>
            </div>
            {lote.notas && (
              <div>
                <dt className="text-tinta/50">Notas</dt>
                <dd>{lote.notas}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-xl font-semibold">Bitácora</h2>
        <table className="mt-4 w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Quién</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Valor</th>
              <th className="py-2">Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {(registros ?? []).map((registro) => (
              <tr key={registro.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">{nombreDe(registro.user_id)}</td>
                <td className="py-2 pr-4">{TIPO_LABELS[registro.tipo] ?? registro.tipo}</td>
                <td className="py-2 pr-4">{registro.valor}</td>
                <td className="py-2">{new Date(registro.created_at).toLocaleString("es")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <RegistroForm loteId={lote.id} />
      </div>
    </main>
  );
}
```

Nota: se elimina el redirect por `ROLES_QUE_EDITAN` que la versión anterior tenía al inicio de la función — esa restricción ahora solo condiciona QUÉ se muestra (formulario de edición vs. datos de solo lectura), no si se puede entrar a la página.

- [ ] **Step 2: Typecheck y build**

Run: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run typecheck && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lotes/[id]/page.tsx
git commit -m "cultivo: convierte /admin/lotes/[id] en detalle abierto a todos con bitácora"
```

---

### Task 4: Lista de lotes — cualquier rol entra al detalle

**Files:**
- Modify: `src/app/admin/lotes/page.tsx`

- [ ] **Step 1: Quitar la condición de `canEdit` sobre el link de cada fila**

En `src/app/admin/lotes/page.tsx`, reemplazar:

```tsx
              <td className="py-2 pr-4">
                {canEdit ? (
                  <Link
                    href={`/admin/lotes/${lote.id}`}
                    className="text-musgo-oscuro underline"
                  >
                    {lote.nombre}
                  </Link>
                ) : (
                  lote.nombre
                )}
              </td>
```

por:

```tsx
              <td className="py-2 pr-4">
                <Link href={`/admin/lotes/${lote.id}`} className="text-musgo-oscuro underline">
                  {lote.nombre}
                </Link>
              </td>
```

El botón "Nuevo lote" (arriba de la tabla) se queda igual, todavía condicionado a `canEdit` — eso no cambia en esta historia.

- [ ] **Step 2: Verificar build completo**

```bash
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key-for-ci-build"
npm run lint && npm run typecheck && npm run build && npm run test
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lotes/page.tsx
git commit -m "cultivo: cualquier rol aprobado puede entrar al detalle de un lote desde la lista"
```

---

### Task 5: E2E de registros y bitácora

**Files:**
- Create: `e2e/admin-registros.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `e2e/fixtures/test-users.ts` (ya existe, ya devuelve `id`).

- [ ] **Step 1: Escribir los E2E**

Crear `e2e/admin-registros.spec.ts`:

```ts
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
      [nombre, "Orellana", "2026-07-29", operador.id]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un estudiante registra una tarea y la ve en la bitácora sin recargar", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote bitácora estudiante");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();

  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();

  const row = page.locator("tbody tr", { hasText: "Riego" });
  await expect(row).toContainText("200ml");
});

test("un estudiante ve el lote de solo lectura, sin el formulario de editar", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote solo lectura");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );

  await expect(page.getByLabel("Estado")).toHaveCount(0);
  await expect(page.getByText("Orellana")).toBeVisible();
});

test("un operador sigue pudiendo editar el lote desde la misma página", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote editable");
  const operador = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(operador.email)}&password=${encodeURIComponent(operador.password)}&next=/admin/lotes/${loteId}`
  );

  const select = page.getByLabel("Estado");
  await select.selectOption("fructificacion");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/lotes$/);
});

test("un usuario no puede registrar una tarea a nombre de otro, RLS lo rechaza", async () => {
  const loteId = await crearLoteDePrueba("Lote suplantación");
  const estudianteA = await createTestUser("estudiante");
  const estudianteB = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: estudianteA.id, role: "authenticated" })}'`
    );
    await expect(
      db.query(
        "insert into public.registros (lote_id, user_id, tipo, valor) values ($1, $2, $3, $4)",
        [loteId, estudianteB.id, "observacion", "suplantando a otro"]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});
```

- [ ] **Step 2: Correr contra el stack local y verificar que pasan**

```bash
npx supabase start
export $(npx supabase status -o env | xargs)
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_E2E_TEST_MODE=true
npm run test:e2e -- e2e/admin-registros.spec.ts --workers=1
```

Expected: 4 tests PASS. Si `getByLabel("Estado")` en el segundo test encuentra un elemento inesperado, confirmar que la versión de solo lectura de la página (sección `<dl>`) no usa la palabra "Estado" como `<label>` de ningún control interactivo — solo como `<dt>` de texto plano, que `getByLabel` no debería matchear.

- [ ] **Step 3: Correr la suite completa una vez más en serie**

```bash
npm run test:e2e -- --workers=1
```

Expected: todos los E2E PASS.

- [ ] **Step 4: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 5: Commit**

```bash
git add e2e/admin-registros.spec.ts
git commit -m "test: agrega E2E de registros y bitácora (crear, solo lectura para estudiante, RLS contra suplantación)"
```

---

## Post-plan: verificación en CI y sincronización de producción

Push y confirmar el pipeline completo en GitHub Actions antes de mergear a `main`. Después de mergear, aplicar la migración 8 al proyecto real de Supabase (con confirmación explícita del usuario), como ya es rutina en este proyecto.
