import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the delivered module. No browser timing or live network is asserted.
const source = readFileSync(new URL('../dist/jc-architecture-modules.js', import.meta.url), 'utf8');
function boot(storage = new Map()) {
  const timers = new Map(); let nextTimer = 0;
  const ctx = {
    document:{readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},createElement(){return {style:{},click(){}};}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    navigator:{onLine:true},performance:{now:()=>1},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    AbortController,Blob,URL,
    state:{_ownerUserId:'alice',activeCampaignId:'portal-a',_resetEpoch:0,campaigns:[{id:'portal-a',dbId:'db-a'}]},
    cloudSession:{user:{id:'alice'}},NATIVE_POLICE_QUESTION_BANK:[],ALL_QUESTIONS:[],
    fetch:async()=>{throw Error('Unexpected network');},toast(){}
  };
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'jc-architecture-modules.js'});
  return {ctx,storage,timers};
}
const {ctx,storage,timers}=boot();
const resolve=(...args)=>ctx.resolveStableTaxonomy(...args);
const cpp=resolve('Noções de Direito Processual Penal','Inquérito Policial','Roubo e flagrante');
assert.equal(cpp.subjectId,'disc_cpp');assert.equal(cpp.topicId,'cpp_ip');
assert.equal(resolve('Código de Processo Penal').subjectId,'disc_cpp');
assert.equal(resolve('Processual Penal').subjectId,'disc_cpp');
assert.equal(resolve('Direito Penal','Teoria do Crime','Inquérito policial').subjectId,'disc_penal','Statement keywords must not override a declared discipline');
assert.equal(resolve('Código Penal').subjectId,'disc_penal');
for (const subject of ['',null,{},'Conteúdo Geral','Questão 23','Simulado Geral','Manuais do Caçador (Método & Estratégia)']) {
  assert.equal(resolve(subject,'Art. 5º','Direitos fundamentais').subjectId,'disc_nao_classificada');
  assert.equal(resolve(subject).needsReview,true);
}
const biology=resolve('Biologia','Ecologia','Cadeias alimentares');
assert.match(biology.subjectId,/^disc_custom_/);
assert.equal(resolve('BIOLOGIA','Ecologia').subjectId,biology.subjectId,'Custom IDs are stable across case');
assert.notEqual(biology.subjectId,'disc_const');
assert.equal(resolve('Direito Constitucional','','Enunciado sem pistas de assunto').topicId,null,'Unknown topics must not become the first topic');
assert.equal(resolve('História de Pernambuco','Item 3','Olinda').topicId,null,'A tie between topics requires review');
assert.equal(resolve('Direito Constitucional','Tema não catalogado').topicNeedsReview,true);
assert.equal(resolve('Direito Constitucional','Tema não catalogado').topicId,resolve('Constitucional','Tema não catalogado').topicId);
const cppSources=ctx.getTrustedExternalSources('CPP','Inquérito');
assert(cppSources.some(s=>s.url.includes('del3689')));
assert(!cppSources.some(s=>s.url.includes('del2848')),'CPP must not show the Penal Code as its primary source');
assert.equal(ctx.getTrustedExternalSources('Conteúdo Geral').length,0);
assert(!ctx.getTrustedExternalSources('Biologia','Ecologia').some(s=>s.url.includes('constituicao.htm')));
assert(!cppSources.some(s=>s.name.includes('Wikipédia Acadêmica')));
assert(cppSources.every(s=>s.url.startsWith('https://')));

let n=0;
const question=(extra={})=>({id:`q${++n}`,subject:'Direito Processual Penal',topic:'Inquérito Policial',statement:'O inquérito policial reúne elementos para a persecução penal.',options:['Alternativa primeira','Alternativa segunda','Alternativa terceira','Alternativa quarta','Alternativa quinta'],correct_index:4,origin:'oficial',key_source:'oficial_preliminar',...extra});
const seed=question({id:'native-1',native:true,origin:'autoral',correct_index:0});
ctx.NATIVE_POLICE_QUESTION_BANK=[seed];
const originalSeed=JSON.stringify(ctx.NATIVE_POLICE_QUESTION_BANK);
const official=question({id:'official-5',source_url:'https://example.test/prova.pdf'});
const ce=question({id:'ce-2',options:['Certo','Errado'],correct_index:1,origin:'autoral'});
const localUnknownOrigin=question({id:'unknown-origin',origin:undefined});
ctx.ALL_QUESTIONS=[
  question({id:'native-1',native:true,origin:'autoral',correct_index:2,key_source:'manual_revisado',answer_key_validation:'revisado'}),official,ce,localUnknownOrigin,
  question({correct_index:null}),question({correct_index:true}),question({correct_index:5}),question({correct_index:-1}),
  question({correct_index:' '}),question({answer_unknown:true}),question({annulled:true}),
  question({key_source:'ia_sugerido',answer_key_validation:'pendente'}),
  question({explanation:'[Gabarito sugerido pela IA — validação pendente]'}),
  question({options:['Uma alternativa','','Outra alternativa'],correct_index:0}),
  question({options:[{text:'Uma alternativa'},{text:'Outra alternativa'}],correct_index:0}),
  question({options:['A) Texto idêntico','B) Texto idêntico'],correct_index:0}),
  question({subject:'Manuais do Caçador',topic:'Método'}),question({subject:''}),
  question({id:'foreign-owner',user_id:'bob'}),question({id:'foreign-portal',campaign_id:'db-b'}),
  question({id:'shared',statement:'Questão compartilhada sobre os prazos do inquérito policial.',user_id:'bob',campaign_id:'db-b',from_community:true})
];
let bank=ctx.consolidateUserQuestionsIntoNativeBank({showToast:false});
assert.equal(bank.total,5,'Only current questions with valid options, keys and scope are organized');
assert.equal(bank.subjectsCount,1);assert.equal(bank.hierarchy['Direito Processual Penal'].subjectId,'disc_cpp');
assert.equal(bank.questions.find(q=>q.id==='native-1').correct_index,2,'A current reviewed key overrides a native seed');
assert.equal(bank.questions.filter(q=>q.id==='native-1').length,1);
assert.equal(bank.questions.find(q=>q.id==='official-5').origin,'oficial');
assert.equal(bank.questions.find(q=>q.id==='official-5').key_source,'oficial_preliminar');
assert.equal(bank.questions.find(q=>q.id==='official-5').correct_index,4);
assert.equal(JSON.stringify(bank.questions.find(q=>q.id==='official-5').options),JSON.stringify(official.options));
assert.equal(bank.questions.find(q=>q.id==='ce-2').correct_index,1);
assert.equal(bank.questions.find(q=>q.id==='unknown-origin').origin,'nao_informada','Organization must not invent authorship');
assert.equal(bank.questions.find(q=>q.id==='official-5').native,false,'An imported question must not become a native seed');
assert.equal(JSON.stringify(ctx.NATIVE_POLICE_QUESTION_BANK),originalSeed,'The native bank must remain immutable');
const aliceKey=ctx.JC_MODULES.nativeBankPromoter.storageKey();
assert(storage.has(aliceKey));

ctx.ALL_QUESTIONS=[question({id:'native-1',answer_unknown:true,correct_index:null})];
bank=ctx.consolidateUserQuestionsIntoNativeBank({showToast:false});
assert.equal(bank.total,0,'A withdrawn current key must not be restored from a native seed or saved snapshot');
ctx.ALL_QUESTIONS=[];ctx.NATIVE_POLICE_QUESTION_BANK=[];
storage.set(aliceKey,JSON.stringify({version:2,scope:{userId:'alice',campaignId:'portal-a',resetEpoch:0},questions:[official]}));
storage.set('jc_promoted_native_bank_v1',JSON.stringify([official]));
assert.equal(ctx.consolidateUserQuestionsIntoNativeBank({showToast:false}).total,0,'Deleted content must not resurrect from export snapshots');

ctx.ALL_QUESTIONS=[question({subject:'Raciocínio Lógico-Matemático',statement:'Quanto é 2+2 nesta expressão?',options:['2+2','2-2'],correct_index:0}),question({subject:'Raciocínio Lógico-Matemático',statement:'Quanto é 2-2 nesta expressão?',options:['2+2','2-2'],correct_index:0})];
assert.equal(ctx.consolidateUserQuestionsIntoNativeBank({showToast:false}).total,2,'Mathematical operators must survive deduplication');

ctx.cloudSession={user:{id:'bob'}};
const beforeSwitch=JSON.stringify([...storage]);
assert.equal(ctx.consolidateUserQuestionsIntoNativeBank({showToast:false}).scopeReady,false);
assert.equal(ctx.consolidateUserQuestionsIntoNativeBank({showToast:false}).total,0,'A late old-account in-memory bank must not be exported under the new account');
assert.equal(ctx.exportConsolidatedNativeBankJson(),null);
assert.equal(JSON.stringify([...storage]),beforeSwitch,'An account transition cannot overwrite another account snapshot');
ctx.state._ownerUserId='bob';ctx.ALL_QUESTIONS=[];
const bobKey=ctx.JC_MODULES.nativeBankPromoter.storageKey();
assert.notEqual(bobKey,aliceKey);
assert.equal(ctx.consolidateUserQuestionsIntoNativeBank({showToast:false}).total,0);
ctx.state.activeCampaignId='portal-b';assert.notEqual(ctx.JC_MODULES.nativeBankPromoter.storageKey(),bobKey);
ctx.state.activeCampaignId='portal-a';ctx.state._resetEpoch=17;assert.notEqual(ctx.JC_MODULES.nativeBankPromoter.storageKey(),bobKey);

// A single eight-second deadline covers search plus extraction, and external
// metadata cannot inject an untrusted link into a study card.
const requestSignals=[];
ctx.fetch=async(url,options)=>{requestSignals.push(options.signal);return {ok:true,json:async()=>url.includes('/w/api.php')?{query:{search:[{title:'Inquérito policial'}]}}:{title:'Inquérito policial',extract:'Texto enciclopédico para consulta.',content_urls:{desktop:{page:'javascript:alert(1)'}}}};};
const extract=await ctx.JC_MODULES.smartLibrary.fetchLiveWikipediaTopicExtract('Inquérito policial','CPP');
assert.equal(requestSignals.length,2);assert.equal(requestSignals[0],requestSignals[1]);
assert.equal(extract.pageUrl,'https://pt.wikipedia.org/wiki/Inqu%C3%A9rito%20policial');
assert.equal(timers.size,0,'The deadline must be cleared after success');
ctx.fetch=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
const pending=ctx.JC_MODULES.smartLibrary.fetchLiveWikipediaTopicExtract('Inquérito policial','CPP');
const deadline=[...timers.values()][0];assert.equal(deadline.delay,8000);deadline.fn();
assert.equal(await pending,null);assert.equal(timers.size,0);
ctx.navigator.onLine=false;ctx.fetch=()=>{throw Error('Offline code must not fetch');};
assert.equal(await ctx.JC_MODULES.smartLibrary.fetchLiveWikipediaTopicExtract('Inquérito policial','CPP'),null);
console.log('OK r178: disciplinas e assuntos sem fallback cruzado; organização local sem alterar gabaritos/origem/sementes; snapshots não ressuscitam itens; escopos e fontes externas validados.');
