# Épica 5 — Registro de tareas y bitácora (historias 22-23) — diseño

**Fecha:** 2026-07-29
**Épica:** 5 — Gestión del cultivo (historias 22-23)

## Historia

**Como** cualquier usuario aprobado (estudiante incluido),
**quiero** registrar una tarea diaria sobre un lote (riego, humedad, temperatura u observación),
**para** dejar constancia de lo que se hizo y cuándo, sin depender de la memoria de nadie.

**Como** cualquier usuario aprobado,
**quiero** ver la bitácora cronológica de un lote,
**para** entender su historia completa de cultivo.

## Alcance

Solo historias 22 y 23. Fotos (`foto_url`) quedan reservadas en el modelo pero sin implementar subida real — es una pieza técnica aparte (Supabase Storage + su propia RLS) para un spec futuro. Historia 24 (vistas por rol especializadas, asignación de tareas por parte de profesores) también queda fuera — introduce el concepto de "asignación" que no existe todavía en el modelo y merece su propio diseño.

**Cambio de comportamiento respecto a lo ya construido:** `/admin/lotes/[id]` deja de ser una página exclusiva de edición (operador/profesor/admin) y pasa a ser una página de **detalle abierta a cualquier rol aprobado** — necesario para que un estudiante pueda ver la bitácora de un lote y registrar una tarea. El formulario de editar el lote (nombre/especie/estado/etc.) se sigue mostrando únicamente a operador/profesor/admin, ahora como una sección condicional dentro de esa misma página en vez de ser toda la página.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 5, historias 22-23

- [ ] CA1: cualquier rol aprobado (estudiante incluido) puede registrar una tarea (tipo + valor) sobre un lote desde /admin/lotes/[id].
- [ ] CA2: cualquier rol aprobado ve la bitácora completa de un lote (todos los registros, no solo los propios), ordenada del más reciente al más antiguo, con quién la hizo, tipo, valor y cuándo.
- [ ] CA3: un usuario no puede registrar una tarea a nombre de otro — el user_id del registro siempre es el del usuario autenticado, garantizado por RLS, no solo por la UI.
- [ ] CA4: los registros son inmutables — no existe forma de editar ni eliminar uno, ni en la UI ni a través de la API (sin policy de UPDATE/DELETE).
- [ ] CA5: un rol operador/profesor/admin sigue pudiendo editar los datos del lote (nombre, especie, estado, etc.) desde la misma página /admin/lotes/[id]; un estudiante ve esos datos de solo lectura, sin el formulario de edición.
- [ ] CA6: la lista /admin/lotes permite a cualquier rol aprobado entrar al detalle de un lote (antes solo los roles que editaban podían hacer click).
```

Escenario Gherkin del criterio más sensible (CA3):

```gherkin
Escenario: un usuario no puede registrar una tarea suplantando a otro
  Dado un usuario autenticado con role = "estudiante"
  Cuando invoca la Server Action de crear registro con un user_id distinto al suyo (manipulando la llamada, no vía la UI)
  Entonces la base de datos rechaza el insert por RLS
  Y no se crea ningún registro
```

## Diseño

### 1. Modelo de datos

Migración `supabase/migrations/00000000000008_registros.sql`:

```sql
create type public.registro_tipo as enum ('riego', 'humedad', 'temperatura', 'observacion');

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  tipo public.registro_tipo not null,
  valor text not null,
  foto_url text,
  created_at timestamptz not null default now()
);

alter table public.registros enable row level security;

grant select on public.registros to authenticated;
grant insert on public.registros to authenticated;

create policy "cualquier rol aprobado lee registros"
  on public.registros for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "cualquier rol aprobado crea sus propios registros"
  on public.registros for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

-- Sin policy de UPDATE ni DELETE: un registro es una entrada de bitácora
-- de un momento específico, inmutable — mismo principio que lotes (nunca
-- se borra) y activity_log (solo el trigger escribe).
```

Notas de diseño:
- `foto_url` existe en la columna pero ningún código la usa todavía — reservada para cuando se implemente subida real de fotos.
- `on delete cascade` en `lote_id`: dado que los lotes nunca se eliminan (sin policy de DELETE), esta cascada nunca se dispara en la práctica hoy — se declara igual por corrección referencial estándar.
- El `with check` de INSERT combina dos condiciones: `user_id = auth.uid()` (CA3, nadie registra a nombre de otro) y el chequeo de rol aprobado (mismo patrón que `lotes`).

### 2. `/admin/lotes/[id]` — de "editar" a "detalle"

Reescribir `src/app/admin/lotes/[id]/page.tsx`:
- Quitar el redirect por rol (`ROLES_QUE_EDITAN`) que hoy bloquea la página entera a no-editores.
- Calcular `canEdit` igual que en la lista (`ROLES_QUE_EDITAN.includes(profile?.role ?? "")`).
- Si `canEdit`: mostrar `<LoteForm>` como hoy (sección "Editar lote").
- Si no `canEdit`: mostrar los datos del lote en solo lectura (mismo patrón `<dl>` que `/admin/perfil`).
- Debajo, en ambos casos: sección "Bitácora" con la lista de registros del lote (join con `profiles` para mostrar nombre de quién registró, mismo patrón de dos queries + cruce en memoria que `/admin/auditoria`).
- Debajo de la bitácora: `<RegistroForm loteId={lote.id} />` — visible a cualquier rol aprobado.

### 3. Registrar una tarea

- `src/app/admin/lotes/registros-actions.ts`: `createRegistro(loteId: string, tipo: RegistroTipo, valor: string): Promise<void>` — obtiene `user_id` de la sesión (`getClaims().claims.sub`), nunca de un parámetro; inserta con `lote_id`, `user_id`, `tipo`, `valor`. La autorización real vive en RLS (CA3), la acción no reimplementa el chequeo de rol ni de identidad.
- `src/app/admin/lotes/[id]/registro-form.tsx`: client component — `<select>` de tipo (riego/humedad/temperatura/observación) + `<input>` de valor + botón "Registrar". Tras guardar, `router.refresh()` (no `router.push`, se queda en la misma página) para que la bitácora se actualice sin navegar fuera.

### 4. Lista `/admin/lotes`

Modificar `src/app/admin/lotes/page.tsx`: el `nombre` de cada fila es siempre un `<Link>` a `/admin/lotes/[id]`, para cualquier rol (ya no condicionado a `canEdit` — ahora esa página es de detalle, no solo de edición). El botón "Nuevo lote" sigue condicionado a `canEdit`.

## Verificación

- **E2E (Playwright)**: un estudiante entra a un lote existente, registra una tarea, y la ve aparecer en la bitácora sin recargar manualmente. Un estudiante ve el lote de solo lectura (sin el formulario de editar). Un operador sigue pudiendo editar el lote desde la misma página. Un intento directo (vía conexión a Postgres simulando la sesión, mismo patrón usado para CA5 de lotes) de insertar un registro con `user_id` de otra persona es rechazado por RLS.

## Fuera de alcance

- Subida real de fotos (`foto_url`) — spec futuro, requiere Supabase Storage.
- Historia 24: vistas especializadas por rol, asignación de tareas por profesores — spec futuro, introduce el concepto de "asignación".
- Edición o eliminación de registros — deliberadamente imposible (inmutabilidad).
- Filtros de la bitácora por tipo/fecha — prematuro para el volumen actual.
