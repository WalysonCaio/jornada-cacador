import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const ctx={};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../dist/question-availability.js',import.meta.url),'utf8'),ctx);
const {partition,describe}=ctx.JCQuestionAvailability;
const ready=Array.from({length:934},(_,id)=>({id}));
const review=Array.from({length:600},(_,id)=>({id:'r'+id,reason:'review'}));
const pending=Array.from({length:300},(_,id)=>({id:'p'+id,reason:'pendingKey'}));
const annulled=Array.from({length:31},(_,id)=>({id:'a'+id,reason:'annulled'}));
const outside=Array.from({length:500},(_,id)=>({id:'o'+id}));
const records=[...ready,...review,...pending,...annulled,...outside];
assert.equal(records.length,2365);
const counts=partition(records,ready,item=>item.reason);
assert.equal(counts.total,2365);assert.equal(counts.available,934);assert.equal(counts.review,600);assert.equal(counts.pendingKey,300);assert.equal(counts.annulled,31);assert.equal(counts.otherFilters,500);
assert.equal(counts.total,counts.availableInStore+counts.review+counts.pendingKey+counts.annulled+counts.otherFilters,'every local record is accounted for exactly once');
assert.match(describe(counts),/2365 questões no aparelho/);assert.match(describe(counts),/934 prontas neste filtro/);
assert.match(describe(counts),/600 aguardam revisão/);assert.match(describe(counts),/300 sem gabarito validado/);assert.match(describe(counts),/500 fora dos filtros/);
const repeated={id:'same'};
const duplicates=partition([repeated,repeated],[repeated],()=> 'pendingKey');
assert.equal(duplicates.availableInStore,1);assert.equal(duplicates.pendingKey,1,'multiset does not count one ready occurrence twice');
const supplemental=partition([],ready,()=> 'review');
assert.equal(supplemental.total,0);assert.equal(supplemental.supplemental,934);assert.match(describe(supplemental),/base complementar/);
assert.equal(partition(records,[],()=> 'review').review,2365);assert.equal(partition(null,null).total,0);

// Execute the production UI adapter and updateQuestionPool with the exact pool.
const start=source.indexOf('  function questionAvailabilityBreakdown('),end=source.indexOf('  function progressiveQuestions(',start);
assert(start>=0&&end>start);
let writes=0;
const label={hidden:true,_text:'',get textContent(){return this._text},set textContent(value){writes++;this._text=value}};
const nodes={'#questionAvailabilitySummary':label,'#questionPoolCount':{},'#startQuestions':{},'#questionBattleMode':{value:'progressive'}};
Object.assign(ctx,{ALL_QUESTIONS:records,q:selector=>nodes[selector],filteredQuestionPool:()=>ready,activeCampaignErrors:()=>[],updateSimuladoAvailability(){},
 questionDisciplineDecision:item=>({needs_review:item.reason==='review'}),isQuestionDisciplineEligible:()=>true,
 answerKeyStatus:item=>item.reason==='pendingKey'?'sem_gabarito':item.reason==='annulled'?'anulada':'oficial'});
vm.runInContext(source.slice(start,end),ctx);
ctx.updateQuestionPool();assert.equal(label.hidden,false);assert.equal(writes,1);assert.match(nodes['#questionPoolCount'].textContent,/934 disponíveis/);
ctx.updateQuestionPool();assert.equal(writes,1,'unchanged background refresh does not rewrite status DOM');
ctx.filteredQuestionPool=()=>ready.slice(0,10);ctx.updateQuestionPool();assert.equal(writes,2);assert.match(label.textContent,/10 prontas neste filtro/);
assert.equal(ctx.ALL_QUESTIONS,records,'explaining exclusions does not mutate the bank or fabricate questions');
console.log('OK r187 contagens: 2365 = 934 prontas + revisão/gabarito/anuladas/filtros, sem dupla contagem, base complementar explícita e status sem escritas repetidas.');
