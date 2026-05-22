import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Lightbulb, HelpCircle, Target, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StudyGuide {
  key_concepts: { term: string; definition: string }[];
  key_points: string[];
  faq: { question: string; answer: string }[];
  quiz_tips: string[];
}

interface Props {
  moduleId: string;
  moduleTitle: string;
  open: boolean;
  onClose: () => void;
}

function Section({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StudyGuideModal({ moduleId, moduleTitle, open, onClose }: Props) {
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-study-guide", {
        body: { moduleId, forceRegenerate: force },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Error al generar guía");
      setGuide(data.guide);
      setCached(data.cached);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !guide && !loading) load();
    if (!isOpen) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-primary" />
            Guía de repaso — {moduleTitle}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando guía de repaso…</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>Reintentar</Button>
          </div>
        )}

        {guide && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {cached && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Guía guardada</span>
                <button
                  onClick={() => load(true)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerar
                </button>
              </div>
            )}

            {/* Conceptos clave */}
            {guide.key_concepts?.length > 0 && (
              <Section icon={<Lightbulb className="w-4 h-4 text-amber-500" />} title="Conceptos clave">
                <dl className="space-y-2.5">
                  {guide.key_concepts.map((c, i) => (
                    <div key={i}>
                      <dt className="font-semibold text-sm">{c.term}</dt>
                      <dd className="text-sm text-muted-foreground leading-relaxed">{c.definition}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {/* Puntos esenciales */}
            {guide.key_points?.length > 0 && (
              <Section icon={<BookOpen className="w-4 h-4 text-primary" />} title="Puntos esenciales">
                <ul className="space-y-1.5">
                  {guide.key_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* FAQ */}
            {guide.faq?.length > 0 && (
              <Section icon={<HelpCircle className="w-4 h-4 text-blue-500" />} title="Preguntas frecuentes" defaultOpen={false}>
                <div className="space-y-3">
                  {guide.faq.map((item, i) => (
                    <div key={i}>
                      <p className="font-semibold text-sm">{item.question}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Tips para el quiz */}
            {guide.quiz_tips?.length > 0 && (
              <Section icon={<Target className="w-4 h-4 text-destructive" />} title="Para el quiz — no olvides" defaultOpen={false}>
                <ul className="space-y-1.5">
                  {guide.quiz_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-destructive font-bold flex-shrink-0">•</span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
