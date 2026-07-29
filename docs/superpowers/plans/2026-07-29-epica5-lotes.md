# Épica 5 — Modelo y CRUD de lotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Existe una tabla `lotes` real, con RLS que permite lectura a cualquier rol aprobado pero escritura solo a `operador`/`profesor`/`admin`, y una UI en `/admin/lotes` para listar, crear y editar lotes — sin capacidad de eliminar.

**Architecture:** RLS por policy de rol (no por `is_admin()` — aquí son tres roles distintos los que pueden escribir), con `grant` explícito desde el día uno (evitando repetir el bug de GRANT faltante de Épica 4). Un componente de formulario compartido (`LoteForm`) reutilizado por las páginas de crear y editar, conectado a Server Actions vía `.bind()` para pasar el `id` en el caso de edición.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (`@supabase/ssr`), Playwright.

## Global Constraints

- `especie` es texto libre, no un catálogo controlado.
- Ningún rol puede eliminar un lote — sin policy de `DELETE`, sin botón de eliminar en la UI.
- La autorización real de crear/editar vive en RLS (policies por rol), no solo en qué botones se muestran — la UI oculta controles como ayuda, no como frontera de seguridad.
- Componentes de servidor por defecto; client components solo donde haya interactividad.
- Commits en español, imperativo, prefijo `cultivo:` (primera vez que se usa este prefijo — Épica 5 es la primera fuera de auth/admin).
- Idioma de la UI: español.

---

### Task 1: Migración — tabla `lotes` y RLS

**Files:**
- Create: `supabase/migrations/00000000000007_lotes.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/00000000000007_lotes.sql`:

```sql
create type public.lote_estado as enum ('incubacion', 'fructificacion', 'cosechado', 'finalizado');

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especie text not null,
  sustrato text,
  fecha_inicio date not null default current_date,
  estado public.lote_estado not null default 'incubacion',
  notas text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lotes enable row level security;

grant select on public.lotes to authenticated;
grant insert, update on public.lotes to authenticated;

create policy "cualquier rol aprobado lee lotes"
  on public.lotes for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "operador, profesor o admin crean lotes"
  on public.lotes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  );

create policy "operador, profesor o admin editan lotes"
  on public.lotes for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  );

-- Sin policy de DELETE para nadie: un lote nunca se borra, solo se marca
-- "finalizado" — trazabilidad completa del historial de cultivo.
```

- [ ] **Step 2: Aplicar localmente y verificar el comportamiento real**

```bash
npx supabase start
npx supabase db reset
```

Expected: las 7 migraciones aplican sin error.

Verificar RLS de verdad, no solo que la tabla existe — usando el mismo método de simulación de sesión (`request.jwt.claims`) documentado en los reportes de tareas anteriores de este proyecto (buscar cómo lo hicieron las tareas de `activity_log` si hace falta referencia):

1. Crear un perfil de prueba con `role = 'estudiante'` e intentar un `insert into lotes` simulando esa sesión — debe fallar por RLS.
2. Crear un perfil de prueba con `role = 'operador'` e intentar el mismo `insert` — debe funcionar.
3. Confirmar que ambos roles pueden hacer `select` sobre `lotes`.
4. Confirmar que no existe ninguna forma de hacer `delete` (ni como admin) — no hay policy que lo permita.

- [ ] **Step 3: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000007_lotes.sql
git commit -m "cultivo: agrega la tabla lotes con RLS por rol (operador/profesor/admin escriben, todos leen)"
```

---

### Task 2: Server Actions y tipos compartidos

**Files:**
- Create: `src/app/admin/lotes/actions.ts`

**Interfaces:**
- Produces: `createLote(values: LoteFormValues): Promise<void>`, `updateLote(id: string, values: LoteFormValues): Promise<void>`, y los tipos `LoteEstado`/`LoteFormValues`, usados por las Tasks 3 y 5.

- [ ] **Step 1: Escribir las Server Actions**

Crear `src/app/admin/lotes/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LoteEstado = "incubacion" | "fructificacion" | "cosechado" | "finalizado";

export interface LoteFormValues {
  nombre: string;
  especie: string;
  sustrato: string;
  fecha_inicio: string;
  estado: LoteEstado;
  notas: string;
}

export async function createLote(values: LoteFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("lotes").insert({
    nombre: values.nombre,
    especie: values.especie,
    sustrato: values.sustrato || null,
    fecha_inicio: values.fecha_inicio,
    estado: values.estado,
    notas: values.notas || null,
    created_by: userId,
  });
  if (error) {
    throw new Error(`No se pudo crear el lote: ${error.message}`);
  }

  revalidatePath("/admin/lotes");
}

export async function updateLote(id: string, values: LoteFormValues) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lotes")
    .update({
      nombre: values.nombre,
      especie: values.especie,
      sustrato: values.sustrato || null,
      fecha_inicio: values.fecha_inicio,
      estado: values.estado,
      notas: values.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`No se pudo actualizar el lote: ${error.message}`);
  }

  revalidatePath("/admin/lotes");
  revalidatePath(`/admin/lotes/${id}`);
}
```

Nota: `LoteEstado`/`LoteFormValues` son exports de tipo (se borran en compilación) — un archivo `"use server"` solo puede exportar funciones async como valores reales en tiempo de ejecución, pero los `type`/`interface` sí son seguros de exportar desde ahí (ya es el patrón usado en `src/app/admin/usuarios/actions.ts` con `UserRole`). No exportar aquí ningún array/constante en tiempo de ejecución (como una lista de estados) — eso vive en el componente de la Task 3 que lo necesita para renderizar.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lotes/actions.ts
git commit -m "cultivo: agrega Server Actions para crear y editar lotes"
```

---

### Task 3: Componente de formulario compartido

**Files:**
- Create: `src/app/admin/lotes/lote-form.tsx`

**Interfaces:**
- Consumes: `LoteEstado`, `LoteFormValues` de `./actions` (Task 2).
- Produces: `LoteForm`, componente usado por la Task 5 (páginas de crear y editar).

- [ ] **Step 1: Escribir el formulario**

Crear `src/app/admin/lotes/lote-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LoteEstado, LoteFormValues } from "./actions";

const ESTADOS: LoteEstado[] = ["incubacion", "fructificacion", "cosechado", "finalizado"];

export function LoteForm({
  initialValues,
  onSubmit,
}: {
  initialValues: LoteFormValues;
  onSubmit: (values: LoteFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            router.push("/admin/lotes");
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Nombre
        <input
          required
          value={values.nombre}
          onChange={(e) => setValues({ ...values, nombre: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Especie
        <input
          required
          value={values.especie}
          onChange={(e) => setValues({ ...values, especie: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Sustrato
        <input
          value={values.sustrato}
          onChange={(e) => setValues({ ...values, sustrato: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Fecha de inicio
        <input
          type="date"
          required
          value={values.fecha_inicio}
          onChange={(e) => setValues({ ...values, fecha_inicio: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Estado
        <select
          value={values.estado}
          onChange={(e) => setValues({ ...values, estado: e.target.value as LoteEstado })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Notas
        <textarea
          value={values.notas}
          onChange={(e) => setValues({ ...values, notas: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Guardar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores (este componente todavía no se usa desde ninguna página — eso es la Task 5 — así que no hay verificación de build completo todavía en este paso).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lotes/lote-form.tsx
git commit -m "cultivo: agrega el formulario compartido de lote"
```

---

### Task 4: Página de lista y nav

**Files:**
- Create: `src/app/admin/lotes/page.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Agregar "Lotes" al nav**

En `src/app/admin/layout.tsx`, agregar el link a "Lotes" **fuera** del condicional `role === "admin"` (visible a cualquier rol aprobado, como "Mi perfil"). Colocarlo entre el bloque admin-only y el link de "Mi perfil":

```tsx
            {profile.role === "admin" && (
              <>
                <Link href="/admin/usuarios" className="text-tinta/70 hover:text-tinta">
                  Usuarios
                </Link>
                <Link href="/admin/auditoria" className="text-tinta/70 hover:text-tinta">
                  Auditoría
                </Link>
              </>
            )}
            <Link href="/admin/lotes" className="text-tinta/70 hover:text-tinta">
              Lotes
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```

- [ ] **Step 2: Crear la página de lista**

Crear `src/app/admin/lotes/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function LotesPage() {
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

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, nombre, especie, estado, fecha_inicio")
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Lotes</h1>
        {canEdit && (
          <Link
            href="/admin/lotes/nuevo"
            className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
          >
            Nuevo lote
          </Link>
        )}
      </div>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Nombre</th>
            <th className="py-2 pr-4">Especie</th>
            <th className="py-2 pr-4">Estado</th>
            <th className="py-2">Fecha de inicio</th>
          </tr>
        </thead>
        <tbody>
          {(lotes ?? []).map((lote) => (
            <tr key={lote.id} className="border-b border-tinta/5">
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
              <td className="py-2 pr-4">{lote.especie}</td>
              <td className="py-2 pr-4">{lote.estado}</td>
              <td className="py-2">{lote.fecha_inicio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck y build**

Run: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run typecheck && npm run build`
Expected: sin errores. El build fallará al intentar prerenderizar cualquier link a `/admin/lotes/nuevo` o `/admin/lotes/[id]` porque esas rutas no existen todavía — eso es esperado en este punto, se resuelve en la Task 5. Si el build falla por otra razón, investigar antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/lotes/page.tsx
git commit -m "cultivo: agrega la lista de lotes en /admin/lotes y el link al nav"
```

---

### Task 5: Páginas de crear y editar

**Files:**
- Create: `src/app/admin/lotes/nuevo/page.tsx`
- Create: `src/app/admin/lotes/[id]/page.tsx`

**Interfaces:**
- Consumes: `LoteForm` de `../lote-form` (Task 3); `createLote`, `updateLote` de `../actions` (Task 2).

- [ ] **Step 1: Página de crear**

Crear `src/app/admin/lotes/nuevo/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { createLote } from "../actions";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function NuevoLotePage() {
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

  if (!profile || !ROLES_QUE_EDITAN.includes(profile.role)) {
    redirect("/admin/lotes");
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Nuevo lote</h1>
      <div className="mt-8">
        <LoteForm
          initialValues={{
            nombre: "",
            especie: "",
            sustrato: "",
            fecha_inicio: new Date().toISOString().slice(0, 10),
            estado: "incubacion",
            notas: "",
          }}
          onSubmit={createLote}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Página de editar**

Crear `src/app/admin/lotes/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoteForm } from "../lote-form";
import { updateLote } from "../actions";

const ROLES_QUE_EDITAN = ["operador", "profesor", "admin"];

export default async function EditarLotePage({
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

  if (!profile || !ROLES_QUE_EDITAN.includes(profile.role)) {
    redirect("/admin/lotes");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("id, nombre, especie, sustrato, fecha_inicio, estado, notas")
    .eq("id", id)
    .single();

  if (!lote) {
    notFound();
  }

  const updateLoteBound = updateLote.bind(null, lote.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Editar lote</h1>
      <div className="mt-8">
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
      </div>
    </main>
  );
}
```

Nota: `updateLote.bind(null, lote.id)` es el patrón soportado por Next.js para pasar argumentos adicionales a una Server Action antes de entregarla a un Client Component — no envolver la acción en una función flecha nueva (`(values) => updateLote(lote.id, values)`), eso pierde la referencia de Server Action que Next.js necesita para serializarla correctamente.

- [ ] **Step 3: Verificar build completo**

```bash
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key-for-ci-build"
npm run lint && npm run typecheck && npm run build && npm run test
```

Expected: sin errores. `/admin/lotes`, `/admin/lotes/nuevo` y `/admin/lotes/[id]` aparecen en la tabla de rutas del build.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/lotes/nuevo src/app/admin/lotes/[id]
git commit -m "cultivo: agrega las páginas de crear y editar lotes"
```

---

### Task 6: E2E de lotes

**Files:**
- Create: `e2e/admin-lotes.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `e2e/fixtures/test-users.ts` (ya existe).

- [ ] **Step 1: Escribir los E2E**

Crear `e2e/admin-lotes.spec.ts`:

```ts
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
```

- [ ] **Step 2: Correr contra el stack local y verificar que pasan**

```bash
npx supabase start
export $(npx supabase status -o env | xargs)
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_E2E_TEST_MODE=true
npm run test:e2e -- e2e/admin-lotes.spec.ts --workers=1
```

Expected: 3 tests PASS.

- [ ] **Step 3: Correr la suite completa una vez más en serie**

```bash
npm run test:e2e -- --workers=1
```

Expected: todos los E2E PASS (públicos, auth-gate, admin-usuarios, admin-perfil, admin-auditoria, admin-lotes).

- [ ] **Step 4: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 5: Commit**

```bash
git add e2e/admin-lotes.spec.ts
git commit -m "test: agrega E2E de lotes (crear, lectura sin edición para estudiante, editar estado)"
```

---

## Post-plan: verificación en CI y sincronización de producción

Push y confirmar el pipeline completo en GitHub Actions antes de mergear a `main`. Después de mergear, aplicar la migración 7 al proyecto real de Supabase (con confirmación explícita del usuario) — como ya pasó dos veces en épicas anteriores, el código en `main` se despliega a Vercel automáticamente pero la base de datos real necesita la migración aplicada por separado.
