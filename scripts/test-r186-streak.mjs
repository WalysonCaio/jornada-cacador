// Mesmo histórico e fuso da conta precisam produzir a mesma ofensiva em aparelhos distintos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(import.meta.url);
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);}
const code=section('function localDayKey(', 'function persistProgressLocally(')+section('function dayKeyOffset(', 'function markStudyActivity(')+section('function dailyQuestionsTarget(', 'function isMissionCompletedOnPastDay(')+section('function civilWeekStartKey(', 'function renderManualStudy(');
const days=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
const baseline=()=>({_ownerUserId:'user-a',activeCampaignId:'pmpe',settings:{dailyMinutes:180,studyTimeZone:'America/Sao_Paulo',studyDays:[1,2,3,4,5,6]},done:{},dailyHistory:[],dailySteps:{},scores:[],studyByDay:Object.fromEntries(days.map(day=>[day,3000])),streakDaysByHalfMission:{},manualStudyEntries:[],streak:0,bestStreak:11});
function context(state,now='2026-11-22T01:27:00Z'){
 const NativeDate=Date,stamp=Date.parse(now);
 class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}}
 const ctx={state,Date:FixedDate,Intl,console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return ctx;
}
function streakMarkup(ctx){
 const nodes=Object.fromEntries(['#streakCardCount','#streakBest','#streakWeek','#streakRequirement','#motivationText','#motivationSource'].map(key=>[key,{}]));
 ctx.$=key=>nodes[key];ctx.MOTIVATIONS=[{text:'Teste',source:'Teste'}];
 vm.runInContext(section('function renderStreak(', 'function renderHero('),ctx);ctx.renderStreak();return nodes['#streakWeek'].innerHTML;
}
if(process.env.JC_STREAK_FIXTURE){
 const input=JSON.parse(process.env.JC_STREAK_FIXTURE),ctx=context(input.state,input.now);
 process.stdout.write(JSON.stringify({today:ctx.localDayKey(),yesterday:ctx.dayKeyOffset(-1),streak:ctx.refreshStreak(),best:ctx.state.bestStreak,half:ctx.state.streakDaysByHalfMission,week:ctx.streakWeekDays(),weekly:ctx.weeklyMissionMetrics(),markup:streakMarkup(ctx)}));
}else{
 const run=(tz,state=baseline(),now='2026-11-22T01:27:00Z')=>{
  const output=spawnSync(process.execPath,[file],{encoding:'utf8',env:{...process.env,TZ:tz,JC_STREAK_FIXTURE:JSON.stringify({state,now})}});
  assert.equal(output.status,0,output.stderr);return JSON.parse(output.stdout);
 };
 const results=['America/Sao_Paulo','UTC','America/Los_Angeles'].map(tz=>({tz,...run(tz)}));
 assert(results.every(row=>row.today==='2026-11-21'),JSON.stringify(results));
 assert(results.every(row=>row.yesterday==='2026-11-20'),JSON.stringify(results));
 assert(results.every(row=>row.streak===5),JSON.stringify(results));
 assert(results.every(row=>JSON.stringify(row.week)===JSON.stringify(results[0].week)),'Calendário de sete dias deve ser idêntico entre aparelhos.');
 assert(results.every(row=>row.markup===results[0].markup),'A grade exibida deve coincidir com a ofensiva derivada.');
 assert.equal(results[0].week.at(-1).key,'2026-11-21');assert.equal(results[0].week.at(-1).weekday,6);
 assert(results.every(row=>JSON.stringify(row.weekly)===JSON.stringify(results[0].weekly)),'Metas semanais devem usar a semana do fuso da conta.');
 const weekly=baseline();weekly.studyByDay['2026-11-15']=3600;weekly.studyByDay['2026-11-22']=3600;weekly.done={old:'2026-11-15T12:00:00Z',current:'2026-11-20T12:00:00Z',fake:true};weekly.scores=[{date:'2026-11-20T12:00:00Z',total:10,campaignId:'pmpe'},{date:'2026-11-23T12:00:00Z',total:500},{date:'2026-11-20T12:00:00Z',total:500,campaignId:'other'}];
 for(const tz of ['UTC','America/Los_Angeles']){const row=run(tz,weekly);assert.equal(row.weekly.start,'2026-11-16');assert.equal(row.weekly.studied,250);assert.equal(row.weekly.questions,10);assert.equal(row.weekly.missions,1);}
 for(const tz of ['UTC','America/Los_Angeles'])assert.equal(run(tz,baseline(),'2026-11-23T01:27:00Z').weekly.start,'2026-11-16','Domingo brasileiro não pode trocar de semana junto com o UTC.');
 const defaults=baseline();delete defaults.settings.studyTimeZone;
 for(const tz of ['UTC','America/Los_Angeles'])assert.equal(run(tz,defaults).today,'2026-11-21','Default estável não depende do fuso do aparelho.');
 // O fuso configurado da conta prevalece também quando não é o do Brasil.
 const abroad=baseline();abroad.settings.studyTimeZone='America/Los_Angeles';
 for(const tz of ['UTC','America/Sao_Paulo']){const row=run(tz,abroad,'2026-11-22T07:30:00Z');assert.equal(row.today,'2026-11-21');assert.equal(row.streak,5);}
 // Número derivado antigo não inventa continuidade quando ontem não qualificou.
 const missing=baseline();delete missing.studyByDay['2026-11-20'];missing.streak=50;
 const broken=run('America/Sao_Paulo',missing);assert.equal(broken.streak,0);assert.equal(broken.best,11);
 const half=baseline();half.studyByDay={};half.streakDaysByHalfMission=Object.fromEntries(days.map(day=>[day,day+'T18:00:00Z']));
 assert.equal(run('UTC',half).streak,5);
 // Valores booleanos de done não são datas em 1970 nem geram dias fabricados.
 const malformed=baseline();malformed.done={pending:false,legacy:true,missing:null,empty:'',number:1,broken:'not-a-date',overflow:'2026-11-31T12:00:00Z'};
 const repaired=run('America/Sao_Paulo',malformed);assert.deepEqual(repaired.half,{},'Valores inválidos de done não fabricam dias de estudo.');
 const invalid=baseline();invalid.settings.studyTimeZone='not/a-timezone';assert.equal(run('UTC',invalid).today,'2026-11-21');
 // Chaves civis antigas não são reagrupadas quando a preferência de fuso muda.
 const legacy=baseline(),stamp='2026-11-21T01:27:00Z';legacy.done={m1:stamp};legacy.streakDaysByHalfMission={'2026-11-21':stamp};legacy.settings.studyTimeZone='America/Los_Angeles';
 const kept=run('UTC',legacy);assert.deepEqual(kept.half,{'2026-11-21':stamp});
 const oldHistory=baseline();oldHistory.done={m1:stamp};oldHistory.dailyHistory=[{date:'2026-11-21',completedAt:stamp}];
 assert.deepEqual(run('UTC',oldHistory).half,{'2026-11-21':stamp},'Data civil explícita do histórico prevalece sobre reinterpretação do timestamp.');
 const ctx=context(baseline());ctx.save=()=>assert.fail('Renderização/reparo não deve chamar save');ctx.scheduleCloudSync=()=>assert.fail('Reparo não deve criar loop de sync');
 assert.equal(ctx.repairStudyLedger(),false);ctx.state.done={m1:'2026-11-21T18:00:00Z'};
 assert.equal(ctx.repairStudyLedger(),true);assert.equal(ctx.state._studyLedgerRepairPending,true);
 ctx.state._studyLedgerRepairPending=false;assert.equal(ctx.repairStudyLedger(),false);ctx.refreshStreak();ctx.refreshStreak();assert.equal(ctx.state._studyLedgerRepairPending,false,'Reparo é idempotente.');
 assert.equal(ctx.civilDayOffset('2024-02-28',1),'2024-02-29');assert.equal(ctx.civilDayOffset('2026-12-31',1),'2027-01-01');assert.equal(ctx.civilDayOffset('2026-02-30',1),'');
 assert.equal(ctx.localDayKey('2026-11-21'),'2026-11-21');assert.equal(ctx.completedStudyDay(true),'');
 const manual=context(baseline());manual.state.manualStudyEntries=[{date:'2026-11-21',minutes:30},{date:'2026-11-21',minutes:-5},{date:'2026-11-21',minutes:'invalid'},{date:'2026-11-31',minutes:80},{date:'2026-11-22',minutes:50}];manual.repairStudyLedger();
 assert.equal(manual.state.studyByDay['2026-11-21'],1800);assert.equal(manual.state.studyByDay['2026-11-22'],undefined);assert.equal(manual.state.studyByDay['2026-11-31'],undefined);
 console.log('OK r186 ofensiva: fuso da conta entre aparelhos, dias civis, ausência real de continuidade, metade da missão e sem datas fabricadas.');
}
