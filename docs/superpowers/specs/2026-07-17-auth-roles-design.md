# Autenticación y roles (Épica 3) — Spec de diseño

## Contexto

Épica 1 ya entregó la base de datos: tabla `profiles` (id, email, nombre, role, estado, created_at), enum `user_role` (`pendiente` | `estudiante` | `profesor` | `admin`), trigger `handle_new_user` que crea el perfil con `role = 'pendiente'` en el primer login, y RLS ya endurecida (incluye la corrección de auto-escalación de rol y de recursión infinita). Backlog historias 12 y 13 (trigger + RLS) están **ya completas** — Épica 3 se enfoca en las historias 10, 11, 14 y 15: login/logout con Google, protección de `/admin`, y la pantalla de cuenta pendiente.

## Investigación previa — por qué esto no sigue el patrón "de memoria"

Antes de diseñar, verifiqué contra la documentación viva de Supabase (no contra conocimiento de entrenamiento, que está desactualizado en varios puntos clave):

- **Next.js reemplazó `middleware.ts` por un archivo `proxy.ts`** (nueva convención de archivo de Next.js — ver `nextjs.org/docs/app/getting-started/proxy`). El proyecto corre Next.js 16.2.10, que ya usa esta convención.
- **`supabase.auth.getClaims()` es el método recomendado para proteger rutas en servidor**, no `getUser()` ni `getSession()`. `getClaims()` valida la firma del JWT localmente contra las llaves públicas del proyecto en cada llamada — es seguro de confiar. La documentación advierte explícitamente: *"Never trust `getSession()` inside server code such as Proxy."*
- El flujo OAuth con PKCE (necesario en Server-Side Auth) sigue siendo `signInWithOAuth({ provider: 'google', options: { redirectTo } })` desde el cliente, más una ruta de callback en `app/auth/callback/route.ts` que llama `exchangeCodeForSession(code)` — esto no cambió.

## Arquitectura

### 1. Proxy (reemplaza middleware.ts) — refresco de sesión + gate de autenticación

- `src/proxy.ts`: exporta `proxy(request)` llamando a `updateSession`, con un `matcher` que excluye assets estáticos (`_next/static`, `_next/image`, imágenes).
- `src/lib/supabase/proxy.ts`: función `updateSession` — crea un `createServerClient` con cookies de request/response, llama `supabase.auth.getClaims()`. Si no hay usuario **y** la ruta empieza con `/admin` o `/pendiente`, redirige a `/login`. El resto del sitio (landing pública, `/login`, `/auth/callback`) no requiere autenticación y no se toca.

### 2. Login

- `src/app/login/page.tsx` — Server Component. Si ya hay un usuario autenticado (`getClaims()`), redirige a `/admin` de una vez (evita mostrar el botón de login a quien ya inició sesión). Si no, renderiza el botón.
- `src/app/login/login-button.tsx` — Client Component (`"use client"`, la única interactividad real de este flujo): botón "Iniciar sesión con Google" que llama `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })` usando el cliente browser existente (`src/lib/supabase/client.ts`, ya creado en Épica 1).

### 3. Callback OAuth

- `src/app/auth/callback/route.ts` — Route Handler `GET`. Toma `code` de los query params, llama `exchangeCodeForSession(code)` con el cliente server. Si tiene éxito, redirige a `/admin`. Si falla, redirige a `/auth/auth-code-error`.
- `src/app/auth/auth-code-error/page.tsx` — página mínima de error ("No pudimos iniciar sesión, intentá de nuevo") con link a `/login`.

### 4. Panel `/admin` — gate por rol

- `src/app/admin/layout.tsx` — Server Component. Obtiene el usuario vía `getClaims()` (ya garantizado no-nulo acá, el proxy ya filtró usuarios no autenticados). Consulta `profiles` por `role` usando el id del usuario. Si `role === 'pendiente'`, redirige a `/pendiente`. Si no, renderiza `children` (sin layout visual todavía — nav/header con usuario y rol es Épica 4, historia 16).
- `src/app/admin/page.tsx` — placeholder mínimo ("Bienvenido a Bichongos — panel en construcción") para que `/admin` tenga contenido real y no un 404. Épica 4 lo reemplaza.

### 5. Pantalla de cuenta pendiente

- `src/app/pendiente/page.tsx` — Server Component, protegida por el proxy (requiere estar autenticado, no requiere rol específico). Copy: explica que la cuenta fue creada y está esperando aprobación de un admin, con el nombre/email del usuario logueado. Incluye un botón de **cerrar sesión**.
- `src/app/actions/auth.ts` — Server Action `signOut()` (`"use server"`): llama `supabase.auth.signOut()` y redirige a `/`. Invocada desde un `<form action={signOut}>` en `/pendiente` (sin necesidad de JS en el cliente, patrón estándar de Server Actions).

### 6. Integración con la landing

- Modificar `src/components/landing/cta-footer.tsx`: agregar un link de texto pequeño "Iniciar sesión" apuntando a `/login`, junto al resto del footer (ubicación, crédito de Songo Sorhongo). El resto de la landing permanece 100% estático — no se convierte en dinámica solo por esto.

## Configuración externa requerida (Google Cloud Console + Supabase Dashboard)

Esto lo hace el usuario con guía paso a paso al momento de ejecutar esa parte del plan (no automatizable sin `gcloud` CLI, que no está disponible en este entorno):

1. **Google Cloud Console** → Google Auth Platform → Clients → crear OAuth Client ID tipo **Web application**.
   - Authorized JavaScript origins: `https://bichongos.store` y `http://localhost:3000` (dev).
   - Authorized redirect URIs: la URL de callback del proyecto Supabase — `https://hmrapzermtnyavqjoesh.supabase.co/auth/v1/callback` (formato `https://<project-ref>.supabase.co/auth/v1/callback`).
2. **Supabase Dashboard** → Authentication → Providers → Google: pegar el Client ID y Client Secret generados, habilitar el provider.
3. **Supabase Dashboard** → Authentication → URL Configuration: Site URL = `https://bichongos.store`; Redirect URLs (allow list) debe incluir `https://bichongos.store/auth/callback` y `http://localhost:3000/auth/callback`.

## Decisiones explícitas (para revisar si cambian)

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` se mantiene** como nombre de variable de entorno, aunque la documentación actual de Supabase usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en sus ejemplos más nuevos. Renombrarla tocaría `.env.local`, `.env.example`, las variables ya configuradas en Vercel, y ambos archivos de cliente — un cambio disruptivo solo por alinear nombres, sin beneficio funcional (el *valor* que usamos ya es el publishable key moderno, decisión tomada en Épica 1). Se mantiene el nombre actual.
- **Logout vive en `/pendiente` en esta épica, no en la landing pública.** La historia 11 dice "login/logout desde la landing" — se interpreta como "el flujo de login es accesible desde el sitio público" (el link en el footer), no como que la landing muestre un estado de sesión personalizado. Un logout visible y persistente (header con usuario/rol) es la historia 16, Épica 4. Acá el logout solo necesita *existir* y ser alcanzable, lo cual cumple `/pendiente` (el único lugar de esta épica donde un usuario autenticado-pero-no-aprobado aterriza).
- **`/admin/page.tsx` es un placeholder**, no el panel real (eso es Épica 4). Esta épica solo entrega la infraestructura de autenticación y el gate por rol.
- **El proxy protege `/admin` y `/pendiente`** (ambos requieren sesión); el gate por *rol* (pendiente vs. aprobado) vive únicamente en `admin/layout.tsx`, no duplicado en `/pendiente`, para evitar lógica de redirección repetida/loops.
