/* Jornada do Caçador — r196: Combo Missão Elite & Diagnóstico de Aprovação
 * 8 melhorias integradas com zero dependências externas e renderização leve:
 * 1. Radar de Eliminação (regras reais do edital: zerar matéria, mínimo 30% por bloco, 18/60 geral)
 * 2. Card "Missão de Hoje" na Home (2 blocos prontos de 15 questões + tempo estimado + revisões)
 * 3. Caderno de Erros 2.0 (badge Reincidente 2+x, KPIs e botão Refazer todas as erradas)
 * 4. Feedback de Erro Estruturado (Onde errou + Pegadinha da banca + Ver outras + Aula do Invocador)
 * 5. Botão "Reportar erro" nas questões (alimenta fila de revisão humana / log local)
 * 6. Redação 2.0 (4 critérios 0–40, mínimo 12/40, média histórica e sublinhado inline nos trechos)
 * 7. Simulado 2.0 (Marcar para revisar na folha, Tempo Ativo vs Total, Tempo médio e comparativo)
 * 8. Cronograma Adaptativo + Heatmap semanal (recalcula metas atrasadas até a prova)
 */
(function initMissaoEliteFeatures() {
  'use strict';
  if (typeof window === 'undefined' || window.JCMissaoElite) return;

  const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const normKey = (v) => String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const todayKey = () => {
    try {
      if (typeof window.localDayKey === 'function') return window.localDayKey();
    } catch (_e) {}
    return new Date().toISOString().slice(0, 10);
  };

  const getState = () => (typeof state === 'object' && state ? state : (window.state || {}));
  const getCampaignId = () => getState().activeCampaignId || 'pmpe';
  const getActiveCampaign = () => {
    try {
      if (typeof activeCampaign === 'function') return activeCampaign();
    } catch (_e) {}
    const st = getState();
    return (st.campaigns || []).find((c) => c.id === st.activeCampaignId) || { id: 'pmpe', name: 'PMPE — Soldado', examDate: '2027-02-21' };
  };

  const getPool = () => {
    try {
      if (typeof questionPool === 'function') return questionPool() || [];
    } catch (_e) {}
    return Array.isArray(window.ALL_QUESTIONS) ? window.ALL_QUESTIONS : [];
  };

  const getCanonSubj = (raw, ctx = '') => {
    try {
      if (typeof canonicalSubjectName === 'function') return canonicalSubjectName(raw, ctx);
    } catch (_e) {}
    return String(raw || 'Geral').trim() || 'Geral';
  };

  // ── 1. RADAR DE ELIMINAÇÃO (REGRAS REAIS DO EDITAL PMPE / AOCP E PORTAIS) ──
  const PMPE_BLOCKS = [
    { id: 'bloco-1', name: 'Bloco I', minPct: 30, targetQ: 20, subjects: ['Língua Portuguesa', 'História de Pernambuco'] },
    { id: 'bloco-2', name: 'Bloco II', minPct: 30, targetQ: 20, subjects: ['Raciocínio Lógico-Matemático', 'Informática'] },
    { id: 'bloco-3', name: 'Bloco III', minPct: 30, targetQ: 20, subjects: ['Direito Constitucional', 'Legislação Extravagante'] },
  ];

  function getEditalBlocks() {
    const camp = getActiveCampaign();
    const cname = normKey(camp?.name || '');
    if (!cname || cname.includes('pmpe') || cname.includes('pernambuco') || cname.includes('cbmpe')) {
      return PMPE_BLOCKS;
    }
    const missions = camp?.customCampaign?.missions || getState().customCampaign?.missions || [];
    const subjects = [...new Set(missions.map((m) => getCanonSubj(m?.subject || '')).filter(Boolean))];
    if (subjects.length <= 2) {
      return [{ id: 'bloco-1', name: 'Bloco Único', minPct: 30, targetQ: 60, subjects: subjects.length ? subjects : ['Geral'] }];
    }
    const size = Math.ceil(subjects.length / 3);
    return [0, 1, 2].map((idx) => ({
      id: `bloco-${idx + 1}`,
      name: `Bloco ${['I', 'II', 'III'][idx]}`,
      minPct: 30,
      targetQ: 20,
      subjects: subjects.slice(idx * size, (idx + 1) * size),
    })).filter((b) => b.subjects.length);
  }

  function computeEliminationRadar() {
    const st = getState();
    const campId = getCampaignId();
    const blocks = getEditalBlocks();
    const scores = (st.scores || []).filter((s) => !s.campaignId || s.campaignId === campId);

    const bySubj = new Map();
    for (const s of scores) {
      const name = getCanonSubj(s.subject || '', `${s.topic || ''} ${s.name || ''}`);
      const k = normKey(name);
      if (!k) continue;
      const cur = bySubj.get(k) || { name, total: 0, correct: 0 };
      cur.total += Number(s.total || 0);
      cur.correct += Number(s.correct || 0);
      bySubj.set(k, cur);
    }

    const matchSubjectStats = (label) => {
      const k = normKey(label);
      if (bySubj.has(k)) return bySubj.get(k);
      for (const [mk, val] of bySubj.entries()) {
        if (mk.includes(k) || k.includes(mk) || (k.includes('legislacao') && mk.includes('direitos humanos'))) {
          return val;
        }
      }
      return { name: label, total: 0, correct: 0 };
    };

    const blockResults = blocks.map((b) => {
      let total = 0, correct = 0;
      const subs = b.subjects.map((subj) => {
        const s = matchSubjectStats(subj);
        total += s.total;
        correct += s.correct;
        const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
        return { subject: subj, total: s.total, correct: s.correct, pct, zeroed: s.total > 0 && s.correct === 0 };
      });
      const pct = total ? Math.round((correct / total) * 100) : null;
      const atRisk = (pct !== null && pct < b.minPct) || subs.some((s) => s.zeroed);
      return { ...b, total, correct, pct, atRisk, subjectsData: subs };
    });

    const totalAnswered = blockResults.reduce((acc, b) => acc + b.total, 0);
    const totalCorrect = blockResults.reduce((acc, b) => acc + b.correct, 0);
    const overallPct = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;
    const projected60 = overallPct !== null ? Math.round((overallPct / 100) * 60) : null;

    const zeroedSubjects = blockResults.flatMap((b) => b.subjectsData.filter((s) => s.zeroed));
    const lowBlocks = blockResults.filter((b) => b.pct !== null && b.pct < b.minPct);

    let status = 'sem_dados';
    let headline = 'Resolva questões para ativar o Radar de Eliminação do edital.';
    let criticalSubject = blocks[0]?.subjects[0] || 'Língua Portuguesa';

    if (totalAnswered > 0) {
      const allSubs = blockResults.flatMap((b) => b.subjectsData);
      const weakest = [...allSubs].sort((a, b) => {
        const pa = a.pct === null ? -1 : a.pct;
        const pb = b.pct === null ? -1 : b.pct;
        return pa - pb;
      })[0];
      if (zeroedSubjects.length) criticalSubject = zeroedSubjects[0].subject;
      else if (weakest) criticalSubject = weakest.subject;

      if (zeroedSubjects.length) {
        status = 'eliminado';
        headline = `Risco crítico: você zerou ${zeroedSubjects.map((s) => s.subject).join(', ')} (zerar matéria elimina na banca).`;
      } else if (lowBlocks.length) {
        status = 'risco';
        const b0 = lowBlocks[0];
        headline = `Risco de eliminação no ${b0.name}: ${b0.pct}% de acerto (o edital exige mínimo de ${b0.minPct}%).`;
      } else if (projected60 !== null && projected60 < 18) {
        status = 'risco';
        headline = `Projeção atual em ${projected60}/60 pontos (mínimo geral do edital: 18/60).`;
      } else {
        status = 'seguro';
        headline = `Dentro dos mínimos do edital (${overallPct}% geral · projeção ${projected60}/60). Continue subindo para a nota de corte.`;
      }
    }

    return { blocks: blockResults, totalAnswered, totalCorrect, overallPct, projected60, status, headline, criticalSubject };
  }

  function startQuickSubjectTrain(subjectName, count = 15, onlyErrors = false) {
    try {
      if (typeof window.openView === 'function') window.openView('report');
      setTimeout(() => {
        const subjSel = document.querySelector('#questionSubject');
        if (subjSel && subjectName && subjectName !== 'all') {
          const match = [...subjSel.options].find((o) => normKey(o.value) === normKey(subjectName));
          if (match) {
            subjSel.value = match.value;
            subjSel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        const modeSel = document.querySelector('#questionBattleMode');
        if (modeSel && onlyErrors) {
          modeSel.value = 'errors';
          modeSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (typeof window.startSubjectTargetedFix === 'function' && subjectName && subjectName !== 'all' && !onlyErrors) {
          window.startSubjectTargetedFix(subjectName, true);
          return;
        }
        const btn = onlyErrors ? document.querySelector('#startErrorReinforcementBtn') : document.querySelector('#startQuestions');
        if (btn && !btn.disabled) btn.click();
      }, 120);
    } catch (_e) {}
  }

  function renderHomeEliminationRadar() {
    const todayView = document.querySelector('#today');
    if (!todayView) return;
    const radar = computeEliminationRadar();
    let card = document.querySelector('#meEliminationRadarHome');
    if (!card) {
      card = document.createElement('section');
      card.id = 'meEliminationRadarHome';
      card.className = 'card meRadarCard';
      const anchor = document.querySelector('#meTodayMissionCard') || document.querySelector('#today .desktopGrid');
      if (anchor) anchor.insertAdjacentElement('afterend', card);
      else todayView.prepend(card);
    }
    const tone = radar.status === 'eliminado' ? 'danger' : radar.status === 'risco' ? 'warn' : radar.status === 'seguro' ? 'ok' : 'neutral';
    card.dataset.tone = tone;
    card.innerHTML = `
      <div class="meRadarHead">
        <div>
          <span class="mePill mePill--${tone}">${radar.status === 'eliminado' ? '🚨 RISCO DE ELIMINAÇÃO' : radar.status === 'risco' ? '⚠️ RADAR DE ELIMINAÇÃO' : radar.status === 'seguro' ? '✓ ACIMA DOS MÍNIMOS' : '📡 RADAR DO EDITAL'}</span>
          <h3 class="meRadarTitle">${esc(radar.headline)}</h3>
        </div>
        <button type="button" class="action small meRadarBtn" data-me-train="${esc(radar.criticalSubject)}">Treinar agora →</button>
      </div>
      <div class="meBlockGrid">
        ${radar.blocks.map((b) => `
          <div class="meBlockItem ${b.atRisk ? 'isRisk' : ''}">
            <div class="meBlockTop">
              <b>${esc(b.name)}</b>
              <span>${b.pct !== null ? `${b.pct}%` : 'Sem dados'} <small>(mín. ${b.minPct}%)</small></span>
            </div>
            <div class="meBlockTrack"><i style="width:${Math.min(100, b.pct || 0)}%"></i><s style="left:${b.minPct}%" title="Mínimo ${b.minPct}%"></s></div>
            <div class="meBlockSubs">${b.subjectsData.map((s) => `<span class="${s.zeroed ? 'isZero' : ''}">${esc(s.subject.split(' ')[0])}: ${s.pct !== null ? `${s.pct}%` : '—'}</span>`).join(' · ')}</div>
          </div>
        `).join('')}
      </div>
    `;
    const btn = card.querySelector('[data-me-train]');
    if (btn) btn.onclick = () => startQuickSubjectTrain(btn.dataset.meTrain, 15, false);
  }

  // ── 2. CARD "MISSÃO DE HOJE" NA HOME ──
  function getTodayMissionBlocks() {
    const st = getState();
    const day = todayKey();
    const campId = getCampaignId();
    const radar = computeEliminationRadar();
    const allSubs = radar.blocks.flatMap((b) => b.subjectsData);
    const ranked = [...allSubs].sort((a, b) => {
      const pa = a.pct === null ? -1 : a.pct;
      const pb = b.pct === null ? -1 : b.pct;
      return pa - pb || a.total - b.total;
    });
    const top2 = ranked.slice(0, 2);
    if (!top2.length) {
      top2.push({ subject: 'Língua Portuguesa', pct: null }, { subject: 'História de Pernambuco', pct: null });
    }
    const todayScores = (st.scores || []).filter((s) => (!s.campaignId || s.campaignId === campId) && String(s.date || '').slice(0, 10) === day);
    return top2.map((item, idx) => {
      const done = todayScores
        .filter((s) => normKey(getCanonSubj(s.subject || '')) === normKey(item.subject))
        .reduce((acc, s) => acc + Number(s.total || 0), 0);
      const target = 15;
      return {
        idx,
        subject: item.subject,
        target,
        done: Math.min(target, done),
        completed: done >= target,
        minutes: 35,
      };
    });
  }

  function renderHomeTodayMission() {
    const todayView = document.querySelector('#today');
    if (!todayView) return;
    let card = document.querySelector('#meTodayMissionCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'meTodayMissionCard';
      card.className = 'card meTodayMission';
      const grid = document.querySelector('#today .desktopGrid');
      if (grid) grid.insertAdjacentElement('beforebegin', card);
      else todayView.prepend(card);
    }
    const blocks = getTodayMissionBlocks();
    const doneBlocks = blocks.filter((b) => b.completed).length;
    const nextBlock = blocks.find((b) => !b.completed) || blocks[0];
    const dueCount = typeof dueReviews === 'function' ? dueReviews().length : 0;
    const errCount = Object.values(getState().errors || {}).filter((e) => !e.campaignId || e.campaignId === getCampaignId()).length;

    card.innerHTML = `
      <div class="meMissionHead">
        <div>
          <span class="meMissionCount">${doneBlocks}/${blocks.length}</span>
          <strong class="meMissionTitle">⚡ Missão de hoje</strong>
          <span class="small muted">Concluir mantém sua ofensiva viva</span>
        </div>
        <button type="button" class="action meMissionCta" data-me-continue="${esc(nextBlock.subject)}">Continuar missão →</button>
      </div>
      <div class="meMissionList">
        ${blocks.map((b) => `
          <button type="button" class="meMissionRow ${b.completed ? 'done' : ''}" data-me-block-subj="${esc(b.subject)}">
            <span class="meMissionCheck">${b.completed ? '✓' : '○'}</span>
            <span class="meMissionBody">
              <b>${b.target} questões de ${esc(b.subject)}</b>
              <small>~${b.minutes} min · foco nos pontos críticos do edital</small>
            </span>
            <span class="meMissionProg">${b.done}/${b.target} ›</span>
          </button>
        `).join('')}
      </div>
      <div class="meMissionFoot">
        <button type="button" class="ghost small" data-me-open="review">🔄 ${dueCount} revisões · ${errCount} erros para refazer ›</button>
        <button type="button" class="ghost small" data-me-open="study">🗂️ Flashcards e resumos ›</button>
      </div>
    `;

    card.querySelector('[data-me-continue]')?.addEventListener('click', (e) => {
      startQuickSubjectTrain(e.currentTarget.dataset.meContinue, 15, false);
    });
    card.querySelectorAll('[data-me-block-subj]').forEach((btn) => {
      btn.onclick = () => startQuickSubjectTrain(btn.dataset.meBlockSubj, 15, false);
    });
    card.querySelectorAll('[data-me-open]').forEach((btn) => {
      btn.onclick = () => window.openView?.(btn.dataset.meOpen);
    });
  }

  // ── 3. CADERNO DE ERROS 2.0 — REINCIDENTE (2+x) + REFAZER TODAS ──
  function enhanceErrorNotebookReincidente() {
    const reviewView = document.querySelector('#review');
    if (!reviewView) return;
    const st = getState();
    const campId = getCampaignId();
    const allErrors = Object.entries(st.errors || {}).filter(([, e]) => !e.campaignId || e.campaignId === campId);
    const reincidentes = allErrors.filter(([, e]) => Number(e?.misses || 1) >= 2);
    const resolvedCount = Number(st.resolvedErrorsCount?.[campId] || 0);

    let bar = document.querySelector('#meErrorNotebookBar');
    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'meErrorNotebookBar';
      bar.className = 'card meErrorBar';
      const head = reviewView.querySelector('.sectionHead');
      if (head) head.insertAdjacentElement('afterend', bar);
      else reviewView.prepend(bar);
    }

    const bySubj = new Map();
    for (const [, e] of allErrors) {
      const s = getCanonSubj(e?.subject || 'Geral');
      const cur = bySubj.get(s) || { total: 0, reinc: 0 };
      cur.total += 1;
      if (Number(e?.misses || 1) >= 2) cur.reinc += 1;
      bySubj.set(s, cur);
    }
    const subjRows = [...bySubj.entries()].sort((a, b) => b[1].reinc - a[1].reinc || b[1].total - a[1].total);

    bar.innerHTML = `
      <div class="meErrHeader">
        <div>
          <div class="eyebrow">CADERNO DE ERROS INTELIGENTE</div>
          <h3 style="margin:2px 0 0">Acertou ao refazer, a questão sai da fila</h3>
        </div>
        <button type="button" class="action small" id="meRedoAllErrorsBtn" ${allErrors.length ? '' : 'disabled'}>🎯 Refazer todas as erradas (${allErrors.length})</button>
      </div>
      <div class="meErrKpis">
        <div class="meErrKpi"><b>${allErrors.length}</b><span>para refazer</span></div>
        <div class="meErrKpi isHot"><b>${reincidentes.length}</b><span>errou 2+ vezes</span></div>
        <div class="meErrKpi isOk"><b>${resolvedCount}</b><span>resolvidas</span></div>
      </div>
      ${subjRows.length ? `
        <div class="meErrSubjList">
          ${subjRows.map(([subj, info]) => `
            <div class="meErrSubjRow">
              <span><b>${esc(subj)}</b> <small class="muted">${info.total} para refazer</small> ${info.reinc ? `<span class="meReincBadge">🔥 ${info.reinc} reincidente${info.reinc > 1 ? 's' : ''}</span>` : ''}</span>
              <button type="button" class="ghost small" data-me-redo-subj="${esc(subj)}">Refazer ›</button>
            </div>
          `).join('')}
        </div>
      ` : '<p class="small muted" style="margin:8px 0 0">Nenhum erro pendente neste portal. Ótimo ritmo!</p>'}
    `;

    bar.querySelector('#meRedoAllErrorsBtn')?.addEventListener('click', () => startQuickSubjectTrain('all', 15, true));
    bar.querySelectorAll('[data-me-redo-subj]').forEach((btn) => {
      btn.onclick = () => startQuickSubjectTrain(btn.dataset.meRedoSubj, 10, true);
    });
  }

  // ── 4. FEEDBACK DE ERRO ESTRUTURADO + 5. BOTÃO REPORTAR ERRO ──
  function getActiveQuestionItem() {
    try {
      if (typeof activeQuestions === 'object' && activeQuestions?.questions) {
        const idx = Number(activeQuestions.index ?? activeQuestions.current ?? 0);
        return activeQuestions.questions[idx] || null;
      }
    } catch (_e) {}
    return null;
  }

  function inferTrapHint(item, chosenIdx) {
    const stmt = String(item?.statement || '');
    if (/\b(exceto|incorret[ao]|errad[ao]|falso|falsa|não\s+é)\b/i.test(stmt)) {
      return 'Comando invertido (EXCETO / INCORRETA) — atenção à negação no enunciado.';
    }
    if (/\b(sempre|nunca|apenas|somente|exclusivamente|jamais)\b/i.test(String(item?.options?.[chosenIdx] || ''))) {
      return 'Termo absoluto/restritivo na alternativa marcada (ex.: "sempre", "apenas", "nunca").';
    }
    if (/\b(art\.|artigo|lei|decreto|súmula|constituição)\b/i.test(stmt)) {
      return 'Troca sutil de letra de lei, prazo, competência ou exceção legal.';
    }
    return 'Distrator clássico da banca — compare a palavra-chave do comando com a alternativa correta.';
  }

  function openReportQuestionDialog(item) {
    let dlg = document.querySelector('#meReportQuestionDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'meReportQuestionDialog';
      dlg.className = 'meReportDialog';
      dlg.innerHTML = `
        <div class="sectionHead">
          <div>
            <div class="eyebrow">QUALIDADE DO BANCO</div>
            <h3 style="margin:2px 0 0">⚑ Reportar erro nesta questão</h3>
          </div>
          <button type="button" class="ghost small" id="meCloseReportDlg">Fechar</button>
        </div>
        <p class="small muted" id="meReportQuestionPreview" style="margin:8px 0 12px"></p>
        <div class="meReportReasons">
          <label><input type="radio" name="meReportReason" value="enunciado_incompleto" checked> Enunciado incompleto ou texto-base ausente</label>
          <label><input type="radio" name="meReportReason" value="gabarito_incorreto"> Gabarito parece incorreto ou desatualizado</label>
          <label><input type="radio" name="meReportReason" value="alternativa_defeito"> Alternativa truncada ou duplicada</label>
          <label><input type="radio" name="meReportReason" value="disciplina_errada"> Disciplina ou tópico trocado</label>
        </div>
        <label class="field" style="margin-top:10px">
          <span>Observação opcional</span>
          <textarea id="meReportNote" rows="3" maxlength="400" placeholder="Ex.: falta o texto-base citado no enunciado..."></textarea>
        </label>
        <div class="modalActions" style="margin-top:12px">
          <button type="button" class="ghost" id="meCancelReportBtn">Cancelar</button>
          <button type="button" class="action" id="meSubmitReportBtn">Enviar reporte</button>
        </div>
      `;
      document.body.appendChild(dlg);
      dlg.querySelector('#meCloseReportDlg').onclick = () => dlg.close();
      dlg.querySelector('#meCancelReportBtn').onclick = () => dlg.close();
    }
    const preview = dlg.querySelector('#meReportQuestionPreview');
    if (preview) preview.textContent = String(item?.statement || '').slice(0, 140) + (String(item?.statement || '').length > 140 ? '…' : '');
    const noteEl = dlg.querySelector('#meReportNote');
    if (noteEl) noteEl.value = '';
    dlg.querySelector('#meSubmitReportBtn').onclick = () => {
      const reason = dlg.querySelector('input[name="meReportReason"]:checked')?.value || 'outro';
      const note = (noteEl?.value || '').trim();
      const st = getState();
      st.questionErrorReports = Array.isArray(st.questionErrorReports) ? st.questionErrorReports : [];
      st.questionErrorReports.unshift({
        id: item?.id || item?._fp || `q_${Date.now()}`,
        subject: item?.subject || '',
        topic: item?.topic || '',
        reason,
        note,
        at: new Date().toISOString(),
        campaignId: getCampaignId(),
      });
      st.questionErrorReports = st.questionErrorReports.slice(0, 200);
      try { if (typeof save === 'function') save(); } catch (_e) {}
      dlg.close();
      if (typeof toast === 'function') toast('⚑ Reporte registrado para revisão humana. Obrigado por ajudar a melhorar o banco!');
    };
    if (!dlg.open) dlg.showModal();
  }

  function bindQuestionFeedbackObserver() {
    const fb = document.querySelector('#questionFeedback');
    const dlg = document.querySelector('#questionDialog');
    if (!fb || !dlg || fb.dataset.meBound) return;
    fb.dataset.meBound = '1';

    // Adiciona botão Reportar erro no rodapé do modal de questões
    const footer = dlg.querySelector('.qModalFooterBar');
    if (footer && !dlg.querySelector('#meReportQuestionBtn')) {
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.id = 'meReportQuestionBtn';
      reportBtn.className = 'ghost small meReportBtn';
      reportBtn.textContent = '⚑ Reportar erro nesta questão';
      reportBtn.onclick = () => openReportQuestionDialog(getActiveQuestionItem());
      footer.appendChild(reportBtn);
    }

    let rafId = 0;
    const obs = new MutationObserver(() => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!fb.textContent.trim() || fb.querySelector('.meFeedbackExtra')) return;
        const item = getActiveQuestionItem();
        if (!item) return;
        const wrong = fb.classList.contains('wrong') || /você errou|incorret|errou/i.test(fb.textContent);
        const subj = getCanonSubj(item.subject || 'Geral');
        const topic = item.topic || subj;
        const extra = document.createElement('div');
        extra.className = 'meFeedbackExtra';
        const chosenIdx = Number(item._lastChosenIndex ?? -1);
        const trapHtml = wrong
          ? `<div class="meTrapPill"><strong>🎯 Pegadinha da banca:</strong> ${esc(inferTrapHint(item, chosenIdx))}</div>`
          : '';
        const otherOpts = Array.isArray(item.options)
          ? item.options.map((opt, idx) => idx !== Number(item.correct_index) ? `<li><b>${String.fromCharCode(65 + idx)})</b> ${esc(String(opt).slice(0, 160))}</li>` : '').filter(Boolean).join('')
          : '';
        extra.innerHTML = `
          ${trapHtml}
          ${otherOpts ? `<details class="meOtherOpts"><summary>Ver as outras alternativas (${item.options.length - 1})</summary><ul>${otherOpts}</ul></details>` : ''}
          <div class="meFeedbackActions">
            <button type="button" class="ghost small" data-me-open-classroom="1">🎓 Abrir Aula do Invocador sobre este tema</button>
            <button type="button" class="ghost small" data-me-report-inline="1">⚑ Reportar erro</button>
          </div>
        `;
        fb.appendChild(extra);
        extra.querySelector('[data-me-open-classroom]')?.addEventListener('click', () => {
          try { dlg.close(); } catch (_e) {}
          if (typeof window.openInvocadorClassroom === 'function') {
            window.openInvocadorClassroom({ subject: subj, topic });
          } else {
            window.openView?.('assistant');
            setTimeout(() => {
              const inp = document.querySelector('#assistantInput');
              if (inp) {
                inp.value = `Explique de forma clara o tema "${topic}" (${subj}) e a pegadinha principal desta questão.`;
                inp.focus();
              }
            }, 140);
          }
        });
        extra.querySelector('[data-me-report-inline]')?.addEventListener('click', () => openReportQuestionDialog(item));
      });
    });
    obs.observe(fb, { childList: true });
  }

  // ── 6. REDAÇÃO 2.0 — 4 CRITÉRIOS (0–40, MÍN 12) + SUBLINHADO INLINE ──
  const ESSAY_CRITERIA_NAMES = [
    'Tema, informatividade e argumentação',
    'Coesão e coerência',
    'Estrutura do texto e dos parágrafos',
    'Gramática e norma culta',
  ];

  function extractEssayScore40(essay) {
    const r = essay?.result || {};
    const raw = Number(r.score ?? r.nota ?? r.total_score ?? r.grade ?? NaN);
    if (!Number.isFinite(raw)) return null;
    if (raw > 40 && raw <= 100) return Math.round((raw / 100) * 40 * 10) / 10;
    if (raw > 100 && raw <= 1000) return Math.round((raw / 1000) * 40 * 10) / 10;
    return Math.min(40, Math.max(0, raw));
  }

  function highlightEssayText(text, highlights = []) {
    if (!text) return '';
    let html = esc(text);
    const list = Array.isArray(highlights) && highlights.length
      ? highlights
      : [
          { excerpt: 'uma coisa', note: 'Evite termos vagos/coloquiais; substitua por expressão precisa.' },
          { excerpt: 'hoje em dia', note: 'Clichê redacional; prefira "na contemporaneidade" ou "atualmente".' },
          { excerpt: 'a gente', note: 'Registro informal inadequado à norma culta dissertativa.' },
        ];
    let idx = 0;
    for (const h of list) {
      const ex = String(h?.excerpt || h?.trecho || h?.quote || '').trim();
      if (!ex || ex.length < 3) continue;
      const escapedEx = esc(ex);
      const pos = html.toLowerCase().indexOf(escapedEx.toLowerCase());
      if (pos !== -1) {
        idx += 1;
        const orig = html.slice(pos, pos + escapedEx.length);
        const tip = esc(h?.note || h?.correcao || h?.motivo || 'Trecho sinalizado para revisão.');
        html = html.slice(0, pos)
          + `<mark class="meEssayMark" title="${tip}">${orig}<sup>${idx}</sup></mark>`
          + html.slice(pos + escapedEx.length);
      }
    }
    return html.replace(/\n/g, '<br>');
  }

  function enhanceEssayView40() {
    const essayView = document.querySelector('#essay');
    if (!essayView) return;
    const essays = Array.isArray(window.cloudEssays) ? window.cloudEssays : [];
    const scored = essays.map((e) => ({ essay: e, score40: extractEssayScore40(e) })).filter((x) => x.score40 !== null);

    let panel = document.querySelector('#meEssayCriteriaPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'meEssayCriteriaPanel';
      panel.className = 'card meEssayPanel';
      const head = essayView.querySelector('.sectionHead');
      if (head) head.insertAdjacentElement('afterend', panel);
      else essayView.prepend(panel);
    }

    const avg40 = scored.length ? Math.round((scored.reduce((a, b) => a + b.score40, 0) / scored.length) * 10) / 10 : null;
    const critAvgs = ESSAY_CRITERIA_NAMES.map((label, i) => {
      const vals = scored.map(({ essay, score40 }) => {
        const crits = essay?.result?.criteria || essay?.result?.criterios;
        if (Array.isArray(crits) && crits[i] && Number.isFinite(Number(crits[i].score ?? crits[i].nota))) {
          const v = Number(crits[i].score ?? crits[i].nota);
          return v > 10 ? Math.round((v / 100) * 10 * 10) / 10 : v;
        }
        return Math.round((score40 / 4) * 10) / 10;
      });
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      return { label, avg };
    });

    const latest = scored[0];
    const latestText = latest?.essay?.text_content || latest?.essay?.content || latest?.essay?.result?.transcricao || '';
    const latestMarks = latest?.essay?.result?.highlights || latest?.essay?.result?.erros_trechos || [];

    panel.innerHTML = `
      <div class="meEssayTop">
        <div>
          <div class="eyebrow">PADRÃO BANCA AOCP · 0 A 40 PONTOS</div>
          <h3 style="margin:2px 0 0">Sua média por critério</h3>
        </div>
        ${avg40 !== null
          ? `<span class="mePill ${avg40 >= 12 ? 'mePill--ok' : 'mePill--danger'}">${avg40 >= 12 ? `✓ Média ${avg40}/40 (mín. 12)` : `🚨 Média ${avg40}/40 (abaixo de 12 elimina)`}</span>`
          : '<span class="mePill mePill--neutral">Mínimo do edital: 12/40</span>'}
      </div>
      <div class="meEssayCritGrid">
        ${critAvgs.map((c) => `
          <div class="meEssayCritRow">
            <div class="meEssayCritHead"><span>${esc(c.label)}</span><b>${c.avg !== null ? `${c.avg} / 10` : '— / 10'}</b></div>
            <div class="meBlockTrack"><i style="width:${c.avg !== null ? Math.min(100, c.avg * 10) : 0}%"></i></div>
          </div>
        `).join('')}
      </div>
      ${latestText ? `
        <details class="meEssayHighlightBox">
          <summary>🔍 Ver marcações inline na sua última redação</summary>
          <div class="meEssayMarkedText">${highlightEssayText(latestText, latestMarks)}</div>
        </details>
      ` : ''}
    `;
  }

  // ── 7. SIMULADO 2.0 — MARCAR PARA REVISAR + TEMPO ATIVO + COMPARATIVO ──
  let simActiveSec = 0;
  let simActiveTimer = null;
  let lastInteractionTs = Date.now();

  function startActiveSimuladoClock() {
    if (simActiveTimer) clearInterval(simActiveTimer);
    simActiveSec = 0;
    lastInteractionTs = Date.now();
    simActiveTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && (Date.now() - lastInteractionTs) < 60_000) {
        simActiveSec += 1;
      }
    }, 1000);
  }

  ['click', 'keydown', 'touchstart'].forEach((ev) => {
    document.addEventListener(ev, () => { lastInteractionTs = Date.now(); }, { passive: true });
  });

  function onSimuladoQuestionRendered(activeSim, item, currentIdx) {
    if (!activeSim) return;
    if (!activeSim._meClockStarted) {
      activeSim._meClockStarted = true;
      activeSim.markedReview = activeSim.markedReview || new Set();
      startActiveSimuladoClock();
    }
    const marked = activeSim.markedReview instanceof Set ? activeSim.markedReview : (activeSim.markedReview = new Set());
    const metaEl = document.querySelector('#simuladoQuestionMeta');
    if (metaEl) {
      let actions = document.querySelector('#meSimQuestionActions');
      if (!actions) {
        actions = document.createElement('div');
        actions.id = 'meSimQuestionActions';
        actions.className = 'meSimActions';
        metaEl.insertAdjacentElement('afterend', actions);
      }
      const isMarked = marked.has(currentIdx);
      actions.innerHTML = `
        <button type="button" class="ghost small ${isMarked ? 'isMarked' : ''}" id="meMarkReviewBtn">${isMarked ? '★ Marcada para revisar' : '☆ Marcar para revisar'}</button>
        <button type="button" class="ghost small" id="meSimReportBtn">⚑ Reportar erro</button>
      `;
      actions.querySelector('#meMarkReviewBtn').onclick = () => {
        if (marked.has(currentIdx)) marked.delete(currentIdx);
        else marked.add(currentIdx);
        onSimuladoQuestionRendered(activeSim, item, currentIdx);
      };
      actions.querySelector('#meSimReportBtn').onclick = () => openReportQuestionDialog(item);
    }
    // Destaca na folha de respostas as questões marcadas para revisar
    document.querySelectorAll('#simuladoSheetGrid .sheetBubble').forEach((b) => {
      const idx = Number(b.dataset.simuladoJump);
      b.classList.toggle('markedReview', marked.has(idx));
    });
  }

  function onTimedSimuladoFinished(info) {
    if (simActiveTimer) { clearInterval(simActiveTimer); simActiveTimer = null; }
    const st = getState();
    const campId = getCampaignId();
    st.simuladoHistory = Array.isArray(st.simuladoHistory) ? st.simuladoHistory : [];
    const totalQ = info.questions?.length || 1;
    const pct = Math.round((info.totalCorrect / totalQ) * 100);
    const avgSecPerQ = Math.max(1, Math.round((info.elapsedSeconds || 1) / totalQ));
    const prev = st.simuladoHistory.find((h) => h.campaignId === campId) || null;
    const entry = {
      sessionId: info.sessionId,
      campaignId: campId,
      date: new Date().toISOString(),
      totalQ,
      correct: info.totalCorrect,
      wrong: info.totalWrong,
      blank: info.totalBlank,
      pct,
      elapsedSeconds: info.elapsedSeconds,
      activeSeconds: Math.min(info.elapsedSeconds, simActiveSec || info.elapsedSeconds),
      avgSecPerQ,
      zeroedSubjects: Object.entries(info.bySubject || {}).filter(([, d]) => d.total > 0 && d.correct === 0).map(([s]) => s),
    };
    st.simuladoHistory.unshift(entry);
    st.simuladoHistory = st.simuladoHistory.slice(0, 20);

    // Injeta card de métricas extras no resultado do simulado logo após renderizar
    setTimeout(() => {
      const target = document.querySelector('#simuladoResultSummary') || document.querySelector('#simuladoDialog .card');
      if (!target || target.querySelector('#meSimResultExtra')) return;
      const diffPct = prev ? pct - prev.pct : null;
      const box = document.createElement('div');
      box.id = 'meSimResultExtra';
      box.className = 'meSimSummaryBox';
      box.innerHTML = `
        <div class="meErrKpis">
          <div class="meErrKpi"><b>${Math.round(entry.elapsedSeconds / 60)} min</b><span>tempo total</span></div>
          <div class="meErrKpi"><b>${Math.round(entry.activeSeconds / 60)} min</b><span>tempo ativo</span></div>
          <div class="meErrKpi"><b>${entry.avgSecPerQ}s</b><span>média / questão</span></div>
          <div class="meErrKpi ${diffPct !== null && diffPct >= 0 ? 'isOk' : ''}"><b>${diffPct === null ? '1º' : `${diffPct >= 0 ? '+' : ''}${diffPct}%`}</b><span>vs. anterior</span></div>
        </div>
        ${entry.zeroedSubjects.length ? `<div class="meTrapPill" style="margin-top:8px">🚨 <b>Atenção (Regra do Edital):</b> você zerou ${esc(entry.zeroedSubjects.join(', '))} neste simulado.</div>` : ''}
      `;
      target.prepend(box);
    }, 120);
  }

  // ── 8. CRONOGRAMA ADAPTATIVO + HEATMAP DE ATIVIDADE SEMANAL ──
  function renderAdaptiveScheduleAndHeatmap() {
    const mapView = document.querySelector('#map');
    if (!mapView) return;
    const st = getState();
    const camp = getActiveCampaign();
    const examDateStr = camp?.examDate || camp?.exam_date || '2027-02-21';
    const today = new Date(`${todayKey()}T12:00:00`);
    const examDate = new Date(`${examDateStr}T12:00:00`);
    const daysLeft = Math.max(1, Math.ceil((examDate - today) / 86_400_000));

    const missions = camp?.customCampaign?.missions || st.customCampaign?.missions || [];
    const doneMap = st.done || {};
    const remainingMissions = missions.filter((m) => !doneMap[m.id]).length;
    const studyDaysPerWeek = Array.isArray(st.settings?.studyDays) && st.settings.studyDays.length ? st.settings.studyDays.length : 6;
    const effectiveStudyDays = Math.max(1, Math.round(daysLeft * (studyDaysPerWeek / 7)));
    const topicsPerDay = remainingMissions ? Math.max(1, Math.ceil(remainingMissions / effectiveStudyDays)) : 0;

    // Monta últimas 8 semanas (56 dias) para o heatmap
    const actDays = st.activityDays || {};
    const studyByDay = st.studyByDay || {};
    const cells = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const mins = Number(studyByDay[key] || 0);
      const active = Boolean(actDays[key]) || mins > 0;
      const lvl = mins >= 90 ? 3 : mins >= 35 ? 2 : active ? 1 : 0;
      cells.push({ key, mins, lvl });
    }

    let panel = document.querySelector('#meAdaptiveScheduleCard');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'meAdaptiveScheduleCard';
      panel.className = 'card meScheduleCard';
      const anchor = mapView.querySelector('#reverseScheduleCard') || mapView.querySelector('.card');
      if (anchor) anchor.insertAdjacentElement('beforebegin', panel);
      else mapView.prepend(panel);
    }

    panel.innerHTML = `
      <div class="meRadarHead">
        <div>
          <div class="eyebrow">CRONOGRAMA ADAPTATIVO · PROVA EM ${daysLeft} DIAS</div>
          <h3 style="margin:2px 0 0">Atrasou um dia? O plano se ajusta sozinho</h3>
          <p class="small muted" style="margin:4px 0 0">${remainingMissions} tópico(s) restante(s) distribuídos em ~${effectiveStudyDays} dias úteis de estudo (${topicsPerDay || 1} tópico/dia até ${esc(examDateStr.split('-').reverse().join('/'))}).</p>
        </div>
        <button type="button" class="ghost small" id="meRecalcScheduleBtn">🔄 Recalcular plano</button>
      </div>
      <div class="meHeatmapWrap">
        <div class="small muted" style="margin-bottom:6px">Constância nas últimas 8 semanas</div>
        <div class="meHeatmapGrid">
          ${cells.map((c) => `<span class="meHeatCell lvl${c.lvl}" title="${c.key}${c.mins ? ` · ${c.mins} min` : ''}"></span>`).join('')}
        </div>
      </div>
    `;

    panel.querySelector('#meRecalcScheduleBtn').onclick = () => {
      st._lastScheduleRecalc = new Date().toISOString();
      try {
        if (typeof save === 'function') save();
        if (typeof renderReverseSchedule === 'function') renderReverseSchedule();
      } catch (_e) {}
      renderAdaptiveScheduleAndHeatmap();
      if (typeof toast === 'function') toast(`🔄 Cronograma recalculado: meta atualizada para ${topicsPerDay || 1} tópico(s) por dia de estudo até a prova!`);
    };
  }

  // ── ORQUESTRAÇÃO LEVE POR ABA (ZERO TRAVAMENTO) ──
  function onViewEnhanced(id) {
    if (id === 'today') {
      renderHomeTodayMission();
      renderHomeEliminationRadar();
    } else if (id === 'review') {
      enhanceErrorNotebookReincidente();
    } else if (id === 'essay') {
      enhanceEssayView40();
    } else if (id === 'map') {
      renderAdaptiveScheduleAndHeatmap();
    }
    bindQuestionFeedbackObserver();
  }

  window.JCMissaoElite = {
    version: 'r196',
    computeEliminationRadar,
    getTodayMissionBlocks,
    highlightEssayText,
    onViewEnhanced,
    onSimuladoQuestionRendered,
    onTimedSimuladoFinished,
    openReportQuestionDialog,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const activeId = document.querySelector('.view.active')?.id || 'today';
      onViewEnhanced(activeId);
    });
  } else {
    const activeId = document.querySelector('.view.active')?.id || 'today';
    setTimeout(() => onViewEnhanced(activeId), 40);
  }
})();
