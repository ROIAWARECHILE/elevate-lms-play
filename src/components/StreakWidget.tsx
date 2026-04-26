// 7-day streak widget inspired by JetflowUX/7-days-streak.
// Shows a circular ring of progress + day-by-day calendar.
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { cn } from "@/lib/utils";

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  weekActivity?: boolean[]; // 7 booleans, mon..sun
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function inferWeekActivity(currentStreak: number, lastActivityDate: string | null): boolean[] {
  // Best-effort: assume the streak's last day is "today" if last_activity is today, otherwise yesterday.
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // 0=Mon..6=Sun
  const isToday = lastActivityDate === today.toISOString().slice(0, 10);
  const lastIdx = isToday ? todayIdx : (todayIdx - 1 + 7) % 7;
  const week = Array(7).fill(false);
  for (let i = 0; i < Math.min(currentStreak, 7); i += 1) {
    week[(lastIdx - i + 7) % 7] = true;
  }
  return week;
}

export function StreakWidget({ currentStreak, longestStreak, lastActivityDate, weekActivity }: StreakWidgetProps) {
  const week = weekActivity ?? inferWeekActivity(currentStreak, lastActivityDate);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const goal = 7;
  const progress = Math.min((currentStreak / goal) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 flex-shrink-0">
              <CircularProgressbarWithChildren
                value={progress}
                styles={buildStyles({
                  pathColor: "hsl(var(--streak))",
                  trailColor: "hsl(var(--muted))",
                  pathTransitionDuration: 1.2,
                })}
              >
                <Flame className="w-7 h-7 text-streak" />
                <span className="text-xl font-bold leading-none mt-1">{currentStreak}</span>
              </CircularProgressbarWithChildren>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1">
                {currentStreak === 0 ? "Empieza tu racha hoy" : `Racha de ${currentStreak} ${currentStreak === 1 ? "día" : "días"}`}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Mejor racha: <span className="font-medium text-foreground">{longestStreak} días</span>
              </p>
              <div className="flex gap-1.5">
                {week.map((active, i) => {
                  const isToday = i === todayIdx;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                          active
                            ? "bg-streak text-streak-foreground shadow-sm"
                            : "bg-muted text-muted-foreground",
                          isToday && !active && "ring-2 ring-streak/40",
                        )}
                      >
                        {active ? <Flame className="w-3.5 h-3.5" /> : DAY_LABELS[i]}
                      </motion.div>
                      <span className={cn("text-[10px]", isToday ? "text-streak font-semibold" : "text-muted-foreground")}>
                        {DAY_LABELS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
