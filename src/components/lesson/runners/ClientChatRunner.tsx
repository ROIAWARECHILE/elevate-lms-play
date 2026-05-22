import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, CheckCircle2, AlertCircle, MinusCircle, ChevronRight, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatSimBlock, ChatSetupBlock, ChatTurnBlock, ChatOutcomeBlock } from "@/lib/courseSchema";

const MOOD_LABEL: Record<string, string> = {
  neutral: "Neutral",
  frustrated: "Frustrado/a",
  happy: "Contento/a",
  confused: "Confundido/a",
  demanding: "Exigente",
};

const MOOD_COLOR: Record<string, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  frustrated: "bg-destructive/10 text-destructive",
  happy: "bg-green-100 text-green-700",
  confused: "bg-yellow-100 text-yellow-700",
  demanding: "bg-orange-100 text-orange-700",
};

const QUALITY_STYLES: Record<string, { border: string; bg: string; icon: React.ReactNode; label: string }> = {
  good: {
    border: "border-green-500",
    bg: "bg-green-50",
    icon: <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />,
    label: "Respuesta ideal",
  },
  neutral: {
    border: "border-yellow-400",
    bg: "bg-yellow-50",
    icon: <MinusCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />,
    label: "Respuesta aceptable",
  },
  bad: {
    border: "border-destructive",
    bg: "bg-destructive/5",
    icon: <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />,
    label: "Respuesta incorrecta",
  },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function SetupScreen({ block, onStart }: { block: ChatSetupBlock; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-sidebar-accent border">
        <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground flex-shrink-0">
          {getInitials(block.persona_name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-base">{block.persona_name}</p>
          <p className="text-sm text-muted-foreground truncate">{block.persona_role}</p>
          <Badge className={cn("mt-1 text-xs", MOOD_COLOR[block.persona_mood] ?? MOOD_COLOR.neutral)}>
            {MOOD_LABEL[block.persona_mood] ?? block.persona_mood}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Situación</p>
          <p className="text-sm text-foreground leading-relaxed">{block.context}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tu objetivo</p>
          <p className="text-sm text-foreground leading-relaxed font-medium">{block.objective}</p>
        </div>
      </div>

      <Button onClick={onStart} className="w-full gap-2 gradient-primary text-primary-foreground">
        <MessageSquare className="w-4 h-4" />
        Comenzar simulación
      </Button>
    </motion.div>
  );
}

function TurnScreen({
  turn,
  turnNumber,
  totalTurns,
  onSelect,
}: {
  turn: ChatTurnBlock;
  turnNumber: number;
  totalTurns: number;
  onSelect: (choiceIdx: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleChoose(idx: number) {
    if (submitted) return;
    setSelected(idx);
  }

  function handleConfirm() {
    if (selected === null || submitted) return;
    setSubmitted(true);
  }

  const choice = selected !== null ? turn.choices[selected] : null;

  return (
    <motion.div
      key={turn.turn}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          Turno {turnNumber} de {totalTurns}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalTurns }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i < turnNumber ? "w-6 bg-primary" : "w-3 bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Mensaje del cliente */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
          <p className="text-sm text-foreground leading-relaxed">{turn.client_message}</p>
        </div>
      </div>

      {/* Reacción del cliente tras elegir */}
      {submitted && choice?.client_reaction && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
            <p className="text-sm text-foreground leading-relaxed italic">{choice.client_reaction}</p>
          </div>
        </motion.div>
      )}

      {/* Separador "Tu respuesta:" */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="w-3 h-3" /> Elige tu respuesta
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Opciones */}
      <div className="space-y-2">
        {turn.choices.map((c, idx) => {
          const isSelected = selected === idx;
          const qStyle = QUALITY_STYLES[c.quality] ?? QUALITY_STYLES.neutral;
          return (
            <div key={idx}>
              <button
                onClick={() => handleChoose(idx)}
                disabled={submitted}
                className={cn(
                  "w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-all",
                  submitted && isSelected
                    ? cn("border-2", qStyle.border, qStyle.bg)
                    : submitted && !isSelected
                    ? "border-border bg-background opacity-40"
                    : isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                {c.text}
              </button>

              {/* Feedback */}
              {submitted && isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className={cn("mt-1 rounded-xl px-4 py-3 border-2 flex items-start gap-2", qStyle.border, qStyle.bg)}
                >
                  {qStyle.icon}
                  <div>
                    <p className="text-xs font-semibold mb-0.5">{qStyle.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.feedback}</p>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botones de acción */}
      {!submitted ? (
        <Button
          onClick={handleConfirm}
          disabled={selected === null}
          className="w-full gradient-primary text-primary-foreground"
        >
          Confirmar respuesta
        </Button>
      ) : (
        <Button onClick={() => onSelect(selected!)} className="w-full gap-2">
          {turnNumber < totalTurns ? (
            <>Siguiente turno <ChevronRight className="w-4 h-4" /></>
          ) : (
            <>Ver resultado <ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      )}
    </motion.div>
  );
}

function OutcomeScreen({
  outcome,
  totalScore,
}: {
  outcome: ChatOutcomeBlock;
  totalScore: number;
}) {
  const maxScore = outcome.max_score || 1;
  const pct = Math.round((totalScore / maxScore) * 100);
  let result: "success" | "partial" | "failure" = "failure";
  if (totalScore >= outcome.thresholds.success) result = "success";
  else if (totalScore >= outcome.thresholds.partial) result = "partial";

  const RESULT_CONFIG = {
    success: {
      icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
      title: "¡Excelente manejo!",
      borderColor: "border-green-500",
      bg: "bg-green-50",
      barColor: "bg-green-500",
    },
    partial: {
      icon: <MinusCircle className="w-12 h-12 text-yellow-500" />,
      title: "Buen intento",
      borderColor: "border-yellow-400",
      bg: "bg-yellow-50",
      barColor: "bg-yellow-400",
    },
    failure: {
      icon: <AlertCircle className="w-12 h-12 text-destructive" />,
      title: "Hay margen de mejora",
      borderColor: "border-destructive",
      bg: "bg-destructive/5",
      barColor: "bg-destructive",
    },
  };

  const cfg = RESULT_CONFIG[result];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-6"
    >
      <div className={cn("flex flex-col items-center gap-3 p-6 rounded-2xl border-2 text-center", cfg.borderColor, cfg.bg)}>
        {cfg.icon}
        <p className="text-lg font-bold text-foreground">{cfg.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{outcome.messages[result]}</p>

        <div className="w-full mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Puntuación</span>
            <span className="font-semibold">{totalScore} / {maxScore}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              className={cn("h-full rounded-full", cfg.barColor)}
            />
          </div>
        </div>
      </div>

      {outcome.tips.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consejos para mejorar</p>
          <ul className="space-y-1.5">
            {outcome.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

export function ClientChatRunner({ blocks }: { blocks: ChatSimBlock[] }) {
  const setup = blocks.find((b): b is ChatSetupBlock => b.type === "chat_setup");
  const turns = blocks.filter((b): b is ChatTurnBlock => b.type === "chat_turn")
    .sort((a, b) => a.turn - b.turn);
  const outcome = blocks.find((b): b is ChatOutcomeBlock => b.type === "chat_outcome");

  const [phase, setPhase] = useState<"setup" | "turns" | "outcome">("setup");
  const [turnIdx, setTurnIdx] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  if (!setup) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Esta lección no tiene configuración de chat.
      </p>
    );
  }

  function handleSelectChoice(choiceIdx: number) {
    const turn = turns[turnIdx];
    const score = turn.choices[choiceIdx]?.score ?? 0;
    setTotalScore((s) => s + score);
    if (turnIdx + 1 < turns.length) {
      setTurnIdx((i) => i + 1);
    } else {
      setPhase("outcome");
    }
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div key="setup">
            <SetupScreen block={setup} onStart={() => setPhase("turns")} />
          </motion.div>
        )}
        {phase === "turns" && turns[turnIdx] && (
          <TurnScreen
            key={`turn-${turnIdx}`}
            turn={turns[turnIdx]}
            turnNumber={turnIdx + 1}
            totalTurns={turns.length}
            onSelect={handleSelectChoice}
          />
        )}
        {phase === "outcome" && outcome && (
          <motion.div key="outcome">
            <OutcomeScreen outcome={outcome} totalScore={totalScore} />
          </motion.div>
        )}
        {phase === "outcome" && !outcome && (
          <motion.div key="no-outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-center text-sm text-muted-foreground py-8">
              Simulación completada. Puntuación: {totalScore}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
