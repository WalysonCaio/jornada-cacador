import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const pdf=readFileSync(new URL('../dist/pdf-text-client.js',import.meta.url),'utf8');
function part(text,a,b){const from=text.indexOf(a),to=text.indexOf(b,from);assert(from>=0&&to>from,a);return text.slice(from,to);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
const user='a',portal='pa',dbId='db-pa';
function fixture(){
 const doc={id:'doc-a',user_id:user,campaign_id:dbId,document_type:'edital',storage_path:'a/file.pdf',title:'Meu edital',processing_status:'pending'};
 const button={disabled:false},gate={hidden:true},calls=[],notices=[];
 const campaign={id:portal,dbId,name:'Portal A',customCampaign:{missions:[{id:'old'}]}};
 const ctx={state:{_ownerUserId:user,_resetEpoch:0,activeCampaignId:portal,campaigns:[campaign],customCampaign:campaign.customCampaign},cloudSession:{user:{id:user},access_token:'token-a'},cloudDocuments:[doc],window:{unpackEditalTopicsList:items=>items},console,
  $:selector=>selector==='#loginGate'?gate:button,activeCampaign:()=>campaign,
  validSession:async()=>({user:{id:user},access_token:'token-a'}),authHeaders:token=>({Authorization:`Bearer ${token}`}),
  cloudFetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({})};},
  fetch:async()=>({ok:true,json:async()=>({topics:[{subject:'Português',topic:'Crase'}],saved:1})}),
  save(){ctx.saves++;},saveSession(value){ctx.logouts++;ctx.cloudSession=value;},saves:0,logouts:0,renders:0,
  renderUserDocuments(){},render(){ctx.renders++;},loadCampaignTopics:async()=>{},loadCloudDocuments:async()=>{},loadGeneratedContent:async()=>{},
  progressNote:()=>'',reconcileMissionProgress:()=>{},canonicalSubjectName:value=>value,toast:message=>notices.push(message),setTimeout:()=>0,
  SUPABASE_URL:'https://supabase.test',Map,Set,Promise,
 };
 vm.createContext(ctx);return{ctx,doc,button,campaign,calls,notices};
}
const base=part(html,'async function processEditalDocument(id){','\nfunction applyServerState(');
for(const boundary of ['fetch','json','error']){
 const f=fixture(),started=deferred(),finish=deferred();
 f.ctx.fetch=async()=>{if(boundary==='json')return{ok:true,json:async()=>{started.resolve();return finish.promise;}};started.resolve();return finish.promise;};
 vm.runInContext(base,f.ctx);const task=f.ctx.processEditalDocument('doc-a');await started.promise;
 f.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};f.ctx.state={_ownerUserId:'b',activeCampaignId:'pb',_resetEpoch:0,customCampaign:{missions:[{id:'b-mission'}]}};f.ctx.cloudDocuments=[{id:'doc-b',processing_status:'ready'}];
 if(boundary==='json')finish.resolve({topics:[{subject:'Penal',topic:'Mapa antigo'}]});
 else if(boundary==='error')finish.reject(new Error('rede antiga'));
 else finish.resolve({ok:false,status:401,json:async()=>{throw new Error('Não deve ler JSON de outra conta');}});
 assert.equal(await task,false,boundary);assert.equal(f.ctx.logouts,0,'401 antigo não desconecta a conta nova');assert.equal(f.ctx.saves,0);assert.equal(f.ctx.renders,0);assert.equal(f.ctx.state.customCampaign.missions[0].id,'b-mission');
 assert.equal(f.calls.length,1,'não atualiza o erro do documento antigo após troca');
 assert.equal(f.calls[0].options.headers.Authorization,'Bearer token-a');
}
{
 const f=fixture(),started=deferred(),finish=deferred();f.ctx.fetch=async()=>({ok:true,json:async()=>{started.resolve();return finish.promise;}});
 vm.runInContext(base,f.ctx);const task=f.ctx.processEditalDocument('doc-a');await started.promise;f.ctx.state._resetEpoch=1;finish.resolve({topics:[{subject:'Português',topic:'Crase'}]});assert.equal(await task,false);assert.equal(f.ctx.saves,0,'reset descarta mapa pendente');
}
{
 const f=fixture();vm.runInContext(base,f.ctx);assert.equal(await f.ctx.processEditalDocument('doc-a'),true);assert.equal(f.ctx.saves,1);assert.equal(f.ctx.state.customCampaign.missions[0].name,'Crase');assert.equal(f.doc.processing_status,'ready');assert.equal(f.button.disabled,false);
}
{
 const f=fixture();f.doc.user_id='b';vm.runInContext(base,f.ctx);assert.equal(await f.ctx.processEditalDocument('doc-a'),false);assert.equal(f.calls.length,0,'documento de outra conta não dispara requisição');
}
const wrapper=part(pdf,'  const originalProcessDocument = processEditalDocument;','  const originalDeleteDocument');
for(const boundary of ['session','prepare','original']){
 const f=fixture(),started=deferred(),finish=deferred();f.doc.document_type='material';let prepared=0,original=0;
 f.ctx.window._activeProcessingDocs=new Set();f.ctx.window._extractedPagesByDocId=new Map();f.ctx.window._extractedPdfMetaByDocId=new Map();
 f.ctx.document={getElementById:()=>null,querySelector:()=>f.button};
 f.ctx.prepareDocumentText=async()=>{prepared++;if(boundary==='prepare'){started.resolve();await finish.promise;}};
 f.ctx.processEditalDocument=async()=>{original++;if(boundary==='original'){started.resolve();await finish.promise;}};
 if(boundary==='session')f.ctx.validSession=async()=>{started.resolve();return finish.promise;};
 vm.runInContext(wrapper,f.ctx);const task=f.ctx.processEditalDocument('doc-a');await started.promise;
 f.ctx.cloudSession={user:{id:'b'}};f.ctx.state._ownerUserId='b';f.button.disabled=true;
 finish.resolve(boundary==='session'?{user:{id:user},access_token:'token-a'}:true);
 assert.equal(await task,false,boundary);assert.equal(f.ctx.window._activeProcessingDocs.size,0,'operação antiga é retirada da fila');assert.equal(f.button.disabled,true,'finally antigo não habilita botão da outra conta');assert.equal(f.notices.length,0);if(boundary==='session')assert.equal(prepared,0);if(boundary!=='original')assert.equal(original,0);
}
// A leitura do mapa anterior não autoriza gravar no portal que foi aberto depois.
{
 const f=fixture(),started=deferred(),finish=deferred();f.ctx.window._extractedPdfMetaByDocId=new Map();f.ctx.window.unpackEditalTopicsList=items=>items;
 Object.assign(f.ctx,{isEditalType:()=>true,normalizeSearch:x=>String(x).toLowerCase(),sanitizeWatermarkText:String,INCIDENCE_ONLY_LINE_RE:/^never$/});
 f.ctx.cloudFetch=async(path,options)=>{f.calls.push({path,options});started.resolve();return{ok:true,json:async()=>finish.promise};};
 vm.runInContext(part(pdf,'  async function saveTopicsToCampaignAndSync(','  async function recoverPdfViaAssistant('),f.ctx);
 const task=f.ctx.saveTopicsToCampaignAndSync(f.doc,[{subject:'Português',topic:'Crase'}],{user:{id:user},access_token:'token-a'},2);await started.promise;f.ctx.state.activeCampaignId='pb';finish.resolve([]);
 assert.equal(await task,false);assert.equal(f.calls.length,1,'não chama RPC de gravação após mudar o portal durante leitura');assert.equal(f.ctx.saves,0);
}
console.log('OK r182: processamento de PDFs, 401 tardio, mapa, wrapper de extração e recuperação respeitam conta/portal/reset e token original.');
