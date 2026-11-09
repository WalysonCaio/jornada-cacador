const ALLOWED_ORIGINS = new Set(["https://jornada.wcaio.workers.dev", "http://localhost:4173", "http://localhost:3000"]);
Deno.serve((request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
  if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  return new Response(
    JSON.stringify({
      error: "Endpoint descontinuado (410 Gone). Utilize assistente-pmpe ou material-gemini.",
      code: "DEPRECATED_ENDPOINT",
    }),
    { status: 410, headers },
  );
});
