import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Zap, Brain, Lock, Crown, Trophy, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";
import { CoursePathSkeleton } from "@/components/SkeletonLoaders";
import { KibboExpression, KibboExpressionType } from "@/components/KibboExpression";

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

type PathNode = {
  type: "lesson" | "quiz";
  id: string;
  title: string;
  moduleTitle: string;
  moduleIndex: number;
  done: boolean;
  locked: boolean;
  link?: string;
};

function CourseHeader({ course, totalLessons, progressPct }: { course: any; totalLessons: number; progressPct: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-navy rounded-2xl p-6 md:p-8 text-navy-foreground"
    >
      <Badge variant="secondary" className="mb-3">
        {course?.level === "beginner" ? "Básico" : course?.level === "intermediate" ? "Intermedio" : "Avanzado"}
      </Badge>
      <h1 className="text-2xl md:text-3xl font-bold mb-2">{course?.title}</h1>
      <p className="text-navy-foreground/80 mb-4 text-sm md:text-base">{course?.description}</p>
      <div className="flex items-center gap-4 text-sm text-navy-foreground/70">
        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {course?.estimated_duration_minutes}min</span>
        <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> {course?.xp_reward} XP</span>
        <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {totalLessons} lecciones</span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Progreso</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 bg-navy-foreground/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function ModuleHeader({ title, description, moduleIndex, isCompleted, xpReward }: {
  title: string;
  description: string;
  moduleIndex: number;
  isCompleted: boolean;
  xpReward: number;
}) {
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-xs rounded-2xl border border-success/30 bg-success/10 p-4 text-center"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-success/20 mb-2"
        >
          <Trophy className="w-5 h-5 text-success" />
        </motion.div>
        <p className="text-sm font-bold text-success">¡Módulo completado!</p>
        <p className="text-xs text-success/80 mt-0.5">{title}</p>
        <div className="flex items-center justify-center gap-1 mt-1 text-xs text-xp font-semibold">
          <Zap className="w-3 h-3" /> +{xpReward} XP
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto max-w-xs rounded-2xl gradient-navy p-4 text-center text-navy-foreground"
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        <Star className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">Unidad {moduleIndex + 1}</span>
      </div>
      <p className="text-sm font-bold">{title}</p>
      {description && <p className="text-xs text-navy-foreground/70 mt-0.5">{description}</p>}
    </motion.div>
  );
}

function PathNodeComponent({ node, isActive, index, xOffset, activeIndex }: {
  node: PathNode;
  isActive: boolean;
  index: number;
  xOffset: number;
  activeIndex: number;
}) {
  const kibboExpression: KibboExpressionType = isActive ? "determined" : "celebrating";
  const showKibbo = isActive;
  const kibboSide = xOffset > 0 ? "left" : "right";

  const nodeContent = node.locked ? (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-4 border-border opacity-50">
        <Lock className="w-5 h-5 text-muted-foreground" />
      </div>
      <span className="text-[11px] text-muted-foreground/60 max-w-[100px] text-center truncate">{node.title}</span>
    </div>
  ) : (
    <RouterLink to={node.link!} className="flex flex-col items-center gap-1.5 group">
      <div className="relative">
          <motion.div
            className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all ${
              node.done
                ? "bg-accent border-accent/30"
                : isActive
                ? "gradient-primary border-primary/30 shadow-primary animate-pulse-glow"
                : "bg-card border-border group-hover:border-accent/40"
            }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {node.done ? (
            <CheckCircle2 className="w-7 h-7 text-accent-foreground" />
          ) : node.type === "quiz" ? (
            <Brain className={`w-7 h-7 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
          ) : (
            <BookOpen className={`w-7 h-7 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
          )}
        </motion.div>
      </div>
      <span className={`text-[11px] max-w-[100px] text-center truncate font-medium ${
        node.done ? "text-accent" : isActive ? "text-primary font-bold" : "text-muted-foreground"
      }`}>
        {node.title}
      </span>
      {isActive && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground bg-primary px-3 py-0.5 rounded-full"
        >
          Empezar
        </motion.span>
      )}
    </RouterLink>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 20 }}
      className="relative flex justify-center"
      style={{ marginLeft: `${xOffset}px` }}
    >
      {showKibbo && (
        <motion.div
          initial={{ opacity: 0, x: kibboSide === "left" ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, type: "spring" }}
          className={`absolute top-0 ${kibboSide === "left" ? "-left-20 md:-left-24" : "-right-20 md:-right-24"} flex flex-col items-center`}
        >
          <div className="relative">
            <KibboExpression expression={kibboExpression} className="w-14 h-14 md:w-16 md:h-16" />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl px-2 py-1 text-[10px] font-medium text-foreground whitespace-nowrap shadow-elevated"
            >
              ¡Tú puedes! 💪
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-card border-b border-r border-border rotate-45" />
            </motion.div>
          </div>
        </motion.div>
      )}
      {nodeContent}
    </motion.div>
  );
}

function SvgConnectors({ nodes, nodeSpacing }: { nodes: PathNode[]; nodeSpacing: number }) {
  const getX = (i: number) => 160 + Math.sin(i * 0.7) * 90;
  const getY = (i: number) => 40 + i * nodeSpacing;

  return (
    <svg
      className="absolute inset-0 w-full pointer-events-none"
      style={{ height: nodes.length * nodeSpacing + 40 }}
      preserveAspectRatio="none"
    >
      {nodes.map((node, i) => {
        if (i === 0) return null;
        const prev = nodes[i - 1];
        const bothDone = prev.done && node.done;
        const x1 = getX(i - 1);
        const y1 = getY(i - 1);
        const x2 = getX(i);
        const y2 = getY(i);
        const midY = (y1 + y2) / 2;

        return (
          <motion.path
            key={`connector-${i}`}
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            stroke={bothDone ? "hsl(var(--accent))" : "hsl(var(--border))"}
            strokeWidth={bothDone ? 3 : 2}
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          />
        );
      })}
    </svg>
  );
}

export default function CourseView() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [completedQuizzes, setCompletedQuizzes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
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
    fetchData();
  }, [courseId, user]);

  // Auto-scroll to active node after data loads
  useEffect(() => {
    if (!loading && activeNodeRef.current) {
      const timer = setTimeout(() => {
        activeNodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) return <CoursePathSkeleton />;

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const progressPct = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 0;

  // Build path nodes grouped by module
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

  const activeIndex = pathNodes.findIndex((n) => !n.done && !n.locked);
  const nodeSpacing = 90;

  // Check which modules are fully completed
  const moduleCompletion = modules.map((mod) => {
    const allLessonsDone = mod.lessons.length > 0 && mod.lessons.every((l) => completedLessons.has(l.id));
    const quizDone = mod.quiz ? completedQuizzes.has(mod.quiz.id) : true;
    return allLessonsDone && quizDone;
  });

  // Build render groups: module headers interspersed with nodes
  type RenderItem =
    | { type: "moduleHeader"; moduleIndex: number; title: string; description: string; isCompleted: boolean; xpReward: number }
    | { type: "node"; node: PathNode; globalIndex: number };

  const renderItems: RenderItem[] = [];
  let globalIdx = 0;
  pathNodes.forEach((node, i) => {
    const isNewModule = i === 0 || node.moduleIndex !== pathNodes[i - 1].moduleIndex;
    if (isNewModule) {
      const mod = modules[node.moduleIndex];
      renderItems.push({
        type: "moduleHeader",
        moduleIndex: node.moduleIndex,
        title: mod.title,
        description: mod.description || "",
        isCompleted: moduleCompletion[node.moduleIndex],
        xpReward: mod.xp_reward,
      });
    }
    renderItems.push({ type: "node", node, globalIndex: globalIdx });
    globalIdx++;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          to="/app/courses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a cursos
        </Link>
      </motion.div>

      <CourseHeader course={course} totalLessons={totalLessons} progressPct={progressPct} />

      {/* Duolingo-style Path */}
      <div className="relative py-8 overflow-hidden">
        <div className="relative flex flex-col items-center gap-2">
          {renderItems.map((item, idx) => {
            if (item.type === "moduleHeader") {
              return (
                <div key={`mod-header-${item.moduleIndex}`} className="py-4 w-full">
                  <ModuleHeader
                    title={item.title}
                    description={item.description}
                    moduleIndex={item.moduleIndex}
                    isCompleted={item.isCompleted}
                    xpReward={item.xpReward}
                  />
                </div>
              );
            }

            const { node, globalIndex } = item;
            const xOffset = Math.sin(globalIndex * 0.7) * 90;
            const isActive = globalIndex === activeIndex;

            return (
              <div key={`${node.type}-${node.id}`} className="py-3" ref={isActive ? activeNodeRef : undefined}>
                <PathNodeComponent
                  node={node}
                  isActive={isActive}
                  index={globalIndex}
                  xOffset={xOffset}
                  activeIndex={activeIndex}
                />
              </div>
            );
          })}

          {progressPct === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", delay: 0.5 }}
              className="flex flex-col items-center gap-3 pt-6"
            >
              <div className="w-20 h-20 rounded-full bg-xp/20 flex items-center justify-center border-4 border-xp/30">
                <Crown className="w-10 h-10 text-xp" />
              </div>
              <KibboExpression expression="celebrating" className="w-20 h-20" />
              <p className="text-sm font-bold text-foreground">¡Curso completado! 🎉</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
