import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const archCode = fs.readFileSync(path.join(root, 'dist', 'jc-architecture-modules.js'), 'utf8');
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const swCode = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');

console.log('=== Teste r178/r180: Redesign Clean UI, Sidebar Retrátil & Cronômetro Tela Cheia ===');

assert.ok(swCode.includes('r180'), 'sw.js deve usar cache r180');
console.log('✓ 1. Service Worker atualizado para r180');

const navMatch = htmlCode.match(/<nav class="tabs"[\s\S]*?<\/nav>/);
assert.ok(navMatch, 'nav.tabs deve continuar presente no HTML para mobile');
const navButtons = navMatch[0].match(/<button\b/g) || [];
assert.equal(navButtons.length, 5, 'nav.tabs deve preservar exatamente os 5 botões principais');
console.log('✓ 2. Barra inferior nav.tabs preservada com 5 botões para mobile');

const elementsById = new Map();
function makeEl(tag, id = '') {
  let _id = id || '';
  const el = {
    tagName: String(tag || 'DIV').toUpperCase(),
    get id() { return _id; },
    set id(v) { _id = String(v || ''); if (_id) elementsById.set(_id, this); },
    className: '',
    innerHTML: '',
    textContent: '',
    hidden: false,
    style: { cssText: '', setProperty() {} },
    dataset: {},
    children: [],
    parentElement: null,
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach((c) => this._set.add(c)); },
      remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._set.has(c)) { this._set.delete(c); return false; }
          this._set.add(c); return true;
        }
        if (force) this._set.add(c); else this._set.delete(c);
        return !!force;
      },
      contains(c) { return this._set.has(c); }
    },
    setAttribute(k, v) { this[k] = v; if (k === 'id') this.id = v; },
    getAttribute(k) { return this[k] || null; },
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) elementsById.set(child.id, child);
      }
      return child;
    },
    prepend(child) { return this.appendChild(child); },
    insertBefore(child) { return this.appendChild(child); },
    closest() { return null; },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  if (_id) elementsById.set(_id, el);
  return el;
}

const headEl = makeEl('HEAD', 'head');
const bodyEl = makeEl('BODY', 'body');
const mainApp = makeEl('MAIN', 'mainApp');
const topEl = makeEl('HEADER', 'topHeader');
const topActions = makeEl('DIV', 'topActions');
topEl.appendChild(topActions);
mainApp.appendChild(topEl);
bodyEl.appendChild(mainApp);

const storage = new Map();
const sandbox = {
  window: null,
  globalThis: null,
  console,
  setTimeout: (fn) => { try { fn(); } catch (_e) {} return 1; },
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  performance: { mark() {}, measure() {}, getEntriesByName() { return []; }, now: () => 100 },
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  },
  navigator: { wakeLock: { request: async () => ({ release: async () => {} }) } },
  document: {
    readyState: 'complete',
    head: headEl,
    body: bodyEl,
    documentElement: { requestFullscreen: async () => {}, classList: bodyEl.classList },
    fullscreenElement: null,
    exitFullscreen: async () => {},
    getElementById: (id) => elementsById.get(id) || makeEl('DIV', id),
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => {
      if (sel === '.top') return topEl;
      if (sel === '.topActions') return topActions;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  state: {
    xp: 1747,
    streak: 9,
    studyHoursLog: {},
    learning: { hearts: 2, heartCooldownUntil: Date.now() + 1200000 },
    pomodoro: { remainingSeconds: 3000, durationSeconds: 3000, running: false }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
new vm.Script(archCode, { filename: 'jc-architecture-modules.js' }).runInContext(sandbox);

const ui = sandbox.JC_MODULES.caveiraCleanUi;
assert.ok(ui, 'Módulo caveiraCleanUi deve existir');
assert.equal(ui.formatHHMMSS(0), '00:00:00');
assert.equal(ui.formatHHMMSS(3000), '00:50:00');
assert.equal(ui.formatHHMMSS(3661), '01:01:01');
console.log('✓ 3. Formatação tabular HH:MM:SS validada');

sandbox.openFullscreenFocusTimer();
const overlay = elementsById.get('jcFullscreenFocusOverlay');
assert.ok(overlay && overlay.classList.contains('open'), 'Overlay tela cheia deve abrir');
sandbox.closeFullscreenFocusTimer();
assert.ok(!overlay.classList.contains('open'), 'Overlay tela cheia deve fechar');
console.log('✓ 4. Modo Foco Tela Cheia validado');

ui.applyCleanMode(true);
assert.ok(bodyEl.classList.contains('jcCleanDashboard') && bodyEl.classList.contains('compactCleanUx'), 'Modo limpo deve ativar jcCleanDashboard e compactCleanUx');
ui.applyCleanMode(false);
assert.ok(!bodyEl.classList.contains('jcCleanDashboard'), 'Modo detalhado deve remover jcCleanDashboard');
console.log('✓ 5. Alternância Visual Limpo ON / OFF validada');
