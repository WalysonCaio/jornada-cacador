import { normalizePages, buildChunks, selectProgrammeChunks, runChunked, mergeChunkResults, totalChars } from "../supabase/functions/_shared/edital-chunking.mjs";

// --- edital sintético: 90 págs de regras + anexo com 14 disciplinas
const subjects = ["Língua Portuguesa", "Raciocínio Lógico", "Informática", "Direito Constitucional", "Direito Administrativo", "Direito Penal", "Direito Processual Penal", "Legislação Especial", "Direitos Humanos", "Atualidades", "História", "Geografia", "Noções de Criminologia", "Ética no Serviço Público"];
const pages = [];
const rule = "O candidato deverá observar as regras de inscrição, taxa, cronograma, recursos e documentos. ".repeat(35);
for (let p = 1; p <= 90; p++) pages.push({
  page: p,
  text: `Edital página ${p}. ${rule}`
});
const expected = [];
let page = 91,
  buf = "ANEXO II - CONTEÚDO PROGRAMÁTICO\n";
for (const s of subjects) {
  buf += `\n${s.toUpperCase()}\n`;
  for (let i = 1; i <= 34; i++) {
    const t = `${s} item ${i}: ${"conteúdo detalhado do assunto ".repeat(3)}`.trim();
    expected.push(t);
    buf += `${i}. ${t}\n`;
  }
  if (buf.length > 3200) {
    pages.push({
      page: page++,
      text: buf
    });
    buf = "";
  }
}
if (buf.trim()) pages.push({
  page: page++,
  text: buf
});
const total = totalChars(normalizePages(pages));
console.log("páginas:", pages.length, "caracteres:", total, "tópicos esperados:", expected.length);

// --- pipeline ANTIGO (copiado do pdf-text-client.js: compactPagesForInlinePayload 110000)
function oldCompact(pages, max = 110000) {
  const t = pages.reduce((s, p) => s + p.text.length, 0);
  if (t <= max) return pages;
  const step = Math.max(1, Math.ceil(t / max));
  const sel = [];
  let count = 0;
  for (let i = 0; i < pages.length; i++) if (i < 5 || i >= pages.length - 5 || i % step === 0) {
    const sl = pages[i].text.slice(0, 3500);
    if (count + sl.length <= max) {
      sel.push({
        page: pages[i].page,
        text: sl
      });
      count += sl.length;
    }
  }
  return sel;
}
const oldText = oldCompact(pages).map(p => p.text).join("\n");
const oldHit = expected.filter(t => oldText.includes(t)).length;
console.log(`ANTIGO: ${oldHit}/${expected.length} tópicos chegaram ao modelo (${Math.round(oldHit / expected.length * 100)}%)`);

// --- pipeline NOVO
const chunks = buildChunks(normalizePages(pages));
const {
  selected,
  skipped
} = selectProgrammeChunks(chunks);
const newText = selected.map(c => c.text).join("\n");
const newHit = expected.filter(t => newText.includes(t)).length;
console.log(`NOVO: ${chunks.length} trechos, ${selected.length} selecionados (${skipped} ignorados), ${newHit}/${expected.length} tópicos chegam ao modelo`);

// --- "modelo" simulado: extrai linhas numeradas do trecho, com disciplina em caixa alta
const fakeCaller = (failIdx = []) => async prompt => {
  const m = prompt.match(/TRECHO (\d+) de/);
  const pos = m ? Number(m[1]) - 1 : -1;
  if (failIdx.includes(pos)) return null;
  const body = prompt.split("TEXTO DO TRECHO:")[1] ?? "";
  let subj = "";
  const topics = [];
  for (const line of body.split("\n")) {
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{6,}$/.test(line.trim()) && !line.includes("ANEXO")) subj = line.trim();
    const mm = line.match(/^\d+\.\s+(.*)$/);
    if (mm && subj) topics.push({
      subject: subj,
      unit: "",
      topic: mm[1],
      learning_order: topics.length,
      difficulty: "basic",
      prerequisite_topic: ""
    });
  }
  return {
    meta: {
      document_kind: "edital_oficial",
      classification_reason: "ok",
      detected_scope: "x",
      confidence: 0.9,
      warnings: []
    },
    topics
  };
};
const mk = (c, i, n) => `TRECHO ${i + 1} de ${n}\nTEXTO DO TRECHO:\n${c.text}`;
const run = await runChunked(selected, mk, fakeCaller(), {
  deadline: Date.now() + 60000
});
const merged = mergeChunkResults(run.results);
console.log(`merge: ${merged.topics.length} tópicos, falhas=${run.failed}, notRun=${run.notRun}`);
const subjOrder = [...new Set(merged.topics.map(t => t.subject))];
console.log("disciplinas na ordem:", subjOrder.length, subjOrder.slice(0, 3).join(" | "), "...");
const lo = merged.topics.filter(t => t.subject === subjOrder[0]).map(t => t.learning_order);
console.log("learning_order 1ª disciplina contínuo:", lo.every((v, i) => v === i), `(0..${lo.length - 1})`);
console.log("edital_order sequencial:", merged.topics.every((t, i) => t.edital_order === i));

// --- falha de 2 trechos
const runFail = await runChunked(selected, mk, fakeCaller([0, 1]), {
  deadline: Date.now() + 60000
});
console.log("com 2 falhas -> failed:", runFail.failed, "ok:", runFail.results.length);

// --- prazo estourado
let t = 1000;
const runLate = await runChunked(selected, mk, fakeCaller(), {
  deadline: 50000,
  now: () => t += 20000
});
console.log("prazo estourado -> ok:", runLate.results.length, "notRun:", runLate.notRun, "failed:", runLate.failed);

// --- edital curto: tudo é analisado
const small = buildChunks(normalizePages(pages.slice(0, 4)));
console.log("edital curto:", small.length, "trecho(s), selecionados:", selectProgrammeChunks(small).selected.length);
// --- página gigante (>30k) é dividida
const big = buildChunks(normalizePages([{
  page: 1,
  text: "linha de texto longa\n".repeat(5000)
}]));
console.log("página gigante dividida em", big.length, "trechos, max", Math.max(...big.map(c => c.chars)));

// --- regras citam disciplinas na pág. 3 (acerto falso cedo) + disciplina "estranha" no meio do anexo
const pages2 = JSON.parse(JSON.stringify(pages));
pages2[2].text += " A prova abrangerá Língua Portuguesa, Matemática, Informática e Direito Constitucional conforme conteúdo programático do Anexo II.";
const weird = pages2.findIndex(p => p.page === 95);
pages2[weird].text += "\nANATOMIA HUMANA\n1. Sistema esquelético e articulações do corpo humano em detalhe\n2. Sistema nervoso central e periférico em detalhe";
const c2 = buildChunks(normalizePages(pages2));
const s2 = selectProgrammeChunks(c2);
const txt2 = s2.selected.map(c => c.text).join("\n");
console.log("acerto falso cedo:", c2.length, "trechos ->", s2.selected.length, "selecionados; disciplina estranha incluída:", txt2.includes("ANATOMIA HUMANA"), "; tópicos:", expected.filter(t => txt2.includes(t)).length + "/476");

// ── asserções: falham o comando se a análise voltar a perder tópicos ──
const fail = m => {
  console.error("FALHOU:", m);
  process.exit(1);
};
if (newHit !== expected.length) fail("trechos não cobrem todos os tópicos do edital");
if (merged.topics.length !== expected.length) fail("merge perdeu tópicos");
if (run.failed || run.notRun) fail("execução por trechos não deveria falhar");
if (!txt2.includes("ANATOMIA HUMANA")) fail("disciplina fora da lista de palavras-chave foi ignorada");
console.log("OK: análise por trechos cobre 100% dos tópicos do edital sintético.");