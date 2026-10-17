const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const ALLOWED_ORIGINS = new Set(["https://jornada.wcaio.workers.dev", "http://localhost:4173", "http://localhost:3000"]);

function cors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const headers = cors(request);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: PUBLIC_KEY } });
    const user = userResponse.ok ? await userResponse.json() : null;
    if (!user?.id || !user?.email) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const payload = await request.json().catch(() => null);
    const action = String(payload?.action ?? "");
    const allowedActions = ["delete_account", "reset_profile", "delete_document", "delete_campaign", "delete_essay"];
    if (!allowedActions.includes(action) || typeof payload?.password !== "string") return json({ error: "Solicitação inválida." }, 400);

    const passwordCheck = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: payload.password }),
    });
    if (!passwordCheck.ok) return json({ error: "Senha incorreta." }, 401);

    const serviceHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };
    const deleteStorageObject = async (path: string) => {
      const result = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${path}`, { method: "DELETE", headers: serviceHeaders });
      if (!result.ok && ![400, 404].includes(result.status)) throw new Error(`STORAGE_DELETE_FAILED:${result.status}`);
    };
    const collectPaths = async (table: string) => {
      const result = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${user.id}&select=storage_path`, { headers: serviceHeaders });
      if (!result.ok) {
        if (table === "essay_submissions" && result.status === 404) return [];
        throw new Error(`PATH_LIST_FAILED:${table}:${result.status}`);
      }
      const rows = await result.json().catch(() => []);
      return Array.isArray(rows) ? rows.map((row) => String(row?.storage_path ?? "")).filter(Boolean) : [];
    };

    const selectOwned = async (table: string, id: string, select: string) => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const result = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=${select}&limit=1`, { headers: serviceHeaders });
      if (!result.ok) throw new Error(`OWNED_RECORD_LOOKUP_FAILED:${table}:${result.status}`);
      const rows = await result.json().catch(() => []);
      return Array.isArray(rows) ? rows[0] ?? null : null;
    };
    const deleteOwnedRow = async (table: string, id: string) => {
      const result = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`, {
        method: "DELETE",
        headers: { ...serviceHeaders, Prefer: "return=representation" },
      });
      if (!result.ok) throw new Error(`OWNED_RECORD_DELETE_FAILED:${table}:${result.status}`);
      const rows = await result.json().catch(() => []);
      if (!Array.isArray(rows) || rows.length !== 1) return false;
      const verify = await selectOwned(table, id, "id");
      return verify === null;
    };

    if (action === "delete_document") {
      const documentId = String(payload?.document_id ?? "");
      const document = await selectOwned("study_documents", documentId, "id,campaign_id,document_type,storage_path");
      if (!document) return json({ error: "Arquivo não encontrado ou não pertence à sua conta." }, 404);
      const storagePath = String(document.storage_path ?? "");
      if (storagePath) {
        await deleteStorageObject(storagePath);
        await deleteStorageObject(`${storagePath}.text.json`);
      }
      const databaseDelete = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_user_study_document`, {
        method: "POST",
        headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_user_id: user.id, p_document_id: documentId }),
      });
      const databaseResult = await databaseDelete.json().catch(() => ({}));
      if (!databaseDelete.ok || databaseResult?.deleted !== true) {
        const missingMigration = databaseDelete.status === 404 || String(databaseResult?.code ?? "") === "PGRST202";
        return json({ error: missingMigration
          ? "A atualização v74 do banco ainda não foi instalada. Execute 20261017_v74_secure_document_delete.sql."
          : "O banco não confirmou a exclusão do arquivo." }, 409);
      }
      const verify = await selectOwned("study_documents", documentId, "id");
      if (verify) return json({ error: "O arquivo ainda existe no banco após a exclusão." }, 409);
      return json({ ...databaseResult, deleted: true, kind: "document" });
    }

    if (action === "delete_essay") {
      const essayId = String(payload?.essay_id ?? "");
      const essay = await selectOwned("essay_submissions", essayId, "id,storage_path");
      if (!essay) return json({ error: "Redação não encontrada ou não pertence à sua conta." }, 404);
      if (essay.storage_path) await deleteStorageObject(String(essay.storage_path));
      if (!await deleteOwnedRow("essay_submissions", essayId)) return json({ error: "O banco não confirmou a exclusão da redação." }, 409);
      return json({ deleted: true, kind: "essay" });
    }

    if (action === "delete_campaign") {
      const campaignId = String(payload?.campaign_id ?? "");
      const campaign = await selectOwned("study_campaigns", campaignId, "id");
      if (!campaign) return json({ error: "Portal não encontrado ou não pertence à sua conta." }, 404);
      const pathsResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?campaign_id=eq.${campaignId}&user_id=eq.${user.id}&select=storage_path`, { headers: serviceHeaders });
      const essaysResponse = await fetch(`${SUPABASE_URL}/rest/v1/essay_submissions?campaign_id=eq.${campaignId}&user_id=eq.${user.id}&select=storage_path`, { headers: serviceHeaders });
      if (!pathsResponse.ok || !essaysResponse.ok) throw new Error(`CAMPAIGN_PATH_LIST_FAILED:${pathsResponse.status}:${essaysResponse.status}`);
      const paths = await pathsResponse.json().catch(() => []);
      const essayFiles = await essaysResponse.json().catch(() => []);
      for (const row of Array.isArray(paths) ? paths : []) {
        const path = String(row?.storage_path ?? "");
        if (path) { await deleteStorageObject(path); await deleteStorageObject(`${path}.text.json`); }
      }
      for (const row of Array.isArray(essayFiles) ? essayFiles : []) {
        const path = String(row?.storage_path ?? "");
        if (path) await deleteStorageObject(path);
      }
      if (!await deleteOwnedRow("study_campaigns", campaignId)) return json({ error: "O banco não confirmou a exclusão do portal." }, 409);
      return json({ deleted: true, kind: "campaign" });
    }

    const documentPaths = await collectPaths("study_documents");
    const essayPaths = await collectPaths("essay_submissions");

    if (action === "reset_profile") {
      const resetResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reset_user_profile_content`, {
        method: "POST",
        headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_user_id: user.id }),
      });
      const resetResult = await resetResponse.json().catch(() => ({}));
      if (!resetResponse.ok) {
        console.error("reset-profile-rpc", resetResponse.status, resetResult);
        const missingMigration = resetResponse.status === 404 || String(resetResult?.code ?? "") === "PGRST202";
        return json({ error: missingMigration
          ? "A atualização v72 do banco ainda não foi instalada. Execute 20261017_v72_reset_profile_complete.sql no SQL Editor do Supabase."
          : "O banco recusou a redefinição. Consulte o log da função account-security." }, 502);
      }

      // Somente apague os objetos depois que a transação do banco confirmar o
      // reset. Assim uma migração ausente nunca deixa registros apontando para
      // arquivos que já foram removidos.
      for (const path of documentPaths) {
        await deleteStorageObject(path);
        await deleteStorageObject(`${path}.text.json`);
      }
      for (const path of essayPaths) await deleteStorageObject(path);

      const remaining: Record<string, number> = {};
      for (const table of ["study_campaigns", "study_documents", "essay_submissions", "focus_sessions"]) {
        const check = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${user.id}&select=user_id&limit=1`, { headers: serviceHeaders });
        if (!check.ok) {
          console.error("reset-profile-check", table, check.status, await check.text());
          remaining[table] = 1;
          continue;
        }
        const rows = await check.json().catch(() => null);
        remaining[table] = Array.isArray(rows) ? rows.length : 1;
      }
      const stateCheck = await fetch(`${SUPABASE_URL}/rest/v1/user_state?user_id=eq.${user.id}&select=state,reset_epoch&limit=1`, { headers: serviceHeaders });
      const stateRows = stateCheck.ok ? await stateCheck.json().catch(() => null) : null;
      const cleanState = Array.isArray(stateRows) && stateRows.length === 1 && stateRows[0]?.state && Object.keys(stateRows[0].state).length === 0 && Number(stateRows[0].reset_epoch) > 0;
      remaining.user_state = cleanState ? 0 : 1;
      remaining.total = Object.values(remaining).reduce((sum, count) => sum + count, 0);
      if (remaining.total > 0) return json({ error: "Ainda existem registros no banco; a redefinição não foi confirmada.", remaining }, 409);

      return json({ ...resetResult, reset: true, verified: true, remaining, version: "72", gemini_key_preserved: true });
    }

    for (const path of documentPaths) {
      await deleteStorageObject(path);
      await deleteStorageObject(`${path}.text.json`);
    }
    for (const path of essayPaths) await deleteStorageObject(path);
    const deleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: serviceHeaders });
    if (!deleteResponse.ok) return json({ error: "Não foi possível excluir a conta agora." }, 502);
    return json({ deleted: true });
  } catch (error) {
    console.error("account-security", error);
    return json({ error: "Falha interna ao concluir a operação de segurança." }, 500);
  }
});
