
# Plan: Reparar definitivamente login y registro

## Diagnóstico real (verificado contra la BD)

Consulté `pg_proc` y `pg_trigger` directamente. Lo que está pasando es distinto a lo que asumimos antes:

### 1. La migración anterior NUNCA se aplicó a la base de datos
- `ensure_user_profile` **no existe** en Postgres (solo `create_company_for_user`, `join_company_by_code`, `handle_new_user`).
- Pero `useAuth.tsx` ya intenta llamar `supabase.rpc("ensure_user_profile", ...)` como fallback defensivo.
- Resultado: cada login hace 4 reintentos × 2 queries paralelas + 1 RPC inexistente que falla → la pantalla queda atascada en loading o redirige mal.

### 2. Confirmación de email está activa y bloqueando usuarios reales
Verifiqué `auth.users`: los últimos 3 registros tienen `email_confirmed_at = NULL`:
- `3292691@clases.edu.sv`
- `yerko.ar.ar@gmail.com`
- `axeldelarosa3010@gmail.com`

Estos usuarios **nunca pueden iniciar sesión** porque Supabase rechaza con "Email not confirmed". El error que reporta el usuario probablemente es este, no un bug del código.

### 3. El trigger `handle_new_user` SÍ funciona
Todos los profiles existen y tienen rol `collaborator` por defecto. El trigger no es el problema.

### 4. `Auth.tsx` no maneja `user && profile === null`
Si por alguna razón el profile no carga (timeout, error de red), la pantalla queda en blanco: ni redirige, ni muestra `RoleChoiceScreen`, ni vuelve al login.

## Solución

### A. Aplicar la migración pendiente (CRÍTICO)
Re-crear la migración con un timestamp nuevo para que se ejecute. Contenido:
- `ensure_user_profile(text)` SECURITY DEFINER → idempotente, crea profile + rol collaborator si faltan.
- `create_company_for_user` y `join_company_by_code` con `PERFORM ensure_user_profile('')` antes de operar, slug único auto-generado, normalización de código.
- `handle_new_user` idempotente con `ON CONFLICT`.
- `GRANT EXECUTE ... TO authenticated` en `ensure_user_profile`.

### B. Decidir qué hacer con la confirmación de email
Dos opciones a discutir con el usuario:

| Opción | Trade-off |
|---|---|
| Desactivar "Confirm email" en Supabase Auth | UX inmediata, sesión activa al instante tras signUp. Riesgo: emails falsos. Recomendado para apps internas/B2B con código de invitación. |
| Mantener confirmación + mejorar UX | Más seguro, pero el usuario debe ir al correo. Hoy ya mostramos `EmailConfirmationScreen`, pero el `signInWithPassword` posterior fallará silenciosamente si no confirmó. Hay que detectar el error específico y mostrar mensaje claro. |

Para este proyecto (LMS corporativo con códigos de invitación), recomiendo **desactivar la confirmación**. Las cuentas se validan implícitamente al unirse a una empresa.

### C. Endurecer `useAuth.tsx`
- Si `loadProfile` agota reintentos sin profile, devolver `profile: null` pero **igual marcar `loading=false`** (ya lo hace, está bien).
- Reducir reintentos de 4 a 2 (250ms, 700ms) — el trigger es síncrono, no necesita más.
- No llamar `ensure_user_profile` si la primera consulta YA devolvió profile (ya está bien).

### D. Endurecer `Auth.tsx`
Cubrir el caso `user && !profile && !authLoading`:
- Mostrar mensaje "No pudimos cargar tu perfil" + botón "Reintentar" (llama `refreshProfile()`) + botón "Cerrar sesión".
- Evita pantalla en blanco si la BD está temporalmente lenta.

### E. Mejorar mensajes de error en login
En `handleSubmit` del login, detectar errores de Supabase comunes y traducirlos:
- `"Email not confirmed"` → "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
- `"Invalid login credentials"` → "Correo o contraseña incorrectos."
- Otros → mensaje genérico actual.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260425170000_apply_auth_hardening.sql` | **CREAR** — re-aplicar contenido de la migración pendiente con nuevo timestamp |
| `src/hooks/useAuth.tsx` | Reducir reintentos de 4 a 2 en `PROFILE_RETRY_DELAYS` |
| `src/pages/Auth.tsx` | Agregar fallback UI para `user && !profile`; traducir errores de Supabase |
| Supabase Dashboard (acción manual del usuario) | Desactivar "Confirm email" en Authentication → Providers → Email, si elige opción A |

## Pregunta para el usuario antes de implementar

Necesito una decisión: ¿quieres desactivar la confirmación de email (recomendado para LMS B2B) o mantenerla con mejor UX? Si la mantienes, los usuarios actuales sin confirmar (`3292691@clases.edu.sv`, `yerko.ar.ar@gmail.com`, `axeldelarosa3010@gmail.com`) seguirán bloqueados hasta que confirmen su correo.
