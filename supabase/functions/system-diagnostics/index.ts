const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";
const ALLOWED_ORIGINS = new Set([SITE, "http://localhost:4173", "http://localhost:3000"]);
function cors(request: Request) { const origin=request.headers.get("origin")??"";return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)?origin:SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Vary":"Origin" }; }

async function count(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, Prefer: "count=exact" },
  });
  const range = response.headers.get("content-range") ?? "*/0";
  return response.ok ? Number(range.split("/")[1] ?? 0) : -1;
}

Deno.serve(async (request) => {
  const headers=cors(request);
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: PUBLIC_KEY } });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (!user?.id) return reply({ error: "Sessão inválida." }, 401);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const userId = encodeURIComponent(user.id);
  const [pending, failed, ready, pendingEssays, failedEssays, running, usageResponse] = await Promise.all([
    count(`study_documents?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`study_documents?user_id=eq.${userId}&processing_status=eq.error`),
    count(`study_documents?user_id=eq.${userId}&processing_status=eq.ready`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=eq.error`),
    count(`focus_sessions?user_id=eq.${userId}&status=eq.running`),
    fetch(`${SUPABASE_URL}/rest/v1/my_ai_usage_daily?user_id=eq.${userId}&usage_day=eq.${today}&select=operation,successful,failed,input_units,output_units`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }),
  ]);
  const usage = usageResponse.ok ? await usageResponse.json() : [];
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  let geminiModels: string[] = [];
  let geminiApiError = "";
  if (geminiKey) {
    const modelResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } }).catch(() => null);
    const modelData = modelResponse ? await modelResponse.json().catch(() => ({})) : {};
    if (modelResponse?.ok && Array.isArray(modelData?.models)) geminiModels = modelData.models.filter((item: any) => item?.supportedGenerationMethods?.includes("generateContent")).map((item: any) => String(item?.name ?? "").replace(/^models\//, "")).filter(Boolean).slice(0, 12);
    else geminiApiError = modelData?.error?.message || "Não foi possível consultar os modelos Gemini.";
  }
  return reply({
    ok: true,
    version: "64",
    project_ref: new URL(SUPABASE_URL).hostname.split(".")[0],
    database: true,
    storage: true,
    gemini_configured: Boolean(geminiKey),
    gemini_api_ok: geminiModels.length > 0,
    gemini_available_models: geminiModels,
    gemini_api_error: geminiApiError || null,
    groq_configured: Boolean(Deno.env.get("GROQ_API_KEY")),
    pending_documents: pending,
    failed_documents: failed,
    ready_documents: ready,
    pending_essays: pendingEssays,
    failed_essays: failedEssays,
    running_focus_sessions: running,
    limits: { successful_file_analyses_per_day: 10, assistant_questions_per_day: 40, max_pdf_megabytes: 50 },
    usage,
    checked_at: new Date().toISOString(),
  });
});
