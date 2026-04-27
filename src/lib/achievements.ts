// Achievement evaluation engine. Runs after user progress events to unlock badges.
import { supabase } from "@/integrations/supabase/client";

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
}

interface UserStats {
  lessons_completed: number;
  quizzes_passed: number;
  perfect_quizzes: number;
  streak_days: number;
  xp_total: number;
  level: number;
  courses_completed: number;
  // PR7 — adaptive/SRS
  srs_strong: number;     // tarjetas con strength >= 0.8
  srs_reviews: number;    // total reviews acumuladas
  correct_streak: number; // máxima racha consecutiva de aciertos en SRS
}

async function fetchStats(userId: string): Promise<UserStats> {
  const [progressRes, profileRes, srsRes] = await Promise.all([
    supabase.from("user_progress").select("lesson_id, quiz_id, score, course_id, completed").eq("user_id", userId).eq("completed", true),
    supabase.from("profiles").select("current_streak, xp_total, level").eq("id", userId).single(),
    supabase.from("srs_items").select("strength, total_reviews, total_correct").eq("user_id", userId),
  ]);

  const rows = progressRes.data ?? [];
  const lessons = rows.filter((r) => r.lesson_id).length;
  const quizzes = rows.filter((r) => r.quiz_id);
  const passed = quizzes.filter((q) => (q.score ?? 0) >= 70).length;
  const perfect = quizzes.filter((q) => (q.score ?? 0) === 100).length;

  // Courses completed: a course is "completed" if all its lessons are done.
  // For simplicity here we count distinct course_ids that have any completed lesson — refine later.
  const courseIds = new Set(rows.filter((r) => r.course_id).map((r) => r.course_id as string));
  let coursesCompleted = 0;
  if (courseIds.size > 0) {
    for (const cid of Array.from(courseIds)) {
      const [{ count: total }, { count: done }] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, modules!inner(course_id)", { count: "exact", head: true })
          .eq("modules.course_id", cid),
        supabase
          .from("user_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("course_id", cid)
          .eq("completed", true)
          .not("lesson_id", "is", null),
      ]);
      if (total && done && done >= total) coursesCompleted += 1;
    }
  }

  return {
    lessons_completed: lessons,
    quizzes_passed: passed,
    perfect_quizzes: perfect,
    streak_days: profileRes.data?.current_streak ?? 0,
    xp_total: profileRes.data?.xp_total ?? 0,
    level: profileRes.data?.level ?? 1,
    courses_completed: coursesCompleted,
  };
}

export async function evaluateAchievements(userId: string, companyId: string): Promise<UnlockedAchievement[]> {
  const [statsP, catalogRes, ownedRes] = await Promise.all([
    fetchStats(userId),
    supabase.from("achievements").select("*"),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
  ]);

  const stats = statsP;
  const owned = new Set((ownedRes.data ?? []).map((r: any) => r.achievement_id));
  const unlocked: UnlockedAchievement[] = [];

  for (const a of catalogRes.data ?? []) {
    if (owned.has(a.id)) continue;
    const value = (stats as any)[a.requirement_type] ?? 0;
    if (value >= a.requirement_value) {
      const { error } = await supabase.from("user_achievements").insert({
        user_id: userId,
        company_id: companyId,
        achievement_id: a.id,
      });
      if (!error) {
        unlocked.push({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          xp_reward: a.xp_reward,
        });
      }
    }
  }
  return unlocked;
}
