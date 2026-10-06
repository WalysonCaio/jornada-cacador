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
    if (payload?.action !== "delete_account" || typeof payload?.password !== "string") {
      return json({ error: "Solicitação inválida." }, 400);
    }

    const passwordCheck = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: payload.password }),
    });
    if (!passwordCheck.ok) return json({ error: "Senha incorreta." }, 401);

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
        await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${document.storage_path}.text.json`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
      }
    }

    const essaysResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/essay_submissions?user_id=eq.${user.id}&select=storage_path`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
    );
    if (essaysResponse.ok) {
      const essays = await essaysResponse.json();
      for (const essay of essays) {
        if (!essay.storage_path) continue;
        await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${essay.storage_path}`, {
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
