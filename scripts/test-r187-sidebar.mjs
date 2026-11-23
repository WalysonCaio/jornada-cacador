// Real sidebar/navigation handlers, with DOM-only fixtures and no account/API.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const handlers=section('  function ensureCollapsibleDesktopSidebar()','  // Agrupa cartões secundários');
const boot=section('  function bootCaveiraUiAndFullscreenTimer()','  JC_MODULES.caveiraCleanUi =');
function node(id,initialClasses=''){
  const classes=new Set(initialClasses.split(/\s+/).filter(Boolean)),attributes=new Map();
  return {id,dataset:{},classList:{contains:name=>classes.has(name),toggle(name,on){const selected=on===undefined?!classes.has(name):Boolean(on);selected?classes.add(name):classes.delete(name);return selected;}},
    setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name),getAttribute:name=>attributes.get(name),attributes};
}
function fixture(active='report',observerAvailable=true){
  const views=['today','report','study','library'].map(id=>node(id,'view'+(id===active?' active':'')));
  const panels=['summaries','laws'].map(id=>node(id,'studyPanel'+(id==='summaries'?' active':'')));
  const buttons=['today','report','study','study:laws','library','profile','profile:tactical'].map(id=>{const btn=node('side-'+id,id==='today'?'active':'');btn.dataset.jcSideView=id;return btn;});
  const main=node('main'),rail=node('jcCollapsibleSidebar'),observers=[];
  const study=views.find(view=>view.id==='study');study.querySelectorAll=selector=>selector==='.studyPanel'?panels:[];
  rail.querySelectorAll=selector=>selector==='[data-jc-side-view]'?buttons:[];
  const document={
    getElementById:id=>id===rail.id?rail:[...views,...panels].find(item=>item.id===id)||null,
    querySelector:selector=>selector==='.view.active'?views.find(view=>view.classList.contains('active'))||null:selector==='#study .studyPanel.active'?panels.find(panel=>panel.classList.contains('active'))||null:['main.app','main'].includes(selector)?main:null,
    querySelectorAll:selector=>selector==='.view'?views:[]
  };
  class Observer{
    constructor(callback){this.callback=callback;this.targets=new Map();observers.push(this);}
    observe(target,options){this.targets.set(target,options);}
    disconnect(){this.targets.clear();}
    deliver(records){this.callback(records);}
  }
  let renders=0,updates=0,saves=0;
  const ctx={document,console,MutationObserver:observerAvailable?Observer:undefined,
    injectCaveiraCleanUiStyles(){},ensureFullscreenFocusModalExists(){},ensureTopHeaderFocusTimerBar(){},preferredCleanMode:()=>true,applyCaveiraCleanDashboardMode(){},updateAllFocusTimerDisplays(){updates++;},save(){saves++;throw new Error('Sidebar must not save progress');},setTimeout(){throw new Error('Sidebar must not poll');}};
  ctx.window=ctx;
  const setActive=id=>views.forEach(view=>view.classList.toggle('active',view.id===id));
  ctx.openView=function(id){if(!views.some(view=>view.id===id))return false;setActive(id);renders++;return 'opened:'+id;};
  vm.createContext(ctx);vm.runInContext(handlers+boot,ctx);
  const assertActive=id=>{
    assert.deepEqual(buttons.filter(btn=>btn.classList.contains('active')).map(btn=>btn.dataset.jcSideView),id?[id]:[]);
    for(const btn of buttons)assert.equal(btn.getAttribute('aria-current'),btn.dataset.jcSideView===id?'page':undefined);
  };
  return {ctx,views,panels,buttons,main,rail,observers,setActive,assertActive,get renders(){return renders;},get updates(){return updates;},get saves(){return saves;}};
}

// Session restoration ran before the sidebar script: boot must read the active DOM.
{
 const e=fixture('report'),mounted=[];
 e.ctx.JC_MODULES={caveiraFullSuiteR179:{init(){assert.fail('navigation cannot run the full boot audit')},initView:id=>mounted.push(id)}};
 e.ctx.bootCaveiraUiAndFullscreenTimer();
 e.ctx.openView('report');e.ctx.openView('library');e.ctx.openView('not-a-view');
 assert.deepEqual(mounted,['report','library','library'],'feature mounting follows the actual visible view even when navigation is refused');
 const calls=[],stubs={tickTrailHearts20MinRegen:()=>calls.push('hearts'),mountCaveiraEssayHub:()=>calls.push('essay'),mountPainelTaticoInProfile:()=>calls.push('profile'),mountCaveiraFlashcardsHub:()=>calls.push('flashcards'),mountCaveiraSmartLawsHub:()=>calls.push('laws'),mountCaveiraQuestionBankEnhancements:()=>calls.push('questions')};
 vm.createContext(stubs);vm.runInContext(section('  function initR179View(', '  function initAllR179()'),stubs);
 stubs.initR179View('report');assert.deepEqual(calls,['questions']);
 stubs.initR179View('today');assert.deepEqual(calls,['questions']);
 stubs.initR179View('study');assert.deepEqual(calls,['questions','flashcards','laws']);
}
{
  const e=fixture('report');e.ctx.bootCaveiraUiAndFullscreenTimer();e.assertActive('report');
  assert.equal(e.observers.length,1);assert.equal(e.renders,0);assert.equal(e.saves,0);
  assert.equal(e.ctx.openView('library'),'opened:library');e.assertActive('library');
  assert.equal(e.ctx.openView('not-a-view'),false);e.assertActive('library');
  assert.equal(e.ctx.openView('report'),'opened:report');e.assertActive('report');
  for(let i=0;i<8;i++)e.ctx.bootCaveiraUiAndFullscreenTimer();
  assert.equal(e.observers.length,1,'repeated boot cannot create observer cascades');
  assert.equal(e.observers[0].targets.get(e.main).subtree,undefined,'ordinary cards/timer DOM must not be observed');
  for(const [target,options] of e.observers[0].targets)if(target!==e.main){assert.equal(options.attributes,true);assert.deepEqual(Array.from(options.attributeFilter),['class']);}
}
// A later hook can replace openView, or internal code can activate a view directly.
{
  const e=fixture('today');
  e.ctx.openView=()=>false; // The duel/session navigation guard refuses a known target.
  e.ctx.bootCaveiraUiAndFullscreenTimer();assert.equal(e.ctx.openView('report'),false);e.assertActive('today');
}
// A later hook can replace openView, or internal code can activate a view directly.
{
  const e=fixture('today');e.ctx.bootCaveiraUiAndFullscreenTimer();
  e.ctx.openView=id=>{e.setActive(id);return id;};e.ctx.openView('report');
  e.observers[0].deliver([{type:'attributes',target:e.views.find(view=>view.id==='report'),attributeName:'class'}]);
  e.assertActive('report');assert.equal(e.saves,0);assert.equal(e.renders,0);
  e.ctx.syncSidebarActiveState('today');e.assertActive('report','requested target cannot override the visible view');
}
// Laws follows its actual active panel; stale explicit hints do not mark another view.
{
  const e=fixture('study');e.ctx.bootCaveiraUiAndFullscreenTimer();e.assertActive('study');
  e.panels.forEach(panel=>panel.classList.toggle('active',panel.id==='laws'));
  e.observers[0].deliver([{type:'attributes',target:e.panels[1],attributeName:'class'}]);e.assertActive('study:laws');
  e.setActive('report');e.ctx.syncSidebarActiveState('study:laws');e.assertActive('report');
  e.setActive('study');e.panels.forEach(panel=>panel.classList.toggle('active',panel.id==='summaries'));e.ctx.syncSidebarActiveState();e.assertActive('study');
}
// Profile can be mounted after boot; the same observer registers the new view.
{
  const e=fixture('report');e.ctx.bootCaveiraUiAndFullscreenTimer();
  const profile=node('profile','view');e.views.push(profile);e.setActive('profile');
  e.observers[0].deliver([{type:'childList',target:e.main,addedNodes:[profile]}]);
  assert(e.observers[0].targets.has(profile));e.assertActive('profile');
  e.ctx.syncSidebarActiveState('profile:tactical');e.assertActive('profile:tactical');
  e.ctx.syncSidebarActiveState();e.assertActive('profile:tactical');
  e.ctx.openView('report');e.assertActive('report');e.ctx.openView('profile');e.assertActive('profile');
  e.setActive('none');e.ctx.syncSidebarActiveState();e.assertActive('');
}
// The immediate initial state and navigation hook remain usable without an observer.
{
  const e=fixture('report',false);e.ctx.bootCaveiraUiAndFullscreenTimer();e.assertActive('report');
  e.ctx.openView('library');e.assertActive('library');assert.equal(e.observers.length,0);
}
assert(!handlers.includes("item.view === 'today' ? 'active'"),'sidebar creation must not force Home active');
console.log('OK r187 sidebar: initial restoration, internal/late navigation, actual view, laws/profile, singleton observer and no progress writes.');
