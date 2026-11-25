// validate-questions (v2) — valida respostas de public.exam_questions em lotes.
// Integra prompt-v2 (checagem de comando/itens + dupla passagem com ordem invertida)
// mantendo VALIDATION_MODEL fixo (ex.: gemini-3.6-flash) e ritmo anti-429.
// Uso (somente admin): POST com header x-admin-token = VALIDATION_ADMIN_TOKEN
// Body: { "limit": 15, "priority": "ia" | "desconhecido" | "all", "dupla": true, "dry_run": false }
// Secrets: VALIDATION_ADMIN_TOKEN, GEMINI_API_KEY, VALIDATION_MODEL (recomendado: gemini-3.6-flash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const LETTERS = ["A", "B", "C", "D", "E"];
const MAX_LIMIT = 50;
const CONCURRENCY = 1;       // 1 por vez para evitar rajada 429 na chave gratuita
const PAUSE_MS = 1100;       // pequena pausa entre chamadas Gemini
const RETRY_429_MS = 4500;   // backoff caso receba 429 pontual

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let cachedModels: string[] | null = null;

async function getActiveModels(apiKey: string): Promise<string[]> {
  const forced = Deno.env.get("VALIDATION_MODEL")?.trim();
  if (forced) return [forced];
  if (cachedModels?.length) return cachedModels;

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!r.ok) throw new Error(`list_models_${r.status}: ${(await r.text()).slice(0, 150)}`);
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
  cachedModels = candidates.slice(0, 3);
  return cachedModels;
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

async function askGemini(prompt: string, models: string[], apiKey: string) {
  let lastErr = "gemini_sem_resposta";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        },
      );
      if (!r.ok) {
        lastErr = `gemini_${r.status}_${model}: ${(await r.text()).slice(0, 180)}`;
        if (r.status === 429 && attempt === 0) {
          await sleep(RETRY_429_MS);
          continue;
        }
        if ([404, 429, 503].includes(r.status)) break;
        throw new Error(lastErr);
      }
      const j = await r.json();
      const rawParts = Array.isArray(j?.candidates?.[0]?.content?.parts) ? j.candidates[0].content.parts : [];
      const answerParts = rawParts.filter((p: any) => !p?.thought);
      const text = (answerParts.length ? answerParts : rawParts).map((p: any) => p?.text ?? "").join("");
      const usage = j?.usageMetadata ?? {};
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      return { parsed, model, tokens_in: usage.promptTokenCount ?? 0, tokens_out: usage.candidatesTokenCount ?? 0 };
    }
  }
  throw new Error(lastErr);
}

async function resolver(
  q: any,
  ask: (prompt: string) => Promise<{ parsed: any; model: string; tokens_in: number; tokens_out: number }>,
  dupla: boolean,
) {
  const n = (q.options as unknown[]).length;
  const direta = [...Array(n).keys()];
  const invertida = [...direta].reverse();

  const res1 = await ask(buildPromptV2(q, direta));
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
  const res2 = await ask(buildPromptV2(q, invertida));
  tin += res2.tokens_in;
  tout += res2.tokens_out;
  model = res2.model || model;
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

async function validateOne(q: any, batch: string, models: string[], apiKey: string, dupla: boolean) {
  try {
    const r = await resolver(q, (prompt) => askGemini(prompt, models, apiKey), dupla);
    const conf = ["alta", "media", "baixa"].includes(r.parsed?.confianca) ? r.parsed.confianca : "baixa";
    const { data, error } = await sb.rpc("save_question_validation", {
      p_id: q.id,
      p_resposta: r.idx,
      p_fundamento: String(r.parsed?.fundamento ?? ""),
      p_confianca: conf,
      p_model: r.model,
      p_batch: batch,
      p_erro: r.idx === null ? String(r.problema || "sem_resposta") : null,
    });
    if (error) throw new Error(error.message);
    return { id: q.id, model: r.model, resultado: data as string, problema: r.problema, tokens_in: r.tokens_in, tokens_out: r.tokens_out };
  } catch (e) {
    const msg = String((e as Error)?.message || "erro_desconhecido").slice(0, 250);
    await sb.rpc("save_question_validation", {
      p_id: q.id,
      p_resposta: null,
      p_fundamento: "",
      p_confianca: "baixa",
      p_model: models[0] ?? "unknown",
      p_batch: batch,
      p_erro: msg,
    });
    return { id: q.id, model: models[0] ?? "unknown", resultado: "erro", problema: msg, tokens_in: 0, tokens_out: 0 };
  }
}

Deno.serve(async (req) => {
  const expectedToken = Deno.env.get("VALIDATION_ADMIN_TOKEN");
  if (!expectedToken || req.headers.get("x-admin-token") !== expectedToken) {
    return new Response("forbidden", { status: 403 });
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY_NAO_CONFIGURADA" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 15), 1), MAX_LIMIT);
  const priority = ["ia", "desconhecido", "all"].includes(body.priority) ? body.priority : "ia";
  const dupla = typeof body.dupla === "boolean" ? body.dupla : (priority === "ia");

  let q = sb.from("exam_questions")
    .select("id,statement,options,subject,topic,board,gabarito_source")
    .eq("status_validacao", "pendente")
    .is("resposta_ia", null)
    .lt("validation_attempts", 3)
    .or("validation_error.is.null,validation_error.not.like.passes_divergentes%");
  if (priority !== "all") q = q.eq("gabarito_source", priority);
  const { data: rows, error } = await q
    .order("gabarito_source", { ascending: false })
    .order("fingerprint")
    .limit(limit);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const models = await getActiveModels(apiKey);
  if (body.dry_run) {
    const sample = rows?.[0];
    const n = sample ? (sample.options as unknown[]).length : 0;
    return Response.json({
      dry_run: true,
      dupla,
      models_detectados: models,
      selecionadas: rows!.length,
      exemplo_prompt_v2: sample ? buildPromptV2(sample, [...Array(n).keys()]) : null,
    });
  }

  const batch = `${new Date().toISOString().slice(0, 16)}-${priority}${dupla ? "-dupla" : ""}`;
  const resumo: Record<string, number> = {};
  const motivos: Record<string, number> = {};
  let tin = 0, tout = 0, usedModel = models[0];
  const fila = [...rows!];

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (fila.length) {
      const item = fila.shift()!;
      const r = await validateOne(item, batch, models, apiKey, dupla);
      usedModel = r.model;
      resumo[r.resultado] = (resumo[r.resultado] ?? 0) + 1;
      if (r.problema) {
        const key = r.problema.split(":")[0];
        motivos[key] = (motivos[key] ?? 0) + 1;
      }
      tin += r.tokens_in;
      tout += r.tokens_out;
      if (fila.length) await sleep(PAUSE_MS);
    }
  }));

  return Response.json({
    batch,
    model: usedModel,
    dupla,
    processadas: rows!.length,
    resumo,
    motivos,
    tokens_entrada: tin,
    tokens_saida: tout,
  });
});
