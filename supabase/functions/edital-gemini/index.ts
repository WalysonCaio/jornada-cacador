import { claimAiRequest, finishAiRequest, guardResponse } from "../_shared/ai-guard.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
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

  let guard;
  try {
    guard = await claimAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, user.id, "analysis", documentId);
    if (!guard.allowed) {
      const denied = guardResponse(guard);
      return reply(request, denied.body, denied.status);
    }
    const fileResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!fileResponse.ok) { await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "FILE_READ"); return reply(request, { error: "Não foi possível abrir o PDF armazenado." }, 502); }
    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) { await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "FILE_TOO_LARGE"); return reply(request, { error: "O edital deve ter no máximo 50 MB para análise." }, 413); }
    const geminiFile = await uploadPdfToGemini(bytes, title);

    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [
          { file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } },
          { text: "Extraia somente o conteúdo programático deste edital. Retorne JSON com topics: lista de objetos subject, unit e topic. Preserve a ordem, não invente tópicos e ignore inscrições, cronogramas, remuneração e regras administrativas." },
        ] }],
        generationConfig: {
          temperature: 0.1, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { topics: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, unit: { type: "STRING" }, topic: { type: "STRING" } }, required: ["subject", "topic"] } } }, required: ["topics"] },
        },
      }),
    });
    const geminiData = await geminiResponse.json();
    await removeGeminiFile(geminiFile.name);
    if (!geminiResponse.ok) {
      console.error("Gemini", geminiResponse.status, geminiData);
      await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", String(geminiResponse.status));
      return reply(request, {
        error: geminiResponse.status === 429
          ? "Erro 429: a cota gratuita do Gemini foi atingida. O edital continua salvo; tente novamente mais tarde."
          : geminiData?.error?.message ?? "O Gemini não conseguiu analisar o edital.",
        code: geminiResponse.status === 429 ? "PROVIDER_429" : "AI_ERROR",
      }, geminiResponse.status === 429 ? 429 : 502);
    }
    const parsed = JSON.parse(geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 1500) : [];
    const uniqueTopics: Array<{ subject: string; unit: string; topic: string }> = [];
    const seenTopics = new Set<string>();
    const normalizeKey = (value: unknown) => String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("pt-BR");

    for (const item of topics) {
      const subject = String(item?.subject ?? "Edital").replace(/\s+/g, " ").trim() || "Edital";
      const unit = String(item?.unit ?? "").replace(/\s+/g, " ").trim();
      const topic = String(item?.topic ?? "").replace(/\s+/g, " ").trim();
      if (!topic) continue;

      // O Gemini pode repetir um tópico em partes diferentes do edital.
      // A tabela aceita apenas um mesmo tópico por disciplina e campanha.
      const key = `${normalizeKey(subject)}\u0000${normalizeKey(topic)}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
      uniqueTopics.push({ subject, unit, topic });
    }
    if (!uniqueTopics.length) { await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "EMPTY_CONTENT"); return reply(request, { error: "Não encontrei o conteúdo programático neste PDF." }, 422); }

    const cleared = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${campaignId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!cleared.ok) {
      console.error("campaign_topics delete", cleared.status, await cleared.text());
      await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "DATABASE_CLEAR");
      return reply(request, { error: "Não foi possível preparar o mapa anterior para a nova análise." }, 502);
    }
    const rows = uniqueTopics.map((item, index: number) => ({ campaign_id: campaignId, user_id: user.id, subject: item.subject, unit_name: item.unit, topic: item.topic, edital_order: index }));
    const inserted = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics`, { method: "POST", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" }, body: JSON.stringify(rows) });
    if (!inserted.ok) {
      const detail = await inserted.text();
      console.error("campaign_topics insert", inserted.status, detail);
      await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "DATABASE_SAVE");
      return reply(request, { error: `O edital foi analisado, mas os tópicos não puderam ser salvos (${inserted.status}).`, detail }, 502);
    }
    const savedTopics = await inserted.json();
    if (!Array.isArray(savedTopics) || savedTopics.length === 0) {
      await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini", "error", "DATABASE_EMPTY");
      return reply(request, { error: "O edital foi analisado, mas nenhum tópico foi confirmado no banco." }, 502);
    }
    await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, { method: "PATCH", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ processing_status: "ready" }) });
    await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard.job_id, "gemini");
    return reply(request, { topics: uniqueTopics, saved: savedTopics.length, provider: "gemini" });
  } catch (error) {
    console.error("edital-gemini", error);
    await finishAiRequest(SUPABASE_URL, SERVICE_ROLE_KEY, guard?.job_id, "gemini", "error", String(error));
    return reply(request, { error: "Falha interna ao interpretar o edital." }, 500);
  }
});
