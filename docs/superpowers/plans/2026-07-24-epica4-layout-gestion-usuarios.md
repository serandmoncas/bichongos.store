# Épica 4 — Layout admin + gestión de usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de `/admin` por un layout real (header + nav) y una página de gestión de usuarios donde un admin aprueba cuentas `pendiente`, cambia roles (incluyendo el nuevo rol `operador`) y activa/desactiva perfiles.

**Architecture:** Server Components para lectura (layout, página de usuarios) + Server Actions para las mutaciones (`updateUserRole`, `updateUserEstado`), autorizadas por la RLS existente de `profiles` (no service role). Un solo componente cliente pequeño (`UserRowControls`) para los controles interactivos de cada fila. La restricción "un admin no puede modificarse a sí mismo" vive en el servidor (la Server Action), no solo en la UI.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (`@supabase/ssr`), Vitest, Playwright — todo ya configurado por el harness de ingeniería.

## Global Constraints

- No exponer la `service_role` key en ningún código de cliente ni de Server Action — las mutaciones usan el cliente autenticado normal (`@/lib/supabase/server`), autorizadas por RLS.
- Un admin no puede cambiar su propio rol ni estado desde `/admin/usuarios` — la validación es server-side (Server Action), no solo deshabilitar el control en el cliente.
- Componentes de servidor por defecto; client components solo donde haya interactividad (convención de CLAUDE.md).
- Commits en español, imperativo, prefijo `auth:` (esta épica reutiliza el prefijo ya usado para roles/auth).
- Idioma de la UI: español.

---

### Task 1: Migración del rol `operador` + documentación

**Files:**
- Create: `supabase/migrations/00000000000005_add_operador_role.sql`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: valor `'operador'` en el enum `public.user_role`, usado por las Tasks 3, 5 y 6.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/00000000000005_add_operador_role.sql`:

```sql
-- Nuevo rol para el personal operativo de confianza (ej. Lore y Fredy):
-- más permisos que "estudiante" (puede crear y editar lotes, no solo
-- registrar tareas), pero sin la capacidad de supervisión/asignación de
-- "profesor". ALTER TYPE ... ADD VALUE debe ir solo en su propia
-- migración — Postgres no permite combinarlo con otro DDL que lo use en
-- la misma transacción.
alter type public.user_role add value 'operador' after 'estudiante';
```

- [ ] **Step 2: Aplicar la migración localmente y verificar**

```bash
npx supabase start
npx supabase db reset
```

Expected: las 5 migraciones (incluida la nueva) aplican sin error. Verificar el nuevo valor:

```bash
npx supabase db execute --query "select unnest(enum_range(null::public.user_role))::text"
```

Expected: `pendiente`, `estudiante`, `operador`, `profesor`, `admin` (en ese orden).

- [ ] **Step 3: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 4: Actualizar CLAUDE.md**

En la sección `## Usuarios y roles`, agregar una línea después de la de `estudiante`:

```markdown
- `operador`: registra tareas diarias del cultivo y además crea/edita lotes (más permisos que `estudiante`); no asigna tareas ni supervisa — eso sigue siendo de `profesor`/`admin`.
```

En la sección `## Modelo de datos inicial`, actualizar la línea del enum:

```markdown
- `profiles`: id (= auth.users.id), email, nombre, role (enum: pendiente | estudiante | operador | profesor | admin), estado (activo/inactivo), created_at.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000005_add_operador_role.sql CLAUDE.md
git commit -m "auth: agrega el rol operador al enum de roles"
```

---

### Task 2: Función pura `canEditRow` + test unitario

**Files:**
- Create: `src/lib/admin/can-edit-own-row.ts`
- Create: `src/lib/admin/can-edit-own-row.test.ts`

**Interfaces:**
- Produces: `canEditRow(currentUserId: string, rowUserId: string): boolean`, usado por la Task 3 (Server Actions, para el rechazo server-side) y la Task 5 (deshabilitar los controles en la UI).

- [ ] **Step 1: Escribir el test — falla primero**

Crear `src/lib/admin/can-edit-own-row.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canEditRow } from "./can-edit-own-row";

describe("canEditRow", () => {
  it("permite editar filas de otros usuarios", () => {
    expect(canEditRow("user-a", "user-b")).toBe(true);
  });

  it("no permite editar la propia fila", () => {
    expect(canEditRow("user-a", "user-a")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- src/lib/admin/can-edit-own-row.test.ts`
Expected: FAIL — `Cannot find module './can-edit-own-row'`.

- [ ] **Step 3: Implementar**

Crear `src/lib/admin/can-edit-own-row.ts`:

```ts
export function canEditRow(currentUserId: string, rowUserId: string): boolean {
  return currentUserId !== rowUserId;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- src/lib/admin/can-edit-own-row.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/can-edit-own-row.ts src/lib/admin/can-edit-own-row.test.ts
git commit -m "auth: agrega canEditRow para bloquear auto-modificación de perfil"
```

---

### Task 3: Server Actions de gestión de usuarios

**Files:**
- Create: `src/app/admin/usuarios/actions.ts`

**Interfaces:**
- Consumes: `canEditRow` de `src/lib/admin/can-edit-own-row.ts` (Task 2); `createClient` de `src/lib/supabase/server.ts` (ya existe).
- Produces: `updateUserRole(userId: string, role: UserRole): Promise<void>`, `updateUserEstado(userId: string, estado: "activo" | "inactivo"): Promise<void>`, y el tipo `UserRole`, usados por la Task 5.

- [ ] **Step 1: Escribir las Server Actions**

Crear `src/app/admin/usuarios/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditRow } from "@/lib/admin/can-edit-own-row";

export type UserRole = "pendiente" | "estudiante" | "operador" | "profesor" | "admin";

async function assertCanEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase.auth.getClaims();
  const currentUserId = data?.claims?.sub;
  if (!currentUserId || !canEditRow(currentUserId, userId)) {
    throw new Error("No puedes modificar tu propio perfil desde este panel");
  }
}

export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  await assertCanEdit(supabase, userId);

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el rol: ${error.message}`);
  }

  revalidatePath("/admin/usuarios");
}

export async function updateUserEstado(userId: string, estado: "activo" | "inactivo") {
  const supabase = await createClient();
  await assertCanEdit(supabase, userId);

  const { error } = await supabase.from("profiles").update({ estado }).eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el estado: ${error.message}`);
  }

  revalidatePath("/admin/usuarios");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/usuarios/actions.ts
git commit -m "auth: agrega Server Actions para cambiar rol y estado de usuarios"
```

---

### Task 4: Layout del admin (header + nav) y redirect de /admin

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `Logo` de `@/components/logo` (variante `inline`, ya existe); `signOut` de `@/app/actions/auth` (ya existe).

- [ ] **Step 1: Modificar el layout**

Reemplazar el contenido completo de `src/app/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, nombre")
    .eq("id", user.sub)
    .single();

  if (!profile || profile.role === "pendiente") {
    redirect("/pendiente");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-tinta/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Logo variant="inline" />
          <nav className="flex gap-4 font-mono text-sm uppercase tracking-wide">
            <Link href="/admin/usuarios" className="text-tinta/70 hover:text-tinta">
              Usuarios
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span className="text-tinta/70">
            {profile.nombre ?? profile.email}{" "}
            <span className="uppercase text-musgo-oscuro">({profile.role})</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="uppercase tracking-wide text-musgo-oscuro underline"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Modificar `/admin/page.tsx` para redirigir**

Reemplazar el contenido completo de `src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/usuarios");
}
```

- [ ] **Step 3: Typecheck y build**

Run: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run typecheck && npm run build`
Expected: sin errores (el build fallará al renderizar `/admin/usuarios` porque todavía no existe — eso se resuelve en la Task 5; si el build falla por esa ruta faltante, es esperado en este punto y se verifica de nuevo al final de la Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "auth: agrega header y nav al layout de /admin, redirige a /admin/usuarios"
```

---

### Task 5: Página de gestión de usuarios

**Files:**
- Create: `src/app/admin/usuarios/page.tsx`
- Create: `src/app/admin/usuarios/user-row-controls.tsx`

**Interfaces:**
- Consumes: `updateUserRole`, `updateUserEstado`, `UserRole` de `./actions` (Task 3); `canEditRow` de `@/lib/admin/can-edit-own-row` (Task 2).

- [ ] **Step 1: Crear el componente cliente de controles por fila**

Crear `src/app/admin/usuarios/user-row-controls.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { updateUserRole, updateUserEstado, type UserRole } from "./actions";
import { canEditRow } from "@/lib/admin/can-edit-own-row";

const ROLES: UserRole[] = ["pendiente", "estudiante", "operador", "profesor", "admin"];

export function UserRowControls({
  profile,
  currentUserId,
}: {
  profile: { id: string; role: UserRole; estado: string };
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const editable = canEditRow(currentUserId, profile.id);

  return (
    <>
      <td className="py-2">
        <select
          defaultValue={profile.role}
          disabled={!editable || isPending}
          onChange={(e) => {
            const role = e.target.value as UserRole;
            startTransition(() => {
              updateUserRole(profile.id, role);
            });
          }}
          className="border border-tinta/20 bg-transparent px-2 py-1 disabled:opacity-40"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2">
        <button
          type="button"
          disabled={!editable || isPending}
          onClick={() => {
            const next = profile.estado === "activo" ? "inactivo" : "activo";
            startTransition(() => {
              updateUserEstado(profile.id, next);
            });
          }}
          className="uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
        >
          {profile.estado}
        </button>
      </td>
    </>
  );
}
```

- [ ] **Step 2: Crear la página**

Crear `src/app/admin/usuarios/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserRowControls } from "./user-row-controls";
import type { UserRole } from "./actions";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    notFound();
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.sub)
    .single();

  if (!currentProfile || currentProfile.role !== "admin") {
    notFound();
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nombre, email, role, estado, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Usuarios</h1>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Nombre</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Rol</th>
            <th className="py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((profile) => (
            <tr key={profile.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">{profile.nombre ?? "—"}</td>
              <td className="py-2 pr-4">{profile.email}</td>
              <UserRowControls
                profile={{
                  id: profile.id,
                  role: profile.role as UserRole,
                  estado: profile.estado,
                }}
                currentUserId={user.sub}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Verificar build completo**

```bash
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key-for-ci-build"
npm run lint && npm run typecheck && npm run build && npm run test
```

Expected: los cuatro comandos terminan sin error, `/admin/usuarios` aparece en la tabla de rutas del build como dinámica (`ƒ`).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/usuarios/page.tsx src/app/admin/usuarios/user-row-controls.tsx
git commit -m "auth: agrega la página de gestión de usuarios en /admin/usuarios"
```

---

### Task 6: E2E de gestión de usuarios

**Files:**
- Modify: `e2e/fixtures/test-users.ts`
- Create: `e2e/admin-usuarios.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` (Task existente de la Épica 3, se amplía su tipo de rol).

- [ ] **Step 1: Ampliar el tipo de rol del fixture**

En `e2e/fixtures/test-users.ts`, cambiar:

```ts
export type TestRole = "pendiente" | "admin";
```

por:

```ts
export type TestRole = "pendiente" | "estudiante" | "operador" | "profesor" | "admin";
```

No hace falta cambiar el resto del archivo — el bloque `if (role !== "pendiente")` ya maneja cualquier rol no-pendiente igual.

- [ ] **Step 2: Escribir los E2E**

Crear `e2e/admin-usuarios.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

async function loginAs(page: import("@playwright/test").Page, user: { email: string; password: string }) {
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/usuarios`
  );
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
}

test("un admin ve la lista de usuarios y aprueba a un pendiente como operador", async ({ page }) => {
  const admin = await createTestUser("admin");
  const pendiente = await createTestUser("pendiente");

  await loginAs(page, admin);

  await expect(page.locator("header")).toContainText(admin.email);
  await expect(page.locator("header")).toContainText(/admin/i);

  const row = page.locator("tbody tr", { hasText: pendiente.email });
  await expect(row).toBeVisible();

  await row.locator("select").selectOption("operador");
  await page.reload();

  const updatedRow = page.locator("tbody tr", { hasText: pendiente.email });
  await expect(updatedRow.locator("select")).toHaveValue("operador");
});

test("un profesor no puede ver /admin/usuarios", async ({ page }) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/usuarios`
  );

  await expect(page.getByText(/this page could not be found|404/i)).toBeVisible();
});

test("un admin no puede modificar su propio rol ni estado", async ({ page }) => {
  const admin = await createTestUser("admin");

  await loginAs(page, admin);

  const ownRow = page.locator("tbody tr", { hasText: admin.email });
  await expect(ownRow.locator("select")).toBeDisabled();
  await expect(ownRow.locator("button")).toBeDisabled();
});
```

- [ ] **Step 3: Correr los E2E contra el stack local y verificar que pasan**

```bash
npx supabase start
export $(npx supabase status -o env | xargs)
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_E2E_TEST_MODE=true
npm run test:e2e -- e2e/admin-usuarios.spec.ts
```

Expected: 3 tests PASS. Si el texto exacto de la página 404 de Next.js no coincide con `/this page could not be found|404/i` en la versión instalada, ajustar el matcher al texto real observado en el fallo.

- [ ] **Step 4: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 5: Correr la suite completa una vez más (unit + build + los E2E ya existentes) para confirmar que nada se rompió**

```bash
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key-for-ci-build"
npm run lint && npm run typecheck && npm run build && npm run test
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add e2e/fixtures/test-users.ts e2e/admin-usuarios.spec.ts
git commit -m "test: agrega E2E de gestión de usuarios (aprobar, operador, auto-modificación)"
```

---

## Post-plan: verificación en CI

Push a una rama y abrir PR (o empujar a la rama de trabajo si ya hay un PR abierto) para confirmar que el pipeline completo (lint, typecheck, build, unit, E2E con Supabase local) pasa en GitHub Actions antes de mergear a `main` — igual que se hizo para el harness de ingeniería.
