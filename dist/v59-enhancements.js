/* Jornada do Caçador v78 — leitura resiliente de PDF, chave IA visível e resumos persistentes. */
(function(){
  const downloadJSON=(name,value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};
  libraryUI.openSummaries=libraryUI.openSummaries||{};
  const normalizeLegalTitle=value=>String(value??'').normalize('NFC').replace(/\b(\d+)\s*a(?=\s+[A-Za-zÀ-ÿ])/g,'$1ª').replace(/\b(\d+)\s*o(?=\s+[A-Za-zÀ-ÿ])/g,'$1º').replace(/\b(?:art(?:igo)?\.?)\s*(\d+)\s*(?:o|º|°)(?=\s|[,.;:()\-–—]|$)/gi,(_match,number)=>`Art. ${number}°`).replace(/\b(?:art(?:igo)?\.?)\s*(\d+)(?=\s|[,.;:()\-–—]|$)/gi,(_match,number)=>`Art. ${number}°`);
  const summaryStateKey=id=>`${state.activeCampaignId||'default'}:${id}`;

  function ensureCoverageDialog(){
    if(document.querySelector('#coverageDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="coverageDialog"><div class="sectionHead"><div><div class="eyebrow">RELATÓRIO DE LEITURA</div><h2 id="coverageTitle">Cobertura do PDF</h2></div><button class="ghost" id="closeCoverage">Fechar</button></div><div id="coverageBody"></div><div class="modalActions"><button class="ghost" id="exportCoverage">Exportar relatório JSON</button></div></dialog>`);
    document.querySelector('#closeCoverage').onclick=()=>document.querySelector('#coverageDialog').close();
  }

  function coverageHTML(doc){
    const coverage=doc?.metadata?.coverage||{},plan=doc?.metadata?.analysis_plan||{},progress=doc?.metadata?.analysis_progress||{},detected=coverage.sections_detected||plan.sections?.map(x=>x.name)||[],covered=coverage.sections_covered||[],omissions=coverage.omissions||[],warnings=coverage.warnings||plan.warnings||[];
    return `<div class="card"><div class="syncCheck"><div><b>${Number(coverage.percent)||0}%</b><span>seções cobertas</span></div><div><b>${Number(coverage.summary_count)||0}</b><span>resumos criados</span></div><div><b>${Number(coverage.estimated_pages||plan.estimated_pages)||0}</b><span>páginas estimadas</span></div><div><b>${Math.round((Number(coverage.confidence)||0)*100)}%</b><span>confiança declarada</span></div></div><p><b>Etapa:</b> ${esc(progress.stage||'concluída')} · ${Number(progress.percent)||100}%</p></div><div class="card"><h3>Seções detectadas</h3>${detected.length?`<ol>${detected.map(x=>`<li>${esc(typeof x==='string'?x:x.name)}</li>`).join('')}</ol>`:'<p class="muted">Inventário ainda não disponível.</p>'}</div><div class="card"><h3>Seções declaradas como cobertas</h3>${covered.length?`<ul>${covered.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">Nenhuma seção declarada.</p>'}</div>${omissions.length?`<div class="lessonBox trap"><b>Omissões informadas</b><ul>${omissions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${warnings.length?`<div class="lessonBox mnemonic"><b>Avisos para conferência</b><ul>${warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'<div class="lessonBox bizu"><b>✓ Nenhum alerta declarado</b>Mesmo assim, confira conteúdos decisivos no PDF original.</div>'}`;
  }

  window.openCoverageReport=function(id){ensureCoverageDialog();const doc=cloudDocuments.find(item=>item.id===id);if(!doc)return toast('Documento não encontrado');document.querySelector('#coverageTitle').textContent=doc.title;document.querySelector('#coverageBody').innerHTML=coverageHTML(doc);document.querySelector('#exportCoverage').onclick=()=>downloadJSON(`relatorio-cobertura-${doc.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,{document_id:doc.id,title:doc.title,exported_at:new Date().toISOString(),metadata:doc.metadata});document.querySelector('#coverageDialog').showModal()};

  const baseDocumentCard=documentCard;
  documentCard=function(doc){
    let html=baseDocumentCard(doc),progress=doc.metadata?.analysis_progress;
    const stages={extracting_text:[1,'Extraindo texto do PDF'],inventory:[1,'Mapeando o PDF'],generation:[2,'Gerando o conteúdo'],review:[3,'Revisando a qualidade'],completed:[4,'Conteúdo concluído']},stage=stages[progress?.stage]||[1,'Preparando a análise'],stageWidth=Math.min(100,Math.max(stage[0]*20,Number(progress?.percent)||stage[0]*25));
    const blocksInfo=progress?.total_sections>0?` (${Number(progress.completed_sections)||0}/${Number(progress.total_sections)} blocos)`:'';
    const pdfKindTag=doc.metadata?.pdf_kind==='scanned_image'
      ?`<div class="small" style="margin-top:6px;color:#fbbf24;font-weight:750">🔍 Arquivo Escaneado / Imagem (Requer OCR Visual · Consome Tokens)</div>`
      :doc.metadata?.pdf_kind==='native_text'
        ?`<div class="small" style="margin-top:6px;color:#34d399;font-weight:750">📄 PDF de Texto Digital (Leitura Local Econômica)</div>`
        :'';
    const extra=`${pdfKindTag}${progress&&doc.processing_status==='processing'?`<div class="materialProgress"><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="100" aria-valuenow="${stageWidth}" aria-label="${esc(stage[1])}"><div class="fill" style="width:${stageWidth}%"></div></div><div class="small muted"><b>Etapa ${stage[0]} de 4</b> — ${esc(stage[1])}${esc(blocksInfo)} · ${stageWidth}%</div></div>`:''}${doc.metadata?.coverage||doc.metadata?.analysis_plan?`<button class="ghost" data-coverage-doc="${doc.id}" style="width:100%;margin-top:8px">Ver relatório completo da análise</button>`:''}`;
    return html.replace('</article>',`${extra}</article>`);
  };
  const baseRenderUserDocuments=renderUserDocuments;
  renderUserDocuments=function(){baseRenderUserDocuments();document.querySelectorAll('[data-coverage-doc]').forEach(button=>button.onclick=()=>openCoverageReport(button.dataset.coverageDoc))};

  loadGeneratedContent=async function(){
    const campaign=activeCampaign(),localCustom=(state.customQuestionsByCampaign?.[state.activeCampaignId]||[]),noteCards=typeof window.extractFlashcardsFromUserNotes==='function'?window.extractFlashcardsFromUserNotes():[];if(!cloudSession||!campaign?.dbId){ALL_SUMMARIES=[];ALL_FLASHCARDS=[...noteCards];ALL_QUESTIONS=[...localCustom];if(typeof window.ensureNativeQuestionBankLoaded==='function')window.ensureNativeQuestionBankLoaded();if(typeof window.ensureNativePedagogicalCouplingLoaded==='function')window.ensureNativePedagogicalCouplingLoaded();LEARNING_SUBJECTS=[...new Set([...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));renderStudy();renderLearning();renderQuestionFilters();return}
    try{const session=await validSession();if(!session)return;const response=await cloudFetch(`generated_study_content?campaign_id=eq.${encodeURIComponent(campaign.dbId)}&user_id=eq.${encodeURIComponent(session.user.id)}&content_type=in.(summary,question_pack)&select=id,title,content_type,content,source_refs,source_document_id,approved&order=created_at.asc`),rows=await response.json();if(!response.ok)throw new Error(rows?.message||'Não foi possível carregar o conteúdo gerado.');const rawSubjects=rows.map(row=>row.content?.subject||'Conteúdo geral');migrateLearningSubjectKeys(rawSubjects);const resolveRowSubject=row=>{if(typeof findSourceDocumentForContent==='function'&&typeof resolveDocumentDiscipline==='function'){const parentDoc=findSourceDocumentForContent(row.source_document_id,row.content?.source||'');return resolveDocumentDiscipline(parentDoc,row.content?.subject,`${row.content?.source||''} ${row.title||''}`)}return canonicalSubjectName(row.content?.subject)};const validRows=rows.filter(row=>{if(typeof window.isHunterManualArtifact==='function'&&window.isHunterManualArtifact(row))return false;const parentDoc=typeof findSourceDocumentForContent==='function'?findSourceDocumentForContent(row.source_document_id,row.content?.source||''):null;const s=resolveRowSubject(row);return !(typeof isInvalidTrailSubject==='function'&&isInvalidTrailSubject(s,row.title,row.content?.source||'',parentDoc))});ALL_SUMMARIES=validRows.filter(row=>{const parentDoc=typeof findSourceDocumentForContent==='function'?findSourceDocumentForContent(row.source_document_id,row.content?.source||''):null;return !row.content?.is_question_pack&&row.content_type!=='question_pack'&&!['prova','simulado'].includes(parentDoc?.document_type)&&(typeof window.isValidPedagogicalSummary!=='function'||window.isValidPedagogicalSummary(row))}).map(row=>{const obj={id:row.id,documentId:row.source_document_id,title:normalizeLegalTitle(row.title),source:row.content?.source||'PDF enviado',category:resolveRowSubject(row),pageStart:Number(row.content?.page_start)||0,pageEnd:Number(row.content?.page_end)||0,approved:!!row.approved,explanation:normalizeLegalTitle(row.content?.explanation||''),points:(row.content?.points||[]).map(normalizeLegalTitle),example:normalizeLegalTitle(row.content?.example||''),bizu:normalizeLegalTitle(row.content?.bizu||''),mnemonic:typeof window.cleanPedagogicalMnemonic==='function'?window.cleanPedagogicalMnemonic(normalizeLegalTitle(row.content?.mnemonic||''),row.title,row.content?.explanation):normalizeLegalTitle(row.content?.mnemonic||''),trap:normalizeLegalTitle(row.content?.trap||'')};return typeof window.sanitizeSummaryObject==='function'?window.sanitizeSummaryObject(obj):obj});const checkRowAllowed=(row)=>{const parentDoc=typeof findSourceDocumentForContent==='function'?findSourceDocumentForContent(row.source_document_id,row.content?.source||''):null;return typeof window.isAllowedFlashcardRow==='function'?window.isAllowedFlashcardRow(row,parentDoc):(!row.content?.is_question_pack&&row.content_type!=='question_pack')};const checkCardValid=(q,a)=>typeof window.isValidFlashcardItem==='function'?window.isValidFlashcardItem(q,a):Boolean(q&&a);const localCards=(state.customFlashcardsByCampaign?.[state.activeCampaignId]||[]).filter(c=>!(typeof isInvalidTrailSubject==='function'&&isInvalidTrailSubject(c?.[0]))&&checkCardValid(c?.[1],c?.[2]));if(state.customFlashcardsByCampaign?.[state.activeCampaignId])state.customFlashcardsByCampaign[state.activeCampaignId]=localCards;ALL_FLASHCARDS=[...validRows.filter(checkRowAllowed).flatMap(row=>{const s=resolveRowSubject(row);return(row.content?.flashcards||[]).map(card=>[s,normalizeLegalTitle(card.question),normalizeLegalTitle(card.answer)]).filter(c=>checkCardValid(c[1],c[2]))}),...localCards,...noteCards];const cloudQuestions=validRows.flatMap(row=>{const s=resolveRowSubject(row);return(row.content?.questions||[]).filter(q=>Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=5&&q.options.every(option=>String(option??'').trim())).map(q=>{const cSubj=canonicalSubjectName(q.subject||s||row.content?.subject,`${s||''} ${q.topic||''} ${q.statement||''} ${row.title||''}`);const isGenTopic=!q.topic||q.topic.startsWith('Questão ')||q.topic.startsWith('Item ')||q.topic===row.title;const cTopic=isGenTopic&&(typeof window.inferQuestionPedagogicalTopic==='function')?window.inferQuestionPedagogicalTopic(q.statement,cSubj):normalizeLegalTitle(q.topic||row.title);return{...q,_fp:undefined,subject:cSubj,topic:cTopic,statement:normalizeLegalTitle(q.statement),associated_text:q.associated_text||'',options:q.options.map(normalizeLegalTitle),correct_index:q.correct_index,explanation:normalizeLegalTitle(q.explanation||''),difficulty:q.difficulty||'medio',origin:q.origin||'autoral',board:q.board||row.content?.source||'',sourceDocumentId:row.source_document_id||null}})}).filter(q=>!(typeof isInvalidTrailSubject==='function'&&isInvalidTrailSubject(q.subject,q.topic))&&(typeof window.isValidPedagogicalQuestion!=='function'||window.isValidPedagogicalQuestion(q)));const seenQ=new Set(cloudQuestions.map(q=>questionFingerprint(q)));const cleanLocalCustom=localCustom.filter(q=>!(typeof isInvalidTrailSubject==='function'&&isInvalidTrailSubject(q?.subject,q?.topic))&&!seenQ.has(questionFingerprint(q)));ALL_QUESTIONS=[...cloudQuestions,...cleanLocalCustom];if(typeof window.ensureNativeQuestionBankLoaded==='function')window.ensureNativeQuestionBankLoaded();LEARNING_SUBJECTS=typeof computeValidLearningSubjects==='function'?computeValidLearningSubjects():[...new Set([...ALL_SUMMARIES.map(x=>x.category),...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));const rememberedTrail=libraryUI.trailSubject[state.activeCampaignId],wanted=canonicalSubjectName(rememberedTrail||selectedLearningSubject);selectedLearningSubject=LEARNING_SUBJECTS.find(subject=>subjectKey(subject)===subjectKey(wanted))||LEARNING_SUBJECTS[0]||'Conteúdo';libraryUI.trailSubject[state.activeCampaignId]=selectedLearningSubject;const savedSummary=libraryUI.summaryFilter[state.activeCampaignId]||'all',savedCard=libraryUI.cardFilter[state.activeCampaignId]||'all',summaryValue=savedSummary==='all'?'all':canonicalSubjectName(savedSummary),cardValue=savedCard==='all'?'all':canonicalSubjectName(savedCard),sf=$('#summaryFilter'),cf=$('#cardFilter'),ns=$('#noteSubject');sf.innerHTML='<option value="all">Todas as disciplinas</option>'+LEARNING_SUBJECTS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');sf.value=LEARNING_SUBJECTS.includes(summaryValue)?summaryValue:'all';cf.innerHTML='<option value="all">Todos os assuntos</option>'+LEARNING_SUBJECTS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');cf.value=LEARNING_SUBJECTS.includes(cardValue)?cardValue:'all';ns.innerHTML='<option value="Geral">Geral</option>'+ALL_SUMMARIES.map(x=>`<option value="${esc(x.title)}" title="${esc(x.title)}">${esc(typeof shortOptionLabel==='function'?shortOptionLabel(x.title,54):x.title.slice(0,54))}</option>`).join('');saveLibraryUI();window.persistToLocalDatabase?.(state.activeCampaignId);window.markViewsDirty?.('study','learning','report');const actId=document.querySelector('.view.active')?.id||'today';if(actId==='study')renderViewById('study',true);else if(actId==='learning')renderViewById('learning',true);else if(actId==='report')renderViewById('report',true)}catch(error){console.warn(error);toast('Não foi possível carregar o conteúdo gerado')}
  };

  window.setSummaryApproval=async function(id,approved){
    const item=ALL_SUMMARIES.find(summary=>summary.id===id);if(!item)return;
    try{const response=await cloudFetch(`generated_study_content?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({approved})});if(!response.ok)throw new Error('Não foi possível atualizar a conferência.');item.approved=approved;renderSummaries($('#summarySearch')?.value||'');toast(approved?'Conteúdo marcado como conferido por você.':'Conferência removida.')}catch(error){toast(error.message)}
  };

  window.openSummarySource=async function(id){const item=ALL_SUMMARIES.find(summary=>summary.id===id),doc=cloudDocuments.find(document=>document.id===item?.documentId);if(!doc)return toast('O PDF de origem não está disponível.');try{const url=await signedDocumentUrl(doc);window.open(`${url}#page=${Math.max(1,item.pageStart||1)}&view=FitH`,'_blank','noopener')}catch(error){toast(error.message)}};
  window.reportSummaryIssue=function(id){const item=ALL_SUMMARIES.find(summary=>summary.id===id);if(!item)return;const current=state.contentIssues?.[id]?.note||'',note=prompt('Descreva o possível erro ou ponto que precisa ser conferido:',current);if(note===null)return;state.contentIssues=state.contentIssues||{};if(note.trim())state.contentIssues[id]={note:note.trim(),title:item.title,source:item.source,campaignId:state.activeCampaignId,reported_at:new Date().toISOString()};else delete state.contentIssues[id];save();renderSummaries($('#summarySearch')?.value||'');toast(note.trim()?'Ponto marcado para conferência.':'Marcação removida.')};


  function computeSummaryDidacticOrder(s){
    const title=String(s?.title||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const source=String(s?.source||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const cat=String(s?.category||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const combined=`${title} ${source}`;

    // 1. Se o título já começa com Manual 01, 02, 03 ou numeração explícita "1.", "2."
    const leadNum=title.match(/^(?:manual|aula|modulo|capitulo|bloco)?\s*0*(\d{1,3})\b/);
    if(leadNum)return Number(leadNum[1]);

    // 2. Direito Constitucional: ordem estrita da Constituição Federal (Art. 1º -> Art. 2º -> Art. 3º -> Art. 4º -> Art. 5º -> Art. 6º -> Art. 12 -> Art. 14 -> Art. 18 -> Art. 37 -> Art. 44 -> Art. 76 -> Art. 92 -> Art. 136 -> Art. 144)
    if(cat.includes('constitucional')){
      if(/teoria da constituicao|poder constituinte|classificacao das constituicoes|aplicabilidade/.test(combined))return 0.5;
      if(/fundamentos da republica|so-ci-di-va-plu|soberania, cidadania|art\.?\s*1\b/.test(combined))return 1;
      if(/organizacao dos poderes|separacao dos poderes|harmonia entre os poderes|art\.?\s*2\b/.test(combined))return 2;
      if(/objetivos fundamentais|construir uma sociedade|erradicar a pobreza|art\.?\s*3\b/.test(combined))return 3;
      if(/relacoes internacionais|autodeterminacao dos povos|concessao de asilo|art\.?\s*4\b/.test(combined))return 4;
      const artMatch=title.match(/\bart(?:igo|s)?\.?\s*(\d{1,3})\b/)||source.match(/\bart(?:igo|s)?\.?\s*(\d{1,3})\b/);
      if(artMatch){
        const n=Number(artMatch[1]);
        if(n===5){
          if(/teoria geral|vida|igualdade|principio da igualdade/.test(title))return 5.05;
          if(/liberdade|locomocao|pensamento|expressao|crenca|profiss/.test(title))return 5.10;
          if(/domicilio|inviolabilidade|sigilo|correspondencia|reuniao|associacao/.test(title))return 5.15;
          if(/propriedade|desapropriacao|direito de peticao|certidao/.test(title))return 5.20;
          if(/pena|prisao|flagrante|racismo|tortura|inafiancave|imprescritive| contraditorio/.test(title))return 5.25;
          if(/remedios|habeas|mandado de seguranca|mandado de injuncao|acao popular/.test(title))return 5.30;
          return 5.18;
        }
        return n;
      }
      if(/principios fundamentais/.test(combined))return 1.5;
      if(/direitos individuais|direitos e deveres individuais|liberdades/.test(combined))return 5.12;
      if(/remedios constitucionais|habeas corpus|mandado de seguranca|acao popular/.test(combined))return 5.35;
      if(/direitos sociais|trabalhadores/.test(combined))return 6;
      if(/nacionalidade|nato|naturalizado/.test(combined))return 12;
      if(/direitos politicos|partidos politicos|plebiscito|sufragio/.test(combined))return 14;
      if(/organizacao politico|organizacao do estado|uniao|estados|municipios|competencia/.test(combined))return 18;
      if(/administracao publica|servidores|limpe|nepotismo|sumula vinculante 13/.test(combined))return 37;
      if(/militares dos estados/.test(combined))return 42;
      if(/poder legislativo|congresso nacional|camara|senado|processo legislativo/.test(combined))return 44;
      if(/poder executivo|presidente da republica/.test(combined))return 76;
      if(/poder judiciario|supremo tribunal|stf|stj|ministerio publico|defensoria|funcoes essenciais/.test(combined))return 92;
      if(/estado de defesa|estado de sitio|forcas armadas/.test(combined))return 136;
      if(/seguranca publica|policia|bombeiro/.test(combined))return 144;
      return 200;
    }

    // 3. Qualquer outra disciplina com "Art. X" explícito no título
    const explicitArt=title.match(/\bart(?:igo|s)?\.?\s*(\d{1,3})\b/);
    if(explicitArt)return Number(explicitArt[1]);

    // 4. Língua Portuguesa (Ordem didática: Fonética/Acentuação -> Morfologia/Classes -> Colocação -> Sintaxe -> Concordância -> Regência/Crase -> Pontuação -> Coesão/Semântica -> Interpretação/Tipologia)
    if(cat.includes('portugues')){
      if(/fonetica|ortografia|acentuacao|divisao silabica|hifen/.test(title))return 1;
      if(/formacao de palavras|estrutura/.test(title))return 2;
      if(/classes de palavras|morfologia|substantivo|adjetivo|verbo|adverbio|pronome|conjunc/.test(title))return 3;
      if(/colocacao pronominal|proclise|mesoclise|enclise/.test(title))return 4;
      if(/sintaxe|periodo simples|sujeito|predicado|funcoes do se|particula apassivadora/.test(title))return 5;
      if(/periodo composto|coordenacao|subordinacao|oracoes/.test(title))return 6;
      if(/concordancia/.test(title))return 7;
      if(/regencia|crase/.test(title))return 8;
      if(/pontuacao|virgula/.test(title))return 9;
      if(/semantica|coesao|coerencia|reescrita|figuras de linguagem/.test(title))return 10;
      if(/tipologia|generos|interpretacao|compreensao/.test(title))return 11;
      if(/redacao oficial/.test(title))return 12;
      return 50;
    }

    // 5. Raciocínio Lógico-Matemático (Proposições -> Tabela-Verdade -> Equivalências/Negação -> Quantificadores/Argumentação -> Conjuntos -> Razão/Porcentagem -> Combinatória/Probabilidade)
    if(cat.includes('raciocinio')||cat.includes('logico')||cat.includes('matematica')){
      if(/proposic|conectivos|estruturas logicas/.test(title))return 1;
      if(/tabela-verdade|tautologia|contradicao|contingencia/.test(title))return 2;
      if(/equivalencia|negacao|de morgan|mane/.test(title))return 3;
      if(/quantificadores|diagramas logicos|todo, algum/.test(title))return 4;
      if(/argumentacao|deducao|validade/.test(title))return 5;
      if(/conjuntos|venn/.test(title))return 6;
      if(/sequencias|razao|proporcao|porcentagem|regra de tres/.test(title))return 7;
      if(/combinatoria|arranjo|combinacao|permutacao|pombos/.test(title))return 8;
      if(/probabilidade/.test(title))return 9;
      return 50;
    }

    // 6. Direito Administrativo
    if(cat.includes('administrativo')){
      if(/principios|regime juridico|limpe/.test(title))return 1;
      if(/organizacao administrativa|direta e indireta|desconcentracao|descentralizacao|autarquia/.test(title))return 2;
      if(/poderes|poder de policia|hierarquico|disciplinar/.test(title))return 3;
      if(/atos administrativos|requisitos|atributos|anulacao|revogacao/.test(title))return 4;
      if(/agentes publicos|servidores|acumulacao/.test(title))return 5;
      if(/servicos publicos|licitac|contratos/.test(title))return 6;
      if(/responsabilidade civil/.test(title))return 7;
      if(/controle|improbidade/.test(title))return 8;
      return 50;
    }

    // 7. Direito Penal
    if(cat.includes('penal')&&!cat.includes('processual')){
      if(/aplicacao da lei|principios|tempo e lugar|luta/.test(title))return 1;
      if(/fato tipico|teoria do crime|conduta|dolo|tentativa|desistencia|arrependimento/.test(title))return 2;
      if(/ilicitude|excludentes|legitima defesa|estado de necessidade/.test(title))return 3;
      if(/culpabilidade|imputabilidade/.test(title))return 4;
      if(/concurso de pessoas|concurso de crimes/.test(title))return 5;
      if(/crimes contra a pessoa|crimes contra a vida|homicidio|lesao/.test(title))return 6;
      if(/patrimonio|furto|roubo|latrocinio|estelionato/.test(title))return 7;
      if(/administracao publica|peculato|concussao|corrupcao|prevaricacao/.test(title))return 8;
      return 50;
    }

    // 8. Direito Processual Penal
    if(cat.includes('processual')){
      if(/principios|disposicoes preliminares|juiz das garantias/.test(title))return 1;
      if(/inquerito policial/.test(title))return 2;
      if(/acao penal/.test(title))return 3;
      if(/competencia|jurisdicao/.test(title))return 4;
      if(/prova|cadeia de custodia/.test(title))return 5;
      if(/flagrante|prisao em flagrante/.test(title))return 6;
      if(/preventiva|temporaria|cautelares/.test(title))return 7;
      return 50;
    }

    // 9. História de Pernambuco (Ordem Cronológica Século XVI -> XVII -> XVIII -> 1817 -> 1824 -> 1848 -> Século XX)
    if(cat.includes('historia')){
      if(/indigena|capitania|duarte coelho|acucar|colonial/.test(title))return 1;
      if(/holand|nassau|insurreicao|guararapes/.test(title))return 2;
      if(/mascates|suassunas/.test(title))return 3;
      if(/1817|revolucao pernambucana/.test(title))return 4;
      if(/1824|confederacao do equador/.test(title))return 5;
      if(/regencia|cabanada|abrilada|setembrada|carneirada|1848|praieira/.test(title))return 6;
      if(/republica|vargas|cangaco|moderniz/.test(title))return 7;
      return 50;
    }

    return Number(s?.pageStart||s?.page||999);
  }

  function formatDidacticSummaryTitle(s){
    const raw=String(s?.title||'').trim();
    const norm=raw.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const cat=String(s?.category||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(cat.includes('constitucional')&&!/\bart\.?\s*\d/i.test(raw)){
      if(/fundamentos da republica/.test(norm))return `${raw} (Art. 1º)`;
      if(/organizacao dos poderes|separacao dos poderes/.test(norm))return `${raw} (Art. 2º)`;
      if(/objetivos fundamentais/.test(norm))return `${raw} (Art. 3º)`;
      if(/relacoes internacionais/.test(norm))return `${raw} (Art. 4º)`;
      if(/liberdades de locomocao|direitos individuais e coletivos|remedios constitucionais/.test(norm))return `${raw} (Art. 5º)`;
      if(/direitos sociais/.test(norm))return `${raw} (Arts. 6º a 11)`;
      if(/nacionalidade/.test(norm))return `${raw} (Art. 12)`;
      if(/direitos politicos/.test(norm))return `${raw} (Arts. 14 a 17)`;
      if(/seguranca publica/.test(norm))return `${raw} (Art. 144)`;
    }
    return raw;
  }

  function sortSummariesDidactically(list){
    return (list||[]).slice().sort((a,b)=>{
      const ra=computeSummaryDidacticOrder(a);
      const rb=computeSummaryDidacticOrder(b);
      if(ra!==rb)return ra-rb;
      const pa=Number(a?.pageStart||a?.page||9999);
      const pb=Number(b?.pageStart||b?.page||9999);
      if(pa!==pb)return pa-pb;
      return String(a?.title||'').localeCompare(String(b?.title||''),'pt-BR');
    });
  }
  window.sortSummariesDidactically=sortSummariesDidactically;
  window.formatDidacticSummaryTitle=formatDidacticSummaryTitle;

  renderSummaries=function(query=''){
    if(typeof window.ensureNativePedagogicalCouplingLoaded==='function')window.ensureNativePedagogicalCouplingLoaded();
    if(Array.isArray(ALL_SUMMARIES)&&typeof window.sanitizeSummaryObject==='function')ALL_SUMMARIES.forEach(s=>window.sanitizeSummaryObject(s));
    const q=query.trim().toLocaleLowerCase('pt-BR'),filter=$('#summaryFilter')?.value||libraryUI.summaryFilter[state.activeCampaignId]||'all',filterKey=filter==='all'?'all':subjectKey(filter);
    const items=ALL_SUMMARIES.filter(s=>{
      if(typeof window.isHunterManualArtifact==='function'&&window.isHunterManualArtifact(s))return false;
      if(filterKey!=='all'&&subjectKey(s.category)!==filterKey)return false;
      if(!q)return true;
      if(!s._hay)s._hay=[s.title,s.category,s.explanation,s.example,s.bizu,s.mnemonic,s.trap,...(s.points||[])].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return s._hay.includes(q);
    });
    const groups=items.reduce((out,item)=>{(out[item.category]||=[]).push(item);return out},{});
    const card=s=>{
      const isOpen=!!libraryUI.openSummaries[summaryStateKey(s.id)];
      return `<article class="summaryCard${isOpen?' open':''}"><button class="summaryHead" data-summary="${s.id}" data-norm-done="1"><span class="summaryTitle"><span class="summaryMeta">${esc(s.source||'PDF enviado')} · ${s.approved?'✓ CONFERIDO PELO USUÁRIO':'GERADO POR IA'}${state.contentIssues?.[s.id]?' · ⚠ REVISAR':''}</span><span>${esc(typeof formatDidacticSummaryTitle==='function'?formatDidacticSummaryTitle(s):s.title)}</span></span><span>${isOpen?'−':'＋'}</span></button><div class="summaryBody">${s.pageStart?`<span class="tag">Fonte: pág. ${s.pageStart}${s.pageEnd>s.pageStart?`–${s.pageEnd}`:''}</span>`:''}${s.explanation?`<p class="lessonIntro">${esc(s.explanation)}</p>`:''}<div class="lessonBox"><b>Pontos essenciais</b><ul>${(s.points||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>${s.example?`<div class="lessonBox"><b>Exemplo explicado</b>${esc(s.example)}</div>`:''}${s.bizu?`<div class="lessonBox bizu"><b>✓ Bizu de prova</b>${esc(s.bizu)}</div>`:''}${s.mnemonic?`<div class="lessonBox mnemonic"><b>◆ Mnemônico</b>${esc(s.mnemonic)}</div>`:''}${s.trap?`<div class="lessonBox trap"><b>⚠ Pegadinha frequente</b>${esc(s.trap)}</div>`:''}${state.contentIssues?.[s.id]?`<div class="lessonBox trap"><b>Ponto marcado para conferência</b>${esc(state.contentIssues[s.id].note)}</div>`:''}<div class="summaryActions"><button class="action small" type="button" data-open-mindmap="${s.id}" style="width:auto">🗺️ Mapa Mental Tático</button>${s.documentId?`<button class="ghost" data-open-summary-source="${s.id}">Abrir PDF na página</button>`:''}<button class="ghost" data-approve-summary="${s.id}" data-approved="${s.approved?'1':'0'}">${s.approved?'Remover conferência':'Marcar como conferido'}</button><button class="ghost" type="button" data-edit-summary="${s.id}">✏️ Editar / Corrigir Resumo</button><button class="ghost" data-report-summary="${s.id}">${state.contentIssues?.[s.id]?'Editar alerta':'Informar possível erro'}</button></div><div class="mindMapContainer" id="mindMapBox-${s.id}" hidden></div><p class="small muted">${s.approved?'Você registrou que conferiu este conteúdo.':'Conteúdo gerado por IA: confira o PDF original antes de decisões de estudo importantes.'}</p></div></article>`;
    };
    const sortedGroups=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b,'pt-BR'));
    $('#summaryList').innerHTML=items.length?`<div class="libraryFolders">${sortedGroups.map(([subject,subjectItems],idx)=>{const key=`study:${state.activeCampaignId}:${subjectKey(subject)}`,open=q?true:(libraryUI.studyFolders[key]!==undefined?libraryUI.studyFolders[key]:idx===0);return`<section class="libraryFolder ${open?'open':''}" data-study-folder="${esc(key)}"><button class="folderHead" data-study-folder-toggle="${esc(key)}"><span><i>▤</i>${esc(subject)}</span><span class="tag">${subjectItems.length} resumo${subjectItems.length===1?'':'s'}</span></button><div class="folderBody">${(typeof sortSummariesDidactically==='function'?sortSummariesDidactically(subjectItems):subjectItems).map(card).join('')}</div></section>`}).join('')}</div>`:'<div class="empty">Nenhum resumo corresponde aos filtros. Envie um PDF na Biblioteca e gere o conteúdo.</div>';
    $$('[data-study-folder-toggle]').forEach(button=>button.onclick=()=>{const folder=button.closest('.libraryFolder'),open=!folder.classList.contains('open');folder.classList.toggle('open',open);libraryUI.studyFolders[button.dataset.studyFolderToggle]=open;saveLibraryUI()});
    $$('[data-summary]').forEach(b=>b.onclick=()=>{const summary=b.closest('.summaryCard');summary.classList.toggle('open');b.lastElementChild.textContent=summary.classList.contains('open')?'−':'＋'});
    $$('[data-open-summary-source]').forEach(button=>button.onclick=()=>openSummarySource(button.dataset.openSummarySource));
    $$$('[data-edit-summary]').forEach(button=>button.onclick=()=>window.openEditSummaryModal?.(button.dataset.editSummary));
    $$$('[data-report-summary]').forEach(button=>button.onclick=()=>reportSummaryIssue(button.dataset.reportSummary));
    $$('[data-approve-summary]').forEach(button=>button.onclick=()=>setSummaryApproval(button.dataset.approveSummary,button.dataset.approved!=='1'))
  };

  exportApplicationBackup=function(){downloadJSON(`jornada-cacador-backup-v78-${localDayKey()}.json`,{format:'jornada-cacador-backup',version:78,exported_at:new Date().toISOString(),campaign:activeCampaign(),state,documents:cloudDocuments.map(doc=>({id:doc.id,title:doc.title,document_type:doc.document_type,processing_status:doc.processing_status,detected_subject:doc.detected_subject,created_at:doc.created_at,metadata:doc.metadata})),study_content:{summaries:ALL_SUMMARIES.filter(item=>!window.isHunterManualArtifact?.(item)),flashcards:ALL_FLASHCARDS.filter(item=>!window.isHunterManualArtifact?.(item)),questions:ALL_QUESTIONS.filter(item=>!window.isHunterManualArtifact?.(item))},notice:'Este backup não contém senhas, chaves secretas nem os arquivos PDF privados.'});toast('Backup completo da versão 78 exportado')};

  let restoringSummaries=false;
  const restoreOpenSummaries=()=>{if(restoringSummaries)return;restoringSummaries=true;try{document.querySelectorAll('[data-summary]:not([data-norm-done="1"])').forEach(button=>{button.dataset.normDone='1';const open=!!libraryUI.openSummaries[summaryStateKey(button.dataset.summary)],card=button.closest('.summaryCard'),icon=open?'−':'＋';card?.classList.toggle('open',open);if(button.lastElementChild&&button.lastElementChild.textContent!==icon)button.lastElementChild.textContent=icon;const title=button.querySelector('.summaryTitle span:last-child'),normalized=normalizeLegalTitle(title?.textContent);if(title&&title.textContent!==normalized)title.textContent=normalized})}finally{restoringSummaries=false}};
  document.querySelector('#summaryList')?.addEventListener('click',event=>{const button=event.target.closest?.('[data-summary]');if(!button)return;libraryUI.openSummaries[summaryStateKey(button.dataset.summary)]=!button.closest('.summaryCard')?.classList.contains('open');saveLibraryUI()},{capture:true});
  const summaryObserver=new MutationObserver(()=>restoreOpenSummaries());
  if(document.querySelector('#summaryList'))summaryObserver.observe(document.querySelector('#summaryList'),{childList:true});
  restoreOpenSummaries();

  const baseDiagnostics=runSystemDiagnostics;
  runSystemDiagnostics=async function(){await baseDiagnostics();const root=$('#diagnosticsList'),ready=cloudDocuments.filter(x=>x.processing_status==='ready'),warnings=ready.filter(x=>x.metadata?.coverage?.needs_review),approved=ALL_SUMMARIES.filter(x=>x.approved).length,total=ALL_SUMMARIES.length,issues=Object.values(state.contentIssues||{}).filter(item=>item.campaignId===state.activeCampaignId).length;root.insertAdjacentHTML('beforeend',diagnosticRow('Cobertura pedagógica',warnings.length===0,`${ready.length} PDF(s) pronto(s) · ${warnings.length} com alerta de cobertura`)+diagnosticRow('Conferência humana',total===0||approved===total,`${approved} de ${total} resumo(s) marcados como conferidos · ${issues} alerta(s) do usuário`)+diagnosticRow('Limite diário de PDFs',true,personalAiStatus?.configured?'Até 25 análises concluídas com sua chave pessoal; erros não consomem cota':'Até 10 análises concluídas; tentativas com erro não são cobradas'))};

  let personalAiStatus=null;
  function ensurePersonalAiDialog(){
    if(document.querySelector('#personalAiDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="personalAiDialog"><div class="sectionHead"><div><div class="eyebrow">CONFIGURAÇÕES DE IA</div><h2>Minha chave Gemini</h2></div><button class="ghost" id="closePersonalAi">Fechar</button></div><div class="card"><p>Use sua própria chave para que análises de PDFs, editais, redações e o Instrutor IA consumam a cota da sua conta Google. A chave será testada e guardada criptografada no Supabase Vault.</p><div id="personalAiState" class="lessonBox">Consultando configuração...</div><label class="field" style="margin-top:12px">Chave Gemini<input id="personalGeminiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Cole sua chave do Google AI Studio"></label><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input id="showPersonalGeminiKey" type="checkbox"> Mostrar chave enquanto digito</label><div class="modalActions" style="margin-top:12px"><button class="ghost danger" id="deletePersonalGeminiKey" hidden>Remover chave</button><button class="action" id="savePersonalGeminiKey">Testar e salvar</button></div><p class="small muted">A chave completa nunca será exibida novamente nem gravada neste aparelho.</p></div><div class="card"><h3>Como criar sua chave</h3><ol><li>Acesse o Google AI Studio.</li><li>Entre em sua conta Google.</li><li>Clique em <b>Create API key</b>.</li><li>Crie ou escolha um projeto.</li><li>Copie a chave e cole acima.</li><li>No Google Cloud, restrinja a chave para a Gemini API.</li></ol><a class="ghost" style="display:block;text-align:center" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Abrir Google AI Studio</a></div></dialog>`);
    const dialog=document.querySelector('#personalAiDialog'),key=document.querySelector('#personalGeminiKey');
    document.querySelector('#closePersonalAi').onclick=()=>{key.value='';dialog.close()};
    document.querySelector('#showPersonalGeminiKey').onchange=event=>{key.type=event.target.checked?'text':'password'};
    document.querySelector('#savePersonalGeminiKey').onclick=savePersonalGeminiKey;
    document.querySelector('#deletePersonalGeminiKey').onclick=deletePersonalGeminiKey;
  }
  async function callAiKeyManager(body){const session=await validSession();if(!session)throw new Error('Entre novamente na sua conta.');const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-key-manager`,{method:'POST',headers:authHeaders(session.access_token),body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Não foi possível atualizar a configuração de IA.');return data}
  function renderPersonalAiStatus(){
    const root=document.querySelector('#personalAiState'),remove=document.querySelector('#deletePersonalGeminiKey'),accountButton=document.querySelector('#personalAiSettings');
    const configured=!!personalAiStatus?.configured,lastFour=personalAiStatus?.last_four||'';
    if(root){
      root.className=`lessonBox ${configured?'bizu':''}`;
      root.innerHTML=configured?`<b>✓ Chave pessoal ativa</b><br><span class="small">Gemini ••••${esc(lastFour)} · análises de PDFs, editais, redações e assistente usarão sua própria cota.</span>`:'<b>Chave pessoal não configurada</b><br><span class="small">Enquanto não configurar, aplica-se a cota compartilhada limitada do aplicativo.</span>';
    }
    if(remove)remove.hidden=!configured;
    if(accountButton)accountButton.textContent=configured?`IA pessoal: ativa (••••${lastFour})`:'Configurar minha IA';
    document.querySelectorAll('[data-open-personal-ai]').forEach(btn=>{
      btn.textContent=configured?`✓ Chave Gemini ••••${lastFour}`:'Configurar minha chave IA';
      btn.classList.toggle('successText',configured);
    });
    const menuAiSpan=document.querySelector('#menuPersonalAi span');
    if(menuAiSpan)menuAiSpan.textContent=configured?`Chave IA (••••${lastFour})`:'Chave Gemini (IA)';
    const smartProvider=document.querySelector('#smartProvider');
    if(smartProvider)smartProvider.textContent=configured?`Gemini pessoal (••••${lastFour})`:'DeepSeek → Groq → Gemini';
    const aiStatus=document.querySelector('#aiStatus');
    if(aiStatus&&cloudSession)aiStatus.textContent=configured?`✓ Gemini pessoal (••••${lastFour})`:'IA conectada';
  }
  async function loadPersonalAiStatus(){if(!cloudSession){personalAiStatus=null;renderPersonalAiStatus();return}try{personalAiStatus=await callAiKeyManager({action:'status'})}catch(error){personalAiStatus={configured:false,error:error.message}}renderPersonalAiStatus()}
  async function openPersonalAiSettings(){if(!cloudSession){toast('Entre na sua conta primeiro para configurar sua chave Gemini.');document.querySelector('#accountBtn')?.click();return}ensurePersonalAiDialog();document.querySelector('#personalGeminiKey').value='';document.querySelector('#showPersonalGeminiKey').checked=false;document.querySelector('#personalGeminiKey').type='password';document.querySelector('#personalAiDialog').showModal();renderPersonalAiStatus();await loadPersonalAiStatus()}
  async function savePersonalGeminiKey(){const key=document.querySelector('#personalGeminiKey').value.replace(/[\s\u200B-\u200D\uFEFF]+/g,'').trim();if(key.length<20)return toast('Cole uma chave Gemini válida.');const password=await requestPasswordConfirmation({title:personalAiStatus?.configured?'Substituir sua chave Gemini?':'Salvar sua chave Gemini?',text:'Confirme sua senha atual. A chave será testada e armazenada criptografada; ela nunca será exibida novamente.',button:'Testar e salvar'});if(!password)return;const button=document.querySelector('#savePersonalGeminiKey');button.disabled=true;button.textContent='Testando chave...';try{personalAiStatus=await callAiKeyManager({action:'save',key,password});document.querySelector('#personalGeminiKey').value='';renderPersonalAiStatus();toast(personalAiStatus?.message||'Chave Gemini pessoal configurada com segurança.')}catch(error){toast(error.message)}finally{button.disabled=false;button.textContent='Testar e salvar'}}
  async function deletePersonalGeminiKey(){const password=await requestPasswordConfirmation({title:'Remover sua chave Gemini?',text:'A chave pessoal será apagada definitivamente do cofre. As futuras análises voltarão para a cota compartilhada limitada.',button:'Remover chave'});if(!password)return;try{personalAiStatus=await callAiKeyManager({action:'delete',password});renderPersonalAiStatus();toast('Chave Gemini pessoal removida.')}catch(error){toast(error.message)}}
  window.openPersonalAiSettings=openPersonalAiSettings;
  window.getPersonalAiStatus=()=>personalAiStatus;
  ensurePersonalAiDialog();

  const passwordButton=document.querySelector('#changePasswordBtn');
  if(passwordButton&&!document.querySelector('#personalAiSettings')){passwordButton.insertAdjacentHTML('beforebegin','<button class="ghost" id="personalAiSettings" style="margin-top:8px;width:100%">Configurar minha IA</button>');document.querySelector('#personalAiSettings').onclick=openPersonalAiSettings}

  // Adiciona atalhos diretos para configurar/verificar a chave Gemini pessoal no Menu, Biblioteca, Instrutor IA e Redação
  const menuGrid=document.querySelector('#moreDialog .menuGrid');
  if(menuGrid&&!document.querySelector('#menuPersonalAi')){
    menuGrid.insertAdjacentHTML('beforeend','<button class="menuItem" id="menuPersonalAi">🔑<span>Chave Gemini (IA)</span></button>');
    document.querySelector('#menuPersonalAi').onclick=()=>{document.querySelector('#moreDialog')?.close();openPersonalAiSettings()};
  }
  const uploadHead=document.querySelector('#library .uploadZone .sectionHead');
  if(uploadHead&&!uploadHead.querySelector('[data-open-personal-ai]')){
    const statusTag=uploadHead.querySelector('.docStatus');
    if(statusTag){
      statusTag.insertAdjacentHTML('beforebegin','<button class="ghost small" type="button" data-open-personal-ai="1" style="padding:6px 10px;min-height:36px">Configurar minha chave IA</button>');
    }
  }
  const aiHeroHead=document.querySelector('#assistant .aiHero .sectionHead');
  if(aiHeroHead&&!aiHeroHead.querySelector('[data-open-personal-ai]')){
    aiHeroHead.insertAdjacentHTML('beforeend','<button class="ghost small" type="button" data-open-personal-ai="1" style="padding:6px 10px;min-height:36px">Configurar minha chave IA</button>');
  }
  const essayHead=document.querySelector('#essay>.sectionHead');
  if(essayHead&&!essayHead.querySelector('[data-open-personal-ai]')){
    essayHead.insertAdjacentHTML('beforeend','<button class="ghost small" type="button" data-open-personal-ai="1" style="padding:6px 10px;min-height:36px">Configurar minha chave IA</button>');
  }
  document.querySelectorAll('[data-open-personal-ai]').forEach(btn=>btn.onclick=openPersonalAiSettings);

  const baseUpdateAccountUI=updateAccountUI;
  updateAccountUI=function(){baseUpdateAccountUI();if(cloudSession)loadPersonalAiStatus();else{personalAiStatus=null;renderPersonalAiStatus()}};
  if(cloudSession)loadPersonalAiStatus();

  ensureCoverageDialog();
  document.querySelector('#aboutDialog .tag').textContent='Versão 78 · Caderno Inteligente e IA pessoal';
  document.querySelector('#diagnosticsDialog .small.muted').textContent='Versão 78 · interface, IA pessoal, PDFs, segurança e sincronização';
  setInterval(()=>{if(document.visibilityState==='visible'&&cloudSession&&cloudDocuments.some(doc=>doc.processing_status==='processing'))loadCloudDocuments()},8000);
})();
