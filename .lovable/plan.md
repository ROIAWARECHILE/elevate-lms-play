# Plan: Mejoras a Kibbo con repos y librerías de GitHub

Investigué repos y librerías reales con buen mantenimiento que encajan con tu stack (React 18 + Vite + Tailwind + Framer Motion + shadcn). Te propongo qué tomar de cada uno y en qué orden integrarlo. **Tú eliges qué fases avanzar.**

---

## 🎬 1. Animaciones y micro-interacciones

| Recurso | Stars | Qué tomamos | Encaje en Kibbo |
|---|---|---|---|
| **[Magic UI](https://github.com/magicuidesign/magicui)** | ~15k | `AnimatedBeam`, `NumberTicker`, `Confetti`, `BorderBeam`, `Marquee`, `ShimmerButton` | Reemplazar `AnimatedCounter` por `NumberTicker` (más fluido), badges con `BorderBeam`, hero del Landing con `AnimatedBeam` |
| **[Aceternity UI](https://ui.aceternity.com)** | ~28k | `3D Card`, `Spotlight`, `BackgroundGradient`, `MovingBorder`, `MeteorEffect` | Cards de cursos con efecto 3D hover, spotlight en Dashboard widgets |
| **[react-rewards](https://github.com/thedevelobear/react-rewards)** | 3k | Confetti/balloons/emojis al click, declarativo | Sustituir `ConfettiEffect` artesanal — anclado al botón, no fullscreen |
| **[Rive React](https://rive.app/docs/runtimes/react)** | — | Animaciones interactivas reactivas a estado | Kibbo (la mascota) viva: mira al cursor, reacciona a aciertos/errores en quiz |
| **[Lottie React](https://github.com/Gamote/lottie-react)** | 1k | Reproducir Lottie JSON | Onboarding más narrativo, estados vacíos animados |

---

## 🎮 2. Gamificación profunda (Duolingo-grade)

| Recurso | Qué tomamos |
|---|---|
| **[JetflowUX/7-days-streak](https://github.com/JetflowUX/7-days-streak)** | Componente listo de racha 7-días con anillo de progreso, calendario y confetti — base directa para el widget de streak en Dashboard |
| **[open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** (~1.5k) | Algoritmo FSRS (mejor que SM-2) para repaso espaciado de lecciones/quizzes ya completados |
| **[catdad/canvas-confetti](https://github.com/catdad/canvas-confetti)** (~11k) | Confetti basado en canvas, 60fps, ligero — para level-ups y completado de curso |
| **[react-circular-progressbar](https://github.com/kevinsqi/react-circular-progressbar)** | Anillos animados para XP diario, completitud de módulo |
| Patrón Duolingo Leagues | Tabla `weekly_leagues` + cohortes de 30 — diseño documentado, sin lib específica |

---

## ✏️ 3. Editor de lecciones tipo Notion

| Recurso | Stars | Qué tomamos |
|---|---|---|
| **[BlockNote](https://github.com/TypeCellOS/BlockNote)** | ~10k | Editor por bloques drag-and-drop, slash menu, formato de salida JSON compatible con tu `content.blocks` |
| **[hunghg255/reactjs-tiptap-editor](https://github.com/hunghg255/reactjs-tiptap-editor)** | ~700 | Editor Tiptap pre-stylado con shadcn — alternativa más ligera si quieres customizar |
| **[Plate.js](https://github.com/udecode/plate)** | ~14k | Plugin-based, muy potente pero curva de aprendizaje mayor |

**Recomendación:** BlockNote — su salida JSON es casi idéntica a tu sistema actual de bloques.

---

## 🚀 4. UX de aplicación (Linear/Vercel-grade)

| Recurso | Qué tomamos |
|---|---|
| **[pacocoursey/cmdk](https://github.com/pacocoursey/cmdk)** (~10k) | Ya está en `components/ui/command.tsx` — falta usarla para Command Palette `Cmd+K` |
| **[react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)** (~3k) | Atajos globales: `←/→` lecciones, `1-4` quiz, `G+D` ir a Dashboard |
| **[sonner](https://github.com/emilkowalski/sonner)** | Ya disponible en shadcn — usarlo para toasts de XP ganado, racha en peligro |
| **[vaul](https://github.com/emilkowalski/vaul)** (~7k) | Drawer mobile-friendly de Emil Kowalski para mobile sheets |
| **[nextstepjs/nextstep](https://github.com/enszrlu/NextStep)** | Onboarding tours guiados — alternativa a tu `WalkthroughOverlay` |

---

## 📊 5. Datos y rendimiento

| Recurso | Qué tomamos |
|---|---|
| **TanStack Query** (ya instalado) | Migrar `useEffect + supabase` → hooks `useCourses`, `useProfile`, `useLeaderboard` en `src/hooks/queries/` |
| **[Zustand](https://github.com/pmndrs/zustand)** (~50k) | Estado global ligero para UI ephemera (modal abierto, drawer, comandos) |
| **[react-virtuoso](https://github.com/petyosi/react-virtuoso)** (~5k) | Virtualizar leaderboard y lista de usuarios admin cuando crezca |
| **Supabase Realtime** | Leaderboard en vivo + presencia de usuarios online |

---

## 🏆 6. Certificados y compartibles

| Recurso | Qué tomamos |
|---|---|
| **[@react-pdf/renderer](https://github.com/diegomura/react-pdf)** (~14k) | Generar certificados PDF al completar curso |
| **[vercel/satori](https://github.com/vercel/satori)** (~12k) | Generar OG-image dinámica para certificados compartibles en LinkedIn |
| **[qrcode.react](https://github.com/zpao/qrcode.react)** | QR de verificación en el certificado → URL `/cert/{uuid}` |

---

## 📋 Fases de integración propuestas

### 🥇 Fase 1 — Pulido visual inmediato (1-2 días)
- Instalar **Magic UI**: `NumberTicker` (Dashboard), `BorderBeam` (badges), `ShimmerButton` (CTAs principales)
- Reemplazar `ConfettiEffect` por **canvas-confetti** (más performante)
- Activar **Command Palette** con `cmdk` ya instalado
- Atajos de teclado con **react-hotkeys-hook** en LessonView/QuizView

### 🥈 Fase 2 — Gamificación viva (3-4 días)
- Adaptar **JetflowUX/7-days-streak** al widget de racha
- **react-rewards** anclado a botones de quiz correcto
- Tabla `achievements` + `user_achievements` con badges desbloqueables
- Daily Quests (3 misiones rotativas con `NumberTicker` de progreso)

### 🥉 Fase 3 — Editor profesional (4-5 días)
- Integrar **BlockNote** en `EditCourse.tsx` para edición visual de bloques
- Migrar lecciones existentes (formato compatible)
- Bloque custom "Quiz inline" para insertar preguntas en medio de lección

### 🎯 Fase 4 — Aprendizaje serio (1 semana)
- **@react-pdf/renderer** + **qrcode.react** → certificados verificables
- **ts-fsrs** → sección "Para repasar hoy" en Dashboard
- Realtime leaderboard con Supabase Realtime + virtualización con `react-virtuoso`

### 🔮 Fase 5 — Mascota viva con Rive (opcional, 2-3 días)
- Migrar Kibbo de PNG estático a animación Rive interactiva
- Estados: idle, mira-cursor, celebra, triste, piensa, duerme
- Reacciona en tiempo real a aciertos/errores en QuizView

---

## 🎯 Mi recomendación honesta

**Empieza por Fase 1 + Fase 2.** Razones:
1. **Fase 1** es ~2 días y da un salto perceptible de "producto pro" (Magic UI + Cmd+K + atajos)
2. **Fase 2** ataca retención con mecánicas probadas (rachas + badges + daily quests)
3. Las fases 3-5 son grandes — mejor validarlas con usuarios después de Fase 2

---

## ❓ Pregunta antes de implementar

¿Avanzamos con **Fase 1 + Fase 2**, prefieres otra combinación, o quieres que detalle alguna fase concreta antes de aprobar?
