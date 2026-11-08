#!/usr/bin/env node
/**
 * Validação automática do banco de questões nativo + ALL_QUESTIONS
 * - Detecta duplicatas exatas por fingerprint (subject + topic + statement)
 * - Detecta quase-duplicatas via Jaccard + Shingles (Word + Char) ou MinHash + LSH sharded por disciplina
 * - Valida estrutura mínima e disciplinas canônicas
 * - Suporta --fix para gerar arquivo deduplicado (*-deduped.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeText,
  subjectKey,
  questionFingerprint,
  questionSimilarity,
  findNearDuplicatesMinHashBySubject,
  findNearDuplicatesEmbeddings,
  mockEmbedFn,
} from './lib/text-similarity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const USE_MINHASH = args.includes('--minhash');
const USE_EMBEDDINGS = args.includes('--embeddings');
const FIX_MODE = args.includes('--fix');
const fileArg =
  args.find((a) => a.startsWith('--file='))?.split('=')[1] ||
  (args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null);

function loadQuestions(filePath) {
  const full = path.resolve(ROOT, filePath || 'dist/native-question-bank.json');
  if (!fs.existsSync(full)) {
    const candidates = [
      'dist/native-question-bank.json',
      'banco-questoes/native/all.json',
    ];
    for (const c of candidates) {
      const p = path.resolve(ROOT, c);
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { path: p, data: Array.isArray(raw) ? raw : raw.questions || raw.items || [] };
      }
    }
    console.error('❌ Nenhum arquivo de banco encontrado.');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.questions || raw.items || [];
  return { path: full, data: list };
}

async function validate(questions) {
  const report = {
    total: questions.length,
    ok: 0,
    errors: [],
    warnings: [],
    duplicates: [],
    nearDuplicates: [],
    bySubject: {},
  };

  const seenFp = new Map();
  const statements = [];

  questions.forEach((q, idx) => {
    const id = q.id || q._id || `#${idx}`;
    const subj = subjectKey(q.subject || q.disciplina || '');
    const statement = String(q.statement || q.enunciado || '').trim();
    const options = q.options || q.alternativas || [];
    const correct = Number(q.correct_index ?? q.gabarito ?? -1);

    report.bySubject[subj || '(sem disciplina)'] =
      (report.bySubject[subj || '(sem disciplina)'] || 0) + 1;

    if (!statement || statement.length < 20) {
      report.errors.push({ id, idx, type: 'statement_short', msg: 'Enunciado muito curto (< 20 chars)' });
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
      report.errors.push({ id, idx, type: 'options_invalid', msg: 'Alternativas inválidas (esperado 2 a 5)' });
    }
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      report.errors.push({ id, idx, type: 'correct_index', msg: `correct_index inválido: ${correct}` });
    }
    if (!subj || subj === 'geral' || subj === 'conteudo') {
      report.warnings.push({ id, idx, type: 'subject_generic', msg: `Disciplina genérica: ${subj}` });
    }

    const fp = questionFingerprint(q);
    if (seenFp.has(fp)) {
      report.duplicates.push({
        id,
        idx,
        firstIdx: seenFp.get(fp),
        fingerprint: fp,
        statementPreview: statement.slice(0, 80),
      });
    } else {
      seenFp.set(fp, idx);
    }

    statements.push({ idx, id, statement, subj });
  });

  if (USE_EMBEDDINGS) {
    report.nearDuplicates = await findNearDuplicatesEmbeddings(questions, mockEmbedFn, {
      threshold: STRICT ? 0.84 : 0.88,
      sameSubjectOnly: true,
    });
  } else if (USE_MINHASH || questions.length >= 2000) {
    report.nearDuplicates = findNearDuplicatesMinHashBySubject(questions, {
      preset: STRICT ? 'balanced' : 'precision',
      strict: STRICT,
    });
  } else {
    for (let i = 0; i < statements.length; i++) {
      for (let j = i + 1; j < statements.length; j++) {
        if (statements[i].subj !== statements[j].subj) continue;
        const sim = questionSimilarity(statements[i].statement, statements[j].statement, STRICT);
        if (sim.isNearDuplicate) {
          report.nearDuplicates.push({
            a: statements[i].id,
            b: statements[j].id,
            idxA: statements[i].idx,
            idxB: statements[j].idx,
            similarity: sim.combined,
            previewA: statements[i].statement.slice(0, 70),
          });
        }
      }
    }
  }

  const badIndices = new Set([
    ...report.errors.map((e) => e.idx),
    ...report.duplicates.map((d) => d.idx),
  ]);
  report.ok = report.total - badIndices.size;
  return { report, badIndices };
}

const { path: usedPath, data: questions } = loadQuestions(fileArg);
console.log(`\n📂 Banco: ${usedPath}`);
console.log(`📊 Total de questões: ${questions.length}\n`);

const { report, badIndices } = await validate(questions);

console.log('── Resultado ──────────────────────────────');
console.log(`✅ OK estrutural:     ${report.ok}`);
console.log(`❌ Erros:             ${report.errors.length}`);
console.log(`⚠️ Avisos:            ${report.warnings.length}`);
console.log(`🔁 Duplicatas exatas: ${report.duplicates.length}`);
console.log(`🔍 Quase-duplicatas:  ${report.nearDuplicates.length}`);
console.log('\nPor disciplina:');
Object.entries(report.bySubject)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  ${n.toString().padStart(4)} ${s}`));

if (FIX_MODE) {
  const deduped = questions.filter((_, idx) => !badIndices.has(idx));
  const outDedup = usedPath.replace(/\.json$/i, '-deduped.json');
  fs.writeFileSync(outDedup, JSON.stringify(deduped, null, 2));
  console.log(`\n🛠️ Arquivo deduplicado salvo em: ${outDedup} (${deduped.length} questões)`);
}

const outReport = path.resolve(ROOT, 'scripts/question-bank-report.json');
fs.writeFileSync(outReport, JSON.stringify(report, null, 2));
console.log(`\n📄 Relatório salvo em: ${outReport}`);

const hasBlocking = report.duplicates.length > 0 || report.errors.length > 0;
process.exit(hasBlocking ? 1 : 0);
