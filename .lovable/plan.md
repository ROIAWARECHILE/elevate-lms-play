
# Plan: Mejoras estratégicas a Kibbo inspiradas en software líder

He analizado el sistema actual y lo comparé con patrones probados en plataformas reconocidas y repositorios open source relevantes. Te propongo mejoras agrupadas por impacto, indicando la inspiración concreta y el esfuerzo. Tú eliges qué grupos avanzar.

---

## 🎯 Inspiraciones clave usadas

| Producto / Repo | Qué tomamos prestado |
|---|---|
| **Duolingo** | Heart system suave, "Daily Quests", liga semanal, friend streaks, repaso espaciado |
| **Linear** | Command Palette (`Cmd+K`), atajos de teclado, transiciones limpias, optimistic UI |
| **Notion** | Editor por bloques real (drag, slash menu), comentarios inline |
| **Khan Academy / Coursera** | Mastery learning, certificados verificables, learning paths |
| **Vercel / Cal.com (OSS)** | Loading states con Suspense, Server Components patterns aplicables a React Query |
| **`pmndrs/zustand` + `TanStack Query`** | Reemplazo de fetching ad-hoc en `useEffect` por cache inteligente |
| **`shadcn/ui` cmdk** | Command palette ya disponible en `components/ui/command.tsx` |
| **`react-hotkeys-hook`** | Atajos globales |
| **`supabase/realtime`** | Leaderboard y notificaciones en vivo |

---

## 🟢 GRUPO A — Quick wins de UX (1-2 días, alto impacto)

### A1. Command Palette global (`Cmd+K`) estilo Linear/Vercel
- Ya tienes `components/ui/command.tsx` (cmdk) pero no se usa.
- Agregar `<GlobalCommandPalette />` en `AppLayout` con:
  - Búsqueda de cursos, lecciones, usuarios (admin)
  - Acciones rápidas: "Continuar aprendiendo", "Ver leaderboard", "Cerrar sesión"
  - Atajos visibles (`G then D` → Dashboard, estilo GitHub/Linear)
- Inspiración: `linear.app`, `vercel.com/dashboard`, repo `pacocoursey/cmdk`.

### A2. Migrar fetching a **TanStack Query** (ya instalado)
- Hoy `Dashboard`, `Courses`, `CourseView`, `Leaderboard` hacen `useEffect + supabase` manual → causa refetch innecesario, race conditions y los bugs de auth que ya peleamos.
- Crear `src/hooks/queries/` con `useCourses`, `useProfile`, `useLeaderboard`, `useCourseProgress`.
- Beneficios: cache, dedupe, `staleTime`, refetch on focus, optimistic updates en quizzes.
- Inspiración: patrón estándar en `cal.com`, `dub.co`, `documenso`.

### A3. Atajos de teclado en LessonView/QuizView
- `←` / `→` navegar lecciones, `Space` reproducir audio, `1-4` seleccionar opción de quiz, `Enter` confirmar.
- Librería: `react-hotkeys-hook` (1.5KB).
- Inspiración: Duolingo web, Anki.

### A4. Skeleton loaders consistentes + Suspense boundaries
- Ya tienes `SkeletonLoaders.tsx` pero solo en algunos lugares. Aplicarlos a Dashboard widgets, CourseView grid, Leaderboard rows.

---

## 🟡 GRUPO B — Gamificación profunda estilo Duolingo (3-5 días)

### B1. **Daily Quests** (3 misiones diarias rotativas)
- Tabla `daily_quests` con plantillas: "Completa 2 lecciones", "Gana 30 XP", "Acierta 5 quizzes seguidos".
- Widget en Dashboard con barra de progreso por misión y recompensa XP extra.
- Reset diario por usuario (cron edge function o lazy on-load).
- Inspiración directa: Duolingo "Daily Quests".

### B2. **Liga semanal** (Bronze → Silver → Gold → Diamond)
- Tabla `weekly_leagues` con cohortes de ~30 usuarios por liga.
- Reset cada lunes, top 7 suben, bottom 5 bajan.
- Visual: el `Leaderboard` actual se enriquece con división y countdown.
- Inspiración: Duolingo Leagues — el feature con mayor retención reportada.

### B3. **Sistema de "Hearts" suave (opcional configurable por empresa)**
- En vez de bloquear, las respuestas erróneas restan "energía" que se regenera cada hora; agotada → modo "repaso" obligatorio.
- Toggle en `AdminSettings`: empresas serias pueden desactivarlo.

### B4. **Repaso espaciado (SM-2 simplificado)**
- Lecciones/quizzes completados se reagendan automáticamente: 1d, 3d, 7d, 21d.
- Nueva sección "Para repasar hoy" en Dashboard.
- Inspiración: Anki, RemNote, SuperMemo. Repo de referencia: `open-spaced-repetition/ts-fsrs`.

### B5. **Achievements / Badges** desbloqueables
- Tabla `achievements` con definiciones, `user_achievements` con progreso.
- Ejemplos: "7 días seguidos", "Primer curso completo", "100% en un quiz", "Madrugador" (lección antes de las 8 AM).
- Modal animado con confeti al desbloquear (ya tienes `ConfettiEffect`).
- Inspiración: Duolingo, Strava, GitHub achievements.

---

## 🔵 GRUPO C — Aprendizaje serio estilo Coursera/Khan (1-2 semanas)

### C1. **Certificados verificables en PDF**
- Al completar un curso al 100%, generar PDF con `@react-pdf/renderer` o edge function con `pdf-lib`.
- URL pública verificable: `/cert/{uuid}` con QR.
- Inspiración: Coursera, Credly. Repo: `vercel/satori` para imagen OG del cert.

### C2. **Learning Paths** (rutas multi-curso)
- Nueva tabla `learning_paths` que agrupa cursos secuenciales con prerequisitos.
- Vista tipo "trail map" extendiendo el zigzag actual.
- Inspiración: Khan Academy "Mastery", freeCodeCamp curriculum.

### C3. **Editor de lecciones por bloques tipo Notion**
- Hoy `content.blocks` ya existe pero el admin no tiene editor visual decente.
- Implementar con `@tiptap/react` + slash menu + drag handles.
- Bloques: heading, párrafo, callout, video embed, imagen, código, divider, quiz inline.
- Inspiración: Notion, repos `BlockNote` (`TypeCellOS/BlockNote`) o `Plate.js`.

### C4. **Comentarios y discusión por lección**
- Tabla `lesson_comments` con threading 1 nivel.
- Útil para Q&A interno por empresa.
- Inspiración: Coursera discussion forums, Mighty Networks.

---

## 🟣 GRUPO D — Tiempo real y colaboración (3-4 días)

### D1. **Realtime leaderboard y presencia**
- Suscribirse a cambios en `profiles.xp_total` por `company_id` con Supabase Realtime.
- Avatares "online" en el leaderboard (presencia).
- Inspiración: Linear (live cursors), Figma multiplayer.

### D2. **Notificaciones in-app**
- Tabla `notifications` + bell icon en topbar con badge.
- Eventos: nuevo curso publicado, te aprobaron, alguien te superó en la liga, racha en peligro.
- Push web (PWA) opcional.

### D3. **"Streak freeze"** automático con notificación al admin
- Si un usuario está por perder racha de 7+ días, mensaje proactivo + 1 freeze gratis al mes (Duolingo style).

---

## 🟠 GRUPO E — Calidad técnica y DX (continuo)

### E1. **Reemplazar `useEffect`-fetch por React Query** (ver A2 — fundacional para todo lo demás).

### E2. **Error boundaries por ruta** con fallback amigable + Sentry opcional.

### E3. **Tests E2E con Playwright** del flujo crítico
- Ya tienes `playwright.config.ts` y `playwright-fixture.ts` pero sin tests reales.
- Cubrir: registro empresa, registro colaborador, completar lección, ganar XP, leaderboard.

### E4. **Storybook ligero** o página `/dev/components` para QA visual de Kibbo expressions, badges, skeletons.

### E5. **Auditoría de RLS automatizada**
- Script que llama `supabase--linter` en CI y falla si hay tablas sin RLS.

### E6. **Optimización de imágenes**
- `cover_image_url` sin transformaciones → usar Supabase Image Transformations (`?width=400&quality=80`).
- Lazy loading nativo + `blur` placeholder.

---

## 📊 Matriz de prioridad recomendada

| Prioridad | Grupos | Por qué |
|---|---|---|
| 🥇 **Hacer ya** | A1, A2, A3, B1, B5 | Bajo costo, alto impacto en retención y "wow" |
| 🥈 **Siguiente sprint** | B2, C1, D1, D2 | Diferenciadores fuertes vs competencia |
| 🥉 **Cuando haya tracción** | B4, C2, C3, C4 | Profundidad pedagógica |
| 🔧 **Continuo** | E1-E6 | Salud del producto |

---

## 📝 Pregunta antes de implementar

No voy a tocar código en este turno (modo plan). Cuando apruebes, dime **qué grupo(s) atacar primero**. Mi recomendación honesta:

> **Empieza por A1 + A2 + B1**. Son ~2 días de trabajo, eliminan la fuente de bugs de fetching que llevamos 3 conversaciones peleando, agregan el "Cmd+K" que da sensación de producto pro, y suman Daily Quests que es la mecánica con mayor lift de retención conocida en gamificación.

¿Avanzamos con esa terna, prefieres otro grupo, o quieres que detalle más alguno antes de aprobar?
