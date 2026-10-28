const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const ALLOWED_ORIGINS = new Set(["https://jornada.wcaio.workers.dev", "http://localhost:4173", "http://localhost:3000"]);
const modelDiscovery = new Map<string, Promise<string>>();
async function pickGeminiModel(geminiKey: string) {
  if (modelDiscovery.has(geminiKey)) return modelDiscovery.get(geminiKey)!;
  const discovery = (async () => {
    const configured = String(Deno.env.get("GEMINI_MODEL") ?? "").replace(/^models\//, "").trim();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } });
    const data = await response.json().catch(() => ({}));
    const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use|gemma|learnlm|aqa)/i;
    const enabled = Array.isArray(data?.models)
      ? data.models
          .filter((item: any) => item?.supportedGenerationMethods?.includes("generateContent"))
          .map((item: any) => String(item?.name ?? "").replace(/^models\//, "").trim())
          .filter((name: string) => name && !blocked.test(name))
          .sort((a: string, b: string) => {
            const score = (name: string) =>
              (name === "gemini-2.5-flash" ? 0 : name === "gemini-2.5-flash-lite" ? 1 : /flash(?!.*lite)/i.test(name) ? 2 : /flash-lite/i.test(name) ? 3 : 4) +
              (/preview|experimental|exp/i.test(name) ? 5 : 0);
            return score(a) - score(b) || a.localeCompare(b);
          })
      : [];
    const model = (configured && enabled.includes(configured) ? configured : "") || enabled[0] || configured || "gemini-2.5-flash";
    if (!response.ok || !model) throw new Error(data?.error?.message || "Nenhum modelo Gemini disponível para corrigir a redação.");
    return model;
  })();
  modelDiscovery.set(geminiKey, discovery);
  return discovery;
}

function parseGeminiJsonText(data: any) {
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
    : [];
  const raw = String((parts.length ? parts : data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || "").join("") ?? "").trim();
  if (!raw) throw new Error("EMPTY_GEMINI_RESPONSE");
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("INVALID_GEMINI_JSON");
  }
}

function headers(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Vary": "Origin" };
}
const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(request) });

async function uploadFile(bytes: Uint8Array, title: string, mimeType: string, geminiKey: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", { method: "POST", headers: { "x-goog-api-key": geminiKey, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength), "X-Goog-Upload-Header-Content-Type": mimeType, "Content-Type": "application/json" }, body: JSON.stringify({ file: { display_name: title } }) });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error("Não foi possível preparar a redação para análise.");
  const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": mimeType, "Content-Length": String(bytes.byteLength), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: bytes });
  const data = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !data?.file?.uri) throw new Error(data?.error?.message ?? "Falha ao enviar a redação para a IA.");
  const file = data.file as { uri: string; name?: string; mimeType?: string; state?: string; error?: { message?: string } };
  if (!file.name) return file;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (String(file.state || "").toUpperCase() === "ACTIVE") return file;
    if (String(file.state || "").toUpperCase() === "FAILED") {
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(file.error?.message || "O Gemini não conseguiu preparar a redação.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": geminiKey } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(statusData?.error?.message || "Não foi possível confirmar o arquivo da redação.");
    }
    Object.assign(file, statusData);
  }
  await removeGeminiFile(file.name, geminiKey);
  throw new Error("O Gemini demorou demais para preparar a redação.");
}

async function removeGeminiFile(name?: string, geminiKey = GEMINI_KEY) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": geminiKey } }).catch(() => undefined);
}

async function finishUsage(id: number | undefined, status: "success" | "error", errorCode?: string, model = "auto-discovered") {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: status === "success" ? "gemini" : null, model: status === "success" ? model : null, error_code: errorCode ?? null }) }).catch(() => undefined);
}

async function userGeminiKey(userId: string) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }) });
  if (!result.ok) return "";
  return String(await result.json().catch(() => "") || "").trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return reply(request, { error: "Método não permitido." }, 405);
  const auth = request.headers.get("authorization") ?? "";
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: PUBLIC_KEY } });
  const user = authResponse.ok ? await authResponse.json() : null;
  if (!user?.id) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_KEY;
  if (!activeGeminiKey) return reply(request, { error: "Configure sua chave Gemini em Perfil → Configurações de IA." }, 503);
  const input = await request.json().catch(() => null);
  const submissionId = String(input?.submission_id ?? "");
  let usageId: number | undefined;
  let geminiFileName: string | undefined;
  let geminiModel = "gemini-2.5-flash";
  try {
    const rowResponse = await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}&user_id=eq.${user.id}&select=*&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const rows = rowResponse.ok ? await rowResponse.json() : [];
    const essay = rows?.[0];
    if (!essay) return reply(request, { error: "Redação não encontrada nesta conta." }, 404);
    const activeSince = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const activeResponse = await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?user_id=eq.${user.id}&processing_status=eq.processing&updated_at=gt.${encodeURIComponent(activeSince)}&id=neq.${encodeURIComponent(submissionId)}&select=id&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const active = activeResponse.ok ? await activeResponse.json() : [];
    if (Array.isArray(active) && active.length) return reply(request, { error: "Já existe uma redação sendo corrigida. Aguarde a conclusão antes de iniciar outra.", retryable: true }, 409);
    const guard = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: user.id, p_campaign_id: essay.campaign_id, p_operation: "review", p_daily_limit: personalGeminiKey ? 10 : 2 }) });
    const usage = guard.ok ? await guard.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
    if (!usage.allowed) return reply(request, { error: usage.reason === "DAILY_LIMIT" ? `Você atingiu o limite diário de ${usage.limit || (personalGeminiKey ? 10 : 2)} análises. Sua redação está salva; configure sua chave pessoal ou tente após a renovação da cota.` : "Já existe uma análise em andamento. Aguarde alguns minutos.", retryable: true }, usage.reason === "DAILY_LIMIT" ? 429 : 409);
    usageId = usage.event_id;
    await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "processing", updated_at: new Date().toISOString() }) });
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${essay.storage_path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!file.ok) throw new Error("Não foi possível abrir o arquivo da redação.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("A redação deve ter no máximo 20 MB.");
    const extension = String(essay.source_name ?? "").toLowerCase().split(".").pop();
    const mimeType = file.headers.get("content-type")?.split(";")[0] || (extension === "png" ? "image/png" : ["jpg", "jpeg"].includes(extension ?? "") ? "image/jpeg" : "application/pdf");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(mimeType)) throw new Error("Formato inválido. Envie PDF, JPG ou PNG.");
    const geminiFile = await uploadFile(bytes, essay.title, mimeType, activeGeminiKey);
    geminiFileName = geminiFile.name;
    const board = String(essay.board ?? "geral");
    const boardGuidance = board === "AOCP" ? "Dê atenção especial à adequação ao tema, estrutura dissertativo-argumentativa, domínio da norma-padrão, coesão e coerência." : board === "Cebraspe" ? "Organize a devolutiva em aspectos macroestruturais (conteúdo, argumentação e organização) e microestruturais (gramática, ortografia, pontuação e coesão)." : board === "FGV" ? "Dê atenção especial à compreensão do tema, construção da tese, progressão argumentativa, estrutura, coesão e domínio linguístico." : "Use critérios gerais de redação para concursos públicos.";
    const prompt = `Atue como corretor experiente de redações para concursos públicos brasileiros. Analise somente o texto manuscrito ou digitado presente no arquivo. Tema informado: ${essay.theme}. Tipo textual informado: ${essay.essay_type}. Banca ou padrão solicitado: ${board}. ${boardGuidance} Quantidade solicitada: ${essay.required_lines || "não informada"} linhas. Instruções adicionais: ${essay.instructions || "nenhuma"}. Não invente trechos ilegíveis. Aponte quando algo não puder ser lido. Avalie aderência ao tema e ao tipo textual, estrutura, tese, argumentação, coesão, coerência, gramática, ortografia, pontuação, repertório, conclusão e respeito à quantidade de linhas. Forneça nota geral de 0 a 100, diagnóstico direto, pontos fortes, problemas encontrados com explicação, plano de melhoria prioritário, sugestões de reescrita em trechos curtos e uma versão-modelo apenas como referência pedagógica. Os critérios são uma aproximação pedagógica: não afirme que a nota reproduz a correção oficial da banca quando o espelho oficial não foi fornecido.`;
    geminiModel = await pickGeminiModel(activeGeminiKey);
    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": activeGeminiKey }, body: JSON.stringify({ contents: [{ parts: [{ file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } }, { text: prompt }] }], generationConfig: { temperature: 0.15, maxOutputTokens: 16384, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { score: { type: "INTEGER", minimum: 0, maximum: 100 }, readable: { type: "BOOLEAN" }, diagnosis: { type: "STRING" }, strengths: { type: "ARRAY", items: { type: "STRING" } }, improvements: { type: "ARRAY", items: { type: "OBJECT", properties: { category: { type: "STRING" }, problem: { type: "STRING" }, recommendation: { type: "STRING" } }, required: ["category", "problem", "recommendation"] } }, priority_plan: { type: "ARRAY", items: { type: "STRING" } }, rewrite_suggestions: { type: "ARRAY", items: { type: "STRING" } }, model_text: { type: "STRING" }, line_observation: { type: "STRING" } }, required: ["score", "readable", "diagnosis", "strengths", "improvements", "priority_plan", "rewrite_suggestions", "model_text", "line_observation"] } } }) });
    const aiData = await ai.json().catch(() => ({}));
    if (!ai.ok) {
      if (ai.status === 429) {
        await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending", updated_at: new Date().toISOString() }) });
        await finishUsage(usageId, "error", "PROVIDER_RATE_LIMIT", geminiModel);
        return reply(request, { error: "A cota gratuita do Gemini terminou temporariamente. A redação continua salva para nova tentativa.", retryable: true }, 429);
      }
      throw new Error(aiData?.error?.message ?? "A IA não conseguiu corrigir a redação.");
    }
    const result = parseGeminiJsonText(aiData);
    await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", result, updated_at: new Date().toISOString() }) });
    await removeGeminiFile(geminiFileName, activeGeminiKey);
    geminiFileName = undefined;
    await finishUsage(usageId, "success", undefined, geminiModel);
    return reply(request, { result, provider: "gemini", model: geminiModel, key_source: personalGeminiKey ? "personal" : "shared" });
  } catch (error) {
    await finishUsage(usageId, "error", "ESSAY_REVIEW_FAILED", geminiModel);
    if (submissionId) await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?id=eq.${encodeURIComponent(submissionId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "error", updated_at: new Date().toISOString() }) }).catch(() => undefined);
    return reply(request, { error: String((error as Error)?.message ?? error) }, 500);
  } finally {
    await removeGeminiFile(geminiFileName, activeGeminiKey);
  }
});
