import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function LessonView() {
  const { courseId, lessonId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);

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
      // Insert progress
      await supabase.from("user_progress").insert({
        user_id: user.id,
        company_id: profile.company_id!,
        course_id: courseId!,
        module_id: lesson.module_id,
        lesson_id: lessonId!,
        completed: true,
        xp_earned: lesson.xp_reward || 10,
        completed_at: new Date().toISOString(),
      });

      // Log XP
      await supabase.from("user_xp_log").insert({
        user_id: user.id,
        company_id: profile.company_id!,
        xp_amount: lesson.xp_reward || 10,
        source: "lesson",
        source_id: lessonId!,
      });

      // Update profile XP
      await supabase
        .from("profiles")
        .update({ xp_total: (profile.xp_total || 0) + (lesson.xp_reward || 10) })
        .eq("id", user.id);

      setCompleted(true);
      await refreshProfile();
      toast({
        title: `+${lesson.xp_reward || 10} XP ⚡`,
        description: "¡Lección completada!",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to={`/app/courses/${courseId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al curso
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card">
          <CardContent className="p-8">
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-1">{lesson?.modules?.title}</p>
              <h1 className="text-2xl font-bold">{lesson?.title}</h1>
            </div>

            {/* Lesson Content */}
            <div className="prose prose-sm max-w-none mb-8">
              {lesson?.content?.text ? (
                <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {lesson.content.text}
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  Esta lección no tiene contenido todavía.
                </p>
              )}
            </div>

            {/* Complete Button */}
            {completed ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 text-success">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <p className="font-semibold">¡Lección completada!</p>
                  <p className="text-sm opacity-80">Has ganado {lesson?.xp_reward || 10} XP</p>
                </div>
              </div>
            ) : (
              <Button
                onClick={completeLesson}
                className="w-full gradient-primary shadow-primary h-12 text-base"
                disabled={completing}
              >
                {completing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                Completar lección (+{lesson?.xp_reward || 10} XP)
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
