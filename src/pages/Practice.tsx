// =====================================================================
// Práctica diaria — sesión adaptativa con tarjetas SRS pendientes.
// Estilo Duolingo: una pregunta a la vez, barra de progreso, vidas,
// feedback inmediato, XP final. Se mezclan tipos de quiz y conceptos.
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useSRS, quality, type SrsItem } from "@/hooks/useSRS";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { fireFromButton } from "@/lib/celebrate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Heart, Zap, CheckCircle2, XCircle,
  Sparkles, RefreshCw, Brain, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SESSION_SIZE = 8;
const STARTING_LIVES = 3;
const XP_PER_CORRECT = 5;

type Phase = "loading" | "ready" | "playing" | "summary" | "empty";

export default function Practice() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { getDue, review } = useSRS();
  const { playCorrect, playWrong, playXp } = useSoundEffects();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<SrsItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);

  // ----- carga inicial -----
  const loadSession = async () => {
    setPhase("loading");
    const due = await getDue(SESSION_SIZE);
    if (due.length === 0) {
      setPhase("empty");
      return;
    }
    setItems(due);
    setIdx(0);
    setLives(STARTING_LIVES);
    setCorrectCount(0);
    setXpEarned(0);
    setStartedAt(Date.now());
    setPhase("ready");
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ----- al responder un ítem -----
  const handleAnswer = async ({
    correct,
    hadHint,
    attempts,
    timeMs,
    btn,
  }: {
    correct: boolean;
    hadHint?: boolean;
    attempts?: number;
    timeMs?: number;
    btn?: HTMLElement | null;
  }) => {
    const item = items[idx];
    if (!item) return;
    const q = quality({ correct, hadHint, attempts, timeMs });
    await review(item.id, q);
    // Cada tarjeta repasada cuenta para la misión "srs"
    try {
      await supabase.rpc("increment_quest_progress", { _quest_type: "srs", _amount: 1 });
    } catch { /* ignore */ }

    if (correct) {
      setCorrectCount((c) => c + 1);
      setXpEarned((x) => x + XP_PER_CORRECT);
      playCorrect();
      if (btn) fireFromButton(btn, 30);
    } else {
      setLives((l) => Math.max(0, l - 1));
      playWrong();
    }
  };

  const next = async () => {
    const isLast = idx >= items.length - 1;
    if (lives <= 0 || isLast) return endSession();
    setIdx(idx + 1);
  };

  const endSession = async () => {
    setPhase("summary");
    if (xpEarned > 0 && user && profile?.company_id) {
      try {
        await supabase.rpc("record_practice_xp", { _xp: xpEarned });
        const newXp = (profile.xp_total ?? 0) + xpEarned;
        const newLevel = Math.floor(newXp / 100) + 1;
        await supabase
          .from("profiles")
          .update({ xp_total: newXp, level: newLevel })
          .eq("id", user.id);
        await supabase.rpc("increment_quest_progress", {
          _quest_type: "xp",
          _amount: xpEarned,
        });
        playXp();
        await refreshProfile();
      } catch (e) {
        console.warn("xp award failed", e);
      }
    }
  };

  // ----- render -----
  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* topbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {phase === "playing" && (
          <>
            <Progress
              value={((idx + 1) / items.length) * 100}
              className="flex-1 h-3"
            />
            <div className="flex items-center gap-1">
              {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-5 h-5 ${
                    i < lives
                      ? "text-destructive fill-destructive"
                      : "text-muted opacity-40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        {phase !== "playing" && (
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Práctica diaria
          </h1>
        )}
        <span className="w-9" />
      </div>

      {phase === "loading" && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {phase === "empty" && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sparkles className="w-12 h-12 mx-auto text-success" />
            <h2 className="font-bold text-lg">¡Estás al día! 🎉</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              No tienes tarjetas pendientes ahora. Completa lecciones para
              añadir más conceptos a tu memoria adaptativa.
            </p>
            <Button onClick={() => navigate("/app/courses")}>
              Ir a cursos
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "ready" && (
        <Card className="overflow-hidden">
          <CardContent className="py-10 text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground shadow-primary"
            >
              <Brain className="w-8 h-8" />
            </motion.div>
            <h2 className="text-2xl font-bold">Sesión de repaso</h2>
            <p className="text-muted-foreground text-sm">
              {items.length} tarjetas seleccionadas según tu memoria.
              <br />
              Tienes <b>{STARTING_LIVES} vidas</b>. Acierta para ganar XP.
            </p>
            <Button
              size="lg"
              className="gradient-primary shadow-primary"
              onClick={() => setPhase("playing")}
            >
              <Zap className="w-4 h-4 mr-2" /> Empezar
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "playing" && items[idx] && (
        <AnimatePresence mode="wait">
          <motion.div
            key={items[idx].id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ItemRunner
              item={items[idx]}
              startedAt={startedAt}
              onAnswered={handleAnswer}
              onNext={next}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {phase === "summary" && (
        <Summary
          correct={correctCount}
          total={items.length}
          xp={xpEarned}
          livesLeft={lives}
          onAgain={loadSession}
          onExit={() => navigate("/app")}
        />
      )}
    </div>
  );
}

// =====================================================================
// Renderer por tipo de payload (dentro de la sesión SRS)
// =====================================================================

type AnswerCb = (a: {
  correct: boolean;
  hadHint?: boolean;
  attempts?: number;
  timeMs?: number;
  btn?: HTMLElement | null;
}) => void;

function ItemRunner({
  item,
  startedAt,
  onAnswered,
  onNext,
}: {
  item: SrsItem;
  startedAt: number;
  onAnswered: AnswerCb;
  onNext: () => void;
}) {
  const kind = item.payload?.kind ?? item.item_type;
  const [answered, setAnswered] = useState<null | { correct: boolean; correctText: string }>(null);

  const finish = (correct: boolean, correctText: string, opts?: { hadHint?: boolean; attempts?: number; btn?: HTMLElement | null }) => {
    setAnswered({ correct, correctText });
    onAnswered({
      correct,
      hadHint: opts?.hadHint,
      attempts: opts?.attempts,
      timeMs: Date.now() - startedAt,
      btn: opts?.btn,
    });
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {labelFor(kind)}
          </Badge>
          {item.strength != null && (
            <span className="text-xs text-muted-foreground ml-auto">
              Memoria: {Math.round(item.strength * 100)}%
            </span>
          )}
        </div>

        {kind === "term" && (
          <TermItem item={item} answered={answered} onFinish={finish} />
        )}
        {kind === "mc" && (
          <McItem item={item} answered={answered} onFinish={finish} />
        )}
        {kind === "true_false" && (
          <TfItem item={item} answered={answered} onFinish={finish} />
        )}
        {kind === "fill_blank" && (
          <FbItem item={item} answered={answered} onFinish={finish} />
        )}
        {kind === "match_pairs" && (
          <PairsRecallItem item={item} answered={answered} onFinish={finish} />
        )}
        {kind === "order_steps" && (
          <OrderRecallItem item={item} answered={answered} onFinish={finish} />
        )}
        {!["term", "mc", "true_false", "fill_blank", "match_pairs", "order_steps"].includes(kind) && (
          <p className="text-muted-foreground italic">Tipo no soportado: {kind}</p>
        )}

        {answered && (
          <FeedbackBox
            correct={answered.correct}
            correctText={answered.correctText}
            explanation={item.payload?.explanation}
            onNext={onNext}
          />
        )}
      </CardContent>
    </Card>
  );
}

function labelFor(kind: string) {
  switch (kind) {
    case "term": return "Concepto";
    case "mc": return "Opción múltiple";
    case "true_false": return "V/F";
    case "fill_blank": return "Completa";
    case "match_pairs": return "Empareja";
    case "order_steps": return "Ordena";
    default: return kind;
  }
}

function FeedbackBox({
  correct, correctText, explanation, onNext,
}: { correct: boolean; correctText: string; explanation?: string; onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
        correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      }`}
    >
      {correct ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
      <div className="flex-1">
        <p className="font-semibold">
          {correct ? "¡Correcto!" : `Respuesta correcta: ${correctText}`}
        </p>
        {explanation && <p className="text-xs opacity-80 mt-1">{explanation}</p>}
      </div>
      <Button size="sm" onClick={onNext}>
        Siguiente <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
    </motion.div>
  );
}

// ---------- TERM (recall: mostramos pregunta, autoeval) ----------
function TermItem({ item, answered, onFinish }: any) {
  const [showAns, setShowAns] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{item.payload.question}</p>
      {!answered && !showAns && (
        <Button onClick={() => setShowAns(true)} variant="outline">
          Mostrar respuesta
        </Button>
      )}
      {showAns && !answered && (
        <div className="rounded-lg border p-3 bg-muted/40 text-sm space-y-2">
          <p className="font-medium">{item.payload.answer}</p>
          {item.payload.hint && (
            <p className="text-xs text-muted-foreground italic">
              Ejemplo: {item.payload.hint}
            </p>
          )}
          <p className="text-xs text-muted-foreground pt-2">¿La sabías?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive"
              onClick={(e) => onFinish(false, item.payload.answer, { attempts: 2, btn: e.currentTarget })}
            >No</Button>
            <Button size="sm" variant="outline"
              onClick={(e) => onFinish(true, item.payload.answer, { hadHint: true, attempts: 1, btn: e.currentTarget })}
            >Más o menos</Button>
            <Button size="sm" className="gradient-primary"
              onClick={(e) => onFinish(true, item.payload.answer, { attempts: 1, btn: e.currentTarget })}
            >Sí, perfecta</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- MC ----------
function McItem({ item, answered, onFinish }: any) {
  const [picked, setPicked] = useState<string | null>(null);
  const onPick = (e: React.MouseEvent<HTMLButtonElement>, opt: string) => {
    if (answered) return;
    setPicked(opt);
    const ok = opt === item.payload.correct;
    onFinish(ok, item.payload.correct, { attempts: 1, btn: e.currentTarget });
  };
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{item.payload.question}</p>
      <div className="grid gap-2">
        {(item.payload.options ?? []).map((opt: string) => {
          const isPicked = picked === opt;
          const isCorrect = answered && opt === item.payload.correct;
          const isWrong = answered && isPicked && opt !== item.payload.correct;
          return (
            <button
              key={opt}
              type="button"
              disabled={!!answered}
              onClick={(e) => onPick(e, opt)}
              className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                isCorrect ? "bg-success/15 border-success/40 text-success"
                : isWrong ? "bg-destructive/15 border-destructive/40 text-destructive animate-shake"
                : isPicked ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-background border-border hover:border-primary/30"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- TF ----------
function TfItem({ item, answered, onFinish }: any) {
  const correctText = item.payload.correct ? "Verdadero" : "Falso";
  const [picked, setPicked] = useState<boolean | null>(null);
  const click = (e: React.MouseEvent<HTMLButtonElement>, val: boolean) => {
    if (answered) return;
    setPicked(val);
    onFinish(val === item.payload.correct, correctText, { attempts: 1, btn: e.currentTarget });
  };
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{item.payload.question}</p>
      <div className="flex gap-2">
        {[
          { v: true, label: "Verdadero" },
          { v: false, label: "Falso" },
        ].map((o) => (
          <Button
            key={String(o.v)}
            disabled={!!answered}
            variant={picked === o.v ? "default" : "outline"}
            onClick={(e) => click(e, o.v)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ---------- FILL BLANK ----------
function FbItem({ item, answered, onFinish }: any) {
  const correctArr: string[] = Array.isArray(item.payload.correct)
    ? item.payload.correct
    : [item.payload.correct];
  const sentence: string = item.payload.sentence ?? "";
  const blanks = (sentence.match(/_+/g) || []).length || 1;
  const [vals, setVals] = useState<string[]>(Array(blanks).fill(""));

  const parts = sentence.split(/_+/g);
  const submit = (e: React.MouseEvent<HTMLButtonElement>) => {
    const ok = vals.every(
      (v, i) => (v ?? "").trim().toLowerCase() === (correctArr[i] ?? "").trim().toLowerCase(),
    );
    onFinish(ok, correctArr.join(" / "), { attempts: 1, btn: e.currentTarget });
  };

  return (
    <div className="space-y-3">
      <p className="text-lg leading-loose">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              <Input
                value={vals[i] ?? ""}
                onChange={(e) => {
                  const n = [...vals];
                  n[i] = e.target.value;
                  setVals(n);
                }}
                disabled={!!answered}
                className="inline-block w-32 mx-1 h-8 align-middle"
              />
            )}
          </span>
        ))}
      </p>
      {!answered && (
        <Button onClick={submit} disabled={vals.some((v) => !v.trim())}>
          Comprobar
        </Button>
      )}
    </div>
  );
}

// ---------- MATCH PAIRS (recall by pick-the-right-pair) ----------
function PairsRecallItem({ item, answered, onFinish }: any) {
  // Pregunta una sola pareja al azar como retrieval rápido
  const pairs: { left: string; right: string }[] = item.payload.pairs ?? [];
  const target = useMemo(
    () => pairs[Math.floor(Math.random() * pairs.length)] ?? pairs[0],
    [item.id], // estable por ítem
  );
  const distractors = useMemo(() => {
    const others = pairs.filter((p) => p.left !== target?.left).map((p) => p.right);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [...shuffled, target?.right].filter(Boolean) as string[];
    return all.sort(() => Math.random() - 0.5);
  }, [pairs, target]);

  const [picked, setPicked] = useState<string | null>(null);
  if (!target) return <p>—</p>;

  const click = (e: React.MouseEvent<HTMLButtonElement>, opt: string) => {
    if (answered) return;
    setPicked(opt);
    onFinish(opt === target.right, target.right, { attempts: 1, btn: e.currentTarget });
  };

  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">¿Qué emparejamos con: <span className="text-primary">"{target.left}"</span>?</p>
      <div className="grid gap-2">
        {distractors.map((opt) => {
          const isPicked = picked === opt;
          const isCorrect = answered && opt === target.right;
          const isWrong = answered && isPicked && opt !== target.right;
          return (
            <button
              key={opt}
              type="button"
              disabled={!!answered}
              onClick={(e) => click(e, opt)}
              className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                isCorrect ? "bg-success/15 border-success/40 text-success"
                : isWrong ? "bg-destructive/15 border-destructive/40 text-destructive animate-shake"
                : isPicked ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-background border-border hover:border-primary/30"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- ORDER STEPS recall ----------
function OrderRecallItem({ item, answered, onFinish }: any) {
  const steps: string[] = item.payload.steps ?? [];
  // Ejercicio: ¿cuál es el siguiente paso después de X?
  const i = useMemo(
    () => Math.floor(Math.random() * Math.max(1, steps.length - 1)),
    [item.id],
  );
  const target = steps[i + 1];
  const distractors = useMemo(() => {
    const others = steps.filter((_, k) => k !== i + 1);
    const pool = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...pool, target].filter(Boolean).sort(() => Math.random() - 0.5);
  }, [steps, i]);

  const [picked, setPicked] = useState<string | null>(null);
  if (!target) return <p>—</p>;
  const click = (e: React.MouseEvent<HTMLButtonElement>, opt: string) => {
    if (answered) return;
    setPicked(opt);
    onFinish(opt === target, target, { attempts: 1, btn: e.currentTarget });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Después de:</p>
      <p className="text-lg font-semibold rounded-lg bg-muted/50 px-3 py-2">
        {steps[i]}
      </p>
      <p className="text-sm text-muted-foreground">¿qué viene?</p>
      <div className="grid gap-2">
        {distractors.map((opt) => {
          const isPicked = picked === opt;
          const isCorrect = answered && opt === target;
          const isWrong = answered && isPicked && opt !== target;
          return (
            <button
              key={opt}
              type="button"
              disabled={!!answered}
              onClick={(e) => click(e, opt)}
              className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                isCorrect ? "bg-success/15 border-success/40 text-success"
                : isWrong ? "bg-destructive/15 border-destructive/40 text-destructive animate-shake"
                : isPicked ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-background border-border hover:border-primary/30"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// Resumen final
// =====================================================================
function Summary({
  correct, total, xp, livesLeft, onAgain, onExit,
}: {
  correct: number; total: number; xp: number; livesLeft: number;
  onAgain: () => void; onExit: () => void;
}) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const allOk = livesLeft > 0 && correct === total;
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
            allOk ? "bg-success/15" : "bg-primary/10"
          }`}
        >
          {allOk ? (
            <CheckCircle2 className="w-10 h-10 text-success" />
          ) : (
            <Brain className="w-10 h-10 text-primary" />
          )}
        </motion.div>
        <h2 className="text-2xl font-bold">
          {allOk ? "¡Sesión perfecta! 🎉" : "Sesión completada"}
        </h2>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          <Stat icon={CheckCircle2} value={`${correct}/${total}`} label="Aciertos" />
          <Stat icon={Zap} value={`+${xp}`} label="XP ganado" />
          <Stat icon={Heart} value={livesLeft} label="Vidas" />
        </div>
        <p className="text-muted-foreground text-sm">
          Precisión: <b>{pct}%</b>
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button onClick={onAgain} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Otra sesión
          </Button>
          <Button onClick={onExit} className="gradient-primary">
            Volver al inicio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <div className="rounded-lg border p-3">
      <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
      <div className="font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
