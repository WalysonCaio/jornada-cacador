const DEFAULT_ORIGINS = [
  "https://jornada-cacador.j32341472.chatgpt.site",
  "http://localhost:4173",
  "http://localhost:3000",
];

function allowedOrigins() {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

export function corsHeaders(request: Request) {
  const origin = (request.headers.get("origin") ?? "").replace(/\/$/, "");
  const origins = allowedOrigins();
  const fallback = Deno.env.get("PRIMARY_SITE_URL")?.replace(/\/$/, "") ?? DEFAULT_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : fallback,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}
