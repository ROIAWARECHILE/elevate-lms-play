

# Plan: Mejoras de UX, Animaciones y Efectos

## Analisis Actual

La app tiene animaciones basicas con framer-motion (fade-in, scale) pero carece de las micro-interacciones, transiciones de pagina, y efectos de feedback que hacen que una app tipo Duolingo se sienta viva y adictiva.

## Mejoras Propuestas

### 1. Transiciones de Pagina (Page Transitions)
Wrap `<Outlet>` en `AppLayout.tsx` con `AnimatePresence` + `motion.div` usando la key de `location.pathname`. Cada pagina entra con fade+slide y sale suavemente.

### 2. Skeleton Loaders en Vez de Spinners
Reemplazar los `Loader2` spinner en `CourseView`, `LessonView`, `Courses`, y `Leaderboard` con skeleton placeholders (pulsating cards/lines) que muestran la estructura de la pagina mientras carga. Mas profesional y menos jarring.

### 3. Micro-interacciones en Cards y Botones
- **Course cards** (`Courses.tsx`): agregar `whileHover={{ y: -4, scale: 1.02 }}` y `whileTap={{ scale: 0.98 }}` para que las cards se eleven al hover
- **Stats cards** (`Dashboard.tsx`): counter animation — los numeros se animan de 0 al valor real usando framer-motion `useMotionValue` + `animate`
- **Quiz answer buttons** (`QuizView.tsx`): shake animation cuando la respuesta es incorrecta, bounce cuando es correcta
- **Lesson complete button**: pulse glow effect antes de presionar

### 4. Confetti al Completar Quiz/Curso
Agregar un componente `ConfettiEffect` que dispara particulas al aprobar un quiz o completar una leccion. Implementado con canvas o CSS keyframes — ligero, sin dependencia extra.

### 5. Course Path Visual Mejorado (CourseView)
- Los nodos completados hacen un bounce sutil al entrar en vista
- El nodo activo tiene un ring animado tipo "pulse" giratorio (no `animate-pulse` basico, sino un gradient ring rotating)
- Agregar particulas/sparkles pequeñas alrededor del nodo activo
- La linea conectora se anima de arriba a abajo como "llenandose" con el progreso

### 6. Improved Streak Counter Animation
En el dashboard y sidebar, cuando el streak cambia: el numero hace un scale bounce (1 → 1.3 → 1) con un flash de color. Icono de fuego con animacion de flicker sutil.

### 7. Progress Bar Animada
Las barras de progreso (`Progress`) se animan de 0 al valor real con easing cuando la pagina carga, en vez de aparecer estaticas.

### 8. Landing Page: Parallax y Stagger
- Secciones de features con stagger animation mejorada (entran de abajo con spring)
- Stats section: los numeros se "cuentan" de 0 al valor final (counting animation)
- Hero: texto principal con animacion palabra por palabra (typewriter-like effect sutil)

### 9. Toast/Feedback Mejorado
Reemplazar toasts genéricos con feedback visual inline:
- XP ganado: el numero de XP en el sidebar/header hace un "bump" visual
- Streak incrementado: icono de fuego hace flash

### 10. Dark Mode Smooth Transition
Aunque no se implementa toggle aun, preparar las transiciones de color con `transition-colors duration-300` en el body para cuando se agregue.

---

## Archivos a Crear/Modificar

| Archivo | Accion |
|---|---|
| `src/components/ConfettiEffect.tsx` | Crear — efecto confetti ligero con CSS/canvas |
| `src/components/AnimatedCounter.tsx` | Crear — componente que anima numeros de 0 a N |
| `src/components/PageTransition.tsx` | Crear — wrapper de transicion de pagina |
| `src/components/SkeletonLoaders.tsx` | Crear — skeletons para courses, leaderboard, lesson |
| `src/components/AppLayout.tsx` | Modificar — integrar PageTransition en Outlet |
| `src/pages/Courses.tsx` | Modificar — hover animations en cards, skeleton loader |
| `src/pages/CourseView.tsx` | Modificar — animated path line, active node ring |
| `src/pages/QuizView.tsx` | Modificar — shake/bounce feedback, confetti al aprobar |
| `src/pages/Dashboard.tsx` | Modificar — animated counters, streak animation |
| `src/pages/LessonView.tsx` | Modificar — confetti al completar, pulse button |
| `src/pages/Landing.tsx` | Modificar — counting stats, stagger mejorado |
| `src/pages/Leaderboard.tsx` | Modificar — skeleton loader, row hover effects |
| `src/pages/Profile.tsx` | Modificar — animated progress bar, counter animation |
| `src/index.css` | Modificar — agregar keyframes para shake, confetti, pulse-ring |
| `tailwind.config.ts` | Modificar — agregar animations shake, bounce-in, confetti |

## Detalles Tecnicos

- Confetti: implementado con ~30 `div` elements con keyframes CSS aleatorios (no libreria externa), disparado por un componente controlado con prop `trigger`
- AnimatedCounter: usa `useEffect` + `requestAnimationFrame` para interpolar de 0 al valor target con easing
- Page transitions: `AnimatePresence` con `mode="wait"` en el Outlet wrapper, cada pagina exporta un `motion.div` wrapper
- Shake animation: `@keyframes shake { 0%,100% { translateX(0) } 25% { translateX(-4px) } 75% { translateX(4px) } }` — 300ms
- Active node ring: `@keyframes spin-ring` con un conic-gradient que rota 360 grados continuamente
- Skeleton loaders: componentes con `animate-pulse` y formas que replican la UI final (cards, text lines, circles)

