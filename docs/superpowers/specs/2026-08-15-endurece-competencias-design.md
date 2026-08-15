# Endurece el gate de competencias

**Fecha:** 2026-08-15
**Épica:** 6 — Capacitación (deuda de la historia 27)
**Tamaño:** feature pequeña (historia + criterios)

## Por qué ahora

La revisión final de la historia 27 dejó cuatro hallazgos sin arreglar por ser
menores. Se archivaron cuando el gate era **teórico**: no existía ninguna
competencia en producción, así que nada de eso podía ocurrir.

El 2026-08-15 se crearon las once competencias reales y el gate quedó vivo —
va a decidir quién puede escribir la bitácora del primer lote. Además están por
entrar cuatro personas nuevas (Juan, Daniela, Lorena, Fredy) que se validarán
en la capacitación. Los hallazgos 1 y 2 pasaron de hipotéticos a plausibles.

## Historia

Como **admin**, quiero que una competencia validada solo pueda otorgarse a
alguien ya aprobado, y que no se pueda reescribir quién creó una competencia,
para que el permiso de operar el cultivo sea auditable y no se pueda preparar
por adelantado sobre una cuenta que todavía nadie autorizó.

## Criterios de aceptación

1. No se le puede validar una competencia a alguien cuya cuenta está pendiente
   de aprobación. Solo a personas ya aprobadas.
2. Al editar una competencia, quién la creó y cuándo se creó no cambian, sin
   importar lo que mande quien edita.
3. Todo lo que ya funcionaba sigue igual: un profesor valida y revoca
   competencias de personas aprobadas, y el gate de la bitácora no cambia.

## Diseño

### Migración 21

**Hallazgo 1 — `competencias_validadas` no exige perfil aprobado.** La policy
de INSERT (migración 18) verifica que quien valida sea profesor/admin, pero no
que el destinatario esté aprobado. `tareas_asignadas` sí lo hace desde la
migración 14, vía `es_perfil_aprobado()`. Sin eso, un profesor llamando
PostgREST directo puede validarle una competencia habilitante a un usuario
`pendiente`; cuando un admin luego lo apruebe como `estudiante`, opera de
inmediato sin que nadie revise nada.

No hay escalada viva —`puede_registrar()` devuelve false para `pendiente`— y la
UI no lo permite porque `listar_usuarios_aprobados()` ya excluye `pendiente`.
Es un permiso preparado por adelantado, y el arreglo es una línea.

Se recrea la policy agregando `public.es_perfil_aprobado(user_id)`. El resto
queda idéntico.

**Hallazgo 2 — `competencias` no protege `created_by`/`created_at`.** La
migración 18 copió el modelo de `contenidos` (migración 15) incluyendo el hueco
que la migración 16 ya había cerrado allá: la policy de UPDATE permite a
cualquier profesor editar la competencia de cualquier otro, pero no fija
`created_by`/`created_at`, así que un UPDATE normal puede reescribirlos.

Se replica `preservar_creacion_contenido()` (migración 16) como
`preservar_creacion_competencia()`. Es duplicación de seis líneas y se acepta a
propósito: unificarlas en una función genérica obligaría a migrar también el
trigger de `contenidos`, que tiene datos vivos en producción, para no dejar dos
mecanismos haciendo lo mismo. No vale el riesgo por seis líneas.

### Fuera de alcance, a propósito

**Hallazgo 4** (un profesor puede antedatar una validación fijando `created_at`
vía API directa) queda abierto. Es cosmético y de la misma clase que el
`lecturas.created_at` ya conocido; arreglarlo acá sentaría un precedente a
medias, con una tabla protegida y la otra no.

**Hallazgo 3** no es de base de datos y va en esta misma rama, abajo.

## Tests

### El test que dejó de aislar (hallazgo 3)

`e2e/admin-registros.spec.ts` — «un usuario no puede registrar una tarea a
nombre de otro» crea un `estudianteA` sin competencia habilitante, así que su
INSERT falla **por dos razones a la vez**: el gate de la historia 27 y la
cláusula `user_id = auth.uid()`. Si alguien quitara esa cláusula, el test
seguiría verde y el agujero pasaría desapercibido.

Se agrega `await habilitarParaOperar(estudianteA.id)` —el helper ya está en el
archivo— para que A sí pueda registrar, y el único motivo de rechazo sea que lo
hace a nombre de B.

### El teardown no borraba todo lo que la suite crea

`e2e/fixtures/teardown.ts` (escrito hoy mismo) borra los usuarios
`e2e-%@bichongos.test`, pero el helper `habilitarParaOperar` crea validadores
con el patrón `validador-%@bichongos.test`, que no matchea. Al detectarlo había
**115 usuarios validadores y 115 competencias huérfanas** acumulados.

La suite quedó repetible pero seguía goteando: con suficientes corridas vuelve
el mismo problema de volumen que motivó el teardown. Se amplía el patrón a
`%@bichongos.test` — el TLD `.test` está reservado por RFC 2606 justamente para
esto, así que ningún usuario real puede caer ahí.

## Riesgo de producción

La migración **quita un permiso**: valida contra `es_perfil_aprobado`. Hay que
consultar el estado real justo antes de aplicarla —cuántas validaciones existen
y si alguna apunta a un usuario `pendiente`— y decidir con ese número, no con
este documento. Al escribirlo había 0 validaciones, pero ese dato caduca al
escribirse (ver la lección de la migración 19 en CLAUDE.md).
