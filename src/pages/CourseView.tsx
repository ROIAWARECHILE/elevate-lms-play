import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, CheckCircle2, Lock, Clock, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";

interface Module {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  xp_reward: number;
  lessons: { id: string; title: string; sort_order: number }[];
}

export default function CourseView() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [courseRes, modulesRes, progressRes] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).single(),
        supabase.from("modules").select("*, lessons(id, title, sort_order)").eq("course_id", courseId).order("sort_order"),
        user
          ? supabase
              .from("user_progress")
              .select("lesson_id")
              .eq("user_id", user.id)
              .eq("course_id", courseId!)
              .eq("completed", true)
              .not("lesson_id", "is", null)
          : Promise.resolve({ data: [] }),
      ]);

      if (courseRes.data) setCourse(courseRes.data);
      if (modulesRes.data) {
        setModules(
          (modulesRes.data as any[]).map((m) => ({
            ...m,
            lessons: (m.lessons || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
          }))
        );
      }
      if (progressRes.data) {
        setCompletedLessons(new Set(progressRes.data.map((p: any) => p.lesson_id).filter(Boolean)));
      }
      setLoading(false);
    };
    fetch();
  }, [courseId, user]);

  if (loading) return null;

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const progressPct = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/app/courses"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a cursos
      </Link>

      {/* Course Header */}
      <div className="gradient-primary rounded-2xl p-8 text-primary-foreground">
        <Badge variant="secondary" className="mb-3">
          {course?.level === "beginner" ? "Básico" : course?.level === "intermediate" ? "Intermedio" : "Avanzado"}
        </Badge>
        <h1 className="text-3xl font-bold mb-2">{course?.title}</h1>
        <p className="text-primary-foreground/80 mb-4">{course?.description}</p>
        <div className="flex items-center gap-4 text-sm text-primary-foreground/70">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {course?.estimated_duration_minutes}min</span>
          <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> {course?.xp_reward} XP</span>
          <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {totalLessons} lecciones</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Progreso</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary-foreground rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Modules Path */}
      <div className="space-y-4">
        {modules.map((mod, mi) => {
          const modLessonsCompleted = mod.lessons.filter((l) => completedLessons.has(l.id)).length;
          const modComplete = modLessonsCompleted === mod.lessons.length && mod.lessons.length > 0;

          return (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: mi * 0.1 }}
            >
              <Card className={`shadow-card ${modComplete ? "border-success" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      modComplete ? "bg-success text-success-foreground" : "gradient-primary text-primary-foreground"
                    }`}>
                      {modComplete ? <CheckCircle2 className="w-5 h-5" /> : mi + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{mod.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {modLessonsCompleted}/{mod.lessons.length} lecciones · {mod.xp_reward} XP
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 ml-5 border-l-2 border-border pl-4">
                    {mod.lessons.map((lesson) => {
                      const done = completedLessons.has(lesson.id);
                      return (
                        <RouterLink
                          key={lesson.id}
                          to={`/app/courses/${courseId}/lessons/${lesson.id}`}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            done ? "text-success" : "hover:bg-muted"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                            {lesson.title}
                          </span>
                        </RouterLink>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
