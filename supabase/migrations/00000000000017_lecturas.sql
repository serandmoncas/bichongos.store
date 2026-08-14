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
--
-- La policy de DELETE se restringe al dueño (user_id = auth.uid()), NO a
-- profesor/admin — deliberado: el progreso es el registro personal del
-- estudiante y un supervisor no lo edita. Difiere a propósito de
-- contenidos (migración 15), donde profesor/admin sí borran filas ajenas
-- porque ahí el dato es documentación compartida.
