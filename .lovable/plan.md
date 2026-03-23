

# Plan: Quizzes Interactivos + Curso Demo IA + Walkthrough Duolingo

## 1. Quiz Interactivo para Colaboradores

**Nueva página `QuizView.tsx`** — experiencia estilo Duolingo:
- Barra de progreso arriba (pregunta X de N)
- Una pregunta a la vez con animación de transición
- Opción múltiple: cards seleccionables con feedback visual (verde correcto, rojo incorrecto)
- Verdadero/Falso: dos botones grandes estilizados
- Al responder: feedback inmediato con animación (confetti/shake), breve explicación
- Al terminar: pantalla de resultados con score, XP ganados, opción de reintentar
- Guarda progreso en `user_progress` con `quiz_id` y `score`
- Otorga XP (+25) si aprueba (score >= passing_score)
- Ruta: `/app/courses/:courseId/quiz/:quizId`

## 2. Admin: Editor de Quizzes en EditCourse

**Ampliar `EditCourse.tsx`** para que cada módulo tenga:
- Sección "Quiz del módulo" con botón para crear/editar quiz
- Editor inline de preguntas:
  - Tipo: opción múltiple o verdadero/falso
  - Texto de la pregunta
  - Opciones (2-4 para múltiple, V/F automático)
  - Marcar respuesta correcta
  - Agregar/eliminar preguntas con drag
- Config del quiz: nota mínima, intentos máximos, XP reward

## 3. CourseView: Integrar Quizzes en el Path

**Modificar `CourseView.tsx`**:
- Después de las lecciones de cada módulo, mostrar enlace al quiz si existe
- Icono diferenciado (brain/clipboard) con estado (completado/pendiente/bloqueado)
- Quiz se desbloquea solo cuando todas las lecciones del módulo están completadas

## 4. Curso Demo: "Introducción a la IA"

**Insertar datos seed via SQL** — un curso completo con 3 módulos:

- **Módulo 1: ¿Qué es la Inteligencia Artificial?**
  - Lección 1: Definición y tipos de IA
  - Lección 2: Historia breve de la IA
  - Quiz: 4 preguntas (mix múltiple opción + V/F)

- **Módulo 2: IA en el mundo real**
  - Lección 1: IA en empresas
  - Lección 2: ChatGPT y modelos de lenguaje
  - Quiz: 4 preguntas

- **Módulo 3: Primeros pasos con IA**
  - Lección 1: Cómo escribir buenos prompts
  - Lección 2: Herramientas de IA para el trabajo
  - Quiz: 4 preguntas

El curso se insertará como `status: 'published'` vinculado a la company del usuario admin logueado, usando un edge function o insert directo.

## 5. Sistema de Walkthrough (Onboarding Guiado estilo Duolingo)

**Nuevo componente `WalkthroughOverlay.tsx`**:
- Overlay con spotlight/highlight sobre elementos de la UI
- Steps secuenciales con tooltip animado apuntando al elemento actual
- Mascota/personaje Kibbo (simple ilustración SVG) que "habla" en cada paso
- Botones "Siguiente" / "Omitir"
- Se activa la primera vez que el usuario entra al dashboard
- Estado guardado en `localStorage` (key: `kibbo_walkthrough_completed`)

**Pasos del walkthrough para Colaborador:**
1. "¡Bienvenido a Kibbo!" — spotlight en el dashboard
2. "Aquí ves tu progreso y XP" — spotlight en stats cards
3. "Explora los cursos disponibles" — spotlight en sidebar "Cursos"
4. "Completa lecciones para ganar XP" — spotlight en meta diaria
5. "Compite con tu equipo" — spotlight en sidebar "Ranking"

**Pasos del walkthrough para Admin:**
1. "¡Bienvenido a Kibbo!" — spotlight en dashboard
2. "Crea cursos para tu equipo" — spotlight en sidebar "Gestionar Cursos"
3. "Agrega módulos, lecciones y quizzes"
4. "Revisa el progreso de tu equipo"

## Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `src/pages/QuizView.tsx` | Crear — experiencia quiz interactivo |
| `src/pages/admin/EditCourse.tsx` | Modificar — agregar editor de quizzes |
| `src/pages/CourseView.tsx` | Modificar — mostrar quizzes en path |
| `src/components/WalkthroughOverlay.tsx` | Crear — sistema de walkthrough |
| `src/components/KibboMascot.tsx` | Crear — SVG mascota simple |
| `src/App.tsx` | Modificar — agregar ruta quiz |
| `src/pages/Dashboard.tsx` | Modificar — integrar walkthrough |
| Migration SQL | Insertar curso demo de IA (seed data) |

## Detalles Técnicos

- No se necesitan cambios de schema (quizzes/questions tables ya existen con RLS)
- El curso demo se inserta via migration con UUIDs fijos para poder referenciar módulos/quizzes/preguntas
- El walkthrough usa `position: fixed` overlay con `z-index` alto, calcula posición de elementos via `getBoundingClientRect`
- Animaciones con framer-motion para transiciones de preguntas y feedback

