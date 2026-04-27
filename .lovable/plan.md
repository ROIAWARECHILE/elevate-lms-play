## 🎯 Objetivo

Transformar el sistema actual (creación + consumo de cursos) en un **motor de aprendizaje adaptativo profesional** que aplique los 9 principios pedagógicos: **Spaced Repetition, Retrieval Practice, Gamificación, Microlearning, Adaptive Learning, Learning by Doing, Feedback Inmediato, Habit Formation y Multimodal Learning**.

Se aplica tanto a cursos creados por **chat** como por el **Course Studio con IA**.

---

## 🧱 Arquitectura propuesta (4 capas)

```
┌─────────────────────────────────────────┐
│  CORE ENGINE  — SRS + Memoria adaptativa │  ← nuevo
├─────────────────────────────────────────┤
│  EXPERIENCE   — Microlecciones + Quizzes │  ← refactor
├─────────────────────────────────────────┤
│  GAME LAYER   — XP, streaks, misiones    │  ← ya existe, se extiende
├─────────────────────────────────────────┤
│  CONTEXT LAYER — Simulaciones / SOPs     │  ← nuevo bloque
└─────────────────────────────────────────┘
```

---

## 📦 PR1 — Core Engine: Spaced Repetition (SM-2 simplificado)

### 1.1 Base de datos (migración)

**Nueva tabla `srs_items`** — una "tarjeta de memoria" por concepto/pregunta clave del usuario:

```sql
CREATE TABLE srs_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  course_id uuid,
  lesson_id uuid,
  -- Identidad del ítem
  item_type text NOT NULL,        -- 'concept' | 'quiz_block' | 'term'
  item_key text NOT NULL,         -- hash del contenido para dedup
  payload jsonb NOT NULL,         -- pregunta + respuesta + explicación
  -- Algoritmo SM-2
  ease_factor real NOT NULL DEFAULT 2.5,
  interval_days int NOT NULL DEFAULT 0,
  repetitions int NOT NULL DEFAULT 0,
  -- Half-Life Regression style
  strength real NOT NULL DEFAULT 0.3,  -- 0..1 probabilidad de recordar HOY
  last_reviewed_at timestamptz,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  -- Estadística
  total_reviews int DEFAULT 0,
  total_correct int DEFAULT 0,
  UNIQUE(user_id, item_key)
);

-- Índice clave para "qué tocar hoy"
CREATE INDEX idx_srs_due ON srs_items(user_id, next_review_at)
  WHERE next_review_at <= now();
```

**RLS:** sólo el dueño lee/escribe sus tarjetas.

**RPC `srs_review(_item_id, _quality int)`** — actualiza intervalo según calidad de respuesta (0=falló, 3=correcto con duda, 5=fácil) usando SM-2:
- `quality < 3` → reset `repetitions=0`, `interval=1`
- `quality >= 3` → intervalos 1, 6, luego × ease_factor
- Ajustar `ease_factor` y recalcular `strength` y `next_review_at`

**RPC `srs_get_due(_limit int)`** — devuelve tarjetas vencidas ordenadas por urgencia.

### 1.2 Lógica cliente

- **`src/lib/srs.ts`** — implementación SM-2 + helpers para clasificar respuestas en quality 0–5.
- **`src/hooks/useSRS.ts`** — `enqueueItems(blocks)`, `reviewItem(id, quality)`, `getDueCount()`.
- **Hook auto-encolar:** cuando una lección se completa, los `interactive_quiz` y `concept` blocks se siembran automáticamente en `srs_items` (dedup por hash).

---

## 🔁 PR2 — Retrieval Practice + Daily Practice Hub

### 2.1 Nueva página `/app/practice` ("Práctica diaria")

Reemplaza/complementa la página `Review` actual:
- **Sesiones cortas de 5–10 ítems** mezclando contenidos vencidos del SRS.
- UI tipo Duolingo: una pregunta a la vez, barra superior de progreso, animaciones de acierto/error, vidas opcionales.
- Al final: resumen XP + racha + "siguiente sesión disponible en X horas".
- Botón fijo en el dashboard: **"Practicar ahora · N pendientes"** con badge rojo si `due > 0`.

### 2.2 Refactor de `Review.tsx`
- Renombrar a "Errores marcados" (lo manual queda).
- La práctica adaptativa real vive en `/app/practice`.

### 2.3 Notificaciones de hábito (in-app)
- Widget en dashboard: "Llevas X días seguidos. ¡No rompas la racha!".
- Toast diario al primer login si hay tarjetas vencidas.

---

## 🎮 PR3 — Adaptive Learning + Microlearning

### 3.1 Perfil dinámico de usuario (`user_skill_profile`)

```sql
CREATE TABLE user_skill_profile (
  user_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  course_id uuid NOT NULL,
  mastery real DEFAULT 0,       -- 0..1 promedio de strength del curso
  difficulty_preference text,   -- 'beginner'|'intermediate'|'advanced' (auto-inferido)
  avg_response_ms int,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
```

- Trigger/función para recalcular `mastery` tras cada review.
- El `LessonRenderer` consulta el perfil y:
  - Para usuarios `advanced` → muestra quiz primero, lectura colapsada.
  - Para `beginner` → muestra lectura completa antes del quiz.

### 3.2 Microlearning enforced
- Validación en Course Studio: **lecciones ≤ 5 min** (estimar por palabras + bloques).
- Si la IA genera lecciones largas → split automático en sub-lecciones de 1 concepto cada una.
- Badge visible "⏱ 3 min" en cada nodo del mapa zigzag.

---

## 🧠 PR4 — Learning by Doing: Nuevos tipos de bloques

Añadir al `courseSchema.ts` 3 nuevos `LessonType`:

| Tipo | Pedagogía | UI |
|------|-----------|-----|
| `simulation` | Learning by Doing | Flujo de decisiones tipo árbol: "¿Qué haces si...?" → ramas con consecuencias |
| `scenario_branching` | Casos reales | Escenario empresarial con 3+ caminos y feedback por ruta |
| `sop_walkthrough` | Procedimientos | Paso a paso con checkmarks obligatorios + foto/video opcional por paso |

Cada uno con su **runner** dedicado en `src/components/lesson/runners/`.

### Nuevos quiz blocks (Duolingo extendido)
- `tap_to_complete` — completa la frase tocando palabras del banco
- `image_select` — elige la imagen correcta (para maquinaria/seguridad)
- `audio_dictation` — escucha y transcribe (TTS via Web Speech API, sin coste)

---

## ⚡ PR5 — Feedback Inmediato profesional

Refactor de `InteractiveQuizRunner.tsx`:
- **Animación de respuesta**: verde + bounce + sonido / rojo + shake + sonido (ya existe `audioEngine`).
- **Explicación enriquecida** siempre visible tras responder, con:
  - "✅ Correcto porque…" / "❌ Error común: …"
  - Mini-tip de memoria ("Recuerda: …")
  - Botón "Ver concepto en diccionario" → enlaza directo.
- **Auto-mark mistake**: al fallar dos veces el mismo ítem en SRS, se añade automáticamente a "Errores marcados" (manteniendo la elección del usuario de marcar manualmente conceptos extra).

---

## 🤖 PR6 — Generación con IA alineada al motor

### 6.1 Edge function `generate-course` (refactor del prompt)

El prompt al modelo Gemini se reescribe para producir cursos **didácticamente correctos**:

1. **Microlearning**: cada lesson ≤ 300 palabras, 1 concepto.
2. **Mix obligatorio por módulo**:
   - 1 lección `concept` (introduce términos)
   - 1 lección `reading` o `video_embed` (contexto)
   - 1 lección `interactive_quiz` con ≥ 5 ejercicios variados
   - 1 lección `simulation` o `case_study` (aplicación)
   - 1 quiz final (retrieval práctica)
3. **Variedad de ejercicios**: nunca > 2 del mismo tipo seguidos.
4. **Explicaciones**: cada `mc/true_false/fill_blank` debe traer `explanation` con tip de memoria.
5. **Distractores plausibles** (no obvios) para MC.

### 6.2 Nueva edge function `materialize-simulation`
Genera escenarios ramificados a partir del `source_brief` cuando la outline marque un nodo como `simulation`.

### 6.3 Course Studio — paso "Estrategia pedagógica"
Nuevo paso entre **Outline** y **Generate**: el admin elige el **mix didáctico** (porcentaje de cada tipo) y la **dificultad inicial**. La IA respeta ese contrato.

---

## 🏆 PR7 — Gamificación bien hecha (anti-grinding)

- **XP por aprendizaje real, no por clicks**: completar lección sin quiz = XP base, con quiz aprobado al primer intento = XP × 1.5.
- **Misiones diarias enfocadas en SRS**: "Repasa 10 tarjetas vencidas" en lugar de sólo "completa lecciones".
- **Logros pedagógicos nuevos**:
  - 🧠 *Memoria de elefante* — 50 tarjetas con `strength > 0.9`
  - 🔥 *Racha de hierro* — 14 días seguidos
  - 🎯 *Sin errores* — 20 ejercicios correctos seguidos
- **Ranking semanal** por XP de práctica adaptativa (no sólo por completar).

---

## 📋 Orden de entrega sugerido

| PR | Alcance | Riesgo | Impacto |
|----|---------|--------|---------|
| **PR1** | DB + SRS engine + auto-seed | Bajo | 🔥 Alto |
| **PR2** | Página `/app/practice` + dashboard hook | Bajo | 🔥 Alto |
| **PR3** | Adaptive profile + microlearning enforce | Medio | Medio |
| **PR4** | Bloques `simulation` + `sop_walkthrough` + nuevos quiz | Medio | 🔥 Alto |
| **PR5** | Feedback inmediato pro + auto-mistake | Bajo | Medio |
| **PR6** | Prompt IA pedagógico + materialize-simulation | Medio | 🔥 Alto |
| **PR7** | Gamificación recalibrada | Bajo | Medio |

---

## ❓ Decisiones que necesito confirmar

Tras aprobar el plan global haré 2–3 preguntas clave (algoritmo SRS exacto, si quieres TTS para audio_dictation, y si el ranking semanal debe ser por equipo o individual). Pero el grueso del plan no depende de eso — puedo arrancar por **PR1 + PR2** que son la columna vertebral.

¿Apruebas para empezar a implementar?