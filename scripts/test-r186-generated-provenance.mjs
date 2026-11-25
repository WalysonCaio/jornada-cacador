import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('dist/index.html'),v59=read('dist/v59-enhancements.js'),v77=read('dist/v77-experience.js');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const loaders=[['inline',section(html,'async function loadGeneratedContent(){','function renderSummaries(')],['effective-v59',section(v59,'  loadGeneratedContent=async function(){','  window.setSummaryApproval=')]];
const base={subject:'Língua Portuguesa',topic:'Concordância verbal',statement:'Assinale a frase que apresenta concordância verbal correta.',options:['Os alunos estudam.','Os alunos estuda.'],correct_index:0,origin:'oficial'};
const questions=[
 {...base,id:'alias-q',sourceDocumentId:'doc-q'},
 {...base,id:'ref-q',statement:base.statement+' Leia as opções.',documentId:'doc-refs',source_refs:[{document_id:'doc-refs',page:2}]},
 {...base,id:'orphan-q',sourceDocumentId:'doc-orphan',statement:'Segundo o texto, assinale quais itens estão corretos.',topic:'Funções da Linguagem',options:['Apenas III.','Apenas II e IV.'],correct_index:1},
 {...base,id:'manual-q',sourceDocumentId:'doc-manual',subject:'Direito Constitucional',subject_source:'heuristica',classification_source:'manual_revisado',topic:'Funções da Linguagem',statement:'Identifique a função da linguagem presente na frase “Eu sinto imensa saudade da minha terra”.',options:['Referencial.','Emotiva.'],correct_index:1,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'PDF original conferido'},
 {...base,id:'conflict-q',sourceDocumentId:'doc-other',statement:base.statement+' Confira a concordância verbal.'},
];
const rows=questions.map((question,index)=>({id:'row-'+index,title:'Prova original '+index,content_type:'question_pack',source_document_id:index===4?'doc-primary':null,source_refs:index===1?[{document_id:'doc-refs',page:1}]:[],content:{is_question_pack:true,subject:question.subject,questions:[question]}}));
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(loader){
 const noop=()=>{},fields=new Map(),messages=[],seenClassification=[];
 const ctx={window:{},state:{_ownerUserId:'a',_resetEpoch:1,activeCampaignId:'portal-a',customCampaign:{missions:[]},customQuestionsByCampaign:{}},cloudSession:{user:{id:'a'},access_token:'token-a'},
  activeCampaign:()=>({id:'portal-a',dbId:'db-a'}),loadGeneratedContent:null,ALL_QUESTIONS:[],ALL_SUMMARIES:[],ALL_FLASHCARDS:[],LEARNING_SUBJECTS:[],cloudDocuments:[{id:'doc-primary'},{id:'doc-other'}],selectedLearningSubject:'Língua Portuguesa',
  validSession:async()=>ctx.cloudSession,cloudFetch:async()=>({ok:true,json:async()=>copy(rows)}),
  extractFlashcardsFromUserNotes:()=>[],migrateLearningSubjectKeys:noop,normalizeLegalTitle:value=>String(value||''),
  findSourceDocumentForContent:()=>({document_type:'prova'}),resolveDocumentDiscipline:(_doc,subject)=>subject||'Língua Portuguesa',standardizeDocumentTitle:String,
  isAllowedFlashcardRow:()=>false,isValidFlashcardItem:()=>true,isValidPedagogicalSummary:()=>false,sanitizeSummaryObject:value=>value,cleanPedagogicalMnemonic:String,
  questionFingerprint:value=>value.id||value.statement,computeValidLearningSubjects:()=>[...new Set(ctx.ALL_QUESTIONS.map(q=>q.subject))],
  libraryUI:{trailSubject:{},summaryFilter:{},cardFilter:{}},saveLibraryUI:noop,
  renderStudy:noop,renderLearning:noop,renderQuestionFilters:noop,renderViewById:noop,
  $:selector=>{if(!fields.has(selector))fields.set(selector,{innerHTML:'',value:''});return fields.get(selector)},esc:String,shortOptionLabel:String,
  isMetaDocumentNoiseText:()=>false,document:{querySelector:()=>null},console:{warn:error=>messages.push(String(error))},toast:message=>messages.push(message),
 };
 vm.createContext(ctx);
 vm.runInContext(section(html,'function normalizeText(','function missionForQuestion(')+section(v77,'  function questionMatchesBoardFilter(','  function subjectIconForName(')+section(v77,'  function getNativeQuestionsForSubject(','  function buildSubjectAppropriateDistractors(')+section(v77,'  function strictSubjectMatch(','  function computeQuestionEditalLearningOrder(')+section(html,'function isValidPedagogicalQuestion(','window.isValidPedagogicalQuestion=')+loader,ctx);
 ctx.window.isValidPedagogicalQuestion=ctx.isValidPedagogicalQuestion;
 ctx.window.classifyQuestion=q=>{seenClassification.push(copy(q));return ctx.questionDisciplineDecision(q)};
 return{ctx,messages,seenClassification};
}
for(const [name,loader] of loaders){
 const {ctx,messages,seenClassification}=fixture(loader);await ctx.loadGeneratedContent();
 assert.deepEqual(messages,[],name+' loads without swallowed errors');
 assert.equal(ctx.ALL_QUESTIONS.length,5,name+' keeps incomplete questions for source review');
 const byId=new Map(ctx.ALL_QUESTIONS.map(q=>[q.id,q]));
 assert.equal(byId.get('alias-q').sourceDocumentId,'doc-q',name+' NULL row source cannot erase a question alias');
 assert.equal(byId.get('ref-q').documentId,'doc-refs');
 assert.deepEqual(copy(byId.get('ref-q').source_refs),[{document_id:'doc-refs',page:1},{document_id:'doc-refs',page:2}],name+' exact row and question references survive');
 assert.equal(byId.get('alias-q').source_refs.length,0,'The loader never invents reference IDs from a title or row ID');
 for(const question of ctx.ALL_QUESTIONS){assert.equal(question.user_id,'a');assert.equal(question.campaign_id,'db-a');assert.match(question.sourceContentId,/^row-/);assert.equal(question.generatedContentId,question.sourceContentId);}
 const orphan=byId.get('orphan-q');assert(orphan.needs_source);assert(orphan.structure_needs_review);assert.equal(orphan.correct_index,1);assert.equal(orphan.origin,'oficial');assert.equal(ctx.isQuestionDisciplineEligible(orphan,'all'),false);
 const manual=byId.get('manual-q');assert.equal(manual.subject,'Direito Constitucional');assert.equal(manual.classification_source,'manual_revisado');assert.equal(manual.correct_index,1);assert.equal(manual.key_source,'manual_revisado');assert.equal(manual.key_reference,'PDF original conferido');assert.equal(manual.classification_needs_review,true);assert.equal(ctx.isQuestionDisciplineEligible(manual,'all'),false);
 const conflict=byId.get('conflict-q');assert.equal(conflict.sourceDocumentId,'doc-primary','The explicit source column remains authoritative');assert(conflict.source_provenance_needs_review);assert.equal(conflict.review_status,'source_not_matched');assert.equal(ctx.isQuestionDisciplineEligible(conflict,'all'),false,'A known contradictory alias cannot silently become eligible');
 assert.equal(seenClassification.length,5,'Both real loaders call the same classifier for every source question');
 assert.equal(seenClassification.find(q=>q.id==='manual-q').classification_source,'manual_revisado');
}
console.log('OK r186: ambos carregadores reais preservam aliases/source_refs, proprietário/portal/row, revisão humana e questões órfãs para revisão sem liberar treino.');
