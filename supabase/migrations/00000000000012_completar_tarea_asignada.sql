-- Al crear un registro de bitácora, si existe una tarea asignada
-- pendiente del mismo lote + tipo + persona, se marca completada
-- automáticamente. SECURITY DEFINER porque quien inserta el registro
-- (la persona asignada) no tiene (ni necesita) permiso de UPDATE directo
-- sobre tareas_asignadas — mismo patrón que log_profile_role_estado_change
-- (migración 6).
create function public.completar_tarea_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tareas_asignadas
  set estado = 'completada', registro_id = new.id, completada_en = now()
  where id = (
    select id from public.tareas_asignadas
    where lote_id = new.lote_id
      and tipo = new.tipo
      and asignado_a = new.user_id
      and estado = 'pendiente'
    order by created_at asc
    limit 1
  );
  return new;
end;
$$;

revoke execute on function public.completar_tarea_asignada() from public, anon, authenticated;

create trigger on_registro_completar_tarea
  after insert on public.registros
  for each row execute procedure public.completar_tarea_asignada();
