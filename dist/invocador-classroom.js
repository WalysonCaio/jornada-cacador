// r188: Modo Aula Interativa do Invocador (inspirado no THU-MAIC/OpenMAIC, leve para Cloudflare + Supabase)
// - 1 única chamada de IA gera 4-6 slides + quadro tático + dúvidas da turma + mini-quiz formativo (3 questões)
// - Isolado por conta, portal e reset; descarta respostas tardias; exporta HTML offline 100% escapado contra XSS.
(() => {
  'use strict';
  const w = window;
  const STORE_KEY = 'jornada-invocador-classroom-v188';
  let activeLesson = null;
  let activeSlideIndex = 0;
  let activePeerIdx = -1;
  let quizAnswers = {};
  let busy = false;
  let activeRequestToken = 0;
  let statusMessage = '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function hashKey(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function currentScope() {
    let st = {}, sess = null;
    try {
      st = typeof state === 'object' && state ? state : (w.state || {});
      sess = typeof cloudSession === 'object' && cloudSession ? cloudSession : (w.cloudSession || null);
    } catch (_e) {}
    const userId = String(sess?.user?.id || st._ownerUserId || 'guest');
    const campaignId = String(st.activeCampaignId || 'default');
    const resetEpoch = Number(st._resetEpoch || 0);
    return { userId, campaignId, resetEpoch, key: `${userId}::${campaignId}::${resetEpoch}` };
  }

  function sameScope(snap) {
    const now = currentScope();
    return Boolean(snap && now.userId === snap.userId && now.campaignId === snap.campaignId && now.resetEpoch === snap.resetEpoch);
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch (_e) {
      return {};
    }
  }

  function saveStore(data) {
    try {
      const entries = Object.entries(data || {}).slice(-25);
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_e) {}
  }

  function gatherTopicContext(topicStr) {
    let summaries = [];
    try {
      summaries = typeof ALL_SUMMARIES !== 'undefined' && Array.isArray(ALL_SUMMARIES) ? ALL_SUMMARIES : (w.ALL_SUMMARIES || []);
    } catch (_e) {}
    const needle = String(topicStr || '').toLowerCase().trim();
    if (!needle || !summaries.length) return '';
    const tokens = needle.split(/\s+/).filter(t => t.length >= 3);
    const matched = summaries.filter(s => {
      if (!s || w.isHunterManualArtifact?.(s)) return false;
      const hay = `${s.category || ''} ${s.title || ''} ${s.explanation || ''}`.toLowerCase();
      return tokens.some(tk => hay.includes(tk));
    }).slice(0, 4);
    return matched.map(s => `[MATERIAL: ${s.source || s.title}] (${s.category || ''})\n${s.title}\n${s.explanation || ''}\n${(s.points || []).join('; ')}`).join('\n\n').slice(0, 8000);
  }

  function buildClassroomPrompt(topic, subject) {
    return [
      `Monte uma AULA INTERATIVA para concurso público sobre o tema: "${topic}"${subject ? ` (Disciplina: ${subject})` : ''}.`,
      'Responda EXCLUSIVAMENTE com um JSON válido (sem texto fora do JSON) seguindo exatamente este formato:',
      '{',
      '  "title": "Título didático da aula",',
      '  "subject": "Disciplina",',
      '  "overview": "Resumo objetivo em 2 frases do que o aluno vai dominar",',
      '  "slides": [',
      '    {',
      '      "title": "Título do slide",',
      '      "body": "Explicação clara e direta em 1 parágrafo",',
      '      "board_box": "Quadro tático: fórmula, esquema, artigo ou mnemônico curto",',
      '      "example": "Exemplo prático de prova",',
      '      "trap": "Pegadinha frequente de banca",',
      '      "classmate_questions": [',
      '        { "q": "Dúvida típica de colega de sala?", "a": "Resposta direta em 2 frases." },',
      '        { "q": "Segunda dúvida comum de prova?", "a": "Resposta direta em 2 frases." }',
      '      ]',
      '    }',
      '  ],',
      '  "quiz": [',
      '    {',
      '      "statement": "Enunciado curto de fixação",',
      '      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],',
      '      "correct_index": 0,',
      '      "explanation": "Explicação curta do porquê."',
      '    }',
      '  ]',
      '}',
      'Regras: gere entre 4 e 6 slides e exatamente 3 questões de fixação no quiz. Não invente artigos ou leis inexistentes.'
    ].join('\n');
  }

  function parseClassroomResponse(rawAnswer, fallbackTopic, fallbackSubject) {
    const raw = String(rawAnswer || '').trim();
    let parsed = null;
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenceMatch ? fenceMatch[1].trim() : raw;
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          parsed = JSON.parse(candidate.slice(start, end + 1));
        } catch (_e) {
          parsed = null;
        }
      }
    }

    if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      const slides = parsed.slides.slice(0, 6).map((sl, idx) => ({
        title: String(sl?.title || `Slide ${idx + 1}`).trim(),
        body: String(sl?.body || '').trim(),
        board_box: String(sl?.board_box || '').trim(),
        example: String(sl?.example || '').trim(),
        trap: String(sl?.trap || '').trim(),
        classmate_questions: Array.isArray(sl?.classmate_questions)
          ? sl.classmate_questions.slice(0, 3).filter(c => c && c.q && c.a).map(c => ({ q: String(c.q).trim(), a: String(c.a).trim() }))
          : []
      })).filter(sl => sl.body || sl.board_box);

      const quiz = Array.isArray(parsed.quiz)
        ? parsed.quiz.slice(0, 5).filter(q => q && q.statement && Array.isArray(q.options) && q.options.length >= 2).map(q => {
            const opts = q.options.slice(0, 5).map(o => String(o || '').trim()).filter(Boolean);
            const idx = Number.isInteger(Number(q.correct_index)) && Number(q.correct_index) >= 0 && Number(q.correct_index) < opts.length ? Number(q.correct_index) : 0;
            return {
              statement: String(q.statement).trim(),
              options: opts,
              correct_index: idx,
              explanation: String(q.explanation || '').trim()
            };
          })
        : [];

      if (slides.length > 0) {
        return {
          title: String(parsed.title || fallbackTopic || 'Aula do Invocador').trim(),
          subject: String(parsed.subject || fallbackSubject || 'Estudo Direcionado').trim(),
          overview: String(parsed.overview || '').trim(),
          slides,
          quiz,
          createdAt: new Date().toISOString(),
          aiFormativeNotice: 'Prática formativa gerada por IA — não altera ranking, XP oficial nem substitui gabarito de banca.'
        };
      }
    }

    // Fallback seguro caso o modelo devolva texto livre em vez de JSON
    const chunks = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 4);
    return {
      title: String(fallbackTopic || 'Aula do Invocador').trim(),
      subject: String(fallbackSubject || 'Estudo Direcionado').trim(),
      overview: 'Aula estruturada a partir da explicação do Invocador.',
      slides: (chunks.length ? chunks : ['Conteúdo recebido sem divisão em slides.']).map((txt, idx) => ({
        title: `Bloco ${idx + 1}`,
        body: txt,
        board_box: '',
        example: '',
        trap: '',
        classmate_questions: []
      })),
      quiz: [],
      createdAt: new Date().toISOString(),
      aiFormativeNotice: 'Prática formativa gerada por IA — não altera ranking, XP oficial nem substitui gabarito de banca.'
    };
  }

  function buildOfflineLessonHtml(lesson) {
    if (!lesson) return '';
    const slidesHtml = (lesson.slides || []).map((sl, i) => `
      <section class="slide">
        <h2>Slide ${i + 1}: ${esc(sl.title)}</h2>
        <p>${esc(sl.body)}</p>
        ${sl.board_box ? `<pre class="board">${esc(sl.board_box)}</pre>` : ''}
        ${sl.example ? `<div class="box"><strong>Exemplo:</strong> ${esc(sl.example)}</div>` : ''}
        ${sl.trap ? `<div class="box trap"><strong>Pegadinha de prova:</strong> ${esc(sl.trap)}</div>` : ''}
        ${(sl.classmate_questions || []).length ? `<div class="peers"><strong>Dúvidas da turma:</strong><ul>${sl.classmate_questions.map(c => `<li><b>${esc(c.q)}</b> — ${esc(c.a)}</li>`).join('')}</ul></div>` : ''}
      </section>
    `).join('');

    const quizHtml = (lesson.quiz || []).length ? `
      <section class="slide">
        <h2>Mini-Quiz de Verificação (Prática Formativa)</h2>
        <p class="notice">${esc(lesson.aiFormativeNotice || 'Prática formativa gerada por IA.')}</p>
        ${lesson.quiz.map((q, qi) => `
          <div class="quiz">
            <p><b>${qi + 1}. ${esc(q.statement)}</b></p>
            <ol type="A">${q.options.map(o => `<li>${esc(o)}</li>`).join('')}</ol>
            <details><summary>Ver resposta comentada</summary><p><b>Gabarito sugerido: ${String.fromCharCode(65 + Number(q.correct_index || 0))}</b> — ${esc(q.explanation)}</p></details>
          </div>
        `).join('')}
      </section>
    ` : '';

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(lesson.title)} — Aula Offline · Jornada do Caçador</title>
<style>
  body{margin:0;padding:20px;background:#07111f;color:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;line-height:1.6}
  main{max-width:860px;margin:0 auto}
  header,.slide{background:#0b182a;border:1px solid #1e3a5f;border-radius:14px;padding:18px 20px;margin-bottom:16px}
  h1,h2{color:#65e7ff;margin-top:0}
  .meta{color:#94a3b8;font-size:.86rem}
  .board{background:#071422;border-left:4px solid #65e7ff;padding:12px 14px;border-radius:8px;white-space:pre-wrap;font-family:ui-monospace,monospace}
  .box{background:#0f223a;border:1px solid #24466b;border-radius:10px;padding:10px 12px;margin-top:10px}
  .box.trap{background:#2d1219;border-color:#9f1239}
  .peers{margin-top:12px;padding-top:10px;border-top:1px solid #1e3a5f}
  .notice{background:#2b2109;border:1px solid #b45309;color:#fde68a;padding:8px 12px;border-radius:8px;font-size:.82rem}
  .quiz{margin-top:12px;padding:12px;background:#071422;border-radius:10px;border:1px solid #1e3a5f}
  summary{cursor:pointer;color:#65e7ff;font-weight:700}
</style>
</head>
<body>
<main>
  <header>
    <div class="meta">Jornada do Caçador · Aula Interativa Offline · ${esc(lesson.subject)}</div>
    <h1>${esc(lesson.title)}</h1>
    ${lesson.overview ? `<p>${esc(lesson.overview)}</p>` : ''}
  </header>
  ${slidesHtml}
  ${quizHtml}
</main>
</body>
</html>`;
  }

  function exportOfflineHtml(lesson) {
    if (!lesson || typeof document === 'undefined') return false;
    const html = buildOfflineLessonHtml(lesson);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = String(lesson.title || 'aula-invocador').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'aula-invocador';
    a.href = url;
    a.download = `${slug}-offline.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function generateLesson(topicInput, subjectInput = '') {
    const topic = String(topicInput || '').trim();
    if (topic.length < 3) {
      statusMessage = 'Informe um assunto ou tópico (mínimo 3 caracteres) para montar a aula.';
      renderClassroom();
      return null;
    }
    const snap = currentScope();
    const cacheId = `${snap.key}::${hashKey(topic.toLowerCase())}`;
    const store = loadStore();
    if (store[cacheId] && store[cacheId].slides?.length) {
      activeLesson = { ...store[cacheId], _scopeKey: snap.key };
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      statusMessage = 'Aula carregada do cache desta conta/portal sem consumir nova chamada de IA.';
      renderClassroom();
      return activeLesson;
    }

    const reqToken = ++activeRequestToken;
    busy = true;
    statusMessage = 'Montando slides, quadro tático, dúvidas da turma e mini-quiz (1 chamada de IA)...';
    renderClassroom();

    try {
      const session = typeof validSession === 'function' ? await validSession() : null;
      if (!sameScope(snap) || reqToken !== activeRequestToken) return null;
      if (!session || !session.access_token) {
        throw new Error('Entre na sua conta para gerar a Aula Interativa do Invocador.');
      }
      const base = typeof SUPABASE_URL === 'string' ? SUPABASE_URL : (w.SUPABASE_URL || '');
      const headers = typeof authHeaders === 'function' ? authHeaders(session.access_token) : { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
      const campaign = typeof activeCampaign === 'function' ? activeCampaign() : null;
      const context = gatherTopicContext(topic);

      const response = await fetch(`${base}/functions/v1/assistente-pmpe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: buildClassroomPrompt(topic, subjectInput),
          context,
          mode: 'aula interativa estruturada',
          campaign_id: campaign?.dbId,
          campaign: campaign?.name
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!sameScope(snap) || reqToken !== activeRequestToken) return null;
      if (!response.ok) {
        throw new Error(result?.error || `Erro ${response.status} ao gerar a Aula Interativa.`);
      }

      const lesson = parseClassroomResponse(result?.answer || '', topic, subjectInput);
      lesson._scopeKey = snap.key;
      const nextStore = loadStore();
      nextStore[cacheId] = lesson;
      saveStore(nextStore);

      activeLesson = lesson;
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      statusMessage = 'Aula pronta! Navegue pelos slides e teste seu domínio no mini-quiz ao final.';
      return lesson;
    } catch (error) {
      if (!sameScope(snap) || reqToken !== activeRequestToken) return null;
      statusMessage = String(error?.message || error);
      if (typeof w.toast === 'function') w.toast(statusMessage);
      return null;
    } finally {
      if (reqToken === activeRequestToken) {
        busy = false;
        if (sameScope(snap)) renderClassroom();
      }
    }
  }

  function renderClassroom() {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('jcInvocadorClassroomRoot');
    if (!root) return;

    const snap = currentScope();
    if (activeLesson && activeLesson._scopeKey && activeLesson._scopeKey !== snap.key) {
      activeLesson = null;
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      statusMessage = '';
    }

    const totalSteps = activeLesson ? activeLesson.slides.length + (activeLesson.quiz?.length ? 1 : 0) : 0;
    const isQuizStep = Boolean(activeLesson && activeLesson.quiz?.length && activeSlideIndex >= activeLesson.slides.length);
    const curSlide = activeLesson && !isQuizStep ? activeLesson.slides[activeSlideIndex] : null;
    const pct = totalSteps ? Math.round(((activeSlideIndex + 1) / totalSteps) * 100) : 0;

    let stageHtml = '';
    if (activeLesson) {
      if (curSlide) {
        const peers = curSlide.classmate_questions || [];
        const activePeer = activePeerIdx >= 0 && peers[activePeerIdx] ? peers[activePeerIdx] : null;
        stageHtml = `
          <div class="jcClassroomStage">
            <div class="jcClassroomHead">
              <div>
                <span class="tag">${esc(activeLesson.subject)}</span>
                <h3 style="margin:6px 0 0">${esc(activeLesson.title)}</h3>
              </div>
              <span class="tag">Slide ${activeSlideIndex + 1} de ${activeLesson.slides.length}</span>
            </div>
            <div class="jcClassroomProgressTrack"><div class="jcClassroomProgressFill" style="width:${pct}%"></div></div>
            <h4 style="margin:0 0 8px;color:#65e7ff">${esc(curSlide.title)}</h4>
            <p style="margin:0;line-height:1.6">${esc(curSlide.body)}</p>
            ${curSlide.board_box ? `<div class="jcClassroomWhiteboard">${esc(curSlide.board_box)}</div>` : ''}
            ${(curSlide.example || curSlide.trap) ? `
              <div class="jcClassroomCallouts">
                ${curSlide.example ? `<div class="jcClassroomCallout"><b>📌 Exemplo prático</b><br>${esc(curSlide.example)}</div>` : ''}
                ${curSlide.trap ? `<div class="jcClassroomCallout trap"><b>⚠️ Pegadinha da banca</b><br>${esc(curSlide.trap)}</div>` : ''}
              </div>
            ` : ''}
            ${peers.length ? `
              <div class="jcPeerChipsWrap">
                <div class="small muted"><b>💬 Dúvidas da turma neste slide (clique para ver a resposta):</b></div>
                <div class="jcPeerChipsRow">
                  ${peers.map((p, idx) => `<button type="button" class="jcPeerChipBtn ${idx === activePeerIdx ? 'active' : ''}" data-jc-peer="${idx}">🙋 ${esc(p.q)}</button>`).join('')}
                </div>
                ${activePeer ? `<div class="jcPeerAnswerBox"><b>🧙‍♂️ Invocador responde:</b> ${esc(activePeer.a)}</div>` : ''}
              </div>
            ` : ''}
            <div class="jcClassroomNavBar">
              <button type="button" class="ghost small" id="jcClassPrevBtn" ${activeSlideIndex === 0 ? 'disabled' : ''}>← Anterior</button>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="ghost small" id="jcClassExportBtn">⬇️ Baixar aula offline (.html)</button>
                <button type="button" class="action small" id="jcClassNextBtn" style="width:auto">${activeSlideIndex < activeLesson.slides.length - 1 ? 'Próximo slide →' : (activeLesson.quiz?.length ? 'Ir para Mini-Quiz →' : 'Concluir aula')}</button>
              </div>
            </div>
          </div>
        `;
      } else if (isQuizStep) {
        const quiz = activeLesson.quiz || [];
        const answeredCount = Object.keys(quizAnswers).length;
        const correctCount = quiz.filter((q, qi) => quizAnswers[qi] === q.correct_index).length;
        stageHtml = `
          <div class="jcClassroomStage">
            <div class="jcClassroomHead">
              <div>
                <span class="tag">VERIFICAÇÃO DE APRENDIZAGEM</span>
                <h3 style="margin:6px 0 0">Mini-Quiz: ${esc(activeLesson.title)}</h3>
              </div>
              <span class="tag">${answeredCount}/${quiz.length} respondidas · ${correctCount} acerto(s)</span>
            </div>
            <div class="jcClassroomProgressTrack"><div class="jcClassroomProgressFill" style="width:100%"></div></div>
            <div class="jcClassroomNotice">ℹ️ ${esc(activeLesson.aiFormativeNotice)}</div>
            ${quiz.map((q, qi) => {
              const chosen = quizAnswers[qi];
              const hasAns = chosen !== undefined;
              return `
                <div class="jcClassroomQuizCard">
                  <b>${qi + 1}. ${esc(q.statement)}</b>
                  <div>
                    ${q.options.map((opt, oi) => {
                      const cls = !hasAns ? '' : (oi === q.correct_index ? 'correct' : (oi === chosen ? 'wrong' : ''));
                      return `<button type="button" class="jcClassroomQuizOpt ${cls}" data-jc-quiz-q="${qi}" data-jc-quiz-o="${oi}" ${hasAns ? 'disabled' : ''}><b>${String.fromCharCode(65 + oi)})</b> ${esc(opt)}</button>`;
                    }).join('')}
                  </div>
                  ${hasAns && q.explanation ? `<p class="small" style="margin:8px 0 0;color:#bae6fd"><b>Comentário:</b> ${esc(q.explanation)}</p>` : ''}
                </div>
              `;
            }).join('')}
            <div class="jcClassroomNavBar">
              <button type="button" class="ghost small" id="jcClassPrevBtn">← Voltar aos slides</button>
              <button type="button" class="ghost small" id="jcClassExportBtn">⬇️ Baixar aula offline (.html)</button>
            </div>
          </div>
        `;
      }
    }

    root.innerHTML = `
      <div class="jcClassroomLauncher">
        <div class="jcClassroomHead">
          <div>
            <div class="eyebrow" style="color:#65e7ff">SALA INTERATIVA · 1 CHAMADA DE IA</div>
            <h3 style="margin:2px 0 0">🎓 Modo Aula Interativa do Invocador</h3>
          </div>
          <span class="tag">Slides + Dúvidas + Quiz + Offline HTML</span>
        </div>
        <p class="small muted" style="margin:0">Digite qualquer tema do edital para gerar uma micro-aula em slides com quadro-esquema, dúvidas típicas de prova e mini-quiz formativo.</p>
        <div class="jcClassroomForm">
          <input type="text" id="jcClassroomTopicInput" placeholder="Ex.: Art. 144 CF/88, Crase obrigatória, Negação de Condicional..." ${busy ? 'disabled' : ''}>
          <button type="button" class="action" id="jcClassroomStartBtn" style="width:auto" ${busy ? 'disabled' : ''}>${busy ? '⏳ Montando aula...' : '🎓 Gerar Aula'}</button>
        </div>
        ${statusMessage ? `<p class="small muted" style="margin:8px 0 0">${esc(statusMessage)}</p>` : ''}
        ${stageHtml}
      </div>
    `;

    const startBtn = root.querySelector('#jcClassroomStartBtn');
    const topicInp = root.querySelector('#jcClassroomTopicInput');
    if (startBtn && topicInp) {
      startBtn.onclick = () => generateLesson(topicInp.value);
      topicInp.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          generateLesson(topicInp.value);
        }
      };
    }

    root.querySelectorAll('[data-jc-peer]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.jcPeer);
        activePeerIdx = activePeerIdx === idx ? -1 : idx;
        renderClassroom();
      };
    });

    root.querySelector('#jcClassPrevBtn')?.addEventListener('click', () => {
      if (activeSlideIndex > 0) {
        activeSlideIndex--;
        activePeerIdx = -1;
        renderClassroom();
      }
    });

    root.querySelector('#jcClassNextBtn')?.addEventListener('click', () => {
      if (activeLesson && activeSlideIndex < totalSteps - 1) {
        activeSlideIndex++;
        activePeerIdx = -1;
        renderClassroom();
      }
    });

    root.querySelector('#jcClassExportBtn')?.addEventListener('click', () => exportOfflineHtml(activeLesson));

    root.querySelectorAll('[data-jc-quiz-q]').forEach(btn => {
      btn.onclick = () => {
        const qi = Number(btn.dataset.jcQuizQ);
        const oi = Number(btn.dataset.jcQuizO);
        if (quizAnswers[qi] === undefined) {
          quizAnswers[qi] = oi;
          renderClassroom();
        }
      };
    });
  }

  function mount() {
    if (typeof document === 'undefined') return;
    const assistant = document.getElementById('assistant');
    if (!assistant || document.getElementById('jcInvocadorClassroomRoot')) return;
    const holder = document.createElement('div');
    holder.id = 'jcInvocadorClassroomRoot';
    const hero = assistant.querySelector('.aiHero');
    if (hero && hero.nextSibling) assistant.insertBefore(holder, hero.nextSibling);
    else assistant.prepend(holder);
    renderClassroom();
  }

  w.JCInvocadorClassroom = {
    mount,
    renderClassroom,
    generateLesson,
    parseClassroomResponse,
    buildOfflineLessonHtml,
    exportOfflineHtml,
    currentScope
  };

  if (typeof document !== 'undefined') {
    const boot = () => mount();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})();
