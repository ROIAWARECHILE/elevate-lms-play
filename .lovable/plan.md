

# Plan: Expresiones de Kibbo en Contextos Clave

## Analisis de la Imagen

La imagen contiene 9 expresiones del zorro Kibbo, cada una con una emocion distinta:

1. **Celebrando** (confetti, brazos arriba) — victoria/logro
2. **Pulgar arriba** (sentado, aprobando) — buen trabajo/confirmacion
3. **Pensando** (signo de interrogacion) — duda/quiz
4. **Sorprendido** (sparkles, boca abierta) — level up/nuevo logro
5. **Triste** (cabizbajo) — quiz reprobado/error
6. **Determinado** (fuego, puños) — streak/motivacion
7. **Durmiendo** (zzz, nube) — inactividad/sin streak
8. **Bailando** (musica, movimiento) — celebracion casual/leccion completada
9. **Emocionado** (manos juntas, signos exclamacion) — bienvenida/onboarding

## Mapeo de Expresiones a Contextos

| Expresion | Donde se usa |
|---|---|
| Celebrando | Quiz aprobado (resultado), confetti celebration |
| Pulgar arriba | Leccion completada, Dashboard "continuar aprendiendo" |
| Pensando | QuizView durante las preguntas, empty states |
| Sorprendido | LevelUpModal al subir de nivel |
| Triste | Quiz reprobado, 404 NotFound |
| Determinado | Streak activo en Dashboard, sidebar streak counter |
| Durmiendo | Streak perdido (streak = 0), Dashboard sin actividad |
| Bailando | XpAnimation, onboarding completado |
| Emocionado | WalkthroughOverlay, Landing hero, Auth page |

## Implementacion

### 1. Crear assets individuales
Copiar la imagen de expresiones y usar la API de generacion de imagen para extraer cada expresion individualmente con fondo transparente. Guardarlas como:
- `src/assets/kibbo-celebrating.png`
- `src/assets/kibbo-thumbsup.png`
- `src/assets/kibbo-thinking.png`
- `src/assets/kibbo-surprised.png`
- `src/assets/kibbo-sad.png`
- `src/assets/kibbo-determined.png`
- `src/assets/kibbo-sleeping.png`
- `src/assets/kibbo-dancing.png`
- `src/assets/kibbo-excited.png`

### 2. Crear componente `KibboExpression`
Nuevo componente que acepta una prop `expression` y renderiza la imagen correspondiente con animacion framer-motion contextual:
- `celebrating`: bounce-in + float
- `thumbsup`: scale spring
- `thinking`: sutil head-tilt (rotate oscillation)
- `surprised`: scale pop + sparkle
- `sad`: slow fade-in + slight droop
- `determined`: pulse-glow ring
- `sleeping`: gentle float (breathing)
- `dancing`: wiggle lateral
- `excited`: bounce rapido

### 3. Integrar en componentes existentes

| Archivo | Cambio |
|---|---|
| `src/components/LevelUpModal.tsx` | Reemplazar icono Trophy con Kibbo sorprendido |
| `src/components/XpAnimation.tsx` | Agregar Kibbo bailando junto al "+XP" |
| `src/components/WalkthroughOverlay.tsx` | Usar Kibbo emocionado en vez del KibboMascot generico |
| `src/pages/QuizView.tsx` | Kibbo pensando durante quiz, celebrando si aprueba, triste si reprueba |
| `src/pages/LessonView.tsx` | Kibbo pulgar arriba al completar leccion |
| `src/pages/Dashboard.tsx` | Kibbo determinado si tiene streak, durmiendo si streak=0, pulgar arriba en "continuar aprendiendo" |
| `src/pages/NotFound.tsx` | Kibbo triste con mensaje amigable |
| `src/pages/Auth.tsx` | Kibbo emocionado saludando |
| `src/pages/Landing.tsx` | Kibbo emocionado en hero (ya usa KibboMascot, swap por expresion) |
| `src/pages/Onboarding.tsx` | Kibbo emocionado durante setup |

### 4. Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `src/assets/kibbo-*.png` (9 archivos) | Crear — expresiones individuales sin fondo |
| `src/components/KibboExpression.tsx` | Crear — componente con selector de expresion + animacion |
| `src/components/LevelUpModal.tsx` | Modificar — usar KibboExpression surprised |
| `src/components/XpAnimation.tsx` | Modificar — agregar KibboExpression dancing |
| `src/components/WalkthroughOverlay.tsx` | Modificar — usar KibboExpression excited |
| `src/pages/QuizView.tsx` | Modificar — thinking/celebrating/sad |
| `src/pages/LessonView.tsx` | Modificar — thumbsup al completar |
| `src/pages/Dashboard.tsx` | Modificar — determined/sleeping segun streak |
| `src/pages/NotFound.tsx` | Modificar — sad con mensaje |
| `src/pages/Auth.tsx` | Modificar — excited |
| `src/pages/Onboarding.tsx` | Modificar — excited |

