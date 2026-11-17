// "Adicionar gabarito depois": aplica só o que é seguro e nunca corrige o aluno com resposta de outra questão.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const grab = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); assert(a >= 0 && b > a, `trecho não encontrado: ${from}`); return src.slice(a, b); };
const code = [grab("function parseExamAnswerKeyTable(", "window.extractStructuredExamQuestions="), grab("async function attachAnswerKeyToExistingDoc", "window.attachAnswerKeyToExistingDoc=")].join("\n");

async function run({ questions, pasted, preferredCaderno = "" }) {
  const toasts = [], patches = [];
  const row = { id: "r1", title: "Prova", content: { questions: JSON.parse(JSON.stringify(questions)) } };
  const doc = { id: "d1", title: "Prova AOCP", metadata: {} };
  const ctx = {
    cloudDocuments: [doc], toast: (m) => toasts.push(m), window: { askUserExamAnswerKeyOptions: async () => ({ appendedText: pasted, preferredCaderno }) },
    validSession: async () => ({ ok: true }), canonicalSubjectName: (s, d) => d || "x", render() {}, renderExamBankHub() {}, loadGeneratedContent: async () => {}, loadCloudDocuments: async () => {},
    cloudFetch: async (url, init = {}) => { if (init.method === "PATCH") { patches.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({}) }; } return { ok: true, json: async () => [row] }; },
  };
  ctx.window.attachAnswerKeyToExistingDoc = null; vm.createContext(ctx); vm.runInContext(code + "\nthis.__run = attachAnswerKeyToExistingDoc;", ctx);
  await ctx.__run("d1");
  const saved = patches.find((p) => p.url.includes("generated_study_content"));
  return { toasts, qs: saved ? saved.body.content.questions : null, patched: patches.length };
}
const mk = (n, extra = {}) => ({ topic: `Questão ${n} · AOCP`, statement: `Enunciado da questão ${n} do caderno.`, options: ["a", "b", "c", "d", "e"], correct_index: -1, answer_unknown: true, origin: "adaptada_do_pdf", explanation: "Questão importada SEM gabarito: ainda não pode ser corrigida.", ...extra });

// A) caso feliz: aplica pelo número da questão e ativa a correção
{ const r = await run({ questions: [1, 2, 3, 4].map((n) => mk(n)), pasted: "1-A 2-B 3-C 4-D 5-E" });
  assert.deepEqual(r.qs.map((q) => q.correct_index), [0, 1, 2, 3]); assert(r.qs.every((q) => q.origin === "oficial" && !q.answer_unknown)); }
// B) dois cadernos colados juntos: recusa e não grava nada
{ const r = await run({ questions: [1, 2, 3, 4].map((n) => mk(n)), pasted: "TIPO 1: 1-A 2-B 3-C 4-D\nTIPO 2: 1-C 2-D 3-E 4-A" });
  assert.equal(r.patched, 0, "não pode gravar gabarito ambíguo"); assert(r.toasts.some((m) => /mais de um gabarito/i.test(m))); }
// C) número ausente no gabarito: a questão continua sem gabarito (não pega a resposta de outra pela posição)
{ const r = await run({ questions: [mk(1), mk(2), mk(7)], pasted: "1-A 2-B 3-C 4-D 5-E" });
  const q7 = r.qs[2]; assert.equal(q7.correct_index, -1); assert.equal(q7.answer_unknown, true, "a questão 7 não pode herdar a resposta da posição 3"); }
// D) questão que já tinha gabarito do documento não é sobrescrita
{ const r = await run({ questions: [mk(1, { correct_index: 3, answer_unknown: undefined, origin: "oficial" }), mk(2)], pasted: "1-A 2-B 3-C 4-D 5-E" });
  assert.equal(r.qs[0].correct_index, 3, "não pode sobrescrever resposta já existente"); assert.equal(r.qs[1].correct_index, 1); }
// E) Certo/Errado
{ const ce = (n) => ({ topic: `Item ${n} (C/E) · Cebraspe`, statement: `Julgue o item ${n} da prova de legislação.`, options: ["CERTO", "ERRADO"], correct_index: -1, answer_unknown: true, origin: "adaptada_do_pdf", explanation: "Item C/E importado SEM gabarito: ainda não pode ser corrigido." });
  const r = await run({ questions: [ce(51), ce(52), ce(53), ce(54)], pasted: "51 C 52 E 53 C 54 E" });
  assert.deepEqual(r.qs.map((q) => q.correct_index), [0, 1, 0, 1]); }
// F) Questão ANULADA no gabarito tardio é marcada como annulled=true e não conta como "sem gabarito"
{ const r = await run({ questions: [mk(1), mk(2), mk(3), mk(4)], pasted: "1-A 2-ANULADA 3-C 4-D" });
  assert.equal(r.qs[0].correct_index, 0);
  assert.equal(r.qs[1].annulled, true, "questão anulada deve receber annulled=true");
  assert.equal(r.qs[1].answer_unknown, undefined, "questão anulada não deve ficar como answer_unknown"); }
console.log("OK: adicionar gabarito depois (aplica por número, recusa ambiguidade, não sobrescreve nem usa a posição).");
