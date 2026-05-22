import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Flame, Zap, Target, TrendingUp, Users, Award, ArrowRight, Play, Clock, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { WalkthroughOverlay } from "@/components/WalkthroughOverlay";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { NumberTicker } from "@/components/magic/NumberTicker";
import { KibboExpression } from "@/components/KibboExpression";
import { StreakWidget } from "@/components/StreakWidget";
import { DailyQuestsWidget } from "@/components/DailyQuestsWidget";
import { PracticeCTA } from "@/components/PracticeCTA";
import { Link, useNavigate } from "react-router-dom";

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
        // Calcular progreso del módulo específico
        const moduleId = nextLesson.module_id;
        const moduleLessons = allLessons.filter((l: any) => l.module_id === moduleId);
        const moduleCompleted = moduleLessons.filter((l: any) => completedIds.has(l.id)).length;
        const moduleTitle = (nextLesson as any).modules?.title || "";

        setNextItem({
          course: courseRes.data,
          lesson: nextLesson,
          progress: allLessons.length > 0 ? (completedIds.size / allLessons.length) * 100 : 0,
          moduleProgress: { done: moduleCompleted, total: moduleLessons.length, title: moduleTitle },
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
          <p className="text-sm text-muted-foreground mb-1">
            Siguiente: {nextItem.lesson.title}
          </p>
          {nextItem.moduleProgress && (
            <p className="text-xs text-muted-foreground/70 mb-3">
              Lección {nextItem.moduleProgress.done + 1} de {nextItem.moduleProgress.total}
              {nextItem.moduleProgress.title ? ` · ${nextItem.moduleProgress.title}` : ""}
            </p>
          )}
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

function EmptyCoursesState({ firstName }: { firstName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="shadow-card border-dashed border-2 border-primary/20">
        <CardContent className="p-10 flex flex-col items-center text-center gap-4">
          <KibboExpression expression="sleeping" className="w-24 h-24" />
          <div>
            <h2 className="text-xl font-bold mb-1">
              ¡Hola{firstName ? `, ${firstName}` : ""}! Tu espacio está listo.
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Tu empresa aún no ha publicado cursos. En cuanto estén disponibles aparecerán aquí y podrás empezar a aprender.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md mt-2">
            {[
              { icon: Zap, label: "Gana XP", desc: "Por cada lección completada", color: "text-xp bg-xp/10" },
              { icon: Flame, label: "Mantén tu racha", desc: "Estudia todos los días", color: "text-streak bg-streak/10" },
              { icon: Trophy, label: "Sube de nivel", desc: "Desbloquea logros", color: "text-primary bg-primary/10" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/40">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ¿Tienes dudas? Contacta al administrador de tu empresa.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function WeakTopicsWidget({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [recommendedModule, setRecommendedModule] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    supabase
      .from("user_mistakes" as any)
      .select("id, question, block_type, times_failed, lesson_id")
      .eq("user_id", userId)
      .eq("mastered", false)
      .order("times_failed", { ascending: false })
      .limit(5)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        setMistakes(data.slice(0, 3));
        // Encontrar el módulo con más errores
        const lessonIds = data.map((m: any) => m.lesson_id).filter(Boolean);
        if (lessonIds.length > 0) {
          const { data: lessons } = await supabase
            .from("lessons")
            .select("id, module_id, modules(id, title)")
            .in("id", lessonIds);
          if (lessons && lessons.length > 0) {
            const moduleCounts = new Map<string, { title: string; count: number }>();
            for (const l of lessons as any[]) {
              const mid = l.modules?.id;
              const mtitle = l.modules?.title;
              if (mid) moduleCounts.set(mid, { title: mtitle, count: (moduleCounts.get(mid)?.count ?? 0) + 1 });
            }
            const top = Array.from(moduleCounts.entries()).sort((a, b) => b[1].count - a[1].count)[0];
            if (top) setRecommendedModule({ id: top[0], title: top[1].title });
          }
        }
      });
  }, [userId]);

  if (mistakes.length === 0) return null;

  return (
    <motion.div {...fadeIn} transition={{ delay: 0.45 }}>
      <Card className="shadow-card border-destructive/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" /> Temas a reforzar
            </h3>
            <span className="text-xs text-muted-foreground">{mistakes.length} pendiente{mistakes.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2 mb-3">
            {mistakes.map((m: any) => (
              <div key={m.id} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive/60 flex-shrink-0 mt-1.5" />
                <span className="text-muted-foreground leading-snug flex-1 line-clamp-1">{m.question}</span>
                <span className="text-xs text-destructive/70 flex-shrink-0 font-medium">×{m.times_failed}</span>
              </div>
            ))}
          </div>
          {recommendedModule && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <BookOpen className="w-3 h-3 flex-shrink-0" />
              Recomendado: repasa <span className="font-medium text-foreground">{recommendedModule.title}</span>
            </p>
          )}
          <Button size="sm" variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => navigate("/app/practice")}>
            Practicar ahora
          </Button>
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
  const [loadingCourses, setLoadingCourses] = useState(true);

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
      setLoadingCourses(false);
    };
    fetchData();
  }, [user, profile?.company_id]);

  const stats = [
    { label: "XP Total", value: profile?.xp_total || 0, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
    { label: "Racha", value: `${profile?.current_streak || 0} días`, icon: Flame, color: "text-streak", bg: "bg-streak/10" },
    { label: "Nivel", value: profile?.level || 1, icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
    { label: "Cursos", value: coursesCount, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
  ];

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const hasCourses = !loadingCourses && courses.length > 0;
  const noCourses = !loadingCourses && courses.length === 0;

  if (noCourses) {
    return (
      <div className="space-y-6" data-walkthrough="dashboard">
        <EmptyCoursesState firstName={firstName} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <KibboExpression
          expression={(profile?.current_streak || 0) > 0 ? "determined" : "sleeping"}
          className="w-16 h-16 flex-shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold">¡Hola, {firstName || "Colaborador"}!</h1>
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

      <PracticeCTA />

      {user && <WeakTopicsWidget userId={user.id} />}

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
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published").eq("company_id", profile.company_id),
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
