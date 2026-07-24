# Harness de Ingeniería Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Bichongos.store verificación automática real (CI, pirámide de pruebas) y reglas de proceso escritas, siguiendo el diseño aprobado en `docs/superpowers/specs/2026-07-23-harness-ingenieria-design.md`.

**Architecture:** Vitest para unit/integración (colocation con el código que prueban), Playwright para E2E contra una instancia local real de Supabase (CLI, vía Docker) levantada en CI, y un workflow de GitHub Actions que corre lint → typecheck → build → unit tests siempre, y E2E solo en pull requests. Las reglas de proceso (Definition of Done, criterios de aceptación, antipatrones) se agregan a CLAUDE.md.

**Tech Stack:** Vitest 3, Playwright (`@playwright/test`), Supabase CLI (devDependency), `pg` para setup directo de fixtures de test, GitHub Actions.

## Global Constraints

- Commits en español, imperativo, sin prefijo de épica (este trabajo es transversal, no de una épica específica del backlog de producto).
- No tocar el modelo de datos, RLS, ni ninguna lógica de producto — este plan es solo andamiaje de verificación y proceso.
- `NEXT_PUBLIC_E2E_TEST_MODE` y la ruta `/e2e-login` nunca deben quedar activas en producción: la ruta depende de la env var estar ausente en Vercel (comportamiento por defecto, no requiere acción explícita).
- El servicio `service_role` de Supabase (real o local) nunca se expone al cliente — los fixtures de test que lo usan corren solo en Node (script de test / CI), nunca en código de la app servido al navegador.
- Todo comando de este plan que muta configuración compartida (branch protection de `main`) requiere confirmación explícita del usuario antes de ejecutarse — no se automatiza sin ese paso.

---

### Task 1: Vitest — configuración base y primer test unitario real

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/supabase/proxy.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Consumes: `updateSession` exportado desde `src/lib/supabase/proxy.ts` (ya existe, firma `(request: NextRequest) => Promise<NextResponse>`).
- Produces: script npm `test` (`vitest run`) y `test:watch` (`vitest`), usados por el workflow de CI en la Task 3.

- [ ] **Step 1: Instalar Vitest y dependencias de test**

```bash
npm install --save-dev vitest@^3 @vitest/coverage-v8@^3
```

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Agregar scripts a `package.json`**

En la sección `"scripts"`, agregar:

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir el test — falla primero**

Crear `src/lib/supabase/proxy.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockCreateServerClient = vi.mocked(createServerClient);

function mockClaims(claims: { sub: string } | null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue(claims ? { data: { claims } } : { data: null }),
    },
  } as never);
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige a /login cuando no hay sesión y la ruta es /admin", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/admin");

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirige a /login cuando no hay sesión y la ruta es /pendiente", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/pendiente");

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("no redirige cuando no hay sesión y la ruta es pública", async () => {
    mockClaims(null);
    const request = new NextRequest("http://localhost:3000/");

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });

  it("no redirige a /admin cuando hay sesión", async () => {
    mockClaims({ sub: "user-123" });
    const request = new NextRequest("http://localhost:3000/admin");

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });
});
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm run test -- src/lib/supabase/proxy.test.ts`
Expected: 4 tests PASS. Si algo falla, leer el mensaje del test antes de tocar `proxy.ts` — el objetivo de este test es documentar el comportamiento existente, no cambiarlo.

- [ ] **Step 6: Correr typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/lib/supabase/proxy.test.ts package.json package-lock.json
git commit -m "test: agrega Vitest y primer test unitario del gate de sesión"
```

---

### Task 2: Playwright — configuración base y smoke test público

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/public-redirect.spec.ts`
- Modify: `package.json` (script `test:e2e` + devDependency)
- Modify: `.gitignore` (agregar `/test-results/`, `/playwright-report/`, `/blob-report/`)

**Interfaces:**
- Consumes: nada del código de la app directamente — navega contra el servidor real vía HTTP.
- Produces: script npm `test:e2e` (`playwright test`), usado por el workflow de CI en la Task 6.

- [ ] **Step 1: Instalar Playwright**

```bash
npm install --save-dev @playwright/test@^1
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Crear `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE ?? "",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 3: Agregar script a `package.json`**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 4: Agregar entradas a `.gitignore`**

```
/test-results/
/playwright-report/
/blob-report/
```

- [ ] **Step 5: Escribir el smoke test**

Crear `e2e/public-redirect.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("la landing pública carga", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Bichongos/i);
});

test("acceder a /admin sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("acceder a /pendiente sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/pendiente");
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run test:e2e`
Expected: 3 tests PASS. La primera corrida hace `next build` real, puede tardar 1-2 minutos.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/public-redirect.spec.ts package.json package-lock.json .gitignore
git commit -m "test: agrega Playwright y smoke test de redirects públicos"
```

---

### Task 3: CI — pipeline de lint, typecheck, build y unit tests

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `lint`, `typecheck`, `build`, `test` de `package.json` (Tasks 1-2 y ya existentes).
- Produces: workflow `CI` con job `verify`, referenciado por nombre en la Task 6 (para agregar los pasos de E2E) y en la Task 7 del spec (branch protection).

- [ ] **Step 1: Crear el workflow**

Crear `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321"
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-for-ci-build"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Unit tests
        run: npm run test
```

- [ ] **Step 2: Verificar el workflow localmente antes de subirlo**

Run:
```bash
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key-for-ci-build"
npm run lint && npm run typecheck && npm run build && npm run test
```
Expected: los cuatro comandos terminan sin error.

- [ ] **Step 3: Commit y push para disparar el workflow real**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: agrega pipeline de lint, typecheck, build y unit tests"
git push
```

- [ ] **Step 4: Verificar en GitHub que el workflow corrió y pasó**

Run: `gh run list --workflow=ci.yml --limit 1`
Expected: el run más reciente tiene status `completed` y conclusion `success`. Si falló, correr `gh run view --log-failed` para ver el error exacto antes de continuar.

---

### Task 4: Supabase CLI local — config y devDependencies

**Files:**
- Create: `supabase/config.toml` (generado por el CLI, no escrito a mano)
- Modify: `package.json` (devDependencies: `supabase`, `pg`, `@types/pg`)

**Interfaces:**
- Produces: stack local de Supabase arrancable con `npx supabase start`, usado por la Task 5 (fixtures de test) y la Task 6 (CI de E2E).

- [ ] **Step 1: Instalar el CLI de Supabase y `pg`**

```bash
npm install --save-dev supabase@latest pg@^8 @types/pg@^8
```

- [ ] **Step 2: Inicializar el proyecto local de Supabase**

Run: `npx supabase init`
Expected: crea `supabase/config.toml` junto al `supabase/migrations/` que ya existe en el repo (no lo toca). Si el comando pregunta algo interactivamente, aceptar los valores por defecto.

- [ ] **Step 3: Levantar el stack local y aplicar las migraciones existentes**

Run: `npx supabase start`
Expected: descarga imágenes Docker (puede tardar varios minutos la primera vez) y termina imprimiendo URLs y credenciales locales, incluyendo confirmación de que las 3 migraciones de `supabase/migrations/` se aplicaron sin error.

- [ ] **Step 4: Anotar el nombre exacto de las variables que expone `supabase status -o env`**

Run: `npx supabase status -o env`
Expected: una lista de líneas `NOMBRE="valor"`. Confirmar los nombres exactos de la URL de API y de la clave anónima/service role (deberían ser `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, pero **verificar contra la salida real** — la Task 6 depende de que estos nombres sean correctos).

- [ ] **Step 5: Detener el stack (no hace falta dejarlo corriendo entre tasks)**

Run: `npx supabase stop`

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml package.json package-lock.json
git commit -m "chore: agrega Supabase CLI local como devDependency"
```

---

### Task 5: Ruta de login solo-para-tests y fixtures de usuarios de prueba

**Files:**
- Create: `src/app/e2e-login/page.tsx`
- Create: `src/app/e2e-login/e2e-login-form.tsx`
- Create: `e2e/fixtures/test-users.ts`
- Create: `e2e/auth-gate.spec.ts`

**Interfaces:**
- Consumes: `createClient` de `src/lib/supabase/client.ts` (ya existe); tabla `public.profiles` y trigger `enforce_role_estado_immutable` de `supabase/migrations/00000000000002_prevent_self_role_change.sql` (ya existen).
- Produces: `createTestUser(role: "pendiente" | "admin") => Promise<{ email: string; password: string }>`, usado por `e2e/auth-gate.spec.ts` y por cualquier E2E futuro que necesite un usuario autenticado.

- [ ] **Step 1: Crear la ruta guardada por env var**

Crear `src/app/e2e-login/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { E2ELoginForm } from "./e2e-login-form";

export default function E2ELoginPage() {
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE !== "true") {
    notFound();
  }

  return (
    <Suspense>
      <E2ELoginForm />
    </Suspense>
  );
}
```

Crear `src/app/e2e-login/e2e-login-form.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function E2ELoginForm() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Iniciando sesión de prueba...");

  useEffect(() => {
    const email = searchParams.get("email");
    const password = searchParams.get("password");
    const next = searchParams.get("next") ?? "/admin";

    if (!email || !password) {
      setStatus("Faltan email o password en la URL");
      return;
    }

    const supabase = createClient();
    supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }
      window.location.href = next;
    });
  }, [searchParams]);

  return <p>{status}</p>;
}
```

- [ ] **Step 2: Verificar que la ruta es inerte sin la env var**

Run: `npm run build && npm run start &` luego `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/e2e-login`
Expected: `404`. Parar el server (`kill %1` o Ctrl+C).

- [ ] **Step 3: Escribir el fixture de usuarios de prueba**

Crear `e2e/fixtures/test-users.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type TestRole = "pendiente" | "admin";

export interface TestUser {
  email: string;
  password: string;
}

export async function createTestUser(role: TestRole): Promise<TestUser> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está seteada — necesaria para crear usuarios de prueba"
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const id = randomUUID();
  const email = `e2e-${id}@bichongos.test`;
  const password = `Test-${id}`;

  const { error: createError } = await admin.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    throw new Error(`No se pudo crear el usuario de prueba: ${createError.message}`);
  }

  if (role !== "pendiente") {
    const db = new Client({ connectionString: DB_URL });
    await db.connect();
    try {
      await db.query(
        "alter table public.profiles disable trigger enforce_role_estado_immutable"
      );
      await db.query("update public.profiles set role = $1 where id = $2", [role, id]);
      await db.query(
        "alter table public.profiles enable trigger enforce_role_estado_immutable"
      );
    } finally {
      await db.end();
    }
  }

  return { email, password };
}
```

- [ ] **Step 4: Escribir los tests de gate por rol**

Crear `e2e/auth-gate.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createTestUser } from "./fixtures/test-users";

test("un usuario con rol pendiente ve la pantalla de cuenta pendiente", async ({ page }) => {
  const user = await createTestUser("pendiente");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin`
  );

  await expect(page).toHaveURL(/\/pendiente$/);
  await expect(
    page.getByRole("heading", { name: /cuenta pendiente de aprobación/i })
  ).toBeVisible();
});

test("un usuario con rol admin accede al panel", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&next=/admin`
  );

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText(/panel de administración está en construcción/i)
  ).toBeVisible();
});
```

- [ ] **Step 5: Correr contra el stack local y verificar que pasan**

```bash
npx supabase start
export $(npx supabase status -o env | xargs)
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_E2E_TEST_MODE=true
npm run test:e2e -- e2e/auth-gate.spec.ts
```

Expected: 2 tests PASS. Si el nombre de alguna variable de `supabase status -o env` no coincide con lo asumido en el Step 4 de la Task 4, ajustar los `export` de arriba con el nombre real y reintentar.

- [ ] **Step 6: Detener el stack local**

Run: `npx supabase stop`

- [ ] **Step 7: Commit**

```bash
git add src/app/e2e-login e2e/fixtures e2e/auth-gate.spec.ts
git commit -m "test: agrega ruta de login solo-para-tests y E2E de gate por rol"
```

---

### Task 6: CI — agregar E2E a pull requests

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npx supabase start`, `npx supabase status -o env` (Task 4); `npm run test:e2e` (Task 2, extendido en Task 5).

- [ ] **Step 1: Agregar los pasos de E2E, condicionados a pull_request**

Modificar `.github/workflows/ci.yml`, agregando al final del job `verify` (después del step "Unit tests"):

```yaml
      - name: Setup Supabase CLI
        if: github.event_name == 'pull_request'
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local stack
        if: github.event_name == 'pull_request'
        run: npx supabase start

      - name: Export Supabase local env vars
        if: github.event_name == 'pull_request'
        run: |
          npx supabase status -o env > /tmp/supabase-status.env
          cat /tmp/supabase-status.env
          echo "NEXT_PUBLIC_SUPABASE_URL=$(grep '^API_URL=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '\"')" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '\"')" >> "$GITHUB_ENV"
          echo "SUPABASE_SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '\"')" >> "$GITHUB_ENV"
          echo "SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_E2E_TEST_MODE=true" >> "$GITHUB_ENV"

      - name: Install Playwright browsers
        if: github.event_name == 'pull_request'
        run: npx playwright install --with-deps chromium

      - name: E2E tests
        if: github.event_name == 'pull_request'
        run: npm run test:e2e

      - name: Stop Supabase local stack
        if: always() && github.event_name == 'pull_request'
        run: npx supabase stop
```

El `cat /tmp/supabase-status.env` en el step de export es deliberado: si el `grep` de alguna variable falla (nombre distinto al esperado), el log del run muestra la salida real completa para poder corregir los patrones sin tener que reproducir el problema localmente.

- [ ] **Step 2: Commit y push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: agrega Supabase local y Playwright E2E a pull requests"
git push
```

- [ ] **Step 3: Abrir un PR de prueba para verificar el pipeline completo**

```bash
git checkout -b chore/verificar-ci-e2e
git commit --allow-empty -m "chore: PR vacío para verificar el pipeline de E2E"
git push -u origin chore/verificar-ci-e2e
gh pr create --title "chore: verificar pipeline de CI con E2E" --body "PR de verificación, no mergear contenido — solo confirma que el job verify pasa con Supabase local + Playwright."
```

- [ ] **Step 4: Verificar que el job pasa**

Run: `gh pr checks --watch`
Expected: el check `verify` termina en `pass`. Si falla en el step de export de env vars, revisar el log del step "Export Supabase local env vars" (el `cat` del Step 1 muestra los nombres reales) y corregir los `grep` en el workflow.

- [ ] **Step 5: Cerrar el PR de verificación sin mergear**

```bash
gh pr close chore/verificar-ci-e2e --delete-branch
git checkout main
```

---

### Task 7: Reglas de proceso en CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Ninguna — es contenido de documentación, no código.

- [ ] **Step 1: Agregar la sección al final de `CLAUDE.md`**

Agregar antes de la sección `## Bootstrap del primer admin en producción` (o al final del archivo si esa sección ya no es la última):

```markdown
## Ciclo de desarrollo (harness de ingeniería)

Ver `docs/superpowers/specs/2026-07-23-harness-ingenieria-design.md` para el diseño completo. Resumen operativo:

**Spec mínima según el tamaño del cambio:**
- Fix trivial / typo: una frase de intención + 1 criterio.
- Feature pequeña: historia de usuario + 2-4 criterios en lista.
- Feature con estado/flujo: historia + escenarios Gherkin + restricciones.
- Cambio estructural: lo anterior + plan de pasos + no-objetivos explícitos.

**Un criterio de aceptación es una regla de negocio, no un detalle técnico.** Se escribe en términos que Juan o Daniela podrían leer y aprobar ("un cupón vigente reduce el total"), nunca en términos de implementación ("el campo se guarda en la tabla X"). Si al refactorizar hay que reescribir el criterio, no era un criterio de aceptación — era un chequeo técnico disfrazado.

**Definition of Done** — nada se da por terminado sin:
- [ ] Todos los criterios de aceptación cubiertos por test o verificación manual explícita.
- [ ] El pipeline de CI en verde (lint, typecheck, build, tests).
- [ ] Ejecución real al menos una vez — no solo "compila".
- [ ] Fallos, si los hubo durante el desarrollo, reportados con su salida (nunca silenciados).
- [ ] Decisiones y *gotchas* no obvios registrados en memoria persistente.
- [ ] La spec actualizada si algo cambió durante la implementación respecto a lo planeado.

**Regla de honestidad:** "hecho y verificado" se afirma solo cuando de verdad se verificó. Un test que falla se reporta con su salida; no hay estados intermedios que "parecen" funcionar.

**Antipatrones a evitar:** spec en el chat en vez de en archivo versionado, generar código sin especificar primero, aceptar un diff sin entenderlo línea por línea, confianza silenciosa (dar algo por bueno porque "compila"), big-bang build (cambios tan grandes que no se pueden revisar ni revertir con confianza).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: agrega reglas de ciclo de desarrollo y Definition of Done a CLAUDE.md"
```

---

## Post-plan: branch protection (requiere confirmación explícita, no automatizar)

Con el job `verify` del workflow `CI` pasando de forma consistente (Task 6 verificada), configurar en GitHub (Settings → Branches → Branch protection rules → agregar regla para `main` → "Require status checks to pass before merging" → seleccionar `verify`). Esto bloquea merges a `main` con el pipeline en rojo, como decidió el usuario en el diseño. No ejecutar esto vía `gh api` sin mostrarle antes el cambio exacto — es una mutación de configuración compartida del repositorio.
