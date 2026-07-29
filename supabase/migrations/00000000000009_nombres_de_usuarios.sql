-- Función acotada para resolver nombre/email de un conjunto de user_ids,
-- usada por la bitácora de /admin/lotes/[id] (abierta a todos los roles
-- aprobados) para mostrar quién hizo cada registro. La RLS normal de
-- profiles solo deja ver el propio perfil (o todos, si eres admin) — esta
-- función es un bypass deliberado y acotado (solo id/nombre/email, no la
-- fila completa con role/estado) en vez de ampliar la policy de SELECT de
-- profiles a "cualquier aprobado ve cualquier perfil completo".
create function public.nombres_de_usuarios(ids uuid[])
returns table (id uuid, nombre text, email text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles caller
    where caller.id = auth.uid() and caller.role <> 'pendiente'
  ) then
    return;
  end if;

  return query
    select p.id, p.nombre, p.email from public.profiles p where p.id = any(ids);
end;
$$;

revoke execute on function public.nombres_de_usuarios(uuid[]) from public, anon;
grant execute on function public.nombres_de_usuarios(uuid[]) to authenticated;
