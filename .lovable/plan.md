

# Plan: Corregir Sistema de Rachas y Problemas Detectados

## Problemas identificados

### 1. Rachas no se reinician visualmente
La racha solo se recalcula cuando el usuario **completa una lección o quiz** (dentro de `updateStreakAndLevel`). Si un usuario no entra por 3 días y abre el dashboard, sigue viendo su racha vieja (ej. "5 días") hasta que complete algo. No hay lógica que valide la racha al cargar la app.

### 2. Bug de zona horaria en rachas
`new Date().toISOString().split("T")[0]` usa UTC, no la hora local del usuario. Un usuario en UTC-6 que completa algo a las 8pm local verá la fecha como el día siguiente en UTC, rompiendo la comparación de rachas.

### 3. Sonidos no reproducen
Los archivos `.wav` fueron subidos como uploads pero posiblemente escritos como archivos vacíos o con encoding incorrecto. Necesitan copiarse como binarios reales desde los uploads. Además, se deben mover a `/public/sounds/` para que Vite los sirva como archivos estáticos (más confiable que importarlos como módulos ES).

## Cambios

### 1. Validar racha al cargar perfil — `src/hooks/useAuth.tsx`

Agregar función `validateStreak` que al cargar el perfil verifique si `last_activity_date` es hoy o ayer. Si no, resetear `current_streak` a 0 en el perfil (DB + estado local). Esto se ejecuta en `fetchProfile`.

### 2. Corregir zona horaria — `src/lib/gamification.ts`

Reemplazar `new Date().toISOString().split("T")[0]` por una función que use la fecha local del usuario:
```typescript
const getLocalDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
```
Aplicar lo mismo para la comparación con "ayer".

### 3. Arreglar sonidos — mover a `/public/sounds/`

- Copiar los 4 archivos `.wav` desde los uploads del usuario a `public/sounds/`
- Actualizar `useSoundEffects.ts` para usar rutas estáticas (`/sounds/respuesta_correcta.wav`) en vez de imports ES
- Eliminar `src/assets/sounds/`

### 4. Aplicar misma corrección de fecha local en `useAuth.tsx`

La validación de streak en `fetchProfile` también debe usar fecha local.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/gamification.ts` | Usar fecha local en vez de UTC |
| `src/hooks/useAuth.tsx` | Agregar validación de racha al cargar perfil |
| `src/hooks/useSoundEffects.ts` | Cambiar imports a rutas `/public/sounds/` |
| `public/sounds/*.wav` | Copiar archivos de audio correctamente |
| `src/assets/sounds/` | Eliminar directorio |

