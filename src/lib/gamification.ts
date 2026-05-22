import { supabase } from "@/integrations/supabase/client";

export function getLocalDate(date?: Date): string {
  return (date || new Date()).toISOString().split('T')[0];
}

export function getYesterdayLocal(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

interface UpdateStreakAndLevelParams {
  userId: string;
  companyId: string;
  xpEarned: number;
  currentProfile: {
    xp_total: number;
    current_streak: number;
    longest_streak: number;
    last_activity_date: string | null;
    level: number;
  };
}

export async function updateStreakAndLevel({
  userId,
  companyId,
  xpEarned,
  currentProfile,
}: UpdateStreakAndLevelParams): Promise<{ newLevel: number; leveledUp: boolean }> {
  const today = getLocalDate();
  const lastActivity = currentProfile.last_activity_date;

  let newStreak = currentProfile.current_streak;
  if (lastActivity === today) {
    // Already active today, no streak change
  } else if (lastActivity === getYesterdayLocal()) {
    newStreak = currentProfile.current_streak + 1;
  } else {
    newStreak = 1;
  }

  const newXpTotal = (currentProfile.xp_total || 0) + xpEarned;
  // Curva exponencial: nivel N requiere 100*N^1.4 XP acumulado
  const xpForLevel = (n: number) => Math.round(100 * Math.pow(n, 1.4));
  let newLevel = 1;
  while (xpForLevel(newLevel + 1) <= newXpTotal) newLevel++;
  const leveledUp = newLevel > (currentProfile.level || 1);
  const newLongestStreak = Math.max(newStreak, currentProfile.longest_streak || 0);

  await supabase
    .from("profiles")
    .update({
      xp_total: newXpTotal,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      last_activity_date: today,
      level: newLevel,
    })
    .eq("id", userId);

  return { newLevel, leveledUp };
}

export async function checkDuplicateProgress(
  userId: string,
  field: "lesson_id" | "quiz_id",
  fieldValue: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_progress")
    .select("id")
    .eq("user_id", userId)
    .eq(field, fieldValue)
    .eq("completed", true)
    .maybeSingle();
  return !!data;
}
