// =====================================================================
// SOPWalkthroughRunner — procedimiento paso a paso con tildes obligatorias.
// Pedagogía: Learning by Doing + retrieval (debes confirmar cada paso).
// =====================================================================
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface SopStep {
  type: "sop_step";
  n: number;
  title: string;
  description: string;
  warning?: string;
  image_url?: string;
  must_check?: boolean;
}

interface Props { blocks: SopStep[] }

export function SOPWalkthroughRunner({ blocks }: Props) {
  const steps = useMemo(
    () => [...(blocks ?? [])].sort((a, b) => (a.n ?? 0) - (b.n ?? 0)),
    [blocks],
  );
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const step = steps[idx];

  if (!step) {
    return (
      <p className="text-sm text-muted-foreground">
        Este procedimiento no tiene pasos definidos.
      </p>
    );
  }

  const mustCheck = step.must_check !== false; // default true
  const isChecked = !!checked[idx];
  const canAdvance = !mustCheck || isChecked;
  const isLast = idx === steps.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Paso {idx + 1} de {steps.length}</Badge>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i < idx ? "bg-success" : i === idx ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="shadow-card">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-bold">{step.title}</h3>
              {step.image_url && (
                <img
                  src={step.image_url}
                  alt={step.title}
                  className="rounded-lg w-full max-h-64 object-cover"
                />
              )}
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {step.description}
              </p>
              {step.warning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{step.warning}</span>
                </div>
              )}
              {mustCheck && (
                <label className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(v) =>
                      setChecked((c) => ({ ...c, [idx]: !!v }))
                    }
                  />
                  <span className="text-sm">Confirmo que he completado este paso</span>
                </label>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          disabled={idx === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          Anterior
        </Button>
        {!isLast ? (
          <Button disabled={!canAdvance} onClick={() => setIdx((i) => i + 1)}>
            Siguiente paso
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-success font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Procedimiento completo
          </div>
        )}
      </div>
    </div>
  );
}
