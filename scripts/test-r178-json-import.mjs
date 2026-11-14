import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const writes=[];
const ctx={window:{},state:{},canonicalSubjectName:value=>String(value||'Conteúdo Geral'),
  questionFingerprint:item=>[item.subject,item.topic,item.statement].join('|'),
  ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],cloudSession:{user:{id:'fixture-user'}},activeCampaign:()=>({dbId:'fixture-campaign'}),
  resolveStrictQuestionDiscipline:(_statement,_topic,subject)=>subject,normalizedDifficulty:()=> 'medio',normalizedOrigin:item=>item.origin==='oficial'?'oficial':'autoral',
  save(){},renderQuestionFilters(){},populateTopicFilter(){},updateQuestionPool(){},renderExamBankHub(){},
  cloudFetch:async(path,options)=>{writes.push({path,body:JSON.parse(options.body)});return{ok:true};},console,
};
vm.createContext(ctx);
vm.runInContext(section('  function answerKeyStatus(','  function classifyQuestion('),ctx);
vm.runInContext(section('  function extractStructuredExamQuestions(','  window.extractStructuredExamQuestions='),ctx);
const parse=(rows,opts={})=>ctx.extractStructuredExamQuestions(JSON.stringify(rows),opts);
const plain=value=>JSON.parse(JSON.stringify(value));
const question={subject:'Direito Constitucional',topic:'Direitos fundamentais',board:'AOCP',statement:'Qual alternativa expressa o direito previsto na Constituição?',options:['Primeira','Segunda','Terceira','Quarta','Quinta'],correct_index:4,origin:'oficial',explanation:'Explicação do documento.'};

const valid=parse([question]);
assert.equal(valid.length,1);
assert.equal(valid[0].correct_index,4);
assert.deepEqual(plain(valid[0].options),question.options);
assert.equal(ctx.gradeAnswer(valid[0],4).ok,true);
const ce=parse({questions:[{...question,options:['CERTO','ERRADO'],correct_index:'1'}]});
assert.equal(ce.length,1);
assert.equal(ce[0].correct_index,1);

// Rejeita a linha inteira; nenhuma remoção de alternativa pode deslocar o gabarito.
for(const options of [['Primeira','','Terceira'],['Primeira',null,'Terceira'],['Mesma','mesma'],['A) Mesmo texto','B) Mesmo texto'],['A'],['A','B','C','D','E','F']]) {
  const result=parse([{...question,options,correct_index:1}],{allowWithoutKey:true});
  assert.equal(result.length,0,JSON.stringify(options));
  assert.equal(result.report.skipped,1);
}
for(const raw of [null,undefined,'',' ',false,true,{},[],[0],-1,5,0.5,'NaN']) {
  const input={...question,correct_index:raw};
  const rejected=parse([input]);
  assert.equal(rejected.length,0,String(raw));
  assert.equal(rejected.report.missingKey,1);
  const kept=parse([input],{allowWithoutKey:true});
  assert.equal(kept.length,1,String(raw));
  assert.equal(kept[0].correct_index,-1);
  assert.equal(kept[0].answer_unknown,true);
  assert.equal(ctx.gradeAnswer(kept[0],0).scored,false);
  assert.deepEqual(plain(kept[0].options),question.options);
}
const explicitlyUnknown=parse([{...question,answer_unknown:true}],{allowWithoutKey:true})[0];
assert.equal(explicitlyUnknown.correct_index,-1);
assert.equal(explicitlyUnknown.answer_unknown,true);
assert.equal(parse([{...question,answer_unknown:true}]).length,0);

// Proveniência e revisão sobrevivem ao JSON sem transformar uma sugestão em fonte oficial.
const suggested={...question,origin:'importada',key_source:'ia_sugerido',answer_key_validation:'pendente',key_reference:'Aguardando documento',source:'Acervo do usuário',source_url:'https://example.test/prova.pdf',source_label:'Prova de 2025',exam_title:'Concurso de teste',exam_year:2025,question_number:7,associated_text:'Texto-base necessário para resolver a questão.'};
const pending=parse([suggested])[0];
for(const key of ['origin','key_source','answer_key_validation','key_reference','source','source_url','source_label','exam_title','exam_year','question_number','associated_text'])assert.equal(pending[key],suggested[key],key);
assert.equal(ctx.answerKeyStatus(pending),'sem_gabarito');
assert.equal(ctx.gradeAnswer(pending,4).scored,false);
const history=[{previous_index:0,previous_source:'ia_sugerido',correct_index:4,at:'2026-11-14T10:00:00.000Z',reference:'Página 12'}];
const reviewed=parse([{...suggested,key_source:'manual_revisado',answer_key_validation:'revisado',explanation_needs_review:true,answer_key_history:history}])[0];
assert.equal(ctx.answerKeyStatus(reviewed),'revisado');
assert.equal(ctx.gradeAnswer(reviewed,4).ok,true);
assert.equal(reviewed.explanation_needs_review,true);
assert.deepEqual(plain(reviewed.answer_key_history),history);
for(const flag of ['annulled','anulada']) {
  const result=parse([{...question,correct_index:null,[flag]:true}]);
  assert.equal(result.length,1);
  assert.equal(result[0].annulled,true);
  assert.equal(result[0].correct_index,-1);
  assert.equal(result.report.annulled,1);
  assert.equal(ctx.gradeAnswer(result[0],0).scored,false);
}
const mixed=parse([question,{...question,correct_index:null},{...question,options:['Vazia','']},{...question,annulled:true}],{allowWithoutKey:true});
assert.equal(mixed.report.expected,4);
assert.equal(mixed.report.extracted,3);
assert.equal(mixed.report.skipped,1);
assert.equal(mixed.report.missingKey,1);
assert.equal(mixed.report.annulled,1);
assert.equal(mixed.report.percent,75);

// Exercita a gravação existente: conteúdo mantém metadados e catálogo legado recebe marcador IA.
vm.runInContext(section('  async function saveQuestionsToCampaign(','  function buildLocalCognitiveTwinQuestion('),ctx);
await ctx.saveQuestionsToCampaign('JSON importado',question.subject,[pending,reviewed,explicitlyUnknown]);
const stored=writes.find(write=>write.path==='generated_study_content').body[0].content.questions;
assert.equal(stored[0].key_source,'ia_sugerido');
assert.equal(stored[0].answer_key_validation,'pendente');
assert.equal(stored[1].key_source,'manual_revisado');
assert.equal(stored[1].answer_key_validation,'revisado');
assert.equal(stored[2].correct_index,-1);
assert.equal(stored[2].answer_unknown,true);
const shared=writes.find(write=>write.path.startsWith('shared_question_bank')).body;
assert.equal(ctx.isUnreviewedAiAnswer(shared[0]),true);
assert.equal(ctx.gradeAnswer(shared[0],4).scored,false);
console.log('OK r178 JSON: alternativas preservadas, índices inválidos sem letra A, importação sem chave, anuladas, proveniência e revisão/pendência IA mantidas ao salvar.');
