import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractSignedUrlFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    // Base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    const metadata = JSON.parse(payload.metadata ?? "{}");
    return (metadata.signed_url as string) ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { mode } = await req.json().catch(() => ({}));

  const defaultAgentId = Deno.env.get("ELEVENLABS_AGENT_ID");
  const clientAgentId = Deno.env.get("ELEVENLABS_CLIENT_AGENT_ID");
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  // Usa agente especializado en clientes si está configurado y el modo es "client"
  const agentId = (mode === "client" && clientAgentId) ? clientAgentId : defaultAgentId;

  if (!agentId || !apiKey) {
    return new Response(
      JSON.stringify({ error: "Secrets no configurados en el servidor (ELEVENLABS_AGENT_ID / ELEVENLABS_API_KEY)." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } },
  );
  const rawBody = await elevenRes.text();
  console.log("[elevenlabs-token] status:", elevenRes.status, "body:", rawBody.slice(0, 200));

  if (!elevenRes.ok) {
    return new Response(
      JSON.stringify({ error: `ElevenLabs ${elevenRes.status}: ${rawBody}` }),
      { status: elevenRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: `Respuesta no JSON: ${rawBody}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // La API nueva devuelve { token: "eyJ..." } con signed_url dentro del JWT
  const jwtToken = parsed.token as string | undefined;
  // La API antigua devolvía { signed_url: "wss://..." } directamente
  const directUrl = parsed.signed_url as string | undefined;

  const signedUrl = directUrl ?? (jwtToken ? extractSignedUrlFromToken(jwtToken) : null);

  if (!signedUrl) {
    return new Response(
      JSON.stringify({ error: `No se pudo extraer signed_url. Respuesta: ${rawBody.slice(0, 300)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log("[elevenlabs-token] signedUrl extracted OK");
  return new Response(
    JSON.stringify({ signedUrl }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
