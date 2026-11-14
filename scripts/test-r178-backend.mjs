// Executa os handlers reais com serviços simulados; nenhuma requisição sai da VM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {validatedSuggestedKeys} from '../supabase/functions/_shared/solved-keys.mjs';
import {normalizeSharedQuestion} from '../supabase/functions/_shared/question-integrity.mjs';
import {validateEssayResult} from '../supabase/functions/_shared/essay-result.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const essayId = '22222222-2222-4222-8222-222222222222';
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type':'application/json'}});
function endpoint(name, fetchImpl) {
  let handler;
  const calls = [];
  const context = {
    Request, Response, Uint8Array, TextEncoder, setTimeout,
    validatedSuggestedKeys, normalizeSharedQuestion, validateEssayResult,
    console: {warn() {}, error() {}},
    Deno: {
      env: {get: key => ({SUPABASE_URL:'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY:'fixture-service', GEMINI_API_KEY:'fixture-gemini'})[key]},
      serve: fn => {handler = fn;},
    },
    fetch: async (url, options = {}) => {
      const call = {url:String(url), method:options.method || 'GET', headers:new Headers(options.headers), body:options.body ? JSON.parse(options.body) : null};
      calls.push(call);
      if (call.url.endsWith('/auth/v1/user')) return json({id:userId});
      if (call.url.endsWith('/rpc/get_user_ai_secret')) return json('');
      if (call.url.endsWith('/rpc/reserve_ai_usage')) return json({allowed:true, event_id:73});
      if (call.url.includes('/ai_usage_events?')) return json({});
      return fetchImpl(call);
    },
  };
  const source = fs.readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(source), context);
  return {
    context, calls,
    async request(body, {method = 'POST', authorization = 'Bearer fixture-user'} = {}) {
      const response = await handler(new Request('https://function.test', {
        method, headers: authorization ? {authorization} : {},
        ...(method === 'POST' ? {body:JSON.stringify(body)} : {}),
      }));
      return {status:response.status, body:await response.json()};
    },
  };
}
const unexpected = call => {throw new Error(`Requisição inesperada: ${call.method} ${call.url}`);};
const baseQuestion = {subject:'Direito Constitucional', topic:'Direitos fundamentais', origin:'oficial', statement:'Qual é a alternativa correta?', options:['Primeira','Segunda','Terceira','Quarta','Quinta'], correct_index:4, explanation:'Fundamento jurídico da resposta.'};

// Índices inválidos nunca viram A; não compactar/truncar alternativas.
for (const raw of [null, undefined, '', ' ', false, true, {}, [], -1, 5, 'abc']) {
  const result = normalizeSharedQuestion({...baseQuestion, correct_index:raw});
  assert.equal(result.correct_index,-1);
  assert.equal(result.answer_unknown,true);
}
for (const options of [['A','','C'],['A','a'],['A'],['A','B','C','D','E','F']]) assert.equal(normalizeSharedQuestion({...baseQuestion, options}),null);
assert.equal(normalizeSharedQuestion(baseQuestion).correct_index,4);
assert.equal(normalizeSharedQuestion({...baseQuestion, options:['Certo','Errado'], correct_index:1}).correct_index,1);
assert.equal(normalizeSharedQuestion({...baseQuestion, answer_unknown:true}).correct_index,-1);
const suggested = normalizeSharedQuestion({...baseQuestion,key_source:'ia_sugerido',answer_key_validation:'pendente',annulled:true});
assert.equal(suggested.key_source,'ia_sugerido');
assert.equal(suggested.answer_key_validation,'pendente');
assert.equal(suggested.annulled,true);
const provenance = normalizeSharedQuestion({...baseQuestion,exam_year:2025,exam_title:'Concurso de teste',source:'Editora informada',key_reference:'Página 12'});
assert.equal(provenance.exam_year,2025);
assert.equal(provenance.exam_title,'Concurso de teste');
assert.equal(provenance.source,'Editora informada');
assert.equal(provenance.key_reference,'Página 12');

// O catálogo respeita a projeção autenticada da biblioteca, sem ler materiais privados via service_role.
const bank = endpoint('assistente-pmpe', call => {
  if (call.url.includes('/shared_question_bank?')) return json([
    {...baseQuestion, fingerprint:'existing'},
    {...baseQuestion, statement:'Questão pendente', correct_index:null},
    {...baseQuestion, statement:'Questão vazia', options:['A','','C']},
  ]);
  if (call.url.endsWith('/rpc/get_community_exam_library')) return json({summaries:[{title:'Constituição', content:{source:'Prova oficial', questions:[
    {...baseQuestion, statement:'Questão da biblioteca', correct_index:3, key_source:'ia_sugerido', answer_key_validation:'pendente'},
  ]}}]});
  return unexpected(call);
});
const catalog = await bank.request({action:'shared_question_bank'});
assert.equal(catalog.status,200);
assert.equal(catalog.body.count,3);
assert.equal(catalog.body.questions.find(q=>q.statement==='Questão pendente').correct_index,-1);
assert.equal(catalog.body.questions.find(q=>q.statement==='Questão da biblioteca').key_source,'ia_sugerido');
assert.equal(catalog.body.questions.find(q=>q.statement==='Questão da biblioteca').source,'Prova oficial');
const communityCall = bank.calls.find(call=>call.url.endsWith('/rpc/get_community_exam_library'));
assert.equal(communityCall.headers.get('authorization'),'Bearer fixture-user');
assert(!bank.calls.some(call=>call.url.includes('/generated_study_content')), 'Não consultar materiais de todas as contas com credencial administrativa');
const unavailableBank = endpoint('assistente-pmpe', () => json({},503));
assert.equal((await unavailableBank.request({action:'shared_question_bank'})).status,503);

// Corpo inválido e falha de autenticação retornam erros recuperáveis do endpoint.
const bodyGuard = endpoint('assistente-pmpe', unexpected);
for (const body of [null, [], 'text', 1]) assert.equal((await bodyGuard.request(body)).status,400);
assert.equal((await bodyGuard.request({}, {authorization:''})).status,401);
assert.equal((await bodyGuard.request({}, {method:'GET'})).status,405);
for (const name of ['assistente-pmpe','redacao-gemini']) {
  const authOutage = endpoint(name, unexpected);
  authOutage.context.fetch = async () => {throw new Error('auth unavailable');};
  assert.equal((await authOutage.request({})).status,503);
}

// A resolução identifica o enunciado e preserva opções: saída ausente/reordenada não ganha gabarito.
async function solve(generated, originals = [baseQuestion]) {
  const api = endpoint('assistente-pmpe', unexpected);
  api.context.askStructuredQuestions = async () => ({questions:generated, provider:'fixture', model:'fixture'});
  const result = await api.request({action:'solve_exam_questions_key',questions:originals});
  return {...result,calls:api.calls};
}
for (const generated of [[],[{...baseQuestion, correct_index:null}],[{...baseQuestion, correct_index:false}],[{...baseQuestion, statement:'Outro enunciado'}],[{...baseQuestion, options:[...baseQuestion.options].reverse()}],[baseQuestion,baseQuestion]]) {
  const refused = await solve(generated);
  assert.equal(refused.status,422);
  assert(!refused.body.solved);
  assert(refused.calls.some(call=>call.body?.error_code==='NO_VALID_SUGGESTED_KEYS'));
}
const solved = await solve([baseQuestion],[{...baseQuestion,index:19}]);
assert.equal(solved.status,200);
assert.equal(solved.body.solved[0].index,19);
assert.equal(solved.body.solved[0].correct_index,4);
assert.equal(solved.body.solved[0].key_source,'ia_sugerido');
assert.match(solved.body.solved[0].explanation,/confira no gabarito oficial/);
const ce = {...baseQuestion,statement:'A afirmação está correta?',options:['Certo','Errado'],correct_index:1};
assert.equal((await solve([ce],[ce])).body.solved[0].correct_index,1);

// Um "Gabarito: B" no texto inteiro não torna toda extração uma questão oficial validada.
const imported = endpoint('assistente-pmpe', call => {
  if (call.url.includes('/shared_question_bank?') && call.method === 'POST') return json({});
  return unexpected(call);
});
imported.context.askStructuredQuestions = async () => ({questions:[baseQuestion],provider:'fixture',model:'fixture'});
const importResult = await imported.request({action:'generate_structured_questions',submode:'parse_raw',raw_text:'Questão de prova. Gabarito: B'});
assert.equal(importResult.status,200);
assert.equal(importResult.body.questions[0].origin,'importada');
assert.equal(importResult.body.questions[0].key_source,'ia_sugerido');
assert.equal(importResult.body.questions[0].answer_key_validation,'pendente');
assert.match(importResult.body.questions[0].explanation,/Gabarito sugerido pela IA/);
const published = imported.calls.find(call=>call.method==='POST' && call.url.includes('/shared_question_bank?')).body[0];
assert.equal(published.origin,'adaptada_do_pdf');
assert.match(published.explanation,/validação humana pendente/);
const blankKey = endpoint('assistente-pmpe', unexpected);
blankKey.context.askStructuredQuestions = async () => ({questions:[{...baseQuestion,correct_index:false}],provider:'fixture',model:'fixture'});
assert.equal((await blankKey.request({action:'generate_structured_questions',submode:'parse_raw',raw_text:'Gabarito: B'})).status,422);

// Exercita também a requisição Gemini real para não esconder um schema limitado a ABCD.
let structuredSchema;
const structured = endpoint('assistente-pmpe', call => {
  if (call.url.includes(':generateContent')) {
    structuredSchema = call.body.generationConfig.responseSchema;
    return json({candidates:[{content:{parts:[{text:JSON.stringify({questions:[baseQuestion]})}]}}]});
  }
  return unexpected(call);
});
structured.context.availableGeminiModels = async () => ['fixture-model'];
await structured.context.askStructuredQuestions('Resolva a questão preservando alternativas.','fixture-gemini');
const properties = structuredSchema.properties.questions.items.properties;
assert.equal(properties.options.minItems,2);
assert.equal(properties.options.maxItems,5);
assert.equal(properties.correct_index.maximum,4);

// Redação: UUID/ownership, falhas de persistência e JSON pedagógico inválido.
const validEssay = {
  readable:true,score:80,criteria:Array.from({length:4},(_,i)=>({name:`Eixo ${i}`,score:20,max_score:25,commentary:'Justificativa'})),
  diagnosis:'Estimativa pedagógica',line_observation:'20 linhas',model_text:'Exemplo didático',strengths:['Clareza'],
  priority_plan:['Revisar coesão'],rewrite_suggestions:['Reescrever a conclusão'],improvements:[],deviations:[],
};
function essayScenario({missing = false, lookupStatus = 200, activeStatus = 200, processingStatus = 200, saveStatus = 200, result = validEssay} = {}) {
  const api = endpoint('redacao-gemini', call => {
    if (call.url.includes('/essay_submissions?')) {
      if (call.method === 'PATCH') return json({},call.body.processing_status === 'ready' ? saveStatus : call.body.processing_status === 'processing' ? processingStatus : 200);
      if (call.url.includes('processing_status=eq.processing')) return json([],activeStatus);
      return json(missing ? [] : [{id:essayId,campaign_id:essayId,storage_path:`${userId}/essay.pdf`,title:'Redação',source_name:'essay.pdf'}],lookupStatus);
    }
    if (call.url.includes('/storage/v1/object/')) return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'application/pdf'}});
    if (call.url.includes(':generateContent')) return json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});
    if (call.method === 'DELETE' && call.url.includes('generativelanguage')) return json({});
    return unexpected(call);
  });
  api.context.uploadFile = async () => ({uri:'fixture://essay',name:'files/fixture',mimeType:'application/pdf'});
  api.context.availableGeminiModels = async () => ['fixture-model'];
  return api;
}
const malformed = essayScenario();
assert.equal((await malformed.request({submission_id:'not-a-uuid'})).status,400);
assert(!malformed.calls.some(call=>call.url.includes('/essay_submissions?')));
const missing = essayScenario({missing:true});
assert.equal((await missing.request({submission_id:essayId})).status,404);
assert(!missing.calls.some(call=>call.method==='PATCH'));
for (const flags of [{lookupStatus:503},{activeStatus:503}]) {
  const unavailable = essayScenario(flags);
  assert.equal((await unavailable.request({submission_id:essayId})).status,503);
  assert(!unavailable.calls.some(call=>call.method==='PATCH'));
}
for (const flags of [{processingStatus:503},{saveStatus:503},{result:{...validEssay,score:70}}]) {
  const failed = essayScenario(flags);
  assert.equal((await failed.request({submission_id:essayId})).status,500);
  for (const call of failed.calls.filter(call=>call.method==='PATCH' && call.url.includes('/essay_submissions?'))) {
    assert(call.url.includes(`id=eq.${essayId}&user_id=eq.${userId}`),'Toda escrita limita redação e proprietário');
  }
  assert(!failed.calls.some(call=>call.url.includes('/ai_usage_events?') && call.body.status==='success'));
}
const reviewed = essayScenario();
const review = await reviewed.request({submission_id:essayId});
assert.equal(review.status,200);
assert.equal(review.body.result.score,80);
assert.match(review.body.result.diagnosis,/não substitui a correção oficial/);
assert(reviewed.calls.some(call=>call.method==='PATCH' && call.body?.processing_status==='ready'));
console.log('OK r178 backend: catálogo com JWT/privacidade, índices e formatos de questão, gabaritos IA verificáveis, auth/JSON inválidos e redação com ownership/persistência/feedback validados.');
