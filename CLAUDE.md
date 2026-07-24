# Bichongos — Contexto del proyecto

## Qué es
Bichongos es un proyecto de **Juan Ballesteros** y **Daniela Arango**, con la asesoría técnica de **Songo Sorhongo** ("Fungicultura para la vida" — laboratorio de cultivo de hongos gourmet/funcionales con trazabilidad IoT en Guarne, Antioquia, dirigido por María Isabel Álvarez Vera y Sergio Monsalve). Songo Sorhongo aporta el sistema de cultivo IoT (cápsulas con sensores de temperatura/humedad/CO₂/luz) y la trazabilidad por lote vía QR — el problema que resuelve: el hongo disponible en el mercado (importado o artesanal local) se cultiva "a ciegas", sin datos ni trazabilidad.

Este repo es la plataforma web del proyecto. Vive en **Bichongos.store** y tiene dos partes:

1. **Landing pública**: presenta el proyecto (marketing, qué es, CTA de contacto).
2. **Panel de administración** (`/admin`): área autenticada donde las personas capacitadas administran el cultivo de hongos.

Detalle de negocio, identidad de marca y copy de referencia para la landing: `docs/superpowers/specs/2026-07-16-landing-publica-design.md`.

## Usuarios y roles
Autenticación con **Google OAuth**. La autorización es por rol:

- `admin`: gestión total — usuarios, roles, cultivo, contenidos.
- `profesor`: supervisa el cultivo, asigna tareas, sube contenidos de capacitación.
- `estudiante`: registra tareas diarias del cultivo, consume contenidos de capacitación.
- `operador`: registra tareas diarias del cultivo y además crea/edita lotes (más permisos que `estudiante`); no asigna tareas ni supervisa — eso sigue siendo de `profesor`/`admin`.
- `pendiente`: estado inicial de todo usuario nuevo tras el primer login con Google. Un admin debe aprobarlo y asignarle rol. **Nadie con rol `pendiente` accede al panel** — ve una pantalla de "cuenta pendiente de aprobación".

Principio clave: **OAuth autentica, la autorización la controla la app** (aprobación manual por admin, no whitelist automática de cualquier cuenta Google).

**Google OAuth está configurado y verificado end-to-end** (Épica 3, 2026-07-22): credenciales reales conectadas en Supabase Auth → Providers → Google. Flujo probado completo: login con Google → creación automática de perfil `pendiente` → gate por rol funcionando en ambos sentidos (`pendiente` → `/pendiente`, rol aprobado → `/admin`) → logout. `serandmoncas@gmail.com` (Sergio Monsalve) es el primer admin real, promovido vía el procedimiento de bootstrap de abajo.

## Stack
- **Frontend**: Next.js (App Router) + TypeScript, deploy en **Vercel**.
- **Backend / DB / Auth**: **Supabase** (Postgres, Supabase Auth con provider de Google, Row Level Security, Realtime para telemetría futura).
- **Dominio**: Bichongos.store apuntado a Vercel.
- Idioma de la UI: **español**.

## Modelo de datos inicial
- `profiles`: id (= auth.users.id), email, nombre, role (enum: pendiente | estudiante | operador | profesor | admin), estado (activo/inactivo), created_at.
  - Trigger: al primer login se crea el perfil con rol `pendiente`.
- `lotes`: id, nombre, especie, sustrato, fecha_inicio, estado, notas.
- `registros`: id, lote_id, user_id, tipo (riego, humedad, temperatura, observación), valor, foto_url, created_at. Bitácora cronológica por lote.
- `activity_log`: auditoría básica de acciones (quién, qué, cuándo).
- (Post-MVP) `dispositivos` y `lecturas` para telemetría del ESP32.

**RLS en todas las tablas.** Reglas generales:
- `pendiente`: sin acceso a nada.
- `estudiante`: lee lotes, crea registros propios, lee contenidos.
- `profesor`: todo lo del estudiante + CRUD de lotes, asignación de tareas, CRUD de contenidos.
- `admin`: todo + gestión de usuarios y roles.

## Backlog priorizado

### Épica 1 — Fundaciones (Sprint 0) ✅
1. ✅ Repo + proyecto Next.js con TypeScript y estructura base
2. ✅ Proyecto Supabase + variables de entorno
3. ✅ Deploy en Vercel + dominio Bichongos.store
4. ✅ Modelo de datos inicial: `profiles`, enum de roles

### Épica 2 — Landing pública ✅
5. ✅ Landing: hero, qué es Bichongos, propuesta de valor, CTA
6. ✅ Sección "cómo funciona" / el cultivo
7. ✅ CTA de contacto/interés
8. ✅ SEO básico: metadata, Open Graph, favicon
9. ✅ Responsive y accesibilidad mínima

### Épica 3 — Autenticación y roles (núcleo del MVP) ✅
10. ✅ Google OAuth en Supabase Auth (credenciales en Google Cloud Console)
11. ✅ Login/logout desde la landing
12. ✅ Trigger en DB: primer login → perfil con rol `pendiente`
13. ✅ Políticas RLS por rol en todas las tablas
14. ✅ Middleware de Next.js que protege `/admin` y redirige según rol
15. ✅ Pantalla de "cuenta pendiente de aprobación"

### Épica 4 — Panel de administración 🚧 (siguiente prioritaria)
**Antes de tocar código: decidir el rol "operador"** para el personal que va a operar el cultivo día a día (Lore y Fredy) — hoy el enum de roles no lo modela explícitamente; hay que definir si mapea al rol `estudiante` existente o si se necesita un rol nuevo, y qué debe poder ver/hacer exactamente. Es una decisión de producto (brainstorming), no inferible del código.
16. ⏳ Layout del admin: navegación, header con usuario y rol
17. ⏳ Gestión de usuarios (solo admin): listar, aprobar, cambiar rol, desactivar
18. ⏳ Perfil propio: editar nombre, ver rol
19. ⏳ Auditoría básica (`activity_log`)

### Épica 5 — Gestión del cultivo
20. ⏳ Modelo de datos del cultivo: lotes
21. ⏳ CRUD de lotes (profesor/admin crean y editan; estudiantes registran)
22. ⏳ Registro de tareas diarias: riego, humedad, temperatura, observaciones, fotos
23. ⏳ Bitácora por lote: historial cronológico
24. ⏳ Vistas por rol: estudiantes ven sus tareas; profesores supervisan y asignan

### Épica 6 — Capacitación (post-MVP)
Reutilizar contenido existente: los SOPs y fichas de especies del repo `Bichongos` (I+D de Sergio Monsalve, `github.com/serandmoncas/Bichongos`) son candidatos directos en vez de escribir contenido de cero.
25. ⏳ Módulo de contenidos (suben profesores)
26. ⏳ Seguimiento de progreso por estudiante
27. ⏳ Checklist de competencias antes de acceso a operaciones reales

### Épica 7 — IoT / Telemetría (post-MVP)
Solo tiene sentido cuando Juan/Daniela tengan su propia cápsula física funcionando.
28. ⏳ Endpoint de telemetría para ESP32 (API key por dispositivo)
29. ⏳ Tabla de lecturas vinculada a lotes
30. ⏳ Dashboard en tiempo real (Supabase Realtime): humedad, temperatura, CO₂
31. ⏳ Alertas por variables fuera de rango

### Épica 8 — Calidad y operación
32. ✅ Pruebas de flujos críticos (auth, permisos por rol) — adelantada fuera de orden como parte del harness de ingeniería (2026-07-24): CI en GitHub Actions (lint/typecheck/build/unit siempre, E2E con Supabase local en cada PR), Vitest para unit, Playwright para E2E del gate por rol. Ver `docs/superpowers/specs/2026-07-23-harness-ingenieria-design.md`.
33. ⏳ Backups y política de datos en Supabase
34. ⏳ Documentación de onboarding para usuarios capacitados

## Definición del MVP
Épicas 1–4 completas + historias 20–23. Resultado: landing en producción, login con Google, roles funcionando, registro básico del cultivo.

## Convenciones
- Commits en español, imperativo, prefijo por épica (ej. `auth: agrega middleware de roles`).
- Componentes de servidor por defecto; client components solo donde haya interactividad.
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend.
- Trabajar por épica: completar y verificar antes de pasar a la siguiente.

## Ciclo de desarrollo (harness de ingeniería)

Ver `docs/superpowers/specs/2026-07-23-harness-ingenieria-design.md` para el diseño completo. Resumen operativo:

**Spec mínima según el tamaño del cambio:**
- Fix trivial / typo: una frase de intención + 1 criterio.
- Feature pequeña: historia de usuario + 2-4 criterios en lista.
- Feature con estado/flujo: historia + escenarios Gherkin + restricciones.
- Cambio estructural: lo anterior + plan de pasos + no-objetivos explícitos.

**Un criterio de aceptación es una regla de negocio, no un detalle técnico.** Se escribe en términos que Juan o Daniela podrían leer y aprobar ("un cupón vigente reduce el total"), nunca en términos de implementación ("el campo se guarda en la tabla X"). Si al refactorizar hay que reescribir el criterio, no era un criterio de aceptación — era un chequeo técnico disfrazado.

**Definition of Done** — nada se da por terminado sin:
- [ ] Todos los criterios de aceptación cubiertos por test o verificación manual explícita.
- [ ] El pipeline de CI en verde (lint, typecheck, build, tests).
- [ ] Ejecución real al menos una vez — no solo "compila".
- [ ] Fallos, si los hubo durante el desarrollo, reportados con su salida (nunca silenciados).
- [ ] Decisiones y *gotchas* no obvios registrados en memoria persistente.
- [ ] La spec actualizada si algo cambió durante la implementación respecto a lo planeado.

**Regla de honestidad:** "hecho y verificado" se afirma solo cuando de verdad se verificó. Un test que falla se reporta con su salida; no hay estados intermedios que "parecen" funcionar.

**Antipatrones a evitar:** spec en el chat en vez de en archivo versionado, generar código sin especificar primero, aceptar un diff sin entenderlo línea por línea, confianza silenciosa (dar algo por bueno porque "compila"), big-bang build (cambios tan grandes que no se pueden revisar ni revertir con confianza).

## Bootstrap del primer admin en producción
El trigger `enforce_role_estado_immutable` (migración 2) bloquea cambios al campo `role` de cualquier perfil a menos que el usuario ya tenga `role = 'admin'`. Esto es correcto por seguridad, pero implica que **no existe un path normal para crear la cuenta admin inicial** (nadie nace como admin). 

Para promover el primer admin en producción, ejecutar en el SQL editor de Supabase (con permisos de service role):
```sql
alter table public.profiles disable trigger enforce_role_estado_immutable;
update public.profiles set role = 'admin' where id = '<user-id>';
alter table public.profiles enable trigger enforce_role_estado_immutable;
```

**Advertencia:** este procedimiento debe ejecutarse únicamente a través del SQL editor / service role de la BD, nunca expuesto en la aplicación.
