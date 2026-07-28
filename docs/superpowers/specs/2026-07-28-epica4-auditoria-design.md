# Épica 4 — Auditoría básica (historia 19) — diseño

**Fecha:** 2026-07-28
**Épica:** 4 — Panel de administración (historia 19, última pendiente — cierra Épica 4)

## Historia

**Como** admin,
**quiero** ver quién cambió el rol o estado de qué usuario y cuándo,
**para** tener trazabilidad de las decisiones de aprobación/gestión de cuentas sin depender de la memoria de nadie.

## Alcance

Solo acciones de admin sobre otros perfiles (`updateUserRole`, `updateUserEstado`). Editar el propio nombre (`updateOwnNombre`) no se audita — bajo riesgo, no aporta valor de trazabilidad. Captura vía trigger de base de datos, no desde la Server Action — así ningún cambio futuro de rol/estado (por otra ruta de código, o incluso el procedimiento de bootstrap del SQL editor) puede quedar sin registrar.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 4, historia 19

- [ ] CA1: cuando un admin cambia el rol de otro perfil, queda un registro en activity_log con quién lo hizo, a quién, el rol anterior y el nuevo, y cuándo.
- [ ] CA2: cuando un admin cambia el estado de otro perfil, queda un registro equivalente.
- [ ] CA3: editar el propio nombre (updateOwnNombre) NO genera registro en activity_log.
- [ ] CA4: /admin/auditoria es visible y accesible solo para admin (mismo patrón que /admin/usuarios); otros roles reciben la pantalla de 404 amigable ya existente.
- [ ] CA5: la tabla en /admin/auditoria muestra, por fila, quién hizo el cambio, a quién, qué cambió y los valores anterior/nuevo, y cuándo — ordenado del más reciente al más antiguo.
- [ ] CA6: nadie (ni siquiera un admin) puede insertar directamente en activity_log vía la API — solo el trigger de la base de datos escribe ahí.
```

## Diseño

### 1. Modelo de datos y trigger

Migración `supabase/migrations/00000000000006_activity_log.sql`:

```sql
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete set null,
  accion text not null,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "admin lee el log de auditoría"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

create function public.log_profile_role_estado_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_rol', old.role::text, new.role::text);
  end if;

  if new.estado is distinct from old.estado then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_estado', old.estado, new.estado);
  end if;

  return new;
end;
$$;

revoke execute on function public.log_profile_role_estado_change() from public, anon, authenticated;

create trigger log_role_estado_change
  after update on public.profiles
  for each row execute procedure public.log_profile_role_estado_change();
```

Notas de diseño:
- **`security definer`** en la función del trigger (igual que `handle_new_user()` en la migración 1) — así puede insertar en `activity_log` sin que el usuario que ejecuta el `UPDATE` necesite privilegios de `INSERT` sobre esa tabla. **No existe ninguna policy de `INSERT`** para `authenticated` — nadie puede escribir en `activity_log` salvo el trigger, satisfaciendo CA6.
- **`after update`**, no `before` — corre después de que `enforce_role_estado_immutable` (que sigue siendo `before update`) ya validó que quien hace el cambio es admin. Si esa validación falla, el `UPDATE` completo se aborta y este trigger nunca llega a ejecutarse — no hay forma de que quede un log de un cambio que en realidad fue rechazado.
- `updateOwnNombre` solo toca la columna `nombre`, nunca `role`/`estado` — ninguna de las dos condiciones del trigger se cumple, satisfaciendo CA3 sin lógica adicional.
- `valor_anterior`/`valor_nuevo` como `text` (no `jsonb`) — mantiene "auditoría básica" simple; el enum `user_role` se castea a `text` explícitamente.

### 2. Página de auditoría

Nueva ruta `src/app/admin/auditoria/page.tsx` (Server Component), mismo gate admin-only que `/admin/usuarios` (`role !== "admin" → notFound()`).

- Consulta `activity_log` ordenado por `created_at desc`, con join a `profiles` (dos veces: una para `actor_id`, otra para `target_id`) para mostrar nombre/email en vez de UUIDs crudos. Como Supabase-js no hace joins múltiples a la misma tabla en una sola query fácilmente, se resuelve con dos queries separadas (`activity_log` + un `select` de `profiles` filtrando por los ids involucrados) y se cruzan en memoria — simple y suficiente para el volumen de datos de este proyecto.
- Tabla: columnas Quién / A quién / Qué cambió / Anterior → Nuevo / Cuándo.

### 3. Nav

Agregar "Auditoría" al `<nav>` de `src/app/admin/layout.tsx`, envuelto en el mismo condicional `profile.role === "admin"` que ya protege "Usuarios".

## Verificación

- **E2E (Playwright)**: un admin de prueba cambia el rol de un usuario de prueba (reusa el flujo ya cubierto en `admin-usuarios.spec.ts`), navega a `/admin/auditoria`, y verifica que aparece una fila con ese cambio. Un usuario de prueba no-admin recibe la pantalla de 404 amigable en `/admin/auditoria`. Un tercer caso: editar el propio nombre y confirmar que NO aparece una fila nueva en el log (cuenta de filas antes/después sin cambio).

## Fuera de alcance

- Auditoría de acciones fuera de `profiles` (no existen otras tablas mutables todavía — Épica 5 las traerá).
- Filtros/búsqueda/paginación en la tabla — prematuro para el volumen actual.
- Exportar el log o retención/purga de registros antiguos.
