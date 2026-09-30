const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const ALLOWED_ORIGINS = new Set([
  "https://jornada.wcaio.workers.dev",
  "https://jornada-cacador.j32341472.chatgpt.site",
  "http://localhost:4173",
]);

function cors(request: Request) {
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
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateStudyPackage(file: { uri: string; mimeType?: string }, title: string) {
  const requestBody = {
    contents: [{ parts: [
      { file_data: { mime_type: file.mimeType ?? "application/pdf", file_uri: file.uri } },
      { text: `Crie um pacote de estudo fiel exclusivamente a este PDF. Divida em até 12 assuntos. Para cada assunto produza: disciplina, título, aula escrita detalhada para iniciante, 5 a 10 pontos essenciais, exemplo explicado, bizu de prova, mnemônico útil, pegadinha frequente, 5 a 8 flashcards e 5 questões de múltipla escolha.

As questões devem avaliar compreensão e aplicação, não apenas memorização. Use enunciados claros, situações práticas quando o material permitir, quatro alternativas plausíveis e apenas uma correta. Inclua dificuldade (facil, medio ou dificil), tópico e uma explicação comentada que justifique a alternativa correta e, de forma breve, mostre o erro conceitual das demais. Não use alternativas obviamente absurdas, não repita o enunciado e não invente lei, artigo, dado ou conteúdo ausente. O arquivo se chama: ${title}.` },
    ] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { summaries: { type: "ARRAY", items: { type: "OBJECT", properties: {
        subject: { type: "STRING" }, title: { type: "STRING" }, explanation: { type: "STRING" }, points: { type: "ARRAY", items: { type: "STRING" } }, example: { type: "STRING" }, bizu: { type: "STRING" }, mnemonic: { type: "STRING" }, trap: { type: "STRING" }, flashcards: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } }, questions: { type: "ARRAY", items: { type: "OBJECT", properties: { statement: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, correct_index: { type: "INTEGER", minimum: 0, maximum: 3 }, explanation: { type: "STRING" }, difficulty: { type: "STRING", enum: ["facil", "medio", "dificil"] }, topic: { type: "STRING" } }, required: ["statement", "options", "correct_index", "explanation", "difficulty", "topic"] } }
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

Deno.serve(async (request) => {
  const headers = cors(request);
  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const auth = request.headers.get("authorization") ?? "";
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: PUBLIC_KEY } });
  const user = authResponse.ok ? await authResponse.json() : null;
  if (!user?.id) return response({ error: "Sessão inválida. Entre novamente." }, 401);
  const input = await request.json().catch(() => null);
  const path = String(input?.storage_path ?? ""), campaignId = String(input?.campaign_id ?? ""), documentId = String(input?.document_id ?? ""), title = String(input?.title ?? "PDF enviado");
  if (!path || !campaignId || !documentId) return response({ error: "Dados do documento incompletos." }, 400);
  if (!path.startsWith(`${user.id}/`)) return response({ error: "Documento de outra conta." }, 403);
  try {
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!file.ok) return response({ error: "Não foi possível abrir o PDF." }, 502);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) return response({ error: "O PDF deve ter no máximo 50 MB para geração automática." }, 413);
    const geminiFile = await uploadPdfToGemini(bytes, title);
    let generated;
    try {
      generated = await generateStudyPackage(geminiFile, title);
    } finally {
      await removeGeminiFile(geminiFile.name);
    }
    const aiData = generated.data;
    const parsed = JSON.parse(aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const summaries = Array.isArray(parsed.summaries) ? parsed.summaries : [];
    if (!summaries.length) return response({ error: "Não encontrei conteúdo de estudo suficiente no PDF." }, 422);
    await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${documentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    const rows = summaries.map((content: Record<string, unknown>) => ({ campaign_id: campaignId, user_id: user.id, source_document_id: documentId, content_type: "summary", title: String(content.title ?? "Resumo"), content: { ...content, source: title }, source_refs: [{ document_id: documentId, title }] }));
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(rows) });
    if (!saved.ok) { console.error("Database", saved.status, await saved.text()); return response({ error: "O conteúdo foi criado, mas não pôde ser salvo." }, 502); }
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready" }) });
    return response({ summaries: summaries.length, flashcards: summaries.reduce((n: number, x: { flashcards?: unknown[] }) => n + (x.flashcards?.length ?? 0), 0), questions: summaries.reduce((n: number, x: { questions?: unknown[] }) => n + (x.questions?.length ?? 0), 0), provider: "gemini", model: generated.model });
  } catch (error) {
    console.error("material-gemini", error);
    if ((error as { retryable?: boolean })?.retryable) {
      await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "pending" }) });
      return response({ error: "As IAs estão com alta demanda agora. O PDF foi salvo e continua aguardando análise. Tente novamente em alguns minutos.", retryable: true }, 503);
    }
    return response({ error: "Falha interna ao gerar o conteúdo do PDF." }, 500);
  }
});
