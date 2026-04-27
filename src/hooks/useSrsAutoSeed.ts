// =====================================================================
// Auto-siembra de tarjetas SRS desde una lección.
// Convierte concept/term/quiz_block en items dedupicados por hash.
// =====================================================================
import { useEffect, useRef } from "react";
import { useSRS, srsKey, type SrsEnqueueInput } from "@/hooks/useSRS";
import { getLessonBlocks } from "@/lib/courseSchema";

/**
 * Llamar tras completar una lección (o al abrirla en modo "estudiar").
 * Por defecto solo siembra al completarla — pásalo `whenCompleted=true`.
 */
export function useSrsAutoSeed(
  lesson: any | null,
  courseId?: string | null,
  trigger: boolean = false,
) {
  const { enqueueMany } = useSRS();
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!lesson || !trigger) return;
    const lessonId: string = lesson.id;
    if (seededFor.current === lessonId) return;
    seededFor.current = lessonId;

    const blocks = getLessonBlocks(lesson);
    const items: SrsEnqueueInput[] = [];

    for (const b of blocks as any[]) {
      // Conceptos / términos
      if (b.type === "term") {
        items.push({
          itemType: "concept",
          itemKey: srsKey(["term", b.term, b.definition]),
          payload: {
            kind: "term",
            question: `¿Qué significa: ${b.term}?`,
            answer: b.definition,
            hint: b.example,
          },
          courseId, lessonId,
        });
      }
      // Quiz blocks: cada uno se convierte en una tarjeta de retrieval
      if (b.type === "mc") {
        items.push({
          itemType: "quiz_block",
          itemKey: srsKey(["mc", b.question, b.correct]),
          payload: {
            kind: "mc",
            question: b.question,
            options: b.options,
            correct: b.correct,
            explanation: b.explanation,
          },
          courseId, lessonId,
        });
      }
      if (b.type === "true_false") {
        items.push({
          itemType: "quiz_block",
          itemKey: srsKey(["tf", b.question, String(b.correct)]),
          payload: {
            kind: "true_false",
            question: b.question,
            correct: b.correct,
            explanation: b.explanation,
          },
          courseId, lessonId,
        });
      }
      if (b.type === "fill_blank") {
        const correct = Array.isArray(b.correct) ? b.correct.join(" / ") : b.correct;
        items.push({
          itemType: "quiz_block",
          itemKey: srsKey(["fb", b.sentence, String(correct)]),
          payload: {
            kind: "fill_blank",
            sentence: b.sentence,
            correct: b.correct,
            explanation: b.explanation,
          },
          courseId, lessonId,
        });
      }
      if (b.type === "match_pairs") {
        items.push({
          itemType: "quiz_block",
          itemKey: srsKey(["mp", JSON.stringify(b.pairs)]),
          payload: {
            kind: "match_pairs",
            pairs: b.pairs,
            explanation: b.explanation,
          },
          courseId, lessonId,
        });
      }
      if (b.type === "order_steps") {
        items.push({
          itemType: "quiz_block",
          itemKey: srsKey(["os", JSON.stringify(b.steps)]),
          payload: {
            kind: "order_steps",
            steps: b.steps,
            explanation: b.explanation,
          },
          courseId, lessonId,
        });
      }
    }

    if (items.length > 0) {
      enqueueMany(items);
    }
  }, [lesson, trigger, courseId, enqueueMany]);
}
