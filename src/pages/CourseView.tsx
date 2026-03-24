import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Zap, Brain, Lock, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";

interface Quiz {
  id: string;
  title: string;
  module_id: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  xp_reward: number;
  lessons: { id: string; title: string; sort_order: number }[];
  quiz?: Quiz | null;
}

export default function CourseView() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [completedQuizzes, setCompletedQuizzes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [courseRes, modulesRes, progressRes] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).single(),
        supabase.from("modules").select("*, lessons(id, title, sort_order), quizzes(id, title, module_id)").eq("course_id", courseId).order("sort_order"),
        user
          ? supabase.from("user_progress").select("lesson_id, quiz_id").eq("user_id", user.id).eq("course_id", courseId!).eq("completed", true)
          : Promise.resolve({ data: [] }),
      ]);
      if (courseRes.data) setCourse(courseRes.data);
      if (modulesRes.data) {
        setModules(
          (modulesRes.data as any[]).map((m) => ({
            ...m,
            lessons: (m.lessons || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
            quiz: m.quizzes?.[0] || null,
          }))
        );
      }
      if (progressRes.data) {
        setCompletedLessons(new Set(progressRes.data.map((p: any) => p.lesson_id).filter(Boolean)));
        setCompletedQuizzes(new Set(progressRes.data.map((p: any) => p.quiz_id).filter(Boolean)));
      }
      setLoading(false);
    };
    fetch();
  }, [courseId, user]);

  if (loading) return null;

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const progressPct = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 0;

  // Build flat list of all nodes for path
  type PathNode = {
    type: "lesson" | "quiz" | "module-end";
    id: string;
    title: string;
    moduleTitle: string;
    moduleIndex: number;
    done: boolean;
    locked: boolean;
    link?: string;
  };

  const pathNodes: PathNode[] = [];
  modules.forEach((mod, mi) => {
    const allLessonsDone = mod.lessons.length > 0 && mod.lessons.every((l) => completedLessons.has(l.id));
    mod.lessons.forEach((lesson) => {
      pathNodes.push({
        type: "lesson",
        id: lesson.id,
        title: lesson.title,
        moduleTitle: mod.title,
        moduleIndex: mi,
        done: completedLessons.has(lesson.id),
        locked: false,
        link: `/app/courses/${courseId}/lessons/${lesson.id}`,
      });
    });
    if (mod.quiz) {
      const quizDone = completedQuizzes.has(mod.quiz.id);
      pathNodes.push({
        type: "quiz",
        id: mod.quiz.id,
        title: mod.quiz.title,
        moduleTitle: mod.title,
        moduleIndex: mi,
        done: quizDone,
        locked: !allLessonsDone,
        link: allLessonsDone ? `/app/courses/${courseId}/quiz/${mod.quiz.id}` : undefined,
      });
    }
  });

  // Find current active node (first non-completed, non-locked)
  const activeIndex = pathNodes.findIndex((n) => !n.done && !n.locked);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/app/courses"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a cursos
      </Link>

      {/* Course Header */}
      <div className="gradient-primary rounded-2xl p-6 md:p-8 text-primary-foreground">
        <Badge variant="secondary" className="mb-3">
          {course?.level === "beginner" ? "Básico" : course?.level === "intermediate" ? "Intermedio" : "Avanzado"}
        </Badge>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{course?.title}</h1>
        <p className="text-primary-foreground/80 mb-4 text-sm md:text-base">{course?.description}</p>
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

      {/* Visual Path — Duolingo style */}
      <div className="relative py-4">
        {/* Vertical connector line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2 z-0" />

        <div className="relative z-10 space-y-0">
          {pathNodes.map((node, i) => {
            const isActive = i === activeIndex;
            const isNewModule = i === 0 || node.moduleIndex !== pathNodes[i - 1].moduleIndex;
            // Zigzag offset
            const offset = i % 2 === 0 ? "-translate-x-8 md:-translate-x-12" : "translate-x-8 md:translate-x-12";

            return (
              <div key={`${node.type}-${node.id}`}>
                {/* Module header */}
                {isNewModule && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex justify-center mb-3 mt-2"
                  >
                    <span className="bg-muted text-muted-foreground text-xs font-semibold px-4 py-1.5 rounded-full">
                      {node.moduleTitle}
                    </span>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className={`flex justify-center py-2 ${offset}`}
                >
                  {node.locked ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground max-w-[100px] text-center truncate">{node.title}</span>
                    </div>
                  ) : (
                    <RouterLink to={node.link!} className="flex flex-col items-center gap-1 group">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all ${
                          node.done
                            ? "bg-success border-success/30"
                            : isActive
                            ? "gradient-primary border-primary/30 shadow-primary animate-pulse"
                            : "bg-muted border-border group-hover:border-primary/40"
                        }`}
                      >
                        {node.done ? (
                          <CheckCircle2 className="w-6 h-6 text-success-foreground" />
                        ) : node.type === "quiz" ? (
                          <Brain className={`w-6 h-6 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        ) : (
                          <BookOpen className={`w-6 h-6 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        )}
                      </div>
                      <span className={`text-[10px] max-w-[100px] text-center truncate ${
                        node.done ? "text-success font-medium" : isActive ? "text-primary font-semibold" : "text-muted-foreground"
                      }`}>
                        {node.title}
                      </span>
                    </RouterLink>
                  )}
                </motion.div>
              </div>
            );
          })}

          {/* Course completion crown */}
          {progressPct === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", delay: 0.5 }}
              className="flex justify-center pt-4"
            >
              <div className="w-16 h-16 rounded-full bg-xp/20 flex items-center justify-center border-4 border-xp/30">
                <Crown className="w-8 h-8 text-xp" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
