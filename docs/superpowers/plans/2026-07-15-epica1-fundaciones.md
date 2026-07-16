# Épica 1 — Fundaciones (Sprint 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the technical foundations of Bichongos: a deployed Next.js + TypeScript app on Vercel at Bichongos.store, wired to a Supabase project, with the initial `profiles` data model and role enum in place.

**Architecture:** Single Next.js (App Router) app at the repo root, deployed to Vercel, backed by one Supabase project (Postgres + Auth). Supabase browser/server clients live in `src/lib/supabase/`. Database schema is managed as SQL migrations under `supabase/migrations/`.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS, `@supabase/supabase-js` + `@supabase/ssr`, Supabase CLI, Vercel CLI.

## Global Constraints

- UI language: español (from Task 2 of Épica 2 onward; Épica 1 has no user-facing UI copy).
- Never expose the `service_role` key to the client — only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public env vars.
- RLS must be enabled on every table from the moment it's created — no table exists without RLS, even temporarily.
- Server components by default; client components only where there's interactivity.
- Commits en español, imperativo, prefijo `fund:` para esta épica (ej. `fund: agrega modelo profiles`).
- Domain `bichongos.store` is already registered by the user at an external registrar (not Vercel Domains) — this plan only points DNS at Vercel, it does not purchase anything.
- No Supabase project exists yet — Task 2 creates it from scratch.

---

### Task 1: Scaffold Next.js + TypeScript project

**Files:**
- Create: entire Next.js project at repo root (`/Users/sergiomonsalve/Code/bichongos.store/`) via `create-next-app`
- Modify: `.gitignore` (verify `.env*.local` is present; `create-next-app` adds this by default)

**Interfaces:**
- Produces: a running Next.js App Router project (`src/app/`, `package.json`, `tsconfig.json`) that Task 2 adds Supabase clients into, and Task 3 deploys.

- [ ] **Step 1: Scaffold the project**

Run from `/Users/sergiomonsalve/Code/bichongos.store/`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted about the existing `README.md`/`.git` in a non-empty directory, confirm to proceed (it will not delete `.git` or `README.md`).

- [ ] **Step 2: Verify the dev server boots**

Run: `npm run dev -- --port 4000 &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000` then kill the background process.
Expected: `200`

- [ ] **Step 3: Verify production build succeeds**

Run: `npm run build`
Expected: exits 0, prints a route summary table ending in `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fund: scaffold proyecto Next.js con TypeScript"
```

---

### Task 2: Supabase project + environment variables + client setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `.env.local` (not committed — already covered by `create-next-app`'s `.gitignore`)
- Create: `.env.example` (committed, placeholder values only)
- Modify: `package.json` (adds `@supabase/supabase-js`, `@supabase/ssr`)

**Interfaces:**
- Consumes: nothing from Task 1 beyond the scaffolded project structure.
- Produces: `createClient()` from `src/lib/supabase/client.ts` (browser context) and `createClient()` from `src/lib/supabase/server.ts` (server/RSC context, `async`, reads cookies) — both return a Supabase JS client typed against the project. Task 4's migrations and Épica 3's auth work both depend on these.

- [ ] **Step 1: Create the Supabase project**

This is an interactive step the user must run themselves (requires browser login):

```bash
npx supabase login
npx supabase projects create bichongos --org-id <TU_ORG_ID> --region <REGION_MAS_CERCANA>
```

Run `npx supabase orgs list` first if `<TU_ORG_ID>` is unknown. Pick a region close to your users (e.g. `sa-east-1` for South America). Record the generated **project ref** and **database password** — the password is only shown once.

- [ ] **Step 2: Install Supabase client libraries**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Capture environment variables**

From the Supabase dashboard (Project Settings → API) for the new project, create `.env.local`:

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_PUBLIC_KEY>
EOF
```

And the committed placeholder version:

```bash
cat > .env.example <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
```

- [ ] **Step 4: Write the browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Write the server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component with no writable cookie store;
            // safe to ignore when middleware is refreshing the session
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Verify the connection**

Create a temporary smoke-test route `src/app/api/_smoke/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { error } = await supabase.auth.getSession()
  return NextResponse.json({ ok: !error, error: error?.message ?? null })
}
```

Run: `npm run dev -- --port 4000 &` then `curl -s http://localhost:4000/api/_smoke` then kill the background process.
Expected: `{"ok":true,"error":null}`

Then delete the smoke-test route: `rm -rf src/app/api/_smoke`

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase package.json package-lock.json .env.example .gitignore
git commit -m "fund: conecta proyecto Supabase con clientes browser/server"
```

---

### Task 3: Deploy to Vercel + configure domain

**Files:**
- No new source files. Vercel project configuration and DNS records only.

**Interfaces:**
- Consumes: the buildable Next.js project from Task 1 and env vars from Task 2.
- Produces: a live production URL at `https://bichongos.store` that later épicas ship against.

- [x] **Step 1: Log in to Vercel**

Interactive step the user must run themselves:

```bash
vercel login
```

Done — CLI authenticated as account `serandmoncas-6387` (team `serandmoncas-6387's projects`, team ID `team_T8hFXEpyLSKKwU1NGjuTkSMA`). Verified with `vercel whoami`.

- [x] **Step 2: Link and deploy the project**

```bash
vercel link --yes --project bichongos
echo -n "<value>" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo -n "<value>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

Done — new project `bichongos` created and linked under `serandmoncas-6387s-projects` (no prior project with that name existed). Both env vars piped in non-interactively from `.env.local` and confirmed present via `vercel env ls` (Production only). Production deploy succeeded; build compiled cleanly with Next.js 16.2.10 / Turbopack.

- [x] **Step 3: Verify the preview deployment**

Run: `curl -s -o /dev/null -w "%{http_code}" <URL_IMPRESA_POR_VERCEL>`
Expected: `200`

Done — deployment aliased to `https://bichongos.vercel.app`, which returns `200`. (The per-deployment URL `https://bichongos-465u9qdly-serandmoncas-6387s-projects.vercel.app` returns `302`, which is expected Vercel deployment-protection/redirect behavior on the raw deployment URL, not the aliased production domain.)

- [x] **Step 4: Attach the domain**

```bash
vercel domains add bichongos.store
```

Done — domain `bichongos.store` added to project `bichongos`. Vercel reports it is not yet configured and needs one of:

- **Option A (recommended):** `A` record — `bichongos.store` → `76.76.21.21`
- **Option B:** change nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com` (current: `dns1.registrar-servers.com` / `dns2.registrar-servers.com`)

This step must be completed by the domain owner in the registrar's DNS panel — the agent does not have registrar access. Vercel will email on verification once DNS is set.

- [ ] **Step 5: Verify the domain resolves**

DNS propagation can take up to a few hours. Once it has:

Run: `curl -s -o /dev/null -w "%{http_code}" https://bichongos.store`
Expected: `200`

Blocked on the user/registrar completing Step 4's DNS change — not yet run.

- [x] **Step 6: Commit deployment notes**

```bash
git add docs/superpowers/plans/2026-07-15-epica1-fundaciones.md
git commit -m "fund: documenta deploy en Vercel y dominio Bichongos.store"
```

---

### Task 4: Initial data model — `profiles` table and role enum

**Files:**
- Create: `supabase/migrations/00000000000001_profiles.sql`

**Interfaces:**
- Consumes: the Supabase project from Task 2 (project ref `hmrapzermtnyavqjoesh`, already created).
- Produces: table `public.profiles(id uuid, email text, nombre text, role user_role, estado text, created_at timestamptz)` and enum `public.user_role`, populated automatically on signup via trigger. Épica 3 (auth middleware) and Épica 4 (admin panel) both read/write this table.

- [ ] **Step 1: Apply the migration via the Supabase MCP server**

No CLI login needed — the controller is already authenticated to project `hmrapzermtnyavqjoesh` via the Supabase MCP server (same as Task 2). Use the MCP `apply_migration` tool directly against that project, passing the SQL from Step 2 below as its `query` and a descriptive `name` (e.g. `profiles`). Also save the same SQL to `supabase/migrations/00000000000001_profiles.sql` in the repo for history/reproducibility, even though the MCP tool — not `supabase db push` — is what actually applies it.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/00000000000001_profiles.sql`:

```sql
create type public.user_role as enum ('pendiente', 'estudiante', 'profesor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  role public.user_role not null default 'pendiente',
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "usuarios leen su propio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "usuarios actualizan su propio nombre"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "admin lee todos los perfiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy "admin actualiza todos los perfiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- SECURITY DEFINER is required here (only the Auth service can insert into
-- auth.users, and this trigger must insert into public.profiles on that
-- user's behalf before any RLS policy on profiles could apply to them).
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- make this callable directly via RPC by anon/authenticated — revoke that,
-- it must only ever run as this trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 3: Verify via the Supabase MCP server**

Use the MCP `list_tables` tool (schema `public`) to confirm `profiles` exists with the expected columns, and MCP `get_advisors` (type `security`) to confirm no new security lint issues (e.g. RLS-disabled warnings) were introduced.

- [ ] **Step 4: Verify the trigger end-to-end**

Use the MCP `execute_sql` tool to confirm RLS is enabled:

```sql
select relrowsecurity from pg_class where relname = 'profiles';
```

Expected: `t` (true).

Then, from the Supabase dashboard (Authentication → Add user) or MCP, create a throwaway test user and use `execute_sql` to confirm a row appears in `profiles` with `role = 'pendiente'` for that user's id. Delete the throwaway user afterward.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000001_profiles.sql
git commit -m "fund: agrega modelo profiles con enum de roles y RLS"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 = backlog #1, Task 2 = backlog #2, Task 3 = backlog #3, Task 4 = backlog #4. All four Épica 1 items covered; no items from Épica 2+ pulled in.
- **Placeholder scan:** `<PROJECT_REF>`, `<TU_ORG_ID>`, `<REGION_MAS_CERCANA>`, `<ANON_PUBLIC_KEY>`, `<URL_IMPRESA_POR_VERCEL>` are intentional — they're values only known after running the preceding interactive command, not omitted logic.
- **Type consistency:** `createClient()` signature (sync in `client.ts`, `async` in `server.ts`) is consistent with how Épica 3's middleware and Épica 4's admin pages will need to call it.
