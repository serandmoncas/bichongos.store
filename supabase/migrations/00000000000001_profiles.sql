create type public.user_role as enum ('pendiente', 'estudiante', 'profesor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  role public.user_role not null default 'pendiente',
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "usuarios leen su propio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "usuarios actualizan su propio nombre"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "admin lee todos los perfiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy "admin actualiza todos los perfiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- SECURITY DEFINER is required here (only the Auth service can insert into
-- auth.users, and this trigger must insert into public.profiles on that
-- user's behalf before any RLS policy on profiles could apply to them).
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- make this callable directly via RPC by anon/authenticated — revoke that,
-- it must only ever run as this trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
