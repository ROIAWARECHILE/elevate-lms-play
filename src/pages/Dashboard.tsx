import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, Flame, Zap, Target, TrendingUp, Users, Award } from "lucide-react";
import { motion } from "framer-motion";
import { WalkthroughOverlay } from "@/components/WalkthroughOverlay";
import { Link } from "react-router-dom";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function CollaboratorDashboard({ profile }: { profile: any }) {
  const { user } = useAuth();
  const [coursesCount, setCoursesCount] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [dailyXp, setDailyXp] = useState(0);

  useEffect(() => {
    if (!user || !profile?.company_id) return;

    const fetchData = async () => {
      const [coursesRes, progressRes, xpRes] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, cover_image_url, level, estimated_duration_minutes, xp_reward")
          .eq("status", "published"),
        supabase
          .from("user_progress")
          .select("course_id")
          .eq("user_id", user.id)
          .eq("completed", true)
          .not("course_id", "is", null),
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

      const uniqueCompleted = new Set(progressRes.data?.map((p) => p.course_id) || []);

      if (xpRes.data) {
        setDailyXp(xpRes.data.reduce((sum, r) => sum + r.xp_amount, 0));
      }
    };
    fetchData();
  }, [user, profile?.company_id]);

  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <div>
        <h1 className="text-2xl font-bold">
          ¡Hola, {profile?.full_name?.split(" ")[0] || "Colaborador"}! 👋
        </h1>
        <p className="text-muted-foreground">Continúa tu aprendizaje donde lo dejaste.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-walkthrough="stats">
        {[
          { label: "XP Total", value: profile?.xp_total || 0, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
          { label: "Racha", value: `${profile?.current_streak || 0} días`, icon: Flame, color: "text-streak", bg: "bg-streak/10" },
          { label: "Nivel", value: profile?.level || 1, icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
          { label: "Cursos", value: coursesCount, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeIn} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Cursos disponibles
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
                {courses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/app/courses/${course.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.estimated_duration_minutes}min · {course.xp_reward} XP
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.5 }}>
        <Card className="shadow-card gradient-card" data-walkthrough="daily-goal">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Meta diaria
              </h3>
              <span className="text-sm text-muted-foreground">{dailyXp} / 30 XP</span>
            </div>
            <Progress value={Math.min((dailyXp / 30) * 100, 100)} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              Completa lecciones para alcanzar tu meta diaria de 30 XP
            </p>
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
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile.company_id),
        supabase
          .from("courses")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
      ]);
      setStats({
        users: profilesRes.count || 0,
        courses: coursesRes.count || 0,
      });
    };
    fetchStats();
  }, [user, profile?.company_id]);

  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <div>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-muted-foreground">Vista general de tu workspace Kibbo.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Usuarios activos", value: stats.users, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Cursos publicados", value: stats.courses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
          { label: "Tasa de completación", value: "—", icon: TrendingUp, color: "text-xp", bg: "bg-xp/10" },
          { label: "Certificados emitidos", value: 0, icon: Award, color: "text-streak", bg: "bg-streak/10" },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeIn} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
        <Card className="shadow-card" data-walkthrough="admin-steps">
          <CardHeader>
            <CardTitle className="text-lg">Primeros pasos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { step: "1", text: "Configura tu empresa", desc: "Nombre, logo y colores", done: false },
              { step: "2", text: "Crea tu primer curso", desc: "Añade módulos y lecciones", done: stats.courses > 0 },
              { step: "3", text: "Invita colaboradores", desc: "Tu equipo podrá empezar a aprender", done: stats.users > 1 },
            ].map((item) => (
              <div key={item.step} className={`flex items-center gap-4 p-3 rounded-xl ${item.done ? "bg-success/10" : "bg-muted/50"}`}>
                <div className={`w-8 h-8 rounded-lg ${item.done ? "bg-success" : "gradient-primary"} flex items-center justify-center text-primary-foreground text-sm font-bold`}>
                  {item.done ? "✓" : item.step}
                </div>
                <div>
                  <p className={`font-medium text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
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
      {isAdmin
        ? <AdminDashboard profile={profile} />
        : <CollaboratorDashboard profile={profile} />}
    </>
  );
}
