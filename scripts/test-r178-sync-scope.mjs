import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const v59=readFileSync(new URL('../dist/v59-enhancements.js',import.meta.url),'utf8');
const block=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a);assert(a>=0&&b>a,start);return src.slice(a,b)};
const syncCode=block(html,'async function pushCloudState(){','async function performGateAuth(');
const validCode=block(html,'async function validSession(){','function updateAccountUI(');
const mergeCode=block(html,'function mergeProgressStates(','async function pushCloudState(){');
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const session=id=>({user:{id},access_token:`token-${id}`,refresh_token:`refresh-${id}`,expires_at:Date.now()/1000+3600});
const initialState=id=>({_ownerUserId:id,_resetEpoch:1,_serverRevision:2,_dirty:false,activeCampaignId:'portal-a',done:{},publicProfile:{bio:'initial'}});
function setup(){
 const writes=[],status=[],toasts=[],applied=[];
 const ctx={state:initialState('a'),cloudSession:session('a'),syncBusy:false,syncReady:true,navigator:{onLine:true},KEY:'state',focusDeviceId:'device',
  console:{warn(){}},localDayKey:()=> '2026-11-14',validSession:async()=>ctx.cloudSession,
  authHeaders:token=>({Authorization:`Bearer ${token}`}),
  localStorage:{setItem:(key,value)=>writes.push([key,value])},setSyncStatus:(...args)=>status.push(args),toast:text=>toasts.push(text),
  scheduleCloudSync:()=>ctx.scheduled++,scheduled:0,
  applyServerState:(remote,revision,epoch)=>{applied.push(remote);ctx.state={...remote,_serverRevision:revision,_resetEpoch:epoch||remote._resetEpoch||0,_dirty:false}},
  cloudDocuments:[],cloudEssays:[],ALL_SUMMARIES:[],ALL_FLASHCARDS:[],ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],
 };
 vm.createContext(ctx);vm.runInContext(mergeCode+syncCode,ctx);
 return {ctx,writes,status,toasts,applied};
}
const accepted=ctx=>({accepted:true,state:{...JSON.parse(JSON.stringify(ctx.state)),publicProfile:{bio:'server'}},revision:3,reset_epoch:1});
// Old uploads/reads must not mutate a new account or a reset made during either awaited stage.
for(const operation of ['pushCloudState','pullCloudState'])for(const stage of ['fetch','json'])for(const change of ['account','reset']){
 const h=setup(),{ctx}=h,pending=deferred();
 ctx.cloudFetch=async()=>stage==='fetch'?pending.promise:{json:()=>pending.promise};
 const task=ctx[operation]();await tick();
 const result=operation==='pushCloudState'?accepted(ctx):[{state:{...ctx.state},server_revision:3,reset_epoch:1}];
 if(change==='account'){ctx.cloudSession=session('b');ctx.state=initialState('b')}else ctx.state._resetEpoch=2;
 const expected=JSON.stringify(ctx.state),writes=h.writes.length,status=h.status.length;
 pending.resolve(stage==='fetch'?{json:async()=>result}:result);
 assert.equal(await task,false,`${operation}/${stage}/${change}`);
 assert.equal(JSON.stringify(ctx.state),expected,'late response changed current state');
 assert.equal(h.writes.length,writes);assert.equal(h.status.length,status);assert.equal(h.applied.length,0);assert.equal(h.toasts.length,0);assert.equal(ctx.syncBusy,false);
}
for(const operation of ['pushCloudState','pullCloudState']){
 const h=setup(),pending=deferred();h.ctx.cloudFetch=()=>pending.promise;
 const task=h.ctx[operation]();await tick();h.ctx.cloudSession=session('b');h.ctx.state=initialState('b');
 const expected=JSON.stringify(h.ctx.state);pending.reject(new Error('old network error'));
 assert.equal(await task,false);assert.equal(JSON.stringify(h.ctx.state),expected);assert.equal(h.writes.length,0);
}
// A new account may start a read while A's upload is pending; A cannot release B's lock.
{
 const h=setup(),pendingA=deferred(),pendingB=deferred();
 h.ctx.cloudFetch=async path=>({json:()=>path==='rpc/sync_user_state'?pendingA.promise:pendingB.promise});
 const taskA=h.ctx.pushCloudState();await tick();h.ctx.cloudSession=session('b');
 const taskB=h.ctx.pullCloudState();await tick();
 assert.equal(h.ctx.state._ownerUserId,'b','a busy old account cannot prevent clearing its local data');
 pendingA.resolve({accepted:true,state:initialState('a'),revision:3,reset_epoch:1});
 assert.equal(await taskA,false);assert.equal(h.ctx.syncBusy,true,'old finally cannot unlock the current request');
 pendingB.resolve([{state:initialState('b'),server_revision:4,reset_epoch:1}]);
 assert.equal(await taskB,true);assert.equal(h.ctx.state._ownerUserId,'b');assert.equal(h.ctx.syncBusy,false);
}
// Token renewal for the same account is allowed, and an accepted response has an explicit success result.
{
 const h=setup();h.ctx.cloudFetch=async(_path,options)=>{assert.equal(options.headers.Authorization,'Bearer token-a');h.ctx.cloudSession={...h.ctx.cloudSession,access_token:'renewed-a'};return {json:async()=>accepted(h.ctx)}};
 assert.equal(await h.ctx.pushCloudState(),true);assert.equal(h.ctx.state._dirty,false);assert.equal(h.ctx.state._serverRevision,3);assert.equal(h.applied.length,1);
}
// Edits made during upload/read survive; they remain dirty until a subsequent upload is confirmed.
for(const operation of ['pushCloudState','pullCloudState']){
 const h=setup(),pending=deferred(),remote=JSON.parse(JSON.stringify(h.ctx.state));
 h.ctx.cloudFetch=async()=>({json:()=>pending.promise});const task=h.ctx[operation]();await tick();
 h.ctx.state.done['new-answer']='2026-11-14';h.ctx.state.publicProfile.bio='edited while syncing';h.ctx.state._dirty=true;
 pending.resolve(operation==='pushCloudState'?{accepted:true,state:remote,revision:3,reset_epoch:1}:[{state:remote,server_revision:3,reset_epoch:1}]);
 assert.equal(await task,false);assert.equal(h.ctx.state.done['new-answer'],'2026-11-14');assert.equal(h.ctx.state.publicProfile.bio,'edited while syncing');assert.equal(h.ctx.state._dirty,true);assert.equal(h.ctx.scheduled,1);assert.equal(h.applied.length,0);
}
// A remote reset remains authoritative; an unchanged ordinary read is applied once.
for(const reset of [1,2]){
 const h=setup(),remote={...h.ctx.state,_resetEpoch:reset,done:{}};
 h.ctx.cloudFetch=async()=>({json:async()=>[{state:remote,server_revision:3,reset_epoch:reset}]});
 assert.equal(await h.ctx.pullCloudState(),true);assert.equal(h.applied.length,1);assert.equal(h.ctx.state._resetEpoch,reset);
}
// Logging into another account creates a clean local state before data from that account is applied.
{
 const h=setup();h.ctx.cloudSession=session('b');h.ctx.cloudFetch=async()=>({json:async()=>[{state:initialState('b'),server_revision:4,reset_epoch:1}]});
 assert.equal(await h.ctx.pullCloudState(),true);assert.equal(h.ctx.state._ownerUserId,'b');assert.equal(h.ctx.state._serverRevision,4);
}
// Offline/concurrent uploads and malformed confirmations cannot claim synchronization.
{
 const h=setup();h.ctx.navigator.onLine=false;assert.equal(await h.ctx.pushCloudState(),false);
 h.ctx.navigator.onLine=true;h.ctx.syncBusy=true;assert.equal(await h.ctx.pushCloudState(),false);
 h.ctx.syncBusy=false;h.ctx.cloudFetch=async()=>({json:async()=>({accepted:true,revision:3})});assert.equal(await h.ctx.pushCloudState(),false);assert.equal(h.applied.length,0);assert.equal(h.ctx.state._dirty,true);
}
// The renewal itself must not resurrect account A after login/logout B, including failures.
for(const failure of [false,true])for(const replacement of ['b','logout']){
 const pending=deferred(),saved=[],ctx={cloudSession:{...session('a'),expires_at:0},authRequest:()=>pending.promise,saveSession:s=>{saved.push(s);ctx.cloudSession=s}};
 vm.createContext(ctx);vm.runInContext(validCode,ctx);const task=ctx.validSession();await tick();ctx.cloudSession=replacement==='b'?session('b'):null;
 if(failure)pending.reject(new Error('expired'));else pending.resolve(session('a'));
 assert.equal(await task,null);assert.equal(ctx.cloudSession?.user?.id,replacement==='b'?'b':undefined);assert.equal(saved.length,0);
}
{
 const pending=deferred(),ctx={cloudSession:{...session('a'),expires_at:0},authRequest:()=>pending.promise,saveSession:s=>ctx.cloudSession=s};
 vm.createContext(ctx);vm.runInContext(validCode,ctx);const task=ctx.validSession();pending.resolve({...session('a'),access_token:'renewed-a'});assert.equal((await task).access_token,'renewed-a');assert.equal(ctx.cloudSession.access_token,'renewed-a');
}
const loaders=[
 ['campaigns',block(html,'async function reconcileCloudCampaigns(){','\n'),'reconcileCloudCampaigns'],
 ['documents',block(html,'async function loadCloudDocuments(){','async function loadEssays(){'),'loadCloudDocuments'],
 ['essays',block(html,'async function loadEssays(){','async function reviewEssay('),'loadEssays'],
 ['topics',block(html,'async function loadCampaignTopics(){','window.unpackEditalTopicsList='),'loadCampaignTopics'],
 ['generated-inline',block(html,'async function loadGeneratedContent(){','function renderSummaries('),'loadGeneratedContent'],
 ['generated-v59',block(v59,'  loadGeneratedContent=async function(){','  window.setSummaryApproval='),'loadGeneratedContent']
];
for(const [name,code,fn]of loaders)for(const stage of ['fetch','json'])for(const change of ['account','portal','reset','error']){
 const pending=deferred(),sentinel=[{id:'current'}],calls=[],ctx={
  state:{...initialState('a'),customCampaign:{missions:[]}},cloudSession:session('a'),
  activeCampaign:()=>({dbId:ctx.state.activeCampaignId==='portal-a'?'db-a':'db-b'}),validSession:async()=>ctx.cloudSession,
  cloudFetch:()=>stage==='fetch'?pending.promise:Promise.resolve({ok:true,json:()=>pending.promise}),
  cloudDocuments:sentinel,cloudEssays:sentinel,ALL_SUMMARIES:sentinel,ALL_FLASHCARDS:sentinel,ALL_QUESTIONS:sentinel,LEARNING_SUBJECTS:sentinel,
  window:{},console:{warn:()=>calls.push('warn')},toast:()=>calls.push('toast'),renderUserDocuments:()=>calls.push('documents'),renderEssays:()=>calls.push('essays'),
  loadGeneratedContent:null,
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);const task=ctx[fn]();await tick();
 if(change==='account'){ctx.cloudSession=session('b');ctx.state=initialState('b')}else if(change==='portal')ctx.state.activeCampaignId='portal-b';else ctx.state._resetEpoch=2;
 if(change==='error')pending.reject(new Error('obsolete request'));else pending.resolve(stage==='fetch'?{ok:true,json:async()=>[]}:[]);
 assert.equal(await task,false,`${name}/${stage}/${change}`);
 for(const key of ['cloudDocuments','cloudEssays','ALL_SUMMARIES','ALL_FLASHCARDS','ALL_QUESTIONS','LEARNING_SUBJECTS'])assert.equal(ctx[key],sentinel,`${name} overwrote ${key}`);
 assert.deepEqual(calls,[],`${name} affected UI after scope changed`);
}
console.log('OK r178: sincronização e seis carregadores descartam respostas/erros antigos por conta, portal e reset; refresh não troca conta; edições durante rede são preservadas; sucesso exige confirmação.');
