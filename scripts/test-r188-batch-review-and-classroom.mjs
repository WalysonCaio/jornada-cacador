import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const qrCode = fs.readFileSync(path.join(root, 'dist', 'question-review.js'), 'utf8');
const classCode = fs.readFileSync(path.join(root, 'dist', 'invocador-classroom.js'), 'utf8');
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const swCode = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');

console.log('=== Teste r188: Reanálise em 1 Clique, Proposta Parcial Segura, Caderno Condicional e Aula Interativa do Invocador ===');

// 1. SW e HTML atualizados
assert.ok(swCode.includes('r188') && swCode.includes('./invocador-classroom.js') && swCode.includes('./ui-r188.css'), 'sw.js deve estar na r188 com os novos módulos');
assert.ok(htmlCode.includes('invocador-classroom.js') && htmlCode.includes('ui-r188.css'), 'index.html deve carregar ui-r188.css e invocador-classroom.js');
console.log('✓ 1. Service Worker e index.html atualizados para r188');

// 2. Testar dist/question-review.js: freshCoverage parcial segura + Caderno oculto quando não ambíguo + 1-clique autoApply
function makeQrSandbox({ ambiguous = false, skipped = 1, extracted = 2, expected = 3, isScanned = false } = {}) {
  const calls = [];
  const panelEl = { innerHTML: '', querySelector: () => ({ addEventListener() {}, onclick: null }), querySelectorAll: () => [] };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    SUPABASE_URL: 'https://example.supabase.co',
    state: { _ownerUserId: 'u1', _resetEpoch: 1, activeCampaignId: 'pmpe', questionAnswerOverrides: {} },
    cloudSession: { user: { id: 'u1' }, access_token: 'tok-1' },
    ALL_QUESTIONS: [],
    activeCampaign: () => ({ dbId: 'camp-1', name: 'PMPE' }),
    validSession: async () => ({ user: { id: 'u1' }, access_token: 'tok-1' }),
    authHeaders: t => ({ Authorization: `Bearer ${t}` }),
    toast: () => {},
    loadGeneratedContent: async () => {},
    document: {
      readyState: 'complete',
      getElementById: id => (id === 'jcQuestionReviewPanel' ? panelEl : null),
      querySelector: () => null,
      createElement: () => ({ className: '', innerHTML: '', prepend() {} })
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('study_documents?')) {
        return { ok: true, json: async () => ([{ id: 'doc-1', title: 'MINI SIMULADO 01', document_type: 'simulado' }]) };
      }
      if (url.includes('get_document_question_review_source')) {
        return {
          ok: true,
          json: async () => ({
            document: { id: 'doc-1', user_id: 'u1', title: 'MINI SIMULADO 01', document_type: 'simulado', metadata: {} },
            snapshot: 'snap-1',
            rows: [{ content: { questions: [{ statement: 'Questão antiga preservada quando não relida?', options: ['Opção A', 'Opção B'], correct_index: 0, key_source: 'oficial_definitivo' }] } }]
          })
        };
      }
      if (url.includes('stage_document_question_review')) {
        return { ok: true, json: async () => ({ status: 'pending', document_id: 'doc-1', review_id: 'rev-1' }) };
      }
      if (url.includes('apply_document_question_review')) {
        return { ok: true, json: async () => ({ status: 'applied', document_id: 'doc-1', saved: 1 }) };
      }
      return { ok: true, json: async () => ({}) };
    },
    window: null
  };
  sandbox.window = sandbox;
  sandbox._extractedPagesByDocId = new Map([['doc-1', isScanned ? [] : [{ page: 1, text: 'texto' }]]]);
  sandbox._extractedPdfMetaByDocId = new Map([['doc-1', { freshSource: true, pdfTotalPages: 1, pagesRead: 1, empty_pages: [], isScannedPdf: isScanned }]]);
  sandbox.JornadaPdfText = { prepareDocumentText: async () => !isScanned };
  sandbox.extractStructuredExamQuestions = () => {
    const arr = extracted > 0 ? [{ statement: 'Questão válida lida integralmente no PDF de teste?', options: ['Alternativa 1', 'Alternativa 2'], correct_index: 0, key_source: 'oficial_definitivo' }] : [];
    arr.report = { ambiguous, cadernos: ambiguous ? ['Azul', 'Branco'] : [], skipped, extracted, expected, annulled: 0, unknownFormatCount: 0 };
    return arr;
  };
  vm.createContext(sandbox);
  new vm.Script(qrCode, { filename: 'question-review.js' }).runInContext(sandbox);
  return { api: sandbox.JCQuestionReview, calls, panelEl };
}

// 2a. Proposta parcial segura + autoApply em 1 clique
{
  const env = makeQrSandbox({ ambiguous: false, skipped: 1, extracted: 2, expected: 3, isScanned: false });
  await env.api.startBatch(false, { autoApply: true, allowPartial: true });
  assert.ok(env.calls.some(c => c.url.includes('stage_document_question_review')), 'Deve gerar proposta mesmo com 1 questão pulada');
  assert.ok(env.calls.some(c => c.url.includes('apply_document_question_review')), 'Com autoApply:true deve aplicar em 1 clique sem exigir confirmação por PDF');
  assert.ok(!env.panelEl.innerHTML.includes('Caderno, se necessário'), 'Campo Caderno não deve aparecer em PDF sem ambiguidade');
  console.log('✓ 2. Proposta parcial segura + aplicação automática em 1 clique validada');
}

// 2b. PDF escaneado continua bloqueado e NÃO mostra campo Caderno
{
  const env = makeQrSandbox({ ambiguous: false, skipped: 0, extracted: 0, expected: 10, isScanned: true });
  await env.api.startBatch(false, { autoApply: true, allowPartial: true });
  assert.ok(!env.calls.some(c => c.url.includes('apply_document_question_review')), 'PDF escaneado (0/10) deve continuar bloqueado');
  assert.ok(!env.panelEl.innerHTML.includes('data-qr-caderno'), 'PDF escaneado sem ambiguidade não deve mostrar campo Caderno');
  console.log('✓ 3. PDF escaneado continua bloqueado sem exibir campo confuso de Caderno');
}

// 2c. PDF com cadernos ambíguos continua bloqueado E mostra o campo Caderno
{
  const env = makeQrSandbox({ ambiguous: true, skipped: 0, extracted: 10, expected: 10, isScanned: false });
  await env.api.startBatch(false, { autoApply: true, allowPartial: true });
  assert.ok(!env.calls.some(c => c.url.includes('apply_document_question_review')), 'PDF ambíguo não deve ser aplicado sem escolha de caderno');
  assert.ok(env.panelEl.innerHTML.includes('data-qr-caderno') && env.panelEl.innerHTML.includes('Azul, Branco'), 'PDF ambíguo deve exibir o campo Caderno com as opções detectadas');
  console.log('✓ 4. Campo Caderno exibido exclusivamente quando há ambiguidade real');
}

// 3. Testar dist/invocador-classroom.js: parse JSON, XSS-safe offline HTML, isolamento de conta/portal/reset e descarte tardio
{
  const storage = new Map();
  let resolveFetch;
  const sb = {
    console,
    setTimeout,
    clearTimeout,
    SUPABASE_URL: 'https://example.supabase.co',
    state: { _ownerUserId: 'user-A', activeCampaignId: 'pmpe', _resetEpoch: 1 },
    cloudSession: { user: { id: 'user-A' }, access_token: 'tok-A' },
    ALL_SUMMARIES: [],
    activeCampaign: () => ({ dbId: 'camp-A', name: 'PMPE' }),
    validSession: async () => ({ user: { id: 'user-A' }, access_token: 'tok-A' }),
    authHeaders: t => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }),
    toast: () => {},
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v))
    },
    fetch: () => new Promise(res => { resolveFetch = res; }),
    window: null
  };
  sb.window = sb;
  vm.createContext(sb);
  new vm.Script(classCode, { filename: 'invocador-classroom.js' }).runInContext(sb);

  const api = sb.JCInvocadorClassroom;
  assert.ok(api, 'JCInvocadorClassroom deve estar exposto');

  // 3a. Parse de resposta JSON com XSS injection test
  const rawJson = '```json\n' + JSON.stringify({
    title: 'Crase <script>alert(1)</script>',
    subject: 'Língua Portuguesa',
    overview: 'Domine a crase.',
    slides: [
      {
        title: 'Regra Geral',
        body: 'Fusão da preposição a + artigo a.',
        board_box: 'a + a = à',
        example: 'Fui à praia.',
        trap: 'Nunca antes de verbo!',
        classmate_questions: [{ q: 'E antes de pronome?', a: 'Em regra, não ocorre.' }]
      }
    ],
    quiz: [
      { statement: 'Há crase em "fui a pé"?', options: ['Sim', 'Não'], correct_index: 1, explanation: 'Pé é masculino.' }
    ]
  }) + '\n```';

  const parsed = api.parseClassroomResponse(rawJson, 'Crase', 'Português');
  assert.equal(parsed.slides.length, 1);
  assert.equal(parsed.slides[0].classmate_questions.length, 1);
  assert.equal(parsed.quiz.length, 1);
  assert.ok(parsed.aiFormativeNotice.includes('não altera ranking'), 'Aviso honesto de prática formativa deve estar presente');

  const offlineHtml = api.buildOfflineLessonHtml(parsed);
  assert.ok(!offlineHtml.includes('<script>alert(1)</script>'), 'HTML offline deve escapar tags <script> contra XSS');
  assert.ok(offlineHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Conteúdo escapado deve estar presente');
  console.log('✓ 5. Aula Interativa: parse de slides/dúvidas/quiz e exportação HTML offline segura contra XSS validados');

  // 3b. Descarte de resposta tardia após troca de conta/portal
  const pendingPromise = api.generateLesson('Artigo 144 CF/88', 'Direito Constitucional');
  await new Promise(r => setTimeout(r, 15));
  // Usuário troca de conta enquanto a IA responde
  sb.cloudSession = { user: { id: 'user-B' }, access_token: 'tok-B' };
  sb.state = { _ownerUserId: 'user-B', activeCampaignId: 'pmpe', _resetEpoch: 1 };
  resolveFetch({ ok: true, json: async () => ({ answer: rawJson }) });
  const lateResult = await pendingPromise;
  assert.equal(lateResult, null, 'Resposta tardia após troca de conta deve ser descartada');
  assert.equal(storage.size, 0, 'Cache não deve gravar resposta da conta A dentro da conta B');
  console.log('✓ 6. Isolamento de conta/portal/reset e descarte de resposta tardia da Aula Interativa validados');
}

console.log('=== Todos os 6 testes da r188 passaram com 100% de sucesso! ===');
