// Exerce o fluxo real de comparação/proposta com armazenamento e rede simulados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../dist/question-review.js',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const q=(text='Sobre o inquérito policial, assinale a alternativa correta.',more={})=>({subject:'Direito Processual Penal',topic:'Inquérito',statement:text,options:['Primeira alternativa.','Segunda alternativa.'],correct_index:0,question_number:1,source_page:2,...more});
const doc={id:'doc-1',title:'Prova de teste',user_id:'a',campaign_id:'db-p',document_type:'prova'};
const rows=[{id:'row-1',title:'Pacote antigo',content_type:'summary',content:{is_question_pack:true,subject:'Direito Processual Penal',questions:[q()]}}];
const meta={freshSource:true,pdfTotalPages:2,pagesRead:2,totalPages:2};
const pages=[{page:1,text:'Capa da prova.'},{page:2,text:'Texto completo da prova e do gabarito.'}];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const calls=[],messages=[],nodes=new Map();
 const node=id=>({id,onclick:null,handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}});
 const panel={innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node(selector));return nodes.get(selector);},querySelectorAll:()=>[]};
 const ctx={console,AbortController,URL,setTimeout,clearTimeout,state:{_ownerUserId:'a',activeCampaignId:'p',_resetEpoch:0,answeredQuestionFingerprints:{old:'correct'}},cloudSession:{user:{id:'a'},access_token:'token-a'},SUPABASE_URL:'https://supabase.test',
 document:{readyState:'loading',addEventListener(){},getElementById:id=>options.panel&&id==='jcQuestionReviewPanel'?panel:null,querySelector:()=>({checked:options.confirm===true})},
 authHeaders:token=>({Authorization:`Bearer ${token}`}),validSession:async()=>ctx.cloudSession,activeCampaign:()=>({dbId:'db-'+ctx.state.activeCampaignId}),toast:msg=>messages.push(msg),
 _extractedPagesByDocId:new Map(),_extractedPdfMetaByDocId:new Map(),
 extractStructuredExamQuestions:()=>Object.defineProperty([q()],'report',{value:{expected:1,extracted:1,annulled:0,skipped:0,unknownFormatCount:0}}),
 loadGeneratedContent:async()=>{},invalidateQuestionPoolCache(){},markViewsDirty(){},
 fetch:async(url,init)=>{
  const body=init.body?JSON.parse(init.body):undefined;calls.push({url,method:init.method,body,headers:init.headers});
  if(url.includes('get_document_question_review_source'))return Response.json({document:{...doc,id:body.p_document_id},rows:clone(rows),snapshot:'snapshot-1'});
  if(url.includes('stage_document_question_review'))return Response.json({review_id:'review-1',status:'pending',document_id:body.p_document_id});
  if(url.includes('apply_document_question_review'))return Response.json({status:'applied',saved:1,document_id:'doc-1'});
  if(url.includes('study_documents?'))return Response.json(options.docs||[doc]);
  if(url.includes('study_document_question_reviews?'))return Response.json([]);
  throw new Error('Pedido inesperado '+url);
 },
 JornadaPdfText:{prepareDocumentText:async(document,session,opts)=>{assert.equal(opts.forceFresh,true);ctx._extractedPagesByDocId.set(document.id,clone(pages));ctx._extractedPdfMetaByDocId.set(document.id,clone(meta));return true;}},
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,api:ctx.JCQuestionReview,calls,messages,nodes,panel};
}
const failures=[];
async function check(name,fn){try{await fn();console.log('OK',name);}catch(error){failures.push(name+': '+error.message);}}
await check('reconciliação mantém originais e preserva gabarito e classificação pessoais',()=>{
 const {api}=fixture(),original=clone(rows);original[0].content.questions[0]=q(undefined,{subject:'Língua Portuguesa',topic:'Interpretação',subject_source:'manual',correct_index:1,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Fonte conferida',answer_key_history:[{from:0,to:1}],explanation:'Comentário pessoal.'});
 const before=JSON.stringify(original),fresh=[q(undefined,{subject:'Direito Penal',topic:'Tipos penais'})],freshBefore=JSON.stringify(fresh);
 const result=api.reconcile(original,fresh,doc,meta),saved=result.candidates[0].content.questions[0];
 assert.equal(JSON.stringify(original),before);assert.equal(JSON.stringify(fresh),freshBefore);
 assert.equal(saved.correct_index,1);assert.equal(saved.key_source,'manual_revisado');assert.equal(saved.key_reference,'Fonte conferida');assert.equal(saved.explanation,'Comentário pessoal.');assert.equal(saved.subject,'Língua Portuguesa');assert.equal(saved.topic,'Interpretação');assert.equal(result.report.keys_preserved,1);assert.equal(result.report.key_conflicts,1);assert.equal(result.candidates[0].approved,false);assert.equal(result.report.factual_review_verified,false);
});
await check('número igual não associa textos ou alternativas diferentes',()=>{
 const {api}=fixture();const result=api.reconcile(rows,[q('Sobre a prisão preventiva, assinale a alternativa correta.')],doc,meta);
 assert.equal(result.report.matched,0);assert.equal(result.report.not_matched,1);assert.equal(result.report.added,1);assert.equal(result.candidates[0].content.questions[0].review_status,'source_not_matched');assert(result.candidates[0].content.questions[0].classification_needs_review);
 const reversed=api.reconcile(rows,[q(undefined,{options:[...q().options].reverse()})],doc,meta);assert.equal(reversed.report.matched,0,'A posição da alternativa não pode ser reinterpretada silenciosamente.');
});
await check('sugestão de IA continua pendente e duplicatas não recebem aprovação factual',()=>{
 const {api}=fixture();const result=api.reconcile([], [q(undefined,{key_source:'ia_sugerido',correct_index:1}),q(undefined,{key_source:'ia_sugerido',correct_index:1})],doc,meta);
 assert.equal(result.report.duplicates,1);assert(result.report.manual_review_required);for(const value of result.candidates[0].content.questions){assert.equal(value.correct_index,-1);assert(value.answer_unknown);assert.equal(value.suggested_correct_index,1);assert.equal(value.answer_key_validation,'pendente');}
});
await check('elemento visual sem figura vai para conferência da fonte',()=>{
 const {api}=fixture();const result=api.reconcile([], [q('Observe o gráfico e assinale a alternativa correta.')],doc,meta);
 const value=result.candidates[0].content.questions[0];assert(value.source_visual_review_required);assert(value.classification_needs_review);assert.equal(value.review_status,'needs_source_check');assert.equal(result.report.visual_pending,1);
});
await check('leitura incompleta, OCR, chave ambígua e formato desconhecido bloqueiam substituição',()=>{
 const {api}=fixture();
 for(const extra of [{freshSource:false},{incomplete:true},{truncated:true},{truncatedPages:1},{failed_pages:[1]},{skipped_pages:[1]},{isScannedPdf:true}])assert.throws(()=>api.freshCoverage({...meta,...extra},pages,{expected:1,extracted:1}));
 for(const parser of [{ambiguous:true,cadernos:['1','2']},{unknownFormatCount:1},{skipped:1},{expected:2,extracted:1}])assert.throws(()=>api.freshCoverage(meta,pages,parser));
 assert.doesNotThrow(()=>api.freshCoverage(meta,pages,{expected:1,extracted:1}));
});
await check('páginas sem texto exigem conferência explícita e não liberam PDF digitalizado',()=>{
 const {api}=fixture(),empty={...meta,empty_pages:[1]};
 assert.throws(()=>api.freshCoverage(empty,pages,{expected:1,extracted:1}),/páginas sem texto/i);
 assert.doesNotThrow(()=>api.freshCoverage(empty,pages,{expected:1,extracted:1},{confirmEmptyPages:true}));
 assert.throws(()=>api.freshCoverage({...empty,isScannedPdf:true},pages,{expected:1,extracted:1},{confirmEmptyPages:true}),/OCR|legível/i);
});
await check('revisão relê o PDF e apenas prepara proposta com snapshot original',async()=>{
 const {api,calls,ctx}=fixture();const before=JSON.stringify(ctx.state);
 assert.equal(await api.reviewDocument('doc-1'),true);assert.equal(calls.length,2);
 assert(calls[0].url.endsWith('rpc/get_document_question_review_source'));assert(calls[1].url.endsWith('rpc/stage_document_question_review'));assert.equal(calls[1].body.p_expected_snapshot,'snapshot-1');assert.equal(calls[1].body.p_document_id,'doc-1');assert.equal(calls[1].body.p_report.factual_review_verified,false);assert.equal(JSON.stringify(ctx.state),before);
 assert(!calls.some(call=>call.url.includes('apply_document')||call.url.includes('generated_study_content')));
});
await check('erro de snapshot não aplica nem declara sucesso',async()=>{
 const {api,ctx,calls}=fixture(),fetch=ctx.fetch;ctx.fetch=async(url,init)=>url.includes('stage_')?Response.json({message:'STALE_SNAPSHOT'},{status:409}):fetch(url,init);
 assert.equal(await api.reviewDocument('doc-1'),false);assert(!calls.some(call=>call.url.includes('apply_')));
});
await check('aplicar exige confirmação explícita e usa RPC atômica separada',async()=>{
 const denied=fixture();assert.equal(await denied.api.applyReview({id:'doc-1',reviewId:'review-1'}),false);assert.equal(denied.calls.length,0);
 const allowed=fixture({confirm:true});assert.equal(await allowed.api.applyReview({id:'doc-1',reviewId:'review-1'}),true);assert.equal(allowed.calls.length,1);assert(allowed.calls[0].url.endsWith('rpc/apply_document_question_review'));assert.equal(allowed.calls[0].body.p_review_id,'review-1');
});
await check('mudança de conta, portal ou redefinição impede proposta tardia',async()=>{
 for(const type of ['account','portal','reset'])for(const phase of ['session','source','prepare','stage']){
  const {api,ctx,calls}=fixture(),late=deferred(),fetch=ctx.fetch,prepare=ctx.JornadaPdfText.prepareDocumentText;
  if(phase==='session')ctx.validSession=()=>late.promise;
  if(phase==='source'||phase==='stage')ctx.fetch=(url,init)=>url.includes(phase==='source'?'get_document_question_review_source':'stage_document_question_review')?late.promise:fetch(url,init);
  if(phase==='prepare')ctx.JornadaPdfText.prepareDocumentText=async(...args)=>{await late.promise;return prepare(...args);};
  const pending=api.reviewDocument('doc-1');await tick();
  if(type==='account'){ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.state._ownerUserId='b';}if(type==='portal')ctx.state.activeCampaignId='p2';if(type==='reset')ctx.state._resetEpoch++;
  late.resolve(phase==='session'?{user:{id:'a'},access_token:'token-a'}:phase==='source'?Response.json({document:doc,rows:clone(rows),snapshot:'snapshot-1'}):phase==='stage'?Response.json({review_id:'review-1'}):true);
  assert.equal(await pending,false,type+'/'+phase);assert(!calls.some(call=>call.url.includes('apply_')));if(phase!=='stage')assert(!calls.some(call=>call.url.includes('stage_')),type+'/'+phase);
 }
});
await check('lote filtra provas e materiais de questões e pausa após o PDF atual',async()=>{
 const docs=[doc,{...doc,id:'doc-2',document_type:'material',title:'100 Questões de Português'},{...doc,id:'not-exam',document_type:'lei',title:'Lei'},{...doc,id:'edital',document_type:'edital',title:'Edital'}];
 const {api,calls,ctx,nodes}=fixture({docs,panel:true});let count=0;const prepare=ctx.JornadaPdfText.prepareDocumentText;
 ctx.JornadaPdfText.prepareDocumentText=async(...args)=>{count++;nodes.get('#qrStop').handlers.click();return prepare(...args);};
 await api.startBatch(true);assert.equal(count,1);assert.equal(calls.filter(call=>call.url.includes('stage_')).length,1);assert.equal(calls.filter(call=>call.url.includes('study_documents?')).length,1);assert(!calls.some(call=>call.url.includes('apply_')));
});
await check('cobertura exige todas as páginas e callback vazio não aplica',async()=>{
 const {api}=fixture();assert.throws(()=>api.freshCoverage({...meta,pagesRead:1},pages,{expected:1,extracted:1}),/contagem/);
 assert.throws(()=>api.freshCoverage(meta,[pages[0],pages[0]],{expected:1,extracted:1}),/ausentes|repetidas/);
 assert.equal(await api.applyReview(undefined),false);
});
await check('revisões locais por alternativa sobrevivem à proposta e mudança posterior bloqueia aplicação',async()=>{
 const {api,ctx,calls}=fixture({confirm:true});ctx.ALL_QUESTIONS=[{...q(),documentId:'doc-1',subject_source:'manual',subject:'Português',topic:'Interpretação'}];
 ctx.answerOptionText=o=>String(o);ctx.answerOptionsSignature=x=>JSON.stringify(x.options);ctx.questionFingerprint=()=> 'fingerprint';
 ctx.state.questionAnswerOverrides={fingerprint:{key_source:'manual_revisado',answer_key_validation:'revisado',correct_answer:q().options[1],options_signature:JSON.stringify(q().options),key_reference:'Conferência pessoal'}};
 const over=api.overlayPersonalReviews(rows,'doc-1');assert.equal(over[0].content.questions[0].correct_index,1);assert.equal(over[0].content.questions[0].subject,'Português');assert.equal(rows[0].content.questions[0].correct_index,0);
 const proposal=api.reconcile(over,[q()],doc,meta);assert.equal(proposal.report.classification_changes,0,'Relatório mostra o que será aplicado após preservar a classificação humana.');
 const record={id:'doc-1',reviewId:'review-1',report:{local_review_signature:api.personalSignature('doc-1')}};
 ctx.state.questionAnswerOverrides.fingerprint.correct_answer=q().options[0];assert.equal(await api.applyReview(record),false);assert.equal(calls.length,0);
});
await check('HTTP200 sem confirmação não anuncia aplicação e falha de refresh preserva confirmação',async()=>{
 const failed=fixture({confirm:true});failed.ctx.fetch=async()=>Response.json({status:'pending',saved:0,document_id:'doc-1'});const record={id:'doc-1',reviewId:'review-1'};
 assert.equal(await failed.api.applyReview(record),false);assert.equal(record.status,'pending');
 const applied=fixture({confirm:true});applied.ctx.loadGeneratedContent=async()=>{throw new Error('refresh offline');};const done={id:'doc-1',reviewId:'review-1'};
 assert.equal(await applied.api.applyReview(done),true);assert.equal(done.status,'applied');assert.match(done.message,/aplicada/);
});
await check('cliques repetidos reanalisam o mesmo PDF uma vez; preparação falsa não usa cache antigo',async()=>{
 const f=fixture(),wait=deferred(),prepare=f.ctx.JornadaPdfText.prepareDocumentText;let count=0;
 f.ctx.JornadaPdfText.prepareDocumentText=async(...args)=>{count++;await wait.promise;return prepare(...args);};
 const first=f.api.reviewDocument('doc-1'),second=f.api.reviewDocument('doc-1');assert.equal(first,second);wait.resolve();assert.equal(await first,true);assert.equal(count,1);assert.equal(f.calls.filter(c=>c.url.includes('stage_')).length,1);
 const stale=fixture();stale.ctx._extractedPagesByDocId.set('doc-1',clone(pages));stale.ctx._extractedPdfMetaByDocId.set('doc-1',clone(meta));stale.ctx.JornadaPdfText.prepareDocumentText=async()=>false;
 assert.equal(await stale.api.reviewDocument('doc-1'),false);assert(!stale.calls.some(c=>c.url.includes('stage_')));
});
if(failures.length){for(const error of failures)console.error('PENDENTE',error);process.exitCode=1;}else console.log('OK r184: comparação imutável, fonte/número/alternativas, gabaritos pessoais, quarentena, cobertura, propostas e aplicação separadas, escopo e lote pausável.');
