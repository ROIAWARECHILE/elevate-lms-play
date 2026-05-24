// =====================================================================
// generate-study-guide — Genera una guía de repaso por módulo.
// Toma todas las lecciones del módulo, las sintetiza con Gemini y
// devuelve secciones estructuradas (conceptos, puntos clave, FAQ,
// tips para el quiz). Cachea el resultado en modules.study_guide_cache.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAiConfig() {
  const API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!API_KEY) throw new Error("OPENAI_API_KEY not configured");
  return {
    apiKey: API_KEY,
    url: "https://api.openai.com/v1/chat/completions",
    model: Deno.env.get("OPENAI_MODEL") || "gpt-4o",
  };
}

async function callAi(messages: any[], tool: any, temperature = 0.35) {
  const { apiKey, url, model } = getAiConfig();
  const maxRetries = 2;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const temp = attempt === 0 ? temperature : Math.max(0.15, temperature - 0.1 * attempt);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: [tool],
          tool_choice: { type: "function", function: { name: tool.function.name } },
          temperature: temp,
          max_tokens: 8000,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) {
          if (attempt < maxRetries) {
            lastErr = new Error("AI_RATE_LIMITED");
            await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
            continue;
          }
          throw new Error("AI_RATE_LIMITED");
        }
        throw new Error(`Gemini error (${res.status}): ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) { lastErr = new Error("No tool call"); continue; }
      try { return JSON.parse(toolCall.function.arguments); }
      catch { lastErr = new Error("Invalid JSON"); continue; }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === maxRetries) throw lastErr;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("AI call failed");
}

const STUDY_GUIDE_TOOL = {
  type: "function",
  function: {
    name: "build_study_guide",
    description: "Generate a structured study guide for a course module",
    parameters: {
      type: "object",
      required: ["key_concepts", "key_points", "faq", "quiz_tips"],
      properties: {
        key_concepts: {
          type: "array",
          description: "Glossary of the most important terms/concepts of the module",
          items: {
            type: "object",
            required: ["term", "definition"],
            properties: {
              term: { type: "string" },
              definition: { type: "string", description: "1-2 sentence definition, plain language" },
            },
          },
        },
        key_points: {
          type: "array",
          description: "5-8 essential takeaways from all lessons, in bullet form",
          items: { type: "string" },
        },
        faq: {
          type: "array",
          description: "3-5 common questions a learner would ask, with concise answers",
          items: {
            type: "object",
            required: ["question", "answer"],
            properties: {
              question: { type: "string" },
              answer: { type: "string", description: "2-3 sentences max" },
            },
          },
        },
        quiz_tips: {
          type: "array",
          description: "3-5 specific things to remember for the module quiz (common traps, key distinctions)",
          items: { type: "string" },
        },
      },
    },
  },
};

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractTextFromBlocks(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      if (!b || typeof b !== "object") return "";
      switch (b.type) {
        case "heading":
        case "paragraph": return b.text || "";
        case "callout": return b.text || "";
        case "quote": return b.text ? `"${b.text}"` : "";
        case "term": return `${b.term}: ${b.definition}. ${b.example || ""}`;
        case "flashcard": return `Q: ${b.front} — A: ${b.back}`;
        case "step": return `Paso ${b.n}: ${b.title}. ${b.description || ""}`;
        case "sop_step": return `${b.title}: ${b.description || ""}`;
        case "scenario": return b.text || "";
        case "question": return b.text || "";
        case "reflection": return b.text || "";
        case "mc": return `${b.question} (correcto: ${b.correct})`;
        case "true_false": return `${b.question} (${b.correct ? "Verdadero" : "Falso"})`;
        case "fill_blank": return b.sentence || "";
        case "comparison_table":
          if (!b.rows) return "";
          return b.rows.map((r: any) => `${r.label}: ${(r.cells || []).join(" vs ")}`).join(". ");
        default: return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { moduleId, forceRegenerate = false } = await req.json();
    if (!moduleId) throw new Error("moduleId requerido");

    const supabase = getServiceClient();

    // Verificar que el módulo existe
    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id, title, description, course_id, study_guide_cache")
      .eq("id", moduleId)
      .single();
    if (modErr || !mod) throw new Error("Módulo no encontrado");

    // Devolver cache si existe y no se fuerza regeneración
    if (mod.study_guide_cache && !forceRegenerate) {
      return json({ guide: mod.study_guide_cache, cached: true });
    }

    // Obtener todas las lecciones del módulo
    const { data: lessons } = await supabase
      .from("lessons")
      .select("title, lesson_type, content")
      .eq("module_id", moduleId)
      .order("sort_order");

    if (!lessons || lessons.length === 0) {
      throw new Error("El módulo no tiene lecciones aún");
    }

    // Construir contexto de texto para la IA
    const lessonSummaries = lessons.map((l: any) => {
      const blocks = l.content?.blocks || [];
      const text = extractTextFromBlocks(blocks);
      return `### Lección: ${l.title} (tipo: ${l.lesson_type})\n${text.slice(0, 3000)}`;
    });

    const context = lessonSummaries.join("\n\n");

    const prompt = `Eres un experto pedagogo. Genera una guía de repaso concisa y útil para el módulo "${mod.title}".

Contenido del módulo:
${context.slice(0, 20000)}

Instrucciones:
- key_concepts: los 4-8 términos/conceptos más importantes con definiciones claras en español
- key_points: 5-8 puntos esenciales que el estudiante debe recordar
- faq: 3-5 preguntas frecuentes que un estudiante haría, con respuestas directas
- quiz_tips: 3-5 cosas específicas a recordar para el quiz (trampas comunes, distinciones clave)
- Todo en español, lenguaje claro y directo
- Sé conciso: cada elemento debe poder leerse en 10-15 segundos`;

    const guide = await callAi(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      STUDY_GUIDE_TOOL,
      0.35,
    );

    // Guardar en cache
    await supabase
      .from("modules")
      .update({ study_guide_cache: guide })
      .eq("id", moduleId);

    return json({ guide, cached: false });
  } catch (e: any) {
    console.error("generate-study-guide error:", e?.message);
    return json({ error: e?.message || "Error desconocido" }, 500);
  }
});
