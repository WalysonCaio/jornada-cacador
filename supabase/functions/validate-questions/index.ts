// validate-questions (v2.2) — zero dependências externas (sem @supabase/supabase-js)
// para eliminar erro HTTP 546 WORKER_RESOURCE_LIMIT no plano Free do Supabase.
// Integra prompt-v2 (checagem de comando/itens + dupla passagem com ordem invertida),
// filtro superseded_at is null (v115) e fallback automático: Gemini -> DeepSeek -> Groq.
// Uso (somente admin): POST com header x-admin-token = VALIDATION_ADMIN_TOKEN
// Body: { "limit": 2, "priority": "ia" | "desconhecido" | "all", "dupla": true, "provider": "auto"|"gemini"|"deepseek"|"groq", "dry_run": false }
// Secrets: VALIDATION_ADMIN_TOKEN, GEMINI_API_KEY, VALIDATION_MODEL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, GROQ_API_KEY, GROQ_MODEL

const LETTERS = ["A", "B", "C", "D", "E"];
const MAX_LIMIT = 20;
const PAUSE_MS = 350;
const LLM_TIMEOUT_MS = 45_000;

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let cachedGeminiModels: string[] | null = null;

function sbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
  if (SERVICE_KEY && !SERVICE_KEY.startsWith("sb_secret_")) {
    h.Authorization = `Bearer ${SERVICE_KEY}`;
  }
  return h;
}

async function fetchPendingQuestions(priority: string, limit: number) {
  const params = new URLSearchParams();
  params.set("select", "id,statement,options,subject,topic,board,gabarito_source");
  params.set("status_validacao", "eq.pendente");
  params.set("superseded_at", "is.null");
  params.set("resposta_ia", "is.null");
  params.set("validation_attempts", "lt.3");
  params.set("or", "(validation_error.is.null,validation_error.not.like.passes_divergentes*)");
  if (priority !== "all") params.set("gabarito_source", `eq.${priority}`);
  params.set("order", "gabarito_source.desc,fingerprint.asc");
  params.set("limit", String(limit));

  const r = await fetch(`${SUPABASE_URL}/rest/v1/exam_questions?${params.toString()}`, {
    method: "GET",
    headers: sbHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`postgrest_select_${r.status}: ${txt.slice(0, 200)}`);
  }
  return await r.json();
}

async function rpcSaveValidation(payload: {
  p_id: string;
  p_resposta: number | null;
  p_fundamento: string;
  p_confianca: string;
  p_model: string;
  p_batch: string;
  p_erro: string | null;
}): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_question_validation`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`rpc_save_${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  return String(data ?? "erro");
}

async function getGeminiModels(apiKey: string): Promise<string[]> {
  const forced = Deno.env.get("VALIDATION_MODEL")?.trim();
  if (forced) return [forced];
  if (cachedGeminiModels?.length) return cachedGeminiModels;

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`list_models_${r.status}`);
  const j = await r.json();
  const candidates: string[] = (j?.models ?? [])
    .filter((m: any) =>
      Array.isArray(m?.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes("generateContent")
    )
    .map((m: any) => String(m.name || "").replace(/^models\//, ""))
    .filter((name: string) =>
      /^gemini-/i.test(name) &&
      /flash/i.test(name) &&
      !/(image|tts|audio|live|embedding|vision|robotics|computer-use|exp)/i.test(name)
    );

  const score = (n: string) => {
    let s = 0;
    const ver = n.match(/gemini-(\d+)(?:\.(\d+))?/i);
    if (ver) s += Number(ver[1]) * 100 + Number(ver[2] || 0) * 10;
    if (!/preview/i.test(n)) s += 5;
    if (!/lite/i.test(n)) s += 3;
    return s;
  };
  candidates.sort((a, b) => score(b) - score(a));
  if (!candidates.length) throw new Error("nenhum_modelo_gemini_flash_ativo");
  cachedGeminiModels = candidates.slice(0, 2);
  return cachedGeminiModels;
}

const optText = (o: unknown) =>
  typeof o === "string" ? o : String((o as any)?.text ?? (o as any)?.label ?? JSON.stringify(o));

function buildPromptV2(q: any, ordem: number[]): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const alts = ordem.map((orig, pos) => `${LETTERS[pos]}) ${optText(q.options[orig])}`).join("\n");
  return `Você é um professor especialista em concursos públicos brasileiros.
Use a legislação, súmulas e jurisprudência vigentes em ${hoje}.

ANTES de resolver, verifique o enunciado:
1. Há um comando claro do que se pede? (frases a completar pelas alternativas são NORMAIS.)
2. Se o enunciado cita itens (I, II, III...), assertivas, texto-base, figura, tabela ou trecho
   sublinhado, esse conteúdo aparece AQUI? Se não aparecer, a questão está incompleta.
3. Alguma alternativa contém texto longo e estranho (parece texto-base colado)? Isso é defeito.
Se 1 ou 2 forem "não", ou houver defeito em 3, responda resposta = null.
NUNCA invente o conteúdo de itens que não foram fornecidos.
Se mais de uma alternativa for defensável, responda resposta = null com problema "ambigua".
Em questões "EXCETO / INCORRETA", escolha a alternativa que atende ao comando.

Banca: ${q.board ?? "não informada"} | Disciplina: ${q.subject ?? "-"} | Tópico: ${q.topic ?? "-"}

ENUNCIADO:
${q.statement}

ALTERNATIVAS:
${alts}

Responda SOMENTE com JSON:
{"comando_identificado": true|false,
 "itens_citados_presentes": true|false,
 "resposta": "A"|"B"|"C"|"D"|"E"|null,
 "confianca": "alta"|"media"|"baixa",
 "tipo_fundamento": "lei"|"sumula"|"jurisprudencia"|"gramatica"|"conceito"|"calculo",
 "fundamento": "cite artigo/súmula/regra específica, até 600 caracteres",
 "problema": "preencha se resposta for null"}`;
}

function aceitar(parsed: any, n: number): { idx: number | null; problema?: string } {
  if (parsed?.comando_identificado !== true) return { idx: null, problema: "sem_comando" };
  if (parsed?.itens_citados_presentes !== true) return { idx: null, problema: "itens_ou_texto_base_ausentes" };
  const idx = typeof parsed?.resposta === "string" ? LETTERS.indexOf(parsed.resposta.trim().toUpperCase()) : -1;
  if (idx < 0 || idx >= n) return { idx: null, problema: String(parsed?.problema || "resposta_invalida") };
  return { idx };
}

function parseJsonSafe(rawText: string) {
  const cleaned = String(rawText || "").replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

type ProviderState = {
  preferred: "auto" | "gemini" | "deepseek" | "groq";
  geminiKeyOverride?: string;
  geminiBlocked: boolean;
  deepseekBlocked: boolean;
  groqBlocked: boolean;
};

async function callGemini(prompt: string, apiKey: string) {
  const models = await getGeminiModels(apiKey);
  let lastErr = "gemini_sem_resposta";
  for (const model of models) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      },
    );
    if (!r.ok) {
      lastErr = `gemini_${r.status}_${model}: ${(await r.text()).slice(0, 150)}`;
      if (r.status === 429) throw Object.assign(new Error(lastErr), { rateLimited: true });
      if (r.status === 404 || r.status === 503) continue;
      throw new Error(lastErr);
    }
    const j = await r.json();
    const rawParts = Array.isArray(j?.candidates?.[0]?.content?.parts) ? j.candidates[0].content.parts : [];
    const answerParts = rawParts.filter((p: any) => !p?.thought);
    const text = (answerParts.length ? answerParts : rawParts).map((p: any) => p?.text ?? "").join("");
    const usage = j?.usageMetadata ?? {};
    return {
      parsed: parseJsonSafe(text),
      model,
      tokens_in: usage.promptTokenCount ?? 0,
      tokens_out: usage.candidatesTokenCount ?? 0,
    };
  }
  throw new Error(lastErr);
}

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  prefix: string,
  prompt: string,
) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responda estritamente com um objeto JSON válido conforme solicitado." },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!r.ok) {
    const msg = `${prefix}_${r.status}_${model}: ${(await r.text()).slice(0, 150)}`;
    if (r.status === 429 || r.status === 402) throw Object.assign(new Error(msg), { rateLimited: true });
    throw new Error(msg);
  }
  const j = await r.json();
  const text = String(j?.choices?.[0]?.message?.content ?? "");
  const usage = j?.usage ?? {};
  return {
    parsed: parseJsonSafe(text),
    model: `${prefix}:${model}`,
    tokens_in: usage.prompt_tokens ?? 0,
    tokens_out: usage.completion_tokens ?? 0,
  };
}

async function askWithFallback(prompt: string, pState: ProviderState) {
  const geminiKey = (pState.geminiKeyOverride || Deno.env.get("GEMINI_API_KEY") || "").trim();
  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  const deepseekModel = Deno.env.get("DEEPSEEK_MODEL")?.trim() || "deepseek-chat";
  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const groqModel = Deno.env.get("GROQ_MODEL")?.trim() || "llama-3.3-70b-versatile";

  const order: Array<"gemini" | "deepseek" | "groq"> =
    pState.preferred === "deepseek" ? ["deepseek", "groq", "gemini"]
      : pState.preferred === "groq" ? ["groq", "deepseek", "gemini"]
      : ["gemini", "deepseek", "groq"];

  const errors: string[] = [];
  for (const prov of order) {
    if (prov === "gemini" && geminiKey && !pState.geminiBlocked) {
      try {
        return await callGemini(prompt, geminiKey);
      } catch (e: any) {
        if (e?.rateLimited) pState.geminiBlocked = true;
        errors.push(String(e?.message || e));
      }
    }
    if (prov === "deepseek" && deepseekKey && !pState.deepseekBlocked) {
      try {
        return await callOpenAICompat(
          "https://api.deepseek.com/chat/completions",
          deepseekKey,
          deepseekModel,
          "deepseek",
          prompt,
        );
      } catch (e: any) {
        if (e?.rateLimited) pState.deepseekBlocked = true;
        errors.push(String(e?.message || e));
      }
    }
    if (prov === "groq" && groqKey && !pState.groqBlocked) {
      try {
        return await callOpenAICompat(
          "https://api.groq.com/openai/v1/chat/completions",
          groqKey,
          groqModel,
          "groq",
          prompt,
        );
      } catch (e: any) {
        if (e?.rateLimited) pState.groqBlocked = true;
        errors.push(String(e?.message || e));
      }
    }
  }
  throw new Error(errors.join(" | ").slice(0, 240) || "nenhum_provedor_ia_disponivel");
}

async function resolver(q: any, pState: ProviderState, dupla: boolean) {
  const n = (q.options as unknown[]).length;
  const direta = [...Array(n).keys()];
  const invertida = [...direta].reverse();

  const res1 = await askWithFallback(buildPromptV2(q, direta), pState);
  let tin = res1.tokens_in, tout = res1.tokens_out, model = res1.model;
  const a1 = aceitar(res1.parsed, n);
  if (a1.idx === null) {
    return { idx: null, problema: a1.problema || "sem_resposta", parsed: res1.parsed, model, tokens_in: tin, tokens_out: tout };
  }
  const orig1 = direta[a1.idx];
  if (!dupla) {
    return { idx: orig1, problema: null, parsed: res1.parsed, model, tokens_in: tin, tokens_out: tout };
  }

  await sleep(PAUSE_MS);
  const res2 = await askWithFallback(buildPromptV2(q, invertida), pState);
  tin += res2.tokens_in;
  tout += res2.tokens_out;
  const a2 = aceitar(res2.parsed, n);
  if (a2.idx === null) {
    return { idx: null, problema: `passe2:${a2.problema || "sem_resposta"}`, parsed: res1.parsed, model, tokens_in: tin, tokens_out: tout };
  }
  const orig2 = invertida[a2.idx];
  if (orig1 !== orig2) {
    return {
      idx: null,
      problema: `passes_divergentes:${LETTERS[orig1]}_vs_${LETTERS[orig2]}`,
      parsed: res1.parsed,
      model,
      tokens_in: tin,
      tokens_out: tout,
    };
  }
  return { idx: orig1, problema: null, parsed: res1.parsed, model, tokens_in: tin, tokens_out: tout };
}

async function validateOne(q: any, batch: string, pState: ProviderState, dupla: boolean) {
  try {
    const r = await resolver(q, pState, dupla);
    const conf = ["alta", "media", "baixa"].includes(r.parsed?.confianca) ? r.parsed.confianca : "baixa";
    const resultado = await rpcSaveValidation({
      p_id: q.id,
      p_resposta: r.idx,
      p_fundamento: String(r.parsed?.fundamento ?? ""),
      p_confianca: conf,
      p_model: r.model,
      p_batch: batch,
      p_erro: r.idx === null ? String(r.problema || "sem_resposta") : null,
    });
    return { id: q.id, model: r.model, resultado, problema: r.problema, tokens_in: r.tokens_in, tokens_out: r.tokens_out };
  } catch (e) {
    const msg = String((e as Error)?.message || "erro_desconhecido").slice(0, 250);
    await rpcSaveValidation({
      p_id: q.id,
      p_resposta: null,
      p_fundamento: "",
      p_confianca: "baixa",
      p_model: "fallback_error",
      p_batch: batch,
      p_erro: msg,
    }).catch(() => {});
    return { id: q.id, model: "fallback_error", resultado: "erro", problema: msg, tokens_in: 0, tokens_out: 0 };
  }
}

Deno.serve(async (req) => {
  const expectedToken = Deno.env.get("VALIDATION_ADMIN_TOKEN");
  if (!expectedToken || req.headers.get("x-admin-token") !== expectedToken) {
    return new Response("forbidden", { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 2), 1), MAX_LIMIT);
  const priority = ["ia", "desconhecido", "all"].includes(body.priority) ? body.priority : "ia";
  const dupla = typeof body.dupla === "boolean" ? body.dupla : (priority === "ia");
  const preferred = ["auto", "gemini", "deepseek", "groq"].includes(body.provider) ? body.provider : "auto";

  let rows: any[];
  try {
    rows = await fetchPendingQuestions(priority, limit);
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }

  if (body.dry_run) {
    const sample = rows?.[0];
    const n = sample ? (sample.options as unknown[]).length : 0;
    return Response.json({
      dry_run: true,
      version: "v2.2-zero-deps",
      dupla,
      preferred_provider: preferred,
      selecionadas: rows.length,
      exemplo_prompt_v2: sample ? buildPromptV2(sample, [...Array(n).keys()]) : null,
    });
  }

  const pState: ProviderState = {
    preferred,
    geminiKeyOverride: req.headers.get("x-gemini-api-key")?.trim() || undefined,
    geminiBlocked: false,
    deepseekBlocked: false,
    groqBlocked: false,
  };
  const batch = `${new Date().toISOString().slice(0, 16)}-${priority}${dupla ? "-dupla" : ""}`;
  const resumo: Record<string, number> = {};
  const modelosUsados: Record<string, number> = {};
  const motivos: Record<string, number> = {};
  let tin = 0, tout = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = await validateOne(rows[i], batch, pState, dupla);
    resumo[r.resultado] = (resumo[r.resultado] ?? 0) + 1;
    modelosUsados[r.model] = (modelosUsados[r.model] ?? 0) + 1;
    if (r.problema) {
      const key = r.problema.split(":")[0];
      motivos[key] = (motivos[key] ?? 0) + 1;
    }
    tin += r.tokens_in;
    tout += r.tokens_out;
    if (i + 1 < rows.length) await sleep(PAUSE_MS);
  }

  return Response.json({
    batch,
    version: "v2.2-zero-deps",
    dupla,
    processadas: rows.length,
    resumo,
    modelos_usados: modelosUsados,
    motivos,
    tokens_entrada: tin,
    tokens_saida: tout,
  });
});
