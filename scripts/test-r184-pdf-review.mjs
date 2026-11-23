// Exercita a extração fresca e o encaminhamento das provas sem substituir conteúdo ativo.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/pdf-text-client.js',import.meta.url),'utf8');
const part=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,a);return source.slice(start,end);};
const later=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture({count=2,fail=[],empty=[],sidecar=null}={}){
 const calls=[],notices=[],pagesLoaded=[];
 const doc={id:'doc-a',user_id:'a',campaign_id:'db-p',storage_path:'a/original.pdf',document_type:'prova',title:'Prova completa'};
 const ctx={Map,Set,Uint8Array,Date,Promise,console:{warn(){},info(){}},setTimeout:fn=>{fn();return 1;},clearTimeout(){},
  state:{_ownerUserId:'a',activeCampaignId:'p',_resetEpoch:0},cloudSession:{user:{id:'a'},access_token:'token-a'},
  window:{_extractedPagesByDocId:new Map(),_extractedPdfMetaByDocId:new Map(),_recentUploadedPdfBytes:new Map()},
  toast:m=>notices.push(m),withTimeout:async promise=>promise,
  EMAIL_LINE_RE:/^[^\s@]+@[^\s@]+\.[^\s@]+$/i,CPF_LINE_RE:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  INCIDENCE_ONLY_LINE_RE:/^(?:alta|média|baixa)$/i,TABLE_CHROME_LINE_RE:/^nunca$/i,
  storageFetch:async(path,session,options={})=>{calls.push({path,session,options});return path.endsWith('.text.json')&&!options.method?{ok:!!sidecar,json:async()=>sidecar}:{ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};},
  sidecarAlreadyExists:async(path,session)=>{calls.push({path:path+'.text.json',session,sidecar:true});return sidecar;},
 };
 const pdf={numPages:count,destroyed:0,destroy:async()=>pdf.destroyed++,getPage:async number=>{
  pagesLoaded.push(number);if(fail.includes(number))throw new Error('PAGE_TIMEOUT');
  return {getTextContent:async()=>({items:empty.includes(number)?[]:[
   {str:'Direito Penal',transform:[0,0,0,0,20,800],width:130},
   {str:`Questão ${number} — A administração utiliza o endereço contato@exemplo.com em sua comunicação. Julgue o procedimento com base nas regras expressas no enunciado e escolha uma das alternativas originais.`,transform:[0,0,0,0,20,780],width:520},
   {str:'A) Primeira alternativa preservada integralmente.',transform:[0,0,0,0,20,760],width:300},
   {str:'B) Segunda alternativa preservada integralmente.',transform:[0,0,0,0,20,740],width:300},
  ]}),getViewport:()=>({width:595,height:842}),cleanup(){}};
 }};
 ctx.openPdfDocumentWithFallback=async()=>pdf;ctx.fixturePdfjs={};
 vm.createContext(ctx);vm.runInContext(part('  function pdfTextItemGeometry(', '  function withTimeout(')+'const extractionJobs=new Map(),extractionGenerations=new Map(),MAX_EXTRACT_PAGES=600;'+part('  function pdfExtractionScope(', '  function compactPagesForInlinePayload(').replace('await import("./pdf.mjs")','await Promise.resolve(fixturePdfjs)'),ctx);
 return{ctx,doc,calls,pdf,pagesLoaded,notices,session:ctx.cloudSession};
}
{
 const f=fixture({sidecar:{pages:[{page:1,text:'TEXTO ANTIGO'}],pdfTotalPages:1,truncatedPages:false,failed_pages:[],skipped_pages:[],empty_pages:[],pagesRead:1}});
 f.ctx.window._extractedPagesByDocId.set(f.doc.id,[{page:1,text:'CACHE ANTIGO'}]);
 f.ctx.window._extractedPdfMetaByDocId.set(f.doc.id,{ownerId:'a',resetEpoch:0});
 let uploadedRead=0;f.ctx.window._recentUploadedPdfBytes.set(f.doc.id,{arrayBuffer:async()=>{uploadedRead++;return new ArrayBuffer(0);}});
 assert.equal(await f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true}),true);
 const pages=f.ctx.window._extractedPagesByDocId.get(f.doc.id),meta=f.ctx.window._extractedPdfMetaByDocId.get(f.doc.id);
 assert.equal(uploadedRead,0);assert(!f.calls.some(call=>call.sidecar));assert.equal(f.calls[0].path,'a/original.pdf');
 assert(pages[0].text.includes('Direito Penal'));assert(pages[0].text.includes('contato@exemplo.com'),'Não apaga um enunciado legítimo por conter @.');
 assert(!pages[0].text.includes('ANTIGO'));assert.equal(meta.pagesRead,2);assert.equal(meta.totalPages,2);assert.equal(meta.freshSource,true);assert.equal(meta.incomplete,false);
 assert(f.calls.filter(call=>call.options?.method).every(call=>call.path.endsWith('.text.json')),'Nenhuma escrita no PDF original.');
}
{
 const f=fixture({count:3,fail:[2],empty:[3]});assert.equal(await f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true}),true);
 const meta=f.ctx.window._extractedPdfMetaByDocId.get(f.doc.id);
 assert.deepEqual(Array.from(meta.failed_pages),[2]);assert.deepEqual(Array.from(meta.empty_pages),[3]);assert.equal(meta.pagesRead,2);assert.equal(meta.pagesWithText,1);assert.equal(meta.incomplete,true);
 assert(!f.calls.some(call=>call.options?.method),'Texto incompleto não substitui sidecar persistido.');
}
{
 const f=fixture({count:601});assert.equal(await f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true}),true);
 const meta=f.ctx.window._extractedPdfMetaByDocId.get(f.doc.id);assert.equal(meta.pagesRead,600);assert.equal(meta.totalPages,601);assert.equal(meta.truncatedPages,true);assert.equal(meta.truncated,true);assert.deepEqual(Array.from(meta.skipped_pages),[601]);
 assert(!f.calls.some(call=>call.options?.method));
}
{
 const f=fixture({count:2,empty:[1,2]});f.ctx.window._extractedPagesByDocId.set(f.doc.id,[{page:1,text:'CACHE antigo'}]);
 assert.equal(await f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true}),false);
 assert(!f.ctx.window._extractedPagesByDocId.has(f.doc.id),'PDF escaneado não deixa texto antigo parecer uma extração atual.');
 assert.equal(f.ctx.window._extractedPdfMetaByDocId.get(f.doc.id).isScannedPdf,true);
}
for(const change of [f=>{f.ctx.cloudSession={user:{id:'b'}};f.ctx.state._ownerUserId='b';},f=>f.ctx.state.activeCampaignId='other',f=>f.ctx.state._resetEpoch++]){
 const f=fixture(),pending=later();f.ctx.storageFetch=async(path,session,options={})=>{f.calls.push({path,session,options});return{ok:true,arrayBuffer:()=>pending.promise};};
 const job=f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true});await tick();change(f);pending.resolve(new Uint8Array([1]).buffer);
 assert.equal(await job,false);assert.equal(f.ctx.window._extractedPagesByDocId.size,0);assert.equal(f.ctx.window._extractedPdfMetaByDocId.size,0);assert(!f.doc.metadata);assert.equal(f.calls.length,1);
}
{
 const f=fixture(),old=later();f.doc.document_type='material';f.ctx.sidecarAlreadyExists=()=>old.promise;
 const obsolete=f.ctx.prepareDocumentText(f.doc,f.session);await tick();
 const fresh=f.ctx.prepareDocumentText(f.doc,f.session,{forceFresh:true});assert.equal(await fresh,true);
 old.resolve({pages:[{page:1,text:'SIDECAR OBSOLETO'}],pdfTotalPages:1});assert.equal(await obsolete,false);
 assert(!f.ctx.window._extractedPagesByDocId.get(f.doc.id)[0].text.includes('OBSOLETO'));
}
// Um clique em extrair/reanalisar prova entra na revisão; não chama o gerador nem grava ativos.
for(const kind of ['prova','simulado','material']){
 const f=fixture();let reviewed=0,prepared=0,generated=0,requests=0;
 f.doc.document_type=kind;if(kind==='material')f.doc.title='Banco de questões para concurso';
 f.ctx.cloudDocuments=[f.doc];f.ctx.activeCampaign=()=>({dbId:'db-p'});f.ctx.validSession=async()=>f.session;f.ctx.authHeaders=()=>({});
 f.ctx.cloudFetch=async()=>{requests++;throw new Error('Nenhuma gravação direta é permitida.');};
 f.ctx.window._activeProcessingDocs=new Set();f.ctx.window.JCQuestionReview={reviewDocument:async id=>{assert.equal(id,'doc-a');reviewed++;return {status:'pending_review'};}};
 f.ctx.prepareDocumentText=async()=>prepared++;f.ctx.processEditalDocument=async()=>generated++;
 f.ctx.document={getElementById:()=>null,querySelector:()=>null};
 vm.runInContext(part('  const originalProcessDocument = processEditalDocument;','  const originalDeleteDocument'),f.ctx);
 assert.equal((await f.ctx.processEditalDocument('doc-a')).status,'pending_review');assert.equal(reviewed,1);assert.equal(prepared,0);assert.equal(generated,0);assert.equal(requests,0);
 assert.equal(f.ctx.window._activeProcessingDocs.size,0);
}
assert(!source.includes('Material verificado no lote'),'Nenhum sucesso fabricado para PDF sem questão reconhecida.');
assert(!source.includes('examReport.cadernos[0]'),'Nenhuma seleção automática do primeiro caderno.');
const wrapper=part('  const originalProcessDocument = processEditalDocument;','  const originalDeleteDocument');
assert(!wrapper.includes('generated_study_content'),'O wrapper antigo não pode substituir questões por POST/DELETE separados.');
// O modo de recuperação não pode contornar a gravação atômica nem inventar prova.
for(const kind of ['material','prova','simulado']){
 const f=fixture();f.doc.document_type=kind;let requests=0;f.ctx.isEditalType=d=>['edital','edital_concurso'].includes(d.document_type);
 f.ctx.cloudFetch=f.ctx.fetch=async()=>{requests++;throw new Error('Recuperação não pode gravar material diretamente.');};
 vm.runInContext(part('  async function recoverPdfViaAssistant(', '  const nativeFetch'),f.ctx);
 assert.equal(await f.ctx.recoverPdfViaAssistant(f.doc,[{page:1,text:'Conteúdo original'}],f.session),false);assert.equal(requests,0);
}
console.log('OK r184 PDF: releitura real, texto original, falhas/páginas omitidas, escopo, cache antigo, OCR e encaminhamento seguro para revisão.');
