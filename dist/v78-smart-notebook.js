(()=>{
  'use strict';
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  // O cache antigo não tem dono comprovável e nunca é migrado para uma conta.
  const LEGACY_STORE='jornada-smart-notebook-v78';
  const STORE='jornada-smart-notebook-v185';
  const MAX_SOURCES=5,MAX_CACHE_ENTRIES=12,MAX_STORAGE_CHARS=384*1024;
  const dataByScope=new Map();
  let displayedScope='',activeOperation=null,requestSequence=0;
  function notebookScope(){
    let st={},session=null,campaign=null;
    try{st=typeof state==='object'&&state?state:(window.state||{});}catch{}
    try{session=typeof cloudSession!=='undefined'?cloudSession:window.cloudSession;}catch{}
    try{campaign=typeof activeCampaign==='function'?activeCampaign():null;}catch{}
    const ownerId=String(session?.user?.id||'guest'),stateOwner=String(st._ownerUserId||'');
    const scope={ownerId,campaignId:String(st.activeCampaignId||'default'),campaignDbId:String(campaign?.dbId||''),campaignName:String(campaign?.name||''),resetEpoch:Number(st._resetEpoch||0),ready:ownerId==='guest'?!stateOwner:stateOwner===ownerId};
    scope.key=JSON.stringify([scope.ownerId,scope.campaignId,scope.campaignDbId,scope.resetEpoch]);return scope;
  }
  function scopeMatches(scope){const now=notebookScope();return scope.ready&&now.ready&&scope.key===now.key;}
  function storageKey(scope){return `${STORE}:${encodeURIComponent(scope.ownerId)}:${scope.resetEpoch}:${encodeURIComponent(scope.campaignId)}:${encodeURIComponent(scope.campaignDbId)}`;}
  function campaignKey(){return notebookScope().campaignId;}
  function emptyData(){return{subject:'all',sources:[],cache:Object.create(null),lastResult:null,manualEmpty:false};}
  function validResult(item,scope){return item&&item.scopeKey===scope.key&&typeof item.answer==='string'&&item.answer.trim()&&item.answer.length<=120000&&typeof item.signature==='string'&&item.signature.length<=60000&&Array.isArray(item.sources)&&item.sources.length<=MAX_SOURCES&&item.sources.every(value=>typeof value==='string');}
  function load(scope){
    if(!scope.ready)return emptyData();
    try{
      const raw=localStorage.getItem(storageKey(scope));if(!raw||raw.length>MAX_STORAGE_CHARS)return emptyData();
      const saved=JSON.parse(raw);if(saved?.version!==1||saved.scopeKey!==scope.key||saved.ownerId!==scope.ownerId)return emptyData();
      const input=saved.data;if(!input||typeof input!=='object'||Array.isArray(input))return emptyData();
      const data=emptyData();data.subject=typeof input.subject==='string'?input.subject.slice(0,200):'all';
      data.sources=Array.isArray(input.sources)?input.sources.filter(id=>typeof id==='string').slice(0,MAX_SOURCES):[];data.manualEmpty=input.manualEmpty===true;
      for(const [key,value] of Object.entries(input.cache||{}).slice(-MAX_CACHE_ENTRIES))if(/^[a-z0-9]+$/.test(key)&&validResult(value,scope))data.cache[key]=value;
      data.lastResult=validResult(input.lastResult,scope)?input.lastResult:null;return data;
    }catch{return emptyData();}
  }
  function syncNotebookScope(){
    const scope=notebookScope(),key=scope.ready?scope.key:`loading:${scope.key}`;
    if(displayedScope!==key){
      const previous=displayedScope;displayedScope=key;
      if(previous){const input=q('#smartQuestion');if(input)input.value='';}
      if(activeOperation){const old=activeOperation;activeOperation=null;old.controller?.abort();}
      const result=q('#smartResult'),message=q('#smartMessage');if(result)result.innerHTML='';if(message)message.textContent=scope.ready?'Selecione as fontes deste portal.':'Aguarde o carregamento da sua conta.';
    }
    return scope;
  }
  function current(scope=syncNotebookScope()){
    if(!scope.ready)return emptyData();if(!dataByScope.has(scope.key))dataByScope.set(scope.key,load(scope));return dataByScope.get(scope.key);
  }
  function persist(scope=notebookScope(),data=current(scope)){
    if(!scopeMatches(scope))return false;
    const entries=Object.entries(data.cache);while(entries.length>MAX_CACHE_ENTRIES){const [key]=entries.shift();delete data.cache[key];}
    try{
      let serialized=JSON.stringify({version:1,scopeKey:scope.key,ownerId:scope.ownerId,data});
      while(serialized.length>MAX_STORAGE_CHARS&&entries.length){const [key]=entries.shift();delete data.cache[key];serialized=JSON.stringify({version:1,scopeKey:scope.key,ownerId:scope.ownerId,data});}
      if(serialized.length>MAX_STORAGE_CHARS)return false;
      localStorage.setItem(storageKey(scope),serialized);return true;
    }catch{return false;}
  }
  function notebookBusy(){const scope=syncNotebookScope();return !!activeOperation&&activeOperation.scope.key===scope.key;}
  function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function readySources(){
    const scope=syncNotebookScope();if(!scope.ready||scope.ownerId==='guest')return[];
    return(cloudDocuments||[]).filter(doc=>{
      const community=doc.is_community===true,owned=doc.user_id===scope.ownerId||(!doc.user_id&&doc.campaign_id===scope.campaignDbId&&scope.campaignDbId);
      return !window.isHunterManualArtifact?.(doc)&&!['edital','edital_concurso'].includes(doc.document_type)&&doc.processing_status==='ready'&&(community||(owned&&doc.campaign_id===scope.campaignDbId))&&(ALL_SUMMARIES||[]).some(summary=>!window.isHunterManualArtifact?.(summary)&&summary.documentId===doc.id);
    });
  }
  function notebookQuestions(){
    const scope=syncNotebookScope();if(!scope.ready||scope.ownerId==='guest')return[];
    const ids=new Set(selectedSources().map(doc=>doc.id)),subject=current().subject;
    return(ALL_QUESTIONS||[]).filter(item=>ids.has(item.documentId||item.sourceDocumentId||item.source_document_id)&&(subject==='all'||subjectKey(item.subject)===subjectKey(subject)));
  }
  function sourceSubject(doc){const own=(ALL_SUMMARIES||[]).find(summary=>!window.isHunterManualArtifact?.(summary)&&summary.documentId===doc.id)?.category;return canonicalSubjectName(own||doc.detected_subject||doc.metadata?.primary_subject||'Conteúdo geral')}
  function subjectSources(){const data=current(),sources=readySources();return data.subject==='all'?sources:sources.filter(doc=>subjectKey(sourceSubject(doc))===subjectKey(data.subject))}
  function selectedSources(){const available=subjectSources(),chosen=new Set(current().sources);return available.filter(doc=>chosen.has(doc.id))}
  function ensureSelection(){const data=current(),available=subjectSources();data.sources=data.sources.filter(id=>available.some(doc=>doc.id===id)).slice(0,MAX_SOURCES);if(!data.sources.length&&available.length&&!data.manualEmpty)data.sources=available.slice(0,MAX_SOURCES).map(doc=>doc.id);persist()}
  function selectedSummaries(){const ids=new Set(selectedSources().map(doc=>doc.id));return(ALL_SUMMARIES||[]).filter(summary=>!window.isHunterManualArtifact?.(summary)&&ids.has(summary.documentId))}
  function contextBlock(){const summaries=selectedSummaries(),parts=summaries.map(item=>[`[FONTE: ${item.source||'PDF'}${item.pageStart?` | PÁGINAS: ${item.pageStart}${item.pageEnd>item.pageStart?`-${item.pageEnd}`:''}`:''}]`,`DISCIPLINA: ${item.category}`,`ASSUNTO: ${item.title}`,item.explanation,(item.points||[]).length?`PONTOS: ${item.points.join('; ')}`:'',item.example?`EXEMPLO: ${item.example}`:'',item.bizu?`BIZU: ${item.bizu}`:'',item.mnemonic?`MNEMÔNICO: ${item.mnemonic}`:'',item.trap?`PEGADINHA: ${item.trap}`:''].filter(Boolean).join('\n'));return parts.join('\n\n').slice(0,22000)}
  function sourceSignature(){return JSON.stringify([current().subject,selectedSources().map(doc=>[doc.id,doc.title,doc.updated_at||doc.created_at||'']).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),contextBlock()]);}

  function install(){
    const tabs=q('#study .studyTabs'),notebook=q('#notebook');if(!tabs||!notebook||q('[data-study="smart"]'))return;
    tabs.classList.add('smartEnabled');tabs.insertAdjacentHTML('beforeend','<button class="studyTab" data-study="smart">Caderno IA</button>');
    notebook.insertAdjacentHTML('afterend',`<div class="studyPanel" id="smart"><div class="smartNotebook"><div class="card smartHero"><div class="eyebrow">CADERNO INTELIGENTE</div><h2>Estude somente pelas fontes escolhidas</h2><p class="muted">Selecione os PDFs, gere um guia ou converse com o Tutor. As respostas pedem citações de fonte e página.</p><div class="smartGuard"><span class="tag">Sem áudio</span><span class="tag">Sem mapa mental</span><span class="tag">Quiz das fontes sem IA</span><span class="tag">Cache contra chamadas repetidas</span></div></div><div class="smartLayout"><aside class="card smartSources"><div class="sectionHead"><h2>Fontes</h2><span class="tag" id="smartSourceCount">0/0</span></div><label class="field">Disciplina<select id="smartSubject"></select></label><div class="smartSelectActions"><button class="ghost" id="smartSelectAll">Marcar todas</button><button class="ghost" id="smartSelectNone">Limpar</button></div><div class="smartSourcesList" id="smartSourcesList"></div><div class="smartEstimate" id="smartEstimate"></div></aside><section class="smartWorkspace"><div class="card"><div class="sectionHead"><div><h2>Ferramentas</h2><p class="small muted" style="margin:3px 0 0">A IA só será chamada depois da sua confirmação.</p></div><span class="tag" id="smartProvider">DeepSeek → Groq → Gemini</span></div><div class="smartActions"><button class="smartAction" id="smartGuide"><b>Gerar guia de estudo</b><span>1 chamada; reutiliza o cache</span></button><button class="smartAction" id="smartQuiz"><b>Iniciar quiz adaptativo</b><span class="smartNoCredit">Não consome IA</span></button></div><label class="field">Pergunte ao Tutor</label><div class="smartQuestion"><textarea id="smartQuestion" placeholder="Ex.: Explique a diferença entre direitos individuais e sociais usando somente as fontes marcadas."></textarea><button class="action" id="smartAsk">Perguntar</button></div><p class="small muted" id="smartMessage">Selecione ao menos uma fonte.</p><div id="smartResult"></div></div><div class="card"><div class="sectionHead"><h2>Cobertura e lacunas</h2><span class="tag">Edital × materiais</span></div><div class="smartCoverageGrid" id="smartCoverage"></div><div class="gapList" id="smartGaps"></div></div></section></div></div></div>`);
    qa('[data-study]').forEach(button=>button.onclick=()=>{if(typeof window.switchStudySubtab==='function')return window.switchStudySubtab(button.dataset.study);qa('.studyTab').forEach(item=>item.classList.toggle('active',item===button));qa('.studyPanel').forEach(panel=>panel.classList.toggle('active',panel.id===button.dataset.study));if(button.dataset.study==='smart')renderSmart()});
    q('#smartSubject').onchange=event=>{cancelNotebookGeneration();current().subject=event.target.value;current().sources=[];current().manualEmpty=false;current().lastResult=null;ensureSelection();renderSmart()};
    q('#smartSelectAll').onclick=()=>{cancelNotebookGeneration();current().sources=subjectSources().slice(0,MAX_SOURCES).map(doc=>doc.id);current().manualEmpty=false;current().lastResult=null;persist();renderSmart();if(subjectSources().length>MAX_SOURCES)toast(`Para economizar créditos, selecione até ${MAX_SOURCES} fontes por consulta.`)};
    q('#smartSelectNone').onclick=()=>{cancelNotebookGeneration();current().sources=[];current().manualEmpty=true;current().lastResult=null;persist();renderSmart()};
    q('#smartSourcesList').onchange=event=>{if(!event.target.matches('[data-smart-source]'))return;cancelNotebookGeneration();const ids=new Set(current().sources),id=event.target.dataset.smartSource;if(event.target.checked&&ids.size>=MAX_SOURCES){event.target.checked=false;return toast(`Selecione no máximo ${MAX_SOURCES} fontes por consulta para controlar o consumo.`)}event.target.checked?ids.add(id):ids.delete(id);current().sources=[...ids];current().manualEmpty=current().sources.length===0;current().lastResult=null;persist();renderSmart()};
    q('#smartGuide').onclick=()=>runGeneration('guide');q('#smartAsk').onclick=()=>runGeneration('tutor');q('#smartQuiz').onclick=startAdaptiveQuiz;
  }

  function renderSmart(){
    const scope=syncNotebookScope();if(!q('#smart'))return;const data=current(scope);if(activeOperation&&activeOperation.sourceSignature!==sourceSignature())cancelNotebookGeneration();const busy=notebookBusy(),subjects=[...new Set(readySources().map(sourceSubject))].sort((a,b)=>a.localeCompare(b,'pt-BR')),select=q('#smartSubject');select.innerHTML='<option value="all">Todas as disciplinas</option>'+subjects.map(subject=>`<option value="${safe(subject)}">${safe(subject)}</option>`).join('');select.value=subjects.some(subject=>subjectKey(subject)===subjectKey(data.subject))?subjects.find(subject=>subjectKey(subject)===subjectKey(data.subject)):'all';if(select.value!==data.subject)data.subject=select.value;ensureSelection();const sources=subjectSources(),chosen=new Set(data.sources);q('#smartSourceCount').textContent=`${sources.filter(doc=>chosen.has(doc.id)).length}/${sources.length}`;q('#smartSourcesList').innerHTML=sources.length?sources.map(doc=>{const count=ALL_SUMMARIES.filter(summary=>summary.documentId===doc.id).length,coverage=Number(doc.metadata?.coverage?.percent)||0;return`<label class="smartSource"><input type="checkbox" data-smart-source="${safe(doc.id)}" ${chosen.has(doc.id)?'checked':''}><span><b>${safe(doc.title)}</b><span>${safe(sourceSubject(doc))} · ${count} assunto${count===1?'':'s'}${coverage?` · ${coverage}% coberto`:''}</span></span></label>`}).join(''):'<div class="empty">Nenhum material processado nesta disciplina.</div>';const context=contextBlock(),selected=selectedSources(),personalStatus=scope.ready&&scope.ownerId!=='guest';if(q('#smartProvider'))q('#smartProvider').textContent=personalStatus?'IA da conta':'Entre na sua conta';q('#smartEstimate').innerHTML=selected.length?`<strong>${selected.length}/${MAX_SOURCES} fontes</strong> · ${selectedSummaries().length} assuntos · contexto limitado a ${Math.ceil(context.length/1000)} mil caracteres.<br>Guia/Tutor: 1 chamada. Quiz: nenhuma chamada.`:'Marque ao menos uma fonte para utilizar o Caderno Inteligente.';q('#smartGuide').disabled=!selected.length||busy;q('#smartAsk').disabled=!selected.length||busy;q('#smartQuiz').disabled=!scope.ready||scope.ownerId==='guest'||!notebookQuestions().length;renderCoverage();renderResult()}

  function renderCoverage(){
    const scope=syncNotebookScope(),allowed=scope.ready&&scope.ownerId!=='guest';
    const summaries=allowed?selectedSummaries():[],sources=allowed?selectedSources():[],questions=allowed?notebookQuestions():[];
    const missions=allowed?(missionPool?.()||[]).filter(item=>{
      const owner=item.user_id||item.userId||item._ownerUserId,campaign=item.campaignId||item.campaign_id;
      return(!owner||owner===scope.ownerId)&&(!campaign||campaign===scope.campaignId||campaign===scope.campaignDbId)&&(current().subject==='all'||subjectKey(item.subject)===subjectKey(current().subject));
    }):[];
    summaries.forEach(s=>{if(!s._normFull)s._normFull=normalizeText([s.title,s.explanation,...(s.points||[])].join(' '));if(!s._catKey)s._catKey=subjectKey(s.category)});
    const covered=missions.filter(mission=>{const mKey=subjectKey(mission.subject),mSlice=normalizeText(mission.name).slice(0,28);return summaries.some(summary=>summary._catKey===mKey&&summary._normFull.includes(mSlice))}),percent=missions.length?Math.round(covered.length/missions.length*100):0;q('#smartCoverage').innerHTML=`<div class="smartMetric"><b>${sources.length}</b><span>fontes selecionadas</span></div><div class="smartMetric"><b>${summaries.length}</b><span>assuntos resumidos</span></div><div class="smartMetric"><b>${questions.length}</b><span>questões disponíveis</span></div><div class="smartMetric"><b>${percent}%</b><span>tópicos relacionados</span></div><div class="smartMetric"><b>${missions.length}</b><span>itens do edital</span></div><div class="smartMetric"><b>${missions.length-covered.length}</b><span>lacunas estimadas</span></div>`;const bySubject={};for(const mission of missions){const key=mission.subject||'Edital';bySubject[key]??={total:0,summary:0,questions:0};bySubject[key].total++}for(const summary of summaries){const key=Object.keys(bySubject).find(name=>subjectKey(name)===subjectKey(summary.category));if(key)bySubject[key].summary++}for(const question of questions){const key=Object.keys(bySubject).find(name=>subjectKey(name)===subjectKey(question.subject));if(key)bySubject[key].questions++}const rows=Object.entries(bySubject).sort((a,b)=>(a[1].summary+a[1].questions)-(b[1].summary+b[1].questions)).slice(0,8);q('#smartGaps').innerHTML=rows.length?rows.map(([name,value])=>`<div class="gapItem ${value.summary&&value.questions?'good':''}"><b>${safe(name)}</b><div class="small">${value.total} tópico${value.total===1?'':'s'} no edital · ${value.summary} resumo${value.summary===1?'':'s'} · ${value.questions} questão${value.questions===1?'':'ões'}</div></div>`).join(''):'<div class="empty">Insira e analise um edital para comparar as fontes com o conteúdo programático.</div>'}

  function promptFor(type,question){const citation='Use exclusivamente o MATERIAL DE REFERÊNCIA. Ao final de cada seção, cite no formato [Fonte: nome do arquivo, pág. X]. Se a página não estiver informada, use [Fonte: nome do arquivo]. Não invente páginas, artigos ou informações ausentes.';if(type==='guide')return`${citation}\nCrie um guia de estudo pedagógico com: visão geral, pré-requisitos, ordem recomendada, pontos essenciais, exemplos, pegadinhas, checklist e plano de revisão 1-7-30 dias. Não produza mapa mental nem roteiro de áudio.`;return`${citation}\nAtue como tutor socrático, mas responda de forma útil à pergunta. Explique passo a passo, faça uma pergunta de verificação ao final e indique o trecho que o estudante deve revisar.\nPergunta: ${question}`}
  function operationCurrent(operation){
    syncNotebookScope();return activeOperation===operation&&scopeMatches(operation.scope)&&sourceSignature()===operation.sourceSignature;
  }
  function cancelNotebookGeneration(){
    if(!activeOperation)return;const previous=activeOperation;activeOperation=null;previous.controller?.abort();
    const message=q('#smartMessage');if(message)message.textContent='As fontes mudaram. Inicie outra consulta com a nova seleção.';
  }
  async function runGeneration(type){
    const scope=syncNotebookScope();
    if(!scope.ready||scope.ownerId==='guest'){toast('Entre e aguarde o carregamento da sua conta para usar o Caderno IA.');return false;}
    if(!scope.campaignDbId){toast('Aguarde a sincronização deste portal antes de consultar a IA.');return false;}
    if(notebookBusy())return false;
    const question=String(q('#smartQuestion')?.value||'').trim();
    if(type==='tutor'&&question.length<3){toast('Escreva sua pergunta para o Tutor.');return false;}
    const context=contextBlock(),sources=selectedSources();if(!context||!sources.length){toast('Selecione ao menos uma fonte processada.');return false;}
    const data=current(scope),sourceTitles=sources.map(doc=>String(doc.title||'PDF')),signature=JSON.stringify([type,sourceSignature(),type==='tutor'?question:'']);
    const cacheKey=hash(signature),cached=data.cache[cacheKey];
    if(validResult(cached,scope)&&cached.signature===signature){data.lastResult=cached;const saved=persist(scope,data);renderResult();toast(saved?'Resultado recuperado do cache sem consumir nova chamada.':'Resultado recuperado nesta sessão; não foi possível atualizar a cópia no aparelho.');return true;}
    if(!confirm(`Esta ação usará 1 pergunta da cota diária do assistente.\n\nFontes: ${sources.length}\nAssuntos: ${selectedSummaries().length}\n\nDeseja continuar?`))return false;
    if(!scopeMatches(scope))return false;
    const operation={scope,sourceSignature:sourceSignature(),sourceTitles,requestToken:++requestSequence,controller:typeof AbortController==='function'?new AbortController():null};
    activeOperation=operation;renderSmart();const message=q('#smartMessage');if(message)message.textContent='Preparando resposta fundamentada nas fontes...';
    let timeout=null;
    try{
      timeout=setTimeout(()=>operation.controller?.abort(),90000);
      const session=await validSession();if(!operationCurrent(operation))return false;
      if(!session||session.user?.id!==scope.ownerId)throw new Error('Entre novamente para utilizar o Caderno Inteligente.');
      const response=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{method:'POST',headers:authHeaders(session.access_token),signal:operation.controller?.signal,body:JSON.stringify({question:promptFor(type,question),context,mode:type==='guide'?'guia de estudo fundamentado':'tutor fundamentado',campaign_id:scope.campaignDbId,campaign:scope.campaignName,document_titles:operation.sourceTitles})});
      if(!operationCurrent(operation))return false;
      const result=await response.json().catch(()=>({}));if(!operationCurrent(operation))return false;
      if(!response.ok)throw new Error(result.error||`Erro ${response.status} ao consultar o assistente.`);
      const answer=typeof result.answer==='string'?result.answer.trim():'';
      if(!answer||answer.length>120000)throw new Error('A IA não retornou uma resposta válida dentro do limite. Tente uma consulta menor.');
      const providerLabel=result.provider==='gemini'&&result.key_source==='personal'?'Gemini (chave pessoal)':String(result.provider||'IA');
      const item={scopeKey:scope.key,signature,type,question:type==='guide'?'Guia de estudo':question,answer,provider:providerLabel,sources:operation.sourceTitles.slice(),createdAt:new Date().toISOString()};
      data.cache[cacheKey]=item;data.lastResult=item;const saved=persist(scope,data);if(!operationCurrent(operation))return false;
      renderResult();if(message)message.textContent=saved?'Resposta concluída e guardada neste aparelho. Confira as citações nas fontes.':'Resposta disponível nesta sessão. Não foi possível salvar no aparelho; confira o espaço disponível.';return true;
    }catch(error){
      if(!operationCurrent(operation))return false;
      const text=error?.name==='AbortError'?'A consulta excedeu o prazo. Tente novamente.':String(error?.message||'Não foi possível concluir a consulta.');
      if(message)message.textContent=text;toast(text);return false;
    }finally{
      if(timeout!==null)clearTimeout(timeout);
      if(activeOperation===operation){activeOperation=null;renderSmart();}
    }
  }
  function resultMatchesSources(item){
    try{return JSON.parse(item.signature)[1]===sourceSignature();}catch{return false;}
  }
  function renderResult(){const scope=syncNotebookScope(),root=q('#smartResult'),item=current(scope).lastResult;if(!root)return;if(!scope.ready||!validResult(item,scope)||!resultMatchesSources(item)){root.innerHTML='';if(item){current(scope).lastResult=null;persist(scope);}return}root.innerHTML=`<article class="smartResult"><div class="smartResultHead"><div><b>${safe(item.question)}</b><div class="smartResultMeta">${safe(item.provider)} · ${new Date(item.createdAt).toLocaleString('pt-BR')} · ${item.sources.length} fonte${item.sources.length===1?'':'s'}</div></div><button class="ghost" id="smartClearResult">Fechar</button></div><p class="small muted">Apoio por IA: confira as citações e a resposta nos materiais selecionados.</p><div class="smartResultBody aiAnswer">${formatAIAnswer(item.answer)}</div></article>`;q('#smartClearResult').onclick=()=>{current().lastResult=null;persist();renderResult()}}
  function startAdaptiveQuiz(){const scope=syncNotebookScope();if(!scope.ready||scope.ownerId==='guest')return toast('Entre e aguarde o carregamento da sua conta.');const allowedIds=new Set(selectedSources().map(doc=>doc.id)),allowed=item=>allowedIds.has(item.documentId||item.sourceDocumentId||item.source_document_id);const subject=current().subject,scores=(state.scores||[]).filter(item=>subject==='all'||subjectKey(item.subject)===subjectKey(subject)),total=scores.reduce((sum,item)=>sum+Number(item.total||0),0),correct=scores.reduce((sum,item)=>sum+Number(item.correct||0),0),rate=total?correct/total:0,target=rate>=.8?'dificil':rate>=.6?'medio':'facil';let pool=questionsForMode('battle',subject).filter(allowed).filter(item=>{const raw=normalizeText(item.difficulty||'medio');return target==='facil'?raw.startsWith('fac'):target==='dificil'?raw.startsWith('dif'):raw.startsWith('med')});if(pool.length<3)pool=questionsForMode('battle',subject).filter(allowed);if(!pool.length)return toast('Ainda não existem questões para esta seleção.');activeQuestions={mode:'battle',subject,questions:balancedQuestions(pool,Math.min(5,pool.length)).map(prepareQuestion),current:0,correct:0,answered:false};q('#questionDialogTitle').textContent=`Quiz adaptativo · ${target==='facil'?'fácil':target==='dificil'?'difícil':'médio'}`;q('#questionDialog').showModal();showQuestion()}

  window.renderSmartNotebookPanel=renderSmart;
  install();
  const renderSmartIfVisible=()=>{syncNotebookScope();if(q('#study')?.classList.contains('active')&&q('#smart')?.classList.contains('active'))renderSmart()};
  const baseRender=render;render=function(...args){syncNotebookScope();const result=baseRender.apply(this,args);renderSmartIfVisible();return result};
  const baseLoadGenerated=loadGeneratedContent;loadGeneratedContent=async function(...args){syncNotebookScope();const result=await baseLoadGenerated.apply(this,args);renderSmartIfVisible();return result};
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 78 · Caderno Inteligente com fontes');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 78 · fontes, citações, questões, IA, PDFs e sincronização');
})();
