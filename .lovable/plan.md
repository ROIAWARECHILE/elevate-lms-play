
# 🧠 Sistema profesional de generación de cursos — Course Studio

Convertimos el actual `generate-course` (PDF + imágenes → módulos planos) en un **motor profesional, multi-fuente y multi-nodo**, inspirado en Coursera, Notion AI, Duolingo y Anki.

---

## 1. Nuevos tipos de nodos (lecciones tipadas)

Hoy todo es `lesson.content.blocks = [heading, paragraph]`. Lo extendemos a un **sistema de bloques tipados**, manteniendo retro-compatibilidad (los cursos viejos siguen funcionando):

| `lesson_type` | Uso | Bloques soportados |
|---|---|---|
| `reading` | Lección clásica explicativa | `heading`, `paragraph`, `callout`, `image`, `quote`, `code`, `divider` |
| `concept` | Definiciones / términos clave | `term` (palabra + definición + ejemplo) |
| `flashcards` | Memorización tipo Anki | `flashcard` (front / back / hint) |
| `steps` | Cómo-hacer / técnica paso a paso | `step` (n, title, description, tip) |
| `comparison` | Tabla comparativa | `comparison_table` (rows/cols) |
| `case_study` | Escenario aplicado | `scenario`, `question`, `reflection` |
| `interactive_quiz` | Mini-quiz dentro de lección | `mc`, `true_false`, `fill_blank`, `match_pairs`, `order_steps` |
| `video_embed` | Video externo (YouTube/Vimeo) | `video` |

**Migración DB**: añadir `lesson_type text default 'reading'` a `lessons`. Todos los cursos existentes quedan como `reading` automáticamente. Los `content.blocks` siguen siendo `jsonb` libre — solo cambia el discriminador `block.type`.

---

## 2. Motor de generación multi-fuente (`generate-course` v2)

Ampliamos la edge function para aceptar **cualquier combinación** de inputs:

- 📄 **PDF** (ya existe)
- 🖼️ **Imágenes / screenshots** (ya existe)
- 📊 **Excel / CSV** → parseo a Markdown-table en cliente con `xlsx` library, se manda como texto al LLM
- 🌐 **URLs** → fetch del contenido + extracción de texto (vía edge function `fetch-source` con sanitización)
- 🔍 **Búsqueda web** (modo "investigación") → usar `tavily` o búsqueda de Lovable AI con grounding
- ✍️ **Texto libre / Markdown pegado**
- 📚 **Mezcla**: ej. "PDF de la política + 2 URLs + investigar X término"

### Pipeline en 3 pasos (chain-of-thought controlado)

En vez de una sola llamada gigante, la nueva edge function ejecuta un pipeline:

1. **`extract`** → LLM lee todas las fuentes y produce un *knowledge brief* estructurado (temas, conceptos clave, hechos, fuentes citadas).
2. **`outline`** → con el brief, genera un esqueleto: módulos + para cada lección decide su **`lesson_type`** según la naturaleza del contenido (definiciones → `concept`, procedimientos → `steps`, datos a memorizar → `flashcards`, casos → `case_study`, etc.).
3. **`materialize`** → expande cada nodo a sus bloques finales + genera el quiz del módulo con variedad (no solo multiple choice: incluye `true_false`, `fill_blank`, `match_pairs` cuando aplique).

Ventajas:
- Mejor calidad (cada paso es más enfocado, menos alucinación).
- Permite **streaming de progreso** real al cliente: "Extrayendo conceptos… Diseñando módulos 3/5… Escribiendo lección 7/24…".
- Permite **preview & approve**: el admin ve el outline y puede editar antes de materializar (ahorra tokens y da control).

---

## 3. Course Studio — nueva UI de admin

Nueva ruta `/app/admin/courses/studio` que reemplaza el flujo actual de `GenerateCourse.tsx` con un **wizard de 4 pasos**:

1. **Sources** — multi-uploader unificado (PDF, imágenes, Excel, URLs, texto, búsqueda web). Chips visuales por fuente, con preview.
2. **Brief** — muestra el knowledge brief extraído (editable). El admin puede añadir notas: "enfócate en X, ignora Y".
3. **Outline** — vista tipo Notion del esqueleto: módulos arrastrables, cada lección muestra su tipo (`reading`, `flashcards`, etc.) con icono. El admin puede:
   - Cambiar el tipo de cualquier lección
   - Reordenar / renombrar / borrar / añadir
   - Aprobar el outline
4. **Generate** — barra de progreso real por nodo (vía streaming). Al terminar redirige a `EditCourse` mejorado.

Tech: `@dnd-kit/core` para drag-and-drop (ya soporta accesibilidad). Animaciones con `framer-motion` siguiendo el lenguaje visual existente (Kibbo, gradientes navy/cyan).

---

## 4. EditCourse v2 — editor profesional por bloques

Refactor de `EditCourse.tsx` para soportar los nuevos `lesson_type`:

- **Renderer dinámico** `<LessonBlockEditor>` que despacha al editor correcto según `lesson_type`.
- Sub-editores: `ReadingEditor` (bloques tipo Notion ligero), `FlashcardsEditor` (flip cards editables), `StepsEditor` (lista numerada con títulos), `ConceptEditor` (term/definition pares), `ComparisonEditor` (tabla), `CaseStudyEditor`.
- Botón **"Regenerar con IA esta lección"** por nodo (llama a `generate-course/regenerate-node` solo para ese bloque).
- Botón **"Convertir tipo"** (ej. transformar 5 paragraphs en 5 flashcards automáticamente).

---

## 5. Renderers en runtime (`LessonView` extendida)

`LessonView.tsx` ya renderiza `blocks: [heading|paragraph]`. Lo extendemos con un dispatcher:

```tsx
{lesson.lesson_type === 'flashcards'  && <FlashcardsRunner blocks={...} />}
{lesson.lesson_type === 'steps'       && <StepsRunner       blocks={...} />}
{lesson.lesson_type === 'concept'     && <ConceptRunner     blocks={...} />}
// ...
{(!lesson.lesson_type || lesson.lesson_type === 'reading') && <ReadingRunner blocks={...} />}
```

Cada runner tiene su propia UX (las flashcards se voltean, los pasos se desbloquean secuencialmente, el case_study tiene preguntas de reflexión que dan XP extra). Todos terminan llamando al mismo `completeLesson()` existente para preservar XP, streaks, achievements y daily quests.

---

## 6. Cambios concretos en código

### Edge functions
- Reescribir `supabase/functions/generate-course/index.ts` → pipeline `extract → outline → materialize`, con tools separadas. Soporta `sources: [{kind: 'pdf'|'image'|'text'|'url'|'excel'|'search', payload}]`.
- Nueva `supabase/functions/fetch-source/index.ts` → fetch sanitizado de URLs + extracción de texto.
- Nueva `supabase/functions/generate-course/regenerate-node` (subruta) → regenerar una sola lección/quiz.

### DB (migración)
- `ALTER TABLE lessons ADD COLUMN lesson_type text NOT NULL DEFAULT 'reading';`
- `ALTER TABLE courses ADD COLUMN source_brief jsonb;` (guardar el brief extraído para auditoría / regeneración futura)
- Nueva tabla opcional `course_sources` (id, course_id, kind, name, metadata) para trazabilidad de "este curso vino de X PDF + Y URL".

### Frontend
- `src/pages/admin/CourseStudio.tsx` (wizard nuevo)
- `src/components/studio/SourcesStep.tsx`, `BriefStep.tsx`, `OutlineStep.tsx`, `GenerateStep.tsx`
- `src/components/lesson/runners/` (FlashcardsRunner, StepsRunner, ConceptRunner, ComparisonRunner, CaseStudyRunner, InteractiveQuizRunner)
- `src/components/lesson/editors/` (gemelos para edición)
- `src/lib/courseSchema.ts` — tipos TS centralizados de bloques + Zod schemas validadores
- Update `LessonView.tsx` y `EditCourse.tsx` con dispatchers
- Reemplazar enlace "Generar con IA" en `AdminCourses.tsx` para apuntar a `/studio` (mantener `GenerateCourse.tsx` como modo "rápido" o deprecarlo).

### Dependencias nuevas
- `xlsx` (parseo Excel/CSV en cliente)
- `@dnd-kit/core` + `@dnd-kit/sortable` (drag-and-drop accesible del outline)
- `zod` (validación de schemas de bloques) — probablemente ya lo tienes via shadcn
- `react-markdown` + `remark-gfm` (render de markdown en bloques `paragraph` y `callout`)

---

## 7. Buenas prácticas aplicadas

- **Schemas tipados con Zod** → todo bloque generado por IA se valida antes de insertarse en DB; bloques inválidos se descartan con log, no rompen el curso.
- **Streaming + idempotencia** → el pipeline guarda checkpoints; si falla en lección 12/24, se puede reanudar.
- **Retry exponencial** en llamadas al AI Gateway con `429` (créditos) y `503`.
- **Límites duros** (max 12 módulos, max 8 lecciones/módulo, max 50 páginas PDF, max 5 URLs, max 10 imágenes) para controlar costo y latencia.
- **Sanitización** de URLs externas (allowlist de schemes, timeout de 10s, max 2MB de respuesta).
- **Auditoría** — `course_sources` deja rastro de qué generó qué; el botón "Regenerar" siempre puede volver atrás.
- **i18n-ready** — todos los prompts y strings en español por defecto (consistente con el resto del sistema), pero el schema soporta `language: 'es'|'en'`.
- **Accesibilidad** — flashcards navegables con teclado (←/→/Space para flip), runners con roles ARIA correctos.
- **Mobile-first** — el wizard y los runners responsive (Kibbo theme ya lo hace fácil).
- **Sin secretos en cliente** — toda llamada al LLM y todo fetch de URLs externas pasan por edge functions.
- **RLS preservada** — toda escritura nueva respeta `company_id` + rol `admin`.

---

## 8. Roadmap de implementación (sugerido en 3 PRs)

1. **PR1 — Foundation**: migración DB (`lesson_type`, `source_brief`, `course_sources`), tipos TS + Zod schemas, runners y editors básicos (`reading`, `flashcards`, `steps`, `concept`). LessonView y EditCourse con dispatcher. *(Compatibilidad total con cursos viejos.)*
2. **PR2 — Studio + Pipeline**: nueva edge function pipeline (extract/outline/materialize), Course Studio wizard con sources unificadas (PDF, imágenes, texto, Excel, URLs).
3. **PR3 — Pulido**: búsqueda web como fuente, regeneración por nodo, conversión de tipos, drag-and-drop avanzado, streaming de progreso real, comparison/case_study/interactive_quiz runners.

---

¿Apruebas el plan completo o prefieres que arranquemos solo con **PR1 + PR2** (que ya entrega un producto utilísimo) y dejamos PR3 para después?
