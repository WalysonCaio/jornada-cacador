(function(root){
  'use strict';
  const names={resolver:'Resolver',simulados:'Simulados',provas:'Central de Provas',desempenho:'Desempenho & Gargalos'};

  // Object identity is not a data change: the cloud and community loaders may
  // replace their arrays with equal rows. Ignore transient UI caches, retain
  // option order, and optionally compare a collection independently of row order.
  function signature(value,unordered=false){
    const imul=Math.imul;
    const encode=item=>{
      if(Array.isArray(item))return '['+item.map(encode).join(',')+']';
      if(item&&typeof item==='object')return '{'+Object.keys(item).filter(key=>!key.startsWith('_')&&!['communitySourceSignature','communitySourceScopeKey'].includes(key)).sort().map(key=>JSON.stringify(key)+':'+encode(item[key])).join(',')+'}';
      return JSON.stringify(item)??'null';
    };
    const text=unordered&&Array.isArray(value)?'['+value.map(encode).sort().join(',')+']':encode(value);
    let a=2166136261,b=5381;
    for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=imul(a^c,16777619);b=imul(b,33)^c}
    return `${text.length}:${a>>>0}:${b>>>0}`;
  }

  // The scheduler is independent from the DOM so that context changes can be
  // tested without a browser, including work already queued for the next paint.
  function createController(options){
    let active='resolver',scopeKey='',generation=0,revision=0,rendering=null,inputSnapshot=null,pending=null;
    const rendered=new Map(),mounted=new Set();
    const key=()=>JSON.stringify(options.readScope());
    const readInputs=()=>options.readInputs?.()||null;
    function changedInputs(next){return next&&(!inputSnapshot||next.length!==inputSnapshot.length||next.some((value,index)=>!Object.is(value,inputSnapshot[index])))}
    function invalidate(){revision++;generation++;pending=null;rendered.clear();inputSnapshot=readInputs()}
    function synchronize(){
      const next=key();
      if(next!==scopeKey){scopeKey=next;active='resolver';generation++;pending=null;rendered.clear();mounted.clear();inputSnapshot=readInputs();options.onScopeChange?.()}
      else{const inputs=readInputs();if(changedInputs(inputs))invalidate()}
    }
    function request(panel){
      synchronize();
      if(panel&&names[panel])active=panel;
      const fresh=rendered.get(active)===revision;
      const isMounted=mounted.has(active);
      options.onSelect?.(active,!fresh,{mounted:isMounted,refreshing:isMounted&&!fresh});
      if(!options.isVisible()||fresh)return;
      // Repeated render()/renderReport()/sync notifications share one job.
      if(pending&&pending.panel===active&&pending.scopeKey===scopeKey&&pending.revision===revision)return;
      const job={panel:active,scopeKey,revision,generation:++generation};pending=job;
      options.afterPaint(()=>{
        if(pending===job)pending=null;
        if(job.generation!==generation||job.scopeKey!==key()||job.revision!==revision||job.panel!==active||!options.isVisible())return;
        rendering=active;
        const ui=isMounted?options.capture?.(active):null;
        try{
          options.renderers[active]?.();
          if(job.scopeKey===key()&&job.revision===revision){rendered.set(active,revision);mounted.add(active);options.onReady?.(active)}
        }catch(error){options.onError?.(active,error)}
        finally{
          if(ui&&job.scopeKey===key()&&options.restore?.(active,ui))options.onRestored?.(active);
          rendering=null;
          // Canonicalization can save repaired metadata during the first pass.
          // A dirty mark must schedule the new version, rather than leave a
          // permanently hidden panel or publish a result for the old revision.
          if(job.scopeKey===key()&&job.revision!==revision&&options.isVisible())request();
        }
      });
    }
    return {
      request,
      invalidate,
      invalidateProgress(){
        const inputs=readInputs();
        if(!inputs||changedInputs(inputs)){invalidate();return}
        // Focus time and hero XP update the statistics, but cannot change the
        // question filters or the catalogue. Keep those panels and their pool.
        rendered.delete('desempenho');
        if(active==='desempenho'){generation++;pending=null}
      },
      get revision(){return revision},
      get active(){synchronize();return active},
      isMounted(panel){return mounted.has(panel)},
      isRendering(panel){return rendering===panel},
      isActive(panel){synchronize();return active===panel&&options.isVisible()},
      scopeKey(){synchronize();return scopeKey}
    };
  }

  let controller=null,settings=null;
  function collect(){
    if(!settings)return;
    const doc=root.document,report=doc.querySelector('#report');
    if(!report)return;
    const move=(selector,panel,closest)=>{
      let node=report.querySelector(selector);
      if(closest)node=node?.closest(closest);
      const target=doc.querySelector(`#questionsPanel-${panel}`);
      if(node&&target&&node.parentElement!==target)target.appendChild(node);
    };
    move('.questionTrainer','resolver');
    move('#simuladoLauncher','simulados');move('#guildOfficialSimuladoCard','simulados');move('#slBossesRaidBanner','simulados');
    move('#examBankHub','provas');move('.sourceLinks','provas','.card');
    for(const selector of ['#performanceSummary','.reportColumns','#tacticalDiagnosisPanel','#cutoffThermometerPanel','#reset'])move(selector,'desempenho');
    for(const selector of ['#achievements','#errorList','#scoreList'])move(selector,'desempenho','.card');
  }
  function capturePanel(panel){
    const node=root.document.querySelector(`#questionsPanel-${panel}`),doc=root.document;
    if(!node)return null;
    const fields=[...node.querySelectorAll('input,select,textarea')].filter(el=>el.id).map(el=>({id:el.id,value:el.value,checked:el.checked}));
    const details=[...node.querySelectorAll('details')].filter(el=>el.id).map(el=>({id:el.id,open:el.open}));
    const focused=node.contains(doc.activeElement)?doc.activeElement:null;
    return {fields,details,focused,focusId:focused?.id,selectionStart:focused?.selectionStart,selectionEnd:focused?.selectionEnd,x:root.scrollX||0,y:root.scrollY||0,
      scroll:[node,...node.querySelectorAll('[id]')].filter(el=>el.scrollTop||el.scrollLeft).map(el=>({id:el.id,top:el.scrollTop,left:el.scrollLeft}))};
  }
  function restorePanel(panel,snapshot){
    if(!snapshot)return;
    const node=root.document.querySelector(`#questionsPanel-${panel}`);if(!node)return;
    let filtersChanged=false;
    for(const saved of snapshot.fields){
      const el=root.document.getElementById(saved.id);if(!el||!node.contains(el))continue;
      if(el.value!==saved.value||typeof saved.checked==='boolean'&&el.checked!==saved.checked)filtersChanged=true;
      // A removed filter option must not silently broaden the user's selection.
      // Retain it until the user picks a new one; the strict filter yields 0.
      if(el.tagName==='SELECT'&&saved.value&&!Array.from(el.options||[]).some(option=>option.value===saved.value)){
        const option=root.document.createElement('option');option.value=saved.value;option.textContent='Seleção anterior — sem questões neste filtro';el.appendChild(option);
      }
      el.value=saved.value;if(typeof saved.checked==='boolean')el.checked=saved.checked;
    }
    for(const saved of snapshot.details){const el=root.document.getElementById(saved.id);if(el&&node.contains(el))el.open=saved.open}
    const focused=snapshot.focusId?root.document.getElementById(snapshot.focusId):snapshot.focused;
    if(focused&&node.contains(focused)){
      focused.focus?.({preventScroll:true});
      if(typeof snapshot.selectionStart==='number'&&typeof focused.setSelectionRange==='function')try{focused.setSelectionRange(snapshot.selectionStart,snapshot.selectionEnd)}catch{}
    }
    for(const saved of snapshot.scroll){const el=root.document.getElementById(saved.id);if(el){el.scrollTop=saved.top;el.scrollLeft=saved.left}}
    root.scrollTo?.(snapshot.x,snapshot.y);
    return filtersChanged;
  }
  function resetScopePanels(){
    const report=root.document.querySelector('#report');if(!report)return;
    // Keep the stable form/control nodes and their listeners, but remove the
    // previous account's labels, draft text and rendered catalogue/history.
    for(const selector of ['#examDocumentsCatalog','#errorList','#scoreList','#subjectStats','#performanceSummary','#achievements','#tacticalDiagnosisPanel','#cutoffThermometerPanel','#quickBoaRespostaBar']){
      const node=report.querySelector(selector);if(node)node.textContent='';
    }
    for(const el of report.querySelectorAll('input,textarea'))if(el.type!=='button'&&el.type!=='submit'&&el.type!=='checkbox'&&el.type!=='radio'&&el.type!=='number')el.value='';
    for(const id of ['questionSubject','questionTopic','genBankSubject','genBankTopic']){
      const el=root.document.getElementById(id);if(!el)continue;
      for(const option of Array.from(el.options||[]).slice(1))option.remove();
      if(el.options?.length)el.value=el.options[0].value;
    }
    root.document.querySelector('#guildOfficialSimuladoCard')?.remove();
    for(const id of Object.keys(names))setPanelStatus(id,true,false,false);
  }
  function setPanelStatus(panel,busy,error,mounted=controller?.isMounted(panel)||false){
    const node=root.document.querySelector(`#questionsPanel-${panel}`);
    if(!node)return;
    node.setAttribute('aria-busy',String(busy));
    node.setAttribute('data-initial-loading',String(busy&&!mounted));
    const status=node.querySelector('.questionsPanelStatus');
    if(status){
      status.hidden=(!busy||mounted)&&!error;
      status.textContent=error?(mounted?'Não foi possível atualizar este painel. O conteúdo anterior foi mantido; toque na aba para tentar novamente.':'Não foi possível abrir este painel. Toque na aba para tentar novamente.'):'Preparando este painel…';
    }
  }
  function configure(options){
    settings=options;
    const doc=root.document,report=doc?.querySelector('#report');
    if(!report)return;
    if(!doc.querySelector('#questionsWorkspaceTabs')){
      const tabs=doc.createElement('div');tabs.id='questionsWorkspaceTabs';tabs.className='questionsWorkspaceTabs';
      tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Central de questões');
      Object.entries(names).forEach(([id,label])=>{
        const button=doc.createElement('button');button.id=`questionsTab-${id}`;button.type='button';button.className='ghost';
        button.setAttribute('role','tab');button.setAttribute('aria-controls',`questionsPanel-${id}`);button.textContent=label;
        button.addEventListener('click',()=>controller.request(id));
        button.addEventListener('keydown',event=>{
          const ids=Object.keys(names),index=ids.indexOf(id);
          const next=event.key==='ArrowRight'?ids[(index+1)%ids.length]:event.key==='ArrowLeft'?ids[(index+ids.length-1)%ids.length]:event.key==='Home'?ids[0]:event.key==='End'?ids[ids.length-1]:null;
          if(next){event.preventDefault();controller.request(next);doc.querySelector(`#questionsTab-${next}`)?.focus()}
        });
        tabs.appendChild(button);
      });
      const head=report.querySelector('.sectionHead');
      if(head)head.insertAdjacentElement('afterend',tabs);else report.prepend(tabs);
      Object.keys(names).forEach(id=>{
        const panel=doc.createElement('div');panel.id=`questionsPanel-${id}`;panel.className='questionsWorkspacePanel';panel.hidden=id!=='resolver';
        panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`questionsTab-${id}`);
        const status=doc.createElement('p');status.className='questionsPanelStatus small muted';status.setAttribute('role','status');status.textContent='Preparando este painel…';
        panel.appendChild(status);report.appendChild(panel);
      });
    }
    controller=createController({
      ...options,
      afterPaint:callback=>typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(()=>root.setTimeout(callback,0)):root.setTimeout(callback,0),
      capture:capturePanel,
      restore:restorePanel,
      onScopeChange:resetScopePanels,
      onSelect:(id,busy,info)=>{
        collect();
        Object.keys(names).forEach(name=>{
          const selected=name===id,button=doc.querySelector(`#questionsTab-${name}`),panel=doc.querySelector(`#questionsPanel-${name}`);
          button?.setAttribute('aria-selected',String(selected));if(button)button.tabIndex=selected?0:-1;
          if(panel)panel.hidden=!selected;
        });
        const score=doc.querySelector('#openScore');if(score)score.hidden=id!=='desempenho';
        setPanelStatus(id,busy,false,info.mounted);
      },
      onReady:id=>{collect();setPanelStatus(id,false)},
      onError:(id,error)=>{setPanelStatus(id,false,true);root.console?.error('Falha no painel de questões',id,error)}
    });
    collect();
    const markDirty=root.markViewsDirty;
    if(typeof markDirty==='function')root.markViewsDirty=function(...ids){
      markDirty(...ids);
      if(ids.includes('report'))controller.invalidateProgress();
      else if(!ids.length)controller.invalidateProgress();
    };
    // Navigation already selected a view before this deferred file was loaded.
    if(options.isVisible())controller.request();
  }
  root.JCQuestionsWorkspace={
    createController,configure,collect,signature,capturePanel,restorePanel,
    request:panel=>controller?.request(panel),
    invalidate:()=>controller?.invalidate(),
    get revision(){return controller?.revision||0},
    isActive:panel=>Boolean(controller?.isActive(panel)),
    isRendering:panel=>Boolean(controller?.isRendering(panel)),
    scopeKey:()=>controller?.scopeKey()||''
  };
})(typeof window==='undefined'?globalThis:window);
