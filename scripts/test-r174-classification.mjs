import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('dist/index.html',root),'utf8');
const source=fs.readFileSync(new URL('dist/v77-experience.js',root),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,`Trecho ausente: ${start}`);return text.slice(a,b)}
const fields={
  '#questionSubject':{value:'Português'},'#questionBoardFilter':{value:'all'},
  '#questionTopic':{value:'all',selectedIndex:-1},'#questionDifficulty':{value:'all'},
  '#questionOrigin':{value:'all'},'#questionBattleMode':{value:'progressive'},
  '#questionHistoryFilter':{value:'all'},'#followEditalOrderToggle':{checked:false}
};
const ctx={window:{},state:{customCampaign:{missions:[]}},q:s=>fields[s],
  ALL_QUESTIONS:[],NATIVE_POLICE_QUESTION_BANK:JSON.parse(fs.readFileSync(new URL('dist/native-question-bank.json',root))),
  ensureNativeQuestionBankLoaded(){},sanitizeAllQuestionsAndErrorsSubjects(){},
  computeQuestionEditalLearningOrder:()=>0,difficultyWeight:()=>0};
vm.createContext(ctx);
vm.runInContext([
  section(html,'function normalizeText(','function missionForQuestion('),
  section(source,'  function questionMatchesBoardFilter(','  function subjectIconForName('),
  section(source,"  function getNativeQuestionsForSubject(",'  function buildSubjectAppropriateDistractors('),
  section(source,'  function strictSubjectMatch(','  function computeQuestionEditalLearningOrder('),
  section(source,'  function answerKeyStatus(','  function classifyQuestion('),
  section(source,'  function classifyQuestion(','  async function completeMissionHonestServer('),
  section(source,'  const _TOPIC_STOP_WORDS=','  function activeCampaignErrors('),
  section(source,'  function filteredQuestionPool(){','  function updateQuestionPool(){'),
  section(html,'function questionPool(){','function stripLeadingOptionPrefix('),
  section(html,'function learningQuestions(','function questionPriority('),
  section(source,'  const FALLBACK_DUEL_QUESTIONS=','  const DUEL_EXAMINER_BOTS='),
  section(source,'  function buildDuelQuestionPack(','  function computeArenaStatsAndRivalries('),
  section(source,'  function findRelatedSummary(','  function buildSpecificErrorDiagnosis('),
  section(source,'  function simuladoCandidatePool(){','  function updateSimuladoAvailability(){'),
  section(source,'  function startQuickSprintBattle(){','  function ensureTopicPanelSearch(){')
].join('\n'),ctx);
ctx.learningCategory=ctx.canonicalSubjectName;
ctx.window.answerKeyStatus=ctx.answerKeyStatus;
ctx.window.questionMatchesBoardFilter=ctx.questionMatchesBoardFilter;

// Missing disciplines and boards must never borrow unrelated questions.
assert.equal(ctx.getNativeQuestionsForSubject('Medicina Legal').length,0);
const math=ctx.getNativeQuestionsForSubject('RLM');
assert(math.length>0);
assert(math.every(q=>ctx.strictSubjectMatch(ctx.resolveStrictQuestionDiscipline(q),'RLM')));
assert.equal(ctx.getNativeQuestionsForSubject('Língua Portuguesa','Banca inexistente').length,0);
assert.equal(ctx.questionMatchesBoardFilter({board:'Instituto AOCP',explanation:'A FGV cobra esse conceito.'},'FGV'),false);
assert.equal(ctx.questionMatchesBoardFilter({board:'Fundação Getulio Vargas'},'FGV'),true);

// The command being tested wins over the subject of the quoted text.
for(const question of [
  {subject:'Língua Portuguesa',statement:'Na frase sobre a Constituição Federal, a conjunção em destaque exprime relação de:',options:['Concessão','Condição']},
  {subject:'Português',statement:"Nas frases I e II, o vocábulo 'se' classifica-se, respectivamente, como:",options:['Pronome e conjunção condicional','Partícula apassivadora']}
]){
  const result=ctx.classifyQuestion(question);
  assert.equal(result.subject,'Língua Portuguesa');assert.equal(result.needs_review,false);
}

const conflict={subject:'Direito Constitucional',topic:'Questão 1',statement:'Calcule a soma das idades de João e Ana.',options:['20','30']};
assert.equal(ctx.classifyQuestion(conflict).subject,'Raciocínio Lógico-Matemático');
assert.equal(ctx.classifyQuestion(conflict).needs_review,true);
assert.equal(ctx.isQuestionDisciplineEligible(conflict,'RLM'),false);
assert.equal(ctx.isQuestionDisciplineEligible(conflict,'all'),false);
// Human taxonomy review is retained even when keywords point to another domain.
conflict.subject='Língua Portuguesa';conflict.subject_source='manual';
assert.equal(ctx.classifyQuestion(conflict).subject,'Língua Portuguesa');
assert.equal(ctx.classifyQuestion(conflict).needs_review,false);
assert.equal(ctx.isQuestionDisciplineEligible({id:'manual-metodo',subject:'Português'},'all'),false);

// Edits with the same length, plus edits to alternatives, invalidate cached inference.
const edited={statement:'Windows',subject:'Conteúdo Geral',options:[]};
assert.equal(ctx.resolveStrictQuestionDiscipline(edited),'Informática');
edited.statement='art 144';
assert.equal(ctx.resolveStrictQuestionDiscipline(edited),'Direito Constitucional');
const editedOptions={statement:'Assinale a alternativa correta.',subject:'Conteúdo Geral',options:['Windows','Linux']};
assert.equal(ctx.resolveStrictQuestionDiscipline(editedOptions),'Informática');
editedOptions.options.splice(0,2,'habeas corpus','mandado de segurança');
assert.equal(ctx.resolveStrictQuestionDiscipline(editedOptions),'Direito Constitucional');

// Subject aliases match; generic subject labels and numeric substrings are not subtopics.
const language={subject:'Língua Portuguesa',subject_source:'manual',topic:'Língua Portuguesa',statement:'Analise a pontuação da frase.',options:['Opção correta','Opção incorreta'],correct_index:0};
assert.equal(ctx.questionMatchesTopicFilter(language,'pontuacao','Português'),true);
assert.equal(ctx.questionMatchesTopicFilter(language,'crase','Português'),false);
const constitutional={subject:'Direito Constitucional',subject_source:'manual',topic:'Art. 144',statement:'Organização da polícia civil.',options:['Opção correta','Opção incorreta']};
assert.equal(ctx.questionMatchesTopicFilter(constitutional,'art 1','Direito Constitucional'),false);
assert.equal(ctx.questionMatchesTopicFilter(constitutional,'nacionalidade','Direito Constitucional'),false);
language.topic='Crase';language.topic_canonical='crase';
assert.equal(ctx.questionMatchesTopicFilter(language,'crase','Português'),true);
language.topic='Pontuação';language.statement='Analise a pontuação.';
assert.equal(ctx.questionMatchesTopicFilter(language,'crase','Português'),false);
assert.equal(ctx.questionMatchesTopicFilter(language,'pontuacao','Português'),true);

// Combined filters exclude conflicts and manuals, and don't refill empty topics.
ctx.ALL_QUESTIONS=[language,{...constitutional,correct_index:0},{...conflict,subject_source:'origem',subject:'Direito Constitucional',correct_index:0},{id:'manual-ciclo',subject:'Português',correct_index:0}];
assert.equal(ctx.filteredQuestionPool().length,1);
fields['#questionTopic'].value='crase';
assert.equal(ctx.filteredQuestionPool().length,0);
assert.equal(ctx.simuladoCandidatePool().length,2);
ctx.missionPool=()=>[{id:'port',subject:'Português'}];
assert.equal(ctx.simuladoCandidatePool().length,1);
fields['#questionTopic'].value='all';fields['#questionSubject'].value='Medicina Legal';
assert.equal(ctx.filteredQuestionPool().length,0);

// The same contract is used in the learning trail, short sprints and duel supplements.
assert.equal(ctx.questionsForMode('trail','Português').length,1);
assert.equal(ctx.questionsForMode('trail','Medicina Legal').length,0);
ctx.window._selectedTrailBoard='Banca inexistente';
assert.equal(ctx.learningQuestions('Português').length,0);
assert.equal(ctx.buildDuelQuestionPack('Medicina Legal','misto',5).length,0);
assert.equal(ctx.buildDuelQuestionPack('Português','misto',5,'Banca inexistente').length,0);
const duel=ctx.buildDuelQuestionPack('Português','misto',5);
assert(duel.length>0);assert(duel.every(q=>ctx.strictSubjectMatch(q.subject,'Português')));
const messages=[];let opened=0;
fields['#questionDialogTitle']={};fields['#questionDialog']={showModal(){opened++}};
ctx.toast=m=>messages.push(m);ctx.openView=()=>{};ctx.showQuestion=()=>{};
ctx.progressiveQuestions=(pool,count)=>pool.slice(0,count);ctx.prepareQuestion=q=>q;
ctx.state.daily='today';ctx.missionPool=()=>[{id:'today',subject:'Português'}];
ctx.startQuickSprintBattle();
assert.equal(opened,1);assert.equal(ctx.activeQuestions.questions.length,1);
ctx.missionPool=()=>[{id:'today',subject:'Medicina Legal'}];ctx.startQuickSprintBattle();
assert.equal(opened,1);assert(messages.at(-1).includes('Medicina Legal'));

// A shared topic name must not link the answer explanation to another subject's theory.
ctx.ALL_SUMMARIES=[{id:'law',title:'Pontuação',category:'Direito Penal'},{id:'manual-ciclo',title:'Pontuação',category:'Manuais do Caçador'},{id:'port',title:'Pontuação',category:'Português'}];
assert.equal(ctx.findRelatedSummary(language).id,'port');
ctx.ALL_SUMMARIES=ctx.ALL_SUMMARIES.slice(0,2);
assert.equal(ctx.findRelatedSummary(language),null);

// Sanitizing imported and campaign-local copies preserves the conflict for later review.
ctx.ALL_QUESTIONS=[{subject:'Direito Constitucional',statement:'Calcule a soma das idades de João e Ana.',topic:'Questão 1',options:['20','30']}];
ctx.state.customQuestionsByCampaign={a:[{...ctx.ALL_QUESTIONS[0]}]};
ctx.dedupeAllQuestionsInMemory=()=>{};
vm.runInContext(section(source,'  function isTopicContaminatedByWrongSubject(','  function strictSubjectMatch('),ctx);
ctx.sanitizeAllQuestionsAndErrorsSubjects(true);ctx.sanitizeAllQuestionsAndErrorsSubjects(true);
for(const q of [ctx.ALL_QUESTIONS[0],ctx.state.customQuestionsByCampaign.a[0]]){
  assert.equal(q.classification_declared_subject,'Direito Constitucional');
  assert.equal(q.classification_needs_review,true);
  assert.equal(ctx.isQuestionDisciplineEligible(q,'RLM'),false);
}

console.log('OK r174: interseção disciplina/banca/assunto, conflitos em revisão, comando gramatical, aliases, manuais excluídos e caches após edição.');
