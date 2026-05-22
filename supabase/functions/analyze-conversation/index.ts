import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAiConfig() {
  const API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!API_KEY) throw new Error("GEMINI_API_KEY not configured");
  return {
    apiKey: API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  };
}

async function callGemini(messages: any[], tool: any): Promise<any> {
  const { apiKey, url, model } = getAiConfig();
  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Gemini error (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Gemini no devolvió tool call");
    return JSON.parse(toolCall.function.arguments);
  }
  throw new Error("Gemini: máximo de reintentos alcanzado");
}

// Reintenta obtener el transcript hasta que esté disponible
async function fetchTranscript(conversationId: string, apiKey: string): Promise<any[]> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const data = await res.json();
    const transcript = data.transcript ?? [];
    if (transcript.length > 0) return transcript;
    if (i < 5) await new Promise((r) => setTimeout(r, 2000));
  }
  return [];
}

function buildAnalysisPrompt(
  mode: string,
  personaName: string | undefined,
  transcript: any[],
): { systemPrompt: string; userPrompt: string } {
  const transcriptText = transcript
    .map((t: any) => `${t.role === "user" ? "Vendedor" : "Cliente/Agente"}: ${t.message}`)
    .join("\n");

  if (mode === "client") {
    return {
      systemPrompt: `Eres un coach experto en ventas de piscinas SWIM. Analiza esta transcripción de una práctica de rol donde el aprendiz hace de vendedor y la IA hace de cliente${personaName ? ` (${personaName})` : ""}. Tu análisis ayuda al vendedor a mejorar sus técnicas.`,
      userPrompt: `Transcripción de la llamada:\n\n${transcriptText}\n\nAnaliza esta conversación y genera un informe de coaching.`,
    };
  }
  if (mode === "tutor") {
    return {
      systemPrompt: `Eres un asistente de aprendizaje. Resume qué dudas resolvió el aprendiz en esta sesión con la tutora Ale sobre el curso SWIM.`,
      userPrompt: `Transcripción:\n\n${transcriptText}\n\nGenera un resumen de la sesión de tutoría.`,
    };
  }
  return {
    systemPrompt: `Eres un coach de ventas SWIM. Resume los tips de ventas que se discutieron en esta sesión.`,
    userPrompt: `Transcripción:\n\n${transcriptText}\n\nGenera un resumen de los tips de ventas tratados.`,
  };
}

const ANALYSIS_TOOL_CLIENT = {
  type: "function",
  function: {
    name: "generate_coaching_report",
    description: "Genera un informe de coaching de ventas basado en la transcripción",
    parameters: {
      type: "object",
      required: ["summary", "clientInsights", "tips", "score", "improvements"],
      properties: {
        summary: { type: "string", description: "Resumen de 2-3 oraciones de cómo fue la llamada" },
        clientInsights: {
          type: "object",
          description: "Análisis del comportamiento del cliente simulado",
          required: ["interests", "objections", "emotionalMoments"],
          properties: {
            interests: {
              type: "array",
              items: { type: "string" },
              description: "Cosas que interesaron o motivaron al cliente",
            },
            objections: {
              type: "array",
              items: { type: "string" },
              description: "Objeciones o problemas que planteó el cliente",
            },
            emotionalMoments: {
              type: "array",
              items: { type: "string" },
              description: "Momentos emocionales clave (ej. 'Se frustró cuando...', 'Se animó cuando...')",
            },
          },
        },
        tips: {
          type: "array",
          description: "Tips específicos de respuesta para situaciones detectadas en esta llamada",
          items: {
            type: "object",
            required: ["situation", "whatHappened", "betterResponse"],
            properties: {
              situation: { type: "string", description: "Título corto de la situación (ej. 'Objeción de precio')" },
              whatHappened: { type: "string", description: "Qué dijo el cliente y cómo respondió el vendedor" },
              betterResponse: { type: "string", description: "Cómo responder mejor la próxima vez, con ejemplo de frase" },
            },
          },
        },
        score: {
          type: "number",
          description: "Puntuación del vendedor del 1 al 10 basada en técnica, empatía y cierre",
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          description: "3 áreas concretas de mejora para el vendedor",
        },
      },
    },
  },
};

const ANALYSIS_TOOL_GENERIC = {
  type: "function",
  function: {
    name: "generate_session_summary",
    description: "Genera un resumen de la sesión",
    parameters: {
      type: "object",
      required: ["summary", "keyPoints", "tips"],
      properties: {
        summary: { type: "string", description: "Resumen de la sesión en 2-3 oraciones" },
        keyPoints: {
          type: "array",
          items: { type: "string" },
          description: "Puntos clave cubiertos en la sesión",
        },
        tips: {
          type: "array",
          items: { type: "string" },
          description: "Tips prácticos obtenidos o recordados en la sesión",
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { conversationId, mode, personaName } = await req.json();
  if (!conversationId) {
    return new Response(JSON.stringify({ error: "conversationId requerido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const elevenApiKey = Deno.env.get("ELEVENLABS_API_KEY")!;

  // 1. Obtener transcripción de ElevenLabs (con reintentos)
  let transcript: any[];
  try {
    transcript = await fetchTranscript(conversationId, elevenApiKey);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Error obteniendo transcripción: ${e}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (transcript.length === 0) {
    return new Response(JSON.stringify({ error: "Transcripción vacía o no disponible aún" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Analizar con Gemini
  const { systemPrompt, userPrompt } = buildAnalysisPrompt(mode, personaName, transcript);
  const tool = mode === "client" ? ANALYSIS_TOOL_CLIENT : ANALYSIS_TOOL_GENERIC;

  let analysis: any;
  try {
    analysis = await callGemini(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tool,
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: `Error en análisis IA: ${e}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ transcript, analysis }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
