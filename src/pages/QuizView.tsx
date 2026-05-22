import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Zap, RotateCcw, Lightbulb, BookOpen, Clock, Target } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { XpAnimation } from "@/components/XpAnimation";
import { LevelUpModal } from "@/components/LevelUpModal";
import { AchievementUnlockModal } from "@/components/AchievementUnlockModal";
import { NumberTicker } from "@/components/magic/NumberTicker";
import { updateStreakAndLevel } from "@/lib/gamification";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { fireSchool } from "@/lib/celebrate";
import { evaluateAchievements, type UnlockedAchievement } from "@/lib/achievements";

interface Question {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  sort_order: number;
  hint?: string | null;
  explanation?: string | null;
}

interface QuestionResult {
  index: number;
  question_text: string;
  correct: boolean;
  timeMs: number;
  usedHint: boolean;
}

export default function QuizView() {
  const { courseId, quizId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playCorrect, playWrong, playXp, playModuleComplete, playQuizPass, playQuizFail } = useSoundEffects();

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
  const [shakeWrong, setShakeWrong] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [usedHints, setUsedHints] = useState<boolean[]>([]);
  const [earnedXp, setEarnedXp] = useState(0);
  const [autoNavigateCount, setAutoNavigateCount] = useState(8);

  const correctCountRef = useRef(0);
  const questionStartTimeRef = useRef(Date.now());
  const sessionStartTimeRef = useRef(Date.now());
  const autoNavTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleBack = useCallback(() => {
    if (currentIndex > 0 && !finished) {
      setShowExitDialog(true);
    } else {
      navigate(`/app/courses/${courseId}`, { state: { restoreActiveNode: true } });
    }
  }, [currentIndex, finished, navigate, courseId]);

  useHotkeys("left", () => handleBack(), { preventDefault: true });

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
        const qs = (questionsRes.data as any[]).map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
        }));
        setQuestions(qs);
        setUsedHints(new Array(qs.length).fill(false));
      }
      setAlreadyPassed(!!progressRes.data);
      setLoading(false);
      sessionStartTimeRef.current = Date.now();
      questionStartTimeRef.current = Date.now();
    };
    fetch();
  }, [quizId, user]);

  // Cleanup auto-navigate timer on unmount
  useEffect(() => {
    return () => {
      if (autoNavTimerRef.current) clearInterval(autoNavTimerRef.current);
    };
  }, []);

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correct_answer;
  const progressPct = questions.length > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / questions.length) * 100 : 0;

  const handleAnswer = (answer: string) => {
    if (showFeedback) return;
    const timeMs = Date.now() - questionStartTimeRef.current;
    setSelectedAnswer(answer);
    setShowFeedback(true);

    const correct = answer === currentQuestion.correct_answer;
    if (correct) {
      const newCount = correctCount + 1;
      setCorrectCount(newCount);
      correctCountRef.current = newCount;
      playCorrect();
    } else {
      setShakeWrong(true);
      setTimeout(() => setShakeWrong(false), 500);
      playWrong();
      // Fire-and-forget: seed error to user_mistakes
      if (user && profile) {
        supabase.from("user_mistakes" as any).insert({
          user_id: user.id,
          company_id: profile.company_id,
          lesson_id: null,
          course_id: courseId,
          block_type: currentQuestion.question_type === "true_false" ? "true_false" : "mc",
          question: currentQuestion.question_text,
          user_answer: answer,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation ?? null,
        }).then(() => {});
      }
    }

    const result: QuestionResult = {
      index: currentIndex,
      question_text: currentQuestion.question_text,
      correct,
      timeMs,
      usedHint: usedHints[currentIndex],
    };
    setQuestionResults((prev) => [...prev, result]);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setHintRevealed(false);
      questionStartTimeRef.current = Date.now();
    } else {
      const finalCorrect = correctCountRef.current;
      setFinished(true);
      setIsSaving(true);
      const score = Math.round((finalCorrect / questions.length) * 100);
      const isPassing = score >= (quiz?.passing_score || 70);
      if (isPassing) {
        fireSchool();
        playQuizPass();
      } else {
        playQuizFail();
      }
      saveResult(finalCorrect).finally(() => setIsSaving(false));
    }
  };

  const handleRevealHint = () => {
    setHintRevealed(true);
    setUsedHints((prev) => {
      const next = [...prev];
      next[currentIndex] = true;
      return next;
    });
  };

  const saveResult = async (finalCorrect: number) => {
    if (!user || !profile) return;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("record_quiz_completion", {
        _quiz_id: quizId!,
        _correct: finalCorrect,
        _total: questions.length,
      });
      if (rpcErr) throw rpcErr;
      const result0 = (rpcData ?? {}) as { duplicate?: boolean; passed?: boolean; xp_earned?: number; score?: number };
      if (result0.duplicate) return;
      const passed = !!result0.passed;
      const xpReward = result0.xp_earned ?? 0;
      setEarnedXp(xpReward);

      if (passed) {
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
        playXp();
        if (result.leveledUp) {
          setNewLevel(result.newLevel);
          setTimeout(() => setShowLevelUp(true), 1200);
        }

        // Check module complete
        const { data: moduleItems } = await supabase
          .from("quizzes")
          .select("id")
          .eq("module_id", quiz?.module_id);
        const { data: moduleProgress } = await supabase
          .from("user_progress")
          .select("quiz_id")
          .eq("user_id", user.id)
          .eq("module_id", quiz?.module_id)
          .eq("completed", true)
          .not("quiz_id", "is", null);
        const completedQuizIds = new Set((moduleProgress || []).map((p: any) => p.quiz_id));
        completedQuizIds.add(quizId!);
        if (moduleItems && moduleItems.every((q: any) => completedQuizIds.has(q.id))) {
          setTimeout(() => playModuleComplete(), 800);
        }

        // Update daily quests
        try {
          await supabase.rpc("increment_quest_progress", { _quest_type: "quiz", _amount: 1 });
          await supabase.rpc("increment_quest_progress", { _quest_type: "xp", _amount: xpReward });
        } catch (e) { /* ignore */ }

        await refreshProfile();

        const newly = await evaluateAchievements(user.id, profile.company_id!);
        if (newly.length > 0) setTimeout(() => setUnlocked(newly), 1500);
      }

      // Start auto-navigate countdown
      const delay = passed && result0.duplicate === false ? 8 : 12;
      setAutoNavigateCount(delay);
      let remaining = delay;
      autoNavTimerRef.current = setInterval(() => {
        remaining -= 1;
        setAutoNavigateCount(remaining);
        if (remaining <= 0) {
          if (autoNavTimerRef.current) clearInterval(autoNavTimerRef.current);
          navigate(`/app/courses/${courseId}`, { state: { restoreActiveNode: true }, replace: true });
        }
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const restart = () => {
    if (autoNavTimerRef.current) clearInterval(autoNavTimerRef.current);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setCorrectCount(0);
    correctCountRef.current = 0;
    setFinished(false);
    setHintRevealed(false);
    setQuestionResults([]);
    setUsedHints(new Array(questions.length).fill(false));
    setEarnedXp(0);
    sessionStartTimeRef.current = Date.now();
    questionStartTimeRef.current = Date.now();
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
  const failedResults = questionResults.filter((r) => !r.correct);
  const totalTimeMs = Date.now() - sessionStartTimeRef.current;
  const avgTimeMs = questionResults.length > 0
    ? Math.round(questionResults.reduce((s, r) => s + r.timeMs, 0) / questionResults.length)
    : 0;

  // ─── Pantalla de resultados ───────────────────────────────────────────────
  if (finished) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <XpAnimation amount={quiz?.xp_reward || 25} show={showXp} onComplete={() => setShowXp(false)} />
        <LevelUpModal show={showLevelUp} level={newLevel} onClose={() => setShowLevelUp(false)} />
        <AchievementUnlockModal achievements={unlocked} onClose={() => setUnlocked([])} />

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 24 }}>
          <Card className="shadow-card overflow-hidden">
            {/* Header */}
            <div className={`p-8 text-center ${passed ? "gradient-primary" : "bg-muted/60"}`}>
              <KibboExpression
                expression={passed ? "celebrating" : "sad"}
                className="w-24 h-24 mx-auto mb-4"
              />
              <h2 className={`text-2xl font-bold mb-1 ${passed ? "text-primary-foreground" : "text-foreground"}`}>
                {passed ? "¡Módulo completado!" : "Sigue practicando"}
              </h2>
              <p className={passed ? "text-primary-foreground/80" : "text-muted-foreground"}>
                {passed ? "Has aprobado la evaluación" : `Necesitas ${quiz?.passing_score || 70}% para aprobar`}
              </p>
            </div>

            <CardContent className="p-6 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <NumberTicker value={finalScore} className="text-3xl font-bold" suffix="%" />
                  <p className="text-xs text-muted-foreground">Puntaje</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">
                    <NumberTicker value={correctCount} />
                    <span className="text-muted-foreground text-xl">/{questions.length}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Correctas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-amber-500">{passed ? `+${quiz?.xp_reward || 25}` : "0"}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>

              {/* Tiempo */}
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground py-1 border-t border-b border-border">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(totalTimeMs / 60000)}m {Math.floor((totalTimeMs % 60000) / 1000)}s total
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  {Math.round(avgTimeMs / 1000)}s por pregunta
                </span>
              </div>

              {/* Desglose por pregunta */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen de respuestas</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {questionResults.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2.5 text-sm p-2.5 rounded-lg ${r.correct ? "bg-success/8" : "bg-destructive/8"}`}>
                      {r.correct
                        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                      <span className={`flex-1 leading-snug ${r.correct ? "" : "text-muted-foreground"}`}>
                        {r.question_text.length > 70 ? r.question_text.slice(0, 70) + "…" : r.question_text}
                      </span>
                      {!r.correct && (
                        <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">→ SRS</span>
                      )}
                      {r.usedHint && r.correct && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium flex items-center gap-0.5">
                          <Lightbulb className="w-2.5 h-2.5" /> Pista
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recomendación contextual según score */}
              <div className={`rounded-xl p-3 text-sm flex items-start gap-2.5 ${
                finalScore >= 90 ? "bg-success/10 text-success" :
                finalScore >= 70 ? "bg-primary/8 text-primary" :
                "bg-destructive/8 text-destructive"
              }`}>
                <span className="text-lg leading-none mt-0.5">
                  {finalScore >= 90 ? "🎯" : finalScore >= 70 ? "💪" : "📖"}
                </span>
                <p className="leading-snug">
                  {finalScore >= 90
                    ? "¡Excelente dominio! Continúa con el siguiente módulo."
                    : finalScore >= 70
                    ? "Casi perfecto. Practica los errores para consolidar lo aprendido."
                    : "Repasa la guía del módulo antes de reintentar para mejorar tu comprensión."}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-1">
                {!passed && (
                  <Button variant="outline" className="flex-1" onClick={restart} disabled={isSaving}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reintentar
                  </Button>
                )}
                {failedResults.length > 0 && (
                  <Button
                    variant="outline"
                    className="flex-1 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => {
                      if (autoNavTimerRef.current) clearInterval(autoNavTimerRef.current);
                      navigate("/app/practice");
                    }}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Practicar errores
                  </Button>
                )}
                <Button
                  className="flex-1 gradient-primary"
                  disabled={isSaving}
                  onClick={() => {
                    if (autoNavTimerRef.current) clearInterval(autoNavTimerRef.current);
                    navigate(`/app/courses/${courseId}`, { state: { restoreActiveNode: true } });
                  }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Ir al curso
                </Button>
              </div>

              {/* Auto-navigate countdown */}
              {!isSaving && (
                <p className="text-center text-xs text-muted-foreground">
                  Volviendo al curso en <span className="font-semibold tabular-nums">{autoNavigateCount}s</span>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Flujo de pregunta ────────────────────────────────────────────────────
  const options = currentQuestion?.question_type === "true_false" ? ["Verdadero", "Falso"] : currentQuestion?.options || [];
  const hasHint = !!(currentQuestion?.hint);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir del quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Llevas {currentIndex} {currentIndex === 1 ? "pregunta" : "preguntas"} respondidas. Si sales ahora, tendrás que empezar desde el principio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir el quiz</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/app/courses/${courseId}`, { state: { restoreActiveNode: true } })}>
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <Progress value={progressPct} className="h-3" />
        </div>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">{currentIndex + 1}/{questions.length}</span>
      </div>

      {/* Pregunta */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.22 }}
        >
          <Card className={`shadow-card ${shakeWrong ? "animate-shake" : ""}`}>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold leading-snug">{currentQuestion?.question_text}</h2>

              {/* Opciones */}
              <div className="space-y-3">
                {options.map((option: string, idx: number) => {
                  let style = "border-border hover:border-primary/50 hover:bg-primary/5";
                  if (showFeedback) {
                    if (option === currentQuestion.correct_answer) {
                      style = "border-success bg-success/10 text-success";
                    } else if (option === selectedAnswer && !isCorrect) {
                      style = "border-destructive bg-destructive/10 text-destructive";
                    } else {
                      style = "border-border opacity-40";
                    }
                  }
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      disabled={showFeedback}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium ${style}`}
                      whileTap={!showFeedback ? { scale: 0.97 } : {}}
                      whileHover={!showFeedback ? { scale: 1.01 } : {}}
                      {...(showFeedback && option === currentQuestion.correct_answer
                        ? { animate: { scale: [1, 1.06, 1] }, transition: { duration: 0.3 } }
                        : {})}
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {showFeedback && option === currentQuestion.correct_answer && <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />}
                        {showFeedback && option === selectedAnswer && !isCorrect && option !== currentQuestion.correct_answer && <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Hint — visible antes de responder */}
              <AnimatePresence>
                {!showFeedback && hasHint && !hintRevealed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-center"
                  >
                    <button
                      onClick={handleRevealHint}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600 transition-colors py-1"
                    >
                      <Lightbulb className="w-3.5 h-3.5" /> Ver pista
                    </button>
                  </motion.div>
                )}
                {!showFeedback && hintRevealed && currentQuestion?.hint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                      <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{currentQuestion.hint}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Panel de feedback expandido */}
              <AnimatePresence>
                {showFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className={`rounded-xl overflow-hidden border-2 ${isCorrect ? "border-success/40 bg-success/8" : "border-destructive/40 bg-destructive/8"}`}
                  >
                    <div className={`px-4 py-3 flex items-center gap-2 ${isCorrect ? "bg-success/15" : "bg-destructive/15"}`}>
                      {isCorrect
                        ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        : <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                      <p className={`font-semibold ${isCorrect ? "text-success" : "text-destructive"}`}>
                        {isCorrect ? "¡Correcto!" : "Incorrecto"}
                      </p>
                      {!isCorrect && (
                        <p className="text-sm text-muted-foreground ml-1">
                          Respuesta correcta: <span className="font-medium text-foreground">{currentQuestion.correct_answer}</span>
                        </p>
                      )}
                    </div>
                    {currentQuestion?.explanation && (
                      <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                        {currentQuestion.explanation}
                      </p>
                    )}
                    <div className="px-4 pb-4 pt-1">
                      <Button
                        onClick={handleNext}
                        className={`w-full h-11 text-base font-semibold ${isCorrect ? "gradient-primary shadow-primary" : "bg-foreground text-background hover:bg-foreground/90"}`}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {currentIndex < questions.length - 1 ? "Siguiente" : "Ver resultados"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
