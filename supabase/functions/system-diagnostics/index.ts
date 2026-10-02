const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

async function count(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, Prefer: "count=exact" },
  });
  const range = response.headers.get("content-range") ?? "*/0";
  return response.ok ? Number(range.split("/")[1] ?? 0) : -1;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: PUBLIC_KEY } });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (!user?.id) return reply({ error: "Sessão inválida." }, 401);

  const today = new Date().toISOString().slice(0, 10);
  const userId = encodeURIComponent(user.id);
  const [pending, failed, pendingEssays, failedEssays, running, usageResponse] = await Promise.all([
    count(`study_documents?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`study_documents?user_id=eq.${userId}&processing_status=eq.error`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=eq.error`),
    count(`focus_sessions?user_id=eq.${userId}&status=eq.running`),
    fetch(`${SUPABASE_URL}/rest/v1/my_ai_usage_daily?user_id=eq.${userId}&usage_day=eq.${today}&select=operation,successful,failed,input_units,output_units`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }),
  ]);
  const usage = usageResponse.ok ? await usageResponse.json() : [];
  return reply({
    ok: true,
    version: "57",
    database: true,
    storage: true,
    gemini_configured: Boolean(Deno.env.get("GEMINI_API_KEY")),
    groq_configured: Boolean(Deno.env.get("GROQ_API_KEY")),
    pending_documents: pending,
    failed_documents: failed,
    pending_essays: pendingEssays,
    failed_essays: failedEssays,
    running_focus_sessions: running,
    usage,
    checked_at: new Date().toISOString(),
  });
});
