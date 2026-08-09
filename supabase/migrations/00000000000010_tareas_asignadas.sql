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
-- posterior a la creación es el paso a "completada", hecho exclusivamente
-- por el trigger completar_tarea_asignada (migración 12, SECURITY
-- DEFINER) — nunca directo por el usuario. Si una tarea se asignó por
-- error, queda pendiente para siempre, mismo principio de inmutabilidad
-- que lotes y registros.
