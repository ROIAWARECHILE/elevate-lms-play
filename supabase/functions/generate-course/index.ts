// =====================================================================
// generate-course v2 — Pipeline multi-fuente: extract → outline → materialize
//
// Acepta:
//   sources: [{ kind: 'pdf'|'image'|'text'|'url'|'excel', name?, payload }]
//   outline?: estructura ya aprobada por admin (salta extract+outline)
//
// Retro-compat: si recibe `pdfBase64`/`imageBase64s`/`instructions` usa
// el flujo legacy en una sola llamada (igual que v1).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- AI helpers ----------

function getAiConfig() {
  const API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const useLovable = !!Deno.env.get("LOVABLE_API_KEY");
  return {
    apiKey: API_KEY,
    url: useLovable
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions",
    model: useLovable ? "google/gemini-2.5-pro" : "gpt-4o",
  };
}

async function callAi(
  messages: any[],
  tool: any,
  opts: { temperature?: number; maxTokens?: number; retries?: number } = {},
) {
  const { apiKey, url, model } = getAiConfig();
  const maxRetries = opts.retries ?? 2;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Lower temperature on retries to make tool calling more deterministic
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
        // Retry on transient errors
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`AI error (${res.status}): ${body.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        throw new Error(`AI error (${res.status}): ${body.slice(0, 500)}`);
      }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        lastErr = new Error("AI did not return tool call");
        continue; // retry
      }
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch (e) {
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

// Validate that generated blocks actually contain content for the given lesson_type.
function blocksAreValid(lessonType: string, blocks: any[]): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  const has = (t: string) => blocks.some((b) => b?.type === t);
  switch (lessonType) {
    case "concept":
      return blocks.some((b) => b?.type === "term" && b.term && b.definition);
    case "flashcards":
      return blocks.some((b) => b?.type === "flashcard" && b.front && b.back);
    case "steps":
      return blocks.some((b) => b?.type === "step" && b.title);
    case "comparison":
      return blocks.some(
        (b) => b?.type === "comparison_table" && Array.isArray(b.headers) && Array.isArray(b.rows) && b.rows.length > 0,
      );
    case "case_study":
      return has("scenario") || has("question");
    case "sop_walkthrough":
      return blocks.some((b) => b?.type === "sop_step" && b.title);
    case "interactive_quiz":
      return blocks.some((b) =>
        ["mc", "true_false", "fill_blank", "match_pairs", "order_steps", "sort_into_buckets", "highlight_terms", "tap_to_complete"].includes(b?.type),
      );
    case "reading":
    default:
      return blocks.some((b) => (b?.type === "paragraph" || b?.type === "heading") && b.text);
  }
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
        topic: { type: "string", description: "Main topic identified across sources" },
        summary: { type: "string", description: "5-10 sentence summary of all material" },
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
          description: "Step-by-step procedures detected in the sources",
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
    description: "Design a course outline with typed lessons based on the knowledge brief",
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
                  required: ["title", "lesson_type", "objective"],
                  properties: {
                    title: { type: "string" },
                    objective: { type: "string", description: "What the learner will know after" },
                    lesson_type: {
                      type: "string",
                      enum: [
                        "reading", "concept", "flashcards", "steps",
                        "comparison", "case_study", "interactive_quiz",
                        "sop_walkthrough",
                      ],
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
          description: "Array of typed blocks matching the lesson_type",
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
            required: ["question_text", "question_type", "options", "correct_answer"],
            properties: {
              question_text: { type: "string" },
              question_type: { type: "string", enum: ["multiple_choice", "true_false"] },
              options: { type: "array", items: { type: "string" } },
              correct_answer: { type: "string" },
            },
          },
        },
      },
    },
  },
};

// ---------- Source → AI content parts ----------

function buildContentParts(sources: any[], textInstructions: string) {
  const parts: any[] = [{ type: "text", text: textInstructions }];
  for (const s of sources || []) {
    if (s.kind === "pdf" && s.payload) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${s.payload}`, detail: "high" },
      });
    } else if (s.kind === "image" && s.payload) {
      const url = String(s.payload).startsWith("data:")
        ? s.payload
        : `data:image/jpeg;base64,${s.payload}`;
      parts.push({ type: "image_url", image_url: { url, detail: "high" } });
    } else if (s.kind === "text" && s.payload) {
      parts.push({
        type: "text",
        text: `\n\n---\nFuente "${s.name || "texto"}":\n${String(s.payload).slice(0, 30_000)}`,
      });
    } else if (s.kind === "url" && s.payload) {
      parts.push({
        type: "text",
        text: `\n\n---\nFuente URL "${s.name || s.payload}":\n${String(s.text || "").slice(0, 30_000)}`,
      });
    } else if (s.kind === "excel" && s.payload) {
      parts.push({
        type: "text",
        text: `\n\n---\nFuente Excel/CSV "${s.name || "tabla"}" (markdown):\n${String(s.payload).slice(0, 30_000)}`,
      });
    }
  }
  return parts;
}

// ---------- Pipeline steps ----------

async function stepExtract(sources: any[], userNotes: string) {
  const text = `Analiza TODAS las fuentes adjuntas y produce un knowledge brief estructurado en español.
Incluye: tema central, resumen de 5-10 frases, conceptos clave (con definiciones y ejemplo),
hechos relevantes, procedimientos paso-a-paso si los detectas, comparaciones si aplican.
Notas del admin: ${userNotes || "(ninguna)"}
Llama a build_knowledge_brief con los resultados.`;
  return await callAi([{ role: "user", content: buildContentParts(sources, text) }], EXTRACT_TOOL, {
    temperature: 0.4,
    maxTokens: 8000,
  });
}

async function stepOutline(brief: any, title: string, level: string, userNotes: string) {
  // Calibrate scope to brief richness — never invent modules without material.
  const conceptCount = Array.isArray(brief?.key_concepts) ? brief.key_concepts.length : 0;
  const factCount = Array.isArray(brief?.facts) ? brief.facts.length : 0;
  const procCount = Array.isArray(brief?.procedures) ? brief.procedures.length : 0;
  const compCount = Array.isArray(brief?.comparisons) ? brief.comparisons.length : 0;
  const richness = conceptCount + factCount + procCount * 2 + compCount;

  // Adaptive caps: poor brief → small focused course, rich brief → up to 6 modules.
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
- Genera ENTRE ${minModules} Y ${maxModules} módulos. NO MÁS. Mejor pocos módulos sólidos que muchos vacíos.
- Cada módulo DEBE poder respaldarse con al menos 2-3 elementos del brief (conceptos, hechos, procedimientos…). Si no hay material para un módulo, NO lo crees.
- Cada módulo: 3 a 5 lecciones. NUNCA generes una lección si no hay material concreto en el brief para llenarla.

REGLAS PEDAGÓGICAS:
- **Microlearning**: cada lección ≤ 5 minutos.
- **Mix lógico por módulo** (adapta según material disponible):
   1. Si hay conceptos clave → una lección "concept"
   2. Si hay procedimiento → una lección "steps" o "sop_walkthrough"
   3. Si hay comparaciones → una lección "comparison"
   4. SIEMPRE una lección "interactive_quiz" para retrieval (≥ 5 ejercicios)
   5. Opcional: "case_study" o "flashcards" si el material lo soporta
- **Asignación de lesson_type según material**:
   * "concept" → SOLO si key_concepts del brief tiene ≥ 3 términos relevantes para el módulo
   * "flashcards" → SOLO si hay datos memorizables (pares cortos)
   * "steps" → SOLO si brief.procedures tiene pasos para el tema
   * "sop_walkthrough" → SOLO si hay procedimiento crítico con riesgos
   * "comparison" → SOLO si brief.comparisons tiene tabla aplicable
   * "case_study" → SOLO si hay hechos suficientes para construir un escenario
   * "interactive_quiz" → SIEMPRE incluir uno por módulo (retrieval)
   * "reading" → ÚLTIMO RECURSO. Evítalo a menos que nada de lo anterior aplique
- "objective" claro (1 frase: qué sabrá el alumno).
- Notas del admin: ${userNotes || "(ninguna)"}
- Español neutro, tono profesional para adultos.`;
  return await callAi([{ role: "user", content: [{ type: "text", text }] }], OUTLINE_TOOL, {
    temperature: 0.4,
    maxTokens: 8000,
  });
}

async function stepMaterializeLesson(brief: any, moduleTitle: string, lesson: any) {
  const schemaHint = LESSON_BLOCK_HINTS[lesson.lesson_type] || LESSON_BLOCK_HINTS.reading;
  const baseText = `Genera los bloques de contenido para esta lección, en español, aplicando microlearning + feedback inmediato.

Curso brief: ${JSON.stringify(brief).slice(0, 12_000)}
Módulo: "${moduleTitle}"
Lección: "${lesson.title}"
Tipo: ${lesson.lesson_type}
Objetivo: ${lesson.objective}

REGLAS DE CALIDAD (OBLIGATORIO):
- Microlearning: ≤ 5 minutos (≤ 300 palabras + ejercicios cortos).
- Concreto y aplicable: cero relleno. Usa datos REALES del brief.
- Para preguntas (mc / true_false / fill_blank): SIEMPRE "explanation" útil que (1) explique por qué la correcta es correcta, (2) mencione el error común, (3) termine con un mini-tip de memoria.
- En "mc" los distractores deben ser PLAUSIBLES.
- En "sop_walkthrough" cada paso crítico lleva "warning" si hay riesgo y "must_check": true.
- DEBES devolver al menos 4 bloques que cumplan EXACTAMENTE el formato del tipo "${lesson.lesson_type}".

FORMATO REQUERIDO de cada bloque (tipo "${lesson.lesson_type}"):
${schemaHint}

Devuelve entre 4 y 10 bloques de calidad real (no placeholders).`;

  // Try up to 2 times. If the second attempt still produces invalid content,
  // throw — caller will skip this lesson rather than insert a placeholder.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = attempt === 0
      ? baseText
      : baseText + `\n\n⚠ INTENTO PREVIO INVÁLIDO: tu salida no contenía bloques válidos del tipo "${lesson.lesson_type}". Esta vez SOLO devuelve bloques con la forma exacta indicada arriba.`;
    const result = await callAi(
      [{ role: "user", content: [{ type: "text", text }] }],
      MATERIALIZE_LESSON_TOOL,
      { temperature: attempt === 0 ? 0.55 : 0.35, maxTokens: 6000 },
    );
    const blocks = Array.isArray(result?.blocks) ? result.blocks : [];
    if (blocksAreValid(lesson.lesson_type, blocks)) return blocks;
  }
  throw new Error(`Lesson "${lesson.title}" produced no valid blocks for type ${lesson.lesson_type}`);
}

async function stepMaterializeQuiz(brief: any, moduleTitle: string, lessons: any[]) {
  const text = `Genera 4-6 preguntas de quiz para el módulo "${moduleTitle}" del curso.
Brief: ${JSON.stringify(brief).slice(0, 8_000)}
Lecciones del módulo: ${lessons.map((l) => `"${l.title}"`).join(", ")}
- Mezcla multiple_choice (4 opciones) y true_false (2 opciones).
- correct_answer debe coincidir EXACTO con una opción.
- Todo en español.`;
  const result = await callAi([{ role: "user", content: [{ type: "text", text }] }], MATERIALIZE_QUIZ_TOOL, {
    temperature: 0.5,
    maxTokens: 4000,
  });
  return Array.isArray(result?.questions) ? result.questions : [];
}

const LESSON_BLOCK_HINTS: Record<string, string> = {
  reading: `{ "type": "heading", "text": "...", "level": 2 } | { "type": "paragraph", "text": "..." } | { "type": "callout", "variant": "info|tip|warning|success", "text": "..." } | { "type": "quote", "text": "...", "cite": "..." }`,
  concept: `{ "type": "term", "term": "...", "definition": "...", "example": "..." }`,
  flashcards: `{ "type": "flashcard", "front": "...", "back": "...", "hint": "..." }`,
  steps: `{ "type": "step", "n": 1, "title": "...", "description": "...", "tip": "..." }`,
  comparison: `Un solo bloque: { "type": "comparison_table", "headers": ["Aspecto","Opción A","Opción B"], "rows": [{"label":"...","cells":["...","..."]}] }`,
  case_study: `{ "type": "scenario", "title": "...", "text": "..." } | { "type": "question", "text": "..." } | { "type": "reflection", "text": "..." }`,
  sop_walkthrough: `Genera 3-7 bloques sop_step en orden:
{ "type": "sop_step", "n": 1, "title": "...", "description": "Instrucción operativa concreta", "warning": "⚠ Riesgo si aplica (opcional)", "must_check": true }
- "must_check": true SIEMPRE para pasos críticos.
- "warning" obligatorio si hay riesgo de seguridad, daño o error costoso.`,
  interactive_quiz: `Genera 5-7 ejercicios variados estilo Duolingo para adultos. USA AL MENOS 3 TIPOS DISTINTOS y NO repitas el mismo tipo más de 2 veces seguidas. Cada ejercicio DEBE incluir "explanation" con el porqué + tip de memoria.
- { "type": "mc", "question": "...", "options": ["a","b","c","d"], "correct": "a", "explanation": "..." }
- { "type": "true_false", "question": "...", "correct": true, "explanation": "..." }
- { "type": "fill_blank", "sentence": "El ___ es ___.", "correct": ["valor1","valor2"], "explanation": "..." }
- { "type": "match_pairs", "pairs": [{"left":"Concepto","right":"Definición"}, ...], "explanation": "..." }  // 3-5 pares
- { "type": "order_steps", "steps": ["Paso 1","Paso 2","Paso 3","Paso 4"], "explanation": "..." }
- { "type": "sort_into_buckets", "buckets": ["Categoría A","Categoría B"], "items": [{"text":"item","bucket":"Categoría A"}, ...], "explanation": "..." }
- { "type": "highlight_terms", "sentence": "Texto donde hay que marcar las palabras clave.", "terms": ["palabras","clave"], "distractors": ["otras"], "explanation": "..." }
- { "type": "tap_to_complete", "sentence": "El ___ controla el ___.", "bank": ["motor","sensor","panel","botón"], "correct": ["motor","sensor"], "explanation": "..." }`,
};

// ---------- Legacy single-shot (back-compat) ----------

const LEGACY_TOOL = {
  type: "function",
  function: {
    name: "generate_course_structure",
    description: "Generates a complete course structure",
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
            required: ["title", "description", "lessons", "quiz"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  required: ["title", "content_blocks"],
                  properties: {
                    title: { type: "string" },
                    content_blocks: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["type", "text"],
                        properties: {
                          type: { type: "string", enum: ["heading", "paragraph"] },
                          text: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
              quiz: {
                type: "object",
                required: ["questions"],
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["question_text", "question_type", "options", "correct_answer"],
                      properties: {
                        question_text: { type: "string" },
                        question_type: { type: "string", enum: ["multiple_choice", "true_false"] },
                        options: { type: "array", items: { type: "string" } },
                        correct_answer: { type: "string" },
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
  },
};

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      // Common
      title,
      level = "beginner",
      companyId,
      userId,
      // New API
      mode, // 'extract' | 'outline' | 'materialize' | undefined (full)
      sources,
      userNotes,
      brief, // for outline+materialize
      outline, // for materialize
      // Legacy
      pdfBase64,
      imageBase64s,
      instructions,
    } = body;

    if (!companyId || !userId) throw new Error("Missing companyId/userId");

    // ----- Mode: extract -----
    if (mode === "extract") {
      const out = await stepExtract(sources || [], userNotes || "");
      return json({ brief: out });
    }

    // ----- Mode: outline -----
    if (mode === "outline") {
      if (!brief) throw new Error("Missing brief");
      if (!title) throw new Error("Missing title");
      const out = await stepOutline(brief, title, level, userNotes || "");
      return json({ outline: out });
    }

    // ----- Mode: materialize_init (creates course shell + empty modules) -----
    // Splits the heavy work so each invocation stays under the edge CPU limit.
    if (mode === "materialize_init") {
      if (!brief || !outline || !title) throw new Error("Missing brief/outline/title");
      const supabase = getServiceClient();

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
          console.error("Module insert:", moduleError);
          moduleIds.push("");
          continue;
        }
        moduleIds.push(moduleData.id);
      }

      return json({ courseId, moduleIds, modulesCount: moduleIds.length });
    }

    // ----- Mode: materialize_module (one module: lessons in parallel + quiz) -----
    if (mode === "materialize_module") {
      const { moduleId, moduleIndex } = body;
      if (!brief || !outline || !moduleId) throw new Error("Missing brief/outline/moduleId");
      const mod = outline.modules?.[moduleIndex];
      if (!mod) throw new Error("Module index out of range");
      const supabase = getServiceClient();

      // Run all lesson generations in parallel (bounded by AI gateway concurrency).
      // Failed lessons are SKIPPED (not inserted as placeholders) so the module
      // never contains empty lessons. We report skipped titles back to the client.
      const lessonResults = await Promise.all(
        (mod.lessons || []).map(async (lesson: any) => {
          try {
            const blocks = await stepMaterializeLesson(brief, mod.title, lesson);
            return { lesson, blocks, ok: true as const };
          } catch (e) {
            console.error("Lesson materialize failed (skipping):", lesson.title, e);
            return { lesson, blocks: [], ok: false as const };
          }
        }),
      );

      // Insert ONLY lessons that produced valid content. Preserves order via sort_order.
      const skipped: string[] = [];
      let inserted = 0;
      for (const { lesson, blocks, ok } of lessonResults) {
        if (!ok || blocks.length === 0) {
          skipped.push(lesson.title);
          continue;
        }
        await supabase.from("lessons").insert({
          module_id: moduleId,
          title: lesson.title,
          lesson_type: lesson.lesson_type || "reading",
          content: { blocks },
          content_type: "text",
          sort_order: inserted,
          xp_reward: 10,
        });
        inserted++;
      }

      // Quiz per module — only if the module actually has lessons with content.
      if (inserted > 0) {
        try {
          const questions = await stepMaterializeQuiz(brief, mod.title, mod.lessons || []);
          // Only keep well-formed questions whose correct_answer matches an option.
          const validQs = (questions || []).filter((q: any) =>
            q?.question_text &&
            Array.isArray(q.options) && q.options.length >= 2 &&
            q.correct_answer && q.options.includes(q.correct_answer),
          );
          if (validQs.length) {
            const { data: quizData, error: quizError } = await supabase
              .from("quizzes")
              .insert({
                module_id: moduleId,
                title: `Quiz: ${mod.title}`,
                passing_score: 70,
                max_attempts: 3,
                xp_reward: 25,
              })
              .select("id")
              .single();
            if (!quizError && quizData) {
              const qRows = validQs.map((q: any, qi: number) => ({
                quiz_id: quizData.id,
                question_text: q.question_text,
                question_type: q.question_type || "multiple_choice",
                options: q.options || [],
                correct_answer: q.correct_answer,
                sort_order: qi,
              }));
              await supabase.from("questions").insert(qRows);
            }
          }
        } catch (e) {
          console.error("Quiz materialize failed:", mod.title, e);
        }
      } else {
        // Module ended up with zero valid lessons → delete the empty module shell
        // so the course never shows hollow modules.
        await supabase.from("modules").delete().eq("id", moduleId);
        console.warn(`Module "${mod.title}" deleted: no valid lessons generated.`);
      }

      return json({ ok: true, moduleId, inserted, skipped, deleted: inserted === 0 });
    }

    // ----- Legacy single-shot materialize (kept for back-compat, NOT recommended). -----
    if (mode === "materialize") {
      throw new Error(
        "Legacy 'materialize' mode disabled to avoid CPU limits. Use 'materialize_init' + 'materialize_module' chunks.",
      );
    }

    // ----- LEGACY single-shot (back-compat) -----
    if (!title) throw new Error("Missing title");
    const legacyParts: any[] = [
      {
        type: "text",
        text: `Genera un curso completo y detallado con la siguiente información:

Título del curso: ${title}
Nivel: ${level}
Instrucciones adicionales: ${instructions || "Genera un curso completo y bien estructurado."}

REGLAS:
- 3 a 8 módulos, 2 a 5 lecciones por módulo, 3-5 bloques por lección.
- Bloques tipo "heading" y "paragraph" en español.
- Cada módulo con quiz de 3-5 preguntas (multiple_choice 4 opciones o true_false).
- Usa la función generate_course_structure.`,
      },
    ];
    if (pdfBase64) {
      legacyParts.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${pdfBase64}`, detail: "high" },
      });
    }
    if (Array.isArray(imageBase64s)) {
      for (const img of imageBase64s) {
        legacyParts.push({
          type: "image_url",
          image_url: {
            url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
            detail: "high",
          },
        });
      }
    }
    const courseStructure = await callAi(
      [{ role: "user", content: legacyParts }],
      LEGACY_TOOL,
      { temperature: 0.7, maxTokens: 16000 },
    );

    const supabase = getServiceClient();
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        title,
        description: courseStructure.description || "",
        level,
        status: "draft",
        company_id: companyId,
        created_by: userId,
        estimated_duration_minutes: courseStructure.estimated_duration_minutes || 30,
        xp_reward: (courseStructure.modules?.length || 3) * 50,
      })
      .select("id")
      .single();
    if (courseError) throw new Error(`Course insert: ${courseError.message}`);
    const courseId = course.id;

    for (let mi = 0; mi < courseStructure.modules.length; mi++) {
      const mod = courseStructure.modules[mi];
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
      if (moduleError) continue;
      const moduleId = moduleData.id;

      if (Array.isArray(mod.lessons)) {
        for (let li = 0; li < mod.lessons.length; li++) {
          const lesson = mod.lessons[li];
          await supabase.from("lessons").insert({
            module_id: moduleId,
            title: lesson.title,
            content: { blocks: lesson.content_blocks || [] },
            content_type: "text",
            sort_order: li,
            xp_reward: 10,
          });
        }
      }

      if (mod.quiz?.questions?.length > 0) {
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .insert({
            module_id: moduleId,
            title: `Quiz: ${mod.title}`,
            passing_score: 70,
            max_attempts: 3,
            xp_reward: 25,
          })
          .select("id")
          .single();
        if (!quizError && quizData) {
          for (let qi = 0; qi < mod.quiz.questions.length; qi++) {
            const q = mod.quiz.questions[qi];
            await supabase.from("questions").insert({
              quiz_id: quizData.id,
              question_text: q.question_text,
              question_type: q.question_type || "multiple_choice",
              options: q.options || [],
              correct_answer: q.correct_answer,
              sort_order: qi,
            });
          }
        }
      }
    }

    return json({ courseId, modulesCount: courseStructure.modules.length });
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
  return createClient(url, key);
}
function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
