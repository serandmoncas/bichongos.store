# Autenticación y roles (Épica 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google OAuth login/logout, a session-refreshing proxy that gates `/admin` and `/pendiente` behind authentication, a role-based redirect (pending users never reach the admin placeholder), and a "cuenta pendiente" screen — the auth infrastructure Épica 4 (the real admin panel) will build on.

**Architecture:** Next.js's `proxy.ts` file convention (successor to `middleware.ts`) refreshes the Supabase session on every request and redirects unauthenticated visitors away from `/admin`/`/pendiente`. `supabase.auth.getClaims()` — not `getUser()`/`getSession()` — is the verified-current, locally-JWT-validated way to read the authenticated user in server code. Role authorization (pending vs. approved) is a separate, single-source-of-truth check in `src/app/admin/layout.tsx`, which queries `profiles.role`.

**Tech Stack:** Next.js (App Router) + TypeScript, `@supabase/ssr` (already installed), Server Actions for logout.

## Global Constraints

- UI language: español.
- Server components by default; the ONLY client component in this plan is the login button (`src/app/login/login-button.tsx`) — it needs `onClick`, which requires it.
- Commits en español, imperativo, prefijo `auth:` para esta épica (ej. `auth: agrega proxy de sesión`).
- Env var names stay as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set in `.env.local` and Vercel from Épica 1/2) — do not rename to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` even though newer Supabase docs use that name; this is an explicit spec decision, not an oversight.
- Never use `supabase.auth.getSession()` or `getUser()` in server code (proxy, layouts, route handlers) to establish identity — always `getClaims()`, which validates the JWT signature locally. `getClaims()` returns `{ data: { claims: JwtPayload }, error }` where `JwtPayload.sub` is the user's id (confirmed against the installed `@supabase/auth-js` type definitions) and `JwtPayload.email` is their email. Note `JwtPayload.role` is the **Postgres** role (`"authenticated"`), completely unrelated to our `profiles.role` app column — never confuse the two.
- The proxy protects path prefixes `/admin` and `/pendiente` only. The public landing (`/`), `/login`, `/auth/callback`, `/auth/auth-code-error` remain unauthenticated-accessible.
- `/admin/page.tsx` in this plan is a placeholder ("panel en construcción") — the real admin panel is Épica 4's scope. Do not build panel features here.
- Supabase project ref: `hmrapzermtnyavqjoesh`. Production domain: `bichongos.store`.
- Spec reference for all architecture decisions: `docs/superpowers/specs/2026-07-17-auth-roles-design.md`.

## Verification Limitation (read before executing any task)

Google OAuth is **not yet configured** (no Client ID/Secret exist in Supabase's Google provider yet — that's Task 6, done interactively with the user, not by an agent). This means: **no task in this plan can complete a real end-to-end Google login.** Every task's verification is scoped to what's testable without live OAuth: build/type correctness, the proxy's unauthenticated-redirect path (this doesn't need Google — it only needs `getClaims()` to correctly return no user for a session-less request, which works today), and code-level correctness of the OAuth-dependent code paths (login button, callback route) via inspection rather than a live round-trip. Do not attempt to fabricate a live OAuth test — report what you verified and what remains untestable until Task 6.

---

### Task 1: Proxy — session refresh + auth gate for `/admin` and `/pendiente`

**Files:**
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars (already in `.env.local`, already in Vercel).
- Produces: on every request except static assets, refreshes the Supabase session cookie and redirects unauthenticated requests to `/admin/*` or `/pendiente/*` to `/login`. Later tasks (Task 3, Task 4) rely on this running first — by the time `admin/layout.tsx` or `pendiente/page.tsx` execute, an unauthenticated visitor has already been redirected away.

- [ ] **Step 1: Write the session-refresh helper**

Create `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/admin', '/pendiente']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getClaims() — a mistake
  // here can make it very hard to debug users being randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Must return supabaseResponse as-is (or copy its cookies onto a new
  // response) — creating a fresh NextResponse without doing so silently
  // drops the refreshed session cookie and desyncs client/server auth state.
  return supabaseResponse
}
```

- [ ] **Step 2: Write the proxy entry point**

Create `src/proxy.ts`:

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icon|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

(The matcher excludes `icon` and `opengraph-image` — Épica 2's generated favicon/OG-image routes — in addition to the standard Next.js static-asset exclusions, since those never need session refresh or auth gating.)

- [ ] **Step 3: Verify the unauthenticated-redirect path**

Run: `npm run dev -- --port 4000 &`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/admin
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/pendiente
curl -s -I http://localhost:4000/admin | grep -i "^location:"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/
```
Expected: first two print `307` (Next.js redirect status), the `location:` header shows `/login`, and the last (public landing, no session) prints `200` — the proxy must not touch unprotected routes. Kill the background dev server after.

Run: `npm run build`
Expected: exits 0. Note: `src/app/login`, `src/app/admin`, `src/app/pendiente` don't exist yet (later tasks create them), so `/admin`/`/pendiente` will 404 from Next.js's router *after* the proxy's redirect logic already ran and sent a 307 before ever reaching the (currently nonexistent) route — the curl checks above test the proxy's redirect, which happens independent of whether the destination route exists yet. This is expected and not a bug to fix in this task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/proxy.ts src/proxy.ts
git commit -m "auth: agrega proxy de refresco de sesión y protección de /admin y /pendiente"
```

---

### Task 2: Login page, login button, OAuth callback route, error page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/login-button.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/auth-code-error/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `src/lib/supabase/server.ts` (Épica 1) and `src/lib/supabase/client.ts` (Épica 1) — both already exist, do not modify them. `Logo` from `src/components/logo.tsx` (Épica 2).
- Produces: a complete, code-correct OAuth login flow. Task 3 depends on `/auth/callback` redirecting to `/admin` on success.

- [ ] **Step 1: Write the login button (the one client component in this plan)**

Create `src/app/login/login-button.tsx`:

```tsx
"use client"

import { createClient } from "@/lib/supabase/client"

export function LoginButton() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button
      onClick={handleLogin}
      className="inline-flex items-center justify-center rounded bg-musgo-oscuro px-6 py-3 font-mono text-sm font-medium uppercase tracking-wide text-crema-claro transition-opacity hover:opacity-90"
    >
      Iniciar sesión con Google
    </button>
  );
}
```

(Uses `bg-musgo-oscuro`, the accessible-contrast token added in Épica 2's final review fix — not the base `musgo` token, for the same WCAG AA reason as the WhatsApp button.)

- [ ] **Step 2: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { LoginButton } from "./login-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Logo variant="horizontal" />
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-semibold">Iniciar sesión</h1>
        <p className="font-serif text-lg italic text-tinta/80">
          Accedé con tu cuenta de Google para gestionar el cultivo.
        </p>
      </div>
      <LoginButton />
    </main>
  );
}
```

- [ ] **Step 3: Write the OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/admin";
  if (!next.startsWith("/")) {
    next = "/admin";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

- [ ] **Step 4: Write the OAuth error page**

Create `src/app/auth/auth-code-error/page.tsx`:

```tsx
import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        No pudimos iniciar tu sesión
      </h1>
      <p className="font-mono text-sm text-tinta/70">
        Ocurrió un error al conectar con Google. Intentá de nuevo.
      </p>
      <Link
        href="/login"
        className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
      >
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: exits 0. This is the primary verification for this task — per the plan's "Verification Limitation" note, the actual Google redirect and code exchange cannot be tested until Task 6 configures real OAuth credentials.

Run: `npm run dev -- --port 4000 &`, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/login`, then kill the background process.
Expected: `200` (an unauthenticated visitor can reach `/login` — it's not proxy-protected).

Code-level check (since live OAuth can't run yet): `grep -n "signInWithOAuth\|redirectTo\|exchangeCodeForSession" src/app/login/login-button.tsx src/app/auth/callback/route.ts` — confirm the provider is `"google"` and the redirect targets match what's described above.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/auth
git commit -m "auth: agrega página de login, botón de Google y ruta de callback OAuth"
```

---

### Task 3: Admin layout (role gate) + placeholder admin page

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `src/lib/supabase/server.ts`, the `profiles` table (Épica 1) — specifically its `role` column and RLS policy `"usuarios leen su propio perfil"` (a user can always read their own row, which is all this layout needs).
- Produces: `/admin` renders only for users whose `profiles.role` is `estudiante`, `profesor`, or `admin`; `pendiente` users are redirected to `/pendiente` (built in Task 4).

- [ ] **Step 1: Write the admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("role")
    .eq("id", user.sub)
    .single();

  if (profile?.role === "pendiente") {
    redirect("/pendiente");
  }

  return <>{children}</>;
}
```

(The `if (!user) redirect("/login")` here is a defense-in-depth belt-and-suspenders check — the proxy from Task 1 should already have redirected unauthenticated requests before this layout ever runs, but layouts must not assume upstream middleware always ran, e.g. during local component testing or future refactors of the matcher.)

- [ ] **Step 2: Write the placeholder admin page**

Create `src/app/admin/page.tsx`:

```tsx
export default function AdminPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        Bienvenido a Bichongos
      </h1>
      <p className="font-mono text-sm text-tinta/70">
        El panel de administración está en construcción.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: exits 0.

Run: `npm run dev -- --port 4000 &`, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/admin`, then kill the background process.
Expected: `307` redirecting to `/login` (same as Task 1's check — confirms the proxy still gates this route now that it actually exists as a real page, closing the loop Task 1 left open).

Code-level check: `grep -n "user.sub\|profiles\|role" src/app/admin/layout.tsx` — confirm the query uses `.eq("id", user.sub)` (not `user.id`, which doesn't exist on `JwtPayload`) and checks `profile?.role === "pendiente"`.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin
git commit -m "auth: agrega layout de /admin con gate por rol y página placeholder"
```

---

### Task 4: Pantalla de cuenta pendiente + logout

**Files:**
- Create: `src/app/pendiente/page.tsx`
- Create: `src/app/actions/auth.ts`

**Interfaces:**
- Consumes: `createClient` from `src/lib/supabase/server.ts`.
- Produces: `signOut()` Server Action, reusable by any future page (Épica 4's header will import it too).

- [ ] **Step 1: Write the logout Server Action**

Create `src/app/actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Write the pending-approval page**

Create `src/app/pendiente/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function PendientePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        Cuenta pendiente de aprobación
      </h1>
      <p className="max-w-md font-mono text-sm text-tinta/70">
        Tu cuenta ({user?.email}) fue creada correctamente, pero todavía no
        tiene acceso al panel. Un administrador necesita aprobarla y
        asignarte un rol antes de que puedas continuar.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: exits 0.

Run: `npm run dev -- --port 4000 &`, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/pendiente`, then kill the background process.
Expected: `307` redirecting to `/login` (proxy-protected, no session).

- [ ] **Step 4: Commit**

```bash
git add src/app/pendiente src/app/actions
git commit -m "auth: agrega pantalla de cuenta pendiente y acción de cerrar sesión"
```

---

### Task 5: Link de login en la landing

**Files:**
- Modify: `src/components/landing/cta-footer.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a discoverable entry point to `/login` from the public landing, satisfying historia 11 per the spec's explicit interpretation (login reachable from the public site, not a personalized nav state).

- [ ] **Step 1: Add the login link to the footer**

In `src/components/landing/cta-footer.tsx`, add an `Iniciar sesión` link. Replace the file's contents with:

```tsx
import Link from "next/link";
import { Logo } from "@/components/logo";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function CtaFooter() {
  return (
    <footer className="bg-tinta px-6 py-20 text-crema-claro sm:px-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          ¿Restaurante, tienda o querés probar Bichongos?
        </h2>
        <WhatsAppButton label="Escribinos por WhatsApp" />
        <Logo variant="mono-negative" />
        <div className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest text-crema-claro/60">
          <p>Guarne, Antioquia</p>
          <p>Con la asesoría técnica de Songo Sorhongo</p>
        </div>
        <Link
          href="/login"
          className="font-mono text-xs uppercase tracking-widest text-crema-claro/40 underline"
        >
          Iniciar sesión
        </Link>
      </div>
    </footer>
  );
}
```

(Only the `import Link` line and the closing `<Link href="/login">...</Link>` block are new — everything else is unchanged from Épica 2.)

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: exits 0.

Run: `npm run dev -- --port 4000 &`, then:
```bash
curl -s http://localhost:4000 | grep -o 'href="/login"'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000
```
Expected: the `href="/login"` grep finds a match, and `/` still returns `200` (the landing itself remains publicly accessible and static — adding a link doesn't make the page dynamic). Kill the background process after.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/cta-footer.tsx
git commit -m "auth: agrega link de inicio de sesión en el footer de la landing"
```

---

### Task 6: Configurar Google OAuth (guiado, requiere al usuario)

**Files:** ninguno — esta tarea es configuración externa, no código.

**Interfaces:**
- Consumes: todo el código de las Tareas 1–5, ya desplegado o corriendo en dev.
- Produces: credenciales reales de Google OAuth conectadas a Supabase — esto es lo que hace el flujo end-to-end (Tareas 1-5) funcionar de verdad por primera vez.

Este task es fundamentalmente distinto a los anteriores: no lo ejecuta un subagente solo, requiere que el controller (la sesión principal) guíe al usuario paso a paso, porque implica crear credenciales en una cuenta de Google que el agente no controla, y no hay `gcloud` CLI disponible en este entorno para automatizarlo.

- [ ] **Step 1: Crear el OAuth Client ID en Google Cloud Console**

Guiar al usuario a:
1. Ir a [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients) (crear un proyecto de Google Cloud primero si no existe uno).
2. Crear un nuevo OAuth Client ID, tipo **Web application**.
3. En **Authorized JavaScript origins**, agregar `https://bichongos.store` y `http://localhost:3000`.
4. En **Authorized redirect URIs**, agregar `https://hmrapzermtnyavqjoesh.supabase.co/auth/v1/callback`.
5. Guardar el **Client ID** y **Client Secret** generados.

- [ ] **Step 2: Configurar el provider de Google en Supabase**

Usar el MCP de Supabase (`execute_sql` no aplica acá — esto es configuración de Auth, no de base de datos; si el MCP no expone un tool para providers de Auth, guiar al usuario a hacerlo manualmente en el Dashboard):
1. Supabase Dashboard → Authentication → Providers → Google.
2. Pegar el Client ID y Client Secret del paso anterior.
3. Habilitar el provider.
4. Authentication → URL Configuration: Site URL = `https://bichongos.store`; agregar `https://bichongos.store/auth/callback` y `http://localhost:3000/auth/callback` a la lista de Redirect URLs permitidas.

- [ ] **Step 3: Verificar el flujo completo end-to-end**

Con las credenciales reales conectadas, probar manualmente (el controller no puede automatizar un login real de Google, esto lo hace el usuario):
1. Ir a `http://localhost:3000/login` (o `https://bichongos.store/login` si ya está desplegado), hacer clic en "Iniciar sesión con Google".
2. Confirmar que redirige a Google, y tras autorizar, vuelve a `/admin`.
3. Como es la primera vez que ese usuario de Google inicia sesión, el trigger `handle_new_user` (Épica 1) crea su perfil con `role = 'pendiente'` — confirmar que en vez de `/admin` termina en `/pendiente`, mostrando su email y el botón de cerrar sesión.
4. Cerrar sesión, confirmar que vuelve a `/`.
5. (Opcional, para probar el otro camino) Usar el MCP de Supabase (`execute_sql` en el proyecto `hmrapzermtnyavqjoesh`) para promover manualmente ese usuario a `role = 'admin'` siguiendo el procedimiento de bootstrap documentado en `CLAUDE.md` ("Bootstrap del primer admin en producción"), volver a iniciar sesión, y confirmar que esta vez sí llega a `/admin` y ve el placeholder.

- [ ] **Step 4: Documentar**

Agregar una nota breve a `CLAUDE.md` (sección nueva o junto al bootstrap de admin) confirmando que Google OAuth está configurado y funcionando, sin exponer el Client Secret en el repo.

```bash
git add CLAUDE.md
git commit -m "auth: documenta que Google OAuth está configurado y verificado end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 = historia 14 (proxy protege `/admin`). Task 2 = historia 10 en código (falta la config externa, Task 6) + parte de historia 11 (login). Task 3 = historia 14 (redirección por rol) + placeholder de lo que Épica 4 construye. Task 4 = historia 15 (pantalla pendiente) + logout (resto de historia 11). Task 5 = historia 11 (login alcanzable desde la landing). Task 6 = cierre real de historia 10 (credenciales conectadas) + verificación end-to-end de todo lo anterior.
- **Placeholder scan:** No hay TBD/TODO. Task 6 es deliberadamente distinta (config externa guiada) — no es un placeholder de trabajo pendiente sin especificar, tiene pasos concretos.
- **Type consistency:** `user.sub` se usa consistentemente en `admin/layout.tsx` (Task 3) y `pendiente/page.tsx` usa `user?.email` — ambos campos confirmados contra el tipo `JwtPayload` real instalado (`RequiredClaims.sub: string`, `JwtPayload.email?: string`). `createClient` de `server.ts` vs `client.ts` se importa desde el path correcto en cada archivo (server-only en layouts/páginas/route handlers, browser-only en `login-button.tsx`).
- **Verification limitation:** ningún task puede probar el login real de Google hasta Task 6 — esto está explícito en el header del plan y repetido en cada task afectada, para que un ejecutor no intente fabricar una prueba falsa de OAuth.
