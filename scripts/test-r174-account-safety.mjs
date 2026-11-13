import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source = stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/account-security/index.ts', import.meta.url), 'utf8'));
const userId = '11111111-1111-4111-8111-111111111111';
const documentId = '22222222-2222-4222-8222-222222222222';

async function scenario({action = 'delete_document', rpcStatus = 200, rpcBody = {deleted: true}, authDeleteStatus = 200, storageStatus = 200} = {}) {
  const calls = [];
  let handler, lookupCount = 0;
  const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const context = {
    Response, Request, Set, console: {error() {}},
    Deno: {env: {get: name => name === 'SUPABASE_URL' ? 'https://supabase.test' : 'test-service-key'}, serve: fn => {handler = fn;}},
    fetch: async (url, options = {}) => {
      const method = options.method || 'GET';
      calls.push({url, method});
      if (url.endsWith('/auth/v1/user')) return reply({id: userId, email: 'fixture@example.test'});
      if (url.includes('/auth/v1/token?')) return reply({access_token: 'fixture-token'});
      if (url.includes('/rpc/delete_user_study_document')) return reply(rpcBody, rpcStatus);
      if (url.includes('/study_documents?') && url.includes('select=id,')) {
        lookupCount++;
        return reply([{id: documentId, campaign_id: documentId, document_type: 'edital', storage_path: `${userId}/edital.pdf`}]);
      }
      if (url.includes('/study_documents?') && url.includes('select=id&')) {
        lookupCount++;
        return reply([]);
      }
      if (url.includes('select=storage_path')) return reply([{storage_path: `${userId}/fixture.pdf`}]);
      if (url.includes('/auth/v1/admin/users/')) return reply({}, authDeleteStatus);
      if (url.includes('/storage/v1/object/')) return reply({}, storageStatus);
      throw new Error(`Requisição inesperada: ${method} ${url}`);
    },
  };
  vm.runInNewContext(source, context);
  const response = await handler(new Request('https://function.test', {method: 'POST', headers: {authorization: 'Bearer fixture'}, body: JSON.stringify({action, document_id: documentId, password: 'fixture-password'})}));
  return {status: response.status, body: await response.json(), calls, lookupCount};
}

for (const failure of [{rpcStatus: 404, rpcBody: {}}, {rpcStatus: 400, rpcBody: {code: 'PGRST202'}}]) {
  const result = await scenario(failure);
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'DOCUMENT_DELETE_MIGRATION_REQUIRED');
  assert(!result.calls.some(call => call.method === 'DELETE'), 'Migração ausente não pode apagar tópicos, documento ou Storage');
}
const rejected = await scenario({rpcStatus: 500, rpcBody: {error: 'unavailable'}});
assert.equal(rejected.status, 409);
assert(!rejected.calls.some(call => call.method === 'DELETE'));
const success = await scenario();
assert.equal(success.status, 200);
assert.equal(success.body.deleted, true);
assert.equal(success.lookupCount, 2, 'Exclusão deve ser verificada antes de remover arquivos');

const refusedAccount = await scenario({action: 'delete_account', authDeleteStatus: 503});
assert.equal(refusedAccount.status, 502);
assert.equal(refusedAccount.body.code, 'ACCOUNT_DELETE_INCOMPLETE');
assert.equal(refusedAccount.body.retryable, true);
assert.match(refusedAccount.body.error, /arquivos vinculados foram removidos/);
assert.notEqual(refusedAccount.body.deleted, true, 'Auth recusou: não anuncie conta excluída');
const deletedAccount = await scenario({action: 'delete_account'});
assert.equal(deletedAccount.body.deleted, true);
const authPosition = deletedAccount.calls.findIndex(call => call.url.includes('/auth/v1/admin/users/'));
const storagePosition = deletedAccount.calls.findIndex(call => call.url.includes('/storage/v1/object/'));
assert(storagePosition >= 0 && authPosition > storagePosition, 'Supabase exige remover objetos antes de excluir seu proprietário');
const cleanupFailure = await scenario({action: 'delete_account', storageStatus: 503});
assert.equal(cleanupFailure.body.code, 'ACCOUNT_DELETE_INCOMPLETE');
assert(!cleanupFailure.calls.some(call => call.url.includes('/auth/v1/admin/users/')), 'Não tente excluir proprietário antes de terminar limpeza');
console.log('OK r174: migração ausente preserva documento/tópicos; exclusão de conta respeita dependências e informa limpeza parcial.');
