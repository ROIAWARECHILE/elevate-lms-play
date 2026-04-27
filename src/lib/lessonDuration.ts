// =====================================================================
// Estimación de duración de una lección (microlearning enforce).
// Heurística simple basada en tipo y contenido — no necesita backend.
// =====================================================================
import { getLessonBlocks } from "@/lib/courseSchema";

const WORDS_PER_MIN = 200; // adulto leyendo en pantalla

export function estimateLessonMinutes(lesson: any): number {
  const type = lesson?.lesson_type || "reading";
  const blocks: any[] = getLessonBlocks(lesson);

  // Caso legacy: solo content.text
  if (blocks.length === 0 && typeof lesson?.content?.text === "string") {
    const w = lesson.content.text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(w / WORDS_PER_MIN));
  }

  let words = 0;
  let interactives = 0;

  for (const b of blocks) {
    switch (b.type) {
      case "heading":
      case "paragraph":
      case "callout":
      case "quote":
        words += String(b.text || b.title || "").split(/\s+/).filter(Boolean).length;
        break;
      case "term":
        words += String(b.term || "").split(/\s+/).length +
                 String(b.definition || "").split(/\s+/).length;
        break;
      case "step":
        words += String(b.title || "").split(/\s+/).length +
                 String(b.description || "").split(/\s+/).length;
        break;
      case "flashcard":
        words += String(b.front || "").split(/\s+/).length +
                 String(b.back || "").split(/\s+/).length;
        break;
      case "scenario":
      case "question":
      case "reflection":
        words += String(b.text || "").split(/\s+/).length;
        break;
      case "mc":
      case "true_false":
      case "fill_blank":
      case "match_pairs":
      case "order_steps":
      case "sort_into_buckets":
      case "highlight_terms":
      case "tap_to_complete":
        interactives += 1;
        break;
      case "video":
        interactives += 3; // ~1.5min por video
        break;
    }
  }

  const readingMin = words / WORDS_PER_MIN;
  const interactiveMin = interactives * 0.5; // ~30s por ejercicio
  const total = Math.ceil(readingMin + interactiveMin);

  // Microlearning: clamp 1..10
  return Math.max(1, Math.min(10, total));
}

/** ¿Esta lección excede el límite de microlearning (5 min)? */
export function isOverMicrolearning(lesson: any, maxMin = 5): boolean {
  return estimateLessonMinutes(lesson) > maxMin;
}
