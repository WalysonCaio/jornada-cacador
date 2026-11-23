(function(root){
  'use strict';
  const names={resolver:'Resolver',simulados:'Simulados',provas:'Central de Provas',desempenho:'Desempenho & Gargalos'};

  // The scheduler is independent from the DOM so that context changes can be
  // tested without a browser, including work already queued for the next paint.
  function createController(options){
    let active='resolver',scopeKey='',generation=0,revision=0,rendering=null,inputSnapshot=null;
    const rendered=new Map();
    const key=()=>JSON.stringify(options.readScope());
    const readInputs=()=>options.readInputs?.()||null;
    function changedInputs(next){return next&&(!inputSnapshot||next.length!==inputSnapshot.length||next.some((value,index)=>!Object.is(value,inputSnapshot[index])))}
    function invalidate(){revision++;generation++;rendered.clear();inputSnapshot=readInputs()}
    function synchronize(){
      const next=key();
      if(next!==scopeKey){scopeKey=next;active='resolver';generation++;rendered.clear();inputSnapshot=readInputs();options.onScopeChange?.()}
      else{const inputs=readInputs();if(changedInputs(inputs))invalidate()}
    }
    function request(panel){
      synchronize();
      if(panel&&names[panel])active=panel;
      const fresh=rendered.get(active)===revision;
      options.onSelect?.(active,!fresh);
      if(!options.isVisible()||fresh)return;
      const pending={panel:active,scopeKey,revision,generation:++generation};
      options.afterPaint(()=>{
        if(pending.generation!==generation||pending.scopeKey!==key()||pending.revision!==revision||pending.panel!==active||!options.isVisible())return;
        rendering=active;
        try{
          options.renderers[active]?.();
          if(pending.scopeKey===key()&&pending.revision===revision){rendered.set(active,revision);options.onReady?.(active)}
        }catch(error){options.onError?.(active,error)}
        finally{
          rendering=null;
          // Canonicalization can save repaired metadata during the first pass.
          // A dirty mark must schedule the new version, rather than leave a
          // permanently hidden panel or publish a result for the old revision.
          if(pending.scopeKey===key()&&pending.revision!==revision&&options.isVisible())request();
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
        if(active==='desempenho')generation++;
      },
      get revision(){return revision},
      get active(){synchronize();return active},
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
  function setPanelStatus(panel,busy,error){
    const node=root.document.querySelector(`#questionsPanel-${panel}`);
    if(!node)return;
    node.setAttribute('aria-busy',String(busy));
    const status=node.querySelector('.questionsPanelStatus');
    if(status){
      status.hidden=!busy&&!error;
      status.textContent=error?'Não foi possível abrir este painel. Toque na aba para tentar novamente.':'Preparando este painel…';
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
      onScopeChange:()=>Object.keys(names).forEach(id=>setPanelStatus(id,true)),
      onSelect:(id,busy)=>{
        collect();
        Object.keys(names).forEach(name=>{
          const selected=name===id,button=doc.querySelector(`#questionsTab-${name}`),panel=doc.querySelector(`#questionsPanel-${name}`);
          button?.setAttribute('aria-selected',String(selected));if(button)button.tabIndex=selected?0:-1;
          if(panel)panel.hidden=!selected;
        });
        const score=doc.querySelector('#openScore');if(score)score.hidden=id!=='desempenho';
        setPanelStatus(id,busy);
      },
      onReady:id=>{collect();setPanelStatus(id,false)},
      onError:(id,error)=>{setPanelStatus(id,false,true);root.console?.error('Falha no painel de questões',id,error)}
    });
    collect();
    const markDirty=root.markViewsDirty;
    if(typeof markDirty==='function')root.markViewsDirty=function(...ids){
      markDirty(...ids);
      if(ids.includes('report'))controller.invalidate();
      else if(!ids.length)controller.invalidateProgress();
    };
    // Navigation already selected a view before this deferred file was loaded.
    if(options.isVisible())controller.request();
  }
  root.JCQuestionsWorkspace={
    createController,configure,collect,
    request:panel=>controller?.request(panel),
    invalidate:()=>controller?.invalidate(),
    get revision(){return controller?.revision||0},
    isActive:panel=>Boolean(controller?.isActive(panel)),
    isRendering:panel=>Boolean(controller?.isRendering(panel)),
    scopeKey:()=>controller?.scopeKey()||''
  };
})(typeof window==='undefined'?globalThis:window);
