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
  });
  return response.ok ? await response.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
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

async function askGemini(systemPrompt: string, userPrompt: string, geminiKey = GEMINI_API_KEY) {
  if (!geminiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  const models = await availableGeminiModels(geminiKey);
  let lastError = "GEMINI_FAILED";
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 3500 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = `GEMINI_${response.status}:${data?.error?.message ?? "falha"}`;
      if (response.status === 429 || response.status === 503 || response.status === 404 || response.status === 400) continue;
      throw new Error(lastError);
    }
    const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
      : [];
    const answer = (parts.length ? parts : data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (answer) return { answer, model, provider: "gemini" };
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
            options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } },
            correct_index: { type: "INTEGER", minimum: 0, maximum: 3 },
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
  const user = await authenticatedUser(authorization);
  if (!user?.id) {
    return json(request, { error: "Sessão inválida ou expirada." }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Solicitação inválida." }, 400);
  }

  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_API_KEY || "";

  if (payload.action === "shared_question_bank") {
    if (!SERVICE_ROLE_KEY) return json(request, { error: "Configuração do servidor incompleta." }, 503);
    const seen = new Map<string, any>();

    // 1. Consulta a tabela dedicada shared_question_bank (se já criada)
    const sharedRes = await fetch(`${SUPABASE_URL}/rest/v1/shared_question_bank?select=*&order=created_at.desc&limit=300`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    }).catch(() => null);
    if (sharedRes?.ok) {
      const rows = await sharedRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (Array.isArray(r.options) && r.options.length === 4 && r.statement) {
            const fp = r.fingerprint || questionHash(r.statement);
            seen.set(fp, {
              subject: String(r.subject || "Conteúdo Geral"),
              topic: String(r.topic || "Prova Oficial"),
              board: String(r.board || "Banca Oficial"),
              difficulty: ["facil", "medio", "dificil"].includes(r.difficulty) ? r.difficulty : "medio",
              origin: r.origin || "oficial",
              statement: String(r.statement),
              options: r.options.map(String),
              correct_index: Number(r.correct_index) || 0,
              explanation: String(r.explanation || ""),
            });
          }
        }
      }
    }

    // 2. Também agrega questões oficiais/adaptadas de provas já processadas em generated_study_content
    const contentRes = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?content_type=eq.summary&select=title,content&order=created_at.desc&limit=250`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    }).catch(() => null);
    if (contentRes?.ok) {
      const rows = await contentRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const subject = String(row?.content?.subject || "Conteúdo Geral");
          const source = String(row?.content?.source || "");
          const isExamSource = /prova|simulado|oficial|aocp|cebraspe|fgv|concurso/i.test(source);
          const qs = Array.isArray(row?.content?.questions) ? row.content.questions : [];
          for (const q of qs) {
            const origin = String(q?.origin || "autoral").toLowerCase();
            if ((/oficial|adaptada_do_pdf|importad|prova/.test(origin) || isExamSource) && Array.isArray(q?.options) && q.options.length === 4 && q?.statement) {
              const fp = questionHash(q.statement);
              if (!seen.has(fp)) {
                seen.set(fp, {
                  subject,
                  topic: String(q.topic || row.title || "Prova Oficial"),
                  board: String(q.board || (source ? source.slice(0, 50) : "Prova Oficial")),
                  difficulty: ["facil", "medio", "dificil"].includes(q.difficulty) ? q.difficulty : "medio",
                  origin: "oficial",
                  statement: String(q.statement),
                  options: q.options.map(String),
                  correct_index: Math.min(3, Math.max(0, Number(q.correct_index) || 0)),
                  explanation: String(q.explanation || ""),
                });
              }
            }
          }
        }
      }
    }

    const questions = [...seen.values()];
    return json(request, { questions, count: questions.length });
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

    const prompt = submode === "parse_raw"
      ? `Extraia e estruture as questões de concurso contidas no texto abaixo.
Disciplina padrão: ${subject}. Banca/Fonte: ${board}.
Para cada questão identificada:
- Preserve o enunciado e as 4 alternativas (se a questão original tiver 5 alternativas A-E, mantenha a alternativa correta e as 3 melhores distratoras para fechar exatamente 4 opções).
- Identifique o gabarito correto em correct_index (0 a 3).
- Marque origin como "oficial".
- Escreva em explanation uma RESOLUÇÃO PASSO A PASSO didática no estilo boaResposta contendo exatamente:
  "Conceito-chave: [resumo direto da regra cobrada]\n✅ Por que a correta está certa: [explicação clara]\n❌ Análise das alternativas: [por que as outras opções estão incorretas]\n⚠️ Pegadinha da banca: [ponto de atenção]".

TEXTO COLADO PELO ALUNO:
${rawText}`
      : submode === "twin" && moldQuestion
      ? `Crie ${count} questão(ões) GÊMEA(S) inédita(s) baseada(s) na questão-molde abaixo, cobrando o mesmo tema jurídico/técnico sob outro ângulo ou caso prático, mantendo o padrão da banca ${board}.
Disciplina: ${moldQuestion.subject || subject}. Assunto: ${moldQuestion.topic || topic}. Dificuldade: ${moldQuestion.difficulty || difficulty}.
QUESTÃO-MOLDE:
Enunciado: ${moldQuestion.statement}
Alternativas: ${JSON.stringify(moldQuestion.options)}
Explicação base: ${moldQuestion.explanation || ""}

Regras obrigatórias:
- 4 alternativas plausíveis (A, B, C, D) do mesmo assunto, apenas 1 correta (correct_index de 0 a 3).
- Marque origin como "autoral".
- No campo explanation, escreva uma RESOLUÇÃO PASSO A PASSO que ensine o aluno (estilo boaResposta):
  "Conceito-chave: [regra ou fundamento cobrado]\n✅ Alternativa correta: [justificativa passo a passo]\n❌ Por que as outras estão erradas: [análise concisa de cada distrator]\n⚠️ Pegadinha da banca (${board}): [como não cair no erro]".`
      : `Elabore um caderno de ${count} questões inéditas de múltipla escolha no estilo exato de cobrança da banca ${board}.
Disciplina: ${subject}.
Assunto / Tópico foco: ${topic}.
Dificuldade solicitada: ${difficulty === "progressivo" ? "progressiva (comece com fácil, passe para média e finalize com difícil)" : difficulty}.

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
        .filter((q: any) => q?.statement && Array.isArray(q?.options) && q.options.length === 4)
        .map((q: any) => ({
          subject: String(q.subject || subject),
          topic: String(q.topic || topic),
          board: String(q.board || board),
          difficulty: ["facil", "medio", "dificil"].includes(String(q.difficulty || "").toLowerCase()) ? String(q.difficulty).toLowerCase() : "medio",
          origin: submode === "parse_raw" ? "oficial" : "autoral",
          statement: String(q.statement).trim(),
          options: q.options.slice(0, 4).map((o: any) => String(o).trim()),
          correct_index: Math.min(3, Math.max(0, Number(q.correct_index) || 0)),
          explanation: String(q.explanation || "").trim(),
        }));

      if (!sanitized.length) throw new Error("EMPTY_QUESTIONS");

      // Salva no banco compartilhado se forem questões oficiais/importadas
      if (submode === "parse_raw" && SERVICE_ROLE_KEY) {
        const sharedRows = sanitized.map((q: any) => ({
          fingerprint: questionHash(q.statement),
          subject: q.subject,
          topic: q.topic,
          board: q.board,
          difficulty: q.difficulty,
          origin: "oficial",
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
      const ownedDocumentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`, {
        headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
      });
      const ownedDocuments = ownedDocumentResponse.ok ? await ownedDocumentResponse.json().catch(() => []) : [];
      if (!Array.isArray(ownedDocuments) || !ownedDocuments[0]?.id) {
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
      const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 1500) : [];
      if (!topics.length) return json(request, { error: "Não encontrei um conteúdo programático neste PDF." }, 422);
      await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
      const rows = topics.map((item: { subject?: string; unit?: string; topic?: string }, index: number) => ({ campaign_id: campaignId, user_id: user.id, subject: String(item.subject ?? "Edital"), unit_name: String(item.unit ?? ""), topic: String(item.topic ?? ""), edital_order: index }));
      await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics`, { method: "POST", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(rows) });
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready" }) });
      return json(request, { topics, provider: "gemini", key_source: personalGeminiKey ? "personal" : "shared", document_id: documentId });
    } catch (error) {
      console.error("Gemini edital error", error);
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "error" }) }).catch(() => undefined);
      return json(request, { error: "Falha ao interpretar o edital. Tente novamente." }, 502);
    }
  }

  if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) return json(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);
  const question = String(payload.question ?? "").trim().slice(0, 6000);
  const context = String(payload.context ?? "").trim().slice(0, 24000);
  const mode = String(payload.mode ?? "explicar").trim().slice(0, 40);
  if (question.length < 3) {
    return json(request, { error: "Escreva uma pergunta para o assistente." }, 400);
  }

  const usage = await reserveUsage(user.id, payload.campaign_id);
  if (!usage.allowed) {
    if (usage.reason === "DAILY_LIMIT") return json(request, { error: `Você atingiu o limite diário de ${usage.limit || 40} perguntas ao assistente. A cota será renovada à meia-noite.`, code: "DAILY_LIMIT" }, 429);
    return json(request, { error: "A proteção de consumo da IA está temporariamente indisponível. Tente novamente em alguns minutos.", code: usage.reason }, 503);
  }

  const systemPrompt = `Você é o Instrutor de Estudos do aplicativo Jornada do Caçador.
Explique em português brasileiro, com clareza, precisão e linguagem de aula escrita.
O estudante está começando do zero. Organize a resposta com títulos curtos quando útil.
Use a campanha, o edital e o material de referência fornecidos pelo estudante; não presuma que ele estuda para a PMPE.
Quando solicitado, produza explicação detalhada, resumo, bizus, mnemônicos, flashcards ou questões comentadas.
Em assuntos jurídicos, diferencie texto legal, explicação e dica de prova.
Não invente artigos, prazos, penas, jurisprudência, fontes ou questões supostamente reais.
Se o contexto fornecido não sustentar uma afirmação jurídica, declare que é necessário conferir a fonte oficial atualizada.
Não trate questões geradas como questões reais de banca. Identifique-as como autorais.
Modo solicitado: ${mode}.`;

  const userPrompt = context
    ? `MATERIAL DE REFERÊNCIA:\n${context}\n\nPEDIDO DO ESTUDANTE:\n${question}`
    : `PEDIDO DO ESTUDANTE:\n${question}\n\nNão foi fornecido material de referência. Avise quando a resposta exigir conferência em fonte oficial.`;

  try {
    let result: { answer: string; model: string; provider: string } | null = null;
    let keySource: "personal" | "shared" = personalGeminiKey ? "personal" : "shared";

    // Se o usuário configurou sua própria chave Gemini pessoal, prioriza a chave dele primeiro.
    if (personalGeminiKey) {
      try {
        result = await askGemini(systemPrompt, userPrompt, personalGeminiKey);
        keySource = "personal";
      } catch (personalErr) {
        console.warn("Chave Gemini pessoal falhou no assistente; tentando provedores de reserva", personalErr);
      }
    }

    if (!result) {
      try {
        result = await askDeepSeek(systemPrompt, userPrompt);
        keySource = "shared";
      } catch (deepSeekError) {
        console.warn("DeepSeek indisponível; acionando Groq", deepSeekError);
        try {
          result = await askGroq(systemPrompt, userPrompt);
          keySource = "shared";
        } catch (groqError) {
          console.warn("Groq indisponível; acionando Gemini", groqError);
          result = await askGemini(systemPrompt, userPrompt, GEMINI_API_KEY || activeGeminiKey);
          keySource = GEMINI_API_KEY && GEMINI_API_KEY !== personalGeminiKey ? "shared" : (personalGeminiKey ? "personal" : "shared");
        }
      }
    }

    await finishUsage(usage.event_id, "success", result.provider, result.model);
    return json(request, { ...result, key_source: keySource, grounded: Boolean(context), user_id: user.id });
  } catch (error) {
    console.error("Todas as IAs falharam", error);
    const message = String((error as Error)?.message ?? error);
    const limited = message.includes("429");
    await finishUsage(usage.event_id, "error", undefined, undefined, limited ? "PROVIDER_429" : "ALL_PROVIDERS_FAILED");
    return json(request, { error: limited ? "A cota gratuita do provedor de IA foi atingida (erro 429). Aguarde a renovação da cota ou tente novamente mais tarde." : "As IAs estão temporariamente indisponíveis. Tente novamente em alguns minutos.", code: limited ? "PROVIDER_429" : "AI_UNAVAILABLE" }, limited ? 429 : 502);
  }
});
