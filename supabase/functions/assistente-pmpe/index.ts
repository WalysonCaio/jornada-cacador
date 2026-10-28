const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jybislbbblyjsrcdegjt.supabase.co";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const GROQ_MODEL = "openai/gpt-oss-20b";
const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-flash";
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

async function userGeminiKey(userId: string) {
  if (!SERVICE_ROLE_KEY) return "";
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }),
  }).catch(() => null);
  if (!result?.ok) return "";
  return String(await result.json().catch(() => "") || "").trim();
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

const geminiModelDiscovery = new Map<string, Promise<string>>();
async function discoverGeminiModel(geminiKey = GEMINI_API_KEY) {
  if (!geminiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  if (geminiModelDiscovery.has(geminiKey)) return geminiModelDiscovery.get(geminiKey)!;
  const discovery = (async () => {
    const configured = String(Deno.env.get("GEMINI_MODEL") ?? "").replace(/^models\//, "").trim();
    const modelsResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } });
    const modelsData = await modelsResponse.json().catch(() => ({}));
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
    const model = (configured && enabled.includes(configured) ? configured : "") || enabled[0] || configured;
    if (!modelsResponse.ok || !model) throw new Error(`GEMINI_MODELS_${modelsResponse.status}:${modelsData?.error?.message ?? "nenhum modelo disponível"}`);
    console.log("Gemini assistant model", model);
    return model;
  })();
  geminiModelDiscovery.set(geminiKey, discovery);
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
  const model = await discoverGeminiModel(geminiKey);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey || "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 3000 },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GEMINI_${response.status}:${data?.error?.message ?? "falha"}`);
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
    : [];
  const answer = (parts.length ? parts : data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text ?? "").join("").trim();
  if (!answer) throw new Error("GEMINI_EMPTY");
  return { answer, model, provider: "gemini" };
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

  let payload: { action?: string; question?: string; context?: string; mode?: string; document_id?: string; storage_path?: string; campaign_id?: string };
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Solicitação inválida." }, 400);
  }

  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_API_KEY || "";

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
      return json(request, { topics, provider: "gemini", document_id: documentId });
    } catch (error) {
      console.error("Gemini edital error", error);
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "error" }) }).catch(() => undefined);
      return json(request, { error: "Falha ao interpretar o edital. Tente novamente." }, 502);
    }
  }

  if (!DEEPSEEK_API_KEY && !GROQ_API_KEY && !activeGeminiKey) return json(request, { error: "DeepSeek, Groq e Gemini não foram configuradas no servidor." }, 503);
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
    let result: { answer: string; model: string; provider: string };
    try {
      result = await askDeepSeek(systemPrompt, userPrompt);
    } catch (deepSeekError) {
      console.error("DeepSeek indisponível; acionando Groq", deepSeekError);
      try {
        result = await askGroq(systemPrompt, userPrompt);
      } catch (groqError) {
        console.error("Groq indisponível; acionando Gemini", groqError);
        result = await askGemini(systemPrompt, userPrompt, activeGeminiKey);
      }
    }
    await finishUsage(usage.event_id, "success", result.provider, result.model);
    return json(request, { ...result, grounded: Boolean(context), user_id: user.id });
  } catch (error) {
    console.error("Todas as IAs falharam", error);
    const message = String((error as Error)?.message ?? error);
    const limited = message.includes("429");
    await finishUsage(usage.event_id, "error", undefined, undefined, limited ? "PROVIDER_429" : "ALL_PROVIDERS_FAILED");
    return json(request, { error: limited ? "A cota gratuita do provedor de IA foi atingida (erro 429). Aguarde a renovação da cota ou tente novamente mais tarde." : "As IAs estão temporariamente indisponíveis. Tente novamente em alguns minutos.", code: limited ? "PROVIDER_429" : "AI_UNAVAILABLE" }, limited ? 429 : 502);
  }
});
