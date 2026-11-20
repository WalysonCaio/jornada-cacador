// Exercita o controlador real com DOM simulado; não certifica aparência ou WCAG.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../dist/jc-architecture-modules.js', import.meta.url), 'utf8');
const experience = fs.readFileSync(new URL('../dist/v77-experience.js', import.meta.url), 'utf8');
const start = source.indexOf('(function () {', source.indexOf('Módulo 7 (r178)'));
const end = source.indexOf('// MÓDULO 8', start);
assert(start > 0 && end > start);
const moduleCode = source.slice(start, end);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; }
function fixture() {
  const ids = new Map(), listeners = new Map(), storage = new Map(), messages = [];
  const ctx = {console, Promise, Date, Math, setTimeout, clearTimeout, state:{studyByDay:{'2026-11-20':3661},settings:{dailyMinutes:90}},timerLeft:1801,timerRun:false,localDayKey:()=> '2026-11-20'};
  function element(tag = 'div', id = '') {
    const attributes = new Map(), classes = new Set(); let storedId = '', storedHTML = '';
    const el = {
      tagName:tag.toUpperCase(), hidden:false, disabled:false, inert:false, isConnected:true, children:[], parentElement:null, style:{overflow:'',setProperty(){}}, dataset:{},
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,flag)=>{const yes=flag===undefined?!classes.has(x):Boolean(flag);if(yes)classes.add(x);else classes.delete(x);return yes;}},
      setAttribute:(key,value)=>attributes.set(key,String(value)),getAttribute:key=>attributes.has(key)?attributes.get(key):null,removeAttribute:key=>attributes.delete(key),
      appendChild(child){child.parentElement=this;this.children.push(child);return child;},
      focus(){ctx.document.activeElement=this;}, getClientRects:()=>[{}], closest:()=>null,
      contains(other){return other===this || this.children.some(child=>child.contains(other));},
      querySelectorAll(selector){if(selector==='[data-jc-focus-mode]')return this.children.filter(x=>x.dataset.jcFocusMode);return this.children.filter(x=>x.tagName==='BUTTON'&&!x.disabled);},
      querySelector(){return null;}, addEventListener(){}, click(){return this.onclick?.();}
    };
    Object.defineProperty(el,'id',{get:()=>storedId,set:value=>{storedId=String(value);if(storedId)ids.set(storedId,el);}});
    Object.defineProperty(el,'innerHTML',{get:()=>storedHTML,set:value=>{storedHTML=String(value);if(el.id==='jcFullscreenFocusOverlay'){
      for(const match of storedHTML.matchAll(/<(button|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)){el.appendChild(element(match[1],match[2]));}
      for(const mode of ['countdown','elapsed']){const chip=element('button');chip.dataset.jcFocusMode=mode;el.appendChild(chip);}
    }}});
    if(id)el.id=id;
    return el;
  }
  const body = element('body'), head = element('head'), root = element('html');
  const origin = element('button','origin'), main = element('main','background');
  main.setAttribute('aria-hidden','false'); main.appendChild(origin); body.appendChild(main); body.style.overflow='auto';
  const preInert = element('aside');preInert.inert=true;body.appendChild(preInert);
  for(const id of ['jcSideCleanModeToggleBtn','cleanUxToggleBtn','settingsCleanUxToggleBtn','jcTodaySecondaryAccordion','jcReportSecondaryAccordion'])element('button',id);
  const label = element('span');
  const document = ctx.document = {
    readyState:'loading',visibilityState:'visible',fullscreenElement:null,activeElement:origin,body,head,documentElement:root,
    createElement:element,getElementById:id=>ids.get(id)||null,querySelector:selector=>selector==='#jcSideCleanModeToggleBtn .jcSideNavLabel'?label:null,querySelectorAll:()=>[],
    addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
    exitFullscreen:async()=>{document.fullscreenElement=null;ctx.exits++;}
  };
  const wake = deferred();ctx.exits=0;ctx.wakeRequests=0;ctx.toggleCalls=0;
  ctx.navigator={wakeLock:{request:()=>{ctx.wakeRequests++;return wake.promise;}}};
  ctx.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
  ctx.toast=message=>messages.push(message);ctx.toggleTimer=()=>{ctx.toggleCalls++;ctx.timerRun=!ctx.timerRun;};ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(moduleCode,ctx);
  const dispatch=(name,event={})=>{let prevented=false;const e={preventDefault(){prevented=true;this.defaultPrevented=true;},...event};for(const handler of listeners.get(name)||[])handler(e);return prevented;};
  return {ctx,ids,storage,messages,body,main,preInert,origin,label,wake,document,dispatch,element};
}
// Preferências, classes e comandos de ambas as entradas são mantidos juntos.
const f=fixture();
f.ctx.applyCaveiraCleanDashboardMode(true);
assert.equal(f.storage.get('jc_caveira_clean_mode_v1'),'1');assert.equal(f.storage.get('jc_clean_ux_v1'),'clean');
assert(f.body.classList.contains('jcCleanDashboard')&&f.body.classList.contains('compactCleanUx'));
assert.equal(f.label.textContent,'Visual Limpo: ON');assert.equal(f.ids.get('cleanUxToggleBtn').getAttribute('aria-pressed'),'true');
assert.equal(f.ids.get('jcTodaySecondaryAccordion').open,false);
f.ctx.applyCaveiraCleanDashboardMode(false);
assert.equal(f.storage.get('jc_caveira_clean_mode_v1'),'0');assert.equal(f.storage.get('jc_clean_ux_v1'),'detailed');
assert(!f.body.classList.contains('jcCleanDashboard')&&!f.body.classList.contains('compactCleanUx'));
assert.equal(f.ids.get('jcReportSecondaryAccordion').open,true);
const cleanStart=experience.indexOf('  function applyCleanUxMode(mode)');const cleanEnd=experience.indexOf('  function applyGlobalAppTheme(',cleanStart);
vm.runInContext(experience.slice(cleanStart,cleanEnd),f.ctx);f.ctx.injectFullLightAppThemeStyles=()=>{};f.ctx.applyCleanUxMode('clean');
assert.equal(f.storage.get('jc_caveira_clean_mode_v1'),'1');assert.equal(f.label.textContent,'Visual Limpo: ON');
// Não ocultar avisos pedagógicos de confiança. Verifica regras CSS sem fingir renderização.
const cleanRules=[...source.matchAll(/body\.jcCleanDashboard[^{}]*\{[^{}]*display:\s*none\s*!important;?[^{}]*\}/g)].map(m=>m[0]);
assert(cleanRules.length>0);assert(cleanRules.every(rule=>!rule.includes('questionTrust')));
assert(source.includes('@media (min-width: 960px)'));assert(source.includes('max-height:100dvh'));assert(source.includes('@media (prefers-reduced-motion:reduce)'));
// Abrir concentra foco, guarda estado anterior, e fechar restaura exatamente o fundo.
f.ctx.openFullscreenFocusTimer();const modal=f.ids.get('jcFullscreenFocusOverlay');assert(modal&&!modal.hidden);
assert.equal(f.document.activeElement,f.ids.get('jcFsPlayPauseBtn'));assert.equal(f.main.inert,true);assert.equal(f.main.getAttribute('aria-hidden'),'true');assert.equal(f.body.style.overflow,'hidden');
assert.equal(f.ids.get('jcFocusGiantDigits').textContent,'00:30:01');
const chips=modal.querySelectorAll('[data-jc-focus-mode]');chips[1].click();assert.equal(f.storage.get('jc_focus_display_mode_v1'),'elapsed');assert.equal(f.ids.get('jcFocusGiantDigits').textContent,'01:01:01');
chips[0].click();
const controls=modal.querySelectorAll('button');controls.at(-1).focus();assert.equal(f.dispatch('keydown',{key:'Tab'}),true);assert.equal(f.document.activeElement,controls[0]);
controls[0].focus();f.dispatch('keydown',{key:'Tab',shiftKey:true});assert.equal(f.document.activeElement,controls.at(-1));
f.document.activeElement=f.origin;f.dispatch('focusin',{target:f.origin});assert.equal(f.document.activeElement,controls[0]);
// Espaço em botão/input permanece com o comportamento nativo, sem acionar duas vezes.
for(const tag of ['button','input','textarea','select']){f.document.activeElement=f.element(tag);assert.equal(f.dispatch('keydown',{key:' '}),false);}
assert.equal(f.ctx.toggleCalls,0);
f.document.activeElement=modal;assert.equal(f.dispatch('keydown',{key:' ',repeat:true}),false);assert.equal(f.ctx.toggleCalls,0);
assert.equal(f.dispatch('keydown',{key:' '}),true);assert.equal(f.ctx.toggleCalls,1);f.dispatch('keydown',{key:' '});assert.equal(f.ctx.toggleCalls,1,'não duplicar operação pendente');await flush();
f.dispatch('keydown',{key:' '});assert.equal(f.ctx.toggleCalls,2);await flush();
assert.equal(f.dispatch('keydown',{key:'Escape'}),true);assert.equal(modal.hidden,true);
assert.equal(f.main.inert,false);assert.equal(f.preInert.inert,true);assert.equal(f.main.getAttribute('aria-hidden'),'false');assert.equal(f.preInert.getAttribute('aria-hidden'),null);assert.equal(f.body.style.overflow,'auto');assert.equal(f.document.activeElement,f.origin);
// Wake Lock recebido depois do fechamento é solto, sem manter a tela acordada.
let released=0;f.wake.resolve({release:async()=>{released++;},addEventListener(){}});await flush();assert.equal(released,1);assert.equal(f.ctx.wakeRequests,1);
// Falha de fullscreen é opcional; fullscreen adquirido por este diálogo é encerrado.
const native=fixture();native.document.documentElement.requestFullscreen=async()=>{native.document.fullscreenElement=native.document.documentElement;};
native.ctx.openFullscreenFocusTimer();await flush();native.ctx.closeFullscreenFocusTimer();await flush();assert.equal(native.ctx.exits,1);
// Escape nativo/fullscreenchange também encerra overlay e restaura foco.
const escaped=fixture();escaped.document.documentElement.requestFullscreen=async()=>{escaped.document.fullscreenElement=escaped.document.documentElement;};
escaped.ctx.openFullscreenFocusTimer();await flush();escaped.document.fullscreenElement=null;escaped.dispatch('fullscreenchange');assert.equal(escaped.ids.get('jcFullscreenFocusOverlay').hidden,true);assert.equal(escaped.document.activeElement,escaped.origin);
// Mudança de visibilidade não solicita bloqueio novo enquanto a página está oculta.
const hidden=fixture();hidden.document.visibilityState='hidden';hidden.ctx.openFullscreenFocusTimer();assert.equal(hidden.ctx.wakeRequests,0);hidden.ctx.closeFullscreenFocusTimer();
console.log('OK r183: preferências sincronizadas, confiança preservada, foco/teclado, wake lock tardio e fullscreen. CSS conferido estruturalmente; sem certificação visual/WCAG.');
