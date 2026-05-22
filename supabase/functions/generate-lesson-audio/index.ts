// =====================================================================
// generate-lesson-audio — Genera un audio explicativo por lección.
// 1. Extrae el texto de los bloques de la lección.
// 2. Gemini genera un guión conversacional tipo "tutor explicando".
// 3. ElevenLabs convierte el guión a MP3.
// 4. El MP3 se sube a Supabase Storage (bucket: lesson-audio).
// 5. La URL pública se cachea en lessons.audio_url.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
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
        case "flashcard": return `Pregunta: ${b.front}. Respuesta: ${b.back}.`;
        case "step": return `Paso ${b.n}: ${b.title}. ${b.description || ""}`;
        case "sop_step": return `${b.title}: ${b.description || ""}`;
        case "scenario": return b.text || "";
        case "question": return b.text || "";
        case "reflection": return b.text || "";
        case "mc": return `${b.question} (respuesta: ${b.correct})`;
        case "true_false": return `${b.question} (${b.correct ? "Verdadero" : "Falso"})`;
        case "fill_blank": return b.sentence || "";
        case "comparison_table":
          if (!b.rows) return "";
          return b.rows.map((r: any) => `${r.label}: ${(r.cells || []).join(" versus ")}`).join(". ");
        default: return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

async function generateScript(lessonTitle: string, moduleTitle: string, rawText: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `Eres un tutor experto y cercano. Tu tarea es crear un guión de audio de 60 a 90 segundos (aproximadamente 150-200 palabras) que explique el contenido de la lección "${lessonTitle}" del módulo "${moduleTitle}" como si se lo estuvieras explicando a un amigo inteligente.

Contenido de la lección:
${rawText.slice(0, 6000)}

Reglas del guión:
- Empieza con una frase de enganche corta (no digas "Hola" ni te presentes)
- Usa lenguaje conversacional, natural, sin tecnicismos innecesarios
- Parafrasea y resume — NO copies el texto literal
- Destaca 2-3 ideas clave como si fueran lo más importante que deben recordar
- Cierra con una frase que conecte con lo que van a practicar o aplicar
- Solo devuelve el texto del guión, sin instrucciones de dirección, sin etiquetas, sin comillas envolventes
- En español, máximo 200 palabras`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 400,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Gemini no devolvió texto");
  return text;
}

async function generateAudio(script: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  // Ale — voz latinoamericana, tono amigable, optimizada para español
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || "n4x17EKVqyxfey8QMqvy";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs error (${res.status}): ${body.slice(0, 300)}`);
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { lessonId, forceRegenerate = false } = await req.json();
    if (!lessonId) throw new Error("lessonId requerido");

    const supabase = getServiceClient();

    // Cargar lección
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, title, lesson_type, content, audio_url, modules(title)")
      .eq("id", lessonId)
      .single();

    if (lessonErr || !lesson) throw new Error("Lección no encontrada");

    // Devolver cache si existe
    if (lesson.audio_url && !forceRegenerate) {
      return json({ audioUrl: lesson.audio_url, cached: true });
    }

    // Tipos sin contenido narrable
    if (lesson.lesson_type === "video_embed") {
      throw new Error("Las lecciones de video no tienen audio explicativo");
    }

    // Extraer texto de los bloques
    const blocks = lesson.content?.blocks || [];
    const rawText = extractTextFromBlocks(blocks);
    if (!rawText || rawText.length < 30) {
      throw new Error("La lección no tiene suficiente contenido para generar audio");
    }

    const moduleTitle = (lesson.modules as any)?.title || "";

    // 1. Gemini genera el guión conversacional
    const script = await generateScript(lesson.title, moduleTitle, rawText);

    // 2. ElevenLabs convierte a MP3
    const audioBytes = await generateAudio(script);

    // 3. Subir a Supabase Storage
    const fileName = `${lessonId}.mp3`;
    const { error: uploadErr } = await supabase.storage
      .from("lesson-audio")
      .upload(fileName, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadErr) throw new Error(`Storage upload error: ${uploadErr.message}`);

    // 4. Obtener URL pública
    const { data: urlData } = supabase.storage
      .from("lesson-audio")
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // 5. Cachear en DB
    await supabase
      .from("lessons")
      .update({ audio_url: audioUrl })
      .eq("id", lessonId);

    return json({ audioUrl, cached: false, script });
  } catch (e: any) {
    console.error("generate-lesson-audio error:", e?.message);
    return json({ error: e?.message || "Error desconocido" }, 500);
  }
});
