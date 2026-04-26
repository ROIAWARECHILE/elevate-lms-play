// Modal shown when one or more achievements are unlocked.
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { fireStars, fireSchool } from "@/lib/celebrate";
import type { UnlockedAchievement } from "@/lib/achievements";

interface Props {
  achievements: UnlockedAchievement[];
  onClose: () => void;
}

function IconByName({ name, className }: { name: string; className?: string }) {
  const map: Record<string, string> = {
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
  const Comp = (LucideIcons as any)[map[name] ?? "Trophy"] ?? LucideIcons.Trophy;
  return <Comp className={className} />;
}

export function AchievementUnlockModal({ achievements, onClose }: Props) {
  const open = achievements.length > 0;

  useEffect(() => {
    if (open) {
      fireSchool();
      setTimeout(() => fireStars(null), 400);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {achievements.length === 1 ? "¡Logro desbloqueado!" : `¡${achievements.length} logros desbloqueados!`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <AnimatePresence>
            {achievements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center gap-4 p-4 rounded-2xl gradient-card border border-primary/20"
              >
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: i * 0.15 + 0.1, type: "spring", stiffness: 200 }}
                  className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-primary flex-shrink-0"
                >
                  <IconByName name={a.icon} className="w-7 h-7 text-primary-foreground" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <p className="text-xs text-xp font-semibold mt-1">+{a.xp_reward} XP</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <Button onClick={onClose} className="w-full gradient-primary shadow-primary">
          ¡Genial!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
