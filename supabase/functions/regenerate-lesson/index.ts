// =====================================================================
// regenerate-lesson — Regenera UNA lección con IA o convierte su tipo.
// Usa el validador compartido para garantizar contenido renderizable.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import {
  sanitizeBlocksForLessonType,
  blocksMeetMinimum,
  MIN_BLOCKS_BY_TYPE,
} from "../_shared/course-quality.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LESSON_TYPES = [
  "reading", "concept", "flashcards", "steps",
  "comparison", "case_study", "interactive_quiz",
  "video_embed", "sop_walkthrough",
] as const;

function getAi() {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  return {
    apiKey: key,
    url: "https://api.openai.com/v1/chat/completions",
    model: Deno.env.get("OPENAI_MODEL") || "gpt-4o",
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
        blocks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
    },
  },
};

const HINTS: Record<string, string> = {
  reading: `heading {text,level} | paragraph {text} | callout {variant,text,title?} | quote {text,cite?} | code {language?,code} | image {url,alt?,caption?} | divider {}`,
  concept: `term {term, definition, example?}`,
  flashcards: `flashcard {front, back, hint?}`,
  steps: `step {n, title, description, tip?}`,
  comparison: `comparison_table {headers[]≥2, rows:[{label, cells[]}]≥2}`,
  case_study: `scenario {text, title?} | question {text} | reflection {text}`,
  interactive_quiz: `mc {question, options[]≥3, correct(igual a una opción), explanation?} | true_false {question, correct: boolean, explanation?} | fill_blank {sentence con ___, correct: string|string[], explanation?} | match_pairs {pairs:[{left,right}]≥3} | order_steps {steps[]≥3} | sort_into_buckets {buckets[], items[]} | highlight_terms {sentence, terms[]} | tap_to_complete {sentence con ___, bank[], correct[] subset bank}`,
  video_embed: `video {provider:youtube|vimeo|url, url, title?}`,
  sop_walkthrough: `sop_step {n, title, description, warning?, must_check?: true} (mín 3)`,
};

async function callAi(messages: any[], opts: { temperature?: number } = {}) {
  const { apiKey, url, model } = getAi();
  const maxRetries = 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, messages, tools: [TOOL],
        tool_choice: { type: "function", function: { name: "build_lesson" } },
        temperature: opts.temperature ?? 0.55,
        max_tokens: 6000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc) throw new Error("AI sin respuesta estructurada");
      return JSON.parse(tc.function.arguments);
    }
    const t = await res.text();
    if (res.status === 429 && attempt < maxRetries) {
      lastErr = new Error("rate limited");
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) throw new Error("Rate limit excedido en OpenAI. Espera unos segundos y reintenta.");
    if (res.status === 401 || res.status === 403) throw new Error("OPENAI_API_KEY inválida. Verifícala en platform.openai.com.");
    throw new Error(`OpenAI error ${res.status}: ${t.slice(0, 300)}`);
  }
  throw lastErr || new Error("AI call failed");
}

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdminCaller(req: Request, supabase: any, companyId: string): Promise<string> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sesión requerida");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const caller = userData?.user;
  if (userError || !caller) throw new Error("Sesión inválida");
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", caller.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", caller.id),
  ]);
  const isAdmin = (roles || []).some((r: any) => r.role === "admin");
  if (!isAdmin || profile?.company_id !== companyId) throw new Error("No autorizado");
  return caller.id;
}

function buildSyntheticFallback(lessonType: string, lessonTitle: string, moduleTitle: string, context: string): any[] {
  const snippet = context.replace(/\n/g, " ").slice(0, 300) || `Contenido sobre ${moduleTitle}`;
  const s = (v: any) => ({ ...v, _synthetic: true });

  if (lessonType === "concept") {
    return [
      s({ type: "term", term: lessonTitle, definition: `${snippet.slice(0, 200)}` }),
      s({ type: "term", term: `Contexto: ${moduleTitle}`, definition: "Este término forma parte del módulo indicado. Regenera con IA para obtener contenido enriquecido." }),
    ];
  }
  if (lessonType === "flashcards") {
    return [
      s({ type: "flashcard", front: `¿Qué es ${lessonTitle}?`, back: snippet.slice(0, 200) }),
      s({ type: "flashcard", front: `¿Cuál es la importancia de ${lessonTitle}?`, back: "Es un elemento clave dentro de este módulo." }),
      s({ type: "flashcard", front: `¿Cómo aplica ${lessonTitle} en la práctica?`, back: "Requiere regeneración con IA para contenido específico." }),
    ];
  }
  if (lessonType === "steps") {
    return [
      s({ type: "step", n: 1, title: `Entender ${lessonTitle}`, description: snippet.slice(0, 200) }),
      s({ type: "step", n: 2, title: "Aplicar el concepto", description: "Identifica cómo aplica en tu contexto específico." }),
      s({ type: "step", n: 3, title: "Verificar resultados", description: "Confirma que los resultados sean coherentes con los objetivos del módulo." }),
    ];
  }
  if (lessonType === "case_study") {
    return [
      s({ type: "scenario", title: lessonTitle, text: snippet.slice(0, 300) }),
      s({ type: "question", text: `¿Cómo aplicarías ${lessonTitle} en tu entorno de trabajo?` }),
      s({ type: "reflection", text: "Reflexiona sobre las implicaciones prácticas y compártelas con tu equipo." }),
    ];
  }
  if (lessonType === "interactive_quiz") {
    return [
      s({ type: "mc", question: `¿Cuál es el enfoque principal de "${lessonTitle}"?`, options: ["Eficiencia operativa", "Reducción de costos", "Mejora continua", "Control de calidad"], correct: "Mejora continua", explanation: "La mejora continua es el objetivo central de este tipo de lección." }),
      s({ type: "true_false", question: `"${lessonTitle}" es relevante para el módulo "${moduleTitle}".`, correct: true, explanation: "Correcto, forma parte del contenido estructurado del módulo." }),
      s({ type: "mc", question: "¿Qué caracteriza a un proceso bien documentado?", options: ["Pasos claros y medibles", "Solo objetivos generales", "Ausencia de métricas", "Dependencia de una persona"], correct: "Pasos claros y medibles", explanation: "La documentación efectiva incluye pasos precisos y verificables." }),
      s({ type: "true_false", question: "La retroalimentación constante mejora los procesos organizacionales.", correct: true, explanation: "Es un principio fundamental de la gestión por procesos." }),
    ];
  }
  if (lessonType === "sop_walkthrough") {
    return [
      s({ type: "sop_step", n: 1, title: `Preparación para ${lessonTitle}`, description: "Revisa los materiales y herramientas necesarios antes de comenzar." }),
      s({ type: "sop_step", n: 2, title: "Ejecución del proceso", description: snippet.slice(0, 200) }),
      s({ type: "sop_step", n: 3, title: "Verificación y cierre", description: "Confirma que todos los pasos fueron completados correctamente." }),
    ];
  }
  if (lessonType === "comparison") {
    return [
      s({ type: "comparison_table", headers: ["Aspecto", "Sin proceso", "Con proceso"], rows: [
        { label: "Eficiencia", cells: ["Baja", "Alta"] },
        { label: "Errores", cells: ["Frecuentes", "Reducidos"] },
        { label: "Tiempo", cells: ["Variable", "Predecible"] },
      ]}),
    ];
  }
  if (lessonType === "video_embed") {
    return [
      s({ type: "video", provider: "url", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: `Video: ${lessonTitle}` }),
    ];
  }
  // default: reading
  return [
    s({ type: "heading", text: lessonTitle, level: 2 }),
    s({ type: "paragraph", text: snippet.slice(0, 400) || `Esta lección aborda "${lessonTitle}" dentro del módulo "${moduleTitle}".` }),
    s({ type: "callout", variant: "info", text: "Este contenido fue generado automáticamente. Usa el botón de regenerar para obtener contenido personalizado con IA." }),
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonId, companyId, mode, newType, extraInstructions } = await req.json();
    if (!lessonId || !companyId || !mode) throw new Error("lessonId, companyId, mode son requeridos");
    if (mode !== "regenerate" && mode !== "convert") throw new Error("mode debe ser 'regenerate' o 'convert'");
    if (mode === "convert" && !LESSON_TYPES.includes(newType)) throw new Error("newType inválido");

    const supabase = getServiceClient();
    const callerId = await requireAdminCaller(req, supabase, companyId);

    const { data: lesson, error: le } = await supabase
      .from("lessons")
      .select("id, title, content, lesson_type, module_id, sort_order")
      .eq("id", lessonId).single();
    if (le || !lesson) throw new Error("Lección no encontrada");

    const { data: mod } = await supabase
      .from("modules")
      .select("id, title, description, course_id")
      .eq("id", lesson.module_id).single();
    if (!mod) throw new Error("Módulo no encontrado");

    const { data: course } = await supabase
      .from("courses")
      .select("id, title, description, level, company_id, source_brief")
      .eq("id", mod.course_id).single();
    if (!course || course.company_id !== companyId) throw new Error("No autorizado");

    const targetType = mode === "convert" ? newType : (lesson.lesson_type || "reading");
    const minBlocks = MIN_BLOCKS_BY_TYPE[targetType] ?? 1;
    const hint = HINTS[targetType] || HINTS.reading;

    const currentBlocks = Array.isArray((lesson.content as any)?.blocks) ? (lesson.content as any).blocks : [];
    const currentText = (lesson.content as any)?.text || "";
    const lessonIsEmpty = currentBlocks.length === 0 && currentText.trim().length === 0;

    // Build rich course context — use facts array from source_brief if available
    const brief = course.source_brief;
    let briefSummary = "";
    if (brief && typeof brief === "object") {
      const facts = Array.isArray((brief as any).facts) ? (brief as any).facts : [];
      const rawText = typeof (brief as any).raw_text === "string" ? (brief as any).raw_text : "";
      if (facts.length > 0) {
        briefSummary = `Hechos clave del curso:\n${facts.slice(0, 20).map((f: string) => `• ${f}`).join("\n")}`;
      }
      if (rawText && briefSummary.length < 1000) {
        briefSummary += `\n\nContexto adicional: ${rawText.slice(0, 2000)}`;
      }
      if (!briefSummary) {
        briefSummary = JSON.stringify(brief).slice(0, 3000);
      }
    }

    // When the lesson has no content, synthesize a topic description from available metadata
    const topicHint = lessonIsEmpty
      ? `⚠ Esta lección no tiene contenido previo. Genera contenido original sobre "${lesson.title}" basándote en el contexto del módulo y el curso.`
      : "";

    const sys = `Eres un diseñador instruccional experto en e-learning corporativo. Generas lecciones tipadas en español para un LMS gamificado.
REGLAS CRÍTICAS:
1. Usa ÚNICAMENTE los tipos de bloque permitidos para el lesson_type indicado.
2. Todos los campos de texto deben ser no-vacíos (sin strings "").
3. PROHIBIDO devolver {} vacíos, arrays vacíos como valor, o tipos de bloque no listados.
4. El campo "type" de cada bloque debe ser exactamente uno de los permitidos.`;

    const baseInstr = mode === "convert"
      ? `Convierte la lección al tipo "${targetType}". Adapta el contenido a la mecánica del nuevo tipo conservando lo esencial.`
      : lessonIsEmpty
        ? `Genera una lección completa de tipo "${targetType}" sobre el tema "${lesson.title}". Inventa contenido didáctico real basado en el contexto del curso.`
        : `Mejora y regenera esta lección de tipo "${targetType}". Hazla más clara, atractiva y didáctica.`;

    // Concrete format examples to reduce AI confusion
    const FORMAT_EXAMPLES: Record<string, string> = {
      reading: `Ejemplo válido: {"type":"heading","text":"Introducción","level":2}, {"type":"paragraph","text":"Texto descriptivo no vacío."}, {"type":"callout","variant":"info","text":"Nota importante."}`,
      concept: `Ejemplo válido: {"type":"term","term":"Nombre del concepto","definition":"Explicación clara y completa del concepto."}, {"type":"term","term":"Otro término","definition":"Su definición detallada."}`,
      flashcards: `Ejemplo válido: {"type":"flashcard","front":"¿Pregunta?","back":"Respuesta completa."}, {"type":"flashcard","front":"¿Otra pregunta?","back":"Otra respuesta."}`,
      steps: `Ejemplo válido: {"type":"step","n":1,"title":"Primer paso","description":"Descripción detallada de lo que se hace."}, {"type":"step","n":2,"title":"Segundo paso","description":"Descripción del segundo paso."}`,
      comparison: `Ejemplo válido: {"type":"comparison_table","headers":["Aspecto","Opción A","Opción B"],"rows":[{"label":"Costo","cells":["$100","$200"]},{"label":"Velocidad","cells":["Rápido","Lento"]}]}`,
      case_study: `Ejemplo válido: {"type":"scenario","title":"Caso","text":"Descripción del escenario."}, {"type":"question","text":"¿Qué harías?"}, {"type":"reflection","text":"Reflexión sobre la decisión."}`,
      interactive_quiz: `Ejemplo válido: {"type":"mc","question":"¿Pregunta?","options":["Opción A","Opción B","Opción C"],"correct":"Opción A","explanation":"Porque..."}, {"type":"true_false","question":"¿Afirmación?","correct":true}`,
      sop_walkthrough: `Ejemplo válido: {"type":"sop_step","n":1,"title":"Paso inicial","description":"Qué hacer primero."}, {"type":"sop_step","n":2,"title":"Verificación","description":"Cómo verificar."}`,
      video_embed: `Ejemplo válido: {"type":"video","provider":"youtube","url":"https://youtube.com/watch?v=XXXX","title":"Título del video"}`,
    };

    const baseCtx = `Curso: "${course.title}" (nivel ${course.level || "beginner"}).
Módulo: "${mod.title}". Descripción: ${mod.description || "(sin descripción)"}.
Lección: "${lesson.title}". Tipo objetivo: ${targetType}.
${briefSummary ? `\n${briefSummary}\n` : ""}
${!lessonIsEmpty ? `Bloques actuales: ${JSON.stringify(currentBlocks).slice(0, 3000)}` : ""}
${currentText ? `Texto legacy: ${currentText.slice(0, 2000)}` : ""}
${extraInstructions ? `\nInstrucciones adicionales: ${extraInstructions}` : ""}
${topicHint}

FORMATO OBLIGATORIO para tipo "${targetType}":
Tipos de bloque permitidos: ${hint}
${FORMAT_EXAMPLES[targetType] || ""}

Devuelve MÍNIMO ${minBlocks} bloques. ${baseInstr}`;

    let lastReason = "";
    let valid: any[] = [];
    let title = lesson.title;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctx = attempt === 0
        ? baseCtx
        : baseCtx + `\n\n⚠ INTENTO ${attempt} INVÁLIDO: ${lastReason}. Revisa que cada bloque tenga "type" correcto y todos los campos requeridos no vacíos.`;
      const result = await callAi(
        [{ role: "system", content: sys }, { role: "user", content: ctx }],
        { temperature: attempt === 0 ? 0.5 : attempt === 1 ? 0.3 : 0.15 },
      );
      const raw = Array.isArray(result?.blocks) ? result.blocks : [];
      const sanitized = sanitizeBlocksForLessonType(targetType, raw);
      title = (result.title || lesson.title).toString().slice(0, 200);
      if (blocksMeetMinimum(targetType, sanitized)) { valid = sanitized; break; }
      lastReason = `solo ${sanitized.length} bloques válidos de ${raw.length} recibidos (mínimo ${minBlocks} para tipo "${targetType}")`;
      console.warn(`[regenerate-lesson] attempt ${attempt + 1} failed: ${lastReason}`, JSON.stringify(raw).slice(0, 500));
    }

    // Fallback sintético: construir bloques mínimos válidos en código para nunca retornar 400
    if (valid.length === 0) {
      console.warn(`[regenerate-lesson] All AI attempts failed for type ${targetType}. Using synthetic fallback.`);
      valid = buildSyntheticFallback(targetType, lesson.title, mod.title, briefSummary);
    }

    const usedFallback = valid.some((b: any) => b._synthetic);
    const cleanBlocks = valid.map(({ _synthetic, ...b }: any) => b);

    const newContent = {
      blocks: cleanBlocks,
      validation: {
        status: "valid",
        fallback: usedFallback,
        repaired: usedFallback,
        block_count: cleanBlocks.length,
        validated_at: new Date().toISOString(),
        source: "regenerate-lesson",
      },
    };

    try {
      await supabase.from("lesson_content_history").insert({
        lesson_id: lessonId,
        content: lesson.content,
        replaced_by: callerId,
      });
    } catch (histErr) {
      console.warn("[regenerate-lesson] Failed to save content history:", histErr);
    }

    const { error: ue } = await supabase
      .from("lessons")
      .update({ title, lesson_type: targetType, content: newContent } as any)
      .eq("id", lessonId);
    if (ue) throw new Error(`No se pudo guardar: ${ue.message}`);

    return new Response(
      JSON.stringify({ ok: true, fallback: usedFallback, lesson: { id: lessonId, title, lesson_type: targetType, content: newContent } }),
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
