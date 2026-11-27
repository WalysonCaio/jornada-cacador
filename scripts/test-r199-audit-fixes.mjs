#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const meJs = fs.readFileSync('dist/missao-elite-features.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const html = fs.readFileSync('dist/index.html', 'utf8');
const vq = fs.readFileSync('supabase/functions/validate-questions/index.ts', 'utf8');

// 1. Real CSS selectors (body.lightAppTheme, no broken [data-theme="light"])
assert.ok(!css.includes('[data-theme="light"]'), 'Não deve restar nenhum seletor inativo [data-theme="light"]');
assert.ok(css.includes('body.lightAppTheme .meMissionProg') && css.includes('#0369a1'), 'Contraste .meMissionProg em body.lightAppTheme ausente');
assert.ok(css.includes('body.lightAppTheme #profile .jcProfileRoleBadge'), 'Contraste do cabeçalho do Perfil em body.lightAppTheme ausente');
assert.ok(css.includes('#jcEditProfileDrawer[hidden]'), 'Proteção hidden do drawer de perfil ausente');

// 2. Service Worker non-blocking cache.put + 5xx fallback
assert.ok(sw.includes('e.waitUntil(cache.put('), 'SW deve usar e.waitUntil para cache.put');
assert.ok(sw.includes('if (r.status >= 500)'), 'SW deve fazer fallback para cache em HTTP >= 500');
assert.ok(sw.includes('r199'), 'SW deve estar na r199');
assert.ok(html.includes('Revisão r199'), 'Diagnóstico deve exibir Revisão r199');

// 3. validate-questions POST-only + finite integer limit
assert.ok(vq.includes('req.method !== "POST"') && vq.includes('Number.isFinite(rawLimit)'), 'Hardening POST/limit ausente em validate-questions');

// 4. Behavioral VM tests for M5 (null->A), M8 (localDayKey), M7 (CBMPE & min sample)
const sandbox = {
  window: {},
  document: {
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  state: {
    activeCampaignId: 'cbmpe',
    campaigns: [{
      id: 'cbmpe',
      name: 'CBMPE — Soldado Bombeiro',
      examDate: '2027-02-21',
      customCampaign: { missions: [{ id: 'm1', subject: 'Física' }, { id: 'm2', subject: 'Química' }, { id: 'm3', subject: 'Biologia' }] },
    }],
    scores: [{ campaignId: 'cbmpe', subject: 'Física', total: 1, correct: 1, date: '2026-11-27T01:30:00Z' }],
    errors: {},
  },
  localDayKey: (dt) => {
    const d = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
sandbox.window = sandbox;
vm.runInNewContext(meJs, sandbox);

const api = sandbox.window.JCMissaoElite;
assert.equal(api.version, 'r199');

// M5: null / undefined / "" correct_index must NEVER become 0 ("A")
assert.equal(api.validKeyIndex({ correct_index: null, options: ['A', 'B'] }), null);
assert.equal(api.validKeyIndex({ correct_index: undefined, options: ['A', 'B'] }), null);
assert.equal(api.validKeyIndex({ correct_index: '', options: ['A', 'B'] }), null);
assert.equal(api.validKeyIndex({ correct_index: 0, answer_unknown: true, options: ['A', 'B'] }), null);
assert.equal(api.validKeyIndex({ correct_index: 2, options: ['A', 'B', 'C'] }), 2);

const ctxNull = api.buildQuestionContextForPopup({ statement: 'Teste?', options: ['A1', 'B1'], correct_index: null });
assert.ok(!ctxNull.includes('Gabarito cadastrado: A'), 'correct_index null NÃO pode enviar Gabarito cadastrado: A!');
assert.ok(ctxNull.includes('Gabarito cadastrado: não confirmado'), 'correct_index null deve enviar não confirmado');

// M8: 2026-11-27T01:30:00Z in America/Sao_Paulo (-03:00) must map to 2026-11-26
assert.equal(api.scoreDayKey('2026-11-27T01:30:00Z'), '2026-11-26');

// M7: CBMPE with Física/Química/Biologia must NOT receive PMPE blocks, and 1 question must NOT claim "seguro"
const radarCbmpe = api.computeEliminationRadar();
const allSubjs = radarCbmpe.blocks.flatMap((b) => b.subjects);
assert.ok(allSubjs.includes('Física') && !allSubjs.includes('História de Pernambuco'), 'CBMPE não pode receber blocos da PMPE');
assert.equal(radarCbmpe.status, 'sem_dados', 'Apenas 1 questão não pode classificar como seguro/aprovado');

console.log('✅ test-r199-audit-fixes: TODOS OS TESTES COMPORTAMENTAIS DA ONDA 2 PASSARAM!');
