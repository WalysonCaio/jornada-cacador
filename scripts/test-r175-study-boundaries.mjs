import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);}
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const guide={id:'manual-01-ciclo-estudos',category:'Manuais do Caçador (Método & Estratégia)',title:'Manual 01 — Ciclo de estudos',source:'Manual Oficial do Caçador',explanation:'GUIA-NAO-ENVIAR-PARA-IA',points:['PASSO-DO-GUIA']};
const material={id:'portugues-crase',category:'Língua Portuguesa',title:'Manual de Redação Oficial',source:'Material do estudante',explanation:'TEORIA-DO-EDITAL',points:['Ponto de Língua Portuguesa']};
const state={activeCampaignId:'portal-a',customCampaign:{missions:[{id:'manual-01-ciclo-estudos',name:'Guia antigo',subject:'Português'},{id:'topic-1',name:'Crase',subject:'Língua Portuguesa'}]}};
const context={window:{},state,ALL_SUMMARIES:[guide,material],ALL_FLASHCARDS:[['Manuais do Caçador','Pergunta do guia','Resposta do guia']],ALL_QUESTIONS:[],
  subjectKey:normalize,normalizeText:normalize,canonicalSubjectName:value=>value,
  activeCampaign:()=>({name:'Portal A'}),cloudDocuments:[{id:'manual-doc',title:'Manual Oficial Jornada do Caçador',document_type:'material',processing_status:'ready'},{id:'material-doc',title:'Manual de Redação Oficial',document_type:'material',processing_status:'ready'}],
  $:()=>({value:''}),isUnifiedPortalActive:()=>false,normalizeAndOrderEditalMissions:items=>items,
};
vm.createContext(context);
vm.runInContext(section('function isHunterManualArtifact(','function computeValidLearningSubjects('),context);
vm.runInContext(section('function missionPool(){','function orderedMissions('),context);
vm.runInContext(section('function computeValidLearningSubjects(){','window.computeValidLearningSubjects='),context);
vm.runInContext(section('function assistantLibraryContext(','function fcKey('),context);

for(const input of [guide,guide.category,{id:guide.id,category:'Português'},['Manuais do Caçador','Pergunta','Resposta'],{content:{source:guide.source}},'manual-oficial-jornada-do-cacador.pdf'])assert.equal(context.isHunterManualArtifact(input),true,JSON.stringify(input));
for(const input of [material,'Manual de Direito Administrativo','Manual de Redação Oficial',null,{subject:'Língua Portuguesa'}])assert.equal(context.isHunterManualArtifact(input),false,JSON.stringify(input));
assert.equal(context.isInvalidTrailSubject(guide.category),true);
assert.equal(context.isInvalidTrailSubject('Língua Portuguesa'),false);
assert.deepEqual(Array.from(context.missionPool(),item=>item.id),['topic-1']);
assert.equal(state.customCampaign.missions.length,2,'Não apague o histórico/missões salvas ao filtrar guia legado');
assert.deepEqual(Array.from(context.computeValidLearningSubjects()),['Língua Portuguesa']);
const ai=context.assistantLibraryContext('');
assert(ai.includes('TEORIA-DO-EDITAL'));
assert(ai.includes('Manual de Redação Oficial'));
assert(!ai.includes('GUIA-NAO-ENVIAR-PARA-IA'));
assert(!ai.includes('Manual Oficial Jornada do Caçador'));

// As duas renderizações (base e aprimorada) precisam proteger a lista mesmo
// antes de uma limpeza tardia de cache, sem converter guias em rótulos de IA.
const enhanced=fs.readFileSync(new URL('../dist/v59-enhancements.js',import.meta.url),'utf8');
const a=enhanced.indexOf('    const items=ALL_SUMMARIES.filter(s=>{'),b=enhanced.indexOf('    const groups=',a);
const listContext={ALL_SUMMARIES:[guide,material],window:context.window,q:'',filterKey:'all',subjectKey:normalize};
vm.createContext(listContext);
vm.runInContext(enhanced.slice(a,b)+'\nglobalThis.itemsForTest=items;',listContext);
assert.deepEqual(Array.from(listContext.itemsForTest,item=>item.id),[material.id]);

// Fontes do Caderno IA: documento de guia legado não é fonte de estudo.
const smart=fs.readFileSync(new URL('../dist/v78-smart-notebook.js',import.meta.url),'utf8');
const start=smart.indexOf('  function readySources(){'),end=smart.indexOf('  function contextBlock(){',start);
Object.assign(context,{ALL_SUMMARIES:[{...guide,documentId:'manual-doc'},{...material,documentId:'material-doc'}],current:()=>({subject:'all',sources:['manual-doc','material-doc']}),MAX_SOURCES:5});
vm.runInContext(smart.slice(start,end),context);
assert.deepEqual(Array.from(context.readySources(),item=>item.id),['material-doc']);
assert.deepEqual(Array.from(context.selectedSummaries(),item=>item.id),[material.id]);
context.ALL_SUMMARIES=[{...guide,documentId:'material-doc'},{...material,documentId:'material-doc'}];
assert.equal(context.sourceSubject(context.cloudDocuments[1]),'Língua Portuguesa','Fonte com guia legado não pode assumir a categoria da ajuda');

// Leituras de revisões e caderno antigo omitem ajuda sem apagar o histórico.
const oldError={campaignId:'portal-a',subject:guide.category,topic:'Ciclo',last:'2020-01-01',misses:1};
const ordinaryError={campaignId:'portal-a',subject:'Língua Portuguesa',topic:'Crase',last:'2020-01-01',misses:1};
context.state.errors={oldHelp:oldError,ordinary:ordinaryError};
context.state.done={};context.state.reviews={};
const preserved=JSON.stringify(context.state.errors);
vm.runInContext(section('function dueReviews(){','function renderReviews('),context);
assert.deepEqual(Array.from(context.dueReviews(),item=>item.key),['ordinary']);
const enhancedSource=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
const errStart=enhancedSource.indexOf('  function activeCampaignErrors(){'),errEnd=enhancedSource.indexOf('\n  function ',errStart+8);
context.sanitizeAllQuestionsAndErrorsSubjects=()=>{};
context.isPlatformManualStudyArtifact=context.isHunterManualArtifact;
vm.runInContext(enhancedSource.slice(errStart,errEnd),context);
assert.deepEqual(Array.from(context.activeCampaignErrors(),item=>item[0]),['ordinary']);
assert.equal(JSON.stringify(context.state.errors),preserved);

// Um treino antigo contendo questão criada da ajuda não pode ser retomado.
const sessionsSource=fs.readFileSync(new URL('../dist/question-session-store.js',import.meta.url),'utf8');
vm.runInContext(sessionsSource,context);
const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
const store=context.window.JornadaQuestionSessions.createStore({storage});
const scope={userId:'user-a',campaignId:'portal-a'};
const question={statement:'Questão de teste com alternativas.',options:['Resposta um','Resposta dois'],correct_index:0};
assert.equal(store.save(scope,{battle:{questions:[{...question,id:guide.id}],current:0,correct:0}}),null);
assert.equal(store.save(scope,{battle:{questions:[question],current:0,correct:0}}),'local');
console.log('OK r175: guia fora de disciplinas/missões/contexto IA/resumos/Caderno IA; material legítimo com nome Manual continua disponível.');
