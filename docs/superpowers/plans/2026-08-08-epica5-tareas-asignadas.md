# Asignación de tareas (Épica 5, historia 24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profesor/admin asignan tareas (lote + tipo + persona) a cualquier usuario aprobado; cada quien ve sus propias tareas en `/admin/tareas` (profesor/admin ven todas); la tarea se completa sola cuando la persona asignada registra una entrada de bitácora que calza en lote + tipo.

**Architecture:** Tabla nueva `tareas_asignadas` con RLS (INSERT solo profesor/admin, SELECT acotado por dueño o rol supervisor). Un trigger `AFTER INSERT` sobre `registros` (ya existente) hace el auto-completado vía `SECURITY DEFINER`, mismo patrón que el trigger de auditoría de `profiles`. Una función `SECURITY DEFINER` nueva (`listar_usuarios_aprobados`) resuelve a quién se le puede asignar, porque `profiles` por RLS solo es legible por su dueño (salvo admin). La UI es una página nueva `/admin/tareas` que reutiliza el patrón de dos-queries-y-cruce-en-memoria ya usado en `/admin/lotes/[id]` y `/admin/auditoria`.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres, RLS, `SECURITY DEFINER` functions/triggers), Playwright para E2E, TypeScript.

## Global Constraints

- RLS en todas las tablas — ninguna tabla nueva sin políticas (CLAUDE.md).
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend (CLAUDE.md).
- Server Actions nunca reciben la identidad como parámetro del cliente — `user_id`/`asignado_por` siempre sale de `supabase.auth.getClaims().data.claims.sub` (spec, sección 5, y precedente en `createRegistro`/`createLote`).
- Commits en español, imperativo, prefijo por épica: `cultivo: ...` para código de producto, `test: ...` para specs de E2E (CLAUDE.md, precedente en `git log`).
- Idioma de la UI: español (CLAUDE.md).
- `tareas_asignadas` no tiene policy de UPDATE ni DELETE para `authenticated` — el único cambio posterior a la creación es el paso a `completada`, hecho exclusivamente por el trigger de la Tarea 3 (spec, sección 1).

---

## Contexto de archivos (dónde va cada cosa)

- `supabase/migrations/00000000000010_tareas_asignadas.sql` — tabla + RLS (Tarea 1)
- `supabase/migrations/00000000000011_listar_usuarios_aprobados.sql` — función para poblar el selector de personas (Tarea 2)
- `supabase/migrations/00000000000012_completar_tarea_asignada.sql` — trigger de auto-completado (Tarea 3)
- `src/app/admin/tareas/actions.ts` — Server Action `asignarTarea` (Tarea 4)
- `src/app/admin/tareas/asignar-tarea-form.tsx` — client component del formulario (Tarea 4)
- `src/app/admin/tareas/page.tsx` — página `/admin/tareas` (Tarea 5)
- `src/app/admin/layout.tsx` — se le agrega el link "Tareas" al nav (Tarea 5, modifica archivo existente)
- `e2e/admin-tareas.spec.ts` — cobertura E2E de CA1-CA7 (Tarea 6)

El enum `public.registro_tipo` (`riego | humedad | temperatura | observacion`) ya existe desde la migración 8 y se reutiliza tal cual para el `tipo` de una tarea asignada — no se crea un enum nuevo para eso.

---

### Task 1: Migración — tabla `tareas_asignadas` con RLS

**Files:**
- Create: `supabase/migrations/00000000000010_tareas_asignadas.sql`

**Interfaces:**
- Consumes: `public.lotes(id)`, `public.registros(id)`, `public.profiles(id, role)` (ya existen).
- Produces: tipo `public.tarea_estado` (`'pendiente' | 'completada'`); tabla `public.tareas_asignadas` con columnas `id uuid`, `lote_id uuid`, `tipo public.registro_tipo`, `asignado_a uuid`, `asignado_por uuid`, `estado public.tarea_estado`, `registro_id uuid` (nullable), `created_at timestamptz`, `completada_en timestamptz` (nullable). Las tareas 2-6 dependen de este nombre de tabla y de estos nombres de columna exactos.

- [ ] **Step 1: Escribir la migración**

```sql
create type public.tarea_estado as enum ('pendiente', 'completada');

create table public.tareas_asignadas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  tipo public.registro_tipo not null,
  asignado_a uuid not null references auth.users(id),
  asignado_por uuid not null references auth.users(id),
  estado public.tarea_estado not null default 'pendiente',
  registro_id uuid references public.registros(id),
  created_at timestamptz not null default now(),
  completada_en timestamptz
);

alter table public.tareas_asignadas enable row level security;

grant select on public.tareas_asignadas to authenticated;
grant insert on public.tareas_asignadas to authenticated;

create policy "cada quien ve sus propias tareas asignadas"
  on public.tareas_asignadas for select
  to authenticated
  using (asignado_a = (select auth.uid()));

create policy "profesor y admin ven todas las tareas asignadas"
  on public.tareas_asignadas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin asignan tareas"
  on public.tareas_asignadas for insert
  to authenticated
  with check (
    asignado_por = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
    and exists (
      select 1 from public.profiles
      where id = asignado_a and role <> 'pendiente'
    )
  );

-- Sin policy de UPDATE ni DELETE para "authenticated": la única escritura
-- posterior a la creación es el paso a "completada", hecho exclusivamente
-- por el trigger completar_tarea_asignada (migración 12, SECURITY
-- DEFINER) — nunca directo por el usuario. Si una tarea se asignó por
-- error, queda pendiente para siempre, mismo principio de inmutabilidad
-- que lotes y registros.
```

**Nota post-implementación:** el tercer `exists()` de este `with check` resultó estar roto — queda filtrado por la RLS de `profiles` del propio caller, que solo expone su propia fila (o todas, si es admin), así que un profesor nunca podía pasar ese chequeo al asignar a otra persona. Corregido en `supabase/migrations/00000000000013_fix_tareas_asignadas_insert_policy.sql` con una función `SECURITY DEFINER` (`es_perfil_aprobado()`), mismo patrón que `is_admin()` (migración 3).

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase start` (si el stack local no está corriendo) seguido de `npx supabase db reset`
Expected: la salida termina sin errores y lista `00000000000010_tareas_asignadas.sql` como aplicada.

- [ ] **Step 3: Verificar la estructura con psql**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.tareas_asignadas"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select policyname, cmd from pg_policies where tablename = 'tareas_asignadas'"
```
Expected: la primera muestra las 9 columnas con los tipos definidos arriba; la segunda lista exactamente 3 filas (`cada quien ve sus propias tareas asignadas` / SELECT, `profesor y admin ven todas las tareas asignadas` / SELECT, `profesor y admin asignan tareas` / INSERT) — sin fila de UPDATE ni DELETE.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000010_tareas_asignadas.sql
git commit -m "cultivo: agrega la tabla tareas_asignadas con RLS (profesor/admin asignan, cada quien lee las suyas)"
```

---

### Task 2: Migración — función `listar_usuarios_aprobados`

**Files:**
- Create: `supabase/migrations/00000000000011_listar_usuarios_aprobados.sql`

**Interfaces:**
- Consumes: `public.profiles(id, nombre, email, role)`.
- Produces: función RPC `public.listar_usuarios_aprobados()` sin parámetros, retorna filas `{ id uuid, nombre text, email text, role text }`. La Tarea 5 la invoca vía `supabase.rpc("listar_usuarios_aprobados")`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Función acotada para que profesor/admin puedan listar a quién asignarle
-- una tarea (/admin/tareas). La RLS normal de profiles solo deja ver el
-- propio perfil (o todos, si eres admin) — profesor no tiene ese acceso.
-- Mismo patrón que nombres_de_usuarios (migración 9): bypass deliberado y
-- acotado a id/nombre/email/role, no la fila completa.
create function public.listar_usuarios_aprobados()
returns table (id uuid, nombre text, email text, role text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles caller
    where caller.id = auth.uid() and caller.role in ('profesor', 'admin')
  ) then
    return;
  end if;

  return query
    select p.id, p.nombre, p.email, p.role::text
    from public.profiles p
    where p.role <> 'pendiente';
end;
$$;

revoke execute on function public.listar_usuarios_aprobados() from public, anon;
grant execute on function public.listar_usuarios_aprobados() to authenticated;
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase db reset`
Expected: sin errores, `00000000000011_listar_usuarios_aprobados.sql` aparece aplicada.

- [ ] **Step 3: Verificar el bypass de rol con psql**

Run (como `postgres`, sin sesión — comprueba que la función existe y no revienta con `role = null` fuera de un contexto autenticado):
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select * from public.listar_usuarios_aprobados()"
```
Expected: devuelve 0 filas (no hay `auth.uid()` en esta sesión psql cruda, así que el `if not exists` corta antes) — no debe lanzar error de tipo ni de sintaxis. Este es el mismo comportamiento de `nombres_de_usuarios` fuera de una sesión autenticada.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000011_listar_usuarios_aprobados.sql
git commit -m "cultivo: agrega listar_usuarios_aprobados para poblar el selector de asignación de tareas"
```

---

### Task 3: Migración — trigger de auto-completado

**Files:**
- Create: `supabase/migrations/00000000000012_completar_tarea_asignada.sql`

**Interfaces:**
- Consumes: tabla `public.tareas_asignadas` (Tarea 1), tabla `public.registros` (columnas `id, lote_id, tipo, user_id`, ya existentes).
- Produces: comportamiento — todo INSERT en `registros` dispara este trigger; no expone función ni tipo nuevo consumido por otras tareas.

- [ ] **Step 1: Escribir la migración**

```sql
-- Al crear un registro de bitácora, si existe una tarea asignada
-- pendiente del mismo lote + tipo + persona, se marca completada
-- automáticamente. SECURITY DEFINER porque quien inserta el registro
-- (la persona asignada) no tiene (ni necesita) permiso de UPDATE directo
-- sobre tareas_asignadas — mismo patrón que log_profile_role_estado_change
-- (migración 6).
create function public.completar_tarea_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tareas_asignadas
  set estado = 'completada', registro_id = new.id, completada_en = now()
  where id = (
    select id from public.tareas_asignadas
    where lote_id = new.lote_id
      and tipo = new.tipo
      and asignado_a = new.user_id
      and estado = 'pendiente'
    order by created_at asc
    limit 1
  );
  return new;
end;
$$;

revoke execute on function public.completar_tarea_asignada() from public, anon, authenticated;

create trigger on_registro_completar_tarea
  after insert on public.registros
  for each row execute procedure public.completar_tarea_asignada();
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase db reset`
Expected: sin errores, `00000000000012_completar_tarea_asignada.sql` aparece aplicada.

- [ ] **Step 3: Verificar el trigger con psql (usando el rol `postgres`, sin RLS de por medio)**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
-- crea un usuario auth mínimo: el trigger handle_new_user (migración 1) ya
-- crea su fila en public.profiles con role = 'pendiente' automáticamente,
-- así que NO se debe volver a insertar esa fila (violaría la PK) — solo
-- subirle el rol, y solo se puede hacer con
-- session_replication_role = replica (igual que el bootstrap del primer
-- admin documentado en CLAUDE.md y que e2e/fixtures/test-users.ts), porque
-- el trigger enforce_role_estado_immutable (migración 2) bloquea cualquier
-- UPDATE de role/estado fuera de una sesión admin autenticada, y en psql
-- crudo auth.uid() es NULL.
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'trigger-test@bichongos.test');
set session_replication_role = replica;
update public.profiles set role = 'estudiante' where id = '11111111-1111-1111-1111-111111111111';
set session_replication_role = default;
insert into public.lotes (id, nombre, especie, created_by) values ('22222222-2222-2222-2222-222222222222', 'Lote trigger test', 'Orellana', '11111111-1111-1111-1111-111111111111');
insert into public.tareas_asignadas (lote_id, tipo, asignado_a, asignado_por) values ('22222222-2222-2222-2222-222222222222', 'riego', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
insert into public.registros (lote_id, user_id, tipo, valor) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'riego', '200ml');
select estado, registro_id is not null as tiene_registro from public.tareas_asignadas where lote_id = '22222222-2222-2222-2222-222222222222';
delete from public.lotes where id = '22222222-2222-2222-2222-222222222222';
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
SQL
```
Expected: el `select` final muestra `estado = completada` y `tiene_registro = t`. El `delete` de `auth.users` al final cae en cascada sobre `public.profiles` (migración 1: `on delete cascade`); el `delete` de `lotes` ya se llevó por cascada `tareas_asignadas` y `registros` de ese lote.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000012_completar_tarea_asignada.sql
git commit -m "cultivo: agrega el trigger que completa una tarea asignada al registrar la tarea correspondiente"
```

---

### Task 4: Server Action `asignarTarea` + formulario `AsignarTareaForm`

**Files:**
- Create: `src/app/admin/tareas/actions.ts`
- Create: `src/app/admin/tareas/asignar-tarea-form.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tipo `RegistroTipo` de `../lotes/registros-actions` (ya existe: `"riego" | "humedad" | "temperatura" | "observacion"`); tabla `tareas_asignadas` (Tarea 1).
- Produces: `asignarTarea(loteId: string, asignadoA: string, tipo: RegistroTipo): Promise<void>` — la Tarea 5 la importa y la pasa (o la usa directamente) desde `AsignarTareaForm`. Componente `AsignarTareaForm({ lotes, personas }: { lotes: { id: string; nombre: string }[]; personas: { id: string; nombre: string | null; email: string }[] })` — la Tarea 5 lo renderiza pasándole ambos arrays.

- [ ] **Step 1: Escribir la Server Action**

`src/app/admin/tareas/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RegistroTipo } from "../lotes/registros-actions";

export async function asignarTarea(loteId: string, asignadoA: string, tipo: RegistroTipo) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase.from("tareas_asignadas").insert({
    lote_id: loteId,
    asignado_a: asignadoA,
    asignado_por: userId,
    tipo,
  });
  if (error) {
    throw new Error(`No se pudo asignar la tarea: ${error.message}`);
  }

  revalidatePath("/admin/tareas");
}
```

- [ ] **Step 2: Escribir el formulario cliente**

`src/app/admin/tareas/asignar-tarea-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarTarea } from "./actions";
import type { RegistroTipo } from "../lotes/registros-actions";

const TIPOS: { value: RegistroTipo; label: string }[] = [
  { value: "riego", label: "Riego" },
  { value: "humedad", label: "Humedad" },
  { value: "temperatura", label: "Temperatura" },
  { value: "observacion", label: "Observación" },
];

export function AsignarTareaForm({
  lotes,
  personas,
}: {
  lotes: { id: string; nombre: string }[];
  personas: { id: string; nombre: string | null; email: string }[];
}) {
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");
  const [asignadoA, setAsignadoA] = useState(personas[0]?.id ?? "");
  const [tipo, setTipo] = useState<RegistroTipo>("observacion");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (lotes.length === 0 || personas.length === 0) {
    return null;
  }

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await asignarTarea(loteId, asignadoA, tipo);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo asignar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Lote
        <select
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {lotes.map((lote) => (
            <option key={lote.id} value={lote.id}>
              {lote.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Persona
        <select
          value={asignadoA}
          onChange={(e) => setAsignadoA(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre ?? persona.email}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as RegistroTipo)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Asignar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos terminan sin errores. Si `lint` marca los dos archivos nuevos, corregir antes de continuar (no hay excepciones configuradas para este directorio).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/tareas/actions.ts src/app/admin/tareas/asignar-tarea-form.tsx
git commit -m "cultivo: agrega Server Action y formulario para asignar tareas"
```

---

### Task 5: Página `/admin/tareas` + link de nav

**Files:**
- Create: `src/app/admin/tareas/page.tsx`
- Modify: `src/app/admin/layout.tsx` (agregar el link "Tareas" al `<nav>`)

**Interfaces:**
- Consumes: `AsignarTareaForm` (Tarea 4), función RPC `nombres_de_usuarios` (ya existe, migración 9, firma `(ids: uuid[]) => { id, nombre, email }[]`), función RPC `listar_usuarios_aprobados` (Tarea 2), tabla `tareas_asignadas` (Tarea 1), tabla `lotes` (ya existe).
- Produces: ruta `/admin/tareas` visible a cualquier rol aprobado.

- [ ] **Step 1: Escribir la página**

`src/app/admin/tareas/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AsignarTareaForm } from "./asignar-tarea-form";

const ROLES_QUE_ASIGNAN = ["profesor", "admin"];

const TIPO_LABELS: Record<string, string> = {
  riego: "Riego",
  humedad: "Humedad",
  temperatura: "Temperatura",
  observacion: "Observación",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
};

export default async function TareasPage() {
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

  const puedeAsignar = ROLES_QUE_ASIGNAN.includes(profile?.role ?? "");

  const COLUMNAS = "id, lote_id, tipo, asignado_a, asignado_por, estado, created_at";
  const { data: tareas } = puedeAsignar
    ? await supabase
        .from("tareas_asignadas")
        .select(COLUMNAS)
        .order("created_at", { ascending: false })
    : await supabase
        .from("tareas_asignadas")
        .select(COLUMNAS)
        .eq("asignado_a", user.sub)
        .order("created_at", { ascending: false });

  type Perfil = { id: string; nombre: string | null; email: string };
  type Lote = { id: string; nombre: string };

  const userIds = Array.from(
    new Set((tareas ?? []).flatMap((t) => [t.asignado_a, t.asignado_por]))
  );
  const { data: perfiles }: { data: Perfil[] | null } = userIds.length
    ? await supabase.rpc("nombres_de_usuarios", { ids: userIds })
    : { data: [] };

  const nombreDe = (userId: string) => {
    const p = perfiles?.find((p: Perfil) => p.id === userId);
    return p?.nombre ?? p?.email ?? userId;
  };

  const loteIds = Array.from(new Set((tareas ?? []).map((t) => t.lote_id)));
  const { data: lotesDeLasTareas }: { data: Lote[] | null } = loteIds.length
    ? await supabase.from("lotes").select("id, nombre").in("id", loteIds)
    : { data: [] };

  const nombreDeLote = (loteId: string) =>
    lotesDeLasTareas?.find((l) => l.id === loteId)?.nombre ?? loteId;

  let lotesParaAsignar: Lote[] = [];
  let personasParaAsignar: Perfil[] = [];

  if (puedeAsignar) {
    const [{ data: lotes }, { data: personas }] = await Promise.all([
      supabase.from("lotes").select("id, nombre").order("nombre"),
      supabase.rpc("listar_usuarios_aprobados"),
    ]);
    lotesParaAsignar = lotes ?? [];
    personasParaAsignar = personas ?? [];
  }

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Tareas</h1>

      {puedeAsignar && (
        <div className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Asignar tarea</h2>
          <AsignarTareaForm lotes={lotesParaAsignar} personas={personasParaAsignar} />
        </div>
      )}

      <div className="mt-12">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Lote</th>
              <th className="py-2 pr-4">Tipo</th>
              {puedeAsignar && <th className="py-2 pr-4">Asignado a</th>}
              <th className="py-2 pr-4">Asignado por</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(tareas ?? []).map((tarea) => (
              <tr key={tarea.id} className="border-b border-tinta/5">
                <td className="py-2 pr-4">{nombreDeLote(tarea.lote_id)}</td>
                <td className="py-2 pr-4">{TIPO_LABELS[tarea.tipo] ?? tarea.tipo}</td>
                {puedeAsignar && <td className="py-2 pr-4">{nombreDe(tarea.asignado_a)}</td>}
                <td className="py-2 pr-4">{nombreDe(tarea.asignado_por)}</td>
                <td className="py-2 pr-4 uppercase text-musgo-oscuro">
                  {ESTADO_LABELS[tarea.estado] ?? tarea.estado}
                </td>
                <td className="py-2">{new Date(tarea.created_at).toLocaleString("es")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Agregar el link "Tareas" al nav**

En `src/app/admin/layout.tsx`, ubicar el bloque (dentro de `<nav>`, después del link "Lotes"):
```tsx
            <Link href="/admin/lotes" className="text-tinta/70 hover:text-tinta">
              Lotes
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```
Reemplazar por (agrega el link "Tareas" entre "Lotes" y "Mi perfil", visible a cualquier rol aprobado igual que "Lotes" — no va dentro del bloque condicional `profile.role === "admin"`):
```tsx
            <Link href="/admin/lotes" className="text-tinta/70 hover:text-tinta">
              Lotes
            </Link>
            <Link href="/admin/tareas" className="text-tinta/70 hover:text-tinta">
              Tareas
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```

- [ ] **Step 3: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual con el servidor de desarrollo**

Run: `npm run dev`, y en el navegador:
1. Crear (vía SQL local, como en la Tarea 3) un lote y un usuario `profesor` de prueba, o usar `/e2e-login` con un usuario creado por el fixture de pruebas.
2. Entrar a `/admin/tareas` como `profesor`: debe verse la sección "Asignar tarea" con los tres selects.
3. Entrar a `/admin/tareas` como `estudiante`: no debe verse la sección "Asignar tarea", solo la tabla (vacía si no se le asignó nada).

Expected: ambos casos se comportan como se describe. Este chequeo se automatiza por completo en la Tarea 6; aquí es solo para atrapar errores obvios de render antes de escribir el E2E.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tareas/page.tsx src/app/admin/layout.tsx
git commit -m "cultivo: agrega la página /admin/tareas con listado por rol y el link de nav"
```

---

### Task 6: Cobertura E2E (CA1-CA7)

**Files:**
- Create: `e2e/admin-tareas.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `./fixtures/test-users` (ya existe); ruta `/e2e-login`; toda la UI y RLS de las Tareas 1-5.

- [ ] **Step 1: Escribir el spec E2E completo**

`e2e/admin-tareas.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function crearLoteDePrueba(nombre: string): Promise<string> {
  const operador = await createTestUser("operador");
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4) returning id",
      [nombre, "Orellana", "2026-08-08", operador.id]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

async function asignarTareaDirecto(
  loteId: string,
  tipo: string,
  asignadoA: string,
  asignadoPor: string
) {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      "insert into public.tareas_asignadas (lote_id, tipo, asignado_a, asignado_por) values ($1, $2, $3, $4)",
      [loteId, tipo, asignadoA, asignadoPor]
    );
  } finally {
    await db.end();
  }
}

test("un profesor asigna una tarea y el estudiante la ve pendiente en /admin/tareas", async ({
  page,
}) => {
  await crearLoteDePrueba("Lote asignación básica");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/tareas`
  );
  await expect(page.getByRole("heading", { name: "Asignar tarea" })).toBeVisible();

  await page.getByLabel("Lote").selectOption({ label: "Lote asignación básica" });
  await page.getByLabel("Persona").selectOption({ label: estudiante.email });
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByRole("button", { name: "Asignar" }).click();

  const filaProfesor = page.locator("tbody tr", { hasText: "Riego" });
  await expect(filaProfesor).toContainText("Pendiente");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/tareas`
  );
  const filaEstudiante = page.locator("tbody tr", { hasText: "Riego" });
  await expect(filaEstudiante).toContainText("Pendiente");
});

test("un estudiante no ve el formulario de asignar tarea", async ({ page }) => {
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/tareas`
  );

  await expect(page.getByRole("heading", { name: "Asignar tarea" })).toHaveCount(0);
});

test("un estudiante no puede asignar tareas directamente, RLS lo rechaza", async () => {
  const loteId = await crearLoteDePrueba("Lote RLS asignar");
  const estudiante = await createTestUser("estudiante");
  const otro = await createTestUser("estudiante");

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
        "insert into public.tareas_asignadas (lote_id, tipo, asignado_a, asignado_por) values ($1, $2, $3, $4)",
        [loteId, "riego", otro.id, estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("registrar la tarea correcta la completa automáticamente", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote autocompletado");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudiante.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("200ml");

  await page.goto("/admin/tareas");
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("Completada");
});

test("registrar un tipo distinto no completa la tarea asignada", async ({ page }) => {
  const loteId = await crearLoteDePrueba("Lote sin autocompletar");
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudiante.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("observacion");
  await page.getByLabel("Valor").fill("todo normal");
  await page.getByRole("button", { name: "Registrar" }).click();

  await page.goto("/admin/tareas");
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("Pendiente");
});

test("un estudiante en /admin/tareas solo ve sus propias tareas, no las de otros", async ({
  page,
}) => {
  const loteId = await crearLoteDePrueba("Lote visibilidad cruzada");
  const profesor = await createTestUser("profesor");
  const estudianteA = await createTestUser("estudiante");
  const estudianteB = await createTestUser("estudiante");
  await asignarTareaDirecto(loteId, "riego", estudianteA.id, profesor.id);
  await asignarTareaDirecto(loteId, "humedad", estudianteB.id, profesor.id);

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudianteA.email)}&password=${encodeURIComponent(estudianteA.password)}&next=/admin/tareas`
  );

  await expect(page.locator("tbody tr", { hasText: "Riego" })).toBeVisible();
  await expect(page.locator("tbody tr", { hasText: "Humedad" })).toHaveCount(0);
});
```

- [ ] **Step 2: Correr el archivo de E2E nuevo en aislamiento**

Run: `npx playwright test e2e/admin-tareas.spec.ts`
Expected: los 6 tests pasan. Si `npx supabase start` no está corriendo, arrancarlo primero (`npx supabase start`) y exportar las variables tal como hace el workflow de CI (`.github/workflows/*.yml`, pasos "Start Supabase local stack" / "Export Supabase local env vars") o usar el `.env.local` que ya use el proyecto para desarrollo.

- [ ] **Step 3: Correr la suite completa (regresión)**

Run: `npm run lint && npm run typecheck && npm run build && npm run test && npm run test:e2e`
Expected: todo pasa en verde, incluyendo los specs preexistentes de `admin-lotes.spec.ts` y `admin-registros.spec.ts` (confirma que el trigger nuevo sobre `registros` no rompió el flujo de registro normal sin tarea asignada).

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-tareas.spec.ts
git commit -m "test: agrega E2E de asignación de tareas (asignar, RLS, auto-completado, visibilidad por rol)"
```

---

## Self-review del plan

- **Cobertura de la spec:** CA1 → Tarea 6 test 1 (vía UI, usa la policy de INSERT de la Tarea 1). CA2 → Tarea 6 test 3 (RLS directo). CA3 → Tarea 6 test 6. CA4 → Tarea 6 test 1 (la fila del profesor ya cubre que ve la tarea recién creada; la policy "profesor y admin ven todas" de la Tarea 1 es la pieza de autorización). CA5 → Tarea 6 test 4 (y verificación manual en la Tarea 3, Step 3). CA6 → Tarea 6 test 5. CA7 → Tarea 1 (ausencia deliberada de policies de UPDATE/DELETE; no hay ningún código en ninguna tarea que las agregue).
- **Placeholders:** ninguno — cada step tiene código completo o un comando y su salida esperada.
- **Consistencia de tipos:** `RegistroTipo` se importa igual (`"../lotes/registros-actions"`) en `actions.ts` y `asignar-tarea-form.tsx` (Tarea 4); `AsignarTareaForm` recibe exactamente `{ lotes, personas }` con los mismos shapes que produce `page.tsx` en la Tarea 5; las columnas seleccionadas de `tareas_asignadas` en la Tarea 5 (`lote_id, tipo, asignado_a, asignado_por, estado, created_at`) existen todas en la tabla de la Tarea 1.
