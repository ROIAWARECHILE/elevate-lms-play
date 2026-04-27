// =====================================================================
// useSkillProfile — perfil adaptativo del usuario para un curso.
// =====================================================================
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DifficultyPref = "beginner" | "intermediate" | "advanced";

export interface SkillProfile {
  user_id: string;
  course_id: string;
  mastery: number;            // 0..1
  difficulty_preference: DifficultyPref;
  total_items: number;
  updated_at: string;
}

/**
 * Lee (y refresca) el perfil de habilidad del usuario para un curso.
 * Si todavía no existe → devuelve un perfil "beginner" por defecto.
 */
export function useSkillProfile(courseId: string | null | undefined) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !courseId) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_skill_profile")
      .select("*")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (data) {
      setProfile(data as unknown as SkillProfile);
    } else {
      setProfile({
        user_id: user.id,
        course_id: courseId,
        mastery: 0,
        difficulty_preference: "beginner",
        total_items: 0,
        updated_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [user, courseId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}
