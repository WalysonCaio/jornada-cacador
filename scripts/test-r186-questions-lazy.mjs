import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workspaceCode=fs.readFileSync(new URL('../dist/questions-workspace.js',import.meta.url),'utf8');
const v77=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const box={window:{}};vm.createContext(box);vm.runInContext(workspaceCode,box);
const {createController}=box.window.JCQuestionsWorkspace;
function section(start,end){const a=v77.indexOf(start),b=v77.indexOf(end,a);assert(a>=0&&b>a,`Bloco ausente: ${start}`);return v77.slice(a,b)}

// Capture the production panel callbacks, rather than a parallel implementation
// of what each sub-tab ought to do. Simulate the large real-world collections.
const counts={filters:0,simulator:0,guild:0,catalog:0,charts:0,errorCards:0,topics:0};
const tasks=[],selected=[],ready=[];
let visible=true,configured,controller;
const ctx={
  window:{JCQuestionsWorkspace:{configure(settings){configured=settings},request(panel){controller.request(panel)}}},
  state:{activeCampaignId:'pmpe',_ownerUserId:'account-a',_resetEpoch:0},
  ALL_QUESTIONS:Array.from({length:2558},(_,i)=>({statement:`Questão ${i}`})),cloudDocuments:[],
  cloudSession:{user:{id:'account-a'}},
  activeCampaign:()=>({dbId:'db-pmpe'}),
  q:()=>({classList:{contains:()=>visible}}),
  renderReport(){counts.errorCards+=81},
  offerSavedTimedSimuladoResume(){},
  renderQuestionFilters(){counts.filters++},
  ensureSimuladoUI(){counts.simulator++},updateSimuladoAvailability(){},
  renderGuildOfficialSimuladoBanner(){counts.guild++},
  enhanceSoloLevelingVisuals(){},
  ensureExamBankHub(){},populateExamHubSelects(){counts.topics++},
  renderExamBankHub(){counts.catalog+=182},
  renderPerformanceChart(){counts.charts++}
};
vm.createContext(ctx);
vm.runInContext(section('  function scheduleQuestionReportExtras(){','  window.renderNotifications='),ctx);
controller=createController({...configured,afterPaint:fn=>tasks.push(fn),onSelect:(panel,busy)=>selected.push([panel,busy]),onReady:panel=>ready.push(panel),onError(_panel,error){throw error}});
const run=()=>tasks.splice(0).forEach(fn=>fn());
ctx.renderReport();
assert.equal(counts.filters,0,'Navegação mostra o painel antes de calcular filtros.');
assert.deepEqual(selected.at(-1),['resolver',true]);
run();
assert.deepEqual(counts,{filters:1,simulator:0,guild:0,catalog:0,charts:0,errorCards:0,topics:0},'Resolver não monta os 182 PDFs, os 81 erros ou os gráficos.');
ctx.renderReport();run();assert.equal(counts.filters,1,'Reabrir um painel válido reutiliza o trabalho.');
controller.request('simulados');assert.equal(counts.simulator,0);run();
assert.equal(counts.simulator,1);assert.equal(counts.guild,1);assert.equal(counts.catalog,0);assert.equal(counts.errorCards,0);
controller.request('provas');run();assert.equal(counts.catalog,182);assert.equal(counts.charts,0);
controller.request('desempenho');run();assert.equal(counts.errorCards,81);assert.equal(counts.charts,1);assert.equal(counts.catalog,182);

// Selecting a different panel before the queued frame cancels the first job.
controller.invalidate();controller.request('provas');controller.request('simulados');run();
assert.equal(counts.catalog,182);assert.equal(counts.simulator,2);
for(const change of [
  ()=>{ctx.state.activeCampaignId='pcpe'},
  ()=>{ctx.cloudSession.user.id='account-b';ctx.state._ownerUserId='account-b'},
  ()=>{ctx.state._resetEpoch++},
  ()=>{ctx.activeCampaign=()=>({dbId:'new-db'})}
]){
  controller.invalidate();controller.request('provas');const before=counts.catalog;change();run();
  assert.equal(counts.catalog,before,'Trabalho enfileirado deve ser descartado após trocar conta, portal, reset ou dbId.');
  controller.request();run();assert.equal(controller.active,'resolver','Novo contexto começa pelo treino.');
}
controller.invalidate();controller.request('desempenho');visible=false;const chartBefore=counts.charts;run();assert.equal(counts.charts,chartBefore);
visible=true;controller.request('provas');controller.invalidate();const catalogBefore=counts.catalog;run();assert.equal(counts.catalog,catalogBefore,'Dados invalidados cancelam o frame antigo.');
controller.request('provas');run();assert.equal(counts.catalog,catalogBefore+182);
assert(ready.includes('resolver')&&ready.includes('simulados')&&ready.includes('provas')&&ready.includes('desempenho'));

// Generic focus/hero saves cannot invalidate the question bank or filter UI.
// A scored answer, favorite, edited source or explicit report mark still can.
controller.request('resolver');run();
const beforeTimer={filters:counts.filters,revision:controller.revision};
ctx.state.studyByDay={};ctx.state.learning={xp:0};
for(let tick=1;tick<=12;tick++){
  ctx.state.studyByDay['2026-11-23']=tick*10;ctx.state.learning.xp=tick;
  controller.invalidateProgress();controller.request();run();
}
assert.equal(controller.revision,beforeTimer.revision,'Doze ticks de foco/hero mantêm a revisão dos dados de questões.');
assert.equal(counts.filters,beforeTimer.filters,'Salvar o cronômetro não refaz filtros.');
ctx.state.questionStatsByCampaign={[ctx.state.activeCampaignId]:{total:1,correct:1}};
controller.invalidateProgress();controller.request();run();assert.equal(counts.filters,beforeTimer.filters+1,'Uma resposta atualiza filtros por histórico.');
ctx.state.favoriteQuestions={fp:{subject:'Português'}};controller.invalidateProgress();controller.request();run();
assert.equal(counts.filters,beforeTimer.filters+2,'Favoritos alteram o banco elegível.');

// Repairs saved during the first render invalidate once and still release the
// loading state after the new revision, without publishing an old result.
const repairTasks=[],repairReady=[];let passes=0,repair;
repair=createController({readScope:()=>['a','pmpe',0],isVisible:()=>true,afterPaint:fn=>repairTasks.push(fn),renderers:{resolver(){if(++passes===1)repair.invalidate()}},onReady:id=>repairReady.push(id)});
repair.request();repairTasks.splice(0).forEach(fn=>fn());assert.equal(repairReady.length,0);
repairTasks.splice(0).forEach(fn=>fn());assert.equal(passes,2);assert.deepEqual(repairReady,['resolver']);

// Boot and primary navigation cannot bypass the panel scheduler.
const bind=section('  function bindQuestionCenter(){','  const baseRenderQuestionFilters=');
assert(!/ensureSimuladoUI\(|renderExamBankHub\(|populateTopicFilter\(\);\s*updateQuestionPool\(\);/.test(bind),'Boot somente vincula controles, sem montar os painéis.');
assert(index.includes("else if(id==='report'){renderReport()}"));
let quickBuilds=0;
const initializeFilters={q:()=>({}),ensureNativeQuestionBankLoaded(){},ensureLazyQuickPractice(){},renderQuickBoaRespostaBar(){quickBuilds++}};
vm.createContext(initializeFilters);vm.runInContext(section('  function ensureTopicFilterSelect(){','  function ensureLazyQuickPractice(){'),initializeFilters);
initializeFilters.ensureTopicFilterSelect();assert.equal(quickBuilds,0,'Inicializar filtros não monta os treinos rápidos.');

// Real filteredQuestionPool reuses discipline/topic work only for the same data
// revision and filter selection. Editing and a new scope must recompute it.
let eligibility=0,revision=0;
const fields={questionSubject:'Língua Portuguesa',questionBoardFilter:'all',questionTopic:'all',questionDifficulty:'all',questionOrigin:'all',questionBattleMode:'balanced',questionHistoryFilter:'all'};
const poolContext={
  window:{JCQuestionsWorkspace:{get revision(){return revision},scopeKey:()=>ctx.state.activeCampaignId}},
  state:ctx.state,ALL_QUESTIONS:Array.from({length:2558},(_,i)=>({subject:'Língua Portuguesa',statement:`Pergunta ${i}`,difficulty:'medio',learning_order:0})),
  q:selector=>selector==='#followEditalOrderToggle'?{checked:false}:{value:fields[selector.slice(1)]||'all',selectedIndex:0,options:[{text:'Todos'}]},
  ensureNativeQuestionBankLoaded(){},sanitizeAllQuestionsAndErrorsSubjects(){},
  isQuestionDisciplineEligible(item,subject){eligibility++;return subject==='all'||item.subject===subject},questionMatchesBoardFilter:()=>true,
  answerKeyStatus:()=> 'oficial',normalizedDifficulty:item=>item.difficulty,normalizedOrigin:()=> 'oficial'
};
vm.createContext(poolContext);vm.runInContext(section('  let questionFilterPoolCache=', '  function updateQuestionPool(){'),poolContext);
assert.equal(poolContext.filteredQuestionPool().length,2558);const checked=eligibility;
poolContext.filteredQuestionPool();assert.equal(eligibility,checked,'Reabrir não reclassifica as 2558 questões.');
revision++;poolContext.filteredQuestionPool();assert(eligibility>checked);const edited=eligibility;
fields.questionSubject='Direito Constitucional';assert.equal(poolContext.filteredQuestionPool().length,0);assert(eligibility>edited);
console.log('r186: quatro painéis sob demanda, paint, escopo e caches validados.');
