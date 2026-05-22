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
  // SRS
  srs_strong: number;
  srs_reviews: number;
  correct_streak: number;
  // Logros avanzados
  quiz_perfect_no_hint: number;   // quizzes al 100% sin pistas
  quiz_high_streak: number;       // quizzes seguidas con >=90%
  fast_quiz_passed: number;       // quizzes en <60s con >=80%
  early_bird_lessons: number;     // lecciones completadas 5am-7am
  night_owl_lessons: number;      // lecciones completadas 10pm-12am
  comeback_quizzes: number;       // quiz donde mejoró de <50% a >=90%
}

async function fetchStats(userId: string): Promise<UserStats> {
  const [progressRes, profileRes, srsRes, quizResultsRes, progressTimeRes] = await Promise.all([
    supabase.from("user_progress").select("lesson_id, quiz_id, score, course_id, completed").eq("user_id", userId).eq("completed", true),
    supabase.from("profiles").select("current_streak, xp_total, level").eq("id", userId).single(),
    supabase.from("srs_items").select("strength, total_reviews, total_correct").eq("user_id", userId),
    supabase.from("user_quiz_results").select("score, time_ms, used_hints, quiz_id").eq("user_id", userId),
    supabase.from("user_progress").select("lesson_id, completed_at").eq("user_id", userId).eq("completed", true).not("lesson_id", "is", null),
  ]);

  const rows = progressRes.data ?? [];
  const lessons = rows.filter((r) => r.lesson_id).length;
  const quizzes = rows.filter((r) => r.quiz_id);
  const passed = quizzes.filter((q) => (q.score ?? 0) >= 70).length;
  const perfect = quizzes.filter((q) => (q.score ?? 0) === 100).length;

  // Logros avanzados
  const quizResults = (quizResultsRes.data ?? []) as Array<{ score: number; time_ms: number | null; used_hints: boolean | null; quiz_id: string }>;
  const quizPerfectNoHint = quizResults.filter((r) => r.score === 100 && !r.used_hints).length;
  const fastQuizPassed = quizResults.filter((r) => r.score >= 80 && r.time_ms != null && r.time_ms < 60000).length;

  // Racha de quizzes >=90%
  let highStreak = 0, currentHighStreak = 0;
  for (const r of quizResults) {
    if (r.score >= 90) { currentHighStreak++; highStreak = Math.max(highStreak, currentHighStreak); }
    else currentHighStreak = 0;
  }

  // Lecciones por hora del día
  const progressTimes = (progressTimeRes.data ?? []) as Array<{ lesson_id: string; completed_at: string }>;
  let earlyBird = 0, nightOwl = 0;
  for (const p of progressTimes) {
    const hour = new Date(p.completed_at).getHours();
    if (hour >= 5 && hour < 7) earlyBird++;
    if (hour >= 22 && hour < 24) nightOwl++;
  }

  // Comeback: quiz donde mejoró de <50% a >=90% (mismo quiz_id)
  const byQuiz = new Map<string, number[]>();
  for (const r of quizResults) {
    if (!byQuiz.has(r.quiz_id)) byQuiz.set(r.quiz_id, []);
    byQuiz.get(r.quiz_id)!.push(r.score);
  }
  let comebacks = 0;
  for (const scores of byQuiz.values()) {
    if (scores.length >= 2 && scores[0] < 50 && Math.max(...scores.slice(1)) >= 90) comebacks++;
  }

  // Courses completed: a course is "completed" if all its lessons are done.
  // For simplicity here we count distinct course_ids that have any completed lesson — refine later.
  // 1 query agrupada en lugar de N*2 queries en loop
  const courseIds = new Set(rows.filter((r) => r.course_id).map((r) => r.course_id as string));
  let coursesCompleted = 0;
  if (courseIds.size > 0) {
    const [totalRes, doneRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, modules!inner(course_id)")
        .in("modules.course_id", Array.from(courseIds)),
      supabase
        .from("user_progress")
        .select("course_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .not("lesson_id", "is", null)
        .in("course_id", Array.from(courseIds)),
    ]);
    const totalByCourse = new Map<string, number>();
    for (const l of totalRes.data ?? []) {
      const cid = (l as any).modules?.course_id;
      if (cid) totalByCourse.set(cid, (totalByCourse.get(cid) ?? 0) + 1);
    }
    const doneByCourse = new Map<string, number>();
    for (const p of doneRes.data ?? []) {
      const cid = p.course_id as string;
      if (cid) doneByCourse.set(cid, (doneByCourse.get(cid) ?? 0) + 1);
    }
    for (const cid of courseIds) {
      const total = totalByCourse.get(cid) ?? 0;
      const done = doneByCourse.get(cid) ?? 0;
      if (total > 0 && done >= total) coursesCompleted += 1;
    }
  }

  const srsRows = (srsRes.data ?? []) as Array<{ strength: number; total_reviews: number; total_correct: number }>;
  const srsStrong = srsRows.filter((r) => (r.strength ?? 0) >= 0.8).length;
  const srsReviews = srsRows.reduce((acc, r) => acc + (r.total_reviews ?? 0), 0);
  // Aproximación de "racha de aciertos": máximo total_correct de un solo item.
  const correctStreak = srsRows.reduce((acc, r) => Math.max(acc, r.total_correct ?? 0), 0);

  return {
    lessons_completed: lessons,
    quizzes_passed: passed,
    perfect_quizzes: perfect,
    streak_days: profileRes.data?.current_streak ?? 0,
    xp_total: profileRes.data?.xp_total ?? 0,
    level: profileRes.data?.level ?? 1,
    courses_completed: coursesCompleted,
    srs_strong: srsStrong,
    srs_reviews: srsReviews,
    correct_streak: correctStreak,
    quiz_perfect_no_hint: quizPerfectNoHint,
    quiz_high_streak: highStreak,
    fast_quiz_passed: fastQuizPassed,
    early_bird_lessons: earlyBird,
    night_owl_lessons: nightOwl,
    comeback_quizzes: comebacks,
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
