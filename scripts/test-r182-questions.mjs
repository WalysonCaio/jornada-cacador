import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const key=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const original={id:'q1',subject:'Português',statement:'Concordância nominal.',options:['Primeira','Segunda'],correct_index:1,sourceDocumentId:'doc-a',board:'Prova A',origin:'oficial'};
const other={...original,id:'q2',subject:'Direito Penal',sourceDocumentId:'doc-b',board:'Prova A'};
const legacy={...original,id:'legacy',sourceDocumentId:null,board:'Prova A'};
const foreign={...original,id:'q3',sourceDocumentId:null,board:'Prova B'};
const documents={window:{},topicKey:key,ALL_QUESTIONS:[original,other,legacy,foreign]};
vm.createContext(documents);vm.runInContext(section('  function examDocumentScopeAllows(', '  function renderSingleExamDocCardHtml('),documents);
assert.deepEqual(Array.from(documents.examDocumentQuestionPool({id:'doc-a',title:'Prova A'}),q=>q.id),['q1'],'Uma coincidência de título não confirma a origem de uma questão legada');
assert.equal(documents.examDocumentQuestionPool({id:'missing',title:'Prova sem questões'}).length,0,'Documento vazio não puxa todo banco oficial');
assert.equal(documents.examDocumentQuestionPool(null).length,0,'Documento não encontrado não inicia outro caderno');

// The actual render branch does no card rendering while a folder is collapsed.
const renderer=section("    let foldersHtml = '';",'    const controlsBarHtml =');
for(const mode of ['subject_first','category_first']){
 let cards=0;
 const meta={catKey:'prova',catLabel:'Provas',catOrder:1,subject:'Português'};
 const ctx={filteredDocs:[{doc:{id:'doc-a',title:'Prova A'},docQuestions:[original],meta,qCount:1}],
  examCatalogState:{groupMode:mode,foldersOpen:{}},state:{activeCampaignId:'portal-a'},searchNorm:'',allSubjects:['Português'],
  subjectKey:key,escText:v=>String(v),renderSingleExamDocCardHtml(doc){cards++;return `<article>${doc.title}</article>`;}};
 vm.createContext(ctx);vm.runInContext(renderer+'\nglobalThis.result=foldersHtml;',ctx);
 assert.equal(cards,0,mode+': não constrói todos os cards para esconder depois');
 assert(!ctx.result.includes('<article>'));
 ctx.examCatalogState.foldersOpen[mode==='subject_first'?'examsubj:portal-a:portugues':'examcat:portal-a:prova']=true;
 vm.runInContext('{'+renderer+'\nglobalThis.result=foldersHtml;}',ctx);
 assert.equal(cards,1);assert(ctx.result.includes('<article>Prova A</article>'));
}
// A click must hydrate the previously empty folder, not merely change its CSS class.
let open=false,rendered=0;
const folder={classList:{contains:()=>open,toggle:(_name,value)=>{open=value;}}};
const button={dataset:{examFolderToggle:'folder-a'},closest:()=>folder};
const toggles={qa:()=>[button],examCatalogState:{foldersOpen:{}},renderExamBankHub(){rendered++;}};
vm.createContext(toggles);vm.runInContext(section("    qa('[data-exam-folder-toggle]')","    qa('[data-exam-subdetails]')"),toggles);
button.onclick();assert.equal(open,true);assert.equal(rendered,1);assert.equal(toggles.examCatalogState.foldersOpen['folder-a'],true);
button.onclick();assert.equal(open,false);assert.equal(rendered,2);

// The final-sprint shortcut obeys the existing discipline/topic/board filter intersection.
const fields={'#questionDialogTitle':{},'#questionDialog':{showModal(){}}};
let shown=0;
const sprint={window:{},ALL_QUESTIONS:[original,other,foreign],filteredQuestionPool:()=>[original],ensureNativeQuestionBankLoaded(){},
 activeCampaignErrors:()=>[],normalizedOrigin:q=>q.origin,normalizedDifficulty:()=> 'medio',questionFingerprint:q=>q.id,
 prepareQuestion:q=>({...q}),q:s=>fields[s],showQuestion(){shown++;},toast(){throw new Error('Sprint válido não deveria falhar');},activeQuestions:null};
vm.createContext(sprint);vm.runInContext(section('  function questionSessionFilterContext(', '  function startFilteredBattle('),sprint);vm.runInContext(section('  function startCaveiraSprintSession(){','  window.startCaveiraSprintSession='),sprint);
sprint.startCaveiraSprintSession();assert.equal(shown,1);assert.deepEqual(Array.from(sprint.activeQuestions.questions,q=>q.id),['q1']);

// Starting the document's timed exam uses exactly its validated questions.
let generalCalls=0,opened=0;
const timed={activeSimulado:null,simuladoTimer:null,readSavedTimedSimulado:()=>null,ensureSimuladoUI(){},
 simuladoCandidatePool(){generalCalls++;return[other];},q:()=>null,
 isQuestionDisciplineEligible:q=>!q.needs_review,answerKeyStatus:q=>q.correct_index>=0?'oficial':'sem_gabarito',
 buildProportionalSimuladoQuestions:(pool,count)=>pool.slice(0,count),clearInterval(){},
 crypto:{randomUUID:()=> 'session-a'},currentTimedSimuladoScope:()=>({userId:'user-a',campaignId:'portal-a',resetEpoch:0}),
 showActiveTimedSimulado(){opened++;},toast(){throw new Error('Não deveria falhar');}};
vm.createContext(timed);vm.runInContext(section('  function startTimedSimulado(', '  function renderSimuladoQuestion(){'),timed);
timed.startTimedSimulado([original,{...legacy,correct_index:-1},{...foreign,needs_review:true}]);
assert.equal(generalCalls,0);assert.equal(opened,1);assert.deepEqual(Array.from(timed.activeSimulado.questions,q=>q.id),['q1']);
timed.startTimedSimulado({type:'click'});assert.equal(generalCalls,1,'Evento de botão continua usando a seleção normal');
console.log('OK r182: catálogo fechado sem montar cards, hidratação ao abrir, proveniência do documento e sprints/simulados respeitando a seleção.');

// A legitimate law textbook with a manual-* id is not platform help.
const manuals={window:{inferStrictQuestionSubject:()=> 'Direito Penal'},topicKey:key,subjectKey:key,
 canonicalSubjectName:value=>String(value??''),isInvalidTrailSubject:()=>false,
 strictSubjectMatch:(subject,target)=>target==='all'||key(subject)===key(target)};
vm.createContext(manuals);
vm.runInContext(section('  function isPlatformManualStudyArtifact(', '  function getActiveEditalSubjectsList('),manuals);
vm.runInContext(section('  function repairKnownExamTextArtifacts(', '  function buildSubjectAppropriateDistractors('),manuals);
const textbook={id:'manual-direito-penal',subject:'Direito Penal',title:'Manual de Direito Penal',subject_source:'manual',statement:'Sobre a tipicidade penal, assinale a alternativa correta.',options:['Primeira','Segunda']};
assert.equal(manuals.isPlatformManualStudyArtifact(textbook),false);
assert.equal(manuals.isQuestionDisciplineEligible(textbook,'Direito Penal'),true);
for(const id of ['manual-01-ciclo-estudos','manual-metodo','manual-ciclo'])assert.equal(manuals.isQuestionDisciplineEligible({...textbook,id},'all'),false,id);

// Formatting an imported item must not promote it to an official answer.
const writes=[];
const saved={window:{},state:{activeCampaignId:'portal-a'},ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],
 cloudSession:{user:{id:'user-a'}},activeCampaign:()=>({dbId:'portal-db'}),
 questionFingerprint:item=>item.id||item.statement,resolveStrictQuestionDiscipline:(_s,_t,subject)=>subject,
 normalizedDifficulty:()=> 'medio',normalizedOrigin:()=> 'oficial',canonicalSubjectName:value=>value,
 save(){},renderQuestionFilters(){},populateTopicFilter(){},updateQuestionPool(){},renderExamBankHub(){},
 cloudFetch:async(path,options)=>{writes.push({path,body:JSON.parse(options.body)});return {ok:true};}};
vm.createContext(saved);
vm.runInContext(section('  function answerKeyStatus(', '  function classifyQuestion('),saved);
vm.runInContext(section('  async function saveQuestionsToCampaign(', '  function buildLocalCognitiveTwinQuestion('),saved);
await saved.saveQuestionsToCampaign('Prova importada','Português',[{...original,origin:'importada'}, {...original,id:'pending',statement:'Questão ainda sem conferência',origin:'importada',key_source:'ia_sugerido',answer_key_validation:'pendente'}]);
const content=writes.find(write=>write.path==='generated_study_content').body[0].content.questions;
assert(content.every(item=>item.origin==='importada'));
const shared=writes.find(write=>write.path.startsWith('shared_question_bank')).body;
assert(shared.every(item=>item.origin==='adaptada_do_pdf'),'Tabela legada mantém opção permitida sem inventar oficialidade');
assert(shared[0].explanation.includes('fonte não verificada'));
assert.equal(saved.isUnreviewedAiAnswer(shared[1]),true,'Metadado de importação não esconde o aviso inicial da IA');
console.log('OK r182: materiais legítimos chamados Manual preservados e importação sem promoção automática de origem/gabarito.');
