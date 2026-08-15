-- Hasta acá, cualquier rol aprobado podía escribir la bitácora de un lote
-- (migración 8). Es decir: un estudiante recién aprobado, sin formación,
-- podía registrar una lectura falsa sobre un lote de producción real.
-- Esta migración exige que un estudiante tenga al menos una competencia
-- habilitante validada por un profesor. Operador, profesor y admin siguen
-- sin restricción: son roles que un admin otorgó deliberadamente.
--
-- SECURITY DEFINER y no un exists() inline en el with check: un exists()
-- dentro de una policy se evalúa bajo la RLS del propio caller, y eso ya
-- rompió este proyecto dos veces (migración 13 corrigió el caso de
-- tareas_asignadas, donde ningún profesor podía asignar). Mismo patrón que
-- is_admin() (migración 3) y es_perfil_aprobado() (migraciones 13-14).
create function public.puede_registrar()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  rol public.user_role;
begin
  select role into rol from public.profiles where id = auth.uid();

  if rol is null or rol = 'pendiente' then
    return false;
  end if;

  if rol in ('operador', 'profesor', 'admin') then
    return true;
  end if;

  return exists (
    select 1
    from public.competencias_validadas cv
    join public.competencias c on c.id = cv.competencia_id
    where cv.user_id = auth.uid() and c.habilita_operar
  );
end;
$$;

revoke execute on function public.puede_registrar() from public, anon;
grant execute on function public.puede_registrar() to authenticated;

drop policy "cualquier rol aprobado crea sus propios registros" on public.registros;

create policy "quien puede operar crea sus propios registros"
  on public.registros for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.puede_registrar()
  );

-- No cambia nada más de registros: la policy de SELECT sigue dejando que
-- cualquier rol aprobado lea la bitácora completa, siguen sin existir
-- policies de UPDATE ni DELETE (los registros son inmutables), y los
-- registros ya creados no se tocan.
