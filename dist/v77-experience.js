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
    const errors=Object.values(state?.errors||{}).reduce((sum,item)=>sum+Number(item?.misses||0),0);
    if(q('#urgentReviewMeta'))q('#urgentReviewMeta').textContent=errors?`${errors} erro${errors===1?'':'s'} pedindo atenção`:'Nenhum erro urgente no momento';
    if(q('#questionShortcutMeta'))q('#questionShortcutMeta').textContent=`${ALL_QUESTIONS?.length||0} questão${ALL_QUESTIONS?.length===1?'':'ões'} disponíveis`;

    // Adiciona atalho direto no cartão da missão diária para treinar questões da disciplina do dia
    const dailyBox=q('#dailyMission');
    if(dailyBox&&mission&&!q('#practiceDailySubjectBtn')){
      const finishBtn=q('#finishDaily');
      if(finishBtn){
        finishBtn.insertAdjacentHTML('afterend',`<button class="ghost" id="practiceDailySubjectBtn" type="button" style="width:100%;margin-top:8px">Treinar questões de ${escText(mission.subject||'esta disciplina')}</button>`);
        q('#practiceDailySubjectBtn').onclick=()=>{
          openView('report');
          const subjSel=q('#questionSubject');
          if(subjSel){
            const match=[...subjSel.options].find(opt=>topicKey(opt.value)===topicKey(mission.subject));
            if(match){subjSel.value=match.value;populateTopicFilter();updateQuestionPool()}
          }
        };
      }
    }
  }

  // Busca rápida de tópicos dentro de #topicPanel no Mapa do Edital (#map)
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

  // 1. Cronograma Reverso até a Data da Prova
  function ensureReverseSchedulePanel(){
    const countdownCard=q('#map .examCountdown');
    if(!countdownCard||q('#reverseSchedulePanel'))return;
    countdownCard.insertAdjacentHTML('afterend',`<div class="card reverseScheduleCard" id="reverseSchedulePanel"><div class="sectionHead"><div><div class="eyebrow">CRONOGRAMA REVERSO ATÉ A PROVA</div><h2 id="reverseScheduleTitle">Ritmo necessário para fechar o edital</h2></div><span class="tag" id="reverseScheduleBadge">Cálculo automático</span></div><div class="reverseScheduleGrid" id="reverseScheduleMetrics"></div><p class="small muted" id="reverseScheduleAdvice" style="margin:10px 0 0"></p></div>`);
  }

  function renderReverseSchedule(){
    ensureReverseSchedulePanel();
    ensureTopicPanelSearch();
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

  // 2. Filtro de Questões por Tópico/Assunto Específico
  function normalizedOrigin(question){const origin=String(question?.origin||'autoral').toLocaleLowerCase('pt-BR');return /oficial|importad|prova/.test(origin)?'oficial':'autoral'}
  function normalizedDifficulty(question){const value=String(question?.difficulty||'medio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return value.startsWith('fac')?'facil':value.startsWith('dif')?'dificil':'medio'}
  function topicKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

  function ensureTopicFilterSelect(){
    const filters=q('.questionFilters');
    if(!filters||q('#questionTopic'))return;
    const subjectField=q('#questionSubject')?.closest('.field');
    const html=`<label class="field">Assunto / Tópico<select id="questionTopic"><option value="all">Todos os assuntos</option></select></label>`;
    if(subjectField)subjectField.insertAdjacentHTML('afterend',html);
    else filters.insertAdjacentHTML('beforeend',html);
    q('#questionTopic')?.addEventListener('change',updateQuestionPool);
  }

  function populateTopicFilter(){
    ensureTopicFilterSelect();
    const topicSelect=q('#questionTopic');
    if(!topicSelect)return;
    const subject=q('#questionSubject')?.value||'all';
    const currentTopic=topicSelect.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const allForSubject=(ALL_QUESTIONS||[]).filter(item=>subject==='all'||learningCategory(item.subject)===subject);
    const pool=baseSource.length?baseSource:allForSubject;
    const topicsMap=new Map();
    for(const item of pool){
      const label=String(item?.topic||'').trim();
      const key=topicKey(label);
      if(label&&key&&!topicsMap.has(key))topicsMap.set(key,label);
    }
    const sorted=[...topicsMap.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
    topicSelect.innerHTML='<option value="all">Todos os assuntos</option>'+sorted.map(([key,label])=>`<option value="${escText(key)}">${escText(label)}</option>`).join('');
    topicSelect.value=topicsMap.has(currentTopic)?currentTopic:'all';
  }

  function filteredQuestionPool(){
    const subject=q('#questionSubject')?.value||'all',topic=q('#questionTopic')?.value||'all',difficulty=q('#questionDifficulty')?.value||'all',origin=q('#questionOrigin')?.value||'all';
    const baseSource=typeof questionsForMode==='function'?questionsForMode('battle',subject):(ALL_QUESTIONS||[]);
    const source=baseSource.length?baseSource:(ALL_QUESTIONS||[]).filter(item=>subject==='all'||learningCategory(item.subject)===subject);
    return source.filter(item=>(topic==='all'||topicKey(item?.topic)===topic)&&(difficulty==='all'||normalizedDifficulty(item)===difficulty)&&(origin==='all'||normalizedOrigin(item)===origin));
  }

  function updateQuestionPool(){
    const pool=filteredQuestionPool(),badge=q('#questionPoolCount');
    if(badge)badge.textContent=`${pool.length} disponíve${pool.length===1?'l':'is'}`;
    const button=q('#startQuestions');
    if(button){
      button.disabled=!pool.length;
      button.textContent=pool.length?`Iniciar batalha de ${Math.min(5,pool.length)} questões`:'Nenhuma questão neste filtro';
    }
    updateSimuladoAvailability();
  }

  function startFilteredBattle(){
    const pool=filteredQuestionPool(),subject=q('#questionSubject')?.value||'all',topicSel=q('#questionTopic');
    if(!pool.length)return toast('Não há questões que correspondam aos filtros selecionados.');
    const topicLabel=topicSel&&topicSel.value!=='all'?topicSel.options[topicSel.selectedIndex]?.text:'';
    activeQuestions={mode:'battle',subject:topicLabel?`${subject==='all'?'Treino':subject} · ${topicLabel}`:subject,questions:balancedQuestions(pool,Math.min(5,pool.length)).map(prepareQuestion),current:0,correct:0,answered:false};
    q('#questionDialogTitle').textContent=topicLabel?`Batalha · ${topicLabel}`:'Batalha de questões';
    q('#questionDialog').showModal();
    showQuestion();
  }

  function renderPerformanceChart(){
    const root=q('#performanceChart');if(!root)return;
    const scores=(state?.scores||[]).filter(item=>!item.campaignId||item.campaignId===state.activeCampaignId),groups={};
    for(const item of scores){const name=item.subject||missionPool().find(m=>m.id===item.id)?.subject||'Conteúdo geral';groups[name]??={total:0,correct:0};groups[name].total+=Number(item.total||0);groups[name].correct+=Number(item.correct||0)}
    const rows=Object.entries(groups).filter(([,data])=>data.total>0).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
    root.className='performanceChart';root.innerHTML=rows.length?rows.map(([name,data])=>{const rate=Math.round(data.correct/data.total*100),tone=rate<60?'low':rate<80?'mid':'high';return `<div class="performanceBar ${tone}" title="${escText(name)}: ${data.correct}/${data.total}"><span>${escText(name)}</span><div class="performanceTrack"><i style="width:${rate}%"></i></div><b>${rate}%</b></div>`}).join(''):'<div class="empty">Resolva questões para visualizar sua precisão por disciplina.</div>';
  }

  // 3. Modo Simulado Cronometrado com Folha de Respostas
  let activeSimulado=null,simuladoTimer=null;

  function ensureSimuladoUI(){
    const trainer=q('.questionTrainer');
    if(trainer&&!q('#simuladoLauncher')){
      trainer.insertAdjacentHTML('afterend',`<div class="card simuladoLauncher" id="simuladoLauncher"><div class="sectionHead"><div><div class="eyebrow">PROVA SIMULADA</div><h2 style="margin:3px 0 0">Simulado Cronometrado com Folha de Respostas</h2><p class="small muted" style="margin:3px 0 0">Monte um caderno completo misturando as disciplinas do portal, navegue livremente pelo gabarito e receba o relatório por matéria ao entregar.</p></div><span class="tag" id="simuladoTotalBadge">0 no banco</span></div><div class="simuladoConfigGrid"><label class="field">Quantidade de questões<select id="simuladoCount"><option value="10">10 questões ( treino rápido )</option><option value="20" selected>20 questões ( simulado curto )</option><option value="30">30 questões ( simulado médio )</option><option value="40">40 questões ( simulado amplo )</option><option value="60">60 questões ( prova completa )</option></select></label><label class="field">Tempo limite<select id="simuladoMinutes"><option value="20">20 minutos</option><option value="40">40 minutos</option><option value="60" selected>1 hora (60 min)</option><option value="90">1h30 (90 min)</option><option value="120">2 horas (120 min)</option><option value="180">3 horas (180 min)</option></select></label><label class="field">Escopo<select id="simuladoScope"><option value="all">Todas as disciplinas do portal</option><option value="filtered">Usar filtros selecionados acima</option></select></label></div><button class="action" id="startSimuladoBtn" style="margin-top:10px">Iniciar Simulado Cronometrado</button></div>`);
      q('#startSimuladoBtn').onclick=startTimedSimulado;
      q('#simuladoScope').onchange=updateSimuladoAvailability;
    }
    if(!q('#simuladoDialog')){
      document.body.insertAdjacentHTML('beforeend',`<dialog id="simuladoDialog" class="simuladoDialog"><div class="simuladoTopBar"><div><div class="eyebrow" id="simuladoMetaLabel">SIMULADO CRONOMETRADO</div><h2 id="simuladoTitle" style="margin:2px 0 0;font-size:1.05rem">Caderno de Prova</h2></div><div class="simuladoClockWrap"><span class="simuladoClock" id="simuladoClock">60:00</span><button class="ghost danger small" id="abortSimuladoBtn" type="button">Sair</button></div></div><div id="simuladoStage"><div class="simuladoSheetBar"><div class="small muted" id="simuladoAnsweredCount">0 respondidas</div><div class="simuladoSheetGrid" id="simuladoSheetGrid" aria-label="Folha de respostas"></div></div><div class="questionBox simuladoQuestionBox"><div class="small muted" id="simuladoQuestionMeta"></div><h3 id="simuladoQuestionText" style="margin:8px 0 14px"></h3><div class="questionOptions" id="simuladoOptions"></div></div><div class="simuladoNavRow"><button class="ghost" id="simuladoPrevBtn" type="button">← Anterior</button><button class="ghost" id="simuladoNextBtn" type="button">Próxima →</button><button class="action" id="simuladoSubmitBtn" type="button">Entregar Simulado</button></div></div><div id="simuladoResultStage" hidden></div></dialog>`);
      q('#abortSimuladoBtn').onclick=abortTimedSimulado;
      q('#simuladoPrevBtn').onclick=()=>navigateSimulado(-1);
      q('#simuladoNextBtn').onclick=()=>navigateSimulado(1);
      q('#simuladoSubmitBtn').onclick=()=>confirmSubmitSimulado();
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
    if(!pool.length)return toast('Envie um PDF na Biblioteca e gere o conteúdo para ter questões no simulado.');
    const wanted=Math.min(pool.length,Math.max(1,Number(q('#simuladoCount')?.value)||20));
    const minutes=Math.max(5,Number(q('#simuladoMinutes')?.value)||60);
    const questions=buildProportionalSimuladoQuestions(pool,wanted);
    if(!questions.length)return toast('Não foi possível montar o caderno de questões.');

    clearInterval(simuladoTimer);
    activeSimulado={
      questions,
      answers:new Array(questions.length).fill(null),
      current:0,
      totalSeconds:minutes*60,
      remainingSeconds:minutes*60,
      startedAt:Date.now(),
      finished:false
    };

    q('#simuladoStage').hidden=false;
    q('#simuladoResultStage').hidden=true;
    q('#simuladoResultStage').innerHTML='';
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
    const {questions,answers,current}=activeSimulado;
    const item=questions[current];
    const answeredCount=answers.filter(a=>a!==null).length;
    q('#simuladoAnsweredCount').textContent=`Folha de respostas: ${answeredCount}/${questions.length} marcada${answeredCount===1?'':'s'}`;
    q('#simuladoSheetGrid').innerHTML=questions.map((_,i)=>{
      const chosen=answers[i];
      const letter=chosen!==null?String.fromCharCode(65+chosen):'';
      return `<button type="button" class="sheetBubble ${i===current?'current':''} ${chosen!==null?'answered':''}" data-simulado-jump="${i}" title="Questão ${i+1}${letter?` (Marcada: ${letter})`:''}">${i+1}${letter?`<small>${letter}</small>`:''}</button>`;
    }).join('');
    qa('[data-simulado-jump]').forEach(btn=>btn.onclick=()=>{activeSimulado.current=Number(btn.dataset.simuladoJump);renderSimuladoQuestion()});

    const diffLabel={facil:'FÁCIL',medio:'MÉDIA',dificil:'DIFÍCIL'}[normalizedDifficulty(item)]||'MÉDIA';
    const originLabel=normalizedOrigin(item)==='oficial'?'OFICIAL/PROVA':'AUTORAL IA';
    q('#simuladoQuestionMeta').textContent=`Questão ${current+1} de ${questions.length} · ${learningCategory(item.subject)} · ${item.topic||'Geral'} · ${diffLabel} · ${originLabel}`;
    q('#simuladoQuestionText').textContent=item.statement;
    q('#simuladoOptions').innerHTML=(item.options||[]).map((opt,i)=>{
      const selected=answers[current]===i;
      return `<button type="button" class="${selected?'selectedOption':''}" data-simulado-option="${i}"><b>${String.fromCharCode(65+i)}.</b> ${escText(opt)}</button>`;
    }).join('');
    qa('[data-simulado-option]').forEach(btn=>btn.onclick=()=>{
      activeSimulado.answers[current]=Number(btn.dataset.simuladoOption);
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
      ? `Você deixou ${unanswered} questão${unanswered===1?'':'ões'} em branco. Deseja entregar o simulado mesmo assim?`
      : 'Deseja finalizar e corrigir sua Folha de Respostas agora?';
    if(!confirm(msg))return;
    finishTimedSimulado(false);
  }

  function finishTimedSimulado(){
    if(!activeSimulado||activeSimulado.finished)return;
    activeSimulado.finished=true;
    clearInterval(simuladoTimer);
    const {questions,answers,totalSeconds,remainingSeconds}=activeSimulado;
    const elapsedSeconds=Math.max(1,totalSeconds-remainingSeconds);
    const elapsedMinutes=Math.max(1,Math.round(elapsedSeconds/60));
    const bySubject={};
    let totalCorrect=0;

    questions.forEach((item,index)=>{
      const chosen=answers[index];
      const ok=chosen===Number(item.correct_index);
      if(ok)totalCorrect++;
      const subj=learningCategory(item.subject)||'Conteúdo geral';
      bySubject[subj]??={total:0,correct:0};
      bySubject[subj].total++;
      if(ok)bySubject[subj].correct++;
      if(typeof recordQuestionResult==='function')recordQuestionResult(item,ok,chosen);
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

    const rate=Math.round(totalCorrect/questions.length*100);
    const subjectRows=Object.entries(bySubject).sort((a,b)=>(b[1].correct/b[1].total)-(a[1].correct/a[1].total)).map(([subj,data])=>{
      const subjRate=Math.round(data.correct/data.total*100);
      const tone=subjRate<60?'low':subjRate<80?'mid':'high';
      return `<div class="performanceBar ${tone}"><span>${escText(subj)}</span><div class="performanceTrack"><i style="width:${subjRate}%"></i></div><b>${data.correct}/${data.total} (${subjRate}%)</b></div>`;
    }).join('');

    const reviewItems=questions.map((item,i)=>{
      const chosen=answers[i],correct=Number(item.correct_index),ok=chosen===correct;
      const chosenLetter=chosen!==null?String.fromCharCode(65+chosen):'Em branco';
      const correctLetter=String.fromCharCode(65+correct);
      return `<div class="topic" style="border-left:4px solid ${ok?'var(--green)':'var(--red)'}"><div style="flex:1"><b>Questão ${i+1} · ${escText(learningCategory(item.subject))}</b> <span class="tag">${ok?'✓ Acertou':'✗ Errou'}</span><div class="small" style="margin:6px 0">${escText(item.statement)}</div><div class="small muted">Sua marcação: <b>${escText(chosenLetter)}</b> · Gabarito: <b>${escText(correctLetter)} — ${escText(item.options?.[correct]||'')}</b></div>${item.explanation?`<div class="small" style="margin-top:5px">${escText(item.explanation)}</div>`:''}</div></div>`;
    }).join('');

    q('#simuladoStage').hidden=true;
    const resultStage=q('#simuladoResultStage');
    resultStage.hidden=false;
    resultStage.innerHTML=`<div class="card"><div class="sectionHead"><div><div class="eyebrow">RESULTADO DO SIMULADO</div><h2>Você acertou ${totalCorrect} de ${questions.length} (${rate}%)</h2><p class="small muted" style="margin:3px 0 0">Tempo utilizado: ${elapsedMinutes} min · Os erros foram enviados automaticamente ao seu Caderno de Erros.</p></div><span class="tag">${rate>=70?'Aprovado no corte (≥70%)':'Abaixo de 70% — revisar'}</span></div><div class="performanceChart" style="margin-top:12px">${subjectRows}</div></div><div class="card"><div class="sectionHead"><h3>Gabarito comentado e folha corrigida</h3><button class="action" id="closeFinishedSimulado" type="button" style="width:auto;padding:10px 18px">Concluir e fechar</button></div><div class="list">${reviewItems}</div></div>`;
    q('#closeFinishedSimulado').onclick=()=>{
      activeSimulado=null;
      q('#simuladoDialog')?.close();
    };
    toast(`Simulado concluído: ${totalCorrect}/${questions.length} (${rate}%)`);
  }

  function bindQuestionCenter(){
    ensureTopicFilterSelect();
    ensureSimuladoUI();
    q('#questionSubject')?.addEventListener('change',()=>{populateTopicFilter();updateQuestionPool()});
    for(const selector of ['#questionDifficulty','#questionOrigin'])q(selector)?.addEventListener('change',updateQuestionPool);
    if(q('#startQuestions'))q('#startQuestions').onclick=startFilteredBattle;
    populateTopicFilter();
    updateQuestionPool();
    renderPerformanceChart();
  }

  const baseRenderQuestionFilters=typeof renderQuestionFilters==='function'?renderQuestionFilters:null;
  if(baseRenderQuestionFilters){
    renderQuestionFilters=function(){
      baseRenderQuestionFilters();
      populateTopicFilter();
      updateQuestionPool();
    };
  }

  const baseOpenView=openView;
  openView=function(id){baseOpenView(id);try{sessionStorage.setItem(viewKey,id)}catch{}if(id==='report'){populateTopicFilter();updateQuestionPool();renderPerformanceChart()}if(id==='today')updateTodayCommand();if(id==='map')renderReverseSchedule()};
  const baseRender=render;
  render=function(){baseRender();updateTodayCommand();renderReverseSchedule();populateTopicFilter();updateQuestionPool();renderPerformanceChart()};
  const baseRenderReport=renderReport;
  renderReport=function(){baseRenderReport();populateTopicFilter();updateQuestionPool();renderPerformanceChart()};

  addTodayCommand();ensureReverseSchedulePanel();bindQuestionCenter();updateTodayCommand();renderReverseSchedule();
  qa('[data-menu-view]').forEach(button=>button.onclick=()=>{q('#moreDialog')?.close();openView(button.dataset.menuView)});
  const remembered=(()=>{try{return sessionStorage.getItem(viewKey)}catch{return null}})();
  if(remembered&&q(`#${CSS.escape(remembered)}`)?.classList.contains('view'))openView(remembered);
  q('#aboutDialog .tag')&&(q('#aboutDialog .tag').textContent='Versão 78 · experiência orientada ao estudo');
  q('#diagnosticsDialog .small.muted')&&(q('#diagnosticsDialog .small.muted').textContent='Versão 78 · interface, questões, simulados, IA, PDFs e sincronização');
})();
