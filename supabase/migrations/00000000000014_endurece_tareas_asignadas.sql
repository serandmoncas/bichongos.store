-- Endurece dos puntos menores encontrados en la revisión final de esta
-- rama (asignación de tareas):
--
-- 1. es_perfil_aprobado(target_id) (migración 13) no verificaba que quien
--    llama fuera a su vez un perfil aprobado — cualquier authenticated con
--    un UUID podía preguntar "¿esta persona está aprobada?". Se agrega el
--    mismo guard defensivo que nombres_de_usuarios (migración 9): si el
--    caller no es un perfil aprobado, retorna false de inmediato, sin
--    llegar a mirar la fila del target.
create or replace function public.es_perfil_aprobado(target_id uuid)
returns boolean
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
    return false;
  end if;

  return exists (
    select 1 from public.profiles where id = target_id and role <> 'pendiente'
  );
end;
$$;

-- 2. La policy de INSERT de tareas_asignadas (migración 10, ajustada en la
--    13) no fijaba estado/registro_id/completada_en al crear la fila. El
--    invariante del diseño es "el único camino a completada es el
--    trigger" (migración 12) — pero nada impedía que un profesor/admin
--    insertara directo una tarea ya "completada" con un registro_id
--    arbitrario. Se recrea la policy agregando esas tres condiciones al
--    with check; el resto queda exactamente igual que en la migración 13.
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
    and estado = 'pendiente'
    and registro_id is null
    and completada_en is null
  );
