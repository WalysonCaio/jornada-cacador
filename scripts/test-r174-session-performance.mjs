import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
const storeContext = { window: {} };
vm.createContext(storeContext);
vm.runInContext(fs.readFileSync(new URL('../dist/question-session-store.js', import.meta.url), 'utf8'), storeContext);
const { createStore, scopeKey } = storeContext.window.JornadaQuestionSessions;
const storage = memoryStorage(), firstTab = memoryStorage();
let now = 1800000000000;
const scope = { userId: 'user-a', campaignId: 'portal-a', resetEpoch: 0 };
const question = { statement: 'Qual o resultado de 2 + 2?', subject: 'Matemática', options: ['3', '4'], correct_index: 1, _userAnswered: true, _userChosenIndex: 1 };
const snapshot = { title: 'Treino de Matemática', battle: { questions: [question, { ...question, _userAnswered: false }], current: 1, correct: 1, answered: false } };
const first = createStore({ storage, fallbackStorage: firstTab, now: () => now });
assert.equal(first.save(scope, snapshot), 'local');
// Closing the first tab loses its sessionStorage. The local snapshot still resumes unchanged.
const reopened = createStore({ storage, fallbackStorage: memoryStorage(), now: () => now });
assert.equal(reopened.read(scope).battle.current, 1);
assert.deepEqual(JSON.parse(JSON.stringify(reopened.read(scope).battle.questions[0])), question);
assert.equal(reopened.read({ ...scope, userId: 'user-b' }), null);
assert.equal(reopened.read({ ...scope, campaignId: 'portal-b' }), null);
assert.equal(reopened.read({ ...scope, resetEpoch: 1 }), null, 'perfil redefinido não pode retomar treino antigo');
first.save(scope, snapshot);
now += 7 * 86400000 + 1;
assert.equal(reopened.read(scope), null, 'treino expirado deve desaparecer');
storage.setItem(scopeKey(scope), '{invalid-json');
assert.equal(reopened.read(scope), null);
assert.equal(storage.getItem(scopeKey(scope)), null);
const blocked = { ...memoryStorage(), setItem() { throw new Error('QuotaExceededError'); } };
const tab = memoryStorage();
const fallback = createStore({ storage: blocked, fallbackStorage: tab, now: () => now });
assert.equal(fallback.save(scope, snapshot), 'session');
assert.equal(fallback.read(scope).battle.correct, 1);
assert.equal(createStore({ storage: blocked, fallbackStorage: blocked, now: () => now }).save(scope, snapshot), null);
assert.equal(first.save(scope, { ...snapshot, battle: { ...snapshot.battle, current: 9 } }), null);
assert.equal(first.save(scope, { ...snapshot, battle: { ...snapshot.battle, questions: [{ statement: 'Inválida', options: [] }] } }), null);
first.save(scope, snapshot);
first.save({ ...scope, campaignId: 'portal-b' }, snapshot);
first.clear(scope);
assert.equal(first.read(scope), null);
assert(first.read({ ...scope, campaignId: 'portal-b' }));
storage.setItem('other-app-data', 'preserve');
first.clearAll();
assert.equal(first.read({ ...scope, campaignId: 'portal-b' }), null);
assert.equal(storage.getItem('other-app-data'), 'preserve');

const source = fs.readFileSync(new URL('../dist/v77-experience.js', import.meta.url), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, `bloco ausente: ${start}`);
  return source.slice(a, b);
}
// Rendering the filters performs one pass and never builds the catalogue or charts.
const calls = [];
const filters = {
  renderQuestionFilters: () => calls.push('filters'),
  populateTopicFilter: () => calls.push('topics'),
  updateQuestionPool: () => calls.push('pool'),
  renderExamBankHub: () => calls.push('catalogue'),
  renderPerformanceChart: () => calls.push('charts')
};
vm.createContext(filters);
vm.runInContext(section('  const baseRenderQuestionFilters=', '  // 11. Painel TAF'), filters);
filters.renderQuestionFilters();
assert.deepEqual(calls, ['filters', 'topics', 'pool']);

// Secondary work starts after paint, splits charts/catalogue, and cancels stale portal/view jobs.
let active = true;
const frames = [], tasks = [], renders = [];
const deferred = {
  window: { requestAnimationFrame: fn => frames.push(fn) },
  setTimeout: fn => tasks.push(fn),
  state: { activeCampaignId: 'portal-a' },
  q: () => ({ classList: { contains: () => active } }),
  renderPerformanceChart: () => renders.push('charts'),
  renderExamBankHub: () => renders.push('catalogue')
};
vm.createContext(deferred);
vm.runInContext(section('  let questionReportExtrasGeneration=', '  const baseRenderReport='), deferred);
function runFrame() { frames.splice(0).forEach(fn => fn()); tasks.splice(0).forEach(fn => fn()); }
deferred.scheduleQuestionReportExtras();
assert.deepEqual(renders, []);
runFrame(); assert.deepEqual(renders, ['charts']);
runFrame(); assert.deepEqual(renders, ['charts', 'catalogue']);
renders.length = 0;
deferred.scheduleQuestionReportExtras(); deferred.scheduleQuestionReportExtras();
runFrame(); runFrame();
assert.deepEqual(renders, ['charts', 'catalogue'], 'renderizações repetidas devem cancelar o trabalho anterior');
renders.length = 0;
deferred.scheduleQuestionReportExtras(); deferred.state.activeCampaignId = 'portal-b';
runFrame(); runFrame(); assert.deepEqual(renders, []);
deferred.scheduleQuestionReportExtras(); active = false;
runFrame(); runFrame(); assert.deepEqual(renders, []);

// Reviewing an already answered item cannot score again or replace the original choice.
let scored = 0, saved = 0;
const answeredItem = { statement: 'Questão', options: ['A', 'B'] };
const hooks = {
  activeQuestions: { answered: false, correct: 0, current: 0 },
  window: {}, document: { querySelector: () => null },
  saveActiveQuestionSession: () => saved++
};
hooks.window.answerQuestion = () => { scored++; hooks.activeQuestions.answered = true; hooks.activeQuestions.correct++; };
hooks.window.skipQuestionBlank = () => { hooks.activeQuestions.answered = true; };
vm.createContext(hooks);
vm.runInContext(section('  const origAnswerQ = window.answerQuestion;', '  const origNextQ = window.nextQuestion;'), hooks);
hooks.window.answerQuestion({ dataset: { questionIndex: '1' } }, answeredItem);
hooks.window.answerQuestion({ dataset: { questionIndex: '0' } }, answeredItem);
assert.equal(scored, 1); assert.equal(saved, 1);
assert.equal(answeredItem._userChosenIndex, 1);
hooks.activeQuestions.answered = false;
hooks.window.answerQuestion({ dataset: { questionIndex: '0' } }, answeredItem);
assert.equal(scored, 1);

// Existing missions cannot turn a new/unprocessed edital into a completed analysis.
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const documents = [
  { id: 'pending', document_type: 'edital', processing_status: 'pending', user_id: 'user-a', title: 'Novo edital' },
  { id: 'processing', document_type: 'edital', processing_status: 'processing', user_id: 'user-a', title: 'Em análise', metadata: { analysis_progress: { updated_at: new Date().toISOString() } } },
  { id: 'ready', document_type: 'edital', processing_status: 'ready', user_id: 'user-a', title: 'Concluído' }
];
const updates = [];
const docContext = {
  cloudSession: { user: { id: 'user-a' } },
  validSession: async () => ({ user: { id: 'user-a' } }),
  activeCampaign: () => ({ dbId: 'portal-a' }),
  cloudFetch: async (path, options = {}) => {
    if (options.method === 'PATCH') { updates.push(JSON.parse(options.body)); return { ok: true }; }
    return { ok: true, json: async () => documents.map(doc => ({ ...doc })) };
  },
  cloudDocuments: [], state: { customCampaign: { missions: [{ id: 'old-topic' }] } },
  window: { _activeProcessingDocs: new Set() },
  standardizeDocumentTitle: value => value, normalizeText: value => value.toLowerCase(),
  isEditalDocumentOrTitle: value => value.document_type === 'edital',
  renderUserDocuments() {}, console,
  $: () => ({ textContent: '' }), databaseSetupMessage: error => error.message
};
vm.createContext(docContext);
const docStart = html.indexOf('async function loadCloudDocuments()');
vm.runInContext(html.slice(docStart, html.indexOf('async function loadEssays()', docStart)), docContext);
await docContext.loadCloudDocuments();
assert.deepEqual(Array.from(docContext.cloudDocuments, doc => doc.processing_status), ['pending', 'processing', 'ready']);
assert.deepEqual(updates, [], 'tópicos antigos não comprovam conclusão do processamento atual');
console.log('OK r174: retomada após fechar aba, isolamento usuário/portal/reset, expiração, quota, descarte e respostas sem pontuação duplicada.');
console.log('OK r174: filtros sem catálogo duplicado; gráficos e catálogo após paint; jobs antigos e abas inativas cancelados.');
console.log('OK r174: edital pendente/processando mantém o status real mesmo quando o portal já possui missões antigas.');

// Cronometrado: relógio de parede, namespace próprio e formato completo para retomar.
const { timedRemainingSeconds } = storeContext.window.JornadaQuestionSessions;
const timedScope = {...scope, kind: 'timed'};
const timedBattle = {
  sessionId: 'timed-session-1', questions: [{...question}, {...question}],
  current: 1, answers: [1, null], eliminated: [[0], []],
  totalSeconds: 1200, startedAt: now - 45000, remainingSeconds: 1200,
  scoringMode: 'standard', finished: false,
};
assert.equal(timedRemainingSeconds(timedBattle, now), 1155);
assert.equal(timedRemainingSeconds(timedBattle, now + 1200000), 0);
assert.equal(timedRemainingSeconds({...timedBattle, startedAt: undefined}, now), 0);
assert.equal(first.save(timedScope, {battle: timedBattle}), 'local');
assert.equal(first.read(scope), null, 'simulado e treino usam chaves distintas');
const afterClose = createStore({storage, fallbackStorage: memoryStorage(), now: () => now + 30000});
const resumed = afterClose.read(timedScope);
assert.equal(resumed.battle.current, 1);
assert.equal(JSON.stringify(resumed.battle.answers), '[1,null]');
assert.equal(JSON.stringify(resumed.battle.eliminated), '[[0],[]]');
assert.equal(timedRemainingSeconds(resumed.battle, now + 30000), 1125, 'retomar não reinicia relógio');
assert.equal(first.save(timedScope, {battle: {...timedBattle, answers: [9, null]}}), null);
assert.equal(first.save(timedScope, {battle: {...timedBattle, eliminated: [[3], []]}}), null);
assert.equal(first.save(timedScope, {battle: {...timedBattle, finished: true}}), null);
assert.equal(afterClose.read({...timedScope, userId: 'another'}), null);
assert.equal(afterClose.read({...timedScope, campaignId: 'another'}), null);

// Executa a finalização real: mesma sessão não pode gerar placar em duplicidade.
let attempts = 0, savedResults = 0, removedSnapshots = 0;
const timedElements = new Map();
const element = selector => {
  if (!timedElements.has(selector)) timedElements.set(selector, {hidden: false, innerHTML: '', querySelectorAll: () => [], close() {}});
  return timedElements.get(selector);
};
const timedContext = {
  activeSimulado: JSON.parse(JSON.stringify({...timedBattle, _sessionScope: timedScope})),
  simuladoTimer: 1,
  currentTimedSimuladoScope: () => timedScope,
  clearSavedTimedSimulado: () => removedSnapshots++,
  clearInterval() {},
  state: {activeCampaignId: scope.campaignId, scores: []},
  window: {JornadaQuestionSessions: {timedRemainingSeconds: battle => timedRemainingSeconds(battle, now)}},
  q: element,
  toast() {},
  learningCategory: value => value,
  canonicalSubjectName: value => value,
  subjectKey: value => value.toLowerCase(),
  questionFingerprint: value => value.statement,
  recordQuestionResult: () => attempts++,
  missionPool: () => [{id: 'wrong-subject-mission', subject: 'Outra disciplina'}],
  save: () => savedResults++, render() {},
  escText: value => String(value || ''),
  formatStepByStepResolution: () => 'Explicação',
  Date,
};
vm.createContext(timedContext);
vm.runInContext(section('  function finishTimedSimulado(){', '  // 5. Simulador de Aprovação'), timedContext);
timedContext.finishTimedSimulado();
assert.equal(attempts, 1);
assert.equal(savedResults, 1);
assert.equal(removedSnapshots, 1);
assert.equal(timedContext.state.scores.length, 1);
assert.equal(timedContext.state.scores[0].id, null, 'não associar placar a missão de outra disciplina');
assert(timedContext.state.completedTimedSimuladoIds.includes(timedBattle.sessionId));
timedContext.activeSimulado = JSON.parse(JSON.stringify({...timedBattle, _sessionScope: timedScope}));
timedContext.finishTimedSimulado();
assert.equal(attempts, 1);
assert.equal(savedResults, 1);
assert.equal(timedContext.state.scores.length, 1, 'snapshot antigo não registra o mesmo resultado duas vezes');
timedContext.activeSimulado = JSON.parse(JSON.stringify({...timedBattle, sessionId: 'other-session', _sessionScope: {...timedScope, campaignId: 'old-portal'}}));
timedContext.finishTimedSimulado();
assert.equal(timedContext.activeSimulado, null);
assert.equal(attempts, 1, 'simulado do portal antigo não pontua no portal novo');
console.log('OK r174: simulado cronometrado preserva respostas/tesoura, relógio contínuo, namespace e finalização idempotente por sessão.');
