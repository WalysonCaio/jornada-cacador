// Termômetro de aprovação: sem números inventados, com amostra mínima e meta configurável.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const v77 = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const a = v77.indexOf("const CUTOFF_MIN_SAMPLE"), b = v77.indexOf("function ensureCutoffThermometer");
assert(a >= 0 && b > a, "helpers do termômetro não encontrados");
const ctx = { state: { activeCampaignId: "c1", cutoffTargets: {} } }; vm.createContext(ctx);
vm.runInContext(v77.slice(a, b), ctx);
const A = (t, c, target) => vm.runInContext(`cutoffAssessment(${t},${c},${target ?? "cutoffTarget()"})`, ctx);

// 1) 1 acerto em 1 questão não vira "elite": amostra pequena e intervalo largo
const one = A(1, 1); assert(one.lowSample && one.rate === 100 && one.lo < 50, `1/1 deveria ser amostra pequena (lo=${one.lo})`);
const ten = A(10, 8); assert(ten.lowSample && ten.lo >= 45 && ten.lo <= 52 && ten.hi >= 90 && ten.hi <= 96, `Wilson 8/10 inesperado: ${ten.lo}-${ten.hi}`);
// 2) com 30+ questões a leitura passa a valer e o intervalo estreita
const big = A(300, 240); assert(!big.lowSample && big.hi - big.lo < 12);
// 3) quantas seguidas faltam (conferido na mão): 20/30, meta 72 => 6
assert.equal(A(30, 20, 72).needTarget, 6); assert.equal(A(30, 24, 72).needTarget, 0);
assert.equal(A(0, 0).rate, 0); assert.equal(A(10, 99).correct, 10, "acertos não podem passar do total");
// 4) meta personalizada e validação
assert.equal(vm.runInContext("cutoffTarget()", ctx), 72);
ctx.state.cutoffTargets.c1 = 80; assert.equal(vm.runInContext("cutoffTarget()", ctx), 80);
ctx.state.cutoffTargets.c1 = 10; assert.equal(vm.runInContext("cutoffTarget()", ctx), 72, "meta fora de 40–95 deve voltar ao padrão");
ctx.state.cutoffTargets.c1 = 90; assert(A(100, 90).elite > 90 && A(100, 90).elite <= 98);
// 5) o código não pode voltar a inventar números nem citar fonte inexistente
assert(!/\?35:0/.test(v77), "acerto inventado de 35% para disciplina sem amostra");
assert(!/Média histórica PMPE/.test(v77), "afirmação sem fonte sobre média histórica");
assert(/b\.rate===null/.test(v77) && /cutoffAssessment\(total,correct,target\)/.test(v77), "painel deve usar a avaliação com amostra mínima");
console.log("OK: termômetro honesto (amostra mínima, intervalo, meta configurável, sem números inventados).");
