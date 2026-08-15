# Épica 6 — Checklist de competencias (historia 27) — diseño

**Fecha:** 2026-08-14
**Épica:** 6 — Capacitación (historia 27)

## Historia

**Como** profesor o admin,
**quiero** definir un catálogo de competencias y validar cuáles logró cada persona,
**para** que nadie opere sobre cultivo real sin haber demostrado que sabe hacerlo.

**Como** estudiante,
**quiero** ver qué competencias ya me validaron y cuáles me faltan,
**para** saber qué necesito para poder registrar en la bitácora.

## Alcance

Última de las tres historias de Épica 6. Las historias 25 (módulo de contenidos, 21 documentos reales) y 26 (seguimiento de progreso) ya están en producción. Esta cierra la épica y es la única que **restringe** algo: hasta ahora todo el módulo de capacitación era informativo.

### El cambio de comportamiento

Hoy la policy de INSERT de `registros` (migración 8) permite escribir la bitácora de un lote a **cualquier rol aprobado**. Es decir: un estudiante recién aprobado, sin formación alguna, puede registrar una lectura de temperatura falsa sobre un lote de producción real. Esta historia endurece esa policy — un `estudiante` necesita al menos una competencia habilitante validada por un profesor. Operador, profesor y admin siguen sin restricción.

**Corrección (2026-08-15): sí quedaron dos personas bloqueadas.** Este párrafo decía originalmente que producción no tenía ningún `estudiante` y que por lo tanto nadie perdía un permiso al desplegar. Era falso. Al aplicar la migración 19 había dos estudiantes activos: `smonsalve@gmail.com` (aprobado el 2026-07-28, es decir que ya existía cuando se escribió este diseño — el conteo estaba mal desde el día uno) y `juan@managerjb.com` (aprobado el mismo 2026-08-15). Ninguno de los dos había escrito nunca en la bitácora, así que se decidió aplicar la migración igual y dejarlos bloqueados hasta que un profesor les valide una competencia habilitante: el gate no interrumpe un trabajo en curso, solo adelanta la validación que la historia exige de todos modos.

**La lección:** el conteo de usuarios de producción es estado vivo, no un dato del diseño. Verificarlo al escribir la spec no sirve de nada — hay que volver a consultarlo en el momento de aplicar la migración, y decidir con ese número. Cualquier futura migración que quite permisos debe repetir la consulta justo antes de correr, no confiar en lo que diga el documento.

Con o sin esos dos casos, el punto de fondo no cambia: el próximo estudiante que un admin apruebe va a entrar sin poder registrar hasta que alguien lo valide — ese es el propósito de la historia, y Juan y Daniela deberían saberlo antes de que ocurra.

### Por qué esto no depende de las lecturas

La historia 26 dejó anotado que `lecturas.created_at` lo setea el cliente y que la 27 no debía tratarlo como evidencia confiable de *cuándo* alguien estudió. Este diseño resuelve esa advertencia eliminándola de raíz: el permiso de operar nunca se deriva de las lecturas, lo otorga una persona. El progreso de la 26 sigue siendo informativo — útil para que un profesor decida a quién evaluar, pero sin peso de decisión automática.

### Fuera de alcance

- Gating de creación o edición de lotes (hoy operador/profesor/admin, no cambia).
- Competencias específicas por tipo de registro (riego, humedad, temperatura, observación).
- Vencimiento o recertificación por tiempo.
- Cualquier vínculo automático entre lecturas y competencias.
- `profiles.estado`: ninguna policy del repo lo mira, así que un usuario `inactivo` conserva sus permisos. Es deuda repo-wide preexistente, no de esta historia; corregirlo requiere tocar las policies de todas las tablas y merece su propia historia.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 6, historia 27

- [ ] CA1: un profesor o admin puede crear, editar y eliminar competencias del catálogo, y marcar cuáles habilitan operar.
- [ ] CA2: un profesor o admin puede validar una competencia a una persona, y revocársela después.
- [ ] CA3: un estudiante ve su propio checklist — qué le validaron, quién y cuándo, y qué le falta — pero no puede validarse nada a sí mismo.
- [ ] CA4: un estudiante sin ninguna competencia habilitante validada NO puede crear registros en la bitácora — ni desde la UI (no ve el formulario) ni invocando la Server Action directamente (RLS lo rechaza).
- [ ] CA5: al validarle una competencia habilitante, ese mismo estudiante pasa a poder registrar; al revocársela, vuelve a quedar bloqueado.
- [ ] CA6: operador, profesor y admin registran en la bitácora sin necesitar ninguna competencia validada.
- [ ] CA7: el catálogo de competencias solo lo administran profesor y admin; un estudiante lo lee pero no lo modifica.
```

Escenario Gherkin del criterio más sensible (CA6 — el gate no debe bloquear a quien no debía):

```gherkin
Escenario: un operador registra sin tener competencias validadas
  Dado un usuario con role = "operador" y cero competencias validadas
  Cuando registra una tarea en la bitácora de un lote
  Entonces el registro se crea normalmente
  Y no se le exige ninguna competencia
```

## Diseño

### 1. Modelo de datos

Migración `supabase/migrations/00000000000018_competencias.sql`:

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
```

**RLS de `competencias`** (mismo modelo que `contenidos`, migración 15):
- SELECT: cualquier rol aprobado.
- INSERT/UPDATE/DELETE: solo profesor/admin, sobre cualquier fila.

**RLS de `competencias_validadas`:**
- SELECT: cada quien ve las suyas, **o** profesor/admin ven todas.
- INSERT: solo profesor/admin, con `validado_por = auth.uid()`.
- DELETE: solo profesor/admin (revocación).
- Sin policy de UPDATE.

Notas de diseño:
- Presencia-como-estado, igual que `lecturas` (historia 26): validar es un INSERT, revocar un DELETE, sin columna de estado que pueda desincronizarse, y el `unique (competencia_id, user_id)` impide validar dos veces lo mismo.
- **La diferencia con `lecturas` es quién escribe.** En `lecturas` el dueño de la fila es quien la crea y la borra, y un profesor no puede tocarla — es el registro personal del estudiante. Acá es al revés: el estudiante solo lee, y profesor/admin escriben y borran. Es su expediente, no su cuaderno.
- `habilita_operar` es lo único que conecta el catálogo con el permiso. Tener validada al menos una competencia marcada así habilita registrar. Una competencia sin esa marca es formativa: se valida y se ve en el checklist, pero no otorga permiso.

### 2. El endurecimiento de `registros`

Migración `supabase/migrations/00000000000019_registros_exige_competencia.sql`.

La policy actual de INSERT de `registros` (migración 8) exige `role <> 'pendiente'`. Se reemplaza por una que distingue estudiante del resto, evaluada a través de una función `SECURITY DEFINER`:

```sql
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

  -- operador, profesor y admin operan sin checklist: son roles que un
  -- admin otorgó deliberadamente a una persona en la que ya confía.
  if rol in ('operador', 'profesor', 'admin') then
    return true;
  end if;

  -- estudiante: necesita al menos una competencia habilitante validada.
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
```

**Por qué `SECURITY DEFINER` y no un `exists()` inline:** un `exists()` dentro de un `with check` se evalúa bajo la RLS del propio caller. Este proyecto ya fue mordido por eso dos veces — en la Épica 5 un `exists()` sobre `profiles` hizo que ningún profesor pudiera asignar tareas (corregido en la migración 13), y el mismo patrón reapareció en la 26. La función encapsula la evaluación fuera de la RLS del caller y sigue el precedente ya establecido por `is_admin()` (migración 3) y `es_perfil_aprobado()` (migraciones 13-14).

Lo que **no** cambia: la policy de SELECT de `registros` (cualquier rol aprobado sigue leyendo la bitácora completa), la ausencia de policies de UPDATE/DELETE (los registros siguen siendo inmutables), y los registros ya existentes.

### 3. Server Actions

`src/app/admin/competencias/actions.ts`:
- `createCompetencia(values)` / `updateCompetencia(id, values)` / `deleteCompetencia(id)` — CRUD del catálogo, con `created_by`/`updated_by` desde la sesión.
- `validarCompetencia(competenciaId, userId)` — inserta con `validado_por` desde la sesión, nunca de un parámetro.
- `revocarCompetencia(competenciaId, userId)` — borra la validación.

`CompetenciaFormValues = { nombre: string; descripcion: string; habilita_operar: boolean }`.

Todas verifican que la operación afectó filas y lanzan error explícito si no, siguiendo el precedente endurecido en las historias 25 y 26: un INSERT/DELETE denegado por RLS devuelve cero filas sin lanzar excepción, y reportar éxito en ese caso sería mentirle al usuario.

### 4. UI

**`/admin/competencias`** — una página con dos caras según el rol:

- **Cualquier rol aprobado:** su checklist — competencias logradas (con quién la validó y cuándo) y pendientes. Si no tiene ninguna habilitante validada, un aviso explicando que por eso no puede registrar en bitácora todavía.
- **Profesor/admin:** además, el catálogo completo con su marca de «habilita operar», un formulario para crear competencias, y por cada una la lista de a quién validársela o revocársela. El selector de personas usa `listar_usuarios_aprobados()` (migración 11), igual que tareas y progreso.

**`/admin/lotes/[id]`** (existente, se modifica): el formulario de registrar se muestra solo si el usuario puede registrar. Si no puede, en su lugar va un aviso con link a `/admin/competencias` explicando qué le falta. Sin esto, un estudiante vería un formulario que siempre falla contra RLS — técnicamente seguro, pero una mala experiencia y un reporte de bug garantizado.

**`src/app/admin/layout.tsx`** (existente, se modifica): link «Competencias» en el nav, visible a cualquier rol aprobado — como «Contenidos», no como «Progreso».

## Verificación

- **E2E (Playwright):**
  - Un profesor crea una competencia habilitante y se la valida a un estudiante; ese estudiante pasa de no poder registrar a poder hacerlo (CA1, CA2, CA5).
  - Un estudiante sin competencia validada no ve el formulario de registrar en el detalle del lote, y un intento directo de INSERT en `registros` (simulando su sesión con `set local role authenticated` + `request.jwt.claims`) es rechazado por RLS (CA4).
  - Un profesor le revoca la competencia y el estudiante vuelve a quedar bloqueado (CA5).
  - **Un operador con cero competencias validadas registra normalmente** (CA6). Este es el test más importante del conjunto: es fácil escribir un gate que, sin querer, bloquee también a los roles que debía dejar pasar, y ese fallo sería invisible en los otros tests.
  - Un estudiante intenta validarse una competencia a sí mismo y RLS lo rechaza (CA3).
  - Un estudiante ve el catálogo pero no el formulario de crear competencias (CA7).

## Fuera de alcance

- Gating de creación/edición de lotes o de asignación de tareas.
- Competencias exigidas por tipo de registro.
- Vencimiento, recertificación o caducidad de competencias.
- Notificaciones al validar o revocar.
- Vínculo automático entre lecturas (historia 26) y competencias — la relación es de criterio humano: un profesor puede mirar el progreso de alguien para decidir a quién evaluar, pero el sistema no lo deriva.
- `profiles.estado = 'inactivo'`: sigue sin efecto en ninguna policy del repo. Un usuario desactivado con una competencia validada seguiría pudiendo registrar. Es deuda preexistente y repo-wide, no introducida acá.
