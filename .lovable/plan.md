

# Plan: Integrar Sonidos de Feedback

## Resumen

Copiar los 4 archivos de audio a `src/assets/sounds/`, crear un hook `useSoundEffects` para reproducirlos, e integrarlos en QuizView (correcta/incorrecta), LessonView (XP ganado) y el momento de completar módulo.

## Mapeo de sonidos

| Archivo | Momento | Ubicación |
|---|---|---|
| `Respuesta_correcta.wav` | Quiz: respuesta correcta | `QuizView.tsx` → `handleAnswer` cuando acierta |
| `respuesta_incorrecta.wav` | Quiz: respuesta incorrecta | `QuizView.tsx` → `handleAnswer` cuando falla |
| `gana_experiencia.wav` | Se gana XP (lección completada, quiz aprobado) | `LessonView.tsx` → `completeLesson` y `QuizView.tsx` → `saveResult` cuando passed |
| `completa_modulo.wav` | Se completa un módulo completo | `QuizView.tsx` → cuando el quiz aprobado es el último item del módulo |

## Cambios

### 1. Copiar archivos a `src/assets/sounds/`

Los 4 `.wav` se copian al proyecto para importarlos como módulos ES6.

### 2. Crear `src/hooks/useSoundEffects.ts`

Hook simple que pre-carga los 4 Audio objects y expone funciones: `playCorrect()`, `playWrong()`, `playXp()`, `playModuleComplete()`. Cada función crea/reproduce el audio con volumen controlado.

### 3. Integrar en `src/pages/QuizView.tsx`

- En `handleAnswer`: llamar `playCorrect()` si acierta, `playWrong()` si falla
- En `saveResult`: llamar `playXp()` cuando passed es true

### 4. Integrar en `src/pages/LessonView.tsx`

- En `completeLesson`: llamar `playXp()` al completar exitosamente

### 5. Sonido de módulo completado

En `QuizView.tsx`, cuando el quiz se aprueba y es el último del módulo, reproducir `playModuleComplete()`.

## Archivos

| Archivo | Acción |
|---|---|
| `src/assets/sounds/*.wav` | Copiar 4 archivos |
| `src/hooks/useSoundEffects.ts` | Crear hook |
| `src/pages/QuizView.tsx` | Integrar sonidos correcta/incorrecta/XP/módulo |
| `src/pages/LessonView.tsx` | Integrar sonido XP |

