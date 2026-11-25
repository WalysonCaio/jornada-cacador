// Revisão dos PDFs originais: extração, comparação e proposta; aplicação separada e atômica.
(() => {
  'use strict';
  const w=window, escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=value=>JSON.parse(JSON.stringify(value)), text=value=>String(value??'').normalize('NFC').replace(/\s+/g,' ').trim();
  const identity=q=>JSON.stringify([text(q?.statement),Array.isArray(q?.options)?q.options.map(text):[]]);
  const manualKey=q=>q?.key_source==='manual_revisado'&&q?.answer_key_validation==='revisado';
  const manualClassification=q=>[q?.subject_source,q?.classification_source].some(value=>['manual','manual_revisado','humano','humana','revisado'].includes(String(value||'').toLowerCase()));
  const validQuestion=q=>q&&typeof q.statement==='string'&&text(q.statement).length>=12&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=5&&q.options.every(o=>typeof o==='string'&&text(o))&&new Set(q.options.map(text)).size===q.options.length;
  const keyValid=q=>(typeof q.correct_index==='number'||typeof q.correct_index==='string')&&String(q.correct_index).trim()!==''&&Number.isInteger(Number(q.correct_index))&&Number(q.correct_index)>=0&&Number(q.correct_index)<q.options.length;
  const examDocument=doc=>['prova','simulado'].includes(doc?.document_type)||(['material','anotacao'].includes(doc?.document_type)&&/\b(prova|simulado|quest[oõ]es)\b/i.test(String(doc?.title||'')));
  const records=new Map();let running=false,stopRequested=false,selectedScope=null,batchOperation=null;
  function scope(){let s={},session=null;try{s=typeof state==='object'?state:w.state||{};session=typeof cloudSession==='object'?cloudSession:w.cloudSession;}catch{}return{userId:session?.user?.id||'',owner:s._ownerUserId||'',reset:Number(s._resetEpoch||0),portal:s.activeCampaignId||''};}
  const sameScope=s=>{const n=scope();return s.userId&&n.userId===s.userId&&n.owner===s.userId&&n.reset===s.reset&&n.portal===s.portal;};
  function currentRecords(){const s=scope();if(!selectedScope||!sameScope(selectedScope)){records.clear();selectedScope=s;running=false;if(batchOperation)batchOperation.cancelled=true;}return [...records.values()];}
  const notify=msg=>{if(typeof w.toast==='function')w.toast(msg);};
  async function sessionFor(s){const session=typeof validSession==='function'?await validSession():null;if(!session||session.user?.id!==s.userId||!sameScope(s))throw new Error('Conta ou portal mudou. A revisão anterior foi interrompida.');return session;}
  async function request(path,body,s,session){
    if(!sameScope(s))throw new Error('Contexto de revisão alterado.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{const base=typeof SUPABASE_URL==='string'?SUPABASE_URL:'',headers=typeof authHeaders==='function'?authHeaders(session.access_token):{Authorization:`Bearer ${session.access_token}`};
      const response=await fetch(`${base}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const data=await response.json().catch(()=>null);if(!sameScope(s))throw new Error('Contexto de revisão alterado.');
      if(!response.ok){const msg=String(data?.message||data?.error||`Erro ${response.status}`),friendly={DOCUMENT_CONTENT_CHANGED:'O conteúdo mudou depois da comparação. Reanalise o PDF para gerar uma proposta atual.',MANUAL_KEY_WOULD_BE_CHANGED:'Há um gabarito revisado que não pode ser sobrescrito. Confira a revisão pessoal antes de tentar novamente.',MANUAL_REVIEW_WOULD_BE_LOST:'Uma revisão pessoal não foi localizada na proposta. Nada foi substituído.',MANUAL_CLASSIFICATION_WOULD_BE_CHANGED:'A proposta diverge de uma classificação confirmada por você. Confira a revisão pessoal.',REVIEW_ALREADY_CLOSED:'Esta proposta já foi aplicada ou cancelada. Recupere a situação atual antes de repetir.'};throw new Error(/PGRST202|does not exist|schema cache/i.test(msg)?'Aplique a migração v110 antes de usar a revisão de PDFs.':friendly[msg]||msg);}
      return data;
    }finally{clearTimeout(timeout);}
  }
  function localQuestionPool(documentId){
    let all=[];try{all=typeof ALL_QUESTIONS!=='undefined'?ALL_QUESTIONS:w.ALL_QUESTIONS||[];}catch{}
    return Array.isArray(all)?all.filter(q=>[q.documentId,q.sourceDocumentId,q.source_document_id].some(id=>id===documentId)):[];
  }
  function personalSignature(documentId){
    let st={};try{st=typeof state==='object'?state:w.state||{};}catch{}
    const manual=localQuestionPool(documentId).filter(q=>manualClassification(q)||manualKey(q)).map(q=>[identity(q),q.subject,q.topic,q.subject_source,q.classification_source,q.correct_index,q.key_source,q.answer_key_validation]);
    const input=JSON.stringify([st.questionAnswerOverrides||{},manual]);let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);
  }
  function overlayPersonalReviews(rows,documentId){
    const result=copy(rows),pool=localQuestionPool(documentId);let overrides={};try{overrides=(typeof state==='object'?state:w.state||{}).questionAnswerOverrides||{};}catch{}
    for(const row of result)for(const original of row.content?.questions||[]){
      const matches=pool.filter(q=>identity(q)===identity(original));if(matches.length!==1)continue;const current=matches[0];
      if(manualClassification(current))for(const k of ['subject','topic','subject_source','classification_source','classification_needs_review','topic_classification_needs_review','classification_declared_subject','classification_reason'])if(Object.hasOwn(current,k))original[k]=copy(current[k]);
      if(manualKey(current))for(const k of ['correct_index','key_source','answer_key_validation','key_reference','answer_key_history','explanation_needs_review','explanation','answer_unknown','annulled','anulada']){if(Object.hasOwn(current,k))original[k]=copy(current[k]);else delete original[k];}
      if(typeof questionFingerprint==='function'&&typeof w.answerOptionsSignature==='function'&&typeof w.answerOptionText==='function'){
        const override=overrides[questionFingerprint(current)];
        if(override?.key_source==='manual_revisado'&&override.answer_key_validation==='revisado'&&override.options_signature===w.answerOptionsSignature(original)){
          const indices=original.options.map((o,i)=>w.answerOptionText(o)===override.correct_answer?i:-1).filter(i=>i>=0);
          if(indices.length===1)Object.assign(original,copy(override),{correct_index:indices[0],answer_unknown:false,annulled:false,anulada:false});
        }
      }
    }
    return result;
  }
  function reconcile(rows,extracted,doc,meta={}){
    if(!Array.isArray(rows)||!Array.isArray(extracted)||!extracted.length)throw new Error('Nenhuma questão reconhecida; o conteúdo anterior foi preservado.');
    if(extracted.some(q=>!validQuestion(q)))throw new Error('Há questões com enunciado ou alternativas inválidos. Nada foi substituído.');
    const report={kind:'structural_pdf_comparison',factual_review_verified:false,document_id:doc.id,title:doc.title,existing:0,extracted:extracted.length,matched:0,added:0,not_matched:0,classification_changes:0,classification_pending:0,structure_pending:0,board_pending:0,text_integrity_pending:0,keys_preserved:0,key_conflicts:0,duplicates:0,visual_pending:0,source_pages:Number(meta.pdfTotalPages||meta.totalPages||0),pages_read:Number(meta.pagesRead||0),details:[],items:[]};
    const lookup=new Map();for(const q of extracted){const id=identity(q);const arr=lookup.get(id)||[];arr.push(copy(q));lookup.set(id,arr);}
    const seen=new Set();for(const q of extracted){const id=identity(q);if(seen.has(id))report.duplicates++;seen.add(id);}
    const candidates=copy(rows), protectedKeys=['correct_index','answer_unknown','annulled','anulada','key_source','answer_key_validation','key_reference','answer_key_history','suggested_correct_index'];
    function prepare(q,old){
      if(old){
        const oldTrusted=manualKey(old)||(!old.answer_unknown&&keyValid(old)&&['oficial_definitivo','oficial_preliminar','documento_informado','gabarito_documento'].includes(old.key_source));
        if(oldTrusted){if(keyValid(q)&&Number(q.correct_index)!==Number(old.correct_index))report.key_conflicts++;
          for(const k of protectedKeys){if(Object.hasOwn(old,k))q[k]=copy(old[k]);else delete q[k];}report.keys_preserved++;
          // O comentário antigo não pode justificar silenciosamente uma resposta diferente.
          q.explanation=old.explanation||q.explanation;q.explanation_needs_review=old.explanation_needs_review===true;
        }
        if(manualClassification(old)){
          for(const k of ['subject','topic','subject_source','classification_source','classification_needs_review','topic_classification_needs_review','classification_reason','classification_declared_subject']){if(Object.hasOwn(old,k))q[k]=copy(old[k]);else delete q[k];}
        }
        if(text(old.subject)!==text(q.subject)||text(old.topic)!==text(q.topic)){report.classification_changes++;report.details.push({number:q.question_number||null,page:q.source_page||null,from:old.subject||'',to:q.subject||'',topic_from:old.topic||'',topic_to:q.topic||''});}
        if(['manual','manual_revisado','humano','humana','revisado'].includes(String(old.board_source||'').toLowerCase()))for(const key of ['board','board_source','board_reference','board_history'])if(Object.hasOwn(old,key))q[key]=copy(old[key]);
        if(old.board&&(!q.board||/n[aã]o informada|desconhecida/i.test(q.board)))q.board=old.board;
        for(const k of ['id','figure_data_url','figure_page','associated_text'])if(old[k]&&!q[k])q[k]=old[k];
      }
      // Recheck after restoring human decisions: keep their values, flag a
      // contradiction for confirmation instead of silently changing them.
      const decision=typeof w.classifyQuestion==='function'?w.classifyQuestion(q):null;
      if(decision?.needs_review){q.classification_needs_review=true;q.classification_reason=decision.reason||q.classification_reason;}
      const quality=typeof w.getQuestionQualityDecision==='function'?w.getQuestionQualityDecision(q):null;
      if(quality?.needs_review){q.needs_source=true;q.structure_needs_review=true;q.quality_status=quality.quality_status;q.quality_reason=quality.reason;q.classification_needs_review=true;q.classification_reason=quality.reason;report.structure_pending++;}
      if(!q.annulled&&!q.anulada&&(!keyValid(q)||q.key_source==='ia_sugerido'||q.answer_unknown)){q.answer_unknown=true;if(keyValid(q))q.suggested_correct_index=Number(q.correct_index);q.correct_index=-1;q.key_source=q.key_source==='ia_sugerido'?'ia_sugerido':'sem_gabarito';q.answer_key_validation='pendente';}
      if(/\b(figura|gr[áa]fico|tabela|charge|tirinha|imagem)\b/i.test(q.statement)&&!q.figure_data_url){q.source_visual_review_required=true;q.classification_needs_review=true;q.classification_reason='A questão depende de elemento visual: confira a página do PDF antes de liberar.';report.visual_pending++;}
      if(q.classification_needs_review||q.topic_classification_needs_review||!q.subject||q.subject==='Conteúdo Geral')report.classification_pending++;
      const boardDecision=typeof w.questionBoardDecision==='function'?w.questionBoardDecision(q):null;
      if(q.board_needs_review||boardDecision?.needs_review){q.board_needs_review=true;q.board_statement=boardDecision?.explicit_board||q.board_statement||'';report.board_pending++;}
      if(q.text_integrity_review?.pending)report.text_integrity_pending++;
      q.source_document_id=doc.id;q.source_document_title=doc.title;q.review_status=q.source_visual_review_required||quality?.needs_review?'needs_source_check':'source_compared';report.items.push({number:q.question_number||null,page:q.source_page||null,statement:q.statement,options:q.options,subject:q.subject||'',topic:q.topic||'',classification_pending:!!(q.classification_needs_review||q.topic_classification_needs_review),structure_pending:!!quality?.needs_review,text_integrity_review:q.text_integrity_review?copy(q.text_integrity_review):null,board:q.board||'',board_pending:!!q.board_needs_review,board_declared:q.board_declared||'',board_statement:q.board_statement||'',board_reference:q.board_reference||'',quality_reason:quality?.needs_review?quality.reason:'',missing_assertions:quality?.missing_assertions||[],answer_unknown:!!q.answer_unknown,correct_index:q.correct_index,key_source:q.key_source||'não informada',key_reference:q.key_reference||'',visual_pending:!!q.source_visual_review_required,matched_previous:!!old});return q;
    }
    for(const row of candidates){
      const qs=row.content?.questions;if(!Array.isArray(qs))continue;
      row.content.questions=qs.map(old=>{report.existing++;const bucket=lookup.get(identity(old));
        if(bucket?.length){report.matched++;return prepare(bucket.shift(),{...old,subject:old.subject||row.content.subject});}
        report.not_matched++;return{...old,classification_needs_review:true,review_status:'source_not_matched',classification_reason:'Não localizada na nova leitura do PDF. Preservada para conferência, fora dos treinos.'};
      });
      row.approved=false;row.content.review_kind=report.kind;row.content.factual_review_verified=false;
    }
    const additions=[];for(const bucket of lookup.values())for(const q of bucket){report.added++;additions.push(prepare(q));}
    if(additions.length)candidates.push({content_type:'summary',title:`Questões do PDF — ${doc.title}`.slice(0,190),content:{is_question_pack:true,subject:'Prova com disciplinas identificadas por questão',source:doc.title,page_start:1,page_end:report.source_pages,explanation:'Questões extraídas novamente do PDF original. Classificações e gabaritos pendentes permanecem identificados.',points:[],flashcards:[],questions:additions,review_kind:report.kind,factual_review_verified:false},source_refs:[{document_id:doc.id,title:doc.title}],approved:false});
    report.manual_review_required=report.not_matched+report.classification_pending+report.structure_pending+report.board_pending+report.key_conflicts+report.duplicates>0;
    return{candidates,report};
  }
  function freshCoverage(meta,pages,parser,options={}){
    if(!meta?.freshSource)throw new Error('A preparação não confirmou releitura do PDF original. Atualize os arquivos da versão.');
    if(meta.incomplete||meta.truncatedPages||meta.truncated||meta.failed_pages?.length||meta.skipped_pages?.length)throw new Error('Leitura incompleta: páginas falharam ou excederam o limite. O original foi preservado; corrija o PDF/OCR e tente novamente.');
    const total=Number(meta.pdfTotalPages||meta.totalPages),read=Number(meta.pagesRead);
    if(!Number.isInteger(total)||total<1||read!==total)throw new Error('Leitura incompleta: a contagem de páginas lidas difere do PDF original.');
    const pageNumbers=Array.isArray(pages)?pages.map(page=>Number(page.page)):[],empty=Array.isArray(meta.empty_pages)?meta.empty_pages.map(Number):[];
    const located=new Set([...pageNumbers,...empty]);
    if(new Set(pageNumbers).size!==pageNumbers.length||[...located].some(page=>!Number.isInteger(page)||page<1||page>total)||located.size!==total)throw new Error('Leitura incompleta: há páginas ausentes ou repetidas na extração.');
    if(meta.empty_pages?.length&&!options.confirmEmptyPages)throw new Error(`Há páginas sem texto (${meta.empty_pages.join(', ')}). Confira se estão em branco ou contêm imagens antes de prosseguir; aplique OCR quando necessário.`);
    if(meta.isScannedPdf||!Array.isArray(pages)||!pages.length)throw new Error('Este PDF precisa de OCR ou não contém texto legível. Nenhuma substituição foi feita.');
    if(parser?.ambiguous)throw new Error(`Escolha explicitamente o caderno do PDF (${(parser.cadernos||[]).join(', ')}). Nenhum caderno foi escolhido automaticamente.`);
    const extractedCount=Number(parser?.extracted||0), expectedCount=Number(parser?.expected||0), annulledCount=Number(parser?.annulled||0), skippedCount=Number(parser?.skipped||0), unknownCount=Number(parser?.unknownFormatCount||0);
    const minExpected=Math.max(0,expectedCount-annulledCount);
    const isPartial=Boolean(unknownCount||skippedCount||extractedCount<minExpected);
    if(isPartial){
      if(!options.allowPartial||extractedCount<1){
        throw new Error(`Algumas questões não puderam ser lidas integralmente (${extractedCount}/${expectedCount||extractedCount} lidas · ${skippedCount} puladas · ${unknownCount} formato desconhecido). A aplicação foi bloqueada para não perder questões. Confira o formato/OCR do PDF.`);
      }
      return {partial:true,extracted:extractedCount,expected:expectedCount,annulled:annulledCount,skipped:skippedCount,unknownFormatCount:unknownCount,skippedNumbers:Array.isArray(parser?.skippedNumbers)?parser.skippedNumbers:[]};
    }
    return {partial:false,extracted:extractedCount,expected:expectedCount,annulled:annulledCount,skipped:0,unknownFormatCount:0,skippedNumbers:[]};
  }
  const documentReviewJobs=new Map();
  function reviewDocument(id,options={}){
    const s=scope(),key=JSON.stringify([s.userId,s.reset,s.portal,id]);
    if(documentReviewJobs.has(key))return documentReviewJobs.get(key);
    const job=performDocumentReview(id,options);documentReviewJobs.set(key,job);
    job.finally(()=>{if(documentReviewJobs.get(key)===job)documentReviewJobs.delete(key);});return job;
  }
  async function performDocumentReview(id,options={}){
    currentRecords();const s=scope();if(!sameScope(s)){notify('Entre e aguarde o carregamento da sua conta.');return false;}
    const record={id,status:'reading',title:options.title||id};records.set(id,record);render();
    try{
      const session=await sessionFor(s),source=await request('rpc/get_document_question_review_source',{p_document_id:id},s,session),doc=source?.document;
      if(!doc||doc.user_id!==s.userId||!examDocument(doc))throw new Error('Selecione uma prova ou simulado que pertença à sua conta.');
      record.title=doc.title;
      if(!w.JornadaPdfText?.prepareDocumentText||typeof w.extractStructuredExamQuestions!=='function')throw new Error('O leitor de PDF ainda está carregando. Tente novamente.');
      const prepared=await w.JornadaPdfText.prepareDocumentText(doc,session,{forceFresh:true});if(!sameScope(s))return false;
      const pages=w._extractedPagesByDocId?.get(id),meta=w._extractedPdfMetaByDocId?.get(id)||{};
      record.emptyPages=meta.empty_pages||[];if(!prepared){freshCoverage(meta,pages,{},options);throw new Error('Não foi possível confirmar uma nova extração deste PDF. O conteúdo anterior foi preservado.');}
      const qs=w.extractStructuredExamQuestions(pages,{defaultSubject:'Conteúdo Geral',defaultBoard:doc.metadata?.board||'Banca não informada',preferredCaderno:options.preferredCaderno||'',allowWithoutKey:true});
      record.cadernos=qs.report?.cadernos||[];
      record.ambiguous=Boolean(qs.report?.ambiguous);
      const allowPartial=options.allowPartial!==false;
      const coverageInfo=freshCoverage(meta,pages,qs.report,{...options,allowPartial});
      record.partialInfo=coverageInfo;
      const proposal=reconcile(overlayPersonalReviews(source.rows||[],doc.id),qs,doc,meta);
      proposal.report.partial_extraction=Boolean(coverageInfo?.partial);
      proposal.report.partial_summary=coverageInfo||{};
      proposal.report.local_review_signature=personalSignature(doc.id);
      proposal.report.extraction=copy(qs.report||{});proposal.report.pdf_coverage={total:meta.pdfTotalPages,pages_read:meta.pagesRead,empty_pages:meta.empty_pages||[],empty_pages_confirmed:!!options.confirmEmptyPages,fresh:true};
      const staged=await request('rpc/stage_document_question_review',{p_document_id:id,p_expected_snapshot:source.snapshot,p_candidates:proposal.candidates,p_report:proposal.report},s,session);
      if(!sameScope(s))return false;
      if(staged?.status!=='pending'||staged.document_id!==id)throw new Error('O servidor não confirmou a proposta pendente deste PDF.');
      record.status='pending';record.reviewId=staged.review_id||staged.id;record.report=proposal.report;record.candidates=proposal.candidates;
      if(!record.reviewId)throw new Error('O servidor não confirmou o identificador da proposta.');
      record.message=coverageInfo?.partial
        ? `Revisão parcial segura (${coverageInfo.extracted}/${coverageInfo.expected||coverageInfo.extracted} lidas · ${coverageInfo.skipped} puladas). As questões não lidas foram preservadas.`
        : 'Proposta pronta. O conteúdo ativo ainda não foi substituído.';
      if(options.autoApply===true){
        return await applyReview(record,{batchConfirmed:true,silent:true});
      }
      return true;
    }catch(error){if(!sameScope(s))return false;record.status='blocked';record.message=error.name==='AbortError'?'A consulta excedeu o prazo. Tente novamente.':String(error.message||error);return false;
    }finally{if(sameScope(s))render();}
  }
  async function applyReview(record,options={}){
    const s=scope();if(!record?.reviewId||!sameScope(s))return false;
    if(record.report?.local_review_signature&&record.report.local_review_signature!==personalSignature(record.id)){if(!options.silent)notify('Suas revisões pessoais mudaram depois desta proposta. Reanalise o PDF para preservar as alterações atuais.');return false;}
    if(!options.batchConfirmed){
      const check=document.querySelector(`[data-qr-confirm="${record.reviewId}"]`);if(!check?.checked){notify('Confira o relatório e marque a confirmação desta proposta antes de aplicar.');return false;}
    }
    let applied=false;
    try{record.status='applying';render();const session=await sessionFor(s);const confirmed=await request('rpc/apply_document_question_review',{p_review_id:record.reviewId},s,session);
      if(confirmed?.status!=='applied'||confirmed.document_id!==record.id||!Number.isInteger(confirmed.saved)||confirmed.saved<1)throw new Error('A aplicação desta proposta não foi confirmada pelo servidor.');applied=true;
      record.status='applied';record.message='Revisão aplicada em uma transação. Respostas e histórico não foram apagados.';
      if(typeof loadGeneratedContent==='function')await loadGeneratedContent();if(!sameScope(s))return false;
      if(typeof w.invalidateQuestionPoolCache==='function')w.invalidateQuestionPoolCache();if(typeof w.markViewsDirty==='function')w.markViewsDirty();if(!options.silent)notify(record.message);return true;
    }catch(error){if(sameScope(s)){record.status=applied?'applied':'pending';record.message=applied?'A revisão foi aplicada; a atualização da tela falhou. Reabra a Biblioteca para carregar o conteúdo.':String(error.message||error);}return applied&&sameScope(s);}finally{if(sameScope(s))render();}
  }
  async function listDocuments(allPortals,s,session){
    const docs=[];for(let offset=0;;offset+=200){const campaign=typeof activeCampaign==='function'?activeCampaign():null;if(!allPortals&&!campaign?.dbId)throw new Error('Selecione um portal sincronizado.');
      const path=`study_documents?user_id=eq.${encodeURIComponent(s.userId)}&document_type=not.in.(edital,edital_concurso)${allPortals?'':`&campaign_id=eq.${encodeURIComponent(campaign.dbId)}`}&select=id,title,campaign_id,document_type&order=id&limit=200&offset=${offset}`;
      const page=await request(path,undefined,s,session);if(!Array.isArray(page))throw new Error('Não foi possível listar seus PDFs.');docs.push(...page.filter(examDocument));if(page.length<200)break;
    }return docs;
  }
  let lastBatchSummary=null;
  async function startBatch(allPortals=false,options={}){
    if(running)return;currentRecords();const s=scope();if(!sameScope(s))return notify('Entre e aguarde sua conta carregar.');
    const autoApply=Boolean(options?.autoApply);
    const operation={};batchOperation=operation;running=true;stopRequested=false;lastBatchSummary=null;render();
    let appliedDocs=0,updatedQuestions=0,pendingDocs=0,blockedDocs=0;
    try{
      const session=await sessionFor(s),docs=await listDocuments(allPortals,s,session);
      if(!docs.length)notify('Nenhuma prova ou simulado encontrado nesse recorte.');
      for(const doc of docs){
        if(operation.cancelled||stopRequested||!sameScope(s))break;
        await reviewDocument(doc.id,{title:doc.title,autoApply,allowPartial:true});
        const rec=records.get(doc.id);
        if(rec?.status==='applied'){appliedDocs++;updatedQuestions+=Number(rec.report?.extracted||0);}
        else if(rec?.status==='pending')pendingDocs++;
        else if(rec?.status==='blocked')blockedDocs++;
      }
      if(sameScope(s)&&docs.length){
        lastBatchSummary={total:docs.length,appliedDocs,updatedQuestions,pendingDocs,blockedDocs,autoApply};
        if(autoApply){
          notify(`✅ Lote concluído: ${appliedDocs} PDF(s) corrigido(s) (${updatedQuestions} questões atualizadas) · ${blockedDocs} bloqueado(s) para conferência.`);
        }
      }
    }catch(error){if(sameScope(s))notify(String(error.message||error));}finally{if(batchOperation===operation){batchOperation=null;running=false;if(sameScope(s))render();}}
  }
  async function applyAllPending(){
    if(running)return 0;const s=scope();if(!sameScope(s))return 0;
    const pending=[...records.values()].filter(r=>r.status==='pending'&&r.reviewId);
    if(!pending.length){notify('Não há propostas pendentes para aplicar.');return 0;}
    running=true;stopRequested=false;render();
    let applied=0;
    try{
      for(const rec of pending){
        if(stopRequested||!sameScope(s))break;
        const ok=await applyReview(rec,{batchConfirmed:true,silent:true});
        if(ok)applied++;
      }
      if(sameScope(s))notify(`✅ ${applied} de ${pending.length} proposta(s) aplicada(s) com segurança!`);
    }finally{running=false;if(sameScope(s))render();}
    return applied;
  }
  async function restorePending(){
    currentRecords();const s=scope();try{const session=await sessionFor(s),rows=await request(`study_document_question_reviews?user_id=eq.${encodeURIComponent(s.userId)}&status=eq.pending&select=id,document_id,campaign_id,report,status,created_at&order=created_at.desc&limit=100`,undefined,s,session);
      for(const row of rows||[])if(!records.has(row.document_id))records.set(row.document_id,{id:row.document_id,title:row.report?.title||row.document_id,reviewId:row.id,report:row.report,status:'pending',message:'Proposta pendente recuperada da conta.'});render();
    }catch(error){if(sameScope(s))notify(String(error.message||error));}
  }
  function render(){
    const root=document.getElementById('jcQuestionReviewPanel');if(!root)return;const list=currentRecords();
    const labels={reading:'Lendo original',pending:'Aguardando conferência',applied:'Aplicada',blocked:'Bloqueada',applying:'Aplicando'};
    root.innerHTML=`<h3>Conferir questões dos PDFs originais</h3><p>Releia provas e simulados sem apagar a versão atual. A comparação confere extração, disciplina, assunto e gabaritos disponíveis; não certifica a resposta de todas as questões. Este fluxo não usa IA para reescrever a prova.</p><div class="qrActions"><button type="button" class="action" id="qrAutoFixPortal" ${running?'disabled':''} style="width:auto">⚡ Reanalisar e corrigir tudo (este portal)</button><button type="button" class="ghost" id="qrCurrent" ${running?'disabled':''}>Só comparar (este portal)</button><button type="button" class="ghost" id="qrAll" ${running?'disabled':''}>Reanalisar todos os meus portais</button><button type="button" class="ghost" id="qrRestore" ${running?'disabled':''}>Recuperar pendentes</button>${list.some(r=>r.status==='pending')&&!running?'<button type="button" class="action" id="qrApplyAll" style="width:auto">✓ Aplicar todas as propostas prontas</button>':''}${running?'<button type="button" class="ghost" id="qrStop">Pausar após este PDF</button>':''}</div>${lastBatchSummary?`<p class="small" style="margin:8px 0;padding:8px 12px;border-radius:10px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3)"><b>Resumo do lote:</b> ${lastBatchSummary.appliedDocs} PDF(s) corrigido(s) · ${lastBatchSummary.updatedQuestions} questões atualizadas · ${lastBatchSummary.pendingDocs} aguardando conferência · ${lastBatchSummary.blockedDocs} bloqueado(s) (escaneados/ambíguos).</p>`:''}<p class="small muted">Gabaritos revisados e histórico são preservados. PDF sem texto, páginas incompletas ou caderno ambíguo exigem conferência. O lote inclui provas, simulados e materiais cujo título identifica questões. Para um arquivo com categoria/título incorretos, confira sua identificação na Biblioteca.</p><div aria-live="polite">${list.map(r=>{const report=r.report;return `<article class="qrRecord"><b>${escape(r.title)}</b><span class="tag">${labels[r.status]||escape(r.status)}</span><p>${escape(r.message||'Preparando extração...')}</p>${report?`<p>${report.extracted} extraídas · ${report.matched} correspondências · ${report.added} novas · ${report.not_matched} antigas não localizadas (preservadas fora do treino) · ${report.classification_pending} classificações pendentes · ${report.structure_pending||0} estruturas pendentes · ${report.text_integrity_pending||0} alternativas com possível vazamento · ${report.board_pending||0} bancas pendentes · ${report.key_conflicts} divergências de gabarito</p><details><summary>Ver comparação e limites</summary><p>Até 50 alterações exibidas aqui; baixe o relatório para conferir todas as questões e alternativas.</p><p>Revisão factual integral: não comprovada. Gabaritos sem fonte continuam pendentes. Respostas, XP e estatísticas históricas não são recalculados retroativamente.</p>${(report.details||[]).slice(0,50).map(d=>`<p>Questão ${escape(d.number||'?')} · página ${escape(d.page||'?')}: ${escape(d.from)} / ${escape(d.topic_from)} → ${escape(d.to)} / ${escape(d.topic_to)}</p>`).join('')}${(report.items||[]).filter(item=>item.structure_pending).slice(0,50).map(item=>`<p>Questão ${escape(item.number||'?')} · página ${escape(item.page||'?')}: ${escape(item.quality_reason)}</p>`).join('')}<p>${(report.items||[]).length} questões no relatório completo.</p></details>`:''}${report?`<button type="button" class="ghost" data-qr-download="${escape(r.id)}">Baixar relatório completo</button>`:''}${r.status==='pending'?`<label class="qrConfirm"><input type="checkbox" data-qr-confirm="${escape(r.reviewId)}"> Conferi a comparação com o PDF e aceito aplicar esta proposta; pendências continuarão bloqueadas.</label><button type="button" class="ghost" data-qr-apply="${escape(r.id)}">Aplicar esta proposta</button>`:''}${r.status==='blocked'?`${r.emptyPages?.length?`<label class="qrConfirm"><input type="checkbox" data-qr-empty="${escape(r.id)}"> Conferi as páginas ${escape(r.emptyPages.join(', '))}: estão em branco e não contêm questões ou imagens necessárias.</label>`:''}${r.ambiguous?`<label>Este PDF tem vários gabaritos — escolha o caderno (${escape((r.cadernos||[]).join(', '))}): <input data-qr-caderno="${escape(r.id)}" placeholder="Ex.: Azul ou Tipo 1"></label>`:''}<button type="button" class="ghost" data-qr-retry="${escape(r.id)}">Reanalisar este PDF</button>`:''}</article>`;}).join('')||'<p class="small muted">Nenhuma revisão iniciada neste contexto. As propostas salvas podem ser recuperadas da conta.</p>'}</div>`;
    root.querySelector('#qrAutoFixPortal')?.addEventListener('click',()=>startBatch(false,{autoApply:true,allowPartial:true}));root.querySelector('#qrCurrent').onclick=()=>startBatch(false);root.querySelector('#qrAll').onclick=()=>startBatch(true,{autoApply:true,allowPartial:true});root.querySelector('#qrRestore').onclick=restorePending;root.querySelector('#qrApplyAll')?.addEventListener('click',()=>applyAllPending());
    root.querySelector('#qrStop')?.addEventListener('click',()=>{stopRequested=true;notify('O lote será pausado após o PDF atual. Propostas salvas permanecem na conta.');});
    root.querySelectorAll('[data-qr-download]').forEach(b=>b.onclick=()=>downloadReport(records.get(b.dataset.qrDownload)));
    root.querySelectorAll('[data-qr-apply]').forEach(b=>b.onclick=()=>applyReview(records.get(b.dataset.qrApply)));
    root.querySelectorAll('[data-qr-retry]').forEach(b=>b.onclick=()=>reviewDocument(b.dataset.qrRetry,{title:records.get(b.dataset.qrRetry)?.title,preferredCaderno:[...root.querySelectorAll('[data-qr-caderno]')].find(i=>i.dataset.qrCaderno===b.dataset.qrRetry)?.value||'',confirmEmptyPages:!![...root.querySelectorAll('[data-qr-empty]')].find(i=>i.dataset.qrEmpty===b.dataset.qrRetry)?.checked}));
  }
  async function downloadReport(record){
    const s=scope();if(!record||!sameScope(s))return false;
    try{let candidates=record.candidates,previousContent=[];
      if(record.reviewId){const session=await sessionFor(s),rows=await request(`study_document_question_reviews?id=eq.${encodeURIComponent(record.reviewId)}&user_id=eq.${encodeURIComponent(s.userId)}&select=candidates,base_rows&limit=1`,undefined,s,session);candidates=rows?.[0]?.candidates||candidates;previousContent=rows?.[0]?.base_rows||[];}
      if(!sameScope(s))return false;
      const blob=new Blob([JSON.stringify({version:1,exported_at:new Date().toISOString(),report:record.report,candidates:candidates||[],previous_content:previousContent,notice:'Comparação técnica com o PDF; revisão factual integral não comprovada.'},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`revisao-pdf-${record.id}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
    }catch(error){if(sameScope(s))notify(String(error.message||error));return false;}
  }
  function mount(){
    const library=document.getElementById('library');if(!library||document.getElementById('jcQuestionReviewPanel'))return;
    const holder=document.createElement('details');holder.className='card qrHub';holder.innerHTML='<summary>Conferir e reanalisar questões dos PDFs</summary><div id="jcQuestionReviewPanel"></div>';library.prepend(holder);render();
  }
  w.JCQuestionReview={reviewDocument,startBatch,restorePending,applyReview,applyAllPending,downloadReport,mount,reconcile,freshCoverage,identity,validQuestion,examDocument,overlayPersonalReviews,personalSignature};
  if(typeof document!=='undefined'){
    const init=()=>{mount();const library=document.getElementById('library');if(library&&typeof MutationObserver==='function')new MutationObserver(()=>{if(!document.getElementById('jcQuestionReviewPanel'))mount();}).observe(library,{childList:true});};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  }
})();
