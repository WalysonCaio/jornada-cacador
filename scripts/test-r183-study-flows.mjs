import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const modules=readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
function classes(){const values=new Set();return{add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){on?values.add(v):values.delete(v);}};}
function node(){return{style:{},dataset:{},classList:classes(),textContent:'',innerHTML:'',hidden:false,open:false,showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
const copy=value=>JSON.parse(JSON.stringify(value));
const PERIOD=20*60*1000;

function trailEnv(hearts=3){
  const nodes={},messages=[],records=[],renders=[];let saves=0,now=100*PERIOD;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const question={subject:'Português',statement:'Qual alternativa corresponde à regra?',options:['Primeira','Segunda'],correct_index:1};
  const ctx={Date:Clock,console,state:{_ownerUserId:'a',activeCampaignId:'p',_resetEpoch:0,learning:{hearts,xp:0,completed:{}},scores:[]},cloudSession:{user:{id:'a'}},activeLesson:null,selectedLearningSubject:'Português',
    $:id=>nodes[id]||(nodes[id]=node()),$$:selector=>selector==='[data-option-index]'?[0,1].map(index=>{const el=nodes['option'+index]||(nodes['option'+index]=node());el.dataset.optionIndex=String(index);return el;}):[],
    toast:text=>messages.push(String(text)),save(){saves++;},esc:String,
    learningUnits:()=>[{key:'p-portugues-0',cards:[copy(question),copy(question)],questions:[copy(question),copy(question)]}],
    balancedQuestions:items=>items,prepareQuestion:item=>item,
    gradeAnswer:(q,index)=>q.pending?{scored:false}:{scored:true,ok:index===q.correct_index},
    recordQuestionResult:(q,ok,chosen)=>records.push({q,ok,chosen}),
    renderHero:()=>renders.push('hero'),renderLearning(){},renderReport(){},renderErrorNotebook(){},
    missionPool:()=>[{id:'portugues',subject:'Português'}],normalizeText:value=>String(value).toLowerCase()
  };
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../dist/progress-ledger.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(section(html,'function createProgressEventId(', 'function prepareProgressForSync('),ctx);
  vm.runInContext(section(html,'const TRAIL_HEART_REGEN_MS =','function renderCampaigns()'),ctx);
  return{ctx,nodes,messages,records,renders,question,get saves(){return saves;},get now(){return now;},set now(value){now=value;}};
}

// Uma vida a cada vinte minutos, inclusive com uma ou duas restantes. Consultar/reabrir não adia o prazo.
for(const initial of [0,1,2]){
  const env=trailEnv(initial),{ctx}=env;
  assert.equal(ctx.availableTrailHearts(),initial);
  const deadline=ctx.state.learning.heartCooldownUntil;
  env.now+=PERIOD-1;assert.equal(ctx.availableTrailHearts(),initial);
  assert.equal(ctx.state.learning.heartCooldownUntil,deadline);
  assert.equal(ctx.restoreTrailHeartsNow(),initial,'atalho antigo não concede três vidas grátis');
  env.now++;assert.equal(ctx.availableTrailHearts(),initial+1);
  if(initial+1<3)assert.equal(ctx.state.learning.heartCooldownUntil,deadline+PERIOD);
  else assert.equal(ctx.state.learning.heartCooldownUntil,null);
  env.now+=4*PERIOD;assert.equal(ctx.availableTrailHearts(),3);
  assert.equal(ctx.state.learning.heartCooldownUntil,null);
}
{
  const env=trailEnv(0),{ctx}=env;
  ctx.state.learning.heartCooldownUntil=env.now-PERIOD;
  assert.equal(ctx.availableTrailHearts(),2,'reabrir recupera as duas vidas que já venceram');
  assert.equal(ctx.state.learning.heartCooldownUntil,env.now+PERIOD);
}
{
  const {ctx,nodes,messages}=trailEnv(0);
  ctx.startLesson(0);assert.equal(ctx.activeLesson,null);
  assert(!nodes['#lessonDialog']?.open);assert(messages.some(text=>text.includes('Próxima vida')));
}
// Gabarito pendente não consome vida, não avança a fase e não soma XP ou resultado.
{
  const env=trailEnv(),{ctx,records}=env;ctx.startLesson(0);
  ctx.activeLesson.questions[0].pending=true;
  const q=ctx.activeLesson.questions[0],before=env.saves;
  ctx.answerLesson(ctx.$$('[data-option-index]')[0],q);
  assert.equal(ctx.activeLesson.answered,false);assert.equal(ctx.activeLesson.answeredCount,0);
  assert.equal(ctx.state.learning.hearts,3);assert.equal(ctx.state.learning.xp,0);assert.equal(records.length,0);assert.equal(env.saves,before);
  ctx.nextLesson();assert.equal(ctx.activeLesson.current,0);
  ctx.finishLesson();assert.equal(ctx.state.scores.length,0);
}
// Falhar com uma vida registra só a questão respondida; finalizar duas vezes não duplica estatística.
{
  const env=trailEnv(1),{ctx,records}=env;ctx.startLesson(0);
  ctx.answerLesson(ctx.$$('[data-option-index]')[0],ctx.activeLesson.questions[0]);
  assert.equal(records.length,1);assert.equal(ctx.state.learning.hearts,0);
  ctx.answerLesson(ctx.$$('[data-option-index]')[0],ctx.activeLesson.questions[0]);assert.equal(records.length,1);
  ctx.nextLesson();assert.equal(ctx.state.scores.length,1);
  assert.equal(ctx.state.scores[0].total,1);assert.equal(ctx.state.scores[0].correct,0);
  assert.equal(ctx.state.scores[0].userId,'a');assert.equal(ctx.state.scores[0].campaignId,'p');
  assert.equal(Object.keys(ctx.state.learning.completed).length,0);
  assert.equal(ctx.finishLesson(),false);assert.equal(ctx.state.scores.length,1);
}
// Acertos completos concedem XP uma vez; reestudar não concede outro bônus de primeira conclusão.
{
  const {ctx}=trailEnv();
  for(let round=0;round<2;round++){
    ctx.startLesson(0);ctx.answerLesson(ctx.$$('[data-option-index]')[1],ctx.activeLesson.questions[0]);
    ctx.nextLesson();ctx.answerLesson(ctx.$$('[data-option-index]')[1],ctx.activeLesson.questions[1]);ctx.nextLesson();
    assert.equal(ctx.state.learning.completed['p-portugues-0'].score,100);
  }
  assert.equal(ctx.state.learning.xp,180);assert.equal(ctx.state.scores.length,2);
}
// Callback de uma lição antiga não grava XP, resultado nem vidas na conta/portal/redefinição atual.
for(const change of ['account','portal','reset','logout']){
  const {ctx,records}=trailEnv();ctx.startLesson(0);const old=ctx.activeLesson,q=old.questions[0];
  if(change==='account'){ctx.cloudSession={user:{id:'b'}};ctx.state._ownerUserId='b';}
  if(change==='portal')ctx.state.activeCampaignId='other';
  if(change==='reset')ctx.state._resetEpoch=1;
  if(change==='logout')ctx.cloudSession=null;
  ctx.answerLesson(ctx.$$('[data-option-index]')[1],q);ctx.nextLesson();ctx.finishLesson();
  assert.equal(records.length,0,change);assert.equal(ctx.state.learning.xp,0);assert.equal(ctx.state.scores.length,0);
  ctx.availableTrailHearts();assert.equal(ctx.activeLesson,null,change);
}

function assistantEnv(){
  const nodes={},messages=[],fetches=[];let saves=0,renders=0;
  for(const id of ['#aiQuestion','#aiContext','#aiMode','#sendAI','#aiLoading'])nodes[id]=node();
  nodes['#aiQuestion'].value='Explique a crase';nodes['#aiContext'].value='';nodes['#aiMode'].value='explain';
  const ctx={console,AbortController,state:{_ownerUserId:'a',activeCampaignId:'p',_resetEpoch:0,aiHistory:[]},cloudSession:{user:{id:'a'},access_token:'a'},navigator:{onLine:true},cloudDocuments:[],SUPABASE_URL:'https://fixture.test',
    $:id=>nodes[id],toast:value=>messages.push(String(value)),save(){saves++;},renderAssistant(){ctx.cancelAssistantOperationForScope();renders++;},
    activeCampaign:()=>({dbId:ctx.campaignDbId??'db-'+ctx.state.activeCampaignId,name:'Portal'}),assistantLibraryContext:()=>'',validSession:async()=>ctx.cloudSession,
    authHeaders:token=>({Authorization:'Bearer '+token}),setTimeout:()=>1,clearTimeout(){},
    classifyAssistantErrorMessage:error=>String(error?.message||'Falha'),
    fetch:async(url,options)=>{fetches.push({url,options,body:JSON.parse(options.body)});return{ok:true,status:200,json:async()=>({answer:'Resposta explicada.',provider:'gemini'})};}
  };
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(section(html,'function cancelAssistantOperationForScope(){','function render(){'),ctx);
  return{ctx,nodes,messages,fetches,get saves(){return saves;},get renders(){return renders;}};
}
{
  const env=assistantEnv(),{ctx,nodes,fetches}=env;
  assert.equal(await ctx.sendAssistant(),true);assert.equal(fetches.length,1);
  assert.equal(ctx.state.aiHistory[0].userId,'a');assert.equal(ctx.state.aiHistory[0].campaignId,'p');
  assert.equal(env.saves,1);assert.equal(nodes['#sendAI'].disabled,false);
}
// Nenhuma resposta tardia vaza para a conta/portal atual, seja na renovação, no HTTP ou no JSON.
for(const change of ['account','portal','reset','logout','dbid'])for(const phase of ['session','fetch','json']){
  const env=assistantEnv(),{ctx,nodes,messages}=env,late=deferred();
  if(phase==='session')ctx.validSession=()=>late.promise;
  if(phase==='fetch')ctx.fetch=()=>late.promise;
  if(phase==='json')ctx.fetch=async()=>({ok:true,status:200,json:()=>late.promise});
  const pending=ctx.sendAssistant();await tick();const operation=ctx.sendAssistant._operation;
  assert.equal(nodes['#sendAI'].disabled,true);
  if(change==='account'){ctx.cloudSession={user:{id:'b'},access_token:'b'};ctx.state._ownerUserId='b';}
  if(change==='portal')ctx.state.activeCampaignId='other';
  if(change==='reset')ctx.state._resetEpoch=1;
  if(change==='logout')ctx.cloudSession=null;
  if(change==='dbid')ctx.campaignDbId='hydrated-db-p';
  ctx.cancelAssistantOperationForScope();assert.equal(operation.controller.signal.aborted,true);
  assert.equal(nodes['#sendAI'].disabled,false);
  late.resolve(phase==='session'?{user:{id:'a'},access_token:'a'}:phase==='fetch'?{ok:true,status:200,json:async()=>({answer:'Texto antigo'})}:{answer:'Texto antigo'});
  assert.equal(await pending,false,change+'/'+phase);
  assert.equal(ctx.state.aiHistory.length,0);assert.equal(env.saves,0);assert.equal(messages.length,0);
}
// Mesmo sem render intermediário, descartar uma resposta fora do escopo libera o botão da própria chamada.
for(const change of ['account','portal','reset','logout','dbid']){
  const env=assistantEnv(),{ctx,nodes}=env,late=deferred();ctx.fetch=()=>late.promise;
  const pending=ctx.sendAssistant();await tick();
  if(change==='account'){ctx.cloudSession={user:{id:'b'},access_token:'b'};ctx.state._ownerUserId='b';}
  if(change==='portal')ctx.state.activeCampaignId='other';
  if(change==='reset')ctx.state._resetEpoch=1;
  if(change==='logout')ctx.cloudSession=null;
  if(change==='dbid')ctx.campaignDbId='hydrated-db-p';
  late.resolve({ok:true,status:200,json:async()=>({answer:'Texto antigo'})});
  assert.equal(await pending,false,change);assert.equal(nodes['#sendAI'].disabled,false,change);
  assert.equal(nodes['#aiLoading'].classList.contains('show'),false);assert.equal(ctx.state.aiHistory.length,0);assert.equal(env.saves,0);
}
// Uma nova pergunta digitada durante o envio é preservada e cliques duplicados usam uma só chamada.
{
  const {ctx,nodes,fetches}=assistantEnv(),late=deferred();
  ctx.fetch=async(url,options)=>{fetches.push({url,options});return late.promise;};
  const pending=ctx.sendAssistant();await tick();await ctx.sendAssistant();assert.equal(fetches.length,1);
  nodes['#aiQuestion'].value='Outra dúvida para depois';
  late.resolve({ok:true,status:200,json:async()=>({answer:'Primeira resposta'})});
  assert.equal(await pending,true);assert.equal(nodes['#aiQuestion'].value,'Outra dúvida para depois');
}
// Concluir a chamada antiga não destrava nem substitui a consulta que a nova conta iniciou.
{
  const {ctx,nodes}=assistantEnv(),old=deferred(),next=deferred(),requests=[];
  ctx.fetch=async(_url,options)=>{requests.push(options);return requests.length===1?old.promise:next.promise;};
  const first=ctx.sendAssistant();await tick();
  ctx.cloudSession={user:{id:'b'},access_token:'b'};ctx.state._ownerUserId='b';
  nodes['#aiQuestion'].value='Pergunta da conta nova';
  const second=ctx.sendAssistant();await tick();assert.equal(requests.length,2);
  assert.equal(requests[0].headers.Authorization,'Bearer a');assert.equal(requests[1].headers.Authorization,'Bearer b');
  old.resolve({ok:true,status:200,json:async()=>({answer:'Texto da conta antiga'})});
  assert.equal(await first,false);assert.equal(nodes['#sendAI'].disabled,true);assert.equal(ctx.state.aiHistory.length,0);
  next.resolve({ok:true,status:200,json:async()=>({answer:'Texto da conta nova'})});
  assert.equal(await second,true);assert.equal(nodes['#sendAI'].disabled,false);
  assert.equal(ctx.state.aiHistory.length,1);assert.equal(ctx.state.aiHistory[0].userId,'b');assert.equal(ctx.state.aiHistory[0].answer,'Texto da conta nova');
}
// A troca de abas ativa exatamente um painel e atualiza as fontes do Caderno IA ao abrir.
{
  const names=['summaries','cards','notebook','smart','laws'];
  const tabs=names.map(name=>({getAttribute:()=>name,classList:classes()}));
  const panels=names.map(id=>({id,classList:classes()}));let smart=0,canvas=0,laws=0;
  const sectionNode={querySelectorAll:selector=>selector==='.studyTab'?tabs:panels};
  const ctx={document:{getElementById:id=>id==='study'?sectionNode:panels.find(p=>p.id===id)},setupCanvasNotebook(){canvas++;},renderSmartNotebookPanel(){smart++;},renderSmartLawsPanelContent(){laws++;}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(section(modules,'  function switchStudySubtab(', '  function mountCaveiraSmartLawsHub('),ctx);
  for(const name of names){ctx.switchStudySubtab(name);assert.equal(tabs.filter(t=>t.classList.contains('active')).length,1);assert.equal(panels.filter(p=>p.classList.contains('active')).length,1);assert(panels.find(p=>p.id===name).classList.contains('active'));}
  assert.equal(canvas,1);assert.equal(laws,1);assert.equal(smart,1);
}
console.log('OK r183: vidas graduais sem atalho gratuito; lições e Invocador preservam pontuação/escopo; abas atualizam o painel escolhido.');
