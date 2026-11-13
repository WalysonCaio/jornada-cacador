import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('dist/v77-experience.js');
const html=read('dist/index.html');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
const identity=value=>String(value??'');
const noOp=()=>{};
function context(extra={}){
  const ctx={window:{},state:{activeCampaignId:'portal-a'},navigator:{onLine:true},normalizeLegalText:identity,normalizeText:identity,
    shuffle:items=>[...items].reverse(),questionFingerprint:item=>[item.subject,item.topic,item.statement].join('|'),
    escText:identity,shortLabel:identity,...extra};
  vm.createContext(ctx);
  vm.runInContext(section(source,'  function answerKeyStatus(','  function classifyQuestion('),ctx);
  vm.runInContext(section(source,'  function stripOptionLetterPrefixClean(','  // Formata qualquer explicação'),ctx);
  return ctx;
}
const q={subject:'Língua Portuguesa',topic:'Concordância',statement:'Qual frase apresenta concordância verbal correta?',options:['Os alunos estudam.','Os alunos estuda.'],correct_index:0,origin:'oficial',explanation:'Comentário de apoio ao estudo.'};
const ctx=context();
const suggested={...q,key_source:'ia_sugerido',answer_key_validation:'pendente'};
assert.equal(ctx.answerKeyStatus(suggested),'sem_gabarito');
assert.equal(ctx.gradeAnswer(suggested,0).scored,false);
assert.equal(ctx.recordBoardQuestionAttempt(suggested,0),false);
const legacy={...q,explanation:'🤖 [Gabarito sugerido pela IA — confira no documento] Explicação provisória.'};
assert.equal(ctx.answerKeyStatus(legacy),'sem_gabarito','Marcador legado preserva pendência sem coluna de metadados');
for(const raw of [null,undefined,'',true,{},-1,2,'NaN'])assert.equal(ctx.answerKeyStatus({...q,correct_index:raw}),'sem_gabarito');
assert.equal(ctx.answerKeyStatus({...q,options:['mesma','mesma']}),'sem_gabarito');
assert.equal(ctx.applyReviewedAnswerKey({...q,options:['mesma','mesma']},0),false);
assert.equal(ctx.applyReviewedAnswerKey({...q},2),false);
const reviewed={...suggested,options:[...q.options]};
assert.equal(ctx.applyReviewedAnswerKey(reviewed,1,'PDF, questão 4'),true);
assert.equal(ctx.answerKeyStatus(reviewed),'revisado');
assert.equal(reviewed.answer_key_history[0].previous_source,'ia_sugerido');
assert.equal(reviewed.explanation_needs_review,true);
const reordered={...q,options:[...q.options].reverse(),correct_index:1};
const restored=ctx.prepareQuestionConsistent(reordered);
assert.equal(restored.correct_index,0,'Correção acompanha o texto escolhido, mesmo com as opções reordenadas');
assert.equal(ctx.answerKeyStatus(restored),'revisado');
const modified=ctx.prepareQuestionConsistent({...q,options:['Texto substituído',q.options[1]]});
assert.equal(modified.answer_key_override_stale,true);
assert.equal(ctx.gradeAnswer(modified,1).scored,false,'Alternativas alteradas invalidam o override antigo');

const statCtx=context();
assert(statCtx.recordBoardQuestionAttempt({...q,board:'AOCP',_answerStartedAt:Date.now()-3000},0));
assert(statCtx.recordBoardQuestionAttempt({...q,board:'Instituto AOCP'},1));
let rows=statCtx.questionBoardPerformanceRows();
assert.equal(rows.length,1);assert.equal(rows[0].total,2);assert.equal(rows[0].correct,1);
assert.equal(rows[0].firstTotal,1);assert.equal(rows[0].firstCorrect,1);assert.equal(rows[0].repeatTotal,1);
assert.equal(rows[0].timedTotal,1);assert(rows[0].averageSeconds>=2&&rows[0].averageSeconds<=5);
assert.equal(rows[0].lowSample,true);
assert(statCtx.recordBoardQuestionAttempt({...q,board:'FGV',origin:'autoral'},0));
assert.equal(statCtx.questionBoardPerformanceRows().length,2);
statCtx.state.activeCampaignId='portal-b';assert.equal(statCtx.questionBoardPerformanceRows().length,0);

// Execução dos dois carregadores reais com uma resposta de banco fictícia.
async function loadCloudQuestions(file){
  const rows=[{id:'row-1',title:'Caderno',content_type:'question_pack',source_document_id:'doc-1',content:{subject:q.subject,is_question_pack:true,questions:[suggested,{...q,statement:q.statement+' Sem chave.',correct_index:-1,answer_unknown:true}]}}];
  const elements=new Map();
  const loaded=context({
    cloudSession:{user:{id:'user-1'}},activeCampaign:()=>({dbId:'db-1'}),validSession:async()=>({user:{id:'user-1'}}),
    cloudFetch:async()=>({ok:true,json:async()=>rows}),ALL_SUMMARIES:[],ALL_FLASHCARDS:[],ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],
    selectedLearningSubject:q.subject,libraryUI:{trailSubject:{},summaryFilter:{},cardFilter:{}},
    canonicalSubjectName:identity,inferStrictQuestionSubject:(_st,_tp,subject)=>subject,normalizeLegalTitle:identity,subjectKey:identity,
    findSourceDocumentForContent:()=>null,resolveDocumentDiscipline:(_doc,subject)=>subject,isInvalidTrailSubject:()=>false,
    migrateLearningSubjectKeys:noOp,sanitizeSummaryObject:identity,cleanPedagogicalMnemonic:identity,
    isValidPedagogicalSummary:()=>false,isAllowedFlashcardRow:()=>false,isValidFlashcardItem:()=>false,
    isValidPedagogicalQuestion:()=>true,extractFlashcardsFromUserNotes:()=>[],computeValidLearningSubjects:()=>[q.subject],
    saveLibraryUI:noOp,renderStudy:noOp,renderLearning:noOp,renderQuestionFilters:noOp,renderViewById:noOp,toast:noOp,console,
    $:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);},esc:identity,shortOptionLabel:identity,
    document:{querySelector:()=>({id:'today'})},
  });
  const text=read(file);
  const code=file.endsWith('index.html')?section(text,'async function loadGeneratedContent(){','function renderSummaries('):section(text,'  loadGeneratedContent=async function(){','  window.setSummaryApproval=');
  vm.runInContext(code,loaded);
  await loaded.loadGeneratedContent();
  assert.equal(loaded.ALL_QUESTIONS.length,2,file+' mantém pendências para revisão');
  assert.equal(loaded.ALL_QUESTIONS[0].key_source,'ia_sugerido');
  assert.equal(loaded.ALL_QUESTIONS[0].answer_key_validation,'pendente');
  assert.equal(loaded.answerKeyStatus(loaded.ALL_QUESTIONS[0]),'sem_gabarito');
  assert.equal(loaded.answerKeyStatus(loaded.ALL_QUESTIONS[1]),'sem_gabarito');
}
await loadCloudQuestions('dist/index.html');
await loadCloudQuestions('dist/v59-enhancements.js');

// Salvar/compartilhar mantém o acervo e transporta a situação IA pelo comentário,
// pois a tabela compartilhada antiga não possui colunas de metadados de gabarito.
const writes=[];
const saved=context({ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],cloudSession:{user:{id:'user-1'}},activeCampaign:()=>({dbId:'db-1'}),
  canonicalSubjectName:identity,resolveStrictQuestionDiscipline:(_s,_t,subject)=>subject,normalizedDifficulty:()=> 'medio',normalizedOrigin:item=>item.origin==='oficial'?'oficial':'autoral',
  save:noOp,cloudFetch:async(path,options)=>{writes.push({path,body:JSON.parse(options.body)});return{ok:true};},
  renderQuestionFilters:noOp,populateTopicFilter:noOp,updateQuestionPool:noOp,renderExamBankHub:noOp,console,
});
vm.runInContext(section(source,'  async function saveQuestionsToCampaign(','  function buildLocalCognitiveTwinQuestion('),saved);
assert.equal(await saved.saveQuestionsToCampaign('Caderno',q.subject,[suggested,{...q,statement:q.statement+' Sem chave.',correct_index:null}]),2);
const contentWrite=writes.find(write=>write.path==='generated_study_content').body[0].content.questions;
assert.equal(contentWrite[0].key_source,'ia_sugerido');
assert.equal(contentWrite[1].correct_index,-1,'Chave nula não vira alternativa A ao salvar');
const shared=writes.find(write=>write.path.startsWith('shared_question_bank')).body;
assert.equal(shared.length,1,'Mantém sugestão compartilhável, sem inventar chave para a questão sem gabarito');
assert.equal(saved.isUnreviewedAiAnswer(shared[0]),true,'Marcador exportado preserva IA pendente quando reimportada');
assert.equal(saved.gradeAnswer(shared[0],0).scored,false);

// Handler real do editor: a identidade deve mudar antes de gravar a validação.
function editQuestion(selectedKey){
  const item={...q,_fp:'fingerprint-antigo'};
  const fields={
    '[data-edit-q-subj="0"]':{value:q.subject},'[data-edit-q-topic="0"]':{value:q.topic},
    '[data-edit-q-ans="0"]':{value:selectedKey},'[data-edit-q-stmt="0"]':{value:q.statement+' Texto revisado.'},
  };
  const editor=context({ALL_QUESTIONS:[item],btn:{dataset:{saveRevQ:'0'}},dlg:{querySelector:selector=>fields[selector]},
    canonicalSubjectName:identity,subjectKey:identity,topicKey:identity,learningCategory:identity,computeQuestionEditalLearningOrder:()=>0,
    save:noOp,renderQuestionFilters:noOp,populateTopicFilter:noOp,updateQuestionPool:noOp,toast:noOp,
  });
  vm.runInContext(section(html,'function questionFingerprint(','function questionsForMode('),editor);
  const start=source.indexOf('        btn.onclick=()=>{',source.indexOf("dlg.querySelectorAll('[data-save-rev-q]')"));
  const end=source.indexOf('\n        };',start);
  vm.runInContext(source.slice(start,end+11),editor);
  editor.btn.onclick();
  assert.notEqual(item._fp,'fingerprint-antigo');
  if(selectedKey==='keep')assert.equal(editor.gradeAnswer(item,0).scored,false,'Alterar enunciado exige validar explicitamente sua chave');
  else{
    assert.equal(editor.answerKeyStatus(item),'revisado');
    assert(editor.state.questionAnswerOverrides[item._fp]);
    assert.equal(editor.state.questionAnswerOverrides['fingerprint-antigo'],undefined);
  }
}
editQuestion('1');
editQuestion('keep');

const ai=context({validSession:async()=>({access_token:'fixture'}),SUPABASE_URL:'https://fixture.test',authHeaders:()=>({}),
  fetch:async()=>({ok:true,json:async()=>({solved:[{index:0,correct_index:1,explanation:'Explicação provisória retornada pela IA.'}]})})});
vm.runInContext(section(source,'  async function solveQuestionsArrayWithAi(','  window.solveQuestionsArrayWithAi = solveQuestionsArrayWithAi;'),ai);
const missing=[{...q,correct_index:-1,answer_unknown:true},{...q,statement:q.statement+' Outra questão.',correct_index:-1,answer_unknown:true}];
assert.equal(await ai.solveQuestionsArrayWithAi(missing),1,'Resposta parcial só marca um item');
assert.equal(ai.answerKeyStatus(missing[0]),'sem_gabarito');
assert.equal(missing[1].correct_index,-1);assert.equal(missing[1].answer_unknown,true);
ai.navigator.onLine=false;
assert.equal(await ai.solveQuestionsArrayWithAi([missing[1]]),0);
assert.equal(missing[1].correct_index,-1);

async function solveDocumentScenario(mode){
  const messages=[],writes=[];
  const doc={id:'doc-1',title:'Simulado sem chave',metadata:{coverage:{warnings:['2 questões SEM gabarito.']}}};
  const originalMetadata=JSON.stringify(doc.metadata);
  const questions=[{...q,correct_index:-1,answer_unknown:true},{...q,statement:q.statement+' Segunda.',correct_index:-1,answer_unknown:true}];
  const button={dataset:{solveAiKeyDoc:'doc-1'},disabled:false,textContent:'Resolver'};
  const documentCtx=context({
    cloudDocuments:[doc],cloudSession:{access_token:'fixture'},navigator:{onLine:mode!=='offline'},
    validSession:async()=>({access_token:'fixture'}),SUPABASE_URL:'https://fixture.test',authHeaders:()=>({}),
    document:{querySelectorAll:()=>[button]},toast:message=>messages.push(message),
    ALL_QUESTIONS:[],save:noOp,render:noOp,renderExamBankHub:noOp,loadGeneratedContent:async()=>{},loadCloudDocuments:async()=>{},
    cloudFetch:async(path,options={})=>{
      if(options.method==='PATCH'){writes.push({path,body:JSON.parse(options.body)});return{ok:mode!=='save-fails'};}
      return{ok:true,json:async()=>[{id:'row-1',content:{questions}}]};
    },
    fetch:async()=>({ok:true,json:async()=>({solved:mode==='zero'?[]:[{index:0,correct_index:1,explanation:'Sugestão provisória de resolução.'}]})}),
  });
  vm.runInContext(section(source,'  async function solveQuestionsArrayWithAi(','  // ── 3) Integração Completa com Goodnotes'),documentCtx);
  await documentCtx.solveMissingAnswerKeyWithAi('doc-1');
  assert.equal(button.disabled,false,'Botão sempre deve ser liberado');
  if(mode==='offline'||mode==='zero'){
    assert.equal(writes.length,0);
    assert.equal(JSON.stringify(doc.metadata),originalMetadata,'Nenhuma sugestão não pode limpar pendências');
    assert(!messages.some(message=>message.includes('sugestão(ões) salvas')));
  }else if(mode==='partial'){
    assert.equal(doc.metadata.coverage.ai_keyed_count,1);
    assert.equal(doc.metadata.coverage.missing_key_count,1);
    assert.equal(doc.metadata.coverage.needs_review,true);
    assert(doc.metadata.coverage.warnings.some(warning=>warning.includes('validação humana')));
    assert(messages.at(-1).includes('1 sugestão(ões) salvas'));
  }else if(mode==='save-fails'){
    assert.equal(JSON.stringify(doc.metadata),originalMetadata);
    assert(messages.at(-1).includes('Não foi possível salvar'));
  }
}
for(const mode of ['offline','zero','partial','save-fails'])await solveDocumentScenario(mode);

// Comentário conflitante nunca muda o gabarito nem destaca outra letra como correta.
vm.runInContext(section(source,'  function splitInlineOptionExplanations(','  // ── 2) Confirmação ao Sair'),ctx);
const conflict=ctx.buildFormattedResolutionStepsHtml('Conceito-chave: concordância. ✅ A) Primeira explicação.',q,1,'B',false,null);
assert(conflict.includes('Comentário inconsistente'));
assert(!conflict.includes('Correta: A'));
const coherent=ctx.buildFormattedResolutionStepsHtml('Conceito-chave: concordância. ✅ A) Concorda. ❌ B) Não concorda.',q,0,'A',false,null);
assert(coherent.includes('Correta: A) Concorda.'));
console.log('OK r174: confiança persiste em recarga/exportação; IA pendente não pontua; revisão segue texto e versão das alternativas; respostas parciais/offline e métricas por banca são honestas.');
