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
    panel.innerHTML=`<button class="commandPrimary" id="continueJourney"><span class="eyebrow">PRÓXIMA AÇÃO</span><b id="continueJourneyTitle">Continuar missão diária</b><span id="continueJourneyMeta">Retome exatamente de onde parou.</span></button><button class="commandShortcut" id="openUrgentReview"><i>↻</i><b>Revisar agora</b><span id="urgentReviewMeta">Confira suas revisões pendentes</span></button><button class="commandShortcut" id="openQuestionCenter"><i>◎</i><b>Resolver questões</b><span id="questionShortcutMeta">Treino por disciplina e tópico</span></button>`;
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

  const baseOpenView=openView;
  openView=function(id){baseOpenView(id);try{sessionStorage.setItem(viewKey,id)}catch{}if(id==='report'){populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()}if(id==='today')updateTodayCommand();if(id==='map')renderReverseSchedule()};
  const baseRender=render;
  render=function(){baseRender();updateTodayCommand();renderReverseSchedule();populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()};
  const baseRenderReport=renderReport;
  renderReport=function(){baseRenderReport();populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()};

  addTodayCommand();ensureReverseSchedulePanel();bindQuestionCenter();updateTodayCommand();renderReverseSchedule();
  qa('[data-menu-view]').forEach(button=>button.onclick=()=>{q('#moreDialog')?.close();openView(button.dataset.menuView)});
  const remembered=(()=>{try{return sessionStorage.getItem(viewKey)}catch{return null}})();
  if(remembered&&q(`#${CSS.escape(remembered)}`)?.classList.contains('view'))openView(remembered);
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 78 · experiência orientada ao estudo');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 78 · interface, questões, simulados, IA, PDFs e sincronização');
})();
