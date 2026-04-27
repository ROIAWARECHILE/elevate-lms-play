// =====================================================================
// InteractiveQuizRunner — ejercicios estilo Duolingo para adultos.
// Tipos: mc, true_false, fill_blank (1+ huecos), match_pairs (click),
//        order_steps (drag&drop), sort_into_buckets (drag&drop),
//        highlight_terms (click toggle).
// Tras fallar permite añadir el ejercicio a "Repasar errores".
// =====================================================================
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InteractiveQuizBlock } from "@/lib/courseSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, GripVertical, BookmarkPlus, Sparkles } from "lucide-react";
import { useMistakes } from "@/hooks/useMistakes";

export function InteractiveQuizRunner({ blocks }: { blocks: InteractiveQuizBlock[] }) {
  if (blocks.length === 0) return <p className="text-muted-foreground italic">Sin ejercicios.</p>;
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

// ---------- Item dispatcher ----------

function QuizItem({ block, idx }: { block: InteractiveQuizBlock; idx: number }) {
  switch (block.type) {
    case "mc": return <MultipleChoice block={block} idx={idx} />;
    case "true_false": return <TrueFalse block={block} idx={idx} />;
    case "fill_blank": return <FillBlank block={block} idx={idx} />;
    case "match_pairs": return <MatchPairs block={block} idx={idx} />;
    case "order_steps": return <OrderSteps block={block} idx={idx} />;
    case "sort_into_buckets": return <SortIntoBuckets block={block} idx={idx} />;
    case "highlight_terms": return <HighlightTerms block={block} idx={idx} />;
    case "tap_to_complete": return <TapToComplete block={block} idx={idx} />;
    default: return null;
  }
}

// ---------- UI helpers ----------

function ItemShell({
  idx,
  question,
  children,
  result,
  explanation,
  onMarkMistake,
  alreadyMarked,
}: {
  idx: number;
  question: React.ReactNode;
  children: React.ReactNode;
  result?: { correct: boolean; correctText: string } | null;
  explanation?: string;
  onMarkMistake?: () => void;
  alreadyMarked?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="mt-0.5">{idx + 1}</Badge>
        <div className="font-semibold text-foreground flex-1">{question}</div>
      </div>
      {children}
      {result && (
        <div
          className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
            result.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.correct ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-semibold">
              {result.correct ? "¡Correcto!" : `Respuesta correcta: ${result.correctText}`}
            </p>
            {explanation && <p className="text-xs opacity-80 mt-1">{explanation}</p>}
          </div>
          {!result.correct && onMarkMistake && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2 shrink-0"
              onClick={onMarkMistake}
              disabled={alreadyMarked}
            >
              <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
              {alreadyMarked ? "Añadido" : "A repaso"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function useMistakeReporter(blockType: string, question: string, correctAnswer: string, explanation?: string) {
  const { addMistake } = useMistakes();
  const { courseId, lessonId } = useParams();
  const [marked, setMarked] = useState(false);
  const mark = async (userAnswer?: string) => {
    const ok = await addMistake({
      blockType,
      question,
      userAnswer: userAnswer ?? null,
      correctAnswer,
      explanation: explanation ?? null,
      lessonId: lessonId ?? null,
      courseId: courseId ?? null,
    });
    if (ok) setMarked(true);
  };
  return { marked, mark };
}

// ---------- Multiple Choice ----------

function MultipleChoice({ block, idx }: { block: Extract<InteractiveQuizBlock, { type: "mc" }>; idx: number }) {
  const [submitted, setSubmitted] = useState(false);
  const [value, setValue] = useState("");
  const correct = value === block.correct;
  const reporter = useMistakeReporter("mc", block.question, block.correct, block.explanation);

  return (
    <ItemShell
      idx={idx}
      question={block.question}
      result={submitted ? { correct, correctText: block.correct } : null}
      explanation={block.explanation}
      onMarkMistake={() => reporter.mark(value)}
      alreadyMarked={reporter.marked}
    >
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
                  ? correct
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
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!value}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- True / False ----------

function TrueFalse({ block, idx }: { block: Extract<InteractiveQuizBlock, { type: "true_false" }>; idx: number }) {
  const [submitted, setSubmitted] = useState(false);
  const [value, setValue] = useState<string>("");
  const correct = (value === "true") === block.correct;
  const correctText = block.correct ? "Verdadero" : "Falso";
  const reporter = useMistakeReporter("true_false", block.question, correctText, block.explanation);

  return (
    <ItemShell
      idx={idx}
      question={block.question}
      result={submitted ? { correct, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() => reporter.mark(value === "true" ? "Verdadero" : "Falso")}
      alreadyMarked={reporter.marked}
    >
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
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!value}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- Fill in the blanks (1 o más huecos: __ ó ___) ----------

function FillBlank({ block, idx }: { block: Extract<InteractiveQuizBlock, { type: "fill_blank" }>; idx: number }) {
  const blanks = useMemo(() => {
    const matches = block.sentence.match(/_+/g) || [];
    return matches.length || 1;
  }, [block.sentence]);

  const correctArr: string[] = useMemo(() => {
    if (Array.isArray(block.correct)) return block.correct;
    return [block.correct];
  }, [block.correct]);

  const [values, setValues] = useState<string[]>(Array(blanks).fill(""));
  const [submitted, setSubmitted] = useState(false);

  const allCorrect =
    values.length === correctArr.length &&
    values.every((v, i) => (v ?? "").trim().toLowerCase() === (correctArr[i] ?? "").trim().toLowerCase());

  const correctText = correctArr.join(" / ");
  const reporter = useMistakeReporter("fill_blank", block.sentence, correctText, block.explanation);

  // Renderiza la frase con inputs en cada hueco
  const parts = block.sentence.split(/_+/g);
  const rendered: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    rendered.push(<span key={`p${i}`}>{p}</span>);
    if (i < parts.length - 1) {
      rendered.push(
        <Input
          key={`b${i}`}
          value={values[i] || ""}
          onChange={(e) => {
            const next = [...values];
            next[i] = e.target.value;
            setValues(next);
          }}
          disabled={submitted}
          className="inline-block w-32 mx-1 h-8 align-middle"
          placeholder="..."
        />,
      );
    }
  });

  return (
    <ItemShell
      idx={idx}
      question={<div className="leading-loose">{rendered}</div>}
      result={submitted ? { correct: allCorrect, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() => reporter.mark(values.join(" / "))}
      alreadyMarked={reporter.marked}
    >
      {!submitted && (
        <Button
          size="sm"
          onClick={() => setSubmitted(true)}
          disabled={values.some((v) => !v.trim())}
        >
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- Match Pairs (click-click) ----------

function MatchPairs({ block, idx }: { block: Extract<InteractiveQuizBlock, { type: "match_pairs" }>; idx: number }) {
  const lefts = block.pairs.map((p) => p.left);
  const rights = useMemo(
    () => [...block.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5),
    [block.pairs],
  );

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({}); // left -> right
  const [wrongFlash, setWrongFlash] = useState<{ l: string; r: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allMatched = Object.keys(matched).length === lefts.length;
  const allCorrect = block.pairs.every((p) => matched[p.left] === p.right);
  const correctText = block.pairs.map((p) => `${p.left} ↔ ${p.right}`).join(" · ");
  const reporter = useMistakeReporter("match_pairs", "Empareja los conceptos", correctText, block.explanation);

  const tryMatch = (left: string, right: string) => {
    const expected = block.pairs.find((p) => p.left === left)?.right;
    if (expected === right) {
      setMatched((m) => ({ ...m, [left]: right }));
      setSelectedLeft(null);
    } else {
      setWrongFlash({ l: left, r: right });
      setTimeout(() => setWrongFlash(null), 500);
      setSelectedLeft(null);
    }
  };

  return (
    <ItemShell
      idx={idx}
      question={<>Empareja cada concepto con su par correcto</>}
      result={submitted ? { correct: allCorrect, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() =>
        reporter.mark(Object.entries(matched).map(([l, r]) => `${l}↔${r}`).join(" · "))
      }
      alreadyMarked={reporter.marked}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {lefts.map((l) => {
            const isMatched = !!matched[l];
            const isSelected = selectedLeft === l;
            const isFlash = wrongFlash?.l === l;
            return (
              <button
                key={l}
                type="button"
                disabled={isMatched || submitted}
                onClick={() => setSelectedLeft(l)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                  isMatched
                    ? "bg-success/15 border-success/40 text-success"
                    : isFlash
                    ? "bg-destructive/15 border-destructive/40 animate-shake"
                    : isSelected
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-background border-border hover:border-primary/30"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r) => {
            const usedBy = Object.entries(matched).find(([, v]) => v === r)?.[0];
            const isFlash = wrongFlash?.r === r;
            return (
              <button
                key={r}
                type="button"
                disabled={!!usedBy || submitted || !selectedLeft}
                onClick={() => selectedLeft && tryMatch(selectedLeft, r)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                  usedBy
                    ? "bg-success/15 border-success/40 text-success"
                    : isFlash
                    ? "bg-destructive/15 border-destructive/40 animate-shake"
                    : selectedLeft
                    ? "bg-background border-primary/30 hover:border-primary/60"
                    : "bg-background border-border opacity-70"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!allMatched}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- Order Steps (drag & drop) ----------

function SortableRow({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-background border-border ${
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing hover:border-primary/30"
      }`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function OrderSteps({ block, idx }: { block: Extract<InteractiveQuizBlock, { type: "order_steps" }>; idx: number }) {
  const [order, setOrder] = useState<string[]>(() =>
    [...block.steps].sort(() => Math.random() - 0.5),
  );
  const [submitted, setSubmitted] = useState(false);
  const correct = order.every((s, i) => s === block.steps[i]);
  const correctText = block.steps.map((s, i) => `${i + 1}. ${s}`).join(" → ");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const reporter = useMistakeReporter("order_steps", "Ordena los pasos correctamente", correctText, block.explanation);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <ItemShell
      idx={idx}
      question={<>Arrastra los pasos al orden correcto</>}
      result={submitted ? { correct, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() => reporter.mark(order.map((s, i) => `${i + 1}. ${s}`).join(" → "))}
      alreadyMarked={reporter.marked}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((s) => (
              <SortableRow key={s} id={s} label={s} disabled={submitted} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- Sort into buckets (drag & drop) ----------

function DraggableChip({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm bg-background border-border select-none ${
        disabled ? "cursor-default opacity-80" : "cursor-grab active:cursor-grabbing hover:border-primary/40"
      }`}
    >
      {label}
    </div>
  );
}

function BucketDrop({
  id,
  title,
  items,
  isCorrectMap,
}: {
  id: string;
  title: string;
  items: string[];
  isCorrectMap: Record<string, boolean | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 p-3 rounded-xl border-2 border-dashed transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const ok = isCorrectMap[it];
          return (
            <span
              key={it}
              className={`text-xs px-2 py-1 rounded-md border ${
                ok === true
                  ? "bg-success/15 border-success/40 text-success"
                  : ok === false
                  ? "bg-destructive/15 border-destructive/40 text-destructive"
                  : "bg-background border-border"
              }`}
            >
              {it}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SortIntoBuckets({
  block,
  idx,
}: {
  block: Extract<InteractiveQuizBlock, { type: "sort_into_buckets" }>;
  idx: number;
}) {
  const POOL = "__pool__";
  const [placement, setPlacement] = useState<Record<string, string>>(() =>
    Object.fromEntries(block.items.map((it) => [it.text, POOL])),
  );
  const [submitted, setSubmitted] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    setPlacement((p) => ({ ...p, [String(active.id)]: String(over.id) }));
  };

  const bucketItems = (b: string) =>
    Object.entries(placement).filter(([, v]) => v === b).map(([k]) => k);

  const isCorrectMap: Record<string, boolean | null> = {};
  block.items.forEach((it) => {
    if (!submitted) {
      isCorrectMap[it.text] = null;
    } else {
      isCorrectMap[it.text] = placement[it.text] === it.bucket;
    }
  });
  const allCorrect = block.items.every((it) => placement[it.text] === it.bucket);
  const correctText = block.items.map((it) => `${it.text} → ${it.bucket}`).join(" · ");
  const reporter = useMistakeReporter("sort_into_buckets", "Clasifica cada elemento", correctText, block.explanation);

  const allPlaced = Object.values(placement).every((v) => v !== POOL);

  return (
    <ItemShell
      idx={idx}
      question={<>Arrastra cada elemento a su categoría</>}
      result={submitted ? { correct: allCorrect, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() =>
        reporter.mark(
          Object.entries(placement)
            .map(([k, v]) => `${k}→${v === POOL ? "?" : v}`)
            .join(" · "),
        )
      }
      alreadyMarked={reporter.marked}
    >
      <DndContext sensors={sensors} onDragEnd={onDragEnd} collisionDetection={closestCenter}>
        <BucketDrop
          id={POOL}
          title="Para clasificar"
          items={bucketItems(POOL).filter((it) => !submitted)}
          isCorrectMap={isCorrectMap}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {bucketItems(POOL).map((it) => (
            <DraggableChip key={it} id={it} label={it} disabled={submitted} />
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {block.buckets.map((b) => (
            <div key={b}>
              <BucketDrop id={b} title={b} items={bucketItems(b)} isCorrectMap={isCorrectMap} />
              <div className="mt-2 flex flex-wrap gap-2">
                {bucketItems(b).map((it) =>
                  submitted ? null : <DraggableChip key={it} id={it} label={it} />,
                )}
              </div>
            </div>
          ))}
        </div>
      </DndContext>
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!allPlaced}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

// ---------- Highlight key terms (click toggle) ----------

function HighlightTerms({
  block,
  idx,
}: {
  block: Extract<InteractiveQuizBlock, { type: "highlight_terms" }>;
  idx: number;
}) {
  // Tokenizamos por espacios pero preservamos puntuación pegada
  const tokens = useMemo(() => block.sentence.split(/(\s+)/), [block.sentence]);
  const correctSet = useMemo(
    () => new Set(block.terms.map((t) => t.toLowerCase().replace(/[.,;:!?]/g, ""))),
    [block.terms],
  );
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const norm = (w: string) => w.toLowerCase().replace(/[.,;:!?]/g, "");

  const isCorrectAt = (i: number) => correctSet.has(norm(tokens[i]));

  const allCorrect =
    [...picked].every((i) => isCorrectAt(i)) &&
    tokens.every((tok, i) => (correctSet.has(norm(tok)) ? picked.has(i) : true));

  const correctText = block.terms.join(", ");
  const reporter = useMistakeReporter(
    "highlight_terms",
    `Marca los términos clave en: "${block.sentence}"`,
    correctText,
    block.explanation,
  );

  const toggle = (i: number) => {
    if (submitted) return;
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <ItemShell
      idx={idx}
      question={<>Marca los términos clave en la frase</>}
      result={submitted ? { correct: allCorrect, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() =>
        reporter.mark([...picked].map((i) => tokens[i]).join(", "))
      }
      alreadyMarked={reporter.marked}
    >
      <p className="leading-loose text-foreground">
        {tokens.map((tok, i) => {
          if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
          const isPicked = picked.has(i);
          const should = isCorrectAt(i);
          let cls = "px-1 rounded cursor-pointer transition-colors ";
          if (submitted) {
            if (isPicked && should) cls += "bg-success/20 text-success";
            else if (isPicked && !should) cls += "bg-destructive/20 text-destructive line-through";
            else if (!isPicked && should) cls += "bg-warning/20 text-warning underline";
            else cls += "";
          } else {
            cls += isPicked ? "bg-primary/20 text-primary" : "hover:bg-muted";
          }
          return (
            <span key={i} className={cls} onClick={() => toggle(i)}>
              {tok}
            </span>
          );
        })}
      </p>
      {!submitted && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5" /> Haz clic en cada palabra clave
          <Button size="sm" className="ml-auto" onClick={() => setSubmitted(true)} disabled={picked.size === 0}>
            Comprobar
          </Button>
        </div>
      )}
    </ItemShell>
  );
}

// ---------- Tap to complete (banco de palabras) ----------

function TapToComplete({
  block,
  idx,
}: {
  block: Extract<InteractiveQuizBlock, { type: "tap_to_complete" }>;
  idx: number;
}) {
  const blanks = useMemo(() => block.correct.length, [block.correct]);
  const [picks, setPicks] = useState<(string | null)[]>(() => Array(blanks).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const usedCounts = picks.reduce<Record<string, number>>((acc, p) => {
    if (p) acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const bankWithLeft = block.bank.map((w) => {
    const total = block.bank.filter((x) => x === w).length;
    return { word: w, left: total - (usedCounts[w] || 0) };
  });

  const allFilled = picks.every((p) => p !== null);
  const allCorrect =
    submitted &&
    picks.every(
      (p, i) =>
        (p ?? "").trim().toLowerCase() === (block.correct[i] ?? "").trim().toLowerCase(),
    );
  const correctText = block.correct.join(" · ");
  const reporter = useMistakeReporter(
    "tap_to_complete",
    block.sentence,
    correctText,
    block.explanation,
  );

  const tapWord = (w: string) => {
    if (submitted) return;
    const next = [...picks];
    const firstEmpty = next.findIndex((p) => p === null);
    if (firstEmpty === -1) return;
    next[firstEmpty] = w;
    setPicks(next);
  };
  const removePick = (i: number) => {
    if (submitted) return;
    const next = [...picks];
    next[i] = null;
    setPicks(next);
  };

  // Renderiza la frase intercalando inputs (huecos tocables)
  const parts = block.sentence.split(/_+/g);
  const rendered: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    rendered.push(<span key={`p${i}`}>{p}</span>);
    if (i < parts.length - 1) {
      const v = picks[i];
      rendered.push(
        <button
          key={`b${i}`}
          type="button"
          onClick={() => removePick(i)}
          disabled={submitted}
          className={`mx-1 inline-block min-w-[80px] px-2 py-0.5 rounded-md border-b-2 align-middle text-sm transition-colors ${
            v
              ? submitted
                ? (v ?? "").trim().toLowerCase() ===
                  (block.correct[i] ?? "").trim().toLowerCase()
                  ? "bg-success/15 border-success text-success"
                  : "bg-destructive/15 border-destructive text-destructive"
                : "bg-primary/10 border-primary text-primary"
              : "border-muted-foreground/40 text-muted-foreground"
          }`}
        >
          {v ?? "____"}
        </button>,
      );
    }
  });

  return (
    <ItemShell
      idx={idx}
      question={<div className="leading-loose">{rendered}</div>}
      result={submitted ? { correct: allCorrect, correctText } : null}
      explanation={block.explanation}
      onMarkMistake={() => reporter.mark(picks.filter(Boolean).join(" · "))}
      alreadyMarked={reporter.marked}
    >
      <div className="flex flex-wrap gap-2">
        {bankWithLeft.map((b, i) => (
          <button
            key={`${b.word}-${i}`}
            type="button"
            disabled={submitted || b.left <= 0}
            onClick={() => tapWord(b.word)}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
              b.left <= 0
                ? "bg-muted/50 border-border text-muted-foreground opacity-50"
                : "bg-background border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            {b.word}
          </button>
        ))}
      </div>
      {!submitted && (
        <Button size="sm" onClick={() => setSubmitted(true)} disabled={!allFilled}>
          Comprobar
        </Button>
      )}
    </ItemShell>
  );
}

