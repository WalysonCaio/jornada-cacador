// classify-subjects — fetch nativo, sem dependências externas (evita WORKER_RESOURCE_LIMIT / 546 no plano Free).
// Uso (admin): POST com header x-admin-token = VALIDATION_ADMIN_TOKEN
// Body: { "limit": 20, "dry_run": false }
// Secrets: VALIDATION_ADMIN_TOKEN, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CLASSIFY_MODEL (opcional).
// SUPABASE_URL vem do ambiente.
// A IA só PROPÕE. A RPC save_subject_classification decide: aplica só com confiança 'alta' E concordância
// com a palavra-chave; o resto vira proposta para revisão. Rótulo 'manual' nunca é tocado.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("VALIDATION_ADMIN_TOKEN") ?? "";
const MODEL = Deno.env.get("CLASSIFY_MODEL") ?? "gemini-3.6-flash";

const MAX_LIMIT = 40;     // lotes pequenos: evita estourar o tempo e a memória do plano Free
const CONCURRENCY = 2;    // no máximo 2 chamadas simultâneas à IA
const MAX_TENTATIVAS = 3; // repete em 429/5xx com espera crescente

const TAXONOMIA = [
  "Direito Constitucional",
  "Direito Penal",
  "Direito Processual Penal",
  "Direito Administrativo",
  "Direito Militar",
  "Direitos Humanos",
  "Legislação Extravagante",
  "Língua Portuguesa",
  "Raciocínio Lógico-Matemático",
  "Informática",
  "História",
  "História de Pernambuco",
  "Geografia",
  "Física",
  "Biologia",
  "Redação",
  "Ética no Serviço Público",
];

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

const optText = (o: unknown) =>
  typeof o === "string" ? o : String((o as any)?.text ?? (o as any)?.label ?? JSON.stringify(o));

function buildPrompt(q: any): string {
  const opts = Array.isArray(q.options) ? q.options : [];
  const alts = opts
    .map((o: unknown, i: number) => `${String.fromCharCode(65 + i)}) ${optText(o)}`)
    .join("\n");
  return `Você classifica questões de concursos brasileiros em UMA disciplina.
Escolha EXATAMENTE um nome desta lista (copie literalmente):
${TAXONOMIA.map((t) => `- ${t}`).join("\n")}

Regras:
- Classifique pelo CONTEÚDO cobrado no enunciado e nas alternativas, nunca pelo nome da fonte, da banca ou do pacote.
- "Legislação Extravagante" para leis especiais (Maria da Penha, drogas, ECA, abuso de autoridade, racismo, tortura).
- Se não der para decidir com segurança (enunciado truncado, texto-base ausente, ou mais de uma disciplina igualmente plausível), responda disciplina = null.

Tópico informado (pode estar errado): ${q.topic ?? "-"}
ENUNCIADO:
${q.statement}
ALTERNATIVAS:
${alts}

Responda SOMENTE com JSON:
{"disciplina": "nome exato da lista, ou null", "confianca": "alta" | "media" | "baixa", "motivo": "até 120 caracteres"}`;
}

// Leitura da fila pela REST do PostgREST (sem cliente externo).
async function listarPendentes(limit: number): Promise<any[]> {
  const url =
    `${SB_URL}/rest/v1/exam_questions` +
    `?select=id,statement,options,topic,board,subject,subject_origem` +
    `&subject_origem=in.(pacote,padrao)&subject_proposta=is.null&superseded_at=is.null` +
    `&order=id&limit=${limit}`;
  const r = await fetch(url, { headers: sbHeaders });
  if (!r.ok) throw new Error(`select_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

// IA com repetição em 429/5xx. Não grava nada se falhar.
async function askGemini(prompt: string): Promise<any> {
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`gemini_${r.status}`);
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  }
  throw new Error("gemini_esgotado");
}

// Chama a RPC pela REST. A RPC decide se aplica ou só propõe.
async function salvarClassificacao(q: any, parsed: any, batch: string): Promise<string> {
  const disc = typeof parsed?.disciplina === "string" ? parsed.disciplina.trim() : null;
  const conf = ["alta", "media", "baixa"].includes(parsed?.confianca) ? parsed.confianca : "baixa";
  const r = await fetch(`${SB_URL}/rest/v1/rpc/save_subject_classification`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify({
      p_id: q.id,
      p_disciplina: disc,
      p_confianca: conf,
      p_modelo: MODEL,
      p_batch: batch,
    }),
  });
  if (!r.ok) throw new Error(`rpc_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as string;
}

async function classificarUma(q: any, batch: string): Promise<string> {
  try {
    const parsed = await askGemini(buildPrompt(q));
    return await salvarClassificacao(q, parsed, batch);
  } catch (_e) {
    return "erro";
  }
}

Deno.serve(async (req) => {
  if (!SB_URL || !SB_KEY || !GEMINI_KEY || !ADMIN_TOKEN) {
    return Response.json(
      { error: "secrets_ausentes", faltando: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "VALIDATION_ADMIN_TOKEN"]
        .filter((n) => !Deno.env.get(n)) },
      { status: 500 },
    );
  }
  if (req.headers.get("x-admin-token") !== ADMIN_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), MAX_LIMIT);

  let rows: any[];
  try {
    rows = await listarPendentes(body.dry_run ? 1 : limit);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  if (body.dry_run) {
    return Response.json({
      dry_run: true,
      selecionadas: rows.length,
      exemplo_prompt: rows[0] ? buildPrompt(rows[0]) : null,
    });
  }

  const batch = `${new Date().toISOString().slice(0, 16)}-classify`;
  const resumo: Record<string, number> = {};
  const fila = [...rows];

  // Pool de 2 trabalhadores: nunca mais que CONCURRENCY chamadas simultâneas.
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (fila.length) {
        const item = fila.shift()!;
        const r = await classificarUma(item, batch);
        resumo[r] = (resumo[r] ?? 0) + 1;
      }
    }),
  );

  return Response.json({ batch, model: MODEL, processadas: rows.length, resumo });
});
