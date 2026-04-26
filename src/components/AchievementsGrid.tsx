// Grid of all achievements showing locked/unlocked state — used in the Profile page.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
}

const ICON_MAP: Record<string, string> = {
  sparkles: "Sparkles",
  "book-open": "BookOpen",
  "graduation-cap": "GraduationCap",
  "check-circle": "CheckCircle",
  star: "Star",
  flame: "Flame",
  zap: "Zap",
  award: "Award",
  trophy: "Trophy",
};

function IconByName({ name, className }: { name: string; className?: string }) {
  const Comp = (LucideIcons as any)[ICON_MAP[name] ?? "Trophy"] ?? LucideIcons.Trophy;
  return <Comp className={className} />;
}

export function AchievementsGrid() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [catalogRes, ownedRes] = await Promise.all([
        supabase.from("achievements").select("*").order("sort_order"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
      ]);
      setAchievements((catalogRes.data as AchievementRow[]) ?? []);
      setUnlocked(new Set((ownedRes.data ?? []).map((r: any) => r.achievement_id)));
      setLoading(false);
    })();
  }, [user]);

  if (loading) return null;

  const unlockedCount = unlocked.size;
  const total = achievements.length;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <LucideIcons.Award className="w-5 h-5 text-primary" />
            Logros
          </CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {unlockedCount} / {total}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {achievements.map((a, i) => {
            const isUnlocked = unlocked.has(a.id);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className={cn(
                  "relative aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center transition-all",
                  isUnlocked
                    ? "gradient-card border border-primary/30 shadow-card"
                    : "bg-muted/30 border border-border opacity-60",
                )}
                title={`${a.name} — ${a.description}`}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-1",
                    isUnlocked ? "gradient-primary shadow-primary" : "bg-muted",
                  )}
                >
                  <IconByName
                    name={a.icon}
                    className={cn("w-5 h-5", isUnlocked ? "text-primary-foreground" : "text-muted-foreground")}
                  />
                </div>
                <p className={cn("text-[10px] font-semibold leading-tight line-clamp-2", isUnlocked ? "text-foreground" : "text-muted-foreground")}>
                  {a.name}
                </p>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
