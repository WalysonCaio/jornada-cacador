(()=>{
  'use strict';
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const escText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const viewKey='jornada-last-view-v77';

  function addTodayCommand(){
    const today=q('#today'),streak=today?.querySelector('.streakCard');
    if(!today||!streak||q('#todayCommand'))return;
    const panel=document.createElement('div');
    panel.id='todayCommand';panel.className='todayCommand';
    panel.innerHTML=`<button class="commandPrimary" id="continueJourney"><span class="eyebrow">PRÓXIMA AÇÃO</span><b id="continueJourneyTitle">Continuar missão diária</b><span id="continueJourneyMeta">Retome exatamente de onde parou.</span></button><button class="commandShortcut" id="openUrgentReview"><i>↻</i><b>Revisar agora</b><span id="urgentReviewMeta">Confira suas revisões pendentes</span></button><button class="commandShortcut" id="openQuestionCenter"><i>◎</i><b>Resolver questões</b><span id="questionShortcutMeta">Treino por disciplina</span></button>`;
    today.insertBefore(panel,streak);
    q('#continueJourney').onclick=()=>{q('#dailyMission')?.scrollIntoView({behavior:'smooth',block:'center'});q('#dailyMission button:not([disabled]),#dailyMission input:not([disabled])')?.focus({preventScroll:true})};
    q('#openUrgentReview').onclick=()=>openView('review');
    q('#openQuestionCenter').onclick=()=>openView('report');
  }

  function updateTodayCommand(){
    const mission=(typeof missionPool==='function'?missionPool():[]).find(item=>item.id===state?.daily)||null;
    const steps=state?.dailySteps||{},finished=mission&&state?.done?.[mission.id];
    const completed=Object.values(steps).filter(Boolean).length;
    const title=q('#continueJourneyTitle'),meta=q('#continueJourneyMeta');
    if(title)title.textContent=finished?'Missão concluída — revisar conteúdo':mission?.name||'Escolher a primeira missão';
    if(meta)meta.textContent=mission?`${mission.subject||'Disciplina'} · ${completed}/4 etapas concluídas`:'Insira um edital para criar seu plano.';
    const errors=Object.values(state?.errors||{}).reduce((sum,item)=>sum+Number(item?.misses||0),0);
    if(q('#urgentReviewMeta'))q('#urgentReviewMeta').textContent=errors?`${errors} erro${errors===1?'':'s'} pedindo atenção`:'Nenhum erro urgente no momento';
    if(q('#questionShortcutMeta'))q('#questionShortcutMeta').textContent=`${ALL_QUESTIONS?.length||0} questão${ALL_QUESTIONS?.length===1?'':'ões'} disponíveis`;
  }

  function normalizedOrigin(question){const origin=String(question?.origin||'autoral').toLocaleLowerCase('pt-BR');return /oficial|importad|prova/.test(origin)?'oficial':'autoral'}
  function normalizedDifficulty(question){const value=String(question?.difficulty||'medio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return value.startsWith('fac')?'facil':value.startsWith('dif')?'dificil':'medio'}
  function filteredQuestionPool(){
    const subject=q('#questionSubject')?.value||'all',difficulty=q('#questionDifficulty')?.value||'all',origin=q('#questionOrigin')?.value||'all';
    const source=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    return source.filter(item=>(difficulty==='all'||normalizedDifficulty(item)===difficulty)&&(origin==='all'||normalizedOrigin(item)===origin));
  }
  function updateQuestionPool(){const pool=filteredQuestionPool(),badge=q('#questionPoolCount');if(badge)badge.textContent=`${pool.length} disponíve${pool.length===1?'l':'is'}`;const button=q('#startQuestions');if(button){button.disabled=!pool.length;button.textContent=pool.length?`Iniciar batalha de ${Math.min(5,pool.length)} questões`:'Nenhuma questão neste filtro'}}
  function startFilteredBattle(){
    const pool=filteredQuestionPool(),subject=q('#questionSubject')?.value||'all';
    if(!pool.length)return toast('Não há questões que correspondam aos filtros selecionados.');
    activeQuestions={mode:'battle',subject,questions:balancedQuestions(pool,Math.min(5,pool.length)).map(prepareQuestion),current:0,correct:0,answered:false};
    q('#questionDialogTitle').textContent='Batalha de questões';q('#questionDialog').showModal();showQuestion();
  }

  function renderPerformanceChart(){
    const root=q('#performanceChart');if(!root)return;
    const scores=(state?.scores||[]).filter(item=>!item.campaignId||item.campaignId===state.activeCampaignId),groups={};
    for(const item of scores){const name=item.subject||missionPool().find(m=>m.id===item.id)?.subject||'Conteúdo geral';groups[name]??={total:0,correct:0};groups[name].total+=Number(item.total||0);groups[name].correct+=Number(item.correct||0)}
    const rows=Object.entries(groups).filter(([,data])=>data.total>0).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
    root.className='performanceChart';root.innerHTML=rows.length?rows.map(([name,data])=>{const rate=Math.round(data.correct/data.total*100),tone=rate<60?'low':rate<80?'mid':'high';return `<div class="performanceBar ${tone}" title="${escText(name)}: ${data.correct}/${data.total}"><span>${escText(name)}</span><div class="performanceTrack"><i style="width:${rate}%"></i></div><b>${rate}%</b></div>`}).join(''):'<div class="empty">Resolva questões para visualizar sua precisão por disciplina.</div>';
  }

  function bindQuestionCenter(){
    for(const selector of ['#questionSubject','#questionDifficulty','#questionOrigin'])q(selector)?.addEventListener('change',updateQuestionPool);
    if(q('#startQuestions'))q('#startQuestions').onclick=startFilteredBattle;
    updateQuestionPool();renderPerformanceChart();
  }

  const baseOpenView=openView;
  openView=function(id){baseOpenView(id);try{sessionStorage.setItem(viewKey,id)}catch{}if(id==='report'){updateQuestionPool();renderPerformanceChart()}if(id==='today')updateTodayCommand()};
  const baseRender=render;
  render=function(){baseRender();updateTodayCommand();updateQuestionPool();renderPerformanceChart()};
  const baseRenderReport=renderReport;
  renderReport=function(){baseRenderReport();updateQuestionPool();renderPerformanceChart()};

  addTodayCommand();bindQuestionCenter();updateTodayCommand();
  qa('[data-menu-view]').forEach(button=>button.onclick=()=>{q('#moreDialog')?.close();openView(button.dataset.menuView)});
  const remembered=(()=>{try{return sessionStorage.getItem(viewKey)}catch{return null}})();
  if(remembered&&q(`#${CSS.escape(remembered)}`)?.classList.contains('view'))openView(remembered);
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 77 · experiência orientada ao estudo');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 77 · interface, questões, IA, PDFs, segurança e sincronização');
})();
