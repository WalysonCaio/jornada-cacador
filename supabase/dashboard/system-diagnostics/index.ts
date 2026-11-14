// ARQUIVO AUTOCONTIDO PARA COLAR NO EDITOR DO SUPABASE: system-diagnostics
// Gerado por: node scripts/build-supabase-dashboard.mjs
// Fonte: supabase/functions/system-diagnostics/index.ts
// SHA-256 da fonte: 2fc9bd9464176a77614622c579b1c6116a8d6f0436397ef734a4f22283546244
// Atualize a fonte e regenere; não exclua os validadores incorporados.

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
  }).catch(() => null);
  // Ausência de contagem não significa uma fila vazia nem um banco saudável.
  const total = response?.headers.get("content-range")?.split("/")[1];
  if (!response?.ok || !total || !/^\d+$/.test(total)) return -1;
  const value = Number(total);
  return Number.isSafeInteger(value) ? value : -1;
}

function extractSecretString(raw: unknown): string {
  if (typeof raw === "string") return raw.replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim();
  if (Array.isArray(raw) && raw[0]) return extractSecretString(raw[0]);
  if (raw && typeof raw === "object") {
    const val = (raw as Record<string, unknown>).get_user_ai_secret ?? (raw as Record<string, unknown>).decrypted_secret ?? "";
    return typeof val === "string" ? val.replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim() : "";
  }
  return "";
}

Deno.serve(async (request) => {
  const headers=cors(request);
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply({ error: "Configuração do serviço de diagnóstico incompleta." }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: PUBLIC_KEY } }).catch(() => null);
  if (!userResponse) return reply({ error: "Não foi possível verificar a sessão agora." }, 503);
  if (userResponse.status >= 500) return reply({ error: "O serviço de autenticação está indisponível agora." }, 503);
  const user = userResponse.ok ? await userResponse.json().catch(() => null) : null;
  if (!user?.id) return reply({ error: "Sessão inválida." }, 401);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const userId = encodeURIComponent(user.id);
  const [pending, failed, ready, pendingEssays, failedEssays, running, usageResponse, storageResponse] = await Promise.all([
    count(`study_documents?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`study_documents?user_id=eq.${userId}&processing_status=eq.error`),
    count(`study_documents?user_id=eq.${userId}&processing_status=eq.ready`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=in.(pending,processing)`),
    count(`essay_submissions?user_id=eq.${userId}&processing_status=eq.error`),
    count(`focus_sessions?user_id=eq.${userId}&status=eq.running`),
    fetch(`${SUPABASE_URL}/rest/v1/my_ai_usage_daily?user_id=eq.${userId}&usage_day=eq.${today}&select=operation,successful,failed,input_units,output_units`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }).catch(() => null),
    // Consulta somente metadados do bucket; não cria nem lê arquivos privados.
    fetch(`${SUPABASE_URL}/storage/v1/bucket/study-documents`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }).catch(() => null),
  ]);
  const usageRows = usageResponse?.ok ? await usageResponse.json().catch(() => null) : null;
  const usageAvailable = Array.isArray(usageRows);
  const usage = usageAvailable ? usageRows : [];
  const bucket = storageResponse?.ok ? await storageResponse.json().catch(() => null) : null;
  const databaseOk = [pending, failed, ready, pendingEssays, failedEssays, running].every(value => value >= 0) && usageAvailable;
  const storageOk = bucket?.id === "study-documents";
  const personalKeyResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: user.id, p_provider: "gemini" }),
  }).catch(() => null);
  const personalGeminiKey = personalKeyResponse?.ok ? extractSecretString(await personalKeyResponse.json().catch(() => "")) : "";
  const geminiKey = personalGeminiKey || Deno.env.get("GEMINI_API_KEY") || "";
  let geminiModels: string[] = [];
  let geminiApiError = "";
  if (geminiKey) {
    const modelResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } }).catch(() => null);
    const modelData = modelResponse ? await modelResponse.json().catch(() => ({})) : {};
    if (modelResponse?.ok && Array.isArray(modelData?.models)) geminiModels = modelData.models.filter((item: any) => item?.supportedGenerationMethods?.includes("generateContent")).map((item: any) => String(item?.name ?? "").replace(/^models\//, "")).filter(Boolean).slice(0, 12);
    else geminiApiError = modelData?.error?.message || "Não foi possível consultar os modelos Gemini.";
  }
  return reply({
    ok: databaseOk && storageOk,
    version: "78",
    project_ref: new URL(SUPABASE_URL).hostname.split(".")[0],
    database: databaseOk,
    database_status: databaseOk ? "available" : "unavailable",
    storage: storageOk,
    storage_status: storageOk ? "available" : "unavailable",
    storage_check: "bucket_metadata_only",
    rls_verified: false,
    usage_available: usageAvailable,
    gemini_configured: Boolean(geminiKey),
    gemini_key_source: personalGeminiKey ? "personal" : "shared",
    gemini_key_last_four: personalGeminiKey ? personalGeminiKey.slice(-4) : null,
    gemini_api_ok: geminiModels.length > 0,
    gemini_available_models: geminiModels,
    gemini_api_error: geminiApiError || null,
    groq_configured: Boolean(Deno.env.get("GROQ_API_KEY")),
    deepseek_configured: Boolean(Deno.env.get("DEEPSEEK_API_KEY")),
    pending_documents: pending,
    failed_documents: failed,
    ready_documents: ready,
    pending_essays: pendingEssays,
    failed_essays: failedEssays,
    running_focus_sessions: running,
    limits: { successful_file_analyses_per_day: personalGeminiKey ? 25 : 10, assistant_questions_per_day: 40, max_pdf_megabytes: 50 },
    usage,
    checked_at: new Date().toISOString(),
  });
});
