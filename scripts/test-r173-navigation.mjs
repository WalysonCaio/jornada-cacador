import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b)}
// Real guide data survives the theory replacement, including a second initialization.
const manuals={window:{}};vm.createContext(manuals);
vm.runInContext(fs.readFileSync(new URL('../dist/content-summaries.js',import.meta.url),'utf8'),manuals);
assert(manuals.window.EXTRA_FLASHCARDS.every(Array.isArray),'flashcards não podem conter objetos de resumo');
manuals.NATIVE_CORE_THEORY_SUMMARIES=[{id:'theory',category:'Português'}];
const merge=section('  window.BASIC_SUMMARIES = [','  try {\n    if (typeof ensureNativePedagogicalCouplingLoaded');
vm.runInContext(merge,manuals);vm.runInContext(merge,manuals);
assert.equal(manuals.window.BASIC_SUMMARIES.filter(s=>/^manual-/.test(s.id)).length,4);
assert.equal(manuals.window.BASIC_SUMMARIES.length,5);
// Inject the real guides again after cloud content replaces the local list.
Object.assign(manuals,{ALL_SUMMARIES:[],ALL_FLASHCARDS:[],getActiveEditalSubjectsList:()=>['Português'],subjectKey:s=>s.toLowerCase(),canonicalSubjectName:s=>s,activeCampaign:()=>({name:'PMPE'})});
vm.runInContext(section('  function ensureNativePedagogicalCouplingLoaded(){','  const ESTUDEI_CYCLE_BLOCKS='),manuals);
manuals.ensureNativePedagogicalCouplingLoaded();
assert.equal(manuals.ALL_SUMMARIES.filter(s=>/^manual-/.test(s.id)).length,4);
manuals.ALL_SUMMARIES=[];manuals.ensureNativePedagogicalCouplingLoaded();
assert.equal(manuals.ALL_SUMMARIES.filter(s=>/^manual-/.test(s.id)).length,4);
// Repeated reads do no fingerprint work; replacements and appended sources load correctly.
let fingerprints=0;
const bank=Array.from({length:1000},(_,i)=>({statement:`Pergunta ${i}`,subject:'Português'}));
const context={window:{},ALL_QUESTIONS:[],NATIVE_POLICE_QUESTION_BANK:bank,canonicalSubjectName:s=>s,questionFingerprint:q=>{fingerprints++;return q.statement}};
vm.createContext(context);
vm.runInContext(section('  const nativeBankLoadedSources =','  // ── r145:'),context);
context.ensureNativeQuestionBankLoaded();assert.equal(context.ALL_QUESTIONS.length,1000);
const first=fingerprints;for(let i=0;i<100;i++)context.ensureNativeQuestionBankLoaded();
assert.equal(fingerprints,first,'navegação não deve recalcular fingerprints');
context.NATIVE_POLICE_QUESTION_BANK.push({statement:'Nova',subject:'Português'});
context.ensureNativeQuestionBankLoaded();assert.equal(context.ALL_QUESTIONS.length,1001);
context.ALL_QUESTIONS=[];context.ensureNativeQuestionBankLoaded();assert.equal(context.ALL_QUESTIONS.length,1001);
context.ALL_QUESTIONS.splice(0,1);context.ensureNativeQuestionBankLoaded();assert.equal(context.ALL_QUESTIONS.length,1000,'não reinserir item removido na sanitização');
// Topic UI: zero matches stays zero; cache invalidates on edits and portal/board changes.
let renders=0,html='';const select={value:'all',set innerHTML(v){renders++;html=v},get innerHTML(){return html}};
const fields={'#questionTopic':select,'#questionSubject':{value:'all'},'#questionBoardFilter':{value:'all'}};
const missions=[{id:'m1',subject:'Português',name:'Crase'}];
const ctx={q:s=>fields[s],state:{activeCampaignId:'a'},ALL_QUESTIONS:[{statement:'Texto',subject:'Português',topic:'Verbos',board:'A'}],ensureTopicFilterSelect(){},sanitizeAllQuestionsAndErrorsSubjects(){},canonicalSubjectName:s=>s,topicKey:s=>s.toLowerCase(),resolveStrictQuestionDiscipline:q=>q.subject,orderedMissions:()=>missions,questionMatchesBoardFilter:(q,b)=>b==='all'||b===q.board,questionMatchesTopicFilter:(q,t)=>q.topic.toLowerCase()===t,isTopicContaminatedByWrongSubject:()=>false,shortLabel:s=>s,escText:s=>s,populateExamHubSelects(){}};
vm.createContext(ctx);vm.runInContext(section('  function populateTopicFilter(){','  function filteredQuestionPool(){'),ctx);
ctx.populateTopicFilter();assert(html.includes('Crase (0q)'));
select.value='verbos';ctx.populateTopicFilter();assert.equal(renders,1);assert.equal(select.value,'verbos');
ctx.ALL_QUESTIONS[0].topic='Crase';ctx.populateTopicFilter();assert.equal(renders,2);assert(html.includes('Crase (1q)'));assert.equal(select.value,'all');
ctx.state.activeCampaignId='b';ctx.populateTopicFilter();assert.equal(renders,3);
fields['#questionBoardFilter'].value='B';ctx.populateTopicFilter();assert.equal(renders,4);assert(html.includes('Crase (0q)'));
console.log('OK r173: 4 manuais preservados, banco incremental, troca de dados/portal, cache de tópicos e contagem zero honesta.');
console.log('100 leituras repetidas de 1.000 questões: zero fingerprints adicionais.');
