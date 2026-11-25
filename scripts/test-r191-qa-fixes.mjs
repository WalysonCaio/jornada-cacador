import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// 1. Versão r191 sincronizada entre package.json e sw.js
assert.ok(/^1\.0\.19[1-9]$/.test(pkg.version));
assert.ok(/r19[1-9]/.test(sw), 'SW deve estar na r191');

// 2. Filtro de disciplina usa KNOWN_CANONICAL_SUBJECTS.has(c) (Set, nunca .includes)
assert.ok(html.includes('KNOWN_CANONICAL_SUBJECTS.has(c)'), 'renderQuestionFilters deve usar KNOWN_CANONICAL_SUBJECTS.has(c)');
assert.ok(!html.includes('KNOWN_CANONICAL_SUBJECTS.includes('), 'Não pode chamar .includes em Set');

// 3. Interrogatório noturno classificado como Legislação Extravagante (nunca Português)
assert.ok(html.includes('interrogatorio noturno'), 'Legislação Extravagante deve reconhecer interrogatório noturno');

// 4. Invocador offline-aware
assert.ok(html.includes('Modo offline (IA indisponível)'), 'Status do Invocador deve refletir modo offline');

// 5. Revisão 1-7-30 e Caderno de Erros reclassificam disciplina pelo enunciado
assert.ok((html.includes('window.classifyQuestion({statement:x.e.question') || html.includes('inferStrictQuestionSubjectDecision(x.e.question||x.e.statement')), 'renderReviews deve reclassificar disciplina pelo enunciado');
assert.ok((html.includes('window.classifyQuestion({statement:e.question') || html.includes('inferStrictQuestionSubjectDecision(e.question||e.statement')), 'renderErrorNotebook deve reclassificar disciplina pelo enunciado');

// 6. Concordância singular/plural da ofensiva
assert.ok(html.includes('streakDaysUnit') && html.includes("?'dia seguido':'dias seguidos'"), 'Ofensiva deve usar singular para 1 dia seguido');

// 7. Painel TAF: botão Iniciar quando zerado + contagem regressiva unificada em T23:59:59
assert.ok(v77.includes("`${examDateStr}T23:59:59`"), 'Painel TAF deve usar T23:59:59 igual ao Cronograma');
assert.ok(v77.includes("!tafTimerState?'Iniciar':"), 'Botão do cronômetro TAF deve exibir Iniciar quando zerado');

// 8. Selos redundantes Autoral IA + QUESTÃO AUTORAL removidos
assert.ok(v77.includes("boardLabel==='Autoral IA'&&sealOrigin==='QUESTÃO AUTORAL'"), 'Selos redundantes de questão autoral devem ser evitados');

// 9. Tema Claro LGPD contraste + badge PDF sem quebra de linha
assert.ok(css.includes('body.lightAppTheme #cookieConsentBanner'), 'Tema claro deve corrigir contraste do banner LGPD');
assert.ok(css.includes('white-space: nowrap'), 'Badges PDF não devem quebrar em duas linhas');

console.log('OK: test-r191-qa-fixes.mjs (todas as 9 verificações da homologação passaram)');
