create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy "admin lee todos los perfiles" on public.profiles;
create policy "admin lee todos los perfiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy "admin actualiza todos los perfiles" on public.profiles;
create policy "admin actualiza todos los perfiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
