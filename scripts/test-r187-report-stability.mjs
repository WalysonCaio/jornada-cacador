// Execute the real workspace, report/render wrappers and status DOM with a
// minimal deterministic document. No browser, external API or private data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const workspace=read('dist/questions-workspace.js'),v77=read('dist/v77-experience.js');
const slice=(start,end)=>{const a=v77.indexOf(start),b=v77.indexOf(end,a);assert(a>=0&&b>a,start);return v77.slice(a,b)};
class Element{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.className='';this.hidden=false;this._text='';this.scrollTop=0;this.scrollLeft=0;this.dataset={};this.listeners={};this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:name=>{this.className+=' '+name}};}
 appendChild(node){node.remove();node.parentElement=this;this.children.push(node);return node;}
 prepend(node){node.remove();node.parentElement=this;this.children.unshift(node);}
 insertAdjacentElement(where,node){assert.equal(where,'afterend');node.remove();const p=this.parentElement;node.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,node);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 contains(node){return this===node||this.children.some(child=>child.contains(node));}
 setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 querySelectorAll(selector){const selectors=selector.split(',').map(x=>x.trim()),out=[];const match=(el,part)=>part==='.view.active'?el.className.includes('view')&&el.className.includes('active'):part[0]==='#'?el.id===part.slice(1):part[0]==='.'?el.className.split(/\s+/).includes(part.slice(1)):part==='[id]'?!!el.id:el.tagName===part.toUpperCase();const visit=node=>{for(const child of node.children){if(selectors.some(part=>match(child,part)))out.push(child);visit(child)}};visit(this);return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){let cur=this;while(cur){if(selector[0]==='.'&&cur.className.split(/\s+/).includes(selector.slice(1)))return cur;cur=cur.parentElement;}return null;}
 get options(){return this.children.filter(x=>x.tagName==='OPTION');}
 get value(){if(this.tagName==='SELECT'){const opts=this.options;return this._value===undefined?(opts[0]?.value||''):opts.some(x=>x.value===this._value)?this._value:'';}return this._value??'';}
 set value(value){this._value=String(value);}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 set textContent(text){this._text=String(text);for(const child of this.children)child.parentElement=null;this.children=[];}
 focus(){this.ownerDocument.activeElement=this;}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
}
const doc={activeElement:null};doc.body=new Element('body',doc);doc.createElement=tag=>new Element(tag,doc);doc.querySelector=selector=>doc.body.querySelector(selector);doc.getElementById=id=>doc.querySelector('#'+id);
function el(tag,id,parent,className=''){const node=doc.createElement(tag);node.id=id;node.className=className;parent?.appendChild(node);return node;}
const report=el('section','report',doc.body,'view active'),head=el('div','reportHead',report,'sectionHead'),trainer=el('div','trainer',report,'questionTrainer');
const field=id=>el('select',id,trainer),subject=field('questionSubject'),topic=field('questionTopic');
function choices(node,values){node.textContent='';for(const value of values){const option=el('option','',node);option.value=value;option.textContent=value;}node.value=values[0];}
choices(subject,['all']);choices(topic,['all']);
const search=el('input','questionSearch',trainer);search.type='text';
const details=el('details','questionsQuickPractice',trainer);details.open=false;
const score=el('button','openScore',head);
const catalogue=el('div','examDocumentsCatalog',el('div','examBankHub',report));catalogue.textContent='PRIVATE OLD CATALOG';
const tasks=[],counts={filters:0,simulados:0,provas:0,desempenho:0,restored:0};let throwNext=false;
const expectedErrors=[];
const ctx={document:doc,console:{...console,error:(...args)=>expectedErrors.push(args)},scrollX:0,scrollY:0,requestAnimationFrame:fn=>tasks.push(fn),setTimeout:fn=>tasks.push(fn),scrollTo(x,y){this.scrollX=x;this.scrollY=y;},
 state:{activeCampaignId:'pmpe',_ownerUserId:'a',_resetEpoch:0,errors:{}},cloudSession:{user:{id:'a'}},ALL_QUESTIONS:Array.from({length:2558},(_,i)=>({id:'q'+i,statement:'Question '+i,subject:'Português',topic:'Crase'})),cloudDocuments:Array.from({length:182},(_,i)=>({id:'doc'+i,title:'PDF '+i})),
 activeCampaign:()=>({dbId:'db-pmpe',customCampaign:{missions:[]}}),q:selector=>doc.querySelector(selector),markViewsDirty(){},
 render(){ctx.renderReport();},renderReport(){counts.desempenho++;},syncHunterStatsSnapshot(){},runV77ViewEnhancements(){},
 offerSavedTimedSimuladoResume(){},renderQuestionFilters(){
  counts.filters++;if(throwNext){throwNext=false;throw new Error('fixture refresh failure');}
  choices(subject,['all','Português','Direito Constitucional']);choices(topic,['all','crase','competencias']);search.value='';details.open=false;
 },
 ensureSimuladoUI(){counts.simulados++;},updateSimuladoAvailability(){},renderGuildOfficialSimuladoBanner(){},enhanceSoloLevelingVisuals(){},
 ensureExamBankHub(){},populateExamHubSelects(){},renderExamBankHub(){counts.provas++;catalogue.textContent='NEW CATALOG '+ctx.cloudSession.user.id;},renderPerformanceChart(){},updateQuestionPool(){counts.restored++;}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(workspace,ctx);
vm.runInContext(slice('  const baseRender=render;\n  render=function(){\n    syncHunterStatsSnapshot();','  window.renderNotifications='),ctx);
function flush(){let steps=0;while(tasks.length){assert(++steps<120,'refresh loop');tasks.shift()();}}
const panel=()=>doc.getElementById('questionsPanel-resolver'),status=()=>panel().querySelector('.questionsPanelStatus');
assert.equal(status().hidden,false,'Preparando is allowed on the initial empty panel');assert.equal(counts.filters,0,'work stays after paint');flush();
assert.equal(counts.filters,1);assert.equal(status().hidden,true);const stableTrainer=trainer,stableSubject=subject;
subject.value='Português';topic.value='crase';search.value='meu filtro';search.focus();search.setSelectionRange(2,5);details.open=true;ctx.scrollY=742;panel().scrollTop=83;
const noFlicker=()=>{assert.equal(status().hidden,true,'mounted Resolver must never return to Preparando');assert.equal(panel().getAttribute('data-initial-loading'),'false');assert.equal(trainer,stableTrainer);assert.equal(subject,stableSubject);};
// Repeated callbacks and equal cloud copies must not rebuild anything.
for(let i=0;i<12;i++){
 ctx.ALL_QUESTIONS=JSON.parse(JSON.stringify(ctx.ALL_QUESTIONS)).reverse();ctx.cloudDocuments=JSON.parse(JSON.stringify(ctx.cloudDocuments)).reverse();
 ctx.markViewsDirty('report');ctx.render();ctx.renderReport();noFlicker();
}
flush();assert.equal(counts.filters,1,'equal data replacements are not dirty revisions');noFlicker();assert.equal(topic.value,'crase');assert.equal(doc.activeElement,search);assert.equal(ctx.scrollY,742);
// Actual changes coalesce into one refresh and retain controls, focus/selection,
// details state, scroll and the filters selected while synchronization happened.
for(let i=0;i<8;i++){
 ctx.ALL_QUESTIONS.push({id:'new'+i,subject:'Português',topic:'Crase',statement:'New question '+i});ctx.state.errors={...ctx.state.errors,['error'+i]:{misses:1}};
 ctx.markViewsDirty('report');ctx.renderReport();ctx.render();noFlicker();
}
flush();assert.equal(counts.filters,2);noFlicker();assert.equal(subject.value,'Português');assert.equal(topic.value,'crase');assert.equal(search.value,'meu filtro');assert.equal(details.open,true);assert.equal(doc.activeElement,search);assert.equal(search.selectionStart,2);assert.equal(search.selectionEnd,5);assert.equal(ctx.scrollY,742);assert.equal(panel().scrollTop,83);assert.equal(counts.restored,1,'restored controls update their displayed availability');
// In-place edits matter; changes to derived _fp/UI fields do not.
ctx.ALL_QUESTIONS[0]._fp='transient';ctx.markViewsDirty('report');ctx.renderReport();flush();assert.equal(counts.filters,2);
ctx.ALL_QUESTIONS[0].communitySourceSignature='new-receipt';ctx.ALL_QUESTIONS[0].communitySourceScopeKey='same-scope-receipt';ctx.markViewsDirty('report');ctx.renderReport();flush();assert.equal(counts.filters,2,'internal receipts do not change the rendered bank');
ctx.ALL_QUESTIONS[0].topic='Regência';ctx.markViewsDirty('report');ctx.renderReport();flush();assert.equal(counts.filters,3);noFlicker();
// A refresh error retains usable controls and reports update failure, not a new
// loading panel. Retrying succeeds without navigation or filter reset.
throwNext=true;ctx.ALL_QUESTIONS[0].topic='Concordância';ctx.markViewsDirty('report');ctx.renderReport();flush();
assert.equal(panel().getAttribute('data-initial-loading'),'false');assert.match(status().textContent,/conteúdo anterior foi mantido/);assert.equal(topic.value,'crase');assert.equal(expectedErrors.length,1,'refresh failure remains observable');ctx.renderReport();flush();noFlicker();
// Selection remains on a mounted secondary tab throughout background callbacks.
ctx.JCQuestionsWorkspace.request('provas');flush();assert.equal(doc.getElementById('questionsPanel-provas').hidden,false);const before=counts.provas;
ctx.cloudDocuments=JSON.parse(JSON.stringify(ctx.cloudDocuments));ctx.markViewsDirty('report');ctx.render();flush();assert.equal(counts.provas,before);assert.equal(doc.getElementById('questionsPanel-provas').hidden,false);
// Scope replacement is a hard reset: stale source names and draft text are
// cleared, old jobs discarded, and a new account must get a first mount.
ctx.ALL_QUESTIONS.push({id:'old-job',statement:'old queued'});ctx.markViewsDirty('report');ctx.renderReport();
ctx.cloudSession={user:{id:'b'}};ctx.state={...ctx.state,_ownerUserId:'b',_resetEpoch:1};ctx.renderReport();
assert.equal(catalogue.textContent,'');assert.equal(search.value,'');assert.equal(ctx.JCQuestionsWorkspace.isActive('resolver'),true);assert.equal(status().hidden,false);flush();
assert.equal(doc.getElementById('questionsPanel-provas').hidden,true);assert.equal(status().hidden,true);assert.equal(catalogue.textContent,'','old account catalogue job was discarded');
assert(!read('dist/questions-workspace.css').includes('[aria-busy="true"]>:not'),'background aria-busy cannot hide mounted contents');
// Execute the independent real-sidebar regression in the required combined gate.
await import('./test-r187-sidebar.mjs');
console.log('OK r187 report: stable mounted DOM, first-load-only placeholder, semantic coalescing, filters/focus/scroll, scopes and sidebar.');
