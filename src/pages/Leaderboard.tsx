import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Zap, Medal } from "lucide-react";
import { motion } from "framer-motion";
import { LeaderboardRowSkeleton } from "@/components/SkeletonLoaders";

interface LeaderboardUser {
  id: string;
  full_name: string;
  xp_total: number;
  current_streak: number;
  level: number;
  avatar_url: string | null;
}

export default function Leaderboard() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!profile?.company_id) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, xp_total, current_streak, level, avatar_url")
        .eq("company_id", profile.company_id)
        .order("xp_total", { ascending: false })
        .limit(50);
      if (data) setUsers(data as LeaderboardUser[]);
      setLoading(false);
    };
    fetch();
  }, [profile?.company_id]);

  const medalColors = ["text-xp", "text-muted-foreground", "text-streak"];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-xp" /> Ranking
        </h1>
        <p className="text-muted-foreground">Los mejores aprendices de tu empresa.</p>
      </motion.div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <LeaderboardRowSkeleton key={i} />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>El ranking aparecerá cuando haya actividad.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                  whileHover={{ backgroundColor: "hsl(var(--accent) / 0.3)" }}
                  className={`flex items-center gap-4 p-4 transition-colors cursor-default ${
                    u.id === user?.id ? "bg-accent/50" : ""
                  }`}
                >
                  <span className="w-8 text-center font-bold text-lg">
                    {i < 3 ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", delay: i * 0.1 + 0.2 }}
                      >
                        <Medal className={`w-6 h-6 mx-auto ${medalColors[i]}`} />
                      </motion.div>
                    ) : (
                      <span className="text-muted-foreground">{i + 1}</span>
                    )}
                  </span>
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {u.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {u.full_name || "Usuario"}
                      {u.id === user?.id && (
                        <span className="text-primary text-xs ml-2">(Tú)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Nivel {u.level}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-xp font-semibold">
                      <Zap className="w-4 h-4" /> {u.xp_total}
                    </span>
                    <span className="flex items-center gap-1 text-streak">
                      <Flame className="w-4 h-4" /> {u.current_streak}d
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
