// =====================================================================
// useDictionaryAutoIndex — al cargar una lección "concept", indexa sus
// términos en el diccionario de la compañía (idempotente).
// =====================================================================
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLessonBlocks } from "@/lib/courseSchema";

export function useDictionaryAutoIndex(lesson: any, courseId?: string | null) {
  const { profile } = useAuth();

  useEffect(() => {
    const run = async () => {
      if (!lesson || !profile?.company_id) return;
      if (lesson.lesson_type !== "concept") return;

      const blocks = getLessonBlocks(lesson).filter((b: any) => b.type === "term") as any[];
      if (blocks.length === 0) return;

      const rows = blocks
        .filter((b) => b.term && b.definition)
        .map((b) => ({
          company_id: profile.company_id!,
          course_id: courseId ?? null,
          lesson_id: lesson.id,
          term: String(b.term).trim(),
          definition: String(b.definition).trim(),
          example: b.example ? String(b.example).trim() : null,
        }));

      if (rows.length === 0) return;

      // Upsert por (lesson_id, term)
      try {
        await supabase
          .from("course_dictionary")
          .upsert(rows as any, { onConflict: "lesson_id,term" });
      } catch (e) {
        // silencioso: el indexado es best-effort
        console.warn("dictionary indexing failed", e);
      }
    };
    run();
  }, [lesson, profile?.company_id, courseId]);
}
