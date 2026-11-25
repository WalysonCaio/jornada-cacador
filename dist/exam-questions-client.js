// r190 (Etapa 3): Leitura estruturada de public.exam_questions no front-end + selo de validação para o aluno.
// - Consulta public.exam_questions respeitando RLS (privadas só do dono + comunitárias compartilhadas).
// - Faz fallback silencioso para generated_study_content se offline ou se a tabela não responder.
// - Nunca trata gabarito 'ia' ou 'desconhecido' como oficial; destaca divergências e fundamentos da IA.
(() => {
  'use strict';
  const w = window;

  function normalizeText(value) {
    return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  function mapDbKeySourceToLegacy(row) {
    const gs = String(row?.gabarito_source || '').toLowerCase();
    if (gs === 'manual_revisado') return 'manual_revisado';
    if (gs === 'ia') return 'ia_sugerido';
    if (gs === 'oficial_pdf') return 'oficial_definitivo';
    if (gs === 'colado') return 'colado';
    if (row?.raw_key_source) return String(row.raw_key_source);
    return 'sem_gabarito';
  }

  function mapExamRowToQuestion(row, portalDbId) {
    if (!row || !row.statement || !Array.isArray(row.options) || row.options.length < 2) return null;
    const options = row.options.slice(0, 5).map((o) => {
      if (typeof o === 'string') return o;
      if (o && typeof o === 'object') return String(o.text ?? o.label ?? o.value ?? '');
      return String(o ?? '');
    }).filter((o) => o.trim().length > 0);
    if (options.length < 2) return null;

    const answerUnknown = Boolean(row.answer_unknown || row.correct_index === null || row.correct_index === undefined);
    const keySource = mapDbKeySourceToLegacy(row);
    const statusValidacao = ['pendente', 'verificada', 'divergente'].includes(String(row.status_validacao || ''))
      ? String(row.status_validacao)
      : 'pendente';

    return {
      id: row.id,
      examQuestionId: row.id,
      _fp: row.fingerprint || undefined,
      fingerprint: row.fingerprint || undefined,
      subject: normalizeText(row.subject || 'Conteúdo Geral') || 'Conteúdo Geral',
      topic: normalizeText(row.topic || 'Geral') || 'Geral',
      board: normalizeText(row.board || 'Não informada') || 'Não informada',
      exam_year: row.exam_year ?? null,
      exam_title: row.exam_title || row.source_document_title || null,
      question_number: row.source_question_number || row.question_number || null,
      source_page: row.source_page ?? null,
      source_question_number: row.source_question_number || row.question_number || null,
      source_document_title: row.source_document_title || row.exam_title || null,
      quality_status: row.quality_status || null,
      statement: String(row.statement),
      options,
      correct_index: answerUnknown ? null : Number(row.correct_index),
      answer_unknown: answerUnknown,
      key_source: keySource,
      gabarito_source: String(row.gabarito_source || 'desconhecido'),
      raw_key_source: row.raw_key_source || null,
      answer_key_validation: keySource === 'manual_revisado' ? 'revisado' : undefined,
      explanation: String(row.explanation || ''),
      origin: row.origin || 'pdf_extraida',
      documentId: row.document_id || undefined,
      sourceDocumentId: row.document_id || undefined,
      source_document_id: row.document_id || undefined,
      user_id: row.user_id || undefined,
      campaign_id: row.campaign_id || portalDbId || undefined,
      share_with_community: Boolean(row.share_with_community),
      is_community: Boolean(row.share_with_community && row.user_id && row.campaign_id !== portalDbId),
      status_validacao: statusValidacao,
      resposta_ia: row.resposta_ia === null || row.resposta_ia === undefined ? null : Number(row.resposta_ia),
      fundamento_ia: row.fundamento_ia ? String(row.fundamento_ia) : '',
      ia_confianca: row.ia_confianca ? String(row.ia_confianca) : null,
      ia_model: row.ia_model ? String(row.ia_model) : null
    };
  }

  async function fetchPortalExamQuestions(portalDbId, userId, options = {}) {
    if (!portalDbId && !userId) return [];
    const fetchFn = options.cloudFetch || (typeof w.cloudFetch === 'function' ? w.cloudFetch : null);
    if (!fetchFn) return [];
    const select = [
      'id', 'user_id', 'campaign_id', 'document_id', 'share_with_community',
      'board', 'exam_year', 'exam_title', 'question_number',
      'source_page', 'source_question_number', 'source_document_title', 'quality_status',
      'subject', 'topic', 'statement', 'options',
      'correct_index', 'answer_unknown', 'raw_key_source', 'gabarito_source',
      'explanation', 'origin', 'fingerprint',
      'status_validacao', 'resposta_ia', 'fundamento_ia', 'ia_confianca', 'ia_model'
    ].join(',');

    const all = [];
    const pageSize = 500;
    const maxPages = 10;
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;
      const filter = portalDbId
        ? `or=(campaign_id.eq.${encodeURIComponent(portalDbId)},share_with_community.eq.true)`
        : `user_id=eq.${encodeURIComponent(userId)}`;
      const path = `exam_questions?${filter}&select=${encodeURIComponent(select)}&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
      const res = await fetchFn(path).catch(() => null);
      if (!res || !res.ok) break;
      const rows = await res.json().catch(() => null);
      if (!Array.isArray(rows) || !rows.length) break;
      for (const r of rows) {
        const mapped = mapExamRowToQuestion(r, portalDbId);
        if (mapped) all.push(mapped);
      }
      if (rows.length < pageSize) break;
    }
    return all;
  }

  function questionKey(q) {
    if (typeof w.questionFingerprint === 'function') return w.questionFingerprint(q);
    return JSON.stringify([
      normalizeText(q?.statement).toLowerCase(),
      (Array.isArray(q?.options) ? q.options : []).map((o) => normalizeText(o).toLowerCase())
    ]);
  }

  function mergeExamQuestionsIntoPool(baseQuestions, examQuestions) {
    const base = Array.isArray(baseQuestions) ? baseQuestions : [];
    const incoming = Array.isArray(examQuestions) ? examQuestions : [];
    if (!incoming.length) return base;

    const byFp = new Map();
    const byNorm = new Map();
    for (const eq of incoming) {
      if (eq._fp) byFp.set(eq._fp, eq);
      byNorm.set(questionKey(eq), eq);
    }

    const used = new Set();
    const merged = base.map((item) => {
      if (!item) return item;
      const match = (item._fp && byFp.get(item._fp)) || byNorm.get(questionKey(item));
      if (!match) return item;
      used.add(match);
      // Preserva revisão manual local (personallyReviewed), mas anexa metadados de validação
      const isManualLocal = item.key_source === 'manual_revisado' && item.answer_key_validation === 'revisado';
      return {
        ...item,
        examQuestionId: match.examQuestionId,
        status_validacao: match.status_validacao,
        gabarito_source: isManualLocal ? 'manual_revisado' : (match.gabarito_source || item.gabarito_source),
        resposta_ia: match.resposta_ia,
        fundamento_ia: match.fundamento_ia,
        ia_confianca: match.ia_confianca,
        ia_model: match.ia_model,
        source_page: item.source_page ?? match.source_page,
        source_question_number: item.source_question_number ?? match.source_question_number,
        source_document_title: item.source_document_title ?? match.source_document_title
      };
    });

    const seenKeys = new Set(merged.map(questionKey));
    for (const eq of incoming) {
      if (used.has(eq)) continue;
      const k = questionKey(eq);
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      merged.push(eq);
    }
    return merged;
  }

  function validationBadgeInfo(item) {
    if (!item) return null;
    const status = String(item.status_validacao || '').toLowerCase();
    const gs = String(item.gabarito_source || '').toLowerCase();
    const isOfficialOrManual = gs === 'oficial_pdf' || gs === 'manual_revisado' || item.key_source === 'manual_revisado';

    if (status === 'divergente') {
      return {
        cls: 'divergente',
        icon: '⚠',
        label: 'Gabarito em revisão (divergência IA)',
        detail: 'A checagem por IA apontou outra alternativa. Confira o fundamento abaixo e o gabarito oficial.'
      };
    }
    if (status === 'verificada') {
      if (isOfficialOrManual) {
        return {
          cls: 'verificada-oficial',
          icon: '✓',
          label: 'Gabarito verificado',
          detail: 'Conferido contra fonte revisada/oficial.'
        };
      }
      return {
        cls: 'verificada-ia',
        icon: '✓',
        label: 'Conferida por IA (não oficial)',
        detail: 'A resposta cadastrada coincidiu com a resolução independente da IA, mas não substitui gabarito oficial de banca.'
      };
    }
    if (gs === 'ia' || item.key_source === 'ia_sugerido' || item.answer_unknown || item.correct_index === null || item.correct_index === undefined) {
      return {
        cls: 'pendente',
        icon: '⏳',
        label: 'Gabarito não confirmado',
        detail: 'Questão ainda aguardando validação ou sem gabarito oficial confirmado.'
      };
    }
    return null;
  }

  w.JCExamQuestions = {
    mapExamRowToQuestion,
    fetchPortalExamQuestions,
    mergeExamQuestionsIntoPool,
    validationBadgeInfo
  };
})();
