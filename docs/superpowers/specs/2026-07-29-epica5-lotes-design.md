# Épica 5 — Modelo de lotes y CRUD (historias 20-21) — diseño

**Fecha:** 2026-07-29
**Épica:** 5 — Gestión del cultivo (historias 20-21, primera parte)

## Historia

**Como** operador, profesor o admin,
**quiero** crear y editar lotes de cultivo (especie, sustrato, fecha de inicio, estado, notas),
**para** tener un registro real sobre el cual, en historias siguientes, se puedan anotar tareas diarias y construir la bitácora.

**Como** estudiante,
**quiero** ver la lista de lotes existentes,
**para** saber qué se está cultivando aunque no pueda crear ni editar lotes yo mismo.

## Alcance

Solo historias 20 (modelo de datos) y 21 (CRUD de lotes). El registro de tareas diarias (22), la bitácora (23) y las vistas especializadas por rol más allá del control de creación/edición (24) quedan para specs siguientes — no tiene sentido diseñarlos todavía sin lotes reales sobre los cuales registrar algo.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 5, historias 20-21

- [ ] CA1: operador, profesor o admin pueden crear un lote nuevo (nombre, especie, sustrato, fecha de inicio, notas) desde /admin/lotes.
- [ ] CA2: cualquier rol aprobado (estudiante incluido) ve la lista de lotes existentes en /admin/lotes, pero estudiante no ve el botón "Nuevo lote" ni controles de edición.
- [ ] CA3: operador, profesor o admin pueden editar los campos de un lote existente, incluyendo avanzar su estado (incubación → fructificación → cosechado → finalizado).
- [ ] CA4: no existe forma de eliminar un lote — ni en la UI ni a través de la API (sin policy de DELETE).
- [ ] CA5: un estudiante que intenta invocar la Server Action de crear/editar un lote directamente (sin pasar por la UI) es rechazado por RLS, no solo por la ausencia del botón en la UI.
```

Escenario Gherkin del criterio más sensible (CA5 — la UI no es la frontera de seguridad):

```gherkin
Escenario: un estudiante no puede crear un lote aunque invoque la acción directamente
  Dado un usuario autenticado con role = "estudiante"
  Cuando invoca la Server Action de crear lote (sin pasar por el botón, que ni siquiera ve)
  Entonces la base de datos rechaza el insert por RLS
  Y no se crea ningún lote
```

## Diseño

### 1. Modelo de datos

Migración `supabase/migrations/00000000000007_lotes.sql`:

```sql
create type public.lote_estado as enum ('incubacion', 'fructificacion', 'cosechado', 'finalizado');

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especie text not null,
  sustrato text,
  fecha_inicio date not null default current_date,
  estado public.lote_estado not null default 'incubacion',
  notas text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lotes enable row level security;

grant select on public.lotes to authenticated;
grant insert, update on public.lotes to authenticated;

create policy "cualquier rol aprobado lee lotes"
  on public.lotes for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "operador, profesor o admin crean lotes"
  on public.lotes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  );

create policy "operador, profesor o admin editan lotes"
  on public.lotes for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('operador', 'profesor', 'admin')
    )
  );

-- Sin policy de DELETE para nadie: un lote nunca se borra, solo se marca
-- "finalizado" — consistente con el principio de trazabilidad del proyecto
-- (nunca cultivar "a ciegas", tampoco perder el historial).
```

Notas de diseño:
- **`especie` es `text` libre por ahora** — no un catálogo controlado. Cuando se traiga contenido del repo `Bichongos` (Épica 6), se puede evolucionar a una tabla de especies sin romper lotes existentes.
- **Sin policy de `DELETE`** — ninguna policy para ese comando significa que ningún rol (ni siquiera admin) puede borrar vía la API. Es una decisión deliberada, no un olvido: si en el futuro se necesita, se agrega explícitamente.
- El `grant` explícito (`select`, `insert`, `update`) se incluye desde el principio en esta migración — ya aprendimos dos veces en Épica 4 que omitirlo dejaba la policy inalcanzable.

### 2. Página `/admin/lotes`

Nueva ruta `src/app/admin/lotes/page.tsx` (Server Component). Gate: igual que `/admin/perfil` — cualquier rol aprobado entra (el layout ya bloquea `pendiente`), sin restricción adicional de rol en este nivel.

- Lista todos los lotes (`nombre`, `especie`, `estado`, `fecha_inicio`), ordenados por `created_at desc`.
- Si `profile.role` es `operador`, `profesor` o `admin`: se muestra el botón "Nuevo lote" (lleva a `/admin/lotes/nuevo`) y cada fila es clicable hacia `/admin/lotes/[id]` para editar.
- Si `profile.role` es `estudiante`: la lista se ve igual pero sin el botón ni links de edición — filas no interactivas.

### 3. Crear y editar

- `src/app/admin/lotes/actions.ts`: `createLote(datos)` y `updateLote(id, datos)`, usando el cliente autenticado normal — la autorización real la da RLS (CA5), la UI solo oculta los controles como ayuda de UX.
- `src/app/admin/lotes/nuevo/page.tsx`: formulario de creación (Server Component + un client component de formulario, mismo patrón que `NombreForm` de Épica 4).
- `src/app/admin/lotes/[id]/page.tsx`: formulario de edición, precargado con los datos del lote, incluyendo un `<select>` de `estado`.

### 4. Nav

Agregar "Lotes" a `src/app/admin/layout.tsx`, **fuera** del condicional `role === "admin"` — visible a todos los roles aprobados (como "Mi perfil"), ya que hasta un `estudiante` puede ver la lista.

## Verificación

- **E2E (Playwright)**: un operador crea un lote y lo ve en la lista; un estudiante ve la lista pero no el botón "Nuevo lote" (y no puede navegar a `/admin/lotes/nuevo` con éxito — o bien no hay ruta que se lo impida a nivel de UI, pero si intenta guardar, RLS lo rechaza); un profesor edita el estado de un lote existente y el cambio persiste.

## Fuera de alcance

- Registro de tareas diarias (historia 22), bitácora (historia 23) — specs separados.
- Fotos adjuntas a lotes o tareas — no pedido todavía.
- Catálogo controlado de especies — texto libre por ahora.
- Asignación de lotes a estudiantes específicos — no existe ese concepto todavía en el modelo.
