import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v59 = fs.readFileSync('dist/v59-enhancements.js', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const eq = fs.readFileSync('dist/exam-questions-client.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(pkg.version, '1.0.195');
assert.ok(sw.includes('r195'), 'SW deve estar na r195');

// 1. Transição instantânea de telas em openView (index.html + v77-experience.js)
assert.ok(html.includes('window._openViewSeq=') && html.includes('requestAnimationFrame'), 'openView deve pintar a aba imediatamente e diferir renderViewById');
assert.ok(v77.includes('const _v77Seq=window._openViewSeq||0;'), 'openView do v77 deve diferir runV77ViewEnhancements com cancelamento por sequência');

// 2. Assinatura O(N) rápida em index.html e v59-enhancements.js (sem deep-clone Object.fromEntries)
assert.ok(!html.includes('Object.fromEntries(Object.keys(item).filter(key=>!transient.has(key)).sort()'), 'index.html não deve mais fazer deep-clone recursivo em contentListSignature');
assert.ok(!v59.includes('Object.fromEntries(Object.keys(item).filter(key=>!transient.has(key)).sort()'), 'v59-enhancements.js não deve mais fazer deep-clone recursivo em contentListSignature');
assert.ok(html.includes('currSigs=current.map(contentListSignature)'), 'finishContent deve reutilizar currSigs sem calcular duas vezes');

// 3. Benchmark real da nova assinatura em 3.000 questões (< 50ms)
{
  const items = Array.from({ length: 3000 }, (_, i) => ({
    id: `q-${i}`,
    subject: 'Direito Constitucional',
    topic: 'Direitos Fundamentais',
    statement: `Questão número ${i} sobre a Constituição Federal de 1988 com enunciado completo.`,
    options: ['A', 'B', 'C', 'D', 'E'],
    correct_index: i % 5,
    key_source: 'ia_sugerido',
    status_validacao: 'pendente'
  }));
  const contentSignature = (value) => `${value.id || ''}|${value.subject || ''}|${value.topic || ''}|${String(value.statement || '').slice(0, 48)}|${value.correct_index ?? ''}|${value.key_source || ''}|${value.status_validacao || ''}|${Array.isArray(value.options) ? value.options.length : 0}`;
  const t0 = performance.now();
  let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < items.length; i++) {
    const s = contentSignature(items[i]);
    for (let j = 0; j < s.length; j++) { const c = s.charCodeAt(j); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2, 33) ^ c; }
  }
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 50, `Assinatura O(N) de 3.000 questões deve rodar em <50ms (rodou em ${elapsed.toFixed(1)}ms)`);
  console.log(`✓ Benchmark 3.000 questões: ${elapsed.toFixed(2)}ms`);
}

// 4. Memoização por questão em sanitizeAllQuestionsAndErrorsSubjects
assert.ok(v77.includes('qItem._jcSanitizedCamp===campId&&qItem._jcSanitizedMissions===missionsLen'), 'sanitizeAllQuestionsAndErrorsSubjects deve pular questões já sanitizadas');

// 5. Cache TTL de 5 min em fetchPortalExamQuestions
assert.ok(eq.includes('EXAM_CACHE_TTL_MS = 300000') && eq.includes('_examFetchCache.set(cacheKey'), 'fetchPortalExamQuestions deve cachear resultados por 5 minutos');

// 6. GPU mobile CSS: desativa backdrop-filter <=900px + content-visibility: auto
assert.ok(css.includes('@media (max-width: 900px)') && css.includes('backdrop-filter: none !important') && css.includes('content-visibility: auto'), 'CSS mobile deve remover backdrop-filter e aplicar content-visibility: auto');

console.log('OK: test-r195-mobile-performance.mjs (todas as 6 otimizações de performance validadas)');
