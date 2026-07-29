create type public.registro_tipo as enum ('riego', 'humedad', 'temperatura', 'observacion');

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  tipo public.registro_tipo not null,
  valor text not null,
  foto_url text,
  created_at timestamptz not null default now()
);

alter table public.registros enable row level security;

grant select on public.registros to authenticated;
grant insert on public.registros to authenticated;

create policy "cualquier rol aprobado lee registros"
  on public.registros for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "cualquier rol aprobado crea sus propios registros"
  on public.registros for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

-- Sin policy de UPDATE ni DELETE: un registro es una entrada de bitácora
-- de un momento específico, inmutable — mismo principio que lotes (nunca
-- se borra) y activity_log (solo el trigger escribe).
