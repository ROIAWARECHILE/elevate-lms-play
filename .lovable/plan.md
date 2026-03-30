

# Plan: Scroll automático al nodo activo + Optimizar sonidos

## Problemas

1. **Scroll se reinicia**: Al volver de una lección/quiz al CourseView, el componente se remonta desde cero y el scroll queda arriba. No hay lógica para scrollear al nodo activo.

2. **Desfase en sonidos**: Cada llamada a `playCorrect()`/`playWrong()` crea un `new Audio()` desde cero, descargando el archivo `.wav` cada vez. Esto causa latencia notable. Los archivos `.wav` además son pesados comparados con `.mp3`.

## Solución

### 1. Auto-scroll al nodo activo — `src/pages/CourseView.tsx`

- Agregar un `ref` al nodo activo (el que tiene `isActive = true`)
- Usar `useEffect` con `scrollIntoView({ behavior: 'smooth', block: 'center' })` después de que el componente se monta y los datos cargan
- Esto hace que al volver al curso, la vista se centre automáticamente en donde el usuario quedó

### 2. Pre-cargar audios al montar — `src/hooks/useSoundEffects.ts`

- Usar `useRef` para almacenar los 4 objetos `Audio` pre-cargados al montar el hook (no crear uno nuevo cada vez)
- Llamar `audio.load()` en el montaje para que el navegador descargue y cachee el archivo
- Al reproducir, clonar el audio (`audio.cloneNode()`) o resetear `currentTime = 0` para reproducción instantánea sin delay
- Esto elimina el desfase porque el archivo ya está en memoria

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/CourseView.tsx` | Agregar ref al nodo activo + useEffect scrollIntoView |
| `src/hooks/useSoundEffects.ts` | Pre-cargar Audio objects con useRef + reutilizar instancias |

