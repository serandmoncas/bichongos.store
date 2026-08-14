# Seguimiento de progreso (Épica 6, historia 26) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario aprobado marca/desmarca contenidos como leídos y ve su avance en `/admin/contenidos`; profesor/admin ven el avance de todo el equipo en `/admin/progreso`.

**Architecture:** Tabla nueva `lecturas` con un `unique (contenido_id, user_id)` — la presencia de la fila *es* el estado, así que marcar es un INSERT y desmarcar un DELETE, sin columna de estado que pueda desincronizarse. RLS: cada quien lee/escribe/borra las suyas; profesor y admin además leen todas (pero no borran ajenas). La UI reutiliza `listar_usuarios_aprobados()` (migración 11) para listar al equipo y el patrón de dos-queries-y-cruce-en-memoria que usa el resto de la app.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres, RLS), Playwright para E2E, TypeScript.

## Global Constraints

- RLS en todas las tablas — ninguna tabla nueva sin políticas (CLAUDE.md).
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend (CLAUDE.md).
- Server Actions nunca reciben la identidad como parámetro del cliente — `user_id` siempre sale de `supabase.auth.getClaims().data.claims.sub` (spec, sección 2).
- Commits en español, imperativo, prefijo por épica: `capacitacion: ...` para código de producto, `test: ...` para specs de E2E (CLAUDE.md).
- Idioma de la UI: español (CLAUDE.md).
- La policy de DELETE de `lecturas` se restringe al dueño — un profesor NO puede desmarcar la lectura de otra persona (spec, CA6). Esto difiere a propósito de `contenidos`, donde profesor/admin sí borran filas ajenas.
- Un INSERT/DELETE denegado por RLS **no lanza excepción** — devuelve cero filas. Toda Server Action de escritura verifica que afectó filas y lanza error explícito si no (precedente: `deleteContenido`/`updateContenido` en `src/app/admin/contenidos/actions.ts`).

---

## Contexto de archivos (dónde va cada cosa)

- `supabase/migrations/00000000000017_lecturas.sql` — tabla + RLS (Tarea 1)
- `src/app/admin/contenidos/lecturas-actions.ts` — Server Actions `marcarLeido`/`desmarcarLeido` (Tarea 2)
- `src/app/admin/contenidos/[id]/lectura-toggle.tsx` — client component del botón (Tarea 2)
- `src/app/admin/contenidos/page.tsx` — se le agrega la marca de leído y el contador (Tarea 3, modifica archivo existente)
- `src/app/admin/contenidos/[id]/page.tsx` — se le agrega el toggle (Tarea 3, modifica archivo existente)
- `src/app/admin/progreso/page.tsx` — tabla de avance por persona (Tarea 4)
- `src/app/admin/progreso/[id]/page.tsx` — detalle de una persona (Tarea 4)
- `src/app/admin/layout.tsx` — link "Progreso" solo para profesor/admin (Tarea 4, modifica archivo existente)
- `e2e/admin-progreso.spec.ts` — cobertura E2E de CA1-CA6 (Tarea 5)

---

### Task 1: Migración — tabla `lecturas` con RLS

**Files:**
- Create: `supabase/migrations/00000000000017_lecturas.sql`

**Interfaces:**
- Consumes: `public.contenidos(id)` y `public.profiles(id, role)` (ya existen).
- Produces: tabla `public.lecturas` con columnas `id uuid`, `contenido_id uuid`, `user_id uuid`, `created_at timestamptz`, y un `unique (contenido_id, user_id)`. Las tareas 2-5 dependen de estos nombres exactos.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.lecturas (
  id uuid primary key default gen_random_uuid(),
  contenido_id uuid not null references public.contenidos(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contenido_id, user_id)
);

alter table public.lecturas enable row level security;

grant select on public.lecturas to authenticated;
grant insert, delete on public.lecturas to authenticated;

create policy "cada quien ve sus propias lecturas"
  on public.lecturas for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profesor y admin ven todas las lecturas"
  on public.lecturas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "cada quien marca sus propias lecturas"
  on public.lecturas for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "cada quien borra sus propias lecturas"
  on public.lecturas for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Sin policy de UPDATE: una lectura existe o no existe. Marcar es un
-- INSERT, desmarcar es un DELETE. No hay columna de estado que pueda
-- desincronizarse, y el unique(contenido_id, user_id) hace imposible
-- marcar dos veces el mismo contenido.
--
-- La policy de DELETE se restringe al dueño (user_id = auth.uid()), NO a
-- profesor/admin — deliberado: el progreso es el registro personal del
-- estudiante y un supervisor no lo edita. Difiere a propósito de
-- contenidos (migración 15), donde profesor/admin sí borran filas ajenas
-- porque ahí el dato es documentación compartida.
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase start` (si el stack local no está corriendo) seguido de `npx supabase db reset`
Expected: la salida termina sin errores y lista `00000000000017_lecturas.sql` como aplicada.

- [ ] **Step 3: Verificar la estructura con psql**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.lecturas"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select policyname, cmd from pg_policies where tablename = 'lecturas' order by cmd, policyname"
```
Expected: la primera muestra las 4 columnas y un índice único sobre `(contenido_id, user_id)`; la segunda lista exactamente 4 filas — 1 de DELETE (`cada quien borra sus propias lecturas`), 1 de INSERT (`cada quien marca sus propias lecturas`) y 2 de SELECT (`cada quien ve sus propias lecturas`, `profesor y admin ven todas las lecturas`). Sin fila de UPDATE.

- [ ] **Step 4: Verificar el comportamiento de RLS con psql**

Este chequeo es el que de verdad importa: las policies se prueban ejecutándolas como un usuario simulado, no leyendo su texto. Un DELETE denegado por RLS devuelve `DELETE 0` sin lanzar error — por eso se verifica el número de filas, no una excepción.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
\set ON_ERROR_STOP off
-- Setup: un estudiante, un profesor y un contenido.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'estudiante-lecturas@bichongos.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'profesor-lecturas@bichongos.test');
set session_replication_role = replica;
update public.profiles set role = 'estudiante' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set role = 'profesor' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
set session_replication_role = default;
insert into public.contenidos (id, titulo, categoria, cuerpo, created_by)
  values ('cccccccc-0000-0000-0000-000000000003', 'Contenido de prueba', 'sop', 'cuerpo', 'bbbbbbbb-0000-0000-0000-000000000002');

\echo '-- El estudiante marca su propia lectura: debe INSERTAR 1'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.lecturas (contenido_id, user_id)
  values ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001');
commit;

\echo '-- El estudiante intenta marcar a nombre del profesor: RLS lo RECHAZA'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.lecturas (contenido_id, user_id)
  values ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002');
rollback;

\echo '-- El profesor VE la lectura del estudiante: debe devolver 1 fila'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select count(*) as lecturas_visibles_para_profesor from public.lecturas;
rollback;

\echo '-- El profesor intenta BORRAR la lectura del estudiante: afecta 0 filas (no lanza error)'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
delete from public.lecturas where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
rollback;

\echo '-- El estudiante borra la suya: debe afectar 1 fila'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.lecturas where contenido_id = 'cccccccc-0000-0000-0000-000000000003';
rollback;

\echo '-- Cleanup'
delete from public.contenidos where id = 'cccccccc-0000-0000-0000-000000000003';
delete from auth.users where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
SQL
```
Expected, en orden: `INSERT 0 1` · `ERROR: new row violates row-level security policy for table "lecturas"` · `lecturas_visibles_para_profesor = 1` · `DELETE 0` (el profesor no borra ajenas — CA6) · `DELETE 1` (el estudiante sí borra la suya). Pegar esta salida en el reporte.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000017_lecturas.sql
git commit -m "capacitacion: agrega la tabla lecturas con RLS (cada quien marca las suyas, profesor/admin las leen todas)"
```

---

### Task 2: Server Actions + componente `LecturaToggle`

**Files:**
- Create: `src/app/admin/contenidos/lecturas-actions.ts`
- Create: `src/app/admin/contenidos/[id]/lectura-toggle.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tabla `lecturas` (Tarea 1).
- Produces: `marcarLeido(contenidoId: string): Promise<void>` y `desmarcarLeido(contenidoId: string): Promise<void>`. Componente `LecturaToggle({ contenidoId, leido }: { contenidoId: string; leido: boolean })`. Las tareas 3 y 5 dependen de estos nombres exactos.

- [ ] **Step 1: Escribir las Server Actions**

`src/app/admin/contenidos/lecturas-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarLeido(contenidoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("lecturas")
    .insert({ contenido_id: contenidoId, user_id: userId })
    .select("id");
  if (error) {
    throw new Error(`No se pudo marcar como leído: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo marcar como leído: sin permisos.");
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${contenidoId}`);
}

export async function desmarcarLeido(contenidoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("lecturas")
    .delete()
    .eq("contenido_id", contenidoId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw new Error(`No se pudo desmarcar: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo desmarcar: no estaba marcado o sin permisos.");
  }

  revalidatePath("/admin/contenidos");
  revalidatePath(`/admin/contenidos/${contenidoId}`);
}
```

Nota: el `.eq("user_id", userId)` del delete es redundante con la policy de RLS (que ya restringe al dueño), pero se deja explícito para que la intención sea evidente al leer el código y para que un cambio futuro en la policy no convierta esto en un borrado ajeno silencioso.

- [ ] **Step 2: Escribir el componente toggle**

`src/app/admin/contenidos/[id]/lectura-toggle.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarLeido, desmarcarLeido } from "../lecturas-actions";

export function LecturaToggle({
  contenidoId,
  leido,
}: {
  contenidoId: string;
  leido: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              if (leido) {
                await desmarcarLeido(contenidoId);
              } else {
                await marcarLeido(contenidoId);
              }
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo guardar.");
            }
          });
        }}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        {leido ? "Marcar como no leído" : "Marcar como leído"}
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos terminan sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/contenidos/lecturas-actions.ts src/app/admin/contenidos/[id]/lectura-toggle.tsx
git commit -m "capacitacion: agrega Server Actions y botón para marcar contenidos como leídos"
```

---

### Task 3: Avance propio en la lista y el detalle de contenidos

**Files:**
- Modify: `src/app/admin/contenidos/page.tsx`
- Modify: `src/app/admin/contenidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `LecturaToggle` (Tarea 2); tabla `lecturas` (Tarea 1).
- Produces: la marca visual y el contador en la lista; el toggle en el detalle. La Tarea 5 verifica ambos.

- [ ] **Step 1: Agregar la marca y el contador a la lista**

En `src/app/admin/contenidos/page.tsx`, después del bloque que obtiene `contenidos` (la asignación `const { data: contenidos } = categoriaValida ? ... : ...`), agregar:

```tsx
  const { data: lecturas } = await supabase.from("lecturas").select("contenido_id");
  const leidos = new Set((lecturas ?? []).map((l) => l.contenido_id));

  const { count: totalContenidos } = await supabase
    .from("contenidos")
    .select("id", { count: "exact", head: true });
```

Nota: la policy de SELECT de `lecturas` ya acota las filas a las del usuario actual (salvo profesor/admin, que ven todas). Para que el contador sea siempre el avance **propio** y no el del equipo, el query filtra explícitamente por el usuario:

```tsx
  const { data: lecturas } = await supabase
    .from("lecturas")
    .select("contenido_id")
    .eq("user_id", user.sub);
  const leidos = new Set((lecturas ?? []).map((l) => l.contenido_id));

  const { count: totalContenidos } = await supabase
    .from("contenidos")
    .select("id", { count: "exact", head: true });
```

Usar esta segunda versión (con el `.eq`), no la primera — sin ese filtro, un profesor vería el conteo de lecturas de todo el equipo mezclado con el suyo.

Luego, reemplazar el bloque del encabezado:
```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Contenidos</h1>
        {canEdit && (
```
por:
```tsx
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Contenidos</h1>
          <p className="mt-1 font-mono text-sm text-tinta/60">
            {leidos.size} de {totalContenidos ?? 0} leídos
          </p>
        </div>
        {canEdit && (
```

Agregar la columna de leído al `<thead>`, reemplazando:
```tsx
            <th className="py-2 pr-4">Título</th>
```
por:
```tsx
            <th className="py-2 pr-4 w-8" aria-label="Leído"></th>
            <th className="py-2 pr-4">Título</th>
```

Y la celda correspondiente en el `<tbody>`, reemplazando:
```tsx
            <tr key={contenido.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/contenidos/${contenido.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {contenido.titulo}
                </Link>
              </td>
```
por:
```tsx
            <tr key={contenido.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4 text-musgo-oscuro">
                {leidos.has(contenido.id) ? (
                  <span aria-label="Leído" title="Leído">✓</span>
                ) : (
                  <span aria-hidden="true"> </span>
                )}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/contenidos/${contenido.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {contenido.titulo}
                </Link>
              </td>
```

- [ ] **Step 2: Agregar el toggle al detalle**

En `src/app/admin/contenidos/[id]/page.tsx`:

Agregar el import junto a los existentes:
```tsx
import { LecturaToggle } from "./lectura-toggle";
```

Después del bloque que obtiene `contenido` y su `if (!contenido) { notFound(); }`, agregar:
```tsx
  const { data: lectura } = await supabase
    .from("lecturas")
    .select("id")
    .eq("contenido_id", contenido.id)
    .eq("user_id", user.sub)
    .maybeSingle();
```

Nota: `.maybeSingle()` y no `.single()` — lo normal es que la fila no exista (el contenido aún no está leído), y `.single()` trataría ese caso como error.

Luego, reemplazar el bloque de acciones del encabezado:
```tsx
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
```
por:
```tsx
        <div className="flex items-start gap-4">
          <LecturaToggle contenidoId={contenido.id} leido={Boolean(lectura)} />
          {canEdit && (
            <>
              <Link
                href={`/admin/contenidos/${contenido.id}/editar`}
                className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
              >
                Editar
              </Link>
              <EliminarContenidoButton id={contenido.id} />
            </>
          )}
        </div>
```

- [ ] **Step 3: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/contenidos/page.tsx src/app/admin/contenidos/[id]/page.tsx
git commit -m "capacitacion: muestra el avance propio en la lista y el toggle de leído en el detalle"
```

---

### Task 4: Vista de supervisión `/admin/progreso` + link de nav

**Files:**
- Create: `src/app/admin/progreso/page.tsx`
- Create: `src/app/admin/progreso/[id]/page.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: función RPC `listar_usuarios_aprobados()` (migración 11 — retorna filas `{ id: string; nombre: string | null; email: string; role: string }`); función RPC `nombres_de_usuarios(ids uuid[])` (migración 9 — retorna `{ id, nombre, email }`); tabla `lecturas` (Tarea 1); tabla `contenidos` (ya existe).
- Produces: rutas `/admin/progreso` y `/admin/progreso/[id]`.

- [ ] **Step 1: Escribir la página de progreso del equipo**

`src/app/admin/progreso/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ROLES_QUE_SUPERVISAN = ["profesor", "admin"];

export default async function ProgresoPage() {
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

  if (!profile || !ROLES_QUE_SUPERVISAN.includes(profile.role)) {
    redirect("/admin/contenidos");
  }

  type Persona = { id: string; nombre: string | null; email: string; role: string };

  const { data: personas }: { data: Persona[] | null } = await supabase.rpc(
    "listar_usuarios_aprobados"
  );

  const { data: lecturas } = await supabase.from("lecturas").select("user_id");

  const { count: totalContenidos } = await supabase
    .from("contenidos")
    .select("id", { count: "exact", head: true });

  const total = totalContenidos ?? 0;
  const conteoPorUsuario = new Map<string, number>();
  for (const lectura of lecturas ?? []) {
    conteoPorUsuario.set(lectura.user_id, (conteoPorUsuario.get(lectura.user_id) ?? 0) + 1);
  }

  const filas = (personas ?? [])
    .map((persona) => {
      const leidos = conteoPorUsuario.get(persona.id) ?? 0;
      return {
        ...persona,
        leidos,
        porcentaje: total === 0 ? 0 : Math.round((leidos / total) * 100),
      };
    })
    .sort((a, b) => b.porcentaje - a.porcentaje);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Progreso</h1>
      <p className="mt-1 font-mono text-sm text-tinta/60">
        Avance del equipo sobre {total} contenidos
      </p>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Persona</th>
            <th className="py-2 pr-4">Rol</th>
            <th className="py-2 pr-4">Leídos</th>
            <th className="py-2">Avance</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="border-b border-tinta/5">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/progreso/${fila.id}`}
                  className="text-musgo-oscuro underline"
                >
                  {fila.nombre ?? fila.email}
                </Link>
              </td>
              <td className="py-2 pr-4">{fila.role}</td>
              <td className="py-2 pr-4">
                {fila.leidos} / {total}
              </td>
              <td className="py-2">{fila.porcentaje} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Escribir el detalle por persona**

`src/app/admin/progreso/[id]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABELS } from "../../contenidos/categorias";

const ROLES_QUE_SUPERVISAN = ["profesor", "admin"];

export default async function ProgresoPersonaPage({
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

  if (!profile || !ROLES_QUE_SUPERVISAN.includes(profile.role)) {
    redirect("/admin/contenidos");
  }

  type Perfil = { id: string; nombre: string | null; email: string };

  const { data: perfiles }: { data: Perfil[] | null } = await supabase.rpc(
    "nombres_de_usuarios",
    { ids: [id] }
  );
  const persona = perfiles?.[0];

  const { data: lecturas } = await supabase
    .from("lecturas")
    .select("id, contenido_id, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  type Contenido = { id: string; titulo: string; categoria: string; nivel: string | null };

  const contenidoIds = (lecturas ?? []).map((l) => l.contenido_id);
  const { data: contenidos }: { data: Contenido[] | null } = contenidoIds.length
    ? await supabase
        .from("contenidos")
        .select("id, titulo, categoria, nivel")
        .in("id", contenidoIds)
    : { data: [] };

  const contenidoDe = (contenidoId: string) =>
    contenidos?.find((c) => c.id === contenidoId);

  return (
    <main className="px-6 py-12">
      <Link
        href="/admin/progreso"
        className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
      >
        ← Progreso
      </Link>
      <h1 className="mt-4 font-serif text-2xl font-semibold">
        {persona?.nombre ?? persona?.email ?? id}
      </h1>
      <p className="mt-1 font-mono text-sm text-tinta/60">
        {(lecturas ?? []).length} contenidos leídos
      </p>
      <table className="mt-8 w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-left text-tinta/60">
            <th className="py-2 pr-4">Contenido</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Nivel</th>
            <th className="py-2">Leído</th>
          </tr>
        </thead>
        <tbody>
          {(lecturas ?? []).map((lectura) => {
            const contenido = contenidoDe(lectura.contenido_id);
            return (
              <tr key={lectura.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/contenidos/${lectura.contenido_id}`}
                    className="text-musgo-oscuro underline"
                  >
                    {contenido?.titulo ?? lectura.contenido_id}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {contenido ? (CATEGORIA_LABELS[contenido.categoria] ?? contenido.categoria) : "—"}
                </td>
                <td className="py-2 pr-4">{contenido?.nivel ?? "—"}</td>
                <td className="py-2">
                  {new Date(lectura.created_at).toLocaleDateString("es")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Agregar el link "Progreso" al nav**

En `src/app/admin/layout.tsx`, ubicar el bloque condicional de admin y los links siguientes:
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
Agregar inmediatamente **después** de ese bloque (antes del link "Lotes") un bloque nuevo para profesor/admin:
```tsx
            {(profile.role === "profesor" || profile.role === "admin") && (
              <Link href="/admin/progreso" className="text-tinta/70 hover:text-tinta">
                Progreso
              </Link>
            )}
```
El resto del nav (Lotes, Tareas, Contenidos, Mi perfil) queda exactamente igual.

- [ ] **Step 4: Typecheck, lint y build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: los tres terminan sin errores, y la tabla de rutas del build incluye `/admin/progreso` y `/admin/progreso/[id]`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/progreso/page.tsx src/app/admin/progreso/[id]/page.tsx src/app/admin/layout.tsx
git commit -m "capacitacion: agrega la vista de progreso del equipo para profesor y admin"
```

---

### Task 5: Cobertura E2E (CA1-CA6)

**Files:**
- Create: `e2e/admin-progreso.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `./fixtures/test-users` (ya existe); ruta `/e2e-login`; toda la UI y RLS de las Tareas 1-4.

- [ ] **Step 1: Escribir el spec E2E completo**

`e2e/admin-progreso.spec.ts`:
```ts
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function tituloUnico(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}

async function crearContenidoDePrueba(titulo: string, creadoPorId: string): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.contenidos (titulo, categoria, nivel, cuerpo, created_by) values ($1, $2, $3, $4, $5) returning id",
      [titulo, "sop", "N1", "Cuerpo de prueba", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un estudiante marca y desmarca un contenido, y su avance se refleja en la lista", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const titulo = tituloUnico("Contenido para marcar");
  const contenidoId = await crearContenidoDePrueba(titulo, profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como no leído" })).toBeVisible();

  // En la lista debe aparecer la marca en la fila de ese contenido.
  await page.goto("/admin/contenidos");
  const fila = page.locator("tbody tr", { hasText: titulo });
  await expect(fila).toContainText("✓");

  // Desmarcar lo revierte.
  await page.goto(`/admin/contenidos/${contenidoId}`);
  await page.getByRole("button", { name: "Marcar como no leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como leído" })).toBeVisible();

  await page.goto("/admin/contenidos");
  const filaSinMarca = page.locator("tbody tr", { hasText: titulo });
  await expect(filaSinMarca).not.toContainText("✓");
});

test("un profesor ve en /admin/progreso lo que marcó el estudiante", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const titulo = tituloUnico("Contenido supervisado");
  const contenidoId = await crearContenidoDePrueba(titulo, profesor.id);
  const estudiante = await createTestUser("estudiante");

  // El estudiante marca el contenido por la UI.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos/${contenidoId}`
  );
  await page.getByRole("button", { name: "Marcar como leído" }).click();
  await expect(page.getByRole("button", { name: "Marcar como no leído" })).toBeVisible();

  // El profesor entra a la vista de supervisión y ve a esa persona.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/progreso`
  );
  await expect(page.getByRole("heading", { name: "Progreso" })).toBeVisible();

  const filaEstudiante = page.locator("tbody tr", { hasText: estudiante.email });
  await expect(filaEstudiante).toBeVisible();

  // Y en su detalle ve el contenido específico que leyó.
  await filaEstudiante.getByRole("link", { name: estudiante.email }).click();
  await expect(page.getByRole("link", { name: titulo })).toBeVisible();
});

test("un estudiante no ve el link Progreso y es redirigido si entra directo", async ({ page }) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/contenidos`
  );
  await expect(page.getByRole("heading", { name: "Contenidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Progreso" })).toHaveCount(0);

  await page.goto("/admin/progreso");
  await expect(page).toHaveURL(/\/admin\/contenidos$/);
});

test("un estudiante no puede marcar una lectura a nombre de otro, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(tituloUnico("Contenido RLS"), profesor.id);
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
      db.query("insert into public.lecturas (contenido_id, user_id) values ($1, $2)", [
        contenidoId,
        estudianteB.id,
      ])
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un profesor no puede borrar la lectura de otra persona (afecta cero filas)", async () => {
  const profesor = await createTestUser("profesor");
  const contenidoId = await crearContenidoDePrueba(tituloUnico("Contenido CA6"), profesor.id);
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    // El estudiante marca su lectura (insertada directo, sin pasar por la UI).
    await db.query("insert into public.lecturas (contenido_id, user_id) values ($1, $2)", [
      contenidoId,
      estudiante.id,
    ]);

    // El profesor intenta borrarla. RLS no lanza error en un DELETE denegado:
    // simplemente no afecta filas. Por eso se verifica rowCount, no una excepción.
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query(
      `set local "request.jwt.claims" = '${JSON.stringify({ sub: profesor.id, role: "authenticated" })}'`
    );
    const resultado = await db.query("delete from public.lecturas where contenido_id = $1", [
      contenidoId,
    ]);
    expect(resultado.rowCount).toBe(0);
    await db.query("rollback");

    // La lectura del estudiante sigue existiendo.
    const quedan = await db.query(
      "select count(*)::int as n from public.lecturas where contenido_id = $1",
      [contenidoId]
    );
    expect(quedan.rows[0].n).toBe(1);
  } finally {
    await db.end();
  }
});
```

- [ ] **Step 2: Correr el spec nuevo en aislamiento**

Run: `npx playwright test e2e/admin-progreso.spec.ts`
Expected: los 5 tests pasan. Antes de correr, exportar las variables de entorno en la **misma** invocación de shell que el comando de playwright:
```bash
npx supabase status -o env > /tmp/supabase-status.env
export NEXT_PUBLIC_SUPABASE_URL=$(grep '^API_URL=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
export NEXT_PUBLIC_E2E_TEST_MODE=true
```

Dos gotchas conocidos de esta máquina, documentados para no perder tiempo redescubriéndolos:
1. Si Playwright no logra levantar el servidor, revisar `lsof -nP -iTCP:3000 -sTCP:LISTEN` — un proceso de Obsidian suele tomar el puerto 3000. No editar `playwright.config.ts` para esquivarlo; reportarlo.
2. Después de un `npx supabase db reset`, el gateway Kong puede quedar con la IP vieja del contenedor de Auth y devolver 502 en cada creación de usuario de prueba. Se arregla con `docker restart supabase_kong_bichongos`.

- [ ] **Step 3: Correr la suite completa (regresión)**

Run: `npm run lint && npm run typecheck && npm run build && npm run test && npm run test:e2e`
Expected: todo en verde. Nota conocida: bajo la ejecución paralela completa (5 workers) esta máquina produce timeouts intermitentes en tests de mutación de varios specs preexistentes — es contención de CPU, no una regresión de esta rama (se reprodujo usando el spec preexistente `admin-tareas` como control). Si aparece un fallo, reportar qué spec, qué test, en cuántas corridas de cuántas, y si se reproduce en aislamiento. No "arreglar" un spec preexistente para poner la suite en verde.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-progreso.spec.ts
git commit -m "test: agrega E2E de seguimiento de progreso (marcar, desmarcar, supervisión, RLS)"
```

---

## Self-review del plan

- **Cobertura de la spec:** CA1 → Tarea 5 test 1 (marcar y desmarcar vía UI). CA2 → Tarea 5 test 1 (marca en la lista) + Tarea 3 (contador «X de Y»). CA3 → Tarea 5 test 2 (profesor ve el avance y el detalle). CA4 → Tarea 5 test 3 (sin link y redirigido). CA5 → Tarea 5 test 4 (RLS rechaza el insert ajeno). CA6 → Tarea 5 test 5 (delete ajeno afecta cero filas) + Tarea 1 Step 4 (misma verificación a nivel psql).
- **Placeholders:** ninguno — cada step tiene el código completo o el comando con su salida esperada.
- **Consistencia de tipos:** `marcarLeido(contenidoId: string)` y `desmarcarLeido(contenidoId: string)` se definen en la Tarea 2 y se importan con esos nombres exactos en `lectura-toggle.tsx` (Tarea 2). `LecturaToggle` recibe `{ contenidoId, leido }` y así lo invoca la Tarea 3. `listar_usuarios_aprobados()` devuelve `{ id, nombre, email, role }` (migración 11) y `nombres_de_usuarios(ids)` devuelve `{ id, nombre, email }` (migración 9) — la Tarea 4 usa cada uno con esas formas. `CATEGORIA_LABELS` se importa desde `../../contenidos/categorias` en la Tarea 4, que es la ruta correcta desde `src/app/admin/progreso/[id]/`.
- **Una decisión que vale la pena señalar:** el conteo de la lista (Tarea 3) filtra explícitamente por `user_id` aunque la RLS ya acota las filas. Sin ese filtro, un profesor —que por policy ve todas las lecturas— vería el conteo del equipo entero como si fuera su avance personal. El plan incluye la advertencia en el propio step para que no se transcriba la versión sin filtro.
