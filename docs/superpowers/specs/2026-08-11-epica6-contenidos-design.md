# Épica 6 — Módulo de contenidos (historia 25) — diseño

**Fecha:** 2026-08-11
**Épica:** 6 — Capacitación (historia 25)

## Historia

**Como** profesor o admin,
**quiero** crear, editar y eliminar contenido de capacitación (fichas de especie y SOPs) en Markdown,
**para** que estudiantes y operadores aprendan a cultivar sin depender de documentos sueltos fuera de la plataforma.

**Como** cualquier usuario aprobado,
**quiero** ver la lista de contenidos y leer su detalle renderizado,
**para** aprender a mi propio ritmo.

## Alcance

Épica 6 tiene tres historias (25, 26, 27) donde 26 y 27 dependen de que el modelo de contenidos exista de verdad — mismo patrón de descomposición incremental que Épica 5 (lotes → registros/bitácora → tareas asignadas). Este spec cubre **solo la historia 25**: el modelo de datos y el CRUD de contenidos.

Contenido reusable identificado en el repo `Bichongos` (I+D, `github.com/serandmoncas/Bichongos`, checkout local en `~/Code/Bichongos`): 13 fichas de especie (`docs/especies/`, nombradas `N{nivel}-{slug}.md`) y 8 SOPs de laboratorio (`docs/protocolos/`), todo en Markdown con una plantilla consistente (metadatos, tablas de parámetros, procedimientos numerados, troubleshooting). Las carpetas `docs/negocio/` y `docs/capsula/` de ese repo no aplican — son plan de negocio y hardware, no capacitación de cultivo. Cargar ese contenido real a la plataforma es trabajo operativo posterior (copiar y pegar vía el formulario de esta historia), no parte del código de este spec.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 6, historia 25

- [ ] CA1: un profesor o admin puede crear un contenido (título, categoría, nivel opcional, cuerpo en Markdown) desde /admin/contenidos/nuevo.
- [ ] CA2: un estudiante u operador no puede crear, editar ni eliminar contenido — ni desde la UI (no ve los controles) ni invocando las Server Actions directamente (RLS lo rechaza).
- [ ] CA3: cualquier usuario aprobado ve la lista completa de contenidos en /admin/contenidos y puede entrar al detalle de cualquiera, con el Markdown renderizado (no como texto plano).
- [ ] CA4: un profesor o admin puede editar o eliminar cualquier contenido, no solo el que creó él mismo.
- [ ] CA5: el nivel (N1-N4) se guarda y se muestra como dato visible/filtrable, pero no restringe qué contenido puede ver un usuario — cualquier rol aprobado ve todos los niveles.
- [ ] CA6: al editar un contenido, queda registrado quién hizo el último cambio y cuándo.
```

Escenario Gherkin del criterio más sensible (CA2):

```gherkin
Escenario: un estudiante no puede crear contenido suplantando el flujo normal
  Dado un usuario autenticado con role = "estudiante"
  Cuando invoca la Server Action de crear contenido (manipulando la llamada, no vía la UI)
  Entonces la base de datos rechaza el insert por RLS
  Y no se crea ningún contenido
```

## Diseño

### 1. Modelo de datos

Nueva migración `supabase/migrations/00000000000015_contenidos.sql`:

```sql
create type public.contenido_categoria as enum ('ficha_especie', 'sop');

create table public.contenidos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria public.contenido_categoria not null,
  nivel text,
  cuerpo text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.contenidos enable row level security;

grant select on public.contenidos to authenticated;
grant insert, update, delete on public.contenidos to authenticated;

create policy "cualquier rol aprobado lee contenidos"
  on public.contenidos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "profesor y admin crean contenidos"
  on public.contenidos for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin editan contenidos"
  on public.contenidos for update
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

create policy "profesor y admin eliminan contenidos"
  on public.contenidos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );
```

Notas de diseño:
- `nivel` es `text` libre, no enum — no todo SOP tiene un nivel N1-N4 limpio (algunos "aplican a" un rango); se guarda tal cual venga, sin validar formato.
- A diferencia de `lotes`/`registros` (que nunca se editan/borran, principio de inmutabilidad como bitácora física), `contenidos` **sí** tiene policies de UPDATE y DELETE reales — es documentación editable, no un registro de auditoría. `updated_by`/`updated_at` dan trazabilidad mínima de quién tocó qué por última vez, dado que cualquier profesor/admin puede editar el contenido de cualquier otro.
- El `with check` de UPDATE fija `updated_by = auth.uid()` (nunca un valor arbitrario del cliente), mismo principio que `asignado_por`/`user_id` en los diseños anteriores.

### 2. Server Actions

`src/app/admin/contenidos/actions.ts`:
- `createContenido(values: ContenidoFormValues): Promise<string>` — inserta con `created_by` desde `getClaims().data.claims.sub`; retorna el `id` creado para redirigir al detalle.
- `updateContenido(id: string, values: ContenidoFormValues): Promise<void>` — actualiza con `updated_by` desde la sesión, nunca del cliente.
- `deleteContenido(id: string): Promise<void>` — elimina y redirige a la lista.

`ContenidoFormValues = { titulo: string; categoria: "ficha_especie" | "sop"; nivel: string; cuerpo: string }`.

### 3. UI

- `src/app/admin/contenidos/page.tsx` — lista: título, categoría, nivel, fecha; filtro simple por categoría (tabs o `<select>`); link "Nuevo contenido" solo si `role` es profesor/admin (mismo patrón `ROLES_QUE_EDITAN` que lotes/tareas).
- `src/app/admin/contenidos/nuevo/page.tsx` — formulario de creación.
- `src/app/admin/contenidos/[id]/page.tsx` — detalle: `cuerpo` renderizado con `react-markdown`; si `canEdit`, botones "Editar" (link) y "Eliminar" (form con confirmación simple).
- `src/app/admin/contenidos/[id]/editar/page.tsx` — mismo formulario que crear, precargado.
- `src/app/admin/contenidos/contenido-form.tsx` — client component compartido entre crear/editar, mismo patrón que `LoteForm`.
- Nueva dependencia: `react-markdown` (renderiza Markdown a JSX de forma segura, sin `dangerouslySetInnerHTML`).
- Nav: link "Contenidos" en `src/app/admin/layout.tsx`, visible a cualquier rol aprobado, junto a "Lotes"/"Tareas".

## Verificación

- **E2E (Playwright):**
  - Un profesor crea un contenido vía el formulario; aparece en `/admin/contenidos` y su detalle muestra el Markdown renderizado (ej. una tabla del cuerpo se ve como `<table>`, no como texto con `|`).
  - Un estudiante ve el contenido en la lista y en el detalle, pero no ve los botones "Editar"/"Eliminar" ni el link "Nuevo contenido".
  - Un profesor distinto al que creó el contenido puede editarlo igual (CA4); tras editar, `updated_by` cambia al segundo profesor.
  - Un intento directo (simulando la sesión de un estudiante, mismo patrón que las specs anteriores) de INSERT/UPDATE/DELETE en `contenidos` es rechazado por RLS.

## Fuera de alcance

- Seguimiento de progreso por estudiante (historia 26) — quién leyó qué, checklist de lectura.
- Checklist de competencias / gating de acceso por nivel (historia 27) — `nivel` es solo metadata en esta historia.
- Adjuntos o imágenes más allá del texto Markdown — el contenido real del repo I+D tiene algunas imágenes PNG de referencia; subir archivos requiere Supabase Storage y su propia RLS, spec futuro si hace falta.
- Versionado de contenido (historial de cambios más allá de "quién tocó por última vez").
- Comentarios o discusión sobre un contenido.
- Carga masiva/importación automática del contenido del repo I+D — se hace a mano, contenido por contenido, vía el formulario de esta historia.
