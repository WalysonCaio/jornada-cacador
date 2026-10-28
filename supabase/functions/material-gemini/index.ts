const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";
const ALLOWED_ORIGINS = new Set([SITE, "http://localhost:4173", "http://localhost:3000"]);
function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Vary": "Origin" };
}
// Static names are only the emergency fallback. The function asks Gemini which
// generateContent models are actually enabled for this API key before each job.
const GEMINI_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const FALLBACK_STATUS = new Set([400, 404]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const TEXT_CHUNK_TARGET = 22000;
const MAX_TEXT_CHUNKS = 10;

const GEMINI_TEXT_FALLBACKS = [...GEMINI_MODEL_FALLBACKS];

function standardJsonSchema(value: any): any {
  if (Array.isArray(value)) return value.map(standardJsonSchema);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = key === "type" && typeof item === "string" ? item.toLowerCase() : standardJsonSchema(item);
  }
  return result;
}

async function createGeminiInteraction(input: any[], schema: any, maxOutputTokens = 32768, timeoutMs = 115000, geminiKey = GEMINI_KEY) {
  let lastStatus = 0;
  let lastMessage = "O Gemini não concluiu a geração.";
  const parts = input.map((part) => {
    if (part?.type === "text") return { text: String(part.text || "") };
    if (part?.type === "document" && part?.data) return { inline_data: { mime_type: part.mime_type || "application/pdf", data: part.data } };
    if (part?.type === "document" && part?.uri) return { file_data: { mime_type: part.mime_type || "application/pdf", file_uri: part.uri } };
    if (part?.text || part?.inline_data || part?.file_data) return part;
    return null;
  }).filter(Boolean);
  const models = await availableGeminiModels(geminiKey);
  for (const model of models.slice(0, 5)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const baseBody = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens,
          responseMimeType: "application/json",
          ...(schema && Object.keys(schema).length ? { responseSchema: standardJsonSchema(schema) } : {}),
        },
      };
      const bodies = schema && Object.keys(schema).length ? [baseBody, relaxedGenerationBody(baseBody, maxOutputTokens)] : [baseBody];
      let shouldStopModels = false;
      for (let attempt = 0; attempt < bodies.length; attempt++) {
        const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          signal: controller.signal,
          body: JSON.stringify(bodies[attempt]),
        });
        const data = await result.json().catch(() => ({}));
        if (result.ok) {
          try {
            return { data, parsed: parseGeminiJsonText(data), model };
          } catch (parseErr) {
            lastStatus = 502;
            lastMessage = String((parseErr as Error)?.message || parseErr);
            console.warn("Gemini generateContent invalid JSON", model, attempt + 1, lastMessage);
            continue;
          }
        }
        lastStatus = result.status;
        lastMessage = data?.error?.message || data?.errors?.[0]?.message || `Gemini ${result.status}`;
        console.warn("Gemini generateContent", model, attempt + 1, result.status, lastMessage);
        if (result.status === 400 && attempt === 0 && bodies.length > 1) continue;
        // Modelo indisponível (400/404) ou sobrecarregado (503) usa a próxima
        // opção imediatamente. Cota 429 é compartilhada e deve parar sem criar
        // tentativas inúteis nem consumir o tempo máximo da Edge Function.
        if (result.status === 429 || result.status === 503) {
          await wait(1200);
          break;
        }
        if (!FALLBACK_STATUS.has(result.status)) {
          shouldStopModels = true;
        }
        break;
      }
      if (shouldStopModels) break;
    } catch (error) {
      const isAbort = (error as Error)?.name === "AbortError";
      lastMessage = isAbort ? `A análise excedeu o tempo seguro de ${Math.round(timeoutMs / 1000)} segundos.` : String((error as Error)?.message || error);
      lastStatus = isAbort ? 504 : 500;
      console.warn("Gemini generateContent exception", model, lastMessage);
      if (isAbort) break;
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error(lastMessage) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
  error.retryable = RETRYABLE_STATUS.has(lastStatus) || FALLBACK_STATUS.has(lastStatus) || lastStatus === 0;
  error.providerStatus = lastStatus;
  error.userMessage = lastStatus === 429
    ? "A cota gratuita do Gemini foi atingida. O PDF continua salvo e a tentativa não consumiu seu limite diário; tente após a renovação da cota ou habilite faturamento no Google AI Studio."
    : lastStatus === 503 || lastStatus === 504
      ? "O Gemini está sobrecarregado ou excedeu o tempo de análise. O PDF continua salvo e a tentativa não consumiu seu limite diário; tente novamente mais tarde."
      : `O Gemini recusou a análise${lastStatus ? ` (erro ${lastStatus})` : ""}: ${lastMessage}`;
  throw error;
}

function parseGeminiJsonText(data: any) {
  const candidateParts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
    : [];
  const raw = String((candidateParts.length ? candidateParts : data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || "").join("") ?? "").trim();
  if (!raw) throw new Error("EMPTY_GEMINI_RESPONSE");
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const normalizeParsed = (val: any) => {
    if (Array.isArray(val)) return { summaries: val };
    if (val && typeof val === "object" && !Array.isArray(val.summaries) && Array.isArray(val.resumos)) {
      return { ...val, summaries: val.resumos };
    }
    return val;
  };
  try { return normalizeParsed(JSON.parse(unfenced)); } catch { /* tenta extrair o objeto */ }
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) return normalizeParsed(JSON.parse(unfenced.slice(start, end + 1)));
  throw new Error("INVALID_GEMINI_JSON");
}

function relaxedGenerationBody(body: any, maxOutputTokens = 32768) {
  return {
    ...body,
    generationConfig: {
      temperature: body?.generationConfig?.temperature ?? 0.1,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  };
}

const discoveredModels = new Map<string, Promise<string[]>>();
function normalizeModelName(value: unknown) { return String(value ?? "").replace(/^models\//, "").trim(); }
async function availableGeminiModels(geminiKey = GEMINI_KEY) {
  if (!geminiKey) return [];
  if (discoveredModels.has(geminiKey)) return discoveredModels.get(geminiKey)!;
  const discovery = (async () => {
    const configured = normalizeModelName(Deno.env.get("GEMINI_MODEL"));
    try {
      const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } });
      const data = await list.json().catch(() => ({}));
      if (!list.ok) console.warn("Gemini models.list", list.status, data?.error?.message ?? "falha");
      const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use|gemma|learnlm|aqa)/i;
      const enabled = Array.isArray(data?.models) ? data.models
        .filter((item: any) => Array.isArray(item?.supportedGenerationMethods) && item.supportedGenerationMethods.includes("generateContent"))
        .map((item: any) => normalizeModelName(item?.name))
        .filter((name: string) => name && !blocked.test(name))
        .sort((a: string, b: string) => {
          const score = (name: string) => (name === "gemini-2.5-flash" ? 0 : name === "gemini-2.5-flash-lite" ? 1 : /flash(?!.*lite)/i.test(name) ? 2 : /flash-lite/i.test(name) ? 3 : /pro/i.test(name) ? 4 : 5) + (/preview|experimental|exp/i.test(name) ? 6 : 0);
          return score(a) - score(b) || a.localeCompare(b);
        }) : [];
      const candidates = [
        configured && (!enabled.length || enabled.includes(configured)) ? configured : "",
        ...GEMINI_TEXT_FALLBACKS.filter((m) => !enabled.length || enabled.includes(m)),
        ...enabled,
        ...GEMINI_TEXT_FALLBACKS,
      ].filter(Boolean);
      const unique = [...new Set(candidates)].slice(0, 8);
      console.log("Gemini model candidates", unique);
      return unique;
    } catch (error) {
      console.warn("Gemini model discovery failed", String((error as Error)?.message ?? error));
      return [...new Set([configured, ...GEMINI_TEXT_FALLBACKS].filter(Boolean))];
    }
  })();
  discoveredModels.set(geminiKey, discovery);
  return discovery;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function reserveUsage(userId: string, campaignId: string, operation: "material" | "exam", dailyLimit = 10) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: operation, p_daily_limit: dailyLimit }),
  });
  if (result.ok) return await result.json();
  const detail = await result.text().catch(() => "");
  console.error("reserve_ai_usage", result.status, detail);
  return { allowed: false, reason: result.status === 404 ? "USAGE_GUARD_MISSING" : "USAGE_GUARD_UNAVAILABLE" };
}

async function setDocumentStatus(documentId: string, userId: string, processingStatus: "pending" | "processing" | "ready" | "error") {
  await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ processing_status: processingStatus }),
  }).catch(() => undefined);
}

async function finishUsage(eventId: number | undefined, status: "success" | "error" | "cached", provider?: string, model?: string, errorCode?: string) {
  if (!eventId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: provider || null, model: model || null, error_code: errorCode || null }) }).catch(() => undefined);
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
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }),
  }).catch(() => null);
  if (!result || !result.ok) {
    if (result && result.status !== 404) console.warn("Personal Gemini key lookup unavailable", result.status);
    return "";
  }
  return extractSecretString(await result.json().catch(() => ""));
}

async function updateJob(documentId: string, values: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs?document_id=eq.${encodeURIComponent(documentId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) }).catch(() => undefined);
}

async function createDocumentInventory(file: { uri: string; mimeType?: string }, title: string, geminiKey = GEMINI_KEY) {
  const requestBody = {
    contents: [{ parts: [
      { file_data: { mime_type: file.mimeType ?? "application/pdf", file_uri: file.uri } },
      { text: `Leia o PDF inteiro antes de responder. Crie um inventário estrutural fiel do documento “${title}”. Liste capítulos e seções relevantes na ordem em que aparecem, com página inicial e final estimadas, disciplina e importância para estudo. Considere início, meio, final e anexos. Não resuma ainda e não invente páginas. Se algo estiver ilegível, registre em warnings.` },
    ] }],
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: 12000,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: {
        estimated_pages: { type: "INTEGER" },
        sections: { type: "ARRAY", minItems: 1, maxItems: 80, items: { type: "OBJECT", properties: {
          name: { type: "STRING" }, subject: { type: "STRING" }, start_page: { type: "INTEGER" }, end_page: { type: "INTEGER" }, importance: { type: "STRING", enum: ["alta", "media", "baixa"] },
        }, required: ["name", "subject", "start_page", "end_page", "importance"] } },
        warnings: { type: "ARRAY", items: { type: "STRING" } },
      }, required: ["estimated_pages", "sections", "warnings"] },
    },
  };
  let temporaryFailure = false;
  let lastStatus = 0;
  let lastMessage = "";
  for (const model of await availableGeminiModels(geminiKey)) {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey }, body: JSON.stringify(requestBody) });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      lastStatus = result.status;
      lastMessage = data?.error?.message ?? `Falha ao mapear o PDF (${result.status}).`;
      temporaryFailure ||= RETRYABLE_STATUS.has(result.status);
      console.warn("Inventory fallback", model, result.status, lastMessage);
      continue;
    }
    try {
      const parsed = parseGeminiJsonText(data);
      if (Array.isArray(parsed?.sections) && parsed.sections.length) return { ...parsed, model };
    } catch { /* tenta o modelo seguinte */ }
  }
  if (temporaryFailure) {
    const unavailable = new Error(lastMessage || "O serviço de IA está temporariamente indisponível.") as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
    unavailable.retryable = true;
    unavailable.providerStatus = lastStatus;
    unavailable.userMessage = lastStatus === 429
      ? "O Gemini atingiu a cota ou está sobrecarregado. O PDF continua salvo e esta tentativa não consumiu seu limite diário."
      : "O Gemini está temporariamente indisponível. O PDF continua salvo e esta tentativa não consumiu seu limite diário.";
    throw unavailable;
  }
  // O inventário melhora a auditoria, mas uma resposta estrutural inválida não deve
  // impedir a leitura principal que já percorre o PDF inteiro.
  return { estimated_pages: 0, sections: [], warnings: ["O inventário preliminar não ficou disponível; confira o relatório de cobertura ao final."], model: "fallback" };
}

async function generateStudyPackage(file: { uri: string; mimeType?: string }, title: string, campaignContext: string, documentType: string, inventory: any, geminiKey = GEMINI_KEY) {
  const requestBody = {
    contents: [{ parts: [
      { file_data: { mime_type: file.mimeType ?? "application/pdf", file_uri: file.uri } },
      { text: `Crie um pacote de estudo completo e fiel exclusivamente ao PDF anexado, alinhado ao edital da campanha abaixo. Antes de escrever, percorra o documento inteiro, do início ao fim, inclusive anexos, capítulos finais e páginas posteriores à página 50. Faça internamente um inventário de capítulos, seções e subtópicos. Depois produza de 1 a 24 assuntos, conforme a extensão real do documento: não pare nos primeiros capítulos e não reduza um PDF longo a poucos resumos genéricos.

Para cada assunto produza: disciplina, título específico, aula escrita detalhada e autossuficiente para iniciante, 7 a 12 pontos essenciais, exemplo explicado passo a passo, bizu de prova, mnemônico útil, pegadinha frequente, 6 a 10 flashcards e exatamente 5 questões de múltipla escolha. A explicação deve desenvolver conceitos, regras, exceções e relações importantes; evite parágrafos curtos que apenas repetem o título. Quando o PDF for extenso, consolide apenas subtópicos diretamente relacionados, sem omitir capítulos independentes.

CONTEXTO DA CAMPANHA:
${campaignContext || "Edital ainda não disponível; use somente o PDF."}

INVENTÁRIO CRIADO NA PRIMEIRA ETAPA:
${JSON.stringify(inventory?.sections || []).slice(0, 30000)}

Use esse inventário como lista de verificação. Cada seção deve aparecer em pelo menos um resumo ou ser registrada em omissions com motivo. Inclua page_start e page_end em cada resumo, usando somente as páginas estimadas no inventário.

TIPO DO DOCUMENTO: ${documentType}. ${["prova", "simulado"].includes(documentType) ? "Extraia e classifique as questões existentes no PDF por disciplina, tópico, banca e ano quando esses dados estiverem expressos. Preserve o sentido e marque como adaptada_do_pdf; não invente identificação oficial." : "Produza conteúdo didático e questões de fixação com base no material."}

PADRÃO OBRIGATÓRIO DAS QUESTÕES:
0. No campo subject, reutilize exatamente o nome da disciplina presente no conteúdo do edital quando houver correspondência. Materiais diferentes da mesma disciplina devem continuar a trilha existente; não crie variações por caixa, acento, numeração, módulo, volume ou abreviação.
1. Revise ortografia, concordância, pontuação e clareza em português brasileiro antes de responder.
2. Para cada assunto gere exatamente: 1 questão fácil, 2 médias e 2 difíceis, nessa progressão pedagógica.
3. Fácil: conceito direto com distratores plausíveis. Média: exige comparação, interpretação ou aplicação. Difícil: exige análise de caso, exceção, combinação de regras ou distinção conceitual sutil.
4. Todas as quatro alternativas devem pertencer à mesma disciplina, ao mesmo assunto e ao mesmo contexto do enunciado. É proibido usar alternativas de temas alheios apenas para completar a questão.
5. As alternativas devem possuir estrutura gramatical e extensão semelhantes. Evite pistas como uma alternativa muito mais detalhada, palavras absolutas usadas apenas nos erros ou três opções evidentemente absurdas.
6. Deve existir uma única resposta inequivocamente correta segundo o PDF. Não invente lei, artigo, dado, jurisprudência ou exceção ausente.
7. A explicação deve justificar a correta e comentar brevemente por que cada uma das outras está errada.
8. Varie a posição da resposta correta entre A, B, C e D.
9. Se o PDF trouxer questões oficiais, crie uma adaptação fiel e marque origin como adaptada_do_pdf. Caso contrário, crie questão autoral e marque origin como autoral. Nunca apresente uma questão autoral como oficial.
10. Use o estilo de cobrança compatível com concursos policiais e com a banca indicada no próprio material, sem copiar questões externas nem alegar acesso a banco pago.

CONTROLE DE COBERTURA:
1. Informe em coverage as páginas estimadas, a lista das principais seções detectadas e quais foram cobertas.
2. sections_detected e sections_covered devem usar nomes comparáveis e refletir o documento inteiro.
3. Registre em omissions qualquer seção que não pôde ser estudada, com o motivo real (por exemplo: página ilegível, somente imagem ou conteúdo truncado). Não omita silenciosamente.
4. coverage_confidence deve variar de 0 a 1. Só use valor alto quando o início, o meio e o final do PDF tiverem sido considerados.
5. Se alguma página estiver ilegível, informe isso; nunca complete lacunas por suposição.

O arquivo se chama: ${title}.` },
    ] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { coverage: { type: "OBJECT", properties: { estimated_pages: { type: "INTEGER" }, sections_detected: { type: "ARRAY", items: { type: "STRING" } }, sections_covered: { type: "ARRAY", items: { type: "STRING" } }, omissions: { type: "ARRAY", items: { type: "STRING" } }, coverage_confidence: { type: "NUMBER" } }, required: ["estimated_pages", "sections_detected", "sections_covered", "omissions", "coverage_confidence"] }, summaries: { type: "ARRAY", minItems: 1, maxItems: 24, items: { type: "OBJECT", properties: {
        subject: { type: "STRING" }, title: { type: "STRING" }, page_start: { type: "INTEGER" }, page_end: { type: "INTEGER" }, explanation: { type: "STRING" }, points: { type: "ARRAY", items: { type: "STRING" } }, example: { type: "STRING" }, bizu: { type: "STRING" }, mnemonic: { type: "STRING" }, trap: { type: "STRING" }, flashcards: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } }, questions: { type: "ARRAY", minItems: 5, maxItems: 5, items: { type: "OBJECT", properties: { statement: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, correct_index: { type: "INTEGER", minimum: 0, maximum: 3 }, explanation: { type: "STRING" }, difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] }, topic: { type: "STRING" }, origin: { type: "STRING", enum: ["autoral", "adaptada_do_pdf"] } }, required: ["statement", "options", "correct_index", "explanation", "difficulty", "topic", "origin"] } }
      }, required: ["subject", "title", "page_start", "page_end", "explanation", "points", "example", "bizu", "mnemonic", "trap", "flashcards", "questions"] } } }, required: ["coverage", "summaries"] },
    },
  };

  let lastError = "O serviço de IA está temporariamente indisponível.";
  let lastStatus = 0;
  const models = await availableGeminiModels(geminiKey);
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const bodies = [requestBody, relaxedGenerationBody(requestBody)];
    for (let attempt = 0; attempt < bodies.length; attempt++) {
      const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify(bodies[attempt]),
      });
      const data = await ai.json().catch(() => ({}));
      if (ai.ok) {
        try {
          const parsed = parseGeminiJsonText(data);
          if (Array.isArray(parsed?.summaries) && parsed.summaries.length) return { data, parsed, model };
          lastError = "O modelo não devolveu resumos utilizáveis.";
        } catch {
          lastError = String(data?.candidates?.[0]?.finishReason || "") === "MAX_TOKENS"
            ? "A resposta do modelo foi interrompida pelo limite de saída."
            : "O modelo devolveu JSON incompleto.";
        }
        console.warn("Gemini invalid output", model, attempt + 1, lastError);
        continue;
      }
      lastStatus = ai.status;
      lastError = data?.error?.message ?? `Falha no modelo ${model} (${ai.status}).`;
      console.warn("Gemini fallback", model, attempt + 1, ai.status, lastError);
      // Invalid/unavailable model IDs and model-specific schema limitations must
      // fall through to the next compatible model instead of aborting the PDF.
      if (FALLBACK_STATUS.has(ai.status)) continue;
      if (!RETRYABLE_STATUS.has(ai.status)) {
        const fatal = new Error(lastError) as Error & { providerStatus?: number; userMessage?: string };
        fatal.providerStatus = ai.status;
        fatal.userMessage = `O Gemini recusou a geração (${ai.status}). O PDF continua salvo. Detalhe: ${lastError}`;
        throw fatal;
      }
      if (attempt === 0) await wait(900 * (modelIndex + 1));
    }
  }
  const unavailable = new Error(lastError) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
  unavailable.retryable = true;
  unavailable.providerStatus = lastStatus;
  unavailable.userMessage = FALLBACK_STATUS.has(lastStatus)
    ? `Nenhum modelo Gemini disponível aceitou esta análise (${lastStatus}). O PDF continua salvo e a tentativa não consumiu a cota. Confira a GEMINI_API_KEY e os modelos liberados para ela.`
    : "O Gemini está temporariamente indisponível. O PDF continua salvo e esta tentativa não consumiu sua cota.";
  throw unavailable;
}

// Fluxo estável: preserva o formato que funcionava nas primeiras versões e
// evita que inventário, esquema excessivo ou auditoria adicional impeçam o
// salvamento de um conteúdo que o Gemini já conseguiu produzir.
function pdfInlinePart(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { inline_data: { mime_type: "application/pdf", data: btoa(binary) } };
}

async function generateStudyPackageStable(file: { uri: string; mimeType?: string }, title: string, campaignContext: string, documentType: string, inlineBytes: Uint8Array | undefined, geminiKey: string) {
  const sourcePart = file?.uri
    ? { type: "document", mime_type: file.mimeType ?? "application/pdf", uri: file.uri }
    : inlineBytes
      ? { type: "document", mime_type: "application/pdf", data: pdfInlinePart(inlineBytes).inline_data.data }
      : { type: "document", mime_type: file.mimeType ?? "application/pdf", uri: file.uri };
  const requestBody = {
    contents: [{ parts: [
      sourcePart,
      { text: `Leia integralmente o PDF “${title}” e crie um pacote de estudo fiel somente ao documento. Divida o conteúdo em até 12 assuntos coerentes, seguindo a ordem pedagógica do material.

Para cada assunto gere: subject, title, explanation, points, example, bizu, mnemonic, trap, flashcards e questions. A explanation deve ser uma aula detalhada e autossuficiente para iniciante. Gere de 5 a 10 pontos essenciais, de 5 a 8 flashcards e 5 questões com quatro alternativas, uma única correta, dificuldade progressiva e explicação comentada. Não invente leis, artigos, dados ou conteúdo ausente.

Em títulos jurídicos, escreva sempre a referência como “Art. 4°”, nunca “Art. 4o”.

CONTEXTO DO PORTAL:
${campaignContext || "Sem edital sincronizado; use exclusivamente o PDF."}

TIPO: ${documentType}. ${["prova", "simulado"].includes(documentType) ? "Quando houver questões no PDF, adapte-as fielmente sem afirmar que uma questão autoral é oficial." : "Produza conteúdo didático e questões de fixação."}` },
    ] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { summaries: { type: "ARRAY", minItems: 1, maxItems: 12, items: { type: "OBJECT", properties: {
        subject: { type: "STRING" }, title: { type: "STRING" }, explanation: { type: "STRING" },
        points: { type: "ARRAY", items: { type: "STRING" } }, example: { type: "STRING" }, bizu: { type: "STRING" }, mnemonic: { type: "STRING" }, trap: { type: "STRING" },
        flashcards: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } },
        questions: { type: "ARRAY", items: { type: "OBJECT", properties: { statement: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, correct_index: { type: "INTEGER", minimum: 0, maximum: 3 }, explanation: { type: "STRING" }, difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] }, topic: { type: "STRING" }, origin: { type: "STRING" } }, required: ["statement", "options", "correct_index", "explanation", "difficulty", "topic"] } },
      }, required: ["subject", "title", "explanation", "points", "example", "bizu", "mnemonic", "trap", "flashcards", "questions"] } } }, required: ["summaries"] },
    },
  };
  const schema = requestBody.generationConfig.responseSchema;
  const prompt = requestBody.contents[0].parts[1].text;
  const result = await createGeminiInteraction([sourcePart, { type: "text", text: prompt }], schema, 32768, 115000, geminiKey);
  if (!Array.isArray(result.parsed?.summaries) || !result.parsed.summaries.length) {
    const error = new Error("O Gemini respondeu sem resumos utilizáveis.") as Error & { retryable?: boolean; userMessage?: string };
    error.retryable = true;
    error.userMessage = "O Gemini leu o arquivo, mas não devolveu resumos utilizáveis. O PDF continua salvo; tente novamente.";
    throw error;
  }
  return result;
}

type TextPage = { page: number; text: string };
type TextChunk = { index: number; pageStart: number; pageEnd: number; text: string; headings: string[] };
type ProviderAttempt = { provider: string; model: string; status: number; message: string };

function jsonFromModelText(value: unknown) {
  const raw = String(value ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(raw); } catch { /* extrai o primeiro objeto completo */ }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("INVALID_PROVIDER_JSON");
}

function normalizeExtractedPage(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadBrowserExtractedPages(storagePath: string): Promise<TextPage[] | null> {
  const sidecarPath = `${storagePath}.text.json`;
  const result = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${sidecarPath}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  // O Storage pode responder 400 ("Object not found") quando o sidecar ainda
  // não existe. Isso não é uma falha de processamento; apenas aciona a leitura
  // visual como alternativa.
  if (result.status === 400 || result.status === 404) return null;
  if (!result.ok) {
    console.warn("Browser text sidecar unavailable", result.status);
    return null;
  }
  const payload = await result.json().catch(() => null);
  const pages = Array.isArray(payload?.pages)
    ? payload.pages.map((item: any, index: number) => ({ page: Number(item?.page) || index + 1, text: normalizeExtractedPage(item?.text) }))
    : [];
  const meaningfulCharacters = pages.reduce((total: number, page: TextPage) => total + page.text.replace(/\s/g, "").length, 0);
  if (!pages.length || meaningfulCharacters < Math.max(300, pages.length * 35)) return null;
  console.log("Using browser-extracted PDF text", pages.length, meaningfulCharacters);
  return pages;
}

function pageHeadings(text: string) {
  return text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 120 && (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9 .,:;()º°ª\-–—/]{3,}$/.test(line) || /^(cap[ií]tulo|t[ií]tulo|se[cç][aã]o|unidade|m[oó]dulo|art\.?)\s/i.test(line)))
    .slice(0, 8);
}

function createTextChunks(pages: TextPage[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let current: TextPage[] = [];
  let length = 0;
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      index: chunks.length,
      pageStart: current[0].page,
      pageEnd: current[current.length - 1].page,
      text: current.map((page) => `[PÁGINA ${page.page}]\n${page.text}`).join("\n\n"),
      headings: [...new Set(current.flatMap((page) => pageHeadings(page.text)))].slice(0, 20),
    });
    current = [];
    length = 0;
  };
  for (const page of pages) {
    const addition = page.text.length + 24;
    if (current.length && length + addition > TEXT_CHUNK_TARGET) flush();
    current.push(page);
    length += addition;
  }
  flush();

  // Não descarta silenciosamente o final de documentos extensos. Quando há
  // mais de dez blocos, redistribui páginas contíguas em dez partes.
  if (chunks.length <= MAX_TEXT_CHUNKS) return chunks;
  const pagesPerChunk = Math.ceil(pages.length / MAX_TEXT_CHUNKS);
  const balanced: TextChunk[] = [];
  for (let offset = 0; offset < pages.length; offset += pagesPerChunk) {
    const group = pages.slice(offset, offset + pagesPerChunk);
    balanced.push({
      index: balanced.length,
      pageStart: group[0].page,
      pageEnd: group[group.length - 1].page,
      text: group.map((page) => `[PÁGINA ${page.page}]\n${page.text}`).join("\n\n"),
      headings: [...new Set(group.flatMap((page) => pageHeadings(page.text)))].slice(0, 20),
    });
  }
  return balanced;
}

async function callOpenAiCompatibleProvider(
  provider: "deepseek" | "groq",
  prompt: string,
  attempts: ProviderAttempt[],
) {
  const config = provider === "deepseek"
    ? { key: DEEPSEEK_KEY, url: "https://api.deepseek.com/chat/completions", model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-flash" }
    : { key: GROQ_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b" };
  if (!config.key) {
    attempts.push({ provider, model: config.model, status: 0, message: "chave não configurada" });
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const result = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "Você é um professor especialista em concursos. Responda somente com um objeto JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      }),
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      attempts.push({ provider, model: config.model, status: result.status, message: String(data?.error?.message || `${provider} ${result.status}`).slice(0, 500) });
      console.warn("AI provider fallback failed", provider, config.model, result.status, String(data?.error?.message || "").slice(0, 300));
      return null;
    }
    const parsed = jsonFromModelText(data?.choices?.[0]?.message?.content);
    if (!Array.isArray(parsed?.summaries) || !parsed.summaries.length) throw new Error("EMPTY_PROVIDER_SUMMARIES");
    console.log("AI provider fallback succeeded", provider, config.model);
    return { parsed, provider, model: config.model };
  } catch (error) {
    const status = (error as Error)?.name === "AbortError" ? 504 : 500;
    attempts.push({ provider, model: config.model, status, message: String((error as Error)?.message || error).slice(0, 500) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function chunkStudyPrompt(chunk: TextChunk, totalChunks: number, title: string, campaignContext: string, documentType: string) {
  return `Analise exclusivamente o trecho abaixo, extraído das páginas ${chunk.pageStart} a ${chunk.pageEnd} do PDF “${title}”. Este é o bloco ${chunk.index + 1} de ${totalChunks}. Não use conhecimento externo para completar lacunas.

Crie entre 1 e 4 resumos, respeitando a ordem pedagógica do texto. Para cada resumo devolva exatamente os campos: subject, title, page_start, page_end, explanation, points, example, bizu, mnemonic, trap, flashcards e questions.

Regras:
- explanation deve ser uma aula detalhada, clara e autossuficiente para iniciante;
- points deve possuir de 5 a 10 itens;
- flashcards deve possuir de 5 a 8 objetos com question e answer;
- questions deve possuir exatamente 5 objetos com statement, options (4 alternativas plausíveis do mesmo assunto), correct_index (0 a 3), explanation, difficulty, topic e origin;
- use a progressão: 1 fácil, 2 médias e 2 difíceis;
- não invente artigo, lei, exceção, banca ou dado ausente;
- em referências jurídicas use “Art. 4°”, nunca “Art. 4o”;
- page_start e page_end devem ficar entre ${chunk.pageStart} e ${chunk.pageEnd};
- se o trecho apenas continuar um assunto anterior, ainda produza um resumo compreensível, sem fingir que viu páginas ausentes;
- responda apenas JSON no formato {"summaries":[...]}.

TIPO: ${documentType}.
CONTEXTO DO EDITAL (somente para nomear a disciplina):
${campaignContext || "Sem edital sincronizado."}

TÍTULOS DETECTADOS NESTE BLOCO:
${chunk.headings.join(" | ") || "Nenhum título inequívoco detectado."}

TEXTO EXTRAÍDO:
${chunk.text}`;
}

const CHUNK_SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    summaries: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "OBJECT",
        properties: {
          subject: { type: "STRING" },
          title: { type: "STRING" },
          page_start: { type: "INTEGER" },
          page_end: { type: "INTEGER" },
          explanation: { type: "STRING" },
          points: { type: "ARRAY", items: { type: "STRING" } },
          example: { type: "STRING" },
          bizu: { type: "STRING" },
          mnemonic: { type: "STRING" },
          trap: { type: "STRING" },
          flashcards: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { question: { type: "STRING" }, answer: { type: "STRING" } },
              required: ["question", "answer"],
            },
          },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                statement: { type: "STRING" },
                options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } },
                correct_index: { type: "INTEGER", minimum: 0, maximum: 3 },
                explanation: { type: "STRING" },
                difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] },
                topic: { type: "STRING" },
                origin: { type: "STRING" },
              },
              required: ["statement", "options", "correct_index", "explanation", "difficulty", "topic"],
            },
          },
        },
        required: ["subject", "title", "explanation", "points", "example", "bizu", "mnemonic", "trap", "flashcards", "questions"],
      },
    },
  },
  required: ["summaries"],
};

async function generateChunkWithFallback(chunk: TextChunk, totalChunks: number, title: string, campaignContext: string, documentType: string, geminiKey: string) {
  const prompt = chunkStudyPrompt(chunk, totalChunks, title, campaignContext, documentType);
  const attempts: ProviderAttempt[] = [];
  const geminiKeys = [...new Set([geminiKey, GEMINI_KEY].filter(Boolean))];
  if (geminiKeys.length) {
    for (const candidateKey of geminiKeys) {
      try {
        const result = await createGeminiInteraction([{ type: "text", text: prompt }], CHUNK_SUMMARY_SCHEMA, 24576, 65000, candidateKey);
        if (!Array.isArray(result.parsed?.summaries) || !result.parsed.summaries.length) throw new Error("EMPTY_GEMINI_SUMMARIES");
        return { ...result, provider: "gemini", attempts };
      } catch (error) {
        const status = Number((error as { providerStatus?: number })?.providerStatus || 500);
        attempts.push({ provider: "gemini", model: "automatic-fallback", status, message: String((error as Error)?.message || error).slice(0, 500) });
      }
    }
  } else attempts.push({ provider: "gemini", model: "", status: 0, message: "chave não configurada" });

  const deepseek = await callOpenAiCompatibleProvider("deepseek", prompt, attempts);
  if (deepseek) return { ...deepseek, attempts };
  const groq = await callOpenAiCompatibleProvider("groq", prompt, attempts);
  if (groq) return { ...groq, attempts };

  const error = new Error("ALL_AI_PROVIDERS_FAILED") as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string; attempts?: ProviderAttempt[] };
  error.retryable = true;
  error.providerStatus = attempts.some((item) => item.status === 429) ? 429 : 503;
  error.attempts = attempts;
  const diagnosis = attempts.map((item) => `${item.provider}: ${item.status || item.message}`).join(" · ");
  error.userMessage = `Gemini, DeepSeek e Groq não concluíram este bloco. O PDF permanece salvo e a tentativa não consumiu a cota diária. Diagnóstico: ${diagnosis}.`;
  throw error;
}

async function generateStudyPackageFromText(
  pages: TextPage[], title: string, campaignContext: string, documentType: string,
  onProgress: (completed: number, total: number, providers: string[]) => Promise<void>,
  geminiKey: string,
) {
  const chunks = createTextChunks(pages);
  const results: any[] = new Array(chunks.length);
  const providers: string[] = [];
  const models: string[] = [];
  const attempts: ProviderAttempt[] = [];
  let nextIndex = 0;
  let completed = 0;
  const worker = async (workerIndex: number) => {
    if (workerIndex > 0) await wait(1200 * workerIndex);
    while (true) {
      const index = nextIndex++;
      if (index >= chunks.length) return;
      const chunk = chunks[index];
      const generated = await generateChunkWithFallback(chunk, chunks.length, title, campaignContext, documentType, geminiKey);
      results[index] = generated;
      providers.push(generated.provider);
      models.push(generated.model);
      attempts.push(...generated.attempts);
      completed += 1;
      await onProgress(completed, chunks.length, providers);
    }
  };
  // Duas análises simultâneas aceleram PDFs longos sem disparar uma rajada que
  // provoque 429 nos provedores gratuitos.
  await Promise.all(Array.from({ length: Math.min(2, chunks.length) }, (_, idx) => worker(idx)));
  const summaries = results.flatMap((generated) => generated?.parsed?.summaries || []);
  const sections = chunks.flatMap((chunk) => chunk.headings.length ? chunk.headings : [`Páginas ${chunk.pageStart}–${chunk.pageEnd}`]);
  return {
    parsed: {
      summaries,
      coverage: {
        estimated_pages: pages.length,
        sections_detected: sections,
        sections_covered: sections,
        omissions: [],
        coverage_confidence: 0.9,
      },
    },
    provider: [...new Set(providers)].join("+") || "unknown",
    model: [...new Set(models)].join("+") || "unknown",
    chunks: chunks.length,
    attempts,
  };
}

async function reviewGeneratedQuestions(summaries: unknown[], campaignContext: string, geminiKey = GEMINI_KEY) {
  const compact = summaries.map((summary: any, summaryIndex) => ({ summary_index: summaryIndex, subject: summary?.subject, title: summary?.title, questions: summary?.questions })).slice(0, 24);
  const model = (await availableGeminiModels(geminiKey))[0];
  if (!model) return summaries;
  const review = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Atue como revisor independente de questões de concurso. Revise o conjunto JSON abaixo usando apenas as informações contidas nele e o contexto do edital. Corrija português, ambiguidade, gabarito incompatível com a explicação e alternativas óbvias ou de tema diferente. Mantenha exatamente quatro alternativas, uma única correta e a progressão 1 fácil, 2 médias e 2 difíceis por resumo. Se não for possível corrigir com segurança, remova a questão. Nunca transforme uma questão autoral em oficial.\n\nCONTEXTO:\n${campaignContext}\n\nQUESTÕES:\n${JSON.stringify(compact)}` }] }],
      generationConfig: {
        temperature: 0.05,
        maxOutputTokens: 32768,
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { reviews: { type: "ARRAY", items: { type: "OBJECT", properties: { summary_index: { type: "INTEGER" }, questions: { type: "ARRAY", items: { type: "OBJECT", properties: { statement: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correct_index: { type: "INTEGER" }, explanation: { type: "STRING" }, difficulty: { type: "STRING" }, topic: { type: "STRING" }, origin: { type: "STRING" } }, required: ["statement","options","correct_index","explanation","difficulty","topic","origin"] } } }, required: ["summary_index","questions"] } } }, required: ["reviews"] },
      },
    }),
  });
  if (!review.ok) { console.warn("Question review unavailable", review.status);return summaries; }
  const data = await review.json().catch(() => ({}));
  let parsed: any = {};
  try { parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); } catch { return summaries; }
  const reviews = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
  return summaries.map((summary: any, index) => ({ ...summary, questions: reviews.find((item: any) => Number(item.summary_index) === index)?.questions ?? summary?.questions, review_status: "ai_reviewed" }));
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
  if (!start.ok || !uploadUrl) {
    const error = new Error(`Falha ao iniciar envio ao Gemini (${start.status}).`) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
    error.retryable = RETRYABLE_STATUS.has(start.status);
    error.providerStatus = start.status;
    error.userMessage = start.status === 429 ? "O Gemini atingiu a cota ou está sobrecarregado. O PDF continua salvo e esta tentativa não consumiu seu limite diário." : "Não foi possível enviar o PDF ao Gemini agora. O arquivo continua salvo para uma nova tentativa.";
    throw error;
  }

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
  const data = await uploaded.json();
  if (!uploaded.ok || !data?.file?.uri) {
    const error = new Error(data?.error?.message ?? `Falha ao enviar PDF ao Gemini (${uploaded.status}).`) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
    error.retryable = RETRYABLE_STATUS.has(uploaded.status);
    error.providerStatus = uploaded.status;
    error.userMessage = uploaded.status === 429 ? "O Gemini atingiu a cota ou está sobrecarregado. O PDF continua salvo e esta tentativa não consumiu seu limite diário." : "O envio do PDF à IA falhou temporariamente. O arquivo continua salvo para uma nova tentativa.";
    throw error;
  }
  const file = data.file as { uri: string; name?: string; mimeType?: string; state?: string; error?: { message?: string } };
  if (!file.name) return file;
  // Files can remain PROCESSING after the resumable upload. Calling
  // generateContent before ACTIVE intermittently makes every later stage fail.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (String(file.state || "").toUpperCase() === "ACTIVE") return file;
    if (String(file.state || "").toUpperCase() === "FAILED") {
      await removeGeminiFile(file.name, geminiKey);
      const failed = new Error(file.error?.message || "O Gemini não conseguiu preparar o PDF.") as Error & { retryable?: boolean; userMessage?: string };
      failed.retryable = true;
      failed.userMessage = "O Gemini não conseguiu preparar o PDF agora. O arquivo continua salvo e a tentativa não consumiu sua cota.";
      throw failed;
    }
    await wait(1500);
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": geminiKey } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      if (RETRYABLE_STATUS.has(statusResponse.status)) continue;
      await removeGeminiFile(file.name, geminiKey);
      const statusError = new Error(statusData?.error?.message || `Falha ao consultar o PDF no Gemini (${statusResponse.status}).`) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
      statusError.retryable = true;
      statusError.providerStatus = statusResponse.status;
      statusError.userMessage = "O PDF foi enviado, mas a IA não confirmou que ele está pronto. O arquivo continua salvo para tentar novamente.";
      throw statusError;
    }
    Object.assign(file, statusData);
  }
  await removeGeminiFile(file.name, geminiKey);
  const timeout = new Error("Tempo excedido aguardando o Gemini preparar o PDF.") as Error & { retryable?: boolean; userMessage?: string };
  timeout.retryable = true;
  timeout.userMessage = "O Gemini demorou para preparar o PDF. Ele continua salvo e esta tentativa não consumiu a cota; tente novamente em alguns minutos.";
  throw timeout;
}

async function removeGeminiFile(name?: string, geminiKey = GEMINI_KEY) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": geminiKey },
  }).catch(() => undefined);
}

function cleanGeneratedText(value: unknown, max = 4000) {
  // NFC preserva símbolos semanticamente importantes do português, como
  // indicadores ordinais (ª/º). NFKC os convertia indevidamente em a/o.
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeLegalNotation(value: unknown, max = 4000) {
  return cleanGeneratedText(value, max)
    .replace(/\b(\d+)\s*a(?=\s+[A-Za-zÀ-ÿ])/g, "$1ª")
    .replace(/\b(\d+)\s*o(?=\s+[A-Za-zÀ-ÿ])/g, "$1º")
    .replace(/\b(?:art(?:igo)?\.?)\s*(\d+)\s*(?:o|º|°)(?=\s|[,.;:()\-–—]|$)/gi, (_match, number) => `Art. ${number}°`)
    .replace(/\b(?:art(?:igo)?\.?)\s*(\d+)(?=\s|[,.;:()\-–—]|$)/gi, (_match, number) => `Art. ${number}°`);
}

function subjectKey(value: unknown) {
  return cleanGeneratedText(value, 200).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\b(disciplina|materia|conteudo|modulo|parte)\b/g, " ").replace(/\b(i{1,3}|iv|v|[1-9])\b$/, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function preferredSubject(value: unknown) {
  const raw = cleanGeneratedText(value || "Conteúdo geral", 200);
  const key = subjectKey(raw);
  const aliases: Array<[RegExp, string]> = [
    [/^(lingua )?portugues(a)?$/, "Língua Portuguesa"],
    [/^direito constitucional/, "Direito Constitucional"],
    [/^direito administrativo/, "Direito Administrativo"],
    [/^direito processual penal/, "Direito Processual Penal"],
    [/^direito penal/, "Direito Penal"],
    [/^(raciocinio logico( matematico)?|matematica e rlm|rlm)$/, "Raciocínio Lógico-Matemático"],
    [/^(informatica|nocao de informatica|nocoes de informatica)$/, "Informática"],
    [/^historia de pernambuco/, "História de Pernambuco"],
    [/^(direitos humanos|direito humano)/, "Direitos Humanos"],
  ];
  return aliases.find(([pattern]) => pattern.test(key))?.[1] ?? raw;
}

function resolveSubject(value: unknown, knownSubjects: string[]) {
  const preferred = preferredSubject(value);
  const key = subjectKey(preferred);
  const exact = knownSubjects.find((subject) => subjectKey(subject) === key);
  if (exact) return preferredSubject(exact);
  const close = knownSubjects.find((subject) => {
    const known = subjectKey(subject);
    return key.length >= 8 && known.length >= 8 && (known.includes(key) || key.includes(known));
  });
  return close ? preferredSubject(close) : preferred;
}

function sanitizeQuestions(value: unknown, fallbackTopic: string) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const valid = [];
  for (const raw of value) {
    const statement = cleanGeneratedText(raw?.statement, 1200);
    const options = Array.isArray(raw?.options) ? raw.options.map((option: unknown) => cleanGeneratedText(option, 600)) : [];
    const normalizedOptions = options.map((option: string) => option.toLocaleLowerCase("pt-BR"));
    const correctIndex = Number(raw?.correct_index);
    const explanation = cleanGeneratedText(raw?.explanation, 3000);
    const difficulty = ["facil", "medio", "dificil"].includes(raw?.difficulty) ? raw.difficulty : "medio";
    const key = statement.toLocaleLowerCase("pt-BR");
    if (statement.length < 20 || options.length !== 4 || options.some((option: string) => option.length < 2)) continue;
    if (new Set(normalizedOptions).size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
    if (explanation.length < 20 || seen.has(key)) continue;
    seen.add(key);
    valid.push({ statement, options, correct_index: correctIndex, explanation, difficulty, topic: cleanGeneratedText(raw?.topic || fallbackTopic, 300), origin: raw?.origin === "adaptada_do_pdf" ? "adaptada_do_pdf" : "autoral" });
  }
  const target = { facil: 1, medio: 2, dificil: 2 } as Record<string, number>;
  const balanced = ["facil", "medio", "medio", "dificil", "dificil"].flatMap((difficulty) => {
    const index = valid.findIndex((question) => question.difficulty === difficulty && target[difficulty]-- > 0);
    return index >= 0 ? valid.splice(index, 1) : [];
  });
  return balanced.length === 5 ? balanced : [...balanced, ...valid].slice(0, 5);
}

function sanitizeStrings(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanGeneratedText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function sanitizeSummary(value: any, knownSubjects: string[]) {
  const title = normalizeLegalNotation(value?.title || "Resumo", 300);
  const flashcards = Array.isArray(value?.flashcards) ? value.flashcards.map((card: any) => ({
    question: cleanGeneratedText(card?.question, 1000),
    answer: cleanGeneratedText(card?.answer, 2400),
  })).filter((card: { question: string; answer: string }) => card.question.length >= 8 && card.answer.length >= 8).slice(0, 10) : [];
  return {
    ...value,
    subject: resolveSubject(value?.subject || "Conteúdo", knownSubjects),
    title,
    page_start: Math.max(0, Math.floor(Number(value?.page_start) || 0)),
    page_end: Math.max(0, Math.floor(Number(value?.page_end) || 0)),
    explanation: normalizeLegalNotation(value?.explanation, 18000),
    points: Array.isArray(value?.points) ? [...new Set(value.points.map((item: unknown) => normalizeLegalNotation(item, 1200)).filter(Boolean))].slice(0, 15) : [],
    example: normalizeLegalNotation(value?.example, 6000),
    bizu: normalizeLegalNotation(value?.bizu, 3000),
    mnemonic: normalizeLegalNotation(value?.mnemonic, 2000),
    trap: normalizeLegalNotation(value?.trap, 3000),
    flashcards,
    questions: sanitizeQuestions(value?.questions, title),
  };
}

function coverageReport(value: any, summaries: any[]) {
  const detected = sanitizeStrings(value?.sections_detected, 120, 500);
  const covered = sanitizeStrings(value?.sections_covered, 120, 500);
  const omissions = sanitizeStrings(value?.omissions, 50, 1000);
  const confidence = Math.max(0, Math.min(1, Number(value?.coverage_confidence) || 0));
  const coveredKeys = covered.map(subjectKey);
  const matched = detected.filter((section) => { const key = subjectKey(section); return coveredKeys.some((coveredKey) => coveredKey === key || (key.length >= 8 && (coveredKey.includes(key) || key.includes(coveredKey)))); }).length;
  const percent = detected.length ? Math.round((matched / detected.length) * 100) : Math.round(confidence * 100);
  const shallow = summaries.filter((summary) => summary.explanation.length < 220 || summary.points.length < 3 || summary.flashcards.length < 3).length;
  const warnings = [];
  if (percent < 80) warnings.push(`Cobertura declarada de ${percent}% das seções detectadas.`);
  if (confidence < 0.7) warnings.push("A IA informou baixa confiança na leitura integral do PDF.");
  if (omissions.length) warnings.push(`${omissions.length} seção(ões) não puderam ser cobertas.`);
  if (shallow) warnings.push(`${shallow} resumo(s) ficaram abaixo do nível mínimo de detalhamento.`);
  return {
    estimated_pages: Math.max(0, Math.floor(Number(value?.estimated_pages) || 0)),
    sections_detected: detected,
    sections_covered: covered,
    omissions,
    confidence,
    percent,
    summary_count: summaries.length,
    shallow_summaries: shallow,
    warnings,
    needs_review: warnings.length > 0,
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("material-gemini configuration missing", { supabase: Boolean(SUPABASE_URL), serviceRole: Boolean(SERVICE_KEY), gemini: Boolean(GEMINI_KEY), deepseek: Boolean(DEEPSEEK_KEY), groq: Boolean(GROQ_KEY) });
    return response({ error: "A função de materiais não está configurada. Confira SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.", code: "MISSING_CONFIGURATION" }, 503);
  }
  const auth = request.headers.get("authorization") ?? "";
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: PUBLIC_KEY } });
  const user = authResponse.ok ? await authResponse.json() : null;
  if (!user?.id) return response({ error: "Sessão inválida. Entre novamente." }, 401);
  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_KEY;
  if (!activeGeminiKey && !DEEPSEEK_KEY && !GROQ_KEY) {
    return response({ error: "Configure sua chave Gemini em Perfil → Configurações de IA." }, 503);
  }
  const input = await request.json().catch(() => null);
  const path = String(input?.storage_path ?? ""), campaignId = String(input?.campaign_id ?? ""), documentId = String(input?.document_id ?? ""), title = String(input?.title ?? "PDF enviado");
  if (!path || !campaignId || !documentId) return response({ error: "Dados do documento incompletos." }, 400);
  if (!path.startsWith(`${user.id}/`)) return response({ error: "Documento de outra conta." }, 403);
  let usage: { allowed?: boolean; event_id?: number; reason?: string; limit?: number } | null = null;
  try {
    const campaignResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_campaigns?id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,name,organization&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const campaigns = campaignResponse.ok ? await campaignResponse.json() : [];
    if (!Array.isArray(campaigns) || !campaigns[0]?.id) return response({ error: "Este portal não pertence à conta conectada." }, 403);
    const documentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&storage_path=eq.${encodeURIComponent(path)}&select=id,document_type,metadata&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const documents = documentResponse.ok ? await documentResponse.json() : [];
    if (!Array.isArray(documents) || !documents[0]?.id) return response({ error: "O documento não pertence a este portal." }, 403);
    const topicsResponse = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=subject,topic&order=edital_order.asc&limit=500`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const editalTopics = topicsResponse.ok ? await topicsResponse.json() : [];
    const knownResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&processing_status=eq.ready&detected_subject=not.is.null&select=detected_subject&limit=500`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const knownDocuments = knownResponse.ok ? await knownResponse.json() : [];
    const knownSubjects = [...new Set([
      ...(Array.isArray(editalTopics) ? editalTopics.map((item: { subject?: string }) => cleanGeneratedText(item.subject, 200)) : []),
      ...(Array.isArray(knownDocuments) ? knownDocuments.map((item: { detected_subject?: string }) => cleanGeneratedText(item.detected_subject, 200)) : []),
    ].filter(Boolean).map(preferredSubject))];
    const campaignContext = [`Concurso: ${campaigns[0].name}`, campaigns[0].organization ? `Órgão: ${campaigns[0].organization}` : "", Array.isArray(editalTopics) && editalTopics.length ? `Conteúdo do edital: ${editalTopics.map((item: { subject?: string; topic?: string }) => `${item.subject}: ${item.topic}`).join("; ")}` : ""].filter(Boolean).join("\n").slice(0, 16000);
    const documentType = String(documents[0].document_type || "material");
    const operation = ["prova", "simulado"].includes(documentType) ? "exam" : "material";
    await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs?on_conflict=document_id,job_type`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, campaign_id: campaignId, document_id: documentId, job_type: operation, status: "processing", attempts: 1, locked_at: new Date().toISOString(), locked_by: "material-gemini" }) });
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!file.ok) {
      await setDocumentStatus(documentId, user.id, "error");
      await updateJob(documentId, { status: "failed", last_error: `STORAGE_${file.status}` });
      return response({ error: `Não foi possível abrir o PDF salvo (${file.status}). Confirme se a função e o arquivo pertencem ao mesmo projeto Supabase.`, code: "STORAGE_READ_FAILED" }, 502);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) {
      await setDocumentStatus(documentId, user.id, "error");
      await updateJob(documentId, { status: "failed", last_error: "FILE_TOO_LARGE" });
      return response({ error: "O PDF deve ter no máximo 50 MB para geração automática.", code: "FILE_TOO_LARGE" }, 413);
    }
    const fingerprint = await sha256(bytes);
    const cachedResponse = await fetch(`${SUPABASE_URL}/rest/v1/document_fingerprints?user_id=eq.${encodeURIComponent(user.id)}&sha256=eq.${fingerprint}&document_id=neq.${encodeURIComponent(documentId)}&select=document_id&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const cached = cachedResponse.ok ? await cachedResponse.json() : [];
    if (Array.isArray(cached) && cached[0]?.document_id) {
      const contentResponse = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${cached[0].document_id}&select=content_type,title,content,source_refs,approved`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
      const existing = contentResponse.ok ? await contentResponse.json() : [];
      if (Array.isArray(existing) && existing.length) {
        const copies = existing.map((row: Record<string, unknown>) => ({ ...row, campaign_id: campaignId, user_id: user.id, source_document_id: documentId, source_refs: [{ document_id: documentId, title }] }));
        const copied = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(copies) });
        if (copied.ok) {
          await fetch(`${SUPABASE_URL}/rest/v1/document_fingerprints`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id, document_id: documentId, sha256: fingerprint, byte_size: bytes.byteLength }) });
          const cachedSubjects = existing.map((row: any) => cleanGeneratedText(row?.content?.subject || "", 200)).filter(Boolean);
          const cachedSubject = resolveSubject(cachedSubjects[0] || "Conteúdo geral", knownSubjects);
          const cachedDocumentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${cached[0].document_id}&select=metadata&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
          const cachedDocuments = cachedDocumentResponse.ok ? await cachedDocumentResponse.json() : [];
          const cachedCoverage = Array.isArray(cachedDocuments) ? cachedDocuments[0]?.metadata?.coverage : null;
          await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", detected_subject: cachedSubject, metadata: { primary_subject: cachedSubject, subjects: [...new Set(cachedSubjects)], analyzed_at: new Date().toISOString(), reused_cache: true, ...(cachedCoverage ? { coverage: cachedCoverage } : {}) } }) });
          await updateJob(documentId, { status: "completed", last_error: null });
          return response({ cached: true, provider: "cache", message: "Este PDF já havia sido analisado. O conteúdo foi reutilizado sem consumir nova cota." });
        }
      }
    }
    usage = await reserveUsage(user.id, campaignId, operation, personalGeminiKey ? 25 : 2);
    if (!usage.allowed) {
      await updateJob(documentId, { status: usage.reason === "BUSY" ? "queued" : "retry", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: usage.reason });
      await setDocumentStatus(documentId, user.id, "pending");
      if (usage.reason === "DAILY_LIMIT") return response({ error: `Você atingiu o limite diário de ${usage.limit || 10} análises de arquivo concluídas. O arquivo está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return response({ error: "Já existe uma análise em andamento. Este PDF entrou na fila e será o próximo.", retryable: true, queued: true, code: "BUSY" }, 409);
      if (usage.reason === "USAGE_GUARD_MISSING") return response({ error: "A tabela de controle de IA não existe neste projeto Supabase. Execute a migração 20261003_v60_fair_ai_quota.sql no projeto correto.", retryable: true, code: usage.reason }, 503);
      return response({ error: "A proteção de consumo está temporariamente indisponível. Confira os logs da função material-gemini.", retryable: true, code: usage.reason }, 503);
    }
    let generated: any;
    let inventory: any = documents[0]?.metadata?.analysis_plan;
    if (!Array.isArray(inventory?.sections)) inventory = { estimated_pages: 0, sections: [], warnings: [], model: "local-text-extraction" };
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_plan: inventory, analysis_progress: { stage: "extracting_text", percent: 15, completed_sections: 0, total_sections: 0, updated_at: new Date().toISOString() } } }) });
    const browserPages = await loadBrowserExtractedPages(path);
    if (browserPages) {
      const pages = browserPages;
      inventory = {
        estimated_pages: pages.length,
        sections: pages.flatMap((page) => pageHeadings(page.text).map((name) => ({ name, start_page: page.page, end_page: page.page }))).slice(0, 100),
        warnings: [],
        model: "unpdf-local",
      };
      generated = await generateStudyPackageFromText(pages, title, campaignContext, documentType, async (completed, total, providers) => {
        const percent = 20 + Math.round((completed / total) * 55);
        await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_plan: inventory, analysis_progress: { stage: "generation", percent, completed_sections: completed, total_sections: total, providers: [...new Set(providers)], updated_at: new Date().toISOString() } } }) });
      }, activeGeminiKey);
    } else {
      if (!activeGeminiKey) {
        const noOcr = new Error("OCR_PROVIDER_NOT_CONFIGURED") as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
        noOcr.retryable = true;
        noOcr.providerStatus = 503;
        noOcr.userMessage = "O navegador não encontrou texto selecionável neste PDF e o Gemini Visual não está configurado. Aplique OCR ao PDF e tente novamente.";
        throw noOcr;
      }
      console.warn("Browser PDF text unavailable; using Gemini native document vision");
      const geminiFile = await uploadPdfToGemini(bytes, title, activeGeminiKey);
      try {
        inventory = { estimated_pages: 0, sections: [], warnings: ["PDF digitalizado: leitura visual realizada pelo Gemini."], model: "gemini-native-vision" };
        try {
          generated = await generateStudyPackageStable(geminiFile, title, campaignContext, documentType, bytes.byteLength <= 14 * 1024 * 1024 ? bytes : undefined, activeGeminiKey);
          generated.provider = "gemini-vision";
          generated.key_source = personalGeminiKey ? "personal" : "shared";
        } catch (visionError) {
          const status = Number((visionError as { providerStatus?: number })?.providerStatus || 0);
          const wrapped = new Error(String((visionError as Error)?.message || visionError)) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string; code?: string };
          wrapped.retryable = true;
          wrapped.providerStatus = status || 503;
          wrapped.code = "OCR_PROVIDER_UNAVAILABLE";
          wrapped.userMessage = status === 429
            ? "Este PDF é digitalizado e precisa da leitura visual do Gemini, mas a cota visual foi atingida. DeepSeek e Groq só podem assumir depois que existir texto extraído. O arquivo continua salvo: tente mais tarde ou aplique OCR ao PDF e processe novamente."
            : "Este PDF é digitalizado e precisa da leitura visual do Gemini, que está temporariamente sobrecarregado. DeepSeek e Groq só podem assumir depois que existir texto extraído. O arquivo continua salvo: tente mais tarde ou aplique OCR ao PDF e processe novamente.";
          throw wrapped;
        }
      } finally {
        await removeGeminiFile(geminiFile.name, activeGeminiKey);
      }
    }
    const parsed: any = generated.parsed;
    const generatedSummaries = Array.isArray(parsed.summaries) ? parsed.summaries : [];
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_plan: inventory, analysis_progress: { stage: "review", percent: 75, completed_sections: parsed?.coverage?.sections_covered?.length || 0, total_sections: inventory?.sections?.length || 0, updated_at: new Date().toISOString() } } }) });
    // A própria geração já exige questões revisadas e a sanitização abaixo faz a
    // validação determinística. Evitar uma terceira chamada grande reduz timeout,
    // consumo de cota e falhas depois de o PDF já ter sido lido com sucesso.
    const rawSummaries = generatedSummaries;
    const summaries = rawSummaries.map((content: Record<string, unknown>) => sanitizeSummary(content, knownSubjects)).filter((content: { title?: string; explanation?: string }) => Boolean(content.title && content.explanation));
    if (!summaries.length) { await setDocumentStatus(documentId, user.id, "error"); await finishUsage(usage.event_id,"error",undefined,undefined,"INSUFFICIENT_CONTENT");await updateJob(documentId,{status:"failed",last_error:"INSUFFICIENT_CONTENT"});return response({ error: "Não encontrei conteúdo de estudo suficiente no PDF." }, 422); }
    const coverage = coverageReport(parsed?.coverage, summaries);
    const hasDeclaredCoverage = Array.isArray(parsed?.coverage?.sections_detected) && parsed.coverage.sections_detected.length > 0;
    const grosslyIncomplete = hasDeclaredCoverage && ((coverage.sections_detected.length >= 4 && coverage.percent < 25) || coverage.confidence < 0.25);
    if (grosslyIncomplete) {
      await setDocumentStatus(documentId, user.id, "error");
      await finishUsage(usage.event_id, "error", generated.provider, generated.model, "LOW_COVERAGE");
      await updateJob(documentId, { status: "failed", last_error: "LOW_COVERAGE" });
      return response({ error: "A análise não atingiu a cobertura mínima de segurança e não substituiu nenhum conteúdo anterior. Tente novamente; se o PDF for digitalizado, gere uma versão com OCR ou divida-o por capítulos.", coverage }, 422);
    }
    const rows = summaries.map((content: Record<string, unknown>) => ({ campaign_id: campaignId, user_id: user.id, source_document_id: documentId, content_type: "summary", title: String(content.title ?? "Resumo"), content: { ...content, source: title }, source_refs: [{ document_id: documentId, title }] }));
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(rows) });
    if (!saved.ok) { console.error("Database", saved.status, await saved.text());await setDocumentStatus(documentId, user.id, "pending");await finishUsage(usage.event_id,"error",undefined,undefined,"CONTENT_SAVE_FAILED");await updateJob(documentId,{status:"retry",last_error:"CONTENT_SAVE_FAILED"});return response({ error: "O conteúdo foi criado, mas não pôde ser salvo.", retryable: true }, 502); }
    const savedRows = await saved.json().catch(() => []);
    const newIds = Array.isArray(savedRows) ? savedRows.map((row: { id?: string }) => row.id).filter(Boolean) : [];
    if (newIds.length) {
      const cleanup = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${documentId}&id=not.in.(${newIds.join(",")})`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
      if (!cleanup.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?id=in.(${newIds.join(",")})`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
        await setDocumentStatus(documentId, user.id, "pending");
        await finishUsage(usage.event_id, "error", undefined, undefined, "CONTENT_REPLACE_FAILED");
        await updateJob(documentId, { status: "retry", last_error: "CONTENT_REPLACE_FAILED" });
        return response({ error: "A nova análise ficou pronta, mas não foi possível substituir a versão anterior com segurança. O conteúdo anterior foi preservado.", retryable: true }, 502);
      }
    }
    const subjectCounts = summaries.reduce((counts: Record<string, number>, item: Record<string, unknown>) => { const subject = cleanGeneratedText(item.subject || "Conteúdo", 200);counts[subject] = (counts[subject] || 0) + 1;return counts; }, {});
    const detectedSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Conteúdo geral";
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", detected_subject: detectedSubject, metadata: { ...(documents[0]?.metadata || {}), primary_subject: detectedSubject, subjects: Object.keys(subjectCounts), analyzed_at: new Date().toISOString(), analysis_plan: inventory, analysis_progress: { stage: "completed", percent: 100, completed_sections: coverage.sections_covered.length, total_sections: coverage.sections_detected.length, updated_at: new Date().toISOString() }, coverage } }) });
    await fetch(`${SUPABASE_URL}/rest/v1/document_fingerprints`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id, document_id: documentId, sha256: fingerprint, byte_size: bytes.byteLength }) });
    await finishUsage(usage.event_id, "success", generated.provider, generated.model);
    await updateJob(documentId, { status: "completed", last_error: null });
    return response({ summaries: summaries.length, flashcards: summaries.reduce((n: number, x: { flashcards?: unknown[] }) => n + (x.flashcards?.length ?? 0), 0), questions: summaries.reduce((n: number, x: { questions?: unknown[] }) => n + (x.questions?.length ?? 0), 0), coverage, provider: generated.provider, model: generated.model, key_source: personalGeminiKey ? "personal" : "shared", chunks: generated.chunks || 1 });
  } catch (error) {
    console.error("material-gemini", error);
    await finishUsage(usage?.event_id, "error", undefined, undefined, (error as { retryable?: boolean })?.retryable ? "PROVIDER_UNAVAILABLE" : "PROCESSING_FAILED");
    await updateJob(documentId, { status: (error as { retryable?: boolean })?.retryable ? "retry" : "failed", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: String((error as Error)?.message ?? error).slice(0, 1000) });
    if ((error as { retryable?: boolean })?.retryable) {
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending" }) });
      const providerStatus = Number((error as { providerStatus?: number })?.providerStatus || 0);
      return response({ error: (error as { userMessage?: string })?.userMessage || "As IAs estão com alta demanda agora. O PDF foi salvo, não consumiu a cota diária e continua aguardando análise.", retryable: true, code: providerStatus === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_UNAVAILABLE", attempts: (error as { attempts?: ProviderAttempt[] })?.attempts || [] }, providerStatus === 429 ? 429 : 503);
    }
    await setDocumentStatus(documentId, user.id, "error");
    const providerStatus = Number((error as { providerStatus?: number })?.providerStatus || 0);
    return response({ error: (error as { userMessage?: string })?.userMessage || `Falha ao gerar o conteúdo do PDF${providerStatus ? ` (provedor ${providerStatus})` : ""}. Consulte os logs de material-gemini para ver o detalhe.`, code: "PROCESSING_FAILED" }, 500);
  }
});
