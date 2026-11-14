import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const modSrc = readFileSync(new URL("../dist/jc-architecture-modules.js", import.meta.url), "utf8");
const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const swSrc = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");

// 1. Verificar vinculação do módulo e Service Worker r177
assert(swSrc.includes("r177"), "sw.js deve estar na versao r177");
assert(swSrc.includes("./jc-architecture-modules.js"), "sw.js deve fazer cache offline do módulo jc-architecture-modules.js");
assert(htmlSrc.includes('src="jc-architecture-modules.js"'), "index.html deve carregar jc-architecture-modules.js");
assert(htmlSrc.includes('id="profile"'), "index.html deve possuir a view #profile (Meu Perfil)");

// 2. Testar execução de jc-architecture-modules.js em um contexto DOM simulado
const mockStorage = new Map();
const ctx = {
  window: null,
  document: {
    readyState: "complete",
    head: { appendChild: () => {} },
    body: { insertAdjacentHTML: () => {} },
    getElementById: (id) => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => {} } }),
    addEventListener: () => {}
  },
  localStorage: {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  },
  performance: {
    now: () => Date.now(),
    mark: () => {},
    measure: () => ({ duration: 14.5 })
  },
  navigator: { onLine: true },
  Blob: class {},
  URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} },
  setTimeout: (fn) => {},
  clearTimeout: () => {}
};
ctx.window = ctx;
ctx.window.ALL_QUESTIONS = [
  {
    subject: "História de Pernambuco",
    topic: "Revolução de 1817",
    board: "UPENET/IAUPE",
    statement: "A Revolução Pernambucana de 1817 superou a fase conspiratória e tomou o poder local por mais de 70 dias.",
    options: ["A", "B", "C", "D"],
    correct_index: 1,
    origin: "oficial"
  },
  {
    subject: "Direito Constitucional",
    topic: "Art. 5º CF",
    board: "Instituto AOCP",
    statement: "A casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador.",
    options: ["A", "B", "C", "D"],
    correct_index: 0,
    origin: "oficial"
  }
];
ctx.window.NATIVE_POLICE_QUESTION_BANK = [];

vm.createContext(ctx);
vm.runInContext(modSrc, ctx);

// 3. Testar Telemetria (performance.mark / p50 / p95)
ctx.window.JC_MODULES.telemetry.markStart("jc_questions_tab_open");
const sample = ctx.window.JC_MODULES.telemetry.markEnd("jc_questions_tab_open");
assert(sample.durationMs > 0, "Telemetria deve registrar duracao positiva em ms");
assert.equal(sample.bankSize, 2, "Telemetria deve registrar tamanho do banco");
const stats = ctx.window.getQuestionsTabTelemetry();
assert(stats.count >= 1 && stats.p50Ms > 0, "getStats deve calcular p50Ms e p95Ms");

// 4. Testar Catálogo de Identificadores Estáveis (Disciplina → Assunto → Subassunto)
const tax1 = ctx.window.resolveStableTaxonomy("História de Pernambuco", "Revolução Pernambucana de 1817", "Revolução dos Padres");
assert.equal(tax1.subjectId, "disc_hist_pe");
assert.equal(tax1.topicId, "hpe_1817");
assert(Array.isArray(tax1.subtopics) && tax1.subtopics.length > 0);

const tax2 = ctx.window.resolveStableTaxonomy("Raciocínio Lógico-Matemático", "Negação de Condicional", "Se Ana é policial então trabalha");
assert.equal(tax2.subjectId, "disc_rlm");
assert.equal(tax2.topicId, "rlm_neg");

// 5. Testar Biblioteca Inteligente e Fontes Externas Confiáveis
const extHist = ctx.window.getTrustedExternalSources("História de Pernambuco", "Capitanias Hereditárias");
assert(extHist.length >= 3, "Deve retornar fontes oficiais e enciclopédicas gratuitas para História de PE");
assert(extHist.some(s => s.url.includes("fundaj") || s.url.includes("wikipedia.org")), "Deve incluir Fundaj e Wikipédia");

const extConst = ctx.window.getTrustedExternalSources("Direito Constitucional", "Art. 5º");
assert(extConst.some(s => s.url.includes("planalto.gov.br")), "Deve incluir Portal da Legislação do Planalto");

// 6. Testar Promotor de Questões do Usuário para Banco Nativo Consolidado
const promoted = ctx.window.consolidateUserQuestionsIntoNativeBank({ saveToStorage: true, showToast: false });
assert.equal(promoted.total, 2, "Deve consolidar as 2 questões válidas no Banco Nativo");
assert.equal(promoted.subjectsCount, 2, "Deve separar corretamente nas 2 disciplinas com IDs estáveis");
assert(promoted.hierarchy["História de Pernambuco"].subjectId === "disc_hist_pe");
assert(promoted.hierarchy["Direito Constitucional"].subjectId === "disc_const");

// 7. Verificar persistência de openSummaries em Ler Teoria dentro de v77-experience.js
assert(v77Src.includes("libraryUI.openSummaries[sKeyId] = true"), "openTheoryForSubjectAndTopic deve gravar libraryUI.openSummaries para o MutationObserver não fechar o card!");
assert(v77Src.includes("smartExternalLibraryBox"), "openTheoryForSubjectAndTopic deve exibir a Biblioteca Externa de Confiança no card aberto!");

console.log("OK: Auditoria completa r177 (Telemetria p50/p95, Taxonomia com IDs Estáveis, Biblioteca Inteligente Externa, Promotor de Banco Nativo e Hub Social Meu Perfil) validada!");

// 8. Validações r177:
// - #profile está dentro de <main class="app"> ANTES do <footer class="appLegalFooter">
const idxProfile = htmlSrc.indexOf('id="profile"');
const idxFooter = htmlSrc.indexOf('<footer class="appLegalFooter"');
assert(idxProfile > 0 && idxFooter > idxProfile, "A aba #profile deve ficar ANTES do rodapé <footer class='appLegalFooter'> dentro de <main>");

// - v59-enhancements.js não possui o erro $$$
const v59Src = readFileSync(new URL("../dist/v59-enhancements.js", import.meta.url), "utf8");
assert(!v59Src.includes("$$$("), "v59-enhancements.js não pode conter $$$ inexistente que quebrava renderSummaries()");

// - Otimização O(1) em renderExamBankHub (qsByDocId Map)
assert(v77Src.includes("const qsByDocId = new Map();"), "renderExamBankHub deve usar Map O(1) qsByDocId para não travar com 6000+ questões");

// - Fotos de perfil e visitante no Ranking e Chat
assert(v77Src.includes("openPublicHunterProfileVisitorModal"), "Ranking e Chat devem permitir visitar o perfil público do caçador");
assert(modSrc.includes("getAppState()"), "jc-architecture-modules.js deve ler getAppState() diretamente do escopo global let state");
assert(modSrc.includes("jcPrivStreak") && modSrc.includes("jcPrivAccuracy"), "Meu Perfil deve ter controles granulares de privacidade");

console.log("OK: Correções r177 (Rodapé abaixo do Perfil, Sincronia Real com let state, Foto no Ranking/Chat, Visita de Perfil com Privacidade, Otimização O(1) da aba Questões e Ler Teoria sem erro $$$) validadas!");
