# Módulo de contenidos (Épica 6, historia 25) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profesor/admin crean, editan y eliminan contenido de capacitación (fichas de especie y SOPs) en Markdown desde `/admin/contenidos`; cualquier rol aprobado lee la lista y el detalle renderizado; el nivel (N1-N4) es metadata visible, sin restringir acceso.

**Architecture:** Tabla nueva `contenidos` con RLS (SELECT para cualquier rol aprobado; INSERT/UPDATE/DELETE solo profesor/admin, cualquiera sobre cualquier fila — a diferencia de `lotes`/`registros`, esta tabla sí es editable/eliminable porque es documentación, no una bitácora de auditoría física). Server Actions + un formulario compartido (`ContenidoForm`) siguiendo el patrón exacto de `LoteForm`. La página de detalle usa `react-markdown` (dependencia nueva) para renderizar el cuerpo como HTML real, no texto plano.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres, RLS), `react-markdown` para renderizado, Playwright para E2E, TypeScript.

## Global Constraints

- RLS en todas las tablas — ninguna tabla nueva sin políticas (CLAUDE.md).
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend (CLAUDE.md).
- Server Actions nunca reciben la identidad como parámetro del cliente — `created_by`/`updated_by` siempre sale de `supabase.auth.getClaims().data.claims.sub` (spec, y precedente en `createLote`/`createRegistro`).
- Commits en español, imperativo, prefijo por épica: `capacitacion: ...` para código de producto, `test: ...` para specs de E2E (CLAUDE.md).
- Idioma de la UI: español (CLAUDE.md).
- `nivel` es un `text` libre, no un enum — no todo SOP tiene un nivel N1-N4 limpio (spec, sección 1).
- El nivel es solo metadata visible/filtrable en esta historia — no restringe qué contenido ve un usuario (spec, CA5). No implementar ningún gating por nivel.

---

## Contexto de archivos (dónde va cada cosa)

- `supabase/migrations/00000000000015_contenidos.sql` — tabla + RLS (Tarea 1)
- `src/app/admin/contenidos/actions.ts` — Server Actions `createContenido`/`updateContenido`/`deleteContenido` (Tarea 2)
- `src/app/admin/contenidos/contenido-form.tsx` — client component del formulario, compartido crear/editar (Tarea 2)
- `src/app/admin/contenidos/page.tsx` — lista con filtro por categoría (Tarea 3)
- `src/app/admin/contenidos/nuevo/page.tsx` — página de creación (Tarea 3)
- `src/app/admin/layout.tsx` — se le agrega el link "Contenidos" al nav (Tarea 3, modifica archivo existente)
- `src/app/admin/contenidos/[id]/page.tsx` — página de detalle con Markdown renderizado (Tarea 4)
- `src/app/admin/contenidos/[id]/eliminar-contenido-button.tsx` — botón de eliminar con confirmación (Tarea 4)
- `src/app/globals.css` — reglas CSS para el contenido renderizado, bajo la clase `.markdown-body` (Tarea 4, modifica archivo existente)
- `package.json` — se agrega `react-markdown` como dependencia (Tarea 4, modifica archivo existente)
- `src/app/admin/contenidos/[id]/editar/page.tsx` — página de edición (Tarea 5)
- `e2e/admin-contenidos.spec.ts` — cobertura E2E de CA1-CA6 (Tarea 6)

---

### Task 1: Migración — tabla `contenidos` con RLS

**Files:**
- Create: `supabase/migrations/00000000000015_contenidos.sql`

**Interfaces:**
- Consumes: `public.profiles(id, role)` (ya existe).
- Produces: tipo `public.contenido_categoria` (`'ficha_especie' | 'sop'`); tabla `public.contenidos` con columnas `id uuid`, `titulo text`, `categoria public.contenido_categoria`, `nivel text` (nullable), `cuerpo text`, `created_by uuid`, `created_at timestamptz`, `updated_by uuid` (nullable), `updated_at timestamptz`. Las tareas 2-6 dependen de este nombre de tabla y estos nombres de columna exactos.

- [ ] **Step 1: Escribir la migración**

```sql
create type public.contenido_categoria as enum ('ficha_especie', 'sop');

create table public.contenidos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria public.contenido_categoria not null,
  nivel text,
  cuerpo text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.contenidos enable row level security;

grant select on public.contenidos to authenticated;
grant insert, update, delete on public.contenidos to authenticated;

create policy "cualquier rol aprobado lee contenidos"
  on public.contenidos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "profesor y admin crean contenidos"
  on public.contenidos for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin editan contenidos"
  on public.contenidos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  )
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin eliminan contenidos"
  on public.contenidos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

-- A diferencia de lotes/registros (que nunca se editan/borran, principio
-- de inmutabilidad como bitácora física), contenidos SÍ tiene policies de
-- UPDATE y DELETE reales: es documentación editable, no un registro de
-- auditoría. updated_by/updated_at dan trazabilidad mínima de quién tocó
-- qué por última vez, dado que cualquier profesor/admin puede editar el
-- contenido de cualquier otro.
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase start` (si el stack local no está corriendo) seguido de `npx supabase db reset`
Expected: la salida termina sin errores y lista `00000000000015_contenidos.sql` como aplicada.

- [ ] **Step 3: Verificar la estructura con psql**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.contenidos"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select policyname, cmd from pg_policies where tablename = 'contenidos'"
```
Expected: la primera muestra las 8 columnas con los tipos definidos arriba; la segunda lista exactamente 4 filas (`cualquier rol aprobado lee contenidos` / SELECT, `profesor y admin crean contenidos` / INSERT, `profesor y admin editan contenidos` / UPDATE, `profesor y admin eliminan contenidos` / DELETE).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000015_contenidos.sql
git commit -m "capacitacion: agrega la tabla contenidos con RLS (profesor/admin gestionan, cualquier rol aprobado lee)"
```

---

### Task 2: Server Actions + formulario compartido `ContenidoForm`

**Files:**
- Create: `src/app/admin/contenidos/actions.ts`
- Create: `src/app/admin/contenidos/contenido-form.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tabla `contenidos` (Tarea 1).
- Produces: tipo `ContenidoCategoria` (`"ficha_especie" | "sop"`); interfaz `ContenidoFormValues { titulo: string; categoria: ContenidoCategoria; nivel: string; cuerpo: string }`; funciones `createContenido(values: ContenidoFormValues): Promise<void>`, `updateContenido(id: string, values: ContenidoFormValues): Promise<void>`, `deleteContenido(id: string): Promise<void>`. Componente `ContenidoForm({ initialValues, onSubmit }: { initialValues: ContenidoFormValues; onSubmit: (values: ContenidoFormValues) => Promise<void> })`. Las tareas 3-6 dependen de estos nombres exactos.

- [ ] **Step 1: Escribir las Server Actions**

`src/app/admin/contenidos/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ContenidoCategoria = "ficha_especie" | "sop";

export interface ContenidoFormValues {
  titulo: string;
  categoria: ContenidoCategoria;
  nivel: string;
  cuerpo: string;
}

export async function createContenido(values: ContenidoFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("contenidos").insert({
    titulo: values.titulo,
    categoria: values.categoria,
    nivel: values.nivel || null,
    cuerpo: values.cuerpo,
    created_by: userId,
  });
  if (error) {
    throw new Error(`No se pudo crear el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
}

export async function updateContenido(id: string, values: ContenidoFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("contenidos")
    .update({
      titulo: values.titulo,
      categoria: values.categoria,
      nivel: values.nivel || null,
      cuerpo: values.cuerpo,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`No se pudo actualizar el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${id}`);
}

export async function deleteContenido(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("contenidos").delete().eq("id", id);
  if (error) {
    throw new Error(`No se pudo eliminar el contenido: ${error.message}`);
  }

  revalidatePath("/admin/contenidos");
}
```

- [ ] **Step 2: Escribir el formulario compartido**

`src/app/admin/contenidos/contenido-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContenidoCategoria, ContenidoFormValues } from "./actions";

const CATEGORIAS: { value: ContenidoCategoria; label: string }[] = [
  { value: "ficha_especie", label: "Ficha de especie" },
  { value: "sop", label: "SOP" },
];

export function ContenidoForm({
  initialValues,
  onSubmit,
}: {
  initialValues: ContenidoFormValues;
  onSubmit: (values: ContenidoFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            router.push("/admin/contenidos");
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Título
        <input
          required
          value={values.titulo}
          onChange={(e) => setValues({ ...values, titulo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Categoría
        <select
          value={values.categoria}
          onChange={(e) =>
            setValues({ ...values, categoria: e.target.value as ContenidoCategoria })
          }
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Nivel
        <input
          value={values.nivel}
          onChange={(e) => setValues({ ...values, nivel: e.target.value })}
          placeholder="N1, N2, N3, N4…"
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Cuerpo (Markdown)
        <textarea
          required
          rows={20}
          value={values.cuerpo}
          onChange={(e) => setValues({ ...values, cuerpo: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1 font-mono"
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

Nota: tras guardar (crear o editar), siempre redirige a `/admin/contenidos` (la lista) — mismo comportamiento que `LoteForm`, no a la página de detalle del contenido recién creado/editado.

- [ ] **Step 3: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos terminan sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/contenidos/actions.ts src/app/admin/contenidos/contenido-form.tsx
git commit -m "capacitacion: agrega Server Actions y formulario compartido para contenidos"
```

---

### Task 3: Lista `/admin/contenidos` + página de creación + link de nav

**Files:**
- Create: `src/app/admin/contenidos/page.tsx`
- Create: `src/app/admin/contenidos/nuevo/page.tsx`
- Modify: `src/app/admin/layout.tsx` (agregar el link "Contenidos" al `<nav>`)

**Interfaces:**
- Consumes: `ContenidoForm` y `createContenido` (Tarea 2); tabla `contenidos` (Tarea 1).
- Produces: rutas `/admin/contenidos` y `/admin/contenidos/nuevo`.

- [ ] **Step 1: Escribir la página de lista**

`src/app/admin/contenidos/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

const CATEGORIA_LABELS: Record<string, string> = {
  ficha_especie: "Ficha de especie",
  sop: "SOP",
};

export default async function ContenidosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
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

  const COLUMNAS = "id, titulo, categoria, nivel, created_at";
  const categoriaValida =
    categoria === "ficha_especie" || categoria === "sop" ? categoria : null;

  const { data: contenidos } = categoriaValida
    ? await supabase
        .from("contenidos")
        .select(COLUMNAS)
        .eq("categoria", categoriaValida)
        .order("created_at", { ascending: false })
    : await supabase
        .from("contenidos")
        .select(COLUMNAS)
        .order("created_at", { ascending: false });

  const filtroClase = (activo: boolean) =>
    activo ? "text-musgo-oscuro underline" : "text-tinta/60";

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Contenidos</h1>
        {canEdit && (
          <Link
            href="/admin/contenidos/nuevo"
            className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
          >
            Nuevo contenido
          </Link>
        )}
      </div>
      <div className="mt-4 flex gap-4 font-mono text-sm">
        <Link href="/admin/contenidos" className={filtroClase(!categoriaValida)}>
          Todas
        </Link>
        <Link
          href="/admin/contenidos?categoria=ficha_especie"
          className={filtroClase(categoriaValida === "ficha_especie")}
        >
          Fichas de especie
        </Link>
        <Link
          href="/admin/contenidos?categoria=sop"
          className={filtroClase(categoriaValida === "sop")}
        >
          SOPs
        </Link>
      </div>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Título</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Nivel</th>
            <th className="py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {(contenidos ?? []).map((contenido) => (
            <tr key={contenido.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/contenidos/${contenido.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {contenido.titulo}
                </Link>
              </td>
              <td className="py-2 pr-4">
                {CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria}
              </td>
              <td className="py-2 pr-4">{contenido.nivel ?? "—"}</td>
              <td className="py-2">
                {new Date(contenido.created_at).toLocaleDateString("es")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Escribir la página de creación**

`src/app/admin/contenidos/nuevo/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContenidoForm } from "../contenido-form";
import { createContenido } from "../actions";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

export default async function NuevoContenidoPage() {
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
    redirect("/admin/contenidos");
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Nuevo contenido</h1>
      <div className="mt-8">
        <ContenidoForm
          initialValues={{ titulo: "", categoria: "ficha_especie", nivel: "", cuerpo: "" }}
          onSubmit={createContenido}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Agregar el link "Contenidos" al nav**

En `src/app/admin/layout.tsx`, ubicar el bloque (dentro de `<nav>`, después del link "Tareas"):
```tsx
            <Link href="/admin/tareas" className="text-tinta/70 hover:text-tinta">
              Tareas
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```
Reemplazar por (agrega "Contenidos" entre "Tareas" y "Mi perfil", visible a cualquier rol aprobado):
```tsx
            <Link href="/admin/tareas" className="text-tinta/70 hover:text-tinta">
              Tareas
            </Link>
            <Link href="/admin/contenidos" className="text-tinta/70 hover:text-tinta">
              Contenidos
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```

- [ ] **Step 4: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/contenidos/page.tsx src/app/admin/contenidos/nuevo/page.tsx src/app/admin/layout.tsx
git commit -m "capacitacion: agrega la lista y la creación de contenidos, con filtro por categoría y link de nav"
```

---

### Task 4: Página de detalle con Markdown renderizado + eliminar

**Files:**
- Create: `src/app/admin/contenidos/[id]/page.tsx`
- Create: `src/app/admin/contenidos/[id]/eliminar-contenido-button.tsx`
- Modify: `src/app/globals.css` (agrega reglas `.markdown-body`)
- Modify: `package.json` (agrega `react-markdown`)

**Interfaces:**
- Consumes: `deleteContenido` (Tarea 2); tabla `contenidos` (Tarea 1).
- Produces: ruta `/admin/contenidos/[id]`; componente `EliminarContenidoButton({ id }: { id: string })`.

- [ ] **Step 1: Instalar `react-markdown`**

Run: `npm install react-markdown`
Expected: se agrega como dependencia en `package.json`/`package-lock.json`. No requiere `@types/react-markdown` — el paquete trae sus propios tipos de TypeScript.

- [ ] **Step 2: Agregar estilos para el contenido renderizado**

En `src/app/globals.css`, agregar al final del archivo:
```css
.markdown-body h1 {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.markdown-body h2 {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.markdown-body h3 {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.markdown-body p {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.markdown-body ul,
.markdown-body ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.markdown-body li {
  margin-bottom: 0.25rem;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid color-mix(in oklch, var(--color-tinta) 15%, transparent);
  padding: 0.5rem;
  text-align: left;
}

.markdown-body code {
  font-family: var(--font-mono);
  background: color-mix(in oklch, var(--color-tinta) 8%, transparent);
  padding: 0.1rem 0.3rem;
  font-size: 0.875em;
}

.markdown-body pre {
  background: color-mix(in oklch, var(--color-tinta) 8%, transparent);
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.markdown-body pre code {
  background: none;
  padding: 0;
}
```
No se usa el plugin `@tailwindcss/typography` — el proyecto no lo tiene instalado y esta tabla de reglas acotada alcanza para lo que el contenido real (fichas de especie, SOPs) necesita: encabezados, tablas, listas, código.

- [ ] **Step 3: Escribir el botón de eliminar**

`src/app/admin/contenidos/[id]/eliminar-contenido-button.tsx`:
```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContenido } from "../actions";

export function EliminarContenidoButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("¿Eliminar este contenido? No se puede deshacer.")) {
          return;
        }
        startTransition(async () => {
          try {
            await deleteContenido(id);
            router.push("/admin/contenidos");
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "No se pudo eliminar.");
          }
        });
      }}
      className="font-mono text-sm uppercase tracking-wide text-terracota underline disabled:text-tinta/30 disabled:no-underline"
    >
      Eliminar
    </button>
  );
}
```

- [ ] **Step 4: Escribir la página de detalle**

`src/app/admin/contenidos/[id]/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { EliminarContenidoButton } from "./eliminar-contenido-button";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

const CATEGORIA_LABELS: Record<string, string> = {
  ficha_especie: "Ficha de especie",
  sop: "SOP",
};

export default async function ContenidoDetallePage({
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

  const { data: contenido } = await supabase
    .from("contenidos")
    .select("id, titulo, categoria, nivel, cuerpo")
    .eq("id", id)
    .single();

  if (!contenido) {
    notFound();
  }

  return (
    <main className="px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{contenido.titulo}</h1>
          <p className="mt-1 font-mono text-sm text-tinta/60">
            {CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria}
            {contenido.nivel && ` · ${contenido.nivel}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-4">
            <Link
              href={`/admin/contenidos/${contenido.id}/editar`}
              className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
            >
              Editar
            </Link>
            <EliminarContenidoButton id={contenido.id} />
          </div>
        )}
      </div>
      <article className="markdown-body mt-8 max-w-2xl">
        <ReactMarkdown>{contenido.cuerpo}</ReactMarkdown>
      </article>
    </main>
  );
}
```

Nota: `react-markdown` no usa hooks ni APIs del navegador — funciona directo como Server Component, no necesita `"use client"`.

- [ ] **Step 5: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/contenidos/[id]/page.tsx src/app/admin/contenidos/[id]/eliminar-contenido-button.tsx src/app/globals.css package.json package-lock.json
git commit -m "capacitacion: agrega el detalle de contenido con Markdown renderizado y el botón de eliminar"
```

---

### Task 5: Página de edición

**Files:**
- Create: `src/app/admin/contenidos/[id]/editar/page.tsx`

**Interfaces:**
- Consumes: `ContenidoForm` y `updateContenido` (Tarea 2); tabla `contenidos` (Tarea 1).
- Produces: ruta `/admin/contenidos/[id]/editar`.

- [ ] **Step 1: Escribir la página de edición**

`src/app/admin/contenidos/[id]/editar/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContenidoForm } from "../../contenido-form";
import { updateContenido } from "../../actions";

const ROLES_QUE_EDITAN = ["profesor", "admin"];

export default async function EditarContenidoPage({
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
    redirect(`/admin/contenidos/${id}`);
  }

  const { data: contenido } = await supabase
    .from("contenidos")
    .select("id, titulo, categoria, nivel, cuerpo")
    .eq("id", id)
    .single();

  if (!contenido) {
    notFound();
  }

  const updateContenidoBound = updateContenido.bind(null, contenido.id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Editar contenido</h1>
      <div className="mt-8">
        <ContenidoForm
          initialValues={{
            titulo: contenido.titulo,
            categoria: contenido.categoria,
            nivel: contenido.nivel ?? "",
            cuerpo: contenido.cuerpo,
          }}
          onSubmit={updateContenidoBound}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/contenidos/[id]/editar/page.tsx
git commit -m "capacitacion: agrega la página de edición de contenidos"
```

---

### Task 6: Cobertura E2E (CA1-CA6)

**Files:**
- Create: `e2e/admin-contenidos.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `./fixtures/test-users` (ya existe); ruta `/e2e-login`; toda la UI y RLS de las Tareas 1-5.

- [ ] **Step 1: Escribir el spec E2E completo**

`e2e/admin-contenidos.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearContenidoDePrueba(
  titulo: string,
  categoria: "ficha_especie" | "sop",
  nivel: string | null,
  creadoPorId: string
): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.contenidos (titulo, categoria, nivel, cuerpo, created_by) values ($1, $2, $3, $4, $5) returning id",
      [titulo, categoria, nivel, "Cuerpo de prueba", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un profesor crea un contenido y el detalle lo renderiza como markdown, no texto plano", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/nuevo`
  );
  await page.getByLabel("Título").fill("Ficha de prueba");
  await page.getByLabel("Categoría").selectOption("ficha_especie");
  await page.getByLabel("Nivel").fill("N1");
  await page
    .getByLabel("Cuerpo (Markdown)")
    .fill("# Encabezado\n\n| Columna A | Columna B |\n| --- | --- |\n| 1 | 2 |\n");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await page.getByRole("link", { name: "Ficha de prueba" }).click();

  await expect(page.getByRole("heading", { name: "Encabezado" })).toBeVisible();
  const celda = page.locator("table td", { hasText: "2" });
  await expect(celda).toBeVisible();
});

test("un estudiante ve el contenido pero no los controles de crear/editar/eliminar", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido solo lectura",
    "sop",
    "N2",
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos`
  );
  await expect(page.getByRole("link", { name: "Nuevo contenido" })).toHaveCount(0);

  await page.goto(`/admin/contenidos/${contenidoId}`);
  await expect(page.getByRole("heading", { name: "Contenido solo lectura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("un estudiante no puede crear contenido directamente, RLS lo rechaza", async () => {
  const estudiante = await createTestUser("estudiante");

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
        "insert into public.contenidos (titulo, categoria, cuerpo, created_by) values ($1, $2, $3, $4)",
        ["Intento estudiante", "sop", "cuerpo", estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un profesor distinto puede editar el contenido de otro, y queda registrado quién lo editó", async ({
  page,
}) => {
  const profesorA = await createTestUser("profesor");
  const profesorB = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido editado por otro",
    "ficha_especie",
    "N1",
    profesorA.id
  );

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesorB.email)}&password=${encodeURIComponent(profesorB.password)}&next=/admin/contenidos/${contenidoId}/editar`
  );
  await page.getByLabel("Título").fill("Título editado por B");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: "Título editado por B" })).toBeVisible();

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query("select updated_by from public.contenidos where id = $1", [
      contenidoId,
    ]);
    expect(result.rows[0].updated_by).toBe(profesorB.id);
  } finally {
    await db.end();
  }
});

test("un profesor puede eliminar un contenido", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido a eliminar",
    "sop",
    null,
    profesor.id
  );

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
  await expect(page.getByRole("link", { name: "Contenido a eliminar" })).toHaveCount(0);
});

test("el nivel es metadata visible pero no restringe el acceso de un estudiante", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(
    "Contenido nivel avanzado",
    "sop",
    "N4",
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await expect(page.getByRole("heading", { name: "Contenido nivel avanzado" })).toBeVisible();
  await expect(page.getByText("N4")).toBeVisible();
});
```

- [ ] **Step 2: Correr el archivo de E2E nuevo en aislamiento**

Run: `npx playwright test e2e/admin-contenidos.spec.ts`
Expected: los 6 tests pasan. Si `npx supabase start` no está corriendo, arrancarlo primero, y exportar las variables de entorno igual que en plans anteriores (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_E2E_TEST_MODE=true`, vía `npx supabase status -o env`).

- [ ] **Step 3: Correr la suite completa (regresión)**

Run: `npm run lint && npm run typecheck && npm run build && npm run test && npm run test:e2e`
Expected: todo pasa en verde, incluyendo los specs preexistentes (`admin-lotes.spec.ts`, `admin-registros.spec.ts`, `admin-tareas.spec.ts`, `admin-auditoria.spec.ts`, etc.) — confirma que la tabla y las rutas nuevas no rompieron nada existente.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-contenidos.spec.ts
git commit -m "test: agrega E2E del módulo de contenidos (crear, solo lectura, RLS, editar cruzado, eliminar, nivel sin gating)"
```

---

## Self-review del plan

- **Cobertura de la spec:** CA1 → Tarea 6 test 1 (vía UI, usa la policy de INSERT de la Tarea 1). CA2 → Tarea 6 tests 2 (UI) y 3 (RLS directo). CA3 → Tarea 6 tests 1 y 2 (lista completa + detalle renderizado, no texto plano). CA4 → Tarea 6 tests 4 (editar cruzado) y 5 (eliminar). CA5 → Tarea 6 test 6 (nivel N4 visible para estudiante, sin bloqueo). CA6 → Tarea 6 test 4 (verifica `updated_by` en la base tras el edit).
- **Placeholders:** ninguno — cada step tiene código completo o un comando y su salida esperada.
- **Consistencia de tipos:** `ContenidoCategoria`/`ContenidoFormValues` se definen una sola vez en `actions.ts` (Tarea 2) y se importan igual en `contenido-form.tsx` (Tarea 2), `page.tsx` de lista (Tarea 3, solo como valor de columna) y `[id]/page.tsx`/`[id]/editar/page.tsx` (Tareas 4-5, vía el tipo inferido de la fila de `contenidos`). `ContenidoForm` recibe siempre `{ initialValues, onSubmit }` con la misma forma en las Tareas 3 y 5. `EliminarContenidoButton` recibe `{ id: string }`, coincide con cómo la Tarea 4 lo invoca.
