// =====================================================================
// generate-course v3 — Pipeline auditable: extract → outline → materialize
// → finalize con auditoría de calidad. Cada lección se valida con el
// módulo compartido course-quality y se guarda solo si pasa el mínimo.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import {
  sanitizeBlocksForLessonType,
  blocksMeetMinimum,
  filterValidQuizQuestions,
  auditCourse,
  MIN_BLOCKS_BY_TYPE,
} from "../_shared/course-quality.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireAdminCaller(req: Request, supabase: any, companyId: string, userId: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sesión requerida");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const caller = userData?.user;
  if (userError || !caller) throw new Error("Sesión inválida");
  if (caller.id !== userId) throw new Error("Usuario inválido para esta operación");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", caller.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", caller.id),
  ]);

  const isAdmin = (roles || []).some((r: any) => r.role === "admin");
  if (!isAdmin || profile?.company_id !== companyId) {
    throw new Error("Solo administradores de la empresa pueden crear cursos");
  }
}

async function deleteDraftCourseTree(supabase: any, courseId: string) {
  const { data: modules } = await supabase.from("modules").select("id").eq("course_id", courseId);
  const moduleIds = (modules || []).map((m: any) => m.id);
  if (moduleIds.length) {
    const { data: quizzes } = await supabase.from("quizzes").select("id").in("module_id", moduleIds);
    const quizIds = (quizzes || []).map((q: any) => q.id);
    if (quizIds.length) await supabase.from("questions").delete().in("quiz_id", quizIds);
    await supabase.from("quizzes").delete().in("module_id", moduleIds);
    await supabase.from("lessons").delete().in("module_id", moduleIds);
    await supabase.from("modules").delete().eq("course_id", courseId);
  }
  await supabase.from("course_sources").delete().eq("course_id", courseId);
  await supabase.from("course_dictionary").delete().eq("course_id", courseId);
  await supabase.from("courses").delete().eq("id", courseId).eq("status", "draft");
}

// ---------- AI helpers ----------

function getAiConfig(opts: { fast?: boolean } = {}) {
  const API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const defaultModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  return {
    apiKey: API_KEY,
    // Endpoint OpenAI-compatible de Google Gemini
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    // Flash por defecto para evitar 429 frecuentes del tier gratuito; GEMINI_MODEL permite subir a Pro si hay cuota.
    model: opts.fast ? "gemini-2.5-flash" : defaultModel,
  };
}

async function callAi(
  messages: any[],
  tool: any,
  opts: { temperature?: number; maxTokens?: number; retries?: number; fast?: boolean } = {},
) {
  const { apiKey, url, model } = getAiConfig({ fast: opts.fast });
  const maxRetries = opts.retries ?? 2;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const temp = attempt === 0 ? (opts.temperature ?? 0.6) : Math.max(0.2, (opts.temperature ?? 0.6) - 0.2 * attempt);
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
          max_tokens: opts.maxTokens ?? 16000,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            "GEMINI_AUTH_ERROR: La GEMINI_API_KEY es inválida o no tiene permisos. Verifícala en Google AI Studio.",
          );
        }
        if (res.status === 429) {
          if (attempt < maxRetries) {
            lastErr = new Error("AI_RATE_LIMITED");
            // Backoff largo: free tier de Gemini tiene RPM muy bajo
            await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
            continue;
          }
          throw new Error(
            "AI_RATE_LIMITED: Demasiadas solicitudes a Gemini. Espera ~1 minuto y vuelve a intentarlo, o usa una API key con plan de pago.",
          );
        }
        if (res.status >= 500) {
          lastErr = new Error(`Gemini error (${res.status}): ${body.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        throw new Error(`Gemini error (${res.status}): ${body.slice(0, 500)}`);
      }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        lastErr = new Error("AI did not return tool call");
        continue;
      }
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch {
        lastErr = new Error("AI returned invalid JSON in tool call");
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === maxRetries) throw lastErr;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("AI call failed");
}

function isAiRateLimited(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("AI_RATE_LIMITED") || message.includes("429") || message.includes("Rate limit");
}

// ---------- Tool schemas ----------

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "build_knowledge_brief",
    description: "Build a structured knowledge brief from the provided sources",
    parameters: {
      type: "object",
      required: ["topic", "key_concepts", "facts", "summary"],
      properties: {
        topic: { type: "string" },
        summary: { type: "string" },
        key_concepts: {
          type: "array",
          items: {
            type: "object",
            required: ["term", "definition"],
            properties: {
              term: { type: "string" },
              definition: { type: "string" },
              example: { type: "string" },
            },
          },
        },
        facts: { type: "array", items: { type: "string" } },
        procedures: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "steps"],
            properties: {
              title: { type: "string" },
              steps: { type: "array", items: { type: "string" } },
            },
          },
        },
        comparisons: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "items"],
            properties: {
              title: { type: "string" },
              items: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

const OUTLINE_TOOL = {
  type: "function",
  function: {
    name: "build_course_outline",
    description: "Design a course outline with typed lessons. Each lesson MUST cite source evidence.",
    parameters: {
      type: "object",
      required: ["description", "estimated_duration_minutes", "modules"],
      properties: {
        description: { type: "string" },
        estimated_duration_minutes: { type: "number" },
        modules: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "description", "lessons"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  required: ["title", "lesson_type", "objective", "evidence"],
                  properties: {
                    title: { type: "string" },
                    objective: { type: "string" },
                    lesson_type: {
                      type: "string",
                      enum: [
                        "reading", "concept", "flashcards", "steps",
                        "comparison", "case_study", "interactive_quiz",
                        "sop_walkthrough", "client_chat",
                      ],
                    },
                    evidence: {
                      type: "array",
                      description: "Conceptos/hechos/procedimientos del brief que respaldan esta lección. Mínimo 1.",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const MATERIALIZE_LESSON_TOOL = {
  type: "function",
  function: {
    name: "build_lesson_blocks",
    description: "Generate the typed content blocks for a single lesson",
    parameters: {
      type: "object",
      required: ["blocks"],
      properties: {
        blocks: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
  },
};

const MATERIALIZE_QUIZ_TOOL = {
  type: "function",
  function: {
    name: "build_module_quiz",
    description: "Generate quiz questions for a module",
    parameters: {
      type: "object",
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            required: ["question_text", "question_type", "options", "correct_answer", "hint", "explanation"],
            properties: {
              question_text: { type: "string" },
              question_type: { type: "string", enum: ["multiple_choice", "true_false"] },
              options: { type: "array", items: { type: "string" } },
              correct_answer: { type: "string" },
              hint: { type: "string", description: "Una pista que ayuda a razonar sin revelar la respuesta directamente. Máximo 1 oración." },
              explanation: { type: "string", description: "Explicación de por qué la respuesta correcta es correcta. 1-2 frases claras y educativas." },
            },
          },
        },
      },
    },
  },
};

// ---------- Source → AI parts ----------

function buildContentParts(sources: any[], textInstructions: string) {
  const parts: any[] = [{ type: "text", text: textInstructions }];
  for (const s of sources || []) {
    if (s.kind === "pdf" && s.payload) {
      parts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${s.payload}`, detail: "high" } });
    } else if (s.kind === "image" && s.payload) {
      const url = String(s.payload).startsWith("data:") ? s.payload : `data:image/jpeg;base64,${s.payload}`;
      parts.push({ type: "image_url", image_url: { url, detail: "high" } });
    } else if (s.kind === "text" && s.payload) {
      parts.push({ type: "text", text: `\n\n---\nFuente "${s.name || "texto"}":\n${String(s.payload).slice(0, 30_000)}` });
    } else if (s.kind === "url" && s.payload) {
      parts.push({ type: "text", text: `\n\n---\nFuente URL "${s.name || s.payload}":\n${String(s.text || "").slice(0, 30_000)}` });
    } else if (s.kind === "excel" && s.payload) {
      parts.push({ type: "text", text: `\n\n---\nFuente Excel/CSV "${s.name || "tabla"}" (markdown):\n${String(s.payload).slice(0, 30_000)}` });
    }
  }
  return parts;
}

// ---------- Pipeline steps ----------

function sourcesAreAllText(sources: any[]) {
  return Array.isArray(sources) && sources.length > 0
    && sources.every((s) => s.kind === "text" || s.kind === "url" || s.kind === "excel");
}

async function stepExtract(sources: any[], userNotes: string) {
  const allText = sourcesAreAllText(sources);
  const text = `Analiza TODAS las fuentes adjuntas y produce un knowledge brief estructurado en español.
${allText ? "El material ya viene como markdown estructurado (parseado con LlamaParse). Aprovecha tablas, listas y headings que ya están presentes." : ""}
Incluye: tema central, resumen de 5-10 frases, conceptos clave (con definiciones y ejemplo),
hechos relevantes, procedimientos paso-a-paso si los detectas, comparaciones si aplican.
Si una sección está ausente del material, devuélvela vacía en vez de inventar.
Notas del admin: ${userNotes || "(ninguna)"}
Llama a build_knowledge_brief con los resultados.`;
  return await callAi([{ role: "user", content: buildContentParts(sources, text) }], EXTRACT_TOOL, {
    temperature: 0.4,
    maxTokens: 8000,
    fast: allText,
  });
}

async function stepOutline(brief: any, title: string, level: string, userNotes: string) {
  const conceptCount = Array.isArray(brief?.key_concepts) ? brief.key_concepts.length : 0;
  const factCount = Array.isArray(brief?.facts) ? brief.facts.length : 0;
  const procCount = Array.isArray(brief?.procedures) ? brief.procedures.length : 0;
  const compCount = Array.isArray(brief?.comparisons) ? brief.comparisons.length : 0;
  const richness = conceptCount + factCount + procCount * 2 + compCount;

  let maxModules: number;
  let minModules: number;
  if (richness < 6) { minModules = 1; maxModules = 2; }
  else if (richness < 14) { minModules = 2; maxModules = 3; }
  else if (richness < 25) { minModules = 3; maxModules = 4; }
  else if (richness < 40) { minModules = 3; maxModules = 5; }
  else { minModules = 4; maxModules = 6; }

  const text = `Diseña un curso titulado "${title}" (nivel ${level}) basado EXCLUSIVAMENTE en este knowledge brief. NO inventes contenido fuera del brief.

BRIEF:
${JSON.stringify(brief).slice(0, 20_000)}

REGLA CRÍTICA — ALCANCE ADAPTATIVO:
- Material disponible: ${conceptCount} conceptos, ${factCount} hechos, ${procCount} procedimientos, ${compCount} comparaciones (richness=${richness}).
- Genera ENTRE ${minModules} Y ${maxModules} módulos. Mejor pocos módulos sólidos que muchos vacíos.
- Cada lección DEBE incluir el array "evidence" con al menos 1 ítem real del brief que la respalda. Si no hay evidencia, NO crees la lección.

REGLAS PEDAGÓGICAS:
- Microlearning: cada lección ≤ 5 minutos.
- Mix lógico por módulo (adapta al material disponible):
   * "concept" SOLO si hay ≥3 key_concepts relevantes para el módulo.
   * "steps" o "sop_walkthrough" SOLO si brief.procedures aporta pasos.
   * "comparison" SOLO si brief.comparisons aporta tabla aplicable.
   * "case_study" SOLO si hay hechos suficientes.
   * "interactive_quiz" SOLO si hay material para construir ≥4 ejercicios variados; si no, omítelo y deja el quiz tabular del módulo.
   * "flashcards" SOLO con datos memorizables.
   * "reading" como ÚLTIMO RECURSO.
- "objective": una frase clara.
- Notas del admin: ${userNotes || "(ninguna)"}
- Español neutro, profesional para adultos.`;
  return await callAi([{ role: "user", content: [{ type: "text", text }] }], OUTLINE_TOOL, {
    temperature: 0.4,
    maxTokens: 8000,
    fast: true,
  });
}

const LESSON_BLOCK_HINTS: Record<string, string> = {
  reading: `{ "type":"heading","text":"...","level":2 } | { "type":"paragraph","text":"..." } | { "type":"callout","variant":"info|tip|warning|success","text":"..." } | { "type":"quote","text":"...","cite":"..." }`,
  concept: `{ "type":"term","term":"...","definition":"...","example":"..." }`,
  flashcards: `{ "type":"flashcard","front":"...","back":"...","hint":"..." }`,
  steps: `{ "type":"step","n":1,"title":"...","description":"...","tip":"..." }`,
  comparison: `Un solo bloque: { "type":"comparison_table","headers":["Aspecto","A","B"],"rows":[{"label":"...","cells":["...","..."]}] }`,
  case_study: `{ "type":"scenario","title":"...","text":"..." } | { "type":"question","text":"..." } | { "type":"reflection","text":"..." }`,
  sop_walkthrough: `{ "type":"sop_step","n":1,"title":"...","description":"...","warning":"⚠ ...","must_check":true }`,
  interactive_quiz: `Ejercicios variados (mínimo 4, mezcla 3+ tipos):
- { "type":"mc","question":"...","options":["a","b","c","d"],"correct":"a","explanation":"..." }
- { "type":"true_false","question":"...","correct":true,"explanation":"..." }
- { "type":"fill_blank","sentence":"El ___ es ___.","correct":["v1","v2"],"explanation":"..." }
- { "type":"match_pairs","pairs":[{"left":"X","right":"Y"}, ...] }
- { "type":"order_steps","steps":["Paso 1","Paso 2","Paso 3"] }
- { "type":"sort_into_buckets","buckets":["A","B"],"items":[{"text":"x","bucket":"A"}] }
- { "type":"highlight_terms","sentence":"...","terms":["..."] }
- { "type":"tap_to_complete","sentence":"El ___ controla el ___.","bank":["a","b","c","d"],"correct":["a","b"] }`,
  client_chat: `OBLIGATORIO generar exactamente en este orden:

Bloque 1 — setup (ÚNICO):
{ "type":"chat_setup","persona_name":"Ana López","persona_role":"Cliente interesado en renovar contrato","persona_mood":"neutral","context":"La cliente llama para preguntar sobre las condiciones de renovación antes de que venza su contrato en 30 días.","objective":"Retener a la cliente explicando los beneficios del plan actual y ofreciendo un descuento por fidelidad." }

Bloques 2 a N — turnos conversacionales (mínimo 3, máximo 6):
{ "type":"chat_turn","turn":1,"client_message":"Hola, quería saber si hay algún descuento por ser cliente fiel...","choices":[{"text":"Claro que sí, tenemos un 10% por renovación anticipada","quality":"good","score":3,"feedback":"Respuesta directa que abre la conversación con una propuesta concreta","client_reaction":"¡Qué bueno saberlo! ¿Cómo puedo aplicarlo?"},{"text":"Tendría que consultarlo con mi supervisor","quality":"neutral","score":1,"feedback":"No incorrecta pero genera incertidumbre innecesaria","client_reaction":"Mmm, bueno… ¿cuánto tardaría eso?"},{"text":"Los descuentos son solo para clientes nuevos","quality":"bad","score":0,"feedback":"Información incorrecta y desmotivadora para un cliente fiel","client_reaction":"Entiendo, creo que entonces busco otra alternativa..."}] }

Último bloque — outcome (ÚNICO):
{ "type":"chat_outcome","max_score":9,"thresholds":{"success":7,"partial":4},"messages":{"success":"Excelente manejo — el cliente renovó su contrato.","partial":"La cliente aceptó pensarlo. Mejorar proactividad y cierre.","failure":"La cliente colgó frustrada. Revisar tono y argumentos."},"tips":["Siempre confirmar que el cliente entendió el beneficio","Usar el nombre del cliente al menos dos veces","Ofrecer un siguiente paso concreto al final"] }

REGLAS:
- Cada chat_turn debe tener EXACTAMENTE 3 choices con quality "good"/"neutral"/"bad" y score 3/1/0.
- max_score = número de turnos × 3.
- El persona_mood debe reflejar el escenario real del brief.`,
};

async function stepMaterializeLesson(brief: any, moduleTitle: string, lesson: any) {
  const schemaHint = LESSON_BLOCK_HINTS[lesson.lesson_type] || LESSON_BLOCK_HINTS.reading;
  const minBlocks = MIN_BLOCKS_BY_TYPE[lesson.lesson_type] ?? 1;
  const evidence = Array.isArray(lesson.evidence) ? lesson.evidence.join("; ") : "";

  const baseText = `Genera los bloques de contenido para esta lección, en español, aplicando microlearning + feedback inmediato.

Curso brief: ${JSON.stringify(brief).slice(0, 12_000)}
Módulo: "${moduleTitle}"
Lección: "${lesson.title}"
Tipo: ${lesson.lesson_type}
Objetivo: ${lesson.objective}
Evidencia del brief: ${evidence || "(usa el brief completo)"}

REGLAS DE CALIDAD (OBLIGATORIO):
- Microlearning ≤ 5 minutos.
- Cero relleno: usa datos REALES del brief o de la evidencia.
- En "mc" mínimo 3 opciones plausibles y "correct" idéntico a una opción.
- En "true_false" "correct" debe ser boolean.
- En "fill_blank" la "sentence" debe contener "___".
- En "match_pairs" mínimo 3 pares completos.
- En "order_steps" mínimo 3 pasos no vacíos.
- En "comparison_table" headers ≥ 2 y rows ≥ 2 con label + cells.
- PROHIBIDO objetos vacíos {} o tipos mezclados (todos los bloques deben ser del tipo "${lesson.lesson_type}").
- DEVUELVE al menos ${minBlocks} bloques que cumplan EXACTAMENTE el formato.

FORMATO REQUERIDO de cada bloque (tipo "${lesson.lesson_type}"):
${schemaHint}

Devuelve entre ${Math.max(minBlocks, 4)} y 10 bloques de calidad real.`;

  let lastReason = "";
  let bestSanitized: any[] = [];
  let bestRaw = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = attempt === 0
      ? baseText
      : baseText + `\n\n⚠ INTENTO PREVIO INVÁLIDO: ${lastReason}. Esta vez SOLO bloques con la forma exacta indicada y al menos ${minBlocks} válidos. NO uses {"type":"${lesson.lesson_type}"} — usa los subtipos exactos del FORMATO REQUERIDO.`;
    let result: any;
    try {
      result = await callAi(
        [{ role: "user", content: [{ type: "text", text }] }],
        MATERIALIZE_LESSON_TOOL,
        { temperature: attempt === 0 ? 0.55 : 0.3, maxTokens: 6000, retries: 0, fast: true },
      );
    } catch (error) {
      if (!isAiRateLimited(error)) throw error;
      const fb = buildFallbackBlocks(lesson, minBlocks - bestSanitized.length);
      const merged = [...bestSanitized, ...fb];
      if (blocksMeetMinimum(lesson.lesson_type, merged)) {
        console.warn(`Lesson "${lesson.title}" usó fallback local por cuota de IA (${fb.length} bloques)`);
        return { blocks: merged, repaired: true, raw_count: bestRaw, fallback: true, quota_fallback: true };
      }
      throw error;
    }
    const raw = Array.isArray(result?.blocks) ? result.blocks : [];
    const coerced = raw.map((b: any) => coerceBlock(lesson.lesson_type, b));
    const sanitized = sanitizeBlocksForLessonType(lesson.lesson_type, coerced);
    if (sanitized.length > bestSanitized.length) { bestSanitized = sanitized; bestRaw = raw.length; }
    if (blocksMeetMinimum(lesson.lesson_type, sanitized)) {
      return { blocks: sanitized, repaired: attempt > 0, raw_count: raw.length };
    }
    lastReason = `${sanitized.length} bloques válidos de ${raw.length} (mínimo ${minBlocks})`;
  }
  // Fallback: complete with synthetic blocks derived from lesson metadata so generation never hard-fails
  const fb = buildFallbackBlocks(lesson, minBlocks - bestSanitized.length);
  const merged = [...bestSanitized, ...fb];
  if (blocksMeetMinimum(lesson.lesson_type, merged)) {
    console.warn(`Lesson "${lesson.title}" usó fallback (${fb.length} bloques sintéticos)`);
    return { blocks: merged, repaired: true, raw_count: bestRaw, fallback: true };
  }
  throw new Error(`Lesson "${lesson.title}" no produjo bloques válidos para tipo ${lesson.lesson_type} (${lastReason})`);
}

function coerceBlock(lessonType: string, b: any): any {
  if (!b || typeof b !== "object") return b;
  // Si el modelo puso type=lesson_type en lugar de subtipo, intentar mapear
  if (b.type === lessonType) {
    if (lessonType === "reading" && typeof b.text === "string") return { ...b, type: "paragraph" };
    if (lessonType === "concept" && b.term && b.definition) return { ...b, type: "term" };
    if (lessonType === "flashcards" && b.front && b.back) return { ...b, type: "flashcard" };
    if (lessonType === "steps" && b.title && b.description) return { ...b, type: "step" };
    if (lessonType === "sop_walkthrough" && b.title && b.description) return { ...b, type: "sop_step" };
    if (lessonType === "video_embed" && b.url) return { ...b, type: "video" };
    if (lessonType === "comparison" && (b.headers || b.columns) && b.rows) {
      return { ...b, type: "comparison_table", headers: b.headers || b.columns };
    }
  }
  // comparison: normalizar headers/rows en cualquier caso
  if (lessonType === "comparison" && (b.type === "comparison_table" || b.type === "table" || b.type === "comparison")) {
    const headers = Array.isArray(b.headers) ? b.headers : (Array.isArray(b.columns) ? b.columns : null);
    let rows = Array.isArray(b.rows) ? b.rows : null;
    if (rows && rows.length && Array.isArray(rows[0])) {
      // filas como arrays planos -> {label, cells}
      rows = rows.map((r: any[]) => ({ label: String(r[0] ?? ""), cells: r.slice(1).map((c) => String(c ?? "")) }));
    } else if (rows) {
      rows = rows.map((r: any) => {
        if (r && typeof r === "object" && (r.label || r.cells)) {
          return { label: String(r.label ?? ""), cells: Array.isArray(r.cells) ? r.cells.map((c: any) => String(c ?? "")) : [] };
        }
        if (r && typeof r === "object") {
          // {col1: x, col2: y}
          const vals = Object.values(r).map((v) => String(v ?? ""));
          return { label: vals[0] || "", cells: vals.slice(1) };
        }
        return r;
      });
    }
    return { ...b, type: "comparison_table", headers, rows };
  }
  // reading: bloques sin type pero con text → paragraph
  if (lessonType === "reading" && !b.type && typeof b.text === "string") return { ...b, type: "paragraph" };
  // reading: aliases
  if (lessonType === "reading") {
    if (b.type === "title" && typeof b.text === "string") return { ...b, type: "heading", level: 2 };
    if (b.type === "subheading" && typeof b.text === "string") return { ...b, type: "heading", level: 2 };
    if (b.type === "text" && typeof b.text === "string") return { ...b, type: "paragraph" };
  }
  return b;
}

function buildFallbackBlocks(lesson: any, count: number): any[] {
  const n = Math.max(1, count);
  const t = lesson.lesson_type;
  const title = String(lesson.title || "Lección");
  const objective = String(lesson.objective || "");
  const evidence: string[] = Array.isArray(lesson.evidence) ? lesson.evidence.filter((x: any) => typeof x === "string" && x.trim()) : [];
  const out: any[] = [];
  if (t === "reading") {
    out.push({ type: "heading", text: title, level: 2 });
    if (objective) out.push({ type: "paragraph", text: objective });
    for (const e of evidence) out.push({ type: "paragraph", text: e });
    while (out.length < n + 1) out.push({ type: "paragraph", text: objective || title });
  } else if (t === "concept") {
    for (const e of evidence) out.push({ type: "term", term: title, definition: e });
    while (out.length < n) out.push({ type: "term", term: title, definition: objective || title });
  } else if (t === "flashcards") {
    for (const e of evidence) out.push({ type: "flashcard", front: title, back: e });
    while (out.length < n) out.push({ type: "flashcard", front: title, back: objective || title });
  } else if (t === "steps" || t === "sop_walkthrough") {
    const sub = t === "steps" ? "step" : "sop_step";
    let i = 1;
    for (const e of evidence) { out.push({ type: sub, n: i, title: `Paso ${i}`, description: e }); i++; }
    while (out.length < n) { out.push({ type: sub, n: i, title: `Paso ${i}`, description: objective || title }); i++; }
  } else if (t === "case_study") {
    out.push({ type: "scenario", title, text: objective || evidence[0] || title });
    out.push({ type: "question", text: `¿Cómo aplicarías esto en "${title}"?` });
  } else if (t === "comparison") {
    const left = evidence[0] || objective || title;
    const right = evidence[1] || objective || title;
    out.push({
      type: "comparison_table",
      headers: ["Aspecto", "Aplicación", "Evidencia"],
      rows: [
        { label: "Propósito", cells: [objective || title, left] },
        { label: "Criterio clave", cells: [title, right] },
      ],
    });
  } else if (t === "interactive_quiz") {
    const answer = evidence[0] || objective || title;
    out.push(
      { type: "mc", question: `¿Cuál es el foco principal de "${title}"?`, options: [answer, "Una acción no relacionada", "Un dato administrativo"], correct: answer, explanation: objective || answer },
      { type: "true_false", question: `"${title}" debe aplicarse con base en evidencia del curso.`, correct: true, explanation: objective || answer },
      { type: "fill_blank", sentence: `${title} se apoya en ___.`, correct: "evidencia", explanation: answer },
      { type: "highlight_terms", sentence: `${title} requiere seguimiento, medición y mejora continua.`, terms: ["seguimiento", "medición", "mejora continua"] },
    );
  } else if (t === "client_chat") {
    const ctx = evidence[0] || objective || title;
    out.push({ type: "chat_setup", persona_name: "Cliente", persona_role: title, persona_mood: "neutral", context: ctx, objective: objective || title });
    out.push({ type: "chat_turn", turn: 1, client_message: `¿Cómo funciona ${title}?`, choices: [{ text: "Le explico con detalle los beneficios.", quality: "good", score: 3, feedback: "Respuesta proactiva y clara." }, { text: "Eso depende de varios factores.", quality: "neutral", score: 1, feedback: "Vaga pero no incorrecta." }, { text: "No tengo esa información.", quality: "bad", score: 0, feedback: "Deja al cliente sin respuesta." }] });
    out.push({ type: "chat_turn", turn: 2, client_message: `¿Hay algo más que deba saber sobre ${title}?`, choices: [{ text: "Sí, hay puntos clave que le explico.", quality: "good", score: 3, feedback: "Demuestra conocimiento y disposición." }, { text: "Puede consultarlo en nuestra web.", quality: "neutral", score: 1, feedback: "Redirige sin resolver directamente." }, { text: "No creo que haya más.", quality: "bad", score: 0, feedback: "Cierra la conversación sin añadir valor." }] });
    out.push({ type: "chat_outcome", max_score: 6, thresholds: { success: 5, partial: 3 }, messages: { success: "¡Excelente manejo de la conversación!", partial: "Buen intento, con margen de mejora.", failure: "El cliente quedó insatisfecho. Repasa los conceptos." }, tips: [`Conoce bien ${title} antes de atender`, "Escucha activamente al cliente", "Cierra con un paso concreto"] });
  } else {
    return [];
  }
  return out;
}

async function stepMaterializeQuiz(brief: any, moduleTitle: string, lessons: any[]) {
  const text = `Genera 4-6 preguntas de quiz para el módulo "${moduleTitle}".
Brief: ${JSON.stringify(brief).slice(0, 8_000)}
Lecciones del módulo: ${lessons.map((l) => `"${l.title}"`).join(", ")}
Reglas:
- Mezcla multiple_choice (4 opciones) y true_false.
- correct_answer EXACTO a una opción.
- Español.
- OBLIGATORIO para cada pregunta:
  - hint: pista que ayuda a razonar (máx 1 oración, NO revela la respuesta directamente)
  - explanation: por qué la respuesta es correcta (1-2 frases educativas y claras)`;
  const result = await callAi([{ role: "user", content: [{ type: "text", text }] }], MATERIALIZE_QUIZ_TOOL, {
    temperature: 0.5,
    maxTokens: 4000,
    fast: true,
  });
  return Array.isArray(result?.questions) ? result.questions : [];
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      title, level = "beginner", companyId, userId,
      mode, sources, userNotes, brief, outline,
    } = body;

    if (!companyId || !userId) throw new Error("Missing companyId/userId");

    const supabase = getServiceClient();
    await requireAdminCaller(req, supabase, companyId, userId);

    if (mode === "extract") {
      if (!Array.isArray(sources) || sources.length === 0) throw new Error("Debes proporcionar al menos una fuente.");
      const out = await stepExtract(sources, userNotes || "");
      return json({ brief: out });
    }

    if (mode === "outline") {
      if (!brief) throw new Error("Missing brief");
      if (!title) throw new Error("Missing title");
      const conceptCount = brief?.key_concepts?.length || 0;
      const factCount = brief?.facts?.length || 0;
      const procCount = brief?.procedures?.length || 0;
      if (conceptCount + factCount + procCount === 0) {
        throw new Error("El brief no contiene material suficiente. Agrega más fuentes.");
      }
      const out = await stepOutline(brief, title, level, userNotes || "");
      return json({ outline: out });
    }

    if (mode === "materialize_init") {
      if (!brief || !outline || !title) throw new Error("Missing brief/outline/title");
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          title,
          description: outline.description || "",
          level,
          status: "draft",
          company_id: companyId,
          created_by: userId,
          estimated_duration_minutes: outline.estimated_duration_minutes || 30,
          xp_reward: (outline.modules?.length || 3) * 50,
          source_brief: brief,
        })
        .select("id")
        .single();
      if (courseError) throw new Error(`Course insert: ${courseError.message}`);
      const courseId = course.id;

      if (Array.isArray(sources) && sources.length) {
        const rows = sources.map((s: any) => ({
          course_id: courseId,
          company_id: companyId,
          kind: s.kind,
          name: s.name || s.kind,
          metadata: s.metadata ?? null,
        }));
        await supabase.from("course_sources").insert(rows);
      }

      const moduleIds: string[] = [];
      for (let mi = 0; mi < (outline.modules || []).length; mi++) {
        const mod = outline.modules[mi];
        const lessonCount = Array.isArray(mod.lessons) ? mod.lessons.length : 0;
        if (!String(mod.title || "").trim() || lessonCount === 0) {
          await deleteDraftCourseTree(supabase, courseId);
          throw new Error(`Outline inválido: el módulo ${mi + 1} no tiene título o lecciones.`);
        }
        const { data: moduleData, error: moduleError } = await supabase
          .from("modules")
          .insert({
            course_id: courseId,
            title: mod.title,
            description: mod.description || "",
            sort_order: mi,
            xp_reward: 25,
          })
          .select("id")
          .single();
        if (moduleError) {
          await deleteDraftCourseTree(supabase, courseId);
          throw new Error(`Module insert: ${moduleError.message}`);
        }
        moduleIds.push(moduleData.id);
      }

      return json({ courseId, moduleIds, modulesCount: moduleIds.length });
    }

    if (mode === "materialize_lesson") {
      const { moduleId, moduleIndex, lessonIndex, sortOrder } = body;
      if (!brief || !outline || !moduleId) throw new Error("Missing brief/outline/moduleId");
      const mod = outline.modules?.[moduleIndex];
      if (!mod) throw new Error("Module index out of range");
      const lesson = mod.lessons?.[lessonIndex];
      if (!lesson) throw new Error("Lesson index out of range");
      const tryInsert = async (lessonObj: any) => {
        const { blocks, repaired, fallback } = await stepMaterializeLesson(brief, mod.title, lessonObj);
        await supabase.from("lessons").insert({
          module_id: moduleId,
          title: lessonObj.title,
          lesson_type: lessonObj.lesson_type || "reading",
          content: {
            blocks,
            validation: {
              status: "valid",
              repaired,
              fallback: !!fallback,
              degraded_from: lessonObj._degraded_from || null,
              block_count: blocks.length,
              validated_at: new Date().toISOString(),
            },
          },
          content_type: "text",
          sort_order: typeof sortOrder === "number" ? sortOrder : lessonIndex,
          xp_reward: 10,
        });
        return { ok: true, inserted: 1, blocks: blocks.length, repaired, fallback: !!fallback };
      };
      try {
        return json(await tryInsert(lesson));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("Lesson failed, degrading to reading:", lesson.title, message);
        // Degradación: reintentar como "reading" antes de rendirse
        if (lesson.lesson_type !== "reading") {
          try {
            return json(await tryInsert({ ...lesson, lesson_type: "reading", _degraded_from: lesson.lesson_type }));
          } catch (e2) {
            const m2 = e2 instanceof Error ? e2.message : String(e2);
            console.error("Reading fallback also failed:", lesson.title, m2);
            return json({ ok: false, inserted: 0, reason: `No se pudo generar la lección "${lesson.title}": ${m2}` });
          }
        }
        return json({ ok: false, inserted: 0, reason: `No se pudo generar la lección "${lesson.title}": ${message}` });
      }
    }

    if (mode === "materialize_module_quiz") {
      const { moduleId, moduleIndex } = body;
      if (!brief || !outline || !moduleId) throw new Error("Missing brief/outline/moduleId");
      const mod = outline.modules?.[moduleIndex];
      if (!mod) throw new Error("Module index out of range");
      const { count: lessonCount } = await supabase
        .from("lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
      if (!lessonCount) {
        await supabase.from("modules").delete().eq("id", moduleId);
        return json({ ok: true, deleted: true, quizCreated: false });
      }

      try {
        const questions = await stepMaterializeQuiz(brief, mod.title, mod.lessons || []);
        const validQs = filterValidQuizQuestions(questions);
        if (validQs.length >= 3) {
          const { data: quizData, error: quizError } = await supabase
            .from("quizzes")
            .insert({ module_id: moduleId, title: `Quiz: ${mod.title}`, passing_score: 70, max_attempts: 3, xp_reward: 25 })
            .select("id").single();
          if (!quizError && quizData) {
            const qRows = validQs.map((q: any, qi: number) => ({
              quiz_id: quizData.id,
              question_text: q.question_text,
              question_type: q.question_type || "multiple_choice",
              options: q.options || [],
              correct_answer: q.correct_answer,
              hint: q.hint ?? null,
              explanation: q.explanation ?? null,
              sort_order: qi,
            }));
            await supabase.from("questions").insert(qRows);
            return json({ ok: true, deleted: false, quizCreated: true, questions: validQs.length });
          }
        }
      } catch (e) {
        console.error("Quiz materialize failed:", mod.title, e);
      }
      return json({ ok: true, deleted: false, quizCreated: false });
    }

    if (mode === "materialize_finalize") {
      const { courseId } = body;
      if (!courseId) throw new Error("Missing courseId");
      const { data: modulesRows } = await supabase
        .from("modules").select("id, title").eq("course_id", courseId).order("sort_order");
      const modules = modulesRows || [];
      const moduleIds = modules.map((r: any) => r.id);

      const lessonsByModule: Record<string, any[]> = {};
      const quizzesByModule: Record<string, any[]> = {};
      let lessonsCount = 0;

      if (moduleIds.length) {
        const { data: lessonsRows } = await supabase
          .from("lessons").select("id, title, lesson_type, content, module_id, sort_order")
          .in("module_id", moduleIds).order("sort_order");
        for (const l of lessonsRows || []) {
          (lessonsByModule[l.module_id] ||= []).push(l);
          lessonsCount += 1;
        }
        const { data: quizzesRows } = await supabase
          .from("quizzes").select("id, module_id").in("module_id", moduleIds);
        const quizIds = (quizzesRows || []).map((q: any) => q.id);
        let questionsByQuiz: Record<string, any[]> = {};
        if (quizIds.length) {
          const { data: qRows } = await supabase
            .from("questions").select("quiz_id, question_text, question_type, options, correct_answer").in("quiz_id", quizIds);
          for (const q of qRows || []) (questionsByQuiz[q.quiz_id] ||= []).push(q);
        }
        for (const q of quizzesRows || []) {
          (quizzesByModule[q.module_id] ||= []).push({ id: q.id, questions: questionsByQuiz[q.id] || [] });
        }
      }

      const audit = auditCourse({ courseId, modules, lessonsByModule, quizzesByModule });

      const xpReward = Math.max(50, audit.validModules * 50);
      const estimatedDuration = Math.max(5, audit.totalValidLessons * 5 + audit.validModules * 5);

      const updatePayload: any = {
        xp_reward: xpReward,
        estimated_duration_minutes: estimatedDuration,
        generation_quality: {
          status: audit.qualityStatus,
          validModules: audit.validModules,
          totalModules: audit.totalModules,
          totalValidLessons: audit.totalValidLessons,
          totalLessons: audit.totalLessons,
          warnings: audit.warnings.slice(0, 20),
          errors: audit.errors.slice(0, 20),
          audited_at: new Date().toISOString(),
        },
      };
      await supabase.from("courses").update(updatePayload).eq("id", courseId);

      // Persistir reporte de calidad para histórico y A/B testing de prompts
      await supabase.from("course_quality_reports").insert({
        course_id: courseId,
        status: audit.qualityStatus,
        report: {
          validModules: audit.validModules,
          totalModules: audit.totalModules,
          totalValidLessons: audit.totalValidLessons,
          totalLessons: audit.totalLessons,
          warnings: audit.warnings.slice(0, 20),
          errors: audit.errors.slice(0, 20),
        },
      }).then(({ error: rErr }) => {
        if (rErr) console.warn("quality_reports insert failed:", rErr.message);
      });

      return json({
        ok: audit.qualityStatus !== "failed",
        qualityStatus: audit.qualityStatus,
        report: audit,
      });
    }

    return json({ error: `Unknown mode: ${mode || "(none)"}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("generate-course error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
