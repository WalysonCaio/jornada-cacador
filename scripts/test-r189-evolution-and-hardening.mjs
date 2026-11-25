import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

const qrCode = read('dist', 'question-review.js');
const qTextCode = read('dist', 'question-text-quality.js');
const classCode = read('dist', 'invocador-classroom.js');
const wsCode = read('dist', 'questions-workspace.js');
const htmlCode = read('dist', 'index.html');
const v77Code = read('dist', 'v77-experience.js');
const swCode = read('dist', 'sw.js');
const manifestObj = JSON.parse(read('dist', 'manifest.webmanifest'));
const fnCode = read('supabase', 'functions', 'assistente-pmpe', 'index.ts');
const dashFnCode = read('supabase', 'dashboard', 'assistente-pmpe', 'index.ts');

console.log('=== Teste r189: Blindagem Crítica, Performance/PWA e Evolução de Estudo ===');

// 1. Reconciliação tolerante a tipografia (preserva gabarito manual) + preservação em parcial + Caderno só com >1 cadernos
{
  const sb = { console, window: null, state: {}, cloudSession: null, ALL_QUESTIONS: [] };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(qTextCode, sb);
  vm.runInContext(qrCode, sb);
  const api = sb.JCQuestionReview;

  const oldRows = [{
    id: 'r1',
    content: {
      is_question_pack: true,
      questions: [
        {
          id: 'q-typo',
          question_number: 1,
          statement: 'S empre que o agente público agir com ilegal idade, assinale a correta.',
          options: ['Deve fazê - lo imediatamente.', 'Não se aplica - se ao caso.'],
          correct_index: 1,
          key_source: 'manual_revisado',
          answer_key_validation: 'revisado',
          key_reference: 'Conferido no edital oficial.'
        },
        {
          id: 'q-skipped',
          question_number: 2,
          statement: 'Questão antiga válida que foi pulada em reanálise parcial do PDF?',
          options: ['Alternativa A válida', 'Alternativa B válida'],
          correct_index: 0,
          key_source: 'oficial_definitivo',
          answer_key_validation: 'confirmado'
        }
      ]
    }
  }];

  const extracted = [{
    question_number: 1,
    statement: 'Sempre que o agente público agir com ilegalidade, assinale a correta.',
    options: ['Deve fazê-lo imediatamente.', 'Não se aplica-se ao caso.'],
    correct_index: 0,
    key_source: 'oficial_preliminar'
  }];

  const res = api.reconcile(oldRows, extracted, { id: 'doc-1', title: 'Prova Simulada' }, {
    pdfTotalPages: 2,
    pagesRead: 2,
    partialInfo: { partial: true, skippedNumbers: [2] }
  });

  assert.equal(res.report.matched, 1, 'Normalização tipográfica deve casar a questão sem duplicar');
  assert.equal(res.report.added, 0, 'Não deve criar duplicata quando apenas a tipografia mudou');
  assert.equal(res.report.preserved_partial, 1, 'Questão pulada em parcial deve ser preservada');
  assert.equal(res.report.not_matched, 0, 'Questão pulada em parcial não deve ir para quarentena');
  const q1 = res.candidates[0].content.questions[0];
  const q2 = res.candidates[0].content.questions[1];
  assert.equal(q1.correct_index, 1, 'Gabarito manual revisado deve ser preservado');
  assert.equal(q1.key_source, 'manual_revisado');
  assert.equal(q2.review_status, 'preserved_partial_skip');
  assert.equal(q2.correct_index, 0);
  assert.equal(api.examDocument({ document_type: 'material', title: '100 Provas e Simulados Comentados' }), true);
  console.log('✓ 1. Reconciliação tolerante a tipografia e preservação parcial validadas');
}

// 2. Edge Function assistente-pmpe modo aula estruturada (JSON schema sem google_search + dashboard sincronizado)
{
  assert.ok(fnCode.includes('async function askStructuredClassroom('), 'Edge Function deve ter handler estruturado para aula');
  assert.ok(fnCode.includes('responseMimeType: "application/json"') && fnCode.includes('responseSchema: schema'), 'Modo aula deve usar responseMimeType e responseSchema');
  assert.ok(fnCode.includes('mode.toLowerCase() === "aula interativa estruturada"'), 'Modo aula interativa estruturada deve ser roteado');
  assert.ok(dashFnCode.includes('askStructuredClassroom'), 'Bundle do dashboard deve estar sincronizado com a Edge Function');
  console.log('✓ 2. Edge Function assistente-pmpe com schema JSON rígido e bundle dashboard validados');
}

// 3. Aula Interativa 2.0: parser balanceado, zero invenção de gabarito A, sem cachear JSON quebrado, tópicos fracos e marcadores offline
{
  const storage = new Map();
  let aborted = false;
  const sb = {
    console, setTimeout, clearTimeout,
    AbortController: class {
      constructor() { this.signal = {}; }
      abort() { aborted = true; }
    },
    SUPABASE_URL: 'https://example.supabase.co',
    state: {
      _ownerUserId: 'u1',
      activeCampaignId: 'pmpe',
      _resetEpoch: 1,
      errors: {
        e1: { campaignId: 'pmpe', subject: 'Direito Constitucional', topic: 'Remédios Constitucionais', count: 4 },
        e2: { campaignId: 'pcpe', subject: 'Direito Penal', topic: 'Outro Portal', count: 9 }
      }
    },
    cloudSession: { user: { id: 'u1' }, access_token: 'tok-1' },
    ALL_SUMMARIES: [],
    activeCampaign: () => ({ dbId: 'db-pmpe', name: 'PMPE' }),
    validSession: async () => ({ user: { id: 'u1' }, access_token: 'tok-1' }),
    authHeaders: t => ({ Authorization: `Bearer ${t}` }),
    toast: () => {},
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    },
    fetch: () => new Promise(() => {}),
    window: null
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(classCode, sb);
  const api = sb.JCInvocadorClassroom;

  // Nested backticks + trailing prose + invalid quiz correct_index (must drop invalid quiz item, NEVER invent 0)
  const messy = 'Aqui está sua aula:\n```json\n' + JSON.stringify({
    title: 'Crase',
    subject: 'Português',
    overview: 'Resumo',
    slides: [{ title: 'Regra', body: 'Use ```a + a = à``` sempre que cabível.', board_box: 'a + a = à', example: 'Vou à aula.', trap: 'Antes de verbo não!', classmate_questions: [] }],
    quiz: [
      { statement: 'Sem gabarito válido?', options: ['A', 'B'], correct_index: null, explanation: 'Inválida' },
      { statement: 'Com gabarito válido?', options: ['Sim', '', 'Não'], correct_index: 1, explanation: 'Correta' }
    ]
  }) + '\n```\nFonte: pesquisa web.';
  const parsed = api.parseClassroomResponse(messy, 'Crase', 'Português');
  assert.equal(parsed._isFallback, false);
  assert.equal(parsed.slides.length, 1);
  assert.equal(parsed.quiz.length, 1, 'Questão sem correct_index válido deve ser descartada (nunca inventar A)');
  assert.equal(parsed.quiz[0].correct_index, 1);

  // Broken truncated JSON must return _parseError and never render raw JSON as slide 1
  const broken = '{"title":"Incompleta","slides":[{"title":"S1","body":"cortado...';
  const parsedBroken = api.parseClassroomResponse(broken, 'Tema', 'Disc');
  assert.equal(parsedBroken.slides.length, 0);
  assert.ok(parsedBroken._parseError);

  // Weak topics must respect activeCampaignId scope
  const weak = api.getWeakTopicSuggestions(4);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].topic, 'Remédios Constitucionais');

  // Offline HTML with slide mastery marks escaped
  const htmlOff = api.buildOfflineLessonHtml(parsed, { 0: 'review' });
  assert.ok(htmlOff.includes('Revisar depois'));

  // Cancel aborts in-flight fetch
  api.generateLesson('Crase obrigatória');
  await new Promise(r => setTimeout(r, 10));
  api.cancelGeneration();
  assert.equal(aborted, true, 'Cancelar aula deve abortar a requisição ativa');
  console.log('✓ 3. Aula Interativa 2.0 (parser balanceado, quiz honesto, cancelamento, tópicos fracos e offline) validada');
}

// 4. Sanitização de URLs/imagens (jcSafeUrl / jcSafeImageSrc) + Deep Merge + Reset Granular
{
  const fnStart = htmlCode.indexOf('function esc(v){');
  const fnEnd = htmlCode.indexOf('function aiInline(');
  const mergeStart = htmlCode.indexOf('function mergeProgressStates(');
  const mergeEnd = htmlCode.indexOf('async function pushCloudState(){');
  assert.ok(fnStart > 0 && fnEnd > fnStart && mergeStart > 0 && mergeEnd > mergeStart);

  const sb = {
    window: null,
    location: { origin: 'https://jornada.wcaio.workers.dev' },
    URL,
    normalizeLegalText: s => s,
    localDayKey: () => '2026-11-24',
    JCProgress: {
      mergeScores: (a = [], b = []) => [...a, ...b],
      mergeLearning: (a = {}, b = {}) => ({ ...a, ...b }),
      mergeTopicMastery: (a = {}, b = {}) => ({ ...a, ...b })
    }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(htmlCode.slice(fnStart, fnEnd) + '\n' + htmlCode.slice(mergeStart, mergeEnd), sb);

  assert.equal(sb.jcSafeUrl('javascript:alert(1)'), '');
  assert.equal(sb.jcSafeImageSrc('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.ok(sb.jcSafeImageSrc('data:image/png;base64,iVBORw0KGgo=').startsWith('data:image/png'));
  assert.equal(sb.jcSafeUrl('https://planalto.gov.br/ccivil_03/constituicao.htm'), 'https://planalto.gov.br/ccivil_03/constituicao.htm');

  const merged = sb.mergeProgressStates(
    {
      questionAnswerOverrides: { q1: { correct_answer: 'A', updatedAt: '2026-11-24T10:00:00Z' } },
      favoriteQuestions: { q1: true },
      questionStatsByCampaign: { pmpe: { total: 20, correct: 15 }, pcpe: { total: 10, correct: 8 } },
      lastStudy: '2026-11-24',
      streak: 7
    },
    {
      questionAnswerOverrides: { q2: { correct_answer: 'B', updatedAt: '2026-11-24T11:00:00Z' } },
      favoriteQuestions: { q2: true },
      questionStatsByCampaign: { pmpe: { total: 12, correct: 9 } },
      lastStudy: '2026-11-22',
      streak: 3
    }
  );
  assert.ok(merged.questionAnswerOverrides.q1 && merged.questionAnswerOverrides.q2, 'Deep merge deve preservar overrides de ambos os aparelhos');
  assert.ok(merged.favoriteQuestions.q1 && merged.favoriteQuestions.q2, 'Deep merge deve unir favoritas');
  assert.equal(merged.questionStatsByCampaign.pmpe.total, 20);
  assert.equal(merged.questionStatsByCampaign.pcpe.total, 10);
  assert.equal(merged.lastStudy, '2026-11-24');
  assert.equal(merged.streak, 7);
  console.log('✓ 4. Sanitização XSS/URL e deep merge multi-dispositivo validados');
}

// 5. Parser de bancas regionais + classificação ampliada de assuntos + Streaming signature + PWA r189
{
  const sb = { window: null };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(qTextCode, sb);
  vm.runInContext(wsCode, sb);

  const leak = sb.JCQuestionText.analyzeOption('Alternativa correta. (UPENET/IAUPE) Assinale a incorreta: a) Um b) Dois');
  assert.equal(leak.needs_review, true, 'Deve detectar vazamento com banca UPENET/IAUPE');
  const sig1 = sb.JCQuestionsWorkspace.signature([{ a: 1, b: 2 }, { a: 3, b: 4 }], true);
  const sig2 = sb.JCQuestionsWorkspace.signature([{ a: 3, b: 4 }, { b: 2, a: 1 }], true);
  assert.equal(sig1, sig2, 'Streaming signature deve ser invariante à ordem das chaves e dos itens quando unordered=true');

  const infStart = v77Code.indexOf('  function inferQuestionPedagogicalTopic(');
  const infEnd = v77Code.indexOf('  window.inferQuestionPedagogicalTopic = inferQuestionPedagogicalTopic;');
  const sbTopic = { window: null };
  sbTopic.window = sbTopic;
  vm.createContext(sbTopic);
  vm.runInContext(v77Code.slice(infStart, infEnd), sbTopic);
  assert.equal(sbTopic.inferQuestionPedagogicalTopic('A Lei 14.133 trata de licitações e contratos.', 'Direito Administrativo'), 'Licitações e Contratos (Lei 14.133/2021)');
  assert.equal(sbTopic.inferQuestionPedagogicalTopic('Ataques de phishing e ransomware comprometem a rede.', 'Informática'), 'Segurança da Informação');
  assert.equal(sbTopic.inferQuestionPedagogicalTopic('A Lei Maria da Penha prevê medidas protetivas.', 'Legislação Extravagante'), 'Lei Maria da Penha (Lei 11.340/2006)');

  assert.ok(swCode.includes('r189') && swCode.includes('NETWORK_TIMEOUT_MS'), 'SW r189 deve conter timeout de rede');
  assert.equal(manifestObj.id, './', 'Manifesto PWA deve definir id');
  assert.ok(manifestObj.icons.some(i => i.purpose === 'any') && manifestObj.icons.some(i => i.purpose === 'maskable'), 'Manifesto deve separar ícones any e maskable');
  console.log('✓ 5. Bancas regionais, tópicos ampliados, streaming signature e PWA r189 validados');
}

console.log('=== Todos os 5 blocos de validação da r189 passaram com 100% de sucesso! ===');
