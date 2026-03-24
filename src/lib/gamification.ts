import { supabase } from "@/integrations/supabase/client";

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
  const today = new Date().toISOString().split("T")[0];
  const lastActivity = currentProfile.last_activity_date;

  let newStreak = currentProfile.current_streak;
  if (lastActivity === today) {
    // Already active today, no streak change
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (lastActivity === yesterdayStr) {
      newStreak = currentProfile.current_streak + 1;
    } else {
      newStreak = 1;
    }
  }

  const newXpTotal = (currentProfile.xp_total || 0) + xpEarned;
  const newLevel = Math.floor(newXpTotal / 100) + 1;
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
