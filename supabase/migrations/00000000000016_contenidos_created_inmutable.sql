-- La policy de UPDATE de contenidos (migración 15) permite a cualquier
-- profesor/admin editar el contenido de cualquier otro, pero no fija
-- created_by/created_at: un UPDATE normal puede reescribirlos junto con
-- el resto de columnas. Eso rompe la trazabilidad mínima que la propia
-- migración 15 declara como motivo de updated_by/updated_at (quién creó
-- el contenido originalmente debe quedar fijo). Igual que
-- prevent_self_role_change (migración 2), se preservan los valores
-- originales en vez de lanzar una excepción: así una edición normal que
-- por descuido reenvía created_by/created_at (p.ej. un formulario que
-- manda el objeto completo) no falla, simplemente esos dos campos no
-- cambian.
create function public.preservar_creacion_contenido()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.created_by = old.created_by;
  new.created_at = old.created_at;
  return new;
end;
$$;

revoke execute on function public.preservar_creacion_contenido() from public, anon, authenticated;

create trigger contenidos_creacion_inmutable
  before update on public.contenidos
  for each row execute procedure public.preservar_creacion_contenido();
