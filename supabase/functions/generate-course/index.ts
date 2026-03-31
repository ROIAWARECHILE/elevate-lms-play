import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "generate_course_structure",
    description:
      "Generates a complete course structure with modules, lessons and quizzes",
    parameters: {
      type: "object",
      required: ["description", "estimated_duration_minutes", "modules"],
      properties: {
        description: {
          type: "string",
          description: "Course description (2-3 sentences)",
        },
        estimated_duration_minutes: {
          type: "number",
          description: "Total estimated duration in minutes",
        },
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
                          type: {
                            type: "string",
                            enum: ["heading", "paragraph"],
                          },
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
                      required: [
                        "question_text",
                        "question_type",
                        "options",
                        "correct_answer",
                      ],
                      properties: {
                        question_text: { type: "string" },
                        question_type: {
                          type: "string",
                          enum: ["multiple_choice", "true_false"],
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                        },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    const USE_LOVABLE = !!Deno.env.get("LOVABLE_API_KEY");
    const AI_URL = USE_LOVABLE
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const AI_MODEL = USE_LOVABLE ? "google/gemini-2.5-pro" : "gpt-4o";

    const { title, instructions, level, pdfBase64, imageBase64s, companyId, userId } =
      await req.json();

    if (!title || !companyId || !userId) {
      throw new Error("Missing required fields: title, companyId, userId");
    }

    // Build multimodal content
    const contentParts: any[] = [];

    // System-like instructions in the user message
    contentParts.push({
      type: "text",
      text: `Genera un curso completo y detallado con la siguiente información:

Título del curso: ${title}
Nivel: ${level || "beginner"}
Instrucciones adicionales: ${instructions || "Genera un curso completo y bien estructurado."}

REGLAS IMPORTANTES:
- Genera entre 3 y 8 módulos según la complejidad del tema.
- Cada módulo debe tener entre 2 y 5 lecciones.
- Cada lección debe tener contenido educativo real y sustancial (mínimo 3-5 bloques de contenido).
- Usa bloques "heading" para títulos de sección y "paragraph" para el contenido explicativo.
- Los párrafos deben ser informativos, con ejemplos prácticos cuando sea posible.
- Cada módulo debe tener un quiz con 3-5 preguntas relevantes.
- Las preguntas deben tener 4 opciones para multiple_choice o 2 para true_false.
- El correct_answer debe coincidir exactamente con una de las opciones.
- Todo el contenido debe estar en español.
- Usa la función generate_course_structure para devolver la estructura.`,
    });

    // Add PDF if provided
    if (pdfBase64) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:application/pdf;base64,${pdfBase64}`,
          detail: "high",
        },
      });
    }

    // Add images if provided
    if (imageBase64s && Array.isArray(imageBase64s)) {
      for (const img of imageBase64s) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
            detail: "high",
          },
        });
      }
    }

    console.log("Calling OpenAI API with gpt-4o...");

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: contentParts,
            },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: {
            type: "function",
            function: { name: "generate_course_structure" },
          },
          temperature: 0.7,
          max_tokens: 16000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorBody);
      throw new Error(
        `OpenAI API error (${openaiResponse.status}): ${errorBody}`
      );
    }

    const openaiData = await openaiResponse.json();
    const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "generate_course_structure") {
      throw new Error("OpenAI did not return expected tool call");
    }

    const courseStructure = JSON.parse(toolCall.function.arguments);
    console.log(
      "Course structure generated:",
      courseStructure.modules?.length,
      "modules"
    );

    // Insert into Supabase using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create the course
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        title,
        description: courseStructure.description || "",
        level: level || "beginner",
        status: "draft",
        company_id: companyId,
        created_by: userId,
        estimated_duration_minutes:
          courseStructure.estimated_duration_minutes || 30,
        xp_reward: (courseStructure.modules?.length || 3) * 50,
      })
      .select("id")
      .single();

    if (courseError) {
      console.error("Course insert error:", courseError);
      throw new Error(`Failed to create course: ${courseError.message}`);
    }

    const courseId = course.id;

    // 2. Insert modules, lessons, quizzes, questions
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

      if (moduleError) {
        console.error("Module insert error:", moduleError);
        continue;
      }

      const moduleId = moduleData.id;

      // Insert lessons
      if (mod.lessons && Array.isArray(mod.lessons)) {
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

      // Insert quiz
      if (mod.quiz && mod.quiz.questions?.length > 0) {
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

    console.log("Course created successfully:", courseId);

    return new Response(
      JSON.stringify({ courseId, modulesCount: courseStructure.modules.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
