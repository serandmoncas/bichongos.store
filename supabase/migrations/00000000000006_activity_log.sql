create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete set null,
  accion text not null,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

grant select on public.activity_log to authenticated;

create policy "admin lee el log de auditoría"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

-- SECURITY DEFINER: el usuario que ejecuta el UPDATE sobre profiles no
-- necesita (ni tiene) privilegios de INSERT sobre activity_log. Nadie
-- puede escribir ahí salvo este trigger — no existe policy de INSERT
-- para authenticated. Corre AFTER UPDATE, después de que
-- enforce_role_estado_immutable (BEFORE UPDATE, migración 2) ya validó
-- que quien cambia el rol/estado es admin; si esa validación falla, el
-- UPDATE se aborta entero y este trigger nunca se ejecuta.
create function public.log_profile_role_estado_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_rol', old.role::text, new.role::text);
  end if;

  if new.estado is distinct from old.estado then
    insert into public.activity_log (actor_id, target_id, accion, valor_anterior, valor_nuevo)
    values (auth.uid(), new.id, 'cambio_estado', old.estado, new.estado);
  end if;

  return new;
end;
$$;

revoke execute on function public.log_profile_role_estado_change() from public, anon, authenticated;

create trigger log_role_estado_change
  after update on public.profiles
  for each row execute procedure public.log_profile_role_estado_change();
