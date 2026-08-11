-- Corrige un bug de la migración 10: el tercer exists() del WITH CHECK de
-- la policy de INSERT filtraba la fila de asignado_a a través de la RLS
-- de profiles del propio caller, y esa RLS solo deja ver la fila propia
-- (o todas, si eres admin) — así que un profesor nunca podía pasar ese
-- chequeo al asignar a otra persona. Se reemplaza por una función
-- SECURITY DEFINER (mismo patrón que is_admin(), migración 3, y
-- nombres_de_usuarios/listar_usuarios_aprobados) que evalúa la condición
-- sin pasar por la RLS del caller.
create function public.es_perfil_aprobado(target_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = target_id and role <> 'pendiente'
  );
$$;

revoke execute on function public.es_perfil_aprobado(uuid) from public, anon;
grant execute on function public.es_perfil_aprobado(uuid) to authenticated;

drop policy "profesor y admin asignan tareas" on public.tareas_asignadas;

create policy "profesor y admin asignan tareas"
  on public.tareas_asignadas for insert
  to authenticated
  with check (
    asignado_por = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
    and public.es_perfil_aprobado(asignado_a)
  );
