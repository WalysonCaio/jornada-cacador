import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const eqCode = fs.readFileSync('dist/exam-questions-client.js', 'utf8');
const htmlCode = fs.readFileSync('dist/index.html', 'utf8');
const v59Code = fs.readFileSync('dist/v59-enhancements.js', 'utf8');
const v77Code = fs.readFileSync('dist/v77-experience.js', 'utf8');
const swCode = fs.readFileSync('dist/sw.js', 'utf8');
const cssCode = fs.readFileSync('dist/ui-r188.css', 'utf8');

const sb = {
  window: null,
  console,
  questionFingerprint: (q) => `${String(q.statement || '').toLowerCase()}::${(q.options || []).length}`
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(eqCode, sb);

const api = sb.JCExamQuestions;

// 1. Mapeamento seguro de exam_questions (answer_unknown=true => correct_index null)
const mappedUnknown = api.mapExamRowToQuestion({
  id: 'eq-1',
  user_id: 'u1',
  campaign_id: 'camp-1',
  document_id: 'doc-1',
  share_with_community: false,
  statement: 'Qual o órgão responsável pelo policiamento ostensivo?',
  options: ['Polícia Militar', 'Polícia Civil', 'Corpo de Bombeiros', 'Polícia Federal'],
  correct_index: null,
  answer_unknown: true,
  gabarito_source: 'desconhecido',
  status_validacao: 'pendente',
  fingerprint: 'fp_1'
}, 'camp-1');

assert.equal(mappedUnknown.correct_index, null);
assert.equal(mappedUnknown.answer_unknown, true);
assert.equal(mappedUnknown.key_source, 'sem_gabarito');
assert.equal(api.validationBadgeInfo(mappedUnknown).label, 'Gabarito não confirmado');

// 2. Selo "verificada" com origem 'ia' NÃO pode dizer oficial
const mappedIaVerified = api.mapExamRowToQuestion({
  id: 'eq-2',
  user_id: 'u1',
  campaign_id: 'camp-1',
  statement: 'Assinale a alternativa correta sobre a crase.',
  options: ['Vou à escola.', 'Vou à pé.', 'Estou à disposição.', 'Começou à chover.'],
  correct_index: 0,
  answer_unknown: false,
  gabarito_source: 'ia',
  status_validacao: 'verificada',
  fundamento_ia: 'Antes de palavra feminina determinada usa-se crase.',
  ia_confianca: 'alta',
  ia_model: 'gemini-3.6-flash',
  fingerprint: 'fp_2'
}, 'camp-1');

const badgeIa = api.validationBadgeInfo(mappedIaVerified);
assert.equal(badgeIa.cls, 'verificada-ia');
assert.ok(badgeIa.label.includes('não oficial'), 'Verificada por IA nunca deve se passar por oficial');

// 3. Selo "verificada" com origem 'oficial_pdf' ou 'manual_revisado'
const mappedManual = api.mapExamRowToQuestion({
  id: 'eq-3',
  statement: 'Questão revisada manualmente.',
  options: ['Opção A', 'Opção B'],
  correct_index: 1,
  answer_unknown: false,
  gabarito_source: 'manual_revisado',
  status_validacao: 'verificada',
  fingerprint: 'fp_3'
}, 'camp-1');
assert.equal(api.validationBadgeInfo(mappedManual).cls, 'verificada-oficial');

// 4. Selo "divergente"
const mappedDiv = api.mapExamRowToQuestion({
  id: 'eq-4',
  statement: 'Questão com divergência detectada pela IA.',
  options: ['Opção A', 'Opção B', 'Opção C'],
  correct_index: 0,
  answer_unknown: false,
  gabarito_source: 'ia',
  status_validacao: 'divergente',
  resposta_ia: 2,
  fundamento_ia: 'Art. 5º, LXXIX da CF/88.',
  fingerprint: 'fp_4'
}, 'camp-1');
assert.equal(api.validationBadgeInfo(mappedDiv).cls, 'divergente');

// 5. Merge preserva revisão manual local e enriquece com status_validacao + fundamento_ia
const basePool = [
  {
    _fp: 'fp_2',
    statement: 'Assinale a alternativa correta sobre a crase.',
    options: ['Vou à escola.', 'Vou à pé.', 'Estou à disposição.', 'Começou à chover.'],
    correct_index: 0,
    key_source: 'manual_revisado',
    answer_key_validation: 'revisado'
  }
];
const merged = api.mergeExamQuestionsIntoPool(basePool, [mappedIaVerified, mappedDiv]);
assert.equal(merged.length, 2);
assert.equal(merged[0].gabarito_source, 'manual_revisado', 'Revisão manual local deve ser preservada');
assert.equal(merged[0].status_validacao, 'verificada');
assert.equal(merged[0].fundamento_ia, 'Antes de palavra feminina determinada usa-se crase.');
assert.equal(merged[1].status_validacao, 'divergente');

// 6. Verificar integração nos arquivos de entrega (index.html, v59, v77, sw.js, css)
assert.ok(htmlCode.includes('exam-questions-client.js'), 'index.html deve carregar exam-questions-client.js');
assert.ok(htmlCode.includes('JCExamQuestions.fetchPortalExamQuestions'), 'index.html deve consultar exam_questions');
assert.ok(v59Code.includes('JCExamQuestions.fetchPortalExamQuestions'), 'v59-enhancements.js deve consultar exam_questions');
assert.ok(v77Code.includes('JCExamQuestions?.validationBadgeInfo'), 'v77-experience.js deve renderizar o selo de validação');
assert.ok(cssCode.includes('.jcValPill.divergente'), 'ui-r188.css deve conter estilos do selo');
assert.ok(swCode.includes('r190') && swCode.includes('./exam-questions-client.js'), 'sw.js r190 deve cachear exam-questions-client.js');

console.log('OK: test-r190-exam-questions-ui.mjs (todas as asserções passaram)');
