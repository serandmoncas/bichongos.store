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
-- "finalizado" — trazabilidad completa del historial de cultivo.
