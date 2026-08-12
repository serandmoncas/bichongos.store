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

-- A diferencia de lotes/registros (que nunca se editan/borran, principio
-- de inmutabilidad como bitácora física), contenidos SÍ tiene policies de
-- UPDATE y DELETE reales: es documentación editable, no un registro de
-- auditoría. updated_by/updated_at dan trazabilidad mínima de quién tocó
-- qué por última vez, dado que cualquier profesor/admin puede editar el
-- contenido de cualquier otro.
