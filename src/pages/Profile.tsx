import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap, Flame, Trophy, Award, BookOpen } from "lucide-react";

export default function Profile() {
  const { user, profile } = useAuth();
  const [completedCourses, setCompletedCourses] = useState(0);

  const level = profile?.level || 1;
  const xpTotal = profile?.xp_total || 0;
  const xpForNextLevel = level * 100;
  // XP progress within current level
  const xpInCurrentLevel = xpTotal - ((level - 1) * 100);
  const xpProgress = Math.min((xpInCurrentLevel / 100) * 100, 100);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      // Count distinct courses where the user has completed at least one lesson
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4 shadow-primary">
          {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <h1 className="text-2xl font-bold">{profile?.full_name || "Usuario"}</h1>
        <p className="text-muted-foreground">{user?.email}</p>
        {profile?.job_title && (
          <p className="text-sm text-muted-foreground mt-1">{profile.job_title}</p>
        )}
      </div>

      {/* Level Progress */}
      <Card className="shadow-card gradient-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Nivel {level}
            </span>
            <span className="text-sm text-muted-foreground">
              {xpInCurrentLevel} / 100 XP
            </span>
          </div>
          <Progress value={xpProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "XP Total", value: xpTotal, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
          { label: "Racha actual", value: `${profile?.current_streak || 0} días`, icon: Flame, color: "text-streak", bg: "bg-streak/10" },
          { label: "Mejor racha", value: `${profile?.longest_streak || 0} días`, icon: Award, color: "text-primary", bg: "bg-primary/10" },
          { label: "Cursos completados", value: completedCourses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
