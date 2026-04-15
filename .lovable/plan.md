

# Plan: Corregir Sistema de Autenticación y Registro

## Problemas identificados

### 1. Race condition entre loading y fetchProfile
En `useAuth.tsx`, `setLoading(false)` se ejecuta **antes** de que `fetchProfile` termine. Esto causa:
- Usuario inicia sesion → `loading = false`, `user = {...}`, `profile = null`
- `AppLayout` ve `profile` sin `company_id` (porque es null) → redirige a `/auth?choose=true`
- El usuario queda atrapado en la pantalla de eleccion de rol aunque ya tiene empresa

### 2. Auth.tsx redirige prematuramente
El `onAuthStateChange` con evento `SIGNED_IN` navega a `/app` sin esperar a que el perfil cargue. El perfil puede no estar listo cuando `AppLayout` lo evalua.

### 3. Registro sin confirmacion de email
Tras `signUp`, se muestra la pantalla de eleccion de rol. Pero si el email no esta confirmado, el usuario no puede autenticarse completamente, y las paginas `/onboarding` y `/join` que dependen de `user` no funcionan.

### 4. Error de build en EditCourse.tsx
Linea 187: `{ [field]: value }` genera un tipo dinamico incompatible con el tipado estricto de Supabase.

## Solucion

### Archivo: `src/hooks/useAuth.tsx`
- **No llamar `setLoading(false)` hasta que `fetchProfile` haya terminado**
- Cambiar el flujo: `getSession` → si hay sesion, `await fetchProfile(...)` → entonces `setLoading(false)`
- En `onAuthStateChange`, solo actualizar user/session inmediatamente, pero esperar a que fetchProfile termine antes de marcar loading como false (solo si es el primer load)
- Usar un ref para saber si ya se hizo la carga inicial y evitar doble-set de loading

### Archivo: `src/pages/Auth.tsx`
- Eliminar la navegacion directa desde `onAuthStateChange`. En su lugar, usar un `useEffect` que observe `user`, `profile` y `authLoading` para decidir cuando redirigir
- Solo redirigir cuando `authLoading === false && user && profile?.company_id`
- Si `authLoading === false && user && profile && !profile.company_id` → mostrar role choice
- Esto elimina la race condition porque espera al perfil completo

### Archivo: `src/pages/admin/EditCourse.tsx`
- Linea 187: castear el objeto de update para satisfacer el tipado estricto
- Cambiar `{ [field]: value }` a un objeto tipado explicitamente

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/useAuth.tsx` | No marcar `loading=false` hasta que fetchProfile termine |
| `src/pages/Auth.tsx` | Reemplazar navegacion por onAuthStateChange con useEffect basado en profile |
| `src/pages/admin/EditCourse.tsx` | Fix tipo en linea 187 |

