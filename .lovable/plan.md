

# Plan: Mejoras Inspiradas en Duolingo

## Analisis Actual vs Duolingo

| Feature | Estado Actual | Duolingo |
|---|---|---|
| Streak diario | Campo en DB, nunca se actualiza | Core feature, se actualiza al completar cualquier actividad |
| Nivel/Level up | Campo estático, nunca sube | Sube automaticamente con XP acumulado |
| Continuar aprendiendo | No existe | CTA principal del dashboard |
| Animaciones XP | Solo un toast | Animación flotante, confetti, sonido |
| Navegación mobile | Sidebar (mala UX mobile) | Bottom tab bar |
| Path visual del curso | Lista plana de cards | Camino visual con nodos conectados |
| Celebración al completar | No existe | Confetti, animación, mensaje motivacional |
| Protección XP duplicado | No existe | N/A (no aplica) |
| Detección curso completado | No existe | Marca automática |

## Cambios Propuestos (priorizados por impacto)

### 1. Sistema de Streak Funcional
**`LessonView.tsx` y `QuizView.tsx`** — Al completar cualquier actividad:
- Comparar `last_activity_date` del perfil con hoy
- Si es ayer: incrementar `current_streak`
- Si es hoy: no hacer nada
- Si es otro día: resetear a 1
- Actualizar `longest_streak` si supera el record
- Actualizar `last_activity_date` a hoy

### 2. Sistema de Level Up Automatico
**`LessonView.tsx` y `QuizView.tsx`** — Despues de sumar XP:
- Calcular nivel: `Math.floor(xpTotal / 100) + 1`
- Si el nuevo nivel es mayor al actual, actualizar y mostrar celebración
- Crear componente `LevelUpModal` con animación

### 3. Dashboard: "Continuar Aprendiendo"
**`Dashboard.tsx`** — Sección prominente al inicio:
- Query: último `user_progress` del usuario, obtener la siguiente lección/quiz sin completar del mismo curso
- Mostrar card grande con: nombre del curso, siguiente lección, botón "Continuar"
- Si no hay progreso, mostrar "Empieza tu primer curso"

### 4. Navegación Mobile: Bottom Tab Bar
**`AppLayout.tsx`** — Detectar viewport mobile:
- En mobile (< 768px): ocultar sidebar, mostrar bottom tab bar fija con 4-5 iconos (Dashboard, Cursos, Ranking, Perfil)
- En desktop: mantener sidebar actual
- Crear componente `BottomTabBar.tsx`

### 5. Path Visual del Curso (estilo Duolingo)
**`CourseView.tsx`** — Reemplazar lista plana por camino visual:
- Nodos circulares conectados por una línea vertical ondulada
- Cada nodo = lección o quiz
- Colores: gris (bloqueado), morado (disponible), verde (completado)
- Nodo actual pulsante/animado
- Icono de corona al final del módulo

### 6. Animaciones de XP y Celebración
- **`XpAnimation.tsx`**: componente que muestra "+10 XP" flotando hacia arriba con fade
- **`ConfettiCelebration.tsx`**: confetti al completar quiz con score alto o al subir de nivel
- Integrar en `LessonView` y `QuizView`

### 7. Protección contra XP Duplicado
**`LessonView.tsx`** — Antes de insertar `user_progress`:
- Verificar si ya existe un registro con ese `lesson_id` + `user_id` + `completed=true`
- Si existe, no insertar ni dar XP
- Lo mismo para `QuizView.tsx` (ya tiene `alreadyPassed` pero no previene re-insert en edge cases)

### 8. Detección de Curso Completado
**`QuizView.tsx` y `LessonView.tsx`** — Después de guardar progreso:
- Verificar si todas las lecciones y quizzes del curso están completadas
- Si sí, insertar un registro de `user_progress` con `course_id` y sin `lesson_id`/`quiz_id` como marcador de "curso completado"
- Otorgar XP bonus del curso (`course.xp_reward`)

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/components/BottomTabBar.tsx` | Crear — navegación mobile |
| `src/components/XpAnimation.tsx` | Crear — animación flotante de XP |
| `src/components/LevelUpModal.tsx` | Crear — modal de level up |
| `src/components/AppLayout.tsx` | Modificar — integrar bottom bar mobile |
| `src/pages/LessonView.tsx` | Modificar — streak, level up, XP protection, curso completado |
| `src/pages/QuizView.tsx` | Modificar — streak, level up, XP protection |
| `src/pages/Dashboard.tsx` | Modificar — "Continuar aprendiendo" |
| `src/pages/CourseView.tsx` | Modificar — path visual con nodos conectados |
| `src/pages/Profile.tsx` | Menor — mostrar streak correctamente |

