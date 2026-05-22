import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Lightbulb, GraduationCap, UserRound, Star, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceAgent, type VoiceAgentMode, type ClientPersona, type ConversationReport } from "@/hooks/useVoiceAgent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const MODES: { id: VoiceAgentMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "tutor",
    label: "Tutor",
    icon: <GraduationCap className="w-4 h-4" />,
    description: "Resuelve dudas del curso",
  },
  {
    id: "tips",
    label: "Tips",
    icon: <Lightbulb className="w-4 h-4" />,
    description: "Consejos de ventas",
  },
  {
    id: "client",
    label: "Rol de cliente",
    icon: <UserRound className="w-4 h-4" />,
    description: "Practica una venta real",
  },
];

const PERSONAS: (ClientPersona & { id: string })[] = [
  {
    id: "roberto",
    name: "Roberto Sandoval",
    gender: "male",
    role: "Cliente interesado, familia de 4 personas, jardín de 60 m²",
    mood: "happy",
    context:
      "Llama tras ver un anuncio. Tiene presupuesto y quiere una piscina para este verano. Preguntará por modelos, plazos de instalación y financiación.",
  },
  {
    id: "claudia",
    name: "Claudia Reyes",
    gender: "female",
    role: "Cliente con piscina SWIM de 6 meses, muy frustrada",
    mood: "frustrated",
    context:
      "El agua de su piscina lleva 3 días verde y tiene invitados el sábado. Está convencida de que la piscina es defectuosa.",
  },
  {
    id: "libre",
    name: "Libre",
    gender: "neutral",
    role: "El agente inventa un perfil de cliente",
    mood: "neutral",
    context: "El agente creará un cliente con un perfil y situación propios para practicar.",
  },
];

function AudioVisualizer({ isSpeaking, status }: { isSpeaking: boolean; status: string }) {
  const isActive = status === "connected";
  return (
    <div className="flex items-center justify-center h-28 relative">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute rounded-full border-2",
            isActive
              ? isSpeaking
                ? "border-primary"
                : "border-primary/40"
              : "border-muted"
          )}
          style={{ width: 40 + i * 28, height: 40 + i * 28 }}
          animate={
            isActive
              ? {
                  scale: isSpeaking ? [1, 1.08 - i * 0.02, 1] : [1, 1.03, 1],
                  opacity: isSpeaking ? [0.8, 1, 0.8] : [0.3, 0.5, 0.3],
                }
              : { scale: 1, opacity: 0.2 }
          }
          transition={{
            duration: isSpeaking ? 0.6 : 1.4,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center z-10 transition-colors",
          isActive ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {isActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "text-green-600 bg-green-50 border-green-200"
    : score >= 5 ? "text-yellow-600 bg-yellow-50 border-yellow-200"
    : "text-red-600 bg-red-50 border-red-200";
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", color)}>
      <Star className="w-3.5 h-3.5 fill-current" />
      {score}/10
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/40 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t">{children}</div>}
    </div>
  );
}

function ConversationReportView({ report, mode }: { report: ConversationReport; mode: VoiceAgentMode }) {
  return (
    <div className="space-y-3">
      {/* Puntuación + Resumen */}
      {report.summary && (
        <div className="rounded-xl border bg-primary/5 px-4 py-3 space-y-2">
          {report.score !== undefined && <ScoreBadge score={report.score} />}
          <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
        </div>
      )}

      {/* Transcripción */}
      <CollapsibleSection title="Transcripción de la llamada" defaultOpen={false}>
        <div className="space-y-2 pt-3 max-h-64 overflow-y-auto">
          {report.transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "text-xs rounded-lg px-3 py-2 max-w-[90%]",
                entry.role === "user"
                  ? "bg-primary/10 text-primary ml-auto text-right"
                  : "bg-muted text-foreground"
              )}
            >
              <span className="font-medium block mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
                {entry.role === "user" ? "Tú" : "Cliente"}
              </span>
              {entry.message}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Insights del cliente (solo modo client) */}
      {mode === "client" && report.clientInsights && (
        <CollapsibleSection title="Comportamiento del cliente" defaultOpen={true}>
          <div className="pt-3 space-y-3">
            {report.clientInsights.interests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1.5">Lo que le interesó</p>
                <ul className="space-y-1">
                  {report.clientInsights.interests.map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.clientInsights.objections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1.5">Objeciones planteadas</p>
                <ul className="space-y-1">
                  {report.clientInsights.objections.map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-2">
                      <span className="text-red-400 mt-0.5">!</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.clientInsights.emotionalMoments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Momentos emocionales</p>
                <ul className="space-y-1">
                  {report.clientInsights.emotionalMoments.map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="mt-0.5">◦</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Tips de respuesta (modo client) */}
      {mode === "client" && report.tips && report.tips.length > 0 && (
        <CollapsibleSection title={`Tips para esta llamada (${report.tips.length})`} defaultOpen={true}>
          <div className="pt-3 space-y-4">
            {report.tips.map((tip, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">{tip.situation}</p>
                <p className="text-xs text-muted-foreground">{tip.whatHappened}</p>
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                  <p className="text-xs text-primary font-medium">Mejor respuesta:</p>
                  <p className="text-xs text-foreground mt-0.5">"{tip.betterResponse}"</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Puntos clave (modos tutor/tips) */}
      {mode !== "client" && report.keyPoints && report.keyPoints.length > 0 && (
        <CollapsibleSection title="Puntos clave de la sesión" defaultOpen={true}>
          <ul className="pt-3 space-y-1.5">
            {report.keyPoints.map((point, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <span className="text-primary mt-0.5">•</span>{point}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Áreas de mejora */}
      {report.improvements && report.improvements.length > 0 && (
        <CollapsibleSection title="Áreas de mejora">
          <ul className="pt-3 space-y-1.5">
            {report.improvements.map((item, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <span className="text-yellow-500 mt-0.5">→</span>{item}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VoiceAgentPanel({ open, onClose }: Props) {
  const [mode, setMode] = useState<VoiceAgentMode>("tutor");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("roberto");
  const { status, isSpeaking, startSession, endSession, lastError, report, analysisStatus, resetReport } = useVoiceAgent();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const showReport = analysisStatus === "done" && report !== null;
  const showAnalyzing = analysisStatus === "loading";

  const selectedPersona = PERSONAS.find((p) => p.id === selectedPersonaId);

  async function handleStart() {
    const persona = mode === "client" ? selectedPersona : undefined;
    await startSession(mode, persona);
  }

  async function handleEnd() {
    await endSession();
  }

  const speakerName =
    mode === "client"
      ? (selectedPersona && selectedPersona.name !== "Libre" ? selectedPersona.name : "El cliente")
      : "Ale";

  const statusLabel =
    status === "connected"
      ? isSpeaking
        ? `${speakerName} está hablando…`
        : "Escuchando…"
      : status === "connecting"
      ? "Conectando…"
      : "Listo para empezar";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base font-semibold">Asistente de voz</SheetTitle>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-y-auto px-5 py-4 gap-5">
          {/* Si hay reporte, mostrarlo en lugar del configurador */}
          {showReport ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informe de sesión</p>
              </div>
              <ConversationReportView report={report} mode={mode} />
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modo</p>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      disabled={isConnected || isConnecting}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all",
                        mode === m.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/30",
                        (isConnected || isConnecting) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {MODES.find((m) => m.id === mode)?.description}
                </p>
              </div>

              {/* Persona selector */}
              <AnimatePresence>
                {mode === "client" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Elige al cliente
                    </p>
                    <div className="space-y-2">
                      {PERSONAS.map((p) => (
                        <button
                          key={p.id}
                          disabled={isConnected || isConnecting}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={cn(
                            "w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all",
                            selectedPersonaId === p.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/30",
                            (isConnected || isConnecting) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground leading-snug mt-0.5">{p.role}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {lastError && (
                <div className="rounded-xl border border-destructive bg-destructive/5 px-3 py-2">
                  <p className="text-xs text-destructive font-medium">Error de conexión</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{lastError}</p>
                </div>
              )}

              {/* Analizando */}
              {showAnalyzing && (
                <div className="rounded-xl border bg-muted/30 px-4 py-4 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Analizando la llamada…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Generando insights con IA</p>
                  </div>
                </div>
              )}

              {/* Audio visualizer */}
              {!showAnalyzing && (
                <div className="rounded-2xl border bg-sidebar-accent/30 py-2">
                  <AudioVisualizer isSpeaking={isSpeaking} status={status} />
                  <p className="text-center text-xs text-muted-foreground pb-3">{statusLabel}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!showReport && (
          <div className="px-5 pb-5 pt-3 border-t">
            {!isConnected ? (
              <Button
                onClick={handleStart}
                disabled={isConnecting || showAnalyzing}
                className="w-full gap-2 gradient-primary text-primary-foreground"
              >
                <Mic className="w-4 h-4" />
                {isConnecting ? "Conectando…" : "Iniciar sesión"}
              </Button>
            ) : (
              <Button
                onClick={handleEnd}
                variant="destructive"
                className="w-full gap-2"
              >
                <MicOff className="w-4 h-4" />
                Terminar sesión
              </Button>
            )}
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Permite el acceso al micrófono cuando el navegador lo solicite
            </p>
          </div>
        )}
        {showReport && (
          <div className="px-5 pb-5 pt-3 border-t">
            <Button
              onClick={resetReport}
              variant="outline"
              className="w-full"
            >
              <Mic className="w-4 h-4 mr-2" />
              Nueva sesión
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
