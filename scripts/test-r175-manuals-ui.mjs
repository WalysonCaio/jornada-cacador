import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const source = read('dist/hunter-manuals.js');
const noDom = {window:{}};
vm.createContext(noDom);vm.runInContext(source,noDom);
const {items,isManual} = noDom.window.JornadaManuals;
assert.equal(items.length,4);
assert.equal(new Set(items.map(item=>item.id)).size,4);
assert(Object.isFrozen(items) && items.every(item=>Object.isFrozen(item)));
assert(items.every(item=>item.content_kind==='platform_manual'&&item.source_label==='Guia da plataforma'));
assert(items.every(item=>!('category' in item)&&!('subject' in item)), 'Catálogo de ajuda não declara disciplina de estudo');
assert.equal(noDom.window.openHunterManuals(),false,'API pode carregar antes de existir DOM sem quebrar a aplicação');
for(const value of [
  ...items, 'Manuais do Caçador (Método & Estratégia)', 'MANUAL OFICIAL DO CAÇADOR',
  ['Manuais do Caçador','Como usar o app?','Abra o menu'],
  {id:'manual-01-ciclo-estudos'}, {category:'Manuais do Caçador'},
  {source:'Manual Oficial do Caçador'}, {content:{subject:'Manuais do Caçador'}},
  {content:{source:'Manual Oficial do Caçador'}}, {content_kind:'platform_manual'},
]) assert.equal(isManual(value),true,JSON.stringify(value));
for(const value of [null,undefined,0,{},'Manual de redação oficial','Manual de Direito Penal',
  {subject:'Língua Portuguesa',title:'Manual de Redação Oficial'},
  ['Língua Portuguesa','Manual é um gênero textual?','Sim.'],
]) assert.equal(isManual(value),false,JSON.stringify(value));

// DOM unit fixture: native dialog events and focus are simulated; no browser,
// authenticated APIs or user data are involved in this check.
class Element {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.dataset={};this.attrs={};this.events={};this.open=false;this.className='';this.id='';}
  get isConnected(){return this===this.doc.body||!!this.parentElement?.isConnected;}
  appendChild(child){child.parentElement=this;this.children.push(child);return child;}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='id')this.id=String(value);if(key==='class')this.className=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  removeAttribute(key){delete this.attrs[key];}
  getAttribute(key){return this.attrs[key]??null;}
  get classList(){return {toggle:(name,active)=>{const classes=new Set(this.className.split(/\s+/).filter(Boolean));if(active)classes.add(name);else classes.delete(name);this.className=[...classes].join(' ');},contains:name=>this.className.split(/\s+/).includes(name)};}
  set innerHTML(html){
    this.html=html;this.children=[];
    const stack=[this];
    for(const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)){
      if(match[1]){if(stack.length>1)stack.pop();continue;}
      const child=new Element(match[2],this.doc);
      for(const attr of match[3].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(attr[1],attr[2]);
      stack.at(-1).appendChild(child);
      if(!/^(br|input|img|hr|meta|link)$/i.test(match[2]))stack.push(child);
    }
  }
  get innerHTML(){return this.html||'';}
  matches(selector){if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return this.classList.contains(selector.slice(1));if(selector[0]==='[')return this.getAttribute(selector.slice(1,-1))!==null;return this.tagName.toLowerCase()===selector;}
  querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(event,handler){(this.events[event]||=[]).push(handler);}
  showModal(){this.open=true;}
  close(){this.open=false;for(const handler of this.events.close||[])handler();}
  focus(){this.doc.activeElement=this;}
  closest(selector){if(selector==='dialog:not([open])'){for(let node=this;node;node=node.parentElement)if(node.tagName==='DIALOG'&&!node.open)return node;}return null;}
}
const doc={events:{},createElement(tag){return new Element(tag,this);},getElementById(id){return this.body.id===id?this.body:this.body.querySelector('#'+id);},querySelector(selector){const [first,second]=selector.split(' ');const parent=this.getElementById(first.slice(1));return second?parent?.querySelector(second):parent;},addEventListener(event,handler){(this.events[event]||=[]).push(handler);}};
doc.body=new Element('body',doc);
const moreBtn=doc.createElement('button');moreBtn.id='moreBtn';doc.body.appendChild(moreBtn);
const menu=doc.createElement('dialog');menu.id='moreDialog';doc.body.appendChild(menu);
const grid=doc.createElement('div');grid.className='menuGrid';menu.appendChild(grid);
const forbidden=()=>{throw Error('Guias não devem chamar IA, progresso ou navegação de estudos');};
const context={window:{document:doc},fetch:forbidden,save:forbidden,openView:forbidden};
Object.defineProperty(context.window,'state',{get:forbidden});
vm.createContext(context);vm.runInContext(source,context);
const api=context.window.JornadaManuals;
assert.equal(grid.children.length,1);
const menuButton=doc.getElementById('openHunterManualsBtn');
assert.equal(menuButton.getAttribute('aria-haspopup'),'dialog');
assert.equal(menuButton.getAttribute('aria-controls'),'hunterManualsDialog');
api.install();for(const handler of doc.events.DOMContentLoaded||[])handler();vm.runInContext(source,context);
assert.equal(grid.children.length,1,'Inicializações repetidas não duplicam o botão');
menu.open=true;doc.activeElement=menuButton;menuButton.onclick();
const dialog=doc.getElementById('hunterManualsDialog');
assert.equal(menu.open,false,'Menu de origem fecha antes do diálogo de ajuda');
assert.equal(dialog.open,true);
assert.equal(dialog.getAttribute('aria-labelledby'),'hunterManualsTitle');
assert.equal(doc.activeElement.id,'hunterManualsGuideTitle');
const buttons=dialog.querySelectorAll('[data-hunter-manual-id]');
assert.equal(buttons.length,4);
assert.equal(buttons[0].getAttribute('aria-current'),'page');
buttons[2].onclick();
assert.equal(buttons[0].getAttribute('aria-current'),null);
assert.equal(buttons[2].getAttribute('aria-current'),'page');
assert(dialog.querySelector('#hunterManualsContent').innerHTML.includes('Manual 03'));
assert(!/GERADO POR IA|4 resumos|Manual Oficial/i.test(dialog.innerHTML));
dialog.querySelector('#closeHunterManualsBtn').onclick();
assert.equal(dialog.open,false);assert.equal(doc.activeElement,moreBtn,'Fechar devolve foco ao botão do Menu, não ao item oculto');
api.open('id-inexistente');
assert(dialog.querySelector('#hunterManualsContent').innerHTML.includes('Manual 01'));
dialog.close();

const summaryContext={window:{}};vm.createContext(summaryContext);vm.runInContext(read('dist/content-summaries.js'),summaryContext);
assert(summaryContext.window.BASIC_SUMMARIES.length>10,'Resumos das disciplinas continuam disponíveis');
assert(!summaryContext.window.BASIC_SUMMARIES.some(isManual));
assert(summaryContext.window.EXTRA_FLASHCARDS.every(Array.isArray));
assert(!summaryContext.window.EXTRA_FLASHCARDS.some(isManual));
console.log('OK r175: quatro guias separados dos resumos, detector sem falso positivo em Manual de Redação, Menu/diálogo acessível, seleção e retorno de foco sem IA/progresso.');
