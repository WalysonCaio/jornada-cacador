#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const meJs = fs.readFileSync('dist/missao-elite-features.js', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');

assert.ok(v77.includes("window.JCMissaoElite?.openQuestionToolPopup==='function'"), 'v77 QAP Invocador deve abrir popup em vez de fechar modal');
assert.ok(meJs.includes('jcQuestionToolPopup'), 'Dialog popup da questão ausente');
assert.ok(meJs.includes('stopImmediatePropagation'), 'Interceptador em fase de captura ausente');
assert.ok(css.includes('.jcToolPopupDialog'), 'CSS do popup da questão ausente');
assert.ok(/r19[7-9]/.test(sw), 'Service Worker deve estar na r197');

// Test detectToolTabFromButton across all 6 toolbar buttons AND ensure navigation buttons are NOT intercepted
const sandbox = {
  window: {},
  document: {
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  state: { activeCampaignId: 'pmpe', campaigns: [{ id: 'pmpe', name: 'PMPE — Soldado' }], scores: [], errors: {} },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
sandbox.window = sandbox;
vm.runInNewContext(meJs, sandbox);

const detect = sandbox.window.JCMissaoElite.detectToolTabFromButton;
const mkBtn = (text, id = '', attrs = {}) => ({
  id,
  textContent: text,
  dataset: {},
  hasAttribute: (k) => Boolean(attrs[k]),
});

assert.equal(detect(mkBtn('🧙‍♂️ INVOCADOR')), 'invocador');
assert.equal(detect(mkBtn('🧙‍♂️ QAP Invocador', 'askQapInstructorBtn')), 'invocador');
assert.equal(detect(mkBtn('💬 COMENTÁRIO DA QUESTÃO')), 'comentario');
assert.equal(detect(mkBtn('📖 TEORIA & LEI')), 'teoria');
assert.equal(detect(mkBtn('📱 CADERNOS')), 'cadernos');
assert.equal(detect(mkBtn('✏️ ANOTAÇÕES')), 'anotacoes');
assert.equal(detect(mkBtn('📈 MEU HISTÓRICO')), 'historico');

// Navigation & answer buttons must NOT be intercepted
assert.equal(detect(mkBtn('Próxima questão →', 'nextQuestion')), null);
assert.equal(detect(mkBtn('← Questão anterior', 'prevQuestionBtn')), null);
assert.equal(detect(mkBtn('Encerrar treino e voltar', 'closeQuestions')), null);
assert.equal(detect(mkBtn('✕ Sair', 'closeQuestionsTopBtn')), null);
assert.equal(detect(mkBtn('⚪ Deixar em Branco (Modo Líquido Caveira)', 'skipQuestionBlankBtn')), null);
assert.equal(detect(mkBtn('☀️ Modo Papel', 'toggleModalPaperModeBtn')), null);
assert.equal(detect(mkBtn('⚑ Reportar erro nesta questão', 'meReportQuestionBtn')), null);

console.log('✅ test-r197-question-popup: TODOS OS 6 BOTÕES E PROTEÇÕES DE NAVEGAÇÃO VALIDADOS!');
