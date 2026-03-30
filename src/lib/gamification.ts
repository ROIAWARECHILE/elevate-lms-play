import { supabase } from "@/integrations/supabase/client";

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDate(d);
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
