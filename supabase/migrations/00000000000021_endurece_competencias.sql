-- Endurece los dos hallazgos de la revisión final de la historia 27 que se
-- dejaron abiertos por menores. Dejaron de ser hipotéticos el 2026-08-15, al
-- crearse las once competencias reales: el gate pasó a decidir quién escribe
-- la bitácora del primer lote, con cuatro personas por validarse.

-- 1. La policy de INSERT de competencias_validadas (migración 18) verifica
--    que quien valida sea profesor/admin, pero no que el destinatario esté
--    aprobado. tareas_asignadas sí lo hace desde la migración 14, vía
--    es_perfil_aprobado(). Sin el guard, un profesor llamando PostgREST
--    directo puede validarle una competencia habilitante a un usuario
--    'pendiente'; cuando un admin luego lo apruebe como 'estudiante', opera
--    de inmediato sin que nadie revise nada.
--
--    No hay escalada viva —puede_registrar() devuelve false para
--    'pendiente'— y la UI tampoco lo ofrece, porque
--    listar_usuarios_aprobados() (migración 11) ya excluye a los pendientes.
--    Es un permiso preparado por adelantado. Se recrea la policy con el
--    guard; el resto queda idéntico a la migración 18.
drop policy "profesor y admin validan competencias" on public.competencias_validadas;

create policy "profesor y admin validan competencias"
  on public.competencias_validadas for insert
  to authenticated
  with check (
    validado_por = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
    and public.es_perfil_aprobado(user_id)
  );

-- 2. competencias no protege created_by/created_at. La migración 18 copió el
--    modelo de contenidos (migración 15) incluyendo el hueco que la migración
--    16 ya había cerrado allá: la policy de UPDATE deja a cualquier profesor
--    editar la competencia de cualquier otro —es documentación compartida, y
--    eso es deliberado— pero no fija esas dos columnas, así que un UPDATE
--    normal puede reescribir quién la creó.
--
--    Igual que preservar_creacion_contenido() y que prevent_self_role_change
--    (migración 2), se preservan los valores originales en vez de lanzar una
--    excepción: así una edición que por descuido reenvía el objeto completo
--    no falla, simplemente esos dos campos no cambian.
--
--    Es duplicación de seis líneas respecto de la migración 16, y se acepta a
--    propósito. Unificarlas en una función genérica obligaría a migrar
--    también el trigger de contenidos —que tiene datos vivos en producción—
--    para no dejar dos mecanismos haciendo lo mismo. No vale el riesgo por
--    seis líneas.
create function public.preservar_creacion_competencia()
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

revoke execute on function public.preservar_creacion_competencia() from public, anon, authenticated;

create trigger competencias_creacion_inmutable
  before update on public.competencias
  for each row execute procedure public.preservar_creacion_competencia();
