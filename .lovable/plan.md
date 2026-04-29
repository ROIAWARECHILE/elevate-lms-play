## Diagnóstico detallado

Course Studio sigue fallando porque el flujo actual mejoró algunos síntomas, pero la arquitectura todavía permite que contenido incompleto llegue a producción o quede oculto tras mensajes de “curso creado”. Hay tres problemas principales:

1. **La validación vive solo dentro de `generate-course` y no es compartida**
   - `generate-course` ya tiene sanitización para `materialize_lesson`, pero `regenerate-lesson`, `GenerateCourse` legacy, edición manual y publicación no usan la misma validación.
   - La base de datos ya tiene cursos con `content.blocks` como `[{}]`, `[{}, {}]` o bloques tipo `paragraph` en lecciones `interactive_quiz`. Eso confirma que hay caminos que guardaron contenido no renderizable.

2. **El contrato con la IA sigue siendo demasiado laxo**
   - El schema de tool calling para lecciones sigue usando `items: { type: "object", additionalProperties: true }`. El prompt pide estructura, pero el contrato técnico no obliga propiedades por tipo.
   - El outline puede crear lecciones no respaldadas por evidencia suficiente. Además fuerza `interactive_quiz` por módulo aunque el brief sea pobre.
   - El modelo elegido en el código es `google/gemini-2.5-pro`; la guía actual del proyecto recomienda Lovable AI con `google/gemini-3-flash-preview` por defecto salvo necesidad específica. También conviene dividir extracción, outline y materialización con límites claros.

3. **La finalización no es una auditoría real de calidad**
   - `materialize_finalize` solo cuenta módulos y lecciones; no verifica si cada lección renderiza según su `lesson_type` ni si los quizzes tienen preguntas válidas suficientes.
   - `AdminCourses` permite publicar cualquier borrador, incluso con lecciones rotas.
   - `CourseView` y `LessonView` consumen lo que exista; si hay bloques inválidos, el alumno ve “Sin ejercicios”, “Sin conceptos” o lecciones vacías.

Hallazgo adicional importante: `src/pages/admin/GenerateCourse.tsx` todavía llama `generate-course` sin `mode`, activando el flujo legacy single-shot. Ese camino inserta bloques de lectura sin la validación nueva y puede volver a crear cursos de baja calidad.

## Arquitectura propuesta

Cambiar el sistema de “generar e insertar” a “generar, validar, auditar y recién entonces habilitar”.

```text
Fuentes
  -> Extractor: brief normalizado + score de suficiencia
  -> Planner: outline con evidencia por lección
  -> Materializer: una lección por llamada
       -> schema estricto por tipo
       -> sanitize + validate compartido
       -> repair 1 vez
       -> insert solo si pasa
  -> Quiz generator por módulo
       -> validar preguntas
  -> Quality audit final
       -> si pasa: curso draft listo para revisar/publicar
       -> si falla: draft requiere revisión o se limpia
```

## Plan de implementación

### 1. Crear un validador único de contenido de curso

Añadir un módulo compartible para Edge Functions y frontend, o duplicar de forma controlada en `supabase/functions/_shared/course-quality.ts` y `src/lib/courseQuality.ts` si el entorno no permite importar directamente entre ambos.

Debe exponer:

- `sanitizeBlocksForLessonType(lessonType, blocks)`
- `validateLessonContent(lessonType, content)`
- `validateQuizQuestions(questions)`
- `auditCourseStructure(course, modules, lessons, quizzes, questions)`
- `getRenderableBlockCount(lesson)`
- `getQualityStatus(...)`

Reglas mínimas:

- `reading`: mínimo 2 bloques con texto real, no solo `divider`.
- `concept`: mínimo 2 `term` con `term` y `definition`.
- `flashcards`: mínimo 3 tarjetas completas.
- `steps`: mínimo 3 pasos completos y numerados.
- `comparison`: 1 tabla con mínimo 2 headers útiles y 2 filas consistentes.
- `case_study`: 1 escenario + 1 pregunta/reflexión.
- `interactive_quiz`: mínimo 4 ejercicios válidos; `mc` con 3+ opciones y `correct` exacto; `true_false` boolean; `match_pairs` con 3 pares; `order_steps` con 3 pasos; etc.
- `sop_walkthrough`: mínimo 3 pasos.

Resultado esperado: ningún flujo podrá considerar “válida” una lección con `[{}]` o con bloques incompatibles con su tipo.

### 2. Endurecer `generate-course` con contratos estrictos por modo

En `supabase/functions/generate-course/index.ts`:

- Cambiar el modelo Lovable AI por defecto a `google/gemini-3-flash-preview`, salvo que se decida mantener Pro solo para PDFs complejos.
- Reemplazar el schema genérico de `MATERIALIZE_LESSON_TOOL` por schemas discriminados o por una herramienta específica según `lesson_type`.
- Añadir validación de input del body por `mode` para evitar llamadas parciales o payloads inconsistentes.
- Mejorar `stepExtract` para devolver un `brief_quality_score` y `insufficient_reason` si el material no alcanza.
- Mejorar `stepOutline` para que cada lección incluya evidencia mínima:
  - `evidence_refs` o `source_evidence` con conceptos/hechos/procedimientos usados.
  - No crear `concept`, `steps`, `comparison`, `case_study` o `interactive_quiz` si no hay evidencia suficiente.
- Ajustar `interactive_quiz`: no forzarlo siempre como lección; puede quedar como quiz tabular del módulo si el brief no soporta ejercicios ricos.
- En `materialize_lesson`, guardar también metadatos de validación en `content.validation`, por ejemplo `{ status, block_count, repaired, warnings }`.

### 3. Convertir `materialize_finalize` en auditoría real

Actualmente solo recalcula XP y duración. Debe:

- Cargar módulos, lecciones, quizzes y preguntas del curso.
- Ejecutar `auditCourseStructure`.
- Detectar:
  - módulos sin lecciones renderizables;
  - lecciones con bloques vacíos/incompatibles;
  - quizzes con menos de 3 preguntas válidas;
  - cursos con menos de 1 módulo útil;
  - módulos con menos de 2 lecciones útiles y sin quiz válido.
- Si falla:
  - devolver `{ ok: false, qualityStatus: "failed", report }`;
  - no navegar como éxito;
  - opcionalmente borrar el draft si quedó irrecuperable.
- Si pasa con advertencias:
  - devolver `{ ok: true, qualityStatus: "needs_review", report }`;
  - mantenerlo en draft y mostrar advertencias accionables.
- Si pasa limpio:
  - devolver `{ ok: true, qualityStatus: "ready", report }`.

Importante: no publicar automáticamente. El curso debe quedar en draft listo para revisión.

### 4. Bloquear publicación de cursos dañados

En `AdminCourses.tsx` y/o con una función RPC segura:

- Antes de pasar de `draft` a `published`, auditar el curso.
- Si hay lecciones rotas o módulos vacíos, mostrar un error claro y no publicar.
- Recomendado: crear una RPC `publish_course_if_valid(_course_id uuid)` con `SECURITY DEFINER` que verifique admin + company + calidad. Así la regla no depende solo del cliente.

Si no queremos migración de DB en la primera fase, se puede hacer validación desde frontend antes del update, pero la solución robusta es RPC.

### 5. Eliminar o redirigir el flujo legacy

En `src/App.tsx` y `src/pages/admin/GenerateCourse.tsx`:

- Redirigir `/app/admin/courses/generate` a `/app/admin/courses/studio`, o transformar `GenerateCourse` en wrapper que use el pipeline nuevo.
- En `generate-course`, desactivar el fallback sin `mode` o hacer que internamente llame al pipeline moderno.
- Mantener solo compatibilidad segura: si llega una llamada legacy, devolver error accionable o procesarla con validación estricta, nunca con inserts directos sin auditoría.

### 6. Reforzar `regenerate-lesson`

En `supabase/functions/regenerate-lesson/index.ts`:

- Usar el mismo sanitizador/validador que `generate-course`.
- Añadir reparación automática si la primera generación no pasa.
- Bloquear guardado si el resultado no es renderizable.
- Aceptar instrucciones de reparación específicas para lecciones dañadas.
- Incluir `sop_walkthrough` en tipos soportados, porque Course Studio lo usa pero `regenerate-lesson` aún no lo lista.

### 7. Mejorar la UI de Course Studio durante generación

En `CourseStudio.tsx`:

- Mantener estado por lección, no solo por módulo:
  - `pending`, `generating`, `valid`, `repairing`, `skipped`, `failed`.
- Mostrar número de bloques válidos y razón si se omite.
- Guardar un `generationReport` con errores por módulo/lección.
- Después de finalizar:
  - si `qualityStatus = failed`, no navegar a EditCourse como éxito;
  - si `needs_review`, navegar a edición pero con banner “requiere revisión” y lista de reparaciones;
  - si `ready`, mostrar éxito normal.
- Añadir acción “Reintentar lecciones fallidas” que llame `regenerate-lesson` o un nuevo modo `repair_course_lessons`.

### 8. Reparar datos existentes

Crear una acción de mantenimiento para cursos ya dañados, especialmente “Politica de seguridad de Fabrica SMART BUILDING”.

Opciones:

- Edge Function `repair-course`:
  - audita el curso;
  - regenera lecciones dañadas con `regenerate-lesson` reforzado;
  - elimina módulos irrecuperables;
  - devuelve reporte.
- O botón en EditCourse: “Auditar y reparar curso”.

También conviene marcar cursos dañados como `draft` hasta que pasen auditoría. Para esto se puede usar `source_brief.generation_quality` sin cambiar schema, o una migración opcional con campos dedicados.

### 9. Pruebas y validación

Añadir tests de Deno para funciones Edge:

- Sanitizador rechaza `[{}]` para todos los tipos.
- `interactive_quiz` rechaza `paragraph` y acepta 4 ejercicios reales.
- `case_study` requiere escenario + pregunta/reflexión.
- `materialize_finalize` falla con curso vacío o lecciones incompatibles.
- `regenerate-lesson` no guarda salida inválida.

Validación manual posterior:

- Generar de nuevo el curso de seguridad industrial.
- Consultar DB y confirmar:
  - cero `content.blocks @> '[{}]'`;
  - cero `interactive_quiz` con bloques no interactivos;
  - todos los módulos tienen lecciones renderizables o fueron eliminados;
  - ningún curso dañado puede publicarse.

## Archivos principales a tocar

- `supabase/functions/generate-course/index.ts`
- `supabase/functions/regenerate-lesson/index.ts`
- `src/pages/admin/CourseStudio.tsx`
- `src/pages/admin/GenerateCourse.tsx`
- `src/App.tsx`
- `src/pages/admin/AdminCourses.tsx`
- `src/pages/admin/EditCourse.tsx`
- `src/lib/courseQuality.ts` nuevo
- `supabase/functions/_shared/course-quality.ts` nuevo
- Migración SQL opcional para `publish_course_if_valid` y/o metadatos de calidad

## Prioridad recomendada

1. Bloquear nuevas creaciones rotas: validador compartido + legacy desactivado.
2. Auditoría final real en `materialize_finalize`.
3. Bloquear publicación de cursos dañados.
4. Reforzar regeneración/reparación.
5. Mejorar UI granular.
6. Reparar cursos existentes.

Con esto Course Studio deja de depender de “que la IA se porte bien” y pasa a tener una capa determinista de calidad: si el contenido no es renderizable, no se guarda, no se publica y se informa exactamente qué falló.