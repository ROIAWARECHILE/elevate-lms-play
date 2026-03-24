import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Zap, RotateCcw, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { XpAnimation } from "@/components/XpAnimation";
import { LevelUpModal } from "@/components/LevelUpModal";
import { updateStreakAndLevel, checkDuplicateProgress } from "@/lib/gamification";

interface Question {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  sort_order: number;
}

export default function QuizView() {
  const { courseId, quizId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [alreadyPassed, setAlreadyPassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showXp, setShowXp] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      const [quizRes, questionsRes, progressRes] = await Promise.all([
        supabase.from("quizzes").select("*, modules(id, course_id, title)").eq("id", quizId).single(),
        supabase.from("questions").select("*").eq("quiz_id", quizId!).order("sort_order"),
        user
          ? supabase
              .from("user_progress")
              .select("id, score")
              .eq("user_id", user.id)
              .eq("quiz_id", quizId!)
              .eq("completed", true)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (quizRes.data) setQuiz(quizRes.data);
      if (questionsRes.data) {
        setQuestions(
          (questionsRes.data as any[]).map((q) => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : [],
          }))
        );
      }
      setAlreadyPassed(!!progressRes.data);
      setLoading(false);
    };
    fetch();
  }, [quizId, user]);

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correct_answer;
  const progressPct = questions.length > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / questions.length) * 100 : 0;

  // Use ref to track correct count reliably across React state batching
  const correctCountRef = { current: correctCount };

  const handleAnswer = (answer: string) => {
    if (showFeedback) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    if (answer === currentQuestion.correct_answer) {
      const newCount = correctCount + 1;
      setCorrectCount(newCount);
      correctCountRef.current = newCount;
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      const finalCorrect = correctCountRef.current;
      setFinished(true);
      saveResult(finalCorrect);
    }
  };

  const saveResult = async (finalCorrect: number) => {
    if (!user || !profile) return;

    // Duplicate protection
    const isDuplicate = await checkDuplicateProgress(user.id, "quiz_id", quizId!);
    if (isDuplicate) return;

    const score = Math.round((finalCorrect / questions.length) * 100);
    const passed = score >= (quiz?.passing_score || 70);

    try {
      await supabase.from("user_progress").insert({
        user_id: user.id,
        company_id: profile.company_id!,
        course_id: courseId!,
        module_id: quiz?.module_id,
        quiz_id: quizId!,
        completed: true,
        score,
        xp_earned: passed ? (quiz?.xp_reward || 25) : 0,
        completed_at: new Date().toISOString(),
      });

      if (passed) {
        const xpReward = quiz?.xp_reward || 25;
        await supabase.from("user_xp_log").insert({
          user_id: user.id,
          company_id: profile.company_id!,
          xp_amount: xpReward,
          source: "quiz",
          source_id: quizId!,
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

        setShowXp(true);
        if (result.leveledUp) {
          setNewLevel(result.newLevel);
          setTimeout(() => setShowLevelUp(true), 1200);
        }

        await refreshProfile();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setCorrectCount(0);
    setFinished(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const finalScore = Math.round((correctCount / questions.length) * 100);
  const passed = finalScore >= (quiz?.passing_score || 70);

  if (finished) {
    return (
      <div className="max-w-lg mx-auto">
        <XpAnimation amount={quiz?.xp_reward || 25} show={showXp} onComplete={() => setShowXp(false)} />
        <LevelUpModal show={showLevelUp} level={newLevel} onClose={() => setShowLevelUp(false)} />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="shadow-card overflow-hidden">
            <div className={`p-8 text-center ${passed ? "gradient-primary" : "bg-destructive"} text-primary-foreground`}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                {passed ? <Trophy className="w-16 h-16 mx-auto mb-4" /> : <XCircle className="w-16 h-16 mx-auto mb-4" />}
              </motion.div>
              <h2 className="text-2xl font-bold mb-1">{passed ? "¡Felicidades!" : "¡Sigue practicando!"}</h2>
              <p className="text-primary-foreground/80">{passed ? "Has aprobado el quiz" : "No alcanzaste la nota mínima"}</p>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{finalScore}%</p>
                  <p className="text-xs text-muted-foreground">Puntaje</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{correctCount}/{questions.length}</p>
                  <p className="text-xs text-muted-foreground">Correctas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-xp">{passed ? `+${quiz?.xp_reward || 25}` : "0"}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>
              <div className="flex gap-3">
                {!passed && (
                  <Button variant="outline" className="flex-1" onClick={restart}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reintentar
                  </Button>
                )}
                <Button className="flex-1 gradient-primary" onClick={() => navigate(`/app/courses/${courseId}`)}>
                  Volver al curso
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const options = currentQuestion?.question_type === "true_false" ? ["Verdadero", "Falso"] : currentQuestion?.options || [];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/app/courses/${courseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <Progress value={progressPct} className="h-3" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{currentIndex + 1}/{questions.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <Card className="shadow-card">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-lg font-semibold leading-snug">{currentQuestion?.question_text}</h2>
              <div className="space-y-3">
                {options.map((option: string, idx: number) => {
                  let style = "border-border hover:border-primary/50 hover:bg-primary/5";
                  if (showFeedback) {
                    if (option === currentQuestion.correct_answer) {
                      style = "border-success bg-success/10 text-success";
                    } else if (option === selectedAnswer && !isCorrect) {
                      style = "border-destructive bg-destructive/10 text-destructive";
                    } else {
                      style = "border-border opacity-50";
                    }
                  } else if (option === selectedAnswer) {
                    style = "border-primary bg-primary/10";
                  }
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      disabled={showFeedback}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium ${style}`}
                      whileTap={!showFeedback ? { scale: 0.98 } : {}}
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option}
                        {showFeedback && option === currentQuestion.correct_answer && <CheckCircle2 className="w-5 h-5 ml-auto text-success" />}
                        {showFeedback && option === selectedAnswer && !isCorrect && option !== currentQuestion.correct_answer && <XCircle className="w-5 h-5 ml-auto text-destructive" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {showFeedback && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-xl ${isCorrect ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  <p className="font-semibold">{isCorrect ? "¡Correcto! 🎉" : "Incorrecto 😕"}</p>
                  {!isCorrect && <p className="text-sm mt-1 opacity-80">La respuesta correcta era: {currentQuestion.correct_answer}</p>}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {showFeedback && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button onClick={handleNext} className="w-full gradient-primary h-12 text-base">
            {currentIndex < questions.length - 1 ? "Siguiente pregunta" : "Ver resultados"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
