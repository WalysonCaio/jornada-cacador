// Execute the actual client sync functions with in-memory network/storage only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const ledger=readFileSync(new URL('../dist/progress-ledger.js',import.meta.url),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);}
const code=ledger+block('function localDayKey(', 'function createProgressEventId(')+block('function progressValuesEqual(', 'function save(){')+
  block('function save(){','}let toastTimer')+'}\n'+block('function dayKeyOffset(', 'function markStudyActivity(')+
  block('function scheduleCloudSync(){','\n')+'\n'+block('function applyServerState(', 'function setGateMode(');
const clone=value=>JSON.parse(JSON.stringify(value));
function env(){
  const writes=[],statuses=[],messages=[],requests=[],timers=new Map();let nextTimer=0,quota=false;
  const now=Date.parse('2026-11-23T12:00:00Z');
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const ctx={Date:FixedDate,Intl,console:{warn(){}},KEY:'fixture',cloudSession:{user:{id:'owner-a'},access_token:'test'},syncReady:true,syncBusy:false,syncTimer:null,focusDeviceId:'device-a',timerRun:null,navigator:{onLine:true},
    localStorage:{setItem:(key,value)=>{if(quota)throw new Error('quota');writes.push({key,state:JSON.parse(value)});}},
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    setSyncStatus:(kind,text)=>statuses.push({kind,text}),toast:text=>messages.push(text),restoreFocusTimerState(){},
    validSession:async()=>ctx.cloudSession,authHeaders:token=>({Authorization:`Bearer ${token}`}),
    render:()=>ctx.refreshStreak(),cloudDocuments:[],cloudEssays:[],ALL_SUMMARIES:[],ALL_FLASHCARDS:[],ALL_QUESTIONS:[],LEARNING_SUBJECTS:[]
  };
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
  const baseline=()=>({_ownerUserId:'owner-a',_resetEpoch:1,_serverRevision:2,_dirty:false,activeCampaignId:'pmpe',done:{},dailySteps:{},dailyHistory:[],activityDays:{},studyByDay:{},streakDaysByHalfMission:{},manualStudyEntries:[],scores:[],topicMastery:{},streak:0,bestStreak:0,lastStudy:null,
    settings:{dailyMinutes:180,studyTimeZone:'America/Sao_Paulo'},learning:ctx.JCProgress.normalizeLearning({completed:{},xp:0})});
  ctx.state=baseline();
  let server=clone(ctx.state),revision=2;
  ctx.cloudFetch=async(path,options={})=>{
    requests.push({path,body:options.body?JSON.parse(options.body):null});
    if(path==='rpc/sync_user_state'){
      server=clone(JSON.parse(options.body).p_state);revision++;
      return {ok:true,json:async()=>({accepted:true,state:clone(server),revision,reset_epoch:server._resetEpoch,server_updated_at:'2026-11-23T12:00:00Z'})};
    }
    return {ok:true,json:async()=>[{state:clone(server),server_revision:revision,reset_epoch:server._resetEpoch}]};
  };
  return {ctx,writes,statuses,messages,requests,timers,baseline,set server(value){server=clone(value);},get server(){return server;},set quota(value){quota=value;},
    async runTimer(){assert.equal(timers.size,1);const [id,timer]=timers.entries().next().value;timers.delete(id);return await timer.fn();}};
}

// Login used to upload successfully while leaving syncReady=false forever.
{
  const e=env(),{ctx}=e;ctx.syncReady=false;ctx.state._dirty=true;
  assert.equal(await ctx.pullCloudState(),true);
  assert.equal(ctx.syncReady,true);assert.equal(ctx.state._dirty,false);
  assert.equal(e.requests[0].path,'rpc/sync_user_state','dirty same-owner state must upload before any read replacement');
  ctx.state.done.next='2026-11-23T12:00:00Z';ctx.save();
  assert.equal(ctx.state._dirty,true);assert.equal(e.timers.size,1,'next save after login still schedules an upload');
  assert.equal(await e.runTimer(),true);assert.equal(ctx.state._dirty,false);assert.equal(e.server.done.next,'2026-11-23T12:00:00Z');
}
// A render-time repair cannot be displayed as confirmed until the repaired data is uploaded.
{
  const e=env();e.server={...e.server,manualStudyEntries:[{id:'manual-1',date:'2026-11-23',minutes:30}]};
  assert.equal(await e.ctx.pullCloudState(),false);assert.equal(e.ctx.state.studyByDay['2026-11-23'],1800);
  assert.equal(e.ctx.state._dirty,true);assert(!e.statuses.some(row=>row.kind==='online'));
  assert.equal(e.timers.size,1);assert(e.writes.some(row=>row.state._dirty&&row.state.studyByDay['2026-11-23']===1800));
  assert.equal(await e.runTimer(),true);assert.equal(e.server.studyByDay['2026-11-23'],1800);
  assert.equal(e.ctx.state._dirty,false);assert.equal(e.statuses.at(-1).kind,'online');assert.equal(e.timers.size,0,'idempotent repair does not create a synchronization loop');
}
// Preparation must mark an already rendered ledger repair dirty before pull can replace it.
{
  const e=env();e.ctx.state.manualStudyEntries=[{id:'manual-2',date:'2026-11-23',minutes:50}];e.ctx.refreshStreak();
  assert.equal(e.ctx.state._studyLedgerRepairPending,true);assert.equal(e.ctx.state._dirty,false);
  assert.equal(await e.ctx.pullCloudState(),true);assert.equal(e.requests[0].path,'rpc/sync_user_state');
  assert.equal(e.server.studyByDay['2026-11-23'],3000);assert.equal(e.server.streak,1);assert.equal(e.ctx.state._studyLedgerRepairPending,undefined);
}
// HTTP failures preserve pending state; quota warnings are truthful and never escape as rejected promises.
{
  const e=env();e.ctx.state.learning={hearts:2,heartCooldownUntil:1234,...e.ctx.state.learning};e.ctx.state._dirty=true;
  assert.equal(await e.ctx.pushCloudState(),true,'server defaults/object key order must not create another pending repair');
  assert.equal(e.ctx.state._dirty,false);assert.equal(e.ctx.state.learning.hearts,2);assert.equal(e.timers.size,0);
  assert.equal(e.ctx.prepareProgressForSync(),false,'normalized contents compare by value rather than key order');
}
for(const method of ['pushCloudState','pullCloudState'])for(const quota of [false,true]){
  const e=env();e.quota=quota;if(method==='pushCloudState')e.ctx.state._dirty=true;
  e.ctx.cloudFetch=async()=>({ok:false,status:503,json:async()=>assert.fail('a non-2xx response is not a valid sync payload')});
  const before=clone(e.ctx.state);assert.equal(await e.ctx[method](),false);
  assert.equal(e.ctx.state._ownerUserId,before._ownerUserId);assert.equal(e.ctx.state.learning.xp,before.learning.xp);
  if(method==='pushCloudState')assert.equal(e.ctx.state._dirty,true);
  assert.equal(e.ctx.syncBusy,false);assert(!e.statuses.some(row=>row.kind==='online'));
  if(quota&&method==='pushCloudState'){assert(e.messages.some(text=>text.includes('Mantenha esta página aberta')));assert.match(e.statuses.at(-1).text,/memória/);}
}
// CAS conflict merges both devices' actual event histories and distinct attempts exactly once.
{
  const e=env(),{ctx}=e,meta={ownerId:'owner-a',campaignId:'pmpe',resetEpoch:1,at:'2026-11-23T12:00:00Z'};
  const base=ctx.JCProgress.normalizeLearning({xp:100,completed:{}});
  ctx.state.learning=ctx.JCProgress.awardLearning(base,20,'acerto_trilha','device-a:1',meta);ctx.state._dirty=true;
  ctx.state.scores=[{id:'topic',sessionId:'a',campaignId:'pmpe',total:5,correct:4,date:'2026-11-23T10:00:00Z'}];
  ctx.state.topicMastery={'pmpe|pt|crase':{attempts:5,correct:4,subjectKey:'pt',topicKey:'crase'}};
  const remote={...e.baseline(),learning:ctx.JCProgress.awardLearning(base,30,'dominio_topico','device-b:1',meta),scores:[{id:'topic',sessionId:'b',campaignId:'pmpe',total:5,correct:3,date:'2026-11-23T11:00:00Z'}],topicMastery:{'pmpe|pt|crase':{attempts:8,correct:6,subjectKey:'pt',topicKey:'crase'}}};
  const bodies=[];ctx.cloudFetch=async(_path,options)=>{const body=JSON.parse(options.body);bodies.push(body);return {ok:true,json:async()=>bodies.length===1?{accepted:false,state:clone(remote),revision:3,reset_epoch:1}:{accepted:true,state:clone(body.p_state),revision:4,reset_epoch:1}};};
  assert.equal(await ctx.pushCloudState(),true);assert.equal(bodies.length,2);
  assert.equal(ctx.state.learning.xp,150);assert.equal(Object.keys(ctx.state.learning.xpLedger.events).length,2);
  assert.equal(ctx.state.scores.length,2);assert.equal(ctx.state.topicMastery['pmpe|pt|crase'].attempts,8);
  assert.equal(ctx.state._serverRevision,4);assert.equal(ctx.state._dirty,false);
}
// Account B cannot trigger preparation/persistence of A while login is switching contexts.
{
  const e=env(),local=e.baseline(),remote=e.baseline();
  local.settings.studyTimeZone='America/Sao_Paulo';remote.settings.studyTimeZone='America/Los_Angeles';
  const merged=e.ctx.mergeProgressStates(remote,local);
  assert.equal(merged.settings.studyTimeZone,remote.settings.studyTimeZone,'an old device default cannot replace the account timezone received during CAS conflict');
}
// Account B cannot trigger preparation/persistence of A while login is switching contexts.
{
  const e=env(),{ctx}=e;ctx.state.learning=ctx.JCProgress.awardLearning(ctx.state.learning,25,'acerto_questao','old-reset:attempt',{ownerId:'owner-a',campaignId:'pmpe',resetEpoch:1,at:'2026-11-23T12:00:00Z'});ctx.state._dirty=true;
  const reset={...e.baseline(),_resetEpoch:2,done:{},scores:[]};
  ctx.cloudFetch=async()=>({ok:true,json:async()=>({accepted:false,reason:'STALE_RESET',state:reset,revision:5,reset_epoch:2})});
  assert.equal(await ctx.pushCloudState(),true);assert.equal(ctx.state._resetEpoch,2);assert.equal(ctx.state.learning.xp,0);
  assert.equal(Object.keys(ctx.state.learning.xpLedger.events).length,0,'an authoritative reset cannot resurrect events from the old generation');
}
{
  const e=env();e.ctx.cloudSession={user:{id:'owner-b'}};e.ctx.state.manualStudyEntries=[{date:'2026-11-23',minutes:50}];
  const before=JSON.stringify(e.ctx.state);assert.equal(e.ctx.prepareProgressForSync(),false);
  assert.equal(JSON.stringify(e.ctx.state),before);assert.equal(e.writes.length,0);
}
console.log('OK r186 sync: login mantém agendamento, reparos aguardam confirmação, HTTP/quota honestos, CAS preserva XP/sessões/maestria, troca de conta não repara estado alheio.');
