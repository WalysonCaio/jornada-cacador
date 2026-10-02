const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const ALLOWED_ORIGINS = new Set(["https://jornada.wcaio.workers.dev", "http://localhost:4173", "http://localhost:3000"]);

function headers(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Vary": "Origin" };
}
const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(request) });

async function uploadPdf(bytes: Uint8Array, title: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", { method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength), "X-Goog-Upload-Header-Content-Type": "application/pdf", "Content-Type": "application/json" }, body: JSON.stringify({ file: { display_name: title } }) });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error("Não foi possível preparar a redação para análise.");
  const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: bytes });
  const data = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !data?.file?.uri) throw new Error(data?.error?.message ?? "Falha ao enviar a redação para a IA.");
  return data.file as { uri: string; name?: string; mimeType?: string };
}

async function finishUsage(id: number | undefined, status: "success" | "error", errorCode?: string) {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: status === "success" ? "gemini" : null, model: status === "success" ? "gemini-2.5-flash" : null, error_code: errorCode ?? null }) }).catch(() => undefined);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  const auth = request.headers.get("authorization") ?? "";
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: PUBLIC_KEY } });
  const user = authResponse.ok ? await authResponse.json() : null;
  if (!user?.id) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  const input = await request.json().catch(() => null);
  const submissionId = String(input?.submission_id ?? "");
  let usageId: number | undefined;
  try {
    const rowResponse = await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}&user_id=eq.${user.id}&select=*&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const rows = rowResponse.ok ? await rowResponse.json() : [];
    const essay = rows?.[0];
    if (!essay) return reply(request, { error: "Redação não encontrada nesta conta." }, 404);
    const activeSince = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const activeResponse = await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?user_id=eq.${user.id}&processing_status=eq.processing&updated_at=gt.${encodeURIComponent(activeSince)}&id=neq.${encodeURIComponent(submissionId)}&select=id&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const active = activeResponse.ok ? await activeResponse.json() : [];
    if (Array.isArray(active) && active.length) return reply(request, { error: "Já existe uma redação sendo corrigida. Aguarde a conclusão antes de iniciar outra.", retryable: true }, 409);
    const guard = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: user.id, p_campaign_id: essay.campaign_id, p_operation: "review", p_daily_limit: 5 }) });
    const usage = guard.ok ? await guard.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
    if (!usage.allowed) return reply(request, { error: usage.reason === "DAILY_LIMIT" ? "Você atingiu o limite diário de 5 correções. Sua redação está salva; tente novamente após a renovação da cota." : "Já existe uma análise em andamento. Aguarde alguns minutos.", retryable: true }, usage.reason === "DAILY_LIMIT" ? 429 : 409);
    usageId = usage.event_id;
    await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${submissionId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "processing", updated_at: new Date().toISOString() }) });
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${essay.storage_path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!file.ok) throw new Error("Não foi possível abrir o PDF da redação.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("A redação deve ter no máximo 20 MB.");
    const geminiFile = await uploadPdf(bytes, essay.title);
    const prompt = `Atue como corretor experiente de redações para concursos públicos brasileiros. Analise somente o texto manuscrito ou digitado presente no PDF. Tema informado: ${essay.theme}. Tipo textual informado: ${essay.essay_type}. Quantidade solicitada: ${essay.required_lines || "não informada"} linhas. Instruções adicionais: ${essay.instructions || "nenhuma"}. Não invente trechos ilegíveis. Aponte quando algo não puder ser lido. Avalie aderência ao tema e ao tipo textual, estrutura, tese, argumentação, coesão, coerência, gramática, ortografia, pontuação, repertório, conclusão e respeito à quantidade de linhas. Forneça nota geral de 0 a 100, diagnóstico direto, pontos fortes, problemas encontrados com explicação, plano de melhoria prioritário, sugestões de reescrita em trechos curtos e uma versão-modelo apenas como referência pedagógica. Não afirme seguir critérios oficiais de uma banca quando eles não foram fornecidos.`;
    const ai = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify({ contents: [{ parts: [{ file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } }, { text: prompt }] }], generationConfig: { temperature: 0.15, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { score: { type: "INTEGER", minimum: 0, maximum: 100 }, readable: { type: "BOOLEAN" }, diagnosis: { type: "STRING" }, strengths: { type: "ARRAY", items: { type: "STRING" } }, improvements: { type: "ARRAY", items: { type: "OBJECT", properties: { category: { type: "STRING" }, problem: { type: "STRING" }, recommendation: { type: "STRING" } }, required: ["category", "problem", "recommendation"] } }, priority_plan: { type: "ARRAY", items: { type: "STRING" } }, rewrite_suggestions: { type: "ARRAY", items: { type: "STRING" } }, model_text: { type: "STRING" }, line_observation: { type: "STRING" } }, required: ["score", "readable", "diagnosis", "strengths", "improvements", "priority_plan", "rewrite_suggestions", "model_text", "line_observation"] } } }) });
    const aiData = await ai.json().catch(() => ({}));
    if (!ai.ok) {
      if (ai.status === 429) {
        await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${submissionId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending", updated_at: new Date().toISOString() }) });
        await finishUsage(usageId, "error", "PROVIDER_RATE_LIMIT");
        return reply(request, { error: "A cota gratuita do Gemini terminou temporariamente. A redação continua salva para nova tentativa.", retryable: true }, 429);
      }
      throw new Error(aiData?.error?.message ?? "A IA não conseguiu corrigir a redação.");
    }
    const result = JSON.parse(aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${submissionId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", result, updated_at: new Date().toISOString() }) });
    if (geminiFile.name) await fetch(`https://generativelanguage.googleapis.com/v1beta/${geminiFile.name}`, { method: "DELETE", headers: { "x-goog-api-key": GEMINI_KEY } }).catch(() => undefined);
    await finishUsage(usageId, "success");
    return reply(request, { result, provider: "gemini" });
  } catch (error) {
    await finishUsage(usageId, "error", "ESSAY_REVIEW_FAILED");
    if (submissionId) await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${submissionId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "error", updated_at: new Date().toISOString() }) }).catch(() => undefined);
    return reply(request, { error: String((error as Error)?.message ?? error) }, 500);
  }
});
