// =====================================================================
// useMistakes — guardar y consultar errores marcados por el alumno
// =====================================================================
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type MistakePayload = {
  lessonId?: string | null;
  courseId?: string | null;
  blockType: string;
  question: string;
  userAnswer?: string | null;
  correctAnswer: string;
  explanation?: string | null;
};

export function useMistakes() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const _persist = useCallback(
    async (payload: MistakePayload) => {
      if (!user || !profile?.company_id) return false;
      try {
        const { data: existing } = await supabase
          .from("user_mistakes")
          .select("id, times_failed")
          .eq("user_id", user.id)
          .eq("lesson_id", payload.lessonId ?? null as any)
          .eq("question", payload.question)
          .eq("correct_answer", payload.correctAnswer)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("user_mistakes")
            .update({
              times_failed: (existing.times_failed ?? 1) + 1,
              last_failed_at: new Date().toISOString(),
              mastered: false,
              user_answer: payload.userAnswer ?? null,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("user_mistakes").insert({
            user_id: user.id,
            company_id: profile.company_id,
            lesson_id: payload.lessonId ?? null,
            course_id: payload.courseId ?? null,
            block_type: payload.blockType,
            question: payload.question,
            user_answer: payload.userAnswer ?? null,
            correct_answer: payload.correctAnswer,
            explanation: payload.explanation ?? null,
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [user, profile],
  );

  const addMistake = useCallback(
    async (payload: MistakePayload) => {
      const ok = await _persist(payload);
      if (ok) {
        toast({ title: "Añadido a repaso", description: "Lo encontrarás en Repasar errores." });
      } else {
        toast({ title: "No se pudo añadir", variant: "destructive" });
      }
      return ok;
    },
    [_persist, toast],
  );

  /** Igual que addMistake pero sin toast — para registro automático tras 2 fallos. */
  const addMistakeSilent = useCallback(
    (payload: MistakePayload) => _persist(payload),
    [_persist],
  );

  return { addMistake, addMistakeSilent };
}
