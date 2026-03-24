import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Flame, Trophy, Award, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export default function Profile() {
  const { user, profile } = useAuth();
  const [completedCourses, setCompletedCourses] = useState(0);

  const level = profile?.level || 1;
  const xpTotal = profile?.xp_total || 0;
  const xpInCurrentLevel = xpTotal - ((level - 1) * 100);
  const xpProgress = Math.min((xpInCurrentLevel / 100) * 100, 100);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("completed", true)
        .not("course_id", "is", null);

      if (data) {
        const uniqueCourses = new Set(data.map((r) => r.course_id));
        setCompletedCourses(uniqueCourses.size);
      }
    };
    fetchStats();
  }, [user]);

  const stats = [
    { label: "XP Total", value: xpTotal, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
    { label: "Racha actual", value: profile?.current_streak || 0, icon: Flame, color: "text-streak", bg: "bg-streak/10", suffix: " días" },
    { label: "Mejor racha", value: profile?.longest_streak || 0, icon: Award, color: "text-primary", bg: "bg-primary/10", suffix: " días" },
    { label: "Cursos completados", value: completedCourses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4 shadow-primary"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
        >
          {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </motion.div>
        <h1 className="text-2xl font-bold">{profile?.full_name || "Usuario"}</h1>
        <p className="text-muted-foreground">{user?.email}</p>
        {profile?.job_title && (
          <p className="text-sm text-muted-foreground mt-1">{profile.job_title}</p>
        )}
      </motion.div>

      {/* Level Progress */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="shadow-card gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Nivel <AnimatedCounter value={level} duration={600} />
              </span>
              <span className="text-sm text-muted-foreground">
                <AnimatedCounter value={xpInCurrentLevel} duration={600} /> / 100 XP
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ y: -2, scale: 1.02 }}
          >
            <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    <AnimatedCounter value={stat.value} duration={800} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
