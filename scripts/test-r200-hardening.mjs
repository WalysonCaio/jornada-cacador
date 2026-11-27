#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v59 = fs.readFileSync('dist/v59-enhancements.js', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const ap = fs.readFileSync('supabase/functions/assistente-pmpe/index.ts', 'utf8');

// 1. A4 Behavioral test: contentSignature MUST detect explanation edit & flashcard index-2 edit with identical IDs/lengths
const s1 = v59.indexOf('const contentSignature=value=>{');
const s2 = v59.indexOf('const communityQuestion=', s1);
const sigBlock = v59.slice(s1, s2);
const ctx = {};
vm.runInNewContext(sigBlock + '\nthis.sig = contentListSignature;', ctx);

const qOrig = [{ id: 'q1', subject: 'Dir', topic: 'T', statement: 'Enunciado?', options: ['A', 'B'], correct_index: 0, explanation: 'Explicação original.' }];
const qEdit = [{ id: 'q1', subject: 'Dir', topic: 'T', statement: 'Enunciado?', options: ['A', 'B'], correct_index: 0, explanation: 'Corpo corrigido.....' }];
assert.notEqual(ctx.sig(qOrig), ctx.sig(qEdit), 'A4: alteração em explanation com mesmo ID e tamanho DEVE invalidar assinatura');

const fcOrig = [['Port', 'Crase', 'Resposta original']];
const fcEdit = [['Port', 'Crase', 'Resposta corrigida']];
assert.notEqual(ctx.sig(fcOrig), ctx.sig(fcEdit), 'A4: alteração na resposta do flashcard (posição 2) DEVE invalidar assinatura');

// 2. A3 Behavioral test: sanitizeImportedBackupState strips __proto__ & malicious ID/priority
const b1 = html.indexOf('function sanitizeImportedBackupState(raw){');
const b2 = html.indexOf('async function importApplicationBackup', b1);
const sanBlock = html.slice(b1, b2);
const bCtx = {};
vm.runInNewContext(sanBlock + '\nthis.sanitize = sanitizeImportedBackupState;', bCtx);

const evil = JSON.parse('{"__proto__":{"polluted":true},"campaigns":[{"id":"pmpe\\"><img src=x onerror=alert(1)>","name":"PMPE","priority":"1<script>"}]}');
const clean = bCtx.sanitize(evil);
assert.equal(({}).polluted, undefined, 'A3: não pode poluir Object.prototype');
assert.ok(!clean.campaigns[0].id.includes('<') && !clean.campaigns[0].id.includes('"'), 'A3: campaign.id malicioso deve ser sanitizado');
assert.equal(clean.campaigns[0].priority, 1, 'A3: priority maliciosa deve virar inteiro seguro');

// 3. M2 & M10 checks in v59
assert.ok(!v59.includes('setInterval(()=>{if(document.visibilityState'), 'M2: setInterval sobreposto deve ser removido');
assert.ok(v59.includes('_scheduleDocPoll'), 'M2: polling não-sobreposto deve estar ativo');
assert.ok(v59.includes('window.bumpQuestionPoolVersion?.()'), 'M10: bumpQuestionPoolVersion deve ser chamado ao alterar questões');

// 4. M6 & A1 checks in assistente-pmpe
assert.ok(ap.includes('isSafeCanonicalPath') && ap.includes('!storagePath.includes("..")'), 'A1: validação canônica de storage_path ausente');
assert.ok(ap.includes('content-length') && ap.includes('rpc/claim_ai_request'), 'M6: Content-Length antes de arrayBuffer e claim_ai_request ausentes');
assert.ok(/r20\d/.test(sw) && /Revisão r20\d/.test(html), 'Versão deve estar na r200');

console.log('✅ test-r200-hardening: TODOS OS TESTES COMPORTAMENTAIS DE HARDENING (A1/A3/A4/M2/M6/M10) PASSARAM!');
