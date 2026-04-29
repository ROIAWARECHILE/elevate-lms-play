// =====================================================================
// repair-course — Audita un curso existente y repara las lecciones rotas.
// - Usa el validador compartido para detectar lecciones sin bloques válidos.
// - Invoca regenerate-lesson para cada lección rota (modo "regenerate").
// - Devuelve un reporte de qué se reparó y qué sigue fallando.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { sanitizeBlocksForLessonType, MIN_BLOCKS_BY_TYPE } from "../_shared/course-quality.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { courseId, companyId } = await req.json();
    if (!courseId || !companyId) throw new Error("courseId y companyId son requeridos");

    const supabase = getServiceClient();

    const { data: course, error: ce } = await supabase
      .from("courses").select("id, company_id, title").eq("id", courseId).single();
    if (ce || !course) throw new Error("Curso no encontrado");
    if (course.company_id !== companyId) throw new Error("No autorizado");

    const { data: modules } = await supabase
      .from("modules").select("id, title").eq("course_id", courseId).order("sort_order");

    const repaired: { lesson: string; module: string }[] = [];
    const stillBroken: { lesson: string; module: string; reason: string }[] = [];
    let scanned = 0;

    for (const mod of modules || []) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, lesson_type, content")
        .eq("module_id", mod.id)
        .order("sort_order");

      for (const l of lessons || []) {
        scanned += 1;
        const type = l.lesson_type || "reading";
        const blocks = Array.isArray((l.content as any)?.blocks) ? (l.content as any).blocks : [];
        const valid = sanitizeBlocksForLessonType(type, blocks);
        const min = MIN_BLOCKS_BY_TYPE[type] ?? 1;
        if (valid.length >= min) continue; // OK

        // Intentar reparar con regenerate-lesson
        try {
          const { data: rd, error: re } = await supabase.functions.invoke("regenerate-lesson", {
            body: { lessonId: l.id, companyId, mode: "regenerate" },
          });
          if (re || rd?.error) {
            stillBroken.push({ lesson: l.title, module: mod.title, reason: rd?.error || re?.message || "regenerate falló" });
          } else {
            repaired.push({ lesson: l.title, module: mod.title });
          }
        } catch (err: any) {
          stillBroken.push({ lesson: l.title, module: mod.title, reason: err?.message || "excepción" });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned,
        repairedCount: repaired.length,
        stillBrokenCount: stillBroken.length,
        repaired,
        stillBroken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("repair-course error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
