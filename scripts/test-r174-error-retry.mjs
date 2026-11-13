import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../dist/v77-experience.js', import.meta.url), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, `Trecho ausente: ${start}`);
  return source.slice(a, b);
}
const code = [
  section('  function answerOptionText(', '  function applyReviewedAnswerKey('),
  section('  function answerKeyStatus(', '  function answerKeyDetails('),
  section('  function questionMatchesErrorPool(', '  function isQuestionFavorited('),
  section('  function startErrorReinforcementBattle(){', '  // 2B. Resolução'),
  section('  function launchSingleErrorRetryByKey(', '  window.launchSingleErrorRetryByKey ='),
].join('\n');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const original = {campaignId:'portal-a',subject:'Língua Portuguesa',topic:'Crase',question:'Assinale a alternativa correta sobre o uso da crase.',options:['Opção incorreta.','Opção correta.','Outra opção incorreta.'],correct_index:1,correctAnswer:'Opção correta.',explanation:'Explicação preservada.'};
const bankQuestion = extra => ({subject:original.subject,topic:original.topic,statement:original.question,options:[...original.options],correct_index:1,origin:'oficial',...extra});

function env(errors, bank = [], preparedInvalid = false) {
  const toasts = [], theory = [];
  const ui = {'#questionDialogTitle':{},'#questionDialog':{showModal(){ui.opened++;}},opened:0,shown:0};
  const ctx = {
    window:{openTheoryForSubjectAndTopic:(...args)=>theory.push(args)},
    document:{querySelector:selector=>ui[selector]},
    q:selector=>ui[selector],
    state:{activeCampaignId:'portal-a',errors}, ALL_QUESTIONS:bank, activeQuestions:null,
    toast:text=>toasts.push(text),
    activeCampaignErrors:()=>Object.entries(errors).filter(([,e])=>!e.campaignId||e.campaignId==='portal-a'),
    deduplicateAndSanitizeErrorNotebook(){},
    topicKey:normalize,
    resolveStrictQuestionDiscipline:item=>typeof item==='object'?item.subject:original.subject,
    isQuestionDisciplineEligible:(item, subject='all')=>Boolean(item&&!item.needs_review&&(subject==='all'||normalize(item.subject)===normalize(subject))),
    progressiveQuestions:(items,count)=>items.slice(0,count),
    prepareQuestion:item=>({...item,correct_index:preparedInvalid?null:item.correct_index}),
    prepareQuestionConsistent:item=>({...item,correct_index:preparedInvalid?null:item.correct_index}),
    showQuestion:()=>ui.shown++,
    buildSubjectAppropriateDistractors(){throw new Error('Não deve fabricar alternativas.');},
    startSubjectTargetedFix(){throw new Error('Não deve substituir erro incompleto por treino aleatório.');},
  };
  ctx.window.showQuestion=ctx.showQuestion;
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return {ctx,toasts,theory,ui};
}

// Um gabarito textual solto não permite reconstruir alternativas nem presumir A.
{
  const legacy={...original};delete legacy.options;delete legacy.correct_index;
  const errors={old:legacy}, before=JSON.stringify(errors);
  const {ctx,toasts,theory,ui}=env(errors);
  ctx.startErrorReinforcementBattle();
  assert.equal(ctx.activeQuestions,null);assert.equal(ui.opened,0);
  assert(toasts.some(text=>text.includes('Ler Teoria')));
  ctx.launchSingleErrorRetryByKey('old');
  assert.equal(ctx.activeQuestions,null);assert.equal(ui.opened,0);
  assert.equal(theory[0][0],original.subject);assert.equal(theory[0][1],original.topic);
  assert.equal(JSON.stringify(errors),before,'Revisão teórica preserva o registro e não concede acertos.');
}

// Restaura somente alternativas e índice realmente preservados, sem exigir correctAnswer textual.
{
  const stored={...original,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Conferência própria'};
  delete stored.correctAnswer;
  const {ctx,ui}=env({ok:stored});
  ctx.startErrorReinforcementBattle();
  assert.equal(ui.opened,1);
  let restored=ctx.activeQuestions.questions[0];
  assert.deepEqual([...restored.options],original.options);assert.equal(restored.correct_index,1);
  assert.equal(restored.key_source,'manual_revisado');assert.equal(restored._errorNotebookKey,'ok');
  ctx.launchSingleErrorRetryByKey('ok');
  restored=ctx.activeQuestions.questions[0];
  assert.equal(restored.origin,'autoral','Histórico sem origem não deve virar questão oficial ou adaptada do PDF.');
  assert.equal(restored.key_reference,'Conferência própria');assert.equal(restored.correct_index,1);
}

for (const change of [
  ...[null,undefined,'',true,false,-1,3,'abc',{}].map(correct_index=>({correct_index})),
  {options:['','Opção correta.']},{options:['Única alternativa.']},
  {answer_unknown:true},{annulled:true},{anulada:true},{needs_review:true},
  {key_source:'ia_sugerido',answer_key_validation:'pendente'},
]) {
  const {ctx,ui}=env({bad:{...original,...change}});
  ctx.startErrorReinforcementBattle();ctx.launchSingleErrorRetryByKey('bad');
  assert.equal(ctx.activeQuestions,null,JSON.stringify(change));
  assert.equal(ui.opened,0);
}

// Questão original encontrada no banco pode recuperar um registro legado incompleto.
{
  const legacy={...original};delete legacy.options;delete legacy.correct_index;
  const q=bankQuestion({key_source:'oficial_definitivo'});
  const {ctx}=env({old:legacy},[q]);
  ctx.launchSingleErrorRetryByKey('old');
  assert.equal(ctx.activeQuestions.questions[0].origin,'oficial');
  assert.equal(ctx.activeQuestions.questions[0].key_source,'oficial_definitivo');
  assert.equal(ctx.activeQuestions.questions[0]._errorNotebookKey,'old');
}

// Questões extras exigem mesma disciplina, alternativas completas e gabarito utilizável.
{
  const bank=[
    bankQuestion({statement:'Questão de reforço da mesma disciplina.'}),
    bankQuestion({statement:'Questão de outra disciplina.',subject:'Direito Penal'}),
    bankQuestion({statement:'Questão sem gabarito.',correct_index:null}),
    bankQuestion({statement:'Questão com sugestão da IA.',key_source:'ia_sugerido'}),
    bankQuestion({statement:'Questão anulada.',annulled:true}),
    bankQuestion({statement:'Questão de outro conteúdo.',topic:'Análise sintática'}),
  ];
  const {ctx}=env({ok:{...original}},bank);
  ctx.launchSingleErrorRetryByKey('ok');
  assert.equal(ctx.activeQuestions.questions.length,2);
  assert(ctx.activeQuestions.questions.every(item=>item.subject===original.subject));
  const aggregate=env({ok:{...original}},bank);aggregate.ctx.startErrorReinforcementBattle();
  assert.equal(aggregate.ctx.activeQuestions.questions.length,1);
}
{
  const {ctx,ui}=env({other:{...original,campaignId:'portal-b'}});
  ctx.launchSingleErrorRetryByKey('other');assert.equal(ui.opened,0);
}
{
  const {ctx,ui}=env({ok:{...original}},[],true);
  ctx.startErrorReinforcementBattle();ctx.launchSingleErrorRetryByKey('ok');
  assert.equal(ui.opened,0,'Preparação inválida também deve impedir o treino.');
}
console.log('OK r174: Caderno de Erros não fabrica alternativas/gabaritos, preserva revisão teórica e só treina questões completas na disciplina e portal corretos.');

// O diagnóstico por disciplina também recebia erros legados e fabricava opções.
for (const complete of [false, true]) {
  const stored = {...original};
  if (!complete) {delete stored.options; delete stored.correct_index;}
  const {ctx, ui, theory} = env({targeted: stored});
  ctx.canonicalSubjectName = value => value;
  ctx.sanitizeAllQuestionsAndErrorsSubjects = () => {};
  ctx.questionFingerprint = item => JSON.stringify([item.subject, item.topic, item.statement]);
  vm.runInContext(section('  function startSubjectTargetedFix(', '  window.startSubjectTargetedFix='), ctx);
  ctx.startSubjectTargetedFix(original.subject, true);
  if (complete) {
    assert.equal(ui.opened, 1);
    assert.deepEqual([...ctx.activeQuestions.questions[0].options], original.options);
    assert.equal(ctx.activeQuestions.questions[0].correct_index, 1);
  } else {
    assert.equal(ui.opened, 0);
    assert.equal(ctx.activeQuestions, null);
    assert.equal(theory[0][0], original.subject);
  }
}
console.log('OK r174: diagnóstico por disciplina também usa somente alternativas originais e direciona registro incompleto à teoria.');
