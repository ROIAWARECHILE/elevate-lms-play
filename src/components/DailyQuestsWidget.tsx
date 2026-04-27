// Duolingo-style daily quests widget with 3 rotating missions.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, BookOpen, Zap, CheckCircle2, Trophy, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fireFromButton } from "@/lib/celebrate";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface DailyQuest {
  id: string;
  quest_type: string;
  target_value: number;
  current_value: number;
  xp_reward: number;
  claimed: boolean;
}

const QUEST_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  lessons: { label: "Completa lecciones", icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
  xp: { label: "Gana XP", icon: Zap, color: "text-xp", bg: "bg-xp/10" },
  quiz: { label: "Aprueba un quiz", icon: Trophy, color: "text-success", bg: "bg-success/10" },
  srs: { label: "Repasa tarjetas", icon: Brain, color: "text-accent", bg: "bg-accent/10" },
};

export function DailyQuestsWidget() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.rpc("ensure_daily_quests");
      if (error) {
        console.error("daily quests", error);
        setLoading(false);
        return;
      }
      setQuests((data as DailyQuest[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const claim = async (quest: DailyQuest, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (!user || !profile?.company_id) return;
    setClaiming(quest.id);
    try {
      const { error: updErr } = await supabase
        .from("daily_quests")
        .update({ claimed: true })
        .eq("id", quest.id)
        .eq("user_id", user.id);
      if (updErr) throw updErr;

      // Award XP
      await supabase.from("user_xp_log").insert({
        user_id: user.id,
        company_id: profile.company_id,
        xp_amount: quest.xp_reward,
        source: "daily_quest",
        source_id: null,
      });
      const newXp = (profile.xp_total || 0) + quest.xp_reward;
      const newLevel = Math.floor(newXp / 100) + 1;
      await supabase.from("profiles").update({ xp_total: newXp, level: newLevel }).eq("id", user.id);

      setQuests((qs) => qs.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q)));
      fireFromButton(ev.currentTarget, 50);
      toast({ title: "¡Misión reclamada!", description: `+${quest.xp_reward} XP` });
      await refreshProfile();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (quests.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Misiones diarias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {quests.map((quest, idx) => {
            const meta = QUEST_META[quest.quest_type] ?? QUEST_META.lessons;
            const pct = Math.min((quest.current_value / quest.target_value) * 100, 100);
            const ready = quest.current_value >= quest.target_value && !quest.claimed;
            const Icon = meta.icon;
            return (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
              >
                <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{meta.label}</p>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {quest.current_value}/{quest.target_value}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${quest.claimed ? "bg-success" : "gradient-primary"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 + idx * 0.08 }}
                    />
                  </div>
                </div>
                {quest.claimed ? (
                  <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                ) : ready ? (
                  <Button
                    size="sm"
                    className="gradient-primary h-8 text-xs"
                    disabled={claiming === quest.id}
                    onClick={(e) => claim(quest, e)}
                  >
                    {claiming === quest.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `+${quest.xp_reward} XP`}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">+{quest.xp_reward} XP</span>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
