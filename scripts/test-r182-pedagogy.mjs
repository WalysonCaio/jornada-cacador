// Exercita a auditoria real: relatório de pendências sem reescrever conteúdo/gabarito.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
const start = source.indexOf('  function auditAndEnrichAllQuestionsPedagogy(');
const end = source.indexOf("  if (typeof window !== 'undefined') {\n    window.auditAndEnrichAllQuestionsPedagogy",start);
assert(start >= 0 && end > start);
const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(source.slice(start,end),ctx);
const audit=list=>ctx.auditAndEnrichAllQuestionsPedagogy(list);
const base={id:'q',subject:'Português',topic:'Crase',statement:'Qual opção emprega a crase corretamente?',options:['Primeira alternativa','Segunda alternativa'],correct_index:1,origin:'autoral',explanation:'A expressão foi empregada conforme a regência e a presença do artigo.'};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function readonlyAudit(list){const serialized=JSON.stringify(list);const result=audit(freeze(list));assert.equal(JSON.stringify(list),serialized,'A auditoria não pode alterar os dados recebidos');assert.equal(result.enrichedCount,0);assert.equal(result.fixedSubjectCount,0);assert.equal(result.fixedTopicCount,0);assert.equal(result.factualReviewVerified,false);assert.equal(result.scope,'structural_metadata');return result;}

for(const key of [undefined,null,false,true,'',' ',{},[],-1,2,99,'invalid']){
 const item={...base,correct_index:key,explanation:''};
 const r=readonlyAudit([item]);
 assert.equal(r.validCount,0,`Chave inválida ${String(key)} não vira A`);
 assert.equal(r.pendingKeyCount,1);
 assert.equal(r.missingExplanationCount,1);
 assert.equal(r.readyCount,0);
 assert.equal(r.pedagogicallyReadyPct,0);
 assert.equal(item.correct_index,key);
 assert.equal(item.explanation,'','Explicação ausente permanece ausente');
}
for(const extra of [
 {key_source:'ia_sugerido',answer_key_validation:'pendente'},
 {explanation:'🤖 [Gabarito sugerido pela IA — validação pendente] Justificativa.'},
 {answer_unknown:true},
]){
 const r=readonlyAudit([{...base,...extra}]);assert.equal(r.pendingKeyCount,1);assert.equal(r.validCount,0);
}
const reviewed=readonlyAudit([{...base,key_source:'manual_revisado',answer_key_validation:'revisado',explanation:'[Gabarito sugerido pela IA — conferido pessoalmente] Referência: gramática consultada.'}]);
assert.equal(reviewed.validCount,1);assert.equal(reviewed.readyCount,1);
for(const extra of [{annulled:true},{anulada:true}]){const r=readonlyAudit([{...base,...extra}]);assert.equal(r.annulledCount,1);assert.equal(r.validCount,0);assert.equal(r.pendingKeyCount,0);}
for(const options of [[],['Única'],['A','','C'],['A) Mesmo texto','B) Mesmo texto'],['A','B','C','D','E','F'],[{text:'A'},{text:'B'}]]){
 const r=readonlyAudit([{...base,options}]);assert.equal(r.invalidStructureCount,1);assert.equal(r.validCount,0);
}
for(const statement of ['',null,{},false])assert.equal(readonlyAudit([{...base,statement}]).invalidStructureCount,1);
for(const extra of [{subject:'Simulado 01',topic:'Questão 12'},{subject:null},{topic:''},{classification_needs_review:true}]){
 const r=readonlyAudit([{...base,...extra}]);assert.equal(r.validCount,1);assert.equal(r.classificationReviewCount,1);assert.equal(r.readyCount,0);
}
assert.equal(readonlyAudit([{...base,explanation_needs_review:true}]).explanationReviewCount,1);
const manual=readonlyAudit([{...base,subject:'Manuais do Caçador (Método)'}]);
assert.equal(manual.excludedManualCount,1);assert.equal(manual.validCount,0);
const empty=readonlyAudit([]);assert.equal(empty.total,0);assert.equal(empty.readyCount,0);assert.equal(empty.pedagogicallyReadyPct,0);assert.equal(empty.status,'sem_questoes');
const malformed=readonlyAudit([null,{options:[]}]);assert.equal(malformed.validCount,0);assert.equal(malformed.pedagogicallyReadyPct,0);
const mixed=readonlyAudit([{...base},{...base,id:'pending',correct_index:-1},{...base,id:'review',classification_needs_review:true},{...base,id:'explanation',explanation:''}]);
assert.equal(mixed.validCount,3);assert.equal(mixed.readyCount,1);assert.equal(mixed.structurallyReadyPct,25);assert.equal(mixed.pedagogicallyReadyPct,25);assert.equal(mixed.questionIssueCount,3);assert.equal(mixed.status,'pendencias_identificadas');assert.equal(ctx.window._lastQuestionPedagogyAudit,mixed);
const ce=readonlyAudit([{...base,options:['Certo','Errado'],correct_index:0}]);assert.equal(ce.validCount,1);
const five=readonlyAudit([{...base,options:['A','B','C','D','E'],correct_index:4}]);assert.equal(five.validCount,1);
ctx.window.ALL_QUESTIONS=freeze([{...base,id:'window-bank',correct_index:-1}]);
assert.equal(ctx.auditAndEnrichAllQuestionsPedagogy().pendingKeyCount,1);
const capped=readonlyAudit(Array.from({length:250},()=>null));assert.equal(capped.invalidStructureCount,250);assert.equal(capped.issues.length,200);assert.equal(capped.issuesTruncated,true);
console.log('OK r182: auditoria somente leitura, gabaritos pendentes/anulados/IA, estrutura, classificação, explicações e percentuais reais; nenhuma revisão factual fabricada.');
