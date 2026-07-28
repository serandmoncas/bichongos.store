# Épica 4 — Auditoría básica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo cambio de rol o estado que haga un admin sobre otro perfil queda registrado automáticamente en `activity_log` (quién, a quién, qué, cuándo), visible en `/admin/auditoria` (admin-only). Cierra la Épica 4.

**Architecture:** Captura vía trigger `AFTER UPDATE` en `profiles` (función `SECURITY DEFINER`, sin policy de `INSERT` para nadie más) — no vía la Server Action. Lectura vía Server Component con RLS admin-only.

**Tech Stack:** Postgres/Supabase (migración + trigger), Next.js App Router (Server Component), Playwright.

## Global Constraints

- Nadie tiene `INSERT` directo sobre `activity_log` — solo el trigger (`security definer`) escribe ahí.
- Commits en español, imperativo, prefijo `auth:`.
- Idioma de la UI: español.
- No auditar `updateOwnNombre` (solo cambios de `role`/`estado`).

---

### Task 1: Migración — tabla `activity_log` y trigger

**Files:**
- Create: `supabase/migrations/00000000000006_activity_log.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/00000000000006_activity_log.sql`:

```sql
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete set null,
  accion text not null,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "admin lee el log de auditoría"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

-- SECURITY DEFINER: el usuario que ejecuta el UPDATE sobre profiles no
-- necesita (ni tiene) privilegios de INSERT sobre activity_log. Nadie
-- puede escribir ahí salvo este trigger — no existe policy de INSERT
-- para authenticated. Corre AFTER UPDATE, después de que
-- enforce_role_estado_immutable (BEFORE UPDATE, migración 2) ya validó
-- que quien cambia el rol/estado es admin; si esa validación falla, el
-- UPDATE se aborta entero y este trigger nunca se ejecuta.
create function public.log_profile_role_estado_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_rol', old.role::text, new.role::text);
  end if;

  if new.estado is distinct from old.estado then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_estado', old.estado, new.estado);
  end if;

  return new;
end;
$$;

revoke execute on function public.log_profile_role_estado_change() from public, anon, authenticated;

create trigger log_role_estado_change
  after update on public.profiles
  for each row execute procedure public.log_profile_role_estado_change();
```

- [ ] **Step 2: Aplicar localmente y verificar el comportamiento real**

```bash
npx supabase start
npx supabase db reset
```

Expected: las 6 migraciones aplican sin error.

Verificar manualmente con SQL directo (usa la conexión local de Postgres, `postgresql://postgres:postgres@127.0.0.1:54322/postgres`):

```bash
npx supabase db query "select count(*) from public.activity_log"
```

Expected: `0` (tabla vacía, recién creada).

- [ ] **Step 3: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000006_activity_log.sql
git commit -m "auth: agrega activity_log y trigger que audita cambios de rol/estado"
```

---

### Task 2: Página de auditoría y nav

**Files:**
- Create: `src/app/admin/auditoria/page.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Agregar el link al nav**

En `src/app/admin/layout.tsx`, dentro del bloque `{profile.role === "admin" && (...)}` que ya envuelve el link a "Usuarios", agregar el link a "Auditoría" justo después (mismo `<>` / mismo condicional — no duplicar la condición):

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
```

- [ ] **Step 2: Crear la página**

Crear `src/app/admin/auditoria/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACCION_LABELS: Record<string, string> = {
  cambio_rol: "Cambio de rol",
  cambio_estado: "Cambio de estado",
};

export default async function AuditoriaPage() {
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

  const { data: entries } = await supabase
    .from("activity_log")
    .select("id, actor_id, target_id, accion, valor_anterior, valor_nuevo, created_at")
    .order("created_at", { ascending: false });

  const userIds = Array.from(
    new Set(
      (entries ?? [])
        .flatMap((e) => [e.actor_id, e.target_id])
        .filter((id): id is string => !!id)
    )
  );

  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, nombre, email").in("id", userIds)
    : { data: [] as { id: string; nombre: string | null; email: string }[] };

  const nombreDe = (id: string | null) => {
    if (!id) return "—";
    const p = profiles?.find((p) => p.id === id);
    return p?.nombre ?? p?.email ?? id;
  };

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Auditoría</h1>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Quién</th>
            <th className="py-2 pr-4">A quién</th>
            <th className="py-2 pr-4">Qué cambió</th>
            <th className="py-2 pr-4">Anterior → Nuevo</th>
            <th className="py-2">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((entry) => (
            <tr key={entry.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">{nombreDe(entry.actor_id)}</td>
              <td className="py-2 pr-4">{nombreDe(entry.target_id)}</td>
              <td className="py-2 pr-4">{ACCION_LABELS[entry.accion] ?? entry.accion}</td>
              <td className="py-2 pr-4">
                {entry.valor_anterior} → {entry.valor_nuevo}
              </td>
              <td className="py-2">{new Date(entry.created_at).toLocaleString("es")}</td>
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

Expected: sin errores, `/admin/auditoria` aparece en la tabla de rutas del build como dinámica (`ƒ`).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/auditoria/page.tsx
git commit -m "auth: agrega la página de auditoría en /admin/auditoria"
```

---

### Task 3: E2E de auditoría

**Files:**
- Create: `e2e/admin-auditoria.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `e2e/fixtures/test-users.ts` (ya existe).

- [ ] **Step 1: Escribir los E2E**

Crear `e2e/admin-auditoria.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

async function loginAs(page: import("@playwright/test").Page, user: { email: string; password: string }, next: string) {
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=${next}`
  );
}

test("un cambio de rol queda registrado y visible en /admin/auditoria", async ({ page }) => {
  const admin = await createTestUser("admin");
  const pendiente = await createTestUser("pendiente");

  await loginAs(page, admin, "/admin/usuarios");
  await expect(page).toHaveURL(/\/admin\/usuarios$/);

  const row = page.locator("tbody tr", { hasText: pendiente.email });
  const select = row.locator("select");
  await select.selectOption("operador");
  await expect(select).toBeDisabled();
  await expect(select).toBeEnabled();

  await page.goto("/admin/auditoria");
  const logRow = page.locator("tbody tr", { hasText: "Cambio de rol" }).first();
  await expect(logRow).toBeVisible();
  await expect(logRow).toContainText("pendiente");
  await expect(logRow).toContainText("operador");
});

test("un no-admin no puede ver /admin/auditoria", async ({ page }) => {
  const profesor = await createTestUser("profesor");

  await loginAs(page, profesor, "/admin/auditoria");

  await expect(
    page.getByRole("heading", { name: "Esta sección aún no existe para tu rol" })
  ).toBeVisible();
});

test("editar el propio nombre no genera un registro de auditoría", async ({ page }) => {
  const admin = await createTestUser("admin");

  await loginAs(page, admin, "/admin/auditoria");
  const before = await page.locator("tbody tr").count();

  await page.goto("/admin/perfil");
  await page.getByLabel("Nombre").fill("Nombre Sin Auditar");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.goto("/admin/auditoria");
  const after = await page.locator("tbody tr").count();
  expect(after).toBe(before);
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
npm run test:e2e -- e2e/admin-auditoria.spec.ts --workers=1
```

Expected: 3 tests PASS. Correr con `--workers=1` para evitar falsos negativos por contención de recursos observados en tareas anteriores en esta máquina de desarrollo.

- [ ] **Step 3: Correr la suite completa una vez más en serie**

```bash
npm run test:e2e -- --workers=1
```

Expected: todos los E2E PASS (públicos, auth-gate, admin-usuarios, admin-perfil, admin-auditoria).

- [ ] **Step 4: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 5: Commit**

```bash
git add e2e/admin-auditoria.spec.ts
git commit -m "test: agrega E2E de auditoría (cambio de rol registrado, admin-only, no audita nombre)"
```

---

## Post-plan: verificación en CI

Push y confirmar el pipeline completo (lint, typecheck, build, unit, E2E con Supabase local) en GitHub Actions antes de mergear a `main`. Con esta historia, la Épica 4 queda completa.
