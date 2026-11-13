import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const catalogue=fs.readFileSync(new URL('../dist/hunter-manuals.js',import.meta.url),'utf8');
function section(start,end,text=source){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,`Trecho ausente: ${start}`);return text.slice(a,b)}
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const legacy={id:'manual-01-ciclo-estudos',category:'Manuais do Caçador (Método & Estratégia)',title:'Manual 01 — Do Caos ao Método',source:'Manual Oficial do Caçador',explanation:'TEXTO_MANUAL_NAO_ENVIAR_PARA_IA',points:['Orientação de uso']};
const theory={id:'normal',category:'Língua Portuguesa',title:'Concordância',source:'Livro de Português',explanation:'TEORIA_VALIDA_PARA_ESTUDAR',points:['Concordância nominal e verbal']};
const question={subject:'Língua Portuguesa',topic:'Concordância',statement:'Qual frase apresenta concordância verbal adequada?',options:['As alunas estudam.','As alunas estuda.'],correct_index:0};
function environment(){
  const context={window:{},ALL_SUMMARIES:[legacy,theory],ALL_QUESTIONS:[{...question,id:legacy.id},question],
    ALL_FLASHCARDS:[['Manuais do Caçador','Dica da plataforma','Uma orientação'],['Língua Portuguesa','O que é concordância?','Relação de flexão entre palavras.']],
    LEARNING_SUBJECTS:['Manuais do Caçador (Método & Estratégia)','Língua Portuguesa'],
    libraryUI:{summaryFilter:{portal:'Manuais do Caçador'},cardFilter:{portal:'Língua Portuguesa'},trailSubject:{portal:'Manuais do Caçador'}},
    getActiveEditalSubjectsList:()=>['Língua Portuguesa'],subjectKey:normalize,canonicalSubjectName:value=>value,
    activeCampaign:()=>({name:'Portal de teste'}),
  };
  vm.createContext(context);vm.runInContext(catalogue,context);
  context.window.BASIC_SUMMARIES=[legacy,theory];
  context.window.MATERIAL_DEEP_DIVES=[legacy];
  vm.runInContext(section('  function isPlatformManualStudyArtifact(', '  function getActiveEditalSubjectsList('),context);
  return context;
}

const ctx=environment(),guides=JSON.stringify(ctx.window.JornadaManuals.items);
assert.equal(ctx.window.JornadaManuals.items.length,4);
assert(ctx.window.JornadaManuals.items.every(item=>!('subject' in item)&&!('category' in item)));
assert.equal(ctx.isPlatformManualStudyArtifact('Manual de Redação Oficial'),false,'Manual didático de Português continua material válido');
assert.equal(ctx.isPlatformManualStudyArtifact(theory),false);
ctx.purgeHunterManualStudyArtifacts();
assert.deepEqual([...ctx.ALL_SUMMARIES],[theory]);
assert.deepEqual([...ctx.ALL_QUESTIONS],[question]);
assert.equal(ctx.ALL_FLASHCARDS.length,1);
assert.equal(ctx.ALL_FLASHCARDS[0][0],'Língua Portuguesa');
assert.deepEqual([...ctx.LEARNING_SUBJECTS],['Língua Portuguesa']);
assert.deepEqual([...ctx.window.BASIC_SUMMARIES],[theory]);
assert.equal(ctx.window.MATERIAL_DEEP_DIVES.length,0);
assert.equal(ctx.libraryUI.summaryFilter.portal,'all');
assert.equal(ctx.libraryUI.cardFilter.portal,'Língua Portuguesa');
assert.equal(ctx.libraryUI.trailSubject.portal,undefined);
assert.equal(JSON.stringify(ctx.window.JornadaManuals.items),guides,'Higienizar estudo não altera nem perde os quatro guias');
assert.equal(ctx.purgeHunterManualStudyArtifacts(),0,'Repetir inicialização não altera dados válidos');

// Conteúdo antigo do cache/nuvem não volta ao acoplamento teórico.
vm.runInContext(section('  function ensureNativePedagogicalCouplingLoaded(){','  const ESTUDEI_CYCLE_BLOCKS='),ctx);
for(let round=0;round<2;round++){
  ctx.ALL_SUMMARIES=[legacy,theory];
  ctx.window.BASIC_SUMMARIES.push({...legacy});
  ctx.ensureNativePedagogicalCouplingLoaded();
  assert.equal(ctx.ALL_SUMMARIES.length,1);
  assert.equal(ctx.ALL_SUMMARIES[0].id,'normal');
  assert.equal(ctx.window.JornadaManuals.items.length,4);
}

// A seleção antiga de ajuda abre os guias; nunca sintetiza uma aula ou concede XP.
let helpOpened=0;
ctx.window.openHunterManuals=()=>helpOpened++;
ctx.openView=()=>{throw new Error('Ajuda não deve abrir estudo como disciplina');};
ctx.save=()=>{throw new Error('Ler ajuda não deve salvar progresso de estudo');};
vm.runInContext(section('  function ensureTopicSummaryExistsForStudy(', '  function openTheoryForSubjectAndTopic('),ctx);
vm.runInContext(section('  function openTheoryForSubjectAndTopic(', '  window.openTheoryForSubjectAndTopic ='),ctx);
ctx.openTheoryForSubjectAndTopic('Manuais do Caçador');
assert.equal(helpOpened,1);
assert.equal(ctx.ensureTopicSummaryExistsForStudy('Manuais do Caçador','Método').bestCard,null);
assert.equal(ctx.ALL_SUMMARIES.length,1);

// Mesmo com memória contaminada, o contexto real do Instrutor não recebe a ajuda.
const ai=environment();
ai.activeCampaign=()=>null;
ai.cloudDocuments=[{title:'Manual Oficial do Caçador',document_type:'material',processing_status:'ready'},
  {title:'Livro de Português',document_type:'material',processing_status:'ready'}];
ai.normalizeText=normalize;ai.$=()=>({value:''});
ai.isHunterManualArtifact=value=>ai.window.JornadaManuals.isManual(value);
vm.runInContext(section('function assistantLibraryContext(', 'function fcKey(',html),ai);
const context=ai.assistantLibraryContext('concordância');
assert(context.includes(theory.explanation));
assert(!context.includes(legacy.explanation));
assert(!context.includes('Manual Oficial do Caçador'));
assert.equal(ai.cloudDocuments.length,2,'A exclusão do contexto não muda documentos nem compartilhamento da biblioteca');

// Questões de ajuda nunca disparam geração com IA, mesmo com seletor legado.
const generation=environment(),messages=[];
generation.cloudSession={};generation.q=selector=>({value:selector==='#genBankSubject'?'Manuais do Caçador':''});
generation.toast=message=>messages.push(message);
generation.validSession=()=>{throw new Error('Ajuda não deve iniciar requisição de IA');};
vm.runInContext(section('  async function handleGenerateBoardPack(){','  // 4. Modo Simulado Cronometrado'),generation);
await generation.handleGenerateBoardPack();
assert(messages.some(message=>message.includes('guias de ajuda')));

// Revisão de uma disciplina com poucos itens não completa a sessão com outra.
const review=environment();review.ALL_QUESTIONS=[question,{...question,subject:'Direito Penal',statement:'Outra disciplina'}];
review.dueReviews=()=>[];review.topicKey=normalize;
review.isQuestionDisciplineEligible=(item,subject)=>subject==='all'||item.subject===subject;
review.answerKeyStatus=()=> 'revisado';review.resolveStrictQuestionDiscipline=item=>item.subject;
review.prepareQuestion=item=>item;review.q=()=>({showModal(){}});review.showQuestion=()=>{};review.toast=()=>{};
vm.runInContext(section("  function startActiveReviewSession(targetSubject=''){",'  function exportVesperaRaioX'),review);
review.startActiveReviewSession('Língua Portuguesa');
assert.equal(review.activeQuestions.questions.length,1);
assert.equal(review.activeQuestions.questions[0].subject,'Língua Portuguesa');
console.log('OK r175: guias independentes, purga de legado/reinicialização, sem material/questões/flashcards/disciplinas/contexto IA; revisão sem completar outra matéria.');
