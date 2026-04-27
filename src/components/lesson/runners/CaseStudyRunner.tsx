import { useState } from "react";
import { motion } from "framer-motion";
import type { CaseStudyBlock } from "@/lib/courseSchema";
import { Briefcase, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function CaseStudyRunner({ blocks }: { blocks: CaseStudyBlock[] }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  if (blocks.length === 0) return <p className="text-muted-foreground italic">Sin caso.</p>;

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "scenario") {
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-2xl gradient-navy text-navy-foreground p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider opacity-80">
                  {b.title || "Escenario"}
                </span>
              </div>
              <p className="leading-relaxed">{b.text}</p>
            </motion.div>
          );
        }
        if (b.type === "question") {
          return (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-2 mb-2">
                <MessageCircleQuestion className="w-4 h-4 text-primary mt-0.5" />
                <p className="font-semibold text-foreground">{b.text}</p>
              </div>
              <Textarea
                value={answers[i] || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                placeholder="Tu respuesta..."
                rows={3}
              />
            </div>
          );
        }
        if (b.type === "reflection") {
          return (
            <div key={i} className="rounded-xl border border-accent/30 bg-accent/10 p-4 flex gap-3">
              <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-relaxed">{b.text}</p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
