// Exercita a função real: o upload nunca apaga o edital/mapa anterior e só limpa objetos novos sem referência confirmada.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b)}
const uploadCode=section('async function uploadStudyDocument(){','async function signedDocumentUrl(');
const campaignCode=section('async function syncCampaignRecord(','function documentCard(');
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const json=value=>({ok:true,json:async()=>value});
function fixture({type='edital',shared=true}={}){
 const calls=[],toasts=[],fields={
  '#documentFile':{files:[{name:'novo.pdf',type:'application/pdf',size:123}],value:'novo.pdf'},
  '#documentTitle':{value:'Novo documento'},'#documentType':{value:type},'#uploadDocument':{disabled:false},
  '#uploadMessage':{textContent:''},'#shareWithCommunityToggle':{checked:shared}
 };
 const campaign={id:'portal-a',dbId:'db-a',name:'Portal A'};
 const old={id:'old',campaign_id:'db-a',user_id:'a',document_type:'edital',storage_path:'a/db-a/antigo.pdf'};
 const ctx={state:{_ownerUserId:'a',activeCampaignId:'portal-a',_resetEpoch:1,campaigns:[campaign],settings:{dailyMinutes:180}},
  cloudSession:{user:{id:'a'},access_token:'token-a'},cloudDocuments:[old],window:{_recentUploadedPdfBytes:new Map()},
  SUPABASE_URL:'https://supabase.test',SUPABASE_KEY:'fixture-public',crypto:{randomUUID:()=> 'uuid'},
  $:s=>fields[s],standardizeDocumentTitle:x=>x,isEditalDocumentOrTitle:()=>false,databaseSetupMessage:e=>e.message,
  toast:m=>toasts.push(m),renderUserDocuments:()=>ctx.rendered++,rendered:0,save:()=>ctx.saved++,saved:0,
  processEditalDocument:async id=>{ctx.processed.push(id)},processed:[],activeCampaign:()=>campaign,
  validSession:async()=>ctx.cloudSession,ensureActiveCampaignRecord:async()=>campaign,
  cloudFetch:async(path,options={})=>{
   calls.push({kind:'rest',path,...options,body:options.body?JSON.parse(options.body):undefined});
   if(options.method==='POST'&&path==='study_documents')return json([{id:'new',campaign_id:'db-a',user_id:'a'}]);
   return json([]);
  },
  fetch:async(url,options={})=>{calls.push({kind:'fetch',url,...options});return json([])}
 };
 vm.createContext(ctx);vm.runInContext(uploadCode,ctx);
 return {ctx,calls,toasts,fields,old,campaign};
}
const storageDeletes=h=>h.calls.filter(c=>c.kind==='fetch'&&c.method==='DELETE');
const uploads=h=>h.calls.filter(c=>c.kind==='fetch'&&c.method==='POST');
const inserts=h=>h.calls.filter(c=>c.kind==='rest'&&c.path==='study_documents'&&c.method==='POST');
function preserved(h){assert.equal(h.ctx.cloudDocuments.includes(h.old),true);assert(!h.calls.some(c=>c.kind==='rest'&&c.method==='DELETE'),'Nenhuma exclusão de registros ou tópicos');assert(storageDeletes(h).every(c=>c.url.endsWith('a/db-a/uuid-novo.pdf')),'Limpeza só pode atingir o novo caminho');}
// Um edital já existente é confirmado no servidor mesmo com lista local vazia; nenhum upload/exclusão ocorre.
{
 const h=fixture();h.ctx.cloudDocuments=[];
 h.ctx.cloudFetch=async(path,options={})=>{h.calls.push({kind:'rest',path,...options});assert(path.includes('user_id=eq.a')&&path.includes('campaign_id=eq.db-a'));assert.equal(options.headers.Authorization,'Bearer token-a');return json([{id:'old'}])};
 assert.equal(await h.ctx.uploadStudyDocument(),false);assert.equal(uploads(h).length,0);assert.equal(storageDeletes(h).length,0);assert.match(h.fields['#uploadMessage'].textContent,/preservados.*outro portal/i);assert.equal(h.fields['#uploadDocument'].disabled,false);
}
// Falha no Storage remove, quando necessário, somente o objeto novo; o mapa e edital antigo permanecem.
{
 const h=fixture();h.ctx.fetch=async(url,options={})=>{h.calls.push({kind:'fetch',url,...options});return options.method==='POST'?{ok:false,json:async()=>({error:'Falha no Storage'})}:json([])};
 assert.equal(await h.ctx.uploadStudyDocument(),false);assert.equal(inserts(h).length,0);assert.equal(storageDeletes(h).length,1);preserved(h);assert.match(h.fields['#uploadMessage'].textContent,/Falha no Storage/);
}
// Falha no insert (inclusive conflito de corrida) só limpa o objeto novo após verificar ausência de referência.
for(const failure of ['Falha ao registrar','duplicate key violates one_edital_per_campaign_idx']){
 const h=fixture(),original=h.ctx.cloudFetch;
 h.ctx.cloudFetch=async(path,options={})=>{if(path==='study_documents'&&options.method==='POST'){h.calls.push({kind:'rest',path,...options});throw new Error(failure)}return original(path,options)};
 assert.equal(await h.ctx.uploadStudyDocument(),false);assert.equal(storageDeletes(h).length,1);preserved(h);
 assert(h.calls.some(c=>c.kind==='fetch'&&c.url.includes('/rest/v1/study_documents?')&&c.url.includes('storage_path=eq.a%2Fdb-a%2Fuuid-novo.pdf')));
 if(failure.includes('one_edital'))assert.match(h.fields['#uploadMessage'].textContent,/preservados.*outro portal/i);
}
// Se o insert foi aceito, erros de JSON, render ou análise não podem excluir o PDF referenciado.
for(const stage of ['json','render','processing']){
 const h=fixture({type:'apostila'}),original=h.ctx.cloudFetch;
 if(stage==='json')h.ctx.cloudFetch=async(path,options={})=>path==='study_documents'&&options.method==='POST'?{ok:true,json:async()=>{throw new Error('resposta interrompida')}}:original(path,options);
 if(stage==='render')h.ctx.renderUserDocuments=()=>{throw new Error('render falhou')};
 if(stage==='processing')h.ctx.processEditalDocument=async()=>{throw new Error('fila indisponível')};
 await h.ctx.uploadStudyDocument();await tick();preserved(h);assert.equal(storageDeletes(h).length,0,stage);
 if(stage==='processing')assert.match(h.fields['#uploadMessage'].textContent,/Arquivo salvo.*análise/i);
}
// Timeout da requisição de insert pode esconder commit. Não remover o arquivo quando a verificação encontra a linha ou falha.
for(const verification of ['found','unavailable']){
 const h=fixture({type:'apostila'});
 h.ctx.cloudFetch=async()=>{throw new Error('Resposta interrompida')};
 h.ctx.fetch=async(url,options={})=>{
  h.calls.push({kind:'fetch',url,...options});
  if(url.includes('/rest/v1/study_documents?')){
   if(verification==='unavailable')throw new Error('rede indisponível');
   return json([{id:'new'}]);
  }
  return json([]);
 };
 assert.equal(await h.ctx.uploadStudyDocument(),false);assert.equal(storageDeletes(h).length,0);preserved(h);
 if(verification==='unavailable')assert.match(h.fields['#uploadMessage'].textContent,/confirmar.*preservado.*antes de reenviar/i);
}
// Preferência da biblioteca é preservada; edital sempre privado e anotação registra conclusão apenas no escopo atual.
for(const [type,shared,expected]of [['edital',true,false],['apostila',true,true],['apostila',false,false],['anotacao',true,true]]){
 const h=fixture({type,shared});assert.equal(await h.ctx.uploadStudyDocument(),true);await tick();
 assert.equal(inserts(h)[0].body.share_with_community,expected);assert.equal(inserts(h)[0].body.metadata.private_only,!expected);
 assert.equal(h.ctx.cloudDocuments[0].id,'new');assert.deepEqual(Array.from(h.ctx.processed),['new']);assert.equal(storageDeletes(h).length,0);preserved(h);
 if(type==='anotacao')assert.equal(h.ctx.state.dailyTracker.summaryCreated,true);
}
// Troca de conta/portal/reset durante leitura/upload não grava no novo escopo nem usa o token de outra conta para limpar.
for(const stage of ['existing','upload'])for(const change of ['account','portal','reset']){
 const h=fixture(),pending=deferred(),original=h.ctx.cloudFetch;
 if(stage==='existing')h.ctx.cloudFetch=()=>pending.promise;
 else h.ctx.fetch=async(url,options={})=>{h.calls.push({kind:'fetch',url,...options});return options.method==='POST'?pending.promise:json([])};
 const task=h.ctx.uploadStudyDocument();await tick();
 if(change==='account'){h.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};h.ctx.state={_ownerUserId:'b',activeCampaignId:'portal-a',_resetEpoch:1}}
 if(change==='portal')h.ctx.state.activeCampaignId='portal-b';
 if(change==='reset')h.ctx.state._resetEpoch=2;
 h.fields['#uploadMessage'].textContent='Nova tela';const count=h.toasts.length;
 pending.resolve(json([]));assert.equal(await task,false);assert.equal(inserts(h).length,0);assert.equal(h.fields['#uploadMessage'].textContent,'Nova tela');assert.equal(h.toasts.length,count);
 assert(storageDeletes(h).every(c=>c.headers.Authorization==='Bearer token-a'));preserved(h);
}
// Troca após POST do registro: a linha e seu PDF permanecem, sem atualizar os dados locais de B.
{
 const h=fixture({type:'apostila'}),pending=deferred();h.ctx.cloudFetch=()=>pending.promise;
 const task=h.ctx.uploadStudyDocument();await tick();h.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};h.ctx.state={_ownerUserId:'b',activeCampaignId:'portal-a',_resetEpoch:1};h.ctx.cloudDocuments=[{id:'b-doc'}];
 pending.resolve(json([{id:'new',user_id:'a',campaign_id:'db-a'}]));assert.equal(await task,false);assert.deepEqual(Array.from(h.ctx.cloudDocuments,x=>x.id),['b-doc']);assert.equal(storageDeletes(h).length,0);
}
// syncCampaignRecord e ensureActiveCampaignRecord não aplicam criação/edição antiga a outra conta ou redefinição.
for(const change of ['account','portal','reset']){
 const h=fixture(),pending=deferred();delete h.campaign.dbId;
 h.ctx.reconcileCloudCampaigns=async()=>{};h.ctx.cloudFetch=()=>pending.promise;
 vm.runInContext(campaignCode,h.ctx);
 const task=h.ctx.syncCampaignRecord(h.campaign);await tick();
 if(change==='account'){h.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};h.ctx.state._ownerUserId='b'}
 if(change==='portal')h.ctx.state.activeCampaignId='portal-b';
 if(change==='reset')h.ctx.state._resetEpoch=2;
 pending.resolve(json([{id:'new-campaign'}]));assert.equal(await task,null);assert.equal(h.campaign.dbId,undefined);assert.equal(h.ctx.saved,0);
}
console.log('OK r182: upload preserva edital/mapa, consulta servidor, limpa apenas objetos novos sem referência, protege commits/erros de análise e mantém escopo e compartilhamento.');
