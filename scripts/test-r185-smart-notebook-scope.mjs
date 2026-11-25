// Executa a IIFE real com DOM, sessão e HTTP simulados. Nenhuma chamada externa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=new URL('../dist/v78-smart-notebook.js',import.meta.url);
const source=fs.readFileSync(file,'utf8');
assert(/\}\)\(\);\s*$/.test(source),'Fechamento da IIFE deve ser reconhecido.');
const instrumented=source.replace(/\}\)\(\);\s*$/,`globalThis.__notebook={current,persist,runGeneration,renderSmart,renderResult,startAdaptiveQuiz,readySources,ensureSelection,selectedSources};})();`);
const clone=x=>JSON.parse(JSON.stringify(x));
const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const deferred=()=>{let resolve,reject;return{promise:new Promise((r,j)=>{resolve=r;reject=j;}),get resolve(){return resolve;},get reject(){return reject;}};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
  const values=new Map(options.values||[]),nodes=new Map(),calls=[],messages=[],timers=new Map(),events=new Map();let timerId=0;
  function node(selector){return{selector,value:selector==='#smartQuestion'?'Explique o material selecionado.':'all',textContent:'',innerHTML:'',disabled:false,hidden:false,dataset:{},classList:{contains:()=>false,add(){},remove(){},toggle(){}},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],focus(){},showModal(){this.open=true;},matches:()=>false};}
  const absent=new Set(['#study .studyTabs','#notebook','[data-study="smart"]','#aboutDialog .tag','#diagnosticsDialog .small.muted']);
  const document={readyState:'complete',visibilityState:'visible',querySelector(selector){if(absent.has(selector))return null;if(!nodes.has(selector))nodes.set(selector,node(selector));return nodes.get(selector);},querySelectorAll:()=>[],addEventListener:(name,fn)=>{events.set(name,fn);},dispatchEvent(){}};
  const ctx={console,document,Map,Set,Date,JSON,URL,AbortController,TextEncoder,TextDecoder,
    setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    setInterval:()=>0,clearInterval(){},requestAnimationFrame:fn=>fn(),
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(options.quota)throw new Error('QuotaExceededError');values.set(key,String(value));},removeItem:key=>values.delete(key)},
    state:{_ownerUserId:'a',_resetEpoch:0,activeCampaignId:'p',scores:[],campaigns:[{id:'p',dbId:'db-p',name:'Portal p'},{id:'p2',dbId:'db-p2',name:'Portal p2'}]},
    cloudSession:{user:{id:'a'},access_token:'token-a'},navigator:{onLine:true},cloudDocuments:[],ALL_SUMMARIES:[],ALL_QUESTIONS:[],SUPABASE_URL:'https://fixture.invalid',
    canonicalSubjectName:value=>String(value||'Conteúdo Geral'),subjectKey:normalize,normalizeText:normalize,missionPool:()=>[],
    formatAIAnswer:value=>String(value??'').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;'),
    toast:message=>messages.push(String(message)),confirm:()=>true,
    render(){},loadGeneratedContent:async()=>true,
    authHeaders:token=>({Authorization:'Bearer '+token}),validSession:async()=>ctx.cloudSession,
    activeCampaign:()=>ctx.state.campaigns?.find(item=>item.id===ctx.state.activeCampaignId),
    fetch:async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return {ok:true,status:200,json:async()=>({answer:'Resposta da conta A.',provider:'gemini'})};},
  };
  ctx.window=ctx;ctx.addEventListener=(name,fn)=>events.set('window:'+name,fn);
  function installSources(owner='a',portal='p',suffix=owner){
    const campaign=ctx.state.campaigns?.find(item=>item.id===portal),dbId=campaign?.dbId||'db-'+portal;
    ctx.cloudDocuments=[{id:'doc-'+suffix,title:'PDF '+suffix,user_id:owner,campaign_id:dbId,document_type:'material',processing_status:'ready',updated_at:'2026-11-21T12:00:00Z'}];
    ctx.ALL_SUMMARIES=[{id:'summary-'+suffix,documentId:'doc-'+suffix,user_id:owner,campaign_id:dbId,category:'Língua Portuguesa',title:'Crase',explanation:'Conteúdo privado de '+suffix,source:'PDF '+suffix,pageStart:1,pageEnd:2,points:['Regra de teste']}];
  }
  installSources();
  vm.createContext(ctx);vm.runInContext(instrumented,ctx,{filename:'v78-smart-notebook.js'});
  const api=ctx.__notebook;
  if(options.render!==false)api.renderSmart();
  return{ctx,api,values,nodes,calls,messages,timers,events,installSources,node:selector=>document.querySelector(selector)};
}
function change(f,type){
  if(type==='account'){f.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};f.ctx.state._ownerUserId='b';f.installSources('b','p','b');}
  if(type==='portal'){f.ctx.state.activeCampaignId='p2';f.installSources('a','p2','p2');}
  if(type==='reset')f.ctx.state._resetEpoch++;
  if(type==='dbId'){f.ctx.state.campaigns[0].dbId='db-p-new';f.installSources('a','p','new-db');}
  if(type==='logout')f.ctx.cloudSession=null;
  if(type==='loading')f.ctx.state._ownerUserId='b';
  f.api.renderSmart();
}
function hasPrivate(values,text){return [...values.values()].some(value=>value.includes(text));}
let total=0;const failures=[];
async function check(name,fn){total++;try{await fn();console.log('OK',name);}catch(error){failures.push({name,error});console.error('FALHOU',name,':',error.message);}}

await check('cache legado sem dono não é atribuído a uma conta',()=>{
  const legacy={p:{subject:'all',sources:['doc-a'],cache:{one:{answer:'SEGREDO LEGADO'}},lastResult:{answer:'SEGREDO LEGADO',sources:['PDF antigo'],question:'Pergunta antiga'}}};
  const f=fixture({values:[['jornada-smart-notebook-v78',JSON.stringify(legacy)]]});
  assert.equal(f.api.current().lastResult,null);assert(!f.node('#smartResult').innerHTML.includes('SEGREDO LEGADO'));
});
await check('geração válida usa conta, portal e fontes capturados',async()=>{
  const f=fixture();await f.api.runGeneration('tutor');assert.equal(f.calls.length,1);
  const request=f.calls[0];assert.equal(request.init.headers.Authorization,'Bearer token-a');assert.equal(request.body.campaign_id,'db-p');assert.deepEqual(request.body.document_titles,['PDF a']);assert(request.body.context.includes('Conteúdo privado de a'));
  assert.equal(f.api.current().lastResult.answer,'Resposta da conta A.');assert.deepEqual(Array.from(f.api.current().lastResult.sources),['PDF a']);assert.equal(f.node('#smartGuide').disabled,false);
});
await check('cache pertence a conta, portal e geração de reset, inclusive após recarregar',async()=>{
  const a=fixture();await a.api.runGeneration('guide');const stored=[...a.values];assert(stored.some(([key])=>key!=='jornada-smart-notebook-v78'));
  const reload=fixture({values:stored});assert.equal(reload.api.current().lastResult.answer,'Resposta da conta A.');
  change(reload,'account');assert.equal(reload.api.current().lastResult,null);assert(!reload.node('#smartResult').innerHTML.includes('Resposta da conta A.'));
  const reset=fixture({values:stored});change(reset,'reset');assert.equal(reset.api.current().lastResult,null);
  const portal=fixture({values:stored});change(portal,'portal');assert.equal(portal.api.current().lastResult,null);
});
await check('conta em carregamento, logout e convidado não consultam a IA nem exibem cache privado',async()=>{
  for(const type of ['loading','logout']){const f=fixture();await f.api.runGeneration('guide');change(f,type);const before=f.calls.length;await f.api.runGeneration('tutor');assert.equal(f.calls.length,before,type);assert(!f.node('#smartResult').innerHTML.includes('Resposta da conta A.'),type);}
  const guest=fixture();guest.ctx.state._ownerUserId='';guest.ctx.cloudSession=null;guest.api.renderSmart();await guest.api.runGeneration('tutor');assert.equal(guest.calls.length,0);
});

await check('carregamento de outra conta e convidado não mostram cobertura nem iniciam quiz privado',()=>{
  for(const type of ['loading','guest']){
    const f=fixture();f.ctx.ALL_QUESTIONS=[{subject:'DISCIPLINA PRIVADA A',statement:'Questão privada A',options:['Um','Dois'],correct_index:0}];
    f.ctx.missionPool=()=>[{id:'mission-a',subject:'DISCIPLINA PRIVADA A',name:'ASSUNTO PRIVADO A'}];let queried=0,shown=0;
    f.ctx.questionsForMode=()=>{queried++;return f.ctx.ALL_QUESTIONS;};f.ctx.balancedQuestions=items=>items;f.ctx.prepareQuestion=item=>item;f.ctx.showQuestion=()=>shown++;
    if(type==='loading')f.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};else{f.ctx.cloudSession=null;f.ctx.state._ownerUserId='';}
    f.api.renderSmart();assert(!f.node('#smartGaps').innerHTML.includes('DISCIPLINA PRIVADA A'),type);assert.equal(f.node('#smartQuiz').disabled,true,type);
    f.api.startAdaptiveQuiz();assert.equal(queried,0,type);assert.equal(shown,0,type);
  }
});
await check('respostas antigas são descartadas em sessão, HTTP e JSON após mudança de escopo',async()=>{
  for(const type of ['account','portal','reset','dbId','logout','loading'])for(const phase of ['session','fetch','json']){
    const f=fixture(),late=deferred();
    if(phase==='session')f.ctx.validSession=()=>late.promise;
    if(phase==='fetch')f.ctx.fetch=async(url,init)=>{f.calls.push({url,init,body:JSON.parse(init.body)});return late.promise;};
    if(phase==='json')f.ctx.fetch=async(url,init)=>{f.calls.push({url,init,body:JSON.parse(init.body)});return{ok:true,status:200,json:()=>late.promise};};
    const pending=f.api.runGeneration('tutor');await tick();change(f,type);
    const token={user:{id:'a'},access_token:'token-a'},answer={answer:'RESPOSTA ANTIGA PRIVADA',provider:'gemini'};
    late.resolve(phase==='session'?token:phase==='fetch'?{ok:true,status:200,json:async()=>answer}:answer);await pending;
    assert(!hasPrivate(f.values,'RESPOSTA ANTIGA PRIVADA'),type+'/'+phase);assert(!f.node('#smartResult').innerHTML.includes('RESPOSTA ANTIGA PRIVADA'),type+'/'+phase);
    assert(!f.messages.some(message=>message.includes('RESPOSTA ANTIGA PRIVADA')),type+'/'+phase);
  }
});
await check('pedido antigo não mantém bloqueio no contexto novo nem libera uma operação mais nova',async()=>{
  const f=fixture(),a=deferred(),b=deferred();
  f.ctx.fetch=async(url,init)=>{f.calls.push({url,init,body:JSON.parse(init.body)});return f.calls.length===1?a.promise:b.promise;};
  const first=f.api.runGeneration('tutor');await tick();assert.equal(f.node('#smartGuide').disabled,true);
  change(f,'account');assert.equal(f.node('#smartGuide').disabled,false,'A conta nova deve poder iniciar sua chamada.');
  f.node('#smartQuestion').value='Pergunta da conta B';const second=f.api.runGeneration('tutor');await tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].init.headers.Authorization,'Bearer token-b');assert.equal(f.node('#smartGuide').disabled,true);
  a.resolve({ok:true,status:200,json:async()=>({answer:'ANTIGA A',provider:'gemini'})});await first;assert.equal(f.node('#smartGuide').disabled,true,'finally antigo não libera operação B.');assert(!hasPrivate(f.values,'ANTIGA A'));
  b.resolve({ok:true,status:200,json:async()=>({answer:'ATUAL B',provider:'gemini'})});await second;assert.equal(f.node('#smartGuide').disabled,false);assert.equal(f.api.current().lastResult.answer,'ATUAL B');
});
await check('cliques repetidos produzem uma só chamada e preservam pergunta nova digitada',async()=>{
  const f=fixture(),late=deferred();f.ctx.fetch=async(url,init)=>{f.calls.push({url,init,body:JSON.parse(init.body)});return late.promise;};
  const first=f.api.runGeneration('tutor');await tick();await f.api.runGeneration('tutor');assert.equal(f.calls.length,1);
  f.node('#smartQuestion').value='Outra pergunta para depois';late.resolve({ok:true,status:200,json:async()=>({answer:'Resposta da primeira'})});await first;assert.equal(f.node('#smartQuestion').value,'Outra pergunta para depois');
});
await check('assinatura considera conteúdo editado e não apenas data ou nome do arquivo',async()=>{
  const f=fixture();await f.api.runGeneration('guide');assert.equal(f.calls.length,1);await f.api.runGeneration('guide');assert.equal(f.calls.length,1,'Mesma fonte usa cache.');
  f.ctx.ALL_SUMMARIES[0].explanation+=' Conteúdo corrigido sem alterar updated_at.';f.api.renderSmart();await f.api.runGeneration('guide');assert.equal(f.calls.length,2,'Conteúdo corrigido exige resposta nova.');
});
await check('resultado antigo não reaparece após mudança nas fontes ou no texto selecionado',async()=>{
  for(const type of ['content','title','selection']){
    const f=fixture();await f.api.runGeneration('guide');assert(f.node('#smartResult').innerHTML.includes('Resposta da conta A.'));
    if(type==='content')f.ctx.ALL_SUMMARIES[0].explanation='Texto de origem revisado sem mudar updated_at.';
    if(type==='title')f.ctx.cloudDocuments[0].title='Novo título do PDF';
    if(type==='selection'){f.api.current().sources=[];f.api.current().manualEmpty=true;}
    f.api.renderSmart();assert(!f.node('#smartResult').innerHTML.includes('Resposta da conta A.'),type);
  }
});
await check('trocar fonte durante chamada não rotula a resposta com o novo PDF',async()=>{
  const f=fixture(),late=deferred();f.ctx.cloudDocuments.push({...f.ctx.cloudDocuments[0],id:'doc-two',title:'PDF dois'});f.ctx.ALL_SUMMARIES.push({...f.ctx.ALL_SUMMARIES[0],id:'summary-two',documentId:'doc-two',source:'PDF dois',explanation:'Segundo material'});
  f.api.current().sources=['doc-a'];f.api.current().manualEmpty=false;f.api.persist();f.api.renderSmart();
  f.ctx.fetch=async(url,init)=>{f.calls.push({url,init,body:JSON.parse(init.body)});return late.promise;};const pending=f.api.runGeneration('guide');await tick();
  f.api.current().sources=['doc-two'];f.api.persist();f.api.renderSmart();late.resolve({ok:true,status:200,json:async()=>({answer:'RESPOSTA SOMENTE FONTE A'})});await pending;
  const result=f.api.current().lastResult;if(result?.answer==='RESPOSTA SOMENTE FONTE A')assert.deepEqual(Array.from(result.sources),['PDF a']);
  assert(!f.node('#smartResult').innerHTML.includes('RESPOSTA SOMENTE FONTE A'),'Uma resposta de fontes anteriores não é exibida na seleção nova.');
});
await check('quota de armazenamento não causa sucesso de persistência falso nem trava o caderno',async()=>{
  const f=fixture({quota:true});await f.api.runGeneration('guide');assert.equal(f.calls.length,1);assert.equal(f.node('#smartGuide').disabled,false);
  assert.equal(f.values.size,0);assert(f.messages.some(message=>/armazenamento|salv|mem[oó]ria|sess[aã]o/i.test(message))||/armazenamento|salv|mem[oó]ria|sess[aã]o/i.test(f.node('#smartMessage').textContent));
});
await check('storage corrompido, malformado ou grande demais não impede abrir o painel',async()=>{
  const seed=fixture();await seed.api.runGeneration('guide');const stored=[...seed.values];assert(stored.length);
  const poison=(value,mode)=>{if(!value||typeof value!=='object')return;for(const child of Object.values(value))poison(child,mode);if(Object.hasOwn(value,'lastResult')){if(mode==='large'){if(value.lastResult)value.lastResult.answer='x'.repeat(3*1024*1024);}else{value.lastResult={answer:{invalid:true},sources:null,question:'Resultado inválido'};value.cache=[];value.sources='não é lista';value.subject={invalid:true};}}};
  for(const mode of ['invalid-json','malformed','large']){
    const values=stored.map(([key,raw])=>{if(mode==='invalid-json')return[key,'{json inválido'];const parsed=JSON.parse(raw);poison(parsed,mode);return[key,JSON.stringify(parsed)];});
    const f=fixture({values});assert.doesNotThrow(()=>f.api.renderSmart(),mode);assert(JSON.stringify(f.api.current()).length<1024*1024,'Payload excessivo deve ser recusado/limitado.');
    const item=f.api.current().lastResult;assert(!item||(typeof item.answer==='string'&&Array.isArray(item.sources)),mode);
  }
});
await check('fontes e material de outra conta ou portal não são selecionados',()=>{
  const f=fixture();for(const other of [{user_id:'b',campaign_id:'db-p',id:'foreign-user'},{user_id:'a',campaign_id:'db-other',id:'foreign-portal'}]){
    f.ctx.cloudDocuments.push({...f.ctx.cloudDocuments[0],...other,title:'Documento alheio'});f.ctx.ALL_SUMMARIES.push({...f.ctx.ALL_SUMMARIES[0],documentId:other.id,user_id:other.user_id,campaign_id:other.campaign_id,source:'Documento alheio'});
  }
  f.api.renderSmart();const available=Array.from(f.api.readySources(),doc=>doc.id);assert.deepEqual(available,['doc-a']);const ids=Array.from(f.api.selectedSources(),doc=>doc.id);assert.deepEqual(ids,['doc-a']);
});
await check('fontes explicitamente compartilhadas continuam permitidas e a seleção inicial respeita cinco PDFs',()=>{
  const f=fixture();f.ctx.cloudDocuments.push({...f.ctx.cloudDocuments[0],id:'community',title:'PDF compartilhado',user_id:'b',campaign_id:'other-db',is_community:true});f.ctx.ALL_SUMMARIES.push({...f.ctx.ALL_SUMMARIES[0],documentId:'community',source:'PDF compartilhado'});
  for(let i=0;i<8;i++){const id='own-'+i;f.ctx.cloudDocuments.push({...f.ctx.cloudDocuments[0],id,title:'PDF '+i});f.ctx.ALL_SUMMARIES.push({...f.ctx.ALL_SUMMARIES[0],documentId:id,source:'PDF '+i});}
  assert(Array.from(f.api.readySources(),d=>d.id).includes('community'));
  f.api.current().sources=[];f.api.current().manualEmpty=false;f.api.renderSmart();assert.equal(f.api.selectedSources().length,5);
  f.api.current().sources=[];f.api.current().manualEmpty=true;f.api.renderSmart();assert.equal(f.api.selectedSources().length,0,'Limpar a seleção não a preenche de novo automaticamente.');
});
await check('troca de conta limpa a pergunta e o quiz fica restrito às fontes atuais',()=>{
  const f=fixture();f.node('#smartQuestion').value='PERGUNTA PRIVADA DA CONTA A';change(f,'account');assert.equal(f.node('#smartQuestion').value,'');
  const item=(documentId,statement)=>({documentId,subject:'Língua Portuguesa',statement,options:['Um','Dois'],correct_index:0,difficulty:'facil'});
  f.ctx.ALL_QUESTIONS=[item('doc-a','Questão privada antiga A'),item('doc-b','Questão atual B'),{...item('doc-b','Sem vínculo de fonte'),documentId:undefined}];
  f.ctx.activeQuestions=null;f.ctx.questionsForMode=()=>f.ctx.ALL_QUESTIONS;f.ctx.balancedQuestions=(items,count)=>items.slice(0,count);f.ctx.prepareQuestion=item=>({...item});let shown=0;f.ctx.showQuestion=()=>shown++;
  f.api.renderSmart();assert.equal(f.node('#smartQuiz').disabled,false);f.api.startAdaptiveQuiz();assert.equal(shown,1);
  assert.equal(f.ctx.activeQuestions.questions.length,1);assert.equal(f.ctx.activeQuestions.questions[0].statement,'Questão atual B');assert.equal(f.ctx.activeQuestions.questions[0].documentId,'doc-b');
  f.ctx.ALL_QUESTIONS=[item('doc-a','Questão antiga A')];f.api.renderSmart();assert.equal(f.node('#smartQuiz').disabled,true);
  shown=0;f.api.startAdaptiveQuiz();assert.equal(shown,0,'Pool antigo de outro PDF não inicia o quiz do contexto B.');
});
await check('renovação de sessão mantém a conta original e utiliza o token renovado',async()=>{
  const f=fixture();f.ctx.validSession=async()=>({user:{id:'a'},access_token:'token-a-renovado'});await f.api.runGeneration('guide');assert.equal(f.calls[0].init.headers.Authorization,'Bearer token-a-renovado');assert.equal(f.api.current().lastResult.answer,'Resposta da conta A.');
  const other=fixture();other.ctx.validSession=async()=>({user:{id:'b'},access_token:'token-b'});await other.api.runGeneration('guide');assert.equal(other.calls.length,0);assert.equal(other.api.current().lastResult,null);assert.equal(other.node('#smartGuide').disabled,false);
});
await check('falha de rede ou resposta vazia libera controles e permite tentar novamente',async()=>{
  for(const mode of ['network','empty']){
    const f=fixture();const original=f.ctx.fetch;f.ctx.fetch=async()=>{if(mode==='network')throw new Error('Rede indisponível');return{ok:true,status:200,json:async()=>({answer:''})};};
    await f.api.runGeneration('guide');assert.equal(f.node('#smartGuide').disabled,false);assert.equal(f.api.current().lastResult,null);
    f.ctx.fetch=original;await f.api.runGeneration('guide');assert.equal(f.api.current().lastResult.answer,'Resposta da conta A.');
  }
});
if(failures.length){for(const {name,error} of failures)console.error(name+'\n'+error.stack);console.error(`${total-failures.length}/${total} grupos passaram.`);process.exitCode=1;}else console.log(`OK r185 Caderno IA: ${total} grupos; cache por conta/portal/reset, snapshots, respostas tardias, concorrência, fontes e falhas.`);
