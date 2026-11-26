import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(pkg.version, '1.0.194');
assert.ok(sw.includes('r194'), 'SW deve estar na r194');

// 1. Ícone Minha conta no #moreDialog e ícones Revisar agora / Resolver questões na Home
assert.ok(html.includes('👤<span>Minha conta</span>'), 'Minha conta deve usar ícone 👤');
assert.ok(v77.includes('<i>🔄</i><span class="cmdPill" id="urgentReviewPill">'), 'Revisar agora deve usar ícone 🔄');
assert.ok(v77.includes('<i>🎯</i><span class="cmdPill" id="questionShortcutPill">'), 'Resolver questões deve usar ícone 🎯');

// 2. Hero no Tema Claro: especificidade section.hero sobrepõe :not(.hero)
assert.ok(v77.includes('body.lightAppTheme section.hero .small.muted'), 'Hero em Tema Claro deve forçar contraste claro com alta especificidade');

// 3. Badge PDF (.docIcon) sem quebra em duas linhas
assert.ok(css.includes('.docIcon') && css.includes('min-width: 48px !important'), '.docIcon deve ter largura mínima e nowrap para não quebrar PDF em PD/F');

// 4. Revisão 1-7-30 infere disciplina apenas pelo enunciado (sem viés do topic antigo)
assert.ok(html.includes("inferStrictQuestionSubjectDecision(x.e.question||x.e.statement||'','','',x.e.options||[],{})"), 'renderReviews deve inferir disciplina só pelo enunciado');
assert.ok(v77.includes("window.inferStrictQuestionSubjectDecision(errStmtText, '', '', err.options || [], {})"), 'deduplicateAndSanitizeErrorNotebook deve inferir disciplina só pelo enunciado');

console.log('OK: test-r194-final-touches.mjs (todos os 4 retoques da r194 validados)');
