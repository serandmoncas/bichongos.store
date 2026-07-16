# Landing pública (Épica 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public landing page at `/` for Bichongos — brand system (colors, typography, logo), five content sections (hero, problema, cómo funciona, producto, CTA+footer), SEO metadata, and a responsive/accessible layout — replacing the current `create-next-app` scaffold.

**Architecture:** Single Next.js App Router page (`src/app/page.tsx`) composed of server components in `src/components/landing/`, each owning one section. Shared brand primitives (`Logo`, `WhatsAppButton`) live in `src/components/`. Brand colors and fonts are global Tailwind v4 `@theme` tokens in `globals.css`, not hardcoded per component, so Épica 4 (admin panel) can reuse them.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4, `next/font/google` (IBM Plex Serif, IBM Plex Mono).

## Global Constraints

- UI language: español.
- Server components by default; no `"use client"` anywhere in this plan — the landing has no interactivity that requires it.
- Commits en español, imperativo, prefijo `land:` para esta épica (ej. `land: agrega sección hero`).
- Colors as Tailwind v4 `@theme` tokens using the exact oklch values below — never hardcode a hex/oklch value directly in a component's className or inline style.
- No real product/lab photography exists yet — sections use the brand palette and the logo symbol, not placeholder photos.
- No public pricing yet — the CTA is WhatsApp for quotes, not a price list.
- WhatsApp number for every CTA in this plan: `+57 305 2779142` → link format `https://wa.me/573052779142`.
- Songo Sorhongo (the advisory lab) is mentioned only once, as a small secondary credit in the footer — never in the hero, page title, or as if it were Bichongos' own identity/contact channels.
- Spec reference for all copy and design decisions: `docs/superpowers/specs/2026-07-16-landing-publica-design.md`.

---

### Task 1: Brand foundation — theme tokens, fonts, Logo component

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/logo.tsx`
- Delete: nothing yet (page.tsx content replaced in Task 4)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: Tailwind utilities `bg-crema`, `bg-crema-claro`, `bg-tinta`, `bg-musgo`, `bg-terracota` (and matching `text-*`, `border-*`) usable by every later task. `font-serif` (IBM Plex Serif) and `font-mono` (IBM Plex Mono) Tailwind utilities. A `Logo` component: `<Logo variant="horizontal" | "inline" | "mono-negative" | "icon" />`, default export, no props beyond `variant` (optional `className` passthrough for sizing).

- [ ] **Step 1: Replace theme tokens in `globals.css`**

Replace the full contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-crema: oklch(96% 0.02 75);
  --color-crema-claro: oklch(98% 0.008 75);
  --color-tinta: oklch(20% 0.02 90);
  --color-musgo: oklch(56% 0.13 150);
  --color-terracota: oklch(56% 0.15 40);
  --font-serif: var(--font-plex-serif);
  --font-mono: var(--font-plex-mono);
}

body {
  background: var(--color-crema);
  color: var(--color-tinta);
}
```

This removes the scaffold's `--background`/`--foreground` dark-mode media query and Geist font variables — the brand system is a fixed light palette, not OS-dark-mode-adaptive.

- [ ] **Step 2: Swap fonts in `layout.tsx`**

Replace the full contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Bichongos",
  description: "Bichongos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${ibmPlexSerif.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-serif bg-crema text-tinta">
        {children}
      </body>
    </html>
  );
}
```

(The `metadata` title/description here are placeholders replaced with real SEO copy in Task 5 — do not treat Task 5's absence yet as a defect, it's explicitly deferred.)

- [ ] **Step 2b: Verify fonts load**

Run: `npm run dev -- --port 4000 &`, then `curl -s http://localhost:4000 | grep -o 'font-plex-[a-z]*' | sort -u`, then kill the background process.
Expected: both `font-plex-serif` and `font-plex-mono` appear (confirms both `next/font` variables are wired into the page).

- [ ] **Step 3: Write the Logo component**

Create `src/components/logo.tsx`:

```tsx
type LogoVariant = "horizontal" | "inline" | "mono-negative" | "icon";

const SYMBOL_CIRCLES = [
  { cx: 27, cy: 16, r: 5, opacity: 1 },
  { cx: 16, cy: 26, r: 5, opacity: 0.75 },
  { cx: 38, cy: 26, r: 5, opacity: 0.75 },
  { cx: 27, cy: 36, r: 5, opacity: 0.5 },
];

function Symbol({
  outerFill,
  coreFill,
  size,
}: {
  outerFill: string;
  coreFill: string;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 54 54"
      role="img"
      aria-label="Símbolo Bichongos"
    >
      {SYMBOL_CIRCLES.map((c) => (
        <circle
          key={`${c.cx}-${c.cy}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={outerFill}
          opacity={c.opacity}
        />
      ))}
      <circle cx={27} cy={26} r={3} fill={coreFill} />
    </svg>
  );
}

export function Logo({
  variant,
  className,
}: {
  variant: LogoVariant;
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <div className={className}>
        <Symbol outerFill="var(--color-tinta)" coreFill="var(--color-musgo)" size={44} />
      </div>
    );
  }

  if (variant === "mono-negative") {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <Symbol outerFill="var(--color-crema)" coreFill="var(--color-tinta)" size={44} />
        <span className="font-mono text-2xl font-semibold text-crema">Bichongos</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <Symbol outerFill="var(--color-musgo)" coreFill="var(--color-tinta)" size={36} />
        <span className="font-mono text-xl font-semibold text-tinta">Bichongos</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <Symbol outerFill="var(--color-musgo)" coreFill="var(--color-tinta)" size={60} />
      <span className="font-mono text-2xl font-semibold text-tinta">Bichongos</span>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/components/logo.tsx
git commit -m "land: agrega sistema de marca (tokens de color, tipografía, logo)"
```

---

### Task 2: WhatsApp button + Hero section

**Files:**
- Create: `src/components/whatsapp-button.tsx`
- Create: `src/components/landing/hero.tsx`

**Interfaces:**
- Consumes: `Logo` from `src/components/logo.tsx` (Task 1), theme tokens from Task 1.
- Produces: `<WhatsAppButton label="..." />` (default export from `whatsapp-button.tsx`, `label` required prop, always links to the fixed number below). `<Hero />` (default export, no props) — later imported by `page.tsx` in Task 4.

- [ ] **Step 1: Write the WhatsApp button**

Create `src/components/whatsapp-button.tsx`:

```tsx
const WHATSAPP_NUMBER = "573052779142";

export function WhatsAppButton({ label }: { label: string }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir a Bichongos por WhatsApp"
      className="inline-flex items-center justify-center rounded bg-musgo px-6 py-3 font-mono text-sm font-medium uppercase tracking-wide text-crema-claro transition-opacity hover:opacity-90"
    >
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Write the Hero section**

Create `src/components/landing/hero.tsx`:

```tsx
import { Logo } from "@/components/logo";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-24 text-center sm:px-12">
      <Logo variant="horizontal" />
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
          Bichongos
        </h1>
        <p className="mx-auto max-w-xl font-serif text-xl italic text-tinta/80 sm:text-2xl">
          Hongos premium cultivados con precisión IoT, trazables del sustrato
          al plato.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
          Laboratorio de cultivo · Guarne, Antioquia
        </p>
      </div>
      <WhatsAppButton label="Escribinos por WhatsApp" />
    </section>
  );
}
```

- [ ] **Step 3: Temporarily render Hero to verify**

Modify `src/app/page.tsx` to, temporarily, only:

```tsx
import { Hero } from "@/components/landing/hero";

export default function Home() {
  return (
    <main>
      <Hero />
    </main>
  );
}
```

(This is a scaffolding step — Task 4 replaces `page.tsx` again with the full section list. Do not delete the old default-scaffold JSX by hand-editing around it; a full replace is expected and correct here.)

- [ ] **Step 4: Verify**

Run: `npm run dev -- --port 4000 &`, then `curl -s http://localhost:4000 | grep -o 'Hongos premium cultivados con precisión IoT'`, then kill the background process.
Expected: the tagline text is found in the rendered HTML.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/whatsapp-button.tsx src/components/landing/hero.tsx src/app/page.tsx
git commit -m "land: agrega botón de WhatsApp y sección hero"
```

---

### Task 3: Problema + Cómo funciona sections

**Files:**
- Create: `src/components/landing/problema.tsx`
- Create: `src/components/landing/como-funciona.tsx`

**Interfaces:**
- Consumes: theme tokens from Task 1. No dependency on Hero/WhatsAppButton.
- Produces: `<Problema />` and `<ComoFunciona />` (default exports, no props) — imported by `page.tsx` in Task 4.

- [ ] **Step 1: Write the Problema section**

Create `src/components/landing/problema.tsx`:

```tsx
const PUNTOS = [
  {
    titulo: "Importado y sin origen",
    texto:
      "El champiñón viene de Bogotá y el shiitake de China: 3–7 días de transporte y cero información de cómo se cultivó.",
  },
  {
    titulo: "Local pero a ciegas",
    texto:
      "El cultivo artesanal de la región tampoco registra humedad, lote ni condiciones — la calidad cambia de cosecha a cosecha y nadie sabe por qué.",
  },
  {
    titulo: "Sin respaldo funcional",
    texto:
      "Melena de león, reishi y cordyceps casi no se consiguen frescas y, sin datos de cultivo, no hay forma de garantizar su potencia.",
  },
];

export function Problema() {
  return (
    <section className="bg-tinta px-6 py-20 text-crema-claro sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          Todo el hongo del mercado se cultiva a ciegas
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg italic text-crema-claro/80">
          El problema no es solo la frescura: es la ausencia total de
          trazabilidad y datos de cultivo — tanto en el hongo importado como
          en el artesanal.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {PUNTOS.map((p) => (
            <div key={p.titulo}>
              <h3 className="font-serif text-lg font-semibold">{p.titulo}</h3>
              <p className="mt-2 font-mono text-sm text-crema-claro/70">
                {p.texto}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex gap-12">
          <div>
            <p className="font-serif text-4xl font-semibold text-terracota">
              3–7
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-crema-claro/60">
              días de frescura perdida
            </p>
          </div>
          <div>
            <p className="font-serif text-4xl font-semibold text-terracota">
              0
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-crema-claro/60">
              datos de humedad, lote y condiciones
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the Cómo funciona section**

Create `src/components/landing/como-funciona.tsx`:

```tsx
const VARIABLES = ["Temperatura", "Humedad", "CO₂", "Luz"];

export function ComoFunciona() {
  return (
    <section className="px-6 py-20 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          La cápsula de cultivo controlada por IoT
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg italic text-tinta/80">
          Cada especie habita una cámara hermética que recrea su microclima
          exacto. El sistema lee sensores cada 30 segundos y ajusta
          temperatura, humedad, CO₂ y luz según el perfil activo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {VARIABLES.map((v) => (
            <span
              key={v}
              className="rounded-full border border-tinta/20 px-4 py-2 font-mono text-sm"
            >
              {v}
            </span>
          ))}
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-serif text-4xl font-semibold text-musgo">
              &lt; 24 h
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
              de cosechado a entrega
            </p>
          </div>
          <div>
            <p className="font-serif text-4xl font-semibold text-musgo">QR</p>
            <p className="font-mono text-xs uppercase tracking-widest text-tinta/60">
              historial por lote en la mesa
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-2xl font-mono text-sm text-tinta/70">
          Cada lote tiene un identificador único con el historial completo de
          cultivo — del sustrato al plato en menos de 24 horas.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/problema.tsx src/components/landing/como-funciona.tsx
git commit -m "land: agrega secciones de problema y cómo funciona"
```

---

### Task 4: Producto + CTA final/footer sections, assemble page.tsx

**Files:**
- Create: `src/components/landing/producto.tsx`
- Create: `src/components/landing/cta-footer.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `Logo`, `WhatsAppButton` (Task 1/2), `Hero`, `Problema`, `ComoFunicona` (Tasks 2/3).
- Produces: the fully assembled `/` page — this is the task where all five sections are wired together in final order.

- [ ] **Step 1: Write the Producto section**

Create `src/components/landing/producto.tsx`:

```tsx
const LINEAS = [
  {
    nombre: "Frescos gourmet",
    detalle: "Orellana, shiitake, melena de león, enoki, portobello.",
  },
  {
    nombre: "Secos y polvo",
    detalle: "Reishi, melena de león y shiitake en bolsa o frasco.",
  },
  {
    nombre: "Extractos dobles",
    detalle: "Reishi, melena, cordyceps y blend \"Inmunidad\".",
  },
  {
    nombre: "Servicios",
    detalle: "Kits de cultivo, licencia del sistema, consultoría y escuela de fungicultura.",
  },
];

export function Producto() {
  return (
    <section className="bg-crema-claro px-6 py-20 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          Cuatro líneas de producto, un mismo sistema
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LINEAS.map((l) => (
            <div
              key={l.nombre}
              className="rounded border border-tinta/10 bg-crema p-6"
            >
              <h3 className="font-serif text-lg font-semibold">{l.nombre}</h3>
              <p className="mt-2 font-mono text-sm text-tinta/70">
                {l.detalle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the CTA final + footer section**

Create `src/components/landing/cta-footer.tsx`:

```tsx
import { Logo } from "@/components/logo";
import { WhatsAppButton } from "@/components/whatsapp-button";

export function CtaFooter() {
  return (
    <footer className="bg-tinta px-6 py-20 text-crema-claro sm:px-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
          ¿Restaurante, tienda o querés probar Bichongos?
        </h2>
        <WhatsAppButton label="Escribinos por WhatsApp" />
        <Logo variant="mono-negative" />
        <div className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest text-crema-claro/60">
          <p>Guarne, Antioquia</p>
          <p>Con la asesoría técnica de Songo Sorhongo</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Assemble the full page**

Replace `src/app/page.tsx` with:

```tsx
import { Hero } from "@/components/landing/hero";
import { Problema } from "@/components/landing/problema";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { Producto } from "@/components/landing/producto";
import { CtaFooter } from "@/components/landing/cta-footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Problema />
        <ComoFunciona />
        <Producto />
      </main>
      <CtaFooter />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev -- --port 4000 &`, then:
```bash
curl -s http://localhost:4000 | grep -o 'Cuatro líneas de producto, un mismo sistema'
curl -s http://localhost:4000 | grep -o 'Con la asesoría técnica de Songo Sorhongo'
curl -s http://localhost:4000 | grep -c 'wa.me/573052779142'
```
Expected: first two greps each find their text once; the third prints `2` (hero CTA + footer CTA both link to WhatsApp). Kill the background dev server after.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/producto.tsx src/components/landing/cta-footer.tsx src/app/page.tsx
git commit -m "land: agrega sección de producto y CTA final, ensambla la landing completa"
```

---

### Task 5: SEO metadata, favicon, Open Graph

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/opengraph-image.tsx`
- Modify: `src/app/favicon.ico` (replaced, not hand-edited — see Step 2)

**Interfaces:**
- Consumes: `Logo`/color tokens conceptually (the OG image reimplements the icon symbol directly using Next's `ImageResponse` API, since that API does not render arbitrary React component trees from other files reliably — see Step 1 code).
- Produces: final `metadata` export consumed by Next's `<head>` injection (no other task depends on this).

- [ ] **Step 1: Real SEO metadata in `layout.tsx`**

In `src/app/layout.tsx`, replace the placeholder `metadata` export from Task 1 with:

```tsx
export const metadata: Metadata = {
  title: "Bichongos · Hongos premium cultivados con precisión IoT",
  description:
    "Hongos premium cultivados con precisión IoT, trazables del sustrato al plato. Laboratorio de cultivo en Guarne, Antioquia.",
  openGraph: {
    title: "Bichongos",
    description:
      "Hongos premium cultivados con precisión IoT, trazables del sustrato al plato.",
    locale: "es_CO",
    type: "website",
  },
};
```

Leave the rest of `layout.tsx` (font setup, `RootLayout`) exactly as Task 1 left it.

- [ ] **Step 2: Generate the favicon**

Run this Node script once to render the icon variant's geometry to a 64×64 PNG and write it as `src/app/favicon.ico`-compatible bytes is unnecessary complexity for a static icon — instead, replace the file directly with a hand-authored SVG-to-ICO is out of scope for a script; use the simplest correct path: delete the placeholder binary favicon and add an `icon.tsx` using Next's built-in file convention instead, which Next auto-serves without needing a real `.ico` file.

Delete `src/app/favicon.ico`, then create `src/app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(96% 0.02 75)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 54 54">
          <circle cx="27" cy="16" r="5" fill="oklch(20% 0.02 90)" />
          <circle cx="16" cy="26" r="5" fill="oklch(20% 0.02 90)" />
          <circle cx="38" cy="26" r="5" fill="oklch(20% 0.02 90)" />
          <circle cx="27" cy="36" r="5" fill="oklch(20% 0.02 90)" />
          <circle cx="27" cy="26" r="3" fill="oklch(56% 0.13 150)" />
        </svg>
      </div>
    ),
    size
  );
}
```

(Note: opacity is deliberately dropped here — per the brand handoff, the favicon simplifies to solid tones since decreasing opacity isn't visible at 16–32px.)

- [ ] **Step 3: Open Graph image**

Create `src/app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "oklch(20% 0.02 90)",
        }}
      >
        <svg width="90" height="90" viewBox="0 0 54 54">
          <circle cx="27" cy="16" r="5" fill="oklch(56% 0.13 150)" />
          <circle cx="16" cy="26" r="5" fill="oklch(56% 0.13 150)" opacity={0.75} />
          <circle cx="38" cy="26" r="5" fill="oklch(56% 0.13 150)" opacity={0.75} />
          <circle cx="27" cy="36" r="5" fill="oklch(56% 0.13 150)" opacity={0.5} />
          <circle cx="27" cy="26" r="3" fill="oklch(98% 0.008 75)" />
        </svg>
        <div style={{ fontSize: 64, color: "oklch(98% 0.008 75)", fontWeight: 600 }}>
          Bichongos
        </div>
      </div>
    ),
    size
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: exits 0; the route summary includes `/icon` and `/opengraph-image` as generated routes.

Run: `npm run dev -- --port 4000 &`, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/icon` and `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/opengraph-image`, then kill the background process.
Expected: both print `200`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/icon.tsx src/app/opengraph-image.tsx
git rm src/app/favicon.ico
git commit -m "land: agrega metadata SEO, favicon e imagen Open Graph"
```

---

### Task 6: Responsive and accessibility verification pass

**Files:**
- No new files expected. Fixes only if verification finds a real issue — modify whichever `src/components/landing/*.tsx` file the issue lives in.

**Interfaces:**
- Consumes: the fully assembled page from Task 4 and SEO additions from Task 5.
- Produces: nothing new — this is a verification/fix task, the final gate before the whole-branch review.

- [ ] **Step 1: Contrast check on the four brand colors**

Run this Node one-liner to compute WCAG contrast ratios (requires no new dependency — uses a minimal manual oklch→relative-luminance path via a small inline script):

```bash
node -e '
function oklchToSrgb(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const toLinear = (v) => Math.max(0, Math.min(1, v));
  return [toLinear(r), toLinear(g), toLinear(bl)];
}
function relLuminance([r, g, b]) {
  const f = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1/2.4) - 0.055);
  const [rs, gs, bs] = [r, g, b].map(f);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rs) + 0.7152 * lin(gs) + 0.0722 * lin(bs);
}
function contrast(L1, L2) {
  const [a, b] = [L1, L2].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const colors = {
  crema: [0.96, 0.02, 75],
  cremaClaro: [0.98, 0.008, 75],
  tinta: [0.20, 0.02, 90],
  musgo: [0.56, 0.13, 150],
  terracota: [0.56, 0.15, 40],
};
const lum = {};
for (const [name, [L, C, H]] of Object.entries(colors)) {
  lum[name] = relLuminance(oklchToSrgb(L, C, H));
}
const pairs = [
  ["tinta text on crema bg", "tinta", "crema"],
  ["cremaClaro text on tinta bg", "cremaClaro", "tinta"],
  ["terracota text on crema bg", "terracota", "crema"],
  ["musgo text on crema bg", "musgo", "crema"],
];
for (const [label, a, b] of pairs) {
  console.log(label, "=", contrast(lum[a], lum[b]).toFixed(2));
}
'
```

Expected and required: `tinta text on crema bg` and `cremaClaro text on tinta bg` (the two body-text combinations actually used in the components) must be ≥ 4.5 (WCAG AA for normal text). `terracota text on crema bg` and `musgo text on crema bg` are reported for awareness only — per the plan, these two colors are never used as body text on crema, only as accents/large numerals, so a lower ratio here is not a failure by itself, but note the numbers in your report.

If either of the two *required* pairs is below 4.5, stop and report — do not adjust the oklch values yourself without flagging it, since they're shared design tokens.

- [ ] **Step 2: Heading hierarchy check**

Run: `curl -s http://localhost:4000 | grep -o '<h[1-6]' | sort | uniq -c` (with `npm run dev -- --port 4000 &` running first, killed after).
Expected: exactly one `<h1` (the Hero), and the rest `<h2` (one per section: Problema, ComoFunciona, Producto, CtaFooter) — no `<h3` used as a page-level heading (the `<h3>`s inside Problema's three points and Producto's four cards are correctly nested under their section's `<h2>`, which this grep won't distinguish by nesting level, but confirms no stray `<h4>`+ exists and the h1/h2 counts are right: 1 and 4 respectively).

- [ ] **Step 3: aria-label and alt check**

Run: `curl -s http://localhost:4000 | grep -o 'aria-label="[^"]*"'` and `curl -s http://localhost:4000 | grep -o 'aria-label="Símbolo Bichongos"'` (dev server running, killed after).
Expected: `aria-label="Escribir a Bichongos por WhatsApp"` appears (once per `WhatsAppButton` instance — hero and footer, so twice total), and `aria-label="Símbolo Bichongos"` appears at least once (every `Logo` instance's inner `<svg role="img">` carries it).

- [ ] **Step 4: Responsive breakpoint spot-check**

This step requires an actual browser, not curl — use the `run` skill or `claude-in-chrome` tooling if available in your environment to load `http://localhost:4000` at 375px (mobile), 768px (tablet), and 1280px (desktop) widths and visually confirm: the Producto grid collapses to 1 column on mobile and reaches 4 columns by `lg:`, the Problema/ComoFunciona stat pairs don't overlap or clip text at 375px, and the Hero tagline doesn't overflow its container at any width. If no browser tool is available in your environment, report this specific check as ⚠️ not run rather than skipping it silently.

- [ ] **Step 5: Fix any findings, or confirm clean**

If Steps 1–4 found a real issue, fix it in the relevant `src/components/landing/*.tsx` file and re-run the specific check that failed. If everything passed, there is nothing to commit for this step — proceed to Step 6.

- [ ] **Step 6: Final build verification and commit (only if fixes were made)**

Run: `npm run build && npm run lint`
Expected: both exit 0.

If Step 5 made any code changes:
```bash
git add -A
git commit -m "land: corrige hallazgos de accesibilidad/responsive"
```
If Step 5 made no changes, skip this commit — there's nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** Task 1 = sistema de marca (colores, tipografía, logo). Task 2 = hero + CTA WhatsApp. Task 3 = problema + cómo funciona. Task 4 = producto + CTA final/footer + ensamblado. Task 5 = SEO/favicon/OG. Task 6 = responsive/accesibilidad. All 5 backlog historias (5–9) and every section from the spec's "Estructura de contenido" are covered.
- **Placeholder scan:** No TBD/TODO. Task 5 Step 2's favicon approach was rewritten mid-task-description to use Next's `icon.tsx` file convention instead of a hand-rolled ICO-writing script, because that's the actually-correct, simpler mechanism — this is a resolved decision, not a deferred placeholder.
- **Type consistency:** `Logo` accepts `variant: LogoVariant` consistently across Tasks 1 (definition), 2 (Hero uses `"horizontal"`), and 4 (CtaFooter uses `"mono-negative"`). `WhatsAppButton` accepts `label: string` consistently across Tasks 2 and 4. Both are imported via the `@/components/...` alias already configured by `create-next-app` in Épica 1 (`tsconfig.json`'s `paths`).
- **Songo Sorhongo attribution:** confirmed only one mention, in Task 4's `CtaFooter`, matching the spec's explicit decision.
