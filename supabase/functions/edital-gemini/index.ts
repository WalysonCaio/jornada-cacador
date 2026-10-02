const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const ALLOWED_ORIGINS = new Set([
  "https://jornada.wcaio.workers.dev",
  "https://jornada-cacador.j32341472.chatgpt.site",
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

async function uploadPdfToGemini(bytes: Uint8Array, title: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
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
    headers: { "x-goog-api-key": GEMINI_API_KEY },
  }).catch(() => undefined);
}

async function reserveUsage(userId: string, campaignId: string) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: "edital", p_daily_limit: 5 }) });
  return result.ok ? await result.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
}

async function finishUsage(eventId: number | undefined, status: "success" | "error", errorCode?: string) {
  if (!eventId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: "gemini", model: "gemini-3.5-flash-lite", error_code: errorCode || null }) }).catch(() => undefined);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return reply(request, { error: "Método não permitido." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "Authorization": authorization, "apikey": PUBLISHABLE_KEY } });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (!user?.id) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  if (!GEMINI_API_KEY) return reply(request, { error: "GEMINI_API_KEY não configurada." }, 503);

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
  let usage: { allowed?: boolean; event_id?: number; reason?: string; limit?: number } | null = null;
  try {
    const campaignResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_campaigns?id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,name&limit=1`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    const campaigns = campaignResponse.ok ? await campaignResponse.json() : [];
    if (!Array.isArray(campaigns) || !campaigns[0]?.id) return reply(request, { error: "Este portal não pertence à conta conectada." }, 403);
    usage = await reserveUsage(user.id, campaignId);
    if (!usage.allowed) {
      if (usage.reason === "DAILY_LIMIT") return reply(request, { error: `Você atingiu o limite diário de ${usage.limit || 5} análises. O edital está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return reply(request, { error: "Já existe um PDF sendo analisado. Este edital continuará aguardando na fila.", retryable: true, queued: true, code: "BUSY" }, 409);
      return reply(request, { error: "A proteção de consumo está temporariamente indisponível.", retryable: true }, 503);
    }
    const campaignName = String(payload?.campaign_name ?? campaigns[0]?.name ?? "").trim();
    const fileResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!fileResponse.ok) { await finishUsage(usage.event_id,"error","FILE_READ_FAILED");return reply(request, { error: "Não foi possível abrir o PDF armazenado." }, 502); }
    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) { await finishUsage(usage.event_id,"error","FILE_TOO_LARGE");return reply(request, { error: "O edital deve ter no máximo 50 MB para análise." }, 413); }
    const geminiFile = await uploadPdfToGemini(bytes, title);
    geminiFileName = geminiFile.name;

    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [
          { file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } },
          { text: `Você é um analista de editais de concursos públicos brasileiros. Analise exclusivamente o PDF anexado e extraia o conteúdo programático que realmente gera matérias de estudo e missões.

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
11. Em meta, informe detected_scope, confidence de 0 a 1 e warnings objetivos.

Retorne somente o JSON solicitado.` },
        ] }],
        generationConfig: {
          temperature: 0.1, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: {
            meta: { type: "OBJECT", properties: { detected_scope: { type: "STRING" }, confidence: { type: "NUMBER" }, warnings: { type: "ARRAY", items: { type: "STRING" } } }, required: ["detected_scope", "confidence", "warnings"] },
            topics: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, unit: { type: "STRING" }, topic: { type: "STRING" }, subject_order: { type: "INTEGER" }, learning_order: { type: "INTEGER" }, difficulty: { type: "STRING", enum: ["basic", "intermediate", "advanced"] }, prerequisite_topic: { type: "STRING" }, pedagogical_reason: { type: "STRING" } }, required: ["subject", "topic", "subject_order", "learning_order", "difficulty", "prerequisite_topic", "pedagogical_reason"] } }
          }, required: ["meta", "topics"] },
        },
      }),
    });
    const geminiData = await geminiResponse.json();
    await removeGeminiFile(geminiFile.name);
    geminiFileName = undefined;
    if (!geminiResponse.ok) { console.error("Gemini", geminiResponse.status, geminiData);await finishUsage(usage.event_id,"error",geminiResponse.status===429?"PROVIDER_429":"PROVIDER_ERROR");return reply(request, { error: geminiResponse.status===429?"A cota gratuita do Gemini foi atingida (erro 429). O edital está salvo; tente novamente após a renovação da cota.":geminiData?.error?.message ?? "O Gemini não conseguiu analisar o edital.",retryable:geminiResponse.status===429,code:geminiResponse.status===429?"PROVIDER_429":"AI_ERROR" }, geminiResponse.status===429?429:502); }
    const parsed = JSON.parse(geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const meta = {
      detected_scope: String(parsed?.meta?.detected_scope ?? campaignName ?? title).trim(),
      confidence: Math.max(0, Math.min(1, Number(parsed?.meta?.confidence ?? 0))),
      warnings: Array.isArray(parsed?.meta?.warnings) ? parsed.meta.warnings.map((warning: unknown) => String(warning).trim()).filter(Boolean).slice(0, 10) : [],
    };
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

      // O Gemini pode repetir um tópico em partes diferentes do edital.
      // A tabela aceita apenas um mesmo tópico por disciplina e campanha.
      const key = `${normalizeKey(subject)}\u0000${normalizeKey(topic)}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
      const difficulty = ["basic", "intermediate", "advanced"].includes(String(item?.difficulty)) ? String(item.difficulty) : "basic";
      uniqueTopics.push({ subject, unit, topic, edital_order: originalIndex, subject_order: Math.max(0, Number(item?.subject_order)||0), learning_order: Math.max(0, Number(item?.learning_order)||0), difficulty, prerequisite_topic: String(item?.prerequisite_topic??"").trim(), pedagogical_reason: String(item?.pedagogical_reason??"").trim().slice(0,500) });
    }
    if (uniqueTopics.length < 3) { await finishUsage(usage.event_id,"error","INSUFFICIENT_TOPICS");return reply(request, { error: "A análise não encontrou conteúdo programático suficiente com segurança. Confira se o PDF contém as disciplinas e se o nome do portal corresponde ao cargo." }, 422); }
    if (meta.confidence < 0.65) meta.warnings.unshift("A IA indicou baixa confiança na identificação do cargo ou do conteúdo programático. Revise o mapa antes de iniciar as missões.");

    const cleared = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${campaignId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!cleared.ok) {
      console.error("campaign_topics delete", cleared.status, await cleared.text());
      await finishUsage(usage.event_id,"error","MAP_CLEAR_FAILED");return reply(request, { error: "Não foi possível preparar o mapa anterior para a nova análise." }, 502);
    }
    const rows = uniqueTopics.map((item) => ({ campaign_id: campaignId, user_id: user.id, subject: item.subject, unit_name: item.unit, topic: item.topic, edital_order: item.edital_order, subject_order: item.subject_order, learning_order: item.learning_order, difficulty: item.difficulty, prerequisite_topic: item.prerequisite_topic || null, pedagogical_reason: item.pedagogical_reason || null }));
    const inserted = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics`, { method: "POST", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" }, body: JSON.stringify(rows) });
    if (!inserted.ok) {
      const detail = await inserted.text();
      console.error("campaign_topics insert", inserted.status, detail);
      await finishUsage(usage.event_id,"error","TOPICS_SAVE_FAILED");return reply(request, { error: `O edital foi analisado, mas os tópicos não puderam ser salvos (${inserted.status}).`, detail }, 502);
    }
    const savedTopics = await inserted.json();
    if (!Array.isArray(savedTopics) || savedTopics.length === 0) {
      await finishUsage(usage.event_id,"error","TOPICS_EMPTY");return reply(request, { error: "O edital foi analisado, mas nenhum tópico foi confirmado no banco." }, 502);
    }
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready" }) });
    await finishUsage(usage.event_id, "success");
    return reply(request, { topics: uniqueTopics, saved: savedTopics.length, provider: "gemini", meta });
  } catch (error) {
    console.error("edital-gemini", error);
    await finishUsage(usage?.event_id, "error", "PROCESSING_FAILED");
    return reply(request, { error: "Falha interna ao interpretar o edital." }, 500);
  } finally {
    await removeGeminiFile(geminiFileName);
  }
});
