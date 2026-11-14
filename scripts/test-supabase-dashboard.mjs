// Confere o artefato que será colado no painel, sem dependências injetadas ou rede.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildFunction, names} from './build-supabase-dashboard.mjs';

const expected = ['account-security', 'assistente-pmpe', 'edital-gemini', 'material-gemini', 'redacao-gemini', 'system-diagnostics'];
assert.deepEqual([...names].sort(), expected);
for (const name of names) {
  const file = new URL(`../supabase/dashboard/${name}/index.ts`, import.meta.url);
  const source = readFileSync(file, 'utf8');
  assert.equal(source, buildFunction(name), `${name}: arquivo do painel está desatualizado em relação às fontes`);
  assert(!/^\s*import\s/m.test(source), `${name}: import estático impede cópia independente no painel`);
  assert(!/\bimport\s*\(/.test(source), `${name}: import dinâmico não pode depender de outro arquivo`);
  assert(!/\bfrom\s*['"]\.{1,2}\//.test(source), `${name}: referência local restante`);

  let handler, registrations = 0, networkCalls = 0;
  const context = {
    Request, Response, Headers, Uint8Array, TextEncoder, TextDecoder,
    URL, AbortController, setTimeout, clearTimeout,
    console: {log() {}, warn() {}, error() {}},
    Deno: {
      env: {get: key => ({SUPABASE_URL:'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY:'fixture-service', GEMINI_API_KEY:'fixture-gemini'})[key]},
      serve: value => { registrations++; handler = value; },
    },
    fetch: () => { networkCalls++; throw new Error(`${name}: teste do painel não permite acesso à rede`); },
  };
  const script = new vm.Script(stripTypeScriptTypes(source.replace(/^export /gm, '')), {filename:fileURLToPath(file)});
  script.runInNewContext(context);
  assert.equal(registrations, 1, `${name}: registra exatamente um handler`);
  assert.equal(typeof handler, 'function');
  const preflight = await handler(new Request('https://function.test', {method:'OPTIONS', headers:{origin:'https://jornada.wcaio.workers.dev'}}));
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://jornada.wcaio.workers.dev');
  const get = await handler(new Request('https://function.test', {method:'GET'}));
  assert.equal(get.status, 405);
  assert.equal(networkCalls, 0, `${name}: inicialização, preflight e método inválido não acessam serviços`);
}

// Reexecuta a regressão dos handlers usando somente o conteúdo dos arquivos do painel.
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./test-r178-backend.mjs', import.meta.url))], {
  env:{...process.env, JC_TEST_DASHBOARD_BUNDLES:'1'}, stdio:'inherit',
});
if (result.error) throw result.error;
assert.equal(result.status, 0, 'Handlers do painel precisam passar na mesma regressão do backend canônico');
console.log(`OK: ${names.length} funções do painel reproduzíveis, sem imports externos, inicialização independente e regressões dos handlers aprovadas.`);
