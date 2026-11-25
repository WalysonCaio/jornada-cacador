// validate-questions — valida respostas de public.exam_questions em lotes.
// Uso (somente admin): POST com header x-admin-token = VALIDATION_ADMIN_TOKEN
// Body: { "limit": 40, "priority": "ia" | "desconhecido" | "all", "dry_run": false }
// Secrets: VALIDATION_ADMIN_TOKEN, GEMINI_API_KEY, (opcional) VALIDATION_MODEL
// A IA NUNCA recebe correct_index nem explanation (a explicação costuma entregar a resposta).
// correct_index NUNCA é alterado: a comparação é feita na RPC save_question_validation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODEL = Deno.env.get("VALIDATION_MODEL") ?? "gemini-2.5-flash";
const LETTERS = ["A", "B", "C", "D", "E"];
const MAX_LIMIT = 100;
const CONCURRENCY = 4;

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const optText = (o: unknown) =>
  typeof o === "string" ? o : String((o as any)?.text ?? (o as any)?.label ?? JSON.stringify(o));

function buildPrompt(q: any): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const alts = (q.options as unknown[]).map((o, i) => `${LETTERS[i]}) ${optText(o)}`).join("\n");
  return `Você é um professor especialista em concursos públicos brasileiros.
Resolva a questão abaixo usando a legislação, súmulas e jurisprudência vigentes em ${hoje}.
Se a questão depender de texto-base, figura, tabela ou trecho que NÃO foi fornecido, ou se o enunciado
estiver truncado/ambíguo, NÃO chute: responda resposta = null e explique em "problema".
Se a questão pedir a alternativa INCORRETA/EXCETO, escolha a alternativa que atende ao comando.

Banca: ${q.board ?? "não informada"} | Disciplina: ${q.subject ?? "-"} | Tópico: ${q.topic ?? "-"}

ENUNCIADO:
${q.statement}

ALTERNATIVAS:
${alts}

Responda SOMENTE com JSON:
{"resposta":"A"|"B"|"C"|"D"|"E"|null,
 "confianca":"alta"|"media"|"baixa",
 "tipo_fundamento":"lei"|"sumula"|"jurisprudencia"|"gramatica"|"conceito"|"calculo",
 "fundamento":"cite artigo/súmula/regra específica e explique em até 600 caracteres",
 "problema":"preencha só se resposta for null"}`;
}

async function askGemini(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY_NAO_CONFIGURADA");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
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
  if (!r.ok) throw new Error(`gemini_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const rawParts = Array.isArray(j?.candidates?.[0]?.content?.parts) ? j.candidates[0].content.parts : [];
  const answerParts = rawParts.filter((p: any) => !p?.thought);
  const text = (answerParts.length ? answerParts : rawParts).map((p: any) => p?.text ?? "").join("");
  const usage = j?.usageMetadata ?? {};
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  return { parsed, tokens_in: usage.promptTokenCount ?? 0, tokens_out: usage.candidatesTokenCount ?? 0 };
}

async function validateOne(q: any, batch: string) {
  try {
    const { parsed, tokens_in, tokens_out } = await askGemini(buildPrompt(q));
    const idx = typeof parsed.resposta === "string" ? LETTERS.indexOf(parsed.resposta.trim().toUpperCase()) : -1;
    const valido = idx >= 0 && idx < (q.options as unknown[]).length;
    const conf = ["alta", "media", "baixa"].includes(parsed.confianca) ? parsed.confianca : "baixa";
    const { data, error } = await sb.rpc("save_question_validation", {
      p_id: q.id,
      p_resposta: valido ? idx : null,
      p_fundamento: String(parsed.fundamento ?? ""),
      p_confianca: conf,
      p_model: MODEL,
      p_batch: batch,
      p_erro: valido ? null : String(parsed.problema ?? "resposta_invalida"),
    });
    if (error) throw new Error(error.message);
    return { id: q.id, resultado: data as string, tokens_in, tokens_out };
  } catch (e) {
    await sb.rpc("save_question_validation", {
      p_id: q.id, p_resposta: null, p_fundamento: "", p_confianca: "baixa",
      p_model: MODEL, p_batch: batch, p_erro: String((e as Error).message).slice(0, 250),
    });
    return { id: q.id, resultado: "erro", tokens_in: 0, tokens_out: 0 };
  }
}

Deno.serve(async (req) => {
  const expectedToken = Deno.env.get("VALIDATION_ADMIN_TOKEN");
  if (!expectedToken || req.headers.get("x-admin-token") !== expectedToken) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 40), 1), MAX_LIMIT);
  const priority = ["ia", "desconhecido", "all"].includes(body.priority) ? body.priority : "ia";

  let q = sb.from("exam_questions")
    .select("id,statement,options,subject,topic,board,gabarito_source")   // sem correct_index/explanation
    .eq("status_validacao", "pendente").is("resposta_ia", null).lt("validation_attempts", 3);
  if (priority !== "all") q = q.eq("gabarito_source", priority);
  const { data: rows, error } = await q
    .order("gabarito_source", { ascending: false })   // 'ia' antes de 'desconhecido'
    .order("fingerprint")                             // ordem pseudoaleatória (bom para piloto)
    .limit(limit);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (body.dry_run) {
    return Response.json({ dry_run: true, selecionadas: rows!.length, exemplo_prompt: rows![0] ? buildPrompt(rows![0]) : null });
  }

  const batch = `${new Date().toISOString().slice(0, 16)}-${priority}`;
  const resumo: Record<string, number> = {};
  let tin = 0, tout = 0;
  const fila = [...rows!];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (fila.length) {
      const item = fila.shift()!;
      const r = await validateOne(item, batch);
      resumo[r.resultado] = (resumo[r.resultado] ?? 0) + 1;
      tin += r.tokens_in; tout += r.tokens_out;
    }
  }));
  return Response.json({ batch, model: MODEL, processadas: rows!.length, resumo, tokens_entrada: tin, tokens_saida: tout });
});
