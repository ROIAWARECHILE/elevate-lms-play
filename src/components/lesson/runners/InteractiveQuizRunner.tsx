import { useState } from "react";
import { motion } from "framer-motion";
import type { InteractiveQuizBlock } from "@/lib/courseSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle } from "lucide-react";

export function InteractiveQuizRunner({ blocks }: { blocks: InteractiveQuizBlock[] }) {
  if (blocks.length === 0) return <p className="text-muted-foreground italic">Sin preguntas.</p>;

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
        >
          <QuizItem block={b} idx={i} />
        </motion.div>
      ))}
    </div>
  );
}

function QuizItem({ block, idx }: { block: InteractiveQuizBlock; idx: number }) {
  const [submitted, setSubmitted] = useState(false);
  const [value, setValue] = useState<string>("");

  let isCorrect = false;
  let correctText = "";

  if (block.type === "mc") {
    isCorrect = value === block.correct;
    correctText = block.correct;
  } else if (block.type === "true_false") {
    isCorrect = (value === "true") === block.correct;
    correctText = block.correct ? "Verdadero" : "Falso";
  } else if (block.type === "fill_blank") {
    isCorrect = value.trim().toLowerCase() === block.correct.trim().toLowerCase();
    correctText = block.correct;
  }

  if (block.type === "match_pairs" || block.type === "order_steps") {
    // simplified read-only render for v1
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground italic">
          {block.type === "match_pairs"
            ? "Empareja los conceptos (interactividad próximamente)"
            : "Ordena los pasos (interactividad próximamente)"}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {block.type === "match_pairs"
            ? block.pairs.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{p.left}</span><span className="text-muted-foreground">↔</span><span>{p.right}</span>
                </li>
              ))
            : block.steps.map((s, i) => <li key={i}>• {s}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="font-semibold text-foreground">
        {idx + 1}. {block.type === "fill_blank" ? block.sentence.replace(/_+/g, "______") : (block as any).question}
      </p>

      {block.type === "mc" && (
        <div className="space-y-1.5">
          {block.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => !submitted && setValue(opt)}
              disabled={submitted}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                value === opt
                  ? submitted
                    ? isCorrect
                      ? "bg-success/15 border-success/40 text-success"
                      : "bg-destructive/15 border-destructive/40 text-destructive"
                    : "bg-primary/10 border-primary/40 text-primary"
                  : "bg-background border-border hover:border-primary/30"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {block.type === "true_false" && (
        <div className="flex gap-2">
          {[
            { v: "true", label: "Verdadero" },
            { v: "false", label: "Falso" },
          ].map((o) => (
            <Button
              key={o.v}
              type="button"
              variant={value === o.v ? "default" : "outline"}
              size="sm"
              onClick={() => !submitted && setValue(o.v)}
              disabled={submitted}
            >
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {block.type === "fill_blank" && (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tu respuesta"
          disabled={submitted}
        />
      )}

      {!submitted ? (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!value}>
          Comprobar
        </Button>
      ) : (
        <div
          className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
            isCorrect ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {isCorrect ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
          <div>
            <p className="font-semibold">{isCorrect ? "¡Correcto!" : `Respuesta correcta: ${correctText}`}</p>
            {(block as any).explanation && (
              <p className="text-xs opacity-80 mt-1">{(block as any).explanation}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
