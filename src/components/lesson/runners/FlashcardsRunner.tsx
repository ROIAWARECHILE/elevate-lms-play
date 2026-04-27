import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FlashcardBlock } from "@/lib/courseSchema";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCw, Eye } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";

export function FlashcardsRunner({ blocks }: { blocks: FlashcardBlock[] }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (blocks.length === 0) return <p className="text-muted-foreground italic">Sin tarjetas.</p>;

  const card = blocks[idx];
  const next = () => {
    setFlipped(false);
    setIdx((i) => Math.min(i + 1, blocks.length - 1));
  };
  const prev = () => {
    setFlipped(false);
    setIdx((i) => Math.max(i - 1, 0));
  };

  useHotkeys("space", (e) => { e.preventDefault(); setFlipped((f) => !f); }, { enableOnFormTags: false });
  useHotkeys("right", next);
  useHotkeys("left", prev);

  return (
    <div className="space-y-4">
      <div className="text-center text-xs text-muted-foreground">
        Tarjeta {idx + 1} de {blocks.length} · <kbd className="px-1.5 py-0.5 bg-muted rounded">Espacio</kbd> para voltear
      </div>

      <div
        className="relative w-full h-64 cursor-pointer perspective-1000"
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Mostrar frente" : "Mostrar dorso"}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${idx}-${flipped}`}
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 rounded-2xl border-2 p-6 flex flex-col items-center justify-center text-center shadow-elevated ${
              flipped
                ? "bg-accent/10 border-accent/40"
                : "gradient-navy text-navy-foreground border-transparent"
            }`}
          >
            <p className="text-xs uppercase tracking-wider opacity-70 mb-3">
              {flipped ? "Respuesta" : "Pregunta"}
            </p>
            <p className="text-xl font-semibold leading-relaxed">
              {flipped ? card.back : card.front}
            </p>
            {!flipped && card.hint && (
              <p className="text-xs opacity-70 mt-4 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Pista: {card.hint}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={prev} disabled={idx === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFlipped((f) => !f)}>
          <RotateCw className="w-4 h-4 mr-1" /> Voltear
        </Button>
        <Button variant="outline" size="sm" onClick={next} disabled={idx === blocks.length - 1}>
          Siguiente <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
