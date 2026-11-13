import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../dist/v77-experience.js', import.meta.url), 'utf8');
const start = source.indexOf('  function computeQuestionOptionChoiceStats(item, chosenIndex) {');
const end = source.indexOf('  window.computeQuestionOptionChoiceStats = computeQuestionOptionChoiceStats;', start);
assert(start >= 0 && end > start);
const context = {
  state: {activeCampaignId:'portal-a', optionChoiceTelemetry:{fixture:{0:4,1:3}}},
  questionFingerprint: item => item.id || 'fixture',
  answerOptionText: value => String(value ?? '').normalize('NFC').replace(/\s+/g,' ').trim().replace(/^[A-E]\)\s+/,''),
  answerKeyStatus: item => item.answer_unknown || item.key_source === 'ia_sugerido' ? 'sem_gabarito' : item.annulled ? 'anulada' : 'revisado',
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const stats = (item, choice) => context.computeQuestionOptionChoiceStats(item, choice);
const q = {id:'fixture',statement:'Qual opção corresponde ao resultado?',options:['A) Resposta certa','B) Distrator errado'],correct_index:0};
const plain = value => JSON.parse(JSON.stringify(value));

const legacy = stats(q);
assert.deepEqual(plain(legacy.counts),[0,0], 'Índices antigos não identificam alternativas após embaralhamento');
assert.equal(legacy.totalSamples,0);
assert.equal(legacy.legacySamples,7, 'Histórico legado deve permanecer reconhecido e preservado');
assert.deepEqual(context.state.optionChoiceTelemetry.fixture,{0:4,1:3});

assert.deepEqual(plain(stats(q,1).counts),[0,1]);
const shuffled = {...q,options:['A) Distrator errado','B) Resposta certa'],correct_index:1};
const afterShuffle = stats(shuffled);
assert.deepEqual(plain(afterShuffle.counts),[1,0], 'A escolha acompanha o texto, não a antiga letra B');
assert.equal(afterShuffle.trapIndex,0);
assert.equal(afterShuffle.correctIndex,1);
assert.deepEqual(plain(stats(shuffled,1).counts),[1,1]);
assert.deepEqual(plain(stats(q).counts),[1,1]);

context.state.activeCampaignId='portal-b';
assert.equal(stats(q).totalSamples,0, 'Um portal não recebe estatísticas do outro');
stats(q,0);
context.state.activeCampaignId='portal-a';
assert.equal(stats(q).totalSamples,2);
assert.equal(stats({...q,options:['Resposta certa','Novo distrator']}).totalSamples,0, 'Editar alternativas inicia uma versão compatível nova');

for (const change of [{key_source:'ia_sugerido'},{answer_unknown:true},{annulled:true},{correct_index:null},{correct_index:true},{correct_index:-1},{correct_index:7}]) {
  const before=stats(q).totalSamples;
  stats({...q,...change},0);
  assert.equal(stats(q).totalSamples,before,`Gabarito inválido ou não validado não grava telemetria: ${JSON.stringify(change)}`);
}
stats(q,-1);stats(q,2);stats(q,'0');
assert.equal(stats(q).totalSamples,2);
assert.equal(stats({id:'empty',options:[],correct_index:null}).correctIndex,-1);
assert.deepEqual(plain(stats({id:'empty',options:[],correct_index:null}).counts),[]);
assert.equal(stats({id:'duplicated',options:['Mesmo texto','Mesmo texto'],correct_index:0},0).totalSamples,0, 'Alternativas de conteúdo duplicado não têm identidade inequívoca');
const adversarial={id:'prototype',options:['__proto__','constructor'],correct_index:1};
assert.equal(stats(adversarial,0).totalSamples,1);
assert.equal({}.polluted,undefined);
console.log('OK r174: histórico por conteúdo acompanha embaralhamento, isola portais/versões, preserva legado sem reinterpretá-lo e exclui gabaritos pendentes.');
