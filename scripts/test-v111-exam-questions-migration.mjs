import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildSupabaseHeaders,
  transformBackfillData,
  mapGabaritoSource,
  isDocumentCommunityShared
} from './migrate-exam-questions.mjs';

// 0. Verificar cabeçalhos para sb_secret_ vs JWT legacy
const secretHeaders = buildSupabaseHeaders('sb_secret_exemplo123', { Accept: 'application/json' });
assert.equal(secretHeaders.apikey, 'sb_secret_exemplo123');
assert.equal(secretHeaders.Authorization, undefined, 'sb_secret_ não deve enviar Authorization: Bearer');

const jwtHeaders = buildSupabaseHeaders('aaa.bbb.ccc', { Accept: 'application/json' });
assert.equal(jwtHeaders.apikey, 'aaa.bbb.ccc');
assert.equal(jwtHeaders.Authorization, 'Bearer aaa.bbb.ccc');

// 1. Verificar contrato da migração SQL v111
const sql = fs.readFileSync('supabase/migrations/20261125010000_v111_exam_questions.sql', 'utf8');
assert.ok(/create table if not exists public\.exam_questions/i.test(sql), 'Tabela exam_questions ausente');
assert.ok(/alter table public\.exam_questions enable row level security/i.test(sql), 'RLS ausente');
assert.ok(/share_with_community boolean not null default false/i.test(sql), 'Default fail-closed de privacidade ausente');
assert.ok(!/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql), 'SQL não pode conter comandos destrutivos');

// 2. Verificar mapeamento de key_source
assert.equal(mapGabaritoSource('ia_sugerido'), 'ia');
assert.equal(mapGabaritoSource('sem_gabarito'), 'desconhecido');
assert.equal(mapGabaritoSource(null), 'desconhecido');
assert.equal(mapGabaritoSource('oficial_pdf'), 'desconhecido');
assert.equal(mapGabaritoSource('manual_revisado'), 'manual_revisado');

// 3. Verificar privacidade
assert.equal(isDocumentCommunityShared({ share_with_community: false, document_type: 'prova' }), false);
assert.equal(isDocumentCommunityShared({ share_with_community: true, document_type: 'edital' }), false);
assert.equal(isDocumentCommunityShared({ share_with_community: true, document_type: 'prova' }), true);

// 4. Simular backfill completo
const { rows, stats } = transformBackfillData({
  studyDocuments: [
    { id: 'doc-priv', user_id: 'u1', campaign_id: 'c1', title: 'Simulado Privado HD', document_type: 'simulado', share_with_community: false, metadata: {} },
    { id: 'doc-pub', user_id: 'u1', campaign_id: 'c1', title: 'Prova PMPE 2024', document_type: 'prova', share_with_community: true, metadata: {} }
  ],
  generatedRows: [
    {
      id: 'g1',
      user_id: 'u1',
      campaign_id: 'c1',
      source_document_id: 'doc-priv',
      title: 'Bloco 1',
      content: {
        subject: 'Direito Constitucional',
        questions: [
          {
            _fp: 'fp_priv_unknown',
            statement: 'Qual o remédio constitucional adequado para proteger direito líquido e certo?',
            options: ['Habeas Corpus', 'Mandado de Segurança', 'Habeas Data', 'Ação Popular'],
            correct_index: 0,
            answer_unknown: true,
            key_source: 'sem_gabarito',
            source_page: 4,
            source_question_number: '12',
            source_document_title: 'Simulado Privado HD',
            quality_status: 'needs_review'
          }
        ]
      }
    }
  ],
  sharedBankRows: []
});

assert.equal(stats.unique_total, 1);
assert.equal(rows[0].correct_index, null);
assert.equal(rows[0].gabarito_source, 'desconhecido');
assert.equal(rows[0].share_with_community, false);

console.log('OK: test-v111-exam-questions-migration.mjs (incluindo suporte a sb_secret_)');
