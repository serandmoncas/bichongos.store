-- Función acotada para que profesor/admin puedan listar a quién asignarle
-- una tarea (/admin/tareas). La RLS normal de profiles solo deja ver el
-- propio perfil (o todos, si eres admin) — profesor no tiene ese acceso.
-- Mismo patrón que nombres_de_usuarios (migración 9): bypass deliberado y
-- acotado a id/nombre/email/role, no la fila completa.
create function public.listar_usuarios_aprobados()
returns table (id uuid, nombre text, email text, role text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles caller
    where caller.id = auth.uid() and caller.role in ('profesor', 'admin')
  ) then
    return;
  end if;

  return query
    select p.id, p.nombre, p.email, p.role::text
    from public.profiles p
    where p.role <> 'pendiente';
end;
$$;

revoke execute on function public.listar_usuarios_aprobados() from public, anon;
grant execute on function public.listar_usuarios_aprobados() to authenticated;
