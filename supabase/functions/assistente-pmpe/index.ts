// ARQUIVO AUTOCONTIDO PARA COLAR NO EDITOR DO SUPABASE: assistente-pmpe
// Gerado por: node scripts/build-supabase-dashboard.mjs
// Fonte: supabase/functions/assistente-pmpe/index.ts
// SHA-256 da fonte: ec2580cf1a4b9ac231c36058526ee3a4f17ee1bba8396b69431008d04333c66e
// Atualize a fonte e regenere; não exclua os validadores incorporados.

// Dependência incorporada: ../_shared/solved-keys.mjs (SHA-256 9648f444db9058b826236cfb6c82d6313565ab28e8ca97c32d195bc3567b2cbd)
const { validatedSuggestedKeys } = (() => {
function validatedSuggestedKeys(originals, generated) {
  if (!Array.isArray(originals) || !Array.isArray(generated)) return [];
  const normalize = text => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return originals.flatMap((original, index) => {
    const matches = generated.filter(item => normalize(item?.statement) === normalize(original?.statement));
    if (matches.length !== 1 || !normalize(original?.statement)) return [];
    const match = matches[0], options = original.options;
    if (!Array.isArray(options) || !Array.isArray(match.options) || options.length !== match.options.length ||
        options.some((text, i) => normalize(text) !== normalize(match.options[i]))) return [];
    const raw = match.correct_index;
    if (options.length < 2 || options.length > 5 || options.some(text => !normalize(text)) || new Set(options.map(normalize)).size !== options.length ||
        raw === null || raw === undefined || typeof raw === 'boolean' || typeof raw === 'object' || String(raw).trim() === '' || !Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) >= options.length || !normalize(match.explanation)) return [];
    return [{index: original.index ?? index, correct_index:Number(raw), explanation:'🤖 [Gabarito sugerido pela IA — confira no gabarito oficial quando disponível] '+normalize(match.explanation),key_source:'ia_sugerido',origin:'adaptada_do_pdf'}];
  });
}
return { validatedSuggestedKeys };
})();
// Dependência incorporada: ../_shared/question-integrity.mjs (SHA-256 67f45373841d01dd15769476a7b280adf2d2cd740f2348a6ee1f51a922b10662)
const { normalizeSharedQuestion } = (() => {
// Public question projection: never repairs a missing key by guessing A.
function normalizeSharedQuestion(value, defaults = {}) {
  if (!value || typeof value !== 'object' || !String(value.statement ?? '').trim()) return null;
  if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 5) return null;
  const options = value.options.map(option => String(option ?? '').trim());
  if (options.some(option => !option) || new Set(options.map(option => option.toLocaleLowerCase('pt-BR'))).size !== options.length) return null;
  const raw = value.correct_index;
  const valid = raw !== null && raw !== undefined && typeof raw !== 'boolean' && typeof raw !== 'object' &&
    String(raw).trim() !== '' && Number.isInteger(Number(raw)) && Number(raw) >= 0 && Number(raw) < options.length && !value.answer_unknown;
  return {
    subject: String(value.subject || defaults.subject || 'Conteúdo Geral'),
    topic: String(value.topic || defaults.topic || 'Assunto não informado'),
    board: String(value.board || defaults.board || 'Banca não informada'),
    difficulty: ['facil', 'medio', 'dificil'].includes(value.difficulty) ? value.difficulty : 'medio',
    origin: String(value.origin || defaults.origin || 'importada'),
    statement: String(value.statement).trim(),
    options,
    correct_index: valid ? Number(raw) : -1,
    explanation: String(value.explanation || ''),
    ...(value.source || defaults.source ? {source: String(value.source || defaults.source)} : {}),
    ...(value.exam_title ? {exam_title: String(value.exam_title)} : {}),
    ...(value.exam_year !== null && value.exam_year !== undefined && String(value.exam_year).trim() !== '' && Number.isInteger(Number(value.exam_year)) ? {exam_year: Number(value.exam_year)} : {}),
    ...(value.key_reference ? {key_reference: String(value.key_reference)} : {}),
    ...(valid ? {} : {answer_unknown: true}),
    ...(value.key_source ? {key_source: String(value.key_source)} : {}),
    ...(value.answer_key_validation ? {answer_key_validation: String(value.answer_key_validation)} : {}),
    ...(value.annulled || value.anulada ? {annulled: true} : {}),
  };
}
return { normalizeSharedQuestion };
})();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jybislbbblyjsrcdegjt.supabase.co";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const GROQ_MODEL = "openai/gpt-oss-20b";
const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const ALLOWED_ORIGINS = new Set([
  "https://jornada.wcaio.workers.dev",
  "http://localhost:4173",
  "http://localhost:3000",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://jornada.wcaio.workers.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

async function authenticatedUser(authorization: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "Authorization": authorization,
      "apikey": PUBLISHABLE_KEY,
    },
  });
  return response.ok ? await response.json() : null;
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
  if (!SERVICE_ROLE_KEY) return "";
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }),
  }).catch(() => null);
  if (!result?.ok) return "";
  return extractSecretString(await result.json().catch(() => ""));
}

async function reserveUsage(userId: string, campaignId?: string) {
  if (!SERVICE_ROLE_KEY) return { allowed: false, reason: "SERVER_CONFIGURATION" };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId || null, p_operation: "assistant", p_daily_limit: 40 }),
  }).catch(() => null);
  return response?.ok ? await response.json().catch(() => ({ allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" })) : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
}

async function finishUsage(eventId: number | undefined, status: "success" | "error", provider?: string, model?: string, errorCode?: string) {
  if (!eventId || !SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ status, provider: provider || null, model: model || null, error_code: errorCode || null }),
  }).catch(() => undefined);
}

const geminiModelsCache = new Map<string, Promise<string[]>>();
async function availableGeminiModels(geminiKey = GEMINI_API_KEY): Promise<string[]> {
  if (!geminiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  if (geminiModelsCache.has(geminiKey)) return geminiModelsCache.get(geminiKey)!;
  const discovery = (async () => {
    const configured = String(Deno.env.get("GEMINI_MODEL") ?? "").replace(/^models\//, "").trim();
    const modelsResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } }).catch(() => null);
    const modelsData = modelsResponse ? await modelsResponse.json().catch(() => ({})) : {};
    const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use|gemma|learnlm|aqa)/i;
    const enabled = Array.isArray(modelsData?.models)
      ? modelsData.models
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
    const list = [...new Set([
      configured && enabled.includes(configured) ? configured : "",
      ...FALLBACK_MODELS.filter((m) => !enabled.length || enabled.includes(m)),
      ...enabled,
      ...FALLBACK_MODELS,
    ].filter(Boolean))].slice(0, 5);
    if (!list.length) throw new Error("GEMINI_NO_MODELS");
    return list;
  })();
  geminiModelsCache.set(geminiKey, discovery);
  return discovery;
}

async function discoverGeminiModel(geminiKey = GEMINI_API_KEY) {
  const models = await availableGeminiModels(geminiKey);
  return models[0];
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

function parseGenericJson(rawText: string) {
  const unfenced = String(rawText ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("INVALID_JSON");
  }
}

function questionHash(statement: string): string {
  const norm = String(statement || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `q-${(h >>> 0).toString(36)}`;
}

async function askGroq(systemPrompt: string, userPrompt: string) {
  if (!GROQ_API_KEY) throw new Error("GROQ_NOT_CONFIGURED");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.25,
      max_completion_tokens: 3000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GROQ_${response.status}:${data?.error?.message ?? "falha"}`);
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("GROQ_EMPTY");
  return { answer, model: GROQ_MODEL, provider: "groq" };
}

async function askDeepSeek(systemPrompt: string, userPrompt: string) {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_NOT_CONFIGURED");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.25,
      max_tokens: 3000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`DEEPSEEK_${response.status}:${data?.error?.message ?? "falha"}`);
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("DEEPSEEK_EMPTY");
  return { answer, model: DEEPSEEK_MODEL, provider: "deepseek" };
}

async function askGemini(systemPrompt: string, userPrompt: string, geminiKey = GEMINI_API_KEY, enableWebSearch = true) {
  if (!geminiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  const models = await availableGeminiModels(geminiKey);
  let lastError = "GEMINI_FAILED";
  for (const model of models) {
    const configs = enableWebSearch
      ? [
          { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } },
          { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 4096 } },
        ]
      : [
          { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 4096 } },
        ];
    for (const bodyObj of configs) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify(bodyObj),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = `GEMINI_${response.status}:${data?.error?.message ?? "falha"}`;
        if (response.status === 400 && (bodyObj as any).tools) continue;
        if (response.status === 429 || response.status === 503 || response.status === 404 || response.status === 400) break;
        throw new Error(lastError);
      }
      const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
        ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
        : [];
      let answer = (parts.length ? parts : data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text ?? "").join("").trim();
      const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (answer && Array.isArray(chunks) && chunks.length) {
        const webSources = chunks
          .map((c: any) => c?.web?.title && c?.web?.uri ? `- ${c.web.title} (${c.web.uri})` : null)
          .filter(Boolean)
          .slice(0, 4);
        if (webSources.length && !answer.includes("Fontes consultadas")) {
          answer += `\n\n---\n**🌐 Fontes de Pesquisa da Banca consultadas em tempo real:**\n${webSources.join("\n")}`;
        }
      }
      if (answer) return { answer, model, provider: "gemini" };
    }
  }
  throw new Error(lastError);
}

async function askStructuredQuestions(prompt: string, geminiKey = GEMINI_API_KEY, personalFirst = false) {
  const schema = {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        minItems: 1,
        maxItems: 15,
        items: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING" },
            topic: { type: "STRING" },
            board: { type: "STRING" },
            difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] },
            origin: { type: "STRING" },
            statement: { type: "STRING" },
            options: { type: "ARRAY", minItems: 2, maxItems: 5, items: { type: "STRING" } },
            correct_index: { type: "INTEGER", minimum: 0, maximum: 4 },
            explanation: { type: "STRING" },
          },
          required: ["subject", "topic", "difficulty", "statement", "options", "correct_index", "explanation"],
        },
      },
    },
    required: ["questions"],
  };

  const tryGemini = async (key: string) => {
    const models = await availableGeminiModels(key);
    let lastErr = "GEMINI_STRUCTURED_FAILED";
    for (const model of models) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = `GEMINI_${res.status}:${data?.error?.message ?? "falha"}`;
        if (res.status === 429 || res.status === 503 || res.status === 404 || res.status === 400) continue;
        throw new Error(lastErr);
      }
      const parsed = parseGeminiJsonText(data);
      if (Array.isArray(parsed?.questions) && parsed.questions.length) {
        return { questions: parsed.questions, provider: "gemini", model };
      }
    }
    throw new Error(lastErr);
  };

  if (personalFirst && geminiKey) {
    try {
      return await tryGemini(geminiKey);
    } catch (e) {
      console.warn("Personal Gemini structured questions fallback", e);
    }
  }
  if (GEMINI_API_KEY) {
    try {
      return await tryGemini(GEMINI_API_KEY);
    } catch (e) {
      console.warn("Server Gemini structured questions fallback", e);
    }
  }
  const sysJson = "Você é um elaborador e professor especialista em concursos públicos. Responda EXCLUSIVAMENTE com um objeto JSON válido no formato {\"questions\":[...]} sem markdown.";
  if (DEEPSEEK_API_KEY) {
    try {
      const ds = await askDeepSeek(sysJson, prompt);
      const parsed = parseGenericJson(ds.answer);
      if (Array.isArray(parsed?.questions) && parsed.questions.length) return { questions: parsed.questions, provider: "deepseek", model: ds.model };
    } catch (e) {
      console.warn("DeepSeek structured fallback failed", e);
    }
  }
  if (GROQ_API_KEY) {
    const gr = await askGroq(sysJson, prompt);
    const parsed = parseGenericJson(gr.answer);
    if (Array.isArray(parsed?.questions) && parsed.questions.length) return { questions: parsed.questions, provider: "groq", model: gr.model };
  }
  throw new Error("ALL_STRUCTURED_PROVIDERS_FAILED");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { error: "Método não permitido." }, 405);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(request, { error: "Entre na sua conta para usar o assistente." }, 401);
  }
  let user;
  try {
    user = await authenticatedUser(authorization);
  } catch {
    return json(request, { error: "Não foi possível validar sua sessão. Tente novamente.", code: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!user?.id) {
    return json(request, { error: "Sessão inválida ou expirada." }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Solicitação inválida." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(request, { error: "Solicitação inválida." }, 400);
  }

  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_API_KEY || "";

  if (payload.action === "shared_question_bank") {
    if (!SERVICE_ROLE_KEY) return json(request, { error: "Configuração do servidor incompleta." }, 503);
    const seen = new Map<string, any>();

    const sharedRes = await fetch(`${SUPABASE_URL}/rest/v1/shared_question_bank?select=*&order=created_at.desc&limit=300`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    }).catch(() => null);
    if (sharedRes?.ok) {
      const rows = await sharedRes.json().catch(() => []);
      if (Array.isArray(rows)) for (const row of rows) {
        const question = normalizeSharedQuestion(row);
        if (question) seen.set(row.fingerprint || questionHash(question.statement), question);
      }
    }

    // Use the same authenticated projection as the community library. Reading
    // generated_study_content with service_role would bypass private documents
    // and the existing watermark sanitizer, regardless of the sharing controls.
    const communityRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_community_exam_library`, {
      method: "POST",
      headers: { Authorization: authorization, apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_exam_name: "", p_exam_org: "" }),
    }).catch(() => null);
    if (communityRes?.ok) {
      const community = await communityRes.json().catch(() => null);
      const rows = Array.isArray(community?.summaries) ? community.summaries : [];
      for (const row of rows) {
        const source = String(row?.content?.source || "");
        const isExamSource = /prova|simulado|oficial|aocp|cebraspe|fgv|concurso/i.test(source);
        const questions = Array.isArray(row?.content?.questions) ? row.content.questions : [];
        for (const item of questions) {
          if (!/oficial|adaptada_do_pdf|importad|prova/.test(String(item?.origin || "").toLowerCase()) && !isExamSource) continue;
          const question = normalizeSharedQuestion(item, {subject: row?.content?.subject, topic: row?.title, source});
          if (!question) continue;
          const fingerprint = questionHash(question.statement);
          if (!seen.has(fingerprint)) seen.set(fingerprint, question);
        }
      }
    }

    if (!sharedRes?.ok && !communityRes?.ok) return json(request, {error: "O banco compartilhado está temporariamente indisponível. Tente novamente.",code:"SHARED_BANK_UNAVAILABLE"}, 503);
    const questions = [...seen.values()];
    return json(request, { questions, count: questions.length });
  }

  if (payload.action === "generate_pedagogical_flashcards") {
    if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) {
      return json(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);
    }
    const campaignId = String(payload.campaign_id ?? "").trim();
    const subject = String(payload.subject ?? "Conteúdo Geral").trim().slice(0, 120);
    const topic = String(payload.topic ?? "Tópicos de Alta Incidência").trim().slice(0, 180);
    const board = String(payload.board ?? "Instituto AOCP / Cebraspe / FGV").trim().slice(0, 80);
    const count = Math.min(12, Math.max(4, Number(payload.count) || 8));
    const context = String(payload.context ?? "").trim().slice(0, 16000);

    const usage = await reserveUsage(user.id, campaignId || undefined);
    if (!usage.allowed) {
      if (usage.reason === "DAILY_LIMIT") return json(request, { error: `Limite diário atingido (${usage.limit || 40}).`, code: "DAILY_LIMIT" }, 429);
      return json(request, { error: "Proteção de consumo temporariamente indisponível.", code: usage.reason }, 503);
    }

    const fcPrompt = `Atue como um PROFESSOR COORDENADOR ESPECIALISTA EM CONCURSOS PÚBLICOS (${board}) e especialista no método científico de repetição espaçada (Anki / Active Recall).
Gere exatamente ${count} FLASHCARDS DE MEMORIZAÇÃO ATIVA E ALTA INCIDÊNCIA para a disciplina "${subject}" (Foco: ${topic}).
${context ? `CONTEXTO E TÓPICOS DO EDITAL/MATERIAL:\n${context}\n` : ""}
REGRAS PEDAGÓGICAS OBRIGATÓRIAS DOS FLASHCARDS:
1. Cada flashcard deve testar 1 único conceito-chave, regra gramatical, prazo, artigo de lei, competência, requisito, exceção ou fórmula de altíssima incidência nas provas da banca ${board}.
2. question (Frente do cartão): Pergunta conceitual direta, curta, clara e 100% autossuficiente (ex.: "Qual a diferença entre adjunto adnominal e complemento nominal?", "Em quais casos a crase é obrigatória?", "Quais são os crimes inafiançáveis e imprescritíveis segundo o Art. 5º da CF?").
3. answer (Verso do cartão): Resposta direta, enxuta e estruturada para memorização rápida em até 3 frases curtas (inclua o bizu ou mnemônico real apenas se já existir na doutrina/material; nunca invente mnemônicos forçados).
4. PROIBIDO criar perguntas sobre páginas, blocos, estrutura de PDF, ou perguntas que dependam de texto externo ("segundo o texto") ou alternativas A/B/C/D.
Responda EXCLUSIVAMENTE com um JSON válido no formato:
{"flashcards":[{"subject":"${subject}","topic":"Assunto específico","question":"Pergunta direta da frente?","answer":"Resposta objetiva do verso."}]}`;

    try {
      const sysJson = "Você é um Professor Coordenador especialista em Flashcards estilo Anki para concursos públicos. Responda EXCLUSIVAMENTE com JSON puro no formato {\"flashcards\":[...]}.";
      let rawAns = "";
      let provider = "gemini";
      let model = "gemini";
      if (activeGeminiKey) {
        try {
          const gRes = await askGemini(sysJson, fcPrompt, activeGeminiKey, false);
          rawAns = gRes.answer;
          provider = "gemini";
          model = gRes.model;
        } catch (e) {
          console.warn("Gemini flashcards fallback", e);
        }
      }
      if (!rawAns && DEEPSEEK_API_KEY) {
        const dRes = await askDeepSeek(sysJson, fcPrompt);
        rawAns = dRes.answer;
        provider = "deepseek";
        model = dRes.model;
      }
      if (!rawAns && GROQ_API_KEY) {
        const grRes = await askGroq(sysJson, fcPrompt);
        rawAns = grRes.answer;
        provider = "groq";
        model = grRes.model;
      }
      const parsed = parseGenericJson(rawAns);
      const cards = (Array.isArray(parsed?.flashcards) ? parsed.flashcards : [])
        .filter((c: any) => c?.question && c?.answer && String(c.question).trim().length >= 10 && String(c.answer).trim().length >= 5)
        .map((c: any) => ({
          subject: String(c.subject || subject).trim(),
          topic: String(c.topic || topic).trim(),
          question: String(c.question).trim(),
          answer: String(c.answer).trim(),
        }));
      if (!cards.length) throw new Error("EMPTY_FLASHCARDS");
      await finishUsage(usage.event_id, "success", provider, model);
      return json(request, { flashcards: cards, provider, model });
    } catch (err) {
      await finishUsage(usage.event_id, "error", undefined, undefined, "FLASHCARDS_FAILED");
      return json(request, { error: "Não foi possível gerar os flashcards neste momento. Tente novamente." }, 502);
    }
  }


  if (payload.action === "solve_exam_questions_key") {
    if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) {
      return json(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);
    }
    const campaignId = String(payload.campaign_id ?? "").trim();
    const rawQuestions = Array.isArray(payload.questions) ? payload.questions.slice(0, 12) : [];
    if (!rawQuestions.length) {
      return json(request, { error: "Nenhuma questão enviada para resolução de gabarito." }, 400);
    }
    const usage = await reserveUsage(user.id, campaignId || undefined);
    if (!usage.allowed) {
      if (usage.reason === "DAILY_LIMIT") return json(request, { error: `Limite diário atingido (${usage.limit || 40}). A cota renova à meia-noite.`, code: "DAILY_LIMIT" }, 429);
      return json(request, { error: "Proteção de consumo temporariamente indisponível.", code: usage.reason }, 503);
    }
    const itemsText = rawQuestions.map((q: any, idx: number) => {
      const opts = Array.isArray(q?.options) ? q.options.map((o: any, oi: number) => `(${"ABCDE"[oi] || oi}) ${String(o ?? "").trim()}`).join(" | ") : "";
      return `Questão #${idx} [Disciplina: ${q?.subject || "Geral"}]: ${String(q?.statement ?? "").trim()}\nAlternativas: ${opts}`;
    }).join("\n\n");

    const solvePrompt = `Resolva com rigor técnico-jurídico, gramatical, lógico e histórico as ${rawQuestions.length} questões de prova abaixo que foram importadas sem gabarito oficial.
Para CADA questão (na mesma ordem, de #0 até #${rawQuestions.length - 1}), determine a única alternativa correta (correct_index: 0 para A/CERTO, 1 para B/ERRADO, 2 para C, 3 para D, 4 para E) e escreva uma explicação passo a passo honesta e didática.
Regras:
- Nunca chute cegamente a letra A (índice 0): analise todas as alternativas antes de decidir.
- Preserve o enunciado e as alternativas originais.
- Inicie explanation com "🤖 [Gabarito sugerido pela IA — confira no gabarito oficial quando disponível] " seguido do Conceito-chave e da justificativa da alternativa correta.

QUESTÕES PARA RESOLVER:
${itemsText}`;

    try {
      const generated = await askStructuredQuestions(solvePrompt, activeGeminiKey, Boolean(personalGeminiKey));
      const solved = validatedSuggestedKeys(rawQuestions, generated.questions);
      if (!solved.length) {
        await finishUsage(usage.event_id, "error", undefined, undefined, "NO_VALID_SUGGESTED_KEYS");
        return json(request, {error: "A IA não retornou gabaritos verificáveis para as questões enviadas. Elas continuam sem gabarito."}, 422);
      }
      await finishUsage(usage.event_id, "success", generated.provider, generated.model);
      return json(request, { solved, provider: generated.provider, model: generated.model, key_source: "ia_sugerido" });
    } catch (_err) {
      await finishUsage(usage.event_id, "error", undefined, undefined, "SOLVE_KEY_FAILED");
      return json(request, { error: "Não foi possível resolver o gabarito com a IA neste momento. Tente novamente." }, 502);
    }
  }

  if (payload.action === "generate_structured_questions") {
    if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) {
      return json(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);
    }
    const campaignId = String(payload.campaign_id ?? "").trim();
    const submode = String(payload.submode ?? "board_pack").trim();
    const subject = String(payload.subject ?? "Conteúdo Geral").trim().slice(0, 120);
    const topic = String(payload.topic ?? "Assunto do Edital").trim().slice(0, 180);
    const board = String(payload.board ?? "Instituto AOCP").trim().slice(0, 80);
    const difficulty = String(payload.difficulty ?? "medio").trim();
    const count = Math.min(10, Math.max(1, Number(payload.count) || 5));
    const context = String(payload.context ?? "").trim().slice(0, 18000);
    const rawText = String(payload.raw_text ?? "").trim().slice(0, 20000);
    const moldQuestion = payload.mold_question && typeof payload.mold_question === "object" ? payload.mold_question : null;

    const usage = await reserveUsage(user.id, campaignId || undefined);
    if (!usage.allowed) {
      if (usage.reason === "DAILY_LIMIT") return json(request, { error: `Limite diário atingido (${usage.limit || 40}). A cota renova à meia-noite.`, code: "DAILY_LIMIT" }, 429);
      return json(request, { error: "Proteção de consumo temporariamente indisponível.", code: usage.reason }, 503);
    }

    const hasExplicitGabaritoInRawText = /(?:gabarito|resposta(?:s)?\s*(?:oficial|correta)?|alternativa\s+correta|item\s+correto)\s*[:\-=–]?\s*(?:letra\s*)?(?:CERTO|ERRADO|[A-E])\b/i.test(rawText);
    const prompt = submode === "parse_raw"
      ? `Extraia e estruture as questões contidas no texto abaixo SEM INVENTAR GABARITO.
Disciplina padrão: ${subject}. Banca/Fonte: ${board}.
Regras obrigatórias:
- Preserve TODAS as alternativas originais da questão: se for Certo/Errado (2 opções), mantenha ["CERTO", "ERRADO"]; se tiver 4 alternativas (A-D), mantenha as 4; se tiver 5 alternativas (A-E), preserve integralmente as 5 alternativas (NUNCA apague a 5ª alternativa E).
- Só preencha correct_index (0 a 4) se o gabarito estiver EXPLICITAMENTE escrito no texto colado. Se a questão NÃO trouxer gabarito explícito no texto, devolva correct_index como -1 (nunca chute a letra A / índice 0).
- Marque origin como "importada". A presença de um gabarito no texto não comprova a origem oficial nem valida a associação de cada resposta.
- Escreva em explanation uma RESOLUÇÃO PASSO A PASSO didática contendo Conceito-chave, justificativa do gabarito e análise das alternativas.

TEXTO COLADO PELO ALUNO:
${rawText}`
      : submode === "twin" && moldQuestion
      ? `Crie ${count} questão(ões) GÊMEA(S) PEDAGÓGICA(S) inédita(s) baseada(s) na questão-molde abaixo, mantendo o padrão da banca ${board}.
Disciplina: ${moldQuestion.subject || subject}. Assunto: ${moldQuestion.topic || topic}. Dificuldade: ${moldQuestion.difficulty || difficulty}.
QUESTÃO-MOLDE ORIGINAL:
Enunciado: ${moldQuestion.statement}
Alternativas: ${JSON.stringify(moldQuestion.options)}
Gabarito da molde: ${moldQuestion.options?.[Number(moldQuestion.correct_index) || 0] || ""}
Explicação base: ${moldQuestion.explanation || ""}
${payload.student_error_context ? `DIAGNÓSTICO DO ALUNO NA QUESTÃO-MOLDE: ${String(payload.student_error_context).slice(0, 600)}` : ""}

DIRETRIZ PEDAGÓGICA DA QUESTÃO GÊMEA (ENGENHARIA DE FIXAÇÃO E TRANSFERÊNCIA):
1. NÃO copie o mesmo texto: mude o caso concreto, os personagens ou inverta o ângulo de cobrança (ex.: se a molde cobrou a regra geral, cobre um caso prático de aplicação ou a exceção legal; se o aluno errou confundindo uma alternativa distratora, crie um cenário que force o aluno a diferenciar exatamente o gabarito daquele distrator).
2. Elabore 4 alternativas plausíveis (A, B, C, D) de extensão semelhante, com apenas 1 correta (correct_index de 0 a 3, variando a letra correta em relação à molde).
3. Marque origin como "autoral".
4. No campo explanation, escreva uma RESOLUÇÃO PASSO A PASSO cirúrgica (estilo boaResposta):
  "Conceito-chave: [regra ou artigo exato cobrado e conexão com a questão anterior]\n✅ Alternativa correta: [justificativa passo a passo do caso concreto]\n❌ Por que as outras estão erradas: [análise concisa de cada distrator, destacando a diferença para a alternativa que confunde]\n⚠️ Pegadinha da banca (${board}): [gatilho mental para nunca mais errar este ponto]".`
      : `Elabore um caderno de ${count} questões inéditas de múltipla escolha reproduzindo FIELMENTE a engenharia de prova e pegadinhas da banca ${board}.
Disciplina: ${subject}.
Assunto / Tópico foco: ${topic}.
Dificuldade solicitada: ${difficulty === "progressivo" ? "progressiva (comece com fácil, passe para média e finalize com difícil)" : difficulty === "dificil" ? "DIFÍCIL (Nível Boss Raid: cobre casos práticos complexos, exceções legais, prazos, jurisprudência dominante e pegadinhas clássicas da banca)" : difficulty}.
Perfil obrigatório da banca ${board}:
- Se Cebraspe: situações hipotéticas, jurisprudência dominante STF/STJ, súmulas e pegadinhas de generalização ("sempre", "exclusivamente") ou inversão entre regra e exceção.
- Se FGV: enunciados narrativos longos com personagens em casos concretos ("João, servidor público..."), exigindo aplicação prática da norma e alternativas técnicas próximas.
- Se Instituto AOCP: literalidade cirúrgica da lei seca, prazos, penas, competências e exceções ("salvo", "exceto", "vedado"), trocando palavras-chave nos distratores.
- Se IDECAN: cobrança técnica e detalhista cruzando dispositivos legais com classificações doutrinárias e nomenclatura técnica.

${context ? `MATERIAL DE REFERÊNCIA DO PORTAL:\n${context}\n` : ""}

Regras obrigatórias de qualidade (estilo boaResposta):
1. Crie exatamente ${count} questões com 4 alternativas (options com 4 textos de extensão semelhante) e uma única correta (correct_index de 0 a 3).
2. Varie a posição da alternativa correta.
3. Marque origin como "autoral".
4. Em explanation, escreva obrigatoriamente uma RESOLUÇÃO PASSO A PASSO que ensine o conteúdo:
   "Conceito-chave: [explicação direta do fundamento]\n✅ Alternativa correta: [passo a passo do raciocínio]\n❌ Análise das alternativas: [por que cada distrator está incorreto]\n⚠️ Pegadinha da banca (${board}): [alerta tático de prova]".`;

    try {
      const generated = await askStructuredQuestions(prompt, activeGeminiKey, Boolean(personalGeminiKey));
      const keySource = personalGeminiKey && generated.provider === "gemini" ? "personal" : "shared";
      const sanitized = generated.questions
        .filter((q: any) => {
          if (!q?.statement || !Array.isArray(q?.options)) return false;
          const opts = q.options.map((o: any) => String(o ?? "").trim());
          if (opts.some((o: string) => !o) || new Set(opts.map((o: string) => o.toLocaleLowerCase("pt-BR"))).size !== opts.length) return false;
          if (opts.length < 2 || opts.length > 5) return false;
          const rawIdx = q.correct_index;
          if (rawIdx === null || rawIdx === undefined || typeof rawIdx === "boolean" || typeof rawIdx === "object" || String(rawIdx).trim() === "" || !Number.isInteger(Number(rawIdx))) return false;
          const idx = Number(rawIdx);
          if (idx < 0 || idx >= opts.length) return false;
          if (submode === "parse_raw" && !hasExplicitGabaritoInRawText) return false;
          return true;
        })
        .map((q: any) => {
          const opts = q.options.map((o: any) => String(o ?? "").trim());
          const idx = Number(q.correct_index);
          return {
            subject: String(q.subject || subject),
            topic: String(q.topic || topic),
            board: String(q.board || board),
            difficulty: ["facil", "medio", "dificil"].includes(String(q.difficulty || "").toLowerCase()) ? String(q.difficulty).toLowerCase() : "medio",
            origin: submode === "parse_raw" ? "importada" : "autoral",
            statement: String(q.statement).trim(),
            options: opts,
            correct_index: idx,
            explanation: (submode === "parse_raw" ? "🤖 [Gabarito sugerido pela IA — extraído de material importado; validação humana pendente] " : "") + String(q.explanation || "").trim(),
            ...(submode === "parse_raw" ? {key_source: "ia_sugerido", answer_key_validation: "pendente"} : {}),
          };
        });

      if (!sanitized.length) {
        return json(request, { error: submode === "parse_raw" ? "Nenhuma questão com gabarito explícito pôde ser extraída do texto colado. Inclua o gabarito (ex.: Gabarito: B) para importar sem chutar alternativas." : "Nenhuma questão válida gerada.", code: "NO_VALID_QUESTIONS_WITH_KEY" }, 422);
      }

      // O texto contém uma indicação de gabarito, mas a associação extraída pela
      // IA continua pendente de revisão. Não promove a extração a fonte oficial.
      // O prefixo preserva essa situação no catálogo legado, sem colunas de proveniência.
      if (submode === "parse_raw" && hasExplicitGabaritoInRawText && SERVICE_ROLE_KEY) {
        const sharedRows = sanitized.map((q: any) => ({
          fingerprint: questionHash(q.statement),
          subject: q.subject,
          topic: q.topic,
          board: q.board,
          difficulty: q.difficulty,
          origin: "adaptada_do_pdf",
          statement: q.statement,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          created_by: user.id,
        }));
        await fetch(`${SUPABASE_URL}/rest/v1/shared_question_bank?on_conflict=fingerprint`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify(sharedRows),
        }).catch(() => undefined);
      }

      await finishUsage(usage.event_id, "success", generated.provider, generated.model);
      return json(request, { questions: sanitized, provider: generated.provider, model: generated.model, key_source: keySource });
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      const limited = msg.includes("429");
      await finishUsage(usage.event_id, "error", undefined, undefined, limited ? "PROVIDER_429" : "STRUCTURED_QUESTIONS_FAILED");
      return json(request, { error: limited ? "Limite de requisições da IA atingido (429). Aguarde 1 minuto ou configure sua chave Gemini pessoal." : "Não foi possível gerar/estruturar as questões neste momento. Tente novamente.", code: limited ? "PROVIDER_429" : "GENERATION_FAILED" }, limited ? 429 : 502);
    }
  }

  if (payload.action === "parse_edital") {
    if (!activeGeminiKey || !SERVICE_ROLE_KEY) {
      return json(request, { error: "A leitura de editais ainda precisa da GEMINI_API_KEY no Supabase." }, 503);
    }
    const storagePath = String(payload.storage_path ?? "");
    const campaignId = String(payload.campaign_id ?? "");
    const documentId = String(payload.document_id ?? "");
    if (!storagePath.startsWith(`${user.id}/`) || !campaignId || !documentId) {
      return json(request, { error: "Documento inválido para esta conta." }, 400);
    }
    try {
      const ownedDocumentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&storage_path=eq.${encodeURIComponent(storagePath)}&select=id,document_type&limit=1`, {
        headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
      });
      const ownedDocuments = ownedDocumentResponse.ok ? await ownedDocumentResponse.json().catch(() => []) : [];
      if (!Array.isArray(ownedDocuments) || !ownedDocuments[0]?.id || !["edital", "edital_concurso"].includes(String(ownedDocuments[0]?.document_type))) {
        return json(request, { error: "O documento ou portal não pertence à conta conectada." }, 403);
      }
      const fileResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}`, {
        headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
      });
      if (!fileResponse.ok) return json(request, { error: "Não foi possível ler o PDF armazenado." }, 502);
      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      if (bytes.byteLength > 50 * 1024 * 1024) return json(request, { error: "Para análise automática, envie um edital de até 50 MB." }, 413);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const base64 = btoa(binary);
      const parseModel = await discoverGeminiModel(activeGeminiKey);
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(parseModel)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": activeGeminiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: "application/pdf", data: base64 } },
            { text: "Leia somente o conteúdo programático deste edital. Extraia cada tópico cobrado, sem inventar conteúdo. Retorne JSON com a propriedade topics, uma lista de objetos com subject, unit e topic. Preserve a ordem do edital, una duplicatas exatas e ignore cronogramas, inscrições, remuneração e regras administrativas." },
          ] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { topics: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, unit: { type: "STRING" }, topic: { type: "STRING" } }, required: ["subject", "topic"] } } }, required: ["topics"] },
          },
        }),
      });
      const geminiData = await geminiResponse.json().catch(() => ({}));
      if (!geminiResponse.ok) return json(request, { error: geminiData?.error?.message ?? "O Gemini não conseguiu analisar o edital." }, 502);
      const parsed = parseGeminiJsonText(geminiData);
      const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 4000) : [];
      const rows = topics.map((item: { subject?: string; unit?: string; topic?: string }, index: number) => ({ subject: String(item?.subject ?? "").trim(), unit_name: String(item?.unit ?? "").trim(), topic: String(item?.topic ?? "").trim(), edital_order: index })).filter((item: { subject: string; topic: string }) => item.subject && item.topic);
      if (!rows.length) return json(request, { error: "Não encontrei um conteúdo programático neste PDF." }, 422);
      const persisted = await fetch(`${SUPABASE_URL}/rest/v1/rpc/replace_campaign_topics_atomic`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_user_id: user.id,
          p_campaign_id: campaignId,
          p_document_id: documentId,
          p_topics: rows,
          p_coverage: { needs_review: true, summary_count: rows.length, warnings: ["Extração pelo modo de recuperação: confira disciplinas e tópicos com o edital original. A cobertura integral não foi verificada."] },
        }),
      }).catch(() => null);
      const persistedData = persisted ? await persisted.json().catch(() => null) : null;
      const saved = persistedData?.topics;
      if (!persisted?.ok || !Array.isArray(saved) || !saved.length || persistedData?.saved !== saved.length) {
        const missingMigration = persisted?.status === 404 || persistedData?.code === "PGRST202";
        return json(request, {
          error: missingMigration ? "Aplique a migração v107 no Supabase para salvar o edital com segurança. O mapa atual foi preservado." : "Não foi possível confirmar a gravação do edital. Recarregue o portal antes de tentar novamente.",
          code: missingMigration ? "MAP_STORAGE_MIGRATION_REQUIRED" : "TOPICS_SAVE_FAILED",
          retryable: !missingMigration,
        }, missingMigration ? 503 : 502);
      }
      return json(request, { topics: saved, saved: saved.length, provider: "gemini", key_source: personalGeminiKey ? "personal" : "shared", document_id: documentId });
    } catch (error) {
      console.error("Gemini edital error", error);
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "error" }) }).catch(() => undefined);
      return json(request, { error: "Falha ao interpretar o edital. Tente novamente." }, 502);
    }
  }

  if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) return json(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);
  const question = String(payload.question ?? "").trim().slice(0, 6000);
  const context = String(payload.context ?? "").trim().slice(0, 18000);
  const mode = String(payload.mode ?? "explicar").trim().slice(0, 40);
  if (question.length < 3) {
    return json(request, { error: "Escreva uma pergunta para o assistente." }, 400);
  }

  const usage = await reserveUsage(user.id, payload.campaign_id);
  if (!usage.allowed) {
    if (usage.reason === "DAILY_LIMIT") return json(request, { error: `Você atingiu o limite diário de ${usage.limit || 40} perguntas ao assistente. A cota será renovada à meia-noite.`, code: "DAILY_LIMIT" }, 429);
    return json(request, { error: "A proteção de consumo da IA está temporariamente indisponível. Tente novamente em alguns minutos.", code: usage.reason }, 503);
  }

  const systemPrompt = `Você é o PROFESSOR COORDENADOR E ESTRATEGISTA DE CONCURSOS da plataforma Jornada do Caçador.
Sua missão é ensinar com clareza clínica e rigor técnico para concursos policiais e administrativos (Instituto AOCP, Cebraspe, FGV, IBFC, IDECAN, UPENET/IAUPE, FCC e Vunesp), sempre com HONESTIDADE PEDAGÓGICA ABSOLUTA.

DIRETRIZES OBRIGATÓRIAS DO PROFESSOR COORDENADOR:
1. HONESTIDADE DOCUMENTAL E LEGAL (ZERO INVENÇÃO):
   - NUNCA invente número de artigo, lei, súmula, julgado, data ou estatística percentual de banca.
   - Se a informação exata não constar no MATERIAL DE REFERÊNCIA enviado ou se você não tiver certeza absoluta da literalidade vigente, declare expressamente que não há base documental suficiente no material sincronizado e oriente o aluno a conferir na fonte oficial atualizada.
2. INCIDÊNCIA EM PROVA COM TRANSPARÊNCIA:
   - Só informe índice de cobrança se houver base no material do aluno ou rotule expressamente como "Estimativa pedagógica de estudo" (nunca afirme estatística oficial de banca sem dado real).
3. AULA CLÍNICA E RIGOR TÉCNICO:
   - Explique o conceito central, a regra geral, as exceções cobradas em prova e os exemplos práticos.
   - Em temas jurídicos, diferencie claramente: (a) Letra da Lei Seca, (b) Jurisprudência/Súmulas (STF/STJ) e (c) Pegadinhas clássicas.
4. MNEMÔNICOS REAIS (PROIBIDO INVENTAR SIGLAS):
   - Só destaque mnemônicos que constem no material do aluno ou que sejam universalmente consagrados em concursos (ex.: SO-CI-DI-VA-PLU no Art. 1º da CF, CON-GAR-ERR-PRO no Art. 3º, MP3.COM no Art. 12 § 3º, CAPACETE de PM no Art. 22, LIMPE no Art. 37, CO-FI-FO-MO-OB e PATI em Atos Administrativos). Se não houver mnemônico real para o tema, NÃO invente siglas forçadas!
5. QUANDO O ALUNO PEDIR FLASHCARDS:
   - Use Active Recall (estilo Anki): Frente com pergunta conceitual direta e autossuficiente; Verso com resposta enxuta e objetiva.
6. AVISO DE CONFERÊNCIA:
   - Encerre lembrando de conferir a literalidade na legislação oficial atualizada e no edital do concurso.
CONTRATO ESTRITO DO MODO SOLICITADO (${mode}):
- Se modo = "radar da banca": NUNCA invente porcentagens ("cai em 73% das provas"). Classifique os tópicos apenas qualitativamente (Alta prioridade, Média prioridade, Complementar) e rotule como estimativa pedagógica caso não haja estatística no material do aluno.
- Se modo = "bizus e mnemônicos": NUNCA crie siglas inventadas. Cite apenas mnemônicos consagrados (SO-CI-DI-VA-PLU, CON-GAR-ERR-PRO, LIMPE, MP3.COM, CAPACETE de PM, CO-FI-FO-MO-OB, PATI) ou macetes diretos de eliminação de alternativa.
- Se modo = "flashcards": Estruture cada cartão estritamente com "Frente: [pergunta direta]" e "Verso: [resposta objetiva]".
- Se modo = "questões comentadas": Rotule todas as questões criadas como "[Questão Autoral / Pedagógica]" e nunca afirme serem transcrições literais de provas oficiais se forem geradas agora.`;

  const userPrompt = context
    ? `MATERIAL DE REFERÊNCIA:\n${context}\n\nPEDIDO DO ESTUDANTE:\n${question}`
    : `PEDIDO DO ESTUDANTE:\n${question}\n\nNão foi fornecido material de referência. Avise quando a resposta exigir conferência em fonte oficial.`;

  try {
    let result: { answer: string; model: string; provider: string } | null = null;
    let keySource: "personal" | "shared" = personalGeminiKey ? "personal" : "shared";

    // Prioriza Gemini primeiro (chave pessoal ou compartilhada) para maior precisão jurídica e pesquisa
    if (personalGeminiKey) {
      try {
        result = await askGemini(systemPrompt, userPrompt, personalGeminiKey);
        keySource = "personal";
      } catch (personalErr) {
        console.warn("Chave Gemini pessoal falhou; tentando Gemini compartilhado", personalErr);
      }
    }
    if (!result && GEMINI_API_KEY) {
      try {
        result = await askGemini(systemPrompt, userPrompt, GEMINI_API_KEY);
        keySource = "shared";
      } catch (sharedGeminiErr) {
        console.warn("Gemini compartilhado falhou; tentando reserva", sharedGeminiErr);
      }
    }

    if (!result) {
      try {
        result = await askDeepSeek(systemPrompt, userPrompt);
        keySource = "shared";
      } catch (deepSeekError) {
        console.warn("DeepSeek indisponível; acionando Groq", deepSeekError);
        result = await askGroq(systemPrompt, userPrompt);
        keySource = "shared";
      }
    }

    if (!result?.answer || !String(result.answer).trim()) {
      await finishUsage(usage.event_id, "error", result?.provider, result?.model, "EMPTY_RESPONSE");
      return json(request, { error: "O assistente retornou uma resposta vazia. Reformule sua pergunta e tente novamente.", code: "EMPTY_RESPONSE" }, 502);
    }
    await finishUsage(usage.event_id, "success", result.provider, result.model);
    const confidence = context ? "apoiada_no_material" : "conhecimento_geral_conferir";
    return json(request, { ...result, key_source: keySource, grounded: Boolean(context), confidence, user_id: user.id });
  } catch (error) {
    console.error("Todas as IAs falharam", error);
    const message = String((error as Error)?.message ?? error);
    const limited = message.includes("429");
    await finishUsage(usage.event_id, "error", undefined, undefined, limited ? "PROVIDER_429" : "ALL_PROVIDERS_FAILED");
    return json(request, { error: limited ? "A cota gratuita do provedor de IA foi atingida (erro 429). Aguarde a renovação da cota ou tente novamente mais tarde." : "As IAs estão temporariamente indisponíveis. Tente novamente em alguns minutos.", code: limited ? "PROVIDER_429" : "AI_UNAVAILABLE" }, limited ? 429 : 502);
  }
});
