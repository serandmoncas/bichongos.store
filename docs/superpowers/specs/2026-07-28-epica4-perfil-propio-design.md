# Épica 4 — Perfil propio (historia 18) — diseño

**Fecha:** 2026-07-28
**Épica:** 4 — Panel de administración (historia 18)

## Historia

**Como** usuario aprobado del panel (cualquier rol),
**quiero** ver mi email, rol y fecha de aprobación, y poder editar mi propio nombre,
**para** corregir mi nombre si quedó mal capturado desde Google y tener claridad de qué rol tengo.

## Alcance

Solo historia 18. Auditoría (`activity_log`, historia 19) queda para un spec separado — cierra formalmente la Épica 4 en el MVP.

## Criterios de aceptación

```
## Criterios de aceptación — Épica 4, historia 18

- [ ] CA1: cualquier usuario con rol aprobado (no pendiente) ve en /admin/perfil su email, su rol y la fecha en que se creó su perfil, todos de solo lectura.
- [ ] CA2: puede editar y guardar su propio nombre; el cambio persiste (se ve reflejado tras recargar).
- [ ] CA3: intentar guardar un nombre vacío o solo espacios se rechaza, sin llegar a escribir en la base de datos.
- [ ] CA4: el nav del panel muestra "Mi perfil" a todos los roles aprobados, y "Usuarios" solo a admin.
```

## Diseño

### 1. Nav condicional en el layout

Modificar `src/app/admin/layout.tsx`: agregar el link `Link href="/admin/perfil"` ("Mi perfil") junto al de "Usuarios" en el `<nav>`, visible siempre (para cualquier rol aprobado). Envolver el link a "Usuarios" en `{profile.role === "admin" && (...)}` — deja de mostrarse a `estudiante`/`operador`/`profesor` (que de todas formas caían en la pantalla de 404 amigable si le hacían click).

### 2. Página de perfil

Nueva ruta `src/app/admin/perfil/page.tsx` (Server Component). Sin gate adicional más allá del que ya aplica el layout (cualquier rol aprobado entra — a diferencia de `/admin/usuarios`, que es admin-only).

- Lee el propio perfil (`email`, `nombre`, `role`, `created_at`) con el cliente autenticado normal.
- Muestra `email`, `role` y `created_at` como texto de solo lectura.
- Renderiza `<NombreForm nombre={profile.nombre} />` para el campo editable.

### 3. Server Action

`src/app/admin/perfil/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnNombre(nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nombre: trimmed })
    .eq("id", userId);
  if (error) {
    throw new Error(`No se pudo actualizar el nombre: ${error.message}`);
  }

  revalidatePath("/admin/perfil");
  revalidatePath("/admin"); // el header también muestra el nombre
}
```

Nota: `userId` sale de la sesión del propio usuario (`getClaims().claims.sub`), nunca de un parámetro — estructuralmente no hay forma de que esta acción apunte al perfil de otra persona. No necesita `canEditRow` (esa función es para cuando *otro* usuario, un admin, edita filas ajenas).

### 4. Formulario

`src/app/admin/perfil/nombre-form.tsx` (client component, `useTransition`), con input controlado, botón "Guardar", y mensaje de error/éxito inline. Validación de "no vacío" también en el cliente (deshabilita el botón) para feedback inmediato, pero la Server Action repite la validación — el cliente nunca es la frontera real.

## Verificación

- **Unit (Vitest)**: no hay lógica pura nueva que aísle además de la validación de `nombre.trim()` — dado lo trivial que es, no amerita extraerla a una función separada solo para testear (YAGNI). Se cubre vía el E2E.
- **E2E (Playwright)**: un usuario de prueba (cualquier rol aprobado) entra a `/admin/perfil`, cambia su nombre, recarga, verifica que persiste. Un segundo caso intenta guardar un nombre vacío y verifica que no se guarda (el valor previo sigue mostrándose).

## Fuera de alcance

- Historia 19 (`activity_log`) — spec separado.
- Editar email o avatar — no pedido, el email viene de Google OAuth y no debería divergir.
