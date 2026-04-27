// =====================================================================
// regenerate-lesson — Regenera UNA lección con IA o convierte su tipo.
//
// Body:
//   {
//     lessonId: uuid,
//     companyId: uuid,
//     mode: 'regenerate' | 'convert',
//     newType?: LessonType,        // requerido si mode = 'convert'
//     extraInstructions?: string,
//   }
//
// Reglas:
// - Verifica que la lección pertenezca a un curso de la company del caller.
// - Usa el contexto del curso (título, brief, lecciones cercanas) para mejor calidad.
// - Devuelve { lesson_type, content: { blocks } } y guarda en DB.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LESSON_TYPES = [
  "reading", "concept", "flashcards", "steps",
  "comparison", "case_study", "interactive_quiz", "video_embed",
] as const;

function getAi() {
  const key = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("No AI API key configured");
  const useLov = !!Deno.env.get("LOVABLE_API_KEY");
  return {
    apiKey: key,
    url: useLov
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions",
    model: useLov ? "google/gemini-2.5-pro" : "gpt-4o",
  };
}

const TOOL = {
  type: "function",
  function: {
    name: "build_lesson",
    description: "Build a typed lesson with structured blocks",
    parameters: {
      type: "object",
      required: ["lesson_type", "title", "blocks"],
      properties: {
        lesson_type: { type: "string", enum: [...LESSON_TYPES] },
        title: { type: "string" },
        blocks: {
          type: "array",
          description:
            "Blocks must match lesson_type: reading→heading/paragraph/callout/quote/code/image/divider; concept→term; flashcards→flashcard; steps→step; comparison→comparison_table; case_study→scenario/question/reflection; interactive_quiz→mc/true_false/fill_blank/match_pairs/order_steps; video_embed→video.",
          items: { type: "object" },
        },
      },
    },
  },
};

async function callAi(messages: any[]) {
  const { apiKey, url, model } = getAi();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "build_lesson" } },
      temperature: 0.6,
      max_tokens: 6000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Rate limit excedido. Intenta en un minuto.");
    if (res.status === 402) throw new Error("Sin créditos en Lovable AI. Recarga en Settings.");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("AI sin respuesta estructurada");
  return JSON.parse(tc.function.arguments);
}

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonId, companyId, mode, newType, extraInstructions } = await req.json();
    if (!lessonId || !companyId || !mode) throw new Error("lessonId, companyId, mode son requeridos");
    if (mode !== "regenerate" && mode !== "convert") throw new Error("mode debe ser 'regenerate' o 'convert'");
    if (mode === "convert" && !LESSON_TYPES.includes(newType)) throw new Error("newType inválido");

    const supabase = getServiceClient();

    // Cargar lección + módulo + curso para validar tenant y obtener contexto.
    const { data: lesson, error: le } = await supabase
      .from("lessons")
      .select("id, title, content, lesson_type, module_id, sort_order")
      .eq("id", lessonId)
      .single();
    if (le || !lesson) throw new Error("Lección no encontrada");

    const { data: mod } = await supabase
      .from("modules")
      .select("id, title, description, course_id")
      .eq("id", lesson.module_id)
      .single();
    if (!mod) throw new Error("Módulo no encontrado");

    const { data: course } = await supabase
      .from("courses")
      .select("id, title, description, level, company_id, source_brief")
      .eq("id", mod.course_id)
      .single();
    if (!course || course.company_id !== companyId) throw new Error("No autorizado");

    const targetType = mode === "convert" ? newType : (lesson.lesson_type || "reading");

    const currentBlocks = Array.isArray((lesson.content as any)?.blocks)
      ? (lesson.content as any).blocks
      : [];
    const currentText = (lesson.content as any)?.text || "";

    const briefSummary =
      typeof course.source_brief === "object" && course.source_brief
        ? JSON.stringify(course.source_brief).slice(0, 4000)
        : "";

    const sys = `Eres un diseñador instruccional experto. Generas lecciones tipadas para una plataforma LMS gamificada (estilo Duolingo + Notion). Respondes SIEMPRE en español. Sigues estrictamente el schema de bloques según el lesson_type pedido.

Tipos y bloques permitidos:
- reading: heading {text, level}, paragraph {text}, callout {variant, text, title?}, quote {text, cite?}, code {language?, code}, image {url, alt?, caption?}, divider {}
- concept: term {term, definition, example?}
- flashcards: flashcard {front, back, hint?}
- steps: step {n, title, description, tip?}
- comparison: comparison_table {headers[], rows: [{label, cells[]}]}
- case_study: scenario {text, title?}, question {text}, reflection {text}
- interactive_quiz: mc {question, options[], correct, explanation?} | true_false {question, correct, explanation?} | fill_blank {sentence, correct, explanation?} | match_pairs {pairs:[{left,right}]} | order_steps {steps[]}
- video_embed: video {provider, url, title?}

Reglas:
- Usa entre 3 y 8 bloques.
- Sin markdown dentro de los textos (solo texto plano).
- Lenguaje claro, directo, profesional.`;

    const userInstr =
      mode === "convert"
        ? `Convierte la siguiente lección al tipo "${targetType}". Reorganiza el contenido conservando la información esencial pero adaptándola a la mecánica del nuevo tipo.`
        : `Mejora y regenera esta lección manteniendo su tipo "${targetType}". Hazla más clara, atractiva y didáctica.`;

    const ctx = `Curso: "${course.title}" (nivel ${course.level || "beginner"}).
Módulo: "${mod.title}". Descripción del módulo: ${mod.description || "(sin descripción)"}.
Lección actual: "${lesson.title}".
Tipo actual: ${lesson.lesson_type || "reading"}.
Tipo objetivo: ${targetType}.

Contenido actual (bloques): ${JSON.stringify(currentBlocks).slice(0, 4000)}
${currentText ? `Texto legacy: ${currentText.slice(0, 3000)}` : ""}

${briefSummary ? `Brief del curso: ${briefSummary}` : ""}

${extraInstructions ? `Instrucciones adicionales del admin: ${extraInstructions}` : ""}

${userInstr}`;

    const result = await callAi([
      { role: "system", content: sys },
      { role: "user", content: ctx },
    ]);

    if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
      throw new Error("La IA no devolvió bloques válidos");
    }

    const newContent = { blocks: result.blocks };
    const newTitle = (result.title || lesson.title).toString().slice(0, 200);

    const { error: ue } = await supabase
      .from("lessons")
      .update({
        title: newTitle,
        lesson_type: targetType,
        content: newContent,
      } as any)
      .eq("id", lessonId);
    if (ue) throw new Error(`No se pudo guardar: ${ue.message}`);

    return new Response(
      JSON.stringify({
        ok: true,
        lesson: { id: lessonId, title: newTitle, lesson_type: targetType, content: newContent },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("regenerate-lesson error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
