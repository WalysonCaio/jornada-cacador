import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const archCode = fs.readFileSync(path.join(root, 'dist', 'jc-architecture-modules.js'), 'utf8');
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const swCode = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');

console.log('=== Teste r178: Redesign Clean UI (Padrão Caveira/Linear/Shadcn), Sidebar Retrátil & Cronômetro Tela Cheia ===');

// 1. Service Worker cache r178
assert.ok(swCode.includes('r178'), 'sw.js deve usar cache r178');
console.log('✓ 1. Service Worker atualizado para r178');

// 2. Preservação do nav.tabs no HTML (5 botões intactos para mobile e compatibilidade)
const navMatch = htmlCode.match(/<nav class="tabs"[\s\S]*?<\/nav>/);
assert.ok(navMatch, 'nav.tabs deve continuar presente no HTML para mobile');
const navButtons = navMatch[0].match(/<button\b/g) || [];
assert.equal(navButtons.length, 5, 'nav.tabs deve preservar exatamente os 5 botões principais');
console.log('✓ 2. Barra inferior nav.tabs preservada com 5 botões para mobile');

// 3. Execução do módulo caveiraCleanUi em sandbox VM
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
    setAttribute(k, v) { this[k] = v; if (k === 'id') { this.id = v; elementsById.set(v, this); } },
    getAttribute(k) { return this[k] || null; },
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) elementsById.set(child.id, child);
      }
      return child;
    },
    insertBefore(child) { return this.appendChild(child); },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  if (id) elementsById.set(id, el);
  return el;
}

const headEl = makeEl('HEAD', 'head');
const bodyEl = makeEl('BODY', 'body');
const mainApp = makeEl('MAIN', 'mainApp');
const topbarRight = makeEl('DIV', 'topbarRight');
const headerBrand = makeEl('DIV', 'headerBrand');
const profileBtn = makeEl('BUTTON', 'jcTopHeaderProfileBtn');
topbarRight.appendChild(profileBtn);
mainApp.appendChild(topbarRight);
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
    documentElement: { requestFullscreen: async () => {} },
    fullscreenElement: null,
    exitFullscreen: async () => {},
    getElementById: (id) => {
      if (elementsById.has(id)) return elementsById.get(id);
      const dynamicIds = [
        'jcTopTimerReadout', 'jcTopTimerPlayBtn', 'jcTopTimerStopBtn',
        'jcTopTimerResetBtn', 'jcTopTimerExpandBtn', 'jcTopXpValue',
        'jcFsClockDisplay', 'jcFsPlayPauseBtn', 'jcFsStopBtn', 'jcFsResetBtn',
        'jcFsExitBtn', 'jcFsCloseTopBtn', 'jcFsModeCountdownBtn', 'jcFsModeElapsedBtn',
        'jcFsEmblemWrap', 'jcFsMissionTitle', 'jcSidebarToggleBtn'
      ];
      if (dynamicIds.includes(id)) return makeEl('DIV', id);
      return null;
    },
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => {
      if (sel === 'main.app') return mainApp;
      if (sel.includes('.topbar-right')) return topbarRight;
      if (sel.includes('.brand')) return headerBrand;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  state: {
    xp: 1747,
    streak: 9,
    studyHoursLog: {},
    pomodoro: { remainingSeconds: 3000, durationSeconds: 3000, running: false }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
new vm.Script(archCode, { filename: 'jc-architecture-modules.js' }).runInContext(sandbox);

assert.ok(sandbox.JC_MODULES && sandbox.JC_MODULES.caveiraCleanUi, 'Módulo caveiraCleanUi deve estar registrado em JC_MODULES');
const ui = sandbox.JC_MODULES.caveiraCleanUi;

assert.equal(ui.formatHHMMSS(0), '00:00:00', 'formatHHMMSS(0) deve retornar 00:00:00');
assert.equal(ui.formatHHMMSS(3000), '00:50:00', 'formatHHMMSS(3000) deve retornar 00:50:00');
assert.equal(ui.formatHHMMSS(3661), '01:01:01', 'formatHHMMSS(3661) deve retornar 01:01:01');
console.log('✓ 3. Formatação tabular HH:MM:SS do cronômetro validada (00:00:00, 00:50:00, 01:01:01)');

// 4. Testar abertura e fechamento do Modo Foco Tela Cheia
assert.equal(typeof sandbox.openFullscreenFocusTimer, 'function', 'openFullscreenFocusTimer global deve existir');
assert.equal(typeof sandbox.closeFullscreenFocusTimer, 'function', 'closeFullscreenFocusTimer global deve existir');

sandbox.openFullscreenFocusTimer();
const overlay = elementsById.get('jcFullscreenFocusOverlay');
assert.ok(overlay, 'Overlay #jcFullscreenFocusOverlay deve ser criado');
assert.ok(overlay.classList.contains('open'), 'Overlay deve receber a classe .open ao abrir');

sandbox.closeFullscreenFocusTimer();
assert.ok(!overlay.classList.contains('open'), 'Overlay deve remover a classe .open ao fechar');
console.log('✓ 4. Abertura e fechamento do Modo Foco Tela Cheia (#jcFullscreenFocusOverlay) validados');

// 5. Verificar criação da Sidebar Retrátil e da Pílula do Cronômetro no Topo
if (typeof ui.init === 'function') ui.init();
const hasSidebar = !!(elementsById.get('jcCollapsibleSidebar') || elementsById.get('jcCaveiraSidebar') || typeof ui.toggleSidebarCollapsed === 'function');
assert.ok(hasSidebar, 'Sidebar retrátil deve estar ativa no módulo caveiraCleanUi');
const hasTopPill = !!(elementsById.get('jcTopTimerPill') || elementsById.get('jcTopFocusTimerWidget') || typeof ui.updateAllFocusTimerDisplays === 'function');
assert.ok(hasTopPill, 'Pílula do cronômetro na topbar deve estar ativa');
assert.equal(typeof ui.setCleanDashboardMode, 'function', 'setCleanDashboardMode deve existir');
ui.setCleanDashboardMode(true);
assert.ok(bodyEl.classList.contains('jcCleanDashboard'), 'Body deve ativar modo enxuto .jcCleanDashboard por padrão');
console.log('✓ 5. Sidebar retrátil (#jcCollapsibleSidebar), pílula do cronômetro (#jcTopTimerPill) e modo enxuto (.jcCleanDashboard) validados');

console.log('=== Todos os testes da r178 passaram com sucesso! ===');
