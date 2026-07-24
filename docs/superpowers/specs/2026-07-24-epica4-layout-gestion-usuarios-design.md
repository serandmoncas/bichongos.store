# Épica 4 — Layout del admin y gestión de usuarios (incluye rol operador) — diseño

**Fecha:** 2026-07-24
**Épica:** 4 — Panel de administración (historias 16 y 17)

## Problema

`/admin` es hoy un placeholder ("panel en construcción"). No hay forma de aprobar usuarios `pendiente`, asignarles rol, ni gestionar el personal que va a operar el cultivo. Además, el enum de roles (`pendiente | estudiante | profesor | admin`) no modela a Lore y Fredy, el personal operativo de confianza que va a usar el panel día a día — necesitan más permisos que un `estudiante` (crear/editar lotes, no solo registrar tareas) pero no supervisan ni asignan trabajo como un `profesor`.

## Alcance

Historias 16 (layout del admin) y 17 (gestión de usuarios) de la Épica 4, más la migración del nuevo rol `operador` que ambas necesitan. Fuera de alcance: historia 18 (perfil propio) e historia 19 (auditoría/`activity_log`) — specs separados. Las políticas RLS de `lotes`/`registros` para `operador` se escriben en Épica 5, cuando esas tablas existan; aquí solo se documenta el modelo de permisos acordado.

## Diseño

### 1. Modelo de roles

Nuevo valor en el enum `public.user_role`: `operador`, agregado entre `estudiante` y `profesor`.

```sql
alter type public.user_role add value 'operador';
```

Postgres exige que `ALTER TYPE ... ADD VALUE` vaya en su propia migración (no puede combinarse con otro DDL que lo use en la misma transacción) — migración `00000000000005_add_operador_role.sql`, solo esa línea.

Modelo de permisos (documentado para Épica 5, no implementado en RLS todavía):
- **`operador`** = todo lo de `estudiante` (lee lotes, registra tareas/observaciones propias, lee contenidos) **+ crea y edita lotes**.
- No cambia nada de `estudiante`, `profesor` ni `admin`.
- No se toca RLS de `profiles` — las políticas de admin (`admin lee/actualiza todos los perfiles`) usan `is_admin()`, independiente de qué valores tenga el enum.

### 2. Layout del admin

Modificar `src/app/admin/layout.tsx` (mantiene el gate por rol ya existente, solo agrega estructura visual alrededor de `{children}`):
- **Header**: `Logo` (variante `inline`), email del usuario actual, badge con su rol, botón "Cerrar sesión" (reutiliza la Server Action `signOut` de `src/app/actions/auth.ts`).
- **Nav**: un solo link, "Usuarios" → `/admin/usuarios`. No se construye una nav genérica para secciones que no existen todavía (Épica 5+ agregará las suyas cuando lleguen).

`src/app/admin/page.tsx` deja de ser el placeholder: hace `redirect("/admin/usuarios")` — es la única sección real hoy, evitar una pantalla intermedia vacía.

### 3. Gestión de usuarios

Nueva ruta `src/app/admin/usuarios/page.tsx` (Server Component). Gate adicional específico de esta página: si el perfil del usuario actual no tiene `role === "admin"`, `notFound()` (profesor/operador/estudiante pasan el gate del layout pero no deben ver esta página).

Contenido:
- Tabla con todos los perfiles (`nombre`, `email`, `role`, `estado`, `created_at`), leída con el cliente autenticado normal (RLS ya lo permite a un admin).
- Por fila: dropdown de rol (`pendiente | estudiante | operador | profesor | admin`) y toggle de estado (`activo | inactivo`), cada cambio dispara una Server Action que hace el `update` sobre `profiles` a través del cliente autenticado normal — **no** service role. La autorización la da la RLS existente, consistente con "RLS es la frontera de seguridad, no el frontend" (CLAUDE.md).
- **Restricción de producto**: la fila del propio admin tiene el dropdown de rol y el toggle de estado deshabilitados — un admin no puede cambiarse su propio rol ni desactivarse desde esta UI. (El trigger de BD no previene esto — es una salvaguarda de UI para evitar que alguien se bloquee su propio acceso sin querer.)
- No hay botón "Aprobar" separado: aprobar un usuario `pendiente` es asignarle cualquier rol real desde el mismo dropdown.

### 4. Server Actions

`src/app/admin/usuarios/actions.ts` (nuevo):
- `updateUserRole(userId: string, role: UserRole)`: valida que `userId` no sea el del usuario actual (server-side, no solo deshabilitar el botón en el cliente — el cliente se puede manipular), luego hace el `update`.
- `updateUserEstado(userId: string, estado: "activo" | "inactivo")`: misma validación.
- Ambas revalidan la ruta (`revalidatePath("/admin/usuarios")`) tras el update.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 4, historias 16-17

- [ ] CA1: un admin ve en /admin/usuarios la lista completa de perfiles con su rol y estado actuales.
- [ ] CA2: un admin puede cambiar el rol de cualquier perfil, incluyendo asignar "operador", excepto el suyo propio.
- [ ] CA3: un admin puede desactivar/reactivar cualquier perfil, excepto el suyo propio.
- [ ] CA4: un usuario con rol pendiente, profesor, estudiante u operador recibe 404 al visitar /admin/usuarios (solo admin la ve).
- [ ] CA5: cambiar el rol o estado del propio admin vía la Server Action (no solo la UI) es rechazado — la restricción es del servidor, no solo del cliente.
- [ ] CA6: el header de /admin muestra el email y rol del usuario actual, y el botón de cerrar sesión funciona.
```

Escenario Gherkin del criterio más sensible (CA2/CA5 — auto-modificación):

```gherkin
Escenario: un admin no puede cambiarse su propio rol
  Dado que un admin autenticado ve su propia fila en /admin/usuarios
  Cuando intenta invocar updateUserRole con su propio id de usuario
  Entonces la acción se rechaza sin modificar su perfil
  Y su rol en la base de datos sigue siendo "admin"

Escenario: un admin aprueba a un usuario pendiente como operador
  Dado un perfil con role = "pendiente"
  Cuando el admin le asigna el rol "operador" desde /admin/usuarios
  Entonces el perfil pasa a role = "operador"
  Y ese usuario, al iniciar sesión, accede a /admin en vez de ser redirigido a /pendiente
```

## Verificación

- **Unit (Vitest)**: función pura que decide si los controles de una fila deben estar deshabilitados dado `(currentUserId, rowUserId)` — extraída, no enterrada en el JSX del componente.
- **E2E (Playwright)**, extendiendo `e2e/fixtures/test-users.ts`: un admin de prueba entra a `/admin/usuarios`, cambia el rol de un usuario de prueba `pendiente` a `operador`, se verifica que persiste (releyendo el perfil). Un usuario de prueba con rol `profesor` recibe 404 en `/admin/usuarios`.

## Fuera de alcance (explícito)

- Perfil propio (historia 18) y auditoría/`activity_log` (historia 19) — specs separados.
- RLS de `lotes`/`registros` para `operador` — se escribe en Épica 5, cuando esas tablas existan.
- Paginación/búsqueda en la tabla de usuarios — prematuro para el número de usuarios actual del proyecto (equipo pequeño).
