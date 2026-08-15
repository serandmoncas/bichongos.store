# Checklist de competencias (Épica 6, historia 27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profesor/admin definen un catálogo de competencias y las validan por persona; un `estudiante` sin ninguna competencia habilitante validada no puede crear registros en la bitácora de un lote, mientras operador/profesor/admin siguen sin restricción.

**Architecture:** Dos tablas nuevas — `competencias` (catálogo, RLS igual a `contenidos`) y `competencias_validadas` (presencia-como-estado, pero escrita por profesor/admin y solo leída por el dueño, al revés que `lecturas`). El gate se aplica reemplazando la policy de INSERT de `registros` por una que llama a una función `SECURITY DEFINER` `puede_registrar()`, siguiendo el precedente de `is_admin()`/`es_perfil_aprobado()` — evaluar el `exists()` inline dentro del `with check` ya rompió este proyecto dos veces.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres, RLS, `SECURITY DEFINER`), Playwright para E2E, TypeScript.

## Global Constraints

- RLS en todas las tablas — ninguna tabla nueva sin políticas (CLAUDE.md).
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend (CLAUDE.md).
- Server Actions nunca reciben la identidad como parámetro del cliente — `created_by`/`updated_by`/`validado_por` siempre salen de `supabase.auth.getClaims().data.claims.sub` (spec, sección 3).
- Commits en español, imperativo, prefijo por épica: `capacitacion: ...` para código de producto, `test: ...` para specs de E2E (CLAUDE.md).
- Idioma de la UI: español (CLAUDE.md).
- Un INSERT/DELETE denegado por RLS **no lanza excepción** — devuelve cero filas. Toda Server Action de escritura verifica que afectó filas y lanza error explícito si no (precedente endurecido en las historias 25 y 26).
- **El gate aplica SOLO a `estudiante`.** Operador, profesor y admin registran sin competencias (spec, CA6). Es fácil escribir un gate que bloquee de más, y ese fallo sería invisible salvo que se lo pruebe explícitamente.
- `competencias_validadas` la escriben profesor/admin, NO el dueño de la fila — al revés que `lecturas` (historia 26). Es el expediente del estudiante, no su cuaderno personal.

---

## Contexto de archivos (dónde va cada cosa)

- `supabase/migrations/00000000000018_competencias.sql` — dos tablas + RLS (Tarea 1)
- `supabase/migrations/00000000000019_registros_exige_competencia.sql` — función `puede_registrar()` + reemplazo de la policy de INSERT de `registros` (Tarea 2)
- `src/app/admin/competencias/actions.ts` — Server Actions del catálogo y de validar/revocar (Tarea 3)
- `src/app/admin/competencias/competencia-form.tsx` — client component del formulario de catálogo (Tarea 3)
- `src/app/admin/competencias/validar-competencia-form.tsx` — client component de validar/revocar por persona (Tarea 3)
- `src/app/admin/competencias/page.tsx` — página con las dos caras según rol (Tarea 4)
- `src/app/admin/layout.tsx` — link "Competencias" al nav (Tarea 4, modifica archivo existente)
- `src/app/admin/lotes/[id]/page.tsx` — oculta el formulario de registrar si no puede registrar (Tarea 5, modifica archivo existente)
- `e2e/admin-competencias.spec.ts` — cobertura E2E de CA1-CA7 (Tarea 6)

---

### Task 1: Migración — tablas `competencias` y `competencias_validadas`

**Files:**
- Create: `supabase/migrations/00000000000018_competencias.sql`

**Interfaces:**
- Consumes: `public.profiles(id, role)` (ya existe).
- Produces: tabla `public.competencias` con columnas `id uuid`, `nombre text`, `descripcion text` (nullable), `habilita_operar boolean`, `created_by uuid`, `created_at timestamptz`, `updated_by uuid` (nullable), `updated_at timestamptz`. Tabla `public.competencias_validadas` con `id uuid`, `competencia_id uuid`, `user_id uuid`, `validado_por uuid`, `created_at timestamptz`, y `unique (competencia_id, user_id)`. Las tareas 2-6 dependen de estos nombres exactos.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.competencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  habilita_operar boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.competencias_validadas (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  validado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (competencia_id, user_id)
);

alter table public.competencias enable row level security;
alter table public.competencias_validadas enable row level security;

grant select on public.competencias to authenticated;
grant insert, update, delete on public.competencias to authenticated;

grant select on public.competencias_validadas to authenticated;
grant insert, delete on public.competencias_validadas to authenticated;

-- Catálogo: cualquier rol aprobado lo lee; solo profesor/admin lo administran.
-- Mismo modelo que contenidos (migración 15).

create policy "cualquier rol aprobado lee competencias"
  on public.competencias for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "profesor y admin crean competencias"
  on public.competencias for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin editan competencias"
  on public.competencias for update
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

create policy "profesor y admin eliminan competencias"
  on public.competencias for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

-- Validaciones: cada quien ve las suyas, profesor/admin ven todas y son
-- los únicos que validan y revocan.
--
-- Ojo con la asimetría respecto de lecturas (migración 17): allá el dueño
-- de la fila la crea y la borra, y un profesor NO puede tocarla, porque es
-- el registro personal del estudiante. Acá es al revés — el estudiante
-- solo lee. Es su expediente, no su cuaderno. No "armonizar" las dos.

create policy "cada quien ve sus propias competencias validadas"
  on public.competencias_validadas for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profesor y admin ven todas las competencias validadas"
  on public.competencias_validadas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin validan competencias"
  on public.competencias_validadas for insert
  to authenticated
  with check (
    validado_por = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin revocan competencias"
  on public.competencias_validadas for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

-- Sin policy de UPDATE en competencias_validadas: una validación existe o
-- no existe. Validar es un INSERT, revocar un DELETE — mismo principio de
-- presencia-como-estado que lecturas, y el unique(competencia_id, user_id)
-- impide validar dos veces lo mismo.
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase start` (si el stack local no está corriendo) seguido de `npx supabase db reset`
Expected: sin errores, `00000000000018_competencias.sql` aparece aplicada.

- [ ] **Step 3: Verificar la estructura con psql**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.competencias"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.competencias_validadas"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select tablename, policyname, cmd from pg_policies where tablename in ('competencias','competencias_validadas') order by tablename, cmd, policyname"
```
Expected: `competencias` con 8 columnas y `competencias_validadas` con 5 más un índice único sobre `(competencia_id, user_id)`. La tercera query lista 8 filas — 4 para `competencias` (SELECT, INSERT, UPDATE, DELETE) y 4 para `competencias_validadas` (DELETE, INSERT, y 2 de SELECT), sin ninguna de UPDATE sobre `competencias_validadas`.

- [ ] **Step 4: Verificar el comportamiento de RLS con psql**

Las policies se prueban ejecutándolas como usuarios simulados, no leyendo su texto. Recordá al interpretar la salida: un INSERT denegado lanza `ERROR`, pero un DELETE denegado devuelve `DELETE 0` sin lanzar nada.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
\set ON_ERROR_STOP off
\echo '-- Setup: un profesor y un estudiante'
insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'prof-comp@bichongos.test'),
  ('22222222-0000-0000-0000-000000000002', 'est-comp@bichongos.test');
set session_replication_role = replica;
update public.profiles set role = 'profesor' where id = '11111111-0000-0000-0000-000000000001';
update public.profiles set role = 'estudiante' where id = '22222222-0000-0000-0000-000000000002';
set session_replication_role = default;

\echo '-- El profesor crea una competencia habilitante: debe INSERTAR 1'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.competencias (id, nombre, habilita_operar, created_by)
  values ('33333333-0000-0000-0000-000000000003', 'Esteriliza sustrato', true, '11111111-0000-0000-0000-000000000001');
commit;

\echo '-- El estudiante intenta crear una competencia: RLS lo RECHAZA'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.competencias (nombre, habilita_operar, created_by)
  values ('Inventada por el estudiante', true, '22222222-0000-0000-0000-000000000002');
rollback;

\echo '-- El estudiante intenta validarse a si mismo: RLS lo RECHAZA'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.competencias_validadas (competencia_id, user_id, validado_por)
  values ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002');
rollback;

\echo '-- El profesor se la valida al estudiante: debe INSERTAR 1'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.competencias_validadas (competencia_id, user_id, validado_por)
  values ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001');
commit;

\echo '-- El estudiante VE la suya: debe devolver 1'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-0000-0000-0000-000000000002","role":"authenticated"}';
select count(*) as validadas_visibles_para_el_estudiante from public.competencias_validadas;
rollback;

\echo '-- El estudiante intenta revocarsela: afecta 0 filas (no lanza error)'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-0000-0000-0000-000000000002","role":"authenticated"}';
delete from public.competencias_validadas where user_id = '22222222-0000-0000-0000-000000000002';
rollback;

\echo '-- El profesor SI la revoca: debe afectar 1 fila'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.competencias_validadas where user_id = '22222222-0000-0000-0000-000000000002';
rollback;

\echo '-- Cleanup'
delete from public.competencias where id = '33333333-0000-0000-0000-000000000003';
delete from auth.users where id in ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');
SQL
```
Expected, en orden: `INSERT 0 1` · `ERROR ... row-level security` · `ERROR ... row-level security` · `INSERT 0 1` · `validadas_visibles_para_el_estudiante = 1` · `DELETE 0` (el estudiante no revoca) · `DELETE 1` (el profesor sí). Pegar la salida cruda completa en el reporte, sin editar ni anotar.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000018_competencias.sql
git commit -m "capacitacion: agrega las tablas competencias y competencias_validadas con RLS"
```

---

### Task 2: Migración — `puede_registrar()` y el endurecimiento de `registros`

**Files:**
- Create: `supabase/migrations/00000000000019_registros_exige_competencia.sql`

**Interfaces:**
- Consumes: `public.competencias` y `public.competencias_validadas` (Tarea 1); `public.profiles(id, role)`; la policy `"cualquier rol aprobado crea sus propios registros"` de la migración 8, que esta tarea reemplaza.
- Produces: función `public.puede_registrar()` que retorna `boolean`, invocable por `authenticated` vía RPC. Las tareas 4-6 la consultan desde la app.

- [ ] **Step 1: Escribir la migración**

```sql
-- Hasta acá, cualquier rol aprobado podía escribir la bitácora de un lote
-- (migración 8). Es decir: un estudiante recién aprobado, sin formación,
-- podía registrar una lectura falsa sobre un lote de producción real.
-- Esta migración exige que un estudiante tenga al menos una competencia
-- habilitante validada por un profesor. Operador, profesor y admin siguen
-- sin restricción: son roles que un admin otorgó deliberadamente.
--
-- SECURITY DEFINER y no un exists() inline en el with check: un exists()
-- dentro de una policy se evalúa bajo la RLS del propio caller, y eso ya
-- rompió este proyecto dos veces (migración 13 corrigió el caso de
-- tareas_asignadas, donde ningún profesor podía asignar). Mismo patrón que
-- is_admin() (migración 3) y es_perfil_aprobado() (migraciones 13-14).
create function public.puede_registrar()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  rol public.user_role;
begin
  select role into rol from public.profiles where id = auth.uid();

  if rol is null or rol = 'pendiente' then
    return false;
  end if;

  if rol in ('operador', 'profesor', 'admin') then
    return true;
  end if;

  return exists (
    select 1
    from public.competencias_validadas cv
    join public.competencias c on c.id = cv.competencia_id
    where cv.user_id = auth.uid() and c.habilita_operar
  );
end;
$$;

revoke execute on function public.puede_registrar() from public, anon;
grant execute on function public.puede_registrar() to authenticated;

drop policy "cualquier rol aprobado crea sus propios registros" on public.registros;

create policy "quien puede operar crea sus propios registros"
  on public.registros for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.puede_registrar()
  );

-- No cambia nada más de registros: la policy de SELECT sigue dejando que
-- cualquier rol aprobado lea la bitácora completa, siguen sin existir
-- policies de UPDATE ni DELETE (los registros son inmutables), y los
-- registros ya creados no se tocan.
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `npx supabase db reset`
Expected: sin errores, `00000000000019_registros_exige_competencia.sql` aplicada.

- [ ] **Step 3: Verificar que la policy vieja ya no existe y la nueva sí**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select policyname, cmd from pg_policies where tablename = 'registros' order by cmd, policyname"
```
Expected: exactamente 2 filas — `quien puede operar crea sus propios registros` (INSERT) y `cualquier rol aprobado lee registros` (SELECT). La policy vieja `cualquier rol aprobado crea sus propios registros` NO debe aparecer.

- [ ] **Step 4: Verificar el gate con psql — los cuatro casos que importan**

Este es el chequeo central de toda la historia. El caso del operador es el más importante: es fácil escribir un gate que bloquee de más, y ese fallo no aparecería en ningún otro test.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
\set ON_ERROR_STOP off
\echo '-- Setup: profesor, estudiante, operador, un lote y una competencia habilitante'
insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'prof-gate@bichongos.test'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'est-gate@bichongos.test'),
  ('cccc0000-0000-0000-0000-00000000000c', 'oper-gate@bichongos.test');
set session_replication_role = replica;
update public.profiles set role = 'profesor'   where id = 'aaaa0000-0000-0000-0000-00000000000a';
update public.profiles set role = 'estudiante' where id = 'bbbb0000-0000-0000-0000-00000000000b';
update public.profiles set role = 'operador'   where id = 'cccc0000-0000-0000-0000-00000000000c';
set session_replication_role = default;
insert into public.lotes (id, nombre, especie, created_by)
  values ('dddd0000-0000-0000-0000-00000000000d', 'Lote gate', 'Orellana', 'aaaa0000-0000-0000-0000-00000000000a');
insert into public.competencias (id, nombre, habilita_operar, created_by)
  values ('eeee0000-0000-0000-0000-00000000000e', 'Opera cultivo', true, 'aaaa0000-0000-0000-0000-00000000000a');

\echo '-- CASO 1: estudiante SIN competencia intenta registrar -> RLS lo RECHAZA'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbb0000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into public.registros (lote_id, user_id, tipo, valor)
  values ('dddd0000-0000-0000-0000-00000000000d', 'bbbb0000-0000-0000-0000-00000000000b', 'riego', 'sin competencia');
rollback;

\echo '-- CASO 2: operador SIN ninguna competencia registra -> DEBE FUNCIONAR'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccc0000-0000-0000-0000-00000000000c","role":"authenticated"}';
insert into public.registros (lote_id, user_id, tipo, valor)
  values ('dddd0000-0000-0000-0000-00000000000d', 'cccc0000-0000-0000-0000-00000000000c', 'riego', 'operador sin competencia');
rollback;

\echo '-- El profesor le valida la competencia habilitante al estudiante'
insert into public.competencias_validadas (competencia_id, user_id, validado_por)
  values ('eeee0000-0000-0000-0000-00000000000e', 'bbbb0000-0000-0000-0000-00000000000b', 'aaaa0000-0000-0000-0000-00000000000a');

\echo '-- CASO 3: el mismo estudiante, ahora CON competencia -> DEBE FUNCIONAR'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbb0000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into public.registros (lote_id, user_id, tipo, valor)
  values ('dddd0000-0000-0000-0000-00000000000d', 'bbbb0000-0000-0000-0000-00000000000b', 'riego', 'con competencia');
rollback;

\echo '-- CASO 4: se le revoca y vuelve a quedar bloqueado -> RLS lo RECHAZA'
delete from public.competencias_validadas where user_id = 'bbbb0000-0000-0000-0000-00000000000b';
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbb0000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into public.registros (lote_id, user_id, tipo, valor)
  values ('dddd0000-0000-0000-0000-00000000000d', 'bbbb0000-0000-0000-0000-00000000000b', 'riego', 'tras revocar');
rollback;

\echo '-- Cleanup'
delete from public.lotes where id = 'dddd0000-0000-0000-0000-00000000000d';
delete from public.competencias where id = 'eeee0000-0000-0000-0000-00000000000e';
delete from auth.users where id in ('aaaa0000-0000-0000-0000-00000000000a','bbbb0000-0000-0000-0000-00000000000b','cccc0000-0000-0000-0000-00000000000c');
SQL
```
Expected, en orden: CASO 1 → `ERROR: new row violates row-level security policy for table "registros"` · CASO 2 → `INSERT 0 1` · CASO 3 → `INSERT 0 1` · CASO 4 → `ERROR ... row-level security`. Pegar la salida cruda completa en el reporte, sin editar.

Si el CASO 2 falla, el gate está bloqueando a operador y la función está mal — es el fallo más importante de detectar acá.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000019_registros_exige_competencia.sql
git commit -m "capacitacion: exige competencia habilitante al estudiante para registrar en bitácora"
```

---

### Task 3: Server Actions + formularios de competencias

**Files:**
- Create: `src/app/admin/competencias/actions.ts`
- Create: `src/app/admin/competencias/competencia-form.tsx`
- Create: `src/app/admin/competencias/validar-competencia-form.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tablas de la Tarea 1.
- Produces: interfaz `CompetenciaFormValues { nombre: string; descripcion: string; habilita_operar: boolean }`; funciones `createCompetencia(values)`, `updateCompetencia(id, values)`, `deleteCompetencia(id)`, `validarCompetencia(competenciaId, userId)`, `revocarCompetencia(competenciaId, userId)`. Componentes `CompetenciaForm({ initialValues, onSubmit })` y `ValidarCompetenciaForm({ competenciaId, personas, validadas })`. La Tarea 4 los consume con estos nombres exactos.

- [ ] **Step 1: Escribir las Server Actions**

`src/app/admin/competencias/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompetenciaFormValues {
  nombre: string;
  descripcion: string;
  habilita_operar: boolean;
}

export async function createCompetencia(values: CompetenciaFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias")
    .insert({
      nombre: values.nombre,
      descripcion: values.descripcion || null,
      habilita_operar: values.habilita_operar,
      created_by: userId,
    })
    .select("id");
  if (error) {
    throw new Error(`No se pudo crear la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo crear la competencia: sin permisos.");
  }

  revalidatePath("/admin/competencias");
}

export async function updateCompetencia(id: string, values: CompetenciaFormValues) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias")
    .update({
      nombre: values.nombre,
      descripcion: values.descripcion || null,
      habilita_operar: values.habilita_operar,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(`No se pudo actualizar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo actualizar la competencia: sin permisos o ya no existe.");
  }

  revalidatePath("/admin/competencias");
}

export async function deleteCompetencia(id: string) {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("competencias")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(`No se pudo eliminar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo eliminar la competencia: sin permisos o ya no existe.");
  }

  revalidatePath("/admin/competencias");
}

export async function validarCompetencia(competenciaId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const validadorId = data?.claims?.sub;
  if (!validadorId) {
    throw new Error("No autenticado");
  }

  const { data: rows, error } = await supabase
    .from("competencias_validadas")
    .insert({
      competencia_id: competenciaId,
      user_id: userId,
      validado_por: validadorId,
    })
    .select("id");
  if (error) {
    // 23505 = ya estaba validada. Validar es idempotente: el estado
    // deseado ya es cierto, así que no es un error del usuario.
    if (error.code === "23505") {
      revalidatePath("/admin/competencias");
      return;
    }
    throw new Error(`No se pudo validar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo validar la competencia: sin permisos.");
  }

  revalidatePath("/admin/competencias");
}

export async function revocarCompetencia(competenciaId: string, userId: string) {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("competencias_validadas")
    .delete()
    .eq("competencia_id", competenciaId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw new Error(`No se pudo revocar la competencia: ${error.message}`);
  }
  if (!rows?.length) {
    throw new Error("No se pudo revocar la competencia: sin permisos o no estaba validada.");
  }

  revalidatePath("/admin/competencias");
}
```

- [ ] **Step 2: Escribir el formulario del catálogo**

`src/app/admin/competencias/competencia-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompetenciaFormValues } from "./actions";

export function CompetenciaForm({
  initialValues,
  onSubmit,
}: {
  initialValues: CompetenciaFormValues;
  onSubmit: (values: CompetenciaFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await onSubmit(values);
            setValues(initialValues);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Nombre
        <input
          required
          value={values.nombre}
          onChange={(e) => setValues({ ...values, nombre: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        Descripción
        <textarea
          value={values.descripcion}
          onChange={(e) => setValues({ ...values, descripcion: e.target.value })}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2 font-mono text-sm text-tinta/70">
        <input
          type="checkbox"
          checked={values.habilita_operar}
          onChange={(e) => setValues({ ...values, habilita_operar: e.target.checked })}
        />
        Habilita operar
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

- [ ] **Step 3: Escribir el formulario de validar/revocar**

`src/app/admin/competencias/validar-competencia-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validarCompetencia, revocarCompetencia } from "./actions";

export function ValidarCompetenciaForm({
  competenciaId,
  personas,
  validadas,
}: {
  competenciaId: string;
  personas: { id: string; nombre: string | null; email: string }[];
  validadas: string[];
}) {
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (personas.length === 0) {
    return null;
  }

  const yaValidada = validadas.includes(personaId);

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          aria-label="Persona"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1 font-mono text-sm"
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre ?? persona.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                if (yaValidada) {
                  await revocarCompetencia(competenciaId, personaId);
                } else {
                  await validarCompetencia(competenciaId, personaId);
                }
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo guardar.");
              }
            });
          }}
          className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
        >
          {yaValidada ? "Revocar" : "Validar"}
        </button>
      </div>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/competencias/actions.ts src/app/admin/competencias/competencia-form.tsx src/app/admin/competencias/validar-competencia-form.tsx
git commit -m "capacitacion: agrega Server Actions y formularios de competencias"
```

---

### Task 4: Página `/admin/competencias` + link de nav

**Files:**
- Create: `src/app/admin/competencias/page.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `CompetenciaForm`, `ValidarCompetenciaForm`, `createCompetencia`, `deleteCompetencia` (Tarea 3); función RPC `listar_usuarios_aprobados()` (migración 11 — retorna filas `{ id: string; nombre: string | null; email: string; role: string }`); función RPC `nombres_de_usuarios(ids uuid[])` (migración 9 — retorna `{ id, nombre, email }`); tablas de la Tarea 1.
- Produces: ruta `/admin/competencias`.

- [ ] **Step 1: Escribir la página**

`src/app/admin/competencias/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetenciaForm } from "./competencia-form";
import { ValidarCompetenciaForm } from "./validar-competencia-form";
import { createCompetencia } from "./actions";

const ROLES_QUE_GESTIONAN_COMPETENCIAS = ["profesor", "admin"];

export default async function CompetenciasPage() {
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

  const canEdit = ROLES_QUE_GESTIONAN_COMPETENCIAS.includes(profile?.role ?? "");

  type Competencia = {
    id: string;
    nombre: string;
    descripcion: string | null;
    habilita_operar: boolean;
  };
  type Validada = {
    competencia_id: string;
    user_id: string;
    validado_por: string;
    created_at: string;
  };
  type Persona = { id: string; nombre: string | null; email: string };

  const { data: competencias }: { data: Competencia[] | null } = await supabase
    .from("competencias")
    .select("id, nombre, descripcion, habilita_operar")
    .order("nombre");

  const { data: validadas }: { data: Validada[] | null } = await supabase
    .from("competencias_validadas")
    .select("competencia_id, user_id, validado_por, created_at");

  const mias = (validadas ?? []).filter((v) => v.user_id === user.sub);
  const validadorIds = Array.from(new Set(mias.map((v) => v.validado_por)));
  const { data: validadores }: { data: Persona[] | null } = validadorIds.length
    ? await supabase.rpc("nombres_de_usuarios", { ids: validadorIds })
    : { data: [] };

  const nombreDe = (id: string) => {
    const p = validadores?.find((v) => v.id === id);
    return p?.nombre ?? p?.email ?? id;
  };

  const miaPorCompetencia = new Map(mias.map((v) => [v.competencia_id, v]));
  const tengoHabilitante = (competencias ?? []).some(
    (c) => c.habilita_operar && miaPorCompetencia.has(c.id)
  );

  let personas: Persona[] = [];
  if (canEdit) {
    const { data: aprobados }: { data: Persona[] | null } = await supabase.rpc(
      "listar_usuarios_aprobados"
    );
    personas = aprobados ?? [];
  }

  const validadasDe = (competenciaId: string) =>
    (validadas ?? []).filter((v) => v.competencia_id === competenciaId).map((v) => v.user_id);

  return (
    <main className="px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold">Competencias</h1>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">Mis competencias</h2>
        {!tengoHabilitante && (
          <p className="mt-2 max-w-xl font-mono text-sm text-terracota">
            Todavía no tenés ninguna competencia que habilite operar, así que no podés
            registrar tareas en la bitácora de un lote. Un profesor tiene que validártela.
          </p>
        )}
        <table className="mt-4 w-full max-w-3xl font-mono text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-tinta/60">
              <th className="py-2 pr-4">Competencia</th>
              <th className="py-2 pr-4">Habilita operar</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2">Validada por</th>
            </tr>
          </thead>
          <tbody>
            {(competencias ?? []).map((competencia) => {
              const mia = miaPorCompetencia.get(competencia.id);
              return (
                <tr key={competencia.id} className="border-b border-tinta/5">
                  <td className="py-2 pr-4">{competencia.nombre}</td>
                  <td className="py-2 pr-4">{competencia.habilita_operar ? "Sí" : "No"}</td>
                  <td className="py-2 pr-4 text-musgo-oscuro">
                    {mia ? "Lograda" : "Pendiente"}
                  </td>
                  <td className="py-2">
                    {mia
                      ? `${nombreDe(mia.validado_por)} · ${new Date(
                          mia.created_at
                        ).toLocaleDateString("es")}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canEdit && (
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold">Catálogo</h2>
          <CompetenciaForm
            initialValues={{ nombre: "", descripcion: "", habilita_operar: false }}
            onSubmit={createCompetencia}
          />
          <ul className="mt-8 flex max-w-3xl flex-col gap-6">
            {(competencias ?? []).map((competencia) => (
              <li key={competencia.id} className="border-b border-tinta/5 pb-4">
                <p className="font-mono text-sm">
                  {competencia.nombre}
                  {competencia.habilita_operar && (
                    <span className="ml-2 uppercase text-musgo-oscuro">habilita operar</span>
                  )}
                </p>
                {competencia.descripcion && (
                  <p className="mt-1 font-mono text-sm text-tinta/60">
                    {competencia.descripcion}
                  </p>
                )}
                <ValidarCompetenciaForm
                  competenciaId={competencia.id}
                  personas={personas}
                  validadas={validadasDe(competencia.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Agregar el link "Competencias" al nav**

En `src/app/admin/layout.tsx`, ubicar el bloque (dentro de `<nav>`):
```tsx
            <Link href="/admin/contenidos" className="text-tinta/70 hover:text-tinta">
              Contenidos
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```
Reemplazar por (agrega "Competencias" entre "Contenidos" y "Mi perfil", visible a cualquier rol aprobado — como "Contenidos", no como "Progreso"):
```tsx
            <Link href="/admin/contenidos" className="text-tinta/70 hover:text-tinta">
              Contenidos
            </Link>
            <Link href="/admin/competencias" className="text-tinta/70 hover:text-tinta">
              Competencias
            </Link>
            <Link href="/admin/perfil" className="text-tinta/70 hover:text-tinta">
              Mi perfil
            </Link>
```

- [ ] **Step 3: Typecheck, lint y build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: los tres sin errores, y la tabla de rutas del build incluye `/admin/competencias`.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/competencias/page.tsx src/app/admin/layout.tsx
git commit -m "capacitacion: agrega la página de competencias con checklist propio y catálogo"
```

---

### Task 5: Ocultar el formulario de registrar a quien no puede operar

**Files:**
- Modify: `src/app/admin/lotes/[id]/page.tsx`

**Interfaces:**
- Consumes: función RPC `puede_registrar()` (Tarea 2 — retorna `boolean`, sin parámetros); `RegistroForm` (ya existe).
- Produces: nada que otras tareas consuman. La Tarea 6 verifica el comportamiento.

- [ ] **Step 1: Consultar `puede_registrar()` y condicionar el formulario**

En `src/app/admin/lotes/[id]/page.tsx`, agregar el import de `Link` junto a los existentes si no está ya presente:
```tsx
import Link from "next/link";
```

Después del bloque que obtiene `perfiles` (la llamada a `nombres_de_usuarios`) y antes del `const updateLoteBound = ...`, agregar:
```tsx
  const { data: puedeRegistrar } = await supabase.rpc("puede_registrar");
```

Luego reemplazar la línea que renderiza el formulario:
```tsx
        <RegistroForm loteId={lote.id} />
```
por:
```tsx
        {puedeRegistrar ? (
          <RegistroForm loteId={lote.id} />
        ) : (
          <p className="mt-4 max-w-xl font-mono text-sm text-terracota">
            No podés registrar tareas todavía: necesitás que un profesor te valide una
            competencia que habilite operar.{" "}
            <Link href="/admin/competencias" className="underline">
              Ver mis competencias
            </Link>
          </p>
        )}
```

Nota: sin este cambio un estudiante sin competencia vería el formulario y cada intento fallaría contra RLS. Técnicamente seguro, pero es una mala experiencia y un reporte de bug garantizado.

- [ ] **Step 2: Typecheck, lint y build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: los tres sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/lotes/[id]/page.tsx"
git commit -m "capacitacion: oculta el formulario de registrar a quien no tiene competencia habilitante"
```

---

### Task 6: Cobertura E2E (CA1-CA7)

**Files:**
- Create: `e2e/admin-competencias.spec.ts`

**Interfaces:**
- Consumes: `createTestUser` de `./fixtures/test-users` (ya existe); ruta `/e2e-login`; toda la UI y RLS de las Tareas 1-5.

- [ ] **Step 1: Escribir el spec E2E completo**

`e2e/admin-competencias.spec.ts`:
```ts
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestUser } from "./fixtures/test-users";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function nombreUnico(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}

async function crearLoteDePrueba(nombre: string, creadoPorId: string): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.lotes (nombre, especie, fecha_inicio, created_by) values ($1, $2, $3, $4) returning id",
      [nombre, "Orellana", "2026-08-14", creadoPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

async function crearCompetenciaDePrueba(
  nombre: string,
  habilitaOperar: boolean,
  creadaPorId: string
): Promise<string> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const result = await db.query(
      "insert into public.competencias (nombre, habilita_operar, created_by) values ($1, $2, $3) returning id",
      [nombre, habilitaOperar, creadaPorId]
    );
    return result.rows[0].id as string;
  } finally {
    await db.end();
  }
}

test("un profesor crea una competencia y se la valida a un estudiante", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const estudiante = await createTestUser("estudiante");
  const nombre = nombreUnico("Esteriliza sustrato");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(profesor.email)}&password=${encodeURIComponent(profesor.password)}&next=/admin/competencias`
  );
  await expect(page.getByRole("heading", { name: "Competencias" })).toBeVisible();

  await page.getByLabel("Nombre").fill(nombre);
  await page.getByLabel("Habilita operar").check();
  await page.getByRole("button", { name: "Guardar" }).click();

  const item = page.locator("li", { hasText: nombre });
  await expect(item).toBeVisible();

  await item.getByLabel("Persona").selectOption({ label: estudiante.email });
  await item.getByRole("button", { name: "Validar" }).click();
  await expect(item.getByRole("button", { name: "Revocar" })).toBeVisible();
});

test("un estudiante sin competencia habilitante no ve el formulario de registrar", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote sin competencia"), profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await expect(page.getByRole("heading", { name: "Bitácora", exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver mis competencias" })).toBeVisible();
});

test("validar una competencia habilitante desbloquea el registro, y revocarla lo vuelve a bloquear", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote gate"), profesor.id);
  const competenciaId = await crearCompetenciaDePrueba(
    nombreUnico("Opera cultivo"),
    true,
    profesor.id
  );
  const estudiante = await createTestUser("estudiante");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      "insert into public.competencias_validadas (competencia_id, user_id, validado_por) values ($1, $2, $3)",
      [competenciaId, estudiante.id, profesor.id]
    );
  } finally {
    await db.end();
  }

  // Con la competencia validada, el estudiante registra normalmente.
  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("riego");
  await page.getByLabel("Valor").fill("200ml");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Riego" })).toContainText("200ml");

  // Se le revoca y el formulario desaparece.
  const db2 = new Client({ connectionString: DB_URL });
  await db2.connect();
  try {
    await db2.query("delete from public.competencias_validadas where user_id = $1", [
      estudiante.id,
    ]);
  } finally {
    await db2.end();
  }

  await page.goto(`/admin/lotes/${loteId}`);
  await expect(page.getByRole("button", { name: "Registrar" })).toHaveCount(0);
});

test("un operador sin ninguna competencia validada registra normalmente", async ({ page }) => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote operador"), profesor.id);
  const operador = await createTestUser("operador");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(operador.email)}&password=${encodeURIComponent(operador.password)}&next=/admin/lotes/${loteId}`
  );
  await page.getByLabel("Tipo").selectOption("humedad");
  await page.getByLabel("Valor").fill("85%");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.locator("tbody tr", { hasText: "Humedad" })).toContainText("85%");
});

test("un estudiante sin competencia no puede insertar un registro directamente, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const loteId = await crearLoteDePrueba(nombreUnico("Lote RLS"), profesor.id);
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
        "insert into public.registros (lote_id, user_id, tipo, valor) values ($1, $2, $3, $4)",
        [loteId, estudiante.id, "riego", "sin competencia"]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un estudiante no puede validarse una competencia a sí mismo, RLS lo rechaza", async () => {
  const profesor = await createTestUser("profesor");
  const competenciaId = await crearCompetenciaDePrueba(
    nombreUnico("Autovalidada"),
    true,
    profesor.id
  );
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
        "insert into public.competencias_validadas (competencia_id, user_id, validado_por) values ($1, $2, $3)",
        [competenciaId, estudiante.id, estudiante.id]
      )
    ).rejects.toThrow();
    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("un estudiante ve el catálogo pero no el formulario de crear competencias", async ({
  page,
}) => {
  const profesor = await createTestUser("profesor");
  const nombre = nombreUnico("Visible para todos");
  await crearCompetenciaDePrueba(nombre, false, profesor.id);
  const estudiante = await createTestUser("estudiante");

  await page.goto(
    `/e2e-login?email=${encodeURIComponent(estudiante.email)}&password=${encodeURIComponent(estudiante.password)}&next=/admin/competencias`
  );
  await expect(page.getByRole("heading", { name: "Competencias" })).toBeVisible();

  // Ve la competencia en su checklist...
  await expect(page.locator("tbody tr", { hasText: nombre })).toBeVisible();
  // ...pero no la sección de catálogo ni su formulario.
  await expect(page.getByRole("heading", { name: "Catálogo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
});
```

- [ ] **Step 2: Correr el spec nuevo en aislamiento**

Run: `npx playwright test e2e/admin-competencias.spec.ts`
Expected: los 7 tests pasan. Antes, exportar las variables en la **misma** invocación de shell que el comando de playwright:
```bash
npx supabase status -o env > /tmp/supabase-status.env
export NEXT_PUBLIC_SUPABASE_URL=$(grep '^API_URL=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' /tmp/supabase-status.env | cut -d '=' -f2- | tr -d '"')
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
export NEXT_PUBLIC_E2E_TEST_MODE=true
```

Dos gotchas conocidos de esta máquina: si Playwright no puede levantar el servidor, revisar `lsof -nP -iTCP:3000 -sTCP:LISTEN` — un proceso de Obsidian suele tomar el puerto 3000, y está autorizado matarlo. Si después de un `db reset` la creación de usuarios de prueba empieza a fallar con 502 / `AuthRetryableFetchError`, correr `docker restart supabase_kong_bichongos`.

- [ ] **Step 3: Correr la suite completa (regresión)**

Run: `npm run lint && npm run typecheck && npm run build && npm run test && npm run test:e2e`
Expected: todo en verde.

**Atención especial a `admin-registros.spec.ts`**, que es preexistente y ejercita justamente la bitácora que esta historia endurece. **Dos de sus tests van a fallar legítimamente**, porque ambos hacen que un `estudiante` registre por la UI y con el gate nuevo ese estudiante ya no tiene permiso:

- `e2e/admin-registros.spec.ts:23` — "un estudiante registra una tarea y la ve en la bitácora sin recargar".
- `e2e/admin-registros.spec.ts:66` — "la bitácora muestra el nombre real de cada autor, no solo el del usuario que mira": crea un `estudianteA` que registra por la UI (línea ~95).

Eso NO es flakiness: es la consecuencia esperada del cambio de comportamiento, y es exactamente la señal de que el gate funciona. **Reportarlo y parar.** No los arregles por tu cuenta: decidir si esos tests deben cambiar de rol (usar `operador` en vez de `estudiante`), validarle una competencia en el setup, o cambiar de expectativa, es una decisión de producto que toma el humano.

Un tercer test, `e2e/admin-registros.spec.ts:113` ("un usuario no puede registrar una tarea a nombre de otro, RLS lo rechaza"), va a seguir pasando — pero ahora por dos razones en vez de una (el `user_id` ajeno *y* la falta de competencia), lo cual lo vuelve menos preciso como prueba de lo que dice probar. Mencionalo en el reporte; no lo toques.

Nota aparte sobre flakiness real: bajo ejecución paralela completa esta máquina produce timeouts intermitentes en tests de mutación de varios specs preexistentes (contención de CPU). Si aparece uno, reportar qué spec, qué test, en cuántas corridas de cuántas, y si se reproduce en aislamiento.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-competencias.spec.ts
git commit -m "test: agrega E2E del checklist de competencias y del gate de la bitácora"
```

---

## Self-review del plan

- **Cobertura de la spec:** CA1 → Tarea 6 test 1 (crear vía UI) + Tarea 1 (policies del catálogo). CA2 → Tarea 6 test 1 (validar) y test 3 (revocar). CA3 → Tarea 6 test 6 (RLS rechaza autovalidarse) + Tarea 4 (sección "Mis competencias"). CA4 → Tarea 6 tests 2 (UI sin formulario) y 5 (RLS directo) + Tarea 2 Step 4 CASO 1. CA5 → Tarea 6 test 3 (desbloquea y vuelve a bloquear) + Tarea 2 Step 4 CASOS 3 y 4. CA6 → Tarea 6 test 4 + Tarea 2 Step 4 CASO 2. CA7 → Tarea 6 test 7.
- **Placeholders:** ninguno — cada step tiene código completo o comando con salida esperada.
- **Consistencia de tipos:** `CompetenciaFormValues` se define en `actions.ts` (Tarea 3) y se importa con ese nombre en `competencia-form.tsx` (Tarea 3) y se construye en `page.tsx` (Tarea 4). `ValidarCompetenciaForm` recibe `{ competenciaId, personas, validadas }` en la Tarea 3 y así lo invoca la Tarea 4. `puede_registrar()` no lleva parámetros (Tarea 2) y así se llama en la Tarea 5. `listar_usuarios_aprobados()` devuelve `{ id, nombre, email, role }` y `nombres_de_usuarios(ids)` devuelve `{ id, nombre, email }` — la Tarea 4 usa cada uno con esa forma.
- **El riesgo mayor del plan, señalado donde corresponde:** la Tarea 6 Step 3 advierte que **dos** tests de `admin-registros.spec.ts` (líneas 23 y 66) van a fallar legítimamente, porque ambos hacen que un estudiante registre por la UI y esta historia le quita ese permiso. Verificado leyendo el archivo, no supuesto. Está marcado como decisión de producto y no de implementación, para que nadie lo "arregle" en silencio cambiando el rol del fixture.
- **Un efecto de segundo orden, también anotado:** el test de la línea 113 sigue pasando pero deja de ser preciso, porque ahora hay dos motivos por los que el insert falla en vez de uno. No es un fallo, es una pérdida de poder diagnóstico — vale registrarla sin actuar sobre ella en esta rama.
