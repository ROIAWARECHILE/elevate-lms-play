
## Plan: fijar el retorno al curso y eliminar el desfase de audio

### Diagnóstico real del proyecto

1. **El scroll no falla por ausencia de lógica, sino por dos problemas de flujo**
   - `CourseView` ya tiene `scrollIntoView`, pero hoy depende solo de `loading`.
   - En `QuizView`, al terminar el quiz se hace `setFinished(true)` y **`saveResult()` se lanza sin esperar**. Eso permite volver al curso antes de que `user_progress` y el progreso del módulo queden persistidos.
   - Además, el layout remonta el contenido por `location.pathname`, así que el scroll debe ejecutarse **después** de que el curso vuelva a renderizarse con el progreso nuevo, no solo con un timeout fijo.

2. **El audio sigue con desfase por arquitectura**
   - `useSoundEffects` se monta por página y destruye/recrea audios en cada navegación.
   - Aunque precarga, sigue usando `HTMLAudioElement` + `cloneNode`, que para SFX cortos suele introducir latencia.
   - La solución más práctica y sólida aquí es un **manager global con Web Audio API**, con buffers decodificados una sola vez y reproducción instantánea.

---

## Implementación propuesta

### 1) Hacer que el quiz guarde de verdad antes de permitir volver al curso
**Archivo:** `src/pages/QuizView.tsx`

- Agregar estado de persistencia, por ejemplo `isSavingResult`.
- En la última pregunta:
  - esperar `await saveResult(finalCorrect)` antes de dejar lista la salida al curso, o
  - mostrar la pantalla final pero con el botón “Volver al curso” deshabilitado hasta terminar de guardar.
- Si aprobó, asegurarse de que:
  - `user_progress`
  - `user_xp_log`
  - `updateStreakAndLevel`
  - chequeo de módulo completo
  - `refreshProfile()`
  terminen antes de considerar listo el regreso.

**Resultado:** al volver, `CourseView` ya verá el progreso correcto y no “desde el inicio”.

---

### 2) Pasar una intención explícita de “volver al nodo activo”
**Archivos:**  
- `src/pages/QuizView.tsx`
- `src/pages/LessonView.tsx`
- `src/pages/CourseView.tsx`

- Al volver desde lesson/quiz, navegar con estado de ruta o marcador persistente:
  - ejemplo: `state: { restoreActiveNode: true, restoredAt: Date.now() }`
- En `CourseView`, leer esa señal con `useLocation()` y ejecutar restauración solo cuando venga de una actividad.
- Mantener una clave por curso en `sessionStorage` como respaldo para cubrir refresh/remount.

**Resultado:** el curso sabe que no debe abrir “normal”, sino reenfocar el nodo actual del usuario.

---

### 3) Reemplazar el auto-scroll frágil por restauración robusta
**Archivo:** `src/pages/CourseView.tsx`

- Cambiar el efecto actual basado solo en `[loading]` por uno que dependa de:
  - `loading`
  - `activeIndex`
  - señal de retorno (`location.state` o `sessionStorage`)
- Ejecutar el scroll cuando:
  - los módulos y progresos ya estén cargados
  - el nodo activo exista en DOM
  - la transición del layout ya haya pintado
- En vez de un único `setTimeout(400)`, usar:
  - `requestAnimationFrame`
  - uno o varios reintentos cortos hasta encontrar el nodo
  - `block: "center"` y opcionalmente `inline: "nearest"`

**Importante:** el `ref` al nodo activo se mantiene, pero la restauración se vuelve determinística y no dependiente de timing accidental.

---

### 4) Sustituir el sistema de sonidos por un motor global de SFX
**Archivo principal:** `src/hooks/useSoundEffects.ts`  
**Posible apoyo:** nuevo helper en `src/lib/` o `src/hooks/`

- Convertir `useSoundEffects` en una capa fina sobre un **singleton** de audio.
- Usar **Web Audio API**:
  - `AudioContext`
  - `fetch` de `/public/sounds/*.wav`
  - `decodeAudioData`
  - cacheo en `AudioBuffer`
- Reproducir con `AudioBufferSourceNode` para disparo inmediato.
- Hacer warm-up/resume del contexto tras la primera interacción del usuario para evitar bloqueo del navegador.
- Mantener volúmenes por tipo de evento igual que ahora.

**Resultado:** los sonidos se cargan una vez en toda la app y disparan casi sin latencia aunque cambies de página.

---

### 5) Mantener compatibilidad con la UX actual
**Archivos afectados:**  
- `src/pages/QuizView.tsx`
- `src/pages/LessonView.tsx`
- `src/hooks/useSoundEffects.ts`

- Conservar los mismos puntos de disparo:
  - correcta
  - incorrecta
  - XP
  - módulo completado
- Solo cambia la infraestructura:
  - persistencia antes de volver
  - reproducción instantánea y global
- Revisar que el sonido de módulo completo no compita mal con el de XP; si hace falta, encadenarlo con un delay corto controlado tras guardado exitoso.

---

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/pages/QuizView.tsx` | Esperar persistencia, bloquear regreso prematuro, enviar señal de restauración al curso |
| `src/pages/LessonView.tsx` | Enviar señal de restauración al volver al curso |
| `src/pages/CourseView.tsx` | Leer estado de retorno y restaurar scroll al nodo activo con reintentos robustos |
| `src/hooks/useSoundEffects.ts` | Reemplazar audio por página por manager global basado en Web Audio |
| `public/sounds/*` | Se reutilizan tal como están; no hace falta moverlos |

## Nota técnica clave

La causa principal del “vuelvo y aparece desde arriba/inicio” no es solo el scroll: es también una **carrera entre navegación y guardado del quiz**. Primero hay que garantizar persistencia; después, restaurar el foco del nodo activo con una señal explícita y un scroll sincronizado con el render.
