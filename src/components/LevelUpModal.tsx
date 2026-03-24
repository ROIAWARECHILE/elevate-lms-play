import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LevelUpModalProps {
  show: boolean;
  level: number;
  onClose: () => void;
}

export function LevelUpModal({ show, level, onClose }: LevelUpModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-card rounded-3xl p-8 text-center max-w-sm mx-4 shadow-elevated"
            initial={{ scale: 0.5, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2, stiffness: 300 }}
              className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 shadow-primary"
            >
              <Trophy className="w-12 h-12 text-primary-foreground" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-1 text-xp mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">¡Subiste de nivel!</span>
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-4xl font-extrabold text-gradient mb-2">Nivel {level}</h2>
              <p className="text-muted-foreground text-sm mb-6">
                ¡Sigue así! Cada lección te acerca más a la maestría.
              </p>
              <Button onClick={onClose} className="gradient-primary shadow-primary px-8">
                ¡Genial!
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
