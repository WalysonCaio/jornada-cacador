#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const meJs = fs.readFileSync('dist/missao-elite-features.js', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');

assert.ok(html.includes('id="headerLogoutBtn"'), 'Botão de logout no cabeçalho ausente');
assert.ok(html.includes('id="menuLogoutBtn"'), 'Botão de logout na Central do Caçador ausente');
assert.ok(html.includes('window.requestLogoutAccount=function()'), 'Helper seguro requestLogoutAccount ausente');
assert.ok(html.includes("$('#headerLogoutBtn').hidden=!signed"), 'Visibilidade automática do logout no cabeçalho ausente');
assert.ok(meJs.includes('ensureProfileLogoutButton') && meJs.includes('meProfileLogoutBtn'), 'Botão de logout na aba Perfil ausente');
assert.ok(sw.includes('r201') && html.includes('Revisão r201'), 'Versão deve estar na r201');

console.log('✅ test-r201-logout: BOTÃO DE LOGOUT NO CABEÇALHO, MENU E PERFIL VALIDADO!');
