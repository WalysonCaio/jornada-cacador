// Funções reais de leis: cópia por conta, leitura/hidratação, conteúdo salvo e falhas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const code=section("  const LAWS_FAV_KEY =",'  function getAppStateSafe()')+
 section('  let lawsFilterFavOnly =','  function switchStudySubtab(')+
 section('  function mountCaveiraSmartLawsHub()','  // 6) Pílulas Rápidas')+
 section('  async function syncAllLawsToUserDatabase(','  // Conferência estrutural');
const law={id:'ext-law-test',discipline:'Direito',title:'Seleção de teste',articles:['Primeiro dispositivo com conteúdo para leitura.'],content_kind:'external_excerpt',sourceUrl:'https://pt.wikisource.org/wiki/Teste',sourceName:'Wikisource · conferir fonte'};
function fixture(){
 const values=new Map(),messages=[],calls=[];
 const ctx={window:{toast:message=>messages.push(message)},cloudSession:{user:{id:'a'},access_token:'fixture-a'},state:{_ownerUserId:'a',_resetEpoch:1,activeCampaignId:'p1'},navigator:{onLine:true},URL,AbortController,setTimeout,clearTimeout,
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},getAppStateSafe:()=>ctx.state,
  authHeaders:token=>({Authorization:'Bearer '+token}),cloudFetch:async(path,options={})=>{calls.push({path,options});return{ok:true,json:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,values,messages,calls};
}
const base=fixture();
assert.equal(base.ctx.getAllLawsCombined().length,12);
assert.match(base.ctx.getAllLawsCombined()[0].title,/seleção dos arts\. 1º a 5º/);
assert.match(base.ctx.getAllLawsCombined()[0].coverage,/não é texto integral/);
assert.equal(base.ctx.saveCustomImportedLaw(law),true);
assert.equal(base.ctx.setFavLaws([law.id]),true);
base.ctx.toggleHighlightArticle(law.id+':0');
const originalKey=[...base.values.keys()].find(key=>key.includes('custom_external'));
base.ctx.cloudSession={user:{id:'b'},access_token:'fixture-b'};base.ctx.state._ownerUserId='b';
assert.equal(base.ctx.getCustomImportedLaws().length,0);assert.equal(base.ctx.getFavLaws().length,0);assert.equal(Object.keys(base.ctx.getHighlightedArticles()).length,0);
assert(base.values.has(originalKey),'Outra conta não apaga o conteúdo da anterior');
base.ctx.cloudSession={user:{id:'a'},access_token:'fixture-a'};base.ctx.state._ownerUserId='a';
assert.equal(base.ctx.getCustomImportedLaws().length,1);
base.ctx.state._resetEpoch=2;assert.equal(base.ctx.getCustomImportedLaws().length,0,'Reset não recupera cache antigo');
base.ctx.state._resetEpoch=1;
base.ctx.saveExternalFullTextCache(law.id,{paragraphs:['Complemento externo realmente exibido.'],source:'Fonte externa de teste',sourceUrl:'https://pt.wikisource.org/wiki/Teste',fetchedAt:'2026-11-17',truncated:true});
const saved=await base.ctx.syncAllLawsToUserDatabase(true,law.id);
assert.equal(saved.status,'synced');assert.equal(saved.cloudSaved,1);
const post=base.calls.find(call=>call.options.method==='POST');assert.equal(post.path,'study_laws_bank?on_conflict=user_id,id');
const rows=JSON.parse(post.options.body);assert.equal(rows.length,1);assert.equal(rows[0].user_id,'a');assert.deepEqual(rows[0].articles,[...law.articles,'Complemento externo realmente exibido.']);assert.equal(rows[0].metadata.external.truncated,true);assert.equal(post.options.headers.Authorization,'Bearer fixture-a');
assert(base.messages.at(-1).includes('na conta e neste aparelho'));assert(!base.messages.at(-1).includes('100%'));
// Outro dispositivo hidrata exatamente o conteúdo confirmado na conta.
const device=fixture();device.ctx.cloudFetch=async()=>({ok:true,json:async()=>rows});
assert.equal(await device.ctx.loadLawsFromUserDatabase(),true);
const hydrated=device.ctx.getAllLawsCombined().find(item=>item.id===law.id);assert(hydrated);assert.deepEqual(Array.from(hydrated.articles),rows[0].articles);
assert.equal(hydrated.sourceUrl,law.sourceUrl);
// GET antigo não pode atingir conta/portal/reset novos, nem apaga edição feita durante leitura.
for(const change of [c=>{c.state._ownerUserId='b';c.cloudSession={user:{id:'b'},access_token:'fixture-b'}},c=>c.state.activeCampaignId='p2',c=>c.state._resetEpoch++]){
 const f=fixture();let resolve;f.ctx.cloudFetch=()=>new Promise(r=>resolve=r);const pending=f.ctx.loadLawsFromUserDatabase();change(f.ctx);resolve({ok:true,json:async()=>rows});assert.equal(await pending,false);assert(!f.ctx.getCustomImportedLaws().length);
}
const editing=fixture();let complete;editing.ctx.cloudFetch=()=>new Promise(r=>complete=r);const pendingLoad=editing.ctx.loadLawsFromUserDatabase();editing.ctx.saveCustomImportedLaw({...law,title:'Edição local durante carregamento'});complete({ok:true,json:async()=>rows});await pendingLoad;assert.equal(editing.ctx.getAllLawsCombined().find(item=>item.id===law.id).title,'Edição local durante carregamento');
// Quota e rede falhando não produzem sucesso; memória não é anunciada como persistência.
const failed=fixture();failed.ctx.localStorage.setItem=()=>{throw new Error('quota')};failed.ctx.cloudFetch=async()=>{throw new Error('offline')};const failure=await failed.ctx.syncAllLawsToUserDatabase(true);assert.equal(failure.status,'failed');assert.equal(failure.localSaved,false);assert.equal(failure.cloudSaved,0);assert.match(failed.messages.at(-1),/Não foi possível salvar/);
const offline=fixture();offline.ctx.navigator.onLine=false;const local=await offline.ctx.syncAllLawsToUserDatabase();assert.equal(local.status,'local_pending');assert.match(offline.messages.at(-1),/sincronização pendente/);assert.equal(offline.calls.length,0);
const cloudOnly=fixture();cloudOnly.ctx.localStorage.setItem=()=>{throw new Error('quota')};assert.equal((await cloudOnly.ctx.syncAllLawsToUserDatabase()).status,'cloud_only');assert.match(cloudOnly.messages.at(-1),/cópia local não pôde/);
// POST antigo não anuncia sucesso na conta atual.
const switching=fixture();let resolvePost;switching.ctx.cloudFetch=()=>new Promise(r=>resolvePost=r);const upload=switching.ctx.syncAllLawsToUserDatabase();switching.ctx.cloudSession={user:{id:'b'},access_token:'fixture-b'};switching.ctx.state._ownerUserId='b';resolvePost({ok:true});assert.equal((await upload).status,'cancelled');assert.equal(switching.messages.length,0);
// Texto importado é escapado em todos os pontos do leitor/painel.
const xss=fixture();const evil={...law,title:'<img src=x onerror=alert(1)>',discipline:'<script>bad()</script>',articles:['<img src=x onerror=alert(1)>'],sourceName:'<svg onload=alert(1)>',sourceUrl:'javascript:alert(1)'};
const html=xss.ctx.renderActiveLawReaderHtml(evil);assert(!html.includes('<img'));assert(!html.includes('<script'));assert(!html.includes('<svg'));assert(!html.includes('href="javascript:'));assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));assert(!/texto completo|texto integral importado/i.test(html));
assert.equal(xss.ctx.safeLawUrl('https://pt.wikipedia.org.evil.test/a'),'');assert.equal(xss.ctx.safeLawUrl('https://user@pt.wikipedia.org/a'),'');
const panel={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};xss.ctx.document={getElementById:()=>null};xss.ctx.saveCustomImportedLaw(evil);xss.ctx.applyLawUiScope();vm.runInContext("lawsSearchQuery='<img>';",xss.ctx);xss.ctx.renderSmartLawsPanelContent(panel);assert(!panel.innerHTML.includes('<img'));assert(panel.innerHTML.includes('&lt;img'));
// Iniciar/abrir uma view só lê a conta; nenhuma gravação automática permanece.
assert(!source.includes('    syncAllLawsToUserDatabase(false);'));assert(source.includes('    loadLawsFromUserDatabase(false);'));
console.log('OK r182 leis: escopo, persistência real, conteúdo complementar, hidratação, respostas tardias, falhas e escape de texto.');
