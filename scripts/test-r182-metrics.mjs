import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
const start=source.indexOf('  // Dados dos hubs:'),end=source.indexOf('  // 5) Central de Leis',start);
assert(start>=0&&end>start,'Seletores dos novos hubs ausentes');
const now=Date.parse('2026-11-17T15:00:00Z');
class TestDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const date=days=>new Date(now-days*86400000).toISOString();
const buttons={days:[1,7,30,9999].map(days=>({getAttribute:()=>String(days)})),modes:['questions','flashcards','edital'].map(mode=>({getAttribute:()=>mode}))};
const nodes=new Map();
for(const id of ['essay','profileHubRoot','cards','jcEssayDashboardHub','jcTacticalPanelSection','jcFlashcardsDashboardHub','jcFlashFocusDeckBtn','jcFlashFilterAllBtn','jcFlashOpenReviewBtn','jcEssayFocusFormBtn','jcEssayFocusHistoryBtn','jcEssaySeeAllBtn','jcEssayTriggerThemeBtn']){
 nodes.set(id,{id,innerHTML:'',querySelectorAll:selector=>selector==='[data-tact-days]'?buttons.days:selector==='[data-tact-mode]'?buttons.modes:[]});
}
const events=new Map(),frames=[];let saves=0,rendered=0,active='profile';
const app={_ownerUserId:'a',activeCampaignId:'p',campaigns:[{id:'p',dbId:'db-p'}],scores:[
 {campaignId:'p',subject:'Português',correct:90,total:100,date:'2024-01-01T12:00:00Z'},
 {campaignId:'p',subject:'Português',correct:1,total:1,date:date(0)},
 {campaignId:'p',subject:'Português',correct:1,total:2,date:date(4)},
 {campaignId:'other',subject:'Outra campanha',correct:99,total:99,date:date(0)},
 {campaignId:'p',userId:'b',subject:'Outra conta',correct:99,total:99,date:date(0)},
 {campaignId:'p',subject:'Sem data',correct:3,total:3},
 {campaignId:'p',subject:'Inválida',correct:4,total:2,date:date(0)},
 {campaignId:'p',subject:'Futura',correct:9,total:9,date:date(-1)}
],topicMastery:{cumulative:{attempts:999,correct:999}},done:{m1:date(0),m2:true},flashProgress:{}};
const ctx={Date:TestDate,console,Map,Set,Promise,
 state:app,cloudSession:{user:{id:'a'}},cloudEssays:[],ALL_FLASHCARDS:[['Português','Pergunta 1','Resposta 1'],['Português','Pergunta 2','Resposta 2']],
 getAppStateSafe:()=>ctx.state,activeCampaign:()=>ctx.state.campaigns.find(c=>c.id===ctx.state.activeCampaignId),
 missionPool:()=>[{id:'m1',subject:'Português'},{id:'m2',subject:'Direito Penal'}],
 document:{getElementById:id=>nodes.get(id)||null,querySelector:()=>({id:active}),addEventListener:(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);}},
 requestAnimationFrame:fn=>frames.push(fn),addEventListener:(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);},
 save:()=>{saves++;return 'saved';},renderEssays:()=>{rendered++;return 'rendered';},
};
ctx.window=ctx;
vm.createContext(ctx);
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const fk=html.indexOf('function fcKey('),fp=html.indexOf('function fcProgress(',fk);
assert(fk>=0&&fp>fk);vm.runInContext(html.slice(fk,fp),ctx);
vm.runInContext(source.slice(start,end),ctx);
const scope=()=>ctx.caveiraMetricScope();
let snap=ctx.caveiraMetricTactical(scope(),'questions',30);
assert.equal(snap.rows.reduce((n,row)=>n+row.total,0),3,'período usa somente scores datados do portal e conta, sem cumulativo');
assert.equal(ctx.caveiraMetricTactical(scope(),'questions',1).rows.length,1,'Hoje exclui datas anteriores');
assert.equal(ctx.caveiraMetricTactical(scope(),'questions',9999).rows.reduce((n,row)=>n+row.total,0),103,'todo histórico inclui data antiga sem incluir futuro');
ctx.mountPainelTaticoInProfile();
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('>3</div>'));
buttons.days[0].onclick();
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('>1</div>'),'botão Hoje realmente altera o indicador');
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('primeira tentativa'),'não inventa distinção inexistente');
app.flashProgress[ctx.fcKey(ctx.ALL_FLASHCARDS[0])]={level:'easy',reviews:4,date:date(0),campaignId:'p',userId:'a'};
app.flashProgress[ctx.fcKey(ctx.ALL_FLASHCARDS[1])]={level:'hard',reviews:9,date:date(4),campaignId:'p',userId:'a'};
buttons.modes[1].onclick();
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('Marcados fáceis: <b>1</b>'));
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('Cartões avaliados'));
buttons.days[2].onclick();
assert.equal(ctx.caveiraMetricTactical(scope(),'flashcards',30).rows.length,2,'conta cartões por última avaliação e não soma 13 revisões');
ctx.mountCaveiraFlashcardsHub();
assert(nodes.get('jcFlashcardsDashboardHub').innerHTML.includes('class="jcCaveiraBigNumber">2</div>'),'hub usa ALL_FLASHCARDS e flashProgress reais');
assert(nodes.get('jcFlashcardsDashboardHub').innerHTML.includes('não comprovam retenção'));
buttons.modes[2].onclick();
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('Missões concluídas'));
assert.equal(ctx.caveiraMetricTactical(scope(),'edital',30).rows.length,1,'conclusão legada sem data não vira missão de hoje');
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('sem nota de domínio'));
assert(!/100%\s+de acerto/.test(nodes.get('jcTacticalPanelSection').innerHTML), 'Conclusão de missão não vira taxa de acerto');

ctx.cloudEssays=[
 {id:'e1',user_id:'a',campaign_id:'db-p',title:'<img src=x onerror=alert(1)>',board:'<b>Minha banca</b>',created_at:date(0),processing_status:'ready',result:{score:0}},
 {id:'e2',user_id:'a',campaign_id:'db-p',title:'Oito pontos',created_at:date(1),processing_status:'ready',result:{score:8}},
 {id:'e3',user_id:'a',campaign_id:'db-p',title:'Oitenta pontos',created_at:date(2),processing_status:'ready',result:{score:80}},
 {id:'e4',user_id:'a',campaign_id:'db-p',title:'Pendente',created_at:date(3),processing_status:'processing',result:{score:99}},
 {id:'e5',user_id:'b',campaign_id:'db-p',title:'Segredo B',created_at:date(0),processing_status:'ready',result:{score:100}},
 {id:'e6',user_id:'a',campaign_id:'other',title:'Outro portal',created_at:date(0),processing_status:'ready',result:{score:100}}
];
ctx.mountCaveiraEssayHub();
let renderedHtml=nodes.get('jcEssayDashboardHub').innerHTML;
assert(renderedHtml.includes('class="jcCaveiraBigNumber">4</div>'));
assert(renderedHtml.includes('3 CORRIGIDAS'));
assert(renderedHtml.includes('1 AGUARDANDO / EM CORREÇÃO'));
assert(renderedHtml.includes('0/100'),'nota zero é válida e fica visível');
assert(renderedHtml.includes('8/100'),'nota baixa não é multiplicada por dez');
assert(renderedHtml.includes('&lt;img')&&!renderedHtml.includes('<img'),'título escapado');
assert(!renderedHtml.includes('Segredo B')&&!renderedHtml.includes('Outro portal'));
assert(renderedHtml.includes('29/100'),'média usa somente as três notas prontas e válidas');

app.scores.push({campaignId:'p',subject:'<svg onload=alert(1)>',total:1,correct:0,date:date(0)});
buttons.modes[0].onclick();
assert(nodes.get('jcTacticalPanelSection').innerHTML.includes('&lt;svg'));
assert(!nodes.get('jcTacticalPanelSection').innerHTML.includes('<svg onload'));
// Atualizações posteriores ao carregamento usam wrappers únicos e uma tarefa coalescida.
assert.equal(events.get('flashcards:graded').length,1);
assert.equal(ctx.save(),'saved');assert.equal(ctx.save(),'saved');assert.equal(saves,2);
assert.equal(frames.length,1,'vários saves na mesma tarefa não criam filas de renderização');
active='essay';ctx.cloudEssays=ctx.cloudEssays.slice(0,1);
assert.equal(ctx.renderEssays(),'rendered');assert.equal(rendered,1);
frames.shift()();
assert(nodes.get('jcEssayDashboardHub').innerHTML.includes('class="jcCaveiraBigNumber">1</div>'),'callback atualiza com os dados carregados depois');
assert.equal(events.get('flashcards:graded').length,1,'montar novamente não duplica listener');
ctx.cloudSession={user:{id:'b'}};
ctx.mountCaveiraEssayHub();ctx.mountPainelTaticoInProfile();ctx.mountCaveiraFlashcardsHub();
assert(!nodes.get('jcEssayDashboardHub').innerHTML.includes('&lt;img'),'transição de conta não mostra dados antigos');
assert(nodes.get('jcEssayDashboardHub').innerHTML.includes('Aguarde o carregamento'));
ctx.cloudSession=null;ctx.mountCaveiraEssayHub();
assert(!nodes.get('jcEssayDashboardHub').innerHTML.includes('&lt;img'),'logout não revela lista anterior');
ctx.cloudSession={user:{id:'a'}};app.campaigns.push({id:'other'});
const key=ctx.fcKey(ctx.ALL_FLASHCARDS[0]);app.flashProgress[key]={level:'easy',date:date(0),reviews:4};
assert.equal(ctx.caveiraMetricFlashcards(scope()).cards.filter(card=>card.rating).length,1,'legado sem escopo não é atribuído a portal com múltiplas campanhas');
console.log('OK r182: painéis usam redações/flashcards reais, filtros de período e modalidade, dados com escopo, notas zero, HTML escapado e atualização única após carregar/avaliar.');
