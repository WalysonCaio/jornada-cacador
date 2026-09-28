import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: PUBLIC_KEY },
    });
    const user = userResponse.ok ? await userResponse.json() : null;
    if (!user?.id || !user?.email) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const payload = await request.json().catch(() => null);
    if (!["delete_account", "delete_document"].includes(payload?.action) || typeof payload?.password !== "string") {
      return json({ error: "Solicitação inválida." }, 400);
    }

    const passwordCheck = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: payload.password }),
    });
    if (!passwordCheck.ok) return json({ error: "Senha incorreta." }, 401);

    if (payload.action === "delete_document") {
      const documentId = String(payload.document_id ?? "");
      if (!documentId) return json({ error: "Documento não informado." }, 400);
      const documentResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${user.id}&select=id,storage_path,document_type,campaign_id&limit=1`,
        { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
      );
      const documents = documentResponse.ok ? await documentResponse.json() : [];
      const document = documents?.[0];
      if (!document) return json({ error: "Arquivo não encontrado ou não pertence à sua conta." }, 404);
      if (document.storage_path) {
        const storageDelete = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${document.storage_path}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
        if (!storageDelete.ok && storageDelete.status !== 404) {
          return json({ error: "Não foi possível liberar o espaço do arquivo no Storage." }, 502);
        }
      }
      await fetch(`${SUPABASE_URL}/rest/v1/generated_study_content?source_document_id=eq.${documentId}&user_id=eq.${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      });
      if (document.document_type === "edital" && document.campaign_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${document.campaign_id}&user_id=eq.${user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
      }
      const deleted = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${documentId}&user_id=eq.${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      });
      if (!deleted.ok) return json({ error: "O arquivo saiu do Storage, mas o registro não pôde ser excluído." }, 502);
      return json({ deleted: true, document_type: document.document_type, campaign_id: document.campaign_id });
    }

    const documentsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/study_documents?user_id=eq.${user.id}&select=storage_path`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
    );
    if (documentsResponse.ok) {
      const documents = await documentsResponse.json();
      for (const document of documents) {
        if (!document.storage_path) continue;
        await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${document.storage_path}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
      }
    }

    const deleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    if (!deleteResponse.ok) {
      console.error("delete-user", deleteResponse.status, await deleteResponse.text());
      return json({ error: "Não foi possível excluir a conta agora." }, 502);
    }

    return json({ deleted: true });
  } catch (error) {
    console.error("account-security", error);
    return json({ error: "Falha interna ao excluir a conta." }, 500);
  }
});
