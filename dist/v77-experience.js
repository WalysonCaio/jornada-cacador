(()=>{
  'use strict';
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const escText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const viewKey='jornada-last-view-v77';
  if(typeof processEditalDocument==='function'&&typeof window.processStudyDocument!=='function'){
    window.processStudyDocument=id=>processEditalDocument(id);
  }

  function addTodayCommand(){
    const today=q('#today'),streak=today?.querySelector('.streakCard');
    if(!today||!streak||q('#todayCommand'))return;
    const panel=document.createElement('div');
    panel.id='todayCommand';panel.className='todayCommand';
    panel.innerHTML=`<button class="commandPrimary" id="continueJourney"><span class="eyebrow">⚡ PRÓXIMA AÇÃO DO DIA</span><b id="continueJourneyTitle">Continuar missão diária</b><span id="continueJourneyMeta">Retome exatamente de onde parou.</span></button><button class="commandShortcut" id="openUrgentReview"><div class="cmdHead"><i>↻</i><span class="cmdPill" id="urgentReviewPill">Ciclo 1·7·30</span></div><div><b>Revisar agora</b><span id="urgentReviewMeta">Confira suas revisões pendentes</span></div></button><button class="commandShortcut" id="openQuestionCenter"><div class="cmdHead"><i>◎</i><span class="cmdPill" id="questionShortcutPill">Treino ativo</span></div><div><b>Resolver questões</b><span id="questionShortcutMeta">Treino por disciplina e tópico</span></div></button>`;
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
    const errors=Object.values(state?.errors||{}).filter(e=>!e?.campaignId||e.campaignId===state?.activeCampaignId).reduce((sum,item)=>sum+Number(item?.misses||0),0);
    if(q('#urgentReviewMeta'))q('#urgentReviewMeta').textContent=errors?`${errors} erro${errors===1?'':'s'} pedindo atenção`:'Nenhum erro urgente no momento';
    if(q('#questionShortcutMeta'))q('#questionShortcutMeta').textContent=`${ALL_QUESTIONS?.length||0} questão${ALL_QUESTIONS?.length===1?'':'ões'} disponíveis`;

    const dailyBox=q('#dailyMission');
    if(dailyBox&&mission&&!q('#practiceDailySubjectBtn')){
      const finishBtn=q('#finishDaily');
      if(finishBtn){
        finishBtn.insertAdjacentHTML('afterend',`<div class="dailyExtraRow" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><button class="ghost" id="practiceDailySubjectBtn" type="button">◎ Questões de ${escText(mission.subject||'hoje')}</button><button class="ghost" id="startSprint5MinBtn" type="button">⚡ Sprint Rápido (5 min)</button></div>`);
        q('#practiceDailySubjectBtn').onclick=()=>{
          openView('report');
          const subjSel=q('#questionSubject');
          if(subjSel){
            const match=[...subjSel.options].find(opt=>topicKey(opt.value)===topicKey(mission.subject));
            if(match){subjSel.value=match.value;populateTopicFilter();updateQuestionPool()}
          }
        };
        q('#startSprint5MinBtn').onclick=startQuickSprintBattle;
      }
    }
  }

  function startQuickSprintBattle(){
    const pool=(ALL_QUESTIONS||[]);
    if(!pool.length){
      openView('report');
      return toast('Envie um PDF ou gere um caderno na Central de Provas para iniciar o Sprint de 5 minutos.');
    }
    const mission=(typeof missionPool==='function'?missionPool():[]).find(item=>item.id===state?.daily)||null;
    const subjPool=mission?pool.filter(x=>topicKey(learningCategory(x.subject))===topicKey(mission.subject)):[];
    const source=subjPool.length>=3?subjPool:pool;
    activeQuestions={
      mode:'progressive',
      subject:mission?.subject?`Sprint 5 min · ${mission.subject}`:'Sprint Rápido 5 min',
      questions:progressiveQuestions(source,Math.min(4,source.length)).map(prepareQuestion),
      current:0,
      correct:0,
      streak:0,
      level:1,
      answered:false
    };
    q('#questionDialogTitle').textContent='⚡ Sprint Relâmpago de 5 Minutos';
    q('#questionDialog').showModal();
    showQuestion();
  }

  function ensureTopicPanelSearch(){
    const panel=q('#topicPanel'),list=q('#topicList');
    if(!panel||!list||q('#topicSearchInput'))return;
    list.insertAdjacentHTML('beforebegin',`<div class="searchBox" style="position:static;margin-bottom:10px;padding:7px 10px"><input id="topicSearchInput" type="search" placeholder="Filtrar tópicos desta disciplina..." aria-label="Filtrar tópicos desta disciplina"></div>`);
    q('#topicSearchInput').oninput=e=>{
      const term=topicKey(e.target.value);
      qa('#topicList .topic').forEach(label=>{
        const text=topicKey(label.textContent);
        label.style.display=!term||text.includes(term)?'':'none';
      });
    };
  }

  // 1. Cronograma Reverso + Ciclo de Estudos Automático (Estilo Estratégia / Gran / Caveira)
  function ensureReverseSchedulePanel(){
    const countdownCard=q('#map .examCountdown');
    if(!countdownCard||q('#reverseSchedulePanel'))return;
    countdownCard.insertAdjacentHTML('afterend',`<div class="card reverseScheduleCard" id="reverseSchedulePanel"><div class="sectionHead"><div><div class="eyebrow">CRONOGRAMA REVERSO ATÉ A PROVA</div><h2 id="reverseScheduleTitle">Ritmo necessário para fechar o edital</h2></div><span class="tag" id="reverseScheduleBadge">Cálculo automático</span></div><div class="reverseScheduleGrid" id="reverseScheduleMetrics"></div><p class="small muted" id="reverseScheduleAdvice" style="margin:10px 0 0"></p></div><div class="card studyCycleCard" id="studyCyclePanel"><div class="sectionHead"><div><div class="eyebrow">CICLO DE ESTUDOS AUTOMÁTICO & RAIO-X 80/20</div><h2 style="margin:3px 0 0">Rotação Inteligente de Disciplinas</h2><p class="small muted" style="margin:3px 0 0">Distribui seus blocos de foco dando peso dobrado às matérias com mais tópicos pendentes ou menor precisão nas questões.</p></div><span class="tag" id="studyCycleProgressTag">Ciclo ativo</span></div><div class="studyCycleGrid" id="studyCycleBlocks"></div></div>`);
  }

  function renderStudyCycle(){
    const container=q('#studyCycleBlocks'),tagEl=q('#studyCycleProgressTag');
    if(!container)return;
    const missions=(typeof missionPool==='function'?missionPool():[]).filter(m=>!String(m.id).startsWith('setup-'));
    if(!missions.length){
      if(tagEl)tagEl.textContent='Aguardando edital';
      container.innerHTML=`<div class="empty" style="grid-column:1/-1">Analise o edital na Biblioteca para gerar seu Ciclo Automático de Estudos por peso e prioridade.</div>`;
      return;
    }

    const bySubject={};
    for(const m of missions){
      const subj=canonicalSubjectName(m.subject||'Disciplina');
      bySubject[subj]??={total:0,done:0,qTotal:0,qCorrect:0};
      bySubject[subj].total++;
      if(state?.done?.[m.id])bySubject[subj].done++;
    }
    const scores=(state?.scores||[]).filter(s=>!s.campaignId||s.campaignId===state.activeCampaignId);
    for(const s of scores){
      const subj=canonicalSubjectName(s.subject||missions.find(m=>m.id===s.id)?.subject||'');
      if(bySubject[subj]){
        bySubject[subj].qTotal+=Number(s.total||0);
        bySubject[subj].qCorrect+=Number(s.correct||0);
      }
    }

    const cycleItems=Object.entries(bySubject).map(([subj,d])=>{
      const pending=Math.max(0,d.total-d.done);
      const accuracy=d.qTotal>0?Math.round(d.qCorrect/d.qTotal*100):null;
      const highPriority=pending>=Math.ceil(d.total*0.5)||(accuracy!==null&&accuracy<68);
      const blocks=pending===0?1:(highPriority?2:1);
      const mode=pending===0?'Revisão + Questões':(accuracy!==null&&accuracy<60?'Reforço Teórico + Erros':'Teoria + 10 Questões');
      const blockMinutes=Math.max(30,Math.min(60,Math.round((state?.settings?.dailyMinutes||60)/2)));
      return {subj,pending,total:d.total,accuracy,blocks,mode,blockMinutes,highPriority};
    }).sort((a,b)=>(b.highPriority-a.highPriority)||(b.pending-a.pending));

    state.completedCycleBlocks=state.completedCycleBlocks||{};
    const campKey=state.activeCampaignId||'default';
    const doneMap=state.completedCycleBlocks[campKey]||{};
    const allCompleted=cycleItems.every((item,idx)=>Boolean(doneMap[`${idx}`]));
    if(allCompleted&&cycleItems.length){
      state.completedCycleBlocks[campKey]={};
    }
    const activeDoneMap=state.completedCycleBlocks[campKey]||{};
    const doneCount=cycleItems.filter((_,idx)=>activeDoneMap[`${idx}`]).length;
    if(tagEl)tagEl.textContent=`${doneCount}/${cycleItems.length} blocos no giro`;

    container.innerHTML=cycleItems.slice(0,9).map((item,idx)=>{
      const completed=Boolean(activeDoneMap[`${idx}`]);
      const badgeTone=item.highPriority?'priorityHigh':'priorityNormal';
      return `<div class="cycleBlockCard ${completed?'completed':''} ${badgeTone}">
        <div class="cycleBlockTop">
          <span class="eyebrow">BLOCO ${idx+1} · ${item.blocks===2?'PESO 2x (PRIORIDADE 80/20)':'PESO 1x'}</span>
          <span class="tag">${item.blockMinutes*item.blocks} min</span>
        </div>
        <b>${escText(item.subj)}</b>
        <span class="small muted">${escText(item.mode)} · ${item.pending} pendente(s)${item.accuracy!==null?` · ${item.accuracy}% acerto`:''}</span>
        <div class="cycleBlockActions">
          <button type="button" class="ghost small" data-cycle-toggle="${idx}">${completed?'✓ Concluído no giro':'Marcar bloco concluído'}</button>
          <button type="button" class="ghost small" data-cycle-train="${escText(item.subj)}">◎ Questões</button>
        </div>
      </div>`;
    }).join('');

    qa('[data-cycle-toggle]').forEach(btn=>btn.onclick=()=>{
      const idx=btn.dataset.cycleToggle;
      state.completedCycleBlocks=state.completedCycleBlocks||{};
      state.completedCycleBlocks[campKey]=state.completedCycleBlocks[campKey]||{};
      state.completedCycleBlocks[campKey][idx]=!state.completedCycleBlocks[campKey][idx];
      save();
      renderStudyCycle();
      toast(state.completedCycleBlocks[campKey][idx]?'Bloco do ciclo concluído!':'Bloco reaberto no ciclo.');
    });
    qa('[data-cycle-train]').forEach(btn=>btn.onclick=()=>{
      const targetSubj=btn.dataset.cycleTrain;
      openView('report');
      const subjSel=q('#questionSubject');
      if(subjSel){
        const match=[...subjSel.options].find(opt=>topicKey(opt.value)===topicKey(targetSubj));
        if(match){subjSel.value=match.value;populateTopicFilter();updateQuestionPool()}
      }
    });
  }

  function renderReverseSchedule(){
    ensureReverseSchedulePanel();
    ensureTopicPanelSearch();
    renderStudyCycle();
    const panel=q('#reverseSchedulePanel');
    if(!panel)return;
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    const missions=typeof missionPool==='function'?missionPool():[];
    const total=missions.length;
    const done=missions.filter(m=>state?.done?.[m.id]).length;
    const remaining=Math.max(0,total-done);
    const date=campaign?.examDate||campaign?.exam_date||null;
    const studyDaysCount=Math.max(1,(state?.settings?.studyDays||[1,2,3,4,5,6]).length);
    const metricsEl=q('#reverseScheduleMetrics'),badgeEl=q('#reverseScheduleBadge'),adviceEl=q('#reverseScheduleAdvice'),titleEl=q('#reverseScheduleTitle');

    if(!total){
      badgeEl.textContent='Aguardando edital';
      titleEl.textContent='Envie o edital para calcular sua meta semanal';
      metricsEl.innerHTML=`<div class="reverseMetric"><b>0</b><span>tópicos restantes</span></div><div class="reverseMetric"><b>—</b><span>meta / semana</span></div><div class="reverseMetric"><b>—</b><span>meta / dia de estudo</span></div><div class="reverseMetric"><b>${studyDaysCount}d</b><span>dias planejados/sem</span></div>`;
      adviceEl.textContent='Assim que o edital do portal for analisado na Biblioteca, o sistema calculará quantos tópicos você precisa concluir por semana até a prova.';
      return;
    }

    if(!date){
      const suggestedPerWeek=Math.max(1,studyDaysCount);
      const weeksAtCurrentPace=Math.ceil(remaining/suggestedPerWeek);
      badgeEl.textContent='Sem data definida';
      titleEl.textContent=remaining===0?'Edital 100% concluído!':`Faltam ${remaining} de ${total} tópicos`;
      metricsEl.innerHTML=`<div class="reverseMetric"><b>${remaining}</b><span>tópicos restantes</span></div><div class="reverseMetric"><b>${suggestedPerWeek}/sem</b><span>ritmo de 1/dia útil</span></div><div class="reverseMetric"><b>~${weeksAtCurrentPace} sem</b><span>previsão neste ritmo</span></div><div class="reverseMetric"><b>${Math.round(done/total*100)}%</b><span>edital vencido</span></div>`;
      adviceEl.textContent='Defina a data da prova no botão “Definir data” acima para calcular a meta exata de tópicos por semana e por dia até o concurso.';
      return;
    }

    const target=new Date(`${date}T23:59:59`);
    const daysLeft=Math.ceil((target-Date.now())/86400000);
    if(remaining===0){
      badgeEl.textContent='Edital fechado ✓';
      titleEl.textContent='Todos os tópicos do edital foram concluídos!';
      metricsEl.innerHTML=`<div class="reverseMetric"><b>0</b><span>tópicos restantes</span></div><div class="reverseMetric"><b>100%</b><span>cobertura concluída</span></div><div class="reverseMetric"><b>${Math.max(0,daysLeft)}d</b><span>até a prova</span></div><div class="reverseMetric"><b>Revisão</b><span>foco recomendado</span></div>`;
      adviceEl.textContent='Excelente! Utilize os dias restantes para simulados cronometrados, revisão espaçada e zerar o Caderno de Erros.';
      return;
    }

    if(daysLeft<=0){
      badgeEl.textContent='Prazo encerrado';
      titleEl.textContent=`Restam ${remaining} tópico(s) pendentes`;
      metricsEl.innerHTML=`<div class="reverseMetric"><b>${remaining}</b><span>tópicos restantes</span></div><div class="reverseMetric"><b>${done}/${total}</b><span>concluídos</span></div><div class="reverseMetric"><b>0d</b><span>dias restantes</span></div><div class="reverseMetric"><b>Priorizar</b><span>revisão final</span></div>`;
      adviceEl.textContent='A data informada para a prova já chegou ou passou. Atualize a data da prova ou priorize os tópicos de maior peso.';
      return;
    }

    const weeksLeft=Math.max(1/7,daysLeft/7);
    const studyDaysRemaining=Math.max(1,Math.round(weeksLeft*studyDaysCount));
    const perWeek=Math.ceil(remaining/weeksLeft);
    const perStudyDayRaw=remaining/studyDaysRemaining;
    const perStudyDay=perStudyDayRaw>=1?Math.ceil(perStudyDayRaw):Number(perStudyDayRaw.toFixed(1));
    const intense=perStudyDayRaw>2;

    badgeEl.textContent=intense?'Ritmo intensivo':'Meta em dia';
    titleEl.textContent=`Meta: ${perWeek} tópico${perWeek===1?'':'s'} por semana até ${target.toLocaleDateString('pt-BR')}`;
    metricsEl.innerHTML=`<div class="reverseMetric"><b>${remaining}</b><span>tópicos restantes</span></div><div class="reverseMetric"><b>${perWeek}/sem</b><span>meta semanal</span></div><div class="reverseMetric"><b>${perStudyDay}/dia</b><span>em ${studyDaysCount} dias/sem</span></div><div class="reverseMetric"><b>${Math.ceil(weeksLeft)} sem</b><span>(${daysLeft} dias) até a prova</span></div>`;
    adviceEl.textContent=intense
      ? `Atenção: faltam ${remaining} tópicos para ${daysLeft} dias (~${studyDaysRemaining} dias de estudo). Considere aumentar os dias de estudo no Planejamento ou focar nos assuntos mais cobrados.`
      : `Cumprindo cerca de ${perWeek} missões por semana (${perStudyDay} por dia de estudo), você fechará 100% do edital antes da prova.`;
  }

  // 2. Filtros Avançados (Tópico, Modo Progressivo, Inéditas/Favoritas estilo TEC/Qconcursos)
  function normalizedOrigin(question){const origin=String(question?.origin||'autoral').toLocaleLowerCase('pt-BR');return /oficial|importad|prova|adaptada/.test(origin)?'oficial':'autoral'}
  function normalizedDifficulty(question){const value=String(question?.difficulty||'medio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return value.startsWith('fac')?'facil':value.startsWith('dif')?'dificil':'medio'}
  function topicKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

  function activeCampaignErrors(){
    return Object.entries(state?.errors||{}).filter(([,e])=>!e?.campaignId||e.campaignId===state?.activeCampaignId);
  }

  function questionMatchesErrorPool(question,errorEntries){
    if(!errorEntries.length)return false;
    const qSubj=topicKey(learningCategory(question?.subject));
    const qTopic=topicKey(question?.topic);
    const qStmt=topicKey(question?.statement);
    return errorEntries.some(([,err])=>{
      const eTopic=topicKey(err?.topic);
      const eSubj=topicKey(err?.subject);
      const eStmt=topicKey(err?.question);
      return (eStmt&&eStmt===qStmt)||(eTopic&&qTopic&&(qTopic.includes(eTopic)||eTopic.includes(qTopic)))||(eSubj&&qSubj===eSubj);
    });
  }

  function isQuestionFavorited(question){
    const fp=questionFingerprint(question);
    return Boolean(state?.favoriteQuestions?.[fp]);
  }

  function isQuestionAnsweredBefore(question){
    const fp=questionFingerprint(question);
    return Boolean(state?.answeredQuestionFingerprints?.[fp]);
  }

  function ensureTopicFilterSelect(){
    const filters=q('.questionFilters');
    if(!filters)return;
    if(!q('#questionTopic')){
      const subjectField=q('#questionSubject')?.closest('.field');
      const html=`<label class="field">Assunto / Tópico<select id="questionTopic"><option value="all">Todos os assuntos</option></select></label>`;
      if(subjectField)subjectField.insertAdjacentHTML('afterend',html);
      else filters.insertAdjacentHTML('beforeend',html);
      q('#questionTopic')?.addEventListener('change',updateQuestionPool);
    }
    if(!q('#questionBattleMode')){
      filters.insertAdjacentHTML('beforeend',`<label class="field">Modo de aprendizado<select id="questionBattleMode"><option value="progressive">Desafio progressivo (Fácil → Difícil)</option><option value="balanced">Equilibrado (Mistura níveis)</option><option value="errors">Reforço automático (Meus erros)</option></select></label>`);
      q('#questionBattleMode')?.addEventListener('change',updateQuestionPool);
    }
    if(!q('#questionHistoryFilter')){
      filters.insertAdjacentHTML('beforeend',`<label class="field">Filtro TEC / Caderno<select id="questionHistoryFilter"><option value="all">Todas do banco</option><option value="unanswered">✨ Apenas inéditas (não resolvidas)</option><option value="favorites">⭐ Minhas favoritas</option></select></label>`);
      q('#questionHistoryFilter')?.addEventListener('change',updateQuestionPool);
    }
    const trainer=q('.questionTrainer');
    if(trainer&&!q('#trainerQuickActions')){
      const startBtn=q('#startQuestions');
      if(startBtn){
        startBtn.insertAdjacentHTML('afterend',`<div class="trainerQuickActions" id="trainerQuickActions"><button type="button" class="ghost" id="startProgressiveChallengeBtn">⚡ Desafio Progressivo</button><button type="button" class="ghost" id="startErrorReinforcementBtn">🔥 Reforçar meus erros (0)</button><button type="button" class="ghost" id="printQuestionBookletBtn">🖨️ Imprimir Caderno (PDF)</button></div>`);
        q('#startProgressiveChallengeBtn').onclick=()=>{
          if(q('#questionBattleMode'))q('#questionBattleMode').value='progressive';
          updateQuestionPool();
          startFilteredBattle();
        };
        q('#startErrorReinforcementBtn').onclick=startErrorReinforcementBattle;
        q('#printQuestionBookletBtn').onclick=exportPrintableQuestionBooklet;
      }
    }
  }

  function populateTopicFilter(){
    ensureTopicFilterSelect();
    const topicSelect=q('#questionTopic');
    if(!topicSelect)return;
    const subject=q('#questionSubject')?.value||'all';
    const currentTopic=topicSelect.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const allForSubject=(ALL_QUESTIONS||[]).filter(item=>subject==='all'||learningCategory(item.subject)===subject);
    const pool=allForSubject.length?allForSubject:baseSource;
    const topicsMap=new Map();
    for(const item of pool){
      const label=String(item?.topic||'').trim();
      const key=topicKey(label);
      if(label&&key&&!topicsMap.has(key))topicsMap.set(key,label);
    }
    const sorted=[...topicsMap.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
    topicSelect.innerHTML='<option value="all">Todos os assuntos</option>'+sorted.map(([key,label])=>`<option value="${escText(key)}">${escText(label)}</option>`).join('');
    topicSelect.value=topicsMap.has(currentTopic)?currentTopic:'all';
    populateExamHubSelects();
  }

  function filteredQuestionPool(){
    const subject=q('#questionSubject')?.value||'all',topic=q('#questionTopic')?.value||'all',difficulty=q('#questionDifficulty')?.value||'all',origin=q('#questionOrigin')?.value||'all',battleMode=q('#questionBattleMode')?.value||'progressive',historyFilter=q('#questionHistoryFilter')?.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const allMatchingSubject=(ALL_QUESTIONS||[]).filter(item=>subject==='all'||learningCategory(item.subject)===subject);
    const source=allMatchingSubject.length?allMatchingSubject:baseSource;
    let filtered=source.filter(item=>(topic==='all'||topicKey(item?.topic)===topic)&&(difficulty==='all'||normalizedDifficulty(item)===difficulty)&&(origin==='all'||normalizedOrigin(item)===origin));
    if(historyFilter==='unanswered'){
      const unanswered=filtered.filter(item=>!isQuestionAnsweredBefore(item));
      if(unanswered.length)filtered=unanswered;
    }else if(historyFilter==='favorites'){
      filtered=filtered.filter(item=>isQuestionFavorited(item));
    }
    if(battleMode==='errors'){
      const errEntries=activeCampaignErrors();
      const errPool=filtered.filter(item=>questionMatchesErrorPool(item,errEntries));
      if(errPool.length)filtered=errPool;
    }
    return filtered;
  }

  function updateQuestionPool(){
    const pool=filteredQuestionPool(),badge=q('#questionPoolCount'),battleMode=q('#questionBattleMode')?.value||'progressive';
    if(badge)badge.textContent=`${pool.length} disponíve${pool.length===1?'l':'is'}`;
    const button=q('#startQuestions');
    if(button){
      button.disabled=!pool.length;
      const count=Math.min(battleMode==='progressive'?6:5,pool.length);
      button.textContent=pool.length
        ? (battleMode==='progressive'?`Iniciar Desafio Progressivo (${count} questões)`:battleMode==='errors'?`Iniciar Reforço de Erros (${count} questões)`:`Iniciar batalha de ${count} questões`)
        : 'Nenhuma questão neste filtro';
    }
    const errBtn=q('#startErrorReinforcementBtn');
    if(errBtn){
      const errCount=activeCampaignErrors().length;
      errBtn.textContent=`🔥 Reforçar meus erros (${errCount})`;
    }
    updateSimuladoAvailability();
  }

  function progressiveQuestions(pool,count=6){
    const groups={
      facil:shuffle(pool.filter(item=>normalizedDifficulty(item)==='facil')),
      medio:shuffle(pool.filter(item=>normalizedDifficulty(item)==='medio')),
      dificil:shuffle(pool.filter(item=>normalizedDifficulty(item)==='dificil'))
    };
    const ordered=[];
    const pattern=['facil','facil','medio','medio','dificil','dificil'];
    for(const diff of pattern){
      const candidate=groups[diff].shift();
      if(candidate&&!ordered.includes(candidate))ordered.push(candidate);
    }
    for(const item of [...groups.facil,...groups.medio,...groups.dificil,...shuffle(pool)]){
      if(ordered.length>=count)break;
      if(!ordered.includes(item))ordered.push(item);
    }
    return ordered.slice(0,count).sort((a,b)=>difficultyWeight(normalizedDifficulty(a))-difficultyWeight(normalizedDifficulty(b)));
  }

  function startFilteredBattle(){
    const pool=filteredQuestionPool(),subject=q('#questionSubject')?.value||'all',topicSel=q('#questionTopic'),battleMode=q('#questionBattleMode')?.value||'progressive';
    if(!pool.length)return toast('Não há questões que correspondam aos filtros selecionados.');
    const topicLabel=topicSel&&topicSel.value!=='all'?topicSel.options[topicSel.selectedIndex]?.text:'';
    const count=Math.min(battleMode==='progressive'?6:5,pool.length);
    const chosenQuestions=(battleMode==='progressive'?progressiveQuestions(pool,count):balancedQuestions(pool,count)).map(prepareQuestion);
    activeQuestions={
      mode:battleMode==='progressive'?'progressive':battleMode==='errors'?'errors':'battle',
      subject:topicLabel?`${subject==='all'?'Treino':subject} · ${topicLabel}`:subject,
      questions:chosenQuestions,
      current:0,
      correct:0,
      streak:0,
      level:1,
      answered:false
    };
    q('#questionDialogTitle').textContent=battleMode==='progressive'
      ? `Desafio Progressivo${topicLabel?` · ${topicLabel}`:''}`
      : battleMode==='errors'
      ? 'Reforço Automático de Erros'
      : topicLabel?`Batalha · ${topicLabel}`:'Batalha de questões';
    q('#questionDialog').showModal();
    showQuestion();
  }

  function startErrorReinforcementBattle(){
    const errEntries=activeCampaignErrors();
    if(!errEntries.length)return toast('Parabéns! Seu Caderno de Erros está zerado neste portal.');
    const allPool=ALL_QUESTIONS||[];
    let errQuestions=allPool.filter(item=>questionMatchesErrorPool(item,errEntries));
    if(!errQuestions.length){
      errQuestions=errEntries.filter(([,e])=>e?.question&&e?.correctAnswer).map(([,e])=>{
        const distractors=['Interpretação restritiva incompatível com o texto legal','Exceção não prevista na norma de regência','Inversão entre regra geral e hipótese específica'].filter(d=>d!==e.correctAnswer);
        const opts=[e.correctAnswer,...distractors.slice(0,3)];
        return {
          subject:e.subject||'Revisão de Erros',
          topic:e.topic||'Ponto de Atenção',
          statement:e.question,
          options:opts,
          correct_index:0,
          explanation:e.explanation||`Você marcou anteriormente: “${e.lastChosen||'outra opção'}”. O gabarito correto é: “${e.correctAnswer}”.`,
          difficulty:'medio',
          origin:'autoral'
        };
      });
    }
    if(!errQuestions.length)return toast('Envie materiais ou gere questões dos tópicos errados para iniciar a revisão prática.');
    const count=Math.min(6,errQuestions.length);
    activeQuestions={
      mode:'errors',
      subject:'Reforço de Erros',
      questions:progressiveQuestions(errQuestions,count).map(prepareQuestion),
      current:0,
      correct:0,
      streak:0,
      level:1,
      answered:false
    };
    q('#questionDialogTitle').textContent='🔥 Reforço Automático de Erros';
    q('#questionDialog').showModal();
    showQuestion();
  }

  // 2B. Resolução Passo a Passo (Estilo boaResposta) + Recursos TEC / Qconcursos / Caveira / Descomplica
  function findRelatedSummary(question){
    if(!Array.isArray(ALL_SUMMARIES)||!ALL_SUMMARIES.length)return null;
    const qSubj=topicKey(learningCategory(question?.subject));
    const qTopic=topicKey(question?.topic);
    return ALL_SUMMARIES.find(s=>topicKey(s.title)===qTopic||(qTopic&&topicKey(s.title).includes(qTopic)))
      || ALL_SUMMARIES.find(s=>topicKey(s.category)===qSubj)
      || null;
  }

  function formatStepByStepResolution(item,chosenIndex,ok,interactive=true){
    const correctIndex=Number(item.correct_index)||0;
    const correctLetter=String.fromCharCode(65+correctIndex);
    const chosenLetter=Number.isInteger(chosenIndex)?String.fromCharCode(65+chosenIndex):'—';
    const rawExp=String(item.explanation||'').trim();
    const related=findRelatedSummary(item);
    const fp=questionFingerprint(item);
    const isFav=isQuestionFavorited(item);
    const savedComment=state?.questionPersonalNotes?.[fp]||'';

    const lines=rawExp.split(/\n+|\s*\|\s*/).map(l=>l.trim()).filter(Boolean);
    const conceptLine=lines.find(l=>/^conceito[- ]?chave\s*:/i.test(l));
    const whyCorrectLine=lines.find(l=>/^(✅|\s*alternativa correta|\s*por que a correta|\s*correta\s*:)/i.test(l));
    const whyWrongLine=lines.find(l=>/^(❌|\s*an[aá]lise das alternativas|\s*por que as outras|\s*demais alternativas)/i.test(l));
    const trapLine=lines.find(l=>/^(⚠️|⚠|\s*pegadinha)/i.test(l));

    const hasStructured=Boolean(conceptLine||whyCorrectLine||whyWrongLine||trapLine);
    let stepsHtml='';

    if(hasStructured){
      const cleanPrefix=txt=>escText(txt.replace(/^(?:conceito[- ]?chave|✅|❌|⚠️|⚠|alternativa correta|por que a correta est[aá] certa|an[aá]lise das alternativas|por que as outras est[aá]o erradas|demais alternativas|pegadinha(?: da banca)?(?:\s*\([^)]*\))?)\s*:?\s*/i,''));
      if(conceptLine)stepsHtml+=`<div class="stepResolutionBlock concept"><b>💡 Conceito-chave cobrado</b><p>${cleanPrefix(conceptLine)}</p></div>`;
      if(whyCorrectLine)stepsHtml+=`<div class="stepResolutionBlock right"><b>✅ Por que a alternativa ${correctLetter} está correta</b><p>${cleanPrefix(whyCorrectLine)}</p></div>`;
      if(whyWrongLine)stepsHtml+=`<div class="stepResolutionBlock wrongAnalysis"><b>❌ Análise das demais alternativas</b><p>${cleanPrefix(whyWrongLine)}</p></div>`;
      if(trapLine)stepsHtml+=`<div class="stepResolutionBlock trap"><b>⚠️ Pegadinha de prova</b><p>${cleanPrefix(trapLine)}</p></div>`;
      const extraLines=lines.filter(l=>![conceptLine,whyCorrectLine,whyWrongLine,trapLine].includes(l));
      if(extraLines.length&&!whyCorrectLine){
        stepsHtml+=`<div class="stepResolutionBlock right"><b>✅ Resolução comentada</b><p>${escText(extraLines.join(' '))}</p></div>`;
      }
    } else {
      stepsHtml+=`<div class="stepResolutionBlock right"><b>✅ Passo a passo do raciocínio</b><p>${escText(rawExp||`A alternativa ${correctLetter} reproduz corretamente o entendimento aplicável ao tema “${item.topic||item.subject}”.`)}</p></div>`;
      if(related?.bizu){
        stepsHtml+=`<div class="stepResolutionBlock concept"><b>💡 Bizu do material (${escText(related.title)})</b><p>${escText(related.bizu)}</p></div>`;
      }
      if(related?.trap){
        stepsHtml+=`<div class="stepResolutionBlock trap"><b>⚠️ Pegadinha frequente neste tema</b><p>${escText(related.trap)}</p></div>`;
      }
    }

    const optionsBreakdown=(item.options||[]).map((opt,idx)=>{
      const letter=String.fromCharCode(65+idx);
      const isRight=idx===correctIndex;
      const isUserPick=idx===chosenIndex;
      const statusTag=isRight?'<span class="stepOptBadge good">✓ Correta</span>':isUserPick?'<span class="stepOptBadge bad">✗ Sua escolha</span>':'<span class="stepOptBadge neutral">Distrator</span>';
      return `<div class="stepOptionItem ${isRight?'isRight':isUserPick?'isWrong':''}"><div><b>${letter})</b> ${escText(opt)}</div>${statusTag}</div>`;
    }).join('');

    const interactiveControls=interactive?`
      <div class="resolutionActionBar">
        <button type="button" class="ghost small" id="spawnTwinQuestionBtn">⚡ Gerar questão gêmea</button>
        <button type="button" class="ghost small" id="explainEasyAnalogyBtn">🧠 Explicar fácil (analogia)</button>
        <button type="button" class="ghost small" id="createFlashcardFromQuestionBtn">🃏 Virar Flashcard</button>
        <button type="button" class="ghost small" id="toggleFavoriteQuestionBtn">${isFav?'⭐ Favorita (salva)':'☆ Favoritar questão'}</button>
        <button type="button" class="ghost small" id="saveQuestionNoteBtn">📌 Salvar no Caderno</button>
      </div>
      <div id="easyAnalogyOutput" hidden class="stepResolutionBlock concept" style="margin-top:6px"></div>
      <div class="personalQuestionBizuBox">
        <label class="small muted" for="personalQuestionCommentInput">💬 Meu bizu / anotação nesta questão (estilo TEC/Qconcursos):</label>
        <div class="personalBizuRow">
          <input type="text" id="personalQuestionCommentInput" value="${escText(savedComment)}" placeholder="Escreva seu mnemônico ou observação rápida para lembrar desta questão...">
          <button type="button" class="ghost small" id="savePersonalQuestionCommentBtn">Salvar bizu</button>
        </div>
      </div>` : '';

    return `<div class="boaRespostaResolution ${ok?'isGood':'isBad'}">
      <div class="resolutionHeader">
        <div>
          <span class="eyebrow">${ok?'✓ RESPOSTA CORRETA · +25 XP':'✗ RESPOSTA INCORRETA · APRENDA COM O PASSO A PASSO'}</span>
          <h4>Gabarito: Alternativa ${correctLetter}${!ok?` (você marcou ${chosenLetter})`:''}</h4>
        </div>
        <span class="tag">${escText(item.board||(normalizedOrigin(item)==='oficial'?'Prova Oficial':'Estilo Banca'))}</span>
      </div>
      ${stepsHtml}
      <details class="resolutionOptionsDetails" ${!ok?'open':''}>
        <summary>Ver conferência alternativa por alternativa (A–D)</summary>
        <div class="stepOptionsList">${optionsBreakdown}</div>
      </details>
      ${interactiveControls}
    </div>`;
  }

  async function saveQuestionsToCampaign(title,subject,questions,sourceLabel='Banco de Questões'){
    if(!Array.isArray(questions)||!questions.length)return 0;
    const normalized=questions.filter(item=>item?.statement&&Array.isArray(item?.options)&&item.options.length===4).map(item=>({
      subject:canonicalSubjectName(item.subject||subject||'Conteúdo Geral'),
      topic:String(item.topic||title||'Geral').trim(),
      board:String(item.board||sourceLabel).trim(),
      statement:String(item.statement).trim(),
      options:item.options.slice(0,4).map(o=>String(o).trim()),
      correct_index:Math.min(3,Math.max(0,Number(item.correct_index)||0)),
      explanation:String(item.explanation||'').trim(),
      difficulty:['facil','medio','dificil'].includes(normalizedDifficulty(item))?normalizedDifficulty(item):'medio',
      origin:normalizedOrigin(item)==='oficial'?'oficial':'autoral'
    }));
    if(!normalized.length)return 0;

    const existingFp=new Set((ALL_QUESTIONS||[]).map(item=>questionFingerprint(item)));
    const fresh=normalized.filter(item=>!existingFp.has(questionFingerprint(item)));
    const toAdd=fresh.length?fresh:normalized;

    state.customQuestionsByCampaign=state.customQuestionsByCampaign||{};
    const campId=state.activeCampaignId;
    const currentLocal=state.customQuestionsByCampaign[campId]||[];
    const localFp=new Set(currentLocal.map(item=>questionFingerprint(item)));
    for(const item of toAdd){
      if(!localFp.has(questionFingerprint(item)))currentLocal.push(item);
      if(!existingFp.has(questionFingerprint(item)))ALL_QUESTIONS.push(item);
    }
    state.customQuestionsByCampaign[campId]=currentLocal.slice(-400);
    LEARNING_SUBJECTS=[...new Set([...LEARNING_SUBJECTS,...toAdd.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    save();

    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    if(cloudSession&&campaign?.dbId){
      try{
        await cloudFetch('generated_study_content',{
          method:'POST',
          headers:{'Content-Type':'application/json',Prefer:'return=representation'},
          body:JSON.stringify([{
            campaign_id:campaign.dbId,
            user_id:cloudSession.user.id,
            content_type:'summary',
            title:String(title||`Caderno ${sourceLabel}`).slice(0,140),
            content:{
              is_question_pack:true,
              subject:toAdd[0].subject,
              source:sourceLabel,
              explanation:`Pacote de questões (${sourceLabel}) salvo no banco da campanha.`,
              points:[],
              flashcards:[],
              questions:toAdd
            },
            source_refs:[{title:sourceLabel}]
          }])
        });
      }catch(e){
        console.warn('Salvamento em nuvem pendente; mantido localmente',e);
      }
    }

    renderQuestionFilters();
    populateTopicFilter();
    updateQuestionPool();
    renderExamBankHub();
    return toAdd.length;
  }

  async function spawnTwinQuestionForCurrent(currentItem,btnEl){
    if(!cloudSession)return toast('Entre na sua conta para gerar questões gêmeas com a IA.');
    if(btnEl){btnEl.disabled=true;btnEl.textContent='⏳ Gerando questão gêmea...'}
    try{
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada. Entre novamente.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({
          action:'generate_structured_questions',
          submode:'twin',
          count:1,
          subject:learningCategory(currentItem.subject),
          topic:currentItem.topic||'Assunto do Edital',
          board:currentItem.board||'Instituto AOCP',
          difficulty:normalizedDifficulty(currentItem),
          mold_question:currentItem,
          campaign_id:activeCampaign()?.dbId
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível gerar a questão gêmea.');
      const twin=data.questions?.[0];
      if(!twin)throw new Error('A IA não retornou a questão gêmea.');
      await saveQuestionsToCampaign(`Questão Gêmea · ${twin.topic}`,twin.subject,[twin],twin.board||'Questão Gêmea IA');
      if(activeQuestions&&Array.isArray(activeQuestions.questions)){
        activeQuestions.questions.splice(activeQuestions.current+1,0,prepareQuestion(twin));
        q('#questionCounter').textContent=`${activeQuestions.current+1}/${activeQuestions.questions.length} · ${normalizedDifficulty(currentItem).toUpperCase()}`;
        q('#nextQuestion').textContent='Responder questão gêmea →';
      }
      if(btnEl)btnEl.textContent='✓ Questão gêmea adicionada!';
      toast('Questão gêmea criada e colocada como próxima da fila!');
    }catch(error){
      if(btnEl){btnEl.disabled=false;btnEl.textContent='⚡ Gerar questão gêmea'}
      toast(error.message);
    }
  }

  async function explainQuestionWithEasyAnalogy(item,btnEl){
    const outBox=q('#easyAnalogyOutput');
    if(!outBox)return;
    if(!cloudSession)return toast('Entre na sua conta para usar a explicação com analogia.');
    if(btnEl){btnEl.disabled=true;btnEl.textContent='⏳ Gerando analogia...'}
    try{
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada.');
      const correctOpt=item.options?.[Number(item.correct_index)||0]||'';
      const prompt=`Explique de forma extremamente simples, direta e com uma analogia prática do dia a dia policial por que a resposta correta para a questão abaixo é "${correctOpt}". Máximo de 2 parágrafos curtos.\n\nQuestão: ${item.statement}`;
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({question:prompt,context:item.explanation||'',mode:'explicar',campaign_id:activeCampaign()?.dbId})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível gerar a analogia.');
      outBox.hidden=false;
      outBox.innerHTML=`<b>🧠 Explicação descomplicada com analogia</b><p>${escText(data.answer||'')}</p>`;
      if(btnEl)btnEl.textContent='✓ Analogia exibida';
    }catch(err){
      if(btnEl){btnEl.disabled=false;btnEl.textContent='🧠 Explicar fácil (analogia)'}
      toast(err.message);
    }
  }

  function createFlashcardFromQuestion(item,btnEl){
    const correctIdx=Number(item.correct_index)||0;
    const correctOpt=item.options?.[correctIdx]||'';
    const subj=canonicalSubjectName(item.subject||'Geral');
    const cardQ=`[${item.topic||subj}] ${item.statement}`;
    const cardA=`✅ ${correctOpt}\n\n${item.explanation||''}`.trim();
    state.customFlashcardsByCampaign=state.customFlashcardsByCampaign||{};
    const campId=state.activeCampaignId;
    state.customFlashcardsByCampaign[campId]=state.customFlashcardsByCampaign[campId]||[];
    state.customFlashcardsByCampaign[campId].push([subj,cardQ,cardA]);
    ALL_FLASHCARDS.push([subj,cardQ,cardA]);
    save();
    if(typeof renderCard==='function')renderCard();
    if(btnEl){btnEl.disabled=true;btnEl.textContent='✓ Virada em Flashcard!'}
    toast('Flashcard criado e adicionado à Central de Estudo!');
  }

  function saveCurrentQuestionToNotes(item){
    const correctIdx=Number(item.correct_index)||0;
    const correctLetter=String.fromCharCode(65+correctIdx);
    const noteTitle=`Questão comentada: ${item.topic||item.subject||'Estudo'}`;
    const noteBody=[
      `Disciplina: ${learningCategory(item.subject)}`,
      `Enunciado: ${item.statement}`,
      `Alternativa correta: ${correctLetter}) ${item.options?.[correctIdx]||''}`,
      `Resolução: ${item.explanation||''}`
    ].join('\n\n');
    state.userNotes=state.userNotes||[];
    state.userNotes.push({
      id:String(Date.now()),
      title:noteTitle,
      content:noteBody,
      subject:learningCategory(item.subject)||'Geral',
      campaignId:state.activeCampaignId,
      updated:new Date().toISOString()
    });
    save();
    if(typeof renderNotes==='function')renderNotes();
    toast('Questão e resolução passo a passo salvas nas suas Anotações!');
  }

  // Sobrescreve showQuestion e answerQuestion com Tesoura de Alternativas (TEC/Qconcursos) + Resolução Passo a Passo
  window.showQuestion=function(){
    const battle=activeQuestions;
    if(!battle)return;
    const item=battle.questions[battle.current];
    const diff=normalizedDifficulty(item);
    const diffLabel={facil:'FÁCIL',medio:'MÉDIA',dificil:'DIFÍCIL'}[diff]||'MÉDIA';
    const origin=normalizedOrigin(item)==='oficial'?'OFICIAL/PROVA':'AUTORAL IA';
    const levelLabel=battle.mode==='progressive'
      ? ` · NÍVEL ${diff==='facil'?'1 (BASE)':diff==='medio'?'2 (APLICAÇÃO)':'3 (DOMÍNIO)'}`
      : '';
    q('#questionCounter').textContent=`${battle.current+1}/${battle.questions.length} · ${diffLabel} · ${origin}${levelLabel}`;
    q('#questionText').textContent=item.statement;
    q('#questionOptions').innerHTML=(item.options||[]).map((o,i)=>`<div class="optionWithScissors"><button type="button" class="optionMainBtn" data-question-index="${i}"><b>${String.fromCharCode(65+i)}.</b> ${escText(o)}</button><button type="button" class="scissorBtn" data-scissor-index="${i}" title="Riscar/eliminar alternativa (estilo TEC/Qconcursos)" aria-label="Riscar alternativa ${String.fromCharCode(65+i)}">✂</button></div>`).join('');
    q('#questionFeedback').innerHTML='';
    q('#nextQuestion').hidden=true;
    battle.answered=false;
    qa('[data-question-index]').forEach(b=>b.onclick=()=>window.answerQuestion(b,item));
    qa('[data-scissor-index]').forEach(sBtn=>sBtn.onclick=e=>{
      e.stopPropagation();
      if(battle.answered)return;
      const idx=sBtn.dataset.scissorIndex;
      const optBtn=q(`[data-question-index="${idx}"]`);
      if(optBtn){
        optBtn.classList.toggle('eliminatedOption');
        sBtn.classList.toggle('active');
      }
    });
  };

  window.answerQuestion=function(button,item){
    const battle=activeQuestions;
    if(!battle||battle.answered)return;
    battle.answered=true;
    const chosen=Number(button.dataset.questionIndex),correct=Number(item.correct_index),ok=chosen===correct;
    const fp=questionFingerprint(item);
    state.answeredQuestionFingerprints=state.answeredQuestionFingerprints||{};
    state.answeredQuestionFingerprints[fp]=ok?'correct':'wrong';
    recordQuestionResult(item,ok,chosen);
    if(ok){
      battle.correct++;
      battle.streak=(battle.streak||0)+1;
      button.classList.add('correct');
      state.learning.xp=(state.learning.xp||0)+25;
    }else{
      battle.streak=0;
      button.classList.add('wrong');
      qa('[data-question-index]').find(b=>Number(b.dataset.questionIndex)===correct)?.classList.add('correct');
    }
    q('#questionFeedback').innerHTML=formatStepByStepResolution(item,chosen,ok,true);
    qa('[data-question-index],[data-scissor-index]').forEach(b=>b.disabled=true);

    const twinBtn=q('#spawnTwinQuestionBtn');
    if(twinBtn)twinBtn.onclick=()=>spawnTwinQuestionForCurrent(item,twinBtn);
    const analogyBtn=q('#explainEasyAnalogyBtn');
    if(analogyBtn)analogyBtn.onclick=()=>explainQuestionWithEasyAnalogy(item,analogyBtn);
    const flashBtn=q('#createFlashcardFromQuestionBtn');
    if(flashBtn)flashBtn.onclick=()=>createFlashcardFromQuestion(item,flashBtn);
    const favBtn=q('#toggleFavoriteQuestionBtn');
    if(favBtn)favBtn.onclick=()=>{
      state.favoriteQuestions=state.favoriteQuestions||{};
      if(state.favoriteQuestions[fp]){
        delete state.favoriteQuestions[fp];
        favBtn.textContent='☆ Favoritar questão';
        toast('Removida das favoritas.');
      }else{
        state.favoriteQuestions[fp]={savedAt:new Date().toISOString(),subject:item.subject,topic:item.topic};
        favBtn.textContent='⭐ Favorita (salva)';
        toast('Questão adicionada às suas Favoritas!');
      }
      save();
      updateQuestionPool();
    };
    const noteBtn=q('#saveQuestionNoteBtn');
    if(noteBtn)noteBtn.onclick=()=>{saveCurrentQuestionToNotes(item);noteBtn.disabled=true;noteBtn.textContent='✓ Salva no Caderno'};
    const bizuSaveBtn=q('#savePersonalQuestionCommentBtn');
    if(bizuSaveBtn)bizuSaveBtn.onclick=()=>{
      const val=q('#personalQuestionCommentInput')?.value?.trim()||'';
      state.questionPersonalNotes=state.questionPersonalNotes||{};
      if(val)state.questionPersonalNotes[fp]=val;
      else delete state.questionPersonalNotes[fp];
      save();
      toast(val?'Seu bizu pessoal foi salvo nesta questão!':'Bizu removido.');
    };

    q('#nextQuestion').hidden=false;
    q('#nextQuestion').textContent=battle.current===battle.questions.length-1?'Concluir batalha':'Próxima questão →';
    q('#nextQuestion').scrollIntoView({block:'nearest'});
  };

  // 2C. Diagnóstico Tático de Pontos Fortes e Pontos Fracos
  function ensureTacticalDiagnosisPanel(){
    const columns=q('#report .reportColumns');
    if(!columns||q('#tacticalDiagnosisPanel'))return;
    columns.insertAdjacentHTML('beforebegin',`<div class="card tacticalDiagnosisCard" id="tacticalDiagnosisPanel"><div class="sectionHead"><div><div class="eyebrow">DIAGNÓSTICO DE DESEMPENHO</div><h2 style="margin:3px 0 0">Pontos Fortes e Pontos Fracos</h2><p class="small muted" style="margin:3px 0 0">Identifique onde sua precisão já está segura e quais matérias precisam de reforço imediato.</p></div><span class="tag" id="diagnosisSummaryTag">Análise tática</span></div><div class="diagnosisGrid" id="diagnosisColumns"></div></div>`);
  }

  function renderTacticalDiagnosis(){
    ensureTacticalDiagnosisPanel();
    const container=q('#diagnosisColumns'),tagEl=q('#diagnosisSummaryTag');
    if(!container)return;
    const scores=(state?.scores||[]).filter(item=>!item.campaignId||item.campaignId===state.activeCampaignId);
    const missions=typeof missionPool==='function'?missionPool():[];
    const bySubject={};
    for(const item of scores){
      const name=canonicalSubjectName(item.subject||missions.find(m=>m.id===item.id)?.subject||'Conteúdo Geral');
      bySubject[name]??={total:0,correct:0,misses:0};
      bySubject[name].total+=Number(item.total||0);
      bySubject[name].correct+=Number(item.correct||0);
    }
    for(const [,err] of activeCampaignErrors()){
      const name=canonicalSubjectName(err?.subject||'Conteúdo Geral');
      bySubject[name]??={total:0,correct:0,misses:0};
      bySubject[name].misses+=Number(err?.misses||1);
    }

    const entries=Object.entries(bySubject).map(([name,d])=>{
      const rate=d.total>0?Math.round(d.correct/d.total*100):(d.misses>0?35:0);
      return {name,total:d.total,correct:d.correct,misses:d.misses,rate};
    });

    if(!entries.length){
      if(tagEl)tagEl.textContent='Sem histórico ainda';
      container.innerHTML=`<div class="empty" style="grid-column:1/-1">Resolva sua primeira bateria de questões ou simulado para destravar o mapa de Pontos Fortes e Pontos Fracos.</div>`;
      return;
    }

    const strong=entries.filter(x=>x.total>=3&&x.rate>=75).sort((a,b)=>b.rate-a.rate);
    const evolving=entries.filter(x=>x.total>0&&x.rate>=55&&x.rate<75).sort((a,b)=>a.rate-b.rate);
    const weak=entries.filter(x=>x.rate<55||x.misses>=2&&x.rate<75).sort((a,b)=>a.rate-b.rate);

    if(tagEl)tagEl.textContent=`${strong.length} forte(s) · ${weak.length} crítico(s)`;

    const renderItem=(item,showTrainBtn)=>`<div class="diagnosisItem"><div><b>${escText(item.name)}</b><span class="small muted">${item.total?`${item.correct}/${item.total} acertos (${item.rate}%)`:''}${item.misses?`${item.total?' · ':''}${item.misses} erro(s) ativo(s)`:''}</span></div>${showTrainBtn?`<button type="button" class="ghost small" data-train-diagnosis-subject="${escText(item.name)}">Treinar →</button>`:`<span class="tag">${item.rate}%</span>`}</div>`;

    container.innerHTML=`
      <div class="diagnosisCol strong">
        <div class="diagnosisColHead"><b>🟢 Pontos Fortes (≥75%)</b><span>${strong.length}</span></div>
        <div class="diagnosisList">${strong.length?strong.map(x=>renderItem(x,false)).join(''):'<p class="small muted">Acerte 75% ou mais em uma disciplina (mín. 3 questões) para dominá-la.</p>'}</div>
      </div>
      <div class="diagnosisCol evolving">
        <div class="diagnosisColHead"><b>🟡 Em Evolução (55–74%)</b><span>${evolving.length}</span></div>
        <div class="diagnosisList">${evolving.length?evolving.map(x=>renderItem(x,true)).join(''):'<p class="small muted">Nenhuma disciplina na faixa intermediária no momento.</p>'}</div>
      </div>
      <div class="diagnosisCol weak">
        <div class="diagnosisColHead"><b>🔴 Reforço Prioritário (<55%)</b><span>${weak.length}</span></div>
        <div class="diagnosisList">${weak.length?weak.map(x=>renderItem(x,true)).join(''):'<p class="small muted">Nenhum ponto crítico detectado! Continue praticando.</p>'}</div>
      </div>
    `;

    qa('[data-train-diagnosis-subject]').forEach(btn=>btn.onclick=()=>{
      const targetSubj=btn.dataset.trainDiagnosisSubject;
      const subjSel=q('#questionSubject');
      if(subjSel){
        const match=[...subjSel.options].find(opt=>topicKey(opt.value)===topicKey(targetSubj));
        if(match){
          subjSel.value=match.value;
          if(q('#questionBattleMode'))q('#questionBattleMode').value='progressive';
          populateTopicFilter();
          updateQuestionPool();
          startFilteredBattle();
          return;
        }
      }
      switchExamHubTab('generator');
      if(q('#genBankSubject'))q('#genBankSubject').value=targetSubj;
      q('#examBankHub')?.scrollIntoView({behavior:'smooth',block:'center'});
      toast(`Gere um caderno de questões de ${targetSubj} abaixo para iniciar o treino!`);
    });
  }

  function renderPerformanceChart(){
    const root=q('#performanceChart');if(!root)return;
    const scores=(state?.scores||[]).filter(item=>!item.campaignId||item.campaignId===state.activeCampaignId),groups={};
    for(const item of scores){const name=item.subject||missionPool().find(m=>m.id===item.id)?.subject||'Conteúdo geral';groups[name]??={total:0,correct:0};groups[name].total+=Number(item.total||0);groups[name].correct+=Number(item.correct||0)}
    const rows=Object.entries(groups).filter(([,data])=>data.total>0).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
    root.className='performanceChart';root.innerHTML=rows.length?rows.map(([name,data])=>{const rate=Math.round(data.correct/data.total*100),tone=rate<60?'low':rate<80?'mid':'high';return `<div class="performanceBar ${tone}" title="${escText(name)}: ${data.correct}/${data.total}"><span>${escText(name)}</span><div class="performanceTrack"><i style="width:${rate}%"></i></div><b>${rate}%</b></div>`}).join(''):'<div class="empty">Resolva questões para visualizar sua precisão por disciplina.</div>';
    renderTacticalDiagnosis();
    renderCutoffThermometer();
    ensureLegalHighlightToggle();
    if(legalHighlightEnabled)setTimeout(()=>applyLegalHighlightsToTextNodes(q('#summaryList')),50);
  }

  // 3. Central de Provas & Alimentação do Banco (#examBankHub)
  let activeExamHubTab='catalog';

  function ensureExamBankHub(){
    if(q('#examBankHub'))return;
    const legacyCard=q('#report .sourceLinks')?.closest('.card');
    if(!legacyCard)return;
    legacyCard.id='examBankHub';
    legacyCard.classList.add('examBankHubCard');
    legacyCard.innerHTML=`
      <div class="sectionHead">
        <div>
          <div class="eyebrow">CENTRAL DE PROVAS & BANCO DE QUESTÕES</div>
          <h2 style="margin:3px 0 0">Provas Oficiais, Importação e Gerador Estilo Banca</h2>
          <p class="small muted" style="margin:3px 0 0">Resolva provas reais dentro do app, puxe questões do banco compartilhado, cole questões de provas anteriores ou gere baterias passo a passo no estilo da sua banca.</p>
        </div>
        <span class="tag" id="examHubCountTag">0 oficiais</span>
      </div>
      <div class="examHubTabs" role="tablist">
        <button type="button" class="examHubTab active" data-exam-tab="catalog">📚 Provas & Banco Oficial</button>
        <button type="button" class="examHubTab" data-exam-tab="import">➕ Importar Prova / Colar Questões</button>
        <button type="button" class="examHubTab" data-exam-tab="generator">🎯 Gerar no Estilo da Banca</button>
      </div>
      <div class="examHubPanel active" id="examHubCatalogPanel" data-exam-panel="catalog">
        <div class="sharedBankBanner">
          <div>
            <b>🌐 Catálogo Oficial Compartilhado do Aplicativo</b>
            <p class="small muted" id="sharedBankStatusText" style="margin:3px 0 0">Sincronize questões extraídas de provas oficiais e simulados já processados no banco de dados sem gastar nova cota de IA.</p>
          </div>
          <button type="button" class="action small" id="syncSharedBankBtn" style="width:auto;padding:10px 15px;white-space:nowrap">📥 Puxar Questões do Banco</button>
        </div>
        <div id="examDocumentsCatalog" class="examDocumentsCatalog"></div>
      </div>
      <div class="examHubPanel" id="examHubImportPanel" data-exam-panel="import" hidden>
        <div class="examImportSplit">
          <div class="examImportBox">
            <div class="eyebrow">OPÇÃO 1 · ARQUIVO PDF DA PROVA</div>
            <h3 style="margin:4px 0 6px">Enviar Prova Oficial ou Simulado em PDF</h3>
            <p class="small muted" style="margin:0 0 10px">Envie o caderno de prova em PDF direto por aqui. O sistema extrairá as questões e classificará por matéria automaticamente.</p>
            <input type="file" id="quickExamPdfInput" accept="application/pdf,.pdf" style="margin-bottom:8px">
            <input type="text" id="quickExamPdfTitle" placeholder="Título da prova (ex.: Prova PMPE 2024 — AOCP)" style="margin-bottom:8px">
            <button type="button" class="action" id="quickExamPdfUploadBtn">Enviar PDF e Extrair Questões</button>
          </div>
          <div class="examImportBox">
            <div class="eyebrow">OPÇÃO 2 · TEXTO COPIADO, JSON OU CSV</div>
            <h3 style="margin:4px 0 6px">Colar Questões de Prova ou Importar Pacote</h3>
            <p class="small muted" style="margin:0 0 10px">Cole abaixo 1 ou mais questões copiadas de qualquer prova/gabarito (ou carregue um arquivo .json) para converter em questões interativas com resolução passo a passo.</p>
            <div class="formrow" style="margin-bottom:8px">
              <label class="field" style="margin:0">Disciplina<input type="text" id="pasteQuestionSubject" placeholder="Ex.: Direito Penal"></label>
              <label class="field" style="margin:0">Banca / Fonte<select id="pasteQuestionBoard"><option value="Instituto AOCP">Instituto AOCP</option><option value="Cebraspe">Cebraspe</option><option value="FGV Conhecimento">FGV Conhecimento</option><option value="IBFC">IBFC</option><option value="FCC">FCC</option><option value="Vunesp">Vunesp</option><option value="Prova Oficial">Outra Banca Oficial</option></select></label>
            </div>
            <textarea id="pasteQuestionRawText" rows="4" placeholder="Cole aqui o enunciado, as alternativas (A, B, C, D) e o gabarito, ou selecione um arquivo JSON abaixo..."></textarea>
            <div class="examImportActionsRow">
              <label class="ghost small" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:0">📂 Carregar JSON<input type="file" id="importQuestionFileInput" accept=".json,application/json" hidden></label>
              <button type="button" class="action" id="parseAndSaveQuestionsBtn" style="flex:1">⚡ Converter e Salvar no Banco</button>
            </div>
          </div>
        </div>
      </div>
      <div class="examHubPanel" id="examHubGeneratorPanel" data-exam-panel="generator" hidden>
        <div class="examGeneratorBox">
          <div class="eyebrow">ESTILO CAVEIRA / TEC / BOARESPOSTA · RESOLUÇÃO PASSO A PASSO</div>
          <h3 style="margin:4px 0 6px">Gerador de Caderno Comentado no Estilo da Banca</h3>
          <p class="small muted" style="margin:0 0 12px">Escolha a banca, a disciplina e o assunto do seu edital. A IA criará questões inéditas com resolução passo a passo (Conceito-chave + análise de cada alternativa + pegadinha) e salvará no seu banco.</p>
          <div class="simuladoConfigGrid" style="margin-bottom:10px">
            <label class="field" style="margin:0">Banca organizadora<select id="genBankBoard"><option value="Instituto AOCP">Instituto AOCP</option><option value="Cebraspe">Cebraspe</option><option value="FGV Conhecimento">FGV Conhecimento</option><option value="IBFC">IBFC</option><option value="FCC">FCC</option><option value="Vunesp">Vunesp</option><option value="Projeto Caveira (Policial)">Estilo Caveira (Carreiras Policiais)</option></select></label>
            <label class="field" style="margin:0">Disciplina do portal<select id="genBankSubject"></select></label>
            <label class="field" style="margin:0">Assunto / Tópico foco<select id="genBankTopic"><option value="Geral do edital">Todos os tópicos da disciplina</option></select></label>
          </div>
          <div class="formrow" style="margin-bottom:10px">
            <label class="field" style="margin:0">Progressão de dificuldade<select id="genBankDifficulty"><option value="progressivo">Progressiva (Fácil → Média → Difícil)</option><option value="medio">Nível Médio (Aplicação)</option><option value="dificil">Nível Difícil (Casos e Exceções)</option></select></label>
            <label class="field" style="margin:0">Quantidade<select id="genBankCount"><option value="5">5 questões comentadas</option><option value="8">8 questões comentadas</option><option value="10">10 questões comentadas</option></select></label>
          </div>
          <button type="button" class="action" id="generateBoardPackBtn">✨ Gerar Caderno Comentado e Salvar no Banco</button>
        </div>
      </div>
      <details class="officialSourcesAccordion">
        <summary>🔗 Precisa baixar o PDF original de uma prova? Consultar sites oficiais das bancas ↗</summary>
        <div class="sourceLinks" style="margin-top:10px">
          <a class="sourceLink" href="https://link.institutoaocp.org.br/visualizar-prova-gabarito-definitivo-public/index.jsp?concurso=588" target="_blank" rel="noopener"><b>Instituto AOCP — PMPE</b><span>Abrir ↗</span></a>
          <a class="sourceLink" href="https://www.cebraspe.org.br/concursos/" target="_blank" rel="noopener"><b>Cebraspe — Concursos</b><span>Abrir ↗</span></a>
          <a class="sourceLink" href="https://conhecimento.fgv.br/concursos" target="_blank" rel="noopener"><b>FGV Conhecimento</b><span>Abrir ↗</span></a>
          <a class="sourceLink" href="https://www.pciconcursos.com.br/provas/" target="_blank" rel="noopener"><b>PCI Concursos — Acervo de Provas</b><span>Abrir ↗</span></a>
        </div>
      </details>
    `;

    qa('[data-exam-tab]').forEach(btn=>btn.onclick=()=>switchExamHubTab(btn.dataset.examTab));
    q('#syncSharedBankBtn').onclick=syncSharedQuestionBank;
    q('#quickExamPdfInput').onchange=e=>{
      const file=e.target.files?.[0];
      if(file&&!q('#quickExamPdfTitle').value)q('#quickExamPdfTitle').value=file.name.replace(/\.pdf$/i,'');
    };
    q('#quickExamPdfUploadBtn').onclick=handleQuickExamPdfUpload;
    q('#importQuestionFileInput').onchange=handleImportQuestionJsonFile;
    q('#parseAndSaveQuestionsBtn').onclick=handleParseAndSaveRawQuestions;
    q('#genBankSubject').onchange=populateGenBankTopics;
    q('#generateBoardPackBtn').onclick=handleGenerateBoardPack;
  }

  function switchExamHubTab(tabName){
    activeExamHubTab=tabName;
    qa('[data-exam-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.examTab===tabName));
    qa('[data-exam-panel]').forEach(panel=>{
      const active=panel.dataset.examPanel===tabName;
      panel.classList.toggle('active',active);
      panel.hidden=!active;
    });
    if(tabName==='generator')populateExamHubSelects();
  }

  function populateExamHubSelects(){
    const genSubj=q('#genBankSubject');
    if(!genSubj)return;
    const missions=typeof missionPool==='function'?missionPool():[];
    const subjects=[...new Set([
      ...missions.map(m=>canonicalSubjectName(m.subject)).filter(Boolean),
      ...(LEARNING_SUBJECTS||[]).map(s=>canonicalSubjectName(s)).filter(Boolean),
      ...(ALL_QUESTIONS||[]).map(item=>canonicalSubjectName(item.subject)).filter(Boolean)
    ])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const list=subjects.length?subjects:['Língua Portuguesa','Direito Constitucional','Direito Administrativo','Direito Penal','Raciocínio Lógico-Matemático','Informática'];
    const current=genSubj.value;
    genSubj.innerHTML=list.map(s=>`<option value="${escText(s)}">${escText(s)}</option>`).join('');
    if(list.includes(current))genSubj.value=current;
    populateGenBankTopics();
  }

  function populateGenBankTopics(){
    const genSubj=q('#genBankSubject')?.value||'';
    const genTopic=q('#genBankTopic');
    if(!genTopic)return;
    const missions=(typeof missionPool==='function'?missionPool():[]).filter(m=>topicKey(canonicalSubjectName(m.subject))===topicKey(genSubj));
    const qTopics=(ALL_QUESTIONS||[]).filter(item=>topicKey(canonicalSubjectName(item.subject))===topicKey(genSubj)).map(item=>item.topic).filter(Boolean);
    const topics=[...new Set([...missions.map(m=>m.name),...qTopics])].slice(0,60);
    genTopic.innerHTML=`<option value="Tópicos essenciais de ${escText(genSubj)}">Todos os tópicos de ${escText(genSubj)}</option>`+topics.map(t=>`<option value="${escText(t)}">${escText(t)}</option>`).join('');
  }

  function renderExamBankHub(){
    ensureExamBankHub();
    enhanceFlashcardsSpacedRepetition();
    enhanceEssayCenter();
    const catalogEl=q('#examDocumentsCatalog'),countTag=q('#examHubCountTag');
    if(!catalogEl)return;
    const officialQuestions=(ALL_QUESTIONS||[]).filter(item=>normalizedOrigin(item)==='oficial');
    if(countTag)countTag.textContent=`${officialQuestions.length} oficia${officialQuestions.length===1?'l':'is'} · ${(ALL_QUESTIONS||[]).length} total`;

    const examDocs=(typeof cloudDocuments!=='undefined'?cloudDocuments:[]).filter(d=>['prova','simulado'].includes(d.document_type));
    const docsHtml=examDocs.length?examDocs.map(doc=>{
      const docQuestions=(ALL_QUESTIONS||[]).filter(item=>item.sourceDocumentId===doc.id||topicKey(item.board)===topicKey(doc.title));
      const status=doc.processing_status||'pending';
      const statusLabel={ready:`${docQuestions.length||Number(doc.metadata?.coverage?.summary_count||0)*5||'Pronta'} questões`,processing:'Extraindo questões...',pending:'Aguardando extração',error:'Falha — tentar novamente'}[status]||status;
      return `<div class="examDocRow">
        <div>
          <span class="eyebrow">${doc.document_type==='simulado'?'SIMULADO EM PDF':'PROVA OFICIAL'}</span>
          <b>${escText(doc.title)}</b>
          <span class="small muted">${escText(statusLabel)} · ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
        <div class="examDocActions">
          ${status==='ready'?`<button type="button" class="ghost small" data-exam-doc-battle="${doc.id}">◎ Treinar</button><button type="button" class="action small" data-exam-doc-simulado="${doc.id}">▶ Simulado</button>`:`<button type="button" class="action small" data-exam-doc-process="${doc.id}">⚡ Extrair Questões</button>`}
        </div>
      </div>`;
    }).join(''):`<div class="examEmptyState">
      <b>Nenhuma prova em PDF enviada ainda neste portal</b>
      <p class="small muted" style="margin:4px 0 10px">Clique em <b>“📥 Puxar Questões do Banco”</b> acima, envie o PDF de uma prova na aba <b>“➕ Importar Prova”</b> ou gere questões comentadas na aba <b>“🎯 Gerar no Estilo da Banca”</b>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button type="button" class="ghost small" id="emptyGoImportTabBtn">➕ Importar Prova / Questões</button>
        <button type="button" class="ghost small" id="emptyGoGeneratorTabBtn">🎯 Gerar Caderno da Banca</button>
      </div>
    </div>`;

    catalogEl.innerHTML=docsHtml;
    if(q('#emptyGoImportTabBtn'))q('#emptyGoImportTabBtn').onclick=()=>switchExamHubTab('import');
    if(q('#emptyGoGeneratorTabBtn'))q('#emptyGoGeneratorTabBtn').onclick=()=>switchExamHubTab('generator');

    qa('[data-exam-doc-process]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.examDocProcess;
      if(typeof processEditalDocument==='function')processEditalDocument(id);
    });
    qa('[data-exam-doc-battle]').forEach(btn=>btn.onclick=()=>{
      const doc=examDocs.find(d=>d.id===btn.dataset.examDocBattle);
      const docPool=(ALL_QUESTIONS||[]).filter(item=>item.sourceDocumentId===doc?.id||normalizedOrigin(item)==='oficial');
      if(!docPool.length)return toast('Extraia as questões desta prova primeiro.');
      activeQuestions={
        mode:'progressive',
        subject:doc?.title||'Prova Oficial',
        questions:progressiveQuestions(docPool,Math.min(10,docPool.length)).map(prepareQuestion),
        current:0,
        correct:0,
        streak:0,
        level:1,
        answered:false
      };
      q('#questionDialogTitle').textContent=`Prova · ${doc?.title||'Oficial'}`;
      q('#questionDialog').showModal();
      showQuestion();
    });
    qa('[data-exam-doc-simulado]').forEach(btn=>btn.onclick=()=>{
      const doc=examDocs.find(d=>d.id===btn.dataset.examDocSimulado);
      const docPool=(ALL_QUESTIONS||[]).filter(item=>item.sourceDocumentId===doc?.id||normalizedOrigin(item)==='oficial');
      if(!docPool.length)return toast('Extraia as questões desta prova primeiro.');
      if(q('#questionOrigin'))q('#questionOrigin').value='oficial';
      if(q('#simuladoScope'))q('#simuladoScope').value='filtered';
      updateQuestionPool();
      startTimedSimulado();
    });
  }

  async function syncSharedQuestionBank(){
    if(!cloudSession)return toast('Entre na sua conta para sincronizar o banco compartilhado de questões.');
    const btn=q('#syncSharedBankBtn'),statusEl=q('#sharedBankStatusText');
    if(btn){btn.disabled=true;btn.textContent='⏳ Buscando no banco...'}
    try{
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada. Entre novamente.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({action:'shared_question_bank',campaign_id:activeCampaign()?.dbId})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível consultar o banco compartilhado.');
      const shared=Array.isArray(data.questions)?data.questions:[];
      if(!shared.length){
        if(statusEl)statusEl.textContent='O catálogo compartilhado ainda não possui provas extras além das suas. Importe uma prova ou gere questões na aba ao lado!';
        toast('Nenhuma questão nova encontrada no catálogo compartilhado.');
        return;
      }
      const added=await saveQuestionsToCampaign('Catálogo Oficial Compartilhado','Conteúdo Geral',shared,'Banco Oficial Compartilhado');
      if(statusEl)statusEl.textContent=`✓ Catálogo sincronizado: ${shared.length} questão(ões) oficial(is) verificada(s) e disponível(is) para treino neste portal!`;
      toast(`${added} questão(ões) oficial(is) sincronizada(s) para o seu banco!`);
    }catch(error){
      toast(error.message);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='📥 Puxar Questões do Banco'}
    }
  }

  async function handleQuickExamPdfUpload(){
    const fileInput=q('#quickExamPdfInput'),titleInput=q('#quickExamPdfTitle');
    const file=fileInput?.files?.[0];
    if(!file)return toast('Selecione o arquivo PDF da prova primeiro.');
    if(!cloudSession)return toast('Entre na sua conta para enviar e processar PDFs.');
    const libFile=q('#documentFile'),libTitle=q('#documentTitle'),libType=q('#documentType');
    if(!libFile||!libType||typeof uploadStudyDocument!=='function')return toast('Use a aba Biblioteca para enviar o PDF.');
    const dt=new DataTransfer();
    dt.items.add(file);
    libFile.files=dt.files;
    if(libTitle)libTitle.value=titleInput?.value?.trim()||file.name.replace(/\.pdf$/i,'');
    libType.value='prova';
    const btn=q('#quickExamPdfUploadBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Enviando e extraindo questões...'}
    try{
      await uploadStudyDocument();
      if(fileInput)fileInput.value='';
      if(titleInput)titleInput.value='';
      switchExamHubTab('catalog');
      renderExamBankHub();
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Enviar PDF e Extrair Questões'}
    }
  }

  function tryParseLocalQuestionText(rawText,defaultSubject,defaultBoard){
    const trimmed=String(rawText||'').trim();
    if(!trimmed)return[];
    if(trimmed.startsWith('[')||trimmed.startsWith('{')){
      try{
        const parsed=JSON.parse(trimmed);
        const arr=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.questions)?parsed.questions:[]);
        return arr.filter(x=>x?.statement&&Array.isArray(x?.options)&&x.options.length>=4).map(x=>({
          subject:x.subject||defaultSubject||'Conteúdo Geral',
          topic:x.topic||'Questão Importada',
          board:x.board||defaultBoard||'Prova Oficial',
          statement:String(x.statement).trim(),
          options:x.options.slice(0,4).map(String),
          correct_index:Math.min(3,Math.max(0,Number(x.correct_index)||0)),
          explanation:String(x.explanation||'Questão oficial importada pelo usuário.'),
          difficulty:x.difficulty||'medio',
          origin:'oficial'
        }));
      }catch{}
    }
    return[];
  }

  async function handleImportQuestionJsonFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    try{
      const text=await file.text();
      if(q('#pasteQuestionRawText'))q('#pasteQuestionRawText').value=text;
      toast('Arquivo carregado! Clique em “Converter e Salvar no Banco”.');
    }catch{
      toast('Não foi possível ler o arquivo selecionado.');
    }finally{
      e.target.value='';
    }
  }

  async function handleParseAndSaveRawQuestions(){
    const rawText=q('#pasteQuestionRawText')?.value?.trim()||'';
    const subject=q('#pasteQuestionSubject')?.value?.trim()||q('#questionSubject')?.value||'Conteúdo Geral';
    const board=q('#pasteQuestionBoard')?.value||'Instituto AOCP';
    if(rawText.length<15)return toast('Cole o texto da(s) questão(ões) ou carregue um arquivo JSON primeiro.');

    const btn=q('#parseAndSaveQuestionsBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Estruturando questões e resoluções...'}
    try{
      const localParsed=tryParseLocalQuestionText(rawText,subject==='all'?'Conteúdo Geral':subject,board);
      if(localParsed.length){
        const count=await saveQuestionsToCampaign(`Importação ${board}`,subject==='all'?'Conteúdo Geral':subject,localParsed,board);
        q('#pasteQuestionRawText').value='';
        switchExamHubTab('catalog');
        toast(`✓ ${count} questão(ões) importada(s) e salva(s) no banco!`);
        return;
      }
      if(!cloudSession)throw new Error('Entre na sua conta para converter questões em texto livre usando a IA.');
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada. Entre novamente.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({
          action:'generate_structured_questions',
          submode:'parse_raw',
          subject:subject==='all'?'Conteúdo Geral':subject,
          board,
          raw_text:rawText,
          campaign_id:activeCampaign()?.dbId
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível converter o texto em questões.');
      const count=await saveQuestionsToCampaign(`Prova Importada · ${board}`,subject==='all'?'Conteúdo Geral':subject,data.questions||[],board);
      q('#pasteQuestionRawText').value='';
      switchExamHubTab('catalog');
      toast(`✓ ${count} questão(ões) oficial(is) estruturada(s) com resolução passo a passo!`);
    }catch(error){
      toast(error.message);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='⚡ Converter e Salvar no Banco'}
    }
  }

  async function handleGenerateBoardPack(){
    if(!cloudSession)return toast('Entre na sua conta para gerar cadernos comentados no estilo da banca.');
    const board=q('#genBankBoard')?.value||'Instituto AOCP';
    const subject=q('#genBankSubject')?.value||'Direito Constitucional';
    const topic=q('#genBankTopic')?.value||`Tópicos essenciais de ${subject}`;
    const difficulty=q('#genBankDifficulty')?.value||'progressivo';
    const count=Number(q('#genBankCount')?.value)||5;
    const btn=q('#generateBoardPackBtn');
    if(btn){btn.disabled=true;btn.textContent=`⏳ Elaborando ${count} questões estilo ${board}...`}
    try{
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada. Entre novamente.');
      const context=typeof assistantLibraryContext==='function'?assistantLibraryContext():'';
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({
          action:'generate_structured_questions',
          submode:'board_pack',
          board,
          subject,
          topic,
          difficulty,
          count,
          context,
          campaign_id:activeCampaign()?.dbId
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível gerar o caderno de questões.');
      const generated=Array.isArray(data.questions)?data.questions:[];
      if(!generated.length)throw new Error('Nenhuma questão retornada pela IA.');
      await saveQuestionsToCampaign(`Caderno ${board} · ${topic}`,subject,generated,board);
      toast(`✓ ${generated.length} questões estilo ${board} salvas no seu banco! Iniciando treino...`);
      activeQuestions={
        mode:'progressive',
        subject:`${subject} · ${board}`,
        questions:generated.map(prepareQuestion),
        current:0,
        correct:0,
        streak:0,
        level:1,
        answered:false
      };
      q('#questionDialogTitle').textContent=`Caderno ${board} · ${subject}`;
      q('#questionDialog').showModal();
      showQuestion();
    }catch(error){
      toast(error.message);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='✨ Gerar Caderno Comentado e Salvar no Banco'}
    }
  }

  // 4. Modo Simulado Cronometrado com Folha de Respostas + Modalidade Líquida Caveira/Cebraspe + Tesoura
  let activeSimulado=null,simuladoTimer=null;

  function ensureSimuladoUI(){
    const trainer=q('.questionTrainer');
    if(trainer&&!q('#simuladoLauncher')){
      trainer.insertAdjacentHTML('afterend',`<div class="card simuladoLauncher" id="simuladoLauncher"><div class="sectionHead"><div><div class="eyebrow">PROVA SIMULADA · ESTILO CAVEIRA & BANCAS</div><h2 style="margin:3px 0 0">Simulado Cronometrado com Folha de Respostas</h2><p class="small muted" style="margin:3px 0 0">Monte um caderno completo misturando as disciplinas do portal, elimine alternativas com a tesoura (✂), escolha entre nota tradicional ou líquida (Cebraspe/Caveira) e receba o diagnóstico ao entregar.</p></div><span class="tag" id="simuladoTotalBadge">0 no banco</span></div><div class="simuladoConfigGrid"><label class="field">Quantidade de questões<select id="simuladoCount"><option value="10">10 questões ( treino rápido )</option><option value="20" selected>20 questões ( simulado curto )</option><option value="30">30 questões ( simulado médio )</option><option value="40">40 questões ( simulado amplo )</option><option value="60">60 questões ( prova completa )</option></select></label><label class="field">Tempo limite<select id="simuladoMinutes"><option value="20">20 minutos</option><option value="40">40 minutos</option><option value="60" selected>1 hora (60 min)</option><option value="90">1h30 (90 min)</option><option value="120">2 horas (120 min)</option><option value="180">3 horas (180 min)</option></select></label><label class="field">Escopo<select id="simuladoScope"><option value="all">Todas as disciplinas do portal</option><option value="filtered">Usar filtros selecionados acima</option></select></label><label class="field">Regra de pontuação<select id="simuladoScoringMode"><option value="standard">Tradicional (AOCP / FGV — sem penalidade)</option><option value="liquid">Líquida Caveira / Cebraspe (1 errada anula 1 certa)</option></select></label></div><button class="action" id="startSimuladoBtn" style="margin-top:10px">Iniciar Simulado Cronometrado</button></div>`);
      q('#startSimuladoBtn').onclick=startTimedSimulado;
      q('#simuladoScope').onchange=updateSimuladoAvailability;
    }
    if(!q('#simuladoDialog')){
      document.body.insertAdjacentHTML('beforeend',`<dialog id="simuladoDialog" class="simuladoDialog"><div class="simuladoTopBar"><div><div class="eyebrow" id="simuladoMetaLabel">SIMULADO CRONOMETRADO</div><h2 id="simuladoTitle" style="margin:2px 0 0;font-size:1.05rem">Caderno de Prova</h2></div><div class="simuladoClockWrap"><span class="simuladoClock" id="simuladoClock">60:00</span><button class="ghost danger small" id="abortSimuladoBtn" type="button">Sair</button></div></div><div id="simuladoStage"><div class="simuladoSheetBar"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="small muted" id="simuladoAnsweredCount">0 respondidas</div><button type="button" class="ghost small" id="simuladoClearAnswerBtn" style="padding:4px 10px;min-height:30px;font-size:.75rem">␣ Deixar questão em branco</button></div><div class="simuladoSheetGrid" id="simuladoSheetGrid" aria-label="Folha de respostas"></div></div><div class="questionBox simuladoQuestionBox"><div class="small muted" id="simuladoQuestionMeta"></div><h3 id="simuladoQuestionText" style="margin:8px 0 14px"></h3><div class="questionOptions" id="simuladoOptions"></div></div><div class="simuladoNavRow"><button class="ghost" id="simuladoPrevBtn" type="button">← Anterior</button><button class="ghost" id="simuladoNextBtn" type="button">Próxima →</button><button class="action" id="simuladoSubmitBtn" type="button">Entregar Simulado</button></div></div><div id="simuladoResultStage" hidden></div></dialog>`);
      q('#abortSimuladoBtn').onclick=abortTimedSimulado;
      q('#simuladoPrevBtn').onclick=()=>navigateSimulado(-1);
      q('#simuladoNextBtn').onclick=()=>navigateSimulado(1);
      q('#simuladoSubmitBtn').onclick=()=>confirmSubmitSimulado();
      q('#simuladoClearAnswerBtn').onclick=()=>{
        if(!activeSimulado)return;
        activeSimulado.answers[activeSimulado.current]=null;
        renderSimuladoQuestion();
      };
    }
  }

  function simuladoCandidatePool(){
    const scope=q('#simuladoScope')?.value||'all';
    if(scope==='filtered')return filteredQuestionPool();
    return ALL_QUESTIONS||[];
  }

  function updateSimuladoAvailability(){
    const badge=q('#simuladoTotalBadge'),btn=q('#startSimuladoBtn');
    if(!badge||!btn)return;
    const pool=simuladoCandidatePool();
    badge.textContent=`${pool.length} no banco`;
    btn.disabled=pool.length<1;
  }

  function buildProportionalSimuladoQuestions(pool,wantedCount){
    const bySubject={};
    for(const item of pool){
      const subj=learningCategory(item.subject)||'Geral';
      (bySubject[subj]||=[]).push(item);
    }
    const subjects=Object.keys(bySubject);
    if(!subjects.length)return[];
    for(const subj of subjects)bySubject[subj]=shuffle(bySubject[subj]);
    const selected=[],seen=new Set();
    let cursor=0;
    while(selected.length<wantedCount){
      let addedInRound=false;
      for(const subj of subjects){
        const candidate=bySubject[subj][cursor];
        if(candidate){
          const fp=questionFingerprint(candidate);
          if(!seen.has(fp)){
            seen.add(fp);
            selected.push(prepareQuestion(candidate));
            addedInRound=true;
            if(selected.length>=wantedCount)break;
          }
        }
      }
      if(!addedInRound)break;
      cursor++;
    }
    return selected;
  }

  function formatSimuladoClock(seconds){
    const s=Math.max(0,Math.floor(seconds));
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function startTimedSimulado(){
    const pool=simuladoCandidatePool();
    if(!pool.length)return toast('Envie um PDF na Biblioteca ou gere questões na Central de Provas para montar o simulado.');
    const wanted=Math.min(pool.length,Math.max(1,Number(q('#simuladoCount')?.value)||20));
    const minutes=Math.max(5,Number(q('#simuladoMinutes')?.value)||60);
    const scoringMode=q('#simuladoScoringMode')?.value||'standard';
    const questions=buildProportionalSimuladoQuestions(pool,wanted);
    if(!questions.length)return toast('Não foi possível montar o caderno de questões.');

    clearInterval(simuladoTimer);
    activeSimulado={
      questions,
      answers:new Array(questions.length).fill(null),
      eliminated:questions.map(()=>new Set()),
      scoringMode,
      current:0,
      totalSeconds:minutes*60,
      remainingSeconds:minutes*60,
      startedAt:Date.now(),
      finished:false
    };

    q('#simuladoStage').hidden=false;
    q('#simuladoResultStage').hidden=true;
    q('#simuladoResultStage').innerHTML='';
    q('#simuladoMetaLabel').textContent=scoringMode==='liquid'?'SIMULADO CAVEIRA / CEBRASPE (1 ERRADA ANULA 1 CERTA)':'SIMULADO CRONOMETRADO TRADICIONAL';
    q('#simuladoTitle').textContent=`Caderno com ${questions.length} questão${questions.length===1?'':'ões'}`;
    q('#simuladoClock').textContent=formatSimuladoClock(activeSimulado.remainingSeconds);
    q('#simuladoClock').classList.remove('warnText');
    renderSimuladoQuestion();
    q('#simuladoDialog').showModal();

    simuladoTimer=setInterval(()=>{
      if(!activeSimulado||activeSimulado.finished)return;
      activeSimulado.remainingSeconds=Math.max(0,activeSimulado.totalSeconds-Math.floor((Date.now()-activeSimulado.startedAt)/1000));
      const clockEl=q('#simuladoClock');
      if(clockEl){
        clockEl.textContent=formatSimuladoClock(activeSimulado.remainingSeconds);
        clockEl.classList.toggle('warnText',activeSimulado.remainingSeconds<=300);
      }
      if(activeSimulado.remainingSeconds<=0){
        toast('Tempo esgotado! Entregando o simulado automaticamente.');
        finishTimedSimulado(true);
      }
    },1000);
  }

  function renderSimuladoQuestion(){
    if(!activeSimulado)return;
    const {questions,answers,eliminated,current}=activeSimulado;
    const item=questions[current];
    const elimSet=eliminated[current]||new Set();
    const answeredCount=answers.filter(a=>a!==null).length;
    q('#simuladoAnsweredCount').textContent=`Folha de respostas: ${answeredCount}/${questions.length} marcada${answeredCount===1?'':'s'} (${questions.length-answeredCount} em branco)`;
    q('#simuladoSheetGrid').innerHTML=questions.map((_,i)=>{
      const chosen=answers[i];
      const letter=chosen!==null?String.fromCharCode(65+chosen):'';
      return `<button type="button" class="sheetBubble ${i===current?'current':''} ${chosen!==null?'answered':''}" data-simulado-jump="${i}" title="Questão ${i+1}${letter?` (Marcada: ${letter})`:' (Em branco)'}">${i+1}${letter?`<small>${letter}</small>`:''}</button>`;
    }).join('');
    qa('[data-simulado-jump]').forEach(btn=>btn.onclick=()=>{activeSimulado.current=Number(btn.dataset.simuladoJump);renderSimuladoQuestion()});

    const diffLabel={facil:'FÁCIL',medio:'MÉDIA',dificil:'DIFÍCIL'}[normalizedDifficulty(item)]||'MÉDIA';
    const originLabel=normalizedOrigin(item)==='oficial'?'OFICIAL/PROVA':'AUTORAL IA';
    q('#simuladoQuestionMeta').textContent=`Questão ${current+1} de ${questions.length} · ${learningCategory(item.subject)} · ${item.topic||'Geral'} · ${diffLabel} · ${originLabel}`;
    q('#simuladoQuestionText').textContent=item.statement;
    q('#simuladoOptions').innerHTML=(item.options||[]).map((opt,i)=>{
      const selected=answers[current]===i;
      const isElim=elimSet.has(i);
      return `<div class="optionWithScissors"><button type="button" class="optionMainBtn ${selected?'selectedOption':''} ${isElim?'eliminatedOption':''}" data-simulado-option="${i}"><b>${String.fromCharCode(65+i)}.</b> ${escText(opt)}</button><button type="button" class="scissorBtn ${isElim?'active':''}" data-simulado-scissor="${i}" title="Riscar/eliminar alternativa">✂</button></div>`;
    }).join('');
    qa('[data-simulado-option]').forEach(btn=>btn.onclick=()=>{
      const idx=Number(btn.dataset.simuladoOption);
      activeSimulado.answers[current]=activeSimulado.answers[current]===idx?null:idx;
      renderSimuladoQuestion();
    });
    qa('[data-simulado-scissor]').forEach(sBtn=>sBtn.onclick=e=>{
      e.stopPropagation();
      const idx=Number(sBtn.dataset.simuladoScissor);
      if(elimSet.has(idx))elimSet.delete(idx);
      else elimSet.add(idx);
      renderSimuladoQuestion();
    });
    q('#simuladoPrevBtn').disabled=current<=0;
    q('#simuladoNextBtn').disabled=current>=questions.length-1;
  }

  function navigateSimulado(delta){
    if(!activeSimulado)return;
    const next=activeSimulado.current+delta;
    if(next<0||next>=activeSimulado.questions.length)return;
    activeSimulado.current=next;
    renderSimuladoQuestion();
  }

  function abortTimedSimulado(){
    if(!activeSimulado||activeSimulado.finished){
      clearInterval(simuladoTimer);
      q('#simuladoDialog')?.close();
      return;
    }
    if(!confirm('Sair do simulado em andamento? As respostas atuais não serão salvas.'))return;
    clearInterval(simuladoTimer);
    activeSimulado=null;
    q('#simuladoDialog')?.close();
  }

  function confirmSubmitSimulado(){
    if(!activeSimulado||activeSimulado.finished)return;
    const unanswered=activeSimulado.answers.filter(a=>a===null).length;
    const msg=unanswered>0
      ? `Você deixou ${unanswered} questão${unanswered===1?'':'ões'} em branco${activeSimulado.scoringMode==='liquid'?' (sem penalidade na regra líquida)':''}. Deseja entregar o simulado agora?`
      : 'Deseja finalizar e corrigir sua Folha de Respostas agora?';
    if(!confirm(msg))return;
    finishTimedSimulado(false);
  }

  function finishTimedSimulado(){
    if(!activeSimulado||activeSimulado.finished)return;
    activeSimulado.finished=true;
    clearInterval(simuladoTimer);
    const {questions,answers,scoringMode,totalSeconds,remainingSeconds}=activeSimulado;
    const elapsedSeconds=Math.max(1,totalSeconds-remainingSeconds);
    const elapsedMinutes=Math.max(1,Math.round(elapsedSeconds/60));
    const bySubject={};
    let totalCorrect=0,totalWrong=0,totalBlank=0;

    questions.forEach((item,index)=>{
      const chosen=answers[index];
      const isBlank=chosen===null;
      const ok=!isBlank&&chosen===Number(item.correct_index);
      if(isBlank)totalBlank++;
      else if(ok)totalCorrect++;
      else totalWrong++;

      const subj=learningCategory(item.subject)||'Conteúdo geral';
      bySubject[subj]??={total:0,correct:0,wrong:0,blank:0};
      bySubject[subj].total++;
      if(isBlank)bySubject[subj].blank++;
      else if(ok)bySubject[subj].correct++;
      else bySubject[subj].wrong++;

      if(!isBlank){
        const fp=questionFingerprint(item);
        state.answeredQuestionFingerprints=state.answeredQuestionFingerprints||{};
        state.answeredQuestionFingerprints[fp]=ok?'correct':'wrong';
        if(typeof recordQuestionResult==='function')recordQuestionResult(item,ok,chosen);
      }
    });

    const missions=typeof missionPool==='function'?missionPool():[];
    for(const [subj,data] of Object.entries(bySubject)){
      const missionId=missions.find(m=>normalizeText(m.subject).includes(normalizeText(subj)))?.id||missions[0]?.id||null;
      state.scores.push({
        id:missionId,
        total:data.total,
        correct:data.correct,
        date:new Date().toISOString(),
        campaignId:state.activeCampaignId,
        subject:subj,
        source:'simulado'
      });
    }
    save();
    render();

    const rawRate=Math.round(totalCorrect/questions.length*100);
    const liquidPoints=Math.max(0,totalCorrect-totalWrong);
    const liquidRate=Math.round(liquidPoints/questions.length*100);
    const displayRate=scoringMode==='liquid'?liquidRate:rawRate;

    const subjectRows=Object.entries(bySubject).sort((a,b)=>(b[1].correct/b[1].total)-(a[1].correct/a[1].total)).map(([subj,data])=>{
      const subjRate=Math.round(data.correct/data.total*100);
      const tone=subjRate<60?'low':subjRate<80?'mid':'high';
      return `<div class="performanceBar ${tone}"><span>${escText(subj)}</span><div class="performanceTrack"><i style="width:${subjRate}%"></i></div><b>${data.correct}/${data.total} (${subjRate}%)</b></div>`;
    }).join('');

    const reviewItems=questions.map((item,i)=>{
      const chosen=answers[i],correct=Number(item.correct_index),ok=chosen===correct;
      return `<div class="topic" style="border-left:4px solid ${chosen===null?'var(--gold)':ok?'var(--green)':'var(--red)'};display:block"><div style="margin-bottom:8px"><b>Questão ${i+1} · ${escText(learningCategory(item.subject))}</b> <span class="tag">${chosen===null?'␣ Em branco':ok?'✓ Acertou':'✗ Errou'}</span></div><div class="small" style="margin:6px 0 10px">${escText(item.statement)}</div>${formatStepByStepResolution(item,chosen,ok,false)}</div>`;
    }).join('');

    const liquidSummary=scoringMode==='liquid'
      ? `<p class="small" style="margin:6px 0 0;color:var(--cyan)"><b>Pontuação Líquida Caveira/Cebraspe:</b> ${liquidPoints} pts líquidos (${liquidRate}%) · ${totalCorrect} certas − ${totalWrong} erradas · ${totalBlank} em branco.</p>`
      : '';

    q('#simuladoStage').hidden=true;
    const resultStage=q('#simuladoResultStage');
    resultStage.hidden=false;
    resultStage.innerHTML=`<div class="card"><div class="sectionHead"><div><div class="eyebrow">RESULTADO DO SIMULADO</div><h2>Você acertou ${totalCorrect} de ${questions.length} (${rawRate}% bruto)</h2>${liquidSummary}<p class="small muted" style="margin:4px 0 0">Tempo utilizado: ${elapsedMinutes} min · Os erros foram enviados automaticamente ao seu Caderno de Erros.</p></div><span class="tag">${displayRate>=70?'Caveira Aprovado (≥70%)':'Abaixo do corte — revisar'}</span></div><div class="performanceChart" style="margin-top:12px">${subjectRows}</div></div><div class="card"><div class="sectionHead"><h3>Gabarito comentado passo a passo</h3><button class="action" id="closeFinishedSimulado" type="button" style="width:auto;padding:10px 18px">Concluir e fechar</button></div><div class="list">${reviewItems}</div></div>`;
    q('#closeFinishedSimulado').onclick=()=>{
      activeSimulado=null;
      q('#simuladoDialog')?.close();
    };
    toast(`Simulado concluído: ${totalCorrect}/${questions.length} (${rawRate}%)`);
  }


  // 5. Termômetro de Nota de Corte Policial (#cutoffThermometerPanel)
  function ensureCutoffThermometer(){
    const perfGrid=q('#report #performanceSummary');
    if(!perfGrid||q('#cutoffThermometerPanel'))return;
    perfGrid.insertAdjacentHTML('afterend',`<div class="card cutoffThermometerCard" id="cutoffThermometerPanel"><div class="sectionHead"><div><div class="eyebrow">SIMULADOR DE APROVAÇÃO · META DE CORTE</div><h2 id="cutoffStatusTitle" style="margin:3px 0 0">Termômetro de Nota de Corte</h2></div><span class="tag" id="cutoffTierBadge">Em aferição</span></div><div class="cutoffTrackWrap"><div class="cutoffBar"><div class="cutoffFill" id="cutoffFillBar" style="width:0%"></div><span class="cutoffMarker" style="left:60%" title="60% — Habilitação mínima"><i>60%</i></span><span class="cutoffMarker" style="left:72%" title="72% — Corte médio PMPE / Carreiras Policiais"><i>72% Vagas</i></span><span class="cutoffMarker" style="left:80%" title="80% — Zona Caveira / Primeiros Colocados"><i>80% Elite</i></span></div></div><p class="small muted" id="cutoffAdviceText" style="margin:14px 0 0"></p></div>`);
  }

  function renderCutoffThermometer(){
    ensureCutoffThermometer();
    const fillEl=q('#cutoffFillBar'),titleEl=q('#cutoffStatusTitle'),badgeEl=q('#cutoffTierBadge'),adviceEl=q('#cutoffAdviceText');
    if(!fillEl)return;
    const scores=(state?.scores||[]).filter(s=>!s.campaignId||s.campaignId===state.activeCampaignId);
    const total=scores.reduce((n,s)=>n+Number(s.total||0),0);
    const correct=scores.reduce((n,s)=>n+Number(s.correct||0),0);
    if(total<5){
      fillEl.style.width='0%';
      badgeEl.textContent='Resolva 5+ questões';
      titleEl.textContent='Resolva sua primeira bateria para medir sua faixa de corte';
      adviceEl.textContent='As faixas de referência são: 60% (Habilitação), 72% (Zona de Vagas — padrão PMPE/Polícias) e 80%+ (Elite Caveira).';
      return;
    }
    const rate=Math.round(correct/total*100);
    fillEl.style.width=`${Math.min(100,rate)}%`;
    if(rate>=80){
      badgeEl.textContent='🏆 Faixa Elite (≥80%)';
      titleEl.textContent=`Precisão global: ${rate}% (${correct}/${total}) — Acima do corte de elite!`;
      adviceEl.textContent='Você está na faixa competitiva dos primeiros colocados. Mantenha o ritmo com simulados na regra líquida e revisão espaçada.';
    }else if(rate>=72){
      const neededFor80=Math.max(1,Math.ceil((0.80*total-correct)/0.20));
      badgeEl.textContent='✓ Zona de Vagas (≥72%)';
      titleEl.textContent=`Precisão global: ${rate}% (${correct}/${total}) — Dentro da nota de corte!`;
      adviceEl.textContent=`Você já superou o corte médio de 72%. Acertando mais ${neededFor80} questão(ões) seguida(s), você entra na faixa Elite (80%+).`;
    }else if(rate>=60){
      const neededFor72=Math.max(1,Math.ceil((0.72*total-correct)/0.28));
      badgeEl.textContent='⚡ Habilitado (60–71%)';
      titleEl.textContent=`Precisão global: ${rate}% (${correct}/${total}) — Rumo à zona de vagas`;
      adviceEl.textContent=`Faltam cerca de ${neededFor72} acerto(s) seguido(s) para atingir a linha de corte competitiva de 72%. Priorize as matérias do Reforço Prioritário abaixo.`;
    }else{
      const neededFor60=Math.max(1,Math.ceil((0.60*total-correct)/0.40));
      badgeEl.textContent='🎯 Base em construção';
      titleEl.textContent=`Precisão global: ${rate}% (${correct}/${total}) — Fortalecendo a base`;
      adviceEl.textContent=`Use o modo Desafio Progressivo e leia as resoluções passo a passo. Mais ${neededFor60} acerto(s) levam você ao primeiro marco de 60%.`;
    }
  }

  // 6. Exportação de Caderno de Questões para Impressão / PDF (com Folha de Respostas e Gabarito Comentado)
  function exportPrintableQuestionBooklet(){
    const pool=filteredQuestionPool();
    if(!pool.length)return toast('Não há questões disponíveis neste filtro para imprimir.');
    const selected=pool.slice(0,30);
    const campaignName=activeCampaign()?.name||'Jornada do Caçador';
    const subjectLabel=q('#questionSubject')?.value==='all'?'Todas as Disciplinas':(q('#questionSubject')?.value||'Geral');
    const w=window.open('','_blank');
    if(!w)return toast('Permita a abertura de pop-up para gerar o PDF de impressão.');
    const questionsHtml=selected.map((item,idx)=>{
      const diff={facil:'Fácil',medio:'Média',dificil:'Difícil'}[normalizedDifficulty(item)]||'Média';
      const opts=(item.options||[]).map((o,i)=>`<div class="opt"><b>(${String.fromCharCode(65+i)})</b> ${escText(o)}</div>`).join('');
      return `<article class="qItem"><div class="qHead"><b>QUESTÃO ${String(idx+1).padStart(2,'0')}</b><span>${escText(learningCategory(item.subject))} · ${escText(item.topic||'Geral')} · ${diff}</span></div><p class="qStmt">${escText(item.statement)}</p><div class="qOpts">${opts}</div></article>`;
    }).join('');
    const answerKeyHtml=selected.map((item,idx)=>{
      const letter=String.fromCharCode(65+(Number(item.correct_index)||0));
      return `<div class="ansItem"><b>${String(idx+1).padStart(2,'0')}: ${letter}</b> — <span>${escText(item.explanation||item.options?.[item.correct_index]||'')}</span></div>`;
    }).join('');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Caderno de Questões — ${escText(campaignName)}</title><style>body{font:13.5px/1.5 Inter,Arial,sans-serif;color:#111d2c;max-width:840px;margin:28px auto;padding:0 16px}header{border-bottom:2px solid #0f2942;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}h1{font-size:1.25rem;margin:0}.meta{font-size:.8rem;color:#4a6075}.qItem{break-inside:avoid;border:1px solid #d4e0ec;border-radius:8px;padding:12px 14px;margin-bottom:12px}.qHead{display:flex;justify-content:space-between;font-size:.78rem;color:#1d4f7a;border-bottom:1px solid #e6eef5;padding-bottom:5px;margin-bottom:8px}.qStmt{margin:0 0 9px;font-weight:600}.qOpts{display:grid;gap:5px}.opt{font-size:.92rem}.pageBreak{page-break-before:always;margin-top:32px;padding-top:16px;border-top:2px solid #0f2942}.ansItem{margin-bottom:8px;font-size:.86rem;break-inside:avoid}@media print{body{margin:12mm;max-width:none}.noPrint{display:none}}</style></head><body><div class="noPrint" style="margin-bottom:16px;padding:10px;background:#eef6fc;border-radius:8px;display:flex;justify-content:space-between;align-items:center"><span><b>Pronto para impressão ou Salvar como PDF</b> (${selected.length} questões + gabarito comentado)</span><button onclick="window.print()" style="padding:8px 16px;font-weight:bold;cursor:pointer">🖨️ Imprimir / Salvar PDF</button></div><header><div><h1>${escText(campaignName)} — Caderno de Prova</h1><div class="meta">Filtro: ${escText(subjectLabel)} · ${selected.length} questões</div></div><div class="meta">Data: ${new Date().toLocaleDateString('pt-BR')}</div></header>${questionsHtml}<section class="pageBreak"><h2>Gabarito Oficial e Resolução Passo a Passo</h2>${answerKeyHtml}</section></body></html>`);
    w.document.close();
  }

  // 7. Modo "Lei Seca Grifada" (Destaque automático de Artigos, Prazos, Penas e Exceções nos Resumos)
  let legalHighlightEnabled=localStorage.getItem('jornada-legal-hl')!=='0';

  function applyLegalHighlightsToTextNodes(rootEl){
    if(!rootEl||!legalHighlightEnabled)return;
    const targets=rootEl.querySelectorAll('.lessonIntro, .lessonBox li, .lessonBox');
    const lawRegex=/((?:Art\.?\s*\d+[º°ª]?|§\s*\d+[º°ª]?|parágrafo único|Lei\s+(?:Complementar\s+|Federal\s+|Estadual\s+)?n?[º°]?\s*[\d.\/-]+|CF\/88|Súmula\s+(?:Vinculante\s+)?\d+|STF|STJ))/gi;
    const exceptionRegex=/((?:salvo|exceto|vedad[oa]s?|proibid[oa]s?|inafiançáve(?:l|is)|imprescritíve(?:l|is)|insuscetíveis|insuscetível|nunca|jamais|somente|exclusivamente|independe(?:m|ntemente)?))/gi;
    const penaltyRegex=/((?:reclusão|detenção|multa|\d+\s*(?:dias?|meses|anos?|horas?)|maioria\s+absoluta|unânime))/gi;

    targets.forEach(el=>{
      if(el.dataset.hlApplied==='1')return;
      el.dataset.hlApplied='1';
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null);
      const nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        const val=node.nodeValue||'';
        if(val.length<4)continue;
        if(!lawRegex.test(val)&&!exceptionRegex.test(val)&&!penaltyRegex.test(val))continue;
        lawRegex.lastIndex=0;exceptionRegex.lastIndex=0;penaltyRegex.lastIndex=0;
        const escaped=escText(val)
          .replace(lawRegex,'<mark class="hlLaw">$1</mark>')
          .replace(exceptionRegex,'<mark class="hlException">$1</mark>')
          .replace(penaltyRegex,'<mark class="hlPenalty">$1</mark>');
        const span=document.createElement('span');
        span.innerHTML=escaped;
        node.parentNode?.replaceChild(span,node);
      }
    });
  }

  function ensureLegalHighlightToggle(){
    const filters=q('#summaries .summaryFilters');
    if(!filters||q('#toggleLegalHighlightBtn'))return;
    filters.insertAdjacentHTML('beforeend',`<button type="button" class="ghost small" id="toggleLegalHighlightBtn" style="white-space:nowrap">${legalHighlightEnabled?'🖍️ Grifo Lei Seca: ON':'🖍️ Grifo Lei Seca: OFF'}</button>`);
    q('#toggleLegalHighlightBtn').onclick=()=>{
      legalHighlightEnabled=!legalHighlightEnabled;
      localStorage.setItem('jornada-legal-hl',legalHighlightEnabled?'1':'0');
      q('#toggleLegalHighlightBtn').textContent=legalHighlightEnabled?'🖍️ Grifo Lei Seca: ON':'🖍️ Grifo Lei Seca: OFF';
      if(typeof renderSummaries==='function')renderSummaries(q('#summarySearch')?.value||'');
      if(legalHighlightEnabled)setTimeout(()=>applyLegalHighlightsToTextNodes(q('#summaryList')),30);
      toast(legalHighlightEnabled?'Grifo tático de artigos, prazos e exceções ativado!':'Grifo tático desativado.');
    };
  }


  // 8. Repetição Espaçada SM-2 nos Flashcards (Estilo Anki / Caveira) + Atalhos 1/2/3
  function enhanceFlashcardsSpacedRepetition(){
    const cardsPanel=q('#cards');
    if(!cardsPanel||q('#flashcardSpacedBar'))return;
    const head=cardsPanel.querySelector('.sectionHead');
    if(head){
      head.insertAdjacentHTML('afterend',`<div class="flashSpacedBar" id="flashcardSpacedBar"><span class="small muted" id="flashSpacedStats">Repetição espaçada ativa (1=Difícil · 2=Rever · 3=Fácil · Espaço=Virar)</span><label class="small" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flashDueOnlyToggle"> Apenas pendentes/difíceis</label></div>`);
      q('#flashDueOnlyToggle').onchange=()=>{if(typeof renderCard==='function')renderCard();updateFlashcardSpacedStats()};
    }
    document.addEventListener('flashcards:graded',updateFlashcardSpacedStats);
    document.addEventListener('keydown',e=>{
      if(!q('#study')?.classList.contains('active')||!q('#cards')?.classList.contains('active'))return;
      if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||''))return;
      if(e.key==='1'){e.preventDefault();window.gradeCard?.('hard')}
      else if(e.key==='2'){e.preventDefault();window.gradeCard?.('medium')}
      else if(e.key==='3'){e.preventDefault();window.gradeCard?.('easy')}
    });
    updateFlashcardSpacedStats();
  }

  function updateFlashcardSpacedStats(){
    const statsEl=q('#flashSpacedStats');
    if(!statsEl)return;
    const now=Date.now(),cards=(ALL_FLASHCARDS||[]).map((c,i)=>({c,i,key:fcKey(c)}));
    let due=0,hard=0,mastered=0;
    for(const x of cards){const p=fcProgress(x);if(fcDue(p,now))due++;if(p?.level==='hard')hard++;if(p&&Number(p.streak||0)>=3)mastered++}
    statsEl.textContent=`Total: ${cards.length} cartões · ${due} para revisar agora · ${hard} difíceis · ${mastered} dominados (Atalhos: 1, 2, 3)`;
  }

  // 9. Gerador de Temas Policiais com Textos de Apoio (Texto I e II) + IA + Folha de Redação 30 Linhas (#essay)
  const POLICE_ESSAY_THEMES=[
    {
      title:'Redação PMPE — Segurança e Direitos Humanos',
      theme:'O equilíbrio entre o uso progressivo da força policial e a garantia dos direitos fundamentais na segurança pública brasileira',
      board:'AOCP',
      text1:'A Constituição Federal de 1988, em seu artigo 144, estabelece que a segurança pública é dever do Estado, direito e responsabilidade de todos, sendo exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio. Nesse cenário, a atuação das polícias militares exige preparo técnico contínuo para conter condutas ilícitas sem violar garantias individuais previstas no artigo 5º do texto constitucional.',
      source1:'Fonte adaptada: Constituição da República Federativa do Brasil de 1988 (arts. 5º e 144).',
      text2:'A Lei nº 13.060/2014 disciplina o uso dos instrumentos de menor potencial ofensivo pelos agentes de segurança pública em todo o território nacional, determinando que o emprego da força deve obedecer aos princípios da legalidade, necessidade, razoabilidade e proporcionalidade. Segundo diretrizes da SENASP, a qualificação operacional reduz a letalidade e fortalece a legitimidade jurídica das abordagens policiais perante o Poder Judiciário e a sociedade.',
      source2:'Fonte adaptada: Brasil, Lei Federal nº 13.060/2014 e Diretrizes Nacionais sobre Uso da Força (SENASP/MJSP).',
      command:'A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija um texto dissertativo-argumentativo, de 20 a 30 linhas, sobre o tema proposto. Ao desenvolver seu texto, aborde necessariamente:\n1) o papel constitucional das forças policiais na preservação da ordem pública e da dignidade humana;\n2) a importância dos princípios da necessidade e proporcionalidade (Lei nº 13.060/2014) na atuação ostensiva;\n3) medidas práticas de capacitação e fiscalização para aprimorar a atuação policial.'
    },
    {
      title:'Redação Policial — Tecnologia e Combate ao Crime',
      theme:'O papel da inteligência policial, câmeras corporais e tecnologia no enfrentamento à criminalidade violenta',
      board:'Cebraspe',
      text1:'O avanço das organizações criminosas e a interiorização dos delitos patrimoniais e letais impuseram às forças estaduais de segurança a transição do policiamento meramente reativo para o policiamento orientado pela inteligência. Ferramentas como mapeamento criminal georreferenciado, reconhecimento óptico de placas e integração de bancos de dados permitem alocar viaturas e efetivo nos horários e manchas criminais de maior risco.',
      source1:'Fonte adaptada: Fórum Brasileiro de Segurança Pública (FBSP) — Estudos sobre Gestão e Tecnologia Policial.',
      text2:'Paralelamente ao uso de sistemas analíticos, a implementação de câmeras corporais (bodycams) no fardamento policial consolidou-se como instrumento de transparência e produção de provas. Estudos indicam que o registro audiovisual protege o bom policial contra falsas acusações, qualifica o flagrante delito enviado ao Ministério Público e diminui episódios de confronto desnecessário.',
      source2:'Fonte adaptada: Diretrizes do Ministério da Justiça e Segurança Pública sobre Câmeras Corporais (2024).',
      command:'Considerando que os textos acima têm caráter unicamente motivador, redija um texto dissertativo acerca do tema proposto. Em seu texto, aborde obrigatoriamente os seguintes aspectos:\n1) o impacto da inteligência policial e do policiamento orientado por dados na prevenção de crimes violentos;\n2) os benefícios das câmeras corporais para a cadeia de custódia da prova e para a proteção jurídica do agente;\n3) desafios orçamentários e operacionais para modernizar as polícias estaduais.'
    },
    {
      title:'Redação Segurança Pública — Violência Doméstica',
      theme:'Desafios das forças de segurança na proteção de grupos vulneráveis e no cumprimento efetivo da Lei Maria da Penha',
      board:'AOCP',
      text1:'Promulgada em 2006, a Lei nº 11.340 (Lei Maria da Penha) criou mecanismos para coibir e prevenir a violência doméstica e familiar contra a mulher, reconhecendo-a como uma forma de violação dos direitos humanos. O atendimento policial imediato e o acompanhamento do cumprimento das medidas protetivas de urgência, por meio de patrulhas especializadas, figuram entre os principais fatores de redução do feminicídio.',
      source1:'Fonte adaptada: Lei Federal nº 11.340/2006 e Relatórios do Instituto de Pesquisa Econômica Aplicada (IPEA).',
      text2:'Apesar dos avanços legislativos — incluindo a tipificação do crime de descumprimento de medida protetiva (art. 24-A) e a possibilidade de concessão de medidas urgentes em municípios sem sede de comarca —, a subnotificação, a dependência econômica e a necessidade de acolhimento humanizado nas ocorrências ainda desafiam o policiamento ostensivo e judiciário.',
      source2:'Fonte adaptada: Conselho Nacional de Justiça (CNJ) — Protocolo para Julgamento e Atendimento com Perspectiva de Gênero.',
      command:'Com base nos textos de apoio e em seu repertório sociocultural e jurídico, redija um texto dissertativo-argumentativo sobre o tema. Aborde necessariamente:\n1) a relevância das patrulhas especializadas no monitoramento das medidas protetivas de urgência;\n2) os entraves sociais e institucionais que dificultam o rompimento do ciclo da violência doméstica;\n3) ações integradas entre polícia ostensiva, rede de assistência e Justiça para prevenir o feminicídio.'
    },
    {
      title:'Redação Policial — Polícia Comunitária',
      theme:'A importância do policiamento comunitário e da confiança social para a prevenção primária da violência urbana',
      board:'FGV',
      text1:'A filosofia de Polícia Comunitária baseia-se na premissa de que a segurança pública não se resume à repressão pós-delito, mas requer parceria permanente entre os agentes estatais e os moradores de cada território. Quando a comunidade confia na guarnição local, há maior compartilhamento de informações preventivas, recuperação de espaços públicos degradados e redução da sensação de medo.',
      source1:'Fonte adaptada: Curso Nacional de Polícia Comunitária — Secretaria Nacional de Segurança Pública (SENASP).',
      text2:'Em contrapartida, a ausência de diálogo entre instituições policiais e populações periféricas costuma ser explorada por grupos criminosos para impor a chamada "lei do silêncio". Superar esse distanciamento demanda presença territorial contínua, respeito ao cidadão durante a abordagem e articulação com escolas, conselhos comunitários de segurança e serviços municipais.',
      source2:'Fonte adaptada: Estudos contemporâneos de Sociologia da Violência e Prevenção Criminal.',
      command:'A partir da análise dos textos motivadores, elabore uma dissertação argumentativa sobre o tema proposto, contemplando:\n1) a diferença entre o policiamento estritamente reativo e a filosofia de polícia comunitária;\n2) o papel da confiança mútua entre cidadão e policial no enfraquecimento do controle territorial do crime;\n3) propostas concretas para aproximar as forças de segurança da sociedade civil.'
    },
    {
      title:'Redação Segurança — Sistema Prisional e Reincidência',
      theme:'Caminhos para reduzir a reincidência criminal e combater a atuação de organizações criminosas no Brasil',
      board:'Cebraspe',
      text1:'A Lei de Execução Penal (Lei nº 7.210/1984) dispõe que a execução penal tem por objetivo efetivar as disposições de sentença ou decisão criminal e proporcionar condições para a harmônica integração social do condenado. Todavia, a superlotação carcerária e o déficit de vagas de estudo e trabalho intramuros dificultam a ressocialização e favorecem o recrutamento de detentos por facções.',
      source1:'Fonte adaptada: Lei nº 7.210/1984 (LEP) e Levantamento Nacional de Informações Penitenciárias (SENAPPEN).',
      text2:'O enfrentamento às organizações criminosas que operam a partir de unidades prisionais exige duplo movimento do Estado: de um lado, rigor no isolamento de lideranças, bloqueio de comunicações ilícitas e asfixia financeira da lavagem de dinheiro; de outro, cumprimento dos direitos básicos e oferta de educação e remição de pena aos apenados de menor potencial ofensivo.',
      source2:'Fonte adaptada: Conselho Nacional do Ministério Público (CNMP) — Diagnóstico do Sistema Prisional Brasileiro.',
      command:'Redija um texto dissertativo-argumentativo sobre o tema acima, abordando obrigatoriamente:\n1) as causas estruturais da elevada reincidência criminal no país;\n2) medidas de inteligência penitenciária e financeira para conter o comando de facções nos presídios;\n3) o papel do trabalho e da educação na execução penal conforme a Lei nº 7.210/1984.'
    },
    {
      title:'Redação Policial — Crimes Cibernéticos',
      theme:'A evolução dos crimes digitais e a necessidade de modernização investigativa e ostensiva das polícias estaduais',
      board:'FGV',
      text1:'A digitalização acelerada dos serviços bancários e das relações sociais no Brasil foi acompanhada pelo crescimento expressivo de estelionatos eletrônicos, invasão de dispositivos informáticos (Lei nº 14.155/2021), extorsões mediante sequestro de dados e golpes aplicados por meio de engenharia social e aplicativos de mensagens.',
      source1:'Fonte adaptada: Anuário Brasileiro de Segurança Pública — Evolução dos Estelionatos por Meio Eletrônico.',
      text2:'Diferentemente dos crimes patrimoniais tradicionais, os delitos cibernéticos frequentemente ultrapassam divisas estaduais em segundos e deixam vestígios voláteis. Isso exige que tanto o policial que realiza o primeiro atendimento quanto os núcleos especializados dominem protocolos de preservação da prova digital e atuem em cooperação interestadual.',
      source2:'Fonte adaptada: Manual de Investigação Cibernética e Cadeia de Custódia Digital (MJSP).',
      command:'Com base nos textos motivadores, escreva uma redação dissertativo-argumentativa posicionando-se sobre o tema. Aborde:\n1) os impactos sociais e econômicos da migração da criminalidade para o ambiente digital;\n2) a importância da preservação de vestígios digitais e da atualização legislativa (Lei nº 14.155/2021);\n3) estratégias de prevenção, educação digital da população e capacitação policial.'
    },
    {
      title:'Redação PMPE — Patrimônio Histórico e Grandes Eventos',
      theme:'Preservação da ordem pública, cultura regional e proteção do patrimônio histórico em grandes eventos populares',
      board:'AOCP',
      text1:'O Estado de Pernambuco abriga manifestações culturais e sítios históricos reconhecidos mundialmente, como o Carnaval de Olinda e do Recife, o São João do interior e conjuntos arquitetônicos tombados. O planejamento operacional da Polícia Militar nesses eventos demanda policiamento preventivo de grandes multidões aliado à proteção de bens culturais insubstituíveis.',
      source1:'Fonte adaptada: Diretrizes de Planejamento Operacional em Grandes Eventos e Proteção do Patrimônio Cultural (PMPE/IPHAN).',
      text2:'O artigo 216 da Constituição Federal define o patrimônio cultural brasileiro como os bens de natureza material e imaterial portadores de referência à identidade e à memória dos diferentes grupos formadores da sociedade. Vandalismo, furtos e tumultos em festas de grande porte exigem atuação integrada entre forças estaduais, guardas municipais, defesa civil e órgãos de cultura.',
      source2:'Fonte adaptada: Constituição Federal de 1988 (art. 216) e Lei nº 9.605/1998 (Crimes contra o Ordenamento Urbano e o Patrimônio Cultural).',
      command:'A partir dos textos motivadores, redija um texto dissertativo-argumentativo de 20 a 30 linhas sobre o tema proposto, contemplando:\n1) a relação entre segurança pública, direito ao lazer e valorização da identidade cultural regional;\n2) os desafios táticos do policiamento ostensivo em eventos de massa e sítios históricos;\n3) ações preventivas e tecnológicas para coibir delitos sem comprometer as manifestações populares.'
    },
    {
      title:'Redação Segurança Pública — Saúde Mental do Policial',
      theme:'A valorização profissional e o cuidado com a saúde física e mental dos agentes de segurança pública',
      board:'AOCP',
      text1:'O exercício da atividade policial expõe o servidor a níveis elevados de estresse ocupacional, risco iminente à vida, turnos noturnos e contato diário com situações traumáticas. Pesquisas na área de saúde do trabalhador apontam que a ausência de acompanhamento psicológico periódico impacta não apenas o bem-estar familiar do agente, mas também sua tomada de decisão sob pressão nas ruas.',
      source1:'Fonte adaptada: Programa Pró-Vida — Programa Nacional de Qualidade de Vida para Profissionais de Segurança Pública (Lei nº 13.675/2018).',
      text2:'Instituído pelo Sistema Único de Segurança Pública (SUSP), o programa de atenção biopsicossocial aos operadores de segurança reconhece que a eficiência do policiamento depende diretamente da saúde integral do efetivo. Superar o estigma interno na busca por apoio psiquiátrico e psicológico é considerado passo decisivo pelas corporações modernas.',
      source2:'Fonte adaptada: Lei Federal nº 13.675/2018 (SUSP) e Cadernos Técnicos de Saúde Mental Policial.',
      command:'A partir dos textos de apoio, elabore um texto dissertativo-argumentativo sobre o tema. Aborde obrigatoriamente:\n1) os principais fatores de desgaste físico e emocional inerentes à carreira policial;\n2) a relação direta entre a saúde mental do agente e a qualidade do serviço prestado ao cidadão;\n3) políticas institucionais efetivas de prevenção, acolhimento e valorização nos órgãos de segurança.'
    }
  ];

  let lastPickedEssayIndex=-1;

  function formatProposalInstructions(pick){
    const parts=[];
    if(pick.text1)parts.push(`TEXTO MOTIVADOR I:\n${pick.text1}${pick.source1?`\n(${pick.source1})`:''}`);
    if(pick.text2)parts.push(`TEXTO MOTIVADOR II:\n${pick.text2}${pick.source2?`\n(${pick.source2})`:''}`);
    if(pick.command)parts.push(`PROPOSTA E CRITÉRIOS DA BANCA:\n${pick.command}`);
    return parts.join('\n\n').slice(0,3000);
  }

  function renderEssayMotivatingBox(pick){
    let box=q('#essayMotivatingBox');
    const helperBar=q('#essayHelperBar');
    if(!helperBar)return;
    if(!box){
      helperBar.insertAdjacentHTML('afterend','<div class="essayMotivatingCard" id="essayMotivatingBox" hidden></div>');
      box=q('#essayMotivatingBox');
    }
    if(!pick||(!pick.text1&&!pick.text2&&!pick.command)){
      box.hidden=true;
      box.innerHTML='';
      return;
    }
    box.hidden=false;
    box.innerHTML=`
      <div class="essayMotivatingHead">
        <div>
          <span class="eyebrow">CADERNO DE PROPOSTA ESTILO PROVA · ${escText((pick.board||'PADRÃO OFICIAL').toUpperCase())}</span>
          <h3 style="margin:2px 0 0;font-size:1rem">${escText(pick.theme||'Tema da Redação')}</h3>
        </div>
        <span class="tag">${escText(pick.originLabel||'Textos Motivadores I e II')}</span>
      </div>
      ${pick.text1?`<div class="essaySupportBox"><b>Texto Motivador I</b><div>${escText(pick.text1)}</div>${pick.source1?`<span class="essaySupportSource">${escText(pick.source1)}</span>`:''}</div>`:''}
      ${pick.text2?`<div class="essaySupportBox"><b>Texto Motivador II</b><div>${escText(pick.text2)}</div>${pick.source2?`<span class="essaySupportSource">${escText(pick.source2)}</span>`:''}</div>`:''}
      ${pick.command?`<div class="essayCommandBox"><b style="color:var(--gold);display:block;font-size:.76rem;text-transform:uppercase;margin-bottom:4px">Proposta de Redação / Aspectos Obrigatórios</b>${escText(pick.command)}</div>`:''}
    `;
  }

  function applyEssayProposal(pick, originLabel='Banco de Provas'){
    if(!pick)return;
    if(q('#essayTitle'))q('#essayTitle').value=pick.title||'Redação Simulada';
    if(q('#essayTheme'))q('#essayTheme').value=pick.theme||'';
    if(q('#essayBoard')&&pick.board){
      const hasOpt=[...q('#essayBoard').options].some(o=>o.value===pick.board);
      if(hasOpt)q('#essayBoard').value=pick.board;
    }
    if(q('#essayLines')&&!q('#essayLines').value)q('#essayLines').value='30';
    const fullInstructions=formatProposalInstructions(pick);
    if(q('#essayInstructions')&&fullInstructions)q('#essayInstructions').value=fullInstructions;
    renderEssayMotivatingBox({...pick,originLabel});
  }

  async function generateAiEssayProposal(){
    const btn=q('#generateAiEssayThemeBtn');
    const board=q('#essayBoard')?.value||'AOCP';
    const campaignName=(typeof activeCampaign==='function'?activeCampaign()?.name:'Concurso Policial')||'Concurso Policial';
    const missions=(typeof missionPool==='function'?missionPool():[]).filter(m=>!String(m.id).startsWith('setup-'));
    const subjects=[...new Set(missions.map(m=>m.subject).filter(Boolean))].slice(0,8).join(', ')||'Direito Constitucional, Direitos Humanos, Legislação Penal e Segurança Pública';
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando proposta + textos de apoio...'}
    try{
      const session=typeof validSession==='function'?await validSession().catch(()=>null):null;
      if(!session)throw new Error('OFFLINE_OR_NO_SESSION');
      const prompt=`Crie uma proposta completa de prova discursiva/redação inédita no estilo da banca ${board} voltada para o concurso "${campaignName}" (disciplinas do edital: ${subjects}).\nResponda EXCLUSIVAMENTE em JSON válido com as chaves:\n{\n  "title": "Título curto da proposta",\n  "theme": "Frase-tema oficial da redação",\n  "board": "${board}",\n  "text1": "Texto motivador I completo (4 a 6 frases densas com dados estatísticos, contexto social ou doutrina sobre o tema)",\n  "source1": "Fonte adaptada do Texto I",\n  "text2": "Texto motivador II completo (4 a 6 frases com base na Constituição Federal, legislação específica ou caso concreto complementar ao Texto I)",\n  "source2": "Fonte adaptada do Texto II",\n  "command": "Comando da proposta exigindo texto de 20 a 30 linhas e listando 3 itens obrigatórios (1, 2 e 3) que o candidato deve abordar."\n}`;
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:authHeaders(session.access_token),
        body:JSON.stringify({
          question:prompt,
          context:`Portal: ${campaignName}. Disciplinas: ${subjects}. Banca: ${board}.`,
          mode:'gerador de proposta de redacao com textos motivadores',
          campaign_id:typeof activeCampaign==='function'?activeCampaign()?.dbId:null,
          campaign:campaignName
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data?.answer)throw new Error(data?.error||'IA_UNAVAILABLE');
      const raw=String(data.answer).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');
      const s=raw.indexOf('{'),e=raw.lastIndexOf('}');
      if(s<0||e<=s)throw new Error('INVALID_JSON');
      const parsed=JSON.parse(raw.slice(s,e+1));
      if(!parsed.theme||!parsed.text1||!parsed.text2)throw new Error('INCOMPLETE_PROPOSAL');
      applyEssayProposal({
        title:String(parsed.title||`Redação ${campaignName}`),
        theme:String(parsed.theme),
        board:String(parsed.board||board),
        text1:String(parsed.text1),
        source1:String(parsed.source1||'Fonte adaptada: Coletânea da Banca Examinadora.'),
        text2:String(parsed.text2),
        source2:String(parsed.source2||'Fonte adaptada: Legislação e Jurisprudência Aplicada.'),
        command:String(parsed.command||'Redija um texto dissertativo-argumentativo de 20 a 30 linhas abordando: 1) contextualização do problema; 2) fundamentos constitucionais e legais; 3) propostas de enfrentamento.')
      },'Gerado por IA para o seu Edital');
      toast('Proposta inédita com Textos Motivadores I e II criada pela IA!');
    }catch{
      let idx=Math.floor(Math.random()*POLICE_ESSAY_THEMES.length);
      if(idx===lastPickedEssayIndex&&POLICE_ESSAY_THEMES.length>1)idx=(idx+1)%POLICE_ESSAY_THEMES.length;
      lastPickedEssayIndex=idx;
      applyEssayProposal(POLICE_ESSAY_THEMES[idx],'Proposta Oficial com Textos I e II');
      toast('Tema com Textos Motivadores I e II carregado!');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='✨ Criar Tema + Textos de Apoio (IA)'}
    }
  }

  function enhanceEssayCenter(){
    const essayCard=q('#essay .card');
    if(!essayCard||q('#essayHelperBar'))return;
    essayCard.insertAdjacentHTML('afterbegin',`<div class="essayHelperBar" id="essayHelperBar"><button type="button" class="ghost small" id="suggestEssayThemeBtn">🎲 Sortear Tema + Textos de Apoio (Prova)</button><button type="button" class="ghost small" id="generateAiEssayThemeBtn">✨ Criar Tema + Textos de Apoio (IA)</button><button type="button" class="ghost small" id="printBlankEssaySheetBtn">🖨️ Imprimir Folha Oficial de 30 Linhas</button></div>`);
    q('#suggestEssayThemeBtn').onclick=()=>{
      let idx=Math.floor(Math.random()*POLICE_ESSAY_THEMES.length);
      if(idx===lastPickedEssayIndex&&POLICE_ESSAY_THEMES.length>1)idx=(idx+1)%POLICE_ESSAY_THEMES.length;
      lastPickedEssayIndex=idx;
      const pick=POLICE_ESSAY_THEMES[idx];
      applyEssayProposal(pick,'Banco de Provas (Textos I e II)');
      toast('Tema, Texto Motivador I, Texto Motivador II e Comando preenchidos!');
    };
    q('#generateAiEssayThemeBtn').onclick=generateAiEssayProposal;
    q('#printBlankEssaySheetBtn').onclick=()=>{
      const theme=q('#essayTheme')?.value?.trim()||'Tema livre / Defina o tema antes de iniciar a escrita';
      const board=q('#essayBoard')?.value||'Padrão Oficial';
      const instructions=q('#essayInstructions')?.value?.trim()||'';
      const maxLines=Math.min(60,Math.max(15,Number(q('#essayLines')?.value)||30));
      const w=window.open('','_blank');
      if(!w)return toast('Permita pop-ups para abrir a folha pautada de 30 linhas.');
      const linesHtml=Array.from({length:maxLines},(_,i)=>`<div class="rLine"><span>${String(i+1).padStart(2,'0')}</span><i></i></div>`).join('');
      const supportHtml=instructions?`<div class="support">${escText(instructions).replace(/\n/g,'<br>')}</div>`:'';
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Folha de Redação (${maxLines} linhas)</title><style>body{font:13px/1.45 Inter,Arial,sans-serif;color:#111d2c;max-width:780px;margin:20px auto;padding:0 16px}header{border:2px solid #10253a;border-radius:8px;padding:12px 14px;margin-bottom:14px}h1{font-size:1.05rem;margin:0 0 6px}.theme{font-size:.9rem;background:#f4f8fb;padding:8px 10px;border-left:4px solid #1768ac;margin-top:6px}.support{font-size:.82rem;line-height:1.45;background:#f9fbfd;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;margin-top:8px}.rLine{display:grid;grid-template-columns:28px 1fr;align-items:end;height:26px}.rLine span{font-size:.75rem;color:#5a7186;font-weight:700;padding-bottom:2px}.rLine i{display:block;border-bottom:1px solid #8ea4b8;height:100%}@media print{body{margin:10mm;max-width:none}.noPrint{display:none}}</style></head><body><div class="noPrint" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;background:#eef6fc;padding:10px;border-radius:8px"><span><b>Caderno de Proposta + Folha de Redação (${maxLines} linhas)</b> — imprima, escreva à mão e envie foto/PDF para correção na IA</span><button onclick="window.print()" style="padding:8px 14px;font-weight:bold;cursor:pointer">🖨️ Imprimir Folha</button></div><header><h1>FOLHA DE TEXTO DEFINITIVO · BANCA: ${escText(board.toUpperCase())}</h1><div style="font-size:.78rem;color:#4a6075">Leia atentamente os textos motivadores, respeite as margens, escreva com caneta esferográfica preta ou azul e observe o limite de ${maxLines} linhas.</div><div class="theme"><b>PROPOSTA / TEMA:</b> ${escText(theme)}</div>${supportHtml}</header><div>${linesHtml}</div></body></html>`);
      w.document.close();
    };
  }

  // 10. Alerta sonoro suave (Web Audio API) ao concluir Bloco de Foco
  function playCompletionChime(){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      const ctx=new Ctx();
      [523.25,659.25,783.99].forEach((freq,idx)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine';osc.frequency.value=freq;
        gain.gain.setValueAtTime(0.08,ctx.currentTime+idx*0.14);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+idx*0.14+0.35);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(ctx.currentTime+idx*0.14);osc.stop(ctx.currentTime+idx*0.14+0.36);
      });
    }catch{}
  }

  function bindQuestionCenter(){
    ensureTopicFilterSelect();
    ensureSimuladoUI();
    ensureTacticalDiagnosisPanel();
    ensureExamBankHub();
    q('#questionSubject')?.addEventListener('change',()=>{populateTopicFilter();updateQuestionPool()});
    for(const selector of ['#questionDifficulty','#questionOrigin','#questionBattleMode','#questionHistoryFilter'])q(selector)?.addEventListener('change',updateQuestionPool);
    if(q('#startQuestions'))q('#startQuestions').onclick=startFilteredBattle;
    populateTopicFilter();
    updateQuestionPool();
    renderPerformanceChart();
    renderExamBankHub();
  }

  const baseRenderQuestionFilters=typeof renderQuestionFilters==='function'?renderQuestionFilters:null;
  if(baseRenderQuestionFilters){
    renderQuestionFilters=function(){
      baseRenderQuestionFilters();
      populateTopicFilter();
      updateQuestionPool();
      renderExamBankHub();
    };
  }


  // 11. Painel TAF Policial (inspirado no Forma Fit: Barra/Isometria, Corrida 2.400m, Natação 50m, Salto e Abdominal) + Ranking Geral de Caçadores
  const TAF_PRESETS={
    pmpe_m:{
      label:'PMPE / Polícias Militares — Masculino',
      tests:{
        bar:{type:'bar',mode:'reps',name:'Barra Fixa (Pronada)',min_reps:5,min_sec:20,unit:'repetições',rules:'Pegada pronada, queixo ultrapassando a barra e extensão total dos cotovelos.'},
        abs:{type:'abs',name:'Abdominal Remador (1 min)',min_reps:36,time_limit_s:60,unit:'repetições',rules:'Execução contínua em 60 segundos no padrão remador.'},
        jump:{type:'jump',name:'Impulsão Horizontal (Salto)',distance_m:1.80,unit:'metros',rules:'Salto parado sem corrida de aproximação, medido pelo calcanhar mais próximo.'},
        swim:{type:'swim',name:'Natação 50m Livre',distance_m:50,time_limit_s:60,unit:'segundos',rules:'50 metros nado livre sem apoiar nas bordas, raias ou fundo da piscina.'},
        run:{type:'run',name:'Corrida de 2.400m (Cooper)',distance_m:2400,time_limit_s:720,unit:'metros',rules:'Percorrer 2.400 metros no tempo máximo de 12min00s (720s).'}
      }
    },
    pmpe_f:{
      label:'PMPE / Polícias Militares — Feminino',
      tests:{
        bar:{type:'bar',mode:'isometry',name:'Isometria na Barra Fixa',min_reps:3,min_sec:15,unit:'segundos',rules:'Sustentação isométrica na barra fixa com queixo acima da barra por no mínimo 15 segundos.'},
        abs:{type:'abs',name:'Abdominal Remador (1 min)',min_reps:28,time_limit_s:60,unit:'repetições',rules:'Execução contínua em 60 segundos no padrão remador.'},
        jump:{type:'jump',name:'Impulsão Horizontal (Salto)',distance_m:1.45,unit:'metros',rules:'Salto parado sem corrida de aproximação, medido pelo calcanhar mais próximo.'},
        swim:{type:'swim',name:'Natação 50m Livre',distance_m:50,time_limit_s:70,unit:'segundos',rules:'50 metros nado livre em até 1min10s (70s) sem apoio.'},
        run:{type:'run',name:'Corrida de 2.400m / 2.000m',distance_m:2000,time_limit_s:720,unit:'metros',rules:'Percorrer a distância mínima exigida no tempo máximo de 12min00s.'}
      }
    },
    policial_m:{
      label:'Carreiras Policiais (PRF / PF / PC) — Masculino',
      tests:{
        bar:{type:'bar',mode:'reps',name:'Barra Fixa',min_reps:6,min_sec:25,unit:'repetições',rules:'Mínimo de 6 flexões dinâmicas na barra fixa.'},
        abs:{type:'abs',name:'Abdominal Remador (1 min)',min_reps:40,time_limit_s:60,unit:'repetições',rules:'Mínimo de 40 repetições válidas em 60 segundos.'},
        jump:{type:'jump',name:'Impulsão Horizontal',distance_m:2.00,unit:'metros',rules:'Salto horizontal mínimo de 2,00 metros.'},
        swim:{type:'swim',name:'Natação 50m',distance_m:50,time_limit_s:54,unit:'segundos',rules:'50 metros em até 54 segundos.'},
        run:{type:'run',name:'Corrida 2.400m (12 min)',distance_m:2400,time_limit_s:720,unit:'metros',rules:'Mínimo de 2.400 metros em 12min00s.'}
      }
    },
    policial_f:{
      label:'Carreiras Policiais (PRF / PF / PC) — Feminino',
      tests:{
        bar:{type:'bar',mode:'isometry',name:'Isometria na Barra Fixa',min_reps:3,min_sec:20,unit:'segundos',rules:'Sustentação em isometria na barra por no mínimo 20 segundos.'},
        abs:{type:'abs',name:'Abdominal Remador (1 min)',min_reps:32,time_limit_s:60,unit:'repetições',rules:'Mínimo de 32 repetições válidas em 60 segundos.'},
        jump:{type:'jump',name:'Impulsão Horizontal',distance_m:1.60,unit:'metros',rules:'Salto horizontal mínimo de 1,60 metros.'},
        swim:{type:'swim',name:'Natação 50m',distance_m:50,time_limit_s:64,unit:'segundos',rules:'50 metros em até 64 segundos.'},
        run:{type:'run',name:'Corrida 2.000m (12 min)',distance_m:2000,time_limit_s:720,unit:'metros',rules:'Mínimo de 2.000 metros em 12min00s.'}
      }
    }
  };

  const TAF_ORDER=['bar','abs','jump','swim','run'];

  function formatTafTime(sec){
    const n=Math.max(0,Math.round(Number(sec)||0));
    const m=Math.floor(n/60),s=n%60;
    return m>0?`${m}min${String(s).padStart(2,'0')}s`:`${s}s`;
  }

  function formatStopwatchClock(sec){
    const n=Math.max(0,Math.floor(Number(sec)||0));
    const m=Math.floor(n/60),s=n%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // Funções trazidas do Forma Fit (fitness.js): activeSeconds, togglePause e metTarget
  function tafActiveSeconds(d,now=Date.now()){
    if(!d||!d.started_at)return 0;
    return Math.max(0,Math.floor(((d.paused_at||now)-d.started_at-(d.paused_ms||0))/1000));
  }

  function tafTogglePause(d,now=Date.now()){
    if(!d)return d;
    if(d.paused_at){
      d.paused_ms=(d.paused_ms||0)+(now-d.paused_at);
      d.paused_at=null;
    }else{
      d.paused_at=now;
    }
    return d;
  }

  function ensureTafState(){
    if(!state.taf||typeof state.taf!=='object')state.taf={preset:'pmpe_m',tests:{},history:[]};
    if(!state.taf.preset||!TAF_PRESETS[state.taf.preset])state.taf.preset='pmpe_m';
    if(!state.taf.tests||typeof state.taf.tests!=='object')state.taf.tests={};
    if(!Array.isArray(state.taf.history))state.taf.history=[];
    const base=TAF_PRESETS[state.taf.preset].tests;
    for(const key of TAF_ORDER){
      if(!state.taf.tests[key]||typeof state.taf.tests[key]!=='object'){
        state.taf.tests[key]=JSON.parse(JSON.stringify(base[key]));
      }else{
        state.taf.tests[key]={...JSON.parse(JSON.stringify(base[key])),...state.taf.tests[key]};
      }
    }
    return state.taf;
  }

  function tafMetTarget(test){
    if(!test||!test.result)return null;
    const r=test.result;
    if(test.type==='bar'){
      return test.mode==='isometry'?Number(r.time_s||0)>=Number(test.min_sec||15):Number(r.reps||0)>=Number(test.min_reps||5);
    }
    if(test.type==='abs'){
      return Number(r.reps||0)>=Number(test.min_reps||35)&&Number(r.time_s||60)<=Number(test.time_limit_s||60);
    }
    if(test.type==='jump'){
      return Number(r.distance_m||0)>=Number(test.distance_m||1.8);
    }
    return Number(r.distance_m||0)>=Number(test.distance_m||50)&&Number(r.time_s||9999)<=Number(test.time_limit_s||60);
  }

  function tafProgressPercent(test){
    if(!test||!test.result)return 0;
    const r=test.result;
    if(test.type==='bar'){
      const cur=test.mode==='isometry'?Number(r.time_s||0):Number(r.reps||0);
      const goal=test.mode==='isometry'?Number(test.min_sec||15):Number(test.min_reps||5);
      return Math.min(100,Math.max(0,Math.round((cur/Math.max(1,goal))*100)));
    }
    if(test.type==='abs'){
      return Math.min(100,Math.max(0,Math.round((Number(r.reps||0)/Math.max(1,Number(test.min_reps||35)))*100)));
    }
    if(test.type==='jump'){
      return Math.min(100,Math.max(0,Math.round((Number(r.distance_m||0)/Math.max(0.1,Number(test.distance_m||1.8)))*100)));
    }
    const distRatio=Number(r.distance_m||0)/Math.max(1,Number(test.distance_m||50));
    const timeRatio=Number(test.time_limit_s||60)/Math.max(1,Number(r.time_s||test.time_limit_s||60));
    return Math.min(100,Math.max(0,Math.round(Math.min(distRatio,timeRatio)*100)));
  }

  function tafRuleLabel(test){
    if(test.type==='bar'){
      return test.mode==='isometry'
        ?`Meta do edital: mín. ${test.min_sec||15}s em isometria`
        :`Meta do edital: mín. ${test.min_reps||5} repetições dinâmicas`;
    }
    if(test.type==='abs')return `Meta do edital: mín. ${test.min_reps||35} rep em ${formatTafTime(test.time_limit_s||60)}`;
    if(test.type==='jump')return `Meta do edital: mín. ${Number(test.distance_m||1.8).toFixed(2).replace('.',',')} m`;
    return `Meta do edital: ${Number(test.distance_m||50).toLocaleString('pt-BR')} m em até ${formatTafTime(test.time_limit_s||60)}`;
  }

  function tafResultLabel(test){
    const r=test?.result;
    if(!r)return 'Ainda não registrado';
    if(test.type==='bar'){
      return test.mode==='isometry'?`${r.time_s||0}s sustentados`:`${r.reps||0} repetições`;
    }
    if(test.type==='abs')return `${r.reps||0} rep em ${formatTafTime(r.time_s||60)}`;
    if(test.type==='jump')return `${Number(r.distance_m||0).toFixed(2).replace('.',',')} m`;
    if(test.type==='run'){
      const pace=r.distance_m>0&&r.time_s>0?formatStopwatchClock(Math.round((r.time_s)/(r.distance_m/1000))):null;
      return `${Number(r.distance_m||0).toLocaleString('pt-BR')} m em ${formatTafTime(r.time_s||0)}${pace?` (Pace ${pace}/km)`:''}`;
    }
    return `${Number(r.distance_m||0).toLocaleString('pt-BR')} m em ${formatTafTime(r.time_s||0)}`;
  }

  function tafGapAdvice(test,weeksLeft){
    const met=tafMetTarget(test);
    if(met===null)return 'Faça um simulado diagnóstico para calcular sua meta semanal até a prova.';
    if(met)return '✓ Índice aprovado! Mantenha 2 treinos semanais de manutenção sem sobrecarga articular.';
    const r=test.result||{};
    const w=Math.max(1,weeksLeft||8);
    if(test.type==='bar'){
      if(test.mode==='isometry'){
        const diff=Math.max(1,Number(test.min_sec||15)-Number(r.time_s||0));
        return `Faltam ${diff}s na barra · evolua +${Math.max(1,Math.ceil(diff/w))}s por semana até a prova.`;
      }
      const diff=Math.max(1,Number(test.min_reps||5)-Number(r.reps||0));
      return `Falta${diff===1?'':'m'} ${diff} repetiç${diff===1?'ão':'ões'} · ganhe +1 repetição a cada ${Math.max(1,Math.floor(w/diff))} semana(s).`;
    }
    if(test.type==='abs'){
      const diff=Math.max(1,Number(test.min_reps||35)-Number(r.reps||0));
      return `Faltam ${diff} abdominais · aumente +${Math.max(1,Math.ceil(diff/w))} rep por semana.`;
    }
    if(test.type==='jump'){
      const diffCm=Math.max(1,Math.round((Number(test.distance_m||1.8)-Number(r.distance_m||0))*100));
      return `Faltam ${diffCm} cm no salto · ganhe +${Math.max(1,Math.ceil(diffCm/w))} cm por semana (pliometria e impulsão).`;
    }
    const distDiff=Math.max(0,Number(test.distance_m||50)-Number(r.distance_m||0));
    const timeDiff=Math.max(0,Number(r.time_s||0)-Number(test.time_limit_s||60));
    const parts=[];
    if(distDiff>0)parts.push(`+${Math.round(distDiff)} m de distância`);
    if(timeDiff>0)parts.push(`baixar ${formatTafTime(timeDiff)} no tempo (~${Math.max(1,Math.ceil(timeDiff/w))}s/semana)`);
    return `Para bater o índice: ${parts.join(' e ')}.`;
  }

  function syncHunterStatsSnapshot(){
    try{
      const taf=ensureTafState();
      const tests=TAF_ORDER.map(k=>taf.tests[k]).filter(Boolean);
      const readyCount=tests.filter(t=>tafMetTarget(t)===true).length;
      const pool=typeof missionPool==='function'?missionPool():[];
      const doneCount=pool.filter(m=>state?.done?.[m.id]).length;
      const editalComplete=pool.length>0&&doneCount===pool.length;
      const curXp=typeof xp==='function'?xp():0;
      const curRank=typeof level==='function'?level(curXp,editalComplete)?.label||'E III - Caçador Iniciante':'E III - Caçador Iniciante';
      const totalQ=(state?.scores||[]).reduce((a,s)=>a+Number(s.total||0),0);
      const corrQ=(state?.scores||[]).reduce((a,s)=>a+Number(s.correct||0),0);
      const acc=totalQ?Math.round((corrQ/totalQ)*100):0;
      const user=cloudSession?.user;
      const defaultName=user?.user_metadata?.full_name||user?.user_metadata?.name||(user?.email?user.email.split('@')[0]:'')||'Caçador';
      const defaultRole=(typeof activeCampaign==='function'?activeCampaign()?.name:'')||'PMPE — Soldado';
      state.publicProfile=state.publicProfile||{};
      state.hunterStats={
        name:state.publicProfile.name||defaultName,
        role:state.publicProfile.role||defaultRole,
        xp:curXp,
        rank:curRank,
        streak:Number(state?.streak||0),
        bestStreak:Math.max(Number(state?.bestStreak||0),Number(state?.streak||0)),
        missionsDone:doneCount,
        accuracy:acc,
        tafReady:readyCount,
        tafTotal:tests.length||5,
        updatedAt:new Date().toISOString()
      };
    }catch{}
  }

  let tafTimerState=null,tafTimerInterval=null;

  function updateTafStopwatchDisplay(){
    const timeEl=q('#tafSwClock'),statusEl=q('#tafSwTargetInfo');
    if(!timeEl)return;
    const elapsed=tafActiveSeconds(tafTimerState);
    timeEl.textContent=formatStopwatchClock(elapsed);
    if(tafTimerState?.targetSec&&elapsed>=tafTimerState.targetSec&&!tafTimerState.notified){
      tafTimerState.notified=true;
      playCompletionChime();
      toast(`⏱️ Tempo do simulado atingido (${formatTafTime(tafTimerState.targetSec)})!`);
    }
    if(statusEl){
      statusEl.textContent=tafTimerState?.label
        ?`${tafTimerState.label} · ${tafTimerState.paused_at?'Pausado':'Em andamento'}${tafTimerState.targetSec?` (Alvo: ${formatTafTime(tafTimerState.targetSec)})`:''}`
        :'Escolha um teste (1 min Abdominal, 12 min Corrida, 60s Natação ou Isometria Barra) para cronometrar.';
    }
  }

  function startTafStopwatch(label,targetSec=0){
    tafTimerState={label,targetSec:Number(targetSec)||0,started_at:Date.now(),paused_at:null,paused_ms:0,notified:false};
    if(tafTimerInterval)clearInterval(tafTimerInterval);
    tafTimerInterval=setInterval(updateTafStopwatchDisplay,250);
    updateTafStopwatchDisplay();
  }

  function renderTafPanel(){
    const root=q('#tafRoot');
    if(!root)return;
    const taf=ensureTafState();
    syncHunterStatsSnapshot();
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    const examDateStr=campaign?.examDate||state?.examDate||null;
    const daysLeft=examDateStr?Math.max(0,Math.ceil((new Date(`${examDateStr}T12:00:00`).getTime()-Date.now())/86400000)):null;
    const weeksLeft=daysLeft!==null?Math.max(1,Math.ceil(daysLeft/7)):8;
    const tests=TAF_ORDER.map(k=>({key:k,...taf.tests[k]}));
    const readyCount=tests.filter(t=>tafMetTarget(t)===true).length;
    const testedCount=tests.filter(t=>tafMetTarget(t)!==null).length;
    const overallStatus=readyCount===tests.length?'APTO EM TODOS OS ÍNDICES':readyCount>=3?'QUASE LÁ · FOCO NOS PENDENTES':testedCount>0?'EM EVOLUÇÃO FÍSICA':'AGUARDANDO 1º SIMULADO';

    root.innerHTML=`
      <div class="sectionHead">
        <div>
          <div class="eyebrow">PREPARAÇÃO FÍSICA POLICIAL · INSPIRADO NO FORMA FIT</div>
          <h2 style="margin:3px 0 0">Painel TAF (${escText(campaign?.name||'Carreira Policial')})</h2>
          <p class="small muted" style="margin:3px 0 0">Acompanhe Barra Fixa/Isometria, Corrida de 2.400m, Natação 50m, Impulsão Horizontal e Abdominal com metas até o dia da prova.</p>
        </div>
        <span class="tag">${readyCount}/${tests.length} índices aptos</span>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="sectionHead" style="margin-bottom:10px">
          <div>
            <div class="eyebrow">DIAGNÓSTICO ATÉ A PROVA ${daysLeft!==null?`· FALTAM ${daysLeft} DIAS (${weeksLeft} SEMANAS)`:''}</div>
            <h3 style="margin:3px 0 0">${overallStatus}</h3>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="tafPresetSelect" style="min-width:240px">
              ${Object.entries(TAF_PRESETS).map(([k,v])=>`<option value="${k}" ${taf.preset===k?'selected':''}>Tabela: ${escText(v.label)}</option>`).join('')}
            </select>
            <button type="button" class="ghost small" id="applyTafPresetBtn">Aplicar tabela padrão</button>
          </div>
        </div>
        <div class="bar"><div class="fill" style="width:${Math.round((readyCount/tests.length)*100)}%"></div></div>
        <div class="small muted" style="margin-top:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>Progresso global no TAF: <b>${Math.round((readyCount/tests.length)*100)}% dos testes aprovados</b></span>
          <span>${daysLeft!==null?`Data da prova: ${new Date(`${examDateStr}T12:00:00`).toLocaleDateString('pt-BR')} · Planejamento dividido em ${weeksLeft} semanas`:'Defina a data da prova na aba Portais para calcular a evolução semanal.'}</span>
        </div>
      </div>

      <div class="tafStopwatch">
        <div>
          <div class="eyebrow">CRONÔMETRO OFICIAL DE SIMULADO TAF</div>
          <div class="tafStopwatchTime" id="tafSwClock">${formatStopwatchClock(tafActiveSeconds(tafTimerState))}</div>
          <div class="small muted" id="tafSwTargetInfo">Escolha um teste (1 min Abdominal, 12 min Corrida, 60s Natação ou Isometria Barra) para cronometrar.</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="ghost small" data-taf-sw="Abdominal (1 min)|60">⏱️ 1 min (Abdominal)</button>
          <button type="button" class="ghost small" data-taf-sw="Isometria Barra|20">⏱️ Isometria Barra</button>
          <button type="button" class="ghost small" data-taf-sw="Natação 50m|60">⏱️ 60s (Natação)</button>
          <button type="button" class="ghost small" data-taf-sw="Corrida 2.400m (12 min)|720">⏱️ 12 min (Corrida)</button>
          <button type="button" class="action small" id="tafSwPauseBtn">${tafTimerState?.paused_at?'Retomar':'Pausar'}</button>
          <button type="button" class="ghost danger small" id="tafSwResetBtn">Zerar</button>
        </div>
      </div>

      <div class="tafGrid">
        ${tests.map(t=>{
          const met=tafMetTarget(t);
          const pct=tafProgressPercent(t);
          const statusClass=met===true?'ready':pct>=75?'near':'prep';
          const statusText=met===true?'✓ APTO NO EDITAL':met===false?(pct>=75?'⚡ QUASE LÁ':'EM PREPARAÇÃO'):'SEM SIMULADO';
          return `
            <article class="tafCard ${statusClass}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div class="eyebrow">${escText(t.type.toUpperCase())}</div>
                  <h3 style="margin:2px 0 0;font-size:1.02rem">${escText(t.name)}</h3>
                </div>
                <span class="tafStatusPill ${statusClass}">${statusText}</span>
              </div>
              <div class="small"><b>${escText(tafRuleLabel(t))}</b></div>
              <div class="small muted">${escText(t.rules||'')}</div>
              <div style="background:#06111d;padding:9px 11px;border-radius:10px;border:1px solid #1a334a">
                <div class="small muted">Último resultado (${escText(t.result?.date?new Date(`${t.result.date}T12:00:00`).toLocaleDateString('pt-BR'):'—')})</div>
                <strong style="font-size:1.05rem;color:#f8fafc">${escText(tafResultLabel(t))}</strong>
                <div class="bar" style="margin-top:6px;height:7px"><div class="fill" style="width:${pct}%"></div></div>
              </div>
              <div class="small muted">${escText(tafGapAdvice(t,weeksLeft))}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
                <button type="button" class="action small" style="flex:1" data-taf-record="${t.key}">Registrar simulado</button>
                <button type="button" class="ghost small" data-taf-edit="${t.key}">Editar meta</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>

      <div class="card" id="tafFormCard" hidden style="margin-top:14px"></div>

      <div class="card" style="margin-top:14px">
        <div class="sectionHead">
          <div>
            <h2>Histórico de Simulados TAF</h2>
            <p class="small muted" style="margin:2px 0 0">Todos os seus treinos e simulados físicos ficam salvos e sincronizados na nuvem.</p>
          </div>
          <span class="tag">${taf.history.length} registro${taf.history.length===1?'':'s'}</span>
        </div>
        <div class="list">
          ${taf.history.length?taf.history.slice(0,20).map(item=>`
            <div class="card" style="padding:11px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <b>${escText(item.name)}</b> · <span class="tafStatusPill ${item.passed?'ready':'near'}">${item.passed?'Apto':'Em evolução'}</span>
                <div class="small muted">${escText(item.summary)} · ${escText(item.date?new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR'):'')}</div>
                ${item.notes?`<div class="small" style="margin-top:3px">${escText(item.notes)}</div>`:''}
              </div>
              <button type="button" class="ghost danger small" data-taf-del-hist="${escText(item.id)}">Excluir</button>
            </div>
          `).join(''):'<div class="empty">Nenhum simulado TAF registrado ainda. Clique em "Registrar simulado" em qualquer modalidade acima para começar.</div>'}
        </div>
      </div>
    `;

    q('#applyTafPresetBtn').onclick=()=>{
      const chosen=q('#tafPresetSelect').value;
      if(!TAF_PRESETS[chosen])return;
      taf.preset=chosen;
      for(const k of TAF_ORDER){
        const prevResult=taf.tests[k]?.result||null;
        taf.tests[k]={...JSON.parse(JSON.stringify(TAF_PRESETS[chosen].tests[k])),result:prevResult};
      }
      save();
      if(cloudSession&&navigator.onLine)pushCloudState();
      renderTafPanel();
      renderReverseSchedule();
      toast(`Tabela ${TAF_PRESETS[chosen].label} aplicada!`);
    };

    qa('[data-taf-sw]').forEach(btn=>{
      btn.onclick=()=>{
        const [label,sec]=btn.dataset.tafSw.split('|');
        startTafStopwatch(label,Number(sec)||0);
      };
    });
    if(q('#tafSwPauseBtn'))q('#tafSwPauseBtn').onclick=()=>{
      if(!tafTimerState)return startTafStopwatch('Cronômetro Livre TAF',0);
      tafTogglePause(tafTimerState);
      updateTafStopwatchDisplay();
      q('#tafSwPauseBtn').textContent=tafTimerState.paused_at?'Retomar':'Pausar';
    };
    if(q('#tafSwResetBtn'))q('#tafSwResetBtn').onclick=()=>{
      if(tafTimerInterval){clearInterval(tafTimerInterval);tafTimerInterval=null}
      tafTimerState=null;
      updateTafStopwatchDisplay();
    };

    qa('[data-taf-record]').forEach(btn=>{
      btn.onclick=()=>openTafRecordForm(btn.dataset.tafRecord);
    });
    qa('[data-taf-edit]').forEach(btn=>{
      btn.onclick=()=>openTafGoalEditor(btn.dataset.tafEdit);
    });
    qa('[data-taf-del-hist]').forEach(btn=>{
      btn.onclick=()=>{
        const id=btn.dataset.tafDelHist;
        taf.history=taf.history.filter(h=>h.id!==id);
        save();
        if(cloudSession&&navigator.onLine)pushCloudState();
        renderTafPanel();
        toast('Registro excluído do histórico.');
      };
    });
  }

  function openTafRecordForm(key){
    const taf=ensureTafState(),test=taf.tests[key],formCard=q('#tafFormCard');
    if(!test||!formCard)return;
    const swSec=tafActiveSeconds(tafTimerState);
    const prev=test.result||{};
    const defSec=swSec>0?swSec:(prev.time_s||test.time_limit_s||60);
    formCard.hidden=false;
    formCard.innerHTML=`
      <div class="sectionHead">
        <h3>Registrar Simulado — ${escText(test.name)}</h3>
        <button type="button" class="ghost small" id="closeTafFormBtn">Fechar</button>
      </div>
      <div class="essayGrid">
        ${test.type==='bar'?`
          <label class="field">Modalidade da Barra
            <select id="tafRecBarMode">
              <option value="reps" ${test.mode!=='isometry'?'selected':''}>Repetições dinâmicas (Masculino / Geral)</option>
              <option value="isometry" ${test.mode==='isometry'?'selected':''}>Sustentação em Isometria — Segundos (Feminino)</option>
            </select>
          </label>
          <label class="field">Valor alcançado (repetições ou segundos)
            <input type="number" id="tafRecVal1" min="0" max="300" value="${test.mode==='isometry'?(swSec||prev.time_s||0):(prev.reps||0)}">
          </label>
        `:test.type==='abs'?`
          <label class="field">Repetições realizadas
            <input type="number" id="tafRecVal1" min="0" max="200" value="${prev.reps||0}">
          </label>
          <label class="field">Tempo gasto (segundos)
            <input type="number" id="tafRecTimeSec" min="1" max="300" value="${defSec}">
          </label>
        `:test.type==='jump'?`
          <label class="field">Distância alcançada no salto (metros, ex.: 1.85)
            <input type="number" id="tafRecDist" min="0.3" max="4.5" step="0.01" value="${prev.distance_m||test.distance_m||1.80}">
          </label>
        `:`
          <label class="field">Distância percorrida (metros)
            <input type="number" id="tafRecDist" min="10" max="15000" step="10" value="${prev.distance_m||test.distance_m||2400}">
          </label>
          <label class="field">Tempo realizado (minutos : segundos)
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <input type="number" id="tafRecMin" min="0" max="120" placeholder="Minutos" value="${Math.floor(defSec/60)}">
              <input type="number" id="tafRecSec" min="0" max="59" placeholder="Segundos" value="${defSec%60}">
            </div>
          </label>
        `}
        <label class="field">Data do simulado
          <input type="date" id="tafRecDate" value="${typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10)}">
        </label>
        <label class="field">Observação (pista, academia, fadiga, tênis...)
          <input type="text" id="tafRecNotes" maxlength="160" placeholder="Ex.: Pista oficial, sol forte, sobrou gás no final">
        </label>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button type="button" class="action" id="saveTafRecordBtn">Salvar resultado no TAF</button>
      </div>
    `;
    formCard.scrollIntoView({behavior:'smooth',block:'center'});
    q('#closeTafFormBtn').onclick=()=>{formCard.hidden=true};
    q('#saveTafRecordBtn').onclick=()=>{
      const date=q('#tafRecDate')?.value||(typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10));
      const notes=q('#tafRecNotes')?.value?.trim()||'';
      const result={date};
      if(test.type==='bar'){
        const mode=q('#tafRecBarMode')?.value||'reps';
        test.mode=mode;
        const val=Math.max(0,Number(q('#tafRecVal1')?.value||0));
        if(mode==='isometry')result.time_s=val;
        else result.reps=val;
      }else if(test.type==='abs'){
        result.reps=Math.max(0,Number(q('#tafRecVal1')?.value||0));
        result.time_s=Math.max(1,Number(q('#tafRecTimeSec')?.value||60));
      }else if(test.type==='jump'){
        result.distance_m=Math.max(0,Number(q('#tafRecDist')?.value||0));
      }else{
        result.distance_m=Math.max(0,Number(q('#tafRecDist')?.value||0));
        const m=Math.max(0,Number(q('#tafRecMin')?.value||0));
        const s=Math.max(0,Number(q('#tafRecSec')?.value||0));
        result.time_s=Math.max(1,m*60+s);
      }
      test.result=result;
      const passed=tafMetTarget(test)===true;
      taf.history.unshift({
        id:'taf-'+Date.now(),
        key,
        name:test.name,
        date,
        passed,
        summary:tafResultLabel(test),
        notes,
        createdAt:new Date().toISOString()
      });
      syncHunterStatsSnapshot();
      save();
      if(cloudSession&&navigator.onLine)pushCloudState();
      renderTafPanel();
      renderReverseSchedule();
      toast(passed?`🏆 Parabéns! Índice de ${test.name} aprovado no padrão do edital!`:`Simulado de ${test.name} salvo! Continue evoluindo até a meta.`);
    };
  }

  function openTafGoalEditor(key){
    const taf=ensureTafState(),test=taf.tests[key],formCard=q('#tafFormCard');
    if(!test||!formCard)return;
    formCard.hidden=false;
    formCard.innerHTML=`
      <div class="sectionHead">
        <h3>Editar Meta do Edital — ${escText(test.name)}</h3>
        <button type="button" class="ghost small" id="closeTafFormBtn">Fechar</button>
      </div>
      <div class="essayGrid">
        ${test.type==='bar'?`
          <label class="field">Tipo exigido no seu edital
            <select id="tafGoalBarMode">
              <option value="reps" ${test.mode!=='isometry'?'selected':''}>Repetições dinâmicas (Barra Fixa)</option>
              <option value="isometry" ${test.mode==='isometry'?'selected':''}>Isometria em segundos (Sustentação)</option>
            </select>
          </label>
          <label class="field">Mínimo de repetições (se dinâmica)
            <input type="number" id="tafGoalReps" min="1" max="50" value="${test.min_reps||5}">
          </label>
          <label class="field">Mínimo de segundos (se isometria)
            <input type="number" id="tafGoalSec" min="5" max="180" value="${test.min_sec||15}">
          </label>
        `:test.type==='abs'?`
          <label class="field">Mínimo de repetições exigidas
            <input type="number" id="tafGoalReps" min="5" max="120" value="${test.min_reps||35}">
          </label>
          <label class="field">Tempo limite (segundos)
            <input type="number" id="tafGoalSec" min="15" max="300" value="${test.time_limit_s||60}">
          </label>
        `:test.type==='jump'?`
          <label class="field">Distância mínima do salto (metros, ex.: 1.80)
            <input type="number" id="tafGoalDist" min="0.5" max="4.0" step="0.01" value="${test.distance_m||1.80}">
          </label>
        `:`
          <label class="field">Distância exigida no edital (metros)
            <input type="number" id="tafGoalDist" min="25" max="10000" step="25" value="${test.distance_m||2400}">
          </label>
          <label class="field">Tempo máximo permitido (segundos — ex.: 720 = 12min)
            <input type="number" id="tafGoalSec" min="20" max="3600" value="${test.time_limit_s||720}">
          </label>
        `}
        <label class="field" style="grid-column:1/-1">Regra / Observação do Edital
          <input type="text" id="tafGoalRules" maxlength="240" value="${escText(test.rules||'')}">
        </label>
      </div>
      <div style="margin-top:10px">
        <button type="button" class="action" id="saveTafGoalBtn">Salvar meta do edital</button>
      </div>
    `;
    formCard.scrollIntoView({behavior:'smooth',block:'center'});
    q('#closeTafFormBtn').onclick=()=>{formCard.hidden=true};
    q('#saveTafGoalBtn').onclick=()=>{
      if(test.type==='bar'){
        test.mode=q('#tafGoalBarMode')?.value||'reps';
        test.min_reps=Math.max(1,Number(q('#tafGoalReps')?.value||5));
        test.min_sec=Math.max(5,Number(q('#tafGoalSec')?.value||15));
      }else if(test.type==='abs'){
        test.min_reps=Math.max(1,Number(q('#tafGoalReps')?.value||35));
        test.time_limit_s=Math.max(15,Number(q('#tafGoalSec')?.value||60));
      }else if(test.type==='jump'){
        test.distance_m=Math.max(0.5,Number(q('#tafGoalDist')?.value||1.8));
      }else{
        test.distance_m=Math.max(25,Number(q('#tafGoalDist')?.value||2400));
        test.time_limit_s=Math.max(20,Number(q('#tafGoalSec')?.value||720));
      }
      test.rules=q('#tafGoalRules')?.value?.trim()||test.rules;
      syncHunterStatsSnapshot();
      save();
      if(cloudSession&&navigator.onLine)pushCloudState();
      renderTafPanel();
      toast('Meta do edital atualizada!');
    };
  }

  // 12. Ranking Geral de Caçadores (Perfis Primário + Secundário ex.: PMPE e PPPE, sem TAF no Ranking)
  let leaderboardRows=[],leaderboardBusy=false,leaderboardSort='streak',leaderboardRoleFilter='all',leaderboardSqlMissing=false;

  function normalizeExamSlug(name='',org=''){
    const raw=topicKey(`${name} ${org}`);
    if(/\bpmpe\b|policia militar de pernambuco|soldado pmpe|oficial pmpe/.test(raw))return 'pmpe';
    if(/\bpppe\b|policia penal de pernambuco|policial penal pe|agente penitenciario pe/.test(raw))return 'pppe';
    if(/\bpcpe\b|policia civil de pernambuco/.test(raw))return 'pcpe';
    if(/\bcbmpe\b|bombeiro militar de pernambuco|bombeiros pe/.test(raw))return 'cbmpe';
    if(/\bprf\b|policia rodoviaria federal/.test(raw))return 'prf';
    if(/\bpf\b|policia federal/.test(raw))return 'pf';
    if(/\bpmba\b|policia militar da bahia/.test(raw))return 'pmba';
    if(/\bpmce\b|policia militar do ceara/.test(raw))return 'pmce';
    if(/\bpmpb\b|policia militar da paraiba/.test(raw))return 'pmpb';
    if(/\bpmal\b|policia militar de alagoas/.test(raw))return 'pmal';
    const slug=topicKey(name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return slug.slice(0,40)||'geral';
  }

  function formatExamRoleLabel(roleText=''){
    const clean=String(roleText||'').trim();
    if(!clean)return '';
    const slug=normalizeExamSlug(clean);
    const fullMap={
      pmpe:'PMPE — Polícia Militar de Pernambuco',
      pppe:'PPPE — Polícia Penal de Pernambuco',
      pcpe:'PCPE — Polícia Civil de Pernambuco',
      cbmpe:'CBMPE — Corpo de Bombeiros Militar de PE',
      prf:'PRF — Polícia Rodoviária Federal',
      pf:'PF — Polícia Federal',
      pmba:'PMBA — Polícia Militar da Bahia',
      pmce:'PMCE — Polícia Militar do Ceará',
      pmpb:'PMPB — Polícia Militar da Paraíba',
      pmal:'PMAL — Polícia Militar de Alagoas'
    };
    if(fullMap[slug]&&clean.length<=16)return fullMap[slug];
    return clean;
  }

  function detectUserRoles(){
    const campaigns=Array.isArray(state?.campaigns)?state.campaigns.slice().sort((a,b)=>(Number(a.priority||1)-Number(b.priority||1))):[];
    const active=typeof activeCampaign==='function'?activeCampaign():campaigns[0];
    const primaryDefault=active?.name||campaigns[0]?.name||'PMPE — Soldado';
    const primary=String(state?.publicProfile?.role||primaryDefault).trim()||'PMPE — Soldado';
    const primarySlug=normalizeExamSlug(primary);
    let secondaryDefault='';
    for(const c of campaigns){
      if(c?.name&&normalizeExamSlug(c.name,c.organization||'')!==primarySlug){
        secondaryDefault=c.name;
        break;
      }
    }
    const rawSecondary=state?.publicProfile?.secondaryRole!==undefined
      ?String(state.publicProfile.secondaryRole||'').trim()
      :secondaryDefault;
    const secondary=(rawSecondary&&normalizeExamSlug(rawSecondary)!==primarySlug)?rawSecondary:'';
    return {primary,secondary};
  }

  function rankLabelForXp(x){
    if(typeof level==='function')return level(Number(x)||0,false)?.label||'E III - Caçador Iniciante';
    return 'E III - Caçador Iniciante';
  }

  function localHunterRow(){
    syncHunterStatsSnapshot();
    const roles=detectUserRoles();
    const hs=state.hunterStats||{};
    if(state.hunterStats){
      state.hunterStats.role=roles.primary;
      state.hunterStats.secondaryRole=roles.secondary;
    }
    return {
      user_id:cloudSession?.user?.id||'local',
      is_me:true,
      name:hs.name||'Você (Caçador)',
      role:roles.primary,
      secondary_role:roles.secondary,
      streak:Number(hs.streak||state?.streak||0),
      best_streak:Number(hs.bestStreak||state?.bestStreak||0),
      last_study:state?.lastStudy||'',
      missions_done:Number(hs.missionsDone||0),
      accuracy:Number(hs.accuracy||0),
      xp:Number(hs.xp||0),
      updated_at:new Date().toISOString()
    };
  }

  function renderRoleBadgesHtml(primaryRole,secondaryRole,centered=false){
    const p=formatExamRoleLabel(primaryRole||'PMPE — Soldado');
    const s=(secondaryRole&&normalizeExamSlug(secondaryRole)!==normalizeExamSlug(primaryRole))?formatExamRoleLabel(secondaryRole):'';
    return `
      <div class="roleBadgesWrap" style="${centered?'justify-content:center':''}">
        <span class="roleBadgePrimary" title="Concurso Primário">🎯 ${escText(p)}</span>
        ${s?`<span class="roleBadgeSecondary" title="Concurso Secundário">🛡️ ${escText(s)}</span>`:''}
      </div>
    `;
  }

  async function loadHuntersLeaderboard(forceToast=false){
    if(leaderboardBusy)return;
    leaderboardBusy=true;
    renderHuntersLeaderboard();
    try{
      syncHunterStatsSnapshot();
      const roles=detectUserRoles();
      if(state.hunterStats){
        state.hunterStats.role=roles.primary;
        state.hunterStats.secondaryRole=roles.secondary;
      }
      if(!cloudSession){
        leaderboardRows=[localHunterRow()];
        return;
      }
      const response=await cloudFetch('rpc/get_hunters_leaderboard',{method:'POST',body:JSON.stringify({})});
      const rows=await response.json();
      if(Array.isArray(rows)&&rows.length){
        leaderboardSqlMissing=false;
        const meLocal=localHunterRow();
        leaderboardRows=rows.map(r=>r.is_me?{
          ...r,
          name:meLocal.name||r.name,
          role:meLocal.role||r.role,
          secondary_role:meLocal.secondary_role||(r.secondary_role||''),
          streak:Math.max(Number(r.streak||0),meLocal.streak),
          best_streak:Math.max(Number(r.best_streak||0),meLocal.best_streak),
          missions_done:Math.max(Number(r.missions_done||0),meLocal.missions_done),
          accuracy:meLocal.accuracy||Number(r.accuracy||0),
          xp:Math.max(Number(r.xp||0),meLocal.xp)
        }:r);
        if(forceToast)toast(`Ranking atualizado: ${leaderboardRows.length} caçador(es) na disputa!`);
      }else{
        leaderboardRows=[localHunterRow()];
      }
    }catch(err){
      const msg=String(err?.message||err||'');
      if(/get_hunters_leaderboard|Could not find the function|PGRST202/i.test(msg)){
        leaderboardSqlMissing=true;
      }
      leaderboardRows=[localHunterRow()];
    }finally{
      leaderboardBusy=false;
      renderHuntersLeaderboard();
    }
  }

  function deduplicateHunterRows(rows=[]){
    const byName=new Map();
    for(const item of rows){
      const key=topicKey(item?.name||'cacador')||String(item?.user_id||Math.random());
      const prev=byName.get(key);
      if(!prev){
        byName.set(key,item);
        continue;
      }
      const prevScore=(prev.is_me?1000000:0)+Number(prev.xp||0)*10+Number(prev.streak||0)*100+Number(prev.missions_done||0)*50+Number(prev.accuracy||0);
      const curScore=(item.is_me?1000000:0)+Number(item.xp||0)*10+Number(item.streak||0)*100+Number(item.missions_done||0)*50+Number(item.accuracy||0);
      if(curScore>prevScore)byName.set(key,item);
    }
    return [...byName.values()];
  }

  function renderHuntersLeaderboard(){
    const root=q('#rankingRoot');
    if(!root)return;
    const me=localHunterRow();
    const list=deduplicateHunterRows((leaderboardRows&&leaderboardRows.length?leaderboardRows:[me]).slice());
    const mySlugs=new Set([normalizeExamSlug(me.role),me.secondary_role?normalizeExamSlug(me.secondary_role):''].filter(Boolean));
    const filtered=leaderboardRoleFilter==='same'
      ?list.filter(r=>{
        const r1=normalizeExamSlug(r.role);
        const r2=r.secondary_role?normalizeExamSlug(r.secondary_role):'';
        return mySlugs.has(r1)||(r2&&mySlugs.has(r2));
      })
      :list;

    filtered.sort((a,b)=>{
      if(leaderboardSort==='xp')return (b.xp-a.xp)||(b.streak-a.streak)||(b.accuracy-a.accuracy);
      if(leaderboardSort==='accuracy')return (b.accuracy-a.accuracy)||(b.missions_done-a.missions_done)||(b.streak-a.streak);
      return (b.streak-a.streak)||(b.xp-a.xp)||(b.accuracy-a.accuracy);
    });

    const todayStr=typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10);
    const top3=filtered.slice(0,3);
    const medals=['🥇 1º Lugar','🥈 2º Lugar','🥉 3º Lugar'];

    root.innerHTML=`
      <div class="sectionHead">
        <div>
          <div class="eyebrow">COMUNIDADE E COMPETIÇÃO SAUDÁVEL</div>
          <h2 style="margin:3px 0 0">🏆 Ranking Geral de Caçadores</h2>
          <p class="small muted" style="margin:3px 0 0">Acompanhe a ofensiva diária, perfil de concurso (primário e secundário) e desempenho nos estudos.</p>
        </div>
        <div class="rankHeaderActions">
          <button type="button" class="action small" id="openDuelArenaFromRankBtn" style="background:linear-gradient(90deg,#7c3aed,#2563eb)">⚔️ Arena Duelo X1</button>
          <button type="button" class="ghost small" id="shareAppRankingBtn">📲 Convidar Amigos</button>
          <button type="button" class="ghost small" id="dedupRankingBtn" title="Verifica e remove perfis duplicados sem progresso no banco">🧹 Limpar Duplicados</button>
          <button type="button" class="ghost small" id="refreshRankingBtn">${leaderboardBusy?'⏳ Atualizando...':'↻ Atualizar'}</button>
        </div>
      </div>

      ${leaderboardSqlMissing?`
        <div class="card" style="margin-bottom:12px;border-color:var(--gold)">
          <b>Ative o Ranking e a Biblioteca da Comunidade no Supabase (1 vez):</b>
          <p class="small muted" style="margin:4px 0 0">Execute o arquivo <code>supabase/migrations/20261030_v91_community_library_and_ranking.sql</code> no SQL Editor do Supabase para listar todos os usuários e compartilhar materiais por concurso.</p>
        </div>
      `:''}

      <div class="card" style="margin-bottom:12px">
        <div class="sectionHead" style="margin-bottom:8px">
          <div>
            <div class="eyebrow">SEU PERFIL NO RANKING (PRIMÁRIO E SECUNDÁRIO)</div>
            <strong style="font-size:1.02rem">${escText(me.name)}</strong>
            ${renderRoleBadgesHtml(me.role,me.secondary_role,false)}
          </div>
          <span class="tag">🔥 ${me.streak}d ofensiva · ${me.xp} XP</span>
        </div>
        <div class="essayGrid" style="align-items:end">
          <label class="field">Seu Nome no Ranking
            <input type="text" id="rankProfileNameInput" maxlength="50" value="${escText(state.publicProfile?.name||me.name)}" placeholder="Ex.: Walyson Caio">
          </label>
          <label class="field">1º Concurso (Perfil Primário)
            <input type="text" id="rankProfileRoleInput" maxlength="60" value="${escText(state.publicProfile?.role||me.role)}" placeholder="Ex.: PMPE — Polícia Militar de PE">
          </label>
          <label class="field" style="grid-column:1/-1">2º Concurso (Perfil Secundário — Opcional: só aparece se preenchido ou se você tiver 2 portais)
            <input type="text" id="rankProfileSecRoleInput" maxlength="60" value="${escText(me.secondary_role||'')}" placeholder="Ex.: PPPE — Polícia Penal de PE (deixe em branco se estudar só para 1 concurso)">
          </label>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <label class="small muted" style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="rankProfileHideToggle" ${state.publicProfile?.hidden?'checked':''}>
            Ocultar meu perfil para outros usuários
          </label>
          <button type="button" class="ghost small" id="saveRankProfileBtn">Salvar meu perfil no Ranking</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="ghost small ${leaderboardSort==='streak'?'active':''}" data-rank-sort="streak">🔥 Por Ofensiva</button>
          <button type="button" class="ghost small ${leaderboardSort==='xp'?'active':''}" data-rank-sort="xp">⚡ Por XP / Patente</button>
          <button type="button" class="ghost small ${leaderboardSort==='accuracy'?'active':''}" data-rank-sort="accuracy">🎯 Por Desempenho</button>
        </div>
        <select id="rankRoleFilterSelect" style="max-width:260px">
          <option value="all" ${leaderboardRoleFilter==='all'?'selected':''}>Todos os concursos (${list.length} caçadores)</option>
          <option value="same" ${leaderboardRoleFilter==='same'?'selected':''}>Mesmo concurso que o meu (${escText(me.role)}${me.secondary_role?` / ${escText(me.secondary_role)}`:''})</option>
        </select>
      </div>

      ${top3.length?`
        <div class="podiumGrid">
          ${top3.map((item,idx)=>`
            <div class="podiumCard ${idx===0?'first':''}">
              <div class="eyebrow">${medals[idx]}</div>
              <div style="display:flex;justify-content:center;margin:4px 0">
                <span class="rankAvatar">${escText((item.name||'C').trim().slice(0,1).toUpperCase())}</span>
              </div>
              <strong style="font-size:1rem">${escText(item.name)}${item.is_me?' (Você)':''}</strong>
              ${renderRoleBadgesHtml(item.role,item.secondary_role,true)}
              <div style="font-size:1.25rem;font-weight:900;color:var(--gold);margin-top:4px">🔥 ${Number(item.streak||0)} dia${Number(item.streak||0)===1?'':'s'} de ofensiva</div>
              <div class="small muted">${escText(rankLabelForXp(item.xp))} · ${Number(item.xp||0)} XP</div>
              <div class="small muted">🎯 ${Number(item.accuracy||0)}% acertos · ✓ ${Number(item.missions_done||0)} missões concluídas</div>
            </div>
          `).join('')}
        </div>
      `:''}

      <div class="card">
        <div class="sectionHead">
          <h3>Classificação Geral</h3>
          <span class="tag">${filtered.length} participante${filtered.length===1?'':'s'}</span>
        </div>
        <div>
          ${filtered.map((item,idx)=>{
            const studiedToday=item.last_study===todayStr;
            return `
              <div class="rankRow ${item.is_me?'isMe':''}">
                <div class="rankPos">#${idx+1}</div>
                <div class="rankRowMain" style="display:flex;align-items:center;gap:10px;min-width:0">
                  <span class="rankAvatar">${escText((item.name||'C').trim().slice(0,1).toUpperCase())}</span>
                  <div style="min-width:0;flex:1">
                    <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      ${escText(item.name)}${item.is_me?' <span class="tag" style="padding:2px 6px;font-size:.68rem">Você</span>':''}
                      ${studiedToday?' <span style="color:#4ade80;font-size:.75rem;font-weight:700">● Estudou hoje</span>':''}
                    </div>
                    ${renderRoleBadgesHtml(item.role,item.secondary_role,false)}
                    <div class="small muted" style="margin-top:2px">${escText(rankLabelForXp(item.xp))}</div>
                  </div>
                </div>
                <div class="rankRowMetrics small muted">
                  <span>🎯 <b>${Number(item.accuracy||0)}%</b> acertos</span>
                  <span>✓ <b>${Number(item.missions_done||0)}</b> missões</span>
                  <span>Rec: <b>${Number(item.best_streak||0)}d</b></span>
                  ${!item.is_me?`<button type="button" class="ghost small" style="padding:4px 9px;min-height:28px;font-size:.73rem" data-challenge-from-rank="${escText(item.user_id)}|${escText(item.name)}">⚔️ Desafiar X1</button>`:''}
                </div>
                <div class="rankRowRight" style="text-align:right">
                  <div style="font-weight:900;color:var(--gold);font-size:1.02rem">🔥 ${Number(item.streak||0)}d</div>
                  <div class="small muted">${Number(item.xp||0)} XP</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    q('#refreshRankingBtn').onclick=()=>loadHuntersLeaderboard(true);
    if(q('#openDuelArenaFromRankBtn'))q('#openDuelArenaFromRankBtn').onclick=()=>openView('duel');
    qa('[data-challenge-from-rank]').forEach(btn=>{
      btn.onclick=()=>{
        const [uid,uname]=btn.dataset.challengeFromRank.split('|');
        selectedDuelOpponentId=uid;
        selectedDuelOpponentName=uname;
        openView('duel');
      };
    });
    if(q('#dedupRankingBtn'))q('#dedupRankingBtn').onclick=async()=>{
      try{
        const res=await cloudFetch('rpc/cleanup_duplicate_hunter_profiles',{method:'POST',body:JSON.stringify({})});
        const data=await res.json().catch(()=>({}));
        const removed=Number(data?.removed_count||0);
        await loadHuntersLeaderboard(false);
        toast(removed>0?`✓ ${removed} perfil(is) duplicado(s) excluído(s) do banco!`:'✓ Nenhum perfil duplicado pendente no banco (apenas 1 conta por participante).');
      }catch{
        await loadHuntersLeaderboard(false);
        toast('Lista deduplicada! Execute a migração v92 no SQL Editor do Supabase para excluir duplicados do banco.');
      }
    };
    q('#shareAppRankingBtn').onclick=async()=>{
      const rolesText=me.secondary_role?`${me.role} e ${me.secondary_role}`:me.role;
      const shareText=`🔥 Estou estudando no Jornada do Caçador para ${rolesText} (${me.streak} dias de ofensiva e ${me.xp} XP)! Entre no app, compartilhe materiais da prova e dispute no Ranking: https://jornada.wcaio.workers.dev`;
      if(navigator.share){
        try{await navigator.share({title:'Jornada do Caçador — Ranking',text:shareText,url:'https://jornada.wcaio.workers.dev'});return}catch{}
      }
      try{await navigator.clipboard.writeText(shareText);toast('Convite copiado! Cole no WhatsApp dos seus amigos.')}catch{toast('Compartilhe o link: https://jornada.wcaio.workers.dev')}
    };
    q('#saveRankProfileBtn').onclick=async()=>{
      state.publicProfile=state.publicProfile||{};
      state.publicProfile.name=q('#rankProfileNameInput')?.value?.trim()||me.name;
      state.publicProfile.role=q('#rankProfileRoleInput')?.value?.trim()||me.role;
      state.publicProfile.secondaryRole=q('#rankProfileSecRoleInput')?.value?.trim()||'';
      state.publicProfile.hidden=!!q('#rankProfileHideToggle')?.checked;
      syncHunterStatsSnapshot();
      const roles=detectUserRoles();
      if(state.hunterStats){
        state.hunterStats.role=roles.primary;
        state.hunterStats.secondaryRole=roles.secondary;
      }
      save();
      if(cloudSession&&navigator.onLine)await pushCloudState();
      await loadHuntersLeaderboard(true);
      toast('Seu perfil primário e secundário no Ranking foi salvo!');
    };
    qa('[data-rank-sort]').forEach(btn=>{
      btn.onclick=()=>{
        leaderboardSort=btn.dataset.rankSort;
        renderHuntersLeaderboard();
      };
    });
    if(q('#rankRoleFilterSelect'))q('#rankRoleFilterSelect').onchange=e=>{
      leaderboardRoleFilter=e.target.value;
      renderHuntersLeaderboard();
    };
  }

  function ensureTafAndRankingShortcuts(){
    const todayCmd=q('#todayCommand');
    if(todayCmd&&!q('#openTafShortcut')){
      todayCmd.insertAdjacentHTML('beforeend',`
        <button class="commandShortcut" id="openTafShortcut" type="button"><div class="cmdHead"><i>💪</i><span class="cmdPill" id="tafShortcutPill">Aptidão Física</span></div><div><b>Painel TAF</b><span id="tafShortcutMeta">Índices físicos até a prova</span></div></button>
        <button class="commandShortcut" id="openRankingShortcut" type="button"><div class="cmdHead"><i>🏆</i><span class="cmdPill" id="rankingShortcutPill">Comunidade</span></div><div><b>Ranking Geral</b><span id="rankingShortcutMeta">Ofensiva e amigos no banco</span></div></button>
        <button class="commandShortcut" id="openEssayShortcut" type="button"><div class="cmdHead"><i>✍️</i><span class="cmdPill" id="essayShortcutPill">Textos I e II</span></div><div><b>Redação & Temas</b><span id="essayShortcutMeta">Propostas de prova e correção IA</span></div></button>
      `);
      q('#openTafShortcut').onclick=()=>openView('taf');
      q('#openRankingShortcut').onclick=()=>openView('ranking');
      q('#openEssayShortcut').onclick=()=>openView('essay');
    }
    const taf=ensureTafState();
    const readyCount=TAF_ORDER.map(k=>taf.tests[k]).filter(t=>tafMetTarget(t)===true).length;
    if(q('#tafShortcutMeta'))q('#tafShortcutMeta').textContent=`${readyCount}/5 índices aptos no edital`;
    if(q('#tafShortcutPill'))q('#tafShortcutPill').textContent=`${readyCount}/5 aptos`;
    if(q('#rankingShortcutMeta'))q('#rankingShortcutMeta').textContent=`🔥 ${state?.streak||0}d ofensiva · ver caçadores`;
    if(q('#essayShortcutMeta'))q('#essayShortcutMeta').textContent=`${(cloudEssays||[]).length} enviada(s) · sortear tema + textos`;
  }

  // 15. Biblioteca Compartilhada da Comunidade por Concurso (Sem Download do PDF Bruto + Sanitização Anti-CPF)
  let communityCache={slug:'',documents:[],summaries:[],editalTopics:[],loadedAt:0};

  function sanitizePersonalWatermarks(text=''){
    return String(text??'')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}\s*[-/]\s*\d{2}\b/g,'[CPF PROTEGIDO]')
      .replace(/(cpf|inscrito|licenciado para|aluno\(a\)|comprador)\s*[:\-]?\s*[0-9.\-]{8,18}/gi,'$1: [DADO PROTEGIDO]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[EMAIL PROTEGIDO]');
  }

  async function syncCommunityLibraryForActivePortal(){
    if(!cloudSession)return;
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    if(!campaign)return;
    const slug=normalizeExamSlug(campaign.name||'',campaign.organization||'');
    try{
      const res=await cloudFetch('rpc/get_community_exam_library',{
        method:'POST',
        body:JSON.stringify({p_exam_name:campaign.name||'',p_exam_org:campaign.organization||''})
      });
      const data=await res.json().catch(()=>null);
      if(!res.ok||!data)return;
      // Filtrar estritamente: NUNCA compartilhar 'edital' / 'edital_concurso' de outros usuários
      const commDocs=(Array.isArray(data.documents)?data.documents:[]).filter(d=>!['edital','edital_concurso'].includes(d.document_type));
      const commSums=Array.isArray(data.summaries)?data.summaries:[];
      communityCache={slug:data.exam_slug||slug,documents:commDocs,summaries:commSums,editalTopics:[],loadedAt:Date.now()};

      // Remover qualquer edital da comunidade que estivesse em memória
      for(let i=cloudDocuments.length-1;i>=0;i--){
        if(cloudDocuments[i]?.is_community&&['edital','edital_concurso'].includes(cloudDocuments[i].document_type)){
          cloudDocuments.splice(i,1);
        }
      }

      // 1) Mesclar apenas materiais, leis, provas, simulados e anotações da comunidade em cloudDocuments (SEM storage_path)
      const stdTitle=t=>typeof window.standardizeDocumentTitle==='function'?window.standardizeDocumentTitle(sanitizePersonalWatermarks(t)):sanitizePersonalWatermarks(t).toUpperCase();
      const ownTitles=new Set((cloudDocuments||[]).filter(d=>!d.is_community).map(d=>`${d.document_type}|${topicKey(stdTitle(d.title))}`));
      const existingIds=new Set((cloudDocuments||[]).map(d=>d.id));
      let addedDocs=0;
      for(const cDoc of commDocs){
        const formattedTitle=stdTitle(cDoc.title);
        const dedupKey=`${cDoc.document_type}|${topicKey(formattedTitle)}`;
        if(existingIds.has(cDoc.id)||ownTitles.has(dedupKey))continue;
        cloudDocuments.push({
          ...cDoc,
          title:formattedTitle,
          storage_path:null,
          source_url:null,
          is_community:true,
          processing_status:'ready'
        });
        existingIds.add(cDoc.id);
        ownTitles.add(dedupKey);
        addedDocs++;
      }

      // 2) Mesclar resumos, flashcards e questões higienizados nas funções de estudo (ALL_SUMMARIES, ALL_FLASHCARDS, ALL_QUESTIONS)
      const existingSumKeys=new Set((ALL_SUMMARIES||[]).map(s=>`${topicKey(s.category)}|${topicKey(s.title)}`));
      const existingCardKeys=new Set((ALL_FLASHCARDS||[]).map(c=>`${topicKey(c[0])}|${topicKey(c[1])}`));
      const existingQKeys=new Set((ALL_QUESTIONS||[]).map(qItem=>topicKey(qItem.statement).slice(0,80)));

      for(const row of commSums){
        const parentDoc=(cloudDocuments||[]).find(d=>String(d.id)===String(row.source_document_id))||null;
        const cat=typeof window.resolveDocumentDiscipline==='function'
          ?window.resolveDocumentDiscipline(parentDoc,row.content?.subject||'',`${row.content?.source||''} ${row.title||''}`)
          :canonicalSubjectName(row.content?.subject||'Conteúdo geral',`${row.content?.source||''} ${row.title||''}`);
        const cleanTitle=sanitizePersonalWatermarks(row.title||'Assunto da Comunidade');
        const sumKey=`${topicKey(cat)}|${topicKey(cleanTitle)}`;
        if(!existingSumKeys.has(sumKey)){
          ALL_SUMMARIES.push({
            id:row.id,
            documentId:row.source_document_id,
            title:cleanTitle,
            source:`🤝 Comunidade (${sanitizePersonalWatermarks(row.content?.source||'Material compartilhado')})`,
            category:cat,
            explanation:sanitizePersonalWatermarks(row.content?.explanation||''),
            points:(row.content?.points||[]).map(sanitizePersonalWatermarks),
            example:sanitizePersonalWatermarks(row.content?.example||''),
            bizu:sanitizePersonalWatermarks(row.content?.bizu||''),
            mnemonic:sanitizePersonalWatermarks(row.content?.mnemonic||''),
            trap:sanitizePersonalWatermarks(row.content?.trap||''),
            is_community:true
          });
          existingSumKeys.add(sumKey);
        }

        for(const card of (row.content?.flashcards||[])){
          const qText=sanitizePersonalWatermarks(card.question||'');
          const aText=sanitizePersonalWatermarks(card.answer||'');
          const cKey=`${topicKey(cat)}|${topicKey(qText)}`;
          if(qText&&aText&&!existingCardKeys.has(cKey)){
            ALL_FLASHCARDS.push([cat,qText,aText]);
            existingCardKeys.add(cKey);
          }
        }

        for(const qObj of (row.content?.questions||[])){
          if(!Array.isArray(qObj.options)||qObj.options.length!==4||!Number.isInteger(qObj.correct_index))continue;
          const stText=sanitizePersonalWatermarks(qObj.statement||'');
          const qKey=topicKey(stText).slice(0,80);
          if(stText&&!existingQKeys.has(qKey)){
            ALL_QUESTIONS.push({
              subject:cat,
              topic:sanitizePersonalWatermarks(qObj.topic||cleanTitle),
              statement:stText,
              options:qObj.options.map(sanitizePersonalWatermarks),
              correct_index:qObj.correct_index,
              explanation:sanitizePersonalWatermarks(qObj.explanation||''),
              difficulty:qObj.difficulty||'medio',
              origin:qObj.origin||'autoral',
              documentId:row.source_document_id,
              is_community:true
            });
            existingQKeys.add(qKey);
          }
        }
      }

      LEARNING_SUBJECTS=[...new Set([...ALL_SUMMARIES.map(x=>x.category),...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));

      if(addedDocs>0||commSums.length>0||commTopics.length>0){
        if(typeof renderUserDocuments==='function')renderUserDocuments();
        if(typeof renderStudy==='function')renderStudy();
        if(typeof renderLearning==='function')renderLearning();
        if(typeof renderQuestionFilters==='function')renderQuestionFilters();
        renderCommunityCoopBanner();
      }
    }catch{}
  }

  function applyCommunityEditalToPortal(){
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    const rows=communityCache.editalTopics||[];
    if(!campaign||!rows.length)return toast('Nenhum edital da comunidade encontrado para este concurso.');
    const unpacked=typeof window.unpackEditalTopicsList==='function'?window.unpackEditalTopicsList(rows,campaign.name):rows;
    const missions=unpacked.map((row,i)=>({
      id:`edital-comm-${i}`,
      dbId:null,
      si:null,
      ti:i,
      name:sanitizePersonalWatermarks(row.topic),
      subject:canonicalSubjectName(row.subject||'Edital'),
      editalOrder:row.edital_order??i,
      subjectOrder:row.subject_order??0,
      learningOrder:row.learning_order??i,
      difficulty:row.difficulty||'basic',
      prerequisite:row.prerequisite_topic||'',
      pedagogicalReason:row.pedagogical_reason||''
    }));
    state.customCampaign={name:campaign.name,missions};
    campaign.customCampaign=state.customCampaign;
    save();
    render();
    toast(`🤝 Mapa do edital de ${campaign.name} (${missions.length} tópicos) sincronizado da comunidade!`);
  }

  function openProtectedCommunityViewer(docId){
    const doc=(cloudDocuments||[]).find(d=>String(d.id)===String(docId));
    const dlg=q('#communityViewerDialog'),titleEl=q('#communityViewerTitle'),bodyEl=q('#communityViewerBody');
    if(!doc||!dlg||!bodyEl)return;
    const docSummaries=(ALL_SUMMARIES||[]).filter(s=>String(s.documentId)===String(doc.id));
    const docQuestions=(ALL_QUESTIONS||[]).filter(qItem=>String(qItem.documentId)===String(doc.id));
    titleEl.textContent=sanitizePersonalWatermarks(doc.title||'Material da Comunidade');

    bodyEl.innerHTML=`
      <div class="card" style="margin-bottom:12px;background:#071524;border-color:#264f73">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <span class="tag">🤝 Compartilhado por ${escText(doc.author_name||'Colega do concurso')}</span>
            <span class="tag">🔒 Download de PDF bloqueado (Proteção de CPF e Direitos)</span>
          </div>
          <span class="small muted">${docSummaries.length} resumo(s) · ${docQuestions.length} questão(ões) extraída(s)</span>
        </div>
        <p class="small muted" style="margin:8px 0 0">Este material faz parte da rede colaborativa do seu concurso. O arquivo PDF bruto não pode ser baixado para proteger o CPF de quem enviou, mas todo o conteúdo pedagógico abaixo já está integrado aos seus Resumos, Flashcards, Questões e Caderno IA.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${docQuestions.length?`<button type="button" class="action small" id="commViewerStartQuizBtn">🎯 Resolver ${docQuestions.length} Questão(ões) deste Material</button>`:''}
          <button type="button" class="ghost small" id="commViewerOpenSmartBtn">✦ Usar como Fonte no Caderno IA</button>
          <button type="button" class="ghost small" id="commViewerOpenSummariesBtn">📖 Ir para Resumos e Flashcards</button>
        </div>
      </div>

      ${docSummaries.length?docSummaries.map((s,idx)=>`
        <article class="card" style="margin-bottom:10px">
          <div class="eyebrow">${escText(s.category||'Disciplina')} · Tópico ${idx+1}</div>
          <h3 style="margin:3px 0 8px">${escText(s.title)}</h3>
          <p style="line-height:1.6">${escText(s.explanation||'')}</p>
          ${(s.points||[]).length?`<div class="lessonBox"><b>Pontos essenciais</b><ul>${s.points.map(p=>`<li>${escText(p)}</li>`).join('')}</ul></div>`:''}
          ${s.bizu?`<div class="lessonBox bizu"><b>⚡ Bizu de Prova</b><p>${escText(s.bizu)}</p></div>`:''}
          ${s.mnemonic?`<div class="lessonBox"><b>🧠 Mnemônico</b><p>${escText(s.mnemonic)}</p></div>`:''}
          ${s.trap?`<div class="lessonBox trap"><b>⚠️ Pegadinha da Banca</b><p>${escText(s.trap)}</p></div>`:''}
        </article>
      `).join(''):'<div class="empty">Os tópicos e questões deste arquivo já estão integrados ao seu banco de estudo.</div>'}
    `;

    q('#closeCommunityViewer').onclick=()=>dlg.close();
    if(q('#commViewerStartQuizBtn'))q('#commViewerStartQuizBtn').onclick=()=>{
      dlg.close();
      activeQuestions={
        mode:'battle',
        subject:doc.title,
        questions:docQuestions.slice(0,10).map(prepareQuestion),
        current:0,
        correct:0,
        answered:false
      };
      q('#questionDialogTitle').textContent=`🤝 Questões: ${doc.title}`;
      q('#questionDialog').showModal();
      showQuestion();
    };
    if(q('#commViewerOpenSmartBtn'))q('#commViewerOpenSmartBtn').onclick=()=>{
      dlg.close();
      openView('study');
      const smartTab=q('[data-study="smart"]');
      if(smartTab)smartTab.click();
    };
    if(q('#commViewerOpenSummariesBtn'))q('#commViewerOpenSummariesBtn').onclick=()=>{
      dlg.close();
      openView('study');
    };
    dlg.showModal();
  }

  function renderCommunityCoopBanner(){
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    const commDocs=(cloudDocuments||[]).filter(d=>d.is_community);
    const commSums=(ALL_SUMMARIES||[]).filter(s=>s.is_community);
    const commQs=(ALL_QUESTIONS||[]).filter(qItem=>qItem.is_community);
    const commTopics=communityCache.editalTopics||[];
    const libSection=q('#library');
    if(libSection){
      let banner=q('#communityCoopBanner');
      if(!banner){
        const uploadZone=libSection.querySelector('.uploadZone');
        if(uploadZone){
          uploadZone.insertAdjacentHTML('afterend','<div class="communityBanner" id="communityCoopBanner"></div>');
          banner=q('#communityCoopBanner');
        }
      }
      if(banner){
        const slugUpper=(communityCache.slug||normalizeExamSlug(campaign?.name||'')).toUpperCase();
        banner.innerHTML=`
          <div>
            <div class="eyebrow">🤝 REDE COOPERATIVA DO CONCURSO · PERFIL ${escText(slugUpper)}</div>
            <b>Biblioteca Compartilhada da Comunidade (${escText(campaign?.name||'Concurso')})</b>
            <div class="small muted">Materiais de estudo, leis, provas e simulados analisados por colegas do mesmo concurso ficam disponíveis para visualização protegida e estudo (o Edital permanece individual de cada usuário e o PDF original fica bloqueado contra download).</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span class="tag">${commDocs.length} material(is) da comunidade · ${commSums.length} resumos · ${commQs.length} questões</span>
            <button type="button" class="ghost small" id="syncCommunityNowBtn">↻ Sincronizar Acervo</button>
          </div>
        `;
        if(q('#syncCommunityNowBtn'))q('#syncCommunityNowBtn').onclick=async()=>{
          await syncCommunityLibraryForActivePortal();
          toast('Acervo compartilhado da comunidade sincronizado!');
        };
        if(q('#useCommunityEditalBtn'))q('#useCommunityEditalBtn').onclick=applyCommunityEditalToPortal;
      }
    }
    qa('[data-view-community-doc]').forEach(btn=>{
      btn.onclick=()=>openProtectedCommunityViewer(btn.dataset.viewCommunityDoc);
    });
    qa('[data-title-example]').forEach(el=>{
      el.onclick=()=>{
        const input=q('#documentTitle');
        if(input){input.value=el.dataset.titleExample;input.focus()}
      };
    });
    const docFile=q('#documentFile'),docTitle=q('#documentTitle');
    if(docFile&&!docFile.dataset.stdBound){
      docFile.dataset.stdBound='1';
      docFile.addEventListener('change',()=>{
        const f=docFile.files?.[0];
        if(f&&docTitle&&!docTitle.value.trim()&&typeof window.standardizeDocumentTitle==='function'){
          docTitle.value=window.standardizeDocumentTitle(f.name);
        }
      });
    }
    if(docTitle&&!docTitle.dataset.stdBound){
      docTitle.dataset.stdBound='1';
      docTitle.addEventListener('blur',()=>{
        if(docTitle.value.trim()&&typeof window.standardizeDocumentTitle==='function'){
          docTitle.value=window.standardizeDocumentTitle(docTitle.value);
        }
      });
    }
  }

  // 13. Central de Revisão Inteligente (Ciclo 1-7-30, Revisão Ativa por Questões, Resumo Inline e Raio-X de Véspera Imprimível)
  const HIGH_INCIDENCE_PATTERNS=/direitos e garantias|art\.?\s*5|art\.?\s*144|seguranca publica|inquerito policial|prisao|flagrante|crimes contra a administracao|crimes contra a pessoa|crimes contra o patrimonio|maria da penha|tortura|abuso de autoridade|estatuto do desarmamento|drogas|concordancia|regencia|crase|interpretacao|compreensao|pontuacao|proposicoes|tabela-verdade|porcentagem| atos administrativos|poderes administrativos|licitacoes/i;

  function topicIncidenceLevel(mission){
    const text=`${mission?.subject||''} ${mission?.name||''}`;
    if(HIGH_INCIDENCE_PATTERNS.test(normalizeText(text)))return 'high';
    const relatedQ=(ALL_QUESTIONS||[]).filter(qItem=>topicKey(qItem.subject)===topicKey(mission?.subject)&&normalizeText(qItem.statement||'').includes(normalizeText(mission?.name||'').slice(0,18))).length;
    if(relatedQ>=2)return 'high';
    if(relatedQ===1||/direito|portugues|legislacao|penal|constitucional/i.test(normalizeText(mission?.subject||'')))return 'med';
    return 'low';
  }

  function decorateEditalIncidenceBadges(){
    const missions=typeof missionPool==='function'?missionPool():[];
    if(!missions.length)return;
    qa('#topicList .topic').forEach(row=>{
      if(row.querySelector('.incidenceBadge'))return;
      const chk=row.querySelector('input[data-id]');
      const m=missions.find(item=>String(item.id)===String(chk?.dataset?.id||''));
      if(!m)return;
      const lvl=topicIncidenceLevel(m);
      const titleEl=row.querySelector('b')||row.querySelector('span');
      if(titleEl&&lvl!=='low'){
        titleEl.insertAdjacentHTML('beforeend',lvl==='high'
          ?'<span class="incidenceBadge high" title="Tópico de altíssima incidência em provas policiais">🔥 Alta incidência</span>'
          :'<span class="incidenceBadge med" title="Tópico frequente em provas">⚡ Frequente</span>');
      }
    });
  }

  function forecastNext7DaysReviews(){
    const days=[];
    const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const pool=typeof missionPool==='function'?missionPool():[];
    const intervals=[1,7,30];
    const now=new Date();
    now.setHours(0,0,0,0);
    for(let offset=0;offset<7;offset++){
      const d=new Date(now);
      d.setDate(now.getDate()+offset);
      const dStart=d.getTime(),dEnd=dStart+86399999;
      let count=0;
      for(const m of pool){
        const doneAt=state?.done?.[m.id];
        if(!doneAt)continue;
        for(const step of intervals){
          const key=`${m.id}-${step}`;
          if(state?.reviews?.[key])continue;
          const dueTime=new Date(doneAt).getTime()+step*86400000;
          if(offset===0?(dueTime<=dEnd):(dueTime>=dStart&&dueTime<=dEnd))count++;
        }
      }
      for(const [,err] of Object.entries(state?.errors||{})){
        if(err?.campaignId&&err.campaignId!==state?.activeCampaignId)continue;
        const dueTime=new Date(err?.nextReview||err?.last||0).getTime();
        if(offset===0?(dueTime<=dEnd):(dueTime>=dStart&&dueTime<=dEnd))count++;
      }
      days.push({
        label:offset===0?'Hoje':offset===1?'Amanhã':labels[d.getDay()],
        dateStr:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
        count
      });
    }
    return days;
  }

  function startActiveReviewSession(targetSubject=''){
    const due=typeof dueReviews==='function'?dueReviews():[];
    const dueSubjects=new Set(due.map(x=>topicKey(x.kind==='mission'?x.m?.subject:x.e?.subject)).filter(Boolean));
    let pool=(ALL_QUESTIONS||[]).filter(qItem=>{
      if(targetSubject)return topicKey(qItem.subject)===topicKey(targetSubject);
      return dueSubjects.size?dueSubjects.has(topicKey(qItem.subject)):true;
    });
    if(pool.length<3)pool=(ALL_QUESTIONS||[]);
    if(!pool.length)return toast('Envie um material ou gere questões para iniciar a Revisão Ativa.');
    const count=Math.min(5,pool.length);
    const chosen=typeof balancedQuestions==='function'?balancedQuestions(pool,count):pool.slice(0,count);
    activeQuestions={
      mode:'battle',
      subject:targetSubject?`Revisão Ativa · ${targetSubject}`:'Revisão Ativa dos Tópicos Vencidos',
      questions:chosen.map(prepareQuestion),
      current:0,
      correct:0,
      answered:false
    };
    q('#questionDialogTitle').textContent=targetSubject?`⚡ Revisão Ativa: ${targetSubject}`:'⚡ Sessão de Revisão Ativa';
    q('#questionDialog').showModal();
    showQuestion();
  }

  function exportVesperaRaioX(subjectFilter='all'){
    const campaignName=(typeof activeCampaign==='function'?activeCampaign()?.name:'Meu Concurso')||'Meu Concurso';
    const errors=Object.values(state?.errors||{}).filter(e=>(!e.campaignId||e.campaignId===state?.activeCampaignId)&&(subjectFilter==='all'||topicKey(e.subject)===topicKey(subjectFilter)));
    const summaries=(ALL_SUMMARIES||[]).filter(s=>subjectFilter==='all'||topicKey(s.category)===topicKey(subjectFilter));
    const cards=(ALL_FLASHCARDS||[]).map((c,i)=>({c,i,key:typeof fcKey==='function'?fcKey(c):String(i)})).filter(x=>{
      if(subjectFilter!=='all'&&topicKey(x.c.subject)!==topicKey(subjectFilter))return false;
      const p=typeof fcProgress==='function'?fcProgress(x):null;
      return !p||p.level==='hard'||p.level==='medium';
    });
    const notes=(state?.userNotes||[]).filter(n=>subjectFilter==='all'||topicKey(n.subject||'')===topicKey(subjectFilter));

    const w=window.open('','_blank');
    if(!w)return toast('Permita pop-ups para abrir o Raio-X de Revisão de Véspera.');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Raio-X de Revisão Final — ${escText(campaignName)}</title>
      <style>
        body{font:13px/1.5 Inter,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:860px;margin:20px auto;padding:0 16px}
        header{border:2px solid #0f172a;border-radius:10px;padding:14px 16px;margin-bottom:16px;background:#f8fafc}
        h1{margin:0 0 4px;font-size:1.2rem}
        h2{margin:18px 0 8px;font-size:1rem;border-bottom:2px solid #cbd5e1;padding-bottom:4px;color:#0369a1;text-transform:uppercase}
        .box{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;margin-bottom:8px;break-inside:avoid}
        .bizu{background:#f0fdf4;border-left:4px solid #16a34a}
        .trap{background:#fef2f2;border-left:4px solid #dc2626}
        .err{background:#fffbeb;border-left:4px solid #d97706}
        .tag{display:inline-block;padding:2px 7px;border-radius:99px;font-size:.72rem;font-weight:700;background:#e2e8f0;margin-right:6px}
        @media print{.noPrint{display:none}body{margin:8mm;max-width:none}}
      </style>
    </head><body>
      <div class="noPrint" style="display:flex;justify-content:space-between;align-items:center;background:#e0f2fe;padding:10px 14px;border-radius:8px;margin-bottom:14px">
        <span><b>Raio-X de Revisão de Véspera (${escText(subjectFilter==='all'?'Todas as Disciplinas':subjectFilter)})</b> — pronto para imprimir ou salvar em PDF</span>
        <button onclick="window.print()" style="padding:8px 14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
      </div>
      <header>
        <h1>RAIO-X DE REVISÃO DE VÉSPERA · ${escText(campaignName.toUpperCase())}</h1>
        <div>Disciplina: <b>${escText(subjectFilter==='all'?'Todas as disciplinas do portal':subjectFilter)}</b> · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
        <div style="font-size:.8rem;color:#475569;margin-top:4px">Resumo tático personalizado contendo seus erros recorrentes, bizus de prova, pegadinhas de banca, flashcards críticos e anotações.</div>
      </header>

      <h2>1. Pontos Críticos do Seu Caderno de Erros (${errors.length})</h2>
      ${errors.length?errors.map(e=>`
        <div class="box err">
          <div><span class="tag">${escText(e.subject||'Disciplina')}</span><b>${escText(e.topic||'Tópico')}</b> (${Number(e.misses||1)} erro(s))</div>
          ${e.question?`<div style="margin-top:4px"><b>Questão:</b> ${escText(e.question)}</div>`:''}
          ${e.correctAnswer?`<div style="margin-top:2px;color:#15803d"><b>Gabarito / Conceito correto:</b> ${escText(e.correctAnswer)}</div>`:''}
          ${e.explanation?`<div style="margin-top:3px"><b>Bizu de correção:</b> ${escText(e.explanation)}</div>`:''}
        </div>
      `).join(''):'<p>Nenhum erro ativo registrado para este filtro.</p>'}

      <h2>2. Bizus, Mnemônicos e Pegadinhas de Banca (${summaries.length})</h2>
      ${summaries.length?summaries.slice(0,40).map(s=>`
        <div class="box bizu">
          <div><span class="tag">${escText(s.category||'Matéria')}</span><b>${escText(s.title||'Assunto')}</b></div>
          ${s.bizu?`<div style="margin-top:4px"><b>⚡ Bizu:</b> ${escText(s.bizu)}</div>`:''}
          ${s.mnemonic?`<div style="margin-top:2px"><b>🧠 Mnemônico:</b> ${escText(s.mnemonic)}</div>`:''}
          ${s.trap?`<div class="trap" style="padding:6px 8px;margin-top:4px"><b>⚠️ Pegadinha de prova:</b> ${escText(s.trap)}</div>`:''}
          ${!s.bizu&&!s.trap&&s.explanation?`<div style="margin-top:4px">${escText(String(s.explanation).slice(0,260))}</div>`:''}
        </div>
      `).join(''):'<p>Envie PDFs na Biblioteca para extrair bizus e pegadinhas das matérias.</p>'}

      <h2>3. Flashcards Prioritários de Memorização (${Math.min(30,cards.length)})</h2>
      ${cards.length?cards.slice(0,30).map(x=>`
        <div class="box">
          <div><span class="tag">${escText(x.c.subject||'Disciplina')}</span><b>P: ${escText(x.c.front)}</b></div>
          <div style="margin-top:3px"><b>R:</b> ${escText(x.c.back)}</div>
        </div>
      `).join(''):'<p>Nenhum flashcard pendente neste filtro.</p>'}

      ${notes.length?`
        <h2>4. Suas Anotações e Bizus Pessoais (${notes.length})</h2>
        ${notes.map(n=>`<div class="box"><b>${escText(n.title||'Nota')}</b><div>${escText(n.text||n.content||'')}</div></div>`).join('')}
      `:''}
    </body></html>`);
    w.document.close();
  }

  function enhanceReviewCenter(){
    const reviewSection=q('#review');
    if(!reviewSection)return;
    let hub=q('#smartReviewHub');
    if(!hub){
      const firstCard=reviewSection.querySelector('.card');
      if(firstCard){
        firstCard.insertAdjacentHTML('beforebegin','<div class="reviewHubCard" id="smartReviewHub"></div>');
        hub=q('#smartReviewHub');
      }
    }
    if(!hub)return;

    const dueList=typeof dueReviews==='function'?dueReviews():[];
    const now=Date.now();
    const fcDueCount=(ALL_FLASHCARDS||[]).map((c,i)=>({c,i,key:typeof fcKey==='function'?fcKey(c):String(i)})).filter(x=>typeof fcDue==='function'?fcDue(fcProgress(x),now):false).length;
    const activeErrors=Object.values(state?.errors||{}).filter(e=>!e.campaignId||e.campaignId===state?.activeCampaignId).length;
    const doneRevs=Object.keys(state?.reviews||{}).length;
    const forecast=forecastNext7DaysReviews();
    const subjects=[...new Set([
      ...(typeof missionPool==='function'?missionPool().map(m=>m.subject):[]),
      ...(ALL_SUMMARIES||[]).map(s=>s.category),
      ...Object.values(state?.errors||{}).map(e=>e.subject)
    ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));

    hub.innerHTML=`
      <div class="sectionHead" style="margin:0">
        <div>
          <div class="eyebrow">SISTEMA DE RETENÇÃO ESPAÇADA (1 · 7 · 30 DIAS + CADERNO DE ERROS)</div>
          <h3 style="margin:2px 0 0">Central de Revisão Ativa e Raio-X de Véspera</h3>
        </div>
        <span class="tag">${dueList.length+fcDueCount} itens para revisar hoje</span>
      </div>

      <div class="reviewStatsGrid">
        <div class="reviewStatBox"><b>${dueList.length}</b><span>tópicos/erros vencidos hoje</span></div>
        <div class="reviewStatBox"><b>${fcDueCount}</b><span>flashcards para revisar agora</span></div>
        <div class="reviewStatBox"><b>${activeErrors}</b><span>erros ativos no caderno</span></div>
        <div class="reviewStatBox"><b>${doneRevs}</b><span>revisões já concluídas</span></div>
      </div>

      <div>
        <div class="small muted" style="margin-bottom:6px;font-weight:700">PREVISÃO DE REVISÕES DOS PRÓXIMOS 7 DIAS</div>
        <div class="reviewScheduleRow">
          ${forecast.map(d=>`
            <div class="reviewDayChip ${d.count>0?'hasDue':''}">
              <span>${escText(d.label)} (${escText(d.dateStr)})</span>
              <b>${d.count} ${d.count===1?'item':'itens'}</b>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="reviewActionsBar">
        <button type="button" class="action small" id="startActiveReviewQuizBtn">⚡ Revisão Ativa (Questões dos Vencidos)</button>
        <button type="button" class="ghost small" id="openDueFlashcardsFromRevBtn">🃏 Revisar Flashcards (${fcDueCount})</button>
        <div style="display:flex;gap:6px;flex:1.2;min-width:250px">
          <select id="vesperaSubjectSelect" style="flex:1">
            <option value="all">Raio-X: Todas as matérias</option>
            ${subjects.map(s=>`<option value="${escText(s)}">${escText(s)}</option>`).join('')}
          </select>
          <button type="button" class="ghost small" id="exportVesperaRaioXBtn" style="min-width:170px">🖨️ Raio-X de Véspera</button>
        </div>
      </div>
    `;

    q('#startActiveReviewQuizBtn').onclick=()=>startActiveReviewSession('');
    q('#openDueFlashcardsFromRevBtn').onclick=()=>{
      openView('study');
      const cardTab=q('[data-study="cards"]');
      if(cardTab)cardTab.click();
      const dueToggle=q('#flashDueOnlyToggle');
      if(dueToggle&&!dueToggle.checked){dueToggle.checked=true;dueToggle.dispatchEvent(new Event('change'))}
    };
    q('#exportVesperaRaioXBtn').onclick=()=>{
      exportVesperaRaioX(q('#vesperaSubjectSelect')?.value||'all');
    };

    // Enriquecer cada item do #reviewList dentro de .reviewCardActions mantendo layout empilhado 100% responsivo no mobile
    qa('#reviewList .topic').forEach(itemEl=>{
      if(itemEl.querySelector('[data-rev-quick-quiz]'))return;
      const titleText=itemEl.querySelector('b')?.textContent?.trim()||'';
      const metaText=itemEl.querySelector('.small.muted')?.textContent||'';
      const subjGuess=subjects.find(s=>metaText.includes(s))||'';
      const actionsBar=itemEl.querySelector('.reviewCardActions')||itemEl;
      const existingBtn=actionsBar.querySelector('button');
      if(!existingBtn)return;
      const quizBtn=document.createElement('button');
      quizBtn.type='button';
      quizBtn.className='ghost small';
      quizBtn.dataset.revQuickQuiz='1';
      quizBtn.textContent='🎯 Testar questões';
      quizBtn.onclick=()=>startActiveReviewSession(subjGuess);
      actionsBar.insertBefore(quizBtn,existingBtn);

      const relatedSum=(ALL_SUMMARIES||[]).find(s=>
        (subjGuess&&topicKey(s.category)===topicKey(subjGuess)&&normalizeText(s.title).includes(normalizeText(titleText).slice(0,16)))||
        normalizeText(s.title).includes(normalizeText(titleText).slice(0,22))
      );
      if(relatedSum){
        const sumBtn=document.createElement('button');
        sumBtn.type='button';
        sumBtn.className='ghost small';
        sumBtn.textContent='📖 Ver resumo';
        sumBtn.onclick=()=>{
          let preview=itemEl.querySelector('.revInlineSummary');
          if(preview){preview.remove();return}
          preview=document.createElement('div');
          preview.className='lessonBox bizu revInlineSummary';
          preview.style.cssText='width:100%;margin-top:8px';
          preview.innerHTML=`<b>${escText(relatedSum.title)}</b><p style="margin:4px 0">${escText(relatedSum.explanation||'')}</p>${relatedSum.bizu?`<div class="small"><b>⚡ Bizu:</b> ${escText(relatedSum.bizu)}</div>`:''}`;
          itemEl.appendChild(preview);
        };
        actionsBar.insertBefore(sumBtn,quizBtn);
      }
    });
  }

  // 14. Modo Redação Digitada na Tela (gera folha PNG automaticamente se o aluno preferir digitar em vez de enviar foto/PDF)
  function enhanceTypedEssayOption(){
    const fileInput=q('#essayFile');
    if(!fileInput||q('#typedEssayBox'))return;
    const fieldLabel=fileInput.closest('label');
    if(!fieldLabel)return;
    fieldLabel.insertAdjacentHTML('afterend',`
      <div class="card" id="typedEssayBox" style="padding:12px 14px;margin:8px 0 12px;background:#071320;border:1px solid #1e3a54">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <b style="font-size:.88rem">✍️ Opcional: Digitar redação direto na tela (sem precisar de foto/PDF)</b>
          <span class="tag" id="typedEssayCounter">0 linhas · 0 palavras</span>
        </div>
        <textarea id="typedEssayText" rows="7" maxlength="4500" placeholder="Se você estiver sem papel agora, digite sua redação aqui (de 20 a 30 linhas). Ao clicar em 'Converter texto digitado em folha para correção', ela será anexada automaticamente no campo de arquivo acima!"></textarea>
        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="small muted">Dica: ~75 caracteres equivalem a 1 linha manuscrita na folha oficial.</span>
          <button type="button" class="ghost small" id="attachTypedEssayBtn">📄 Converter texto digitado para correção</button>
        </div>
      </div>
    `);
    const ta=q('#typedEssayText'),counter=q('#typedEssayCounter');
    ta.oninput=()=>{
      const text=ta.value.trim();
      const words=text?text.split(/\s+/).length:0;
      const estLines=text?Math.max(1,Math.ceil(text.length/75)):0;
      counter.textContent=`~${estLines} linha${estLines===1?'':'s'} · ${words} palavra${words===1?'':'s'}`;
    };
    q('#attachTypedEssayBtn').onclick=async()=>{
      const text=ta.value.trim();
      if(text.length<80)return toast('Digite ao menos um parágrafo completo antes de converter para folha de correção.');
      const canvas=document.createElement('canvas');
      canvas.width=1240;
      canvas.height=1754;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#0f172a';
      ctx.font='bold 24px Arial, sans-serif';
      const title=q('#essayTitle')?.value?.trim()||'Redação Simulada';
      const theme=q('#essayTheme')?.value?.trim()||'Tema Oficial';
      ctx.fillText(`FOLHA DE REDAÇÃO — ${title.slice(0,55)}`,60,60);
      ctx.font='18px Arial, sans-serif';
      ctx.fillStyle='#334155';
      ctx.fillText(`Tema: ${theme.slice(0,85)}`,60,92);

      // Quebrar texto em linhas de até 82 caracteres respeitando parágrafos
      const wrapped=[];
      for(const para of text.split(/\n+/)){
        const words=para.trim().split(/\s+/).filter(Boolean);
        let line='    ';
        for(const w of words){
          if((line+' '+w).length>84){
            wrapped.push(line);
            line=w;
          }else{
            line=line==='    '?`    ${w}`:`${line} ${w}`;
          }
        }
        if(line.trim())wrapped.push(line);
      }

      ctx.font='21px Georgia, serif';
      for(let i=0;i<35;i++){
        const y=145+i*43;
        ctx.strokeStyle='#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(60,y+8);
        ctx.lineTo(1180,y+8);
        ctx.stroke();
        ctx.fillStyle='#64748b';
        ctx.font='bold 16px Arial, sans-serif';
        ctx.fillText(String(i+1).padStart(2,'0'),24,y);
        if(wrapped[i]){
          ctx.fillStyle='#0f172a';
          ctx.font='21px Georgia, serif';
          ctx.fillText(wrapped[i],66,y);
        }
      }

      const blob=await new Promise(res=>canvas.toBlob(res,'image/png',0.95));
      if(!blob)return toast('Não foi possível gerar a folha da redação.');
      const file=new File([blob],'redacao-digitada.png',{type:'image/png'});
      const dt=new DataTransfer();
      dt.items.add(file);
      fileInput.files=dt.files;
      if(q('#essayLines')&&!q('#essayLines').value)q('#essayLines').value='30';
      toast(`Redação digitada convertida (${wrapped.length} linhas) e pronta! Agora clique em "Enviar e corrigir redação".`);
    };
  }


  // 16. Arena de Duelos X1 (Estilo Perguntados — Cross-Platform PC ↔ Celular, Sem afetar o XP de estudo)
  let duelHubData={players:[],my_duels:[],completed_duels:[]},duelHubBusy=false,duelSqlMissing=false;
  let selectedDuelOpponentId='',selectedDuelOpponentName='',activeDuelSession=null,duelRoundTimer=null,duelPollTimer=null;

  const FALLBACK_DUEL_QUESTIONS=[
    {subject:'Direito Constitucional',topic:'Art. 5º — Direitos e Garantias Fundamentais',difficulty:'medio',statement:'Segundo o art. 5º, XI, da Constituição Federal, a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, SALVO:',options:['Apenas por determinação judicial, a qualquer hora do dia ou da noite.','Em caso de flagrante delito ou desastre, ou para prestar socorro, ou, durante o dia, por determinação judicial.','Durante a noite, mediante mandado policial expedido pelo Delegado de Polícia.','A qualquer hora, para cumprimento de intimação administrativa urgente.'],correct_index:1,explanation:'Pelo art. 5º, XI, da CF/88: flagrante delito, desastre ou prestar socorro podem ocorrer a qualquer hora (dia ou noite); já por determinação judicial, SOMENTE durante o dia.'},
    {subject:'Direito Constitucional',topic:'Art. 144 — Segurança Pública',difficulty:'facil',statement:'De acordo com o art. 144, § 5º, da Constituição Federal, cabem à Polícia Militar:',options:['A apuração de infrações penais comuns e o exercício da polícia judiciária da União.','A polícia ostensiva e a preservação da ordem pública.','O patrulhamento ostensivo das rodovias e ferrovias federais.','A execução exclusiva das atividades de defesa civil em âmbito federal.'],correct_index:1,explanation:'Art. 144, § 5º, CF/88: Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública.'},
    {subject:'Legislação Extravagante',topic:'Lei nº 9.455/1997 — Crimes de Tortura',difficulty:'dificil',statement:'Acerca da Lei nº 9.455/1997 (Crimes de Tortura), assinale a alternativa CORRETA:',options:['O crime de tortura é afiançável e suscetível de graça ou anistia se praticado por particular.','Aquele que se omite em face dessas condutas, quando tinha o dever de evitá-las ou apurá-las, incorre na pena de detenção de 1 a 4 anos.','O crime de tortura só pode ser praticado por funcionário público no exercício da função (crime próprio em todas as modalidades).','A condenação acarreta a perda do cargo apenas se o agente for reincidente específico.'],correct_index:1,explanation:'Na tortura omissiva (art. 1º, § 2º, da Lei 9.455/97), a pena é de DETENÇÃO de 1 a 4 anos (diferente das formas comissivas, punidas com reclusão).'},
    {subject:'Língua Portuguesa',topic:'Sintaxe e Conjunções Subordinativas',difficulty:'medio',statement:'No período "Embora o suspeito tenha fugido, a guarnição conseguiu recuperar o veículo minutos depois", a conjunção destacada estabelece relação semântica de:',options:['Causa.','Condição.','Concessão.','Proporção.'],correct_index:2,explanation:'"Embora" é a conjunção subordinativa adverbial concessiva clássica, introduzindo um fato contrário que não impede a realização da oração principal.'},
    {subject:'Direito Penal',topic:'Excludentes de Ilicitude (Art. 23 do CP)',difficulty:'facil',statement:'NÃO constitui causa de exclusão da ilicitude (antijuridicidade) prevista no art. 23 do Código Penal:',options:['Estado de necessidade.','Legítima defesa.','Arrependimento posterior.','Estrito cumprimento de dever legal.'],correct_index:2,explanation:'As excludentes de ilicitude do art. 23 são: Estado de Necessidade, Legítima Defesa, Estrito Cumprimento de Dever Legal e Exercício Regular de Direito (Bizu: BRUCE LEE). O arrependimento posterior (art. 16) é causa de diminuição de pena.'},
    {subject:'Legislação Extravagante',topic:'Lei Maria da Penha (Lei nº 11.340/2006)',difficulty:'dificil',statement:'Sobre as medidas protetivas de urgência na Lei nº 11.340/2006 e o entendimento dos Tribunais Superiores, é CORRETO afirmar:',options:['O crime de descumprimento de medida protetiva (art. 24-A) deixa de existir se a medida tiver sido deferida por juízo cível.','A concessão de medida protetiva de urgência independe do registro de boletim de ocorrência ou do ajuizamento de ação penal ou cível.','Nos crimes de lesão corporal praticados com violência doméstica contra a mulher, a ação penal é pública condicionada à representação.','É permitida a aplicação de penas de cesta básica nos casos de violência doméstica de menor potencial ofensivo.'],correct_index:1,explanation:'As medidas protetivas têm natureza autônoma de tutela de urgência; além disso, pela Súmula 542 do STJ, a lesão corporal em violência doméstica é de ação penal pública INCONDICIONADA, e o art. 17 veda cesta básica.'},
    {subject:'Direito Processual Penal',topic:'Inquérito Policial',difficulty:'medio',statement:'Assinale a característica CORRETA do Inquérito Policial no direito brasileiro:',options:['É procedimento escrito, inquisitivo, sigiloso e dispensável para o oferecimento da denúncia quando já houver justa causa.','É procedimento contraditório obrigatório, sob pena de nulidade absoluta da ação penal subsequente.','A autoridade policial pode mandar arquivar os autos do inquérito policial sempre que verificar atipicidade.','O ofendido não pode requerer diligências durante o curso do inquérito policial.'],correct_index:0,explanation:'O IP é escrito, sigiloso, inquisitivo e dispensável (se o MP já dispuser de elementos de informação suficientes). Pelo art. 17 do CPP, a autoridade policial NUNCA pode mandar arquivar autos de inquérito.'}
  ];

  function buildDuelQuestionPack(subjectFilter='all',mode='misto',count=5){
    let pool=(ALL_QUESTIONS||[]).filter(qItem=>Array.isArray(qItem.options)&&qItem.options.length===4&&Number.isInteger(qItem.correct_index));
    if(subjectFilter&&subjectFilter!=='all'){
      const bySubj=pool.filter(qItem=>topicKey(qItem.subject)===topicKey(subjectFilter));
      if(bySubj.length>=3)pool=bySubj;
    }
    if(mode==='dificil'){
      const hard=pool.filter(qItem=>normalizeText(qItem.difficulty||'').startsWith('dif'));
      if(hard.length>=3)pool=hard;
    }else if(mode==='fixacao'){
      const easyMed=pool.filter(qItem=>!normalizeText(qItem.difficulty||'').startsWith('dif'));
      if(easyMed.length>=3)pool=easyMed;
    }
    if(pool.length<count){
      pool=[...pool,...FALLBACK_DUEL_QUESTIONS];
    }
    const shuffled=pool.slice().sort(()=>Math.random()-0.5);
    const picked=[];
    const usedStatements=new Set();
    for(const item of shuffled){
      const key=topicKey(item.statement).slice(0,70);
      if(usedStatements.has(key))continue;
      usedStatements.add(key);
      picked.push({
        subject:canonicalSubjectName(item.subject||'Geral'),
        topic:item.topic||item.subject||'Desafio X1',
        difficulty:item.difficulty||'medio',
        statement:typeof window.formatQuestionStatementText==='function'?window.formatQuestionStatementText(item.statement):item.statement,
        options:item.options.slice(0,4),
        correct_index:Number(item.correct_index)||0,
        explanation:item.explanation||'Confira o fundamento teórico na Central de Estudo.'
      });
      if(picked.length>=count)break;
    }
    return picked;
  }

  function computeArenaStatsAndRivalries(){
    const myId=cloudSession?.user?.id||'local';
    const players=Array.isArray(duelHubData.players)?duelHubData.players:[];
    const completed=(Array.isArray(duelHubData.completed_duels)?duelHubData.completed_duels:[]).slice().sort((a,b)=>new Date(a.completed_at||a.created_at).getTime()-new Date(b.completed_at||b.created_at).getTime());

    const statsByUser=new Map();
    for(const p of players){
      statsByUser.set(p.user_id,{
        user_id:p.user_id,
        name:p.name,
        role:p.role,
        is_me:p.is_me||p.user_id===myId,
        is_online:p.is_online,
        wins:0,
        losses:0,
        draws:0,
        streak:0,
        best_streak:0,
        total_correct:0
      });
    }

    // Confronto direto (Head-to-Head) e sequência consecutiva contra cada rival ("Freguesia / Dominação")
    const pairHistory=new Map();

    for(const d of completed){
      const cId=d.challenger_id,oId=d.opponent_id;
      if(!statsByUser.has(cId))statsByUser.set(cId,{user_id:cId,name:d.challenger_name||'Caçador',role:'PMPE',is_me:cId===myId,wins:0,losses:0,draws:0,streak:0,best_streak:0,total_correct:0});
      if(!statsByUser.has(oId))statsByUser.set(oId,{user_id:oId,name:d.opponent_name||'Caçador',role:'PMPE',is_me:oId===myId,wins:0,losses:0,draws:0,streak:0,best_streak:0,total_correct:0});
      const cStat=statsByUser.get(cId),oStat=statsByUser.get(oId);
      cStat.total_correct+=Number(d.challenger_score||0);
      oStat.total_correct+=Number(d.opponent_score||0);

      if(d.is_draw||!d.winner_id){
        cStat.draws++;oStat.draws++;
        cStat.streak=0;oStat.streak=0;
      }else if(d.winner_id===cId){
        cStat.wins++;oStat.losses++;
        cStat.streak++;cStat.best_streak=Math.max(cStat.best_streak,cStat.streak);
        oStat.streak=0;
      }else if(d.winner_id===oId){
        oStat.wins++;cStat.losses++;
        oStat.streak++;oStat.best_streak=Math.max(oStat.best_streak,oStat.streak);
        cStat.streak=0;
      }

      const pairKey=[cId,oId].sort().join('|');
      const rec=pairHistory.get(pairKey)||{u1:cId,u1Name:cStat.name,u2:oId,u2Name:oStat.name,wins:{[cId]:0,[oId]:0},draws:0,lastWinner:null,consecutiveWins:0};
      rec.u1Name=statsByUser.get(rec.u1)?.name||rec.u1Name;
      rec.u2Name=statsByUser.get(rec.u2)?.name||rec.u2Name;
      if(d.is_draw||!d.winner_id){
        rec.draws++;
        rec.lastWinner=null;
        rec.consecutiveWins=0;
      }else{
        rec.wins[d.winner_id]=(rec.wins[d.winner_id]||0)+1;
        if(rec.lastWinner===d.winner_id){
          rec.consecutiveWins++;
        }else{
          rec.lastWinner=d.winner_id;
          rec.consecutiveWins=1;
        }
      }
      pairHistory.set(pairKey,rec);
    }

    const ranking=[...statsByUser.values()].sort((a,b)=>(b.wins-a.wins)||(b.streak-a.streak)||(a.losses-b.losses)||(b.total_correct-a.total_correct));
    const dominations=[...pairHistory.values()].filter(r=>r.lastWinner&&r.consecutiveWins>=1).sort((a,b)=>b.consecutiveWins-a.consecutiveWins);
    return {ranking,dominations,pairHistory};
  }

  async function loadDuelArenaHub(silent=false){
    if(duelHubBusy)return;
    duelHubBusy=true;
    if(!silent)renderDuelArena();
    try{
      if(!cloudSession){
        duelHubData={players:[localHunterRow()],my_duels:[],completed_duels:[]};
        return;
      }
      const res=await cloudFetch('rpc/get_duel_arena_hub',{method:'POST',body:JSON.stringify({})});
      const data=await res.json().catch(()=>null);
      if(res.ok&&data){
        duelSqlMissing=false;
        duelHubData={
          players:Array.isArray(data.players)?data.players:[],
          my_duels:Array.isArray(data.my_duels)?data.my_duels:[],
          completed_duels:Array.isArray(data.completed_duels)?data.completed_duels:[]
        };
      }
    }catch(err){
      const msg=String(err?.message||err||'');
      if(/get_duel_arena_hub|Could not find the function|PGRST202/i.test(msg)){
        duelSqlMissing=true;
      }
    }finally{
      duelHubBusy=false;
      if(!activeDuelSession)renderDuelArena();
    }
  }

  async function launchDuelChallenge(useAiGeneration=false){
    const oppSelect=q('#duelOpponentSelect'),subjSelect=q('#duelSubjectSelect'),modeSelect=q('#duelModeSelect'),countSelect=q('#duelCountSelect');
    const oppId=oppSelect?.value||selectedDuelOpponentId;
    if(!oppId)return toast('Escolha um caçador oponente para desafiar no X1!');
    const subj=subjSelect?.value||'all';
    const mode=modeSelect?.value||'misto';
    const count=Math.min(10,Math.max(3,Number(countSelect?.value)||5));
    const oppPlayer=(duelHubData.players||[]).find(p=>String(p.user_id)===String(oppId));
    const oppName=oppPlayer?.name||selectedDuelOpponentName||'Oponente';

    let questions=[];
    if(useAiGeneration&&cloudSession){
      const aiBtn=q('#createDuelAiBtn');
      if(aiBtn){aiBtn.disabled=true;aiBtn.textContent='⏳ IA criando questões do duelo...'}
      try{
        const session=await validSession();
        const campaignName=(typeof activeCampaign==='function'?activeCampaign()?.name:'Concurso Policial')||'Concurso Policial';
        const subjText=subj==='all'?'Direito Constitucional, Direito Penal, Legislação Extravagante, Língua Portuguesa e Direito Militar':subj;
        const diffLabel=mode==='dificil'?'difíceis com pegadinhas de banca':mode==='fixacao'?'diretas de fixação de conceitos e lei seca':'equilibradas entre fixação e questões difíceis';
        const prompt=`Crie ${count} questões inéditas de múltipla escolha (4 alternativas A, B, C, D) ${diffLabel} sobre "${subjText}" para o concurso "${campaignName}".\nResponda EXCLUSIVAMENTE com um array JSON válido no formato:\n[{"subject":"Disciplina","topic":"Assunto","difficulty":"${mode==='dificil'?'dificil':'medio'}","statement":"Enunciado claro","options":["Alternativa A","Alternativa B","Alternativa C","Alternativa D"],"correct_index":0,"explanation":"Gabarito comentado curto"}]`;
        const r=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
          method:'POST',
          headers:authHeaders(session.access_token),
          body:JSON.stringify({question:prompt,context:`Duelo X1 ${campaignName} - ${subjText}`,mode:'gerador de duelo x1',campaign_id:activeCampaign()?.dbId,campaign:campaignName})
        });
        const d=await r.json().catch(()=>({}));
        const raw=String(d?.answer||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');
        const s=raw.indexOf('['),e=raw.lastIndexOf(']');
        if(s>=0&&e>s){
          const parsed=JSON.parse(raw.slice(s,e+1));
          if(Array.isArray(parsed)&&parsed.length>=3){
            questions=parsed.filter(x=>Array.isArray(x.options)&&x.options.length>=4).slice(0,count).map(x=>({
              subject:canonicalSubjectName(x.subject||subjText),
              topic:String(x.topic||'Desafio IA X1'),
              difficulty:String(x.difficulty||mode),
              statement:typeof window.formatQuestionStatementText==='function'?window.formatQuestionStatementText(x.statement):String(x.statement),
              options:x.options.slice(0,4).map(String),
              correct_index:Math.min(3,Math.max(0,Number(x.correct_index)||0)),
              explanation:String(x.explanation||'Questão gerada pela IA para o Duelo X1.')
            }));
          }
        }
      }catch{}finally{
        if(aiBtn){aiBtn.disabled=false;aiBtn.textContent='✨ Desafiar com Questões Criadas pela IA'}
      }
    }

    if(!questions.length){
      questions=buildDuelQuestionPack(subj,mode,count);
    }

    try{
      const res=await cloudFetch('rpc/create_hunter_duel',{
        method:'POST',
        body:JSON.stringify({
          p_opponent_id:oppId,
          p_subject:subj==='all'?'Roleta Mista (Perguntados)':subj,
          p_mode:mode,
          p_questions:questions
        })
      });
      const created=await res.json().catch(()=>({}));
      if(!res.ok||!created?.duel_id)throw new Error(created?.message||'Execute a migração v95 no Supabase para criar duelos online.');
      toast(`⚔️ Desafio X1 criado contra ${oppName}! Responda sua rodada agora!`);
      await loadDuelArenaHub(true);
      const myDuel=(duelHubData.my_duels||[]).find(d=>d.id===created.duel_id)||{
        id:created.duel_id,
        challenger_id:cloudSession?.user?.id,
        opponent_id:oppId,
        challenger_name:localHunterRow().name,
        opponent_name:oppName,
        subject:subj==='all'?'Roleta Mista (Perguntados)':subj,
        difficulty_mode:mode,
        questions
      };
      startPlayingDuel(myDuel);
    }catch(err){
      toast(err.message||'Não foi possível iniciar o duelo.');
    }
  }

  function startPlayingDuel(duel){
    if(!duel||!Array.isArray(duel.questions)||!duel.questions.length)return toast('Este duelo não possui questões válidas.');
    if(duelRoundTimer){clearInterval(duelRoundTimer);duelRoundTimer=null}
    activeDuelSession={
      duel,
      index:0,
      score:0,
      totalTimeS:0,
      questionStartMs:Date.now(),
      secondsLeft:25,
      answered:false,
      answers:[]
    };
    renderDuelArena();
    startDuelQuestionCountdown();
  }

  function startDuelQuestionCountdown(){
    if(duelRoundTimer)clearInterval(duelRoundTimer);
    if(!activeDuelSession)return;
    activeDuelSession.secondsLeft=25;
    activeDuelSession.questionStartMs=Date.now();
    duelRoundTimer=setInterval(()=>{
      if(!activeDuelSession||activeDuelSession.answered)return;
      const elapsed=Math.floor((Date.now()-activeDuelSession.questionStartMs)/1000);
      const rem=Math.max(0,25-elapsed);
      activeDuelSession.secondsLeft=rem;
      const clockEl=q('#duelLiveTimerText'),fillEl=q('#duelLiveTimerFill');
      if(clockEl)clockEl.textContent=`⏱️ ${rem}s`;
      if(fillEl)fillEl.style.width=`${Math.round((rem/25)*100)}%`;
      if(rem<=0){
        answerDuelQuestion(-1);
      }
    },250);
  }

  function answerDuelQuestion(chosenIdx){
    if(!activeDuelSession||activeDuelSession.answered)return;
    activeDuelSession.answered=true;
    if(duelRoundTimer){clearInterval(duelRoundTimer);duelRoundTimer=null}
    const spent=Math.min(25,Math.max(1,Math.round((Date.now()-activeDuelSession.questionStartMs)/1000)));
    activeDuelSession.totalTimeS+=spent;
    const curQ=activeDuelSession.duel.questions[activeDuelSession.index];
    const isCorrect=chosenIdx===Number(curQ.correct_index);
    if(isCorrect)activeDuelSession.score++;
    activeDuelSession.answers.push({index:activeDuelSession.index,chosen:chosenIdx,correct:isCorrect,time_s:spent});

    qa('[data-duel-opt]').forEach(btn=>{
      const idx=Number(btn.dataset.duelOpt);
      btn.disabled=true;
      if(idx===Number(curQ.correct_index))btn.classList.add('correct');
      else if(idx===chosenIdx)btn.classList.add('wrong');
    });

    const fb=q('#duelRoundFeedback');
    if(fb){
      fb.hidden=false;
      fb.innerHTML=`
        <div class="lessonBox ${isCorrect?'bizu':'trap'}" style="margin-top:10px">
          <b>${chosenIdx<0?'⏰ Tempo esgotado!':isCorrect?`✓ Acertou em ${spent}s!`:'✗ Resposta incorreta'}</b>
          <p style="margin:4px 0 0">${escText(curQ.explanation||'Revise este ponto no seu material.')}</p>
        </div>
        <button type="button" class="action" id="nextDuelQuestionBtn" style="margin-top:10px;width:100%">
          ${activeDuelSession.index+1<activeDuelSession.duel.questions.length?'Próxima questão do duelo →':'Finalizar minha rodada e enviar placar 🏆'}
        </button>
      `;
      q('#nextDuelQuestionBtn').onclick=async()=>{
        if(activeDuelSession.index+1<activeDuelSession.duel.questions.length){
          activeDuelSession.index++;
          activeDuelSession.answered=false;
          renderDuelArena();
          startDuelQuestionCountdown();
        }else{
          await finishAndSubmitDuelRound();
        }
      };
    }
  }

  async function finishAndSubmitDuelRound(){
    if(!activeDuelSession)return;
    const {duel,score,totalTimeS,answers}=activeDuelSession;
    const btn=q('#nextDuelQuestionBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Salvando seu placar na Arena...'}
    try{
      const res=await cloudFetch('rpc/submit_hunter_duel_round',{
        method:'POST',
        body:JSON.stringify({
          p_duel_id:duel.id,
          p_score:score,
          p_time_s:totalTimeS,
          p_answers:answers
        })
      });
      const updated=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(updated?.message||'Erro ao enviar resultado do duelo.');
      playCompletionChime();
      activeDuelSession=null;
      await loadDuelArenaHub(true);
      renderDuelArena();
      if(updated.status==='completed'){
        const myId=cloudSession?.user?.id;
        const won=updated.winner_id===myId;
        toast(updated.is_draw?`🤝 Duelo empatado (${score}/${duel.questions.length})!`:won?`🏆 VITÓRIA NO X1! Você venceu por ${score}/${duel.questions.length} (${totalTimeS}s)!`:`Duelo finalizado (${score}/${duel.questions.length}). Confira o placar na Arena!`);
      }else{
        toast(`✓ Sua rodada (${score}/${duel.questions.length} em ${totalTimeS}s) foi registrada! Aguardando o oponente responder.`);
      }
    }catch(err){
      toast(err.message||'Não foi possível registrar o duelo.');
      activeDuelSession=null;
      renderDuelArena();
    }
  }

  function renderDuelArena(){
    const root=q('#duelRoot');
    if(!root)return;
    const myId=cloudSession?.user?.id||'local';
    const me=localHunterRow();

    if(activeDuelSession){
      const {duel,index,score,totalTimeS,secondsLeft}=activeDuelSession;
      const curQ=duel.questions[index];
      const oppName=duel.challenger_id===myId?duel.opponent_name:duel.challenger_name;
      const letters=['A','B','C','D'];
      root.innerHTML=`
        <div class="duelPlayStage">
          <div class="sectionHead" style="margin-bottom:6px">
            <div>
              <div class="eyebrow">⚔️ DUELO X1 CONTRA ${escText((oppName||'OPONENTE').toUpperCase())} · RODADA ${index+1}/${duel.questions.length}</div>
              <h2 style="margin:2px 0 0">${escText(curQ.subject||'Disciplina')} · <span style="font-size:.9rem;color:var(--cyan)">${escText(curQ.topic||'Questão')}</span></h2>
            </div>
            <div style="text-align:right">
              <span class="tag" id="duelLiveTimerText" style="font-size:.95rem;font-weight:900">⏱️ ${secondsLeft}s</span>
              <div class="small muted" style="margin-top:3px">Placar parcial: <b>${score}/${index}</b> (${totalTimeS}s)</div>
            </div>
          </div>
          <div class="duelTimerBar"><div class="duelTimerFill" id="duelLiveTimerFill" style="width:${Math.round((secondsLeft/25)*100)}%"></div></div>
          <div id="duelQuestionStatement" style="white-space:pre-line;line-height:1.68;padding:14px;border-radius:12px;background:#071422;border:1px solid #1f3c56;margin-bottom:14px;font-size:.96rem">${escText(curQ.statement)}</div>
          <div>
            ${(curQ.options||[]).map((opt,i)=>`
              <button type="button" class="duelOptBtn" data-duel-opt="${i}">
                <b>${letters[i]||i+1}</b>
                <span>${escText(opt)}</span>
              </button>
            `).join('')}
          </div>
          <div id="duelRoundFeedback" hidden></div>
        </div>
      `;
      qa('[data-duel-opt]').forEach(btn=>{
        btn.onclick=()=>answerDuelQuestion(Number(btn.dataset.duelOpt));
      });
      return;
    }

    const {ranking,dominations,pairHistory}=computeArenaStatsAndRivalries();
    const opponents=(duelHubData.players||[]).filter(p=>!p.is_me&&String(p.user_id)!==String(myId));
    const pendingForMe=(duelHubData.my_duels||[]).filter(d=>d.status==='pending'&&((d.challenger_id===myId&&!d.challenger_done)||(d.opponent_id===myId&&!d.opponent_done)));
    const waitingOpponent=(duelHubData.my_duels||[]).filter(d=>d.status==='pending'&&((d.challenger_id===myId&&d.challenger_done&&!d.opponent_done)||(d.opponent_id===myId&&d.opponent_done&&!d.challenger_done)));
    const finishedMy=(duelHubData.my_duels||[]).filter(d=>d.status==='completed').slice(0,12);
    const subjects=[...new Set([...LEARNING_SUBJECTS,'Direito Constitucional','Direito Militar','Legislação Extravagante','Direito Penal','Direito Processual Penal','Língua Portuguesa','Raciocínio Lógico-Matemático','Informática'])];

    root.innerHTML=`
      <div class="card duelHero" style="margin-bottom:12px">
        <div class="sectionHead" style="margin-bottom:6px">
          <div>
            <div class="eyebrow">⚔️ MODO COMPETITIVO ESTILO PERGUNTADOS · PC ↔ CELULAR</div>
            <h2 style="margin:2px 0 0">Arena X1 — Duelo de Caçadores</h2>
            <p class="small muted" style="margin:4px 0 0">Desafie amigos online ou em qualquer navegador (computador ou celular) em baterias de fixação e questões difíceis. <b>Não altera seu XP de estudo!</b></p>
          </div>
          <div class="rankHeaderActions">
            <span class="tag">🎮 Sem perder/ganhar XP de estudo</span>
            <button type="button" class="action small" id="refreshDuelHubBtn">${duelHubBusy?'⏳ Atualizando...':'↻ Atualizar Arena'}</button>
          </div>
        </div>
        <div class="duelWheelCats">
          <span class="duelCatChip">⚖️ Constitucional</span>
          <span class="duelCatChip">🚨 Legislação Extravagante</span>
          <span class="duelCatChip">🎖️ Direito Militar</span>
          <span class="duelCatChip">📘 Língua Portuguesa</span>
          <span class="duelCatChip">🚔 Penal & Processo Penal</span>
          <span class="duelCatChip">🧠 RLM & Informática</span>
        </div>
      </div>

      ${duelSqlMissing?`
        <div class="card" style="margin-bottom:12px;border-color:var(--gold)">
          <b>Ative a Arena de Duelos X1 no Supabase (1 vez):</b>
          <p class="small muted" style="margin:4px 0 0">Execute o arquivo <code>supabase/migrations/20261030_v95_duel_arena_x1.sql</code> no SQL Editor do Supabase para liberar os desafios X1 entre computador e celular.</p>
        </div>
      `:''}

      ${pendingForMe.length?`
        <div class="card" style="margin-bottom:12px;border-color:#22c55e;background:linear-gradient(145deg,#0c291e,#071420)">
          <div class="sectionHead">
            <div>
              <div class="eyebrow" style="color:#4ade80">🔔 DESAFIOS X1 AGUARDANDO SUA RESPOSTA AGORA</div>
              <h3 style="margin:2px 0 0">Sua vez de jogar!</h3>
            </div>
            <span class="tag">${pendingForMe.length} duelo(s)</span>
          </div>
          <div class="list">
            ${pendingForMe.map(d=>{
              const rival=d.challenger_id===myId?d.opponent_name:d.challenger_name;
              return `
                <div class="card" style="padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                  <div>
                    <b>⚔️ Contra ${escText(rival)}</b> · <span class="tag">${escText(d.subject||'Roleta Mista')}</span>
                    <div class="small muted">${(d.questions||[]).length} questões · Modo: ${escText(d.difficulty_mode||'misto')} · Desempate por tempo (25s/questão)</div>
                  </div>
                  <button type="button" class="action small" data-play-duel="${escText(d.id)}" style="width:auto">▶️ Jogar Minha Rodada Agora</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `:''}

      <div class="card" style="margin-bottom:12px">
        <div class="sectionHead">
          <div>
            <div class="eyebrow">LANÇAR NOVO DESAFIO X1</div>
            <h3 style="margin:2px 0 0">Escolha o Oponente e a Modalidade</h3>
          </div>
          <span class="tag">25s por questão</span>
        </div>
        <div class="essayGrid">
          <label class="field">Desafiar Caçador
            <select id="duelOpponentSelect">
              ${opponents.length?opponents.map(p=>`<option value="${escText(p.user_id)}" ${String(p.user_id)===String(selectedDuelOpponentId)?'selected':''}>${p.is_online?'🟢 [Online agora] ':'⚪ '}${escText(p.name)} (${escText(p.role||'PMPE')})</option>`).join(''):'<option value="">Aguardando outros caçadores no banco</option>'}
            </select>
          </label>
          <label class="field">Disciplina (Banco / Biblioteca / Edital)
            <select id="duelSubjectSelect">
              <option value="all">🎲 Roleta Mista Estilo Perguntados (Todas as matérias)</option>
              ${subjects.map(s=>`<option value="${escText(s)}">${escText(s)}</option>`).join('')}
            </select>
          </label>
          <label class="field">Nível do Duelo
            <select id="duelModeSelect">
              <option value="misto">⚖️ Equilibrado (Fixação + Questões Difíceis)</option>
              <option value="fixacao">⚡ Fixação Rápida (Conceitos e Lei Seca)</option>
              <option value="dificil">🔥 Somente Difíceis e Pegadinhas de Banca</option>
            </select>
          </label>
          <label class="field">Quantidade de Questões
            <select id="duelCountSelect">
              <option value="5" selected>5 questões (Rápido ~2 min)</option>
              <option value="7">7 questões (Disputa completa)</option>
            </select>
          </label>
        </div>
        <div class="essayHelperBar" style="margin-top:12px;margin-bottom:0;padding-bottom:0;border-bottom:0">
          <button type="button" class="action" id="createDuelBankBtn">⚔️ Iniciar Duelo X1 (Banco da Biblioteca)</button>
          <button type="button" class="ghost" id="createDuelAiBtn">✨ Desafiar com Questões Criadas pela IA</button>
        </div>
      </div>

      ${dominations.length?`
        <div class="card" style="margin-bottom:12px;border-color:#f59e0b88">
          <div class="sectionHead">
            <div>
              <div class="eyebrow" style="color:var(--gold)">🔥 QUADRO DE DOMINAÇÃO E VITÓRIAS CONSECUTIVAS (FREGUESIA X1)</div>
              <h3 style="margin:2px 0 0">Quem está dominando os confrontos diretos</h3>
            </div>
            <span class="tag">Vitórias seguidas</span>
          </div>
          <div style="display:grid;gap:8px">
            ${dominations.map(dom=>{
              const winnerName=dom.lastWinner===dom.u1?dom.u1Name:dom.u2Name;
              const loserName=dom.lastWinner===dom.u1?dom.u2Name:dom.u1Name;
              const wScore=dom.wins[dom.lastWinner]||0;
              const lScore=dom.wins[dom.lastWinner===dom.u1?dom.u2:dom.u1]||0;
              return `
                <div class="card" style="padding:11px 14px;background:#0a1826;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                  <div>
                    <span class="dominationBadge">👑 ${dom.consecutiveWins>=2?`DOMINANDO: ${dom.consecutiveWins} VITÓRIAS SEGUIDAS!`:'1ª VITÓRIA DA SÉRIE'}</span>
                    <div style="margin-top:5px;font-size:.95rem"><b>${escText(winnerName)}</b> ganhou <b>${dom.consecutiveWins}x consecutiva(s)</b> de <b>${escText(loserName)}</b></div>
                  </div>
                  <div class="tag">Placar Histórico: ${wScore} × ${lScore}${dom.draws?` (${dom.draws} emp.)`:''}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `:''}

      <div class="card" style="margin-bottom:12px">
        <div class="sectionHead">
          <div>
            <div class="eyebrow">TOPO DA ARENA · SEPARADO DO XP DE ESTUDO</div>
            <h3 style="margin:2px 0 0">🏆 Ranking de Vencedores do Duelo X1</h3>
          </div>
          <span class="tag">${ranking.length} competidor(es)</span>
        </div>
        <div>
          ${ranking.map((r,idx)=>{
            const total=r.wins+r.losses+r.draws;
            const winRate=total?Math.round((r.wins/total)*100):0;
            return `
              <div class="rankRow ${r.is_me?'isMe':''}">
                <div class="rankPos">${idx===0&&r.wins>0?'👑':`#${idx+1}`}</div>
                <div class="rankRowMain" style="display:flex;align-items:center;gap:10px;min-width:0">
                  <span class="rankAvatar">${escText((r.name||'C').trim().slice(0,1).toUpperCase())}</span>
                  <div style="min-width:0">
                    <div style="font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <span class="onlineDot ${r.is_online?'on':''}" title="${r.is_online?'Online agora':'Offline'}"></span>
                      <span>${escText(r.name)}</span>
                      ${r.is_me?'<span class="tag" style="padding:2px 6px;font-size:.68rem">Você</span>':''}
                      ${r.streak>=2?`<span class="dominationBadge">🔥 ${r.streak} vitórias seguidas</span>`:''}
                    </div>
                    <div class="small muted">${r.is_online?'🟢 Online agora no navegador':'Pode receber desafio (joga quando entrar)'}</div>
                  </div>
                </div>
                <div class="rankRowMetrics small muted">
                  <span>⚔️ <b>${r.wins}V</b> · ${r.losses}D · ${r.draws}E</span>
                  <span>🎯 Aproveitamento: <b>${winRate}%</b></span>
                  <span>Recorde invicto: <b>${r.best_streak}x</b></span>
                  ${!r.is_me?`<button type="button" class="action small" style="width:auto;padding:5px 10px;min-height:30px;font-size:.75rem" data-quick-duel-opp="${escText(r.user_id)}|${escText(r.name)}">⚔️ Chamar para X1</button>`:''}
                </div>
                <div class="rankRowRight" style="text-align:right">
                  <div style="font-weight:900;color:var(--cyan);font-size:1.02rem">🏆 ${r.wins} vit.</div>
                  <div class="small muted">${r.total_correct} acertos</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${(waitingOpponent.length||finishedMy.length)?`
        <div class="card">
          <div class="sectionHead">
            <h3>Histórico Recente e Duelos Aguardando Oponente</h3>
            <span class="tag">${waitingOpponent.length+finishedMy.length} partida(s)</span>
          </div>
          <div class="list">
            ${waitingOpponent.map(d=>{
              const rival=d.challenger_id===myId?d.opponent_name:d.challenger_name;
              const myScore=d.challenger_id===myId?d.challenger_score:d.opponent_score;
              const myTime=d.challenger_id===myId?d.challenger_time_s:d.opponent_time_s;
              return `
                <div class="card" style="padding:11px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                  <div>
                    <b>⏳ Aguardando ${escText(rival)} responder</b> · <span class="tag">${escText(d.subject)}</span>
                    <div class="small muted">Sua rodada: <b>${myScore}/${(d.questions||[]).length} acertos em ${myTime}s</b> · Assim que ${escText(rival)} jogar no celular ou PC, o vencedor será declarado!</div>
                  </div>
                  <span class="tag">Em aberto</span>
                </div>
              `;
            }).join('')}
            ${finishedMy.map(d=>{
              const isChal=d.challenger_id===myId;
              const rival=isChal?d.opponent_name:d.challenger_name;
              const myScore=isChal?d.challenger_score:d.opponent_score;
              const myTime=isChal?d.challenger_time_s:d.opponent_time_s;
              const oppScore=isChal?d.opponent_score:d.challenger_score;
              const oppTime=isChal?d.opponent_time_s:d.challenger_time_s;
              const won=d.winner_id===myId;
              return `
                <div class="card" style="padding:11px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-left:4px solid ${d.is_draw?'var(--gold)':won?'#22c55e':'#ef4444'}">
                  <div>
                    <b>${d.is_draw?'🤝 Empate':won?'🏆 Vitória':'⚔️ Derrota'} contra ${escText(rival)}</b> · <span class="tag">${escText(d.subject)}</span>
                    <div class="small muted">Você: <b>${myScore} acertos (${myTime}s)</b> × ${escText(rival)}: <b>${oppScore} acertos (${oppTime}s)</b></div>
                  </div>
                  <span class="tafStatusPill ${d.is_draw?'near':won?'ready':'prep'}">${d.is_draw?'Empate':won?'Venceu':'Perdeu'}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `:''}
    `;

    if(q('#refreshDuelHubBtn'))q('#refreshDuelHubBtn').onclick=()=>loadDuelArenaHub(false);
    if(q('#createDuelBankBtn'))q('#createDuelBankBtn').onclick=()=>launchDuelChallenge(false);
    if(q('#createDuelAiBtn'))q('#createDuelAiBtn').onclick=()=>launchDuelChallenge(true);
    qa('[data-play-duel]').forEach(btn=>{
      btn.onclick=()=>{
        const found=(duelHubData.my_duels||[]).find(d=>String(d.id)===String(btn.dataset.playDuel));
        if(found)startPlayingDuel(found);
      };
    });
    qa('[data-quick-duel-opp]').forEach(btn=>{
      btn.onclick=()=>{
        const [uid,uname]=btn.dataset.quickDuelOpp.split('|');
        selectedDuelOpponentId=uid;
        selectedDuelOpponentName=uname;
        const sel=q('#duelOpponentSelect');
        if(sel){sel.value=uid;sel.scrollIntoView({behavior:'smooth',block:'center'})}
        toast(`Oponente ${uname} selecionado! Escolha a matéria e clique em Iniciar Duelo X1.`);
      };
    });
  }

  const baseOpenView=openView;
  openView=function(id){baseOpenView(id);try{sessionStorage.setItem(viewKey,id)}catch{}if(id==='report'){populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()}if(id==='today'){updateTodayCommand();ensureTafAndRankingShortcuts()}if(id==='map'){renderReverseSchedule();decorateEditalIncidenceBadges()}if(id==='review')enhanceReviewCenter();if(id==='essay')enhanceTypedEssayOption();if(id==='taf')renderTafPanel();if(id==='library'){renderCommunityCoopBanner();syncCommunityLibraryForActivePortal()}if(id==='ranking'){renderHuntersLeaderboard();loadHuntersLeaderboard()}if(id==='duel'){renderDuelArena();loadDuelArenaHub()}};
  const baseTickClock=typeof tickClock==='function'?tickClock:null;
  if(baseTickClock){
    window.tickClock=function(){
      const wasEnding=typeof timerLeft==='number'&&timerLeft===1&&Boolean(timerRun);
      baseTickClock();
      if(wasEnding)playCompletionChime();
    };
  }
  const baseRender=render;
  render=function(){syncHunterStatsSnapshot();baseRender();enhanceFlashcardsSpacedRepetition();enhanceEssayCenter();enhanceTypedEssayOption();enhanceReviewCenter();decorateEditalIncidenceBadges();renderCommunityCoopBanner();updateFlashcardSpacedStats();updateTodayCommand();ensureTafAndRankingShortcuts();renderReverseSchedule();populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub();if(q('#taf')?.classList.contains('active'))renderTafPanel();if(q('#ranking')?.classList.contains('active'))renderHuntersLeaderboard()};
  const baseRenderReport=renderReport;
  renderReport=function(){baseRenderReport();populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()};

  addTodayCommand();ensureReverseSchedulePanel();bindQuestionCenter();updateTodayCommand();renderReverseSchedule();
  qa('[data-menu-view]').forEach(button=>button.onclick=()=>{q('#moreDialog')?.close();openView(button.dataset.menuView)});
  function realignStudyDisciplinesWithLibrary(){
    if(!Array.isArray(cloudDocuments)||!cloudDocuments.length||typeof window.resolveDocumentDiscipline!=='function')return;
    let changed=false;
    for(const s of (ALL_SUMMARIES||[])){
      const doc=cloudDocuments.find(d=>String(d.id)===String(s.documentId));
      if(doc){
        const nextCat=window.resolveDocumentDiscipline(doc,s.category,`${doc.title} ${s.title}`);
        if(nextCat&&nextCat!==s.category){s.category=nextCat;changed=true}
        const stdDocTitle=typeof window.standardizeDocumentTitle==='function'?window.standardizeDocumentTitle(doc.title):doc.title;
        if(!s.is_community&&stdDocTitle&&s.source!==stdDocTitle){s.source=stdDocTitle;changed=true}
      }
    }
    for(const qItem of (ALL_QUESTIONS||[])){
      const doc=qItem.documentId?cloudDocuments.find(d=>String(d.id)===String(qItem.documentId)):null;
      const nextCat=window.resolveDocumentDiscipline(doc,qItem.subject,`${doc?.title||''} ${qItem.topic||''}`);
      if(nextCat&&nextCat!==qItem.subject){qItem.subject=nextCat;changed=true}
    }
    for(const card of (ALL_FLASHCARDS||[])){
      const nextCat=canonicalSubjectName(card[0],card[1]||'');
      if(nextCat&&nextCat!==card[0]){card[0]=nextCat;changed=true}
    }
    if(changed){
      LEARNING_SUBJECTS=[...new Set([...ALL_SUMMARIES.map(x=>x.category),...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      if(typeof renderStudy==='function')renderStudy();
      if(typeof renderLearning==='function')renderLearning();
      if(typeof renderQuestionFilters==='function')renderQuestionFilters();
    }
  }
  const baseLoadCloudDocsForSync=typeof loadCloudDocuments==='function'?loadCloudDocuments:null;
  if(baseLoadCloudDocsForSync){
    loadCloudDocuments=async function(){
      const res=await baseLoadCloudDocsForSync();
      realignStudyDisciplinesWithLibrary();
      return res;
    };
  }
  const baseLoadGenForComm=typeof loadGeneratedContent==='function'?loadGeneratedContent:null;
  if(baseLoadGenForComm){
    loadGeneratedContent=async function(){
      const res=await baseLoadGenForComm();
      realignStudyDisciplinesWithLibrary();
      await syncCommunityLibraryForActivePortal();
      realignStudyDisciplinesWithLibrary();
      return res;
    };
  }
  setTimeout(()=>syncCommunityLibraryForActivePortal(),1200);
  setInterval(()=>{if(q('#duel')?.classList.contains('active')&&!activeDuelSession&&cloudSession&&navigator.onLine)loadDuelArenaHub(true)},7000);
  const remembered=(()=>{try{return sessionStorage.getItem(viewKey)}catch{return null}})();
  if(remembered&&q(`#${CSS.escape(remembered)}`)?.classList.contains('view'))openView(remembered);
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 78 · experiência orientada ao estudo');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 78 · interface, questões, simulados, IA, PDFs e sincronização');
})();
