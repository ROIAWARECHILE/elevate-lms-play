// =====================================================================
// PracticeCTA — widget de Práctica diaria (SRS) para el Dashboard.
// =====================================================================
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Brain, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSrsDueCount } from "@/hooks/useSRS";

export function PracticeCTA() {
  const { count } = useSrsDueCount();
  const hasDue = count > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <Card className={`shadow-card overflow-hidden ${hasDue ? "border-primary/40" : ""}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            hasDue ? "gradient-primary shadow-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {hasDue ? <Brain className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {hasDue ? "Práctica adaptativa lista" : "Práctica diaria"}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasDue
                ? `${count} ${count === 1 ? "tarjeta" : "tarjetas"} para repasar ahora`
                : "Sin tarjetas pendientes. Completa lecciones para alimentar tu memoria."}
            </p>
          </div>
          <Button asChild size="sm" className={hasDue ? "gradient-primary shadow-primary" : ""} variant={hasDue ? "default" : "outline"}>
            <Link to="/app/practice">
              Practicar <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
