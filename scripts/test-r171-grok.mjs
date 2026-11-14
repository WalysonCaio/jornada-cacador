import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const idxSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const swSrc = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
const guiaSrc = readFileSync(new URL("../GUIA-UNIFICADO.md", import.meta.url), "utf8");
const javaSrc = readFileSync(new URL("../android/app/src/main/java/br/com/jornadadocacador/app/MainActivity.java", import.meta.url), "utf8");

// 1. Validar versão r177 no service worker e guia
assert(swSrc.includes("r177"), "sw.js deve estar na versao r177");
assert(guiaSrc.includes("r177"), "GUIA-UNIFICADO.md deve estar na versao r177");

// 2. Executar e testar as funções do r177 no VM
const ctx = {
  window: {},
  state: {
    activeCampaignId: "pmpe",
    topicMastery: {
      "pmpe|dir_const|art5": { subjectKey: "dir_const", attempts: 12, correct: 9 }, // 75%
      "pmpe|dir_penal|crimes": { subjectKey: "dir_penal", attempts: 5, correct: 5 }   // 100%, mas <10 questões
    }
  },
  subjectKey: (s) => (s.includes("Const") ? "dir_const" : s.includes("Penal") ? "dir_penal" : s),
  canonicalSubjectName: (s) => s
};
vm.createContext(ctx);

// Extrair e rodar as funções de v77-experience.js
const funcSlice = v77Src.slice(
  v77Src.indexOf("function disciplineReadyForBoss("),
  v77Src.indexOf("async function completeMissionHonestServer(")
);
vm.runInContext(funcSlice, ctx);

// Teste 1: disciplineReadyForBoss
const constBoss = ctx.disciplineReadyForBoss("Direito Constitucional");
assert.equal(constBoss.attempts, 12);
assert.equal(constBoss.score, 75);
assert.equal(constBoss.ready, true, "Constitucional tem 12 questões e 75%, deve liberar o chefe");

const penalBoss = ctx.disciplineReadyForBoss("Direito Penal");
assert.equal(penalBoss.attempts, 5);
assert.equal(penalBoss.score, 100);
assert.equal(penalBoss.ready, false, "Penal tem apenas 5 questões (min 10), chefe deve permanecer bloqueado");

// Teste 2: questionOriginSeal
assert.equal(ctx.questionOriginSeal({ origin: "oficial" }), "OFICIAL");
assert.equal(ctx.questionOriginSeal({ origin: "autoral", from_community: true }), "COMUNIDADE");
assert.equal(ctx.questionOriginSeal({ origin: "autoral", bank: "nativo" }), "NATIVO");
assert.equal(ctx.questionOriginSeal({ origin: "adaptada_do_pdf" }), "IA DO SEU MATERIAL");

// Teste 3: answerKeyStatus e gradeAnswer
const qOficial = { origin: "oficial", correct_index: 2 };
assert.equal(ctx.answerKeyStatus(qOficial), "oficial");
const g1 = ctx.gradeAnswer(qOficial, 2); assert.equal(g1.status, "oficial"); assert.equal(g1.scored, true); assert.equal(g1.ok, true);
const g2 = ctx.gradeAnswer(qOficial, 0); assert.equal(g2.status, "oficial"); assert.equal(g2.scored, true); assert.equal(g2.ok, false);

const qSemGab = { origin: "oficial", answer_unknown: true, correct_index: -1 };
assert.equal(ctx.answerKeyStatus(qSemGab), "sem_gabarito");
assert.equal(ctx.gradeAnswer(qSemGab, 1).scored, false, "Questao sem gabarito nao pontua acerto nem erro");

const qAnulada = { origin: "oficial", annulled: true, correct_index: -1 };
assert.equal(ctx.answerKeyStatus(qAnulada), "anulada");
assert.equal(ctx.gradeAnswer(qAnulada, 3).scored, false, "Questao anulada nao pontua");

// Teste 4: Android MainActivity
assert(javaSrc.includes("setAllowFileAccess(false);"), "MainActivity deve desativar allowFileAccess por seguranca");
assert(javaSrc.includes("Sem conexão"), "MainActivity deve ter tela de erro offline personalizada");
assert(javaSrc.includes("shouldOverrideUrlLoading"), "MainActivity deve tratar schemes externos com seguranca");

// Teste 5: index.html
assert(idxSrc.includes("disciplineReadyForBoss"), "index.html deve checar disciplineReadyForBoss para liberar o chefe");
assert(idxSrc.includes("questionOriginSeal"), "index.html deve usar questionOriginSeal para rotular as questoes");

console.log("OK: Todas as melhorias Grok (r177) validadas com 100% de sucesso!");
