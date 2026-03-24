import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface XpAnimationProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
}

export function XpAnimation({ amount, show, onComplete }: XpAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 800);
          }}
        >
          <motion.div
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-xp/20 backdrop-blur-sm border border-xp/30"
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1.2, y: -40 }}
            exit={{ scale: 0.8, y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <Zap className="w-8 h-8 text-xp fill-xp" />
            <span className="text-3xl font-extrabold text-xp">+{amount} XP</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
