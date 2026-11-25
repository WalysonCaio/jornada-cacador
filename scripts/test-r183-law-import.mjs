// Fluxo real de importação oficial: integridade, persistência e leitura paginada sem navegador.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
const source=fs.readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const code=section('  const LAWS_FAV_KEY =','  function getAppStateSafe()')+
 section('  let lawsFilterFavOnly =','  function switchStudySubtab(')+
 section('  function mountCaveiraSmartLawsHub()','  // 6) Pílulas Rápidas')+
 section('  async function syncAllLawsToUserDatabase(','  // Conferência estrutural');
const hash=articles=>createHash('sha256').update(JSON.stringify(articles)).digest('hex');
function documentLaw(count=1250,size=50){
 const articles=Array.from({length:count},(_,i)=>`Art. ${i+1}. MARCADOR_${String(i).padStart(5,'0')}: ${'texto de teste '.repeat(Math.ceil(size/15))}`);
 return{id:'official-cf88',law_id:'cf88',title:'Constituição Federal de teste',discipline:'Direito Constitucional',articles,content_kind:'official_document_extraction',full_document:true,source_url:'https://www2.camara.leg.br/legin/teste.html',sourceName:'Câmara dos Deputados',source_version:'2026-11-20-teste',retrieved_at:'2026-11-20T12:00:00.000Z',content_hash:hash(articles)};
}
function indexedFixture(records=new Map()){
 let initialized=false;
 return{records,open(){const req={};queueMicrotask(()=>{req.result={objectStoreNames:{contains:()=>initialized},createObjectStore:()=>{initialized=true;},close(){},transaction(){const tx={};tx.objectStore=()=>({get(key){const operation={};queueMicrotask(()=>{operation.result=records.has(key)?structuredClone(records.get(key)):undefined;operation.onsuccess?.();tx.oncomplete?.();});return operation;},put(record){const copy=structuredClone(record);queueMicrotask(()=>{records.set(copy.key,copy);tx.oncomplete?.();});return{};}});return tx;}};if(!initialized)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
function fixture({database}={}){
 const values=new Map(),messages=[],calls=[],requests=[];
 const ctx={window:{toast:message=>messages.push(message)},cloudSession:{user:{id:'a'},access_token:'token-a'},state:{_ownerUserId:'a',_resetEpoch:1,activeCampaignId:'portal-1'},navigator:{onLine:true},SUPABASE_URL:'https://project.supabase.co',URL,AbortController,setTimeout,clearTimeout,TextEncoder,crypto:webcrypto,
  localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},getAppStateSafe:()=>ctx.state,
  authHeaders:token=>({Authorization:`Bearer ${token}`}),fetch:async(url,options)=>{requests.push({url,options});return{ok:true,status:200,json:async()=>({law:documentLaw(),warnings:['Verifique a vigência na referência.']})};},cloudFetch:async(path,options={})=>{calls.push({path,options});return{ok:true,json:async()=>[]};}};
 if(database)ctx.indexedDB=database;
 vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,values,messages,calls,requests};
}
const f=fixture();
assert.equal(f.ctx.getAllLawsCombined().length,12,'As seleções anteriores permanecem disponíveis');
assert.equal((await f.ctx.importOfficialLawToLibrary('url-arbitraria')).status,'failed');
assert.equal(f.requests.length,0,'Não aceita IDs nem URLs fora do catálogo');
const imported=await f.ctx.importOfficialLawToLibrary('cf88');
assert.equal(imported.status,'synced');assert.equal(imported.law.articles.length,1250);
assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'https://project.supabase.co/functions/v1/leis-oficiais');assert.equal(f.requests[0].options.headers.Authorization,'Bearer token-a');assert.deepEqual(JSON.parse(f.requests[0].options.body),{law_id:'cf88'});
const rows=JSON.parse(f.calls.find(call=>call.options.method==='POST').options.body);
assert.equal(rows.length,1);assert.equal(rows[0].user_id,'a');assert.equal(rows[0].articles.length,1250);assert.equal(rows[0].metadata.full_document,true);assert.equal(rows[0].metadata.law_id,'cf88');assert.equal(rows[0].metadata.content_hash,hash(rows[0].articles));assert.equal(rows[0].metadata.fetchedAt,'2026-11-20T12:00:00.000Z');assert.deepEqual(rows[0].metadata.sourceWarnings,['Verifique a vigência na referência.']);
assert.equal(f.ctx.getAllLawsCombined().length,13,'Importar não remove as seleções locais');
assert.match(imported.law.coverage,/não certifica vigência/);
// Outra sessão/dispositivo mantém classificação oficial, metadados e até o último bloco.
const device=fixture();device.ctx.cloudFetch=async()=>({ok:true,json:async()=>rows});assert.equal(await device.ctx.loadLawsFromUserDatabase(),true);
const loaded=device.ctx.getAllLawsCombined().find(law=>law.id==='official-cf88');assert(loaded);assert.equal(loaded.articles.length,1250);assert.equal(loaded.full_document,true);assert.equal(loaded.law_id,'cf88');assert.equal(loaded.content_hash,rows[0].metadata.content_hash);assert.equal(loaded.sourceVersion,rows[0].source_version);assert.equal(loaded.sourceUrl,rows[0].source_url);assert.equal(loaded.fetchedAt,rows[0].metadata.fetchedAt);assert.deepEqual(Array.from(loaded.sourceWarnings),rows[0].metadata.sourceWarnings);assert.match(loaded.coverage,/Imagens, OCR e anexos externos não são incluídos/);
// Paginação desenha apenas 60 blocos e conserva índices absolutos para os grifos.
vm.runInContext('lawReaderPage=0',device.ctx);const first=device.ctx.renderActiveLawReaderHtml(loaded);assert.equal((first.match(/data-law-highlight=/g)||[]).length,60);assert(first.includes('MARCADOR_00000'));assert(!first.includes('MARCADOR_00060'));assert(first.includes('Página 1/21'));assert(!first.includes('id="jcFetchLawComplementBtn"'),'Documento oficial não é misturado a complemento enciclopédico');
vm.runInContext('lawReaderPage=20',device.ctx);const last=device.ctx.renderActiveLawReaderHtml(loaded);assert.equal((last.match(/data-law-highlight=/g)||[]).length,50);assert(last.includes('MARCADOR_01249'));assert(last.includes('data-law-highlight="official-cf88:1249"'));assert(last.includes('Página 21/21'));
vm.runInContext('lawReaderPage=999',device.ctx);assert(device.ctx.renderActiveLawReaderHtml(loaded).includes('Página 21/21'),'Página fora do intervalo é limitada ao fim real');
// Texto e metadados vindos da fonte são sempre escapados.
const evil={...loaded,title:'<img src=x onerror=alert(1)>',articles:['<script>executar()</script> & texto'],sourceName:'<svg onload=alert(1)>',sourceUrl:'javascript:alert(1)'};const safe=device.ctx.renderActiveLawReaderHtml(evil);assert(!safe.includes('<script>'));assert(!safe.includes('<img'));assert(!safe.includes('<svg'));assert(!safe.includes('href="javascript:'));assert(safe.includes('&lt;script&gt;'));assert.equal(device.ctx.officialLawSource('https://www2.camara.leg.br.evil.test/a'),'');
// Integridade real e respostas inválidas não são anunciadas como documento integral.
for(const mutate of [law=>{law.articles.push('Texto adulterado depois do cálculo do hash');},law=>{law.source_url='https://evil.test/fonte';},law=>{law.full_document=false;},law=>{law.law_id='cp';}]){
 const invalid=fixture();invalid.ctx.fetch=async()=>{const law=documentLaw();mutate(law);return{ok:true,json:async()=>({law})};};const result=await invalid.ctx.importOfficialLawToLibrary('cf88');assert.equal(result.status,'failed');assert.equal(invalid.ctx.getAllLawsCombined().length,12);assert.equal(invalid.calls.length,0);
}
for(const setup of [ctx=>{ctx.cloudSession=null;ctx.state._ownerUserId='';},ctx=>{ctx.navigator.onLine=false;}]){const blocked=fixture();setup(blocked.ctx);assert.equal((await blocked.ctx.importOfficialLawToLibrary('cf88')).status,'failed');assert.equal(blocked.requests.length,0);}
const unavailable=fixture();unavailable.ctx.fetch=async()=>({ok:false,status:404,json:async()=>({error:'Não encontrada'})});assert.equal((await unavailable.ctx.importOfficialLawToLibrary('cf88')).status,'failed');assert.match(unavailable.messages.at(-1),/Publique a função/);assert.equal(unavailable.ctx.getAllLawsCombined().length,12);
// Cliques concorrentes compartilham uma única consulta, mas outra conta/portal/reset invalida a resposta antiga.
const dedup=fixture();let resolve;dedup.ctx.fetch=()=>new Promise(done=>resolve=done);const a=dedup.ctx.importOfficialLawToLibrary('cf88'),b=dedup.ctx.importOfficialLawToLibrary('cf88');resolve({ok:true,json:async()=>({law:documentLaw()})});await Promise.all([a,b]);assert.equal(dedup.calls.filter(call=>call.options.method==='POST').length,1);
const queued=fixture();const queueResolvers=[];queued.ctx.fetch=(url,options)=>new Promise(done=>queueResolvers.push({done,id:JSON.parse(options.body).law_id}));const one=queued.ctx.importOfficialLawToLibrary('cf88'),two=queued.ctx.importOfficialLawToLibrary('cp');assert.equal(queueResolvers.length,1,'A segunda importação aguarda a gravação da primeira');queueResolvers[0].done({ok:true,json:async()=>({law:documentLaw()})});await one;for(let tick=0;tick<20&&queueResolvers.length<2;tick++)await Promise.resolve();assert.equal(queueResolvers[1].id,'cp');queueResolvers[1].done({ok:true,json:async()=>({law:{...documentLaw(),id:'official-cp',law_id:'cp',title:'Código Penal'}})});assert.equal((await two).status,'synced');assert.equal(queued.calls.filter(call=>call.options.method==='POST').length,2);
for(const change of [ctx=>{ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.state._ownerUserId='b';},ctx=>{ctx.state.activeCampaignId='portal-2';},ctx=>{ctx.state._resetEpoch++;}]){
 const switching=fixture();let complete;switching.ctx.fetch=()=>new Promise(done=>complete=done);const pending=switching.ctx.importOfficialLawToLibrary('cf88');change(switching.ctx);complete({ok:true,json:async()=>({law:documentLaw()})});assert.equal((await pending).status,'cancelled');assert.equal(switching.calls.length,0);assert.equal(switching.messages.length,0);assert(!switching.ctx.getAllLawsCombined().some(law=>law.id==='official-cf88'));
}
// Livro maior que a cópia síncrona usa IndexedDB, inclusive quando localStorage está sem espaço.
const database=indexedFixture(),large=fixture({database});large.ctx.localStorage.setItem=()=>{throw new Error('quota');};const largeLaw=documentLaw(1250,600);large.ctx.fetch=async()=>{large.ctx.navigator.onLine=false;return{ok:true,json:async()=>({law:largeLaw})};};const local=await large.ctx.importOfficialLawToLibrary('cf88');assert.equal(local.status,'local_pending');assert.equal(local.localSaved,true);assert.equal(local.cloudSaved,0);assert.equal(database.records.size,1);
const offlineDevice=fixture({database:indexedFixture(database.records)});offlineDevice.ctx.navigator.onLine=false;assert.equal(await offlineDevice.ctx.loadLawsFromUserDatabase(),true);const offlineLaw=offlineDevice.ctx.getAllLawsCombined().find(law=>law.id==='official-cf88');assert.equal(offlineLaw.articles.length,1250);assert.equal(offlineLaw.articles.at(-1),largeLaw.articles.at(-1));assert.equal(offlineLaw.content_hash,largeLaw.content_hash);
const other=fixture({database:indexedFixture(database.records)});other.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};other.ctx.state._ownerUserId='b';other.ctx.navigator.onLine=false;await other.ctx.loadLawsFromUserDatabase();assert(!other.ctx.getAllLawsCombined().some(law=>law.id==='official-cf88'),'IndexedDB respeita proprietário/reset');
// Bindings da tela chamam as ações reais e o leitor muda de página sem renderizar o livro inteiro.
const ui=fixture();const panel={innerHTML:'',nodes:new Map(),querySelector(selector){return this.nodes.get(selector.slice(1))||null;},querySelectorAll(){return[];}};
Object.defineProperty(panel,'innerHTML',{get(){return this.html||'';},set(value){this.html=value;this.nodes=new Map([...value.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],{value:match[1]==='jcOfficialLawSelect'?'cf88':'',focus(){},setSelectionRange(){}}]));}});
ui.ctx.document={getElementById:id=>id==='laws'?panel:null};ui.ctx.applyLawUiScope();ui.ctx.activeLawModalItem=loaded;vm.runInContext('activeLawModalItem=globalThis.activeLawModalItem',ui.ctx);ui.ctx.renderSmartLawsPanelContent(panel);assert(panel.innerHTML.includes('jcOfficialLawSelect'));assert.equal(typeof panel.nodes.get('jcImportOfficialLawBtn').onclick,'function');assert.equal(typeof panel.nodes.get('jcImportAllOfficialLawsBtn').onclick,'function');assert(panel.innerHTML.includes('Página 1/21'));panel.nodes.get('jcLawReaderNextBtn').onclick();assert(panel.innerHTML.includes('Página 2/21'));assert(panel.innerHTML.includes('MARCADOR_00060'));assert(!panel.innerHTML.includes('MARCADOR_00000'));panel.nodes.get('jcLawReaderPrevBtn').onclick();assert(panel.innerHTML.includes('Página 1/21'));
console.log('OK r183 leis oficiais: catálogo, integridade SHA-256, 1.250 blocos preservados, metadados na nuvem, IndexedDB, paginação 60, escopo, falhas e escape.');
