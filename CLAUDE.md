# Bichongos — Contexto del proyecto

## Qué es
Bichongos es la plataforma web del proyecto de cultivo de hongos. Vive en **Bichongos.store** y tiene dos partes:

1. **Landing pública**: presenta el proyecto (marketing, qué es, CTA de contacto).
2. **Panel de administración** (`/admin`): área autenticada donde las personas capacitadas administran el cultivo de hongos.

## Usuarios y roles
Autenticación con **Google OAuth**. La autorización es por rol:

- `admin`: gestión total — usuarios, roles, cultivo, contenidos.
- `profesor`: supervisa el cultivo, asigna tareas, sube contenidos de capacitación.
- `estudiante`: registra tareas diarias del cultivo, consume contenidos de capacitación.
- `pendiente`: estado inicial de todo usuario nuevo tras el primer login con Google. Un admin debe aprobarlo y asignarle rol. **Nadie con rol `pendiente` accede al panel** — ve una pantalla de "cuenta pendiente de aprobación".

Principio clave: **OAuth autentica, la autorización la controla la app** (aprobación manual por admin, no whitelist automática de cualquier cuenta Google).

## Stack
- **Frontend**: Next.js (App Router) + TypeScript, deploy en **Vercel**.
- **Backend / DB / Auth**: **Supabase** (Postgres, Supabase Auth con provider de Google, Row Level Security, Realtime para telemetría futura).
- **Dominio**: Bichongos.store apuntado a Vercel.
- Idioma de la UI: **español**.

## Modelo de datos inicial
- `profiles`: id (= auth.users.id), email, nombre, role (enum: pendiente | estudiante | profesor | admin), estado (activo/inactivo), created_at.
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

### Épica 1 — Fundaciones (Sprint 0)
1. Repo + proyecto Next.js con TypeScript y estructura base
2. Proyecto Supabase + variables de entorno
3. Deploy en Vercel + dominio Bichongos.store
4. Modelo de datos inicial: `profiles`, enum de roles

### Épica 2 — Landing pública
5. Landing: hero, qué es Bichongos, propuesta de valor, CTA
6. Sección "cómo funciona" / el cultivo
7. CTA de contacto/interés
8. SEO básico: metadata, Open Graph, favicon
9. Responsive y accesibilidad mínima

### Épica 3 — Autenticación y roles (núcleo del MVP)
10. Google OAuth en Supabase Auth (credenciales en Google Cloud Console)
11. Login/logout desde la landing
12. Trigger en DB: primer login → perfil con rol `pendiente`
13. Políticas RLS por rol en todas las tablas
14. Middleware de Next.js que protege `/admin` y redirige según rol
15. Pantalla de "cuenta pendiente de aprobación"

### Épica 4 — Panel de administración
16. Layout del admin: navegación, header con usuario y rol
17. Gestión de usuarios (solo admin): listar, aprobar, cambiar rol, desactivar
18. Perfil propio: editar nombre, ver rol
19. Auditoría básica (`activity_log`)

### Épica 5 — Gestión del cultivo
20. Modelo de datos del cultivo: lotes
21. CRUD de lotes (profesor/admin crean y editan; estudiantes registran)
22. Registro de tareas diarias: riego, humedad, temperatura, observaciones, fotos
23. Bitácora por lote: historial cronológico
24. Vistas por rol: estudiantes ven sus tareas; profesores supervisan y asignan

### Épica 6 — Capacitación (post-MVP)
25. Módulo de contenidos (suben profesores)
26. Seguimiento de progreso por estudiante
27. Checklist de competencias antes de acceso a operaciones reales

### Épica 7 — IoT / Telemetría (post-MVP)
28. Endpoint de telemetría para ESP32 (API key por dispositivo)
29. Tabla de lecturas vinculada a lotes
30. Dashboard en tiempo real (Supabase Realtime): humedad, temperatura, CO₂
31. Alertas por variables fuera de rango

### Épica 8 — Calidad y operación
32. Pruebas de flujos críticos (auth, permisos por rol)
33. Backups y política de datos en Supabase
34. Documentación de onboarding para usuarios capacitados

## Definición del MVP
Épicas 1–4 completas + historias 20–23. Resultado: landing en producción, login con Google, roles funcionando, registro básico del cultivo.

## Convenciones
- Commits en español, imperativo, prefijo por épica (ej. `auth: agrega middleware de roles`).
- Componentes de servidor por defecto; client components solo donde haya interactividad.
- Nunca exponer la `service_role` key en el cliente; RLS es la frontera de seguridad, no el frontend.
- Trabajar por épica: completar y verificar antes de pasar a la siguiente.
