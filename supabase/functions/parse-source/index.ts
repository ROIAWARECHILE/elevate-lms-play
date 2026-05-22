// =====================================================================
// parse-source — Convierte PDFs / imágenes / docx a markdown estructurado
// usando LlamaParse (https://docs.cloud.llamaindex.ai/llamaparse).
//
// Acepta dos modos de entrada:
//   - storageUrl + storagePath: descarga el archivo desde Supabase Storage
//     (flujo principal para archivos >4MB, sin limit de payload HTTP)
//   - payload: base64 del archivo (flujo legacy para imágenes pequeñas en
//     fallback de modo visión)
//
// Tras parsear, elimina el archivo de Storage para evitar huérfanos.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LLAMA_BASE = "https://api.cloud.llamaindex.ai/api/v1/parsing";
const MAX_BYTES = 55 * 1024 * 1024; // 55 MB
const MAX_POLL_MS = 110_000;

const KIND_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  image: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const KIND_TO_EXT: Record<string, string> = {
  pdf: "pdf", image: "jpg", docx: "docx", pptx: "pptx",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function downloadFromStorage(storageUrl: string): Promise<Uint8Array> {
  const res = await fetch(storageUrl);
  if (!res.ok) throw new Error(`Error descargando archivo de Storage: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function uploadToLlama(apiKey: string, kind: string, name: string, bytes: Uint8Array, mimeOverride?: string) {
  const mime = mimeOverride || KIND_TO_MIME[kind] || "application/octet-stream";
  const ext = KIND_TO_EXT[kind] || "bin";
  const filename = name?.includes(".") ? name : `${name || "source"}.${ext}`;

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("result_type", "markdown");
  form.append("language", "es");
  form.append("parse_mode", "parse_page_with_agent");
  form.append("invalidate_cache", "false");
  form.append(
    "parsing_instruction",
    [
      "Eres un parser para un sistema de e-learning corporativo (LMS).",
      "Extrae TODO el contenido relevante manteniendo la estructura original:",
      "- Tablas reales en formato markdown (| col1 | col2 |).",
      "- Listas numeradas para procedimientos y pasos.",
      "- Headings (#, ##, ###) para secciones y sub-secciones.",
      "- Especificaciones técnicas, dimensiones, precios y comparativas.",
      "- Definiciones y glosarios como pares término — definición.",
      "Conserva el orden de lectura. No resumas. Idioma: español.",
    ].join(" "),
  );

  const res = await fetch(`${LLAMA_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LlamaParse upload ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data?.id) throw new Error("LlamaParse no devolvió job id");
  return data.id as string;
}

async function pollJob(apiKey: string, jobId: string) {
  const start = Date.now();
  while (Date.now() - start < MAX_POLL_MS) {
    const res = await fetch(`${LLAMA_BASE}/job/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LlamaParse job ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const status = String(data?.status || "").toUpperCase();
    if (status === "SUCCESS") return data;
    if (status === "ERROR" || status === "CANCELED" || status === "FAILED") {
      throw new Error(`LlamaParse job falló: ${data?.error || status}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // 1.5s entre polls (antes 2.5s)
  }
  throw new Error("LlamaParse timeout (>110s). El documento es muy grande, prueba dividirlo.");
}

async function fetchMarkdown(apiKey: string, jobId: string) {
  const res = await fetch(`${LLAMA_BASE}/job/${jobId}/result/markdown`, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LlamaParse markdown ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return String(data?.markdown || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let storagePath: string | undefined;
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  try {
    const apiKey = Deno.env.get("LLAMAPARSE_API_KEY");
    if (!apiKey) return json({ error: "LLAMAPARSE_API_KEY no configurado" }, 500);

    const body = await req.json();
    const { kind, name, payload, mime, storageUrl } = body || {};
    storagePath = body?.storagePath;

    if (!kind) return json({ error: "kind es requerido" }, 400);
    if (!["pdf", "image", "docx", "pptx"].includes(kind)) {
      return json({ error: `kind no soportado: ${kind}` }, 400);
    }
    if (!storageUrl && !payload) {
      return json({ error: "storageUrl o payload son requeridos" }, 400);
    }

    // Inicializar cliente de Supabase con service role para limpiar Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      supabaseAdmin = createClient(supabaseUrl, serviceKey);
    }

    let bytes: Uint8Array;
    if (storageUrl) {
      // Flujo principal: descargar desde Supabase Storage
      bytes = await downloadFromStorage(storageUrl);
    } else {
      // Flujo legacy: payload base64
      try {
        bytes = base64ToBytes(String(payload));
      } catch {
        return json({ error: "payload base64 inválido" }, 400);
      }
    }

    if (bytes.byteLength > MAX_BYTES) {
      return json({ error: `Archivo excede ${Math.round(MAX_BYTES / 1024 / 1024)} MB` }, 413);
    }

    const jobId = await uploadToLlama(apiKey, kind, name || "source", bytes, mime);
    const meta = await pollJob(apiKey, jobId);
    const markdown = await fetchMarkdown(apiKey, jobId);

    // Limpiar archivo de Storage tras parsear correctamente
    if (supabaseAdmin && storagePath) {
      await supabaseAdmin.storage.from("course-uploads").remove([storagePath]);
    }

    const tables = (markdown.match(/\n\|.+\|\n\|[\s:|-]+\|/g) || []).length;
    const headings = (markdown.match(/^#{1,6}\s/gm) || []).length;

    return json({
      markdown,
      job_id: jobId,
      pages: meta?.job_metadata?.credits_used ?? meta?.pages ?? null,
      stats: { chars: markdown.length, tables, headings },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("parse-source error:", message);

    // Limpiar archivo de Storage aunque haya fallado el parse
    if (supabaseAdmin && storagePath) {
      await supabaseAdmin.storage.from("course-uploads").remove([storagePath]).catch(() => {});
    }

    return json({ error: message }, 400);
  }
});
