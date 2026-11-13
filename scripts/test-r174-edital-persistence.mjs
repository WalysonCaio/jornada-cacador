import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('dist/pdf-text-client.js');
const start = source.indexOf('  async function saveTopicsToCampaignAndSync(');
const end = source.indexOf('  async function recoverPdfViaAssistant(', start);
assert(start >= 0 && end > start);
const functionSource = source.slice(start, end);
const uid = 'owner', document = {id: 'doc', campaign_id: 'db-portal', user_id: uid, document_type: 'edital', title: 'Edital', processing_status: 'pending', metadata: {old: true}};
const topics = [{subject: 'Português', topic: 'Crase'}];
const confirmed = [{id: 'uuid-topic', subject: 'Português', topic: 'Crase', edital_order: 0, subject_order: 0, learning_order: 0, difficulty: 'basic'}];
const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

const savedResponse = (items = confirmed) => response({saved: items.length, topics: items});

function scenario(rpc, backup = response([])) {
  const calls = [], notices = [];
  const campaign = {id: 'portal', dbId: 'db-portal', name: 'Portal', customCampaign: {missions: [{id: 'old', name: 'Mapa anterior'}]}};
  const ctx = {
    window: {_extractedPdfMetaByDocId: new Map(), unpackEditalTopicsList: list => list},
    state: {activeCampaignId: 'portal', campaigns: [campaign], customCampaign: campaign.customCampaign},
    cloudSession: {user: {id: uid}},
    isEditalType: d => ['edital', 'edital_concurso'].includes(d.document_type),
    canonicalSubjectName: value => value,
    sanitizeWatermarkText: value => String(value),
    normalizeSearch: value => String(value).toLowerCase(),
    INCIDENCE_ONLY_LINE_RE: /^(alta|media|baixa)$/i,
    cloudFetch: async (path, options = {}) => {
      calls.push({path, ...options});
      if (path.startsWith('campaign_topics?')) {
        if (backup instanceof Error) throw backup;
        return backup;
      }
      assert.equal(path, 'rpc/replace_campaign_topics_atomic');
      if (rpc instanceof Error) throw rpc;
      return typeof rpc === 'function' ? await rpc(ctx) : rpc;
    },
    toast: text => notices.push(text),
    save: () => { ctx.saves++; },
    saves: 0,
    reconcileMissionProgress: () => {},
    loadCloudDocuments: async () => {},
    pushCloudState: async () => {},
    navigator: {onLine: true},
    render: () => {},
    console,
    activeCampaign: () => campaign,
    compactPagesForInlinePayload: pages => pages,
    extractStructuredEditalTopics: () => ({subjectCount: 1, topics: []}),
    SUPABASE_URL: 'https://example.invalid',
    authHeaders: () => ({}),
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  function parseJsonBlock('), start) + functionSource, ctx);
  vm.runInContext(source.slice(end, source.indexOf('  // Intercepta chamadas fetch', end)), ctx);
  return {ctx, calls, notices, doc: structuredClone(document), run: d => ctx.saveTopicsToCampaignAndSync(d || structuredClone(document), topics, {user: {id: uid}}, 5)};
}

for (const rpc of [response({code: 'PGRST202'}, 404), response({message: 'DB failure'}, 500), new Error('offline'), response([]), savedResponse([{}]), savedResponse(confirmed.concat(confirmed))]) {
  const test = scenario(rpc);
  assert.equal(await test.run(test.doc), false);
  assert.equal(test.ctx.saves, 0, 'erro não pode substituir mapa local');
  assert.equal(test.ctx.state.customCampaign.missions[0].id, 'old');
  assert.equal(test.doc.processing_status, 'pending');
  assert(!test.calls.some(call => call.method === 'DELETE'), 'não deve haver fallback DELETE/POST');
  assert.equal(test.calls.filter(call => call.path.startsWith('rpc/')).length, 1);
}
for (const backup of [response({error: 'database error'}, 500), new Error('offline'), response({invalid: true})]) {
  const test = scenario(savedResponse(), backup);
  assert.equal(await test.run(), false);
  assert.equal(test.calls.length, 1, 'não salva sem conferir mapa anterior');
  assert.equal(test.ctx.saves, 0);
}
const partial = scenario(savedResponse(), response([{subject: 'Português', topic: 'Crase'}, {subject: 'Matemática', topic: 'Frações'}]));
assert.equal(await partial.run(), false);
assert.equal(partial.calls.length, 1, 'resultado com menos disciplinas não substitui mapa maior');

let finishRpc, rpcStarted;
const started = new Promise(resolve => {rpcStarted = resolve;});
const pending = scenario(async () => {rpcStarted(); return await new Promise(resolve => {finishRpc = resolve;});});
const operation = pending.run(pending.doc);
await started;
assert.equal(pending.ctx.saves, 0, 'estado fica intacto enquanto servidor não confirmou');
assert.equal(pending.doc.processing_status, 'pending');
finishRpc(savedResponse());
assert.equal(await operation, true);
assert.equal(pending.ctx.state.customCampaign.missions[0].id, 'edital-uuid-topic');
assert.equal(pending.doc.processing_status, 'ready');
assert.equal(pending.doc.metadata.coverage.needs_review, true, 'extração recuperada exige conferência');
const body = JSON.parse(pending.calls[1].body);
assert.equal(body.p_user_id, uid);
assert.equal(body.p_document_id, 'doc');
assert.equal(body.p_campaign_id, 'db-portal');
assert.equal(body.p_coverage.summary_count, 1);

const switched = scenario(async ctx => {ctx.state.activeCampaignId = 'other'; return savedResponse();});
assert.equal(await switched.run(), true, 'gravação remota concluída permanece válida');
assert.equal(switched.ctx.saves, 0, 'troca de portal não contamina estado atual');
assert.equal(switched.ctx.state.customCampaign.missions[0].id, 'old');
const signedOut = scenario(async ctx => {ctx.cloudSession = null; return savedResponse();});
assert.equal(await signedOut.run(), true);
assert.equal(signedOut.ctx.saves, 0, 'logout durante gravação não importa mapa da conta anterior');
const changedAccount = scenario(async ctx => {ctx.cloudSession = {user: {id: 'other'}}; return savedResponse();});
assert.equal(await changedAccount.run(), true);
assert.equal(changedAccount.ctx.saves, 0, 'troca de conta durante gravação não contamina perfil atual');
const truncated = scenario(savedResponse());
truncated.ctx.window._extractedPdfMetaByDocId.set('doc', {pdfTotalPages: 10, truncatedPages: true});
assert.equal(await truncated.run(), true);
const coverage = JSON.parse(truncated.calls[1].body).p_coverage;
assert.equal(coverage.percent, 50);
assert.equal(coverage.incomplete, true);

// A recuperação não pode salvar como completo o conjunto de apenas um trecho
// quando o segundo falhou, nem esconder JSON recuperado de uma resposta cortada.
const chunkFailure = scenario(savedResponse());
let aiCalls = 0;
chunkFailure.ctx.fetch = async () => ++aiCalls === 1
  ? response({answer: JSON.stringify({topics})}) : response({error: 'AI unavailable'}, 503);
const twoPages = [{page: 1, text: 'A'.repeat(8000)}, {page: 2, text: 'B'.repeat(8000)}];
assert.equal(await chunkFailure.ctx.recoverPdfViaAssistant(chunkFailure.doc, twoPages, {user: {id: uid}}), false);
assert.equal(aiCalls, 2);
assert.equal(chunkFailure.calls.length, 0, 'trecho falho não dispara gravação nem troca mapa');
assert.equal(chunkFailure.ctx.saves, 0);
const partialJson = scenario(savedResponse());
partialJson.ctx.fetch = async () => response({answer: '{"topics":[{"subject":"Português","topic":"Crase"},'});
assert.equal(await partialJson.ctx.recoverPdfViaAssistant(partialJson.doc, [{page: 1, text: 'conteúdo'}], {user: {id: uid}}), true);
assert.equal(JSON.parse(partialJson.calls[1].body).p_coverage.incomplete, true, 'JSON recuperado deve declarar resultado parcial');

for (const path of ['supabase/functions/edital-gemini/index.ts', 'supabase/functions/assistente-pmpe/index.ts']) {
  const code = read(path);
  assert(code.includes('rpc/replace_campaign_topics_atomic'), path);
  assert(code.includes('MAP_STORAGE_MIGRATION_REQUIRED'), 'falta migração deve ser erro explícito');
  assert(!/campaign_topics[^\n]*method:\s*['"]DELETE/.test(code), 'não pode apagar mapa em requisição isolada');
}
const sql = read('supabase/migrations/20261113120000_v107_atomic_edital_topics.sql');
for (const term of ['auth.uid() is distinct from p_user_id', 'pg_advisory_xact_lock', 'campaign_not_owned', 'edital_not_owned', 'on conflict (campaign_id, subject, topic) do update', 'topics_not_confirmed', "processing_status = 'ready'", 'PARTIAL_RESULT']) assert(sql.includes(term), term);
assert(!/do update set[\s\S]*?\b(?:status|mastery|id)\s*=/.test(sql.slice(sql.indexOf('on conflict'), sql.indexOf('get diagnostics'))), 'reanálise preserva progresso e IDs');
console.log('OK r174: edital sem exclusões isoladas; erro/migração ausente/offline preservam mapa; sucesso só após confirmação; troca de portal isolada; cobertura parcial honesta. Contrato SQL inspecionado; integração PostgreSQL é uma verificação separada.');
