import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const social=fs.readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
const experience=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function profileFixture(){
  const storage=new Map([['jc_profile_avatar_v1','https://legacy.test/other-user.png'],['jc_profile_display_name_v1','Outra conta']]);
  const ids=new Map(),images=[],readers=[],messages=[];
  const dialog=()=>({innerHTML:'',open:false,style:{},buttons:new Map(),querySelector(id){if(!this.buttons.has(id))this.buttons.set(id,{});return this.buttons.get(id);},showModal(){this.open=true;},close(){this.open=false;}});
  const panel={innerHTML:''};
  const ctx={URL,console,navigator:{onLine:true},state:{_ownerUserId:'user-a',_resetEpoch:0,_serverRevision:1,_dirty:false,publicProfile:{}},cloudSession:{user:{id:'user-a',user_metadata:{}}},questions:[],JC_MODULES:{telemetry:{getStats:()=>({sampleCount:0,p50Ms:null})}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    document:{getElementById:id=>ids.get(id)||null,querySelectorAll:()=>[],createElement:type=>type==='dialog'?dialog():{getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/png;base64,YQ=='},body:{appendChild:el=>ids.set(el.id,el)}},
    FileReader:class{constructor(){readers.push(this);}readAsDataURL(){}},Image:class{constructor(){images.push(this);this.width=200;this.height=200;}},
    getAppState:()=>ctx.state,getAllQuestions:()=>ctx.questions,getAllSummaries:()=>[],getAllFlashcards:()=>[],injectSocialProfileStyles(){},
    ensureProfileViewSectionExists:()=>panel,save:()=>{ctx.state._dirty=true;},pushCloudState:async()=>{},toast:message=>messages.push(message),questionFingerprint:q=>q.id,
    missionPool:()=>[],activeCampaign:()=>null,level:()=>({label:'Caçador'}),
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(section(social,'  function profileHtml(', '  function ensureProfileViewSectionExists()'),ctx);
  vm.runInContext(section(social,'  function renderHunterProfileHub()', '  JC_MODULES.socialProfile ='),ctx);
  return {ctx,storage,ids,images,readers,panel,messages};
}
const changes={name:'Nome atualizado',role:'Cargo',secondaryRole:'',bio:'Minha bio',city:'Recife',hidden:false,privacy:{showAvatar:true,showAccuracy:false}};

// Public content is escaped in text and attributes; avatars accept only raster data or HTTPS.
{
  const {ctx,ids}=profileFixture();
  const attack='\"><img src=x onerror=alert(1)>';
  for(const url of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','http://avatar.test/a.png','//avatar.test/a.png'])assert.equal(ctx.profileAvatarUrl(url),'');
  assert.equal(ctx.profileAvatarUrl('https://avatar.test/a.png'),'https://avatar.test/a.png');
  ctx.openPublicHunterProfileVisitorModal({user_id:'\"bad-selector',name:attack,role:attack,bio:attack,avatar:'javascript:alert(1)',xp:100,missions_done:10,streak:4});
  const dlg=ids.get('jcPublicHunterVisitorDialog');
  assert(!dlg.innerHTML.includes(attack));assert(dlg.innerHTML.includes('&lt;img'));assert(!dlg.innerHTML.includes('javascript:'));
  assert(dlg.innerHTML.includes('Não informado'),'Missing hours must not be manufactured from missions/streak');
  assert(!dlg.innerHTML.includes('Ritmo Estimado'));
  let clicked=0;
  ctx.document.querySelectorAll=()=>[{dataset:{challengeFromRank:'\"bad-selector|nome'},click:()=>clicked++}];
  dlg.querySelector('#jcVisitorChallengeDuelBtn').onclick();assert.equal(clicked,1,'Untrusted ID does not enter a CSS selector');
  ctx.state.profileDisplayName=attack;ctx.state.profileBioMotto=attack;ctx.state.profileTargetRole=attack;
  ctx.renderHunterProfileHub();
  assert(!ctx.ensureProfileViewSectionExists().innerHTML.includes(attack));
  assert(ctx.ensureProfileViewSectionExists().innerHTML.includes('ainda sem medição'));
  assert(!ctx.ensureProfileViewSectionExists().innerHTML.includes('abertura instantânea'));
}

// Cache belongs to an account and reset generation; legacy ownerless entries are discarded.
{
  const {ctx,storage}=profileFixture();
  assert.equal(ctx.getHunterAvatarDataUrl(),'');assert(!storage.has('jc_profile_avatar_v1'));
  ctx.writeProfileCache('name','Conta A');
  assert.equal(ctx.getHunterDisplayName(),'Conta A');
  ctx.cloudSession={user:{id:'user-b'}};ctx.state={_ownerUserId:'user-a',profileDisplayName:'Segredo A',publicProfile:{}};
  assert.equal(ctx.getHunterDisplayName(),'Caçador');assert.equal(ctx.ownProfileState(),null);
  ctx.state={_ownerUserId:'user-b',publicProfile:{}};assert.equal(ctx.getHunterDisplayName(),'Caçador');
  ctx.cloudSession={user:{id:'user-a'}};ctx.state={_ownerUserId:'user-a',_resetEpoch:1,publicProfile:{}};
  assert.equal(ctx.getHunterDisplayName(),'Caçador','Reset does not resurrect cached identity');
}

// Save success requires a confirmed new revision; offline, failure and account changes stay honest.
{
  const {ctx}=profileFixture();
  ctx.navigator.onLine=false;
  assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'pending');assert.equal(ctx.state.publicProfile.name,changes.name);
  ctx.navigator.onLine=true;ctx.pushCloudState=async()=>{throw new Error('offline');};
  assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'pending');
  ctx.pushCloudState=async()=>{};assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'pending');
  ctx.pushCloudState=async()=>{ctx.state._serverRevision++;ctx.state._dirty=false;return true;};
  assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'synced');
  const pending=deferred();ctx.pushCloudState=()=>pending.promise;
  const save=ctx.saveHunterProfileChanges(changes);
  assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'busy');
  ctx.cloudSession={user:{id:'user-b'}};ctx.state={_ownerUserId:'user-b',_resetEpoch:0,publicProfile:{name:'Conta B'}};
  pending.resolve();assert.equal((await save).status,'account_changed');assert.equal(ctx.state.publicProfile.name,'Conta B');
  ctx.save=()=>{throw new Error('quota');};assert.equal((await ctx.saveHunterProfileChanges(changes)).status,'storage_error');
}

// FileReader and image decoding may finish after switching accounts or resetting progress.
for(const stage of ['reader','image']){
  const {ctx,ids,readers,images}=profileFixture();const input={};ids.set('jcProfileAvatarInput',input);ctx.renderHunterProfileHub();
  input.onchange({target:{files:[{type:'image/png',size:100}]}});
  if(stage==='image'){readers[0].result='data:image/png;base64,YQ==';readers[0].onload();assert.equal(images.length,1);ctx.state._resetEpoch++;}
  else{ctx.cloudSession={user:{id:'user-b'}};ctx.state={_ownerUserId:'user-b',publicProfile:{}};}
  if(stage==='reader')readers[0].onload();else images[0].onload();
  assert.equal(ctx.state.profileAvatarDataUrl,undefined);assert.equal(images.length,stage==='reader'?0:1);
}

// Per-board accuracy excludes provisional/missing keys and never infers an official board.
{
  const {ctx}=profileFixture();
  ctx.questions=[{id:'official',origin:'oficial'},{id:'unknown',board:'FGV'},{id:'provisional',board:'FGV'}];
  ctx.state.answeredQuestionFingerprints={official:'correct',unknown:'wrong',provisional:'correct'};
  ctx.answerKeyStatus=q=>q.id==='official'?'oficial':q.id==='unknown'?'sem_gabarito':'provisorio';
  const boards=ctx.computeBoardAccuracyStats();
  const official=boards.find(item=>item.board==='Banca não informada');assert.equal(official.answered,1);assert.equal(official.pct,100);
  assert.equal(boards.find(item=>item.board==='FGV Conhecimento').answered,0);
}

function rankingFixture(){
  const ctx={console,window:{},cloudSession:{user:{id:'user-a'}},state:{_ownerUserId:'user-a',_resetEpoch:0,hunterStats:{}},navigator:{onLine:true},renderHuntersLeaderboard(){},toast(){},localDayKey:date=>(date||new Date()).toISOString().slice(0,10),syncHunterStatsSnapshot(){},detectUserRoles:()=>({primary:'Concurso A',secondary:''})};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(section(experience,'  function computeAuditedHunterXpCeiling(', '  function syncHunterStatsSnapshot()'),ctx);
  vm.runInContext("let leaderboardRows=[],leaderboardBusy=false,leaderboardRowsScope='',leaderboardRequestId=0,leaderboardSqlMissing=false;",ctx);
  vm.runInContext(section(experience,'  function rankingScope()', '  function renderRoleBadgesHtml('),ctx);
  vm.runInContext(section(experience,'  async function loadHuntersLeaderboard(', '  function renderHuntersLeaderboard()'),ctx);
  return ctx;
}
{
  const ctx=rankingFixture();
  const row={user_id:'remote',xp:1000,streak:10,missions_done:40,accuracy:70};
  const general=ctx.rankingPeriodMetrics(row),weekly=ctx.rankingPeriodMetrics(row,true);
  assert.equal(general._displayHours,null);assert.equal(general._displayQuestions,null);
  assert.equal(weekly._displayXp,null);assert.equal(weekly._displayMissions,null);assert.equal(weekly.accuracy,null);
  const actual=ctx.rankingPeriodMetrics({...row,hours:2.5,questions_total:12,weekly_hours:0.5},true);assert.equal(actual._displayHours,0.5);
  const privateRow=ctx.rankingPeriodMetrics({...row,hours:5,questions_total:9,role:'Privado A',privacy:{showAccuracy:false,showStreak:false,showHours:false,showTargetRole:false}});
  for(const key of ['accuracy','streak','_displayMissions','_displayQuestions','_displayHours'])assert.equal(privateRow[key],null,key);
  assert.equal(privateRow.role,'Cargo privado');
  assert.equal(ctx.deduplicateHunterRows([{user_id:'a',name:'Ana'},{user_id:'b',name:'Ana'}]).length,2,'Same name does not merge different people');
  ctx.state.studyByDay={'2026-11-13':3600,'2026-11-14':1800};ctx.state.scores=[{total:10,correct:7}];
  assert.equal(ctx.localHunterRow().hours,1.5);assert.equal(ctx.localHunterRow().questions_total,10);assert.equal(ctx.localHunterRow().weekly_questions_total,null,'Undated scores are not assigned to a week');
  ctx.state.hunterStats.xp=999999;
  assert.equal(ctx.localHunterRow().xp,ctx.computeAuditedHunterXpCeiling(0,0,10,0,0),'Own XP is limited by recorded questions/missions/bosses/streak');
  const request=deferred();ctx.cloudFetch=()=>request.promise;
  const load=ctx.loadHuntersLeaderboard();
  ctx.cloudSession={user:{id:'user-b'}};ctx.state={_ownerUserId:'user-b',_resetEpoch:0,publicProfile:{name:'B'}};
  request.resolve({ok:true,json:async()=>[{user_id:'old',name:'Conta antiga'}]});await load;
  assert.equal(vm.runInContext('leaderboardRows.length',ctx),0,'Old leaderboard response is discarded after switching accounts');
  vm.runInContext("leaderboardRows=[{user_id:'old',is_me:true,name:'Perfil antigo'}];leaderboardRowsScope='user-a:0'",ctx);
  const fresh=deferred();ctx.cloudFetch=()=>fresh.promise;
  const newLoad=ctx.loadHuntersLeaderboard();
  assert.equal(vm.runInContext('leaderboardRows.length',ctx),0,'Switch clears old rows before rendering/loading the next account');
  fresh.resolve({ok:true,json:async()=>[]});await newLoad;
  ctx.cloudFetch=async()=>({ok:false,json:async()=>({message:'RPC indisponível'})});await ctx.loadHuntersLeaderboard();
  assert.equal(vm.runInContext('leaderboardRows.length',ctx),1);assert.equal(vm.runInContext('leaderboardRows[0].user_id',ctx),'user-b');
}
console.log('OK r178 perfil: escape/URLs, cache por conta/reset, confirmação de salvamento, callbacks tardios, métricas registradas, privacidade, homônimos e RPC com troca de conta.');
