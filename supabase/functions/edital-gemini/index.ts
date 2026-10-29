const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 34000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const FALLBACK_STATUS = new Set([400, 404]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const modelDiscovery = new Map<string, Promise<string[]>>();

async function availableGeminiModels(geminiKey: string): Promise<string[]> {
  if (modelDiscovery.has(geminiKey)) return modelDiscovery.get(geminiKey)!;
  const discovery = (async () => {
    const configured = String(Deno.env.get("GEMINI_MODEL") ?? "").replace(/^models\//, "").trim();
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } });
      const data = await response.json().catch(() => ({}));
      const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use|gemma|learnlm|aqa)/i;
      const names = Array.isArray(data?.models)
        ? data.models
            .filter((item: any) => item?.supportedGenerationMethods?.includes("generateContent"))
            .map((item: any) => String(item?.name ?? "").replace(/^models\//, "").trim())
            .filter((name: string) => name && !blocked.test(name))
            .sort((a: string, b: string) => {
              const score = (name: string) =>
                (name === "gemini-2.5-flash" ? 0 : name === "gemini-2.5-flash-lite" ? 1 : /flash(?!.*lite)/i.test(name) ? 2 : /flash-lite/i.test(name) ? 3 : /pro/i.test(name) ? 4 : 5) +
                (/preview|experimental|exp/i.test(name) ? 6 : 0);
              return score(a) - score(b) || a.localeCompare(b);
            })
        : [];
      const preferred = [
        configured && names.includes(configured) ? configured : "",
        ...FALLBACK_MODELS.filter((m) => names.includes(m)),
        ...names,
        ...(names.length === 0 ? [configured, ...FALLBACK_MODELS] : []),
      ].filter(Boolean);
      const unique = [...new Set(preferred)].slice(0, 5);
      if (!unique.length) throw new Error(data?.error?.message || "Nenhum modelo generateContent liberado.");
      console.log("Gemini edital models", unique);
      return unique;
    } catch (error) {
      modelDiscovery.delete(geminiKey);
      console.error("Gemini model discovery", String((error as Error)?.message ?? error));
      const fallback = [...new Set([configured, ...FALLBACK_MODELS].filter(Boolean))];
      if (fallback.length) return fallback;
      throw new Error("A chave Gemini não possui um modelo disponível para analisar o edital.");
    }
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

async function setDocumentStatus(documentId: string, userId: string, processingStatus: "pending" | "processing" | "ready" | "error") {
  if (!documentId || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ processing_status: processingStatus }),
  }).catch(() => undefined);
}

const ALLOWED_ORIGINS = new Set([
  "https://jornada.wcaio.workers.dev",
  "http://localhost:4173",
  "http://localhost:3000",
]);

function headers(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function pdfInlinePart(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { inline_data: { mime_type: "application/pdf", data: btoa(binary) } };
}

async function uploadPdfToGemini(bytes: Uint8Array, title: string, geminiKey: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: title } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`Falha ao iniciar envio ao Gemini (${start.status}).`);

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const data = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !data?.file?.uri) throw new Error(data?.error?.message ?? `Falha ao enviar PDF ao Gemini (${uploaded.status}).`);
  const file = data.file as { uri: string; name?: string; mimeType?: string; state?: string; error?: { message?: string } };
  if (!file.name) return file;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (String(file.state || "").toUpperCase() === "ACTIVE") return file;
    if (String(file.state || "").toUpperCase() === "FAILED") {
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(file.error?.message || "O Gemini não conseguiu preparar o edital.");
    }
    await wait(1500);
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": geminiKey } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      if (RETRYABLE_STATUS.has(statusResponse.status)) continue;
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(statusData?.error?.message || `Falha ao consultar o edital no Gemini (${statusResponse.status}).`);
    }
    Object.assign(file, statusData);
  }
  await removeGeminiFile(file.name, geminiKey);
  throw new Error("O Gemini demorou demais para preparar o edital. Tente novamente em alguns minutos.");
}

async function removeGeminiFile(name?: string, geminiKey = GEMINI_API_KEY) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": geminiKey },
  }).catch(() => undefined);
}

async function releaseStaleLocks(userId: string) {
  const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?user_id=eq.${encodeURIComponent(userId)}&status=eq.started&created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "error", error_code: "STALE_RELEASED" }),
  }).catch(() => undefined);
}

function formatEditalPages(rawPages: any[]): string | null {
  const pages = Array.isArray(rawPages) ? rawPages : [];
  if (!pages.length) return null;
  const formatted = pages
    .map((p: any, idx: number) => ({
      page: Number(p?.page) || idx + 1,
      text: String(p?.text ?? "").replace(/\u0000/g, "").replace(/[\t ]+/g, " ").trim(),
    }))
    .filter((p: { text: string }) => p.text.length > 10);
  const totalChars = formatted.reduce((acc: number, p: { text: string }) => acc + p.text.length, 0);
  if (totalChars < 120) return null;
  const fullText = formatted.map((p: { page: number; text: string }) => `[PÁGINA ${p.page}]\n${p.text}`).join("\n\n");
  if (fullText.length <= 130000) return fullText;
  const keywords = /(conte[uú]do program[aá]tico|conhecimentos? (gerais|espec[ií]ficos|b[aá]sicos)|objetos? de avalia[cç][aã]o|disciplinas?|anexo|l[ií]ngua portuguesa|direito|racioc[ií]nio|inform[aá]tica|matem[aá]tica|hist[oó]ria|geografia|legisla[cç][aã]o)/i;
  const selectedPages = formatted.filter((p: { text: string }, i: number) => keywords.test(p.text) || i < 3 || i >= formatted.length - 18);
  return (selectedPages.length ? selectedPages : formatted).map((p: { page: number; text: string }) => `[PÁGINA ${p.page}]\n${p.text}`).join("\n\n").slice(0, 130000);
}

async function loadBrowserExtractedEditalText(storagePath: string, inlinePayload?: any): Promise<string | null> {
  if (typeof inlinePayload?.extracted_text === "string" && inlinePayload.extracted_text.trim().length >= 120) {
    return inlinePayload.extracted_text.trim().slice(0, 130000);
  }
  if (Array.isArray(inlinePayload?.extracted_pages) && inlinePayload.extracted_pages.length) {
    const fromInline = formatEditalPages(inlinePayload.extracted_pages);
    if (fromInline) return fromInline;
  }
  const result = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}.text.json`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  }).catch(() => null);
  if (!result || !result.ok) return null;
  const payload = await result.json().catch(() => null);
  return formatEditalPages(payload?.pages);
}

async function reserveUsage(userId: string, campaignId: string, dailyLimit = 10) {
  await releaseStaleLocks(userId);
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: "edital", p_daily_limit: dailyLimit }) });
  return result.ok ? await result.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
}

async function finishUsage(eventId: number | undefined, status: "success" | "error", errorCode?: string, model = "gemini-2.5-flash") {
  if (!eventId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: "gemini", model, error_code: errorCode || null }) }).catch(() => undefined);
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

async function userGeminiKey(userId: string) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }) }).catch(() => null);
  if (!result?.ok) return "";
  return extractSecretString(await result.json().catch(() => ""));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return reply(request, { error: "Método não permitido." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "Authorization": authorization, "apikey": PUBLISHABLE_KEY } });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (!user?.id) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_API_KEY;
  if (!activeGeminiKey) return reply(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);

  const payload = await request.json().catch(() => null);
  const storagePath = String(payload?.storage_path ?? "");
  const campaignId = String(payload?.campaign_id ?? "");
  const documentId = String(payload?.document_id ?? "");
  const title = String(payload?.title ?? "Edital enviado");
  if (!storagePath || !campaignId || !documentId) {
    console.error("Campos ausentes", { storagePath: !!storagePath, campaignId: !!campaignId, documentId: !!documentId });
    return reply(request, { error: "O aplicativo não enviou todos os dados do documento." }, 400);
  }
  if (!storagePath.startsWith(`${user.id}/`)) return reply(request, { error: "Este documento não pertence à conta conectada." }, 403);

  let geminiFileName: string | undefined;
  let geminiFileKey = activeGeminiKey;
  let usage: { allowed?: boolean; event_id?: number; reason?: string; limit?: number } | null = null;
  let selectedModel = "gemini-2.5-flash";
  let usedKeySource: "personal" | "shared" = personalGeminiKey ? "personal" : "shared";
  try {
    const campaignResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_campaigns?id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,name&limit=1`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    const campaigns = campaignResponse.ok ? await campaignResponse.json() : [];
    if (!Array.isArray(campaigns) || !campaigns[0]?.id) return reply(request, { error: "Este portal não pertence à conta conectada." }, 403);
    const documentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,document_type,storage_path&limit=1`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    const documents = documentResponse.ok ? await documentResponse.json() : [];
    const document = Array.isArray(documents) ? documents[0] : null;
    if (!document || !["edital", "edital_concurso"].includes(String(document.document_type)) || document.storage_path !== storagePath) {
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: "O arquivo não está registrado como edital deste portal." }, 422);
    }
    usage = await reserveUsage(user.id, campaignId, personalGeminiKey ? 25 : 2);
    if (!usage.allowed) {
      await setDocumentStatus(documentId, user.id, "pending");
      if (usage.reason === "DAILY_LIMIT") return reply(request, { error: `Você atingiu o limite diário de ${usage.limit || (personalGeminiKey ? 25 : 2)} análises de arquivo concluídas. O edital está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return reply(request, { error: "Já existe um PDF sendo analisado. Este edital continuará aguardando na fila.", retryable: true, queued: true, code: "BUSY" }, 409);
      return reply(request, { error: "A proteção de consumo está temporariamente indisponível.", retryable: true }, 503);
    }
    const campaignName = String(payload?.campaign_name ?? campaigns[0]?.name ?? "").trim();
    const extractedEditalText = await loadBrowserExtractedEditalText(storagePath, payload);
    let bytes: Uint8Array | null = null;
    const ensurePdfBytes = async (): Promise<Uint8Array | Response> => {
      if (bytes) return bytes;
      const fileResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
      if (!fileResponse.ok) {
        await finishUsage(usage?.event_id, "error", "FILE_READ_FAILED");
        await setDocumentStatus(documentId, user.id, "error");
        return reply(request, { error: "Não foi possível abrir o PDF armazenado." }, 502);
      }
      const loaded = new Uint8Array(await fileResponse.arrayBuffer());
      if (loaded.byteLength > 50 * 1024 * 1024) {
        await finishUsage(usage?.event_id, "error", "FILE_TOO_LARGE");
        await setDocumentStatus(documentId, user.id, "error");
        return reply(request, { error: "O edital deve ter no máximo 50 MB para análise." }, 413);
      }
      bytes = loaded;
      return bytes;
    };

    const promptText = `Você é um analista de editais de concursos públicos brasileiros. Analise exclusivamente o PDF anexado e extraia o conteúdo programático que realmente gera matérias de estudo e missões.

Portal do estudante: ${campaignName || "não informado"}
Nome do arquivo: ${title}

REGRAS OBRIGATÓRIAS:
1. Localize primeiro as seções intituladas Conteúdo Programático, Conhecimentos Gerais, Conhecimentos Específicos, Objetos de Avaliação ou equivalentes.
2. Se o PDF possuir vários cargos, use somente o cargo que corresponda ao nome do portal ou do arquivo. Se não for possível identificar com segurança, registre um aviso em meta.warnings; não misture silenciosamente cargos diferentes.
3. subject deve ser o nome da disciplina conforme o edital, apenas corrigindo espaços, caixa e erros óbvios de OCR.
4. unit representa bloco, unidade ou seção intermediária quando existir. Não invente unidade.
5. topic deve ser um item de estudo atômico e fiel. Separe enumerações apenas quando o próprio edital apresentar conteúdos distintos; preserve artigos, leis, decretos, intervalos e qualificadores.
6. Não transforme título de disciplina em tópico e não crie subassuntos ausentes.
7. Ignore inscrições, vagas, cotas, salários, datas, etapas, TAF, exames médicos, recursos, documentação e demais regras administrativas, salvo quando fizerem parte expressa de uma disciplina cobrada.
8. Preserve em edital_order a ordem original, mas organize learning_order como um professor planejando um currículo: fundamentos e pré-requisitos antes de aplicações e conteúdos avançados. Dentro de cada disciplina, cada etapa deve preparar a próxima.
9. Não use conhecimento externo e não complete texto truncado por suposição.
10. subject_order define a rotação das disciplinas; learning_order começa em 0 dentro de cada disciplina; difficulty é basic, intermediate ou advanced; prerequisite_topic deve conter o título exato de outro tópico retornado na mesma disciplina, ou string vazia; pedagogical_reason explica brevemente por que aquela posição facilita a aprendizagem.
11. Antes de extrair, classifique document_kind como edital_oficial, edital_verticalizado, material_estudo ou outro.
12. edital_oficial é o documento normativo de abertura do concurso. edital_verticalizado é uma organização fiel do conteúdo programático de um edital, normalmente separada por disciplinas, tópicos ou itens de acompanhamento. AMBOS SÃO FONTES VÁLIDAS para criar o mapa e as missões. Não rejeite um PDF apenas por ser verticalizado ou por não conter inscrições, vagas e regras administrativas.
13. Somente classifique como material_estudo quando o documento for apostila, aula, livro, resumo explicativo ou lei isolada, sem funcionar como lista do conteúdo programático do concurso.
14. Em meta, informe detected_scope, confidence de 0 a 1 e warnings objetivos. Se for verticalizado, avise que ele é uma fonte derivada e deve ser conferido com o edital oficial, mas extraia todos os tópicos normalmente.

Retorne somente o JSON solicitado no formato {"meta":{"document_kind":"edital_oficial","classification_reason":"...","detected_scope":"...","confidence":0.95,"warnings":[]},"topics":[{"subject":"...","unit":"...","topic":"...","subject_order":0,"learning_order":0,"difficulty":"basic","prerequisite_topic":"","pedagogical_reason":"..."}]}.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        meta: { type: "OBJECT", properties: { document_kind: { type: "STRING", enum: ["edital_oficial", "edital_verticalizado", "material_estudo", "outro"] }, classification_reason: { type: "STRING" }, detected_scope: { type: "STRING" }, confidence: { type: "NUMBER" }, warnings: { type: "ARRAY", items: { type: "STRING" } } }, required: ["document_kind", "classification_reason", "detected_scope", "confidence", "warnings"] },
        topics: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, unit: { type: "STRING" }, topic: { type: "STRING" }, subject_order: { type: "INTEGER" }, learning_order: { type: "INTEGER" }, difficulty: { type: "STRING", enum: ["basic", "intermediate", "advanced"] }, prerequisite_topic: { type: "STRING" }, pedagogical_reason: { type: "STRING" } }, required: ["subject", "topic", "subject_order", "learning_order", "difficulty", "prerequisite_topic", "pedagogical_reason"] } },
      },
      required: ["meta", "topics"],
    };

    const keysToTry: Array<{ key: string; source: "personal" | "shared" }> = [];
    if (personalGeminiKey) keysToTry.push({ key: personalGeminiKey, source: "personal" });
    if (GEMINI_API_KEY && GEMINI_API_KEY !== personalGeminiKey) keysToTry.push({ key: GEMINI_API_KEY, source: "shared" });

    let parsed: any = null;
    let lastStatus = 502;
    let lastErrorMessage = "O Gemini não conseguiu analisar o edital.";

    keyLoop: for (const candidateKey of keysToTry) {
      geminiFileKey = candidateKey.key;
      usedKeySource = candidateKey.source;
      const models = await availableGeminiModels(candidateKey.key);

      // 1ª Tentativa rápida: se o navegador já extraiu a camada de texto do edital, analisa direto via texto com timeout seguro
      if (extractedEditalText) {
        const textBody = {
          contents: [{ parts: [{ text: `${promptText}\n\nTEXTO EXTRAÍDO DO EDITAL:\n${extractedEditalText}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 65536, responseMimeType: "application/json", responseSchema },
        };
        const textRelaxed = {
          contents: textBody.contents,
          generationConfig: { temperature: 0.1, maxOutputTokens: 65536, responseMimeType: "application/json" },
        };
        for (let mIdx = 0; mIdx < Math.min(2, models.length); mIdx++) {
          const candidateModel = models[mIdx];
          selectedModel = candidateModel;
          for (const body of [textBody, textRelaxed]) {
            const resp = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": candidateKey.key },
              body: JSON.stringify(body),
            }, 32000);
            if (resp && resp.ok) {
              try {
                const candidateParsed = parseGeminiJsonText(await resp.json().catch(() => ({})));
                if (candidateParsed && Array.isArray(candidateParsed.topics) && candidateParsed.topics.length >= 1) {
                  parsed = candidateParsed;
                  break keyLoop;
                }
              } catch { /* tenta próximo */ }
            } else if (resp) {
              lastStatus = resp.status;
            }
          }
        }
      }

      // 2ª Tentativa: leitura multimodal nativa do PDF no Gemini (baixa o PDF somente agora se necessário)
      const loadedOrReply = await ensurePdfBytes();
      if (loadedOrReply instanceof Response) return loadedOrReply;
      const pdfBytes = loadedOrReply;

      let documentPart: any = null;
      try {
        if (pdfBytes.byteLength <= 12 * 1024 * 1024) {
          documentPart = pdfInlinePart(pdfBytes);
        } else {
          const geminiFile = await uploadPdfToGemini(pdfBytes, title, candidateKey.key);
          geminiFileName = geminiFile.name;
          documentPart = { file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } };
        }
      } catch (uploadErr) {
        if (pdfBytes.byteLength <= 18 * 1024 * 1024) {
          documentPart = pdfInlinePart(pdfBytes);
        } else {
          lastErrorMessage = String((uploadErr as Error)?.message ?? uploadErr);
          continue;
        }
      }

      const baseRequestBody = {
        contents: [{ parts: [documentPart, { text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema,
        },
      };
      const relaxedBody = {
        contents: baseRequestBody.contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      };

      for (let mIdx = 0; mIdx < models.length; mIdx++) {
        const candidateModel = models[mIdx];
        selectedModel = candidateModel;
        const bodies = [baseRequestBody, relaxedBody];
        for (let attempt = 0; attempt < bodies.length; attempt++) {
          const geminiResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": candidateKey.key },
            body: JSON.stringify(bodies[attempt]),
          }, 36000);
          if (!geminiResponse) {
            lastStatus = 504;
            lastErrorMessage = "Tempo limite excedido no modelo visual; tentando alternativa.";
            break;
          }
          const geminiData = await geminiResponse.json().catch(() => ({}));
          if (geminiResponse.ok) {
            try {
              parsed = parseGeminiJsonText(geminiData);
              if (parsed && (Array.isArray(parsed.topics) || parsed.meta)) {
                await removeGeminiFile(geminiFileName, candidateKey.key);
                geminiFileName = undefined;
                break keyLoop;
              }
            } catch (parseErr) {
              console.warn("edital-gemini JSON parse warning", candidateModel, attempt + 1, String((parseErr as Error)?.message ?? parseErr));
              lastStatus = 502;
              lastErrorMessage = "O modelo devolveu uma resposta incompleta ao analisar o edital.";
              continue;
            }
          }
          lastStatus = geminiResponse.status;
          lastErrorMessage = geminiData?.error?.message ?? `O Gemini não conseguiu analisar o edital (${geminiResponse.status}).`;
          console.warn("Gemini edital attempt", candidateKey.source, candidateModel, attempt + 1, geminiResponse.status, lastErrorMessage);
          if (geminiResponse.status === 400 && attempt === 0) continue;
          // Em caso de 429 (cota por modelo) ou 503, aguarda brevemente e tenta o próximo modelo habilitado na mesma chave.
          if (geminiResponse.status === 429 || geminiResponse.status === 503 || FALLBACK_STATUS.has(geminiResponse.status)) {
            if (mIdx + 1 < models.length) await wait(1200);
            break;
          }
          break;
        }
      }
      await removeGeminiFile(geminiFileName, candidateKey.key);
      geminiFileName = undefined;
    }

    if (!parsed && extractedEditalText) {
      const fallbackProviders = [
        { name: "deepseek", key: DEEPSEEK_API_KEY, url: "https://api.deepseek.com/chat/completions", model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat" },
        { name: "groq", key: GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b" },
      ].filter((p) => Boolean(p.key));
      for (const prov of fallbackProviders) {
        const resp = await fetchWithTimeout(prov.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${prov.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: prov.model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: 'Você é um analista de editais de concursos. Responda apenas com JSON válido no formato {"meta":{"document_kind":"edital_oficial","classification_reason":"Extraído do texto","detected_scope":"Edital","confidence":0.9,"warnings":[]},"topics":[{"subject":"...","unit":"","topic":"...","subject_order":0,"learning_order":0,"difficulty":"basic","prerequisite_topic":"","pedagogical_reason":""}]}.' },
              { role: "user", content: `${promptText}\n\nTEXTO EXTRAÍDO DO EDITAL:\n${extractedEditalText.slice(0, 75000)}` },
            ],
          }),
        }, 32000);
        if (resp && resp.ok) {
          try {
            const d = await resp.json().catch(() => ({}));
            const rawContent = String(d?.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            const candidate = JSON.parse(rawContent);
            if (Array.isArray(candidate?.topics) && candidate.topics.length >= 1) {
              parsed = candidate;
              selectedModel = prov.model;
              break;
            }
          } catch { /* tenta próximo */ }
        }
      }
    }

    if (!parsed) {
      const retryable = RETRYABLE_STATUS.has(lastStatus);
      const code = lastStatus === 429 ? "PROVIDER_429" : retryable ? "PROVIDER_UNAVAILABLE" : "AI_ERROR";
      await finishUsage(usage.event_id, "error", code, selectedModel);
      await setDocumentStatus(documentId, user.id, retryable ? "pending" : "error");
      const error = lastStatus === 429
        ? "A cota da sua chave Gemini foi atingida (erro 429). O edital permanece salvo e esta tentativa não foi contabilizada."
        : retryable
          ? "O Gemini está temporariamente indisponível. O edital permanece salvo na fila; tente novamente em alguns minutos."
          : lastErrorMessage;
      return reply(request, { error, retryable, code, provider_status: lastStatus, model: selectedModel, key_source: usedKeySource }, lastStatus === 429 ? 429 : 502);
    }

    const rawKind = String(parsed?.meta?.document_kind ?? "").toLowerCase().trim();
    const hasExtractedTopics = Array.isArray(parsed?.topics) && parsed.topics.length >= 1;
    const normalizedKind = ["edital_oficial", "edital_verticalizado", "edital_concurso"].includes(rawKind)
      ? rawKind
      : (hasExtractedTopics && rawKind !== "material_estudo" ? "edital_oficial" : (rawKind || "outro"));
    const meta = {
      document_kind: normalizedKind,
      classification_reason: String(parsed?.meta?.classification_reason ?? "Conteúdo programático identificado.").trim(),
      detected_scope: String(parsed?.meta?.detected_scope ?? campaignName ?? title).trim(),
      confidence: Math.max(0, Math.min(1, Number(parsed?.meta?.confidence ?? (hasExtractedTopics ? 0.88 : 0)))),
      warnings: Array.isArray(parsed?.meta?.warnings) ? parsed.meta.warnings.map((warning: unknown) => String(warning).trim()).filter(Boolean).slice(0, 10) : [],
    };
    const validEditalKinds = new Set(["edital_oficial", "edital_verticalizado", "edital_concurso"]);
    if (!validEditalKinds.has(meta.document_kind)) {
      await finishUsage(usage.event_id, "error", "NOT_AN_EDITAL", selectedModel);
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: `Este PDF não parece ser um edital oficial nem um edital verticalizado. ${meta.classification_reason} Exclua-o desta categoria e envie novamente como Material de estudo, Lei ou norma, Prova ou Simulado.`, code: "NOT_AN_EDITAL" }, 422);
    }
    if (meta.document_kind === "edital_verticalizado" && !meta.warnings.some((warning: string) => /verticalizado/i.test(warning))) meta.warnings.unshift("Edital verticalizado aceito como base do mapa. Confira os tópicos com o edital oficial quando ele estiver disponível.");
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 1500) : [];
    const uniqueTopics: Array<{ subject: string; unit: string; topic: string; edital_order: number; subject_order: number; learning_order: number; difficulty: string; prerequisite_topic: string; pedagogical_reason: string }> = [];
    const seenTopics = new Set<string>();
    const normalizeKey = (value: unknown) => String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("pt-BR");
    const normalizeSearch = (value: unknown) => normalizeKey(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const administrativeOnly = /^(inscri(c|ç)(a|ã)o|cronograma|remunera(c|ç)(a|ã)o|vagas?|isen(c|ç)(a|ã)o|taxa de inscri(c|ç)(a|ã)o|resultado|recursos?|exame m[eé]dico|teste de aptid(a|ã)o f[ií]sica|investiga(c|ç)(a|ã)o social|documentos?|matr[ií]cula|curso de forma(c|ç)(a|ã)o)$/i;

    for (const [originalIndex, item] of topics.entries()) {
      const subject = String(item?.subject ?? "Edital").replace(/\s+/g, " ").trim() || "Edital";
      const unit = String(item?.unit ?? "").replace(/\s+/g, " ").trim();
      const topic = String(item?.topic ?? "").replace(/\s+/g, " ").trim();
      if (!topic || topic.length < 3 || topic.length > 600) continue;
      if (normalizeSearch(subject) === normalizeSearch(topic)) continue;
      if (administrativeOnly.test(normalizeSearch(topic))) continue;

      const key = `${normalizeKey(subject)}\u0000${normalizeKey(topic)}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
      const difficulty = ["basic", "intermediate", "advanced"].includes(String(item?.difficulty)) ? String(item.difficulty) : "basic";
      uniqueTopics.push({ subject, unit, topic, edital_order: originalIndex, subject_order: Math.max(0, Number(item?.subject_order)||0), learning_order: Math.max(0, Number(item?.learning_order)||0), difficulty, prerequisite_topic: String(item?.prerequisite_topic??"").trim(), pedagogical_reason: String(item?.pedagogical_reason??"").trim().slice(0,500) });
    }
    if (uniqueTopics.length < 1) {
      await finishUsage(usage.event_id, "error", "INSUFFICIENT_TOPICS", selectedModel);
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: "A análise não encontrou conteúdo programático suficiente com segurança. Confira se o PDF contém as disciplinas e se o nome do portal corresponde ao cargo." }, 422);
    }
    if (meta.confidence < 0.65) meta.warnings.unshift("A IA indicou baixa confiança na identificação do cargo ou do conteúdo programático. Revise o mapa antes de iniciar as missões.");

    const cleared = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!cleared.ok) {
      console.error("campaign_topics delete", cleared.status, await cleared.text());
      await finishUsage(usage.event_id, "error", "MAP_CLEAR_FAILED", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: "Não foi possível preparar o mapa anterior para a nova análise.", retryable: true }, 502);
    }
    const rows = uniqueTopics.map((item) => ({ campaign_id: campaignId, user_id: user.id, subject: item.subject, unit_name: item.unit, topic: item.topic, edital_order: item.edital_order, subject_order: item.subject_order, learning_order: item.learning_order, difficulty: item.difficulty, prerequisite_topic: item.prerequisite_topic || null, pedagogical_reason: item.pedagogical_reason || null }));
    const inserted = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics`, { method: "POST", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" }, body: JSON.stringify(rows) });
    if (!inserted.ok) {
      const detail = await inserted.text();
      console.error("campaign_topics insert", inserted.status, detail);
      await finishUsage(usage.event_id, "error", "TOPICS_SAVE_FAILED", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: `O edital foi analisado, mas os tópicos não puderam ser salvos (${inserted.status}).`, detail, retryable: true }, 502);
    }
    const savedTopics = await inserted.json();
    if (!Array.isArray(savedTopics) || savedTopics.length === 0) {
      await finishUsage(usage.event_id, "error", "TOPICS_EMPTY", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: "O edital foi analisado, mas nenhum tópico foi confirmado no banco.", retryable: true }, 502);
    }
    await setDocumentStatus(documentId, user.id, "ready");
    await finishUsage(usage.event_id, "success", undefined, selectedModel);
    return reply(request, { topics: uniqueTopics, saved: savedTopics.length, provider: "gemini", model: selectedModel, key_source: usedKeySource, meta });
  } catch (error) {
    console.error("edital-gemini", error);
    await finishUsage(usage?.event_id, "error", "PROCESSING_FAILED", selectedModel);
    if (documentId) await setDocumentStatus(documentId, user.id, "error");
    return reply(request, { error: String((error as Error)?.message || "Falha interna ao interpretar o edital.") }, 500);
  } finally {
    await removeGeminiFile(geminiFileName, geminiFileKey);
  }
});
