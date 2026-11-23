import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const ctx={console};ctx.window=ctx;vm.createContext(ctx);
function runSection(text,startMark,endMark){
  const start=text.indexOf(startMark),end=text.indexOf(endMark,start);
  assert(start>=0&&end>start,`production section exists: ${startMark}`);
  vm.runInContext(text.slice(start,end),ctx);
}
runSection(source,'  function normalizedOrigin(','\n  function repairKnownExamTextArtifacts(');
runSection(html,"function questionCommandParts(statement='",'\nfunction exclusiveQuestionSubjectEvidence(');
Object.assign(ctx,{
  resolveStrictQuestionDiscipline:(item,_topic,fallback)=>typeof item==='object'?item.subject:fallback,
  strictSubjectMatch:(a,b)=>!b||b==='all'||ctx.topicKey(a)===ctx.topicKey(b),
});
runSection(source,'  function questionMatchesBoardFilter(','\n  function subjectIconForName(');
const topicStart=source.indexOf('  const _TOPIC_REF_CACHE=');
const topicEnd=source.indexOf('\n  function activeCampaignErrors(',topicStart);
assert(topicStart>=0&&topicEnd>topicStart,'production topic helpers exist');
vm.runInContext(source.slice(topicStart,topicEnd),ctx);

const constitutional='Direito Constitucional';
const family='Organização do Estado e Repartição de Competências (Arts. 21 a 24)';
const art5='Direitos e Deveres Individuais e Coletivos (Art. 5º)';
const art7='Dos Direitos Sociais (Art. 6º ao 11)';
const narrow22='Competência privativa da União (Art. 22)';
const narrow24='Competência concorrente (Art. 24)';
const question=(statement,topic=art5,extra={})=>({subject:constitutional,statement,topic,board:'Instituto AOCP',options:['Primeira opção.','Segunda opção.'],correct_index:1,origin:'oficial',difficulty:'medio',...extra});
const matches=(item,label)=>ctx.questionMatchesTopicFilter(item,ctx.topicKey(label),item.subject,label);
const art24=question('(FUNCAB) Segundo o art. 24 da Constituição Federal, compete à União, aos Estados e ao Distrito Federal legislar concorrentemente sobre quais matérias?');
const savedKey=JSON.stringify([art24.options,art24.correct_index]);
ctx.applyQuestionTopicEvidence(art24);ctx.applyQuestionBoardEvidence(art24);
assert.match(art24.topic,/Organização.*Estado|Repartição.*Competências/i);
assert.equal(art24.topic_declared,art5);
assert.equal(art24.board,'FUNCAB');
assert.equal(art24.board_declared,'Instituto AOCP');
assert(matches(art24,family));assert(matches(art24,narrow24));assert(!matches(art24,narrow22));assert(!matches(art24,art5));
assert.equal(JSON.stringify([art24.options,art24.correct_index]),savedKey,'classification never changes options or answer key');
console.log('OK r187 assunto: CF art. 24/legislar concorrentemente sai de Art. 5 e entra em competências; Art. 22 e Art. 24 permanecem distintos.');

const art22=question('De acordo com o art. 22 da Constituição Federal, compete privativamente à União legislar sobre quais matérias?');
ctx.applyQuestionTopicEvidence(art22);
assert(matches(art22,narrow22));assert(!matches(art22,narrow24));assert(!matches(art22,art5));
for(const article of [21,23]){
 const item=question(`Nos termos do art. ${article} da Constituição Federal, qual é a competência atribuída à União e aos entes federados?`);
 ctx.applyQuestionTopicEvidence(item);assert(matches(item,family));assert(!matches(item,art5));
}
const remedy=question('Qual remédio constitucional, previsto no art. 5º da Constituição Federal, protege direito líquido e certo por mandado de segurança?','Remédios Constitucionais');
const social=question('Nos termos do art. 7º da Constituição Federal, quais são os direitos sociais dos trabalhadores?',art5);
ctx.applyQuestionTopicEvidence(remedy);ctx.applyQuestionTopicEvidence(social);
assert(matches(remedy,'Remédios Constitucionais'));assert(!matches(remedy,art7));assert(!matches(remedy,family));
assert(matches(social,art7));assert(!matches(social,art5));assert(!matches(social,family));
console.log('OK r187 famílias constitucionais: CF 21–24, remédios do Art. 5 e direitos sociais do Art. 7 não se misturam.');
assert(!matches(remedy,'Habeas corpus'),'mandado de segurança does not satisfy a selected habeas corpus topic');
assert(matches(remedy,'Mandado de segurança'));
const ordinaryRights=question('Segundo o art. 5º da Constituição Federal, assinale a afirmação correta sobre os direitos individuais.');
ctx.applyQuestionTopicEvidence(ordinaryRights);
assert(matches(ordinaryRights,art5));assert(!matches(ordinaryRights,'Remédios Constitucionais'));
assert(!matches(ordinaryRights,'Direito à propriedade (Art. 5º)'),'generic Art. 5 evidence does not justify a narrower property topic');
const narrowProperty=question('Segundo o art. 5º da Constituição Federal, assinale a afirmação correta sobre o direito à propriedade.','Direito à propriedade (Art. 5º)');
ctx.applyQuestionTopicEvidence(narrowProperty);
assert.equal(narrowProperty.topic,'Direito à propriedade (Art. 5º)');
assert(matches(narrowProperty,'Direito à propriedade (Art. 5º)'));assert(!matches(narrowProperty,'Remédios Constitucionais'));
console.log('OK r187 recortes específicos: mandado de segurança não entra em habeas corpus; Art. 5 genérico não vira remédio/propriedade; tópico estreito compatível é preservado.');

const manual=question(art24.statement,art5,{topic_source:'manual_revisado'});
ctx.applyQuestionTopicEvidence(manual);
assert.equal(manual.topic,art5);assert.equal(manual.topic_source,'manual_revisado');
assert.equal(manual.topic_classification_needs_review,true);assert(!matches(manual,art5));assert(!matches(manual,family));
const manualUnrelated=question(art24.statement,'Controle de constitucionalidade',{topic_classification_source:'manual'});
ctx.applyQuestionTopicEvidence(manualUnrelated);
assert.equal(manualUnrelated.topic,'Controle de constitucionalidade');
assert.equal(manualUnrelated.topic_classification_source,'manual');
assert.equal(manualUnrelated.topic_classification_needs_review,true);
assert(!matches(manualUnrelated,'Controle de constitucionalidade'));assert(!matches(manualUnrelated,family));
const compatibleManualTopic=question(art24.statement,'Organização do Estado e Repartição de Competências',{topic_source:'manual',board:'FUNCAB'});
ctx.applyQuestionTopicEvidence(compatibleManualTopic);
assert.equal(compatibleManualTopic.topic,'Organização do Estado e Repartição de Competências');
assert.equal(compatibleManualTopic.topic_source,'manual');
assert(!compatibleManualTopic.topic_classification_needs_review);assert(matches(compatibleManualTopic,narrow24));
const compatibleManualBoard=question('(Instituto AOCP) Qual alternativa está correta?',art5,{board:'AOCP',board_source:'manual'});
ctx.applyQuestionBoardEvidence(compatibleManualBoard);
assert.equal(compatibleManualBoard.board,'AOCP');assert.equal(compatibleManualBoard.board_source,'manual');
assert(!compatibleManualBoard.board_needs_review);assert(ctx.questionMatchesBoardFilter(compatibleManualBoard,'Instituto AOCP'));
const manualBoard=question('(FUNCAB) Qual alternativa está correta?',art5,{board_source:'manual_revisado'});
ctx.applyQuestionBoardEvidence(manualBoard);
assert.equal(manualBoard.board,'Instituto AOCP');assert.equal(manualBoard.board_source,'manual_revisado');
assert.equal(manualBoard.board_needs_review,true);assert.equal(ctx.questionBoardDecision(manualBoard).explicit_board,'FUNCAB');
assert(!ctx.questionMatchesBoardFilter(manualBoard,'Instituto AOCP'));assert(!ctx.questionMatchesBoardFilter(manualBoard,'FUNCAB'));
assert(!ctx.questionMatchesBoardFilter(manualBoard,'all'),'a manual board conflict waits for review even without a board selection');
console.log('OK r187 proveniência: divergências com assunto/banca manuais preservam os valores e aguardam revisão.');

const bodyCitation=question('O relatório menciona a banca (FUNCAB) apenas como exemplo. Segundo a Constituição Federal, assinale a alternativa correta.');
assert.equal(ctx.resolvedQuestionBoard(bodyCitation),'Instituto AOCP');
const filenameOnly=question('Assinale a alternativa correta.',art5,{board:'',source_file:'prova-AOCP.pdf',source_label:'Portal AOCP'});
assert.equal(ctx.resolvedQuestionBoard(filenameOnly),'');
assert.equal(ctx.declaredQuestionBoard('Questão 15. (FUNCAB / 2014) Assinale a alternativa correta.'),'FUNCAB');
assert.equal(ctx.declaredQuestionBoard('[FUNCAB / 2014] Assinale a alternativa correta.'),'FUNCAB');
assert.equal(ctx.declaredQuestionBoard('FUNCAB — Assinale a alternativa correta.'),'FUNCAB');
assert.equal(ctx.declaredQuestionBoard('(FUNCAB / AOCP) Assinale a alternativa correta.'),'');
assert.equal(ctx.declaredQuestionBoard('[FUNCAB / FGV] Assinale a alternativa correta.'),'');
assert.equal(ctx.declaredQuestionBoard('No texto aparece (FUNCAB), sem atribuição inicial.'),'');
assert(ctx.questionMatchesBoardFilter(art24,'FUNCAB'));assert(!ctx.questionMatchesBoardFilter(art24,'AOCP'));
const incidentalArticle=question('Analise a coesão do trecho que cita o art. 24 do Código Penal.','Coesão textual',{subject:'Língua Portuguesa'});
assert(!ctx.constitutionalQuestionTopicEvidence(incidentalArticle));
const keywordsOnly=question('A liberdade e a propriedade são citadas no caso, mas o comando trata da competência concorrente do art. 24 da Constituição Federal.','Competência concorrente');
assert(!matches(keywordsOnly,art5));
const unrelated=question('Assinale a alternativa sobre prisões cautelares.','Prisão preventiva',{subject:'Direito Processual Penal'});
assert(!matches(unrelated,'Prisão'));assert(!matches(unrelated,'Prisão temporária'));
console.log('OK r187 falsos positivos: citação no corpo, nome de arquivo, palavras soltas e substrings não atribuem banca/assunto.');

const stored={art24,manual,manualUnrelated,manualBoard,compatibleManualTopic,compatibleManualBoard,narrowProperty,bodyCitation,filenameOnly};
for(const item of Object.values(stored)){ctx.applyQuestionTopicEvidence(item);ctx.applyQuestionBoardEvidence(item);}
const snapshot=JSON.stringify(stored);
const reloaded=JSON.parse(snapshot);
for(const item of Object.values(reloaded)){ctx.applyQuestionTopicEvidence(item);ctx.applyQuestionBoardEvidence(item);}
assert.equal(JSON.stringify(reloaded),snapshot,'stored evidence is idempotent after JSON reload');
assert.equal(reloaded.manual.topic_source,'manual_revisado');assert.equal(reloaded.manualBoard.board_source,'manual_revisado');
console.log('OK r187 recarga: decisões e metadados sobrevivem ao JSON sem perder proveniência ou alterar gabaritos.');

// Run the actual pool adapter and launchers. Unrelated services are isolated;
// topic and board decisions above remain the real production functions.
const nodes={
 '#questionSubject':{value:constitutional},'#questionBoardFilter':{value:'FUNCAB'},
 '#questionTopic':{value:ctx.topicKey(narrow24),selectedIndex:0,options:[{text:narrow24}]},
 '#questionDifficulty':{value:'all'},'#questionOrigin':{value:'all'},
 '#questionBattleMode':{value:'battle'},'#questionHistoryFilter':{value:'all'},
 '#followEditalOrderToggle':{checked:false},'#questionDialogTitle':{},
 '#questionDialog':{showModal(){}},'#simuladoScope':{value:'filtered'},
};
const pool=[art24,art22,social,remedy,manual,manualBoard,unrelated];
Object.assign(ctx,{
 ALL_QUESTIONS:pool,state:{activeCampaignId:'test',daily:'m24',errors:{}},activeQuestions:null,
 q:selector=>nodes[selector],ensureNativeQuestionBankLoaded(){},sanitizeAllQuestionsAndErrorsSubjects(){},
 isQuestionDisciplineEligible:(item,subject='all')=>!item.topic_classification_needs_review&&!item.classification_needs_review&&ctx.strictSubjectMatch(item.subject,subject),
 answerKeyStatus:()=> 'oficial',canonicalSubjectName:value=>value,subjectKey:value=>ctx.topicKey(value),
 difficultyWeight:value=>({facil:1,medio:2,dificil:3})[value]||2,computeQuestionEditalLearningOrder:()=>1,
 isQuestionAnsweredBefore:()=>true,isQuestionFavorited:()=>false,
 activeCampaignErrors:()=>[['e24',{question:art24.statement,subject:constitutional,topic:art24.topic}]],
 missionPool:()=>[{id:'m24',name:narrow24,subject:constitutional}],
 shuffle:items=>[...items],balancedQuestions:(items,count)=>items.slice(0,count),
 prepareQuestion:item=>({...item}),showQuestion(){},toast:message=>{throw new Error(message)},openView(){},
 questionFingerprint:item=>item.statement,
});
runSection(source,'  function questionMatchesErrorPool(','\n  function isQuestionFavorited(');
runSection(source,'  let questionFilterPoolCache=null;','\n  function questionAvailabilityBreakdown(');
runSection(source,'  function progressiveQuestions(','\n  function startErrorReinforcementBattle(');
runSection(source,'  function startErrorReinforcementBattle(','\n  function findRelatedSummary(');
runSection(source,'  function startCaveiraSprintSession(','\n  window.startCaveiraSprintSession=');
runSection(source,'  function startQuickSprintBattle(','\n  function ensureTopicPanelSearch(');
runSection(source,'  function simuladoCandidatePool(','\n  function updateSimuladoAvailability(');
for(const mode of ['battle','progressive','errors']){
 nodes['#questionBattleMode'].value=mode;
 assert.deepEqual(Array.from(ctx.filteredQuestionPool(),item=>item.statement),[art24.statement],`${mode}: active topic and board stay strict`);
 ctx.startFilteredBattle();assert.deepEqual(Array.from(ctx.activeQuestions.questions,item=>item.statement),[art24.statement]);
}
ctx.startCaveiraSprintSession();assert.deepEqual(Array.from(ctx.activeQuestions.questions,item=>item.statement),[art24.statement]);
ctx.startQuickSprintBattle();assert.deepEqual(Array.from(ctx.activeQuestions.questions,item=>item.statement),[art24.statement]);
assert.deepEqual(Array.from(ctx.simuladoCandidatePool(),item=>item.statement),[art24.statement]);
console.log('OK r187 modos reais: batalha, progressivo, erros, missão/sprint e simulado filtrado recebem apenas o assunto selecionado.');

const asError=item=>({...item,question:item.statement});
const errors=[['e24',asError(art24)],['e22',asError(art22)],['e7',asError(social)],['eManual',asError(manualBoard)]];
ctx.activeCampaignErrors=()=>errors;
ctx.startErrorReinforcementBattle();
assert.deepEqual(Array.from(ctx.activeQuestions.questions,item=>item.statement),[art24.statement],'reinforcement intersects real bank with selected topic and board');
ctx.ALL_QUESTIONS=[];
ctx.startErrorReinforcementBattle();
assert.deepEqual(Array.from(ctx.activeQuestions.questions,item=>item.statement),[art24.statement],'notebook fallback also applies selected topic and board');
assert.equal(ctx.activeQuestions.questions[0]._errorNotebookKey,'e24');
ctx.activeQuestions=null;ctx.activeCampaignErrors=()=>errors.slice(1);
assert.throws(()=>ctx.startErrorReinforcementBattle(),/não têm questões completas/);
assert.equal(ctx.activeQuestions,null,'unrelated saved errors never replace an empty selected-topic pool');
console.log('OK r187 reforço real: banco e fallback do Caderno de Erros respeitam o tópico e a banca selecionados; erros fora do filtro não entram.');

const savedContext=ctx.questionSessionFilterContext();
const savedBattle={questions:[{...art24}],filterContext:JSON.parse(JSON.stringify(savedContext))};
assert(ctx.savedQuestionSessionCanResume(savedBattle));
nodes['#questionBoardFilter'].value='Instituto AOCP';nodes['#questionTopic'].value=ctx.topicKey(art5);
assert(ctx.savedQuestionSessionCanResume(savedBattle),'a saved Art. 24/FUNCAB session retains its original filters when the UI changes');
assert(!ctx.questionMatchesSessionFilterContext(art24,ctx.questionSessionFilterContext()),'current Art. 5/AOCP controls differ from the saved session');
assert(!ctx.savedQuestionSessionCanResume({...savedBattle,questions:[{...art22,board:'FUNCAB'}]}),'saved Art. 24 scope rejects an Art. 22 question');
assert(!ctx.savedQuestionSessionCanResume({questions:[manualBoard],filterContext:ctx.questionSessionFilterContext({subject:constitutional})}),'manual board review blocks resume even with all boards/topics');
assert(ctx.savedQuestionSessionCanResume({questions:[art24]}),'legacy sessions without filter context may resume when their questions are eligible');
assert(!ctx.savedQuestionSessionCanResume({questions:[{...art24,topic_classification_needs_review:true}]}),'legacy sessions still require eligible questions');
assert(!ctx.savedQuestionSessionCanResume({questions:[]}));
nodes['#questionBoardFilter'].value=savedContext.board;nodes['#questionTopic'].value=savedContext.topic;
console.log('OK r187 retomada real: usa o recorte original salvo, rejeita Art. 22 em sessão de Art. 24 e bloqueia revisões mesmo sem filtro de banca.');

Object.assign(ctx,{
 repairKnownExamTextArtifacts:value=>String(value??''),
 getQuestionQualityDecision:()=>({needs_review:false}),
 answerOptionText:value=>String(value??'').trim(),
});
runSection(source,'  function extractStructuredExamQuestions(','\n  window.extractStructuredExamQuestions=');
const importCases=[art24,manual,manualUnrelated,manualBoard,compatibleManualTopic,compatibleManualBoard,narrowProperty];
const imported=ctx.extractStructuredExamQuestions(JSON.stringify(importCases),{defaultSubject:constitutional,defaultBoard:'Instituto AOCP'});
assert.equal(imported.length,importCases.length);
for(let index=0;index<importCases.length;index++){
 const original=importCases[index],actual=imported[index];
 for(const field of ['topic','topic_source','topic_classification_source','topic_declared','topic_statement','topic_classification_needs_review','board','board_source','board_declared','board_statement','board_needs_review']){
  assert.equal(actual[field],original[field],`JSON parser preserves ${field} for row ${index}`);
 }
 assert.equal(actual.correct_index,original.correct_index);assert.equal(JSON.stringify(actual.options),JSON.stringify(original.options));
}
assert(imported[1].topic_classification_needs_review);assert(imported[3].board_needs_review);
console.log('OK r187 importação JSON real: proveniência e revisão manuais de assunto/banca sobrevivem ao parser sem alterar alternativas/gabaritos.');

const sanitizerQuestion=question('(FUNCAB) Nos termos do art. 24 da Constituição Federal, a União e os Estados podem legislar concorrentemente sobre qual matéria?');
const toNotebook=item=>{const record={...item,question:item.statement};delete record.statement;return record;};
const matchingError=toNotebook({...sanitizerQuestion});
const unmatchedError=toNotebook(question('(FUNCAB) Conforme o art. 24 da Constituição Federal, identifique uma matéria sobre a qual os entes podem legislar concorrentemente.'));
const manualError=toNotebook({...sanitizerQuestion,topic_source:'manual_revisado',board_source:'manual_revisado'});
let saves=0;
Object.assign(ctx,{
 ALL_QUESTIONS:[sanitizerQuestion],
 state:{activeCampaignId:'sanitize-test',errors:{matched:matchingError,unmatched:unmatchedError,manual:manualError}},
 questionDisciplineDecision:item=>({subject:item.subject||constitutional,needs_review:false,reason:'Classificação de fixture.'}),
 isInvalidTrailSubject:()=>false,dedupeAllQuestionsInMemory(){},save(){saves++;},
});
runSection(source,'  function isTopicContaminatedByWrongSubject(','\n  function strictSubjectMatch(');
ctx.sanitizeAllQuestionsAndErrorsSubjects(true);
for(const record of [matchingError,unmatchedError]){
 assert.match(record.topic,/Organização.*Estado|Repartição.*Competências/i);
 assert.equal(record.board,'FUNCAB');assert(matches({...record,statement:record.question},narrow24));
 assert.equal(record.correct_index,1);
}
assert.equal(manualError.topic,art5);assert.equal(manualError.topic_source,'manual_revisado');
assert.equal(manualError.board,'Instituto AOCP');assert.equal(manualError.board_source,'manual_revisado');
assert.equal(manualError.topic_classification_needs_review,true);assert.equal(manualError.board_needs_review,true);
assert(saves>0,'error evidence changes are saved');
const sanitizedSnapshot=JSON.stringify(ctx.state.errors);
ctx.sanitizeAllQuestionsAndErrorsSubjects(true);
assert.equal(JSON.stringify(ctx.state.errors),sanitizedSnapshot,'repeated sanitation preserves the same error evidence');
console.log('OK r187 saneamento real: erros com e sem questão correspondente recebem evidência; revisão manual é preservada e a recarga é estável.');

Object.assign(ctx,{state:{activeCampaignId:'stats-test'},gradeAnswer:()=>({scored:true,ok:true}),questionFingerprint:item=>item.statement});
runSection(source,'  function recordBoardQuestionAttempt(', '\n  window.recordBoardQuestionAttempt=');
assert(ctx.recordBoardQuestionAttempt({...art24,board:'Instituto AOCP',board_source:'metadata'},1));
const stats=Object.values(ctx.state.questionBoardStatsByCampaign['stats-test']);
assert.equal(stats.length,1);assert.equal(stats[0].board,'FUNCAB','statistics use the explicit statement board even before another sanitation');
assert.equal(ctx.recordBoardQuestionAttempt(manualBoard,1),false,'disputed manual board cannot create a misleading board statistic');
vm.runInContext(readFileSync(new URL('../dist/question-review.js',import.meta.url),'utf8'),ctx);
const oldBoard={...art24,board:'Instituto AOCP',board_source:'manual_revisado',board_reference:'Minha referência.'};
const freshBoard={...art24,board:'FUNCAB',board_source:'statement',board_needs_review:false};
const oldRows=[{id:'r1',content:{questions:[oldBoard]}}],beforeRows=JSON.stringify(oldRows);
const proposed=ctx.JCQuestionReview.reconcile(oldRows,[freshBoard],{id:'doc-test',title:'Prova original'});
assert.equal(JSON.stringify(oldRows),beforeRows);assert.equal(proposed.candidates[0].content.questions[0].board,'Instituto AOCP');
assert.equal(proposed.report.board_pending,1);assert(proposed.report.manual_review_required);
assert.equal(proposed.report.items[0].board_reference,'Minha referência.');assert.equal(proposed.report.items[0].board_statement,'FUNCAB');
console.log('OK r187 métricas e revisão: FUNCAB vai para a banca correta; conflito humano preserva referência e exige conferência.');
runSection(source,'  function isQuestionDisciplineEligible(', '\n  window.isQuestionDisciplineEligible=');
assert.equal(ctx.isQuestionDisciplineEligible(oldBoard,'all'),false,'all training modes reject an unresolved human board conflict');
assert.equal(ctx.isQuestionDisciplineEligible(freshBoard,'all'),true);
