import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source = stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/system-diagnostics/index.ts', import.meta.url), 'utf8'));
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json'}});

async function diagnose(overrides = {}, method = 'POST') {
  const calls = [];
  const ctx = {
    URL, Response, Intl, Date, Set, Number, String, Array, JSON,
    Deno: {
      env: {get: name => overrides.missingConfig ? undefined : ({SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'})[name]},
      serve: handler => { ctx.handler = handler; },
    },
    fetch: async (url, options = {}) => {
      calls.push({url, options});
      if (url.endsWith('/auth/v1/user')) {
        if (overrides.authThrows) throw new Error('network');
        return json({id: 'user-a'}, overrides.authStatus ?? 200);
      }
      if (options.method === 'HEAD') {
        if (overrides.countThrows) throw new Error('network');
        const headers = overrides.countHeader === null ? {} : {'content-range': overrides.countHeader ?? '*/0'};
        return new Response(null, {status: overrides.countStatus ?? 200, headers});
      }
      if (url.includes('/my_ai_usage_daily?')) {
        if (overrides.usageThrows) throw new Error('network');
        return json(overrides.usageBody ?? [], overrides.usageStatus ?? 200);
      }
      if (url.endsWith('/storage/v1/bucket/study-documents')) {
        if (overrides.storageThrows) throw new Error('network');
        return json({id: overrides.bucketId ?? 'study-documents'}, overrides.storageStatus ?? 200);
      }
      if (url.endsWith('/rpc/get_user_ai_secret')) return json(null);
      throw new Error(`Unexpected request: ${url}`);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const response = await ctx.handler(new Request('https://example.test/diagnostics', {method, headers: {authorization: 'Bearer test-user'}}));
  return {response, calls, body: method === 'OPTIONS' ? null : await response.json()};
}

const healthy = await diagnose();
assert.equal(healthy.response.status, 200);
assert.equal(healthy.body.ok, true);
assert.equal(healthy.body.database, true);
assert.equal(healthy.body.storage, true);
assert.equal(healthy.body.pending_documents, 0);
assert.equal(healthy.body.rls_verified, false, 'Consultas administrativas não comprovam isolamento RLS.');
assert.equal(healthy.body.storage_check, 'bucket_metadata_only');
assert(healthy.calls.every(({options}) => ['GET', 'HEAD'].includes(options.method ?? 'GET') || options.body === JSON.stringify({p_user_id:'user-a',p_provider:'gemini'})), 'O diagnóstico não deve alterar registros.');
assert(healthy.calls.filter(({options}) => options.method === 'HEAD').every(({url}) => url.includes('user_id=eq.user-a')), 'Contagens precisam respeitar a conta autenticada.');

for (const overrides of [
  {countStatus: 500}, {countThrows: true}, {countHeader: null},
  {countHeader: '*/*'}, {countHeader: '*/NaN'}, {countHeader: '*/9007199254740992'},
  {usageStatus: 403}, {usageThrows: true}, {usageBody: {}},
]) {
  const {body} = await diagnose(overrides);
  assert.equal(body.ok, false, JSON.stringify(overrides));
  assert.equal(body.database, false, JSON.stringify(overrides));
  assert.equal(body.database_status, 'unavailable');
}
for (const overrides of [{storageStatus: 404}, {storageThrows: true}, {bucketId: 'another-bucket'}]) {
  const {body} = await diagnose(overrides);
  assert.equal(body.ok, false);
  assert.equal(body.storage, false);
  assert.equal(body.storage_status, 'unavailable');
  assert.equal(body.database, true, 'Falha de Storage não deve inventar uma falha no banco.');
}
const counted = await diagnose({countHeader: '0-0/7'});
assert.equal(counted.body.pending_documents, 7);
assert.equal(counted.body.database, true);
assert.equal((await diagnose({authThrows: true})).response.status, 503);
assert.equal((await diagnose({authStatus: 503})).response.status, 503);
assert.equal((await diagnose({authStatus: 401})).response.status, 401);
const unconfigured = await diagnose({missingConfig: true});
assert.equal(unconfigured.response.status, 503);
assert.equal(unconfigured.calls.length, 0);
const preflight = await diagnose({}, 'OPTIONS');
assert.equal(preflight.calls.length, 0);
assert.equal((await diagnose({}, 'GET')).response.status, 405);
console.log('OK r174: diagnóstico verifica contagens e bucket, recusa saúde falsa, distingue falhas de rede/autenticação e não presume RLS validada.');

// A interface também deve tratar sentinelas de falha como indisponibilidade.
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const uiSource = html.slice(html.indexOf('async function runSystemDiagnostics()'), html.indexOf('function exportApplicationBackup()'));
async function diagnoseUi(data) {
  const rows = [], root = {}, button = {};
  const ctx = {
    $: selector => selector === '#diagnosticsList' ? root : button,
    localStorage: {getItem: () => null}, KEY: 'fixture',
    navigator: {onLine: true}, state: {_serverRevision: 0, _dirty: false},
    cloudSession: {}, validSession: async () => ({access_token: 'fixture'}),
    SUPABASE_URL: 'https://supabase.test', authHeaders: () => ({}),
    AbortController, setTimeout: () => 1, clearTimeout() {},
    diagnosticRow: (label, ok, detail) => {rows.push({label, ok: !!ok, detail}); return label;},
    fetch: async () => json(data),
  };
  vm.createContext(ctx);
  vm.runInContext(uiSource, ctx);
  await ctx.runSystemDiagnostics();
  assert.equal(button.disabled, false);
  return rows;
}
const rows = await diagnoseUi({...healthy.body, running_focus_sessions: -1, pending_documents: -1, pending_essays: -1, usage_available: false});
for (const label of ['Sessão de foco', 'Fila de PDFs', 'Fila de redações', 'Consumo de IA hoje', 'Sincronização deste aparelho']) {
  assert.equal(rows.find(row => row.label === label)?.ok, false, label);
}
assert(rows.find(row => row.label === 'Banco de dados').detail.includes('RLS requer teste específico'));
assert(!rows.some(row => row.label === 'Supabase e RLS'));
console.log('OK r174: interface não transforma contagem -1, consumo desconhecido ou revisão zero em diagnóstico aprovado.');
