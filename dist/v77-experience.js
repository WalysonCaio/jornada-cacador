(()=>{
  'use strict';
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const escText=value=>{
    const raw=typeof value==='string'&&value.length>1&&typeof window.normalizeLegalText==='function'?window.normalizeLegalText(value):String(value??'');
    return raw.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  };
  const shortLabel=(text,maxLen=52)=>{
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    return clean.length>maxLen?clean.slice(0,maxLen-1).trim()+'…':clean;
  };
  const BOARD_BOSS_PROFILES={
    'Cebraspe':{
      rank:'RANK S · DIFICULDADE ALTA',
      difficulty:'dificil',
      scoring:'liquid',
      summary:'Casos hipotéticos, jurisprudência dominante do STF/STJ, súmulas e pegadinhas de generalização ("sempre", "exclusivamente") ou inversão entre regra e exceção.',
      promptRules:`PADRÃO OBRIGATÓRIO DA BANCA CEBRASPE (NÍVEL DIFÍCIL / RANK S):
- Crie enunciados contextualizados com situações hipotéticas de serviço público/policial ("Determinado agente público...", "Considerando a jurisprudência dominante do STF e do STJ...").
- Cobre entendimento sumulado, jurisprudência de tribunais superiores, exceções constitucionais/legais e distinções doutrinárias finas.
- Nos distratores, use as pegadinhas clássicas do Cebraspe: generalizações indevidas ("em qualquer hipótese", "sempre", "exclusivamente"), inversão entre competência privativa e exclusiva, ou troca entre regra geral e exceção.`
    },
    'FGV Conhecimento':{
      rank:'RANK S · DIFICULDADE ALTA',
      difficulty:'dificil',
      scoring:'standard',
      summary:'Enunciados longos baseados em casos práticos com personagens ("João, servidor estadual..."), exigindo interpretação profunda e aplicação da norma ao caso concreto.',
      promptRules:`PADRÃO OBRIGATÓRIO DA BANCA FGV (NÍVEL DIFÍCIL / RANK S):
- TODA questão deve apresentar um caso prático narrativo com personagens nomeados (ex.: "João, policial penal em serviço...", "Maria, servidora pública estadual...") enfrentando um dilema jurídico, administrativo ou lógico concreto.
- As 4 alternativas devem ser extensas, técnicas e muito próximas entre si, exigindo que o candidato aplique a lei/jurisprudência/gramática ao caso narrado (nunca faça perguntas curtas do tipo "O que diz o art. X").`
    },
    'Instituto AOCP':{
      rank:'RANK A · DIFICULDADE MÉDIA-ALTA',
      difficulty:'dificil',
      scoring:'standard',
      summary:'Cobrança cirúrgica da letra seca da lei, prazos, quóruns, penas e exceções expressas ("salvo", "exceto", "vedado"), trocando palavras-chave nos distratores.',
      promptRules:`PADRÃO OBRIGATÓRIO DA BANCA INSTITUTO AOCP (NÍVEL DIFÍCIL / RANK A):
- Cobre com rigor cirúrgico a literalidade da lei seca, prazos processuais/administrativos, penas, requisitos, competências e exceções legais expressas ("salvo", "exceto", "vedado", "prescindível" vs "imprescindível").
- Construa alternativas onde os distratores reproduzem o texto legal quase idêntico, mas trocam um verbo modal ("poderá" por "deverá"), um prazo, uma autoridade competente ou misturam incisos do mesmo artigo.`
    },
    'IDECAN':{
      rank:'RANK A · DIFICULDADE MÉDIA-ALTA',
      difficulty:'dificil',
      scoring:'standard',
      summary:'Questões técnicas e detalhistas que cruzam múltiplos artigos da legislação especial com classificações doutrinárias e nomenclatura técnica.',
      promptRules:`PADRÃO OBRIGATÓRIO DA BANCA IDECAN (NÍVEL DIFÍCIL / RANK A):
- Elabore questões técnicas e detalhistas que cruzem dispositivos da legislação com classificações doutrinárias (ex.: atributos e espécies de atos, teoria do crime, tipos de flagrante, análise morfossintática avançada).
- Exija domínio preciso da nomenclatura técnica e das exceções previstas na legislação específica do cargo.`
    }
  };
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
          const allQ=ALL_QUESTIONS||[];
          const subjPool=allQ.filter(x=>topicKey(learningCategory(x.subject))===topicKey(mission.subject));
          const topicMatches=subjPool.filter(x=>normalizeText(`${x.topic||''} ${x.statement||''}`).includes(normalizeText(mission.name||'').slice(0,18)));
          const pool=topicMatches.length>=3?topicMatches:(subjPool.length?subjPool:allQ);
          if(pool.length){
            const targetCount=Math.min(20,pool.length);
            const chosen=typeof balancedQuestions==='function'?balancedQuestions(pool,targetCount):pool.slice(0,targetCount);
            activeQuestions={
              mode:'battle',
              subject:mission.subject||'Missão Diária',
              missionId:mission.id,
              questions:chosen.map(prepareQuestion),
              current:0,
              correct:0,
              answered:false
            };
            q('#questionDialogTitle').textContent=`◎ Missão Diária: ${mission.name}`;
            q('#questionDialog').showModal();
            showQuestion();
            return;
          }
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
    if(typeof renderExamCountdown==='function')renderExamCountdown();
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

    if(typeof window.isUnifiedPortalActive==='function'&&window.isUnifiedPortalActive()){
      const secCamp=typeof window.getSecondaryPortalForUnification==='function'?window.getSecondaryPortalForUnification():null;
      const uStats=typeof window.buildUnifiedMissionPool==='function'?window.buildUnifiedMissionPool(campaign,secCamp).stats:null;
      const pMissions=missions.filter(m=>m.originScope==='both'||m.originScope==='primary');
      const sMissions=missions.filter(m=>m.originScope==='both'||m.originScope==='secondary');
      const pRem=Math.max(0,pMissions.length-pMissions.filter(m=>state?.done?.[m.id]).length);
      const sRem=Math.max(0,sMissions.length-sMissions.filter(m=>state?.done?.[m.id]).length);
      const pDate=campaign?.examDate||campaign?.exam_date||null;
      const sDate=secCamp?.examDate||secCamp?.exam_date||null;
      const pDays=pDate?Math.ceil((new Date(`${pDate}T23:59:59`)-Date.now())/86400000):null;
      const sDays=sDate?Math.ceil((new Date(`${sDate}T23:59:59`)-Date.now())/86400000):null;
      const pPace=pDays&&pDays>0?`${Math.ceil(pRem/Math.max(1/7,pDays/7))}/sem`:`${Math.max(1,studyDaysCount)}/sem`;
      const sPace=sDays&&sDays>0?`${Math.ceil(sRem/Math.max(1/7,sDays/7))}/sem`:`${Math.max(1,studyDaysCount)}/sem`;
      badgeEl.textContent=`Conciliação (${uStats?.pBadge||"1º"} + ${uStats?.sBadge||"2º"})`;
      titleEl.textContent=`Ritmo das 2 Provas: ${remaining} tópicos restantes no mapa unificado (${uStats?.fusedMissionsCount||0} comuns fundidos)`;
      metricsEl.innerHTML=`
        <div class="reverseMetric"><b>${pDays!==null?`${Math.max(0,pDays)}d`:"Sem data"}</b><span>🎯 Prova ${escText(uStats?.pBadge||"1")} (${pRem} pend. · ${pPace})</span></div>
        <div class="reverseMetric"><b>${sDays!==null?`${Math.max(0,sDays)}d`:"Sem data"}</b><span>🔥 Prova ${escText(uStats?.sBadge||"2")} (${sRem} pend. · ${sPace})</span></div>
        <div class="reverseMetric"><b>${uStats?.fusedMissionsCount||0}</b><span>⚡ tópicos 2-em-1 (ambos)</span></div>
        <div class="reverseMetric"><b>${total?Math.round(done/total*100):0}%</b><span>progresso unificado</span></div>
      `;
      adviceEl.textContent=`Cada missão ⚡ AMBOS concluída abate simultaneamente o cronograma de ${uStats?.pBadge||"Prova 1"} e de ${uStats?.sBadge||"Prova 2"}. Você pode definir datas diferentes para cada prova ou desunificar quando quiser sem perder progresso.`;
      return;
    }

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

  // 2A. Banco Base Nativo Policial/Militar (Instituto AOCP, Cebraspe, FGV, UPENET/IAUPE, IBFC) + Modo boaResposta
  const NATIVE_POLICE_QUESTION_BANK = [
    {
      subject: 'Língua Portuguesa',
      topic: 'Crase e Regência Nominal/Verbal',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — Padrão PMPE/CBMPE) Assinale a alternativa em que o emprego do acento grave indicativo de crase está em total conformidade com a norma-padrão da língua portuguesa:',
      options: [
        'A viatura retornou à base operacional exatamente às dezoito horas para a troca de turno.',
        'O relatório disciplinar foi encaminhado à Vossa Senhoria para análise imediata.',
        'Os recrutas ficaram frente à frente com o comandante durante a formatura matinal.',
        'O patrulhamento ostensivo passou à ser realizado com o apoio de aeronaves.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: A crase ocorre pela fusão da preposição "a" com o artigo definido feminino "a" (à base) e nas locuções adverbiais femininas de horas exatas (às dezoito horas). | ✅ Alternativa correta: A) "Retornou à base" (quem retorna, retorna a algum lugar + substantivo feminino "base") e "às dezoito horas" (horas determinadas exigem crase). | ❌ Análise das alternativas: B) Não ocorre crase antes de pronomes de tratamento (Vossa Senhoria); C) Expressões com palavras repetidas ("frente a frente", "cara a cara") não levam crase; D) Não ocorre crase antes de verbo no infinitivo ("a ser"). | ⚠️ Pegadinha da banca: O Instituto AOCP cobra reiteradamente a proibição de crase antes de verbo ("passou a ser") e antes de palavras repetidas ("gota a gota", "frente a frente").'
    },
    {
      subject: 'Língua Portuguesa',
      topic: 'Concordância Verbal e Verbos Impessoais',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Carreiras Policiais) Tendo em vista as regras de concordância verbal da norma-padrão, assinale a alternativa CORRETA:',
      options: [
        'Houveram diversas ocorrências de perturbação do sossego no último feriado.',
        'Fazem dois anos que o novo grupamento tático foi inaugurado no interior.',
        'Existiam fortes indícios de autoria e materialidade no inquérito policial concluído.',
        'Devem haver novos editais para a área de segurança pública neste semestre.'
      ],
      correct_index: 2,
      explanation: 'Conceito-chave: O verbo "haver" no sentido de existir/ocorrer e o verbo "fazer" indicando tempo decorrido são impessoais (sem sujeito) e permanecem obrigatoriamente na 3ª pessoa do singular, inclusive quando acompanhados de verbo auxiliar. | ✅ Alternativa correta: C) O verbo "existir" é pessoal e concorda normalmente no plural com o sujeito "fortes indícios". | ❌ Análise das alternativas: A) O correto é "Houve diversas ocorrências"; B) O correto é "Faz dois anos"; D) O auxiliar de verbo impessoal também fica no singular: "Deve haver novos editais". | ⚠️ Pegadinha da banca: O Instituto AOCP costuma colocar o verbo "haver" em locução verbal ("Devem haver") para induzir o candidato ao erro; lembre-se de que "existir" varia ("Devem existir"), mas "haver" não ("Deve haver").'
    },
    {
      subject: 'Língua Portuguesa',
      topic: 'Conjunções e Relações Lógico-Semânticas',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe — Segurança Pública) No período "Conquanto chovesse torrencialmente na madrugada, a equipe de resgate manteve as buscas na encosta", a conjunção em destaque exprime relação de:',
      options: [
        'Concessão, podendo ser substituída por "Embora" ou "Posto que" sem alteração semântica.',
        'Causa, podendo ser substituída por "Porquanto" ou "Já que".',
        'Condição, equivalendo a "Caso" ou "Contanto que".',
        'Conformidade, equivalendo a "Consoante" ou "Segundo".'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: As conjunções subordinativas adverbiais concessivas introduzem uma ressalva ou fato contrário que não impede a realização da ação principal. | ✅ Alternativa correta: A) "Conquanto", "Embora", "Posto que", "Ainda que" e "Mesmo que" são conjunções concessivas clássicas. | ❌ Análise das alternativas: B) "Porquanto" é causal/explicativa (não confunda com "Conquanto"); C) "Contanto que" é condicional; D) "Consoante" é conformativa. | ⚠️ Pegadinha da banca: As bancas adoram confundir "Conquanto" (concessiva = embora), "Porquanto" (causal/explicativa = porque) e "Contanto que" (condicional = desde que).'
    },
    {
      subject: 'Língua Portuguesa',
      topic: 'Colocação Pronominal e Reescrita',
      board: 'FGV Conhecimento',
      difficulty: 'dificil',
      origin: 'oficial',
      statement: '(FGV Conhecimento) Assinale a alternativa em que a colocação do pronome oblíquo átono obedece rigorosamente à prescrição da gramática normativa:',
      options: [
        'Me informaram ontem sobre a alteração do local de prova.',
        'Os candidatos que inscreveram-se no certame devem conferir o cartão de confirmação.',
        'Nunca afaste-se dos princípios da legalidade e da moralidade administrativa.',
        'Em se tratando de flagrante delito, a entrada no domicílio independe de mandado judicial.'
      ],
      correct_index: 3,
      explanation: 'Conceito-chave: Palavras atrativas (advérbios como "nunca", pronomes relativos como "que", e a estrutura "Em + gerúndio") exigem próclise, sendo vedado iniciar período com pronome oblíquo átono. | ✅ Alternativa correta: D) Na estrutura "Em + se + gerúndio" ("Em se tratando"), a próclise ao gerúndio é obrigatória. | ❌ Análise das alternativas: A) Proibido iniciar frase com pronome átono ("Informaram-me"); B) O pronome relativo "que" atrai o pronome ("que se inscreveram"); C) O advérbio "Nunca" atrai o pronome ("Nunca se afaste"). | ⚠️ Pegadinha da banca: A FGV explora o pronome relativo "que" distante ou colado ao verbo; sempre que houver "que", "não", "nunca", "jamais" ou "embora" sem pausa, a próclise é obrigatória.'
    },
    {
      subject: 'Língua Portuguesa',
      topic: 'Regência Verbal (Assistir, Visar, Implicar)',
      board: 'UPENET/IAUPE',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(UPENET/IAUPE — PMPE/CBMPE) De acordo com a regência verbal culta, assinale a frase gramaticalmente CORRETA:',
      options: [
        'A nova diretriz operacional implica em imediata redistribuição do efetivo.',
        'O curso de formação visa ao aperfeiçoamento técnico e ético do militar estadual.',
        'Os instrutores assistiram os novos soldados durante o treinamento de tiro defensivo, no sentido de presenciar.',
        'O candidato preferiu mais o turno matutino do que o turno noturno.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: O verbo "visar" no sentido de "ter por objetivo/almejar" é transitivo indireto (rege preposição "a"), admitindo também uso direto na linguagem contemporânea, mas "visar ao" é a forma padrão consagrada em provas. | ✅ Alternativa correta: B) "Visa ao aperfeiçoamento" segue rigorosamente a regência padrão. | ❌ Análise das alternativas: A) "Implicar" no sentido de acarretar é transitivo direto ("implica imediata redistribuição", sem "em"); C) "Assistir" no sentido de ver/presenciar exige preposição "a" ("assistiram aos"); D) "Preferir" exige "preferir X a Y", sem "mais... do que". | ⚠️ Pegadinha da banca: "Implicar em" (no sentido de resultar) e "Preferir mais X do que Y" são dois dos desvios mais cobrados pela UPENET e pelo Instituto AOCP.'
    },
    {
      subject: 'Raciocínio Lógico-Matemático',
      topic: 'Negação da Condicional (Se... então)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) Considere a proposição composta: "Se o soldado conclui a ronda, então o perímetro está seguro". A negação lógica correta dessa proposição é:',
      options: [
        'Se o soldado não conclui a ronda, então o perímetro não está seguro.',
        'O soldado conclui a ronda e o perímetro não está seguro.',
        'O soldado não conclui a ronda ou o perímetro está seguro.',
        'Se o perímetro não está seguro, então o soldado não conclui a ronda.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A negação de uma condicional ~(P -> Q) NUNCA se faz com outra condicional; aplica-se a regra do MANÉ (Mantém a primeira E Nega a segunda: P ^ ~Q). | ✅ Alternativa correta: B) Mantém "O soldado conclui a ronda" + conectivo "e" + nega a segunda ("o perímetro não está seguro"). | ❌ Análise das alternativas: A) Tentou negar com "Se... então"; C) Trata-se da equivalência (Neymar), não da negação; D) Trata-se da equivalência contrapositiva (~Q -> ~P), não da negação. | ⚠️ Pegadinha da banca: O Instituto AOCP coloca a equivalência contrapositiva (letra D) e a equivalência disjunção (letra C) como distratores quando pede a NEGAÇÃO da condicional!'
    },
    {
      subject: 'Raciocínio Lógico-Matemático',
      topic: 'Equivalência Lógica da Condicional (Contrapositiva)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP) Uma proposição logicamente equivalente a "Se há flagrante delito, então a prisão é realizada" é:',
      options: [
        'Se não há flagrante delito, então a prisão não é realizada.',
        'Há flagrante delito e a prisão não é realizada.',
        'Se a prisão não é realizada, então não há flagrante delito.',
        'Há flagrante delito ou a prisão não é realizada.'
      ],
      correct_index: 2,
      explanation: 'Conceito-chave: A condicional (P -> Q) possui duas equivalências fundamentais: 1) Contrapositiva (~Q -> ~P: inverte e nega ambas) e 2) Disjunção (~P v Q: nega a primeira ou mantém a segunda). | ✅ Alternativa correta: C) Inverteu e negou os dois termos (~Q -> ~P): "Se a prisão não é realizada, então não há flagrante delito". | ❌ Análise das alternativas: A) Apenas negou sem inverter (falácia da negação do antecedente); B) É a negação (MANÉ); D) Não negou a primeira parte. | ⚠️ Pegadinha da banca: Quando a banca pede EQUIVALÊNCIA com "Se... então", você deve INVERTER E NEGAR os dois lados (~Q -> ~P), jamais apenas negar na mesma ordem.'
    },
    {
      subject: 'Raciocínio Lógico-Matemático',
      topic: 'Negação de Quantificadores (Todo / Algum / Nenhum)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe) A negação lógica da proposição universal "Todos os bombeiros militares do quartel possuem curso de salvamento aquático" é:',
      options: [
        'Nenhum bombeiro militar do quartel possui curso de salvamento aquático.',
        'Todos os bombeiros militares do quartel não possuem curso de salvamento aquático.',
        'Pelo menos um bombeiro militar do quartel não possui curso de salvamento aquático.',
        'Apenas um bombeiro militar do quartel possui curso de salvamento aquático.'
      ],
      correct_index: 2,
      explanation: 'Conceito-chave: Para negar o quantificador universal "Todo A é B", basta apresentar um contraexemplo existencial: "Algum A não é B" ("Pelo menos um A não é B" / "Existe um A que não é B"). | ✅ Alternativa correta: C) Substitui "Todos" por "Pelo menos um" e nega o predicado ("não possui"). | ❌ Análise das alternativas: A) "Nenhum" nunca nega "Todo" (é o erro mais comum em prova!); B) Continua universal; D) Restringe a "apenas um". | ⚠️ Pegadinha da banca: Jamais negue "Todo" com "Nenhum"! A regra de ouro é: Todo <-> Algum... não (PEA + Não).'
    },
    {
      subject: 'Raciocínio Lógico-Matemático',
      topic: 'Análise Combinatória — Combinação Simples',
      board: 'FGV Conhecimento',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(FGV) Um comandante dispõe de 6 soldados habilitados e precisa escolher uma equipe de 3 soldados para compor uma guarnição de guarda, sem distinção de função entre os escolhidos. O número de maneiras distintas de formar essa equipe é:',
      options: [
        '18 maneiras.',
        '20 maneiras.',
        '120 maneiras.',
        '216 maneiras.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Quando a ordem de escolha dos elementos NÃO importa (formar comissão, equipe ou grupo sem cargos distintos), utiliza-se Combinação Simples: C(n, p) = n! / [p! (n - p)!]. | ✅ Alternativa correta: B) C(6, 3) = (6 × 5 × 4) / (3 × 2 × 1) = 120 / 6 = 20 maneiras. | ❌ Análise das alternativas: A) Multiplicou 6 × 3; C) Calculou Arranjo A(6,3) = 120, esquecendo de dividir por 3! = 6; D) Calculou 6³. | ⚠️ Pegadinha da banca: A alternativa C (120) é o resultado do Arranjo; sempre pergunte "Se eu trocar a ordem dos escolhidos, muda a equipe?". Se não muda, divida pelo fatorial de p!'
    },
    {
      subject: 'Informática',
      topic: 'Segurança da Informação — Ransomware vs Phishing',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) Na Segurança da Informação, o código malicioso (malware) que torna inacessíveis os dados armazenados em um equipamento, geralmente usando criptografia, e que exige pagamento de resgate (normalmente em criptomoedas) para restabelecer o acesso ao usuário denomina-se:',
      options: [
        'Spyware.',
        'Ransomware.',
        'Rootkit.',
        'Adware.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Segundo a Cartilha de Segurança para Internet do CERT.br, Ransomware (do inglês "ransom" = resgate) é o malware que sequestra dados por criptografia (Ransomware Crypto) ou bloqueia a tela (Ransomware Locker) exigindo pagamento de resgate. | ✅ Alternativa correta: B) Ransomware = sequestro de dados + criptografia + exigência de resgate. | ❌ Análise das alternativas: A) Spyware monitora atividades (keylogger/screenlogger); C) Rootkit oculta a presença de invasores no sistema; D) Adware exibe anúncios indesejados. | ⚠️ Pegadinha da banca: O Instituto AOCP cobra literalmente as definições da Cartilha CERT.br; associe imediatamente "criptografia de arquivos + pedido de resgate" a Ransomware.'
    },
    {
      subject: 'Informática',
      topic: 'Correio Eletrônico — Campos Para, Cc e Cco',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP) Ao enviar um e-mail institucional para três destinatários (A no campo "Para", B no campo "Cc" e C no campo "Cco"), é CORRETO afirmar que:',
      options: [
        'A e B conseguem visualizar que C recebeu a mensagem.',
        'C consegue visualizar que A e B receberam a mensagem, mas nem A nem B sabem que C a recebeu.',
        'Nenhum dos três destinatários consegue ver o endereço eletrônico dos demais.',
        'O campo Cco impede o envio de arquivos anexos por motivos de segurança.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: O campo Cco (Cópia Carbono Oculta / Bcc) oculta os destinatários nele inseridos de todos os demais destinatários da mensagem. | ✅ Alternativa correta: B) Quem está em Cco vê quem está em "Para" e "Cc", mas quem está em "Para", "Cc" (ou mesmo outro destinatário em "Cco") não vê quem está listado em Cco. | ❌ Análise das alternativas: A) A e B não veem C; C) A e B veem um ao outro; D) Cco aceita anexos normalmente. | ⚠️ Pegadinha da banca: Se houver dois destinatários (C e D) dentro do campo Cco, C também NÃO vê D (os destinatários em Cco ficam ocultos até entre si).'
    },
    {
      subject: 'Informática',
      topic: 'Redes de Computadores e Protocolos (HTTPS, DNS, DHCP)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe) A respeito dos protocolos da camada de aplicação da arquitetura TCP/IP utilizados na Internet e em intranets policiais, assinale a opção CORRETA:',
      options: [
        'O protocolo DNS é responsável por atribuir dinamicamente endereços IP às estações de trabalho da rede local.',
        'O protocolo HTTPS utiliza o protocolo TLS/SSL para garantir confidencialidade, integridade e autenticidade na comunicação web, operando por padrão na porta TCP 443.',
        'O protocolo SMTP é utilizado exclusivamente para a leitura e sincronização de mensagens recebidas na caixa de entrada.',
        'O navegador em modo de navegação anônima oculta o tráfego de rede do provedor de internet (ISP) e do administrador do firewall corporativo.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: HTTPS = HTTP sobre TLS/SSL (porta padrão 443), garantindo criptografia fim a fim entre o navegador e o servidor web. | ✅ Alternativa correta: B) O HTTPS assegura confidencialidade, integridade e autenticação do servidor na porta 443. | ❌ Análise das alternativas: A) Quem atribui IP dinamicamente é o DHCP (o DNS traduz nomes de domínio em endereços IP); C) SMTP é para ENVIO de e-mails (Sua Mensagem Tá Partindo), enquanto IMAP/POP3 são para recebimento; D) A guia anônima apenas não salva histórico/cookies localmente no PC, mas o provedor e o roteador da empresa continuam vendo os acessos. | ⚠️ Pegadinha da banca: Guia anônima NÃO torna o usuário invisível para o provedor de internet nem substitui uma VPN!'
    },
    {
      subject: 'História de Pernambuco',
      topic: 'Revolução Pernambucana de 1817 ("Revolução dos Padres")',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) A Revolução Pernambucana de 1817 constituiu um dos mais importantes movimentos emancipacionistas do período joanino no Brasil. Sobre esse movimento histórico, assinale a alternativa CORRETA:',
      options: [
        'Defendia a manutenção do absolutismo monárquico de D. João VI, exigindo apenas a redução dos impostos sobre o café.',
        'Instaurou um Governo Provisório republicano em Pernambuco por mais de 70 dias, proclamando a liberdade de imprensa e de consciência religiosa, embora não tenha abolido de imediato a escravidão.',
        'Ficou restrita exclusivamente à cidade de Olinda, sem qualquer adesão de províncias vizinhas como Paraíba, Rio Grande do Norte e Ceará.',
        'Teve como principal líder o Frei Caneca na luta contra a outorga da Constituição Imperial de 1824.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A Revolução Pernambucana de 1817 foi o único movimento emancipacionista do período colonial/joanino que conseguiu tomar o poder e instalar um Governo Provisório republicano (Inspirado no Iluminismo e na Maçonaria/Aerópago de Itambé). | ✅ Alternativa correta: B) O Governo Provisório de 1817 adotou a Lei Orgânica com liberdade de imprensa e tolerância religiosa, mas recuou quanto à abolição imediata da escravidão para não perder o apoio dos senhores de engenho. | ❌ Análise das alternativas: A) Era republicana e antimonárquica; C) Espalhou-se pela Paraíba, RN e Ceará; D) A luta contra a Constituição de 1824 foi a Confederação do Equador (1824), não a Revolução de 1817. | ⚠️ Pegadinha da banca: O Instituto AOCP e a UPENET sempre tentam misturar 1817 (período de D. João VI) com a Confederação do Equador de 1824 (período de D. Pedro I e a Constituição outorgada).'
    },
    {
      subject: 'História de Pernambuco',
      topic: 'Insurreição Pernambucana e Batalhas dos Guararapes (1648–1649)',
      board: 'UPENET/IAUPE',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(UPENET/IAUPE — PMPE/CBMPE) No contexto do domínio holandês no Nordeste (1630–1654), a saída de Maurício de Nassau e a cobrança rigorosa das dívidas dos senhores de engenho pela Companhia das Índias Ocidentais (WIC) desencadearam a Insurreição Pernambucana (1645–1654), cujo marco militar decisivo ocorreu:',
      options: [
        'Na Guerra dos Mascates, que opôs os comerciantes do Recife à nobreza açucareira de Olinda em 1710.',
        'Nas duas Batalhas dos Montes Guararapes (1648 e 1649), simbolizadas pela união das forças comandadas por João Fernandes Vieira, André Vidal de Negreiros, Henrique Dias e Filipe Camarão.',
        'Na Revolução Praieira de 1848, liderada por Borges da Fonseca e Pedro Ivo.',
        'Na Conspiração dos Suassunas, ocorrida em 1801 na comarca de Goiana.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A Insurreição Pernambucana (1645–1654) expulsou os holandeses da Nova Holanda, tendo como vitórias decisivas as duas Batalhas dos Guararapes (1648 e 1649), consideradas o berço histórico do Exército Brasileiro. | ✅ Alternativa correta: B) Destaca os quatro líderes clássicos da Restauração Pernambucana (João Fernandes Vieira, André Vidal de Negreiros, o líder negro Henrique Dias e o líder indígena Filipe Camarão). | ❌ Análise das alternativas: A) Guerra dos Mascates ocorreu em 1710–1711; C) Praieira foi em 1848; D) Suassunas foi em 1801. | ⚠️ Pegadinha da banca: Memorize a cronologia pernambucana: Insurreição Pernambucana (1645-1654) -> Mascates (1710) -> Suassunas (1801) -> Revolução Pernambucana (1817) -> Confederação do Equador (1824) -> Praieira (1848).'
    },
    {
      subject: 'História de Pernambuco',
      topic: 'Confederação do Equador (1824) e Revolução Praieira (1848)',
      board: 'Instituto AOCP',
      difficulty: 'dificil',
      origin: 'oficial',
      statement: '(Instituto AOCP) Assinale a alternativa que diferencia corretamente a Confederação do Equador (1824) da Revolução Praieira (1848) na história política de Pernambuco:',
      options: [
        'A Confederação do Equador (1824) reagiu ao fechamento da Assembleia Constituinte e ao centralismo da Constituição outorgada por D. Pedro I, tendo caráter republicano e separatista; já a Praieira (1848) ocorreu no Segundo Reinado, defendendo o voto livre e universal, a liberdade de imprensa e a nacionalização do comércio a retalho.',
        'A Confederação do Equador ocorreu no Segundo Reinado sob liderança de Pedro Ivo, enquanto a Revolução Praieira ocorreu no Primeiro Reinado sob liderança de Cipriano Barata.',
        'Ambos os movimentos defenderam o fortalecimento do Poder Moderador e o monopólio comercial dos comerciantes portugueses no Recife.',
        'A Revolução Praieira de 1848 proclamou a independência da República de Olinda com apoio naval da Inglaterra.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: A Confederação do Equador (1824, 1º Reinado, Frei Caneca e Manoel de Carvalho Paes de Andrade) foi separatista e republicana contra o Poder Moderador de D. Pedro I; a Revolução Praieira (1848, 2º Reinado, Manifesto ao Mundo de Borges da Fonseca) lutou contra a hegemonia da família Cavalcanti e o monopólio português no comércio a retalho. | ✅ Alternativa correta: A) Sintetiza com precisão os marcos de 1824 e de 1848 ("Manifesto ao Mundo"). | ❌ Análise das alternativas: B) Inverteu os reinados e líderes; C) Ambos combateram o autoritarismo e a lusofobia estava presente; D) Não houve independência de Olinda com apoio inglês em 1848. | ⚠️ Pegadinha da banca: Falou em "Manifesto ao Mundo", "Jornal Diário Novo (Rua da Praia)", "nacionalização do comércio a retalho" e o dístico "Quem viver em Pernambuco há de estar enganado: que ou há de ser Cavalcanti, ou há de ser cavalgado" -> marque Revolução Praieira (1848)!'
    },
    {
      subject: 'Direito Constitucional',
      topic: 'Art. 5º, XI — Inviolabilidade Domiciliar',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE/CBMPE) Nos termos expressos do art. 5º, inciso XI, da Constituição Federal de 1988, a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, SALVO:',
      options: [
        'Em caso de flagrante delito ou desastre, ou para prestar socorro, a qualquer hora; ou, durante o dia, por determinação judicial.',
        'Durante a noite, mediante mandado de busca e apreensão expedido pelo Juiz de Direito ou pelo Delegado de Polícia.',
        'Apenas durante o dia, inclusive nas hipóteses de flagrante delito, desastre ou prestação de socorro.',
        'Em qualquer horário do dia ou da noite, desde que haja requisição direta do Ministério Público.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: O art. 5º, XI, da CF/88 prevê 3 exceções que admitem ingresso sem consentimento a QUALQUER HORA (dia ou noite): flagrante delito, desastre ou prestar socorro; e 1 exceção que só pode ser cumprida DURANTE O DIA: determinação judicial. | ✅ Alternativa correta: A) Reproduz com exatidão a regra constitucional. | ❌ Análise das alternativas: B) Mandado judicial nunca pode ser cumprido à noite sem consentimento, e Delegado não expede mandado de busca domiciliar (reserva de jurisdição); C) Flagrante, desastre e socorro podem ocorrer à noite; D) MP não substitui ordem judicial. | ⚠️ Pegadinha da banca: O Instituto AOCP adora trocar "determinação judicial" por "determinação policial" ou dizer que o mandado judicial pode ser cumprido à noite.'
    },
    {
      subject: 'Direito Constitucional',
      topic: 'Art. 144 — Segurança Pública (PM, CBM e Polícia Penal)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Segurança Pública) De acordo com o art. 144 da Constituição Federal de 1988, atualizado até a Emenda Constitucional nº 104/2019, assinale a alternativa CORRETA:',
      options: [
        'Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.',
        'As polícias penais são subordinadas diretamente aos Comandantes-Gerais das Polícias Militares de cada Estado.',
        'Às polícias civis, dirigidas por delegados de polícia de carreira, incumbem as funções de polícia judiciária e a apuração das infrações penais, inclusive as militares.',
        'As guardas municipais integram o rol taxativo do caput do art. 144 com atribuição de polícia judiciária estadual.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: O art. 144, § 5º, da CF/88 define a competência da PM (polícia ostensiva e preservação da ordem pública) e do CBM (defesa civil + atribuições legais). Ambos são forças auxiliares e reserva do Exército, subordinados aos Governadores dos Estados/DF (§ 6º). | ✅ Alternativa correta: A) Transcreve fielmente o § 5º do art. 144 da CF/88. | ❌ Análise das alternativas: B) As polícias penais são vinculadas ao órgão administrador do sistema penal da unidade federativa e subordinadas ao Governador (§ 5º-A e § 6º); C) O § 4º exclui expressamente as infrações penais MILITARES da competência da Polícia Civil ("exceto as militares"); D) Guardas municipais estão no § 8º (proteção de bens, serviços e instalações municipais) e não exercem polícia judiciária. | ⚠️ Pegadinha da banca: Atenção ao termo "exceto as militares" no § 4º (Polícia Civil não apura crime militar) e ao vínculo das Polícias Penais (vinculadas ao órgão administrador do sistema penal e subordinadas ao Governador).'
    },
    {
      subject: 'Direito Constitucional',
      topic: 'Remédios Constitucionais (HC, MS, HD, MI e Ação Popular)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe) Acerca dos remédios constitucionais previstos no art. 5º da Constituição Federal, assinale a opção CORRETA:',
      options: [
        'Qualquer cidadão é parte legítima para propor ação popular que vise a anular ato lesivo ao patrimônio público, à moralidade administrativa, ao meio ambiente e ao patrimônio histórico e cultural, ficando o autor, salvo comprovada má-fé, isento de custas judiciais e do ônus da sucumbência.',
        'O habeas data é o remédio cabível para proteger direito líquido e certo não amparado por habeas corpus, quando o responsável pelo abuso de poder for autoridade pública.',
        'São gratuitas as ações de mandado de segurança e mandado de injunção, e, na forma da lei, os atos necessários ao exercício da cidadania.',
        'O mandado de segurança coletivo pode ser impetrado por partido político sem representação no Congresso Nacional.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: A Ação Popular (art. 5º, LXXIII, CF/88) é privativa do CIDADÃO (eleitor em pleno gozo dos direitos políticos) e visa anular ato lesivo ao patrimônio público, moralidade administrativa, meio ambiente e patrimônio histórico/cultural. | ✅ Alternativa correta: A) Literalidade do art. 5º, LXXIII, da CF/88. | ❌ Análise das alternativas: B) Essa é a definição do Mandado de Segurança (o Habeas Data serve para conhecer ou retificar dados pessoais do próprio impetrante em bancos governamentais ou de caráter público); C) As ações gratuitas pela CF (art. 5º, LXXVII) são o Habeas Corpus e o Habeas Data (não o MS e o MI); D) O partido político precisa ter representação no Congresso Nacional (art. 5º, LXX, "a"). | ⚠️ Pegadinha da banca: As ações gratuitas no inciso LXXVII são as duas que começam com "H": Habeas Corpus e Habeas Data!'
    },
    {
      subject: 'Direito Constitucional',
      topic: 'Nacionalidade e Cargos Privativos de Brasileiro Nato (Art. 12, § 3º)',
      board: 'FGV Conhecimento',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(FGV Conhecimento) Segundo o art. 12, § 3º, da Constituição Federal, são cargos privativos de brasileiro NATO, EXCETO:',
      options: [
        'Oficial das Forças Armadas.',
        'Ministro de Estado da Defesa.',
        'Carreira diplomática.',
        'Senador da República.'
      ],
      correct_index: 3,
      explanation: 'Conceito-chave: Pelo mnemônico clássico MP3.COM, são privativos de brasileiro nato: Ministro do STF, Presidente e Vice da República, Presidente da Câmara dos Deputados, Presidente do Senado Federal, Carreira Diplomática, Oficial das Forças Armadas e Ministro de Estado da Defesa. | ✅ Alternativa correta: D) Um brasileiro naturalizado pode ser Deputado Federal ou Senador da República; o que ele NÃO pode ser é Presidente da Câmara ou Presidente do Senado! | ❌ Análise das alternativas: A, B e C constam expressamente no rol taxativo do art. 12, § 3º, da CF/88. | ⚠️ Pegadinha da banca: Senador e Deputado Federal PODEM ser brasileiros naturalizados (apenas a Presidência da Câmara e a Presidência do Senado exigem brasileiro nato); além disso, Oficial da PM/CBM estadual não está no rol das Forças Armadas (Exército, Marinha e Aeronáutica).'
    },
    {
      subject: 'Direito Administrativo',
      topic: 'Poderes Administrativos — Poder de Polícia e seus Atributos',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP) No estudo dos poderes administrativos, o atributo do Poder de Polícia que permite à Administração Pública executar diretamente suas medidas de polícia por seus próprios meios, sem necessidade de prévia intervenção do Poder Judiciário, nos casos previstos em lei ou de urgência, denomina-se:',
      options: [
        'Discricionariedade.',
        'Autoexecutoriedade.',
        'Coercibilidade.',
        'Tipicidade.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Os atributos clássicos do Poder de Polícia formam o mnemônico DAC: Discricionariedade, Autoexecutoriedade e Coercibilidade. | ✅ Alternativa correta: B) A Autoexecutoriedade é a prerrogativa de a Administração executar materialmente seus atos sem precisar pedir autorização prévia ao Judiciário (dividindo-se em exigibilidade e executoriedade). | ❌ Análise das alternativas: A) Discricionariedade é a margem legal de conveniência e oportunidade; C) Coercibilidade é a imposição imperativa/obrigatória ao particular; D) Tipicidade é atributo dos atos administrativos. | ⚠️ Pegadinha da banca: Lembre-se de que a cobrança de MULTA administrativa, embora decorra do poder de polícia, NÃO possui autoexecutoriedade (se o particular não pagar, o Estado precisa inscrever em dívida ativa e ajuizar execução fiscal).'
    },
    {
      subject: 'Direito Administrativo',
      topic: 'Atos Administrativos — Anulação vs Revogação (Súmula 473 do STF)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP) Nos termos da Súmula 473 do Supremo Tribunal Federal e da doutrina de Direito Administrativo, sobre a extinção dos atos administrativos, assinale a alternativa CORRETA:',
      options: [
        'A Administração pode anular seus próprios atos, quando eivados de vícios que os tornam ilegais, porque deles não se originam direitos; ou revogá-los, por motivo de conveniência ou oportunidade, respeitados os direitos adquiridos.',
        'O Poder Judiciário pode revogar atos discricionários praticados pelo Poder Executivo sempre que discordar do mérito administrativo.',
        'A revogação incide sobre atos ilegais e produz efeitos retroativos (ex tunc).',
        'Os atos vinculados e os atos já exauridos admitem revogação a qualquer tempo pela autoridade superior.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: Anulação = vício de legalidade, efeitos retroativos (ex tunc), feita pela Administração (autotutela) ou pelo Judiciário. Revogação = mérito (conveniência e oportunidade) sobre ato válido e discricionário, efeitos prospectivos (ex nunc), feita EXCLUSIVAMENTE pela Administração. | ✅ Alternativa correta: A) Reproduz a célebre Súmula 473 do STF. | ❌ Análise das alternativas: B) O Judiciário NUNCA revoga ato de outro Poder (só controla legalidade/anulação); C) Revogação incide sobre ato VÁLIDO e tem efeito ex nunc; D) Atos vinculados, consumados ou que geraram direito adquirido são irrevogáveis. | ⚠️ Pegadinha da banca: Grave a regra de ouro: Judiciário ANULA ato ilegal, mas jamais REVOGA ato de outro Poder!'
    },
    {
      subject: 'Direito Administrativo',
      topic: 'Responsabilidade Civil do Estado (Art. 37, § 6º, da CF/88)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe — Polícias) Durante perseguição policial em via pública, uma viatura da Polícia Militar colidiu acidentalmente contra o veículo de um morador que estava regularmente estacionado. À luz do art. 37, § 6º, da Constituição Federal e da jurisprudência do STF:',
      options: [
        'O Estado responde objetivamente pelos danos causados ao terceiro, na modalidade do risco administrativo, assegurado o direito de regresso contra o agente público nos casos de dolo ou culpa.',
        'A vítima deve ajuizar a ação indenizatória diretamente contra o motorista da viatura policial, comprovando a culpa grave deste.',
        'Adota-se no Brasil, como regra geral para acidentes de trânsito envolvendo viaturas, a teoria do risco integral, que não admite nenhuma excludente de responsabilidade.',
        'O Estado somente responderá se ficar comprovado dolo específico do policial militar na condução da viatura.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: Pelo art. 37, § 6º, da CF/88, o Estado responde OBJETIVAMENTE (independentemente de dolo ou culpa) pelos danos que seus agentes, nessa qualidade, causarem a terceiros, sob a Teoria do Risco Administrativo (que admite excludentes como culpa exclusiva da vítima, caso fortuito ou força maior). | ✅ Alternativa correta: A) Responsabilidade objetiva do Estado + ação regressiva subjetiva (exige dolo ou culpa do agente). | ❌ Análise das alternativas: B) Pelo Tema 940 do STF (Dupla Garantia), a ação deve ser proposta contra o Estado, não diretamente contra o servidor; C) A regra é o Risco Administrativo, não o Risco Integral; D) A responsabilidade do Estado independe de dolo ou culpa. | ⚠️ Pegadinha da banca: Pelo STF (Tema 940), o particular lesado NÃO pode processar diretamente o agente público pelo ato funcional; deve processar o Estado, e o Estado cobra do agente em regresso se houver dolo ou culpa!'
    },
    {
      subject: 'Direito Penal',
      topic: 'Excludentes de Ilicitude — Legítima Defesa (Art. 25 do CP)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) De acordo com o art. 25 do Código Penal, incluído o parágrafo único pela Lei nº 13.964/2019 (Pacote Anticrime), entende-se em legítima defesa:',
      options: [
        'Quem pratica o fato para salvar de perigo atual, que não provocou por sua vontade, direito próprio ou alheio, cujo sacrifício não era razoável exigir-se.',
        'Quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem, considerando-se também em legítima defesa o agente de segurança pública que repele agressão ou risco de agressão a vítima mantida refém durante a prática de crimes.',
        'Apenas quem repele agressão injusta futura ou já inteiramente cessada contra seu patrimônio.',
        'O agente que age sob coação moral irresistível ou em estrita obediência a ordem manifestamente ilegal de superior hierárquico.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A legítima defesa (art. 25 do CP) exige agressão INJUSTA, ATUAL ou IMINENTE, uso moderado dos meios necessários e proteção de direito próprio ou alheio. O Pacote Anticrime incluiu o parágrafo único contemplando expressamente o agente de segurança pública no caso de vítima mantida refém. | ✅ Alternativa correta: B) Reúne o caput e o parágrafo único do art. 25 do Código Penal. | ❌ Análise das alternativas: A) Define o Estado de Necessidade (art. 24); C) Agressão passada é vingança e agressão futura é mera suposição (não admitem legítima defesa); D) Coação moral irresistível e obediência hierárquica a ordem NÃO manifestamente ilegal excluem a culpabilidade (art. 22), não a ilicitude. | ⚠️ Pegadinha da banca: No Estado de Necessidade há "perigo atual" (não fala em iminente); na Legítima Defesa há "injusta agressão, atual OU iminente".'
    },
    {
      subject: 'Direito Penal',
      topic: 'Desistência Voluntária e Arrependimento Eficaz (Art. 15 do CP)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Carreiras Policiais) O agente que, voluntariamente, desiste de prosseguir na execução do crime ou impede que o resultado se produza, nos termos do art. 15 do Código Penal ("Ponte de Ouro"):',
      options: [
        'Responde pelo crime tentado, com a pena reduzida de um a dois terços.',
        'Só responde pelos atos já praticados.',
        'Tem a sua pena reduzida de um sexto a um terço a título de arrependimento posterior.',
        'É isento de qualquer pena, ainda que os atos anteriores configurem lesão corporal ou porte ilegal de arma.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Na desistência voluntária (interrompe os atos executórios podendo continuar) e no arrependimento eficaz (esgota os atos executórios, mas age para impedir a consumação e tem sucesso), o art. 15 do CP afasta a tentativa e determina que o agente "só responde pelos atos já praticados". | ✅ Alternativa correta: B) Literalidade do art. 15 do Código Penal. | ❌ Análise das alternativas: A) É a consequência da tentativa (quando não se consuma por circunstâncias alheias à vontade do agente, art. 14, II); C) É o arrependimento posterior (art. 16, em crimes sem violência ou grave ameaça); D) Ele responde pelos atos anteriores que já forem típicos (ex.: violação de domicílio ou lesão corporal). | ⚠️ Pegadinha da banca: Se o agente para porque ouviu a sirene da viatura da PM, a circunstância é ALHEIA à vontade dele -> responde por TENTATIVA (art. 14, II); se ele pode prosseguir e para por vontade própria ("posso prosseguir, mas não quero" — Fórmula de Frank) -> Desistência Voluntária (art. 15).'
    },
    {
      subject: 'Direito Penal',
      topic: 'Crimes contra a Administração Pública — Concussão vs Corrupção Passiva',
      board: 'FGV Conhecimento',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(FGV Conhecimento) Um agente público que, no exercício de suas funções, EXIGE para si vantagem indevida, impondo temor à vítima em razão da autoridade do seu cargo, pratica o crime de:',
      options: [
        'Corrupção passiva (art. 317 do CP).',
        'Concussão (art. 316 do CP).',
        'Peculato-apropriação (art. 312 do CP).',
        'Prevaricação (art. 319 do CP).'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A diferença nuclear entre os tipos penais está no verbo: EXIGIR vantagem indevida = Concussão (art. 316 do CP, pena de reclusão de 2 a 12 anos, aumentada pelo Pacote Anticrime); SOLICITAR, RECEBER ou ACEITAR promessa de vantagem indevida = Corrupção Passiva (art. 317 do CP). | ✅ Alternativa correta: B) O verbo "exigir" caracteriza o crime formal de Concussão (art. 316 do CP). | ❌ Análise das alternativas: A) Corrupção passiva tem os verbos solicitar, receber ou aceitar promessa; C) Peculato é apropriar-se, desviar ou subtrair bem público ou particular de que tem a posse em razão do cargo; D) Prevaricação é retardar ou deixar de praticar ato de ofício para satisfazer interesse ou sentimento pessoal. | ⚠️ Pegadinha da banca: Se a questão trouxer o verbo EXIGIR, mas a exigência for de tributo ou contribuição social que sabe indevido, aí passa a ser Excesso de Exação (art. 316, § 1º)!'
    },
    {
      subject: 'Direito Processual Penal',
      topic: 'Inquérito Policial — Características e Súmula Vinculante 14',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Polícias) A respeito do Inquérito Policial no Código de Processo Penal e na jurisprudência vinculante do STF, assinale a alternativa CORRETA:',
      options: [
        'A autoridade policial poderá mandar arquivar autos de inquérito sempre que verificar a inexistência de crime.',
        'É direito do defensor, no interesse do representado, ter acesso amplo aos elementos de prova que, já documentados em procedimento investigatório realizado por órgão com competência de polícia judiciária, digam respeito ao exercício do direito de defesa.',
        'O inquérito policial é peça indispensável para o oferecimento da denúncia pelo Ministério Público em qualquer infração penal.',
        'Por ser procedimento sigiloso, o advogado precisa apresentar procuração com poderes especiais mesmo quando os autos não estiverem sujeitos a sigilo decretado.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: O Inquérito Policial é procedimento administrativo, escrito, sigiloso, inquisitivo, oficioso, oficial, indisponível e dispensável (Bizu: ECLIPSE / IDOSO). Pela Súmula Vinculante 14 do STF, o sigilo não alcança o defensor quanto às diligências JÁ DOCUMENTADAS nos autos. | ✅ Alternativa correta: B) Reproduz literalmente a Súmula Vinculante nº 14 do STF. | ❌ Análise das alternativas: A) Art. 17 do CPP: "A autoridade policial não poderá mandar arquivar autos de inquérito" (indisponibilidade); C) O IP é dispensável se o titular da ação penal já possuir elementos informativos suficientes; D) Sem sigilo especial, o advogado pode examinar autos sem procuração (Estatuto da OAB). | ⚠️ Pegadinha da banca: Pela SV 14, o advogado tem acesso ao que JÁ ESTÁ DOCUMENTADO nos autos, mas NÃO às diligências ainda em andamento (como interceptação telefônica em curso)!'
    },
    {
      subject: 'Direito Processual Penal',
      topic: 'Prisão em Flagrante (Art. 302 do CPP) e Uso de Algemas (SV 11)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe) Nos termos do Código de Processo Penal e da Súmula Vinculante nº 11 do STF, assinale a opção CORRETA acerca da prisão em flagrante e do uso de algemas:',
      options: [
        'Qualquer do povo DEVERÁ e as autoridades policiais e seus agentes PODERÃO prender quem quer que seja encontrado em flagrante delito.',
        'Só é lícito o uso de algemas em casos de resistência e de fundado receio de fuga ou de perigo à integridade física própria ou alheia, por parte do preso ou de terceiros, justificada a excepcionalidade por escrito, sob pena de responsabilidade disciplinar, civil e penal do agente ou da autoridade e de nulidade da prisão ou do ato processual a que se refere.',
        'A falta de testemunhas da infração impede a lavratura do auto de prisão em flagrante pela autoridade policial.',
        'O flagrante preparado ou provocado por agente policial é plenamente válido no ordenamento jurídico brasileiro.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A Súmula Vinculante 11 do STF condiciona a licitude do uso de algemas a 3 hipóteses (resistência, fundado receio de fuga ou perigo à integridade física própria ou alheia) + justificativa por escrito. | ✅ Alternativa correta: B) Texto literal da Súmula Vinculante 11 do STF. | ❌ Análise das alternativas: A) O art. 301 do CPP diz o inverso: "Qualquer do povo PODERÁ (facultativo) e as autoridades policiais e seus agentes DEVERÃO (obrigatório) prender..."; C) Art. 304, § 2º: a falta de testemunhas da infração não impede o auto de prisão em flagrante (assinam duas testemunhas de apresentação); D) Súmula 145 do STF: não há crime quando a preparação do flagrante pela polícia torna impossível a sua consumação (crime impossível). | ⚠️ Pegadinha da banca: O art. 301 do CPP é campeão de cobrança: Qualquer do povo PODERÁ (flagrante facultativo); Policiais DEVERÃO (flagrante obrigatório/compulsório)!'
    },
    {
      subject: 'Direitos Humanos',
      topic: 'Declaração Universal dos Direitos Humanos (DUDH — 1948)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) A Declaração Universal dos Direitos Humanos (DUDH), adotada pela Assembleia Geral da ONU em 10 de dezembro de 1948, constitui marco fundamental da proteção internacional da pessoa humana. Sobre a DUDH, assinale a alternativa CORRETA:',
      options: [
        'Foi aprovada sob a forma de tratado internacional solene com força coercitiva imediata e tribunal penal próprio.',
        'Consagra simultaneamente direitos civis e políticos (1ª geração/dimensão) e direitos econômicos, sociais e culturais (2ª geração/dimensão), afirmando que todos os seres humanos nascem livres e iguais em dignidade e direitos.',
        'Admite a aplicação de tortura ou tratamento cruel em casos excepcionais de guerra declarada ou terrorismo internacional.',
        'Restringe a titularidade dos direitos fundamentais apenas aos cidadãos natos dos Estados-membros signatários da ONU.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A DUDH (Resolução 217-A III da Assembleia Geral da ONU, 1948) une em um único texto os direitos de 1ª dimensão (arts. 3º a 21: vida, liberdade, segurança, presunção de inocência, asilo, nacionalidade) e os de 2ª dimensão (arts. 22 a 27: segurança social, trabalho, lazer, saúde, educação). | ✅ Alternativa correta: B) Reflete a indivisibilidade e universalidade dos direitos de 1ª e 2ª dimensões na DUDH. | ❌ Análise das alternativas: A) Formalmente foi adotada como Resolução da Assembleia Geral da ONU (não como tratado em sentido estrito); C) A vedação à tortura (art. 5º da DUDH) é absoluta e não comporta exceção; D) Os direitos da DUDH são universais, sem distinção de qualquer espécie (art. 2º). | ⚠️ Pegadinha da banca: O Instituto AOCP cobra com frequência se a DUDH traz apenas direitos de 1ª geração — ERRADO! Ela traz direitos de 1ª E de 2ª geração (civis/políticos + sociais/econômicos/culturais).'
    },
    {
      subject: 'Direitos Humanos',
      topic: 'Incorporação de Tratados de Direitos Humanos (Art. 5º, § 3º, da CF/88)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Polícias) De acordo com o art. 5º, § 3º, da Constituição Federal (incluído pela EC nº 45/2004) e a jurisprudência do Supremo Tribunal Federal, os tratados e convenções internacionais sobre direitos humanos:',
      options: [
        'Têm sempre status de lei ordinária federal, independentemente do quórum de aprovação no Congresso Nacional.',
        'Quando aprovados, em cada Casa do Congresso Nacional, em dois turnos, por três quintos dos votos dos respectivos membros, serão equivalentes às emendas constitucionais; se aprovados pelo rito comum, possuem status supralegal (abaixo da Constituição e acima das leis ordinárias).',
        'Precisam ser aprovados em turno único por maioria simples do Senado Federal para adquirirem status constitucional.',
        'Ingressam automaticamente no ordenamento jurídico brasileiro com status constitucional no momento da assinatura pelo Presidente da República.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Tratado de Direitos Humanos aprovado pelo rito especial do art. 5º, § 3º (2 casas, 2 turnos, 3/5 dos membros — Bizu: 2-2-3/5) = equivalente a Emenda Constitucional (bloco de constitucionalidade). Tratado de Direitos Humanos aprovado pelo rito ordinário (como o Pacto de San José da Costa Rica) = Status SUPRALEGAL (acima das leis e abaixo da CF). Tratado comum (comercial/tributário) = Lei Ordinária. | ✅ Alternativa correta: B) Explica com perfeição a dupla posição hierárquica dos tratados de Direitos Humanos no Brasil. | ❌ Análise das alternativas: A) Tratado de DH nunca é mera lei ordinária (é no mínimo supralegal); C e D) Violam o rito do art. 5º, § 3º (2 turnos, nas 2 Casas, por 3/5). | ⚠️ Pegadinha da banca: O Pacto de San José da Costa Rica tem status SUPRALEGAL (foi por isso que paralisou a prisão civil do depositário infiel — Súmula Vinculante 25 do STF)!'
    },
    {
      subject: 'Legislação Extravagante',
      topic: 'Lei Maria da Penha (Lei nº 11.340/2006 e Súmula 542 do STJ)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) Acerca da Lei nº 11.340/2006 (Lei Maria da Penha) e do entendimento sumulado do Superior Tribunal de Justiça, assinale a alternativa CORRETA:',
      options: [
        'Aos crimes praticados com violência doméstica e familiar contra a mulher, independentemente da pena prevista, não se aplica a Lei nº 9.099/1995 (Juizados Especiais), sendo a ação penal relativa ao crime de lesão corporal resultante de violência doméstica contra a mulher pública incondicionada.',
        'Para a configuração da violência doméstica e familiar baseada no gênero, é indispensável a coabitação atual entre o agressor e a ofendida.',
        'Na hipótese de renúncia à representação nos crimes de ação pública condicionada, a ofendida poderá manifestá-la diretamente perante a autoridade policial na delegacia.',
        'O crime de descumprimento de medida protetiva de urgência (art. 24-A) só se configura se a medida tiver sido deferida por juiz criminal.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: O art. 41 da Lei 11.340/2006 afasta integralmente a Lei 9.099/1995 nos crimes praticados com violência doméstica contra a mulher, e a Súmula 542 do STJ estabelece que a lesão corporal praticada contra a mulher no âmbito doméstico é de ação penal pública INCONDICIONADA. | ✅ Alternativa correta: A) Soma a literalidade do art. 41 da Lei 11.340/06 com a Súmula 542 do STJ. | ❌ Análise das alternativas: B) Art. 5º, III: independe de coabitação; C) Art. 16: a retratação/renúncia à representação só será admitida PERANTE O JUIZ, em audiência especialmente designada com essa finalidade, antes do recebimento da denúncia e ouvido o MP; D) Art. 24-A, § 1º: a configuração do crime independe da competência civil ou criminal do juiz que deferiu as medidas. | ⚠️ Pegadinha da banca: Lesão corporal na Lei Maria da Penha = Ação Pública INCONDICIONADA (mesmo que leve!). Ameaça na Lei Maria da Penha = Ação Pública CONDICIONADA à representação (e a retratação só vale perante o JUIZ antes do recebimento da denúncia).'
    },
    {
      subject: 'Legislação Extravagante',
      topic: 'Lei de Abuso de Autoridade (Lei nº 13.869/2019)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — Polícias) Nos termos dos artigos 1º a 4º da Lei nº 13.869/2019 (Nova Lei de Abuso de Autoridade), assinale a alternativa CORRETA:',
      options: [
        'A divergência na interpretação de lei ou na avaliação de fatos e provas configura crime de abuso de autoridade na modalidade culposa.',
        'As condutas descritas na lei constituem crime de abuso de autoridade quando praticadas pelo agente com a finalidade específica de prejudicar outrem ou beneficiar a si mesmo ou a terceiro, ou, ainda, por mero capricho ou satisfação pessoal.',
        'Os crimes previstos na Lei nº 13.869/2019 são de ação penal pública condicionada à representação do ofendido.',
        'A perda do cargo, do mandato ou da função pública é efeito automático da primeira condenação por crime de abuso de autoridade.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Todos os crimes da Lei 13.869/2019 são DOLOSOS e exigem dolo específico (elemento subjetivo especial do tipo previsto no art. 1º, § 1º: prejudicar outrem, beneficiar a si ou a terceiro, ou agir por mero capricho ou satisfação pessoal). | ✅ Alternativa correta: B) Literalidade do art. 1º, § 1º, da Lei 13.869/2019. | ❌ Análise das alternativas: A) Art. 1º, § 2º: a divergência na interpretação de lei ou na avaliação de fatos e provas NÃO configura abuso de autoridade (vedação ao crime de hermenêutica), e não existe abuso de autoridade culposo; C) Art. 3º: todos os crimes da lei são de ação penal pública INCONDICIONADA; D) Art. 4º, parágrafo único: a perda do cargo e a inabilitação (de 1 a 5 anos) NÃO são automáticas — exigem REINCIDÊNCIA em crime de abuso de autoridade e devem ser declaradas motivadamente na sentença! | ⚠️ Pegadinha da banca: Compare Tortura (perda do cargo é AUTOMÁTICA) x Abuso de Autoridade (perda do cargo NÃO é automática e exige REINCIDÊNCIA específica em crime de abuso de autoridade)!'
    },
    {
      subject: 'Legislação Extravagante',
      topic: 'Lei de Tortura (Lei nº 9.455/1997)',
      board: 'Cebraspe',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Cebraspe) À luz da Lei nº 9.455/1997 (Lei de Tortura), assinale a opção CORRETA:',
      options: [
        'No Brasil, o crime de tortura é crime próprio em todas as suas modalidades, só podendo figurar como sujeito ativo o agente público.',
        'Aquele que se omite em face das condutas de tortura, quando tinha o dever de evitá-las ou apurá-las, incorre na pena de detenção de um a quatro anos, e a condenação acarretará a perda do cargo, função ou emprego público e a interdição para seu exercício pelo dobro do prazo da pena aplicada.',
        'A Lei de Tortura aplica-se exclusivamente aos crimes cometidos dentro do território nacional.',
        'O crime de tortura admite concessão de fiança pela autoridade policial no caso da modalidade omissiva.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: No Brasil (diferente da Convenção da ONU), a tortura é, em regra, CRIME COMUM (qualquer pessoa pode praticar, exceto na tortura-castigo de preso/pessoa submetida a medida de segurança do art. 1º, § 1º, e na tortura omissiva do § 2º). Na tortura omissiva (tortura imprópria), a pena é de DETENÇÃO de 1 a 4 anos. | ✅ Alternativa correta: B) Reúne o art. 1º, § 2º (detenção de 1 a 4 anos na omissão) e o § 5º (perda automática do cargo + interdição pelo dobro do prazo da pena aplicada). | ❌ Análise das alternativas: A) Em regra é crime comum (e se cometido por agente público, aumenta a pena de 1/6 a 1/3 — art. 1º, § 4º, I); C) Art. 2º: tem extraterritorialidade incondicionada se a vítima for brasileira ou se o agente encontrar-se em local sob jurisdição brasileira; D) O crime de tortura é inafiançável e insuscetível de graça ou anistia (§ 6º). | ⚠️ Pegadinha da banca: Na Lei de Tortura, a perda do cargo é efeito AUTOMÁTICO da condenação e a interdição vale pelo DOBRO do prazo da pena aplicada!'
    },
    {
      subject: 'Legislação Extravagante',
      topic: 'Lei de Drogas (Lei nº 11.343/2006 — Art. 28 vs Art. 33)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE) De acordo com o art. 28 da Lei nº 11.343/2006 (Lei de Drogas), quem adquirir, guardar, tiver em depósito, transportar ou trouxer consigo, para consumo pessoal, drogas sem autorização ou em desacordo com determinação legal ou regulamentar será submetido às seguintes medidas, EXCETO:',
      options: [
        'Advertência sobre os efeitos das drogas.',
        'Prestação de serviços à comunidade.',
        'Medida educativa de comparecimento a programa ou curso educativo.',
        'Pena privativa de liberdade de detenção de seis meses a dois anos.'
      ],
      correct_index: 3,
      explanation: 'Conceito-chave: O art. 28 da Lei 11.343/2006 (porte de droga para consumo pessoal) NUNCA prevê pena privativa de liberdade (nem prisão em flagrante, nem detenção, nem reclusão)! As três medidas são apenas: I - advertência; II - prestação de serviços à comunidade; III - comparecimento a programa ou curso educativo. | ✅ Alternativa correta: D) Não existe pena de detenção ou reclusão para o art. 28 da Lei de Drogas. | ❌ Análise das alternativas: A, B e C constam nos incisos I, II e III do art. 28 da Lei 11.343/2006. | ⚠️ Pegadinha da banca: Mesmo que o indivíduo descumpra injustificadamente as medidas do art. 28, o juiz só pode aplicar admoestação verbal e multa (art. 28, § 6º) — jamais conversão em prisão!'
    },
    {
      subject: 'Legislação Extravagante',
      topic: 'Estatuto do Desarmamento (Lei nº 10.826/2003 — Posse vs Porte)',
      board: 'FGV Conhecimento',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(FGV Conhecimento) À luz da Lei nº 10.826/2003 (Estatuto do Desarmamento), assinale a alternativa que distingue corretamente os crimes de posse irregular (art. 12) e porte ilegal (art. 14) de arma de fogo de uso permitido:',
      options: [
        'A posse irregular (art. 12) consiste em possuir ou manter sob sua guarda arma de fogo de uso permitido no interior de sua residência ou dependência desta, ou no seu local de trabalho, desde que seja o titular ou o responsável legal do estabelecimento ou empresa; já o porte fora desses locais configura o crime do art. 14.',
        'Qualquer empregado subalterno que mantenha arma de fogo sem registro dentro da empresa em que trabalha responde apenas por posse irregular (art. 12).',
        'O crime de posse irregular de arma de fogo de uso permitido (art. 12) é punido com reclusão de 4 a 8 anos e é inafiançável.',
        'Portar arma de fogo desmuniciada em via pública é conduta absolutamente atípica segundo a jurisprudência consolidada do STF.'
      ],
      correct_index: 0,
      explanation: 'Conceito-chave: Posse irregular (art. 12, detenção de 1 a 3 anos) ocorre no interior da residência/dependência ou no local de trabalho (desde que o agente seja o TITULAR ou RESPONSÁVEL LEGAL da empresa). Fora desses locais, ou no local de trabalho quando o agente NÃO é o titular/responsável legal, configura-se PORTE ilegal (art. 14, reclusão de 2 a 4 anos). | ✅ Alternativa correta: A) Distingue exatamente o critério espacial e subjetivo dos arts. 12 e 14 da Lei 10.826/2003. | ❌ Análise das alternativas: B) Se o empregado não é o titular/responsável legal do estabelecimento, manter arma no trabalho configura PORTE ilegal (art. 14); C) A pena do art. 12 é detenção de 1 a 3 anos e multa; D) Para o STF e STJ, os crimes dos arts. 12, 14 e 16 são de perigo abstrato (portar arma desmuniciada, porém apta a disparar, continua sendo crime). | ⚠️ Pegadinha da banca: Funcionário comum (que não é dono nem gerente/responsável legal) que guarda arma na gaveta do escritório comete PORTE ILEGAL (art. 14), e não posse!'
    },
    {
      subject: 'Direito Militar',
      topic: 'Estatuto dos Militares de PE (Lei Estadual nº 6.783/1974 — Hierarquia e Disciplina)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE/CBMPE) Nos termos do art. 12 da Lei Estadual nº 6.783/1974 (Estatuto dos Policiais Militares do Estado de Pernambuco), constituem a base institucional da Polícia Militar, crescendo a autoridade e a responsabilidade com a elevação do grau hierárquico:',
      options: [
        'A discricionariedade e a conveniência administrativa.',
        'A hierarquia e a disciplina.',
        'A inamovibilidade e a vitaliciedade.',
        'A subordinação civil e a livre sindicalização.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Tanto pelo art. 42 e art. 142 da CF/88 quanto pelo art. 12 da Lei Estadual 6.783/1974, a HIERARQUIA e a DISCIPLINA são a base institucional das Corporações Militares Estaduais (PMPE e CBMPE). | ✅ Alternativa correta: B) Literalidade do art. 12 da Lei 6.783/1974: Hierarquia é a ordenação da autoridade em níveis diferentes dentro da estrutura da Corporação (por postos e graduações); Disciplina é a rigorosa observância e o acatamento integral das leis, regulamentos, normas e disposições. | ❌ Análise das alternativas: A) São conceitos do ato administrativo discricionário; C) São garantias da magistratura; D) Ao militar são proibidas a sindicalização e a greve (art. 142, § 3º, IV, CF/88). | ⚠️ Pegadinha da banca: O Instituto AOCP costuma inverter os conceitos de Posto e Graduação do art. 14 da Lei 6.783/74: POSTO é o grau hierárquico do OFICIAL (conferido por ato do Governador); GRADUAÇÃO é o grau hierárquico da PRAÇA (conferido pelo Comandante-Geral)!'
    },
    {
      subject: 'Direito Militar',
      topic: 'Estatuto dos Militares de PE (Lei nº 6.783/1974 — Agregação vs Reversão vs Excedente)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — PMPE/CBMPE) Segundo a Lei Estadual nº 6.783/1974 (Estatuto dos Militares de Pernambuco), a situação na qual o policial militar da ativa deixa de ocupar vaga na escala hierárquica do seu Quadro, nela permanecendo sem número, denomina-se:',
      options: [
        'Reversão.',
        'Agregação.',
        'Reforma compulsória.',
        'Transferência para a reserva remunerada.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Pelo art. 75 da Lei 6.783/1974, a AGREGAÇÃO é a situação na qual o militar da ativa deixa de ocupar vaga na escala hierárquica do seu Quadro, nela permanecendo sem número. Já a REVERSÃO (art. 80) é o ato pelo qual o militar agregado retorna ao respectivo Quadro tão logo cesse o motivo que determinou a sua agregação. | ✅ Alternativa correta: B) Define exatamente o instituto da Agregação (art. 75). | ❌ Análise das alternativas: A) Reversão é o retorno do agregado à escala ativa (art. 80); C e D) Reforma e Reserva são formas de inatividade (o agregado continua sendo militar da ATIVA!). | ⚠️ Pegadinha da banca: O militar AGREGADO continua na ATIVA (não foi para a inatividade!), apenas fica "sem número" no quadro; quando cessa o motivo da agregação, ele retorna por meio da REVERSÃO.'
    },
    {
      subject: 'Direito Militar',
      topic: 'Código Penal Militar — Crime Militar em Tempo de Paz (Art. 9º do CPM)',
      board: 'Cebraspe',
      difficulty: 'dificil',
      origin: 'oficial',
      statement: '(Cebraspe — Polícias Militares e Bombeiros) Com base no art. 9º do Código Penal Militar (com a redação dada pela Lei nº 13.491/2017) e no art. 125, § 4º, da Constituição Federal, assinale a opção CORRETA:',
      options: [
        'Apenas os crimes previstos de modo exclusivo no Código Penal Militar podem ser considerados crimes militares em tempo de paz.',
        'Os crimes previstos na legislação penal comum (como abuso de autoridade, tortura ou crimes do Código Penal), quando praticados por militar em serviço ou atuando em razão da função, passam a ser considerados crimes militares por extensão.',
        'Os crimes dolosos contra a vida de civil praticados por policial militar estadual em serviço são julgados monocraticamente pelo Juiz de Direito do Juízo Militar.',
        'Compete à Justiça Militar Estadual processar e julgar civis que praticarem crime de desacato contra guarnição da Polícia Militar.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A Lei 13.491/2017 alterou o inciso II do art. 9º do CPM para abranger não apenas os crimes previstos no CPM, mas também os previstos na legislação penal comum (crimes militares por extensão/extravagantes), quando preenchidas as hipóteses do inciso II (ex.: militar em serviço ou atuando em razão da função). | ✅ Alternativa correta: B) Reflete a ampliação da competência da Justiça Militar operada pela Lei 13.491/2017. | ❌ Análise das alternativas: A) Ignora a Lei 13.491/2017; C) Pelo art. 125, § 4º, da CF/88 e art. 9º, § 1º, do CPM, os crimes dolosos contra a vida de civil praticados por militares estaduais são da competência do TRIBUNAL DO JÚRI; D) A Justiça Militar ESTADUAL nunca julga civis (art. 125, § 4º, da CF/88: compete à JME processar e julgar os MILITARES dos Estados). | ⚠️ Pegadinha da banca: A Justiça Militar da UNIÃO (Federal) pode julgar civis em hipóteses restritas, mas a Justiça Militar ESTADUAL (PMPE/CBMPE) NUNCA julga civil!'
    },
    {
      subject: 'Física',
      topic: 'Termologia e Propagação de Calor (Condução, Convecção e Irradiação — CBMPE)',
      board: 'Instituto AOCP',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(Instituto AOCP — CBMPE Bombeiro Militar) Na dinâmica dos incêndios estruturais, o calor propaga-se de uma região de maior temperatura para outra de menor temperatura por três processos físicos fundamentais. O processo de transferência de calor que ocorre predominantemente em fluidos (líquidos e gases) mediante o deslocamento de massas de diferentes densidades — fazendo com que a fumaça e os gases superaquecidos subam até o teto do ambiente — denomina-se:',
      options: [
        'Condução térmica.',
        'Convecção térmica.',
        'Irradiação térmica.',
        'Sublimação adiabática.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Condução = transferência partícula a partícula sem transporte de matéria (predominante nos sólidos/metais); Convecção = transferência por movimentação de massas de fluido (líquidos e gases) devido à diferença de densidade; Irradiação = ondas eletromagnéticas (infravermelho), única que ocorre até no vácuo. | ✅ Alternativa correta: B) A subida dos gases quentes e da fumaça para o teto em um incêndio ocorre por Convecção térmica. | ❌ Análise das alternativas: A) Condução ocorre sem transporte de matéria (ex.: barra de ferro aquecida); C) Irradiação ocorre por ondas eletromagnéticas sem exigir meio material; D) Sublimação é mudança de estado físico. | ⚠️ Pegadinha da banca: Em provas do Corpo de Bombeiros (CBMPE), lembre-se de que nos SÓLIDOS não há convecção (apenas condução), e no VÁCUO só ocorre irradiação!'
    },
    {
      subject: 'Biologia',
      topic: 'Fisiologia Humana e Atendimento Pré-Hospitalar (CBMPE)',
      board: 'Instituto AOCP',
      difficulty: 'medio',
      origin: 'oficial',
      statement: '(Instituto AOCP — CBMPE) No estudo da fisiologia circulatória e respiratória aplicada ao socorro de urgência, o vaso sanguíneo que transporta sangue rico em oxigênio (sangue arterial) diretamente dos pulmões para o átrio esquerdo do coração é:',
      options: [
        'A artéria pulmonar.',
        'A veia cava superior.',
        'As veias pulmonares.',
        'A artéria aorta.'
      ],
      correct_index: 2,
      explanation: 'Conceito-chave: Artéria é todo vaso que SAI do coração (ventrículos); Veia é todo vaso que CHEGA ao coração (átrios). Na pequena circulação (pulmonar), ocorre a exceção clássica: a artéria pulmonar leva sangue venoso (rico em CO2) do ventrículo direito aos pulmões, e as VEIAS PULMONARES trazem sangue arterial (rico em O2) dos pulmões para o átrio esquerdo. | ✅ Alternativa correta: C) As quatro veias pulmonares desembocam no átrio esquerdo trazendo sangue oxigenado dos pulmões. | ❌ Análise das alternativas: A) Artéria pulmonar carrega sangue venoso para os pulmões; B) Veia cava traz sangue venoso do corpo para o átrio direito; D) Artéria aorta sai do ventrículo esquerdo para o corpo. | ⚠️ Pegadinha da banca: Nunca associe "veia = sangue venoso" de forma absoluta! As veias pulmonares carregam sangue ARTERIAL (rico em O2), e as artérias pulmonares carregam sangue VENOSO (rico em CO2).'
    },
    {
      subject: 'Língua Portuguesa',
      topic: 'Vozes Verbais e Transposição para a Voz Passiva',
      board: 'IBFC',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(IBFC — Polícias) Ao transpor a oração na voz ativa "A guarnição apreendeu dois simulacros durante a abordagem" para a voz passiva analítica, mantendo-se o mesmo tempo e modo verbal, obtém-se:',
      options: [
        'Dois simulacros são apreendidos pela guarnição durante a abordagem.',
        'Dois simulacros foram apreendidos pela guarnição durante a abordagem.',
        'Dois simulacros tinham sido apreendidos pela guarnição durante a abordagem.',
        'Apreenderam-se dois simulacros durante a abordagem.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: Na transposição da voz ativa para a passiva analítica, o objeto direto ("dois simulacros") vira sujeito paciente, e o verbo auxiliar "ser" deve ficar no MESMO tempo e modo do verbo principal da ativa ("apreendeu" = pretérito perfeito do indicativo -> "foram apreendidos"). | ✅ Alternativa correta: B) "Apreendeu" (pretérito perfeito) -> "foram apreendidos". | ❌ Análise das alternativas: A) "São apreendidos" está no presente; C) "Tinham sido" está no pretérito mais-que-perfeito composto; D) Trata-se da voz passiva sintética (pronominal), e não analítica. | ⚠️ Pegadinha da banca: O IBFC e o Instituto AOCP sempre trocam o tempo do verbo auxiliar ("são" / "foram" / "serão") ou oferecem a passiva sintética quando o enunciado pede a passiva analítica.'
    },
    {
      subject: 'Direito Constitucional',
      topic: 'Art. 37 — Administração Pública (Princípios LIMPE e Súmula Vinculante 13)',
      board: 'IBFC',
      difficulty: 'facil',
      origin: 'oficial',
      statement: '(IBFC) Nos termos da Súmula Vinculante nº 13 do Supremo Tribunal Federal, a vedação ao nepotismo na Administração Pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios decorre diretamente dos princípios constitucionais do art. 37, caput, alcançando parentes em linha reta, colateral ou por afinidade até o:',
      options: [
        'Segundo grau, necessitando de lei municipal ou estadual específica para produzir efeitos.',
        'Terceiro grau, inclusive, independendo da edição de lei formal específica, por decorrer diretamente da moralidade e da impessoalidade.',
        'Quarto grau, aplicando-se inclusive aos cargos políticos de Secretário de Estado e Ministro de Estado em qualquer hipótese.',
        'Primeiro grau apenas, limitando-se a cônjuge e filhos.'
      ],
      correct_index: 1,
      explanation: 'Conceito-chave: A Súmula Vinculante 13 do STF veda a nomeação de cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o 3º GRAU, inclusive, para cargos em comissão ou funções de confiança, bem como o nepotismo cruzado, diretamente por força do art. 37, caput (moralidade e impessoalidade). | ✅ Alternativa correta: B) Parentesco até o 3º grau, inclusive (pais, filhos, avós, netos, irmãos, tios, sobrinhos, sogros, cunhados etc.), sem depender de lei específica. | ❌ Análise das alternativas: A) Vai até o 3º grau e independe de lei formal; C) Não alcança o 4º grau (primos são 4º grau!) e, em regra, não se aplica a cargos de natureza política (salvo fraude/ausência de qualificação); D) Vai até o 3º grau. | ⚠️ Pegadinha da banca: PRIMO é parente colateral de 4º GRAU, portanto a nomeação de primo NÃO é vedada pela Súmula Vinculante 13!'
    }
  ];
  window.NATIVE_POLICE_QUESTION_BANK = NATIVE_POLICE_QUESTION_BANK;

  function questionMatchesBoardFilter(item, boardFilter) {
    if (!boardFilter || boardFilter === 'all') return true;
    const target = String(boardFilter).toLocaleLowerCase('pt-BR').trim();
    const hay = `${item?.board || ''} ${item?.statement || ''} ${item?.explanation || ''} ${item?.topic || ''}`.toLocaleLowerCase('pt-BR');
    if (target.includes('aocp')) return /aocp/.test(hay);
    if (target.includes('cebraspe') || target.includes('cespe')) return /cebraspe|cespe/.test(hay);
    if (target.includes('fgv')) return /fgv|fundacao getulio vargas/.test(hay);
    if (target.includes('upenet') || target.includes('iaupe')) return /upenet|iaupe/.test(hay);
    if (target.includes('ibfc')) return /ibfc/.test(hay);
    if (target.includes('idecan')) return /idecan/.test(hay);
    return hay.includes(target);
  }
  window.questionMatchesBoardFilter = questionMatchesBoardFilter;

  function ensureNativeQuestionBankLoaded() {
    if (typeof ALL_QUESTIONS === 'undefined' || !Array.isArray(ALL_QUESTIONS)) return;
    const existingFp = new Set(ALL_QUESTIONS.map(qItem => questionFingerprint(qItem)));
    let added = 0;
    for (const item of NATIVE_POLICE_QUESTION_BANK) {
      const normalized = {
        ...item,
        subject: canonicalSubjectName(item.subject),
        is_native_bank: true
      };
      const fp = questionFingerprint(normalized);
      if (!existingFp.has(fp)) {
        existingFp.add(fp);
        ALL_QUESTIONS.push(normalized);
        added++;
      }
    }
    if (added > 0 && typeof window.updateLocalDbBadgeUI === 'function') {
      window.updateLocalDbBadgeUI();
    }
  }
  window.ensureNativeQuestionBankLoaded = ensureNativeQuestionBankLoaded;

  function getNativeQuestionsForSubject(subject, boardFilter = 'all') {
    const sKey = subjectKey(learningCategory(subject));
    let matches = NATIVE_POLICE_QUESTION_BANK.filter(qItem => subjectKey(learningCategory(qItem.subject)) === sKey);
    if (!matches.length) matches = NATIVE_POLICE_QUESTION_BANK.slice(0, 6);
    if (boardFilter && boardFilter !== 'all') {
      const byBoard = matches.filter(qItem => questionMatchesBoardFilter(qItem, boardFilter));
      const others = matches.filter(qItem => !questionMatchesBoardFilter(qItem, boardFilter));
      return [...byBoard, ...others];
    }
    return matches;
  }
  window.getNativeQuestionsForSubject = getNativeQuestionsForSubject;

  // 2. Filtros Avançados (Tópico, Modo Progressivo, Inéditas/Favoritas estilo TEC/Qconcursos)
  function normalizedOrigin(question){const origin=String(question?.origin||'autoral').toLocaleLowerCase('pt-BR');return /oficial|importad|prova|adaptada/.test(origin)?'oficial':'autoral'}
  function normalizedDifficulty(question){const value=String(question?.difficulty||'medio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return value.startsWith('fac')?'facil':value.startsWith('dif')?'dificil':'medio'}
  function topicKey(value){const s=String(value||'');if(!s)return'';const c=topicKey._c||(topicKey._c=new Map());if(s.length<=160){const hit=c.get(s);if(hit!==undefined)return hit}const out=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(s.length<=160){if(c.size>6000)c.clear();c.set(s,out)}return out}

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

  function renderQuickBoaRespostaBar(){
    ensureNativeQuestionBankLoaded();
    const trainer=q('.questionTrainer');
    if(!trainer)return;
    let bar=q('#quickBoaRespostaBar');
    if(!bar){
      const head=trainer.querySelector('.sectionHead');
      const html=`<div class="quickBoaRespostaBox" id="quickBoaRespostaBar"></div>`;
      if(head)head.insertAdjacentHTML('afterend',html);
      else trainer.insertAdjacentHTML('afterbegin',html);
      bar=q('#quickBoaRespostaBar');
    }
    if(!bar)return;
    const currentBoard=q('#questionBoardFilter')?.value||'all';
    const boards=[
      {val:'all',label:'Todas as Bancas'},
      {val:'Instituto AOCP',label:'🎯 Instituto AOCP'},
      {val:'Cebraspe',label:'⚖️ Cebraspe'},
      {val:'FGV Conhecimento',label:'🏛️ FGV'},
      {val:'UPENET/IAUPE',label:'🛡️ UPENET/IAUPE'},
      {val:'IBFC',label:'📋 IBFC'}
    ];
    const allQs=(ALL_QUESTIONS||[]).filter(item=>questionMatchesBoardFilter(item,currentBoard));
    const countsBySubj=new Map();
    for(const item of allQs){
      const s=learningCategory(item.subject)||'Geral';
      if(isInvalidTrailSubject(s))continue;
      countsBySubj.set(s,(countsBySubj.get(s)||0)+1);
    }
    const subjects=[...countsBySubj.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
    bar.innerHTML=`
      <div class="quickBoaHeader">
        <div>
          <span class="eyebrow" style="color:var(--cyan)">⚡ TREINO RÁPIDO EM 1 CLIQUE (ESTILO BOARESPOSTA)</span>
          <p class="small muted" style="margin:2px 0 0">Escolha a banca examinadora abaixo e toque em qualquer disciplina para abrir uma sessão progressiva imediata com gabarito passo a passo:</p>
        </div>
        <span class="tag">${allQs.length} questões ${currentBoard==='all'?'no banco':escText(currentBoard)}</span>
      </div>
      <div class="quickBoardPills" role="group" aria-label="Filtro rápido de banca examinadora">
        ${boards.map(b=>`<button type="button" class="quickBoardPill ${currentBoard===b.val?'active':''}" data-quick-board="${escText(b.val)}">${escText(b.label)}</button>`).join('')}
      </div>
      <div class="quickSubjectChips">
        ${subjects.map(([subj,cnt])=>`<button type="button" class="quickSubjectChip" data-quick-subject-launch="${escText(subj)}"><b>${escText(subj)}</b><span>${cnt} q. →</span></button>`).join('')}
      </div>
    `;
    qa('[data-quick-board]').forEach(btn=>{
      btn.onclick=()=>{
        const bVal=btn.dataset.quickBoard||'all';
        if(q('#questionBoardFilter'))q('#questionBoardFilter').value=bVal;
        populateTopicFilter();
        updateQuestionPool();
        renderQuickBoaRespostaBar();
      };
    });
    qa('[data-quick-subject-launch]').forEach(btn=>{
      btn.onclick=()=>{
        const subj=btn.dataset.quickSubjectLaunch;
        const subjSel=q('#questionSubject');
        if(subjSel){
          if(![...subjSel.options].some(o=>o.value===subj)){
            subjSel.insertAdjacentHTML('beforeend',`<option value="${escText(subj)}">${escText(subj)}</option>`);
          }
          subjSel.value=subj;
        }
        if(q('#questionTopic'))q('#questionTopic').value='all';
        if(q('#questionBattleMode'))q('#questionBattleMode').value='progressive';
        populateTopicFilter();
        updateQuestionPool();
        startFilteredBattle();
      };
    });
  }
  window.renderQuickBoaRespostaBar=renderQuickBoaRespostaBar;

  function ensureTopicFilterSelect(){
    ensureNativeQuestionBankLoaded();
    const filters=q('.questionFilters');
    if(!filters)return;
    if(!q('#questionBoardFilter')){
      const subjectField=q('#questionSubject')?.closest('.field');
      const boardHtml=`<label class="field">Banca Examinadora<select id="questionBoardFilter"><option value="all">Todas as bancas (Banco completo)</option><option value="Instituto AOCP">🎯 Instituto AOCP (PMPE / CBMPE / Polícias)</option><option value="Cebraspe">⚖️ Cebraspe (CESPE)</option><option value="FGV Conhecimento">🏛️ FGV Conhecimento</option><option value="UPENET/IAUPE">🛡️ UPENET / IAUPE (Concursos PE)</option><option value="IBFC">📋 IBFC</option><option value="IDECAN">🦅 IDECAN</option></select></label>`;
      if(subjectField)subjectField.insertAdjacentHTML('beforebegin',boardHtml);
      else filters.insertAdjacentHTML('afterbegin',boardHtml);
      q('#questionBoardFilter')?.addEventListener('change',()=>{
        populateTopicFilter();
        updateQuestionPool();
        renderQuickBoaRespostaBar();
      });
    }
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
    renderQuickBoaRespostaBar();
  }

  function populateTopicFilter(){
    ensureTopicFilterSelect();
    const topicSelect=q('#questionTopic');
    if(!topicSelect)return;
    const subject=q('#questionSubject')?.value||'all';
    const board=q('#questionBoardFilter')?.value||'all';
    const currentTopic=topicSelect.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const allForSubject=(ALL_QUESTIONS||[]).filter(item=>(subject==='all'||learningCategory(item.subject)===subject)&&questionMatchesBoardFilter(item,board));
    const pool=allForSubject.length?allForSubject:baseSource;
    const topicsMap=new Map();
    for(const item of pool){
      const label=String(item?.topic||'').trim();
      const key=topicKey(label);
      if(label&&key&&!topicsMap.has(key))topicsMap.set(key,label);
    }
    const sorted=[...topicsMap.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
    topicSelect.innerHTML='<option value="all">Todos os assuntos</option>'+sorted.map(([key,label])=>`<option value="${escText(key)}" title="${escText(label)}">${escText(shortLabel(label,52))}</option>`).join('');
    topicSelect.value=topicsMap.has(currentTopic)?currentTopic:'all';
    populateExamHubSelects();
  }

  function filteredQuestionPool(){
    ensureNativeQuestionBankLoaded();
    const subject=q('#questionSubject')?.value||'all',board=q('#questionBoardFilter')?.value||'all',topic=q('#questionTopic')?.value||'all',difficulty=q('#questionDifficulty')?.value||'all',origin=q('#questionOrigin')?.value||'all',battleMode=q('#questionBattleMode')?.value||'progressive',historyFilter=q('#questionHistoryFilter')?.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const allMatchingSubject=(ALL_QUESTIONS||[]).filter(item=>subject==='all'||learningCategory(item.subject)===subject);
    const source=allMatchingSubject.length?allMatchingSubject:baseSource;
    let filtered=source.filter(item=>questionMatchesBoardFilter(item,board)&&(topic==='all'||topicKey(item?.topic)===topic)&&(difficulty==='all'||normalizedDifficulty(item)===difficulty)&&(origin==='all'||normalizedOrigin(item)===origin));
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
        <button type="button" class="ghost small" id="toggleFavoriteQuestionBtn">${isFav?'⭐ Favorita (salva)':'☆ Favoritar questão'}</button>
        <button type="button" class="ghost small" id="saveQuestionNoteBtn">📌 Salvar no Caderno</button>
        <button type="button" class="ghost small" id="reportQuestionIssueBtn">🚩 Corrigir / Reportar</button>
      </div>
      <div id="easyAnalogyOutput" hidden class="stepResolutionBlock concept" style="margin-top:6px"></div>
      <div class="personalQuestionBizuBox">
        <label class="small muted" for="personalQuestionCommentInput">💬 Meu bizu / anotação nesta questão (estilo TEC/Qconcursos):</label>
        <div class="personalBizuRow">
          <input type="text" id="personalQuestionCommentInput" value="${escText(savedComment)}" placeholder="Escreva seu mnemônico ou observação rápida para lembrar desta questão...">
          <button type="button" class="ghost small" id="savePersonalQuestionCommentBtn">Salvar bizu</button>
        </div>
      </div>` : '';

    const chosenText=(Number.isInteger(chosenIndex)&&chosenIndex>=0&&item.options?.[chosenIndex])?item.options[chosenIndex]:'';
    const correctText=item.options?.[correctIndex]||'';
    const directComparisonHtml=(!ok&&chosenText)?`
      <div class="directChoiceComparison">
        <div class="choiceCompareCard wrongPick">
          <span class="choiceCompareLabel">✗ SUA ESCOLHA (ALTERNATIVA ${chosenLetter})</span>
          <p>${escText(chosenText)}</p>
        </div>
        <div class="choiceCompareCard rightPick">
          <span class="choiceCompareLabel">✓ GABARITO OFICIAL (ALTERNATIVA ${correctLetter})</span>
          <p>${escText(correctText)}</p>
        </div>
      </div>
    `:'';

    return `<div class="boaRespostaResolution ${ok?'isGood':'isBad'}">
      <div class="resolutionHeader">
        <div>
          <span class="eyebrow">${ok?'✓ RESPOSTA CORRETA · +25 XP':'✗ RESPOSTA INCORRETA · APRENDA COM O PASSO A PASSO'}</span>
          <h4>Gabarito: Alternativa ${correctLetter}${!ok?` (você marcou ${chosenLetter})`:''}</h4>
        </div>
        <span class="tag">${escText(item.board||(normalizedOrigin(item)==='oficial'?'Prova Oficial':'Estilo Banca'))}</span>
      </div>
      ${directComparisonHtml}
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
    LEARNING_SUBJECTS=typeof window.computeValidLearningSubjects==='function'?window.computeValidLearningSubjects():[...new Set([...LEARNING_SUBJECTS,...toAdd.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
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

  function buildLocalCognitiveTwinQuestion(mold){
    const subj=learningCategory(mold?.subject||'Conteúdo Geral');
    const topic=String(mold?.topic||'Fixação de Conceito').replace(/^\[Gêmea\]\s*/i,'').trim();
    const board=mold?.board||'Estilo Banca';
    const origOpts=Array.isArray(mold?.options)?mold.options:[];
    const origCorrectIdx=Math.min(Math.max(0,Number(mold?.correct_index)||0),Math.max(0,origOpts.length-1));
    const correctText=String(origOpts[origCorrectIdx]||'Aplicação correta da regra prevista no edital.').trim();
    const attempt=mold?._lastAttempt||null;
    const wrongDistractors=origOpts.filter((_,i)=>i!==origCorrectIdx).map(x=>String(x).trim()).filter(Boolean);
    while(wrongDistractors.length<3){
      wrongDistractors.push('Previsão incompatível com o texto normativo e entendimento dominante.');
    }
    const cleanExp=String(mold?.explanation||'').replace(/\s+/g,' ').trim();
    const angleNote=attempt&&!attempt.ok&&attempt.chosenText
      ?`Atenção: na questão anterior você marcou "${shortLabel(attempt.chosenText,65)}". Compare os elementos do caso e identifique a alternativa que aplica a regra exata:`
      :`Em uma variação de prova da banca ${board} sobre "${topic}", analise as assertivas e assinale a diretriz juridicamente/tecnicamente correta:`;
    const newStatement=`🧬 [Questão Gêmea de Fixação · ${topic}] ${angleNote}`;
    const newOptions=[correctText,...wrongDistractors.slice(0,3)];
    const newExplanation=[
      `Conceito-chave: Fixação ativa do tema "${topic}" (${subj}).`,
      `✅ Alternativa correta: ${correctText}`,
      attempt&&!attempt.ok&&attempt.chosenText
        ?`❌ Análise do distrator que confundiu antes: A opção "${attempt.chosenText}" é incorreta e atua como pegadinha recorrente.`
        :`❌ Análise das alternativas: As demais opções invertem prazos, requisitos ou generalizam exceções sobre ${topic}.`,
      `⚠️ Pegadinha da banca (${board}): ${cleanExp?shortLabel(cleanExp,180):'Leia atentamente os termos restritivos ou exceções antes de marcar.'}`
    ].join('\n');
    return{
      subject:subj,
      topic:`[Gêmea] ${topic}`,
      board,
      difficulty:normalizedDifficulty(mold),
      origin:'autoral',
      statement:newStatement,
      options:newOptions,
      correct_index:0,
      explanation:newExplanation
    };
  }
  window.buildLocalCognitiveTwinQuestion=buildLocalCognitiveTwinQuestion;

  function reportOrFixCurrentQuestion(item,btnEl){
    if(!item)return;
    const currentLetter=String.fromCharCode(65+(Number(item.correct_index)||0));
    const ans=prompt(`Auditoria Pedagógica da Questão (" ${shortLabel(item.statement,60)} "):

• Digite A, B, C ou D se quiser corrigir o gabarito imediatamente (atual: ${currentLetter});
• Ou escreva uma observação para reportar erro no enunciado/comentário:`,currentLetter);
    if(ans===null)return;
    const clean=ans.trim();
    if(/^[A-Da-d]$/.test(clean)){
      const newIdx=clean.toUpperCase().charCodeAt(0)-65;
      item.correct_index=newIdx;
      const fp=questionFingerprint(item);
      for(const qItem of (ALL_QUESTIONS||[])){
        if(questionFingerprint(qItem)===fp)qItem.correct_index=newIdx;
      }
      save();
      window.persistToLocalDatabase?.(state?.activeCampaignId);
      if(btnEl)btnEl.textContent=`✓ Gabarito ajustado p/ ${clean.toUpperCase()}`;
      toast(`Gabarito atualizado para a alternativa ${clean.toUpperCase()}!`);
      return;
    }
    if(clean.length>=3){
      state.reportedQuestions=state.reportedQuestions||{};
      state.reportedQuestions[questionFingerprint(item)]={note:clean,statement:item.statement,subject:item.subject,at:new Date().toISOString()};
      save();
      if(btnEl)btnEl.textContent='🚩 Reportada';
      toast('Observação registrada! A questão foi marcada para revisão.');
    }
  }
  window.reportOrFixCurrentQuestion=reportOrFixCurrentQuestion;

  async function spawnTwinQuestionForCurrent(currentItem,btnEl){
    if(btnEl){btnEl.disabled=true;btnEl.textContent='⏳ Gerando questão gêmea...'}
    const attempt=currentItem?._lastAttempt||null;
    const errorContext=attempt
      ?(attempt.ok
          ?`O aluno ACERTOU a questão-molde marcando "${attempt.correctText}". Gere uma questão gêmea um nível mais profunda cobrando um caso prático ou exceção legal do mesmo tópico.`
          :`O aluno ERROU a questão-molde: marcou o distrator "${attempt.chosenText}" em vez da correta "${attempt.correctText}". Gere uma questão gêmea inédita que trabalhe exatamente a diferença entre esse distrator e a regra verdadeira.`)
      :'Gere uma questão gêmea cobrando o mesmo tema sob novo caso prático.';
    try{
      let twin=null;
      if(cloudSession&&navigator.onLine){
        const session=await validSession().catch(()=>null);
        if(session){
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
              student_error_context:errorContext,
              campaign_id:activeCampaign()?.dbId
            })
          }).catch(()=>null);
          if(res?.ok){
            const data=await res.json().catch(()=>({}));
            if(data?.questions?.[0])twin=data.questions[0];
          }
        }
      }
      if(!twin){
        twin=buildLocalCognitiveTwinQuestion(currentItem);
      }
      await saveQuestionsToCampaign(`Questão Gêmea · ${twin.topic}`,twin.subject,[twin],twin.board||'Questão Gêmea IA');
      if(activeQuestions&&Array.isArray(activeQuestions.questions)){
        activeQuestions.questions.splice(activeQuestions.current+1,0,prepareQuestion(twin));
        q('#questionCounter').textContent=`${activeQuestions.current+1}/${activeQuestions.questions.length} · ${normalizedDifficulty(currentItem).toUpperCase()}`;
        q('#nextQuestion').textContent='Responder questão gêmea →';
      }
      if(btnEl)btnEl.textContent='✓ Questão gêmea na fila!';
      toast(attempt&&!attempt.ok?'🧬 Questão gêmea focada no seu erro criada e colocada como próxima!':'🧬 Questão gêmea de fixação criada e colocada como próxima da fila!');
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
    if(btnEl){btnEl.disabled=true;btnEl.hidden=true}
    toast('Flashcards são extraídos exclusivamente de Materiais de estudo, Anotações e Textos de Lei.');
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

    item._lastAttempt={ok,chosenIndex:chosen,chosenText:item.options?.[chosen]||'',correctIndex:correct,correctText:item.options?.[correct]||''};
    const twinBtn=q('#spawnTwinQuestionBtn');
    if(twinBtn)twinBtn.onclick=()=>spawnTwinQuestionForCurrent(item,twinBtn);
    const reportBtn=q('#reportQuestionIssueBtn');
    if(reportBtn)reportBtn.onclick=()=>reportOrFixCurrentQuestion(item,reportBtn);
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
      const rate=d.total>0?Math.round(d.correct/d.total*100):null;
      return {name,total:d.total,correct:d.correct,misses:d.misses,rate};
    });

    if(!entries.length){
      if(tagEl)tagEl.textContent='Sem histórico ainda';
      container.innerHTML=`<div class="empty" style="grid-column:1/-1">Resolva sua primeira bateria de questões ou simulado para destravar o mapa de Pontos Fortes e Pontos Fracos.</div>`;
      return;
    }

    const strong=entries.filter(x=>x.total>=10&&x.rate>=75).sort((a,b)=>b.rate-a.rate);
    const evolving=entries.filter(x=>x.rate!==null&&x.rate>=55&&x.rate<75).sort((a,b)=>a.rate-b.rate);
    const weak=entries.filter(x=>(x.rate===null&&x.misses>0)||(x.rate!==null&&(x.rate<55||x.misses>=2&&x.rate<75))).sort((a,b)=>(a.rate??0)-(b.rate??0));

    if(tagEl)tagEl.textContent=`${strong.length} forte(s) · ${weak.length} crítico(s)`;

    const renderItem=(item,showTrainBtn)=>`<div class="diagnosisItem"><div><b>${escText(item.name)}</b><span class="small muted">${item.total?`${item.correct}/${item.total} acertos (${item.rate}%)`:''}${item.misses?`${item.total?' · ':''}${item.misses} erro(s) ativo(s)`:''}</span></div>${showTrainBtn?`<button type="button" class="ghost small" data-train-diagnosis-subject="${escText(item.name)}">Treinar →</button>`:`<span class="tag">${item.rate}%</span>`}</div>`;

    container.innerHTML=`
      <div class="diagnosisCol strong">
        <div class="diagnosisColHead"><b>🟢 Pontos Fortes (≥75%)</b><span>${strong.length}</span></div>
        <div class="diagnosisList">${strong.length?strong.map(x=>renderItem(x,false)).join(''):'<p class="small muted">Acerte 75% ou mais em uma disciplina (mín. 10 questões) para dominá-la.</p>'}</div>
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

  function startSubjectTargetedFix(subjectName,preferErrors=true){
    const cleanSubj=canonicalSubjectName(subjectName);
    const subjKey=topicKey(cleanSubj);
    const allQ=ALL_QUESTIONS||[];
    const subjPool=allQ.filter(item=>topicKey(learningCategory(item.subject))===subjKey);
    const errEntries=activeCampaignErrors().filter(([,e])=>topicKey(canonicalSubjectName(e?.subject||''))===subjKey);
    let chosenPool=[];
    if(preferErrors&&errEntries.length){
      const errMatched=subjPool.filter(item=>questionMatchesErrorPool(item,errEntries));
      const synthFromErrors=errEntries.filter(([,e])=>e?.question&&e?.correctAnswer).map(([,e])=>{
        const distractors=['Alternativa incorreta conforme a literalidade da norma e jurisprudência aplicável.','Hipótese vedada ou incompatível com o instituto jurídico cobrado.','Conceito pertencente a outro dispositivo ou regra diversa na matéria.'];
        const wrongChosen=e.lastChosen&&e.lastChosen!==e.correctAnswer?[e.lastChosen]:[];
        const opts=[e.correctAnswer,...wrongChosen,...distractors].slice(0,4);
        return{subject:cleanSubj,topic:e.topic||'Correção de Erro',statement:e.question,options:opts,correct_index:0,explanation:e.explanation||`Revisão de erro: a resposta correta é "${e.correctAnswer}".`,difficulty:'medio',origin:'adaptada_do_pdf'};
      });
      chosenPool=[...errMatched,...synthFromErrors,...subjPool];
    }else{
      chosenPool=subjPool;
    }
    if(chosenPool.length){
      const seen=new Set();
      const uniquePool=chosenPool.filter(item=>{const fp=questionFingerprint(item);if(seen.has(fp))return false;seen.add(fp);return true});
      const count=Math.min(8,uniquePool.length);
      const selected=typeof progressiveQuestions==='function'?progressiveQuestions(uniquePool,count):uniquePool.slice(0,count);
      activeQuestions={
        mode:'battle',
        subject:cleanSubj,
        questions:selected.map(prepareQuestion),
        current:0,
        correct:0,
        streak:0,
        level:1,
        answered:false
      };
      if(q('#questionDialogTitle'))q('#questionDialogTitle').textContent=`🎯 Correção de Gargalo · ${cleanSubj}`;
      q('#questionDialog')?.showModal();
      showQuestion();
      return;
    }
    const subjSel=q('#questionSubject');
    if(subjSel){
      const match=[...subjSel.options].find(opt=>topicKey(opt.value)===subjKey);
      if(match){
        subjSel.value=match.value;
        populateTopicFilter();
        updateQuestionPool();
        q('.questionTrainer')?.scrollIntoView({behavior:'smooth',block:'center'});
        toast(`Filtro ajustado para ${cleanSubj}. Inicie a bateria para corrigir este ponto!`);
        return;
      }
    }
    switchExamHubTab('generator');
    if(q('#genBankSubject'))q('#genBankSubject').value=cleanSubj;
    q('#examBankHub')?.scrollIntoView({behavior:'smooth',block:'center'});
    toast(`Gere questões comentadas de ${cleanSubj} para treinar esta disciplina!`);
  }
  window.startSubjectTargetedFix=startSubjectTargetedFix;

  function renderPerformanceChart(){
    const root=q('#performanceChart');if(!root)return;
    const scores=(state?.scores||[]).filter(item=>!item.campaignId||item.campaignId===state.activeCampaignId),groups={};
    for(const item of scores){
      const rawName=item.subject||missionPool().find(m=>m.id===item.id)?.subject||'Conteúdo geral';
      const name=canonicalSubjectName(rawName);
      groups[name]??={total:0,correct:0,misses:0};
      groups[name].total+=Number(item.total||0);
      groups[name].correct+=Number(item.correct||0);
    }
    for(const [,err] of activeCampaignErrors()){
      const name=canonicalSubjectName(err?.subject||'Conteúdo geral');
      groups[name]??={total:0,correct:0,misses:0};
      groups[name].misses+=Number(err?.misses||1);
    }
    const rows=Object.entries(groups).filter(([,data])=>data.total>0||data.misses>0).sort((a,b)=>{
      const ra=a[1].total?a[1].correct/a[1].total:0;
      const rb=b[1].total?b[1].correct/b[1].total:0;
      return ra-rb||(b[1].misses-a[1].misses);
    });
    root.className='performanceChart';
    root.innerHTML=rows.length?rows.map(([name,data])=>{
      const rate=data.total?Math.round(data.correct/data.total*100):0;
      const tone=rate<60?'low':rate<72?'mid':'high';
      const statusLabel=rate>=72?'✓ Acima do corte (≥72%)':rate>=60?'⚡ Na disputa (meta: 72%)':'🔴 Abaixo do corte (<60%)';
      return `<div class="performanceBar ${tone}" title="${escText(name)}: ${data.correct}/${data.total}">
        <div class="perfBarHead">
          <span class="perfSubjectName">${escText(name)}</span>
          <div class="perfBarRight">
            <span class="perfMetaCount">${data.total?`${data.correct}/${data.total} acertos`:""}${data.misses?`${data.total?" · ":""}${data.misses} erro(s)`:""}</span>
            <b>${rate}%</b>
          </div>
        </div>
        <div class="performanceTrack">
          <i style="width:${rate}%"></i>
          <s class="perfCutoffTick" style="left:72%" title="Meta de Corte: 72%"></s>
        </div>
        <div class="perfBarFoot">
          <small class="muted">${statusLabel}</small>
          <button type="button" class="ghost small perfTrainBtn" data-perf-train-subject="${escText(name)}">${rate<72||data.misses?'🔧 Corrigir →':'Treinar →'}</button>
        </div>
      </div>`;
    }).join(''):'<div class="empty">Resolva questões para visualizar sua precisão por disciplina e distância para o corte de 72%.</div>';
    root.querySelectorAll('[data-perf-train-subject]').forEach(btn=>{
      btn.onclick=()=>startSubjectTargetedFix(btn.dataset.perfTrainSubject,true);
    });
    renderTacticalDiagnosis();
    renderCutoffThermometer();
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
            <label class="field" style="margin:0">Banca organizadora<select id="genBankBoard"><option value="Instituto AOCP">Instituto AOCP</option><option value="Cebraspe">Cebraspe</option><option value="FGV Conhecimento">FGV Conhecimento</option><option value="IDECAN">IDECAN</option><option value="IBFC">IBFC</option><option value="FCC">FCC</option><option value="Vunesp">Vunesp</option><option value="Projeto Caveira (Policial)">Estilo Caveira (Carreiras Policiais)</option></select></label>
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
    genTopic.innerHTML=`<option value="Tópicos essenciais de ${escText(genSubj)}">Todos os tópicos de ${escText(shortLabel(genSubj,32))}</option>`+topics.map(t=>{
      const cleanVal=String(t||'').replace(/\s+/g,' ').trim().slice(0,180);
      return `<option value="${escText(cleanVal)}" title="${escText(cleanVal)}">${escText(shortLabel(cleanVal,52))}</option>`;
    }).join('');
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

  function parseExamAnswerKeyTable(fullText){
    const keyMap=new Map();
    const raw=String(fullText||'');
    // Procura seção final de GABARITO (prioriza definitivo sobre preliminar)
    const gabSections=[...raw.matchAll(/\b(?:gabarito(?:\s+oficial|\s+definitivo|\s+preliminar)?|respostas\s+do\s+simulado)\b[\s\S]{0,6000}/gi)];
    const targetText=gabSections.length?gabSections[gabSections.length-1][0]:raw.slice(-6000);
    // Casa pares como "01 - A", "1. C", "12) E", "15: ANULADA", "03 C"
    const pairRe=/(?:^|[\s|;,])0*(\d{1,3})\s*(?:[-–—.:)]|\s)\s*(ANULADA|NULA|X|\*|[A-Ea-e]|CERTO|ERRADO)(?=$|[\s|;,.])/gi;
    let m;
    while((m=pairRe.exec(targetText))!==null){
      const num=Number(m[1]);
      const val=m[2].toUpperCase();
      if(num>=1&&num<=250){
        if(/ANULADA|NULA|X|\*/.test(val))keyMap.set(num,'ANULADA');
        else if(val==='CERTO')keyMap.set(num,'C');
        else if(val==='ERRADO')keyMap.set(num,'E');
        else keyMap.set(num,val);
      }
    }
    return keyMap;
  }

  function extractStructuredExamQuestions(rawTextOrPages,opts={}){
    const defaultSubject=opts.defaultSubject||'Conteúdo Geral';
    const defaultBoard=opts.defaultBoard||'Prova Oficial';
    const fullText=Array.isArray(rawTextOrPages)
      ?rawTextOrPages.map(p=>String(p?.text||'')).join('\n\n')
      :String(rawTextOrPages||'');
    const trimmed=fullText.trim();
    if(!trimmed)return[];

    // 1) Se for JSON direto
    if(trimmed.startsWith('[')||trimmed.startsWith('{')){
      try{
        const parsed=JSON.parse(trimmed);
        const arr=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.questions)?parsed.questions:[]);
        return arr.filter(x=>x?.statement&&Array.isArray(x?.options)&&x.options.length>=4).map(x=>({
          subject:canonicalSubjectName(x.subject||defaultSubject),
          topic:x.topic||'Questão Oficial',
          board:x.board||defaultBoard,
          statement:String(x.statement).trim(),
          options:x.options.slice(0,4).map(String),
          correct_index:Math.min(3,Math.max(0,Number(x.correct_index)||0)),
          explanation:String(x.explanation||'Questão oficial importada pelo usuário.'),
          difficulty:x.difficulty||'medio',
          origin:'oficial'
        }));
      }catch{}
    }

    // 2) Extração determinística de blocos de questões numeradas (QUESTÃO 01, Questão 1, 01., 1))
    const answerKeyMap=parseExamAnswerKeyTable(trimmed);
    const bodyWithoutFinalGabarito=trimmed.replace(/\n\s*Gabarito(?:\s+Definitivo|\s+Preliminar|\s+Oficial)?\s*[:\n][\s\S]{0,4000}$/i,'');
    const blockRegex=/(?:^|\n)\s*(?:QUEST[AÃ]O\s*0*(\d{1,3})|0*(\d{1,3})\s*[.)-])\s+([\s\S]*?)(?=(?:\n\s*(?:QUEST[AÃ]O\s*0*\d{1,3}|0*\d{1,3}\s*[.)-]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ(\"\x27]))|$)/gi;
    const results=[];
    let match;
    while((match=blockRegex.exec(bodyWithoutFinalGabarito))!==null){
      const qNum=Number(match[1]||match[2]||0);
      let block=String(match[3]||'').trim();
      if(block.length<20)continue;

      // Verifica gabarito inline no final do bloco ("Gabarito: C", "Resposta: Letra E", "Gabarito: CERTO", "Comentário: ...")
      let inlineAns=null;
      let inlineComment='';
      const commentMatch=block.match(/(?:^|\n)\s*(?:Coment[aá]rio|Resolu[cç][aã]o|Justificativa)\s*[:\-–]\s*([\s\S]+)$/i);
      if(commentMatch){
        inlineComment=commentMatch[1].trim();
        block=block.slice(0,commentMatch.index).trim();
      }
      const inlineGabMatch=block.match(/(?:^|\n|\s)(?:Gabarito(?:\s+Oficial|\s+Definitivo)?|Resposta(?:\s+Correta)?)\s*[:\-–]?\s*(?:Letra\s+)?(ANULADA|CERTO|ERRADO|[A-Ea-e])\b/i);
      if(inlineGabMatch){
        const rawAns=inlineGabMatch[1].toUpperCase();
        inlineAns=rawAns==='CERTO'?'C':rawAns==='ERRADO'?'E':rawAns;
        block=block.slice(0,inlineGabMatch.index).trim();
      }

      const finalKey=inlineAns||(qNum?answerKeyMap.get(qNum):null)||null;
      if(finalKey==='ANULADA')continue; // Descarta questões anuladas oficialmente

      // Tenta extrair alternativas A, B, C, D, (E)
      const optSplitRegex=/(?:^|\n)\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\s*[.)-])\s+/g;
      const optMatches=[...block.matchAll(optSplitRegex)];
      if(optMatches.length>=4){
        const statement=block.slice(0,optMatches[0].index).replace(/\s+/g,' ').trim();
        if(statement.length<10)continue;
        const parsedOpts=[];
        for(let i=0;i<optMatches.length;i++){
          const letter=(optMatches[i][1]||optMatches[i][2]).toUpperCase();
          const start=optMatches[i].index+optMatches[i][0].length;
          const end=i+1<optMatches.length?optMatches[i+1].index:block.length;
          const text=block.slice(start,end).replace(/\s+/g,' ').trim();
          if(text)parsedOpts.push({letter,text});
        }
        if(parsedOpts.length>=4){
          // Se só extraiu se tiver gabarito conhecido (no próprio bloco ou na tabela de gabarito)
          if(!finalKey||!/^[A-E]$/.test(finalKey))continue;
          let correctIdx=parsedOpts.findIndex(o=>o.letter===finalKey);
          if(correctIdx<0)continue;
          let finalFour=parsedOpts.slice(0,4);
          // Se a questão tinha 5 alternativas (A-E) e a correta era E (índice 4), preserva a correta!
          if(parsedOpts.length>=5){
            if(correctIdx>=4){
              finalFour=[parsedOpts[0],parsedOpts[1],parsedOpts[2],parsedOpts[correctIdx]];
              correctIdx=3;
            }
          }
          const inferredSubj=canonicalSubjectName(statement,defaultSubject);
          const subj=inferredSubj&&inferredSubj!=='Conteúdo Geral'?inferredSubj:canonicalSubjectName(defaultSubject);
          results.push({
            subject:subj,
            topic:`Questão ${qNum||results.length+1} · ${defaultBoard}`,
            board:defaultBoard,
            statement,
            options:finalFour.map(o=>o.text),
            correct_index:correctIdx,
            explanation:inlineComment||`Gabarito Oficial do Documento: Alternativa ${finalKey} ("${finalFour[correctIdx].text}").`,
            difficulty:'medio',
            origin:'oficial'
          });
        }
      }else if(/\b(certo|errado|julgue\s+o\s+item)\b/i.test(block)&&(finalKey==='C'||finalKey==='E')){
        // Formato Certo / Errado (Cebraspe)
        const statement=block.replace(/\(\s*\)\s*Certo[\s\S]*$/i,'').replace(/\s+/g,' ').trim();
        if(statement.length<12)continue;
        const isCerto=finalKey==='C';
        const inferredSubj=canonicalSubjectName(statement,defaultSubject);
        const subj=inferredSubj&&inferredSubj!=='Conteúdo Geral'?inferredSubj:canonicalSubjectName(defaultSubject);
        results.push({
          subject:subj,
          topic:`Item ${qNum||results.length+1} (C/E) · ${defaultBoard}`,
          board:defaultBoard||"Cebraspe",
          statement:`[Julgue o item em CERTO ou ERRADO] ${statement}`,
          options:[
            'CERTO — O item está de acordo com a legislação/jurisprudência aplicável.',
            'ERRADO — O item contém incorreção, generalização indevida ou inversão de regra.',
            'Abster-se / Deixar em branco (Modo Líquido Cebraspe).',
            'Item parcialmente incorreto por omissão de requisito essencial.'
          ],
          correct_index:isCerto?0:1,
          explanation:inlineComment||`Gabarito Oficial Cebraspe: ${isCerto?'CERTO':'ERRADO'}.`,
          difficulty:'dificil',
          origin:'oficial'
        });
      }
    }
    return results;
  }
  window.extractStructuredExamQuestions=extractStructuredExamQuestions;

  function tryParseLocalQuestionText(rawText,defaultSubject,defaultBoard){
    return extractStructuredExamQuestions(rawText,{defaultSubject,defaultBoard});
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
      const baseContext=typeof assistantLibraryContext==='function'?assistantLibraryContext():'';
      const boardProfile=BOARD_BOSS_PROFILES[board]||null;
      const context=boardProfile
        ?`${boardProfile.promptRules}\n\n${baseContext}`.trim()
        :baseContext;
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


  // 5. Simulador de Aprovação, Meta de Corte & Diagnóstico Acionável de Erros (#cutoffThermometerPanel)
  const CUTOFF_MIN_SAMPLE=30;
  function cutoffTarget(){
    const raw=Number(state?.cutoffTargets?.[state?.activeCampaignId]);
    return Number.isFinite(raw)&&raw>=40&&raw<=95?Math.round(raw):72;
  }
  function cutoffAssessment(total,correct,target=72,minSample=CUTOFF_MIN_SAMPLE){
    total=Math.max(0,Math.floor(Number(total)||0));
    correct=Math.min(total,Math.max(0,Math.floor(Number(correct)||0)));
    const rate=total>0?Math.round(correct/total*100):0;
    let lo=0,hi=0;
    if(total>0){const z=1.96,p=correct/total,den=1+z*z/total,center=p+z*z/(2*total),margin=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total));lo=Math.max(0,Math.round((center-margin)/den*100));hi=Math.min(100,Math.round((center+margin)/den*100))}
    const need=goal=>rate>=goal?0:Math.max(1,Math.ceil((goal/100*total-correct)/(1-goal/100)));
    const elite=Math.min(98,Math.max(80,target+8));
    return{total,correct,rate,lo,hi,target,elite,lowSample:total<minSample,needMin:need(60),needTarget:need(target),needElite:need(elite)};
  }

  function ensureCutoffThermometer(){
    const perfGrid=q('#report #performanceSummary');
    if(!perfGrid||q('#cutoffThermometerPanel'))return;
    perfGrid.insertAdjacentHTML('afterend',`
      <div class="card cutoffThermometerCard" id="cutoffThermometerPanel">
        <div class="sectionHead cutoffHeaderRow">
          <div>
            <div class="eyebrow">SIMULADOR DE APROVAÇÃO · META DE CORTE &amp; CORREÇÃO DE GARGALOS</div>
            <h2 id="cutoffStatusTitle" style="margin:3px 0 0">Termômetro de Nota de Corte</h2>
          </div>
          <span class="tag" id="cutoffTierBadge">Em aferição</span>
        <label class="small muted" style="display:flex;align-items:center;gap:6px;margin-top:6px">Minha meta (%)<input id="cutoffTargetInput" type="number" min="40" max="95" step="1" inputmode="numeric" style="width:68px" aria-label="Meta de acerto do meu concurso em porcentagem"></label>
        </div>
        <div id="cutoffUnifiedExamSwitchBar" style="margin-bottom:8px"></div>
        <div class="cutoffTrackWrap">
          <div class="cutoffBar">
            <div class="cutoffFill" id="cutoffFillBar" style="width:0%"></div>
            <span class="cutoffCurrentPin" id="cutoffCurrentPin" style="left:0%">0%</span>
            <span class="cutoffMarker m60" style="left:60%" title="60% — Habilitação mínima"></span>
            <span class="cutoffMarker m72" style="left:72%" title="Sua meta de estudo (ajustável)"></span>
            <span class="cutoffMarker m80" style="left:80%" title="80% — Faixa Elite / Primeiros Colocados"></span>
          </div>
          <div class="cutoffScaleTicks">
            <span>0%</span>
            <span class="t60">60% Mínimo</span>
            <span class="t72">🎯 Sua meta</span>
            <span class="t80">🏆 80% Elite</span>
          </div>
        </div>
        <div class="cutoffStagesGrid" id="cutoffStagesGrid"></div>
        <p class="small muted" id="cutoffAdviceText" style="margin:10px 0 0"></p>
        <div class="cutoffActionableBox" id="cutoffActionableBox"></div>
      </div>
    `);
    const targetInput=q('#cutoffTargetInput');
    if(targetInput)targetInput.onchange=()=>{
      const value=Math.round(Number(targetInput.value));
      if(!(value>=40&&value<=95)){toast('Informe uma meta entre 40% e 95%.');targetInput.value=cutoffTarget();return}
      state.cutoffTargets={...(state.cutoffTargets||{}),[state.activeCampaignId]:value};
      save();renderCutoffThermometer();
    };
  }

  function renderCutoffThermometer(){
    ensureCutoffThermometer();
    const fillEl=q('#cutoffFillBar'),pinEl=q('#cutoffCurrentPin'),titleEl=q('#cutoffStatusTitle'),badgeEl=q('#cutoffTierBadge'),adviceEl=q('#cutoffAdviceText'),stagesEl=q('#cutoffStagesGrid'),actionBox=q('#cutoffActionableBox');
    if(!fillEl)return;
    const missions=typeof missionPool==='function'?missionPool():[];
    const isUnified=typeof window.isUnifiedPortalActive==='function'&&window.isUnifiedPortalActive();
    const uStats=isUnified&&typeof window.buildUnifiedMissionPool==='function'?window.buildUnifiedMissionPool().stats:null;
    const examScope=isUnified?(state?.cutoffExamScope||'primary'):'all';
    const switchBar=q('#cutoffUnifiedExamSwitchBar');
    if(switchBar){
      if(isUnified&&uStats){
        switchBar.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;background:rgba(9,24,42,.8);border:1px solid #234769"><span class="small muted"><b>🎯 Simulador Independente por Prova:</b> evita que matérias exclusivas de um edital distorçam a nota do outro</span><div style="display:flex;gap:5px;flex-wrap:wrap"><button type="button" class="ghost small ${examScope==='primary'?'active':''}" data-cutoff-exam-scope="primary">🎯 Prova ${escText(uStats.pBadge)}</button><button type="button" class="ghost small ${examScope==='secondary'?'active':''}" data-cutoff-exam-scope="secondary">🔥 Prova ${escText(uStats.sBadge)}</button><button type="button" class="ghost small ${examScope==='all'?'active':''}" data-cutoff-exam-scope="all">📊 Visão Combinada</button></div></div>`;
        switchBar.querySelectorAll('[data-cutoff-exam-scope]').forEach(btn=>btn.onclick=()=>{
          state.cutoffExamScope=btn.dataset.cutoffExamScope;
          save();
          renderCutoffThermometer();
        });
      }else{
        switchBar.innerHTML='';
      }
    }
    const allowedSubjKeys=new Set();
    if(isUnified&&examScope!=='all'){
      for(const m of missions){
        if(examScope==='primary'&&(m.originScope==='both'||m.originScope==='primary'||m.subjectScope==='both'||m.subjectScope==='primary')){
          allowedSubjKeys.add(topicKey(canonicalSubjectName(m.subject)));
        }else if(examScope==='secondary'&&(m.originScope==='both'||m.originScope==='secondary'||m.subjectScope==='both'||m.subjectScope==='secondary')){
          allowedSubjKeys.add(topicKey(canonicalSubjectName(m.subject)));
        }
      }
    }
    const subjAllowed=subjName=>{
      if(!isUnified||examScope==='all'||!allowedSubjKeys.size)return true;
      return allowedSubjKeys.has(topicKey(canonicalSubjectName(subjName)));
    };
    const secId=typeof window.getSecondaryPortalForUnification==='function'?window.getSecondaryPortalForUnification()?.id:null;
    const rawScores=(state?.scores||[]).filter(s=>!s.campaignId||s.campaignId===state.activeCampaignId||(isUnified&&secId&&s.campaignId===secId));
    const scores=rawScores.filter(s=>{
      const sName=s.subject||missions.find(m=>m.id===s.id)?.subject||'Conteúdo Geral';
      return subjAllowed(sName);
    });
    const tracked=(!isUnified||examScope==='all')?(state?.questionStatsByCampaign?.[state?.activeCampaignId]||{}):{};
    const scoreTotal=scores.reduce((n,s)=>n+Number(s.total||0),0);
    const scoreCorrect=scores.reduce((n,s)=>n+Number(s.correct||0),0);
    const total=Math.max(scoreTotal,Number(tracked.total||0));
    const correct=Number(tracked.total||0)>scoreTotal?Number(tracked.correct||0):scoreCorrect;
    const allErrors=activeCampaignErrors().filter(([,e])=>subjAllowed(e?.subject||'Conteúdo Geral'));
    const bySubject={};
    for(const item of scores){
      const name=canonicalSubjectName(item.subject||missions.find(m=>m.id===item.id)?.subject||'Conteúdo Geral');
      bySubject[name]??={total:0,correct:0,misses:0,topics:[]};
      bySubject[name].total+=Number(item.total||0);
      bySubject[name].correct+=Number(item.correct||0);
    }
    for(const [errKey,err] of allErrors){
      const name=canonicalSubjectName(err?.subject||'Conteúdo Geral');
      bySubject[name]??={total:0,correct:0,misses:0,topics:[]};
      bySubject[name].misses+=Number(err?.misses||1);
      bySubject[name].topics.push({key:errKey,err});
    }

    const target=cutoffTarget();
    const subjDiagnostics=Object.entries(bySubject).map(([name,d])=>{
      const rate=d.total>0?Math.round(d.correct/d.total*100):null;
      const neededForTarget=rate!==null&&rate<target?Math.max(1,Math.ceil((target/100*d.total-d.correct)/(1-target/100))):0;
      return{name,total:d.total,correct:d.correct,misses:d.misses,rate,neededForTarget,topics:d.topics};
    }).sort((a,b)=>(a.rate??101)-(b.rate??101)||(b.misses-a.misses));

    const bottlenecks=subjDiagnostics.filter(d=>(d.rate!==null&&d.rate<target)||d.misses>0);
    const topWeakTopics=allErrors
      .map(([key,e])=>({key,e,subj:canonicalSubjectName(e?.subject||'Geral'),misses:Number(e?.misses||1),attempts:Math.max(Number(e?.attempts||1),Number(e?.misses||1))}))
      .sort((a,b)=>(b.misses/b.attempts)-(a.misses/a.attempts)||b.misses-a.misses)
      .slice(0,4);

    if(total<1&&!allErrors.length){
      fillEl.style.width='0%';
      if(pinEl){pinEl.style.left='0%';pinEl.textContent='0%'}
      badgeEl.textContent='Comece a praticar';
      titleEl.textContent='Resolva questões para medir sua nota de corte e mapear erros';
      if(stagesEl){
        stagesEl.innerHTML=`
          <div class="cutoffStageCard"><span>Marco 1 · Mínimo</span><b>60% Habilitação</b><small>Nota mínima para não ser eliminado</small></div>
          <div class="cutoffStageCard target"><span>Marco 2 · Sua meta</span><b>${target}% definida por você</b><small>A nota de corte real varia por banca, cargo e ano</small></div>
          <div class="cutoffStageCard elite"><span>Marco 3 · Segurança</span><b>80%+ Faixa Elite</b><small>Primeiros colocados</small></div>
        `;
      }
      adviceEl.textContent=`Assim que você responder questões na Trilha, Batalha ou Simulados, este painel mostrará quais disciplinas e assuntos estão abaixo da sua meta de ${target}%, com botões para corrigir cada erro. Ele mede seu desempenho no app, não a nota de corte real da prova.`;
      if(actionBox)actionBox.innerHTML='';
      return;
    }

    const a=cutoffAssessment(total,correct,target);
    const rate=a.rate;
    const clamped=Math.min(100,Math.max(0,rate));
    fillEl.style.width=`${clamped}%`;
    if(pinEl){
      pinEl.style.left=`${Math.min(94,Math.max(6,clamped))}%`;
      pinEl.textContent=`${rate}%`;
    }
    const targetMarker=q('#cutoffThermometerPanel .cutoffMarker.m72'),eliteMarker=q('#cutoffThermometerPanel .cutoffMarker.m80');
    if(targetMarker){targetMarker.style.left=`${target}%`;targetMarker.title=`Sua meta de estudo: ${target}%`}
    if(eliteMarker){eliteMarker.style.left=`${a.elite}%`;eliteMarker.title=`${a.elite}% — Faixa de segurança`}
    const tickTarget=q('#cutoffThermometerPanel .cutoffScaleTicks .t72'),tickElite=q('#cutoffThermometerPanel .cutoffScaleTicks .t80');
    if(tickTarget)tickTarget.textContent=`🎯 Meta ${target}%`;
    if(tickElite)tickElite.textContent=`🏆 ${a.elite}%`;
    const inputEl=q('#cutoffTargetInput');
    if(inputEl&&document.activeElement!==inputEl)inputEl.value=target;
    const interval=`${a.lo}%–${a.hi}%`;
    const sampleNote=a.lowSample?' (amostra pequena)':'';

    if(stagesEl){
      stagesEl.innerHTML=`
        <div class="cutoffStageCard ${rate>=60?'passed':'pending'}">
          <div class="stageTop"><span>1º Marco · Habilitação</span><b class="stagePct">60%</b></div>
          <div class="stageStatus">${rate>=60?'✓ Mínimo atingido':`Faltam +${a.needMin} acerto(s) seguido(s)`}${sampleNote}</div>
        </div>
        <div class="cutoffStageCard target ${rate>=target?'passed':'pending'}">
          <div class="stageTop"><span>2º Marco · Sua meta</span><b class="stagePct">${target}%</b></div>
          <div class="stageStatus">${rate>=target?`✓ Meta atingida (+${rate-target}%)`:`🎯 Faltam +${a.needTarget} acerto(s) p/ a meta`}${sampleNote}</div>
        </div>
        <div class="cutoffStageCard elite ${rate>=a.elite?'passed':'pending'}">
          <div class="stageTop"><span>3º Marco · Margem de segurança</span><b class="stagePct">${a.elite}%+</b></div>
          <div class="stageStatus">${rate>=a.elite?'🏆 Margem de segurança conquistada':`Faltam +${a.needElite} acerto(s) p/ o topo`}${sampleNote}</div>
        </div>
      `;
    }

    const disclaimer=' A meta é definida por você; a nota de corte real varia por banca, cargo e ano.';
    if(a.lowSample){
      badgeEl.textContent=`🔎 Amostra pequena (${total}/${CUTOFF_MIN_SAMPLE} questões)`;
      titleEl.textContent=`Acerto atual: ${rate}% (${correct}/${total}) — ainda é cedo para concluir`;
      adviceEl.textContent=`Com ${total} questão(ões) respondida(s), seu acerto provável está entre ${interval}. Resolva pelo menos ${CUTOFF_MIN_SAMPLE} para uma leitura confiável.${disclaimer}`;
    }else if(rate>=a.elite){
      badgeEl.textContent=`🏆 Margem de segurança (≥${a.elite}%)`;
      titleEl.textContent=`Precisão Global: ${rate}% (${correct}/${total}) — acima da sua meta, com margem`;
      adviceEl.textContent=(bottlenecks.length
        ?`Seu acerto geral (${rate}%, provável ${interval}) está bem acima da meta, mas ainda há ${bottlenecks.length} disciplina(s) com erros ou abaixo de ${target}%. Elimine esses pontos para blindar sua preparação.`
        :'Todas as disciplinas praticadas estão acima da meta. Mantenha o ritmo com simulados cronometrados e revisão espaçada.')+disclaimer;
    }else if(rate>=target){
      badgeEl.textContent=`✓ Meta atingida (≥${target}%)`;
      titleEl.textContent=`Precisão Global: ${rate}% (${correct}/${total}) — dentro da sua meta`;
      adviceEl.textContent=`Você superou sua meta de ${target}% (acerto provável ${interval}). Corrija os gargalos abaixo e acerte mais ${a.needElite} questão(ões) seguida(s) para ganhar margem de segurança.${disclaimer}`;
    }else if(rate>=60){
      badgeEl.textContent=`⚡ Habilitado (60–${target-1}%)`;
      titleEl.textContent=`Precisão Global: ${rate}% (${correct}/${total}) — faltam +${a.needTarget} acertos p/ a meta (${target}%)`;
      adviceEl.textContent=`Você passou do mínimo de 60%, mas precisa subir ${target-rate}% para atingir sua meta (acerto provável ${interval}). Veja abaixo quais matérias e assuntos puxam sua nota para baixo:${disclaimer}`;
    }else{
      badgeEl.textContent='🎯 Abaixo do mínimo (<60%)';
      titleEl.textContent=`Precisão Global: ${rate}% (${correct}/${total}) — foco em corrigir os gargalos`;
      adviceEl.textContent=`Faltam +${a.needMin} acerto(s) seguido(s) para o mínimo de 60% e +${a.needTarget} para a sua meta (${target}%). Clique nos gargalos abaixo para corrigir exatamente onde você erra.${disclaimer}`;
    }

    if(actionBox){
      const bottleneckHtml=bottlenecks.slice(0,4).map(b=>{
        const statusBadge=b.rate===null?`<span class="cutoffPill mid">⚪ Sem amostra de questões</span>`:b.rate<60?`<span class="cutoffPill low">🔴 ${b.rate}% (Crítico)</span>`:b.rate<target?`<span class="cutoffPill mid">🟡 ${b.rate}% (Faltam +${b.neededForTarget} acertos p/ ${target}%)</span>`:`<span class="cutoffPill high">🟢 ${b.rate}% (${b.misses} erro pendente)</span>`;
        return `
          <div class="cutoffBottleneckRow">
            <div class="cutoffBottleneckInfo">
              <div class="cutoffBottleneckTitleRow">
                <b>${escText(b.name)}</b>
                ${statusBadge}
              </div>
              <span class="small muted">${b.total?`${b.correct}/${b.total} acertos${b.total<10?" (amostra pequena)":""}`:""}${b.misses?`${b.total?" · ":""}⚠ ${b.misses} erro(s) acumulado(s) no caderno`:""}</span>
            </div>
            <button type="button" class="action small cutoffFixBtn" data-cutoff-fix-subj="${escText(b.name)}">🔧 Corrigir Agora</button>
          </div>
        `;
      }).join('');

      const topicsHtml=topWeakTopics.map(t=>{
        const pctErr=Math.round((t.misses/t.attempts)*100);
        const hint=t.e?.correctAnswer?`Gabarito: ${shortLabel(t.e.correctAnswer,68)}`:(t.e?.explanation?shortLabel(t.e.explanation,75):'Revise a regra e refaça a questão.');
        return `
          <div class="cutoffErrorTopicCard">
            <div class="cutoffErrorTopicMain">
              <div class="eyebrow" style="color:#ff8fa3">${escText(t.subj)} · ${t.misses} ERRO(S) (${pctErr}% DE FALHA)</div>
              <b>${escText(t.e?.topic||'Assunto com erro recorrente')}</b>
              <p class="small muted" style="margin:3px 0 0">${escText(hint)}</p>
            </div>
            <div class="cutoffErrorTopicActions">
              <button type="button" class="ghost small" data-cutoff-fix-topic-key="${escText(t.key)}" data-cutoff-fix-subj="${escText(t.subj)}">⚔️ Refazer Questão</button>
              <button type="button" class="ghost small" data-cutoff-study-subj="${escText(t.subj)}" data-cutoff-study-topic="${escText(t.e?.topic||'')}">📖 Ler Teoria</button>
            </div>
          </div>
        `;
      }).join('');

      actionBox.innerHTML=(bottlenecks.length||topWeakTopics.length)?`
        <div class="cutoffDiagDivider"></div>
        ${bottlenecks.length?`
          <div class="cutoffSectionBlock">
            <div class="cutoffSubHead">
              <b>📉 Gargalos por Disciplina (O que está segurando sua nota abaixo de ${target}%)</b>
              <span class="small muted">Toque em "Corrigir Agora" para treinar os pontos fracos da matéria</span>
            </div>
            <div class="cutoffBottleneckList">${bottleneckHtml}</div>
          </div>
        `:""}
        ${topWeakTopics.length?`
          <div class="cutoffSectionBlock" style="margin-top:12px">
            <div class="cutoffSubHead">
              <b>🎯 Assuntos Onde Você Mais Errou (Correção Cirúrgica)</b>
              <span class="small muted">${allErrors.length} tópico(s) no Caderno de Erros</span>
            </div>
            <div class="cutoffErrorTopicsGrid">${topicsHtml}</div>
          </div>
        `:""}
      `:`<div class="lessonBox bizu" style="margin-top:12px;margin-bottom:0"><b>✓ Nenhum gargalo crítico detectado!</b> Todas as disciplinas praticadas estão em ótimo nível e sem erros urgentes pendentes.</div>`;

      actionBox.querySelectorAll('[data-cutoff-fix-subj]:not([data-cutoff-fix-topic-key])').forEach(btn=>{
        btn.onclick=()=>startSubjectTargetedFix(btn.dataset.cutoffFixSubj,true);
      });
      actionBox.querySelectorAll('[data-cutoff-fix-topic-key]').forEach(btn=>{
        btn.onclick=()=>{
          const errKey=btn.dataset.cutoffFixTopicKey;
          const err=state?.errors?.[errKey];
          if(err&&err.question&&err.correctAnswer){
            const cleanSubj=canonicalSubjectName(err.subject||'Geral');
            const distractors=['Alternativa incorreta conforme a literalidade da norma e jurisprudência aplicável.','Hipótese vedada ou incompatível com o instituto jurídico cobrado.','Conceito pertencente a outro dispositivo ou regra diversa na matéria.'];
            const wrongChosen=err.lastChosen&&err.lastChosen!==err.correctAnswer?[err.lastChosen]:[];
            const opts=[err.correctAnswer,...wrongChosen,...distractors].slice(0,4);
            const targetQ={subject:cleanSubj,topic:err.topic||'Correção de Erro',statement:err.question,options:opts,correct_index:0,explanation:err.explanation||`A alternativa correta é: ${err.correctAnswer}`,difficulty:'medio',origin:'adaptada_do_pdf'};
            const extraPool=(ALL_QUESTIONS||[]).filter(qItem=>topicKey(learningCategory(qItem.subject))===topicKey(cleanSubj)).slice(0,4);
            activeQuestions={
              mode:'battle',
              subject:cleanSubj,
              questions:[targetQ,...extraPool].map(prepareQuestion),
              current:0,
              correct:0,
              streak:0,
              level:1,
              answered:false
            };
            if(q('#questionDialogTitle'))q('#questionDialogTitle').textContent=`⚔️ Correção Cirúrgica · ${err.topic||cleanSubj}`;
            q('#questionDialog')?.showModal();
            showQuestion();
            return;
          }
          startSubjectTargetedFix(btn.dataset.cutoffFixSubj,true);
        };
      });
      actionBox.querySelectorAll('[data-cutoff-study-subj]').forEach(btn=>{
        btn.onclick=()=>{
          const targetSubj=btn.dataset.cutoffStudySubj;
          const targetTopic=btn.dataset.cutoffStudyTopic||'';
          openView('study');
          const sf=q('#summaryFilter');
          if(sf){
            const match=[...sf.options].find(o=>topicKey(o.value)===topicKey(targetSubj));
            if(match){
              sf.value=match.value;
              sf.dispatchEvent(new Event('change'));
            }
          }
          toast(`📖 Estudar aberto em ${targetSubj}${targetTopic?` (${shortLabel(targetTopic,34)})`:''} para revisar a teoria!`);
        };
      });
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
    const lawRegex=/(\b(?:Art\.?\s*\d+[º°ª]?|§\s*\d+[º°ª]?|parágrafo único|Lei\s+(?:Complementar\s+|Federal\s+|Estadual\s+)?n?[º°]?\s*[\d.\/-]+|CF\/88|Súmula\s+(?:Vinculante\s+)?\d+|STF|STJ)\b)/gi;
    const exceptionRegex=/(\b(?:salvo|exceto|vedad[oa]s?|proibid[oa]s?|inafiançáve(?:l|is)|imprescritíve(?:l|is)|insuscetíveis|insuscetível|nunca|jamais|somente|exclusivamente|independe(?:m|ntemente)?)\b)/gi;
    const penaltyRegex=/(\b(?:reclusão|detenção|multa|\d+\s*(?:dias?|meses|anos?|horas?)|maioria\s+absoluta|unânime)\b)/gi;

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


  // 8. Repetição Espaçada SM-2 nos Flashcards (Estilo Anki / Caveira) + Professor Coordenador IA + Limpeza Pedagógica
  async function purgeNoisyFlashcardsNow(showFeedback=true){
    const checkValid=(qTxt,aTxt)=>typeof window.isValidFlashcardItem==='function'?window.isValidFlashcardItem(qTxt,aTxt):Boolean(qTxt&&aTxt);
    const beforeLen=(ALL_FLASHCARDS||[]).length;
    ALL_FLASHCARDS=(ALL_FLASHCARDS||[]).filter(c=>checkValid(c?.[1],c?.[2]));
    const removedMem=Math.max(0,beforeLen-ALL_FLASHCARDS.length);
    if(state?.customFlashcardsByCampaign){
      for(const k of Object.keys(state.customFlashcardsByCampaign)){
        if(Array.isArray(state.customFlashcardsByCampaign[k])){
          state.customFlashcardsByCampaign[k]=state.customFlashcardsByCampaign[k].filter(c=>checkValid(c?.[1],c?.[2]));
        }
      }
    }
    // Também limpa no Supabase os cartões fora do padrão na campanha ativa
    let cleanedDbRows=0;
    if(cloudSession&&navigator.onLine&&activeCampaign()?.dbId){
      try{
        const res=await cloudFetch(`generated_study_content?campaign_id=eq.${activeCampaign().dbId}&select=id,content,content_type,source_document_id`).catch(()=>null);
        const rows=res?.ok?await res.json().catch(()=>[]):[];
        for(const r of (Array.isArray(rows)?rows:[])){
          const fcs=r?.content?.flashcards;
          if(!Array.isArray(fcs)||!fcs.length)continue;
          const pDoc=(cloudDocuments||[]).find(d=>String(d.id)===String(r.source_document_id))||null;
          const allowRow=typeof window.isAllowedFlashcardRow==='function'?window.isAllowedFlashcardRow(r,pDoc):true;
          const nextFcs=allowRow?fcs.filter(c=>checkValid(c?.question,c?.answer)):[];
          if(nextFcs.length!==fcs.length){
            cleanedDbRows++;
            await cloudFetch(`generated_study_content?id=eq.${encodeURIComponent(r.id)}`,{
              method:'PATCH',
              body:JSON.stringify({content:{...r.content,flashcards:nextFcs}})
            }).catch(()=>undefined);
          }
        }
      }catch{}
    }
    save();
    window.persistToLocalDatabase?.(state?.activeCampaignId);
    if(typeof renderCard==='function')renderCard();
    updateFlashcardSpacedStats();
    if(showFeedback){
      toast(removedMem>0||cleanedDbRows>0
        ?`🧹 Limpeza concluída: ${removedMem} cartão(ões) fora do padrão removido(s) da fila e ${cleanedDbRows} pacote(s) higienizado(s) no banco!`
        :'✓ Todos os flashcards atuais já estão no padrão pedagógico (Active Recall)!');
    }
  }
  window.purgeNoisyFlashcardsNow=purgeNoisyFlashcardsNow;

  async function generateProfessorFlashcardsForSubject(btnEl){
    if(!cloudSession)return toast('Entre na sua conta para gerar Flashcards de Alta Incidência com o Professor IA.');
    const filterVal=q('#cardFilter')?.value||'all';
    const missions=typeof missionPool==='function'?missionPool():[];
    const subjects=[...new Set([...missions.map(m=>canonicalSubjectName(m.subject)),...(LEARNING_SUBJECTS||[])])].filter(Boolean);
    const defaultSubj=filterVal!=='all'?filterVal:(subjects[0]||'Língua Portuguesa');
    const chosenSubj=filterVal!=='all'?filterVal:prompt(`Para qual disciplina deseja gerar 8 Flashcards de Alta Incidência (Método Anki / Professor Coordenador)?\n\nDisciplinas disponíveis: ${subjects.slice(0,8).join(', ')}`,defaultSubj);
    if(!chosenSubj||!chosenSubj.trim())return;
    const subj=canonicalSubjectName(chosenSubj.trim());
    const subjMissions=missions.filter(m=>topicKey(canonicalSubjectName(m.subject))===topicKey(subj)).map(m=>m.name).slice(0,20);
    const contextStr=subjMissions.length?`Tópicos do edital de ${subj}: ${subjMissions.join('; ')}`:`Concurso: ${activeCampaign()?.name||'Carreira Policial'}`;
    if(btnEl){btnEl.disabled=true;btnEl.textContent='⏳ Professor IA criando cartões...'}
    try{
      const session=await validSession();
      if(!session)throw new Error('Sessão expirada.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`,{
        method:'POST',
        headers:{...authHeaders(session.access_token)},
        body:JSON.stringify({
          action:'generate_pedagogical_flashcards',
          subject:subj,
          topic:`Pontos de Alta Incidência em ${subj}`,
          board:'Instituto AOCP / Cebraspe / FGV',
          count:8,
          context:contextStr,
          campaign_id:activeCampaign()?.dbId
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Não foi possível gerar os flashcards.');
      const cards=(Array.isArray(data.flashcards)?data.flashcards:[]).filter(c=>typeof window.isValidFlashcardItem==='function'?window.isValidFlashcardItem(c.question,c.answer):Boolean(c.question&&c.answer));
      if(!cards.length)throw new Error('Nenhum cartão válido retornado. Tente novamente.');
      const existingKeys=new Set((ALL_FLASHCARDS||[]).map(c=>`${topicKey(c[0])}|${topicKey(c[1])}`));
      let added=0;
      state.customFlashcardsByCampaign=state.customFlashcardsByCampaign||{};
      const campId=state.activeCampaignId;
      state.customFlashcardsByCampaign[campId]=state.customFlashcardsByCampaign[campId]||[];
      for(const c of cards){
        const k=`${topicKey(subj)}|${topicKey(c.question)}`;
        if(!existingKeys.has(k)){
          ALL_FLASHCARDS.unshift([subj,c.question,c.answer]);
          state.customFlashcardsByCampaign[campId].push([subj,c.question,c.answer]);
          existingKeys.add(k);
          added++;
        }
      }
      save();
      window.persistToLocalDatabase?.(campId);
      if(typeof renderStudy==='function')renderStudy();
      if(q('#cardFilter')&&[...q('#cardFilter').options].some(o=>o.value===subj)){
        q('#cardFilter').value=subj;
        currentCard=0;
        if(typeof renderCard==='function')renderCard();
      }
      updateFlashcardSpacedStats();
      toast(`✨ ${added} Flashcards de Alta Incidência de ${subj} criados pelo Professor IA!`);
    }catch(err){
      toast(err.message);
    }finally{
      if(btnEl){btnEl.disabled=false;btnEl.textContent='✨ Gerar Flashcards da Banca (IA)'}
    }
  }

  function createManualUserFlashcard(){
    const filterVal=q('#cardFilter')?.value||'all';
    const defaultSubj=filterVal!=='all'?filterVal:(LEARNING_SUBJECTS?.[0]||'Língua Portuguesa');
    const subjInput=prompt('Disciplina do Flashcard:',defaultSubj);
    if(!subjInput||!subjInput.trim())return;
    const front=prompt('FRENTE DO CARTÃO (Pergunta direta de memorização, conceito ou artigo):');
    if(!front||front.trim().length<6)return toast('Digite uma pergunta clara para a frente do cartão.');
    const back=prompt('VERSO DO CARTÃO (Resposta direta e objetiva):');
    if(!back||back.trim().length<3)return toast('Digite a resposta para o verso do cartão.');
    const subj=canonicalSubjectName(subjInput.trim());
    state.customFlashcardsByCampaign=state.customFlashcardsByCampaign||{};
    const campId=state.activeCampaignId;
    state.customFlashcardsByCampaign[campId]=state.customFlashcardsByCampaign[campId]||[];
    state.customFlashcardsByCampaign[campId].unshift([subj,front.trim(),back.trim()]);
    ALL_FLASHCARDS.unshift([subj,front.trim(),back.trim()]);
    save();
    window.persistToLocalDatabase?.(campId);
    currentCard=0;
    if(typeof renderStudy==='function')renderStudy();
    updateFlashcardSpacedStats();
    toast(`🃏 Flashcard manual adicionado em ${subj}!`);
  }

  function dismissCurrentDisplayedFlashcard(){
    const cardEl=q('#flashcard');
    const key=cardEl?.dataset?.card;
    const qTxt=q('#cardQuestion')?.textContent||'';
    if(!key||!qTxt)return toast('Nenhum cartão selecionado.');
    state.dismissedFlashcardKeys=state.dismissedFlashcardKeys||{};
    state.dismissedFlashcardKeys[key]=true;
    ALL_FLASHCARDS=(ALL_FLASHCARDS||[]).filter(c=>fcKey(c)!==key&&c?.[1]!==qTxt);
    if(state.customFlashcardsByCampaign?.[state.activeCampaignId]){
      state.customFlashcardsByCampaign[state.activeCampaignId]=state.customFlashcardsByCampaign[state.activeCampaignId].filter(c=>fcKey(c)!==key&&c?.[1]!==qTxt);
    }
    save();
    window.persistToLocalDatabase?.(state?.activeCampaignId);
    if(typeof renderCard==='function')renderCard();
    updateFlashcardSpacedStats();
    toast('🗑️ Cartão removido do seu baralho!');
  }

  function enhanceFlashcardsSpacedRepetition(){
    const cardsPanel=q('#cards');
    if(!cardsPanel)return;
    // Sempre higieniza cartões de ruído na memória ao abrir a aba
    if(typeof window.isValidFlashcardItem==='function'&&Array.isArray(ALL_FLASHCARDS)){
      ALL_FLASHCARDS=ALL_FLASHCARDS.filter(c=>window.isValidFlashcardItem(c?.[1],c?.[2]));
    }
    if(!q('#flashcardSpacedBar')){
      const head=cardsPanel.querySelector('.sectionHead');
      if(head){
        head.insertAdjacentHTML('afterend',`
          <div class="flashSpacedBar" id="flashcardSpacedBar" style="flex-direction:column;align-items:stretch;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="small muted" id="flashSpacedStats">Repetição espaçada ativa (1=Difícil · 2=Rever · 3=Fácil · Espaço=Virar)</span>
              <label class="small" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flashDueOnlyToggle"> Apenas pendentes/difíceis</label>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding-top:6px;border-top:1px solid rgba(56,189,248,.16)">
              <button type="button" class="action small" id="generateAiProfessorFlashcardsBtn" style="width:auto;padding:6px 11px;font-size:.76rem">✨ Gerar Flashcards da Banca (IA)</button>
              <button type="button" class="ghost small" id="createManualFlashcardBtn" style="width:auto;padding:6px 10px;font-size:.76rem">➕ Criar Cartão</button>
              <button type="button" class="ghost small" id="purgeNoisyFlashcardsBtn" style="width:auto;padding:6px 10px;font-size:.76rem">🧹 Limpar Cartões Fora do Padrão</button>
              <button type="button" class="ghost danger small" id="deleteCurrentFlashcardBtn" style="width:auto;padding:6px 10px;font-size:.76rem;margin-left:auto">🗑️ Excluir este Cartão</button>
            </div>
          </div>
        `);
        q('#flashDueOnlyToggle').onchange=()=>{if(typeof renderCard==='function')renderCard();updateFlashcardSpacedStats()};
        q('#generateAiProfessorFlashcardsBtn').onclick=e=>generateProfessorFlashcardsForSubject(e.currentTarget);
        q('#createManualFlashcardBtn').onclick=createManualUserFlashcard;
        q('#purgeNoisyFlashcardsBtn').onclick=()=>purgeNoisyFlashcardsNow(true);
        q('#deleteCurrentFlashcardBtn').onclick=dismissCurrentDisplayedFlashcard;
      }
    }
    if(!window._v77FlashListenersBound){
      window._v77FlashListenersBound=true;
      document.addEventListener('flashcards:graded',updateFlashcardSpacedStats);
      document.addEventListener('keydown',e=>{
        if(!q('#study')?.classList.contains('active')||!q('#cards')?.classList.contains('active'))return;
        if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||''))return;
        if(e.key==='1'){e.preventDefault();window.gradeCard?.('hard')}
        else if(e.key==='2'){e.preventDefault();window.gradeCard?.('medium')}
        else if(e.key==='3'){e.preventDefault();window.gradeCard?.('easy')}
      });
    }
    if(typeof renderCard==='function')renderCard();
    updateFlashcardSpacedStats();
  }

  function updateFlashcardSpacedStats(){
    const statsEl=q('#flashSpacedStats');
    if(!statsEl)return;
    const validList=(ALL_FLASHCARDS||[]).filter(c=>typeof window.isValidFlashcardItem==='function'?window.isValidFlashcardItem(c?.[1],c?.[2]):true);
    if(validList.length!==(ALL_FLASHCARDS||[]).length)ALL_FLASHCARDS=validList;
    const now=Date.now(),cards=validList.map((c,i)=>({c,i,key:fcKey(c)}));
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

  function triggerStudyLegalHighlights(){
    ensureLegalHighlightToggle();
    if(legalHighlightEnabled)setTimeout(()=>applyLegalHighlightsToTextNodes(q('#summaryList')),50);
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
        const raw=btn.dataset.challengeFromRank||'',cut=raw.indexOf('|'),uid=cut<0?raw:raw.slice(0,cut),uname=cut<0?'Oponente':raw.slice(cut+1);
        selectedDuelOpponentId=uid;
        selectedDuelOpponentName=uname;
        openView('duel');
      };
    });
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
    const cleaned=String(text??'')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}\s*[-/]\s*\d{2}\b/g,'[CPF PROTEGIDO]')
      .replace(/(cpf|inscrito|licenciado para|aluno\(a\)|comprador)\s*[:\-]?\s*[0-9.\-]{8,18}/gi,'$1: [DADO PROTEGIDO]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[EMAIL PROTEGIDO]');
    return typeof window.normalizeLegalText==='function'?window.normalizeLegalText(cleaned):cleaned;
  }

  let _commSyncInFlight=null;
  async function syncCommunityLibraryForActivePortal(force=false){
    if(!cloudSession)return;
    const campaign=typeof activeCampaign==='function'?activeCampaign():null;
    if(!campaign)return;
    if(_commSyncInFlight&&!force)return _commSyncInFlight;
    const slug='universal';
    try{
      if(force||communityCache.slug!==slug||!communityCache.loadedAt||(Date.now()-communityCache.loadedAt>=60000)){
        // Busca universal: consulta o RPC universal e, caso o banco ainda esteja em versão anterior que filtrava por slug,
        // agrega simultaneamente os principais perfis (PMPE, CBMPE, PPPE, PCPE e o portal ativo) + outros portais da própria conta.
        const probeExams=[
          {p_exam_name:campaign.name||'',p_exam_org:campaign.organization||''},
          {p_exam_name:'PMPE — Soldado',p_exam_org:'Polícia Militar de Pernambuco'},
          {p_exam_name:'CBMPE — Bombeiros PE',p_exam_org:'Corpo de Bombeiros Militar de PE'},
          {p_exam_name:'PPPE — Polícia Penal de PE',p_exam_org:'Polícia Penal de Pernambuco'},
          {p_exam_name:'PCPE — Polícia Civil de PE',p_exam_org:'Polícia Civil de Pernambuco'}
        ];
        const firstRes=await cloudFetch('rpc/get_community_exam_library',{
          method:'POST',
          body:JSON.stringify(probeExams[0])
        }).catch(()=>null);
        const firstData=firstRes&&firstRes.ok?await firstRes.json().catch(()=>null):null;
        const docMap=new Map();
        const sumMap=new Map();
        const mergePayload=payload=>{
          if(!payload)return;
          for(const d of (Array.isArray(payload.documents)?payload.documents:[])){
            if(d?.id&&!['edital','edital_concurso'].includes(d.document_type)&&!docMap.has(String(d.id)))docMap.set(String(d.id),d);
          }
          for(const s of (Array.isArray(payload.summaries)?payload.summaries:[])){
            if(s?.id&&!sumMap.has(String(s.id)))sumMap.set(String(s.id),s);
          }
        };
        mergePayload(firstData);
        // Se o RPC no Supabase ainda não for o v99 universal (exam_slug !== "universal"), consulta os demais perfis em paralelo
        if(!firstData||firstData.exam_slug!=='universal'){
          const seenSlugs=new Set([normalizeExamSlug(probeExams[0].p_exam_name,probeExams[0].p_exam_org)]);
          const extraProbes=probeExams.slice(1).filter(p=>{
            const s=normalizeExamSlug(p.p_exam_name,p.p_exam_org);
            if(seenSlugs.has(s))return false;
            seenSlugs.add(s);
            return true;
          });
          const extraResults=await Promise.all(extraProbes.map(p=>cloudFetch('rpc/get_community_exam_library',{method:'POST',body:JSON.stringify(p)}).then(r=>r.ok?r.json():null).catch(()=>null)));
          extraResults.forEach(mergePayload);
        }
        // Também inclui documentos e conteúdos prontos de outros portais do próprio usuário (ex.: PMPE <-> CBM PE)
        const [ownOtherDocsRes,ownOtherSumsRes]=await Promise.all([
          cloudFetch(`study_documents?processing_status=eq.ready&document_type=not.in.(edital,edital_concurso)&select=*&order=created_at.desc&limit=200`).catch(()=>null),
          cloudFetch(`generated_study_content?content_type=in.(summary,question_pack)&select=id,title,content_type,content,source_refs,source_document_id,created_at&order=created_at.asc&limit=500`).catch(()=>null)
        ]);
        const ownOtherDocs=ownOtherDocsRes?.ok?await ownOtherDocsRes.json().catch(()=>[]):[];
        const ownOtherSums=ownOtherSumsRes?.ok?await ownOtherSumsRes.json().catch(()=>[]):[];
        if(Array.isArray(ownOtherDocs)){
          for(const d of ownOtherDocs){
            if(!d?.id||String(d.campaign_id)===String(campaign.dbId))continue;
            if(d.share_with_community===false||d.metadata?.private_only===true)continue;
            if(!docMap.has(String(d.id))){
              docMap.set(String(d.id),{...d,is_community:true,portal_name:d.portal_name||'Meu Outro Portal',author_name:d.author_name||'Sua Biblioteca'});
            }
          }
        }
        if(Array.isArray(ownOtherSums)){
          for(const s of ownOtherSums){
            if(!s?.id||sumMap.has(String(s.id)))continue;
            const pDoc=docMap.get(String(s.source_document_id));
            if(pDoc||!s.source_document_id){
              sumMap.set(String(s.id),{...s,is_community:true,document_type:pDoc?.document_type||'material'});
            }
          }
        }
        communityCache={slug:'universal',documents:[...docMap.values()],summaries:[...sumMap.values()],editalTopics:[],loadedAt:Date.now()};
      }
      const commDocs=Array.isArray(communityCache.documents)?communityCache.documents:[];
      const commSums=Array.isArray(communityCache.summaries)?communityCache.summaries:[];

      // Remover qualquer edital da comunidade que estivesse em memória
      for(let i=cloudDocuments.length-1;i>=0;i--){
        if(cloudDocuments[i]?.is_community&&['edital','edital_concurso'].includes(cloudDocuments[i].document_type)){
          cloudDocuments.splice(i,1);
        }
      }

      // 1) Mesclar todos os materiais, leis, provas, simulados e anotações da comunidade universal em cloudDocuments (SEM storage_path)
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
      const prevSumLen=(ALL_SUMMARIES||[]).length,prevCardLen=(ALL_FLASHCARDS||[]).length,prevQLen=(ALL_QUESTIONS||[]).length;
      const existingSumKeys=new Set((ALL_SUMMARIES||[]).map(s=>`${topicKey(s.category)}|${topicKey(s.title)}`));
      const existingCardKeys=new Set((ALL_FLASHCARDS||[]).map(c=>`${topicKey(c[0])}|${topicKey(c[1])}`));
      const existingQKeys=new Set((ALL_QUESTIONS||[]).map(qItem=>topicKey(qItem.statement).slice(0,80)));

      for(const row of commSums){
        const parentDoc=(cloudDocuments||[]).find(d=>String(d.id)===String(row.source_document_id))||commDocs.find(d=>String(d.id)===String(row.source_document_id))||null;
        const docType=String(parentDoc?.document_type||row.document_type||'material').toLowerCase();
        const isQuestionPackRow=Boolean(row.content?.is_question_pack||row.content_type==='question_pack'||['prova','simulado'].includes(docType));
        const cat=typeof window.resolveDocumentDiscipline==='function'
          ?window.resolveDocumentDiscipline(parentDoc,row.content?.subject||'',`${row.content?.source||''} ${row.title||''}`)
          :canonicalSubjectName(row.content?.subject||'Conteúdo geral',`${row.content?.source||''} ${row.title||''}`);
        const cleanTitle=sanitizePersonalWatermarks(row.title||'Assunto da Comunidade');
        if(typeof window.isInvalidTrailSubject==='function'&&window.isInvalidTrailSubject(cat,cleanTitle,row.content?.source||'',parentDoc))continue;
        const sumKey=`${topicKey(cat)}|${topicKey(cleanTitle)}`;
        const isValidSum=typeof window.isValidPedagogicalSummary==='function'?window.isValidPedagogicalSummary(row):true;
        if(!isQuestionPackRow&&isValidSum&&!existingSumKeys.has(sumKey)){
          const rawMnem=sanitizePersonalWatermarks(row.content?.mnemonic||'');
          ALL_SUMMARIES.push({
            id:row.id,
            documentId:row.source_document_id,
            title:cleanTitle,
            source:`🌐 Comunidade (${sanitizePersonalWatermarks(row.content?.source||'Acervo Universal')})`,
            category:cat,
            explanation:sanitizePersonalWatermarks(row.content?.explanation||''),
            points:(row.content?.points||[]).map(sanitizePersonalWatermarks),
            example:sanitizePersonalWatermarks(row.content?.example||''),
            bizu:sanitizePersonalWatermarks(row.content?.bizu||''),
            mnemonic:typeof window.cleanPedagogicalMnemonic==='function'?window.cleanPedagogicalMnemonic(rawMnem):rawMnem,
            trap:sanitizePersonalWatermarks(row.content?.trap||''),
            is_community:true
          });
          existingSumKeys.add(sumKey);
        }

        // Flashcards: APENAS de materiais, anotações e textos de lei, e sem questões de interpretação de texto externo
        const allowFlashcardsForRow=typeof window.isAllowedFlashcardRow==='function'
          ?window.isAllowedFlashcardRow(row,parentDoc)
          :(!isQuestionPackRow&&['material','anotacao','lei'].includes(docType));
        if(allowFlashcardsForRow){
          for(const card of (row.content?.flashcards||[])){
            const qText=sanitizePersonalWatermarks(card.question||'');
            const aText=sanitizePersonalWatermarks(card.answer||'');
            const isValidCard=typeof window.isValidFlashcardItem==='function'?window.isValidFlashcardItem(qText,aText):Boolean(qText&&aText);
            const cKey=`${topicKey(cat)}|${topicKey(qText)}`;
            if(isValidCard&&!existingCardKeys.has(cKey)){
              ALL_FLASHCARDS.push([cat,qText,aText]);
              existingCardKeys.add(cKey);
            }
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

      const addedContent=(ALL_SUMMARIES.length>prevSumLen)||(ALL_FLASHCARDS.length>prevCardLen)||(ALL_QUESTIONS.length>prevQLen);
      if(addedDocs>0||addedContent){
        LEARNING_SUBJECTS=typeof window.computeValidLearningSubjects==='function'?window.computeValidLearningSubjects():[...new Set([...ALL_SUMMARIES.map(x=>x.category),...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
        window.persistToLocalDatabase?.(state?.activeCampaignId);
        window.markViewsDirty?.('library','study','learning','report');
        const actId=document.querySelector('.view.active')?.id||'today';
        if(actId==='library'&&typeof renderUserDocuments==='function')renderUserDocuments();
        else if(actId==='study'&&typeof renderStudy==='function')renderStudy();
        else if(actId==='learning'&&typeof renderLearning==='function')renderLearning();
        else if(actId==='report'&&typeof renderQuestionFilters==='function'){renderQuestionFilters();populateTopicFilter();updateQuestionPool();renderExamBankHub()}
      }
      if(document.querySelector('.view.active')?.id==='library')renderCommunityCoopBanner();
    }catch{}
  }
  window.syncCommunityLibraryForActivePortal=syncCommunityLibraryForActivePortal;

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
        banner.innerHTML=`
          <div>
            <div class="eyebrow">🌐 REDE COOPERATIVA UNIVERSAL · TODOS OS PERFIS E CONCURSOS</div>
            <b>Biblioteca Compartilhada Universal da Comunidade</b>
            <div class="small muted">Acesso universal liberado para todos os usuários e perfis do banco (PMPE, CBMPE, PPPE, PCPE e demais concursos): materiais de estudo, leis, anotações, provas e simulados compartilhados ficam disponíveis em qualquer portal (o Edital permanece individual e o PDF original segue protegido contra download).</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span class="tag">${commDocs.length} material(is) universais · ${commSums.length} resumos · ${commQs.length} questões</span>
            <button type="button" class="ghost small" id="syncCommunityNowBtn">↻ Sincronizar Acervo Universal</button>
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
      const chk=row.querySelector('input[data-topic],input[data-id]');
      const m=missions.find(item=>String(item.id)===String(chk?.dataset?.topic||chk?.dataset?.id||''));
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
      <div class="card" id="typedEssayBox" style="width:100%;box-sizing:border-box;padding:16px 18px;margin:12px 0 16px;background:linear-gradient(160deg,#091a2b,#061320);border:1px solid #28547a;border-radius:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <b style="font-size:.95rem;color:var(--cyan);display:flex;align-items:center;gap:6px">✍️ Digitar redação direto na tela (sem precisar de foto/PDF)</b>
          <span class="tag" id="typedEssayCounter" style="font-weight:700">0 linhas · 0 palavras</span>
        </div>
        <textarea id="typedEssayText" rows="12" maxlength="5000" style="width:100%!important;box-sizing:border-box!important;min-height:260px;line-height:1.7;font-size:.95rem;padding:14px 16px;border-radius:12px;background:#050f1a;border:1px solid #2d5577;color:#f1f5f9;resize:vertical;display:block;font-family:inherit" placeholder="Digite sua redação diretamente aqui (recomenda-se entre 20 e 30 linhas). Ao clicar no botão abaixo, o sistema formata o texto em folha pautada oficial com cabeçalho, numeração de linhas e anexa automaticamente para a correção da IA!"></textarea>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="small muted">💡 Dica: ~75 a 85 caracteres equivalem a 1 linha manuscrita na folha oficial.</span>
          <button type="button" class="action" id="attachTypedEssayBtn" style="padding:10px 18px;min-height:42px;font-size:.85rem;display:inline-flex;align-items:center;gap:6px">📄 Converter e Anexar Folha Oficial</button>
        </div>
        <div id="typedEssayAttachedBadge" style="display:none;margin-top:10px;padding:9px 13px;border-radius:10px;background:#0d3324;border:1px solid #10b981;color:#6ee7b7;font-size:.84rem;font-weight:700">✓ Folha oficial gerada e anexada com sucesso! Clique em 'Enviar e corrigir redação' abaixo.</div>
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
      if(q('#essayLines'))q('#essayLines').value=String(wrapped.length||30);
      const badge=q('#typedEssayAttachedBadge');
      if(badge){
        badge.style.display='block';
        badge.textContent=`✓ Folha oficial gerada com ${wrapped.length} linha(s) e anexada com sucesso! Clique em 'Enviar e corrigir redação' abaixo.`;
      }
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

  const DUEL_EXAMINER_BOTS=[
    {user_id:'bot:aocp',name:'🤖 Examinador Instituto AOCP',role:'Bot da Banca · Letra da Lei & Prazos',board:'Instituto AOCP',accuracy:0.72,avgTimeS:12,xp:3200,is_bot:true,is_online:true},
    {user_id:'bot:cebraspe',name:'🤖 Examinador Cebraspe',role:'Bot da Banca · Jurisprudência & Casos',board:'Cebraspe',accuracy:0.78,avgTimeS:11,xp:4100,is_bot:true,is_online:true},
    {user_id:'bot:fgv',name:'🤖 Examinador FGV Conhecimento',role:'Bot da Banca · Casos Práticos',board:'FGV Conhecimento',accuracy:0.76,avgTimeS:13,xp:3900,is_bot:true,is_online:true},
    {user_id:'bot:sombra',name:'🤖 Sombra Rank S (Monarca)',role:'Bot Elite · Desafio Máximo',board:'all',accuracy:0.88,avgTimeS:9,xp:5200,is_bot:true,is_online:true}
  ];
  window.DUEL_EXAMINER_BOTS=DUEL_EXAMINER_BOTS;

  function buildDuelQuestionPack(subjectFilter='all',mode='misto',count=5,boardFilter='all'){
    ensureNativeQuestionBankLoaded();
    let pool=(ALL_QUESTIONS||[]).filter(qItem=>Array.isArray(qItem.options)&&qItem.options.length===4&&Number.isInteger(qItem.correct_index));
    if(subjectFilter&&subjectFilter!=='all'){
      const bySubj=pool.filter(qItem=>topicKey(learningCategory(qItem.subject))===topicKey(learningCategory(subjectFilter))||topicKey(qItem.subject)===topicKey(subjectFilter));
      if(bySubj.length>=3)pool=bySubj;
    }
    if(boardFilter&&boardFilter!=='all'){
      const byBoard=pool.filter(qItem=>questionMatchesBoardFilter(qItem,boardFilter));
      const others=pool.filter(qItem=>!questionMatchesBoardFilter(qItem,boardFilter));
      pool=byBoard.length>=count?byBoard:[...byBoard,...others];
    }
    if(mode==='dificil'){
      const hard=pool.filter(qItem=>normalizeText(qItem.difficulty||'').startsWith('dif'));
      if(hard.length>=3)pool=hard;
    }else if(mode==='fixacao'){
      const easyMed=pool.filter(qItem=>!normalizeText(qItem.difficulty||'').startsWith('dif'));
      if(easyMed.length>=3)pool=easyMed;
    }
    if(pool.length<count){
      pool=[...pool,...NATIVE_POLICE_QUESTION_BANK,...FALLBACK_DUEL_QUESTIONS];
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
        board:item.board||(boardFilter!=='all'?boardFilter:'Estilo Banca'),
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
    const meLocal=localHunterRow();
    for(const p of players){
      const isMe=p.is_me||p.user_id===myId;
      statsByUser.set(p.user_id,{
        user_id:p.user_id,
        name:p.name,
        role:p.role||'PMPE — Soldado',
        xp:isMe?Math.max(Number(p.xp||0),Number(meLocal.xp||0)):Number(p.xp||0),
        is_me:isMe,
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

  const seenDuelInviteIds=new Set((()=>{try{return JSON.parse(sessionStorage.getItem('jornada-seen-duel-invites-v108')||'[]')}catch{return[]}})());
  const declinedDuelIds=new Set((()=>{try{return JSON.parse(localStorage.getItem('jornada-declined-duels-v108')||'[]')}catch{return[]}})());
  function persistSeenDuelInvites(){try{sessionStorage.setItem('jornada-seen-duel-invites-v108',JSON.stringify([...seenDuelInviteIds].slice(-80)))}catch{}}
  function persistDeclinedDuels(){try{localStorage.setItem('jornada-declined-duels-v108',JSON.stringify([...declinedDuelIds].slice(-120)))}catch{}}

  function playDuelChallengeSound(){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      const ctx=new Ctx();
      const notes=[523.25,659.25,783.99,1046.5];
      notes.forEach((freq,idx)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='triangle';
        osc.frequency.setValueAtTime(freq,ctx.currentTime+idx*0.09);
        gain.gain.setValueAtTime(0.12,ctx.currentTime+idx*0.09);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+idx*0.09+0.22);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(ctx.currentTime+idx*0.09);
        osc.stop(ctx.currentTime+idx*0.09+0.23);
      });
    }catch{}
  }

  async function declineDuelChallenge(duelId,isCancel=false){
    if(!duelId)return;
    declinedDuelIds.add(String(duelId));
    seenDuelInviteIds.add(String(duelId));
    persistDeclinedDuels();
    persistSeenDuelInvites();
    q('#duelInvitePopupDialog')?.close();
    if(Array.isArray(duelHubData?.my_duels)){
      duelHubData.my_duels=duelHubData.my_duels.filter(d=>String(d.id)!==String(duelId));
    }
    renderDuelArena();
    if(typeof renderInteractiveNotifications==='function')renderInteractiveNotifications();
    try{
      await cloudFetch('rpc/decline_hunter_duel',{
        method:'POST',
        body:JSON.stringify({p_duel_id:duelId})
      });
    }catch{}
    toast(isCancel?'🗑️ Convite de Duelo X1 cancelado.':'❌ Convite de Duelo X1 recusado.');
    await loadDuelArenaHub(true);
  }

  function acceptDuelChallengeNow(duelId){
    const found=(duelHubData?.my_duels||[]).find(d=>String(d.id)===String(duelId));
    q('#duelInvitePopupDialog')?.close();
    q('#notificationDialog')?.close();
    if(!found){
      openView('duel');
      loadDuelArenaHub(false);
      return;
    }
    seenDuelInviteIds.add(String(found.id));
    persistSeenDuelInvites();
    openView('duel');
    startPlayingDuel(found);
  }

  function checkAndShowIncomingDuelInvitePopup(){
    if(!cloudSession||activeDuelSession)return;
    const myId=cloudSession?.user?.id;
    if(!myId)return;
    const incoming=(duelHubData?.my_duels||[]).filter(d=>
      d&&d.status==='pending'&&
      String(d.opponent_id)===String(myId)&&
      !d.opponent_done&&
      !declinedDuelIds.has(String(d.id))&&
      !seenDuelInviteIds.has(String(d.id))
    );
    if(!incoming.length)return;
    const d=incoming[0];
    const dlg=q('#duelInvitePopupDialog'),body=q('#duelInvitePopupBody');
    if(!dlg||!body||dlg.open)return;
    seenDuelInviteIds.add(String(d.id));
    persistSeenDuelInvites();
    playDuelChallengeSound();
    try{
      if(window.Notification&&Notification.permission==='granted'){
        new Notification(`⚔️ Desafio X1 de ${d.challenger_name||'Caçador'}!`,{
          body:`Disciplina: ${d.subject||'Roleta Mista'} (${(d.questions||[]).length} questões). Clique para aceitar ou recusar!`,
          icon:'icon-192.png'
        });
      }
    }catch{}
    const qCount=(d.questions||[]).length||5;
    const modeLabel=d.difficulty_mode==='dificil'?'🔥 Difícil (Pegadinhas)':d.difficulty_mode==='fixacao'?'⚡ Fixação Rápida':'⚖️ Equilibrado';
    body.innerHTML=`
      <div class="slInviteAlertCard">
        <div class="slInviteHeader">
          <span class="slSystemBadge"><i class="slPulseDot"></i> [SISTEMA] CONVITE DE DUELO X1 EM TEMPO REAL</span>
          <span class="tag">⏱️ 25s / questão</span>
        </div>
        <div class="slInviteHeroRow">
          <div class="slInviteAvatar">⚔️</div>
          <div>
            <h2 style="margin:0;font-size:1.22rem;color:#f8fafc">${escText(d.challenger_name||'Um Caçador')} desafiou você para um X1!</h2>
            <p class="small muted" style="margin:4px 0 0">
              ${d.challenger_done
                ?`⚡ <b>${escText(d.challenger_name)}</b> já concluiu a rodada dele! Jogue agora para revelar o placar e definir o vencedor.`
                :`🟢 Desafio recém-lançado na Arena! Você pode aceitar para jogar agora ou recusar.`}
            </p>
          </div>
        </div>
        <div class="slInviteMetaGrid">
          <div class="slInviteMetaItem"><small>DISCIPLINA</small><b>📚 ${escText(d.subject||'Roleta Mista')}</b></div>
          <div class="slInviteMetaItem"><small>MODALIDADE</small><b>${escText(modeLabel)}</b></div>
          <div class="slInviteMetaItem"><small>RODADAS</small><b>🎯 ${qCount} questões</b></div>
        </div>
        <div class="slInviteActions">
          <button type="button" class="action" id="popupAcceptDuelBtn">⚔️ Aceitar e Jogar Agora</button>
          <button type="button" class="ghost danger" id="popupDeclineDuelBtn">❌ Recusar Convite</button>
          <button type="button" class="ghost small" id="popupLaterDuelBtn">⏰ Responder Depois (Fica nas Notificações 🔔)</button>
        </div>
      </div>
    `;
    q('#popupAcceptDuelBtn').onclick=()=>acceptDuelChallengeNow(d.id);
    q('#popupDeclineDuelBtn').onclick=()=>declineDuelChallenge(d.id,false);
    q('#popupLaterDuelBtn').onclick=()=>{
      dlg.close();
      toast('🔔 O convite de duelo ficou salvo no sino de Notificações e na Arena X1!');
    };
    try{dlg.showModal()}catch{}
  }

  async function loadDuelArenaHub(silent=false){
    if(duelHubBusy)return;
    duelHubBusy=true;
    if(!silent&&q('#duel')?.classList.contains('active'))renderDuelArena();
    try{
      if(!cloudSession){
        duelHubData={players:[localHunterRow()],my_duels:[],completed_duels:[]};
        return;
      }
      const res=await cloudFetch('rpc/get_duel_arena_hub',{method:'POST',body:JSON.stringify({})});
      const data=await res.json().catch(()=>null);
      if(res.ok&&data){
        duelSqlMissing=false;
        const rawMy=Array.isArray(data.my_duels)?data.my_duels:[];
        duelHubData={
          players:Array.isArray(data.players)?data.players:[],
          my_duels:rawMy.filter(d=>d&&d.status!=='declined'&&!declinedDuelIds.has(String(d.id))),
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
      if(!activeDuelSession&&q('#duel')?.classList.contains('active'))renderDuelArena();
      if(typeof renderInteractiveNotifications==='function')renderInteractiveNotifications();
      checkAndShowIncomingDuelInvitePopup();
    }
  }

  async function launchDuelChallenge(useAiGeneration=false,forcedOpponentId=null){
    const oppSelect=q('#duelOpponentSelect'),subjSelect=q('#duelSubjectSelect'),boardSelect=q('#duelBoardSelect'),modeSelect=q('#duelModeSelect'),countSelect=q('#duelCountSelect');
    const oppId=forcedOpponentId||oppSelect?.value||selectedDuelOpponentId||'bot:aocp';
    if(!oppId)return toast('Escolha um caçador ou Bot Examinador para desafiar no X1!');
    const botProfile=DUEL_EXAMINER_BOTS.find(b=>b.user_id===oppId)||null;
    const subj=subjSelect?.value||'all';
    const board=boardSelect?.value||(botProfile&&botProfile.board!=='all'?botProfile.board:'all');
    const mode=modeSelect?.value||'misto';
    const count=Math.min(10,Math.max(3,Number(countSelect?.value)||5));
    const oppPlayer=botProfile||(duelHubData.players||[]).find(p=>String(p.user_id)===String(oppId));
    const oppName=oppPlayer?.name||selectedDuelOpponentName||'Oponente';

    let questions=[];
    if(useAiGeneration&&cloudSession){
      const aiBtn=q('#createDuelAiBtn');
      if(aiBtn){aiBtn.disabled=true;aiBtn.textContent='⏳ IA criando questões do duelo...'}
      try{
        const session=await validSession();
        const campaignName=(typeof activeCampaign==='function'?activeCampaign()?.name:'Concurso Policial')||'Concurso Policial';
        const subjText=subj==='all'?'Direito Constitucional, Direito Penal, Legislação Extravagante, Língua Portuguesa e Direito Militar':subj;
        const boardLabel=board!=='all'?` no estilo da banca ${board}`:'';
        const diffLabel=mode==='dificil'?'difíceis com pegadinhas de banca':mode==='fixacao'?'diretas de fixação de conceitos e lei seca':'equilibradas entre fixação e questões difíceis';
        const prompt=`Crie ${count} questões inéditas de múltipla escolha (4 alternativas A, B, C, D) ${diffLabel}${boardLabel} sobre "${subjText}" para o concurso "${campaignName}".\nResponda EXCLUSIVAMENTE com um array JSON válido no formato:\n[{"subject":"Disciplina","topic":"Assunto","board":"${board!=='all'?board:'Instituto AOCP'}","difficulty":"${mode==='dificil'?'dificil':'medio'}","statement":"Enunciado claro","options":["Alternativa A","Alternativa B","Alternativa C","Alternativa D"],"correct_index":0,"explanation":"Conceito-chave: ... | ✅ Alternativa correta: ... | ❌ Análise das alternativas: ... | ⚠️ Pegadinha da banca: ..."}]`;
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
              board:String(x.board||(board!=='all'?board:'Estilo Banca')),
              difficulty:String(x.difficulty||mode),
              statement:typeof window.formatQuestionStatementText==='function'?window.formatQuestionStatementText(x.statement):String(x.statement),
              options:x.options.slice(0,4).map(String),
              correct_index:Math.min(3,Math.max(0,Number(x.correct_index)||0)),
              explanation:String(x.explanation||'Questão gerada pela IA para o Duelo X1.')
            }));
          }
        }
      }catch{}finally{
        if(aiBtn){aiBtn.disabled=false;aiBtn.textContent='✨ Desafiar com Questões Inéditas IA'}
      }
    }

    if(!questions.length){
      questions=buildDuelQuestionPack(subj,mode,count,board);
    }

    const subjectLabel=(subj==='all'?'Roleta Mista (Perguntados)':subj)+(board!=='all'?` · ${board}`:'');

    // Modo Bot Examinador da Banca (Simulação X1 Instantânea sem depender de outro jogador online)
    if(botProfile||String(oppId).startsWith('bot:')){
      const myId=cloudSession?.user?.id||'local';
      const botDuel={
        id:`bot-duel-${Date.now()}`,
        is_bot_duel:true,
        bot_profile:botProfile||DUEL_EXAMINER_BOTS[0],
        challenger_id:myId,
        opponent_id:oppId,
        challenger_name:localHunterRow().name,
        opponent_name:oppName,
        subject:subjectLabel,
        board:board,
        difficulty_mode:mode,
        questions:questions.map(qItem=>prepareQuestion(qItem))
      };
      toast(`🤖 Duelo X1 iniciado contra ${oppName}! Mostre sua velocidade e precisão!`);
      startPlayingDuel(botDuel);
      return;
    }

    try{
      const res=await cloudFetch('rpc/create_hunter_duel',{
        method:'POST',
        body:JSON.stringify({
          p_opponent_id:oppId,
          p_subject:subjectLabel,
          p_mode:mode,
          p_questions:questions
        })
      });
      const created=await res.json().catch(()=>({}));
      if(!res.ok||!created?.duel_id)throw new Error(duelErrorMessage(created?.message,'Não foi possível criar o duelo. Verifique se as migrações v95 e v96 foram executadas no Supabase.'));
      toast(`⚔️ Desafio X1 criado contra ${oppName}! Responda sua rodada agora!`);
      if(typeof postSystemDuelNoticeToGuild==='function'){
        postSystemDuelNoticeToGuild(`⚔️ Lancei um Desafio X1 contra ${oppName} em ${subjectLabel} (${count} questões)!`).catch(()=>undefined);
      }
      await loadDuelArenaHub(true);
      const myDuel=(duelHubData.my_duels||[]).find(d=>d.id===created.duel_id)||{
        id:created.duel_id,
        challenger_id:cloudSession?.user?.id,
        opponent_id:oppId,
        challenger_name:localHunterRow().name,
        opponent_name:oppName,
        subject:subjectLabel,
        difficulty_mode:mode,
        questions
      };
      startPlayingDuel(myDuel);
    }catch(err){
      toast(err.message||'Não foi possível iniciar o duelo.');
    }
  }
  window.launchDuelChallenge=launchDuelChallenge;

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
      submittingAnswer:false,
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
      if(!activeDuelSession||activeDuelSession.answered||activeDuelSession.submittingAnswer)return;
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

  async function answerDuelQuestion(chosenIdx){
    if(!activeDuelSession||activeDuelSession.answered||activeDuelSession.submittingAnswer)return;
    activeDuelSession.submittingAnswer=true;
    activeDuelSession.answered=true;
    if(duelRoundTimer){clearInterval(duelRoundTimer);duelRoundTimer=null}
    const spent=Math.min(25,Math.max(1,Math.round((Date.now()-activeDuelSession.questionStartMs)/1000)));
    activeDuelSession.totalTimeS+=spent;
    const curQ=activeDuelSession.duel.questions[activeDuelSession.index];
    qa('[data-duel-opt]').forEach(btn=>{btn.disabled=true});

    let correctIdx=curQ.correct_index;
    let explanationText=curQ.explanation||'';
    if((correctIdx===null||correctIdx===undefined)&&cloudSession&&activeDuelSession.duel?.id&&!activeDuelSession.duel?.is_bot_duel){
      try{
        const gRes=await cloudFetch('rpc/grade_hunter_duel_question',{
          method:'POST',
          body:JSON.stringify({p_duel_id:activeDuelSession.duel.id,p_question_index:activeDuelSession.index,p_chosen:chosenIdx})
        });
        const gData=await gRes.json().catch(()=>null);
        if(gRes.ok&&gData&&Number.isInteger(gData.correct_index)){
          correctIdx=gData.correct_index;
          explanationText=gData.explanation||explanationText;
          curQ.correct_index=correctIdx;
          curQ.explanation=explanationText;
        }
      }catch{}
    }
    const isCorrect=chosenIdx===Number(correctIdx??0);
    if(isCorrect)activeDuelSession.score++;
    activeDuelSession.answers.push({index:activeDuelSession.index,chosen:chosenIdx,correct:isCorrect,time_s:spent});
    if(typeof recordQuestionResult==='function')recordQuestionResult(curQ,isCorrect,chosenIdx);

    qa('[data-duel-opt]').forEach(btn=>{
      const idx=Number(btn.dataset.duelOpt);
      btn.disabled=true;
      if(idx===Number(correctIdx??0))btn.classList.add('correct');
      else if(idx===chosenIdx)btn.classList.add('wrong');
    });

    const fb=q('#duelRoundFeedback');
    if(fb){
      fb.hidden=false;
      const stepRes=typeof formatStepByStepResolution==='function'?formatStepByStepResolution(curQ,chosenIdx,isCorrect,false):`<div class="lessonBox ${isCorrect?'bizu':'trap'}" style="margin-top:10px"><b>${chosenIdx<0?'⏰ Tempo esgotado!':isCorrect?`✓ Acertou em ${spent}s!`:'✗ Resposta incorreta'}</b><p style="margin:4px 0 0">${escText(curQ.explanation||'Revise este ponto no seu material.')}</p></div>`;
      fb.innerHTML=`
        <div style="margin-top:10px">${stepRes}</div>
        <button type="button" class="action" id="nextDuelQuestionBtn" style="margin-top:10px;width:100%">
          ${activeDuelSession.index+1<activeDuelSession.duel.questions.length?'Próxima questão do duelo →':'Finalizar minha rodada e ver placar 🏆'}
        </button>
      `;
      q('#nextDuelQuestionBtn').onclick=async()=>{
        if(activeDuelSession.index+1<activeDuelSession.duel.questions.length){
          activeDuelSession.index++;
          activeDuelSession.answered=false;
          activeDuelSession.submittingAnswer=false;
          renderDuelArena();
          startDuelQuestionCountdown();
        }else{
          await finishAndSubmitDuelRound();
        }
      };
    }
  }

  function duelErrorMessage(raw,fallback){
    const m=String(raw||'');
    const map={
      already_submitted:'Você já enviou sua rodada deste duelo.',
      duel_closed:'Este duelo já foi encerrado.',
      duel_not_found:'Duelo não encontrado.',
      not_participant:'Você não participa deste duelo.',
      not_authenticated:'Entre na sua conta para jogar o X1 contra outros jogadores online (ou escolha um Bot Examinador da Banca para jogar imediatamente!).',
      invalid_opponent:'Oponente inválido. Escolha outro caçador ou Bot Examinador.',
      invalid_questions:'Não foi possível montar as questões do duelo. Tente outra disciplina.',
      too_many_pending_duels:'Você já tem muitos desafios pendentes hoje. Aguarde seus oponentes responderem.'
    };
    const key=Object.keys(map).find(k=>m.includes(k));
    return key?map[key]:(m||fallback);
  }

  async function finishAndSubmitDuelRound(){
    if(!activeDuelSession)return;
    const {duel,score,totalTimeS,answers}=activeDuelSession;
    const btn=q('#nextDuelQuestionBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Apurando placar da Arena...'}

    // Simulação completa se for duelo contra Bot Examinador da Banca
    if(duel.is_bot_duel||String(duel.opponent_id||'').startsWith('bot:')){
      const bot=duel.bot_profile||DUEL_EXAMINER_BOTS[0];
      const totalQ=duel.questions.length;
      let botScore=0,botTimeS=0;
      for(let i=0;i<totalQ;i++){
        const qDiff=normalizedDifficulty(duel.questions[i]);
        const diffMod=qDiff==='dificil'?-0.08:qDiff==='facil'?0.08:0;
        const hitProb=Math.min(0.95,Math.max(0.45,(bot.accuracy||0.72)+diffMod));
        if(Math.random()<hitProb)botScore++;
        botTimeS+=Math.max(5,Math.min(23,Math.round((bot.avgTimeS||12)+(Math.random()*6-3))));
      }
      const myId=cloudSession?.user?.id||'local';
      const isDraw=(score===botScore&&totalTimeS===botTimeS);
      const iWon=(score>botScore)||(score===botScore&&totalTimeS<botTimeS);
      const completedRecord={
        id:duel.id,
        status:'completed',
        challenger_id:myId,
        opponent_id:bot.user_id,
        challenger_name:duel.challenger_name||localHunterRow().name,
        opponent_name:bot.name,
        subject:duel.subject,
        difficulty_mode:duel.difficulty_mode||'misto',
        questions:duel.questions,
        challenger_score:score,
        challenger_time_s:totalTimeS,
        opponent_score:botScore,
        opponent_time_s:botTimeS,
        challenger_done:true,
        opponent_done:true,
        is_draw:isDraw,
        winner_id:isDraw?null:(iWon?myId:bot.user_id),
        completed_at:new Date().toISOString(),
        created_at:new Date().toISOString()
      };
      state.localBotDuels=Array.isArray(state.localBotDuels)?state.localBotDuels:[];
      state.localBotDuels.unshift(completedRecord);
      state.localBotDuels=state.localBotDuels.slice(0,30);
      save();
      duelHubData.my_duels=[completedRecord,...(duelHubData.my_duels||[])];
      duelHubData.completed_duels=[completedRecord,...(duelHubData.completed_duels||[])];
      playCompletionChime();
      activeDuelSession=null;
      renderDuelArena();
      toast(isDraw?`🤝 Empate técnico contra ${bot.name} (${score}/${totalQ} em ${totalTimeS}s)!`:iWon?`🏆 VITÓRIA NO X1 CONTRA ${bot.name.toUpperCase()}! Placar: ${score}/${totalQ} (${totalTimeS}s) × ${botScore}/${totalQ} (${botTimeS}s)!`:`⚔️ ${bot.name} venceu por ${botScore}/${totalQ} (${botTimeS}s) contra ${score}/${totalQ} (${totalTimeS}s). Tente a revanche!`);
      return;
    }

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
      if(!res.ok)throw new Error(duelErrorMessage(updated?.message,'Erro ao enviar resultado do duelo.'));
      playCompletionChime();
      activeDuelSession=null;
      await loadDuelArenaHub(true);
      renderDuelArena();
      if(updated.status==='completed'){
        const myId=cloudSession?.user?.id;
        const won=updated.winner_id===myId;
        const isChal=updated.challenger_id===myId;
        const finalScore=Number(isChal?updated.challenger_score:updated.opponent_score);
        const shownScore=Number.isFinite(finalScore)?finalScore:score;
        const finalTime=Number(isChal?updated.challenger_time_s:updated.opponent_time_s);
        const shownTime=Number.isFinite(finalTime)?finalTime:totalTimeS;
        toast(updated.is_draw?`🤝 Duelo empatado (${shownScore}/${duel.questions.length})!`:won?`🏆 VITÓRIA NO X1! Você venceu por ${shownScore}/${duel.questions.length} (${shownTime}s)!`:`Duelo finalizado (${shownScore}/${duel.questions.length}). Confira o placar na Arena!`);
      }else{
        const myIdPending=cloudSession?.user?.id,isChalPending=updated.challenger_id===myIdPending;
        const pendScore=Number(isChalPending?updated.challenger_score:updated.opponent_score),pendTime=Number(isChalPending?updated.challenger_time_s:updated.opponent_time_s);
        toast(`✓ Sua rodada (${Number.isFinite(pendScore)?pendScore:score}/${duel.questions.length} em ${Number.isFinite(pendTime)?pendTime:totalTimeS}s) foi registrada! Aguardando o oponente responder.`);
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

    const localBotDuels=Array.isArray(state?.localBotDuels)?state.localBotDuels:[];
    const existingIds=new Set((duelHubData.my_duels||[]).map(d=>d.id));
    for(const bd of localBotDuels){
      if(!existingIds.has(bd.id)){
        duelHubData.my_duels=[bd,...(duelHubData.my_duels||[])];
        duelHubData.completed_duels=[bd,...(duelHubData.completed_duels||[])];
        existingIds.add(bd.id);
      }
    }
    const {ranking,dominations,pairHistory}=computeArenaStatsAndRivalries();
    const opponents=(duelHubData.players||[]).filter(p=>!p.is_me&&String(p.user_id)!==String(myId));
    const pendingForMe=(duelHubData.my_duels||[]).filter(d=>d.status==='pending'&&((d.challenger_id===myId&&!d.challenger_done)||(d.opponent_id===myId&&!d.opponent_done)));
    const waitingOpponent=(duelHubData.my_duels||[]).filter(d=>d.status==='pending'&&((d.challenger_id===myId&&d.challenger_done&&!d.opponent_done)||(d.opponent_id===myId&&d.opponent_done&&!d.challenger_done)));
    const finishedMy=(duelHubData.my_duels||[]).filter(d=>d.status==='completed').slice(0,12);
    const subjects=[...new Set([...LEARNING_SUBJECTS,'Língua Portuguesa','Raciocínio Lógico-Matemático','Informática','História de Pernambuco','Direito Constitucional','Direito Administrativo','Direito Penal','Direito Processual Penal','Direitos Humanos','Legislação Extravagante','Direito Militar','Física','Biologia'])];

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
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <button type="button" class="action small" data-play-duel="${escText(d.id)}" style="width:auto">⚔️ Aceitar e Jogar Agora</button>
                    <button type="button" class="ghost danger small" data-decline-duel="${escText(d.id)}" style="width:auto">❌ Recusar</button>
                  </div>
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
          <label class="field">Desafiar Caçador ou Bot da Banca
            <select id="duelOpponentSelect">
              ${opponents.length?`<optgroup label="👥 Caçadores da Comunidade">${opponents.map(p=>`<option value="${escText(p.user_id)}" ${String(p.user_id)===String(selectedDuelOpponentId)?'selected':''}>${p.is_online?'🟢 [Online agora] ':'⚪ '}${escText(p.name)} (${escText(p.role||'PMPE')})</option>`).join('')}</optgroup>`:''}
              <optgroup label="🤖 Simulação Solo contra Examinador da Banca (Instantâneo)">
                ${DUEL_EXAMINER_BOTS.map(b=>`<option value="${escText(b.user_id)}" ${String(b.user_id)===String(selectedDuelOpponentId)||(!selectedDuelOpponentId&&!opponents.length&&b.user_id==='bot:aocp')?'selected':''}>${escText(b.name)} (${escText(b.role)})</option>`).join('')}
              </optgroup>
            </select>
          </label>
          <label class="field">Banca Examinadora do Duelo
            <select id="duelBoardSelect">
              <option value="all">Todas as Bancas (Banco Completo)</option>
              <option value="Instituto AOCP">🎯 Instituto AOCP (PMPE / CBMPE / Polícias)</option>
              <option value="Cebraspe">⚖️ Cebraspe (CESPE)</option>
              <option value="FGV Conhecimento">🏛️ FGV Conhecimento</option>
              <option value="UPENET/IAUPE">🛡️ UPENET / IAUPE</option>
              <option value="IBFC">📋 IBFC</option>
            </select>
          </label>
          <label class="field">Disciplina (Banco / Biblioteca / Edital)
            <select id="duelSubjectSelect">
              <option value="all">🎲 Roleta Mista Estilo Perguntados (Todas as matérias)</option>
              ${subjects.map(s=>`<option value="${escText(s)}">${escText(s)}</option>`).join('')}
            </select>
          </label>
          <label class="field">Nível e Quantidade
            <div style="display:grid;grid-template-columns:1.3fr .7fr;gap:8px">
              <select id="duelModeSelect" aria-label="Nível do Duelo">
                <option value="misto">⚖️ Equilibrado</option>
                <option value="fixacao">⚡ Fixação Rápida</option>
                <option value="dificil">🔥 Só Difíceis</option>
              </select>
              <select id="duelCountSelect" aria-label="Quantidade de Questões">
                <option value="5" selected>5 questões</option>
                <option value="7">7 questões</option>
              </select>
            </div>
          </label>
        </div>
        <div class="essayHelperBar" style="margin-top:12px;margin-bottom:0;padding-bottom:0;border-bottom:0">
          <button type="button" class="action" id="createDuelBankBtn">⚔️ Iniciar Duelo X1 Agora</button>
          <button type="button" class="ghost" id="quickDuelBotAocpBtn">🤖 Duelo Rápido contra Examinador AOCP</button>
          <button type="button" class="ghost" id="createDuelAiBtn">✨ Desafiar com Questões Inéditas IA</button>
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
                    <div class="small muted">${escText(rankLabelForXp(r.xp||0))} · <b>${Number(r.xp||0)} XP</b> · ${r.is_online?'🟢 Online agora':'Pode receber desafio'}</div>
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
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <span class="tag">Aguardando oponente</span>
                    <button type="button" class="ghost danger small" data-cancel-duel="${escText(d.id)}" style="width:auto">🗑️ Cancelar convite</button>
                  </div>
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
    if(q('#quickDuelBotAocpBtn'))q('#quickDuelBotAocpBtn').onclick=()=>{
      if(q('#duelOpponentSelect'))q('#duelOpponentSelect').value='bot:aocp';
      if(q('#duelBoardSelect'))q('#duelBoardSelect').value='Instituto AOCP';
      launchDuelChallenge(false,'bot:aocp');
    };
    if(q('#createDuelAiBtn'))q('#createDuelAiBtn').onclick=()=>launchDuelChallenge(true);
    const lobbyContainer=document.createElement('div');
    lobbyContainer.id='duelLobbyChatSection';
    lobbyContainer.style.marginTop='12px';
    root.appendChild(lobbyContainer);
    if(typeof renderGuildChatWidget==='function')renderGuildChatWidget('#duelLobbyChatSection','arena');

    qa('[data-play-duel]').forEach(btn=>{
      btn.onclick=()=>{
        const found=(duelHubData.my_duels||[]).find(d=>String(d.id)===String(btn.dataset.playDuel));
        if(found)startPlayingDuel(found);
      };
    });
    qa('[data-decline-duel]').forEach(btn=>{
      btn.onclick=()=>declineDuelChallenge(btn.dataset.declineDuel,false);
    });
    qa('[data-cancel-duel]').forEach(btn=>{
      btn.onclick=()=>declineDuelChallenge(btn.dataset.cancelDuel,true);
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


  // 17. Automação Inteligente das Etapas da Missão Diária (Teoria, Resumo/Flashcards, Questões e Revisão/Erros)
  function ensureDailyTracker(){
    const today=typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10);
    const curMissionId=state?.daily||null;
    if(!state.dailyTracker||state.dailyTracker.date!==today||state.dailyTracker.missionId!==curMissionId){
      state.dailyTracker={
        date:today,
        missionId:curMissionId,
        theoryRead:false,
        summaryCreated:false,
        flashcardsAnswered:0,
        questionsAnswered:0,
        errorsReviewed:0
      };
    }
    return state.dailyTracker;
  }

  function requiredQuestionsForStepLabel(label=''){
    const m=String(label||'').match(/(\d+)\s*quest/i);
    const wanted=m?Number(m[1]):20;
    const avail=(ALL_QUESTIONS||[]).length;
    if(avail>0&&avail<wanted)return Math.max(1,avail);
    return wanted;
  }

  function requiredFlashcardsForStepLabel(label=''){
    const m=String(label||'').match(/(\d+)\s*flashcard/i);
    const wanted=m?Number(m[1]):5;
    const avail=(ALL_FLASHCARDS||[]).length;
    if(avail>0&&avail<wanted)return Math.max(1,avail);
    return wanted;
  }

  function evaluateAndAutoCheckDailySteps(reason=''){
    if(!state?.daily)return;
    const tracker=ensureDailyTracker();
    const steps=typeof dailyStepsFor==='function'?dailyStepsFor(state.settings?.dailyMinutes||180):[];
    if(!steps.length)return;
    state.dailySteps=state.dailySteps||{};
    let newlyChecked=[];

    steps.forEach((label,idx)=>{
      if(state.dailySteps[idx])return;
      const norm=normalizeText(label);
      if(/teoria|revisar o resumo principal/.test(norm)){
        if(tracker.theoryRead||Number(state.studyByDay?.[tracker.date]||0)>=600){
          state.dailySteps[idx]=true;
          newlyChecked.push(label);
        }
      }else if(/flashcard/.test(norm)){
        const reqFc=requiredFlashcardsForStepLabel(label);
        if(tracker.flashcardsAnswered>=reqFc){
          state.dailySteps[idx]=true;
          newlyChecked.push(label);
        }
      }else if(/criar um resumo/.test(norm)){
        if(tracker.summaryCreated||tracker.flashcardsAnswered>=5){
          state.dailySteps[idx]=true;
          newlyChecked.push(label);
        }
      }else if(/questoes|questao/.test(norm)){
        const reqQ=requiredQuestionsForStepLabel(label);
        if(tracker.questionsAnswered>=reqQ){
          state.dailySteps[idx]=true;
          newlyChecked.push(label);
        }
      }else if(/corrigir.*erro|revisao final/.test(norm)){
        if(tracker.errorsReviewed>=1){
          state.dailySteps[idx]=true;
          newlyChecked.push(label);
        }
      }
    });

    if(newlyChecked.length){
      save();
      if(typeof renderDaily==='function')renderDaily();
      updateTodayCommand();
      decorateDailyStepProgressLabels();renderInteractiveNotifications();
      const allDone=steps.every((_,i)=>Boolean(state.dailySteps[i]));
      if(allDone&&!state.done?.[state.daily]){
        complete(state.daily);
        toast('🏆 Todas as etapas da Missão Diária foram cumpridas! Missão concluída automaticamente (+100 XP)!');
      }else{
        toast(`✓ Etapa da missão marcada automaticamente: "${newlyChecked[0]}"!`);
        if(cloudSession&&navigator.onLine&&typeof pushCloudState==='function')pushCloudState();
      }
    }else{
      decorateDailyStepProgressLabels();
    }
  }

  function decorateDailyStepProgressLabels(){
    const box=q('#dailyMission');
    if(!box||!state?.daily)return;
    const tracker=ensureDailyTracker();
    const steps=typeof dailyStepsFor==='function'?dailyStepsFor(state.settings?.dailyMinutes||180):[];
    qa('#dailyMission [data-step]').forEach(chk=>{
      const idx=Number(chk.dataset.step);
      const baseLabel=steps[idx]||'';
      const span=chk.parentElement?.querySelector('span');
      if(!span||!baseLabel)return;
      const norm=normalizeText(baseLabel);
      let badge='';
      if(/questoes|questao/.test(norm)){
        const reqQ=requiredQuestionsForStepLabel(baseLabel);
        const curQ=Math.min(reqQ,Number(tracker.questionsAnswered||0));
        badge=` (${curQ}/${reqQ} respondidas hoje)`;
      }else if(/flashcard/.test(norm)){
        const reqFc=requiredFlashcardsForStepLabel(baseLabel);
        const curFc=Math.min(reqFc,Number(tracker.flashcardsAnswered||0));
        badge=` (${curFc}/${reqFc} hoje)`;
      }else if(/corrigir.*erro|revisao final/.test(norm)){
        badge=chk.checked?' (revisado hoje)':' (marca ao concluir bateria/revisão)';
      }else if(/teoria|revisar o resumo/.test(norm)){
        badge=chk.checked?' (estudado hoje)':' (marca ao ler resumo/PDF ou 10min foco)';
      }else if(/criar um resumo/.test(norm)){
        badge=chk.checked?' (resumo salvo)':' (marca ao salvar nota/bizu ou 5 flashcards)';
      }
      span.innerHTML=`${escText(baseLabel)} <small class="muted" style="font-weight:600;color:var(--cyan)">${escText(badge)}</small>`;
    });
  }

  function hookAutomaticDailyStepTracking(){
    // 1) Hook em recordQuestionResult: cada questão respondida conta para a meta diária de questões
    const baseRecordQ=typeof recordQuestionResult==='function'?recordQuestionResult:null;
    if(baseRecordQ&&!baseRecordQ._dailyHooked){
      window.recordQuestionResult=recordQuestionResult=function(qItem,ok,chosen=null){
        const res=baseRecordQ(qItem,ok,chosen);
        const tracker=ensureDailyTracker();
        tracker.questionsAnswered=(Number(tracker.questionsAnswered)||0)+1;
        save();
        evaluateAndAutoCheckDailySteps('question_answered');
        return res;
      };
      recordQuestionResult._dailyHooked=true;
    }

    // 2) Hook em nextQuestion: ao concluir uma bateria de questões (vendo os gabaritos comentados),
    //    se foi uma bateria da missão ou se atingiu a meta, marca a revisão/correção de erros (Etapa 4)
    const baseNextQ=typeof nextQuestion==='function'?nextQuestion:null;
    if(baseNextQ&&!baseNextQ._dailyHooked){
      window.nextQuestion=nextQuestion=function(){
        const finishing=activeQuestions&&activeQuestions.current>=activeQuestions.questions.length-1;
        const wasMissionBattle=activeQuestions&&(activeQuestions.missionId===state?.daily||Number(activeQuestions.questions?.length||0)>=4);
        const res=baseNextQ();
        if(finishing){
          const tracker=ensureDailyTracker();
          tracker.errorsReviewed=(Number(tracker.errorsReviewed)||0)+1;
          if(wasMissionBattle){
            // Se concluiu a bateria completa da missão diária e o banco tinha menos de 20 questões, garante a etapa de questões também
            const steps=typeof dailyStepsFor==='function'?dailyStepsFor(state.settings?.dailyMinutes||180):[];
            const qStepIdx=steps.findIndex(s=>/questoes|questao/i.test(normalizeText(s)));
            if(qStepIdx>=0&&!state.dailySteps?.[qStepIdx]&&tracker.questionsAnswered>=4){
              state.dailySteps[qStepIdx]=true;
            }
          }
          save();
          evaluateAndAutoCheckDailySteps('battle_finished');
          if(cloudSession&&navigator.onLine&&typeof pushCloudState==='function')pushCloudState();
        }
        return res;
      };
      nextQuestion._dailyHooked=true;
    }

    // 3) Hook em gradeCard (Flashcards): conta flashcards avaliados e marca etapa de flashcards/resumo ativo
    const baseGradeCard=typeof gradeCard==='function'?gradeCard:null;
    if(baseGradeCard&&!baseGradeCard._dailyHooked){
      window.gradeCard=gradeCard=function(levelName){
        const res=baseGradeCard(levelName);
        const tracker=ensureDailyTracker();
        tracker.flashcardsAnswered=(Number(tracker.flashcardsAnswered)||0)+1;
        save();
        evaluateAndAutoCheckDailySteps('flashcard_graded');
        return res;
      };
      gradeCard._dailyHooked=true;
    }

    // 4) Hook em saveUserNote: ao salvar um resumo/anotação no caderno, marca "Criar um resumo detalhado"
    const baseSaveNote=typeof saveUserNote==='function'?saveUserNote:null;
    if(baseSaveNote&&!baseSaveNote._dailyHooked){
      window.saveUserNote=saveUserNote=function(){
        const res=baseSaveNote();
        const tracker=ensureDailyTracker();
        tracker.summaryCreated=true;
        save();
        evaluateAndAutoCheckDailySteps('note_saved');
        return res;
      };
      saveUserNote._dailyHooked=true;
    }

    // 5) Hook ao abrir qualquer Resumo Teórico ([data-summary]) ou PDF da Biblioteca: marca "Estudar a teoria do tópico"
    document.addEventListener('click',e=>{
      const sumBtn=e.target?.closest?.('[data-summary],[data-open-doc],[data-view-community-doc],#smartGuide,#smartAsk');
      if(sumBtn){
        const tracker=ensureDailyTracker();
        if(!tracker.theoryRead){
          tracker.theoryRead=true;
          save();
          evaluateAndAutoCheckDailySteps('theory_opened');
        }
      }
      const revBtn=e.target?.closest?.('[data-review],[data-error-review],[data-mastered-error],#savePersonalBizuBtn');
      if(revBtn){
        const tracker=ensureDailyTracker();
        tracker.errorsReviewed=(Number(tracker.errorsReviewed)||0)+1;
        if(revBtn.id==='savePersonalBizuBtn')tracker.summaryCreated=true;
        save();
        setTimeout(()=>evaluateAndAutoCheckDailySteps('error_reviewed'),60);
      }
    });
  }


  // 18. Central de Notificações Interativa (Feito / Limpar / Lembrar mais tarde 2h ou Amanhã) + Fechar Modal ao Clicar Fora
  let activeNotifTab='active';

  function ensureNotifState(){
    if(!state.notifState||typeof state.notifState!=='object'){
      state.notifState={dismissed:{},snoozed:{}};
    }
    if(!state.notifState.dismissed||typeof state.notifState.dismissed!=='object')state.notifState.dismissed={};
    if(!state.notifState.snoozed||typeof state.notifState.snoozed!=='object')state.notifState.snoozed={};
    return state.notifState;
  }

  function buildInteractiveNotificationItems(){
    if(typeof refreshStreak==='function')refreshStreak();
    const items=[];
    const today=typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10);
    const myId=cloudSession?.user?.id||'local';

    // 1. Duelos X1 aguardando sua resposta
    const pendingDuels=(duelHubData?.my_duels||[]).filter(d=>d.status==='pending'&&!declinedDuelIds.has(String(d.id))&&((d.challenger_id===myId&&!d.challenger_done)||(d.opponent_id===myId&&!d.opponent_done)));
    pendingDuels.forEach(d=>{
      const isInvite=String(d.opponent_id)===String(myId);
      const rival=isInvite?d.challenger_name:d.opponent_name;
      items.push({
        id:`duel-${d.id}`,
        duelId:d.id,
        isDuelInvite:isInvite,
        kind:'warn',
        icon:'⚔️',
        title:isInvite?`Convite de Duelo X1: ${rival} desafiou você!`:`Duelo X1 pendente contra ${rival}`,
        text:`${(d.questions||[]).length} questões (${d.subject||'Roleta Mista'} · 25s/questão) aguardando sua rodada.`,
        view:'duel',
        actionLabel:'⚔️ Aceitar e Jogar'
      });
    });

    // 2. Documentos em processamento, falha, pendentes ou com aviso de cobertura
    const processing=(cloudDocuments||[]).filter(x=>!x.is_community&&x.processing_status==='processing');
    const failed=(cloudDocuments||[]).filter(x=>!x.is_community&&x.processing_status==='error');
    const pending=(cloudDocuments||[]).filter(x=>!x.is_community&&x.processing_status==='pending');
    const coverageWarnings=(cloudDocuments||[]).filter(x=>!x.is_community&&x.processing_status==='ready'&&x.document_type!=='edital'&&x.metadata?.coverage?.needs_review);

    processing.forEach(doc=>items.push({
      id:`proc-${doc.id}`,
      kind:'warn',
      icon:'◌',
      title:`Analisando ${doc.title}`,
      text:'Você pode navegar pelo aplicativo. O resultado aparecerá quando a análise terminar.',
      view:'library',
      actionLabel:'Ver na Biblioteca'
    }));

    failed.forEach(doc=>items.push({
      id:`fail-${doc.id}`,
      docId:doc.id,
      kind:'error',
      icon:'!',
      title:`Falha em ${doc.title}`,
      text:'Toque em Tentar novamente ou abra a Biblioteca.',
      view:'library',
      actionLabel:'⚡ Tentar análise',
      retryDocId:doc.id
    }));

    pending.forEach(doc=>items.push({
      id:`pend-${doc.id}`,
      docId:doc.id,
      kind:'warn',
      icon:'↥',
      title:`${doc.title} aguarda análise`,
      text:doc.document_type==='edital'?'Inicie a análise para criar o mapa e as missões.':'Inicie a geração do conteúdo de estudo.',
      view:'library',
      actionLabel:'⚡ Analisar agora',
      retryDocId:doc.id
    }));

    coverageWarnings.forEach(doc=>items.push({
      id:`cov-${doc.id}`,
      docId:doc.id,
      isCoverageWarning:true,
      kind:'warn',
      icon:'!',
      title:`Revise a cobertura de ${doc.title}`,
      text:(doc.metadata?.coverage?.warnings||[])[0]||'A leitura do PDF precisa de conferência. Marque como "Feito" se já conferiu.',
      view:'library',
      actionLabel:'Abrir Biblioteca'
    }));

    // 3. Revisões espaçadas e erros do dia
    const reviews=typeof dueReviews==='function'?dueReviews():[];
    if(reviews.length){
      items.push({
        id:`rev-${today}-${reviews.length}`,
        stableGroup:`rev-${today}`,
        kind:'warn',
        icon:'↻',
        title:`${reviews.length} revisão${reviews.length===1?' pendente':'ões pendentes'} hoje`,
        text:'Revisar agora ajuda a fixar o conteúdo na memória de longo prazo.',
        view:'review',
        actionLabel:'Ir para Revisões'
      });
    }

    // 4. Contagem regressiva da prova
    const days=typeof examDaysRemaining==='function'?examDaysRemaining():null;
    const examDate=typeof activeCampaign==='function'?activeCampaign()?.examDate:null;
    if(days!==null&&days>=0){
      items.push({
        id:`exam-${today}`,
        kind:days<=7?'warn':'',
        icon:'⌛',
        title:days===0?'A prova é hoje!':days===1?'Falta 1 dia para a prova':`Faltam ${days} dias para a prova`,
        text:`Data: ${new Date(`${examDate}T12:00:00`).toLocaleDateString('pt-BR')}. Mantenha a constância no ciclo reverso.`,
        view:'map',
        actionLabel:'Ver Cronograma'
      });
    }

    // 5. Ofensiva e meta diária de estudo
    const studied=Math.floor(Number(state?.studyByDay?.[today]||0)/60);
    const activeToday=typeof qualifiesStreakDay==='function'?qualifiesStreakDay(today):false;
    const missionToday=typeof dayHasCompletedMission==='function'?dayHasCompletedMission(today):false;
    const reqMin=typeof streakMinSeconds==='function'?Math.round(streakMinSeconds()/60):50;

    if((state?.streak||0)>0&&!activeToday){
      items.push({
        id:`streak-${today}`,
        kind:'warn',
        icon:'♨',
        title:`Proteja sua ofensiva de ${state.streak} ${state.streak===1?'dia':'dias'}`,
        text:`${studied<reqMin?`Estude mais ${reqMin-studied} minuto(s). `:''}${!missionToday?'Conclua uma missão hoje.':''}`.trim(),
        view:'today',
        actionLabel:'Ir para Missão'
      });
    }

    const dailyGoalMin=Number(state?.settings?.dailyMinutes||180);
    if(studied<dailyGoalMin){
      items.push({
        id:`goal-${today}`,
        kind:'',
        icon:'⌁',
        title:'Meta diária de estudo em andamento',
        text:`${studied} de ${dailyGoalMin} minutos estudados hoje (faltam ${Math.max(0,dailyGoalMin-studied)} min).`,
        view:'today',
        actionLabel:'Iniciar Foco'
      });
    }

    // 6. Status de conexão
    if(!navigator.onLine){
      items.push({
        id:'net-offline',
        kind:'error',
        icon:'×',
        title:'Você está offline',
        text:'O progresso fica salvo neste aparelho e será sincronizado quando a internet voltar.'
      });
    }else if(cloudSession&&syncReady){
      items.push({
        id:`sync-ok-${today}`,
        kind:'success',
        icon:'✓',
        title:'Progresso sincronizado na nuvem',
        text:'Missões, questões, anotações, TAF e tempo estudado estão seguros na sua conta.'
      });
    }

    return items;
  }

  function classifyNotifications(){
    const ns=ensureNotifState();
    const now=Date.now();
    // Limpar snoozes vencidos para que voltem automaticamente para "Pendentes"!
    for(const [k,untilTs] of Object.entries(ns.snoozed)){
      if(Number(untilTs)<=now)delete ns.snoozed[k];
    }

    const raw=buildInteractiveNotificationItems();
    const active=[],snoozed=[],done=[];

    for(const item of raw){
      const key=item.stableGroup||item.id;
      if(ns.dismissed[key]||ns.dismissed[item.id]){
        done.push({...item,stateKey:key,doneAt:ns.dismissed[key]||ns.dismissed[item.id]});
      }else if(ns.snoozed[key]&&Number(ns.snoozed[key])>now){
        snoozed.push({...item,stateKey:key,snoozedUntil:Number(ns.snoozed[key])});
      }else{
        active.push({...item,stateKey:key});
      }
    }
    return {active,snoozed,done};
  }

  function markNotificationDone(item){
    const ns=ensureNotifState();
    const key=item.stateKey||item.id;
    ns.dismissed[key]=new Date().toISOString();
    ns.dismissed[item.id]=new Date().toISOString();
    delete ns.snoozed[key];
    // Se for aviso de cobertura de um PDF ("Revise a cobertura de ..."), também limpa a flag needs_review no documento para não voltar mais
    if(item.isCoverageWarning&&item.docId){
      const doc=(cloudDocuments||[]).find(d=>String(d.id)===String(item.docId));
      if(doc&&doc.metadata?.coverage){
        doc.metadata.coverage.needs_review=false;
        if(cloudSession&&navigator.onLine){
          cloudFetch(`study_documents?id=eq.${encodeURIComponent(doc.id)}`,{
            method:'PATCH',
            body:JSON.stringify({metadata:doc.metadata})
          }).catch(()=>undefined);
        }
      }
    }
    save();
    renderInteractiveNotifications();
    toast('✓ Aviso marcado como feito e removido dos pendentes!');
  }

  function snoozeNotification(item,hours=2){
    const ns=ensureNotifState();
    const key=item.stateKey||item.id;
    let until;
    if(hours==='tomorrow'){
      const d=new Date();
      d.setDate(d.getDate()+1);
      d.setHours(8,0,0,0);
      until=d.getTime();
    }else{
      until=Date.now()+Number(hours||2)*3600000;
    }
    ns.snoozed[key]=until;
    delete ns.dismissed[key];
    save();
    renderInteractiveNotifications();
    const timeLabel=hours==='tomorrow'?'amanhã às 08:00':`daqui a ${hours}h`;
    toast(`⏰ Aviso adiado! Lembraremos você ${timeLabel}.`);
  }

  function restoreNotification(key){
    const ns=ensureNotifState();
    delete ns.dismissed[key];
    delete ns.snoozed[key];
    save();
    renderInteractiveNotifications();
    toast('↺ Aviso restaurado para Pendentes.');
  }

  function renderInteractiveNotifications(){
    const root=q('#notificationList');
    if(!root)return;
    const {active,snoozed,done}=classifyNotifications();
    const important=active.filter(x=>x.kind!=='success').length;
    const badge=q('#notificationBadge');
    if(badge){
      badge.hidden=important===0;
      badge.textContent=important>9?'9+':String(important);
    }

    const steps=typeof dailyStepsFor==='function'?dailyStepsFor(state.settings?.dailyMinutes||180):[];
    const doneSteps=Object.values(state.dailySteps||{}).filter(Boolean).length;
    const today=typeof localDayKey==='function'?localDayKey():new Date().toISOString().slice(0,10);
    if(q('#notificationSync'))q('#notificationSync').textContent=!navigator.onLine?'Offline':cloudSession&&syncReady?'Sincronizado':cloudSession?'Sincronizando':'Somente local';
    if(q('#notificationCampaign'))q('#notificationCampaign').textContent=activeCampaign()?.name||'Nenhuma';
    if(q('#notificationStudy'))q('#notificationStudy').textContent=`${Math.floor(Number(state.studyByDay?.[today]||0)/60)} min`;
    if(q('#notificationMission'))q('#notificationMission').textContent=`${Math.round(doneSteps/Math.max(1,steps.length)*100)}%`;

    const currentList=activeNotifTab==='snoozed'?snoozed:activeNotifTab==='done'?done:active;

    root.innerHTML=`
      <div class="notifTabsBar">
        <button type="button" class="notifTabBtn ${activeNotifTab==='active'?'active':''}" data-notif-tab="active">🔔 Pendentes (${active.length})</button>
        <button type="button" class="notifTabBtn ${activeNotifTab==='snoozed'?'active':''}" data-notif-tab="snoozed">⏰ Lembrar depois (${snoozed.length})</button>
        <button type="button" class="notifTabBtn ${activeNotifTab==='done'?'active':''}" data-notif-tab="done">✓ Feitos (${done.length})</button>
      </div>

      <div class="notifBulkBar">
        <span class="small muted">
          ${activeNotifTab==='active'
            ?`${important} aviso(s) pedindo atenção · Clique fora da janela a qualquer momento para fechar`
            :activeNotifTab==='snoozed'
              ?'Avisos adiados voltam sozinhos quando o horário chegar'
              :'Avisos marcados como concluídos ou limpos'}
        </span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${activeNotifTab==='active'&&active.length?`
            <button type="button" class="ghost small" id="notifSnoozeAllBtn">⏰ Adiar todos (2h)</button>
            <button type="button" class="action small" id="notifMarkAllDoneBtn" style="width:auto">✓ Marcar todos como feitos</button>
          `:''}
          ${(activeNotifTab==='snoozed'&&snoozed.length)||(activeNotifTab==='done'&&done.length)?`
            <button type="button" class="ghost small" id="notifRestoreAllBtn">↺ Restaurar todos</button>
          `:''}
        </div>
      </div>

      ${currentList.length?currentList.map((item,idx)=>{
        const snoozeText=item.snoozedUntil?`Adiado até ${new Date(item.snoozedUntil).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:'';
        return `
          <article class="notificationItem ${escText(item.kind||'')}">
            <div class="notifMainRow">
              <div class="notificationIcon">${escText(item.icon||'•')}</div>
              <div>
                <b>${escText(item.title)}</b>
                ${snoozeText?`<span class="notifSnoozeTag">⏰ ${escText(snoozeText)}</span>`:''}
                <p style="margin:3px 0 0">${escText(item.text)}</p>
              </div>
            </div>
            <div class="notifActionsRow">
              ${item.duelId?`
                <button type="button" class="action small" style="width:auto" data-notif-accept-duel="${escText(item.duelId)}">⚔️ Aceitar e Jogar</button>
                <button type="button" class="ghost danger small" style="width:auto" data-notif-decline-duel="${escText(item.duelId)}">❌ Recusar</button>
              `:item.retryDocId?`<button type="button" class="action small" style="width:auto" data-notif-retry-doc="${escText(item.retryDocId)}">${escText(item.actionLabel||'Analisar')}</button>`:item.view?`<button type="button" class="action small" style="width:auto" data-notification-view="${escText(item.view)}">${escText(item.actionLabel||'Abrir')}</button>`:''}
              ${activeNotifTab==='active'?`
                <button type="button" class="ghost small" data-notif-done="${idx}">✓ Feito</button>
                <button type="button" class="ghost small" data-notif-snooze2h="${idx}">⏰ +2h</button>
                <button type="button" class="ghost small" data-notif-tomorrow="${idx}">🌙 Amanhã</button>
              `:`
                <button type="button" class="ghost small" data-notif-restore="${escText(item.stateKey)}">↺ Voltar para Pendentes</button>
              `}
            </div>
          </article>
        `;
      }).join(''):`
        <div class="empty">
          ${activeNotifTab==='active'
            ?'🎉 Tudo limpo! Nenhuma notificação pendente no momento.'
            :activeNotifTab==='snoozed'
              ?'Nenhum aviso adiado para mais tarde.'
              :'Nenhum aviso marcado como feito ainda.'}
        </div>
      `}

      <div style="margin-top:10px;display:flex;justify-content:flex-end">
        <button type="button" class="ghost" id="closeNotificationsBottomBtn" style="width:100%">Fechar painel de notificações</button>
      </div>
    `;

    qa('[data-notif-tab]').forEach(btn=>{
      btn.onclick=()=>{
        activeNotifTab=btn.dataset.notifTab;
        renderInteractiveNotifications();
      };
    });

    qa('[data-notification-view]').forEach(btn=>{
      btn.onclick=()=>openAppView(btn.dataset.notificationView);
    });
    qa('[data-notif-accept-duel]').forEach(btn=>{
      btn.onclick=()=>acceptDuelChallengeNow(btn.dataset.notifAcceptDuel);
    });
    qa('[data-notif-decline-duel]').forEach(btn=>{
      btn.onclick=()=>declineDuelChallenge(btn.dataset.notifDeclineDuel,false);
    });

    qa('[data-notif-retry-doc]').forEach(btn=>{
      btn.onclick=()=>{
        const docId=btn.dataset.notifRetryDoc;
        q('#notificationDialog')?.close();
        openView('library');
        if(typeof processEditalDocument==='function')processEditalDocument(docId);
      };
    });

    qa('[data-notif-done]').forEach(btn=>{
      btn.onclick=()=>{
        const item=currentList[Number(btn.dataset.notifDone)];
        if(item)markNotificationDone(item);
      };
    });

    qa('[data-notif-snooze2h]').forEach(btn=>{
      btn.onclick=()=>{
        const item=currentList[Number(btn.dataset.notifSnooze2h)];
        if(item)snoozeNotification(item,2);
      };
    });

    qa('[data-notif-tomorrow]').forEach(btn=>{
      btn.onclick=()=>{
        const item=currentList[Number(btn.dataset.notifTomorrow)];
        if(item)snoozeNotification(item,'tomorrow');
      };
    });

    qa('[data-notif-restore]').forEach(btn=>{
      btn.onclick=()=>restoreNotification(btn.dataset.notifRestore);
    });

    if(q('#notifMarkAllDoneBtn'))q('#notifMarkAllDoneBtn').onclick=()=>{
      const ns=ensureNotifState();
      const nowIso=new Date().toISOString();
      active.forEach(item=>{
        ns.dismissed[item.stateKey||item.id]=nowIso;
        ns.dismissed[item.id]=nowIso;
        if(item.isCoverageWarning&&item.docId){
          const doc=(cloudDocuments||[]).find(d=>String(d.id)===String(item.docId));
          if(doc&&doc.metadata?.coverage)doc.metadata.coverage.needs_review=false;
        }
      });
      save();
      renderInteractiveNotifications();
      toast('✓ Todas as notificações foram marcadas como feitas!');
    };

    if(q('#notifSnoozeAllBtn'))q('#notifSnoozeAllBtn').onclick=()=>{
      const ns=ensureNotifState();
      const until=Date.now()+2*3600000;
      active.forEach(item=>{
        ns.snoozed[item.stateKey||item.id]=until;
      });
      save();
      renderInteractiveNotifications();
      toast('⏰ Todos os avisos foram adiados por 2 horas!');
    };

    if(q('#notifRestoreAllBtn'))q('#notifRestoreAllBtn').onclick=()=>{
      const ns=ensureNotifState();
      if(activeNotifTab==='snoozed')ns.snoozed={};
      else ns.dismissed={};
      save();
      activeNotifTab='active';
      renderInteractiveNotifications();
      toast('↺ Avisos restaurados para Pendentes.');
    };

    if(q('#closeNotificationsBottomBtn'))q('#closeNotificationsBottomBtn').onclick=()=>{
      q('#notificationDialog')?.close();
    };
  }

  function enableBackdropClickToCloseDialogs(){
    document.addEventListener('mousedown',e=>{
      const dlg=e.target;
      if(!dlg||dlg.tagName!=='DIALOG'||!dlg.open)return;
      // Verifica se o clique ocorreu fora da caixa interna do modal (no backdrop escuro)
      const rect=dlg.getBoundingClientRect();
      const clickedInside=(
        e.clientX>=rect.left&&
        e.clientX<=rect.right&&
        e.clientY>=rect.top&&
        e.clientY<=rect.bottom
      );
      if(!clickedInside){
        if(dlg.id==='passwordConfirmDialog'&&typeof cancelPasswordConfirmation==='function'){
          cancelPasswordConfirmation();
        }else{
          dlg.close();
        }
      }
    });
  }

  function ensureLocalDbBars(){
    const targets=[
      {sel:'#study',id:'localDbBar_study'},
      {sel:'#report',id:'localDbBar_report'},
      {sel:'#library',id:'localDbBar_library'}
    ];
    for(const t of targets){
      const view=q(t.sel);
      if(!view||q(`#${t.id}`))continue;
      const head=view.querySelector('.sectionHead');
      const html=`<div class="localDbBar" id="${t.id}"><div class="localDbStatus"><span class="localDbDot"></span><span data-local-db-text="1">⚡ <b>Banco Local Ativo:</b> abertura instantânea de abas no aparelho</span></div><button type="button" class="ghost small" data-download-local-db="1">📥 Baixar / Atualizar Banco Local</button></div>`;
      if(head)head.insertAdjacentHTML('afterend',html);
      else view.insertAdjacentHTML('afterbegin',html);
    }
    const menuGrid=q('#moreDialog .menuGrid');
    if(menuGrid&&!q('#menuLocalDbDownload')){
      menuGrid.insertAdjacentHTML('beforeend','<button class="menuItem" id="menuLocalDbDownload">⚡<span>Baixar Banco Local</span></button>');
      q('#menuLocalDbDownload').onclick=()=>{q('#moreDialog')?.close();window.downloadFullDatabaseForLocalUse?.(true)};
    }
    qa('[data-download-local-db]').forEach(btn=>{
      if(!btn.dataset.boundLocalDb){
        btn.dataset.boundLocalDb='1';
        btn.onclick=()=>window.downloadFullDatabaseForLocalUse?.(true);
      }
    });
    window.updateLocalDbBadgeUI?.();
  }
  window.updateLocalDbBadgeUI=function(){
    const sLen=(typeof ALL_SUMMARIES!=='undefined'&&Array.isArray(ALL_SUMMARIES))?ALL_SUMMARIES.length:0;
    const qLen=(typeof ALL_QUESTIONS!=='undefined'&&Array.isArray(ALL_QUESTIONS))?ALL_QUESTIONS.length:0;
    const fLen=(typeof ALL_FLASHCARDS!=='undefined'&&Array.isArray(ALL_FLASHCARDS))?ALL_FLASHCARDS.length:0;
    const dLen=(typeof cloudDocuments!=='undefined'&&Array.isArray(cloudDocuments))?cloudDocuments.length:0;
    const label=(sLen||qLen||dLen)
      ?`⚡ <b>Banco Local Ativo no Aparelho:</b> ${sLen} resumos · ${qLen} questões · ${fLen} flashcards · ${dLen} PDFs (abertura instantânea)`
      :`⚡ <b>Modo Banco Local:</b> clique ao lado para baixar seus resumos e questões para uso instantâneo sem travamentos`;
    qa('[data-local-db-text]').forEach(el=>{el.innerHTML=label});
  };

  function runV77ViewEnhancements(id,force=false){
    window._v77RenderedViews=window._v77RenderedViews||new Set();
    ensureLocalDbBars();
    if(!force&&window._v77RenderedViews.has(id)){
      if(id==='ranking')loadHuntersLeaderboard();
      else if(id==='duel')loadDuelArenaHub();
      return;
    }
    window._v77RenderedViews.add(id);
    if(id==='today'){decorateDailyStepProgressLabels();updateTodayCommand();ensureTafAndRankingShortcuts()}
    else if(id==='map'){renderReverseSchedule();decorateEditalIncidenceBadges()}
    else if(id==='study'){enhanceFlashcardsSpacedRepetition();updateFlashcardSpacedStats();window.updateLocalDbBadgeUI?.()}
    else if(id==='library'){renderCommunityCoopBanner();window.updateLocalDbBadgeUI?.();syncCommunityLibraryForActivePortal(false)}
    else if(id==='essay'){enhanceEssayCenter();enhanceTypedEssayOption()}
    else if(id==='review'){enhanceReviewCenter()}
    else if(id==='report'){window.updateLocalDbBadgeUI?.()}
    else if(id==='taf'){renderTafPanel()}
    else if(id==='ranking'){renderHuntersLeaderboard();loadHuntersLeaderboard()}
    else if(id==='duel'){renderDuelArena();loadDuelArenaHub()}
    enhanceSoloLevelingVisuals();
  }

  const baseOpenView=openView;
  openView=function(id){
    baseOpenView(id);
    try{sessionStorage.setItem(viewKey,id)}catch{}
    runV77ViewEnhancements(id,false);
  };
  const baseTickClock=typeof tickClock==='function'?tickClock:null;
  if(baseTickClock){
    window.tickClock=function(){
      const wasEnding=typeof timerLeft==='number'&&timerLeft===1&&Boolean(timerRun);
      baseTickClock();
      if(wasEnding)playCompletionChime();
    };
  }
  const baseRender=render;
  render=function(){
    syncHunterStatsSnapshot();
    baseRender();
    const activeId=document.querySelector('.view.active')?.id||'today';
    if(!window._v77InitialBootDone){
      window._v77InitialBootDone=true;
    }
    runV77ViewEnhancements(activeId,true);
  };
  const baseRenderReport=renderReport;
  renderReport=function(){baseRenderReport();populateTopicFilter();updateQuestionPool();renderPerformanceChart();renderExamBankHub()};

  window.renderNotifications=renderNotifications=renderInteractiveNotifications;if(q('#notificationBtn'))q('#notificationBtn').onclick=()=>{renderInteractiveNotifications();q('#notificationDialog').showModal()};enableBackdropClickToCloseDialogs();enhanceSoloLevelingVisuals();hookAutomaticDailyStepTracking();addTodayCommand();ensureReverseSchedulePanel();bindQuestionCenter();updateTodayCommand();decorateDailyStepProgressLabels();renderReverseSchedule();
  qa('[data-menu-view]').forEach(button=>button.onclick=()=>{q('#moreDialog')?.close();openView(button.dataset.menuView)});
  function enhanceSoloLevelingVisuals(){
    // 1) Hero Card na aba Hoje com visual Holográfico Solo Leveling
    const hero=q('section.hero');
    if(hero){
      hero.classList.add('slSystemHero');
      if(!q('#slHeroHudBar')){
        const campaignName=(typeof activeCampaign==='function'&&activeCampaign()?.name)||'PMPE — Soldado';
        hero.insertAdjacentHTML('afterbegin',`
          <div class="slHeroHudBar" id="slHeroHudBar">
            <span class="slSystemBadge"><i class="slPulseDot"></i> SYSTEM STATUS · CAÇADOR ATIVO</span>
            <span class="slPortalBadge" id="slHeroPortalTag">◈ ${escText(campaignName)}</span>
          </div>
        `);
      }else{
        const portalTag=q('#slHeroPortalTag');
        if(portalTag&&typeof activeCampaign==='function'){
          portalTag.textContent=`◈ ${activeCampaign()?.name||'PMPE — Soldado'}`;
        }
      }
    }

    // 2) Banner Masmorra Solo Leveling na Trilha de Aprendizagem (#learning)
    const learningView=q('#learning');
    if(learningView){
      let trailBanner=q('#slTrailHeroBanner');
      if(!trailBanner){
        const head=learningView.querySelector('.sectionHead');
        if(head){
          head.insertAdjacentHTML('afterend',`
            <div class="slBannerCard slTrailBanner" id="slTrailHeroBanner">
              <div class="slBannerArtWrap">
                <img src="login-banner.jpg" alt="Sistema Solo Leveling" class="slBannerArtImg" loading="lazy">
              </div>
              <div class="slBannerContent">
                <div class="slSystemBadge">⚡ DUNGEON TRILHA · DISCIPLINAS DO PORTAL</div>
                <h3>Evolua por Disciplina com seus Materiais, IA e Simulados</h3>
                <p class="small muted">O edital define as disciplinas do seu portal, e cada fase abaixo é gerada exclusivamente a partir dos seus materiais de estudo, questões criadas pela IA e simulados/provas.</p>
                <div class="slSourcePills" id="slTrailSourceStats"></div>
              </div>
            </div>
          `);
          trailBanner=q('#slTrailHeroBanner');
        }
      }
      const statsEl=q('#slTrailSourceStats');
      if(statsEl){
        ensureNativeQuestionBankLoaded();
        const subj=typeof selectedLearningSubject!=='undefined'?selectedLearningSubject:'';
        const sKey=typeof subjectKey==='function'?subjectKey(subj):'';
        const matCount=(ALL_SUMMARIES||[]).filter(s=>!sKey||subjectKey(s.category)===sKey).length;
        const subjQs=(ALL_QUESTIONS||[]).filter(item=>!sKey||subjectKey(learningCategory(item.subject))===sKey);
        const aiQCount=subjQs.filter(item=>normalizedOrigin(item)==='autoral').length;
        const simQCount=subjQs.filter(item=>normalizedOrigin(item)!=='autoral').length;
        const aocpCount=subjQs.filter(item=>questionMatchesBoardFilter(item,'Instituto AOCP')).length;
        statsEl.innerHTML=`
          <span class="slStatChip">📚 <b>${matCount}</b> resumo(s) de material</span>
          <span class="slStatChip">🎯 <b>${simQCount}</b> de provas/bancas (${aocpCount} AOCP)</span>
          <span class="slStatChip">✨ <b>${aiQCount}</b> questão(ões) IA</span>
        `;
      }
      const rail=q('#disciplineRail');
      if(rail&&!q('#trailControlToolbar')){
        const savedTrailBoard=localStorage.getItem('jornada-trail-board-v118')||'all';
        window._selectedTrailBoard=savedTrailBoard;
        rail.insertAdjacentHTML('beforebegin',`
          <div class="trailControlToolbar" id="trailControlToolbar">
            <label class="trailBoardField">
              <span>🎯 Banca prioritária na Trilha:</span>
              <select id="trailBoardFilter">
                <option value="all">Todas as Bancas (Completa)</option>
                <option value="Instituto AOCP">Instituto AOCP (PMPE / CBMPE)</option>
                <option value="Cebraspe">Cebraspe (CESPE)</option>
                <option value="FGV Conhecimento">FGV Conhecimento</option>
                <option value="UPENET/IAUPE">UPENET / IAUPE</option>
                <option value="IBFC">IBFC</option>
              </select>
            </label>
            <div class="trailHeartsBox">
              <span id="trailHeartsStatusBadge">♥♥♥ 3/3 vidas</span>
              <button type="button" class="ghost small" id="restoreTrailHeartsToolbarBtn">❤️ Restaurar 3 Vidas</button>
            </div>
          </div>
        `);
        const tbSel=q('#trailBoardFilter');
        if(tbSel){
          tbSel.value=savedTrailBoard;
          tbSel.onchange=()=>{
            window._selectedTrailBoard=tbSel.value||'all';
            try{localStorage.setItem('jornada-trail-board-v118',window._selectedTrailBoard)}catch{}
            if(typeof renderLearning==='function')renderLearning();
            enhanceSoloLevelingVisuals();
          };
        }
        const rhBtn=q('#restoreTrailHeartsToolbarBtn');
        if(rhBtn){
          rhBtn.onclick=()=>{
            if(typeof window.restoreTrailHeartsNow==='function')window.restoreTrailHeartsNow();
            enhanceSoloLevelingVisuals();
          };
        }
      }
      const heartsBadge=q('#trailHeartsStatusBadge');
      if(heartsBadge&&typeof availableTrailHearts==='function'){
        const h=availableTrailHearts();
        heartsBadge.textContent=`${'♥'.repeat(Math.max(0,h))}${'♡'.repeat(Math.max(0,3-h))} ${h}/3 vidas`;
      }
    }

    // 3) Banner "Chefes das Bancas (AOCP · CEBRASPE · FGV · IDECAN)" na Central de Questões (#report)
    const reportView=q('#report');
    if(reportView&&!q('#slBossesRaidBanner')){
      const anchor=q('#examBankHub')||reportView.querySelector('.sectionHead');
      if(anchor){
        const bannerHtml=`
          <div class="slBannerCard slBossesBanner" id="slBossesRaidBanner">
            <div class="slBossesPosterWrap">
              <img src="bancas-boss-banner.jpg" alt="Chefes das Bancas: AOCP, Cebraspe, FGV e IDECAN" class="slBossesPosterImg" loading="lazy">
            </div>
            <div class="slBannerContent">
              <div class="slSystemBadge">👑 MASMORRA DAS BANCAS · BOSS RAID</div>
              <h3>Enfrente os Monstros das Bancas Examinadoras</h3>
              <p class="small muted">Toque em um Chefe abaixo para ativar o <b>Modo Boss (Nível Difícil)</b> com o padrão real de cobrança e pegadinhas daquela banca:</p>
              <div class="slBossGrid">
                <button type="button" class="slBossBtn" data-sl-boss-board="Cebraspe">
                  <span class="slBossRank">RANK S · DIFÍCIL</span>
                  <b>CEBRASPE</b>
                  <small>Jurisprudência STF/STJ & Casos</small>
                </button>
                <button type="button" class="slBossBtn" data-sl-boss-board="FGV Conhecimento">
                  <span class="slBossRank">RANK S · DIFÍCIL</span>
                  <b>FGV</b>
                  <small>Casos Práticos Narrativos Longos</small>
                </button>
                <button type="button" class="slBossBtn" data-sl-boss-board="Instituto AOCP">
                  <span class="slBossRank">RANK A · DIFÍCIL</span>
                  <b>AOCP</b>
                  <small>Letra da Lei, Prazos & Exceções</small>
                </button>
                <button type="button" class="slBossBtn" data-sl-boss-board="IDECAN">
                  <span class="slBossRank">RANK A · DIFÍCIL</span>
                  <b>IDECAN</b>
                  <small>Cobrança Técnica & Doutrinária</small>
                </button>
              </div>
              <div class="slActiveBossPanel" id="slActiveBossPanel" hidden></div>
            </div>
          </div>
        `;
        if(anchor.id==='examBankHub')anchor.insertAdjacentHTML('beforebegin',bannerHtml);
        else anchor.insertAdjacentHTML('afterend',bannerHtml);

        const activateBossBoard=(board)=>{
          const profile=BOARD_BOSS_PROFILES[board]||BOARD_BOSS_PROFILES['Instituto AOCP'];
          qa('[data-sl-boss-board]').forEach(b=>b.classList.toggle('active',b.dataset.slBossBoard===board));
          ensureExamBankHub();
          populateExamHubSelects();
          const boardSel=q('#genBankBoard');
          if(boardSel){
            if(![...boardSel.options].some(o=>o.value===board)){
              boardSel.insertAdjacentHTML('beforeend',`<option value="${escText(board)}">${escText(board)}</option>`);
            }
            boardSel.value=board;
          }
          const diffSel=q('#genBankDifficulty');
          if(diffSel)diffSel.value=profile.difficulty||'dificil';
          const scoreSel=q('#simuladoScoringMode');
          if(scoreSel)scoreSel.value=profile.scoring||'standard';

          const currentSubj=q('#questionSubject')?.value||'all';
          const shortB=board.replace('Conhecimento','').replace('Instituto ','').trim();
          const boardRegex=new RegExp(shortB,'i');
          const matchingBoardQs=(ALL_QUESTIONS||[]).filter(item=>(currentSubj==='all'||learningCategory(item.subject)===currentSubj)&&boardRegex.test(`${item.board||''} ${item.explanation||''}`));
          const hardPool=(ALL_QUESTIONS||[]).filter(item=>(currentSubj==='all'||learningCategory(item.subject)===currentSubj)&&['dificil','medio'].includes(normalizedDifficulty(item)));
          const raidPool=matchingBoardQs.length>=3?matchingBoardQs:(hardPool.length?hardPool:(ALL_QUESTIONS||[]));

          const panel=q('#slActiveBossPanel');
          if(panel){
            panel.hidden=false;
            panel.innerHTML=`
              <div class="slBossStatusHead">
                <div>
                  <span class="slBossRank">${escText(profile.rank)} · MODO BOSS ATIVO</span>
                  <h4>Chefe ${escText(board)} selecionado</h4>
                </div>
                <span class="tag">${matchingBoardQs.length} questão(ões) ${escText(shortB)} no banco</span>
              </div>
              <p class="small" style="margin:6px 0 10px;color:#e2e8f0;line-height:1.45"><b>O que muda nesta banca:</b> ${escText(profile.summary)}</p>
              <div class="slBossActionRow">
                <button type="button" class="action small" id="slStartImmediateRaidBtn">⚔️ Enfrentar Agora (${Math.min(8,Math.max(5,raidPool.length))} Questões Difíceis · +300 XP)</button>
                <button type="button" class="ghost small" id="slGenerateBossPackNowBtn">✨ Gerar Caderno Inédito Padrão ${escText(shortB)} (IA)</button>
              </div>
            `;
            q('#slStartImmediateRaidBtn').onclick=()=>{
              if(!raidPool.length){
                switchExamHubTab('generator');
                q('#generateBoardPackBtn')?.click();
                return;
              }
              const sortedHard=[...raidPool].sort((a,b)=>{
                const da=normalizedDifficulty(a)==='dificil'?0:normalizedDifficulty(a)==='medio'?1:2;
                const db=normalizedDifficulty(b)==='dificil'?0:normalizedDifficulty(b)==='medio'?1:2;
                return da-db||(Math.random()-0.5);
              });
              const chosen=sortedHard.slice(0,Math.min(8,sortedHard.length)).map(prepareQuestion);
              activeQuestions={
                mode:'boss',
                subject:currentSubj==='all'?`Raid ${shortB}`:currentSubj,
                questions:chosen,
                current:0,
                correct:0,
                streak:0,
                level:3,
                answered:false
              };
              if(q('#questionDialogTitle'))q('#questionDialogTitle').textContent=`👑 Boss Raid · ${board} (Nível Difícil)`;
              q('#questionDialog')?.showModal();
              showQuestion();
              toast(`⚔️ Boss Raid contra ${board} iniciado! Alcance 70%+ para vencer e ganhar +300 XP!`);
            };
            q('#slGenerateBossPackNowBtn').onclick=()=>{
              switchExamHubTab('generator');
              if(q('#genBankBoard'))q('#genBankBoard').value=board;
              if(q('#genBankDifficulty'))q('#genBankDifficulty').value='dificil';
              q('#examBankHub')?.scrollIntoView({behavior:'smooth',block:'center'});
              handleGenerateBoardPack();
            };
          }
        };

        qa('[data-sl-boss-board]').forEach(btn=>{
          btn.onclick=()=>activateBossBoard(btn.dataset.slBossBoard);
        });
      }
    }
  }

  function realignStudyDisciplinesWithLibrary(){
    let changed=false;
    if(typeof window.isInvalidTrailSubject==='function'){
      const beforeSum=(ALL_SUMMARIES||[]).length;
      ALL_SUMMARIES=(ALL_SUMMARIES||[]).filter(s=>{
        const doc=Array.isArray(cloudDocuments)?cloudDocuments.find(d=>String(d.id)===String(s.documentId)):null;
        return !window.isInvalidTrailSubject(s.category,s.title,s.source,doc);
      });
      if(ALL_SUMMARIES.length!==beforeSum)changed=true;

      const beforeCards=(ALL_FLASHCARDS||[]).length;
      ALL_FLASHCARDS=(ALL_FLASHCARDS||[]).filter(c=>!window.isInvalidTrailSubject(c?.[0],c?.[1])&&(typeof window.isValidFlashcardItem!=='function'||window.isValidFlashcardItem(c?.[1],c?.[2])));
      if(ALL_FLASHCARDS.length!==beforeCards)changed=true;

      const beforeQs=(ALL_QUESTIONS||[]).length;
      ALL_QUESTIONS=(ALL_QUESTIONS||[]).filter(qItem=>{
        const doc=qItem.documentId&&Array.isArray(cloudDocuments)?cloudDocuments.find(d=>String(d.id)===String(qItem.documentId)):null;
        return !window.isInvalidTrailSubject(qItem.subject,qItem.topic,'',doc);
      });
      if(ALL_QUESTIONS.length!==beforeQs)changed=true;
    }

    if(Array.isArray(cloudDocuments)&&cloudDocuments.length&&typeof window.resolveDocumentDiscipline==='function'){
      for(const s of (ALL_SUMMARIES||[])){
        const doc=cloudDocuments.find(d=>String(d.id)===String(s.documentId));
        if(doc){
          const nextCat=window.resolveDocumentDiscipline(doc,s.category,`${doc.title} ${s.title}`);
          if(nextCat&&!window.isInvalidTrailSubject?.(nextCat,s.title,doc.title,doc)&&nextCat!==s.category){s.category=nextCat;changed=true}
          const stdDocTitle=typeof window.standardizeDocumentTitle==='function'?window.standardizeDocumentTitle(doc.title):doc.title;
          if(!s.is_community&&stdDocTitle&&s.source!==stdDocTitle){s.source=stdDocTitle;changed=true}
        }
      }
      for(const qItem of (ALL_QUESTIONS||[])){
        const doc=qItem.documentId?cloudDocuments.find(d=>String(d.id)===String(qItem.documentId)):null;
        const nextCat=window.resolveDocumentDiscipline(doc,qItem.subject,`${doc?.title||''} ${qItem.topic||''}`);
        if(nextCat&&!window.isInvalidTrailSubject?.(nextCat,qItem.topic,'',doc)&&nextCat!==qItem.subject){qItem.subject=nextCat;changed=true}
      }
    }
    for(const card of (ALL_FLASHCARDS||[])){
      const nextCat=canonicalSubjectName(card[0],card[1]||'');
      if(nextCat&&nextCat!==card[0]){card[0]=nextCat;changed=true}
    }

    const nextSubjects=typeof window.computeValidLearningSubjects==='function'
      ?window.computeValidLearningSubjects()
      :[...new Set([...ALL_SUMMARIES.map(x=>x.category),...ALL_FLASHCARDS.map(x=>x[0]),...ALL_QUESTIONS.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(changed||JSON.stringify(nextSubjects)!==JSON.stringify(LEARNING_SUBJECTS)){
      LEARNING_SUBJECTS=nextSubjects;
      window.persistToLocalDatabase?.(state?.activeCampaignId);
      window.markViewsDirty?.('study','learning','report');
      const actId=document.querySelector('.view.active')?.id||'today';
      if(actId==='study'&&typeof renderStudy==='function')renderStudy();
      else if(actId==='learning'&&typeof renderLearning==='function')renderLearning();
      else if(actId==='report'&&typeof renderQuestionFilters==='function')renderQuestionFilters();
    }
    window.updateLocalDbBadgeUI?.();
    enhanceSoloLevelingVisuals();
  }
  const baseLoadCloudDocsForSync=typeof loadCloudDocuments==='function'?loadCloudDocuments:null;
  if(baseLoadCloudDocsForSync){
    loadCloudDocuments=async function(){
      const res=await baseLoadCloudDocsForSync();
      await syncCommunityLibraryForActivePortal(false);
      realignStudyDisciplinesWithLibrary();
      return res;
    };
  }
  const baseLoadGenForComm=typeof loadGeneratedContent==='function'?loadGeneratedContent:null;
  if(baseLoadGenForComm){
    loadGeneratedContent=async function(){
      const res=await baseLoadGenForComm();
      await syncCommunityLibraryForActivePortal(false);
      realignStudyDisciplinesWithLibrary();
      return res;
    };
  }

  // 19. Chat Interno da Guilda de Caçadores & Lobby Interativo em Tempo Real (WebSocket + Optimistic UI + Atalhos Solo Leveling)
  const guildChatState={
    channel:'all',
    sendChannel:'geral',
    messages:[],
    replyTo:null,
    loading:false,
    sqlMissing:false,
    lastFingerprint:'',
    ws:null,
    wsConnected:false,
    lastSeenTime:Number(localStorage.getItem('jornada-guild-last-seen-v108')||0)
  };

  function updateGuildUnreadBadge(){
    const badge=q('#floatingGuildUnreadBadge');
    const btn=q('#floatingGuildChatBtn');
    const dlgOpen=Boolean(q('#guildChatDialog')?.open);
    const onDuelTab=Boolean(q('#duel')?.classList.contains('active'));
    if(btn){
      const signedOrGuest=Boolean(cloudSession)||localStorage.getItem('pmpe-guest-mode')==='1';
      btn.hidden=!signedOrGuest||dlgOpen||onDuelTab;
    }
    if(!badge)return;
    const myId=cloudSession?.user?.id||'';
    if((dlgOpen||onDuelTab)&&guildChatState.messages.length){
      const latest=Math.max(...guildChatState.messages.map(m=>Date.parse(m.created_at||'')||0));
      if(latest>guildChatState.lastSeenTime){
        guildChatState.lastSeenTime=latest;
        try{localStorage.setItem('jornada-guild-last-seen-v108',String(latest))}catch{}
      }
      badge.hidden=true;
      badge.textContent='0';
      return;
    }
    const unread=(guildChatState.messages||[]).filter(m=>{
      const ts=Date.parse(m.created_at||'')||0;
      return String(m.user_id)!==String(myId)&&ts>guildChatState.lastSeenTime;
    }).length;
    badge.hidden=unread<=0;
    badge.textContent=unread>9?'9+':String(unread);
  }

  function computeMessagesFingerprint(list){
    if(!Array.isArray(list)||!list.length)return'0';
    return `${list.length}:${list[0]?.id||''}:${list[list.length-1]?.id||''}`;
  }

  function broadcastGuildRealtimePing(kind='chat'){
    try{
      if(guildChatState.ws&&guildChatState.ws.readyState===1){
        guildChatState.ws.send(JSON.stringify({
          topic:'realtime:guild-lobby',
          event:'broadcast',
          payload:{type:'broadcast',event:kind,payload:{ts:Date.now()}},
          ref:String(Date.now())
        }));
      }
    }catch{}
  }

  function connectGuildRealtimeSocket(){
    if(guildChatState.ws||!cloudSession||!navigator.onLine||typeof WebSocket==='undefined')return;
    try{
      const wsUrl=SUPABASE_URL.replace(/^http/i,'ws')+`/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`;
      const ws=new WebSocket(wsUrl);
      guildChatState.ws=ws;
      ws.onopen=()=>{
        guildChatState.wsConnected=true;
        clearInterval(guildChatState.heartbeat);
        // O Realtime encerra conexões sem heartbeat; o protocolo Phoenix exige um a cada ~30 s.
        guildChatState.heartbeat=setInterval(()=>{try{if(ws.readyState===1)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(Date.now())}))}catch{}},25000);
        const token=cloudSession?.access_token||SUPABASE_KEY;
        ws.send(JSON.stringify({
          topic:'realtime:guild-lobby',
          event:'phx_join',
          payload:{config:{broadcast:{self:false},presence:{key:''}},access_token:token},
          ref:'1'
        }));
        ws.send(JSON.stringify({
          topic:'realtime:public:hunter_guild_messages',
          event:'phx_join',
          payload:{config:{postgres_changes:[{event:'*',schema:'public',table:'hunter_guild_messages'}]},access_token:token},
          ref:'2'
        }));
        ws.send(JSON.stringify({
          topic:'realtime:public:hunter_duels',
          event:'phx_join',
          payload:{config:{postgres_changes:[{event:'*',schema:'public',table:'hunter_duels'}]},access_token:token},
          ref:'3'
        }));
      };
      ws.onmessage=ev=>{
        try{
          const msg=JSON.parse(ev.data||'{}');
          if(msg.event==='postgres_changes'||msg.event==='broadcast'){
            if(String(msg.topic||'').includes('hunter_duels')||(msg.payload?.event==='duel')){
              if(!activeDuelSession)loadDuelArenaHub(true);
            }else{
              loadGuildChatMessages(true);
            }
          }
        }catch{}
      };
      ws.onclose=()=>{
        clearInterval(guildChatState.heartbeat);
        guildChatState.ws=null;
        guildChatState.wsConnected=false;
      };
      ws.onerror=()=>{
        try{ws.close()}catch{}
        clearInterval(guildChatState.heartbeat);
        guildChatState.ws=null;
        guildChatState.wsConnected=false;
      };
    }catch{
      guildChatState.ws=null;
    }
  }

  async function loadGuildChatMessages(silent=false){
    if(guildChatState.loading||!cloudSession||!navigator.onLine)return;
    guildChatState.loading=true;
    try{
      connectGuildRealtimeSocket();
      const res=await cloudFetch('rpc/get_guild_chat_messages',{
        method:'POST',
        body:JSON.stringify({p_channel:'all',p_limit:90})
      });
      const data=await res.json().catch(()=>null);
      if(res.ok&&data&&Array.isArray(data.messages)){
        guildChatState.sqlMissing=false;
        const nextFp=computeMessagesFingerprint(data.messages);
        const changed=nextFp!==guildChatState.lastFingerprint;
        guildChatState.messages=data.messages;
        guildChatState.lastFingerprint=nextFp;
        if(!guildChatState.lastSeenTime&&data.messages.length){
          const latest=Math.max(...data.messages.map(m=>Date.parse(m.created_at||'')||0));
          guildChatState.lastSeenTime=latest;
          try{localStorage.setItem('jornada-guild-last-seen-v108',String(latest))}catch{}
        }
        updateGuildUnreadBadge();
        if(!silent||changed){
          if(q('#guildChatDialog')?.open)renderGuildChatWidget('#guildChatDialogRoot','modal',true);
          if(q('#duel')?.classList.contains('active')&&q('#duelLobbyChatSection'))renderGuildChatWidget('#duelLobbyChatSection','arena',true);
        }
      }
    }catch(err){
      const msg=String(err?.message||err||'');
      if(/get_guild_chat_messages|Could not find the function|PGRST202/i.test(msg)){
        guildChatState.sqlMissing=true;
      }
    }finally{
      guildChatState.loading=false;
    }
  }

  async function sendGuildChatMessageFromUI(prefix='modal',overrideText=null,overrideChannel=null){
    const input=q(`#guildChatInput_${prefix}`);
    const chanSel=q(`#guildChatSendChannel_${prefix}`);
    const btn=q(`#guildChatSendBtn_${prefix}`);
    const text=String(overrideText!==null?overrideText:(input?.value||'')).trim();
    if(!text)return toast('Digite sua mensagem para enviar ao Lobby da Guilda.');
    if(!cloudSession)return toast('Entre na sua conta para conversar no Chat da Guilda.');
    const channel=overrideChannel||chanSel?.value||guildChatState.sendChannel||(guildChatState.channel==='all'?'geral':guildChatState.channel);
    guildChatState.sendChannel=channel;
    const replySnapshot=guildChatState.replyTo;
    if(overrideText===null&&input)input.value='';
    guildChatState.replyTo=null;

    // Optimistic UI: adiciona a mensagem instantaneamente na tela (<15ms)
    const me=typeof localHunterRow==='function'?localHunterRow():{name:'Caçador',role:'PMPE',xp:0};
    const tempId=`temp-${Date.now()}`;
    guildChatState.messages.push({
      id:tempId,
      user_id:cloudSession?.user?.id||'me',
      is_me:true,
      author_name:me.name||'Caçador',
      author_role:me.role||'PMPE',
      author_xp:me.xp||0,
      channel,
      message:text,
      reply_to_id:replySnapshot?.id||null,
      reply_author:replySnapshot?.author_name||null,
      reply_excerpt:replySnapshot?String(replySnapshot.message||'').slice(0,120):null,
      created_at:new Date().toISOString(),
      optimistic:true
    });
    if(q('#guildChatDialog')?.open)renderGuildChatWidget('#guildChatDialogRoot','modal',true);
    if(q('#duel')?.classList.contains('active')&&q('#duelLobbyChatSection'))renderGuildChatWidget('#duelLobbyChatSection','arena',true);

    if(btn){btn.disabled=true}
    try{
      const res=await cloudFetch('rpc/send_guild_chat_message',{
        method:'POST',
        body:JSON.stringify({
          p_message:text,
          p_channel:channel,
          p_reply_to_id:replySnapshot?.id||null
        })
      });
      const created=await res.json().catch(()=>null);
      if(!res.ok){const raw=String(created?.message||'');throw new Error(/rate_limited/.test(raw)?'Você está enviando mensagens rápido demais. Aguarde um instante.':/duplicate_message/.test(raw)?'Você acabou de enviar essa mesma mensagem.':/empty_message/.test(raw)?'Escreva uma mensagem antes de enviar.':(raw||'Não foi possível enviar a mensagem. Execute o SQL v98 atualizado no Supabase.'))}
      broadcastGuildRealtimePing('chat');
      await loadGuildChatMessages(false);
    }catch(err){
      guildChatState.messages=guildChatState.messages.filter(m=>m.id!==tempId);
      if(q('#guildChatDialog')?.open)renderGuildChatWidget('#guildChatDialogRoot','modal',true);
      if(q('#duelLobbyChatSection'))renderGuildChatWidget('#duelLobbyChatSection','arena',true);
      toast(err.message||'Erro ao enviar mensagem.');
    }finally{
      if(btn){btn.disabled=false}
    }
  }

  async function postSystemDuelNoticeToGuild(messageText){
    if(!cloudSession||!messageText)return;
    try{
      await cloudFetch('rpc/send_guild_chat_message',{
        method:'POST',
        body:JSON.stringify({p_message:messageText,p_channel:'duelos',p_reply_to_id:null})
      });
      broadcastGuildRealtimePing('duel');
      await loadGuildChatMessages(true);
    }catch{}
  }

  async function deleteGuildChatMessageById(msgId){
    if(!msgId||!cloudSession)return;
    guildChatState.messages=(guildChatState.messages||[]).filter(m=>String(m.id)!==String(msgId));
    guildChatState.lastFingerprint=computeMessagesFingerprint(guildChatState.messages);
    if(q('#guildChatDialog')?.open)renderGuildChatWidget('#guildChatDialogRoot','modal',true);
    if(q('#duelLobbyChatSection'))renderGuildChatWidget('#duelLobbyChatSection','arena',true);
    try{
      await cloudFetch('rpc/delete_guild_chat_message',{
        method:'POST',
        body:JSON.stringify({p_message_id:msgId})
      });
      broadcastGuildRealtimePing('chat');
      toast('Mensagem removida do Lobby.');
    }catch{}
  }

  function formatGuildTime(iso){
    if(!iso)return'agora';
    const d=new Date(iso);
    if(isNaN(d.getTime()))return'';
    const diffSec=Math.floor((Date.now()-d.getTime())/1000);
    if(diffSec>=0&&diffSec<45)return'agora';
    const now=new Date();
    const sameDay=d.toDateString()===now.toDateString();
    return sameDay
      ?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      :`${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  }

  function renderGuildChatWidget(selector,prefix='modal',preserveInput=false){
    const root=typeof selector==='string'?q(selector):selector;
    if(!root)return;
    const isModal=prefix==='modal';
    const prevInputVal=preserveInput?(q(`#guildChatInput_${prefix}`)?.value||''):'';
    const myId=cloudSession?.user?.id||'local';
    const players=(duelHubData?.players||[]).filter(Boolean);
    const onlineCount=players.filter(p=>p.is_online).length;
    const filteredMsgs=(guildChatState.messages||[]).filter(m=>guildChatState.channel==='all'||m.channel===guildChatState.channel);
    const chanBadges={
      geral:{label:'🌐 Geral',cls:'geral'},
      duelos:{label:'⚔️ Duelos',cls:'duelos'},
      duvidas:{label:'📚 Bizus',cls:'duvidas'}
    };

    const modalStatusEl=q('#guildModalStatusPill');
    if(isModal&&modalStatusEl){
      modalStatusEl.textContent=`🟢 ${onlineCount} online · ${players.length||1} na guilda`;
    }

    root.innerHTML=`
      <div class="${isModal?'slGuildModalInner':'card slGuildLobbyCard'}">
        ${!isModal?`
          <div class="sectionHead" style="margin-bottom:8px">
            <div>
              <div class="eyebrow">💬 TEMPO REAL · FÓRUM &amp; LOBBY X1</div>
              <h3 style="margin:2px 0 0">Lobby da Guilda de Caçadores</h3>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span class="tag">🟢 ${onlineCount} online · ${players.length||1} na guilda</span>
              <button type="button" class="ghost small" data-guild-refresh="${prefix}" style="width:auto;padding:5px 10px;min-height:30px">↻</button>
            </div>
          </div>
        `:""}

        ${guildChatState.sqlMissing?`
          <div class="lessonBox trap" style="margin-bottom:8px">
            <b>Ative o Chat da Guilda no Supabase:</b>
            <p class="small" style="margin:3px 0 0">Execute o SQL atualizado (<code>20261101120000_v97_complete_security_duels_optin_and_base.sql</code>) no SQL Editor do Supabase.</p>
          </div>
        `:""}

        ${players.length>0?`
          <div class="slGuildOnlineStrip">
            <span class="slGuildStripLabel">🟢 Online (${onlineCount}/${players.length}):</span>
            <div class="slGuildPlayersRow">
              ${players.map(p=>`
                <div class="slGuildPlayerChip ${p.is_online?'online':''}">
                  <span class="onlineDot ${p.is_online?'on':''}"></span>
                  <b>${escText(p.name)}</b>
                  ${!p.is_me?`<button type="button" class="slMiniDuelBtn" data-guild-challenge-opp="${escText(p.user_id)}|${escText(p.name)}" title="Desafiar ${escText(p.name)} para Duelo X1">⚔️ X1</button>`:`<span class="small muted">você</span>`}
                </div>
              `).join('')}
            </div>
          </div>
        `:""}

        <div class="slGuildChannelTabs" role="tablist">
          <button type="button" class="slGuildTabBtn ${guildChatState.channel==='all'?'active':''}" data-guild-chan="all" data-guild-prefix="${prefix}">🔥 Todos (${(guildChatState.messages||[]).length})</button>
          <button type="button" class="slGuildTabBtn ${guildChatState.channel==='geral'?'active':''}" data-guild-chan="geral" data-guild-prefix="${prefix}">🌐 Geral</button>
          <button type="button" class="slGuildTabBtn ${guildChatState.channel==='duelos'?'active':''}" data-guild-chan="duelos" data-guild-prefix="${prefix}">⚔️ Duelos</button>
          <button type="button" class="slGuildTabBtn ${guildChatState.channel==='duvidas'?'active':''}" data-guild-chan="duvidas" data-guild-prefix="${prefix}">📚 Bizus</button>
        </div>

        <div class="slGuildFeed" id="guildChatFeed_${prefix}">
          ${filteredMsgs.length?filteredMsgs.map(m=>{
            const isMe=Boolean(m.is_me||String(m.user_id)===String(myId));
            const cb=chanBadges[m.channel]||chanBadges.geral;
            const rankName=typeof rankLabelForXp==='function'?rankLabelForXp(Number(m.author_xp||0)):'Caçador';
            const shortRank=rankName.split('·')[0].trim();
            const isDuelCall=/^⚔️/.test(String(m.message||'').trim());
            const isStatusCard=/^📊/.test(String(m.message||'').trim());
            const isBizuCard=/^💡/.test(String(m.message||'').trim());
            return `
              <div class="slGuildMsg ${isMe?'isMe':''} ${isDuelCall?'duelCallMsg':isStatusCard?'statusCardMsg':isBizuCard?'bizuCardMsg':''}">
                <div class="slGuildMsgAvatar">${escText((m.author_name||'C').trim().slice(0,1).toUpperCase())}</div>
                <div class="slGuildMsgBody">
                  <div class="slGuildMsgHead">
                    <div class="slGuildAuthorWrap">
                      <strong class="slGuildAuthor">${escText(m.author_name||'Caçador')}</strong>
                      <span class="slGuildRankPill">${escText(shortRank)}</span>
                      <span class="slGuildChanTag ${cb.cls}">${cb.label}</span>
                    </div>
                    <span class="slGuildTime">${escText(formatGuildTime(m.created_at))}${m.optimistic?' · ⏳':''}</span>
                  </div>
                  ${m.reply_excerpt?`
                    <div class="slGuildReplyQuote">
                      <b>↩ ${escText(m.reply_author||'Colega')}:</b> ${escText(m.reply_excerpt)}
                    </div>
                  `:""}
                  <div class="slGuildMsgText">${escText(m.message)}</div>
                  <div class="slGuildMsgActions">
                    <button type="button" class="slGuildActLink" data-guild-reply="${escText(m.id)}" data-guild-prefix="${prefix}">↩ Responder</button>
                    ${!isMe?`<button type="button" class="slGuildActLink duel" data-guild-challenge-opp="${escText(m.user_id)}|${escText(m.author_name)}">${isDuelCall?'⚔️ Aceitar Desafio X1':'⚔️ Chamar p/ X1'}</button>`:""}
                    ${isMe&&!m.optimistic?`<button type="button" class="slGuildActLink danger" data-guild-del="${escText(m.id)}">🗑️ Excluir</button>`:""}
                  </div>
                </div>
              </div>
            `;
          }).join(''):`
            <div class="empty" style="padding:18px 12px;margin:auto 0">
              💬 Nenhuma mensagem neste canal ainda. Use os botões rápidos abaixo ou mande um "Salve!" para a Guilda!
            </div>
          `}
        </div>

        ${guildChatState.replyTo?`
          <div class="slGuildReplyBanner">
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">↩ Respondendo a <b>${escText(guildChatState.replyTo.author_name)}</b>: “${escText((guildChatState.replyTo.message||'').slice(0,65))}”</span>
            <button type="button" class="ghost small" data-guild-cancel-reply="${prefix}" style="width:auto;padding:2px 8px;min-height:24px;flex-shrink:0">×</button>
          </div>
        `:""}

        <div class="slGuildQuickBar">
          <button type="button" class="slQuickActionChip duel" data-guild-quick="duel_call" data-guild-prefix="${prefix}">⚔️ Quem vem X1 agora?</button>
          <button type="button" class="slQuickActionChip status" data-guild-quick="share_status" data-guild-prefix="${prefix}">📊 Meu Status</button>
          <button type="button" class="slQuickActionChip bizu" data-guild-quick="ask_bizu" data-guild-prefix="${prefix}">💡 Pedir/Postar Bizu</button>
        </div>

        <div class="slGuildComposeRow">
          <select id="guildChatSendChannel_${prefix}" class="slGuildChannelSelect" aria-label="Canal da mensagem">
            <option value="geral" ${(guildChatState.sendChannel==='geral'||guildChatState.channel==='geral')?'selected':''}>🌐 Geral</option>
            <option value="duelos" ${(guildChatState.sendChannel==='duelos'||guildChatState.channel==='duelos')?'selected':''}>⚔️ Duelos</option>
            <option value="duvidas" ${(guildChatState.sendChannel==='duvidas'||guildChatState.channel==='duvidas')?'selected':''}>📚 Bizus</option>
          </select>
          <input type="text" id="guildChatInput_${prefix}" maxlength="600" placeholder="Mensagem para a Guilda..." value="${escText(prevInputVal)}">
          <button type="button" class="action slGuildSendBtn" id="guildChatSendBtn_${prefix}" title="Enviar mensagem">Enviar ➤</button>
        </div>
      </div>
    `;

    const feedEl=q(`#guildChatFeed_${prefix}`);
    if(feedEl)feedEl.scrollTop=feedEl.scrollHeight;

    root.querySelectorAll(`[data-guild-refresh="${prefix}"]`).forEach(btn=>{
      btn.onclick=async()=>{
        await Promise.all([loadGuildChatMessages(false),loadDuelArenaHub(true)]);
        renderGuildChatWidget(selector,prefix,true);
      };
    });

    root.querySelectorAll('[data-guild-chan]').forEach(btn=>{
      btn.onclick=()=>{
        guildChatState.channel=btn.dataset.guildChan;
        if(btn.dataset.guildChan!=='all')guildChatState.sendChannel=btn.dataset.guildChan;
        if(q('#guildChatDialog')?.open)renderGuildChatWidget('#guildChatDialogRoot','modal',true);
        if(q('#duelLobbyChatSection'))renderGuildChatWidget('#duelLobbyChatSection','arena',true);
      };
    });

    root.querySelectorAll('[data-guild-quick]').forEach(btn=>{
      btn.onclick=()=>{
        const kind=btn.dataset.guildQuick;
        const me=typeof localHunterRow==='function'?localHunterRow():{name:'Caçador',xp:0,streak:0,accuracy:0,missions_done:0};
        const rName=typeof rankLabelForXp==='function'?rankLabelForXp(Number(me.xp||0)):'Caçador';
        if(kind==='duel_call'){
          const camp=(typeof activeCampaign==='function'&&activeCampaign()?.name)||'Concurso';
          sendGuildChatMessageFromUI(prefix,`⚔️ [CONVITE ABERTO X1] Estou online na Arena (${camp})! Quem encara um duelo de 5 questões agora?`,'duelos');
        }else if(kind==='share_status'){
          sendGuildChatMessageFromUI(prefix,`📊 [STATUS DO CAÇADOR] ${rName} · 🔥 ${me.streak||0}d ofensiva · ⚡ ${me.xp||0} XP · 🎯 ${me.accuracy||0}% precisão (${me.missions_done||0} missões concluídas)!`,'geral');
        }else if(kind==='ask_bizu'){
          guildChatState.sendChannel='duvidas';
          const chanSel=q(`#guildChatSendChannel_${prefix}`);
          if(chanSel)chanSel.value='duvidas';
          const inp=q(`#guildChatInput_${prefix}`);
          if(inp){
            if(!inp.value.trim())inp.value='💡 [BIZU / DÚVIDA] ';
            inp.focus();
          }
        }
      };
    });

    root.querySelectorAll('[data-guild-reply]').forEach(btn=>{
      btn.onclick=()=>{
        const found=(guildChatState.messages||[]).find(m=>String(m.id)===String(btn.dataset.guildReply));
        if(found){
          guildChatState.replyTo=found;
          guildChatState.sendChannel=found.channel||'geral';
          renderGuildChatWidget(selector,prefix,true);
          q(`#guildChatInput_${prefix}`)?.focus();
        }
      };
    });

    root.querySelectorAll('[data-guild-cancel-reply]').forEach(btn=>{
      btn.onclick=()=>{
        guildChatState.replyTo=null;
        renderGuildChatWidget(selector,prefix,true);
      };
    });

    root.querySelectorAll('[data-guild-del]').forEach(btn=>{
      btn.onclick=()=>deleteGuildChatMessageById(btn.dataset.guildDel);
    });

    root.querySelectorAll('[data-guild-challenge-opp]').forEach(btn=>{
      btn.onclick=()=>{
        const [uid,uname]=(btn.dataset.guildChallengeOpp||'').split('|');
        if(!uid)return;
        selectedDuelOpponentId=uid;
        selectedDuelOpponentName=uname;
        q('#guildChatDialog')?.close();
        updateGuildUnreadBadge();
        openView('duel');
        setTimeout(()=>{
          const sel=q('#duelOpponentSelect');
          if(sel){sel.value=uid;sel.scrollIntoView({behavior:'smooth',block:'center'})}
          toast(`⚔️ ${uname} selecionado na Arena X1! Escolha a disciplina e lance o desafio!`);
        },120);
      };
    });

    const sendBtn=q(`#guildChatSendBtn_${prefix}`);
    const inputEl=q(`#guildChatInput_${prefix}`);
    if(sendBtn)sendBtn.onclick=()=>sendGuildChatMessageFromUI(prefix);
    if(inputEl){
      inputEl.onkeydown=e=>{
        if(e.key==='Enter'&&!e.shiftKey){
          e.preventDefault();
          sendGuildChatMessageFromUI(prefix);
        }
      };
    }
  }

  function openGuildChatDialog(){
    const dlg=q('#guildChatDialog');
    if(!dlg)return;
    renderGuildChatWidget('#guildChatDialogRoot','modal',false);
    try{dlg.showModal()}catch{}
    updateGuildUnreadBadge();
    loadGuildChatMessages(false);
    loadDuelArenaHub(true);
  }

  if(q('#floatingGuildChatBtn'))q('#floatingGuildChatBtn').onclick=openGuildChatDialog;
  if(q('#menuGuildChat'))q('#menuGuildChat').onclick=()=>{q('#moreDialog')?.close();openGuildChatDialog()};
  if(q('#closeGuildChatDialogBtn'))q('#closeGuildChatDialogBtn').onclick=()=>{q('#guildChatDialog')?.close();updateGuildUnreadBadge()};
  if(q('#guildChatDialog'))q('#guildChatDialog').addEventListener('close',updateGuildUnreadBadge);
  const prevOpenViewForGuild=openView;
  openView=function(id){
    prevOpenViewForGuild(id);
    qa('.tabs .tab[role="tab"]').forEach(t=>t.setAttribute('aria-selected',t.classList.contains('active')?'true':'false'));
    updateGuildUnreadBadge();
  };

  // 20. Central Jurídica Interativa (LGPD, Termos de Uso, Política de Cookies), Banner de Consentimento e Acessibilidade Teclado
  const LEGAL_DOCS_CONTENT={
    privacidade:{
      title:'Política de Privacidade (LGPD — Lei nº 13.709/2018)',
      url:'privacidade.html',
      html:`
        <div class="lessonBox bizu" style="margin-top:0"><b>Resumo Transparente (LGPD):</b> A <b>Jornada do Caçador</b> coleta apenas os dados necessários para sincronizar seu progresso de estudos, processar seus PDFs/redações sob seu comando e permitir recursos cooperativos opcionais. Você pode exportar todo o seu histórico em JSON ou excluir definitivamente sua conta e seus dados a qualquer momento em <b>Minha Conta</b>.</div>
        <h4>1. Dados Coletados e Finalidades</h4>
        <ul>
          <li><b>Identificação e Autenticação:</b> nome/apelido de exibição, e-mail e senha criptografada (via Supabase Auth) para login e sincronia entre celular e computador.</li>
          <li><b>Progresso Pedagógico:</b> missões concluídas, tempo de foco, pontuações em questões/simulados, índices do TAF, flashcards e anotações.</li>
          <li><b>Arquivos Enviados (PDFs e Redações):</b> editais, materiais em PDF e redações enviados pelo usuário para geração de resumos, questões e correções por IA.</li>
          <li><b>Chave de IA Pessoal (Opcional — BYOK):</b> se configurada pelo usuário, fica guardada criptografada no Supabase Vault exclusivamente para uso da própria conta.</li>
          <li><b>Comunidade (Ranking, Arena X1 e Guilda):</b> apelido, cargo-alvo, XP/ofensiva e mensagens enviadas no mural da Guilda.</li>
        </ul>
        <h4>2. Proteção Anti-CPF na Biblioteca da Comunidade</h4>
        <p class="small">Materiais compartilhados na Biblioteca da Comunidade têm o download do PDF bruto bloqueado e passam por higienização automática (<code>sanitize_personal_watermarks</code>) que remove CPFs e e-mails. Você pode alternar qualquer arquivo seu para <b>🔒 Privado</b> a qualquer momento.</p>
        <h4>3. Operadores de Tecnologia e Direitos do Titular (Art. 18 da LGPD)</h4>
        <p class="small">Utilizamos Supabase (banco com isolamento RLS), Cloudflare (hospedagem HTTPS) e provedores de IA (Google Gemini, DeepSeek e Groq) acionados apenas sob seu comando. Você pode exercer a portabilidade (<i>Exportar backup JSON</i>) ou a eliminação total e imediata (<i>Redefinir perfil</i> ou <i>Excluir minha conta</i>) diretamente no aplicativo.</p>
      `
    },
    termos:{
      title:'Termos de Uso da Plataforma',
      url:'termos.html',
      html:`
        <h4>1. Natureza Independente</h4>
        <p class="small">A <b>Jornada do Caçador</b> (idealização e desenvolvimento: Walyson Caio) é uma plataforma independente de apoio aos estudos e <b>não possui vínculo oficial</b> com órgãos públicos, corporações policiais, bancas examinadoras (Cebraspe, FGV, Instituto AOCP, IDECAN) ou cursos preparatórios.</p>
        <h4>2. Uso de Inteligência Artificial e Conferência Obrigatória</h4>
        <p class="small">Resumos, flashcards, questões comentadas, cronogramas e correções de redação gerados por IA são instrumentos de auxílio pedagógico. Cabe ao usuário conferir artigos de lei, prazos, gabaritos definitivos e regras diretamente no <b>edital oficial do concurso</b> e na legislação vigente.</p>
        <h4>3. Ausência de Promessa de Aprovação</h4>
        <p class="small">Os indicadores do Simulador de Aprovação, XP e Patentes medem apenas a evolução nos treinos internos da plataforma, não representando garantia de aprovação ou classificação em concursos públicos.</p>
        <h4>4. Convivência na Guilda e Direitos sobre Materiais</h4>
        <p class="small">O usuário compromete-se a manter respeito no Chat da Guilda e declara possuir direito de uso sobre os PDFs que enviar para estudo, podendo definir sua visibilidade como pública ou privada.</p>
      `
    },
    cookies:{
      title:'Política de Cookies e Armazenamento Local',
      url:'cookies.html',
      html:`
        <h4>1. Zero Rastreadores Publicitários</h4>
        <p class="small">A <b>Jornada do Caçador</b> não utiliza cookies ou pixels de anúncios de terceiros para rastrear você fora do aplicativo.</p>
        <h4>2. Armazenamento Local Estritamente Necessário</h4>
        <ul>
          <li><b>Sessão Segura (<code>localStorage: pmpe-supabase-session-v1</code>):</b> mantém seu login ativo no aparelho.</li>
          <li><b>Progresso e Cronômetro (<code>localStorage: pmpe-hunter-v1</code>):</b> preserva suas missões, ofensiva e cronômetro de foco mesmo sem internet.</li>
          <li><b>Banco Local de Alta Velocidade (<code>IndexedDB: jornada-local-cache-v1</code> e <code>missao-pmpe-caderno</code>):</b> guarda seus resumos, questões, flashcards e folhas do caderno manuscrito no aparelho para abertura instantânea de abas.</li>
          <li><b>Service Worker PWA:</b> mantém os arquivos essenciais da interface em cache para acesso rápido e offline.</li>
        </ul>
      `
    }
  };

  function openLegalCenter(tab='privacidade'){
    const dlg=q('#legalCenterDialog'),body=q('#legalCenterBody'),title=q('#legalCenterTitle'),extLink=q('#legalExternalLink');
    if(!dlg||!body)return;
    const key=LEGAL_DOCS_CONTENT[tab]?tab:'privacidade';
    const doc=LEGAL_DOCS_CONTENT[key];
    if(title)title.textContent=doc.title;
    if(extLink)extLink.href=doc.url;
    body.innerHTML=doc.html;
    qa('[data-legal-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.legalTab===key));
    if(!dlg.open)dlg.showModal();
  }
  window.openLegalCenter=openLegalCenter;

  function initLegalAndAccessibilityEnhancements(){
    const CONSENT_KEY='jornada-lgpd-consent-v1';
    const banner=q('#cookieConsentBanner');
    if(banner&&!localStorage.getItem(CONSENT_KEY)){
      banner.hidden=false;
    }
    const acceptConsent=()=>{
      try{localStorage.setItem(CONSENT_KEY,new Date().toISOString())}catch{}
      if(banner)banner.hidden=true;
      if(q('#legalCenterDialog')?.open)q('#legalCenterDialog').close();
    };
    if(q('#acceptCookieBannerBtn'))q('#acceptCookieBannerBtn').onclick=acceptConsent;
    if(q('#acceptLegalFromModalBtn'))q('#acceptLegalFromModalBtn').onclick=acceptConsent;
    if(q('#closeLegalCenterBtn'))q('#closeLegalCenterBtn').onclick=()=>q('#legalCenterDialog')?.close();

    qa('[data-legal-tab]').forEach(btn=>{
      btn.onclick=()=>openLegalCenter(btn.dataset.legalTab);
    });
    document.addEventListener('click',e=>{
      const link=e.target.closest?.('[data-open-legal]');
      if(!link)return;
      if(e.ctrlKey||e.metaKey||e.shiftKey)return;
      e.preventDefault();
      openLegalCenter(link.dataset.openLegal);
    });
    if(q('#footerManageDataBtn')){
      q('#footerManageDataBtn').onclick=()=>{
        q('#diagnosticsDialog')?.showModal();
        if(typeof runSystemDiagnostics==='function')runSystemDiagnostics();
      };
    }

    const gateSubmit=q('#gateSubmit');
    if(gateSubmit){
      gateSubmit.addEventListener('click',e=>{
        const isSignup=typeof gateMode!=='undefined'&&gateMode==='signup';
        const cb=q('#gateLgpdConsent');
        if(isSignup&&cb&&!cb.checked){
          e.preventDefault();
          e.stopImmediatePropagation();
          const msg=q('#gateMessage');
          if(msg)msg.textContent='Para criar sua conta, marque que concorda com os Termos de Uso e a Política de Privacidade (LGPD).';
        }
      },true);
    }

    qa('[role="tablist"]').forEach(tablist=>{
      tablist.addEventListener('keydown',e=>{
        if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
        const tabs=[...tablist.querySelectorAll('button:not([hidden]):not([disabled])')];
        const idx=tabs.indexOf(document.activeElement);
        if(idx<0)return;
        e.preventDefault();
        const next=tabs[(idx+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
        next?.focus();
        next?.click();
      });
    });
  }
  ensureNativeQuestionBankLoaded();
  LEARNING_SUBJECTS=typeof window.computeValidLearningSubjects==='function'?window.computeValidLearningSubjects():LEARNING_SUBJECTS;
  if(typeof renderQuestionFilters==='function')renderQuestionFilters();
  if(typeof renderLearning==='function')renderLearning();
  initLegalAndAccessibilityEnhancements();
  setTimeout(()=>{
    syncCommunityLibraryForActivePortal();
    if(cloudSession&&navigator.onLine){
      connectGuildRealtimeSocket();
      loadDuelArenaHub(true);
      loadGuildChatMessages(true);
    }
  },1200);
  setInterval(()=>{
    if(cloudSession&&navigator.onLine&&document.visibilityState==='visible'){
      const chatActive=Boolean(q('#guildChatDialog')?.open||q('#duel')?.classList.contains('active'));
      if(chatActive&&!guildChatState.wsConnected){
        loadGuildChatMessages(true);
        if(!activeDuelSession)loadDuelArenaHub(true);
      }
    }
  },8000);
  setInterval(()=>{
    if(cloudSession&&navigator.onLine&&document.visibilityState==='visible'){
      const chatActive=Boolean(q('#guildChatDialog')?.open||q('#duel')?.classList.contains('active'));
      if(!chatActive){
        if(!activeDuelSession)loadDuelArenaHub(true);
        if(!guildChatState.wsConnected)loadGuildChatMessages(true);
      }
    }
  },25000);
  const remembered=(()=>{try{return sessionStorage.getItem(viewKey)}catch{return null}})();
  if(remembered&&q(`#${CSS.escape(remembered)}`)?.classList.contains('view'))openView(remembered);
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 78 · experiência orientada ao estudo');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 78 · interface, questões, simulados, IA, PDFs e sincronização');
})();
