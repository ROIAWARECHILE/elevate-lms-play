// =====================================================================
// fetch-source: descarga sanitizada de URLs externas para Course Studio.
// - Allowlist de schemes (http/https)
// - Timeout de 10s
// - Tope de 2MB de respuesta
// - Devuelve texto plano extraído de HTML (o pasa-through si ya es texto)
// =====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : null;
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
      throw new Error("Invalid URL");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http/https URLs are allowed");
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Kibbo-CourseStudio/1.0 (+https://kibbolearn.online)",
          Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new Error("Response exceeds 2MB limit");
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(merged);

    let title: string | null = null;
    let text: string;
    if (contentType.includes("html")) {
      title = extractTitle(raw);
      text = stripHtml(raw);
    } else if (contentType.includes("json")) {
      text = raw;
    } else {
      text = raw;
    }

    // Cap text to keep prompt under control (~50k chars ≈ 12k tokens)
    if (text.length > 50_000) text = text.slice(0, 50_000) + "…[truncated]";

    return new Response(
      JSON.stringify({ url: parsed.toString(), title, text, contentType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fetch-source error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
