import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const v59=readFileSync(new URL('../dist/v59-enhancements.js',import.meta.url),'utf8');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const versions=[['inline',section(html,'async function loadGeneratedContent(){','function renderSummaries(')],['v59',section(v59,'  loadGeneratedContent=async function(){','  window.setSummaryApproval=')]];
const question=(statement,extras={})=>({subject:'Português',topic:'Crase',statement,options:['Primeira','Segunda'],correct_index:0,...extras});
const row=questions=>({id:'row',title:'Questões de crase',content_type:'question_pack',source_document_id:'document',content:{subject:'Português',questions}});
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function fixture(code){
 const noop=()=>{},rendered=[],fields=new Map();
 const ctx={
  window:{},state:{_ownerUserId:'a',_resetEpoch:1,activeCampaignId:'portal-a',customCampaign:{missions:[]},customQuestionsByCampaign:{'portal-a':[]}},
  cloudSession:{user:{id:'a'},access_token:'token-a'},activeCampaign:()=>({dbId:'db-a'}),loadGeneratedContent:null,
  ALL_QUESTIONS:[],ALL_SUMMARIES:[],ALL_FLASHCARDS:[],LEARNING_SUBJECTS:[],cloudDocuments:[],selectedLearningSubject:'Português',
  validSession:async()=>ctx.cloudSession,cloudFetch:async()=>({ok:true,json:async()=>[]}),
  extractFlashcardsFromUserNotes:()=>[],migrateLearningSubjectKeys:noop,normalizeLegalTitle:value=>String(value||''),
  findSourceDocumentForContent:()=>({document_type:'prova'}),resolveDocumentDiscipline:(_doc,subject)=>subject||'Português',
  canonicalSubjectName:subject=>subject,standardizeDocumentTitle:value=>value,subjectKey:value=>String(value||'').toLowerCase(),
  inferStrictQuestionSubject:(_statement,_topic,subject)=>subject,isInvalidTrailSubject:()=>false,
  isAllowedFlashcardRow:()=>false,isValidFlashcardItem:()=>true,isValidPedagogicalSummary:()=>false,
  isValidPedagogicalQuestion:value=>!!value?.statement,sanitizeSummaryObject:value=>value,cleanPedagogicalMnemonic:value=>value,
  questionFingerprint:value=>value.statement,computeValidLearningSubjects:()=>['Português'],
  libraryUI:{trailSubject:{},summaryFilter:{},cardFilter:{}},saveLibraryUI:noop,
  renderStudy:noop,renderLearning:noop,renderQuestionFilters:noop,renderViewById:id=>rendered.push(id),
  $:selector=>{if(!fields.has(selector))fields.set(selector,{innerHTML:'',value:''});return fields.get(selector)},esc:String,shortOptionLabel:value=>value,
  document:{querySelector:()=>null},console:{warn:noop},toast:message=>rendered.push(message),
 };
 ctx.window.isValidPedagogicalQuestion=ctx.isValidPedagogicalQuestion;
 ctx.window.isHunterManualArtifact=item=>item?.id==='manual-ciclo';
 vm.createContext(ctx);vm.runInContext(code,ctx);return ctx;
}
for(const [name,code]of versions){
 const ctx=fixture(code);
 const current=question('Questão com revisão pessoal',{correct_index:1,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Referência conferida'});
 ctx.state.customQuestionsByCampaign['portal-a']=[current,question('Questão local nova')];
 ctx.ALL_QUESTIONS=[question('Compartilhada',{from_community:true}),question('Privada antiga excluída',{origin:'oficial'}),question('Guia antigo',{id:'manual-ciclo',from_community:true})];
 ctx.cloudFetch=async()=>({ok:true,json:async()=>[row([question('Questão com revisão pessoal'),question('Sem gabarito',{correct_index:null,key_source:'ia_sugerido',answer_key_validation:'pendente'})])]});
 await ctx.loadGeneratedContent();
 assert.deepEqual(Array.from(ctx.ALL_QUESTIONS,q=>q.statement).sort(),['Compartilhada','Questão com revisão pessoal','Questão local nova','Sem gabarito'].sort(),name);
 assert.equal(ctx.ALL_QUESTIONS.find(q=>q.statement==='Questão com revisão pessoal').correct_index,1,name+': revisão pessoal não volta à chave antiga');
 const pending=ctx.ALL_QUESTIONS.find(q=>q.statement==='Sem gabarito');
 assert.equal(pending.correct_index,null);assert.equal(pending.key_source,'ia_sugerido');assert.equal(pending.answer_key_validation,'pendente');
 // A new account must not expose the previous owner's local custom questions even without a database portal.
 ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.activeCampaign=()=>null;
 const before=ctx.ALL_QUESTIONS;assert.equal(await ctx.loadGeneratedContent(),false);assert.equal(ctx.ALL_QUESTIONS,before,name+': old local state is not rendered for a new account');
 // Repeated loads for the same account and portal discard the older response.
 const parallel=fixture(code),pendingReads=[];
 parallel.cloudFetch=()=>new Promise(resolve=>pendingReads.push(resolve));
 const first=parallel.loadGeneratedContent();await tick();const second=parallel.loadGeneratedContent();await tick();
 pendingReads[1]({ok:true,json:async()=>[row([question('Resposta mais recente')])]});await second;
 const latest=parallel.ALL_QUESTIONS;
 pendingReads[0]({ok:true,json:async()=>[row([question('Resposta antiga')])]});
 assert.equal(await first,false);assert.equal(parallel.ALL_QUESTIONS,latest,name+': late same-scope response replaced new content');
 assert.equal(parallel.ALL_QUESTIONS[0].statement,'Resposta mais recente');
}
console.log('OK r182: carregadores mantêm compartilhadas explícitas, perguntas locais e revisão pessoal; não ressuscitam privadas excluídas, preservam chaves pendentes e descartam respostas antigas do mesmo escopo.');
