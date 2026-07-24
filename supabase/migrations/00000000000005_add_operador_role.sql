-- Nuevo rol para el personal operativo de confianza (ej. Lore y Fredy):
-- más permisos que "estudiante" (puede crear y editar lotes, no solo
-- registrar tareas), pero sin la capacidad de supervisión/asignación de
-- "profesor". ALTER TYPE ... ADD VALUE debe ir solo en su propia
-- migración — Postgres no permite combinarlo con otro DDL que lo use en
-- la misma transacción.
alter type public.user_role add value 'operador' after 'estudiante';
