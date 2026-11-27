#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const meJs = fs.readFileSync('dist/missao-elite-features.js', 'utf8');
const v77 = fs.readFileSync('dist/v77-experience.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const sqlF = fs.readFileSync('scripts/manual/triar_formulas_e_enunciados_longos.sql', 'utf8');

assert.ok(meJs.includes('Gabarito oculto para evitar spoiler'), 'Fix 1: bloqueio de spoiler no popup ausente');
assert.ok(meJs.includes('jcRevealSpoilerBtn'), 'Fix 1: botão opcional revelar spoiler ausente');
assert.ok(meJs.includes('T23:59:59'), 'Fix 2: contagem regressiva unificada com T23:59:59 ausente');
assert.ok(html.includes('Revisão r198') && !html.includes('Revisão r187'), 'Fix 3: Diagnóstico deve exibir Revisão r198');
assert.ok(meJs.includes('&times;') && meJs.includes('b.blur()'), 'Fix 4: ícone × visível e blur de aba no popup ausentes');
assert.ok(css.includes('[data-theme="light"] .meMissionProg') && css.includes('#0369a1'), 'Fix 4: contraste Tema Claro ausente');
assert.ok(v77.includes('Precisão Global (histórico geral):'), 'Fix 5: escopo explícito em Desempenho ausente');
assert.ok(sw.includes('r198'), 'SW deve estar na r198');
assert.ok(sqlF.includes('tem que dar 21'), 'SQL de fórmulas deve estar ajustado para trava 21');

console.log('✅ test-r198-final-polish: TODOS OS 5 AJUSTES + SQL TRAVA 21 VALIDADOS!');
