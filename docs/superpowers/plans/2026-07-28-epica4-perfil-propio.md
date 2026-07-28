# Épica 4 — Perfil propio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario aprobado puede ver su email/rol/fecha de creación y editar su propio nombre en `/admin/perfil`; el nav del panel oculta "Usuarios" a quien no sea admin.

**Architecture:** Server Component de lectura (`/admin/perfil/page.tsx`) + un client component pequeño para el form (`nombre-form.tsx`) + una Server Action (`updateOwnNombre`) que toma el id del usuario de su propia sesión, nunca de un parámetro — estructuralmente no puede tocar el perfil de otra persona.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (`@supabase/ssr`), Playwright.

## Global Constraints

- Componentes de servidor por defecto; client components solo donde haya interactividad.
- Commits en español, imperativo, prefijo `auth:`.
- Idioma de la UI: español.
- La validación de "nombre no vacío" debe repetirse en el servidor (Server Action), no confiar solo en el disabled del botón del cliente.

---

### Task 1: Nav condicional en el layout

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Agregar "Mi perfil" y condicionar "Usuarios"**

En `src/app/admin/layout.tsx`, reemplazar el bloque `<nav>` actual:

```tsx
          <nav className="flex gap-4 font-mono text-sm uppercase tracking-wide">
            <Link href="/admin/usuarios" className="text-tinta/70 hover:text-tinta">
              Usuarios
            </Link>
          </nav>
```

por:

```tsx
          <nav className="flex gap-4 font-mono text-sm uppercase tracking-wide">
            {profile.role === "admin" && (
              <Link href="/admin/usuarios" className="text-tinta/70 hover:text-tinta">
                Usuarios
              </Link>
            )}
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
          </nav>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "auth: agrega link a Mi perfil y oculta Usuarios a no-admin en el nav"
```

---

### Task 2: Server Action `updateOwnNombre`

**Files:**
- Create: `src/app/admin/perfil/actions.ts`

**Interfaces:**
- Produces: `updateOwnNombre(nombre: string): Promise<void>`, usado por la Task 3.

- [ ] **Step 1: Escribir la Server Action**

Crear `src/app/admin/perfil/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnNombre(nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nombre: trimmed })
    .eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el nombre: ${error.message}`);
  }

  revalidatePath("/admin/perfil");
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/perfil/actions.ts
git commit -m "auth: agrega Server Action para editar el propio nombre"
```

---

### Task 3: Página de perfil y formulario

**Files:**
- Create: `src/app/admin/perfil/page.tsx`
- Create: `src/app/admin/perfil/nombre-form.tsx`

**Interfaces:**
- Consumes: `updateOwnNombre` de `./actions` (Task 2).

- [ ] **Step 1: Crear el formulario cliente**

Crear `src/app/admin/perfil/nombre-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateOwnNombre } from "./actions";

export function NombreForm({ nombre }: { nombre: string | null }) {
  const [value, setValue] = useState(nombre ?? "");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const trimmed = value.trim();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setFeedback(null);
        startTransition(async () => {
          try {
            await updateOwnNombre(trimmed);
            setFeedback("Guardado.");
          } catch (err) {
            setFeedback(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="font-mono text-sm text-tinta/70" htmlFor="nombre">
        Nombre
      </label>
      <input
        id="nombre"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border border-tinta/20 bg-transparent px-2 py-1 font-mono text-sm"
      />
      <button
        type="submit"
        disabled={!trimmed || isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Guardar
      </button>
      {feedback && <p className="font-mono text-sm text-tinta/70">{feedback}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Crear la página**

Crear `src/app/admin/perfil/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NombreForm } from "./nombre-form";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, nombre, role, created_at")
    .eq("id", user.sub)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const createdAt = new Date(profile.created_at).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Mi perfil</h1>
      <dl className="mt-8 space-y-4 font-mono text-sm">
        <div>
          <dt className="text-tinta/50">Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div>
          <dt className="text-tinta/50">Rol</dt>
          <dd className="uppercase text-musgo-oscuro">{profile.role}</dd>
        </div>
        <div>
          <dt className="text-tinta/50">Cuenta creada</dt>
          <dd>{createdAt}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <NombreForm nombre={profile.nombre} />
      </div>
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

Expected: los cuatro comandos terminan sin error, `/admin/perfil` aparece en la tabla de rutas del build como dinámica (`ƒ`).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/perfil/page.tsx src/app/admin/perfil/nombre-form.tsx
git commit -m "auth: agrega la página de perfil propio en /admin/perfil"
```

---

### Task 4: E2E de perfil propio

**Files:**
- Create: `e2e/admin-perfil.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `e2e/fixtures/test-users.ts` (ya existe).

- [ ] **Step 1: Escribir los E2E**

Crear `e2e/admin-perfil.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

test("un usuario aprobado edita y persiste su propio nombre", async ({ page }) => {
  const user = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  const input = page.getByLabel("Nombre");
  await input.fill("Nombre de Prueba");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nombre")).toHaveValue("Nombre de Prueba");
});

test("no se puede guardar un nombre vacío", async ({ page }) => {
  const user = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  const input = page.getByLabel("Nombre");
  await input.fill("   ");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();
});

test("un no-admin no ve el link Usuarios pero sí Mi perfil", async ({ page }) => {
  const user = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin/perfil`
  );
  await expect(page).toHaveURL(/\/admin\/perfil$/);

  await expect(page.getByRole("link", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
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
npm run test:e2e -- e2e/admin-perfil.spec.ts
```

Expected: 3 tests PASS. Si el label "Nombre" no es encontrado por `getByLabel`, confirmar que el `htmlFor="nombre"`/`id="nombre"` del Task 3 quedaron bien enlazados.

- [ ] **Step 3: Correr la suite completa una vez más para confirmar que nada se rompió**

```bash
npm run test:e2e
```

Expected: todos los E2E (públicos, auth-gate, admin-usuarios, admin-perfil) PASS.

- [ ] **Step 4: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 5: Commit**

```bash
git add e2e/admin-perfil.spec.ts
git commit -m "test: agrega E2E de perfil propio (editar nombre, validación, nav)"
```

---

## Post-plan: verificación en CI

Push y confirmar el pipeline completo (lint, typecheck, build, unit, E2E con Supabase local) en GitHub Actions antes de mergear a `main`.
