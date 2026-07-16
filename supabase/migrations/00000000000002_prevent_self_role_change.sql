create function public.prevent_self_role_change()
returns trigger
language plpgsql
security invoker set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.estado is distinct from old.estado then
    if not exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    ) then
      raise exception 'Solo un admin puede cambiar el rol o estado de un perfil';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_self_role_change() from public, anon, authenticated;

create trigger enforce_role_estado_immutable
  before update on public.profiles
  for each row execute procedure public.prevent_self_role_change();
