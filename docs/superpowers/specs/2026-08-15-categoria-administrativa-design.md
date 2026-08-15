# Categoría «Administrativa» en contenidos

**Fecha:** 2026-08-15
**Épica:** 6 — Capacitación
**Tamaño:** feature pequeña (historia de usuario + criterios)

## Historia

Como **profesor o admin**, quiero publicar en el módulo de contenidos documentos que
no son ni una ficha de especie ni un SOP —acuerdos de reunión, cronogramas, criterios
de compra, lineamientos de trabajo— para que el equipo tenga un solo lugar donde
consultar lo administrativo del proyecto, en vez de que viva en una transcripción o
en un PDF suelto en el computador de alguien.

El disparador concreto: el kickoff del 15 de agosto de 2026 con Juan, Daniela, Sergio
y María Isabel dejó acuerdos (cronograma, caja menor, convocatoria de capacitación,
lineamiento de trato con el equipo de finca) que hoy no caben en ninguna categoría.

## Criterios de aceptación

1. Al crear o editar un contenido se puede elegir la categoría **«Administrativa»**,
   además de las dos que ya existían.
2. La lista de contenidos ofrece un filtro «Administrativas» que muestra solo esos
   documentos, y la categoría se lee con su nombre en español en la tabla.
3. Un contenido administrativo puede quedar **sin nivel** — no es material formativo
   escalonado y no debe obligar a inventarle un N1/N2.
4. Los contenidos que ya existían (fichas de especie y SOPs) siguen visibles y
   filtrables exactamente igual que antes.

## No-objetivos

- No se toca el permiso de quién publica: sigue siendo profesor/admin, igual que
  las otras categorías (policies de la migración 15, sin cambios).
- No se crea una jerarquía ni un orden entre categorías.
- No se toca el seguimiento de lecturas: un contenido administrativo cuenta como
  leído igual que cualquier otro.

## Diseño

### Base de datos — migración 20

```sql
alter type public.contenido_categoria add value if not exists 'administrativa';
```

Nada más. La tabla `contenidos`, sus policies y sus grants (migración 15) no cambian:
la categoría es un valor del enum, no una entidad nueva.

**Gotcha de Postgres:** un valor recién agregado a un enum no se puede *usar* en la
misma transacción que lo agrega. Por eso esta migración contiene únicamente el
`alter type` — cualquier `insert` con `'administrativa'` tiene que ir en una
transacción posterior. Es la razón por la que el contenido de kickoff se inserta
aparte y no dentro del archivo de migración.

El valor se **agrega al final** del orden del enum. Hoy nada ordena por `categoria`
(la lista ordena por `created_at desc`), así que el orden del enum no es observable;
si algún día se ordena por categoría, aparecerá de último pese a ser el primero
alfabéticamente.

### Código

La lista de categorías vivía duplicada en cinco archivos. En vez de agregar
`"administrativa"` a las cinco copias, se centralizó en `categorias.ts`, que pasa a ser
el catálogo único del módulo.

**`src/app/admin/contenidos/categorias.ts`** (el catálogo) exporta:

| Export | Para qué |
|---|---|
| `ContenidoCategoria` | el tipo, derivado con `keyof typeof` — ya no se escribe a mano |
| `CATEGORIAS` | lista ordenada `{ value, label, plural }` para el `<select>` y los filtros |
| `esCategoria(valor)` | type guard de `string` → `ContenidoCategoria` |
| `etiquetaCategoria(valor)` | etiqueta legible, con fallback al valor crudo |

El plural va explícito en el catálogo y no derivado por código: en español no se
pluraliza la última palabra sino el núcleo («Ficha de especie» → «Fichas de especie») y
hay siglas sin regla («SOP» → «SOPs»).

Los consumidores quedan sin ninguna lista propia:

| Archivo | Qué cambia |
|---|---|
| `actions.ts` | importa el tipo en vez de definirlo |
| `contenido-form.tsx` | el `<select>` itera `CATEGORIAS` |
| `page.tsx` | los filtros iteran `CATEGORIAS`; la validación usa `esCategoria` |
| `[id]/page.tsx` | usa `etiquetaCategoria` |
| `progreso/[id]/page.tsx` | usa `etiquetaCategoria` |
| `e2e/admin-contenidos.spec.ts` | importa el tipo (`import type`, se borra al compilar) |

`src/app/admin/contenidos/nuevo/page.tsx` sigue usando `"ficha_especie"` como valor
**por defecto** del formulario. No cambia: es un default, no un catálogo.

**Resultado:** agregar una categoría es ahora un cambio en dos lugares —una línea en
`categorias.ts` y una migración con el valor del enum— en vez de cinco archivos.

### `Object.hasOwn` y no `in`

`esCategoria` usa `Object.hasOwn(CATALOGO, valor)`. La versión obvia,
`valor in CATALOGO`, es incorrecta: el operador `in` también encuentra las propiedades
heredadas de `Object.prototype`, así que `?categoria=constructor` (o `toString`,
`valueOf`…) pasaría la validación y llegaría a Postgres como si fuera un valor del enum.
No es un hueco de seguridad —RLS sigue aplicando y la query va parametrizada—, pero la
consulta falla contra el enum y la lista queda vacía sin explicación.

Hay un E2E que fija esto, y se verificó que tiene dientes: falla con `in`, pasa con
`Object.hasOwn`.

## Contenido a publicar

Con la categoría disponible se publica en producción el documento
**«Kickoff: Preparación para primera siembra»**, categoría `administrativa`, `nivel`
nulo, `created_by` = `serandmoncas@gmail.com` (admin). El cuerpo es el borrador ya
redactado a partir de la transcripción de la reunión y de los dos PDFs del kickoff.

## Riesgo de producción

Esta migración **no quita ningún permiso** — solo amplía un enum. No hay filas
existentes que puedan quedar inválidas y ningún usuario pierde acceso a nada, así
que no aplica la regla de reconsultar el estado de producción antes de correr
(a diferencia de la migración 19, ver
`2026-08-14-epica6-competencias-design.md`). El `if not exists` la hace
idempotente y segura de reintentar.
