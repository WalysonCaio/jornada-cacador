import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('async function persistToLocalDatabase('), html.indexOf('window.persistToLocalDatabase='));
const native = {subject: 'Português', topic: 'Crase', statement: 'Questão nativa de crase', options: ['a', 'b'], correct_index: 1};
const imported = {...native, statement: 'Questão importada de regência', topic: 'Regência', key_source: 'ia_sugerido', answer_key_validation: 'pendente'};
function setup({readDelayed = false, openDelayed = false, failWrite = false, cacheUser = 'user-a', cacheCampaign = 'portal-a'} = {}) {
  let releaseRead, releaseOpen, request, written = null, badges = 0, renders = 0;
  const cache = {userId: cacheUser, campaignId: cacheCampaign, resetEpoch: 0,
    questions: [{...native, explanation: 'cache antigo'}, imported, {...imported}, {...native, id:'manual-01-ciclo-estudos', statement:'Guia antigo da plataforma'}],
    summaries: [{id: 'custom-summary', title: 'Material importado', category: 'Português'}, {id:'manual-01-ciclo-estudos',title:'Guia antigo',category:'Português'}],
    flashcards: [['Português', 'Pergunta longa o suficiente', 'Resposta longa o suficiente'], ['Manuais do Caçador', 'Pergunta do guia', 'Resposta do guia']]};
  const db = {transaction: (_table, mode) => {
    const tx = {objectStore: () => ({
      get: () => {
        request = {};
        releaseRead = () => {request.result = cache; request.onsuccess();};
        if (!readDelayed) queueMicrotask(releaseRead);
        return request;
      },
      put: (value, key) => {
        written = {value, key};
        queueMicrotask(() => failWrite ? tx.onabort() : tx.oncomplete());
      },
    })};
    return tx;
  }};
  const context = {
    state: {activeCampaignId: 'portal-a', customCampaign: {missions: []}}, cloudSession: {user: {id: 'user-a'}},
    ALL_QUESTIONS: [{...native, explanation: 'versão atual'}],
    ALL_SUMMARIES: [{id: 'local-theory', title: 'Resumo local de teoria'}], ALL_FLASHCARDS: [], LEARNING_SUBJECTS: [],
    cloudDocuments: [], cloudEssays: [],
    localCachePortalKey: id => 'user-a:' + id,
    openLocalStudyCacheDB: () => openDelayed ? new Promise(resolve => {releaseOpen = () => resolve(db);}) : Promise.resolve(db),
    localStorage: {setItem() {}},
    questionFingerprint: item => JSON.stringify([item.subject, item.topic, item.statement]),
    isValidPedagogicalQuestion: item => !!item?.statement,
    isValidFlashcardItem: (question, answer) => !!question && !!answer,
    sanitizeSummaryObject: item => item,
    isEditalDocumentOrTitle: () => false, isContaminatedNonEditalMission: () => false,
    normalizeAndOrderEditalMissions: items => items,
    activeCampaign: () => ({name: 'Portal A'}),
    computeValidLearningSubjects: () => ['Português'],
    $: () => null, document: {querySelector: () => null},
    renderViewById: () => {renders++;},
    window: {markViewsDirty() {}, updateLocalDbBadgeUI: () => {badges++;}},
  };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function isHunterManualArtifact('),html.indexOf('function isInvalidTrailSubject(')),context);
  vm.runInContext(source, context);
  return {context, read: () => releaseRead(), open: () => releaseOpen(), cache,
    get written() {return written;}, get badges() {return badges;}, get renders() {return renders;}};
}

const merged = setup();
assert.equal(await merged.context.hydrateFromLocalDatabase(), true);
assert.equal(merged.context.ALL_QUESTIONS.length, 2, 'Banco nativo inicializado não pode ocultar questões do cache');
assert.equal(merged.context.ALL_QUESTIONS[0].explanation, 'versão atual', 'Cache não substitui correção mais recente em memória');
assert.equal(merged.context.ALL_QUESTIONS[1].key_source, 'ia_sugerido', 'Preserve a origem de confiança do gabarito');
assert.equal(merged.context.ALL_SUMMARIES.length, 2, 'Resumo local e material importado devem coexistir');
assert.equal(merged.context.ALL_FLASHCARDS.length, 1);
assert(!merged.context.ALL_SUMMARIES.some(item=>item.id?.startsWith('manual-')), 'Cache antigo não pode recolocar guias em Resumos');
await merged.context.hydrateFromLocalDatabase();
assert.equal(merged.context.ALL_QUESTIONS.length, 2, 'Reidratar novamente não duplica o banco');

for (const change of [ctx => {ctx.state.activeCampaignId = 'portal-b';}, ctx => {ctx.cloudSession.user.id = 'user-b';}, ctx => {ctx.state._resetEpoch = 1;}]) {
  const delayed = setup({readDelayed: true});
  const result = delayed.context.hydrateFromLocalDatabase();
  await new Promise(resolve => setImmediate(resolve));
  change(delayed.context);
  delayed.read();
  assert.equal(await result, false, 'Troca de usuário/portal/reset durante leitura cancela aplicação do cache');
  assert.equal(delayed.context.ALL_QUESTIONS.length, 1);
  assert.equal(delayed.renders, 0);
}
assert.equal(await setup({cacheUser: 'another-user'}).context.hydrateFromLocalDatabase(), false);
assert.equal(await setup({cacheCampaign: 'another-portal'}).context.hydrateFromLocalDatabase(), false);

const saved = setup();
assert.equal(await saved.context.persistToLocalDatabase(), true);
assert.equal(saved.written.key, 'user-a:portal-a');
assert.equal(saved.badges, 1);
const failed = setup({failWrite: true});
assert.equal(await failed.context.persistToLocalDatabase(), false);
assert.equal(failed.badges, 0, 'Transação abortada não anuncia banco salvo');
const switching = setup({openDelayed: true});
const save = switching.context.persistToLocalDatabase();
switching.context.state.activeCampaignId = 'portal-b';
switching.context.ALL_QUESTIONS = [{...imported, statement: 'Conteúdo exclusivo do portal B'}];
switching.open();
assert.equal(await save, false);
assert.equal(switching.written, null, 'Não grave conteúdo do novo portal na chave do portal antigo');
console.log('OK r174: banco nativo e cache importado coexistem; reidratação sem duplicatas; usuário/portal/reset e transação abortada isolados.');
