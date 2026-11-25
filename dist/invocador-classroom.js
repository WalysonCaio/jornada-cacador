// r189 (Onda 1): Modo Aula Interativa do Invocador — Blindagem de Parser, Escopo e Cancelamento
// - Parser balanceado de JSON; nunca inventa gabarito (A) nem cacheia fallback/JSON quebrado.
// - Isolado por conta (validando _ownerUserId), portal/campanha (incluindo dbId) e reset com AbortController + timeout.
(() => {
  'use strict';
  const w = window;
  const STORE_KEY = 'jornada-invocador-classroom-v188';
  const REQUEST_TIMEOUT_MS = 45000;
  let activeLesson = null;
  let activeSlideIndex = 0;
  let activePeerIdx = -1;
  let quizAnswers = {};
  let slideMarks = {};
  let draftTopic = '';
  let busy = false;
  let activeRequestToken = 0;
  let activeAbortController = null;
  let activeTimeoutId = null;
  let statusMessage = '';
  let lastScopeKey = '';

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
    let st = {}, sess = null, camp = null;
    try {
      st = typeof state === 'object' && state ? state : (w.state || {});
      sess = typeof cloudSession === 'object' && cloudSession ? cloudSession : (w.cloudSession || null);
      camp = typeof activeCampaign === 'function' ? activeCampaign() : (typeof w.activeCampaign === 'function' ? w.activeCampaign() : null);
    } catch (_e) {}
    const sessionUid = String(sess?.user?.id || '');
    const ownerUid = String(st._ownerUserId || '');
    const mismatch = Boolean(sessionUid && ownerUid && sessionUid !== ownerUid);
    const userId = mismatch ? 'transition' : (sessionUid || ownerUid || 'guest');
    const campaignId = String(st.activeCampaignId || 'default');
    const campaignDbId = String(camp?.dbId || '');
    const resetEpoch = Number(st._resetEpoch || 0);
    return { userId, campaignId, campaignDbId, resetEpoch, mismatch, key: `${userId}::${campaignId}::${campaignDbId}::${resetEpoch}` };
  }

  function sameScope(snap) {
    const now = currentScope();
    return Boolean(
      snap && !snap.mismatch && !now.mismatch &&
      now.userId === snap.userId &&
      now.campaignId === snap.campaignId &&
      now.campaignDbId === snap.campaignDbId &&
      now.resetEpoch === snap.resetEpoch
    );
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

  function clearCache() {
    try { localStorage.removeItem(STORE_KEY); } catch (_e) {}
  }

  function abortInFlight(reason = '') {
    activeRequestToken++;
    if (activeTimeoutId) {
      try { clearTimeout(activeTimeoutId); } catch (_e) {}
      activeTimeoutId = null;
    }
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch (_e) {}
      activeAbortController = null;
    }
    busy = false;
    if (reason) statusMessage = reason;
  }

  function syncScope() {
    const snap = currentScope();
    if (lastScopeKey && lastScopeKey !== snap.key) {
      abortInFlight('');
      activeLesson = null;
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      slideMarks = {};
      statusMessage = '';
    }
    lastScopeKey = snap.key;
    renderClassroom();
  }

  function getWeakTopicSuggestions(limit = 4) {
    let st = {};
    try { st = typeof state === 'object' && state ? state : (w.state || {}); } catch (_e) {}
    const cid = String(st.activeCampaignId || 'default');
    const normKey = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const pickBetterLabel = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      const score = (s) => (/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(s) ? 2 : 0) + (/[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(s) ? 2 : 0);
      return score(b) > score(a) ? b : a;
    };
    const counts = new Map();
    const errs = st.errors && typeof st.errors === 'object' ? Object.values(st.errors) : [];
    for (const err of errs) {
      if (!err || (err.campaignId && err.campaignId !== cid)) continue;
      const topic = String(err.topic || '').trim();
      const subject = String(err.subject || '').trim();
      if (!topic || topic.length < 3 || /^quest[aã]o\s+\d+/i.test(topic)) continue;
      const key = normKey(topic);
      const cur = counts.get(key) || { topic, subject, errors: 0 };
      cur.topic = pickBetterLabel(cur.topic, topic);
      cur.subject = pickBetterLabel(cur.subject, subject);
      cur.errors += Math.max(1, Number(err.count || err.wrongCount || 1));
      counts.set(key, cur);
    }
    const mastery = st.topicMastery && typeof st.topicMastery === 'object' ? Object.entries(st.topicMastery) : [];
    for (const [k, m] of mastery) {
      if (!m || (m.campaignId && m.campaignId !== cid && !k.startsWith(`${cid}::`))) continue;
      const attempts = Number(m.attempts || 0), correct = Number(m.correct || 0);
      if (attempts < 2) continue;
      const wrong = Math.max(0, attempts - correct);
      if (wrong < 1) continue;
      const topic = String(m.topic || m.topicKey || '').trim();
      const subject = String(m.subject || m.subjectKey || '').trim();
      if (!topic || topic.length < 3) continue;
      const key = normKey(topic);
      const cur = counts.get(key) || { topic, subject, errors: 0 };
      cur.topic = pickBetterLabel(cur.topic, topic);
      cur.subject = pickBetterLabel(cur.subject, subject);
      cur.errors = Math.max(cur.errors, wrong);
      counts.set(key, cur);
    }
    return [...counts.values()].sort((a, b) => b.errors - a.errors).slice(0, limit);
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

  function extractBalancedJsonObject(rawText) {
    const src = String(rawText || '').trim();
    if (!src) return null;
    const unwrapped = src.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const candidates = unwrapped !== src ? [unwrapped, src] : [src];
    for (const text of candidates) {
      let start = text.indexOf('{');
      while (start !== -1) {
        let depth = 0, inStr = false, escaped = false;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (inStr) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inStr = false;
          } else {
            if (ch === '"') inStr = true;
            else if (ch === '{') depth++;
            else if (ch === '}') {
              depth--;
              if (depth === 0) {
                try {
                  return JSON.parse(text.slice(start, i + 1));
                } catch (_e) {
                  break;
                }
              }
            }
          }
        }
        start = text.indexOf('{', start + 1);
      }
    }
    return null;
  }

  function looksLikeBrokenJson(raw) {
    const t = String(raw || '').trim();
    return /^(```json\s*)?\{/i.test(t) && /"slides"\s*:|"title"\s*:|"quiz"\s*:/i.test(t);
  }

  function parseClassroomResponse(rawAnswer, fallbackTopic, fallbackSubject) {
    const raw = String(rawAnswer || '').trim();
    const parsed = extractBalancedJsonObject(raw);

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
        ? parsed.quiz.slice(0, 5).map(q => {
            if (!q || !String(q.statement || '').trim() || !Array.isArray(q.options)) return null;
            const opts = q.options.slice(0, 5).map(o => String(o || '').trim()).filter(Boolean);
            if (opts.length < 2) return null;
            const rawIdx = q.correct_index;
            if (rawIdx === null || rawIdx === undefined || String(rawIdx).trim() === '') return null;
            const idx = Number(rawIdx);
            if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) return null;
            return {
              statement: String(q.statement).trim(),
              options: opts,
              correct_index: idx,
              explanation: String(q.explanation || '').trim()
            };
          }).filter(Boolean)
        : [];

      if (slides.length > 0) {
        return {
          title: String(parsed.title || fallbackTopic || 'Aula do Invocador').trim(),
          subject: String(parsed.subject || fallbackSubject || 'Estudo Direcionado').trim(),
          overview: String(parsed.overview || '').trim(),
          slides,
          quiz,
          createdAt: new Date().toISOString(),
          _isFallback: false,
          aiFormativeNotice: 'Prática formativa gerada por IA — não altera ranking, XP oficial nem substitui gabarito de banca.'
        };
      }
    }

    if (looksLikeBrokenJson(raw)) {
      return {
        title: String(fallbackTopic || 'Aula do Invocador').trim(),
        subject: String(fallbackSubject || 'Estudo Direcionado').trim(),
        overview: '',
        slides: [],
        quiz: [],
        createdAt: new Date().toISOString(),
        _isFallback: true,
        _parseError: 'A resposta estruturada veio incompleta. Tente gerar novamente (não foi salva em cache).'
      };
    }

    const chunks = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 4);
    return {
      title: String(fallbackTopic || 'Aula do Invocador').trim(),
      subject: String(fallbackSubject || 'Estudo Direcionado').trim(),
      overview: 'Aula estruturada a partir da explicação textual do Invocador (não armazenada em cache).',
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
      _isFallback: true,
      aiFormativeNotice: 'Prática formativa gerada por IA — não altera ranking, XP oficial nem substitui gabarito de banca.'
    };
  }

  function buildOfflineLessonHtml(lesson, marks = {}) {
    if (!lesson) return '';
    const slidesHtml = (lesson.slides || []).map((sl, i) => {
      const mark = marks[i] === 'understood' ? 'Dominado' : (marks[i] === 'review' ? 'Revisar depois' : '');
      return `
      <section class="slide">
        <h2>Slide ${i + 1}: ${esc(sl.title)}${mark ? ` <span class="meta">· ${esc(mark)}</span>` : ''}</h2>
        <p>${esc(sl.body)}</p>
        ${sl.board_box ? `<pre class="board">${esc(sl.board_box)}</pre>` : ''}
        ${sl.example ? `<div class="box"><strong>Exemplo:</strong> ${esc(sl.example)}</div>` : ''}
        ${sl.trap ? `<div class="box trap"><strong>Pegadinha de prova:</strong> ${esc(sl.trap)}</div>` : ''}
        ${(sl.classmate_questions || []).length ? `<div class="peers"><strong>Dúvidas da turma:</strong><ul>${sl.classmate_questions.map(c => `<li><b>${esc(c.q)}</b> — ${esc(c.a)}</li>`).join('')}</ul></div>` : ''}
      </section>
    `;
    }).join('');

    const validQuiz = (lesson.quiz || []).filter(q =>
      q && Array.isArray(q.options) && q.options.length >= 2 &&
      Number.isInteger(Number(q.correct_index)) && Number(q.correct_index) >= 0 && Number(q.correct_index) < q.options.length
    );

    const quizHtml = validQuiz.length ? `
      <section class="slide">
        <h2>Mini-Quiz de Verificação (Prática Formativa)</h2>
        <p class="notice">${esc(lesson.aiFormativeNotice || 'Prática formativa gerada por IA.')}</p>
        ${validQuiz.map((q, qi) => {
          const safeIdx = Math.max(0, Math.min(q.options.length - 1, Number(q.correct_index)));
          return `
          <div class="quiz">
            <p><b>${qi + 1}. ${esc(q.statement)}</b></p>
            <ol type="A">${q.options.map(o => `<li>${esc(o)}</li>`).join('')}</ol>
            <details><summary>Ver resposta comentada</summary><p><b>Gabarito sugerido: ${String.fromCharCode(65 + safeIdx)}</b> — ${esc(q.explanation)}</p></details>
          </div>
        `;
        }).join('')}
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
  .board{background:#071422;border:1px solid #24466b;padding:12px 14px;border-radius:8px;white-space:pre-wrap;font-family:ui-monospace,monospace}
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
    const html = buildOfflineLessonHtml(lesson, slideMarks);
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

  function cancelGeneration() {
    if (!busy) return;
    abortInFlight('Geração da aula cancelada.');
    renderClassroom();
  }

  async function generateLesson(topicInput, subjectInput = '') {
    const topic = String(topicInput || '').trim();
    draftTopic = topic;
    if (topic.length < 3) {
      statusMessage = 'Informe um assunto ou tópico (mínimo 3 caracteres) para montar a aula.';
      renderClassroom();
      return null;
    }
    const snap = currentScope();
    if (snap.mismatch) {
      statusMessage = 'Aguarde a troca de conta finalizar para montar a aula.';
      renderClassroom();
      return null;
    }
    lastScopeKey = snap.key;
    const cacheId = `${snap.key}::${hashKey(topic.toLowerCase())}`;
    const store = loadStore();
    if (store[cacheId] && store[cacheId].slides?.length && !store[cacheId]._isFallback) {
      activeLesson = { ...store[cacheId], _scopeKey: snap.key };
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      slideMarks = {};
      statusMessage = 'Aula carregada do cache desta conta/portal sem consumir nova chamada de IA.';
      renderClassroom();
      return activeLesson;
    }

    abortInFlight('');
    const reqToken = ++activeRequestToken;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    activeAbortController = controller;
    const timeoutId = controller ? setTimeout(() => { try { controller.abort(); } catch (_e) {} }, REQUEST_TIMEOUT_MS) : null;
    activeTimeoutId = timeoutId;
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
        signal: controller?.signal,
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
      if (lesson._parseError || !lesson.slides.length) {
        throw new Error(lesson._parseError || 'Não foi possível estruturar os slides desta aula. Tente novamente.');
      }
      lesson._scopeKey = snap.key;
      if (!lesson._isFallback) {
        const nextStore = loadStore();
        nextStore[cacheId] = lesson;
        saveStore(nextStore);
      }

      activeLesson = lesson;
      activeSlideIndex = 0;
      activePeerIdx = -1;
      quizAnswers = {};
      slideMarks = {};
      statusMessage = lesson._isFallback
        ? 'Aula exibida em modo simplificado (sem cache). Você pode regerar para tentar o formato completo.'
        : 'Aula pronta! Navegue pelos slides e teste seu domínio no mini-quiz ao final.';
      return lesson;
    } catch (error) {
      if (!sameScope(snap) || reqToken !== activeRequestToken) return null;
      statusMessage = error?.name === 'AbortError'
        ? 'Geração cancelada ou tempo esgotado. Tente novamente quando quiser.'
        : String(error?.message || error);
      if (typeof w.toast === 'function') w.toast(statusMessage);
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (activeTimeoutId === timeoutId) activeTimeoutId = null;
      if (activeAbortController === controller) activeAbortController = null;
      if (reqToken === activeRequestToken) {
        busy = false;
        renderClassroom();
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
      slideMarks = {};
      statusMessage = '';
    }
    lastScopeKey = snap.key;

    const weakTopics = getWeakTopicSuggestions(4);
    const totalSteps = activeLesson ? activeLesson.slides.length + (activeLesson.quiz?.length ? 1 : 0) : 0;
    const isQuizStep = Boolean(activeLesson && activeLesson.quiz?.length && activeSlideIndex >= activeLesson.slides.length);
    const curSlide = activeLesson && !isQuizStep ? activeLesson.slides[activeSlideIndex] : null;
    const pct = totalSteps ? Math.round(((activeSlideIndex + 1) / totalSteps) * 100) : 0;

    let stageHtml = '';
    if (activeLesson) {
      if (curSlide) {
        const peers = curSlide.classmate_questions || [];
        const activePeer = activePeerIdx >= 0 && peers[activePeerIdx] ? peers[activePeerIdx] : null;
        const isLastSlide = activeSlideIndex >= activeLesson.slides.length - 1;
        const hasQuiz = Boolean(activeLesson.quiz?.length);
        const curMark = slideMarks[activeSlideIndex] || '';
        const okCnt = Object.values(slideMarks).filter(v => v === 'understood').length;
        const revCnt = Object.values(slideMarks).filter(v => v === 'review').length;
        stageHtml = `
          <div class="jcClassroomStage">
            <div class="jcClassroomHead">
              <div>
                <div class="jcClassroomMeta">${esc(activeLesson.subject)} · Slide ${activeSlideIndex + 1} de ${activeLesson.slides.length}${okCnt || revCnt ? ` · ${okCnt} dominado(s) · ${revCnt} p/ revisar` : ''}</div>
                <h3 style="margin:4px 0 0">${esc(activeLesson.title)}</h3>
              </div>
              <div class="jcSlideMarkGroup" role="group" aria-label="Domínio deste slide">
                <button type="button" class="jcSlideMarkBtn ${curMark === 'understood' ? 'active-ok' : ''}" data-jc-mark="understood">✓ Entendi</button>
                <button type="button" class="jcSlideMarkBtn ${curMark === 'review' ? 'active-review' : ''}" data-jc-mark="review">⚑ Revisar depois</button>
              </div>
            </div>
            <div class="jcClassroomProgressTrack"><div class="jcClassroomProgressFill" style="width:${pct}%"></div></div>
            <h4 style="margin:0 0 8px;color:#52d9f7">${esc(curSlide.title)}</h4>
            <p style="margin:0;line-height:1.65">${esc(curSlide.body)}</p>
            ${curSlide.board_box ? `<div class="jcClassroomWhiteboard">${esc(curSlide.board_box)}</div>` : ''}
            ${(curSlide.example || curSlide.trap) ? `
              <div class="jcClassroomCallouts">
                ${curSlide.example ? `<div class="jcClassroomCallout"><b>Exemplo prático</b><br>${esc(curSlide.example)}</div>` : ''}
                ${curSlide.trap ? `<div class="jcClassroomCallout trap"><b>Pegadinha da banca</b><br>${esc(curSlide.trap)}</div>` : ''}
              </div>
            ` : ''}
            ${peers.length ? `
              <div class="jcPeerChipsWrap">
                <div class="small muted"><b>Dúvidas frequentes neste slide:</b></div>
                <div class="jcPeerChipsRow">
                  ${peers.map((p, idx) => `<button type="button" class="jcPeerChipBtn ${idx === activePeerIdx ? 'active' : ''}" data-jc-peer="${idx}">${esc(p.q)}</button>`).join('')}
                </div>
                ${activePeer ? `<div class="jcPeerAnswerBox"><b>Invocador responde:</b> ${esc(activePeer.a)}</div>` : ''}
              </div>
            ` : ''}
            <div class="jcClassroomNavBar">
              <button type="button" class="ghost small" id="jcClassPrevBtn" ${activeSlideIndex === 0 ? 'disabled' : ''}>← Anterior</button>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="ghost small" id="jcClassExportBtn">Baixar aula offline (.html)</button>
                ${!isLastSlide
                  ? '<button type="button" class="action small" id="jcClassNextBtn" style="width:auto">Próximo slide →</button>'
                  : (hasQuiz
                    ? '<button type="button" class="action small" id="jcClassNextBtn" style="width:auto">Ir para Mini-Quiz →</button>'
                    : '<button type="button" class="ghost small" id="jcClassRestartBtn" style="width:auto">Rever do início</button>')}
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
                <div class="jcClassroomMeta">Verificação formativa · ${answeredCount}/${quiz.length} respondidas · ${correctCount} acerto(s)</div>
                <h3 style="margin:4px 0 0">Mini-Quiz: ${esc(activeLesson.title)}</h3>
              </div>
            </div>
            <div class="jcClassroomProgressTrack"><div class="jcClassroomProgressFill" style="width:100%"></div></div>
            <div class="jcClassroomNotice">${esc(activeLesson.aiFormativeNotice)}</div>
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
              <button type="button" class="ghost small" id="jcClassExportBtn">Baixar aula offline (.html)</button>
            </div>
          </div>
        `;
      }
    }

    const existingInput = root.querySelector('#jcClassroomTopicInput');
    if (existingInput && existingInput.value) draftTopic = existingInput.value;

    root.innerHTML = `
      <div class="jcClassroomLauncher">
        <div class="jcClassroomHead">
          <div>
            <div class="jcClassroomMeta">Sala Interativa do Invocador · 1 chamada de IA · Prática formativa</div>
            <h3 style="margin:4px 0 0">Aula Interativa do Invocador</h3>
          </div>
        </div>
        <p class="small muted" style="margin:0">Gere uma micro-aula em slides com quadro-esquema, dúvidas típicas de prova e mini-quiz formativo (sem alterar XP ou ranking oficial).</p>
        ${weakTopics.length ? `
          <div class="jcWeakTopicsBar">
            <span class="small muted">Revisar tópicos com mais erros:</span>
            <div class="jcWeakTopicsRow">
              ${weakTopics.map(t => `<button type="button" class="jcWeakTopicBtn" data-jc-weak-topic="${esc(t.topic)}" data-jc-weak-subj="${esc(t.subject)}" ${busy ? 'disabled' : ''}>${esc(t.topic)} (${t.errors})</button>`).join('')}
            </div>
          </div>
        ` : ''}
        <div class="jcClassroomForm">
          <input type="text" id="jcClassroomTopicInput" value="${esc(draftTopic)}" placeholder="Ex.: Art. 144 CF/88, Crase obrigatória, Negação de Condicional..." ${busy ? 'disabled' : ''}>
          <div style="display:flex;gap:8px">
            <button type="button" class="action" id="jcClassroomStartBtn" style="width:auto" ${busy ? 'disabled' : ''}>${busy ? 'Montando aula...' : 'Gerar Aula'}</button>
            ${busy ? '<button type="button" class="ghost" id="jcClassroomCancelBtn" style="width:auto">Cancelar</button>' : ''}
          </div>
        </div>
        ${statusMessage ? `<p class="small muted" style="margin:8px 0 0">${esc(statusMessage)}</p>` : ''}
        ${stageHtml}
      </div>
    `;

    const startBtn = root.querySelector('#jcClassroomStartBtn');
    const cancelBtn = root.querySelector('#jcClassroomCancelBtn');
    const topicInp = root.querySelector('#jcClassroomTopicInput');
    if (topicInp) {
      topicInp.oninput = () => { draftTopic = topicInp.value; };
      topicInp.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          generateLesson(topicInp.value);
        }
      };
    }
    if (startBtn && topicInp) startBtn.onclick = () => generateLesson(topicInp.value);
    if (cancelBtn) cancelBtn.onclick = () => cancelGeneration();

    root.querySelectorAll('[data-jc-weak-topic]').forEach(btn => {
      btn.onclick = () => generateLesson(btn.dataset.jcWeakTopic, btn.dataset.jcWeakSubj || '');
    });

    root.querySelectorAll('[data-jc-mark]').forEach(btn => {
      btn.onclick = () => {
        const val = btn.dataset.jcMark;
        slideMarks[activeSlideIndex] = slideMarks[activeSlideIndex] === val ? '' : val;
        renderClassroom();
      };
    });

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

    root.querySelector('#jcClassRestartBtn')?.addEventListener('click', () => {
      activeSlideIndex = 0;
      activePeerIdx = -1;
      renderClassroom();
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
    cancelGeneration,
    parseClassroomResponse,
    buildOfflineLessonHtml,
    exportOfflineHtml,
    currentScope,
    syncScope,
    clearCache,
    getWeakTopicSuggestions
  };

  if (typeof w.addEventListener === 'function') {
    for (const ev of ['jc:scope-changed', 'jc:account-changed', 'jc:campaign-changed', 'jc:progress-reset']) {
      w.addEventListener(ev, syncScope);
    }
  }

  if (typeof document !== 'undefined') {
    const boot = () => mount();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})();
