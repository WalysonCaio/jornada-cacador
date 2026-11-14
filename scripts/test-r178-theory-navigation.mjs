import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../dist/v77-experience.js', import.meta.url), 'utf8');
const start = source.indexOf('  function ensureTopicSummaryExistsForStudy(');
const end = source.indexOf('  window.openTheoryForSubjectAndTopic =', start);
assert(start >= 0 && end > start);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const portuguese = { id: 'port', category: 'Português', title: 'Concordância nominal e verbal', explanation: 'As palavras concordam em gênero, número e pessoa.' };
const otherSubject = { id: 'penal', category: 'Direito Penal', title: 'Concordância verbal', explanation: 'Não pode ser selecionado para Português.' };
const incidental = { id: 'unrelated', category: 'Português', title: 'Pontuação', explanation: 'Este texto menciona crase incidentalmente.' };
const legacySynthetic = { id: 'dynamic-theory-port-crase', category: 'Português', title: 'Crase', source: 'Caderno Teórico Cirúrgico · Português', example: 'Alternativa correta: A' };

function environment({ withCard = true, summaries = [otherSubject, portuguese, incidental, legacySynthetic] } = {}) {
  const timers = [], messages = [], tracker = {}, opened = [], button = {}, wikiBox = {};
  let saved = 0, helped = 0, rendered = 0;
  const body = {
    isConnected: true,
    insertAdjacentHTML() {},
    querySelector(selector) {
      if (selector === '[data-fetch-live-wiki-topic]') return button;
      if (selector === '.liveWikiExtractBox') return wikiBox;
      return null;
    }
  };
  const card = { classList: { add(value) { opened.push(value); } }, style: {}, querySelector: () => body, scrollIntoView() {} };
  const target = { dataset: { summary: 'port' }, lastElementChild: {}, closest: () => card };
  const ctx = {
    window: { BASIC_SUMMARIES: [], openHunterManuals() { helped++; } },
    ALL_SUMMARIES: summaries.map(item => ({ ...item })), ALL_QUESTIONS: [{ subject: 'Português', topic: 'Crase', options: ['ERRADA', 'OUTRA'], correct_index: null }],
    state: { activeCampaignId: 'portal-a', _ownerUserId: 'user-a' }, libraryUI: {},
    subjectKey: normalize, topicKey: normalize, canonicalSubjectName: value => value,
    isPlatformManualStudyArtifact: value => /manuais do ca[cç]ador/i.test(String(value?.category || value)),
    CSS: { escape: value => value }, URL, setTimeout(fn) { timers.push(fn); },
    document: {
      querySelector(selector) { return withCard && selector === '#summaryList [data-summary="port"]' ? target : null; },
      querySelectorAll(selector) { return withCard && selector === '#summaryList [data-summary]' ? [target] : []; }
    },
    openView: view => opened.push(view), renderSummaries() { rendered++; }, saveLibraryUI() {},
    toast: message => messages.push(message), ensureDailyTracker: () => tracker,
    save() { saved++; }, evaluateAndAutoCheckDailySteps: step => opened.push(step),
    escText: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    shortLabel: (value, max) => String(value).slice(0, max)
  };
  vm.createContext(ctx); vm.runInContext(source.slice(start, end), ctx);
  return { ctx, timers, messages, tracker, opened, button, wikiBox, body, saved: () => saved, helped: () => helped, rendered: () => rendered };
}

const matching = environment();
assert.equal(matching.ctx.ensureTopicSummaryExistsForStudy('Português', 'Concordância verbal').bestCard.id, 'port');
assert.equal(matching.ctx.ensureTopicSummaryExistsForStudy('Medicina Legal', 'Concordância verbal').bestCard, null);
assert.equal(matching.ctx.ensureTopicSummaryExistsForStudy('Português', 'Crase').bestCard, null, 'Texto incidental e síntese antiga sem fonte não viram teoria de crase');
const original = JSON.stringify(matching.ctx.ALL_SUMMARIES);
assert.equal(matching.ctx.openTheoryForSubjectAndTopic('Português', 'Crase'), false);
assert.equal(JSON.stringify(matching.ctx.ALL_SUMMARIES), original, 'Não se inventa uma aula a partir de um gabarito ausente');
assert.equal(matching.tracker.theoryRead, undefined);
assert.equal(matching.saved(), 0);
assert(matching.messages.at(-1).includes('Nenhum resumo'));
assert.equal(matching.timers.length, 0);

const help = environment();
assert.equal(help.ctx.openTheoryForSubjectAndTopic('Manuais do Caçador'), false);
assert.equal(help.helped(), 1); assert.equal(help.rendered(), 0); assert.equal(help.saved(), 0);
assert.equal(help.ctx.ensureTopicSummaryExistsForStudy('Português', 'Manuais do Caçador').bestCard, null);

const missingCard = environment({ withCard: false });
assert.equal(missingCard.ctx.openTheoryForSubjectAndTopic('Português', 'Concordância verbal'), true);
missingCard.timers.forEach(fn => fn());
assert.equal(missingCard.tracker.theoryRead, undefined, 'Um resumo não renderizado não concede progresso');
assert.equal(missingCard.saved(), 0);

const realCard = environment();
realCard.ctx.window.JC_MODULES = { smartLibrary: { async fetchLiveWikipediaTopicExtract() { return { title: '<img onerror=bad()>', extract: '<script>bad()</script>', pageUrl: 'javascript:bad()' }; } } };
assert.equal(realCard.ctx.openTheoryForSubjectAndTopic('Português', 'Concordância verbal'), true);
assert.equal(realCard.tracker.theoryRead, undefined, 'A navegação precisa abrir o resumo antes de registrar progresso');
realCard.timers.forEach(fn => fn());
assert.equal(realCard.tracker.theoryRead, true); assert.equal(realCard.saved(), 1);
assert.equal(realCard.ctx.libraryUI.summaryFilter['portal-a'], 'Português');
assert.equal(realCard.ctx.libraryUI.openSummaries['portal-a:port'], true);
assert(realCard.opened.includes('theory_opened'));
await realCard.button.onclick();
assert.equal(realCard.button.disabled, false);
assert(realCard.wikiBox.innerHTML.includes('Resumo externo — confira a fonte'));
assert(!realCard.wikiBox.innerHTML.includes('<script>'));
assert(!realCard.wikiBox.innerHTML.includes('javascript:'));
assert(!realCard.wikiBox.innerHTML.includes('Síntese Verificada'));

realCard.ctx.window.JC_MODULES.smartLibrary.fetchLiveWikipediaTopicExtract = async () => { throw new Error('offline'); };
await realCard.button.onclick();
assert.equal(realCard.button.disabled, false);
assert(realCard.wikiBox.textContent.includes('Falha'));

for (const change of [ctx => { ctx.state.activeCampaignId = 'portal-b'; }, ctx => { ctx.state._ownerUserId = 'user-b'; }, ctx => { ctx.state._resetEpoch = 1; }]) {
  const late = environment();
  late.ctx.openTheoryForSubjectAndTopic('Português', 'Concordância verbal');
  change(late.ctx); late.timers.forEach(fn => fn());
  assert.equal(late.tracker.theoryRead, undefined, 'Navegação tardia não altera o progresso de outra conta, portal ou reinicialização');
  assert.equal(late.saved(), 0);
}
console.log('OK r178: teoria real da disciplina/tópico, ausência explícita, manuais separados, progresso após renderização e Wikipedia externa sem falsa validação.');
