# Spec — Página pública de la cápsula GrowBox (`/growbox`)

**Fecha:** 2026-08-28
**Estado:** Implementada
**Tamaño:** feature pequeña (historia + criterios en lista)

## Historia

**Como** persona interesada en Bichongos —cliente, restaurante, aliado o alguien
que evalúa el proyecto—
**quiero** poder ver por dentro la cápsula de cultivo IoT y lo que ya hace
**para** entender que detrás del producto hay un sistema real y medido, no una
promesa de marketing.

**Valor:** la trazabilidad IoT es el argumento que separa a Bichongos del hongo
artesanal o importado. Hasta ahora ese argumento se afirmaba en la landing en dos
frases; esta página lo demuestra con capturas reales, datos medidos y una
declaración honesta de lo que todavía no funciona.

## Intención

El contenido existía ya como artefacto de Claude, accesible solo por enlace
privado. Vivía fuera del sitio: no se podía enlazar desde la landing, no aparecía
en el dominio del proyecto y dependía de una plataforma ajena.

**Quién lo nota:** cualquiera que llegue a bichongos.store y quiera saber cómo
funciona el cultivo.
**Cómo se sabrá que quedó resuelto:** la página vive en `bichongos.store/growbox`,
se llega desde la landing, y se ve igual que el artefacto original.

## Criterios de aceptación

- [x] **CA-1:** Cualquiera puede abrir `bichongos.store/growbox` sin cuenta y ver
      la página completa con sus fotografías.
- [x] **CA-2:** Desde la landing se llega a esa página en un clic.
- [x] **CA-3:** Las cuatro pestañas —El sistema, El panel de control, La app
      móvil, Home Assistant— muestran contenido distinto al pulsarlas, y se
      recorren también con el teclado.
- [x] **CA-4:** Al terminar la página, quien la ha leído tiene a mano el CTA de
      contacto de Bichongos.

## Restricciones

- El diseño del artefacto se conserva tal cual: es específico de este contenido y
  funciona. No se reescribe con la identidad de la landing.
- Su CSS **no puede filtrarse al resto del sitio**. El original definía tokens en
  `:root` y estilizaba `body`, lo que rompería la landing.
- El contenido del artefacto no se edita: mismo texto, mismas capturas.

## Decisiones

1. **Imágenes extraídas a `public/growbox/`.** El artefacto las traía en base64
   (1,4 MB dentro del HTML). Extraídas, Next las optimiza y sirve por separado.
2. **CSS encapsulado bajo `.growbox`.** Ver restricción anterior. Verificado
   midiendo la tipografía y el fondo computados del `body` de la landing después
   del cambio: siguen siendo IBM Plex Serif y crema.
3. **Sin modo oscuro.** El artefacto lo traía automático; el sitio no tiene modo
   oscuro y una página oscura sobre un footer claro se ve rota.
4. **Tipografías por `next/font`** (Fraunces y Karla), cargadas solo en esta
   ruta, como el layout raíz ya hace con IBM Plex.
5. **Pestañas como client component**; los cuatro paneles siguen siendo
   componentes de servidor y su texto entra completo en el HTML inicial.

## No-objetivos

- No se toca `/admin`, ni Supabase, ni el modelo de datos.
- No se edita el contenido ni las capturas del artefacto.
- No se añade imagen propia de Open Graph (queda la del sitio).

## Verificación

| Nivel | Resultado |
|---|---|
| `npm run lint` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ — `/growbox` se prerenderiza como estática |
| `npm test` (vitest) | ✅ 6/6 |
| `e2e/growbox.spec.ts` | ✅ 5/5 |
| Ejecución real | ✅ Revisada en pantalla a 1280 px y a 390 px, y comprobada la pestaña de la app |
| Fuga de CSS | ✅ El `body` de la landing conserva su tipografía y su fondo |

## Gotchas encontrados

- **El puerto 3000 puede estar ocupado por otra cosa.** En la máquina de
  desarrollo lo tenía un plugin de Obsidian. Con `reuseExistingServer`, Playwright
  reutilizó ese servidor ajeno y los tests fallaban con `Cannot GET /growbox`, un
  error que no apunta a la causa. `playwright.config.ts` acepta ahora `PORT`:
  `PORT=3100 npx playwright test`.
- **La suite de `/admin` necesita `SUPABASE_SERVICE_ROLE_KEY`** en el entorno, y
  no está en `.env.local`. Sin ella, `createTestUser` lanza antes de tocar
  ninguna página. No es un fallo de este cambio, pero conviene documentar de
  dónde se saca esa clave para poder correr la suite entera en local.
- **Al medir el estado visual de las pestañas justo tras el clic**, la transición
  de 150 ms está a medias y el subrayado parece estar en la pestaña equivocada.
  Hay que esperar a que termine antes de medir o de tomar capturas.
