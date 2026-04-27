import { motion } from "framer-motion";
import type { ConceptBlock } from "@/lib/courseSchema";
import { Lightbulb } from "lucide-react";

export function ConceptRunner({ blocks }: { blocks: ConceptBlock[] }) {
  if (blocks.length === 0) {
    return <p className="text-muted-foreground italic">Sin conceptos aún.</p>;
  }
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="rounded-2xl border border-border bg-card p-4 shadow-card"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-foreground">{b.term}</h4>
              <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{b.definition}</p>
              {b.example && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Ejemplo: {b.example}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
