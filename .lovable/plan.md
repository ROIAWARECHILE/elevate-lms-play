## Auditoría de Course Studio

Revisé el wizard (`src/pages/admin/CourseStudio.tsx`) y la edge function (`supabase/functions/generate-course/index.ts` + `fetch-source`). Los 4 pasos (Fuentes → Brief → Outline → Generar) funcionan en el camino feliz, pero hay varios fallos reales y debilidades de UX que conviene reparar de una pasada.

### Problemas detectados

**Paso 0 — Fuentes**
- No hay límite de tamaño/tipo: un PDF >20 MB rompe la edge function silenciosamente al codificarlo en base64 dentro del payload.
- `addFiles` y `addExcel` no resetean el `<input file>`, así que no se puede volver a seleccionar el mismo archivo si se borró.
- No se valida que la URL sea http/https antes de invocar `fetch-source` (el backend ya lo valida pero el error llega tarde y feo).
- `addUrl` y `addText` no muestran feedback de éxito.

**Paso 1 — Brief**
- Si el brief queda vacío (sin conceptos/hechos) la UI lo deja pasar y el outline falla más adelante. Falta gate + aviso "material insuficiente, agregá más fuentes".
- El textarea de "refinar brief" en realidad no re-extrae: solo muta `userNotes` y se usará en el outline. La etiqueta confunde.

**Paso 2 — Outline**
- No se puede **agregar/eliminar** lecciones ni módulos, ni reordenar, ni editar el `objective`. El admin queda atado a lo que decidió la IA.
- Si el usuario edita títulos pero la IA luego materializa con `lesson.title` del outline, sí respeta el cambio (ok), pero **no hay forma de regenerar el outline** sin volver atrás y re-extraer.
- No hay validación: se podría avanzar con un módulo sin lecciones.

**Paso 3 — Generar**
- La barra de progreso está hardcoded a 66 %. Debería reflejar `mi+1 / totalModules`.
- Los errores por módulo solo se loguean a consola. Si **todos** los módulos fallan, igual se redirige al curso vacío.
- `materialize_init` inserta el `course` y los `modules` antes de generar lecciones; si el usuario cierra la pestaña a la mitad, queda un curso "draft" huérfano sin forma de retomar.
- `materialize_module` espera `Promise.all` de TODAS las lecciones del módulo en paralelo: con módulos de 5 lecciones se dispara la concurrencia del AI Gateway y suele tirar 429. Conviene limitar a 2 en paralelo.
- En `runMaterialize` el `catch` deja `step=2` pero no limpia el `courseId` parcial.

**Backend (`generate-course`)**
- `mode === "extract"` y `"outline"` no validan que `sources` no esté vacío → la IA igual responde algo, pero podría devolver brief inventado. Añadir guard.
- `stepMaterializeQuiz` se llama incluso si la IA falla en producir lecciones; ya está protegido por `inserted > 0`, ok.
- El cálculo `xp_reward: (outline.modules?.length || 3) * 50` se basa en módulos planeados; si luego se borran módulos vacíos, queda inflado. Recalcular al final.

### Cambios a realizar

**Frontend — `src/pages/admin/CourseStudio.tsx`**
1. Validar tamaño máximo por archivo (PDF 15 MB, imagen 8 MB, Excel 5 MB) y mostrar toast claro.
2. Validar URL http/https antes de invocar.
3. Resetear el `value` del input de archivo tras cargar.
4. Bloquear "Diseñar outline" si el brief tiene 0 conceptos + 0 hechos + 0 procedimientos; mostrar callout "Material insuficiente: agregá más fuentes o continuá bajo tu responsabilidad".
5. En el paso Outline: botones para **agregar lección**, **eliminar lección**, **eliminar módulo**, **reordenar** (↑/↓), y **regenerar outline** (vuelve a llamar `mode:"outline"` con `userNotes` actualizadas).
6. Validar antes de generar: cada módulo debe tener ≥1 lección; si no, deshabilitar "Generar".
7. Reemplazar la barra hardcoded por una real (`(mi+1)/totalModules * 100`) y mostrar lista de módulos con su estado (✓ generado / ⚠ omitido / ⏳ en curso).
8. Si **todos** los módulos terminan vacíos: borrar el curso draft vía RPC y mostrar error en lugar de redirigir.
9. Añadir botón "Cancelar generación" (best-effort: marca un flag y no procesa más módulos; el curso parcial se mantiene en draft).

**Backend — `supabase/functions/generate-course/index.ts`**
1. Validar `sources.length > 0` en `mode:"extract"`; rechazar con 400 si vacío.
2. Validar que el brief tenga al menos 1 concepto/hecho/procedimiento en `mode:"outline"`.
3. En `materialize_module`: limitar concurrencia a **2 lecciones en paralelo** (cola simple) para evitar 429.
4. Recalcular `xp_reward` y `estimated_duration_minutes` del curso al terminar, basados en módulos/lecciones realmente insertados (nuevo `mode:"materialize_finalize"` o hacerlo dentro del último módulo).
5. Filtrar bloques inválidos antes de insertar la lección (defensa extra).

**DB — migración**
- Nada estructural necesario; todo cabe en lo existente. Solo se añade un RPC opcional `delete_draft_course(_course_id uuid)` que el admin (creador) pueda llamar para limpiar drafts huérfanos al cancelar.

### Validación post-cambios
- Probar el flujo end-to-end con: (a) 1 PDF chico, (b) solo 1 nota de texto pegada (caso "material pobre"), (c) URL externa, (d) combinación PDF + Excel.
- Confirmar logs de la edge function (`generate-course`) sin 429 ni errores.
- Verificar que ningún módulo creado quede sin lecciones y que el curso final no tenga conteo de XP inflado.

¿Te parece bien con este alcance? Si querés, puedo recortar (p.ej. dejar fuera la edición de outline en este turno y hacerlo después) — avisame y arranco la implementación.
