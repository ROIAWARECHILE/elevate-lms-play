import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
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
import { AchievementUnlockModal } from "@/components/AchievementUnlockModal";
import { updateStreakAndLevel, checkDuplicateProgress } from "@/lib/gamification";
import { LessonSkeleton } from "@/components/SkeletonLoaders";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { fireSchool, fireFromButton } from "@/lib/celebrate";
import { evaluateAchievements, type UnlockedAchievement } from "@/lib/achievements";
import { LessonRenderer } from "@/components/lesson/LessonRenderer";
import { getLessonTypeMeta } from "@/lib/courseSchema";
import { Badge } from "@/components/ui/badge";
import { useDictionaryAutoIndex } from "@/hooks/useDictionaryAutoIndex";

export default function LessonView() {
  const { courseId, lessonId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playXp } = useSoundEffects();
  const [lesson, setLesson] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showXp, setShowXp] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);

  useHotkeys("left", () => navigate(-1), { preventDefault: true });
  useDictionaryAutoIndex(lesson, courseId);

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
      fireSchool();
      playXp();

      if (result.leveledUp) {
        setNewLevel(result.newLevel);
        setTimeout(() => setShowLevelUp(true), 1200);
      }

      // Update daily quests
      try {
        await supabase.rpc("increment_quest_progress", { _quest_type: "lessons", _amount: 1 });
        await supabase.rpc("increment_quest_progress", { _quest_type: "xp", _amount: xpReward });
      } catch (e) { /* ignore */ }

      await refreshProfile();

      // Evaluate achievements
      const newly = await evaluateAchievements(user.id, profile.company_id!);
      if (newly.length > 0) setTimeout(() => setUnlocked(newly), 1500);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <LessonSkeleton />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <XpAnimation amount={lesson?.xp_reward || 10} show={showXp} onComplete={() => setShowXp(false)} />
      <LevelUpModal show={showLevelUp} level={newLevel} onClose={() => setShowLevelUp(false)} />
      <AchievementUnlockModal achievements={unlocked} onClose={() => setUnlocked([])} />

      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          to={`/app/courses/${courseId}`}
          state={{ restoreActiveNode: true }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al curso
        </Link>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
        <Card className="shadow-card">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-muted-foreground">{lesson?.modules?.title}</p>
                {lesson?.lesson_type && lesson.lesson_type !== "reading" && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {getLessonTypeMeta(lesson.lesson_type).label}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold">{lesson?.title}</h1>
            </div>

            <div className="mb-8">
              <LessonRenderer lesson={lesson} />
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
