import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { KibboExpression } from "./KibboExpression";
import { X } from "lucide-react";

interface Step {
  selector: string;
  title: string;
  description: string;
}

const COLLABORATOR_STEPS: Step[] = [
  { selector: "[data-walkthrough='dashboard']", title: "¡Bienvenido a Kibbo! 🎉", description: "Tu plataforma de aprendizaje corporativo. Aquí verás tu progreso diario." },
  { selector: "[data-walkthrough='stats']", title: "Tu progreso y XP ⚡", description: "Acumula puntos de experiencia completando lecciones y quizzes." },
  { selector: "[data-walkthrough='nav-courses']", title: "Explora los cursos 📚", description: "Descubre y accede a los cursos disponibles para ti." },
  { selector: "[data-walkthrough='daily-goal']", title: "Meta diaria 🎯", description: "Completa lecciones cada día para mantener tu racha." },
  { selector: "[data-walkthrough='nav-leaderboard']", title: "Compite con tu equipo 🏆", description: "Sube en el ranking completando más cursos." },
];

const ADMIN_STEPS: Step[] = [
  { selector: "[data-walkthrough='dashboard']", title: "¡Bienvenido a Kibbo! 🎉", description: "Administra la capacitación de tu equipo desde aquí." },
  { selector: "[data-walkthrough='nav-admin-courses']", title: "Crea cursos 📝", description: "Diseña cursos con módulos, lecciones y quizzes interactivos." },
  { selector: "[data-walkthrough='admin-steps']", title: "Primeros pasos 🚀", description: "Sigue estos pasos para configurar tu workspace." },
  { selector: "[data-walkthrough='nav-leaderboard']", title: "Revisa el progreso 📊", description: "Observa cómo avanza tu equipo en el ranking." },
];

const STORAGE_KEY = "kibbo_walkthrough_completed";

export function WalkthroughOverlay({ isAdmin }: { isAdmin: boolean }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps = isAdmin ? ADMIN_STEPS : COLLABORATOR_STEPS;
  const step = steps[stepIndex];

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [active, stepIndex, updateRect]);

  const finish = () => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const next = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  if (!active) return null;

  const padding = 8;
  const spotlightStyle = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : { top: "50%", left: "50%", width: 200, height: 100, transform: "translate(-50%, -50%)" };

  // Position tooltip below or above the spotlight
  const tooltipTop = rect ? rect.bottom + padding + 16 : undefined;
  const tooltipAbove = rect && rect.bottom + 250 > window.innerHeight;
  const tooltipStyle = rect
    ? tooltipAbove
      ? { bottom: window.innerHeight - rect.top + padding + 16, left: Math.max(16, rect.left) }
      : { top: tooltipTop, left: Math.max(16, rect.left) }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dark overlay with cutout */}
        <div className="absolute inset-0 bg-foreground/60" onClick={finish} />

        {/* Spotlight */}
        {rect && (
          <div
            className="absolute rounded-xl border-2 border-primary shadow-lg pointer-events-none"
            style={{
              ...spotlightStyle,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              zIndex: 10000,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-[10001] max-w-sm"
          style={tooltipStyle as any}
        >
          <div className="bg-card rounded-2xl shadow-xl p-5 border">
            <div className="flex items-start gap-3">
              <KibboExpression expression="excited" className="w-14 h-14 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-base">{step?.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{step?.description}</p>
              </div>
              <button onClick={finish} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === stepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={finish}>
                  Omitir
                </Button>
                <Button size="sm" className="gradient-primary" onClick={next}>
                  {stepIndex < steps.length - 1 ? "Siguiente" : "¡Empezar!"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
