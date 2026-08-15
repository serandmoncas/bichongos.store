# Épica 6 — Seguimiento de progreso por estudiante (historia 26) — diseño

**Fecha:** 2026-08-14
**Épica:** 6 — Capacitación (historia 26)

## Historia

**Como** estudiante u operador,
**quiero** marcar los contenidos que ya estudié y ver cuánto llevo,
**para** saber qué me falta sin llevar la cuenta de memoria.

**Como** profesor o admin,
**quiero** ver el avance de cada persona del equipo,
**para** saber quién está listo y quién necesita acompañamiento.

## Alcance

Segunda de las tres historias de Épica 6. La historia 25 (módulo de contenidos) ya está en producción con 21 documentos reales (13 fichas de especie N1-N4 + 8 SOPs). Esta historia agrega la capa de seguimiento sobre esos contenidos; la historia 27 (checklist de competencias, gating de acceso por nivel) se construye encima de estos datos.

**Qué mide y qué no:** esto registra **autodeclaración de lectura**, no competencia. Que alguien marque las 21 fichas no significa que sepa cultivar. La distinción es deliberada: validar que una persona realmente puede operar es exactamente el trabajo de la historia 27, y este modelo le deja los datos listos (qué leyó cada quien, de qué nivel, cuándo).

Quedan fuera: evaluaciones o quizzes, gating de acceso por nivel (historia 27), notificaciones o recordatorios, y cualquier medición automática de tiempo de lectura o scroll.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 6, historia 26

- [ ] CA1: cualquier usuario aprobado puede marcar un contenido como leído desde su detalle, y desmarcarlo después.
- [ ] CA2: en /admin/contenidos, cada usuario ve cuáles de los contenidos ya leyó y cuántos lleva del total.
- [ ] CA3: un profesor o admin ve en /admin/progreso el avance de todas las personas del equipo, y el detalle de qué leyó cada una y cuándo.
- [ ] CA4: un estudiante u operador no accede a /admin/progreso ni ve su link en la navegación.
- [ ] CA5: nadie puede marcar una lectura a nombre de otra persona — el user_id sale siempre de la sesión, garantizado por RLS.
- [ ] CA6: un profesor no puede desmarcar la lectura de otra persona; solo el propio usuario borra sus lecturas.
```

Escenario Gherkin del criterio más sensible (CA6):

```gherkin
Escenario: un profesor no puede borrar el progreso de un estudiante
  Dado un estudiante que marcó un contenido como leído
  Y un usuario autenticado con role = "profesor"
  Cuando el profesor intenta borrar esa lectura directamente (no vía la UI, que no ofrece la opción)
  Entonces la base de datos rechaza el delete por RLS
  Y la lectura del estudiante sigue existiendo
```

## Diseño

### 1. Modelo de datos

Nueva migración `supabase/migrations/00000000000017_lecturas.sql`:

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
```

Notas de diseño:
- El `unique (contenido_id, user_id)` es la pieza central del modelo: la presencia de la fila **es** el estado. No hay booleano `leido` ni enum de progreso.
- La policy de DELETE se restringe al dueño (`user_id = auth.uid()`), no a profesor/admin — deliberado, CA6: el progreso es del estudiante y un supervisor no lo edita. Esto difiere de `contenidos`, donde profesor/admin sí borran filas ajenas, porque ahí el dato es documentación compartida y acá es el registro personal de alguien.
- `on delete cascade` en `contenido_id`: a diferencia de `lotes` (que nunca se borran), `contenidos` **sí** tiene policy de DELETE real, así que esta cascada se dispara en la práctica cuando un profesor elimina un contenido.

### 2. Server Actions

`src/app/admin/contenidos/lecturas-actions.ts`:
- `marcarLeido(contenidoId: string): Promise<void>` — inserta con `user_id` desde `getClaims().data.claims.sub`, nunca de un parámetro.
- `desmarcarLeido(contenidoId: string): Promise<void>` — borra la fila propia de ese contenido, filtrando por `contenido_id` y por el `user_id` de la sesión.

Ambas revalidan `/admin/contenidos` y `/admin/contenidos/[id]`. Siguiendo el precedente de `deleteContenido` (endurecido en la revisión final de la historia 25), las dos verifican que la operación afectó filas y lanzan error explícito si no — un DELETE denegado por RLS devuelve cero filas sin error, y reportar éxito en ese caso sería mentirle al usuario.

### 3. UI — vista propia (cualquier rol aprobado)

- `src/app/admin/contenidos/page.tsx` (existente, se modifica): columna con marca visual en los contenidos ya leídos, y un resumen encima de la tabla («7 de 21 leídos»). Se resuelve con una query extra a `lecturas` del usuario actual y cruce en memoria con la lista de contenidos, mismo patrón de dos-queries que usa toda la app.
- `src/app/admin/contenidos/[id]/page.tsx` (existente, se modifica): renderiza `<LecturaToggle>` con el estado actual.
- `src/app/admin/contenidos/[id]/lectura-toggle.tsx` (nuevo): client component que alterna entre «Marcar como leído» y «Marcar como no leído» según el estado, llamando a la Server Action correspondiente y refrescando con `router.refresh()`.

### 4. UI — vista de supervisión (solo profesor/admin)

- `src/app/admin/progreso/page.tsx` (nuevo): tabla con una fila por persona — nombre, rol, leídos/total y porcentaje. Redirige a `/admin/contenidos` si el rol no es profesor/admin (mismo patrón de guard que `/admin/contenidos/nuevo`).
- `src/app/admin/progreso/[id]/page.tsx` (nuevo): detalle de una persona — qué contenidos leyó y cuándo, ordenado del más reciente al más antiguo.
- `src/app/admin/layout.tsx` (existente, se modifica): link «Progreso» en el nav, visible solo a profesor/admin — a diferencia de «Contenidos», que ve cualquier rol aprobado.

**Reutilización:** `/admin/progreso` necesita la lista de personas del equipo, y `public.listar_usuarios_aprobados()` (migración 11, creada para el selector de asignar tareas) devuelve exactamente `id, nombre, email, role` y ya está restringida a profesor/admin. No se crea nada nuevo para eso.

**Conteos:** se traen las lecturas y se agrupan en memoria, en vez de una función de agregación en Postgres. A la escala real (21 contenidos × el equipo, un par de cientos de filas en el peor caso) la diferencia es irrelevante y el código queda consistente con el resto de la app.

## Verificación

- **E2E (Playwright):**
  - Un estudiante marca un contenido desde el detalle; en `/admin/contenidos` aparece la marca y el contador sube. Lo desmarca y ambos vuelven al estado anterior.
  - Un profesor ve en `/admin/progreso` el avance de ese estudiante reflejando lo que marcó, y en el detalle de esa persona ve el contenido específico.
  - Un estudiante no ve el link «Progreso» en el nav y es redirigido si entra a `/admin/progreso` directo.
  - Un intento directo (simulando la sesión de un estudiante con la técnica de `set local role authenticated` + `request.jwt.claims`) de insertar una lectura con el `user_id` de otra persona es rechazado por RLS.
  - Un intento directo de un profesor de borrar la lectura de otra persona afecta cero filas (CA6). Nota: un DELETE denegado por RLS no lanza excepción — devuelve cero filas — así que el test debe verificar `rowCount === 0`, no `rejects.toThrow()`.

## Fuera de alcance

- Evaluaciones, quizzes o cualquier verificación de comprensión.
- Gating de acceso a contenidos o a operaciones según el progreso — historia 27.
- Notificaciones, recordatorios o reportes automáticos de avance.
- Medición automática de lectura (tiempo en página, scroll) — el modelo es autodeclaración explícita.
- Progreso sobre algo que no sean contenidos (lotes, tareas asignadas).

## Nota para la historia 27

El `grant insert` de `lecturas` es a nivel de tabla, sin restricción de columna y sin trigger que fije `created_at` en el servidor — quien marca una lectura puede enviar su propio `created_at` en el INSERT. Esto sigue el mismo patrón que ya existe en el resto del repo (`registros`, `tareas_asignadas`, `contenidos` comparten esta característica), así que **no es un defecto de esta historia**. Pero la historia 27 (checklist de competencias / gating de acceso real) planea apoyarse en «qué leyó cada quien y cuándo» para decidir si alguien puede operar — y en ese momento `created_at` deja de ser un dato informativo y pasa a ser evidencia con peso de decisión. Antes de usarlo así, hay que endurecerlo (por ejemplo, con un trigger `before insert` que fuerce `created_at = now()` ignorando lo que mande el cliente).
