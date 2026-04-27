// =====================================================================
// useSRS — repetición espaciada (cliente)
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hash determinista barato: convierte el contenido de un ítem en una clave
 * estable para deduplicar entre lecciones distintas que repiten el mismo
 * concepto. No es criptográfico, solo dedup.
 */
export function srsKey(parts: (string | undefined | null)[]): string {
  const s = parts.filter(Boolean).join("|").toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return "k_" + (h >>> 0).toString(36);
}

/** Convierte una respuesta del usuario en quality SM-2 (0..5). */
export function quality({
  correct,
  hadHint = false,
  attempts = 1,
  timeMs,
}: {
  correct: boolean;
  hadHint?: boolean;
  attempts?: number;
  timeMs?: number;
}): number {
  if (!correct && attempts >= 2) return 0;
  if (!correct) return 2;
  // Correcto:
  if (hadHint) return 3;
  if (attempts > 1) return 3;
  if (timeMs && timeMs < 4000) return 5;
  return 4;
}

export type SrsItem = {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson_id: string | null;
  item_type: string;
  item_key: string;
  payload: any;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  strength: number;
  next_review_at: string;
  total_reviews: number;
  total_correct: number;
};

export type SrsEnqueueInput = {
  itemType: "concept" | "quiz_block" | "term" | "mistake";
  itemKey: string;
  payload: Record<string, any>;
  courseId?: string | null;
  lessonId?: string | null;
};

export function useSRS() {
  const { user } = useAuth();

  const enqueue = useCallback(async (input: SrsEnqueueInput) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("srs_enqueue", {
      _item_type: input.itemType,
      _item_key: input.itemKey,
      _payload: input.payload,
      _course_id: input.courseId ?? null,
      _lesson_id: input.lessonId ?? null,
    });
    if (error) {
      console.warn("srs_enqueue", error.message);
      return null;
    }
    return data as string;
  }, [user]);

  const enqueueMany = useCallback(async (items: SrsEnqueueInput[]) => {
    const out: string[] = [];
    for (const it of items) {
      const id = await enqueue(it);
      if (id) out.push(id);
    }
    return out;
  }, [enqueue]);

  const review = useCallback(async (itemId: string, q: number) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("srs_review", {
      _item_id: itemId,
      _quality: q,
    });
    if (error) {
      console.warn("srs_review", error.message);
      return null;
    }
    return data as SrsItem;
  }, [user]);

  const getDue = useCallback(async (limit = 10, courseId?: string) => {
    if (!user) return [];
    const { data, error } = await supabase.rpc("srs_get_due", {
      _limit: limit,
      _course_id: courseId ?? null,
    });
    if (error) {
      console.warn("srs_get_due", error.message);
      return [];
    }
    return (data ?? []) as SrsItem[];
  }, [user]);

  return { enqueue, enqueueMany, review, getDue };
}

/** Devuelve cuántas tarjetas vencidas hay para el usuario (poll cada 60s). */
export function useSrsDueCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("srs_due_count");
    setCount(typeof data === "number" ? data : 0);
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { count, refresh };
}
