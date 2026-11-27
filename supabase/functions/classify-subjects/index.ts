// classify-subjects — reclassifica a disciplina de questões com origem 'pacote' ou 'padrao'.
// Uso (admin): POST com header x-admin-token = VALIDATION_ADMIN_TOKEN
// Body: { "limit": 40, "dry_run": false }
// Secrets: VALIDATION_ADMIN_TOKEN, GEMINI_API_KEY, CLASSIFY_MODEL (opcional; padrão gemini-3.6-flash).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos pelo ambiente.
// A IA só PROPÕE. A RPC save_subject_classification decide: aplica só com confiança 'alta' E concordância
// com a palavra-chave; o resto vira proposta para revisão. Rótulo 'manual' nunca é tocado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODEL = Deno.env.get("CLASSIFY_MODEL") ?? "gemini-3.6-flash";
const MAX_LIMIT = 100;
const CONCURRENCY = 4;

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

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const optText = (o: unknown) =>
  typeof o === "string" ? o : String((o as any)?.text ?? (o as any)?.label ?? JSON.stringify(o));

function buildPrompt(q: any): string {
  const opts = Array.isArray(q.options) ? q.options : [];
  const alts = opts.map((o: unknown, i: number) => `${String.fromCharCode(65 + i)}) ${optText(o)}`).join("\n");
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

async function askGemini(prompt: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function classifyOne(q: any, batch: string): Promise<string> {
  try {
    const parsed = await askGemini(buildPrompt(q));
    const disc = typeof parsed.disciplina === "string" ? parsed.disciplina.trim() : null;
    const conf = ["alta", "media", "baixa"].includes(parsed.confianca) ? parsed.confianca : "baixa";
    const { data, error } = await sb.rpc("save_subject_classification", {
      p_id: q.id,
      p_disciplina: disc,
      p_confianca: conf,
      p_modelo: MODEL,
      p_batch: batch,
    });
    if (error) throw new Error(error.message);
    return data as string;
  } catch (_e) {
    // Falha de chamada não grava nada: a questão continua na fila para a próxima rodada.
    return "erro";
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-admin-token") !== Deno.env.get("VALIDATION_ADMIN_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 40), 1), MAX_LIMIT);

  const { data: rows, error } = await sb
    .from("exam_questions")
    .select("id,statement,options,topic,board,subject,subject_origem")
    .in("subject_origem", ["pacote", "padrao"])
    .is("subject_proposta", null)
    .is("superseded_at", null)
    .order("id")
    .limit(limit);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (body.dry_run) {
    return Response.json({
      dry_run: true,
      selecionadas: rows!.length,
      exemplo_prompt: rows![0] ? buildPrompt(rows![0]) : null,
    });
  }

  const batch = `${new Date().toISOString().slice(0, 16)}-classify`;
  const resumo: Record<string, number> = {};
  const fila = [...rows!];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (fila.length) {
      const item = fila.shift()!;
      const r = await classifyOne(item, batch);
      resumo[r] = (resumo[r] ?? 0) + 1;
    }
  }));

  return Response.json({ batch, model: MODEL, processadas: rows!.length, resumo });
});
