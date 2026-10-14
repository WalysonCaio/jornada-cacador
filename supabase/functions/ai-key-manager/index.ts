const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const SITE = "https://jornada.wcaio.workers.dev";

function headers(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = new Set([SITE, "http://localhost:4173", "http://localhost:3000"]);
  return {
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : SITE,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(request) });
const adminHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" };

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const result = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: PUBLIC_KEY } });
  return result.ok ? await result.json() : null;
}

async function verifyPassword(email: string, password: string) {
  const result = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return result.ok;
}

async function validateGeminiKey(key: string) {
  const result = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: { "x-goog-api-key": key } });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data?.error?.message || `Gemini ${result.status}`) as Error & { status?: number };
    error.status = result.status;
    throw error;
  }
  const usable = Array.isArray(data?.models) && data.models.some((model: any) => model?.supportedGenerationMethods?.includes("generateContent"));
  if (!usable) throw new Error("A chave é válida, mas não possui modelo generateContent disponível.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return reply(request, { error: "Método não permitido." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(request, { error: "Gerenciador de chaves não configurado." }, 503);

  const user = await authenticate(request);
  if (!user?.id || !user?.email) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  const input = await request.json().catch(() => ({}));
  const action = String(input?.action || "status");

  try {
    if (action === "status") {
      const status = await fetch(`${SUPABASE_URL}/rest/v1/user_ai_credentials?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.gemini&select=key_last_four,validated_at,updated_at&limit=1`, { headers: adminHeaders });
      if (!status.ok) throw new Error("A configuração BYOK ainda não foi instalada no banco. Execute a migração da versão 69.");
      const rows = await status.json();
      const credential = Array.isArray(rows) ? rows[0] : null;
      return reply(request, credential ? { configured: true, provider: "gemini", last_four: credential.key_last_four, validated_at: credential.validated_at } : { configured: false, provider: "gemini" });
    }

    const password = String(input?.password || "");
    if (password.length < 6 || !await verifyPassword(user.email, password)) return reply(request, { error: "Senha atual incorreta." }, 403);

    if (action === "save") {
      const key = String(input?.key || "").trim();
      if (key.length < 20 || key.length > 300 || /\s/.test(key)) return reply(request, { error: "A chave Gemini informada não possui um formato válido." }, 400);
      try {
        await validateGeminiKey(key);
      } catch (error) {
        const status = Number((error as { status?: number })?.status || 0);
        return reply(request, { error: status === 429 ? "A chave foi reconhecida, mas sua cota está temporariamente limitada. Aguarde a renovação antes de salvá-la." : `A chave Gemini não foi aceita: ${String((error as Error)?.message || error)}` }, status === 429 ? 429 : 400);
      }
      const saved = await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_user_ai_secret`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ p_user_id: user.id, p_provider: "gemini", p_secret: key, p_last_four: key.slice(-4) }) });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(data?.message || "Não foi possível guardar a chave no cofre.");
      return reply(request, { configured: true, provider: "gemini", last_four: key.slice(-4), message: "Chave Gemini testada e armazenada com criptografia." });
    }

    if (action === "delete") {
      const removed = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_user_ai_secret`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ p_user_id: user.id, p_provider: "gemini" }) });
      if (!removed.ok) throw new Error("Não foi possível remover a chave pessoal.");
      return reply(request, { configured: false, provider: "gemini", message: "Chave pessoal removida definitivamente." });
    }

    return reply(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("ai-key-manager", String((error as Error)?.message || error));
    return reply(request, { error: String((error as Error)?.message || "Falha ao gerenciar a chave.") }, 500);
  }
});
