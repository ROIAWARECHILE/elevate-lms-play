import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Loader2, Zap } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { XpAnimation } from "@/components/XpAnimation";
import { LevelUpModal } from "@/components/LevelUpModal";
import { ConfettiEffect } from "@/components/ConfettiEffect";
import { updateStreakAndLevel, checkDuplicateProgress } from "@/lib/gamification";
import { LessonSkeleton } from "@/components/SkeletonLoaders";
import { useSoundEffects } from "@/hooks/useSoundEffects";

export default function LessonView() {
  const { courseId, lessonId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showXp, setShowXp] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      const [lessonRes, progressRes] = await Promise.all([
        supabase.from("lessons").select("*, modules(id, course_id, title)").eq("id", lessonId).single(),
        user
          ? supabase
              .from("user_progress")
              .select("id")
              .eq("user_id", user.id)
              .eq("lesson_id", lessonId!)
              .eq("completed", true)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (lessonRes.data) setLesson(lessonRes.data);
      setCompleted(!!progressRes.data);
      setLoading(false);
    };
    fetch();
  }, [lessonId, user]);

  const completeLesson = async () => {
    if (!user || !profile || completed) return;
    setCompleting(true);

    try {
      const isDuplicate = await checkDuplicateProgress(user.id, "lesson_id", lessonId!);
      if (isDuplicate) {
        setCompleted(true);
        setCompleting(false);
        return;
      }

      const xpReward = lesson.xp_reward || 10;

      await supabase.from("user_progress").insert({
        user_id: user.id,
        company_id: profile.company_id!,
        course_id: courseId!,
        module_id: lesson.module_id,
        lesson_id: lessonId!,
        completed: true,
        xp_earned: xpReward,
        completed_at: new Date().toISOString(),
      });

      await supabase.from("user_xp_log").insert({
        user_id: user.id,
        company_id: profile.company_id!,
        xp_amount: xpReward,
        source: "lesson",
        source_id: lessonId!,
      });

      const result = await updateStreakAndLevel({
        userId: user.id,
        companyId: profile.company_id!,
        xpEarned: xpReward,
        currentProfile: {
          xp_total: profile.xp_total || 0,
          current_streak: profile.current_streak || 0,
          longest_streak: profile.longest_streak || 0,
          last_activity_date: (profile as any).last_activity_date,
          level: profile.level || 1,
        },
      });

      setCompleted(true);
      setShowXp(true);
      setShowConfetti(true);

      if (result.leveledUp) {
        setNewLevel(result.newLevel);
        setTimeout(() => setShowLevelUp(true), 1200);
      }

      await refreshProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <LessonSkeleton />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ConfettiEffect trigger={showConfetti} />
      <XpAnimation amount={lesson?.xp_reward || 10} show={showXp} onComplete={() => setShowXp(false)} />
      <LevelUpModal show={showLevelUp} level={newLevel} onClose={() => setShowLevelUp(false)} />

      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          to={`/app/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al curso
        </Link>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
        <Card className="shadow-card">
          <CardContent className="p-8">
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-1">{lesson?.modules?.title}</p>
              <h1 className="text-2xl font-bold">{lesson?.title}</h1>
            </div>

            <div className="prose prose-sm max-w-none mb-8">
              {lesson?.content?.blocks && Array.isArray(lesson.content.blocks) && lesson.content.blocks.length > 0 ? (
                lesson.content.blocks.map((block: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                  >
                    {block.type === "heading" ? (
                      <h3 className="text-lg font-bold text-foreground mt-4 mb-2">{block.text}</h3>
                    ) : (
                      <p className="text-foreground leading-relaxed mb-3">{block.text}</p>
                    )}
                  </motion.div>
                ))
              ) : lesson?.content?.text ? (
                <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {lesson.content.text}
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  Esta lección no tiene contenido todavía.
                </p>
              )}
            </div>

            {completed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-success/10 text-success"
              >
                <KibboExpression expression="thumbsup" className="w-12 h-12 flex-shrink-0" />
                <div>
                  <p className="font-semibold">¡Lección completada!</p>
                  <p className="text-sm opacity-80">Has ganado {lesson?.xp_reward || 10} XP</p>
                </div>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={completeLesson}
                  className="w-full gradient-primary shadow-primary h-12 text-base animate-pulse-glow"
                  disabled={completing}
                >
                  {completing ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-5 h-5 mr-2" />
                  )}
                  Completar lección (+{lesson?.xp_reward || 10} XP)
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
