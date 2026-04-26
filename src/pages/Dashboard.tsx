import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Flame, Zap, Target, TrendingUp, Users, Award, ArrowRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import { WalkthroughOverlay } from "@/components/WalkthroughOverlay";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { NumberTicker } from "@/components/magic/NumberTicker";
import { KibboExpression } from "@/components/KibboExpression";
import { StreakWidget } from "@/components/StreakWidget";
import { DailyQuestsWidget } from "@/components/DailyQuestsWidget";
import { Link } from "react-router-dom";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function ContinueLearningCard({ userId, companyId }: { userId: string; companyId: string }) {
  const [nextItem, setNextItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNext = async () => {
      const { data: lastProgress } = await supabase
        .from("user_progress")
        .select("course_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let targetCourseId = lastProgress?.course_id;

      if (!targetCourseId) {
        const { data: firstCourse } = await supabase
          .from("courses")
          .select("id")
          .eq("status", "published")
          .limit(1)
          .maybeSingle();
        targetCourseId = firstCourse?.id;
      }

      if (!targetCourseId) {
        setLoading(false);
        return;
      }

      const [courseRes, lessonsRes, completedRes] = await Promise.all([
        supabase.from("courses").select("id, title, cover_image_url").eq("id", targetCourseId).single(),
        supabase
          .from("lessons")
          .select("id, title, sort_order, module_id, modules(sort_order)")
          .eq("modules.course_id", targetCourseId)
          .order("sort_order"),
        supabase
          .from("user_progress")
          .select("lesson_id")
          .eq("user_id", userId)
          .eq("course_id", targetCourseId)
          .eq("completed", true),
      ]);

      const completedIds = new Set(completedRes.data?.map((p) => p.lesson_id) || []);
      const allLessons = (lessonsRes.data || []).filter((l: any) => l.modules);
      const nextLesson = allLessons.find((l: any) => !completedIds.has(l.id));

      if (courseRes.data && nextLesson) {
        setNextItem({
          course: courseRes.data,
          lesson: nextLesson,
          progress: allLessons.length > 0 ? (completedIds.size / allLessons.length) * 100 : 0,
        });
      }
      setLoading(false);
    };
    fetchNext();
  }, [userId, companyId]);

  if (loading || !nextItem) return null;

  return (
    <motion.div {...fadeIn} transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}>
      <Card className="shadow-card border-primary/20 overflow-hidden group hover:shadow-elevated transition-shadow duration-300">
        <div className="gradient-primary p-4 pb-3">
          <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">Continuar aprendiendo</p>
        </div>
        <CardContent className="p-5">
          <h3 className="font-bold text-lg mb-1">{nextItem.course.title}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Siguiente: {nextItem.lesson.title}
          </p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${nextItem.progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{Math.round(nextItem.progress)}%</span>
          </div>
          <Link to={`/app/courses/${nextItem.course.id}/lessons/${nextItem.lesson.id}`}>
            <Button className="w-full gradient-primary shadow-primary h-11 group-hover:shadow-elevated transition-shadow">
              <Play className="w-4 h-4 mr-2 fill-current" /> Continuar
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCard({ stat, index }: { stat: any; index: number }) {
  const isNumeric = typeof stat.value === "number";
  return (
    <motion.div
      {...fadeIn}
      transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ y: -2, scale: 1.02 }}
    >
      <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {isNumeric ? <NumberTicker value={stat.value} /> : stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CollaboratorDashboard({ profile }: { profile: any }) {
  const { user } = useAuth();
  const [coursesCount, setCoursesCount] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [dailyXp, setDailyXp] = useState(0);

  useEffect(() => {
    if (!user || !profile?.company_id) return;
    const fetchData = async () => {
      const [coursesRes, xpRes] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, cover_image_url, level, estimated_duration_minutes, xp_reward")
          .eq("status", "published"),
        supabase
          .from("user_xp_log")
          .select("xp_amount")
          .eq("user_id", user.id)
          .gte("created_at", new Date().toISOString().split("T")[0]),
      ]);
      if (coursesRes.data) {
        setCourses(coursesRes.data);
        setCoursesCount(coursesRes.data.length);
      }
      if (xpRes.data) setDailyXp(xpRes.data.reduce((sum, r) => sum + r.xp_amount, 0));
    };
    fetchData();
  }, [user, profile?.company_id]);

  const stats = [
    { label: "XP Total", value: profile?.xp_total || 0, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
    { label: "Racha", value: `${profile?.current_streak || 0} días`, icon: Flame, color: "text-streak", bg: "bg-streak/10" },
    { label: "Nivel", value: profile?.level || 1, icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
    { label: "Cursos", value: coursesCount, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <KibboExpression
          expression={(profile?.current_streak || 0) > 0 ? "determined" : "sleeping"}
          className="w-16 h-16 flex-shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold">¡Hola, {profile?.full_name?.split(" ")[0] || "Colaborador"}!</h1>
          <p className="text-muted-foreground">
            {(profile?.current_streak || 0) > 0
              ? `🔥 Racha de ${profile.current_streak} días — ¡sigue así!`
              : "Completa una lección hoy para iniciar tu racha."}
          </p>
        </div>
      </motion.div>

      {user && profile?.company_id && (
        <ContinueLearningCard userId={user.id} companyId={profile.company_id} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-walkthrough="stats">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StreakWidget
          currentStreak={profile?.current_streak || 0}
          longestStreak={profile?.longest_streak || 0}
          lastActivityDate={(profile as any)?.last_activity_date ?? null}
        />
        <DailyQuestsWidget />
      </div>

      <motion.div {...fadeIn} transition={{ delay: 0.5 }}>
        <Card className="shadow-card gradient-card" data-walkthrough="daily-goal">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Meta diaria
              </h3>
              <span className="text-sm text-muted-foreground">
                <AnimatedCounter value={dailyXp} duration={600} /> / 30 XP
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((dailyXp / 30) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Completa lecciones para alcanzar tu meta diaria de 30 XP</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.6 }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Cursos disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No tienes cursos asignados aún</p>
                <p className="text-sm">Tu admin te asignará cursos pronto.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.05 }}
                  >
                    <Link to={`/app/courses/${course.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground group-hover:scale-110 transition-transform duration-200">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{course.title}</p>
                        <p className="text-xs text-muted-foreground">{course.estimated_duration_minutes}min · {course.xp_reward} XP</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform duration-200" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ profile }: { profile: any }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, courses: 0 });

  useEffect(() => {
    if (!user || !profile?.company_id) return;
    const fetchStats = async () => {
      const [profilesRes, coursesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
      ]);
      setStats({ users: profilesRes.count || 0, courses: coursesRes.count || 0 });
    };
    fetchStats();
  }, [user, profile?.company_id]);

  const statItems = [
    { label: "Usuarios activos", value: stats.users, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Cursos publicados", value: stats.courses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
    { label: "Tasa de completación", value: "—", icon: TrendingUp, color: "text-xp", bg: "bg-xp/10" },
    { label: "Certificados emitidos", value: 0, icon: Award, color: "text-streak", bg: "bg-streak/10" },
  ];

  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-muted-foreground">Vista general de tu workspace Kibbo.</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>
      <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
        <Card className="shadow-card" data-walkthrough="admin-steps">
          <CardHeader><CardTitle className="text-lg">Primeros pasos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { step: "1", text: "Configura tu empresa", desc: "Nombre, logo y colores", done: false },
              { step: "2", text: "Crea tu primer curso", desc: "Añade módulos y lecciones", done: stats.courses > 0 },
              { step: "3", text: "Invita colaboradores", desc: "Tu equipo podrá empezar a aprender", done: stats.users > 1 },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className={`flex items-center gap-4 p-3 rounded-xl ${item.done ? "bg-success/10" : "bg-muted/50"}`}
              >
                <div className={`w-8 h-8 rounded-lg ${item.done ? "bg-success" : "gradient-primary"} flex items-center justify-center text-primary-foreground text-sm font-bold`}>
                  {item.done ? "✓" : item.step}
                </div>
                <div>
                  <p className={`font-medium text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  return (
    <>
      <WalkthroughOverlay isAdmin={isAdmin} />
      {isAdmin ? <AdminDashboard profile={profile} /> : <CollaboratorDashboard profile={profile} />}
    </>
  );
}
