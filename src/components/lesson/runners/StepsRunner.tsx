import { motion } from "framer-motion";
import type { StepBlock } from "@/lib/courseSchema";
import { Lightbulb } from "lucide-react";

export function StepsRunner({ blocks }: { blocks: StepBlock[] }) {
  if (blocks.length === 0) return <p className="text-muted-foreground italic">Sin pasos.</p>;

  // Sort by n (defensive)
  const steps = [...blocks].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

  return (
    <ol className="relative space-y-4 ml-4 border-l-2 border-border pl-6">
      {steps.map((s, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06 * i }}
          className="relative"
        >
          <span className="absolute -left-[35px] top-0 w-7 h-7 rounded-full gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-primary">
            {s.n ?? i + 1}
          </span>
          <h4 className="font-bold text-foreground">{s.title}</h4>
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{s.description}</p>
          {s.tip && (
            <div className="mt-2 flex gap-2 items-start text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg p-2">
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{s.tip}</span>
            </div>
          )}
        </motion.li>
      ))}
    </ol>
  );
}
