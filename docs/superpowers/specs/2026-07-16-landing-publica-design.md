# Landing pública (Épica 2) — Spec de diseño

## Contexto de negocio

**Bichongos** es un proyecto de **Juan Ballesteros** y **Daniela Arango**, con la asesoría de **Songo Sorhongo** ("Fungicultura para la vida") — el laboratorio de cultivo de hongos gourmet y funcionales con trazabilidad IoT en Guarne, Antioquia, dirigido por María Isabel Álvarez Vera y Sergio Monsalve, que aporta el sistema de cultivo IoT y el know-how técnico. El material fuente (pitch deck, identidad visual) fue producido desde Songo Sorhongo como asesor; Bichongos es el proyecto/marca resultante.

**El problema que resuelve:** todo el hongo disponible en el mercado antioqueño se cultiva "a ciegas" — el importado (champiñón de Bogotá, shiitake de China) pierde 3–7 días de frescura y no tiene información de origen; el cultivo artesanal local tampoco registra humedad, lote ni condiciones, así que la calidad varía de cosecha a cosecha sin que nadie sepa por qué; y las variedades funcionales premium (melena de león, reishi, cordyceps) casi no se consiguen frescas.

**La solución:** cápsulas de cultivo controladas por IoT (temperatura, humedad, CO₂, luz, ajustados cada 30 segundos según un perfil por especie) con trazabilidad completa por lote vía QR — del sustrato al plato en menos de 24 horas.

**Líneas de producto:** frescos gourmet · secos y polvo · extractos dobles · servicios (kits de cultivo, licencia del sistema, consultoría, escuela de fungicultura).

**Público de la landing:** dual — clientes B2B (restaurantes/chefs, que es la entrada de mercado según el plan go-to-market) y consumidor final (bienestar, hongos funcionales). Una sola narrativa de marca sirve a ambos: no se fuerza un fork temprano en la página.

**Fuentes:** pitch deck para inversionistas (`Bichongos - Pitch Inversor.pdf` / `Bichongos.pdf`), resumen Etapa 0 (`Bichongos_Fase0_Resumen.pdf`), handoff de identidad visual (`design_handoff_identidad_bichongos/`), sitio previo en FastAPI (`songo-sorhongo.zip`, no reutilizado como código, solo como referencia de copy/tono).

**Fuera de alcance para esta landing:** cifras de inversión (TAM/SAM/SOM, proyecciones financieras, unit economics) — son contenido de pitch para inversionistas, no de cara al público. Precios de producto tampoco se publican todavía (no hay lista de precios final para consumidor/B2B separada de los rangos del pitch) — el CTA de WhatsApp sirve para cotizar.

## Sistema de marca

Dirección elegida: **"Nodo de precisión"** — símbolo de 5 círculos (4 sensores en cruz + núcleo central) que evoca un sombrero de hongo visto desde arriba.

### Colores (oklch, Tailwind v4 `@theme`)

| Token | oklch | Uso |
|---|---|---|
| `crema` | `oklch(96% 0.02 75)` | fondo base |
| `crema-claro` | `oklch(98% 0.008 75)` | tarjetas |
| `tinta` | `oklch(20% 0.02 90)` | texto principal, fondos oscuros |
| `musgo` | `oklch(56% 0.13 150)` | símbolo, CTA, acentos técnicos/IoT |
| `terracota` | `oklch(56% 0.15 40)` | acentos de producto/gourmet |

Regla: máximo 2 acentos por sección; musgo lidera en las partes técnicas (cómo funciona, trazabilidad), terracota en producto.

### Tipografía

- **IBM Plex Serif** (400, 600, 700, italic 400) — voz de marca: titulares, copy emocional.
- **IBM Plex Mono** (400, 500, 600) — voz de dato: wordmark, labels uppercase, cifras.
- Vía `next/font/google`, reemplaza las fuentes Geist del scaffold de Épica 1.

### Logo

Componente `src/components/logo.tsx` con variantes vía prop:
- `horizontal` — símbolo + wordmark + tagline (uso en footer/hero)
- `inline` — símbolo + wordmark en una línea (header/nav)
- `mono-negative` — crema sobre tinta (fondos oscuros)
- `icon` — solo el símbolo (favicon, avatar)

SVG propio (no depende del HTML/CSS del handoff), viewBox 54×54, geometría exacta documentada en el handoff (círculos cx/cy/r listados en `design_handoff_identidad_bichongos/README.md`).

## Estructura de contenido

### 1. Hero
- H1: "Bichongos"
- Tagline (IBM Plex Serif italic): "Hongos premium cultivados con precisión IoT, trazables del sustrato al plato."
- Firma secundaria (mono, uppercase): "Songo Sorhongo · laboratorio de cultivo en Guarne, Antioquia"
- CTA primario: botón "Escribinos por WhatsApp" → `wa.me/573052779142`

### 2. El problema
- H2: "Todo el hongo del mercado se cultiva a ciegas"
- Intro: "El problema no es solo la frescura: es la ausencia total de trazabilidad y datos de cultivo — tanto en el hongo importado como en el artesanal."
- 3 puntos: (a) importado sin origen, 3–7 días de transporte; (b) cultivo local sin registro de humedad/lote/condiciones, calidad inconsistente; (c) variedades funcionales premium casi imposibles de conseguir frescas.
- Cifras destacadas: "3–7 días de frescura perdida" / "0 datos de humedad, lote y condiciones"

### 3. Cómo funciona (la solución)
- H2: "La cápsula de cultivo controlada por IoT"
- Body: "Cada especie habita una cámara hermética que recrea su microclima exacto. El sistema lee sensores cada 30 segundos y ajusta temperatura, humedad, CO₂ y luz según el perfil activo."
- Chips: Temperatura · Humedad · CO₂ · Luz
- Trazabilidad: "Cada lote tiene un identificador único con historial completo de cultivo — del sustrato al plato en menos de 24 horas." + dato destacado "< 24 h" / "QR historial por lote"

### 4. Producto — cuatro líneas
Grid de 4 tarjetas (sin precios):
1. **Frescos gourmet** — Orellana, shiitake, melena de león, enoki, portobello
2. **Secos y polvo** — Reishi, melena de león y shiitake en bolsa o frasco
3. **Extractos dobles** — Reishi, melena, cordyceps y blend "Inmunidad"
4. **Servicios** — kits de cultivo, licencia del sistema, consultoría, escuela de fungicultura

### 5. CTA final + footer
- H2: "¿Restaurante, tienda o querés probar Bichongos?"
- Botón WhatsApp (mismo número que el hero)
- Footer: logo `mono-negative` sobre fondo tinta, ubicación (Guarne, Antioquia), Instagram `@songo_sorhongo`, correo `songosorhongo781@gmail.com`

## Enfoque técnico

- Next.js App Router, un único `src/app/page.tsx` server component orquestando componentes de sección en `src/components/landing/` (`hero.tsx`, `problema.tsx`, `como-funciona.tsx`, `producto.tsx`, `cta-footer.tsx`) — cada uno enfocado en una sección, sin lógica compartida más allá de los tokens de marca.
- `src/components/logo.tsx` reutilizable (ver arriba), y `src/components/whatsapp-button.tsx` para el CTA (evita repetir el link `wa.me` y el `aria-label`).
- Colores y tipografía como tokens globales en `globals.css` (`@theme`) — no hardcodeados por componente, para que Épica 4 (panel admin) los reutilice.
- Sin componentes cliente (`"use client"`) — la landing es 100% estática, sin interactividad que lo requiera.

## SEO básico
- `metadata` en `src/app/layout.tsx`: title "Bichongos · Fungicultura para la vida", description basada en la tagline, Open Graph con imagen del símbolo sobre fondo tinta.
- Favicon generado desde la variante `icon` del logo (monocromo positivo).

## Responsive y accesibilidad
- Mobile-first: 1 columna en mobile, grid `md:`/`lg:` para las 4 tarjetas de producto y las cifras destacadas del problema/trazabilidad.
- Contraste verificado en los 4 colores de marca; terracota/musgo solo como acento, nunca como texto de cuerpo sobre crema si no pasa AA.
- Un solo `h1` (hero), jerarquía `h2` por sección.
- `aria-label` descriptivo en el botón de WhatsApp ("Escribir a Bichongos por WhatsApp").
- `alt` en el SVG del logo.

## Decisiones explícitas (para revisar si cambian)
- **Sin precios públicos todavía** — el CTA de WhatsApp cotiza. Fácil de agregar precios por línea de producto después si se define una lista pública.
- **Sin fotografía real** — no hay assets de producto/laboratorio aún (confirmado en el handoff de identidad); las secciones usan la paleta de marca y el símbolo en vez de fotos placeholder.
- **CTA único: WhatsApp** al número `+57 305 2779142` (distinto al que aparece en el pitch deck, `+57 350 2440674` — se usa el nuevo número indicado explícitamente para el sitio).
- **No se muestra el equipo/fundadores en esta landing** — el pitch deck presenta al equipo de Songo Sorhongo como asesor técnico, pero Épica 2 no incluye una sección "quiénes somos" en el backlog; se puede agregar como historia futura (mencionando a Juan Ballesteros y Daniela Arango como fundadores de Bichongos, con Songo Sorhongo como asesoría) si se quiere.
