// =====================================================================
// fetch-source: descarga sanitizada de URLs externas para Course Studio.
// - User-Agent realista (Chrome) para evitar bloqueos de sitios
// - Timeout 25s, límite 8MB
// - Extracción inteligente del contenido principal (main/article)
// - Detección de PDFs en URL, detección de contenido vacío
// =====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIMEOUT_MS = 25_000;          // 25s

function extractMainContent(html: string): string {
  // 1. Eliminar bloques de ruido completos
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  // 2. Intentar extraer contenido principal semántico
  const mainMatch =
    clean.match(/<main[\s\S]*?<\/main>/i) ||
    clean.match(/<article[\s\S]*?<\/article>/i) ||
    clean.match(/<[^>]*role=["']main["'][^>]*>[\s\S]*?<\/[^>]+>/i) ||
    clean.match(/<[^>]*id=["'](?:content|main|article|post|entry)["'][^>]*>[\s\S]*?<\/[^>]+>/i);
  if (mainMatch) clean = mainMatch[0];

  // 3. Convertir estructura semántica a texto con jerarquía
  clean = clean
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // 4. Strip tags restantes
    .replace(/<[^>]+>/g, " ")
    // 5. Decodificar entities comunes
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    // 6. Limpiar espacios
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return clean;
}

function extractTitle(html: string): string | null {
  // Intentar og:title primero (más descriptivo), luego <title>
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og) return og[1].slice(0, 200);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? t[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") throw new Error("Missing url");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL inválida");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Solo se permiten URLs http/https");
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`El sitio respondió con error ${res.status}`);

    const contentType = res.headers.get("content-type") || "";

    // PDFs en URL: instruir al usuario a descargar y subir como archivo
    if (contentType.includes("pdf")) {
      throw new Error("Esta URL apunta directamente a un PDF. Descárgalo y súbelo como archivo PDF en la sección de fuentes.");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Sin cuerpo en la respuesta");

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new Error("La página es demasiado grande para procesarse. Prueba con una sección específica del sitio.");
        }
        chunks.push(value);
      }
    }

    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(merged);

    let title: string | null = null;
    let text: string;

    if (contentType.includes("html")) {
      title = extractTitle(raw);
      text = extractMainContent(raw);
    } else if (contentType.includes("json")) {
      text = raw;
    } else {
      text = raw;
    }

    // Detectar contenido vacío (sitios SPA o con bloqueo JS)
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 30) {
      throw new Error("Este sitio no devolvió contenido útil. Puede requerir JavaScript para renderizarse. Copia y pega el texto manualmente en la casilla de texto.");
    }

    // Cap a 50k caracteres para mantener el prompt bajo control
    if (text.length > 50_000) text = text.slice(0, 50_000) + "…[truncado]";

    return new Response(
      JSON.stringify({ url: parsed.toString(), title, text, contentType, wordCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Traducir errores técnicos del sistema a mensajes claros
    const friendly = message.includes("abort") || message.includes("signal")
      ? "El sitio tardó demasiado en responder (>25s). Intenta con otra URL."
      : message;
    console.error("fetch-source error:", message);
    return new Response(JSON.stringify({ error: friendly }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
