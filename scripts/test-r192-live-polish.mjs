import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const eq = fs.readFileSync('dist/exam-questions-client.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(pkg.version, '1.0.192');
assert.ok(sw.includes('r192'), 'SW deve estar na r192');

// 1. Filtro #questionSubject restrito ao edital quando houver edital ativo (sem subtópicos soltos)
assert.ok(html.includes('editalOrder.length?editalOrder.includes(subjectKey(c)):KNOWN_CANONICAL_SUBJECTS.has(c)'), 'renderQuestionFilters deve manter apenas disciplinas do edital/canônicas');

// 2. Art. 22 (Horário da busca / Pena) fora de Língua Portuguesa
assert.ok(html.includes('horario da busca|art 22.*busca|art 22.*pena'), 'Legislação Extravagante deve cobrir Art. 22');
assert.ok(v77.includes("subjKey==='lingua portuguesa'&&/^art\\.?\\s*\\d+/i.test(cleanItemTopic)"), 'populateTopicFilter deve impedir tópicos Art. XX em Português');

// 3. Revisão 1-7-30 / Caderno de Erros reclassifica erros antigos pelo texto do enunciado
assert.ok(v77.includes('const errStmtText = err.question || err.statement ||'), 'deduplicateAndSanitizeErrorNotebook deve ler err.question || err.statement');

// 4. Concordância 1 dia seguido aplicada nos dois cards (Hero + Ofensiva)
assert.ok(html.includes('class="streakDaysUnit"') && html.includes("querySelectorAll('#streakDaysUnit,.streakDaysUnit')"), 'Ofensiva deve atualizar singular/plural nos dois elementos');

// 5. Selo explícito em questões autorais mesmo offline
const sb = { window: null, console };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(eq, sb);
const badgeAutoral = sb.JCExamQuestions.validationBadgeInfo({ origin: 'autoral', statement: 'Teste', options: ['A', 'B'] });
assert.equal(badgeAutoral.label, 'Gabarito não confirmado');

// 6. Badge PDF sem quebra de linha
assert.ok(css.includes('word-break: keep-all !important'), 'CSS deve impedir quebra do badge PDF em duas linhas');

console.log('OK: test-r192-live-polish.mjs (todas as 6 verificações da r192 passaram)');
