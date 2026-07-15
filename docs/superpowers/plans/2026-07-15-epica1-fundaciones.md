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

- [ ] **Step 1: Log in to Vercel**

Interactive step the user must run themselves:

```bash
vercel login
```

- [ ] **Step 2: Link and deploy the project**

```bash
vercel link --yes
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

Paste the same values from `.env.local` when prompted for each env var.

- [ ] **Step 3: Verify the preview deployment**

Run: `curl -s -o /dev/null -w "%{http_code}" <URL_IMPRESA_POR_VERCEL>`
Expected: `200`

- [ ] **Step 4: Attach the domain**

```bash
vercel domains add bichongos.store
```

Vercel prints the DNS records to add (typically an `A` record to `76.76.21.21` and/or `CNAME` for `www`). Add those records at your domain registrar's DNS panel — this step happens outside the CLI, in the registrar's dashboard.

- [ ] **Step 5: Verify the domain resolves**

DNS propagation can take up to a few hours. Once it has:

Run: `curl -s -o /dev/null -w "%{http_code}" https://bichongos.store`
Expected: `200`

- [ ] **Step 6: Commit deployment notes**

```bash
git add docs/superpowers/plans/2026-07-15-epica1-fundaciones.md
git commit -m "fund: documenta deploy en Vercel y dominio Bichongos.store"
```

---

### Task 4: Initial data model — `profiles` table and role enum

**Files:**
- Create: `supabase/migrations/00000000000001_profiles.sql`

**Interfaces:**
- Consumes: the Supabase project from Task 2 (`npx supabase link --project-ref <PROJECT_REF>` must have been run once).
- Produces: table `public.profiles(id uuid, email text, nombre text, role user_role, estado text, created_at timestamptz)` and enum `public.user_role`, populated automatically on signup via trigger. Épica 3 (auth middleware) and Épica 4 (admin panel) both read/write this table.

- [ ] **Step 1: Link the local CLI to the remote project**

```bash
npx supabase link --project-ref <PROJECT_REF>
```

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
  using (auth.uid() = id);

create policy "usuarios actualizan su propio nombre"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "admin lee todos los perfiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "admin actualiza todos los perfiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 3: Apply the migration to the remote project**

```bash
npx supabase db push
```

Expected: CLI reports the migration applied with no errors.

- [ ] **Step 4: Verify the trigger and RLS**

In the Supabase dashboard SQL editor, or via `npx supabase db execute`, run:

```sql
select column_name, data_type from information_schema.columns where table_name = 'profiles';
select relrowsecurity from pg_class where relname = 'profiles';
```

Expected: the `profiles` columns match the migration, and `relrowsecurity` is `t` (true).

Then, from the app, sign up a throwaway test user via Supabase Auth (dashboard → Authentication → Add user, or the eventual login flow in Épica 3) and confirm a row appears in `profiles` with `role = 'pendiente'`.

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
