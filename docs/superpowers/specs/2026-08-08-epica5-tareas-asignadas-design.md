# Épica 5 — Asignación de tareas y vistas por rol (historia 24) — diseño

**Fecha:** 2026-08-08
**Épica:** 5 — Gestión del cultivo (historia 24)

## Historia

**Como** profesor o admin,
**quiero** asignar una tarea (tipo + lote + persona) a un estudiante u operador,
**para** dirigir el trabajo diario del cultivo en vez de depender de que alguien decida por su cuenta qué hacer.

**Como** estudiante u operador,
**quiero** ver las tareas que me asignaron,
**para** saber qué me toca hacer sin tener que revisar lote por lote.

**Como** profesor o admin,
**quiero** ver todas las tareas asignadas de todos los lotes y su estado,
**para** supervisar qué se está cumpliendo y qué no.

## Alcance

Introduce el concepto de "tarea asignada" (pendiente de hacer), separado de `registros` (lo que ya se hizo, historia 22-23). Una tarea asignada se completa automáticamente cuando la persona asignada crea un registro que calza en lote + tipo — no hay un botón separado de "marcar como hecha".

Quedan fuera de este spec: editar/cancelar una tarea ya asignada, fecha límite o vencimiento, notificaciones, y fotos (ver "Fuera de alcance").

## Criterios de aceptación

```
## Criterios de aceptación — Épica 5, historia 24

- [ ] CA1: un profesor o admin puede asignar una tarea (lote + tipo + persona) a cualquier usuario con rol aprobado, desde /admin/tareas.
- [ ] CA2: un estudiante u operador no puede asignar tareas — ni desde la UI ni invocando la Server Action directamente (RLS lo rechaza).
- [ ] CA3: un usuario ve en /admin/tareas únicamente las tareas que le asignaron a él (pendientes y completadas), salvo que sea profesor o admin.
- [ ] CA4: un profesor o admin ve en /admin/tareas todas las tareas asignadas de todos los lotes, con quién la asignó, a quién, tipo, lote y estado.
- [ ] CA5: cuando la persona asignada registra una tarea del mismo tipo sobre el mismo lote, la tarea asignada pendiente más antigua que calce pasa a "completada" automáticamente, sin acción manual adicional.
- [ ] CA6: si otra persona (no la asignada) registra una tarea del mismo tipo y lote, la tarea asignada no se completa.
- [ ] CA7: una tarea asignada, una vez creada, no se puede editar ni eliminar (ni por UI ni por API) — el único cambio posible es el paso automático a completada del CA5.
```

Escenarios Gherkin de los criterios más sensibles:

```gherkin
Escenario: un estudiante no puede asignarse tareas a sí mismo ni a otros
  Dado un usuario autenticado con role = "estudiante"
  Cuando invoca la Server Action de asignar tarea (manipulando la llamada, no vía la UI)
  Entonces la base de datos rechaza el insert por RLS
  Y no se crea ninguna tarea asignada

Escenario: registrar la tarea correcta la completa automáticamente
  Dado que un profesor asignó a un estudiante la tarea "riego" sobre el lote "Ostra #3"
  Cuando ese estudiante registra un "riego" sobre el lote "Ostra #3"
  Entonces la tarea asignada pasa a estado "completada"
  Y queda enlazada al registro recién creado

Escenario: registrar una tarea de otro tipo o de otro lote no completa nada
  Dado que un profesor asignó a un estudiante la tarea "riego" sobre el lote "Ostra #3"
  Cuando ese estudiante registra una "observación" sobre el lote "Ostra #3"
  Entonces la tarea asignada de "riego" sigue "pendiente"
```

## Diseño

### 1. Modelo de datos

Migración `supabase/migrations/00000000000010_tareas_asignadas.sql`:

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
-- posterior a la creación es el paso a "completada", y esa la hace
-- exclusivamente el trigger completar_tarea_asignada (SECURITY DEFINER),
-- nunca el usuario directamente. Si una tarea se asignó por error, queda
-- pendiente para siempre — mismo principio de inmutabilidad que lotes y
-- registros (ver "Fuera de alcance").
```

### 2. Auto-completado al registrar

Trigger `AFTER INSERT on registros`, mismo patrón `SECURITY DEFINER` que `log_profile_role_estado_change` (migración 6):

```sql
create function public.completar_tarea_asignada()
returns trigger
language plpgsql
security definer set search_path = public
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

Notas de diseño:
- Compara `new.user_id` (quién hizo el registro) contra `asignado_a` — CA6 se cumple porque si otra persona registra, no hay fila que calce.
- Si hay varias tareas pendientes del mismo lote+tipo+persona, completa la más antigua (`order by created_at asc limit 1`) — evita ambigüedad sin necesitar que el usuario elija cuál está cumpliendo.
- No falla si no hay ninguna tarea que calce: el `update ... where id = (select ... limit 1)` con subquery vacía simplemente no actualiza ninguna fila. Registrar sin tener una tarea asignada (el caso normal de historias 22-23) sigue funcionando exactamente igual que hoy.

### 3. Listar usuarios asignables

`profiles` solo permite a cada quien leer su propia fila (salvo admin, que lee todas — migración 1/3). Profesor necesita ver la lista de personas aprobadas para el selector "asignar a" sin ampliar esa policy. Función nueva, mismo patrón que `nombres_de_usuarios` (migración 9):

```sql
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

Devuelve fila vacía si el caller no es profesor/admin (mismo estilo defensivo que `nombres_de_usuarios`) — la Server Action que la invoca de todas formas solo se expone en la parte de la UI visible a profesor/admin, pero la función no confía en eso.

### 4. Página `/admin/tareas`

Nueva ruta `src/app/admin/tareas/page.tsx` (Server Component), siguiendo el patrón de dos-queries-y-cruce-en-memoria de `/admin/lotes/[id]` y `/admin/auditoria`:

- Lee el perfil propio (`role`) igual que las demás páginas del admin.
- Query de tareas:
  - Si `role` es `profesor` o `admin`: `select *, lotes(nombre)` de **todas** las `tareas_asignadas`, orden `created_at desc`.
  - Si no: mismo select pero `.eq("asignado_a", user.sub)`.
- Resuelve nombres de `asignado_a` y `asignado_por` con `nombres_de_usuarios` (ya existe, acotada a id/nombre/email).
- Si `role` es `profesor` o `admin`: además llama a `listar_usuarios_aprobados()` para poblar el selector de personas del formulario, y a `lotes` (select id, nombre) para el selector de lote.
- Tabla de tareas: columnas Lote, Tipo, Asignado a *(solo en la vista profesor/admin — para el usuario normal es siempre él mismo, se omite)*, Asignado por, Estado, Fecha. Estado se muestra como badge (pendiente/completada).
- Sección "Asignar tarea" (solo profesor/admin): `<AsignarTareaForm lotes={...} personas={...} />`, client component con tres `<select>` (lote, persona, tipo) + botón.

### 5. Server Action

`src/app/admin/tareas/actions.ts`:

```ts
export async function asignarTarea(loteId: string, asignadoA: string, tipo: RegistroTipo) {
  // obtiene user_id de la sesión (getClaims) → asignado_por
  // insert en tareas_asignadas; RLS decide si el caller puede
}
```

Mismo patrón que `createRegistro`: `asignado_por` nunca viene de un parámetro ni del cliente, siempre de la sesión. La autorización real (solo profesor/admin, solo a un usuario aprobado) vive en RLS — la acción no la reimplementa.

### 6. Nav

`src/app/admin/layout.tsx`: agregar `<Link href="/admin/tareas">Tareas</Link>` junto a "Lotes", visible a cualquier rol aprobado (no solo admin).

## Verificación

- **E2E (Playwright):**
  - Un profesor asigna una tarea a un estudiante; el estudiante la ve pendiente en `/admin/tareas`.
  - El estudiante registra una tarea del mismo tipo/lote; la tarea pasa a completada sin acción manual (verificar en `/admin/tareas` tras `router.refresh()` o recarga).
  - Un estudiante no ve el formulario "Asignar tarea", y un intento directo de invocar la Server Action de asignar (simulando su sesión) es rechazado por RLS.
  - Un estudiante en `/admin/tareas` solo ve sus propias tareas, no las de otros; un profesor ve todas.

## Fuera de alcance

- Editar o cancelar una tarea asignada — si se asignó por error, queda pendiente indefinidamente (se puede resolver a mano en el SQL editor si hace falta; no es un flujo de producto todavía).
- Fecha límite / vencimiento y el estado "vencida" que eso implicaría.
- Notificaciones (email/push) al asignar o completar.
- Completar una tarea "a mano" sin pasar por un registro de bitácora — el único camino a `completada` es el trigger.
- Fotos en la tarea asignada — `registros.foto_url` ya existe reservado para historia futura de fotos, sin tocar aquí.
