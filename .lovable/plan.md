## Diagnóstico

El fallo principal no es solo de timeout: el pipeline actual acepta como “generadas” lecciones cuyos bloques no son renderizables. En la base se observan cursos recientes con `content.blocks` como `[{}]`, `[{}, {}]` o bloques tipo `paragraph` dentro de lecciones `interactive_quiz`; por eso la UI muestra “Sin ejercicios”, “Sin caso” o “Esta lección no tiene contenido”.

Causas probables detectadas:

1. **Validación demasiado débil antes de insertar**
   - `blocksAreValid()` acepta algunos casos sin comprobar campos mínimos. Por ejemplo `case_study` acepta un bloque `scenario` aunque esté vacío, e `interactive_quiz` acepta cualquier bloque con `type: "mc"` aunque no tenga pregunta/opciones/correct.
   - No existe normalización ni filtrado profundo de bloques antes de guardar.

2. **El modelo devuelve estructuras incompatibles con el renderer**
   - Se han guardado bloques `{}` y bloques de lectura dentro de `interactive_quiz`.
   - El prompt pide formatos, pero el schema de tool calling solo dice `items: { type: "object" }`; no fuerza propiedades por tipo.

3. **Se generan “quizzes” en dos capas sin garantía**
   - Hay lecciones `interactive_quiz` dentro del contenido del curso y además quizzes de módulo en tablas `quizzes/questions`.
   - Si falla la lección interactiva, el módulo puede quedar con contenido pobre aunque el quiz tabular exista.

4. **Se crean módulos shell antes de saber si tendrán contenido válido**
   - `materialize_init` inserta curso y módulos vacíos al inicio. Si varias lecciones fallan o el usuario cancela, quedan borradores parciales.

5. **Course Studio puede navegar a un curso “creado” aunque haya baja calidad**
   - Cuenta lecciones insertadas, pero no valida si cada módulo tiene mínimo de lecciones renderizables ni si las lecciones interactivas contienen ejercicios reales.

6. **Ruta legacy todavía puede crear cursos con lógica antigua**
   - `src/pages/admin/GenerateCourse.tsx` sigue llamando al modo legacy sin `mode`, que no usa las validaciones nuevas y puede guardar contenido menos estructurado.

## Objetivo de la corrección

Cambiar Course Studio de “insertar lo que devuelva la IA” a un pipeline transaccional por calidad:

```text
Fuentes -> Brief validado -> Outline validado -> Lección generada
                                      -> normalizar bloques
                                      -> validar renderizable
                                      -> reparar una vez si falla
                                      -> insertar solo si pasa
                               -> quiz módulo validado
                               -> finalizar/publicar como borrador solo si pasa umbral mínimo
```

## Plan de implementación

### 1. Endurecer la validación de bloques en `generate-course`

- Crear helpers por tipo:
  - `normalizeBlock(block)` para remover objetos vacíos y limpiar strings.
  - `validateReadingBlock`, `validateConceptBlock`, `validateInteractiveQuizBlock`, etc.
  - `sanitizeBlocksForLessonType(lessonType, blocks)` que devuelva solo bloques compatibles y completos.
- Reglas mínimas:
  - `concept`: al menos 2 términos con `term` + `definition`.
  - `steps`: al menos 3 pasos con `title` + `description`.
  - `case_study`: al menos 1 `scenario` con texto + 1 `question` o `reflection`.
  - `interactive_quiz`: al menos 4 ejercicios válidos; `mc` requiere pregunta, 3+ opciones y `correct` incluido en opciones; `true_false` requiere boolean; `match_pairs` requiere 3+ pares; etc.
  - `comparison`: tabla con headers y filas consistentes.
  - `reading`: al menos 2 bloques de texto real.
- Insertar en `lessons` únicamente los bloques saneados, nunca la salida cruda del modelo.

### 2. Añadir reparación automática antes de omitir una lección

- Si la primera generación no pasa validación:
  - Hacer un segundo intento con un prompt de reparación muy estricto.
  - Incluir el motivo de fallo: “faltan opciones”, “bloques vacíos”, “tipo incorrecto”, etc.
- Si sigue fallando:
  - No insertar la lección.
  - Devolver `{ inserted: 0, reason, validationErrors }` al frontend.

### 3. Cambiar el schema de tool calling para reducir salidas inválidas

- Separar la generación por tipo con schemas más específicos o un schema discriminado más estricto.
- Para `interactive_quiz`, exigir campos de cada ejercicio.
- Para `case_study`, exigir `scenario/question/reflection` con texto.
- Mantener el backend como fuente de verdad; aunque el modelo incumpla, la validación seguirá bloqueando contenido vacío.

### 4. Replantear el outline para evitar sobreprometer contenido

- Bajar la cantidad de lecciones por módulo cuando el brief sea pobre.
- No forzar `interactive_quiz` como lección si no hay suficiente material; en su lugar, el módulo tendrá su evaluación tabular si se puede generar.
- Guardar en cada lección del outline un `sourceEvidence` o `evidence_refs` simple con los conceptos/hechos/procedimientos que la respaldan.
- Antes de generar, validar que cada lección tenga objetivo y evidencia suficiente.

### 5. Finalización estricta del curso

- `materialize_finalize` debe auditar el curso completo antes de navegar:
  - contar módulos supervivientes;
  - contar lecciones renderizables;
  - contar quizzes con preguntas válidas;
  - detectar lecciones vacías o incompatibles.
- Si no alcanza el umbral mínimo:
  - borrar el draft automáticamente si es irrecuperable; o
  - dejarlo como draft “requiere revisión” y mostrar reporte, sin publicar ni navegar como éxito.
- Umbral propuesto:
  - mínimo 1 módulo;
  - mínimo 2 lecciones renderizables por módulo o 1 lección + quiz válido;
  - cero lecciones con `blocks: [{}]` o tipo incompatible.

### 6. Mejorar Course Studio UI para mostrar fallos reales

- En la pantalla de generación, mostrar por módulo:
  - lecciones generadas;
  - lecciones omitidas;
  - razón de omisión;
  - quiz creado/no creado.
- Si termina con advertencias, mostrar un resumen accionable en vez de “Curso creado” genérico.
- Agregar botón “Reintentar omitidas” cuando haya lecciones fallidas.

### 7. Unificar o retirar la ruta legacy `GenerateCourse`

- Redirigir `/app/admin/courses/generate` a Course Studio o actualizarla para usar el pipeline nuevo.
- Evitar que exista una segunda forma de crear cursos que salte validaciones.

### 8. Reparación de datos ya creados

- Añadir una acción de mantenimiento para cursos draft/publicados dañados:
  - detectar lecciones sin bloques renderizables;
  - regenerarlas con la edge function `regenerate-lesson` reforzada;
  - si no se pueden reparar, marcarlas/omitarlas y avisar.
- Como mínimo, aplicar reparación al curso reciente de “Política de seguridad...” que contiene múltiples lecciones vacías.

## Archivos a tocar

- `supabase/functions/generate-course/index.ts`
  - validación fuerte, saneamiento, reparación y finalización estricta.
- `src/pages/admin/CourseStudio.tsx`
  - reporte granular de generación y bloqueo de éxito falso.
- `src/pages/admin/GenerateCourse.tsx`
  - redirección o migración al pipeline nuevo.
- `supabase/functions/regenerate-lesson/index.ts`
  - reutilizar validadores o endurecer validación para reparar cursos dañados.
- Posible migración SQL opcional
  - añadir metadatos de calidad si queremos persistir `generation_status`, `validation_report` o `requires_review` en `courses.source_brief`/campo existente sin cambiar schema estructural.

## Validación posterior

- Probar con el caso actual de seguridad industrial y confirmar que:
  - ninguna lección guarda `blocks: [{}]`;
  - lecciones `interactive_quiz` renderizan ejercicios reales;
  - lecciones `case_study` renderizan escenario/preguntas;
  - módulos sin contenido se eliminan o quedan bloqueados con explicación;
  - Course Studio no muestra éxito si el curso queda vacío o incompleto.
- Consultar DB después de generar para verificar conteos de bloques renderizables por tipo.
- Revisar logs de `generate-course` para confirmar que los errores son explícitos y no silenciosos.