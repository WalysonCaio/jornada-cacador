// Banco nativo de questões: rótulo honesto, gabarito íntegro e sem viés de posição da resposta certa.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const a = src.indexOf("const NATIVE_POLICE_QUESTION_BANK = ["), b = src.indexOf("window.NATIVE_POLICE_QUESTION_BANK = NATIVE_POLICE_QUESTION_BANK;");
assert(a >= 0 && b > a, "banco nativo não encontrado");
const code = src.slice(a, b).replace("const NATIVE_POLICE_QUESTION_BANK", "var NATIVE_POLICE_QUESTION_BANK");
const load = () => { const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx.NATIVE_POLICE_QUESTION_BANK; };
const bank = load(), L = "ABCDE";

// 1) integridade mecânica
assert(bank.length >= 100, `esperava o banco completo (obteve ${bank.length})`);
const seen = new Set();
for (const [i, q] of bank.entries()) {
  assert(Array.isArray(q.options) && q.options.length >= 3 && q.options.length <= 5, `#${i} nº de alternativas`);
  assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length, `#${i} gabarito fora das alternativas`);
  assert.equal(new Set(q.options.map((o) => String(o).trim().toLowerCase())).size, q.options.length, `#${i} alternativas repetidas`);
  assert(String(q.explanation || "").length >= 80, `#${i} explicação curta`);
  const key = String(q.statement).replace(/\s+/g, " ").trim().toLowerCase(); assert(!seen.has(key), `#${i} enunciado duplicado`); seen.add(key);
}
// 2) rótulo honesto: são questões autorais, só o estilo é da banca
assert(bank.every((q) => q.origin === "autoral"), "questões escritas por nós não podem ser 'oficial'");
assert(bank.every((q) => q.norma_base && q.verified_at), "toda questão deve registrar norma_base e verified_at");
assert(new Set(bank.map((q) => q.board)).size >= 4, "o campo board (estilo da banca) deve ser preservado para os filtros");
// 3) a resposta certa não pode ficar quase sempre na mesma posição
const pos = [0, 0, 0, 0, 0]; bank.forEach((q) => pos[q.correct_index]++);
for (let i = 0; i < 4; i++) { const pct = pos[i] / bank.length; assert(pct >= 0.15 && pct <= 0.38, `viés de posição: a resposta certa está na alternativa ${L[i]} em ${Math.round(pct * 100)}% das questões`); }
// 4) comentários coerentes com o gabarito depois de embaralhar
for (const [i, q] of bank.entries()) {
  const m = q.explanation.match(/Alternativa correta:\s*([A-E])\)/); assert(m && m[1] === L[q.correct_index], `#${i} o comentário cita a letra errada como correta`);
  const an = q.explanation.match(/An[aá]lise das alternativas:\s*([^|]*)/);
  if (an) { const cited = [...an[1].matchAll(/(?:^|;\s*)([A-E])\)\s/g)].map((x) => x[1]); const expected = [...L].slice(0, q.options.length).filter((_, k) => k !== q.correct_index);
    if (cited.length === expected.length) assert.equal(cited.join(""), expected.join(""), `#${i} análise cita letras que não batem com as alternativas`); }
}
// 5) alternativas que dependem da ordem ("todas/nenhuma as anteriores", "A e C", numerais romanos) ficam exatamente como estavam
{
  const loadRaw = () => { const ctx = {}; vm.createContext(ctx); vm.runInContext(code.replace("normalizeNativeQuestionBank(NATIVE_POLICE_QUESTION_BANK);", ""), ctx); return ctx.NATIVE_POLICE_QUESTION_BANK; };
  const raw = loadRaw();
  assert.equal(raw.length, bank.length);
  const orderDependent = /\b(todas|nenhuma|ambas|anterior(?:es)?|acima|abaixo)\b|\balternativas?\s+[a-e]\b|\b[a-e]\s+e\s+[a-e]\b/i;
  const numeralOnly = /^\s*(?:[IVX]+|\d+)(?:\s*(?:,|e|ou)\s*(?:[IVX]+|\d+))*\s*(?:apenas|somente)?\.?\s*$/i;
  let guarded = 0, moved = 0;
  raw.forEach((q, i) => {
    const dependent = q.options.some((o) => orderDependent.test(String(o))) || q.options.every((o) => numeralOnly.test(String(o).trim()));
    if (dependent) { guarded++; assert.equal(JSON.stringify(bank[i].options), JSON.stringify(q.options), `#${i} tem alternativas que dependem da ordem e foi embaralhada`); assert.equal(bank[i].correct_index, q.correct_index); }
    else if (JSON.stringify(bank[i].options) !== JSON.stringify(q.options)) moved++;
    assert.equal(bank[i].statement, q.statement, `#${i} o enunciado não pode mudar`);
  });
  assert(guarded >= 8, `o teste precisa exercitar questões dependentes da ordem (achou ${guarded})`);
  assert(moved >= 70, `esperava que a maioria das questões fosse embaralhada (embaralhou ${moved})`);
}
// 6) determinístico: a mesma ordem em toda sessão
assert.deepEqual(JSON.stringify(load().map((q) => [q.options, q.correct_index])), JSON.stringify(bank.map((q) => [q.options, q.correct_index])));
// 7) o filtro da AOCP não pode puxar toda questão oficial
assert(!/target\.includes\('aocp'\)\)\s*return[^;]*item\?\.origin === 'oficial'/.test(src), "filtro AOCP inclui toda questão oficial (Cebraspe/FGV apareciam como AOCP)");
console.log(`OK: banco nativo (${bank.length} questões autorais, posição da certa A/B/C/D = ${pos.slice(0, 4).join("/")}, comentários coerentes, sem viés).`);
