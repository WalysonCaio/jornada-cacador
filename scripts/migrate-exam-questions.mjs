#!/usr/bin/env node
/**
 * Script de migração/backfill não destrutivo para public.exam_questions (v111).
 *
 * Uso (CMD do Windows ou terminal):
 *   node scripts/migrate-exam-questions.mjs --dry-run
 *   node scripts/migrate-exam-questions.mjs --apply
 *
 * Aceita tanto SUPABASE_SECRET_KEY (sb_secret_...) quanto SUPABASE_SERVICE_ROLE_KEY (eyJ...).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

function loadDotEnv(cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

export function buildSupabaseHeaders(serviceKey, extra = {}) {
  const key = String(serviceKey || '').trim();
  const headers = { apikey: key, ...extra };
  // Novas chaves sb_secret_... não são JWT: enviar apenas no header apikey
  if (key && !key.startsWith('sb_secret_') && key.split('.').length === 3) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

export function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function computeFallbackFingerprint(statement, options) {
  const payload = JSON.stringify([
    normalizeText(statement).toLowerCase(),
    (Array.isArray(options) ? options : []).map((o) => normalizeText(o).toLowerCase())
  ]);
  return 'fp_' + crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function resolveFingerprint(q, options) {
  const raw = normalizeText(q?._fp || q?.fingerprint || '');
  if (raw) return raw;
  return computeFallbackFingerprint(q?.statement || '', options);
}

export function mapGabaritoSource(rawKeySource) {
  const norm = normalizeText(rawKeySource).toLowerCase();
  if (!norm || norm === 'sem_gabarito' || norm === 'unknown' || norm === 'desconhecido') {
    return 'desconhecido';
  }
  if (norm === 'ia_sugerido' || norm === 'ia' || norm === 'ai' || norm === 'gemini' || norm === 'ai_suggested') {
    return 'ia';
  }
  if (norm === 'manual_revisado' || norm === 'manual') {
    return 'manual_revisado';
  }
  if (norm === 'colado') {
    return 'colado';
  }
  return 'desconhecido';
}

export function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((opt) => {
      if (typeof opt === 'string') return opt.trim();
      if (opt && typeof opt === 'object') return String(opt.text ?? opt.label ?? opt.value ?? '').trim();
      return String(opt ?? '').trim();
    })
    .filter((o) => o.length > 0)
    .slice(0, 5);
}

export function parseIntegerOrNull(value, min = null, max = null) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (min !== null && n < min) return null;
  if (max !== null && n > max) return null;
  return n;
}

export function isDocumentCommunityShared(doc) {
  if (!doc) return false;
  const docType = normalizeText(doc.document_type).toLowerCase();
  if (docType === 'edital' || docType === 'edital_concurso') return false;
  if (doc.share_with_community === false) return false;
  if (doc.metadata && doc.metadata.private_only === true) return false;
  if (doc.metadata && doc.metadata.share_with_community === false) return false;
  return doc.share_with_community === true;
}

function sourcePriority(row) {
  let score = 0;
  if (row.gabarito_source === 'manual_revisado') score += 100;
  if (row.source_table === 'generated_study_content') score += 20;
  if (row.document_id) score += 10;
  if (row.source_question_number) score += 3;
  if (row.source_page !== null) score += 2;
  if (row.correct_index !== null && !row.answer_unknown) score += 2;
  if (row.explanation && row.explanation.length > 20) score += 1;
  return score;
}

export function transformBackfillData({
  studyDocuments = [],
  generatedRows = [],
  sharedBankRows = []
}) {
  const docById = new Map();
  for (const d of studyDocuments) {
    if (d && d.id) docById.set(String(d.id), d);
  }

  const stats = {
    generated_rows_scanned: generatedRows.length,
    generated_questions_raw: 0,
    shared_bank_raw: sharedBankRows.length,
    invalid_skipped: 0,
    duplicates_merged: 0,
    unique_total: 0,
    from_generated_unique: 0,
    from_shared_bank_unique: 0,
    used_existing_fp: 0,
    used_fallback_fp: 0,
    raw_key_source_counts: {},
    gabarito_source_counts: {},
    answer_unknown_true_total: 0,
    answer_unknown_had_correct_index_cleared: 0,
    correct_index_null_total: 0,
    correct_index_filled_total: 0,
    private_questions_total: 0,
    community_shared_questions_total: 0,
    linked_to_document_total: 0,
    unlinked_document_total: 0
  };

  const bump = (obj, key) => {
    const k = String(key);
    obj[k] = (obj[k] || 0) + 1;
  };

  const byFp = new Map();

  function registerCandidate(candidate, hadExistingFp) {
    const fp = candidate.fingerprint;
    const prev = byFp.get(fp);
    if (!prev) {
      byFp.set(fp, { row: candidate, hadExistingFp });
      return;
    }
    stats.duplicates_merged += 1;
    const mergedShare = prev.row.share_with_community && candidate.share_with_community;
    if (sourcePriority(candidate) > sourcePriority(prev.row)) {
      byFp.set(fp, {
        row: { ...candidate, share_with_community: mergedShare },
        hadExistingFp: prev.hadExistingFp || hadExistingFp
      });
    } else {
      prev.row.share_with_community = mergedShare;
      if (!prev.row.document_id && candidate.document_id) prev.row.document_id = candidate.document_id;
      if (!prev.row.source_document_title && candidate.source_document_title) prev.row.source_document_title = candidate.source_document_title;
      if (prev.row.source_page === null && candidate.source_page !== null) prev.row.source_page = candidate.source_page;
      if (!prev.row.source_question_number && candidate.source_question_number) prev.row.source_question_number = candidate.source_question_number;
      if (!prev.row.quality_status && candidate.quality_status) prev.row.quality_status = candidate.quality_status;
    }
  }

  for (const row of generatedRows) {
    const content = row?.content && typeof row.content === 'object' ? row.content : {};
    const questions = Array.isArray(content.questions) ? content.questions : [];
    const docId =
      row.source_document_id ||
      (Array.isArray(row.source_refs) && row.source_refs[0]?.document_id) ||
      null;
    const doc = docId ? docById.get(String(docId)) : null;
    const shareWithCommunity = isDocumentCommunityShared(doc);

    for (const q of questions) {
      stats.generated_questions_raw += 1;
      const statement = normalizeText(q?.statement);
      const options = normalizeOptions(q?.options);
      if (statement.length < 8 || options.length < 2 || options.length > 5) {
        stats.invalid_skipped += 1;
        continue;
      }

      const hadExistingFp = Boolean(normalizeText(q?._fp || q?.fingerprint || ''));
      const fingerprint = resolveFingerprint(q, options);
      const answerUnknown = q?.answer_unknown === true;
      const rawKeySource = q?.key_source === undefined || q?.key_source === null || String(q.key_source).trim() === ''
        ? null
        : String(q.key_source).trim();
      const gabaritoSource = mapGabaritoSource(rawKeySource);

      const parsedIdx = parseIntegerOrNull(q?.correct_index, 0, options.length - 1);
      const correctIndex = answerUnknown ? null : parsedIdx;

      const sourceQuestionNumber =
        q?.source_question_number !== undefined && q?.source_question_number !== null && String(q.source_question_number).trim() !== ''
          ? String(q.source_question_number).trim()
          : (q?.question_number !== undefined && q?.question_number !== null && String(q.question_number).trim() !== ''
            ? String(q.question_number).trim()
            : null);

      const candidate = {
        user_id: row.user_id || doc?.user_id || null,
        campaign_id: row.campaign_id || doc?.campaign_id || null,
        document_id: docId ? String(docId) : null,
        share_with_community: shareWithCommunity,
        board: normalizeText(q?.board || content.board || doc?.board || 'Não informada') || 'Não informada',
        exam_year: parseIntegerOrNull(q?.exam_year ?? content.exam_year ?? doc?.exam_year, 1980, 2100),
        exam_title: normalizeText(q?.exam_title || q?.source_document_title || doc?.title || row.title || '') || null,
        question_number: sourceQuestionNumber,
        source_page: parseIntegerOrNull(q?.source_page, 0, 100000),
        source_question_number: sourceQuestionNumber,
        source_document_title: normalizeText(q?.source_document_title || doc?.title || content.source || row.title || '') || null,
        quality_status: normalizeText(q?.quality_status || '') || null,
        subject: normalizeText(q?.subject || content.subject || 'Conteúdo Geral') || 'Conteúdo Geral',
        topic: normalizeText(q?.topic || content.title || 'Geral') || 'Geral',
        statement,
        options,
        correct_index: correctIndex,
        answer_unknown: answerUnknown,
        raw_key_source: rawKeySource,
        gabarito_source: gabaritoSource,
        explanation: String(q?.explanation ?? '').trim(),
        origin: normalizeText(q?.origin || 'pdf_extraida') || 'pdf_extraida',
        source_table: 'generated_study_content',
        source_row_id: row.id || null,
        fingerprint,
        status_validacao: 'pendente',
        _hadBogusIndexCleared: answerUnknown && parsedIdx !== null
      };

      registerCandidate(candidate, hadExistingFp);
    }
  }

  for (const s of sharedBankRows) {
    const statement = normalizeText(s?.statement);
    const options = normalizeOptions(s?.options);
    if (statement.length < 8 || options.length < 2 || options.length > 5) {
      stats.invalid_skipped += 1;
      continue;
    }

    const hadExistingFp = Boolean(normalizeText(s?.fingerprint || s?._fp || ''));
    const fingerprint = resolveFingerprint(s, options);
    const parsedIdx = parseIntegerOrNull(s?.correct_index, 0, options.length - 1);

    const candidate = {
      user_id: s.created_by || null,
      campaign_id: null,
      document_id: null,
      share_with_community: true,
      board: normalizeText(s?.board || 'Não informada') || 'Não informada',
      exam_year: parseIntegerOrNull(s?.exam_year, 1980, 2100),
      exam_title: normalizeText(s?.exam_title || '') || null,
      question_number: null,
      source_page: null,
      source_question_number: null,
      source_document_title: normalizeText(s?.exam_title || '') || null,
      quality_status: null,
      subject: normalizeText(s?.subject || 'Conteúdo Geral') || 'Conteúdo Geral',
      topic: normalizeText(s?.topic || 'Geral') || 'Geral',
      statement,
      options,
      correct_index: parsedIdx,
      answer_unknown: parsedIdx === null,
      raw_key_source: null,
      gabarito_source: 'desconhecido',
      explanation: String(s?.explanation ?? '').trim(),
      origin: normalizeText(s?.origin || 'shared_question_bank') || 'shared_question_bank',
      source_table: 'shared_question_bank',
      source_row_id: s.id || null,
      fingerprint,
      status_validacao: 'pendente',
      _hadBogusIndexCleared: false
    };

    registerCandidate(candidate, hadExistingFp);
  }

  const rows = [];
  for (const { row, hadExistingFp } of byFp.values()) {
    const hadCleared = Boolean(row._hadBogusIndexCleared);
    const cleanRow = { ...row };
    delete cleanRow._hadBogusIndexCleared;
    rows.push(cleanRow);

    if (hadExistingFp) stats.used_existing_fp += 1;
    else stats.used_fallback_fp += 1;

    if (cleanRow.source_table === 'generated_study_content') stats.from_generated_unique += 1;
    else stats.from_shared_bank_unique += 1;

    bump(stats.raw_key_source_counts, cleanRow.raw_key_source ?? '(null)');
    bump(stats.gabarito_source_counts, cleanRow.gabarito_source);

    if (cleanRow.answer_unknown) stats.answer_unknown_true_total += 1;
    if (hadCleared) stats.answer_unknown_had_correct_index_cleared += 1;

    if (cleanRow.correct_index === null) stats.correct_index_null_total += 1;
    else stats.correct_index_filled_total += 1;

    if (cleanRow.share_with_community) stats.community_shared_questions_total += 1;
    else stats.private_questions_total += 1;

    if (cleanRow.document_id) stats.linked_to_document_total += 1;
    else stats.unlinked_document_total += 1;
  }

  stats.unique_total = rows.length;
  return { rows, stats };
}

async function fetchAllPaginated(baseUrl, serviceKey, table, select, pageSize = 500) {
  const all = [];
  let offset = 0;
  while (true) {
    const url = `${baseUrl.replace(/\/+$/, '')}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: buildSupabaseHeaders(serviceKey, { Accept: 'application/json' })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Falha ao ler ${table} (HTTP ${res.status}): ${txt.slice(0, 300)}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function insertBatchIgnoreDuplicates(baseUrl, serviceKey, rows, batchSize = 200) {
  let sent = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const url = `${baseUrl.replace(/\/+$/, '')}/rest/v1/exam_questions?on_conflict=fingerprint`;
    const res = await fetch(url, {
      method: 'POST',
      headers: buildSupabaseHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      }),
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Falha ao inserir lote ${i}..${i + chunk.length} em exam_questions (HTTP ${res.status}): ${txt.slice(0, 400)}`);
    }
    sent += chunk.length;
  }
  return sent;
}

function printReport(stats, mode) {
  console.log('\n==============================================================');
  console.log(` RELATÓRIO DE MIGRAÇÃO -> public.exam_questions (${mode.toUpperCase()})`);
  console.log('==============================================================');
  console.log(`Linhas lidas em generated_study_content : ${stats.generated_rows_scanned}`);
  console.log(`Questões brutas em content.questions    : ${stats.generated_questions_raw}`);
  console.log(`Questões brutas em shared_question_bank : ${stats.shared_bank_raw}`);
  console.log(`Descartadas (inválidas/incompletas)     : ${stats.invalid_skipped}`);
  console.log(`Duplicadas mescladas por fingerprint    : ${stats.duplicates_merged}`);
  console.log(`TOTAL ÚNICO PRONTO PARA exam_questions  : ${stats.unique_total}`);
  console.log(`  - Origem generated_study_content      : ${stats.from_generated_unique}`);
  console.log(`  - Origem shared_question_bank         : ${stats.from_shared_bank_unique}`);
  console.log(`  - Fingerprint reaproveitado (_fp)     : ${stats.used_existing_fp}`);
  console.log(`  - Fingerprint gerado (fallback)       : ${stats.used_fallback_fp}`);
  console.log('\n--- Privacidade e vínculo com PDF ---');
  console.log(`  - Privadas (share_with_community=false): ${stats.private_questions_total}`);
  console.log(`  - Comunitárias (share_with_community=true): ${stats.community_shared_questions_total}`);
  console.log(`  - Vinculadas a study_documents        : ${stats.linked_to_document_total}`);
  console.log(`  - Sem document_id                     : ${stats.unlinked_document_total}`);
  console.log('\n--- Integridade de gabarito (answer_unknown) ---');
  console.log(`  - answer_unknown = true               : ${stats.answer_unknown_true_total}`);
  console.log(`  - correct_index limpo -> NULL (por answer_unknown): ${stats.answer_unknown_had_correct_index_cleared}`);
  console.log(`  - correct_index = NULL (total final)  : ${stats.correct_index_null_total}`);
  console.log(`  - correct_index preenchido (a validar): ${stats.correct_index_filled_total}`);
  console.log('\n--- Contagem por key_source original (raw_key_source) ---');
  for (const [k, v] of Object.entries(stats.raw_key_source_counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${k.padEnd(24)}: ${v}`);
  }
  console.log('\n--- Contagem por gabarito_source mapeado ---');
  for (const [k, v] of Object.entries(stats.gabarito_source_counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${k.padEnd(24)}: ${v}`);
  }
  console.log('==============================================================\n');
}

async function main() {
  loadDotEnv();
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const dryRun = !apply || args.has('--dry-run');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Erro: defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }

  console.log(`[v111] Lendo study_documents, generated_study_content e shared_question_bank (${dryRun ? 'DRY-RUN' : 'APPLY'})...`);
  const [studyDocuments, generatedRows, sharedBankRows] = await Promise.all([
    fetchAllPaginated(supabaseUrl, serviceKey, 'study_documents', 'id,user_id,campaign_id,title,document_type,share_with_community,metadata'),
    fetchAllPaginated(supabaseUrl, serviceKey, 'generated_study_content', 'id,user_id,campaign_id,source_document_id,source_refs,content_type,title,content'),
    fetchAllPaginated(supabaseUrl, serviceKey, 'shared_question_bank', 'id,fingerprint,subject,topic,board,exam_year,exam_title,origin,statement,options,correct_index,explanation,created_by')
  ]);

  const { rows, stats } = transformBackfillData({ studyDocuments, generatedRows, sharedBankRows });
  printReport(stats, dryRun ? 'dry-run' : 'apply');

  if (dryRun) {
    console.log('[v111] Modo --dry-run concluído: nenhuma linha foi gravada no banco.');
    console.log('[v111] Confira os números acima antes de rodar com --apply.');
    return;
  }

  console.log(`[v111] Gravando ${rows.length} questões únicas em public.exam_questions (ON CONFLICT DO NOTHING)...`);
  const sent = await insertBatchIgnoreDuplicates(supabaseUrl, serviceKey, rows);
  console.log(`[v111] Concluído: ${sent} registros enviados sem sobrescrever nenhum gabarito existente.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('[v111] Erro fatal:', err?.message || err);
    process.exit(1);
  });
}
