# Harness de ingeniería — diseño

**Fecha:** 2026-07-23
**Fuente:** aplicación de lo relevante de `CICLO_DESARROLLO_SOFTWARE_UNIFICADO_2026.pdf` ("la regla de Jorge") al proyecto Bichongos.

## Problema

El proyecto no tiene verificación automática: no hay CI, no hay tests, y las reglas de "cuándo algo está terminado" viven solo en la cabeza de quien trabaja en cada sesión. Con desarrollo asistido por IA esto es más riesgoso, no menos: el código generado compila y se ve bien con más frecuencia de la que realmente es correcto (Parte X del documento fuente). Se necesita un andamiaje que obligue a verificar antes de aceptar cualquier cambio, humano o agente.

## Alcance

Construir la infraestructura de verificación y las reglas de proceso — no features de producto. Explícitamente fuera de alcance: ADRs separados (las specs de `docs/superpowers/specs/` ya cumplen ese rol para un equipo de 2 personas), y cualquier trabajo de Épica 4/5.

## Diseño

### 1. CI/CD — GitHub Actions

Nuevo `.github/workflows/ci.yml`, disparado en push a `main` y en cada PR contra `main`. Pasos, en orden (el documento es explícito: ningún nivel se salta):

1. `npm ci`
2. `npm run lint` — ESLint (ya existe como script)
3. `npm run typecheck` — nuevo script, `tsc --noEmit`
4. `npm run build` — build de Next.js; atrapa errores de RSC/tipos que a veces el dev server no muestra
5. `npm run test` — Vitest (unit + integración)
6. `npm run test:e2e` — Playwright, solo en el evento `pull_request` (necesita levantar el server con env de Supabase; no corre en push directo a main para no duplicar en cada merge)

Se configura `ci` como **required status check** en la protección de la rama `main`. Esto es un cambio de configuración del repo (branch protection vía `gh api` o la UI de GitHub) — se ejecuta con confirmación explícita del usuario en el momento de aplicarlo, no antes.

Vercel sigue desplegando preview/producción exactamente como hoy; no se toca esa integración.

### 2. Pirámide de pruebas — Vitest + Playwright

**Vitest** (unit/integración):
- `vitest.config.ts` en la raíz, entorno `jsdom` para componentes React, entorno `node` para server actions / lógica de Supabase.
- Convención de colocation: `Component.test.tsx` junto a `Component.tsx`, no una carpeta `__tests__/` separada — mantiene el archivo y su prueba visibles juntos.
- Cobertura inicial: lógica de `src/app/actions/auth.ts` y cualquier lógica de rol/gate que no dependa de un navegador real.

**Playwright** (E2E):
- Carpeta `e2e/` en la raíz.
- Cubre los tres flujos críticos que CLAUDE.md ya marca como núcleo del MVP:
  1. Login con Google → creación de perfil `pendiente` → pantalla de "cuenta pendiente".
  2. Gate por rol en `/admin`: rol no aprobado → redirect a `/pendiente`; rol aprobado → acceso.
  3. Logout.
- Como automatizar el consentimiento real de Google OAuth en CI no es viable (ni deseable), y como `getClaims()` verifica el JWT de sesión contra las claves del proyecto (JWKS) o vía `getUser()` — verificación que ocurre en el servidor de Next.js, no interceptable desde el navegador con Playwright — los tests usan una **instancia local real de Supabase** (Supabase CLI, vía Docker) en vez de fabricar cookies o JWTs a mano:
  1. CI levanta Supabase local (`supabase start`) y aplica las migraciones existentes de `supabase/migrations/`.
  2. Un script de setup crea usuarios de prueba vía la Admin API (`service_role`) con contraseña y `email_confirm: true`, con el rol de perfil que cada escenario necesita (`pendiente`, `admin`) — fijado con acceso directo a Postgres (`disable trigger` / `update` / `enable trigger`), reutilizando el mismo procedimiento de bootstrap ya documentado en CLAUDE.md.
  3. Se agrega una ruta inerte solo-para-tests (`src/app/e2e-login/page.tsx`) que usa el mismo `createClient()` del navegador que ya usa el resto de la app y llama `signInWithPassword()` — esto evita la incertidumbre del flujo PKCE/magic-link (que depende de un `code_verifier` que solo existe en un navegador real) y hace que el navegador guarde la sesión en cookies exactamente como con el login real de Google. La ruta solo funciona si `NEXT_PUBLIC_E2E_TEST_MODE=true`; sin esa env var (nunca seteada en Vercel/producción) devuelve `notFound()`.
  4. Cada test navega a `/e2e-login` con las credenciales del usuario de prueba, y desde ahí a `/admin` — ejercitando el gate real de middleware + `admin/layout.tsx`, código de producción sin dobles.
  - Esto es más lento de levantar en CI (~30-60s extra) pero no depende de reproducir formatos internos de `@supabase/ssr` ni de adivinar cómo se firma un JWT — usa exactamente el mismo camino de verificación que producción.
- No hay nada más que testear todavía (Épicas 4/5 pendientes). Cuando se implementen, sus specs deben incluir criterios de aceptación testeables desde el inicio (sección 3).

### 3. Reglas de proceso en CLAUDE.md

Nueva sección `## Ciclo de desarrollo (harness de ingeniería)` con:

- **Spec mínima por tamaño de cambio** (tabla): fix trivial → una frase de intención + 1 criterio; feature pequeña → historia + 2-4 criterios en lista; feature con estado/flujo → historia + escenarios Gherkin + restricciones; cambio estructural → lo anterior + plan de pasos y no-objetivos explícitos. Formaliza lo que `docs/superpowers/specs/` ya hace parcialmente.
- **Criterios de aceptación = regla de negocio, no detalle técnico**: un criterio se escribe en términos que el negocio (Juan/Daniela) podría leer y aprobar ("un cupón vigente reduce el total"), nunca en términos de implementación ("el campo se guarda en la tabla X"). Si al refactorizar hay que reescribir el criterio, no era un criterio de aceptación — era un chequeo técnico disfrazado.
- **Definition of Done**, checklist:
  - [ ] Todos los criterios de aceptación están cubiertos por test o verificación manual explícita.
  - [ ] El pipeline de CI pasa (lint, typecheck, build, tests).
  - [ ] Se ejecutó de verdad al menos una vez — no solo compiló.
  - [ ] Los fallos, si los hubo durante el desarrollo, se reportaron con su salida (nunca silenciados).
  - [ ] Decisiones y *gotchas* no obvios quedaron en memoria persistente.
  - [ ] La spec se actualizó si algo cambió durante la implementación respecto a lo planeado.
- **Regla de honestidad**: "hecho y verificado" se afirma solo cuando de verdad se verificó. Un test que falla se reporta con su salida; no hay estados intermedios que "parecen" funcionar.
- **Antipatrones a evitar** (priorizados para este proyecto): spec en el chat en vez de en archivo versionado, generar código sin especificar primero, aceptar un diff sin entenderlo línea por línea, confianza silenciosa (dar algo por bueno porque "compila"), big-bang build (cambios tan grandes que no se pueden revisar ni revertir con confianza).

No se documentan catálogos de principios (SOLID, GRASP, DRY/KISS/YAGNI, etc.) en CLAUDE.md: son atemporales y ya aplican implícitamente al trabajo; listarlos sería ruido para un proyecto de este tamaño sin aportar una regla accionable nueva.

## Fuera de alcance (explícito)

- ADRs separados — ya decidido que las specs existentes cumplen ese rol.
- Feature flags, canary/blue-green, SRE/SLOs, observabilidad con logs/métricas/trazas — son prácticas de la Parte VIII/IX del documento pensadas para sistemas en producción con tráfico real; prematuras para el estado actual del proyecto (aún en Épica 4 del MVP). Se reconsideran cuando haya usuarios reales operando el cultivo.
- Métricas DORA — requieren volumen de despliegues y un equipo más grande que 2 personas para ser una señal útil; no se instrumenta ahora.
