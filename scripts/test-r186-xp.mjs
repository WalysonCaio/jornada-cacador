// XP usa os registros de progresso, sem depender do catálogo carregado ou da ofensiva atual.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const start=html.indexOf('function getTopicMasteryStats('),end=html.indexOf('function activeCampaign(){',start);assert(start>=0&&end>start);
const source=html.slice(start,end),clone=value=>JSON.parse(JSON.stringify(value));
const missions=[{id:'m1',subject:'Português',name:'Crase'},{id:'m2',subject:'Direito Constitucional',name:'Direitos fundamentais'}];
function fixture(changes={}){
 const state={_ownerUserId:'user-a',activeCampaignId:'camp-a',done:{m1:'2026-11-16T12:00:00Z',m2:'2026-11-17T12:00:00Z'},bosses:{},scores:[{id:'m2',campaignId:'camp-a',total:6,correct:5,date:'2026-11-17T13:00:00Z'}],topicMastery:{},learning:{completed:{},xp:0},streak:5,bestStreak:11,streakDaysByHalfMission:{'2026-11-16':'2026-11-16T12:00:00Z','2026-11-17':'2026-11-17T12:00:00Z'},...changes};
 const ctx={state,window:{},ALL_QUESTIONS:[],missionPool:()=>missions,normalizeText:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),subjectKey:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),canonicalSubjectName:value=>String(value||'')};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return ctx;
}
let failed=0;function check(name,run){try{run();console.log('OK',name);}catch(error){failed++;console.error('PENDENTE',name,error.message);}}
check('estudo40, domínio100 e bateria usam contagens válidas',()=>{
 const ctx=fixture();assert.equal(ctx.xp(),40+100+Math.floor(5/6*40));assert.equal(ctx.getTopicMasteryStats(missions[0]).isMastered,false);assert.equal(ctx.getTopicMasteryStats(missions[1]).isMastered,true);
});
check('125 ou2981questões carregadas não alteram XP de progresso idêntico',()=>{
 const ctx=fixture(),before=ctx.xp();ctx.ALL_QUESTIONS=Array.from({length:125},()=>({subject:'Português'}));assert.equal(ctx.xp(),before);ctx.ALL_QUESTIONS=Array.from({length:2981},()=>({subject:'Português'}));assert.equal(ctx.xp(),before);
});
check('XP já ganho não diminui quando ofensiva atual quebra',()=>{
 const ctx=fixture({learning:{completed:{},xp:5000}});const withStreak=ctx.xp();ctx.state.streak=0;assert.equal(ctx.xp(),withStreak);
});
check('maestria de outro portal não domina a missão ativa',()=>{
 const ctx=fixture({scores:[],topicMastery:{'camp-b|portugues|crase':{subjectKey:'portugues',topicKey:'crase',attempts:10,correct:10}}});assert.equal(ctx.getTopicMasteryStats(missions[0]).isMastered,false);assert.equal(ctx.xp(),80);
});
check('maestria de tópico parecido não domina tópico diferente',()=>{
 const ctx=fixture({scores:[],topicMastery:{'camp-a|portugues|crase e regencia':{subjectKey:'portugues',topicKey:'crase e regencia',attempts:10,correct:10}}});assert.equal(ctx.getTopicMasteryStats(missions[0]).isMastered,false);
});
check('contagens inválidas não geram XP e não produzem NaN',()=>{
 const ctx=fixture({done:{},scores:[],learning:{xp:0,completed:{}}});const base=ctx.xp();
 for(const score of [{total:10,correct:-1},{total:10,correct:11},{total:10,correct:'bad'},{total:10,correct:Infinity},{total:Infinity,correct:10},{total:true,correct:1},{total:3.5,correct:3},{total:10,correct:2.5}]){ctx.state.scores=[score];assert.equal(ctx.xp(),base,JSON.stringify(score));}
 ctx.state.scores=[];ctx.state.learning.xp='bad';assert(Number.isFinite(ctx.xp()));assert.equal(ctx.xp(),base);
});
check('marcadores falsos de chefe não contam como conclusão',()=>{
 const ctx=fixture({done:{},scores:[],bosses:{falseValue:false,nullValue:null},learning:{xp:0,completed:{}}});assert.equal(ctx.xp(),0);
});
check('missão duplicada na coleção não paga duas vezes',()=>{
 const ctx=fixture({done:{m1:'2026-11-16'},scores:[]});ctx.missionPool=()=>[missions[0],missions[0]];assert.equal(ctx.xp(),40);
});
check('xp arbitrariamente alto continua limitado por evidências de progresso',()=>{
 const ctx=fixture({learning:{xp:999999,completed:{}}});assert(Number.isFinite(ctx.xp()));assert(ctx.xp()<3000);
});
check('ofensiva histórica não concede XP e uma sessão não conta duas vezes',()=>{
 const ctx=fixture({done:{},scores:[],learning:{xp:0,completed:{}},bestStreak:500});assert.equal(ctx.xp(),0);
 const session={id:'m1',campaignId:'camp-a',sessionId:'session-1',date:'2026-11-17',total:10,correct:9};ctx.state.scores=[session,{...session}];assert.equal(ctx.xp(),36);
 ctx.state.scores.push({...session,sessionId:'session-2'});assert.equal(ctx.xp(),72);
});
check('cópia da mesma maestria por alias não soma tentativas nem mistura acertos',()=>{
 const ctx=fixture({scores:[],topicMastery:{'camp-a|portugues|crase':{attempts:3,correct:3},alias:{campaignId:'camp-a',subjectKey:'portugues',topicKey:'crase',attempts:3,correct:3}}});
 const stats=ctx.getTopicMasteryStats(missions[0]);assert.equal(stats.attempts,3);assert.equal(stats.isMastered,false);
});
check('nota arredondada não libera domínio abaixo de 70% real',()=>{
 const ctx=fixture({scores:[{id:'m1',campaignId:'camp-a',total:23,correct:16}]});const stats=ctx.getTopicMasteryStats(missions[0]);assert.equal(stats.accuracy,70);assert.equal(stats.isMastered,false);
});
check('bateria agregada e dados de outra disciplina/conta não comprovam tópico',()=>{
 for(const extra of [{source:'simulado',subject:'Português'},{source:'trail',subject:'Português'},{subject:'Direito Constitucional'},{topic:'Regência'},{userId:'user-b'}]){
  const ctx=fixture({scores:[{id:'m1',campaignId:'camp-a',total:10,correct:10,...extra}]});assert.equal(ctx.getTopicMasteryStats(missions[0]).isMastered,false,JSON.stringify(extra));
 }
 const ctx=fixture({scores:[{id:'m1',campaignId:'camp-a',total:10,correct:10,source:'simulado',subject:'Português',topic:'Crase'}]});assert.equal(ctx.getTopicMasteryStats(missions[0]).isMastered,true);
});
check('aliases do mesmo recibo de chefe não duplicam XP; outra vitória permanece',()=>{
 const victory={date:'2026-11-22T12:00:00Z',total:10,correct:8};const ctx=fixture({done:{},scores:[],bosses:{'boss-camp-a-portugues':victory,0:{...victory},bad:{total:10,correct:11}}});assert.equal(ctx.xp(),300);
 ctx.state.bosses.other={...victory,date:'2026-11-23T12:00:00Z'};assert.equal(ctx.xp(),600);
});
const experience=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const section=(start,end)=>{const a=experience.indexOf(start),b=experience.indexOf(end,a);assert(a>=0&&b>a);return experience.slice(a,b);};
check('teto do ranking segue histórico e rejeita contagens inválidas',()=>{
 const ctx=fixture({scores:[{total:10,correct:7},{total:Infinity,correct:1},{total:10,correct:-1},{total:true,correct:1}],bosses:{a:false,b:null},bestStreak:11});
 vm.runInContext(section('  function computeAuditedHunterXpCeiling(','  function syncHunterStatsSnapshot()'),ctx);
 const before=ctx.computeAuditedHunterXpCeiling(5,2,999999,2,5);ctx.state.streak=0;assert.equal(ctx.computeAuditedHunterXpCeiling(5,2,999999,2,0),before);
 assert.equal(before,5*40+2*60+10*15+11*40+800);
 assert(Number.isFinite(ctx.computeAuditedHunterXpCeiling(Infinity,-1,Infinity,Infinity,Infinity)));
});
function ledgerFixture(){
 const ctx=fixture({done:{},scores:[{sessionId:'s',total:100,correct:100}],learning:{xp:0,completed:{}},bestStreak:0,streakDaysByHalfMission:{}});
 vm.runInContext(fs.readFileSync(new URL('../dist/progress-ledger.js',import.meta.url),'utf8'),ctx);
 vm.runInContext(section('  function computeAuditedHunterXpCeiling(','  function syncHunterStatsSnapshot()'),ctx);return ctx;
}
const eventMetadata={ownerId:'user-a',campaignId:'camp-a',resetEpoch:0,at:'2026-11-23T12:00:00Z'};
check('identificador longo de fase não perde o teto do XP já concedido',()=>{
 const ctx=ledgerFixture(),eventId='trail-complete:'+('topico-'.repeat(90));
 ctx.state.learning=ctx.JCProgress.awardLearning(ctx.state.learning,100,'conclusao_trilha',eventId,eventMetadata);
 assert.equal(ctx.state.learning.xp,100);assert.equal(ctx.verifiedLearningEventXp(),100);
});
check('100 acertos com recibos reais preservam 2500 XP no herói e ranking',()=>{
 const ctx=ledgerFixture();for(let i=0;i<100;i++)ctx.state.learning=ctx.JCProgress.awardLearning(ctx.state.learning,25,'acerto_questao',`attempt:${i}`,eventMetadata);
 assert.equal(ctx.verifiedLearningEventXp(),2500);assert.equal(ctx.xp(),2540);assert(ctx.computeAuditedHunterXpCeiling(0,0,100,0,5)>=ctx.xp());
 const before=ctx.xp();ctx.state.streak=0;assert.equal(ctx.xp(),before);ctx.state.learning.xpLog=[{amount:999999,reason:'acerto_questao'}];assert.equal(ctx.xp(),before,'xpLog não é prova adicional de XP');
});
check('eventos offline válidos convergem sem corte, duplicação ou dependência da ordem',()=>{
 const ctx=ledgerFixture(),base=ctx.JCProgress.normalizeLearning({xp:500,completed:{}});let left=base,right=base;
 for(let i=0;i<50;i++){left=ctx.JCProgress.awardLearning(left,25,'acerto_questao',`pc:${i}`,eventMetadata);right=ctx.JCProgress.awardLearning(right,25,'acerto_questao',`phone:${i}`,{...eventMetadata,campaignId:'another-portal'});}
 const merged=ctx.JCProgress.mergeLearning(left,right);ctx.state.learning=merged;assert.equal(ctx.verifiedLearningEventXp(),2500);assert.equal(ctx.xp(),3040);
 for(const value of [ctx.JCProgress.mergeLearning(right,left),ctx.JCProgress.mergeLearning(merged,left),ctx.JCProgress.mergeLearning(right,merged)]){ctx.state.learning=value;assert.equal(ctx.xp(),3040);}
});
check('teto aceita só razões/valores conhecidos e metadados coerentes do dono',()=>{
 const ctx=ledgerFixture();ctx.state.learning={xp:999999,xpLedger:{version:1,events:{}}};const valid={points:25,reason:'acerto_questao',ownerId:'user-a',campaignId:'camp-a',at:'2026-11-23T12:00:00Z',resetEpoch:0};
 for(const change of [{reason:'unknown'},{points:26},{points:Infinity},{points:true},{points:2.5},{ownerId:'user-b'},{campaignId:''},{at:'bad'},{resetEpoch:1}]){ctx.state.learning.xpLedger.events={invalid:{...valid,...change}};assert.equal(ctx.verifiedLearningEventXp(),0,JSON.stringify(change));}
 ctx.state.learning.xpLedger.events={valid,anotherPortal:{...valid,campaignId:'camp-b'}};assert.equal(ctx.verifiedLearningEventXp(),50);assert.equal(ctx.xp(),740);
});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function rewardFixture({online=false}={}){
 const credits=[],messages=[],calls=[];
 const ctx={state:{_ownerUserId:'user-a',_resetEpoch:0,activeCampaignId:'local-a',daily:'m1',done:{},bosses:{},learning:{xp:0},dailyTracker:{missionId:'m1',questionsAnswered:10,questionsCorrect:8}},cloudSession:{user:{id:'user-a'},access_token:'token-a'},campaign:{id:'local-a',dbId:'db-a'},navigator:{onLine:online},SUPABASE_URL:'https://project.example',Set,Date,JSON,Number,String,Math,window:{},activeCampaign:()=>ctx.campaign,missionPool:()=>[missions[0]],subjectKey:value=>value,canonicalSubjectName:value=>value,authHeaders:token=>({Authorization:`Bearer ${token}`}),complete:id=>{ctx.state.done[id]='2026-11-23T12:00:00Z';},applyXpLocal:(amount,reason,eventId)=>{credits.push({amount,reason,eventId});ctx.state.learning.xp+=amount;},toast:value=>messages.push(value),save:()=>{},renderHero:()=>{},pushCloudState:()=>{},fetch:(url,options)=>{calls.push({url,options});return Promise.resolve({ok:true,json:async()=>({questions_total:10,questions_correct:8,performance_xp:48,mastery_bonus:20,boss_bonus:0})});}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(section('  function missionRewardContext()','  window.loadNativeBank='),ctx);return {ctx,credits,messages,calls};
}
async function checkAsync(name,run){try{await run();console.log('OK',name);}catch(error){failed++;console.error('PENDENTE',name,error.message);}}
await checkAsync('recibo da missão é idempotente e usa campanha do banco em todos os dispositivos',async()=>{
 const {ctx,credits,calls}=rewardFixture({online:true});const first=ctx.finalizeDailyMissionWithHonestXp(),second=ctx.finalizeDailyMissionWithHonestXp();await Promise.all([first,second]);await ctx.finalizeDailyMissionWithHonestXp();
 assert.equal(credits.length,1);assert.equal(credits[0].amount,68);assert(credits[0].eventId.includes('db-a'));assert(!credits[0].eventId.includes('local-a'));assert.equal(JSON.parse(calls[0].options.body).p_campaign_id,'local-a');assert.equal(calls.length,1);
});
for(const stage of ['fetch','json'])for(const changed of ['owner','session','portal','dbId','reset'])await checkAsync(`recibo tardio descartado: ${stage}, troca de ${changed}`,async()=>{
 const {ctx,credits,messages}=rewardFixture({online:true}),wait=deferred();
 if(stage==='fetch')ctx.fetch=()=>wait.promise;else ctx.fetch=async()=>({ok:true,json:()=>wait.promise});
 const pending=ctx.finalizeDailyMissionWithHonestXp();if(stage==='json'){await Promise.resolve();await Promise.resolve();}
 if(changed==='owner'){ctx.cloudSession={user:{id:'user-b'},access_token:'token-b'};ctx.state={...ctx.state,_ownerUserId:'user-b',learning:{xp:0}};}
 if(changed==='session')ctx.cloudSession=null;
 if(changed==='portal')ctx.state.activeCampaignId='local-b';
 if(changed==='dbId')ctx.campaign={...ctx.campaign,dbId:'db-b'};
 if(changed==='reset')ctx.state._resetEpoch++;
 const receipt={questions_total:10,questions_correct:8,performance_xp:48,mastery_bonus:20,boss_bonus:0};wait.resolve(stage==='fetch'?{ok:true,json:async()=>receipt}:receipt);await pending;
 assert.equal(credits.length,0);assert.equal(messages.length,0);assert.equal(Object.keys(ctx.state.learning.missionReceipts||{}).length,0);assert.equal(ctx.finalizeDailyMissionWithHonestXp.pending.size,0);
});
await checkAsync('recibo de rede malformado é limitado pelo desempenho registrado',async()=>{
 const {ctx,credits}=rewardFixture({online:true});ctx.fetch=async()=>({ok:true,json:async()=>({questions_total:10,questions_correct:8,performance_xp:Infinity,mastery_bonus:999999,boss_bonus:999999})});await ctx.finalizeDailyMissionWithHonestXp();assert.equal(credits.length,1);assert.equal(credits[0].amount,20);
});
await checkAsync('sem acertos e tracker de outra missão não geram bônus',async()=>{
 for(const counts of [{questionsAnswered:10,questionsCorrect:0},{questionsAnswered:10,questionsCorrect:11},{questionsAnswered:10,questionsCorrect:2.5},{missionId:'another',questionsAnswered:10,questionsCorrect:10}]){
  const {ctx,credits}=rewardFixture();Object.assign(ctx.state.dailyTracker,counts);await ctx.finalizeDailyMissionWithHonestXp();assert.equal(credits.length,0);assert(ctx.state.done.m1);
 }
});
if(failed)process.exitCode=1;else console.log('OK r186 XP: histórico estável, domínio exato, contagens válidas e recibos isolados/idempotentes.');
