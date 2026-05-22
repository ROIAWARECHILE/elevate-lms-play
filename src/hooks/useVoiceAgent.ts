import { useState, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceAgentMode = "tutor" | "tips" | "client";

export interface ClientPersona {
  name: string;
  role: string;
  mood: string;
  context: string;
  gender: "male" | "female" | "neutral";
}

export interface TranscriptEntry {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
}

export interface ConversationTip {
  situation: string;
  whatHappened: string;
  betterResponse: string;
}

export interface ClientInsights {
  interests: string[];
  objections: string[];
  emotionalMoments: string[];
}

export interface ConversationReport {
  transcript: TranscriptEntry[];
  // Modo client
  summary?: string;
  clientInsights?: ClientInsights;
  tips?: ConversationTip[];
  score?: number;
  improvements?: string[];
  // Modos tutor/tips
  keyPoints?: string[];
}

export type AnalysisStatus = "idle" | "loading" | "done" | "error";

// Voces chilenas disponibles en la cuenta ElevenLabs
const VOICE_FEMALE_CHILEAN = "JM2A9JbRp8XUJ7bdCXJc"; // Fernanda olea 1
const VOICE_MALE_CHILEAN = "0cheeVA5B3Cv6DGq65cT";

function selectVoice(mode: VoiceAgentMode, persona?: ClientPersona): string {
  if (mode === "client" && persona?.gender === "male") return VOICE_MALE_CHILEAN;
  return VOICE_FEMALE_CHILEAN;
}

const MOOD_DESCRIPTION: Record<string, string> = {
  neutral: "neutral, educado/a",
  frustrated: "frustrado/a e impaciente",
  happy: "contento/a y receptivo/a",
  confused: "confundido/a y con dudas",
  demanding: "exigente y muy directo/a",
};

function buildSystemPrompt(mode: VoiceAgentMode, persona?: ClientPersona): string {
  switch (mode) {
    case "tutor":
      return `Eres Ale, tutora virtual del curso SWIM Ventas y Postventa en la plataforma Kibbo.
Ayudas a los vendedores de piscinas SWIM a resolver dudas sobre el producto: modelos (S-Compact 3×1.5m, M-Safe, L-Family 6×3m, XL), garantías (5 años estructura, 2 años equipos), instalación (48 horas), financiación (0% TAE hasta 24 meses, hasta 60 cuotas), servicio técnico (48 técnicos propios, 72h garantía).
Responde siempre en español. Sé concisa y práctica: máximo 2-3 frases por respuesta.`;

    case "tips":
      return `Eres Ale, coach de ventas experta en piscinas SWIM en la plataforma Kibbo.
Tu especialidad es el manejo de objeciones (precio, espacio reducido, mantenimiento complicado, comparación con competencia), técnicas de cierre y estrategias de financiación.
Cuando el vendedor te pida un tip, da exactamente UN consejo práctico y accionable con una frase de ejemplo lista para usar con el cliente.
Responde siempre en español. Sé directa y muy concisa.`;

    case "client": {
      const moodDesc = persona ? (MOOD_DESCRIPTION[persona.mood] ?? persona.mood) : "neutral, curioso";

      if (!persona || persona.name === "Libre") {
        return `=== ROL EXCLUSIVO: ERES UN CLIENTE ===

ESCENA: Un vendedor de piscinas SWIM te acaba de llamar por teléfono. TÚ eres el cliente. La persona que habla contigo es el vendedor, no tú.

PERFIL: Cliente potencial, interesado en piscinas pero cauteloso con el precio. Tienes un jardín mediano y una familia. Estado de ánimo: ${moodDesc}.

LO QUE DEBES HACER (comportamiento de cliente):
- Hacer preguntas sobre precios, modelos, plazos de instalación, garantías, mantenimiento
- Mostrar dudas y vacilaciones: "no sé si cabe en mi jardín", "me parece caro", "¿y si falla?"
- Reaccionar con más o menos entusiasmo según cómo responda el vendedor
- Hablar de tu situación: tu familia, tu jardín, tus necesidades

PROHIBIDO — NUNCA HAGAS ESTO:
- NUNCA expliques el producto como si fueras el vendedor
- NUNCA preguntes "¿en qué te puedo ayudar?" ni "¿qué buscas?" (eso lo dice el vendedor)
- NUNCA propongas alternativas de venta ni menciones promociones
- NUNCA rompas el personaje ni digas que eres IA
- NUNCA tomes el rol activo de vender, persuadir o asesorar

Si en algún momento sientes que empiezas a hablar como vendedor, corrígete: "Perdona, quería decir... [vuelve a tu pregunta de cliente]"

Idioma: español. Frases cortas, tono de llamada telefónica real.`;
      }

      return `=== ROL EXCLUSIVO: ERES ${persona.name.toUpperCase()}, UN CLIENTE ===

ESCENA: Un vendedor de piscinas SWIM te ha llamado por teléfono. TÚ eres el cliente. La persona al otro lado es el vendedor, que intentará convencerte.

IDENTIDAD COMPLETA:
- Tu nombre: ${persona.name}
- Quién eres: ${persona.role}
- Cómo te sientes ahora: ${moodDesc}
- Tu situación concreta: ${persona.context}

LO QUE HACE UN CLIENTE EN ESTA LLAMADA:
- Escucha lo que dice el vendedor y reacciona según tu estado emocional (${moodDesc})
- Hace preguntas de comprador: precio, plazos, garantías, si cabe en tu espacio, qué pasa si algo falla
- Si el vendedor responde bien y genera confianza → te muestras más receptivo/a
- Si el vendedor responde mal, evade o no convence → te muestras más reticente, incluso molesto/a
- Introduces tus propias preocupaciones personales relacionadas con tu situación

PROHIBIDO — NUNCA HAGAS ESTO:
- NUNCA expliques las características o beneficios del producto como si los conocieras
- NUNCA hagas preguntas de vendedor: "¿en qué te puedo ayudar?", "¿cuál es tu presupuesto?"
- NUNCA propongas soluciones, descuentos ni alternativas de venta
- NUNCA rompas el personaje de ${persona.name} bajo ningún concepto
- NUNCA digas que eres una IA, asistente virtual o simulación
- NUNCA adoptes un tono de atención al cliente o de soporte técnico

REGLA DE RECUPERACIÓN: Si empiezas a sonar como vendedor, detente y vuelve: "Bueno, lo que yo quiero saber es... [pregunta de cliente]"

Idioma: español. Frases cortas y naturales, exactamente como hablarías por teléfono.`;
    }
  }
}

function buildFirstMessage(mode: VoiceAgentMode, persona?: ClientPersona): string {
  switch (mode) {
    case "tutor":
      return "Hola, soy Ale. ¿Qué duda tienes sobre el curso SWIM?";
    case "tips":
      return "Hola, soy Ale. Cuéntame la situación con tu cliente y te doy un tip concreto.";
    case "client":
      if (persona && persona.name !== "Libre") {
        return `Hola, buenas. Me llamo ${persona.name}.`;
      }
      return "Hola, buenos días. Llamaba por lo de las piscinas que anuncian...";
  }
}

export function useVoiceAgent() {
  const [lastError, setLastError] = useState<string | null>(null);
  const [report, setReport] = useState<ConversationReport | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");

  // Guardamos el contexto de la sesión activa para usarlo en el análisis post-llamada
  const sessionRef = useRef<{ conversationId: string; mode: VoiceAgentMode; personaName?: string } | null>(null);

  const conversation = useConversation({
    onError: (msg: string) => {
      console.error("[VoiceAgent] Error:", msg);
      setLastError(msg);
    },
    onDisconnect: (details: any) => {
      console.warn("[VoiceAgent] Disconnected:", JSON.stringify(details, null, 2));
      if (details?.reason === "error") {
        const msg = details.message ?? details.context?.reason ?? "Error de conexión desconocido";
        setLastError(msg);
      } else if (details?.reason === "agent") {
        setLastError("El agente cerró la sesión.");
      }
    },
    onConnect: () => {
      setLastError(null);
      // Capturar el conversation ID en cuanto conecta
      const convId = conversation.getId?.();
      if (convId && sessionRef.current) {
        sessionRef.current.conversationId = convId;
      }
      console.log("[VoiceAgent] Connected OK, id:", conversation.getId?.());
    },
  });

  async function startSession(mode: VoiceAgentMode, persona?: ClientPersona) {
    setLastError(null);
    setReport(null);
    setAnalysisStatus("idle");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setLastError("Permiso de micrófono denegado. Habilítalo en la configuración del navegador.");
      return;
    }

    const { data, error } = await supabase.functions.invoke("elevenlabs-token", {
      body: { mode },
    });

    if (error) {
      let msg: string = error.message ?? "Error al llamar a la Edge Function.";
      try {
        const body = await (error as any).context?.json?.();
        if (body?.error) msg = body.error;
      } catch { /* body no es JSON */ }
      setLastError(msg);
      return;
    }

    if (!data?.signedUrl) {
      setLastError((data?.error as string) ?? "La Edge Function no devolvió una URL de sesión.");
      return;
    }

    // Guardamos el contexto para el análisis post-llamada
    sessionRef.current = {
      conversationId: "",
      mode,
      personaName: persona?.name,
    };

    await conversation.startSession({
      signedUrl: data.signedUrl,
      overrides: {
        agent: {
          prompt: { prompt: buildSystemPrompt(mode, persona) },
          firstMessage: buildFirstMessage(mode, persona),
        },
        tts: {
          voiceId: selectVoice(mode, persona),
          stability: 0.35,
          similarityBoost: 0.80,
          style: 0.25,
          useSpeakerBoost: true,
        },
      },
    } as any);
  }

  async function endSession() {
    const ctx = sessionRef.current;
    await conversation.endSession();

    // Lanzar análisis si hubo conversación
    if (!ctx?.conversationId) return;

    setAnalysisStatus("loading");
    try {
      // Pequeña espera para que ElevenLabs procese el transcript
      await new Promise((r) => setTimeout(r, 3000));

      const { data, error } = await supabase.functions.invoke("analyze-conversation", {
        body: {
          conversationId: ctx.conversationId,
          mode: ctx.mode,
          personaName: ctx.personaName,
        },
      });

      if (error || !data) throw new Error(error?.message ?? "Sin respuesta");

      const r: ConversationReport = {
        transcript: data.transcript ?? [],
        summary: data.analysis?.summary,
        clientInsights: data.analysis?.clientInsights,
        tips: data.analysis?.tips,
        score: data.analysis?.score,
        improvements: data.analysis?.improvements,
        keyPoints: data.analysis?.keyPoints,
      };
      setReport(r);
      setAnalysisStatus("done");
    } catch (e: any) {
      console.error("[VoiceAgent] Analysis error:", e);
      setAnalysisStatus("error");
    }
  }

  function resetReport() {
    setReport(null);
    setAnalysisStatus("idle");
    setLastError(null);
  }

  return {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    startSession,
    endSession,
    lastError,
    report,
    analysisStatus,
    resetReport,
  };
}
