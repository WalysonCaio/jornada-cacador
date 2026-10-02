const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function reserveUsage(userId: string, campaignId: string, operation: "material" | "exam") {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: operation, p_daily_limit: 5 }),
  });
  return result.ok ? await result.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
}

async function finishUsage(eventId: number | undefined, status: "success" | "error" | "cached", provider?: string, model?: string, errorCode?: string) {
  if (!eventId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: provider || null, model: model || null, error_code: errorCode || null }) }).catch(() => undefined);
}

async function updateJob(documentId: string, values: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs?document_id=eq.${encodeURIComponent(documentId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) }).catch(() => undefined);
}

async function generateStudyPackage(file: { uri: string; mimeType?: string }, title: string, campaignContext: string, documentType: string) {
  const requestBody = {
    contents: [{ parts: [
      { file_data: { mime_type: file.mimeType ?? "application/pdf", file_uri: file.uri } },
      { text: `Crie um pacote de estudo fiel exclusivamente ao PDF anexado e alinhado ao edital da campanha abaixo. Divida em até 12 assuntos. Para cada assunto produza: disciplina, título, aula escrita detalhada para iniciante, 5 a 10 pontos essenciais, exemplo explicado, bizu de prova, mnemônico útil, pegadinha frequente, 5 a 8 flashcards e exatamente 5 questões de múltipla escolha.

CONTEXTO DA CAMPANHA:
${campaignContext || "Edital ainda não disponível; use somente o PDF."}

TIPO DO DOCUMENTO: ${documentType}. ${["prova", "simulado"].includes(documentType) ? "Extraia e classifique as questões existentes no PDF por disciplina, tópico, banca e ano quando esses dados estiverem expressos. Preserve o sentido e marque como adaptada_do_pdf; não invente identificação oficial." : "Produza conteúdo didático e questões de fixação com base no material."}

PADRÃO OBRIGATÓRIO DAS QUESTÕES:
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

O arquivo se chama: ${title}.` },
    ] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { summaries: { type: "ARRAY", items: { type: "OBJECT", properties: {
        subject: { type: "STRING" }, title: { type: "STRING" }, explanation: { type: "STRING" }, points: { type: "ARRAY", items: { type: "STRING" } }, example: { type: "STRING" }, bizu: { type: "STRING" }, mnemonic: { type: "STRING" }, trap: { type: "STRING" }, flashcards: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } }, questions: { type: "ARRAY", minItems: 5, maxItems: 5, items: { type: "OBJECT", properties: { statement: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, correct_index: { type: "INTEGER", minimum: 0, maximum: 3 }, explanation: { type: "STRING" }, difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] }, topic: { type: "STRING" }, origin: { type: "STRING", enum: ["autoral", "adaptada_do_pdf"] } }, required: ["statement", "options", "correct_index", "explanation", "difficulty", "topic", "origin"] } }
      }, required: ["subject", "title", "explanation", "points", "example", "bizu", "mnemonic", "trap", "flashcards", "questions"] } } }, required: ["summaries"] },
    },
  };

  let lastError = "O serviço de IA está temporariamente indisponível.";
  for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
    const model = GEMINI_MODELS[modelIndex];
    for (let attempt = 0; attempt < 2; attempt++) {
      const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify(requestBody),
      });
      const data = await ai.json().catch(() => ({}));
      if (ai.ok) return { data, model };
      lastError = data?.error?.message ?? `Falha no modelo ${model} (${ai.status}).`;
      console.warn("Gemini fallback", model, attempt + 1, ai.status, lastError);
      if (!RETRYABLE_STATUS.has(ai.status)) throw new Error(lastError);
      if (attempt === 0) await wait(900 * (modelIndex + 1));
    }
  }
  const unavailable = new Error(lastError) as Error & { retryable?: boolean };
  unavailable.retryable = true;
  throw unavailable;
}

async function reviewGeneratedQuestions(summaries: unknown[], campaignContext: string) {
  const compact = summaries.map((summary: any, summaryIndex) => ({ summary_index: summaryIndex, subject: summary?.subject, title: summary?.title, questions: summary?.questions })).slice(0, 12);
  const model = GEMINI_MODELS[0];
  const review = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Atue como revisor independente de questões de concurso. Revise o conjunto JSON abaixo usando apenas as informações contidas nele e o contexto do edital. Corrija português, ambiguidade, gabarito incompatível com a explicação e alternativas óbvias ou de tema diferente. Mantenha exatamente quatro alternativas, uma única correta e a progressão 1 fácil, 2 médias e 2 difíceis por resumo. Se não for possível corrigir com segurança, remova a questão. Nunca transforme uma questão autoral em oficial.\n\nCONTEXTO:\n${campaignContext}\n\nQUESTÕES:\n${JSON.stringify(compact)}` }] }],
      generationConfig: {
        temperature: 0.05,
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
  const data = await uploaded.json();
  if (!uploaded.ok || !data?.file?.uri) throw new Error(data?.error?.message ?? `Falha ao enviar PDF ao Gemini (${uploaded.status}).`);
  return data.file as { uri: string; name?: string; mimeType?: string };
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
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
    const documentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&storage_path=eq.${encodeURIComponent(path)}&select=id,document_type&limit=1`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const documents = documentResponse.ok ? await documentResponse.json() : [];
    if (!Array.isArray(documents) || !documents[0]?.id) return response({ error: "O documento não pertence a este portal." }, 403);
    const topicsResponse = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=subject,topic&order=edital_order.asc&limit=500`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const editalTopics = topicsResponse.ok ? await topicsResponse.json() : [];
    const campaignContext = [`Concurso: ${campaigns[0].name}`, campaigns[0].organization ? `Órgão: ${campaigns[0].organization}` : "", Array.isArray(editalTopics) && editalTopics.length ? `Conteúdo do edital: ${editalTopics.map((item: { subject?: string; topic?: string }) => `${item.subject}: ${item.topic}`).join("; ")}` : ""].filter(Boolean).join("\n").slice(0, 16000);
    const documentType = String(documents[0].document_type || "material");
    const operation = ["prova", "simulado"].includes(documentType) ? "exam" : "material";
    await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs?on_conflict=document_id,job_type`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, campaign_id: campaignId, document_id: documentId, job_type: operation, status: "processing", attempts: 1, locked_at: new Date().toISOString(), locked_by: "material-gemini" }) });
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!file.ok) return response({ error: "Não foi possível abrir o PDF." }, 502);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) return response({ error: "O PDF deve ter no máximo 50 MB para geração automática." }, 413);
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
          const cachedSubject = cachedSubjects[0] || "Conteúdo geral";
          await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", detected_subject: cachedSubject, metadata: { primary_subject: cachedSubject, subjects: [...new Set(cachedSubjects)], analyzed_at: new Date().toISOString(), reused_cache: true } }) });
          await updateJob(documentId, { status: "completed", last_error: null });
          return response({ cached: true, provider: "cache", message: "Este PDF já havia sido analisado. O conteúdo foi reutilizado sem consumir nova cota." });
        }
      }
    }
    usage = await reserveUsage(user.id, campaignId, operation);
    if (!usage.allowed) {
      await updateJob(documentId, { status: usage.reason === "BUSY" ? "queued" : "retry", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: usage.reason });
      if (usage.reason === "DAILY_LIMIT") return response({ error: `Você atingiu o limite diário de ${usage.limit || 5} análises de PDF. O arquivo está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return response({ error: "Já existe uma análise em andamento. Este PDF entrou na fila e será o próximo.", retryable: true, queued: true, code: "BUSY" }, 409);
      return response({ error: "A proteção de consumo está temporariamente indisponível.", retryable: true, code: usage.reason }, 503);
    }
    const geminiFile = await uploadPdfToGemini(bytes, title);
    let generated;
    try {
      generated = await generateStudyPackage(geminiFile, title, campaignContext, documentType);
    } finally {
      await removeGeminiFile(geminiFile.name);
    }
    const aiData = generated.data;
    const parsed = JSON.parse(aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const generatedSummaries = Array.isArray(parsed.summaries) ? parsed.summaries : [];
    const rawSummaries = await reviewGeneratedQuestions(generatedSummaries, campaignContext);
    const summaries = rawSummaries.map((content: Record<string, unknown>) => ({ ...content, subject: cleanGeneratedText(content.subject || "Conteúdo", 200), title: cleanGeneratedText(content.title || "Resumo", 300), questions: sanitizeQuestions(content.questions, cleanGeneratedText(content.title || "Assunto", 300)) })).filter((content: { title?: string }) => Boolean(content.title));
    if (!summaries.length) { await finishUsage(usage.event_id,"error",undefined,undefined,"INSUFFICIENT_CONTENT");await updateJob(documentId,{status:"failed",last_error:"INSUFFICIENT_CONTENT"});return response({ error: "Não encontrei conteúdo de estudo suficiente no PDF." }, 422); }
    await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${documentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const rows = summaries.map((content: Record<string, unknown>) => ({ campaign_id: campaignId, user_id: user.id, source_document_id: documentId, content_type: "summary", title: String(content.title ?? "Resumo"), content: { ...content, source: title }, source_refs: [{ document_id: documentId, title }] }));
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(rows) });
    if (!saved.ok) { console.error("Database", saved.status, await saved.text());await finishUsage(usage.event_id,"error",undefined,undefined,"CONTENT_SAVE_FAILED");await updateJob(documentId,{status:"retry",last_error:"CONTENT_SAVE_FAILED"});return response({ error: "O conteúdo foi criado, mas não pôde ser salvo." }, 502); }
    const subjectCounts = summaries.reduce((counts: Record<string, number>, item: Record<string, unknown>) => { const subject = cleanGeneratedText(item.subject || "Conteúdo", 200);counts[subject] = (counts[subject] || 0) + 1;return counts; }, {});
    const detectedSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Conteúdo geral";
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready", detected_subject: detectedSubject, metadata: { primary_subject: detectedSubject, subjects: Object.keys(subjectCounts), analyzed_at: new Date().toISOString() } }) });
    await fetch(`${SUPABASE_URL}/rest/v1/document_fingerprints`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id, document_id: documentId, sha256: fingerprint, byte_size: bytes.byteLength }) });
    await finishUsage(usage.event_id, "success", "gemini", generated.model);
    await updateJob(documentId, { status: "completed", last_error: null });
    return response({ summaries: summaries.length, flashcards: summaries.reduce((n: number, x: { flashcards?: unknown[] }) => n + (x.flashcards?.length ?? 0), 0), questions: summaries.reduce((n: number, x: { questions?: unknown[] }) => n + (x.questions?.length ?? 0), 0), provider: "gemini", model: generated.model });
  } catch (error) {
    console.error("material-gemini", error);
    await finishUsage(usage?.event_id, "error", undefined, undefined, (error as { retryable?: boolean })?.retryable ? "PROVIDER_UNAVAILABLE" : "PROCESSING_FAILED");
    await updateJob(documentId, { status: (error as { retryable?: boolean })?.retryable ? "retry" : "failed", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: String((error as Error)?.message ?? error).slice(0, 1000) });
    if ((error as { retryable?: boolean })?.retryable) {
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending" }) });
      return response({ error: "As IAs estão com alta demanda agora. O PDF foi salvo e continua aguardando análise. Tente novamente em alguns minutos.", retryable: true }, 503);
    }
    return response({ error: "Falha interna ao gerar o conteúdo do PDF." }, 500);
  }
});
