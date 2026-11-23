import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const doc={id:'doc-a',documentDbId:'legacy-db-a',title:'SIMULADO SOLDADO PMPE',document_type:'simulado',user_id:'user-a',campaign_id:'portal-db',processing_status:'ready',created_at:'2026-11-23',metadata:{coverage:{summary_count:57}}};
const docs=[doc,{...doc,id:'doc-b',documentDbId:undefined},{...doc,id:'foreign-doc',documentDbId:undefined,user_id:'user-b'},
 {...doc,id:'other-portal',documentDbId:undefined,campaign_id:'another-db'},
 {...doc,id:'shared-doc',documentDbId:undefined,user_id:'user-b',campaign_id:'another-db',is_community:true}];
const base={statement:'Assinale a alternativa correta.',subject:'Língua Portuguesa',options:['Primeira','Segunda'],correct_index:1,origin:'oficial'};
const questions=[
 {...base,id:'direct',sourceDocumentId:'doc-a'},
 {...base,id:'snake',source_document_id:'doc-a'},
 {...base,id:'db-alias',documentDbId:'legacy-db-a'},
 {...base,id:'source-ref',source_refs:[{document_id:'doc-a'}]},
 {...base,id:'typed-ref',source_refs:[{type:'document',id:'doc-a'}]},
 {...base,id:'row-ref',rowrefs:[{source_document_id:'doc-a'}]},
 {...base,id:'no-title-repair',board:doc.title,source_refs:[{title:doc.title}]},
 {...base,id:'conflicting',sourceDocumentId:'doc-a',documentId:'doc-b'},
 {...base,id:'foreign-account',documentId:'doc-a',user_id:'user-b'},
 {...base,id:'foreign-portal',documentId:'doc-a',campaign_id:'another-db'},
 {...base,id:'foreign-doc',documentId:'foreign-doc'},
 {...base,id:'other-portal',documentId:'other-portal'},
 {...base,id:'shared',documentId:'shared-doc',user_id:'user-b',campaign_id:'another-db',is_community:true},
 {...base,id:'private-not-shared',documentId:'shared-doc',user_id:'user-b',campaign_id:'another-db'},
 {...base,id:'quality-review',documentId:'doc-a',needs_review:true},
 {...base,id:'key-pending',documentId:'doc-a',correct_index:-1}
];
const context={window:{},state:{_ownerUserId:'user-a',activeCampaignId:'portal-a',_resetEpoch:0},cloudSession:{user:{id:'user-a'}},
 activeCampaign:()=>({id:'portal-a',dbId:'portal-db'}),cloudDocuments:docs,ALL_QUESTIONS:questions,
 isQuestionDisciplineEligible:item=>!item.needs_review,answerKeyStatus:item=>item.correct_index<0?'sem_gabarito':'oficial',escText:value=>String(value),toast:()=>{}};
vm.createContext(context);
vm.runInContext(section('  function examDocumentScopeAllows(', '  function renderExamBankHub(){'),context);
assert.deepEqual(Array.from(context.examDocumentQuestionPool(doc),item=>item.id),['direct','snake','db-alias','source-ref','typed-ref','row-ref','quality-review','key-pending']);
assert.equal(context.examDocumentQuestionPool(docs[1]).length,0,'Matching titles cannot attach questions to a different PDF.');
assert.equal(context.examDocumentQuestionPool(docs[2]).length,0,'Foreign private PDFs are excluded.');
assert.equal(context.examDocumentQuestionPool(docs[3]).length,0,'Private PDFs from another portal are excluded.');
assert.deepEqual(Array.from(context.examDocumentQuestionPool(docs[4]),item=>item.id),['shared'],'Explicitly shared library content remains available.');
assert.equal(context.examDocumentQuestionPool(null).length,0);
const collision={...doc,id:'collision',documentDbId:'legacy-db-a'};
const ambiguous=context.buildExamDocumentQuestionIndex([...docs,collision],questions);
assert(!ambiguous.get('doc-a').some(item=>item.id==='db-alias'),'Ambiguous aliases cannot silently repair a link.');

const meta={catBadge:'SIMULADO',subject:'Língua Portuguesa'};
const linked=context.examDocumentQuestionPool(doc);
let html=context.renderSingleExamDocCardHtml(doc,linked,meta);
assert(html.includes('6 disponíveis · 8 vinculadas · 57 indexadas no processamento'));
assert(html.includes('data-exam-doc-simulado="doc-a"'));
html=context.renderSingleExamDocCardHtml(doc,[],meta);
assert(html.includes('0 disponíveis · 0 vinculadas · 57 indexadas no processamento · vínculo pendente'));
assert(!html.includes('data-exam-doc-simulado='),'A metadata count cannot enable an empty exam.');
assert(html.includes('data-exam-doc-review="doc-a"'));
assert(html.includes('Verificar vínculo'));
html=context.renderSingleExamDocCardHtml(doc,linked.filter(item=>item.needs_review||item.correct_index<0),meta);
assert(!html.includes('data-exam-doc-simulado='),'Questions awaiting structure/key review cannot enable scoring.');
assert(html.includes('Por que não está liberada?'));
html=context.renderSingleExamDocCardHtml(docs[4],[],meta);
assert(html.includes('Importar PDF para revisar'),'A shared PDF is preserved; the owner review RPC is not offered for another user.');
const oldScope=context.examDocumentScopeKey();
context.state.activeCampaignId='portal-b';context.activeCampaign=()=>({id:'portal-b',dbId:'another-db'});
assert.notEqual(oldScope,context.examDocumentScopeKey());
assert.equal(context.examDocumentQuestionPool(doc).length,0,'Changing portal invalidates private links.');
context.cloudSession.user.id='user-b';
assert.equal(context.examDocumentScopeAllows({...doc,user_id:'user-b',campaign_id:'another-db'}),false,'A half-finished account transition cannot reveal the previous local data.');

// Exercise the actual card handlers, including a scope change while old DOM remains.
let hubScope=oldScope,started=0,shown=0;
context.state.activeCampaignId='portal-a';context.activeCampaign=()=>({id:'portal-a',dbId:'portal-db'});context.cloudSession.user.id='user-a';
const battleBtn={dataset:{examDocBattle:'doc-a'}},simuladoBtn={dataset:{examDocSimulado:'doc-a'}};
const fields={'#questionDialogTitle':{},'#questionDialog':{showModal(){shown++;}}};
Object.assign(context,{hubScope,currentExamDoc:id=>hubScope===context.examDocumentScopeKey()?docs.find(item=>item.id===id):null,
 qa:selector=>selector==='[data-exam-doc-battle]'?[battleBtn]:selector==='[data-exam-doc-simulado]'?[simuladoBtn]:[],
 q:selector=>fields[selector],activeQuestions:null,progressiveQuestions:(pool,count)=>pool.slice(0,count),prepareQuestion:item=>item,
 showQuestion(){},startTimedSimulado(pool){started++;assert.equal(pool.length,6);}});
vm.runInContext(section("    qa('[data-exam-doc-battle]')",'  async function syncSharedQuestionBank(){').replace(/\n  }\n\s*$/,''),context);
simuladoBtn.onclick();assert.equal(started,1);
battleBtn.onclick();assert.equal(shown,1);assert.equal(context.activeQuestions.questions.length,6);
context.state._resetEpoch++;
simuladoBtn.onclick();assert.equal(started,1,'Stale buttons do not start an exam after account/portal/reset scope changes.');

// Modal selection and confirmation use a distinct visible action; A/B taps alone never grade.
const makeButton=index=>({dataset:{questionIndex:String(index)},disabled:false,hidden:false,attrs:{},classList:{toggle(){},add(){},remove(){}},
 setAttribute(key,value){this.attrs[key]=value},querySelector:()=>null,insertAdjacentHTML(){}});
const optionButtons=[makeButton(0),makeButton(1)],confirmButton={disabled:true,hidden:false},selectionStatus={},skipButton={};
const modalFields={'#confirmQuestionAnswerBtn':confirmButton,'#questionSelectionStatus':selectionStatus,'#skipQuestionBlankBtn':skipButton,
 '#questionFeedback':{},'#nextQuestion':{scrollIntoView(){}}};
const item={...base};const battle={questions:[item],current:0,answered:false,correct:0,streak:0};
let confirmations=0,results=0,xp=0;
const modal={window:{getQuestionQualityDecision:q=>q.needs_source?{needs_source:true,needs_review:true,reason:'Itens I e II ausentes.'}:{needs_source:false,needs_review:false}},
 q:selector=>modalFields[selector]||null,qa:()=>optionButtons,activeQuestions:battle,state:{_ownerUserId:'user-a',activeCampaignId:'portal-a'},cloudSession:{user:{id:'user-a'}},activeCampaign:()=>({dbId:'portal-db'}),createProgressEventId:()=> 'session-1',escText:value=>String(value),
 toast(){},questionFingerprint:()=> 'question',recordQuestionResult(){results++;},applyXpLocal(amount){xp+=amount},
 recordQuestionAttemptServer:async()=>({}),computeQuestionOptionChoiceStats:()=>({pcts:[0,100],trapIndex:-1,totalSamples:1}),
 formatStepByStepResolution:()=>'<p>Explicação da questão</p>'};
vm.createContext(modal);
vm.runInContext(section('  function answerKeyStatus(', '  function classifyQuestion('),modal);
vm.runInContext(section('  function questionAnswerNotice(', '  window.showQuestion=function(){'),modal);
modal.window.answerQuestion=()=>{confirmations++;battle.answered=true;};
modal.bindQuestionAnswerConfirmation(battle,item);
assert.equal(confirmButton.disabled,true);assert.equal(confirmButton.hidden,false);
optionButtons[1].onclick();optionButtons[0].onclick();assert.equal(confirmations,0);
assert.equal(battle._selectedAnswerIndex,0);assert.equal(optionButtons[0].attrs['aria-pressed'],'true');
assert(selectionStatus.textContent.includes('Alternativa A selecionada'));
confirmButton.onclick();confirmButton.onclick();assert.equal(confirmations,1);assert.equal(confirmButton.hidden,true);

// Run real grading paths: a suggestion/missing key never records results or XP; double clicks never duplicate a correct answer.
vm.runInContext(section('  window.answerQuestion=function(button,item){','  window.skipQuestionBlank=function(item){'),modal);
for(const pending of [{...base,correct_index:-1},{...base,key_source:'ia_sugerido',answer_key_validation:'pendente'}]){
 modal.activeQuestions={questions:[pending],current:0,answered:false,correct:0,streak:0};
 const before={results,xp};
 modal.window.answerQuestion(optionButtons[1],pending);modal.window.answerQuestion(optionButtons[1],pending);
 assert.equal(modal.activeQuestions.answered,true);assert.equal(results,before.results);assert.equal(xp,before.xp);
 assert(modal.questionAnswerNotice(pending).includes('não registra acerto, erro ou XP'));
}
const broken={...base,needs_source:true};
modal.activeQuestions={questions:[broken],current:0,answered:false,correct:0};
modal.bindQuestionAnswerConfirmation(modal.activeQuestions,broken);
assert(optionButtons.every(button=>button.disabled));assert(confirmButton.disabled);assert(skipButton.disabled);
modal.window.answerQuestion(optionButtons[1],broken);assert.equal(modal.activeQuestions.answered,false);assert.equal(xp,0);
assert(modal.questionAnswerNotice(broken).includes('Itens I e II ausentes.'));
optionButtons.forEach(button=>button.disabled=false);
modal.activeQuestions={questions:[item],current:0,answered:false,correct:0,streak:0};
modal.window.answerQuestion(optionButtons[1],item);modal.window.answerQuestion(optionButtons[1],item);
assert.equal(results,1);assert.equal(xp,25);assert.equal(modal.activeQuestions.correct,1);
for(const changed of ['owner','portal','reset']){
 let resolveAttempt;
 modal.state={_ownerUserId:'user-a',activeCampaignId:'portal-a',_resetEpoch:0};modal.cloudSession={user:{id:'user-a'}};
 modal.recordQuestionAttemptServer=()=>new Promise(resolve=>{resolveAttempt=resolve});
 const nextItem={...item};modal.activeQuestions={questions:[nextItem],current:0,answered:false,correct:0,streak:0};
 const before=xp;
 modal.window.answerQuestion(optionButtons[1],nextItem);
 assert.equal(xp,before+25);
 if(changed==='owner')modal.cloudSession.user.id='user-b';
 if(changed==='portal')modal.state.activeCampaignId='portal-b';
 if(changed==='reset')modal.state._resetEpoch++;
 resolveAttempt({mastery_bonus:100,mastery:90});
 await Promise.resolve();await Promise.resolve();
 assert.equal(xp,before+25,`A late mastery bonus cannot cross the ${changed} scope.`);
}
console.log('OK r186: vínculos por origem explícita, escopo privado/compartilhado, contagens disponíveis, ações de prova, seleção confirmada e gabarito pendente sem pontuação.');
