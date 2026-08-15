create table public.competencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  habilita_operar boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.competencias_validadas (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  validado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (competencia_id, user_id)
);

alter table public.competencias enable row level security;
alter table public.competencias_validadas enable row level security;

grant select on public.competencias to authenticated;
grant insert, update, delete on public.competencias to authenticated;

grant select on public.competencias_validadas to authenticated;
grant insert, delete on public.competencias_validadas to authenticated;

-- Catálogo: cualquier rol aprobado lo lee; solo profesor/admin lo administran.
-- Mismo modelo que contenidos (migración 15).

create policy "cualquier rol aprobado lee competencias"
  on public.competencias for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role <> 'pendiente'
    )
  );

create policy "profesor y admin crean competencias"
  on public.competencias for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin editan competencias"
  on public.competencias for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  )
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin eliminan competencias"
  on public.competencias for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

-- Validaciones: cada quien ve las suyas, profesor/admin ven todas y son
-- los únicos que validan y revocan.
--
-- Ojo con la asimetría respecto de lecturas (migración 17): allá el dueño
-- de la fila la crea y la borra, y un profesor NO puede tocarla, porque es
-- el registro personal del estudiante. Acá es al revés — el estudiante
-- solo lee. Es su expediente, no su cuaderno. No "armonizar" las dos.

create policy "cada quien ve sus propias competencias validadas"
  on public.competencias_validadas for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profesor y admin ven todas las competencias validadas"
  on public.competencias_validadas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin validan competencias"
  on public.competencias_validadas for insert
  to authenticated
  with check (
    validado_por = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

create policy "profesor y admin revocan competencias"
  on public.competencias_validadas for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('profesor', 'admin')
    )
  );

-- Sin policy de UPDATE en competencias_validadas: una validación existe o
-- no existe. Validar es un INSERT, revocar un DELETE — mismo principio de
-- presencia-como-estado que lecturas, y el unique(competencia_id, user_id)
-- impide validar dos veces lo mismo.
