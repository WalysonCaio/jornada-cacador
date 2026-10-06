const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
// Static names are only the emergency fallback. The function asks Gemini which
// generateContent models are actually enabled for this API key before each job.
const GEMINI_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const FALLBACK_STATUS = new Set([400, 404]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseGeminiJsonText(data: any) {
  const raw = String(data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") ?? "").trim();
  if (!raw) throw new Error("EMPTY_GEMINI_RESPONSE");
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(unfenced); } catch { /* tenta extrair o objeto */ }
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
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

let discoveredModels: Promise<string[]> | null = null;
function normalizeModelName(value: unknown) { return String(value ?? "").replace(/^models\//, "").trim(); }
async function availableGeminiModels() {
  if (discoveredModels) return discoveredModels;
  discoveredModels = (async () => {
    const configured = normalizeModelName(Deno.env.get("GEMINI_MODEL"));
    try {
      const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": GEMINI_KEY } });
      const data = await list.json().catch(() => ({}));
      if (!list.ok) console.warn("Gemini models.list", list.status, data?.error?.message ?? "falha");
      const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use)/i;
      const enabled = Array.isArray(data?.models) ? data.models
        .filter((item: any) => Array.isArray(item?.supportedGenerationMethods) && item.supportedGenerationMethods.includes("generateContent"))
        .map((item: any) => normalizeModelName(item?.name))
        .filter((name: string) => name && !blocked.test(name))
        .sort((a: string, b: string) => {
          const score = (name: string) => (/flash(?!.*lite)/i.test(name) ? 0 : /flash-lite/i.test(name) ? 1 : /pro/i.test(name) ? 2 : 3) + (/preview|experimental|exp/i.test(name) ? 4 : 0);
          return score(a) - score(b) || a.localeCompare(b);
        }) : [];
      const candidates = [configured, ...enabled, ...GEMINI_MODEL_FALLBACKS].filter(Boolean);
      const unique = [...new Set(candidates)].slice(0, 8);
      console.log("Gemini model candidates", unique);
      return unique;
    } catch (error) {
      console.warn("Gemini model discovery failed", String((error as Error)?.message ?? error));
      return [...new Set([configured, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))];
    }
  })();
  return discoveredModels;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function reserveUsage(userId: string, campaignId: string, operation: "material" | "exam") {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: operation, p_daily_limit: 10 }),
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

async function updateJob(documentId: string, values: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs?document_id=eq.${encodeURIComponent(documentId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) }).catch(() => undefined);
}

async function createDocumentInventory(file: { uri: string; mimeType?: string }, title: string) {
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
  for (const model of await availableGeminiModels()) {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify(requestBody) });
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

async function generateStudyPackage(file: { uri: string; mimeType?: string }, title: string, campaignContext: string, documentType: string, inventory: any) {
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
  const models = await availableGeminiModels();
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const bodies = [requestBody, relaxedGenerationBody(requestBody)];
    for (let attempt = 0; attempt < bodies.length; attempt++) {
      const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
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

async function reviewGeneratedQuestions(summaries: unknown[], campaignContext: string) {
  const compact = summaries.map((summary: any, summaryIndex) => ({ summary_index: summaryIndex, subject: summary?.subject, title: summary?.title, questions: summary?.questions })).slice(0, 24);
  const model = (await availableGeminiModels())[0];
  if (!model) return summaries;
  const review = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
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

async function uploadPdfToGemini(bytes: Uint8Array, title: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_KEY,
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
      await removeGeminiFile(file.name);
      const failed = new Error(file.error?.message || "O Gemini não conseguiu preparar o PDF.") as Error & { retryable?: boolean; userMessage?: string };
      failed.retryable = true;
      failed.userMessage = "O Gemini não conseguiu preparar o PDF agora. O arquivo continua salvo e a tentativa não consumiu sua cota.";
      throw failed;
    }
    await wait(1500);
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": GEMINI_KEY } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      if (RETRYABLE_STATUS.has(statusResponse.status)) continue;
      await removeGeminiFile(file.name);
      const statusError = new Error(statusData?.error?.message || `Falha ao consultar o PDF no Gemini (${statusResponse.status}).`) as Error & { retryable?: boolean; providerStatus?: number; userMessage?: string };
      statusError.retryable = true;
      statusError.providerStatus = statusResponse.status;
      statusError.userMessage = "O PDF foi enviado, mas a IA não confirmou que ele está pronto. O arquivo continua salvo para tentar novamente.";
      throw statusError;
    }
    Object.assign(file, statusData);
  }
  await removeGeminiFile(file.name);
  const timeout = new Error("Tempo excedido aguardando o Gemini preparar o PDF.") as Error & { retryable?: boolean; userMessage?: string };
  timeout.retryable = true;
  timeout.userMessage = "O Gemini demorou para preparar o PDF. Ele continua salvo e esta tentativa não consumiu a cota; tente novamente em alguns minutos.";
  throw timeout;
}

async function removeGeminiFile(name?: string) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": GEMINI_KEY },
  }).catch(() => undefined);
}

function cleanGeneratedText(value: unknown, max = 4000) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeLegalNotation(value: unknown, max = 4000) {
  return cleanGeneratedText(value, max)
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
    explanation: cleanGeneratedText(value?.explanation, 18000),
    points: sanitizeStrings(value?.points, 15, 1200),
    example: cleanGeneratedText(value?.example, 6000),
    bizu: cleanGeneratedText(value?.bizu, 3000),
    mnemonic: cleanGeneratedText(value?.mnemonic, 2000),
    trap: cleanGeneratedText(value?.trap, 3000),
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
  const shallow = summaries.filter((summary) => summary.explanation.length < 700 || summary.points.length < 5 || summary.flashcards.length < 5).length;
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
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
    console.error("material-gemini configuration missing", { supabase: Boolean(SUPABASE_URL), serviceRole: Boolean(SERVICE_KEY), gemini: Boolean(GEMINI_KEY) });
    return response({ error: "A função de materiais não está configurada neste projeto Supabase. Confira SUPABASE_SERVICE_ROLE_KEY e GEMINI_API_KEY nos Secrets.", code: "MISSING_CONFIGURATION" }, 503);
  }
  const auth = request.headers.get("authorization") ?? "";
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: PUBLIC_KEY } });
  const user = authResponse.ok ? await authResponse.json() : null;
  if (!user?.id) return response({ error: "Sessão inválida. Entre novamente." }, 401);
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
    usage = await reserveUsage(user.id, campaignId, operation);
    if (!usage.allowed) {
      await updateJob(documentId, { status: usage.reason === "BUSY" ? "queued" : "retry", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: usage.reason });
      await setDocumentStatus(documentId, user.id, "pending");
      if (usage.reason === "DAILY_LIMIT") return response({ error: `Você atingiu o limite diário de ${usage.limit || 10} análises de arquivo concluídas. O arquivo está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return response({ error: "Já existe uma análise em andamento. Este PDF entrou na fila e será o próximo.", retryable: true, queued: true, code: "BUSY" }, 409);
      if (usage.reason === "USAGE_GUARD_MISSING") return response({ error: "A tabela de controle de IA não existe neste projeto Supabase. Execute a migração 20261003_v60_fair_ai_quota.sql no projeto correto.", retryable: true, code: usage.reason }, 503);
      return response({ error: "A proteção de consumo está temporariamente indisponível. Confira os logs da função material-gemini.", retryable: true, code: usage.reason }, 503);
    }
    const geminiFile = await uploadPdfToGemini(bytes, title);
    let generated;
    let inventory: any = documents[0]?.metadata?.analysis_plan;
    try {
      if (!Array.isArray(inventory?.sections) || !inventory.sections.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_progress: { stage: "inventory", percent: 10, updated_at: new Date().toISOString() } } }) });
        inventory = await createDocumentInventory(geminiFile, title);
        await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_plan: inventory, analysis_progress: { stage: "generation", percent: 30, completed_sections: 0, total_sections: Array.isArray(inventory.sections) ? inventory.sections.length : 0, updated_at: new Date().toISOString() } } }) });
      }
      generated = await generateStudyPackage(geminiFile, title, campaignContext, documentType, inventory);
    } finally {
      await removeGeminiFile(geminiFile.name);
    }
    const parsed: any = generated.parsed;
    const generatedSummaries = Array.isArray(parsed.summaries) ? parsed.summaries : [];
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ metadata: { ...(documents[0]?.metadata || {}), analysis_plan: inventory, analysis_progress: { stage: "review", percent: 75, completed_sections: parsed?.coverage?.sections_covered?.length || 0, total_sections: inventory?.sections?.length || 0, updated_at: new Date().toISOString() } } }) });
    // A própria geração já exige questões revisadas e a sanitização abaixo faz a
    // validação determinística. Evitar uma terceira chamada grande reduz timeout,
    // consumo de cota e falhas depois de o PDF já ter sido lido com sucesso.
    const rawSummaries = generatedSummaries;
    const summaries = rawSummaries.map((content: Record<string, unknown>) => sanitizeSummary(content, knownSubjects)).filter((content: { title?: string; explanation?: string }) => Boolean(content.title && content.explanation));
    if (!summaries.length) { await finishUsage(usage.event_id,"error",undefined,undefined,"INSUFFICIENT_CONTENT");await updateJob(documentId,{status:"failed",last_error:"INSUFFICIENT_CONTENT"});return response({ error: "Não encontrei conteúdo de estudo suficiente no PDF." }, 422); }
    const coverage = coverageReport(parsed?.coverage, summaries);
    const grosslyIncomplete = (coverage.sections_detected.length >= 3 && coverage.percent < 50) || coverage.confidence < 0.35 || coverage.shallow_summaries > Math.ceil(summaries.length / 2);
    if (grosslyIncomplete) {
      await finishUsage(usage.event_id, "error", "gemini", generated.model, "LOW_COVERAGE");
      await updateJob(documentId, { status: "failed", last_error: "LOW_COVERAGE" });
      return response({ error: "A análise não atingiu a cobertura mínima de segurança e não substituiu nenhum conteúdo anterior. Tente novamente; se o PDF for digitalizado, gere uma versão com OCR ou divida-o por capítulos.", coverage }, 422);
    }
    const rows = summaries.map((content: Record<string, unknown>) => ({ campaign_id: campaignId, user_id: user.id, source_document_id: documentId, content_type: "summary", title: String(content.title ?? "Resumo"), content: { ...content, source: title }, source_refs: [{ document_id: documentId, title }] }));
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(rows) });
    if (!saved.ok) { console.error("Database", saved.status, await saved.text());await finishUsage(usage.event_id,"error",undefined,undefined,"CONTENT_SAVE_FAILED");await updateJob(documentId,{status:"retry",last_error:"CONTENT_SAVE_FAILED"});return response({ error: "O conteúdo foi criado, mas não pôde ser salvo." }, 502); }
    const savedRows = await saved.json().catch(() => []);
    const newIds = Array.isArray(savedRows) ? savedRows.map((row: { id?: string }) => row.id).filter(Boolean) : [];
    if (newIds.length) {
      const cleanup = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${documentId}&id=not.in.(${newIds.join(",")})`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
      if (!cleanup.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?id=in.(${newIds.join(",")})`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
        await finishUsage(usage.event_id, "error", undefined, undefined, "CONTENT_REPLACE_FAILED");
        await updateJob(documentId, { status: "retry", last_error: "CONTENT_REPLACE_FAILED" });
        return response({ error: "A nova análise ficou pronta, mas não foi possível substituir a versão anterior com segurança. O conteúdo anterior foi preservado." }, 502);
      }
    }
    const subjectCounts = summaries.reduce((counts: Record<string, number>, item: Record<string, unknown>) => { const subject = cleanGeneratedText(item.subject || "Conteúdo", 200);counts[subject] = (counts[subject] || 0) + 1;return counts; }, {});
    const detectedSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Conteúdo geral";
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", detected_subject: detectedSubject, metadata: { ...(documents[0]?.metadata || {}), primary_subject: detectedSubject, subjects: Object.keys(subjectCounts), analyzed_at: new Date().toISOString(), analysis_plan: inventory, analysis_progress: { stage: "completed", percent: 100, completed_sections: coverage.sections_covered.length, total_sections: coverage.sections_detected.length, updated_at: new Date().toISOString() }, coverage } }) });
    await fetch(`${SUPABASE_URL}/rest/v1/document_fingerprints`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id, document_id: documentId, sha256: fingerprint, byte_size: bytes.byteLength }) });
    await finishUsage(usage.event_id, "success", "gemini", generated.model);
    await updateJob(documentId, { status: "completed", last_error: null });
    return response({ summaries: summaries.length, flashcards: summaries.reduce((n: number, x: { flashcards?: unknown[] }) => n + (x.flashcards?.length ?? 0), 0), questions: summaries.reduce((n: number, x: { questions?: unknown[] }) => n + (x.questions?.length ?? 0), 0), coverage, provider: "gemini", model: generated.model });
  } catch (error) {
    console.error("material-gemini", error);
    await finishUsage(usage?.event_id, "error", undefined, undefined, (error as { retryable?: boolean })?.retryable ? "PROVIDER_UNAVAILABLE" : "PROCESSING_FAILED");
    await updateJob(documentId, { status: (error as { retryable?: boolean })?.retryable ? "retry" : "failed", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: String((error as Error)?.message ?? error).slice(0, 1000) });
    if ((error as { retryable?: boolean })?.retryable) {
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending" }) });
      const providerStatus = Number((error as { providerStatus?: number })?.providerStatus || 0);
      return response({ error: (error as { userMessage?: string })?.userMessage || "As IAs estão com alta demanda agora. O PDF foi salvo, não consumiu a cota diária e continua aguardando análise.", retryable: true, code: providerStatus === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_UNAVAILABLE" }, providerStatus === 429 ? 429 : 503);
    }
    await setDocumentStatus(documentId, user.id, "error");
    const providerStatus = Number((error as { providerStatus?: number })?.providerStatus || 0);
    return response({ error: (error as { userMessage?: string })?.userMessage || `Falha ao gerar o conteúdo do PDF${providerStatus ? ` (Gemini ${providerStatus})` : ""}. Consulte os logs de material-gemini para ver o detalhe.`, code: "PROCESSING_FAILED" }, 500);
  }
});
