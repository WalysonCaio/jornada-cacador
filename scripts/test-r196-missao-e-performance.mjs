#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const v59 = fs.readFileSync('dist/v59-enhancements.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const eqClient = fs.readFileSync('dist/exam-questions-client.js', 'utf8');
const meJs = fs.readFileSync('dist/missao-elite-features.js', 'utf8');

// 1. Performance fixes verification
assert.ok(html.includes('window.bumpQuestionPoolVersion'), 'O(1) _getQuestionPoolSignature epoch missing');
assert.ok(!html.includes('snapshot=JSON.stringify([item.id,item.subject'), 'Old O(N) JSON.stringify loop still present!');
assert.ok(html.includes('function persistProgressLocallyNow()'), 'Debounced persistProgressLocally missing');
assert.ok(html.includes("window.addEventListener('pagehide'"), 'Safe pagehide flush missing');
assert.ok(html.includes('<script src="missao-elite-features.js" defer></script>'), 'missao-elite-features.js not loaded');
assert.ok(v77.includes('updateGuildUnreadBadge._lastSig'), 'updateGuildUnreadBadge memoization missing');
assert.ok(v77.includes('ensureLocalDbBars._mounted'), 'ensureLocalDbBars mount cache missing');
assert.ok(v77.includes('el._lastLocalDbLabel!==label'), 'updateLocalDbBadgeUI innerHTML guard missing');
assert.ok(v59.includes('requestAnimationFrame(()=>{_sumObsRaf=0;restoreOpenSummaries()})'), 'v59 MutationObserver rAF throttle missing');
assert.ok(css.includes('contain: layout style;'), 'CSS layout containment missing');
assert.ok(css.includes('touch-action: manipulation;'), 'CSS touch-action optimization missing');
assert.ok(/r19[6-9]/.test(sw) && sw.includes('missao-elite-features.js'), 'SW not bumped to r196');
assert.ok(eqClient.includes('superseded_at=is.null'), 'v115 superseded_at filter must be preserved');

// 2. Benchmark O(1) _getQuestionPoolSignature with 3,000 questions x 25 calls
const sigStart = html.indexOf('window._jcQuestionPoolEpoch =');
const sigEnd = html.indexOf('function _questionCanTrain', sigStart);
const sigCode = html.slice(sigStart, sigEnd);
const fakeQuestions = Array.from({ length: 3000 }, (_, i) => ({
  id: `q-${i}`,
  subject: 'Língua Portuguesa',
  statement: 'Enunciado longo '.repeat(25) + i,
  options: ['A', 'B', 'C', 'D', 'E'],
  correct_index: i % 5,
}));
const benchCtx = {
  window: {},
  globalThis: {},
  state: { activeCampaignId: 'pmpe', _ownerUserId: 'u1', _resetEpoch: 0 },
  cloudSession: { user: { id: 'u1' } },
  ALL_QUESTIONS: fakeQuestions,
};
benchCtx.window = benchCtx;
benchCtx.globalThis = benchCtx;
vm.runInNewContext(sigCode, benchCtx);
const t0 = performance.now();
for (let i = 0; i < 25; i++) benchCtx._getQuestionPoolSignature();
const elapsed = performance.now() - t0;
console.log(`Benchmark _getQuestionPoolSignature (3.000 questões x 25 chamadas): ${elapsed.toFixed(2)} ms`);
assert.ok(elapsed < 15, `Esperava <15ms para 25 chamadas O(1), obteve ${elapsed.toFixed(2)}ms`);

// 3. Functional tests for dist/missao-elite-features.js (Radar, Missão de Hoje, Redação Inline)
const sandbox = {
  window: {},
  document: {
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  state: {
    activeCampaignId: 'pmpe',
    campaigns: [{ id: 'pmpe', name: 'PMPE — Soldado', examDate: '2027-02-21' }],
    scores: [
      { campaignId: 'pmpe', subject: 'Língua Portuguesa', total: 10, correct: 8, date: '2026-11-26T10:00:00Z' },
      { campaignId: 'pmpe', subject: 'Informática', total: 5, correct: 0, date: '2026-11-26T10:00:00Z' },
    ],
    errors: { e1: { campaignId: 'pmpe', subject: 'Informática', misses: 3 } },
  },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
sandbox.window = sandbox;
vm.runInNewContext(meJs, sandbox);

const api = sandbox.window.JCMissaoElite;
assert.ok(/^r19[6-9]$/.test(api.version));

const radar = api.computeEliminationRadar();
assert.equal(radar.status, 'eliminado', 'Zerar Informática deve disparar status eliminado');
assert.equal(radar.criticalSubject, 'Informática');

const blocks = api.getTodayMissionBlocks();
assert.equal(blocks.length, 2, 'Missão de hoje deve gerar 2 blocos');

const marked = api.highlightEssayText('O voluntariado é uma coisa importante.', [
  { excerpt: 'uma coisa', note: 'Evite termo vago' },
]);
assert.ok(marked.includes('<mark class="meEssayMark"'), 'Redação deve marcar trecho inline');

console.log('✅ test-r196-missao-e-performance: TODOS OS TESTES PASSARAM!');
