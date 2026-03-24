import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { KibboExpression, type KibboExpressionType } from "./KibboExpression";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Step {
  selector: string;
  title: string;
  description: string;
  expression: KibboExpressionType;
}

const COLLABORATOR_STEPS: Step[] = [
  { selector: "[data-walkthrough='dashboard']", title: "¡Bienvenido a Kibbo! 🎉", description: "Tu plataforma de aprendizaje corporativo. Aquí verás tu progreso diario.", expression: "excited" },
  { selector: "[data-walkthrough='stats']", title: "Tu progreso y XP ⚡", description: "Acumula puntos de experiencia completando lecciones y quizzes.", expression: "determined" },
  { selector: "[data-walkthrough='nav-courses']", title: "Explora los cursos 📚", description: "Descubre y accede a los cursos disponibles para ti.", expression: "thumbsup" },
  { selector: "[data-walkthrough='daily-goal']", title: "Meta diaria 🎯", description: "Completa lecciones cada día para mantener tu racha.", expression: "determined" },
  { selector: "[data-walkthrough='nav-leaderboard']", title: "Compite con tu equipo 🏆", description: "Sube en el ranking completando más cursos.", expression: "celebrating" },
];

const ADMIN_STEPS: Step[] = [
  { selector: "[data-walkthrough='dashboard']", title: "¡Bienvenido a Kibbo! 🎉", description: "Administra la capacitación de tu equipo desde aquí.", expression: "excited" },
  { selector: "[data-walkthrough='nav-admin-courses']", title: "Crea cursos 📝", description: "Diseña cursos con módulos, lecciones y quizzes interactivos.", expression: "thinking" },
  { selector: "[data-walkthrough='admin-steps']", title: "Primeros pasos 🚀", description: "Sigue estos pasos para configurar tu workspace.", expression: "thumbsup" },
  { selector: "[data-walkthrough='nav-leaderboard']", title: "Revisa el progreso 📊", description: "Observa cómo avanza tu equipo en el ranking.", expression: "celebrating" },
];

const STORAGE_KEY = "kibbo_walkthrough_completed";

export function WalkthroughOverlay({ isAdmin }: { isAdmin: boolean }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = isAdmin ? ADMIN_STEPS : COLLABORATOR_STEPS;
  const step = steps[stepIndex];

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 1000);
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
    // Small delay to let DOM render
    const timer = setTimeout(updateRect, 100);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
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

  const prev = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  if (!active) return null;

  const padding = 8;

  // Calculate tooltip position — center it horizontally relative to spotlight, constrained to viewport
  const getTooltipPosition = () => {
    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as React.CSSProperties;
    }

    const tooltipWidth = 360;
    const tooltipHeight = 200;
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Try below first
    const belowY = rect.bottom + padding + margin;
    const aboveY = rect.top - padding - margin - tooltipHeight;
    const placeBelow = belowY + tooltipHeight < vh;
    const top = placeBelow ? belowY : Math.max(margin, aboveY);

    // Center horizontally on the spotlight, but clamp to viewport
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(margin, Math.min(left, vw - tooltipWidth - margin));

    return { top, left, width: tooltipWidth } as React.CSSProperties;
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* SVG mask overlay — single dark layer with a transparent cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 9999 }}>
          <defs>
            <mask id="walkthrough-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - padding}
                  y={rect.top - padding}
                  width={rect.width + padding * 2}
                  height={rect.height + padding * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#walkthrough-mask)"
            onClick={finish}
            style={{ cursor: "pointer" }}
          />
        </svg>

        {/* Highlight border around target */}
        {rect && (
          <motion.div
            className="absolute rounded-xl border-2 border-primary pointer-events-none"
            style={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              zIndex: 10000,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            layoutId="spotlight-border"
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={stepIndex}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="absolute z-[10001]"
          style={getTooltipPosition()}
        >
          <div className="bg-card rounded-2xl shadow-2xl p-5 border border-border">
            <div className="flex items-start gap-3">
              <KibboExpression
                key={`expr-${stepIndex}`}
                expression={step?.expression || "excited"}
                className="w-14 h-14 flex-shrink-0 rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-foreground">{step?.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step?.description}</p>
              </div>
              <button onClick={finish} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted -mt-1 -mr-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-2 bg-primary/40" : "w-2 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Button variant="ghost" size="sm" onClick={finish} className="text-xs text-muted-foreground h-8">
                  Omitir
                </Button>
                {stepIndex > 0 && (
                  <Button variant="outline" size="sm" onClick={prev} className="h-8 w-8 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <Button size="sm" className="gradient-primary h-8 px-4" onClick={next}>
                  {stepIndex < steps.length - 1 ? (
                    <>Siguiente <ChevronRight className="w-4 h-4 ml-1" /></>
                  ) : (
                    "¡Empezar! 🚀"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
