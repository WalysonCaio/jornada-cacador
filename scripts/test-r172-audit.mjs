import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {validateEssayResult} from '../supabase/functions/_shared/essay-result.mjs';
const read = f => fs.readFileSync(new URL('../'+f, import.meta.url),'utf8');
const source = read('dist/v77-experience.js');
function slice(a,b) {const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);}
const ctx={window:{},normalizeLegalText:x=>x,shuffle:x=>[...x].reverse(),state:{},navigator:{onLine:false}};
vm.createContext(ctx);
vm.runInContext(slice('  function answerKeyStatus(', '  function classifyQuestion('),ctx);
vm.runInContext(slice('  function stripOptionLetterPrefixClean(', '  // Formata qualquer explicação'),ctx);
vm.runInContext(slice('  async function solveQuestionsArrayWithAi(', '  window.solveQuestionsArrayWithAi = solveQuestionsArrayWithAi;'),ctx);
const q={statement:'Qual é o resultado?',options:['um','dois','três'],correct_index:1,origin:'oficial'};
for(const key of [null,undefined,'',-1,4,'abc']) {
 const bad={...q,correct_index:key}; assert.equal(ctx.answerKeyStatus(bad),'sem_gabarito');
 assert.equal(ctx.prepareQuestionConsistent(bad).correct_index,-1);
 assert.equal(ctx.gradeAnswer(bad,0).scored,false);
}
assert.equal(ctx.gradeAnswer({...q,answer_unknown:true},1).scored,false);
assert.equal(ctx.gradeAnswer({...q,annulled:true},1).scored,false);
assert.equal(ctx.gradeAnswer({...q,origin:'autoral'},1).status,'provisorio');
assert.equal(ctx.gradeAnswer(q,1).ok,true);
assert.equal(ctx.gradeAnswer(q,99).scored,false);
const contradiction={...q,explanation:'✅ Correta: A) um'};
assert.equal(ctx.prepareQuestionConsistent(contradiction).correct_index,1,'prosa não substitui gabarito');
const dependent={...q,origin:'autoral',options:['primeira','segunda','Todas as anteriores']};
assert.equal(JSON.stringify(ctx.prepareQuestionConsistent(dependent).options),JSON.stringify(dependent.options));
const unknown={...q,answer_unknown:true,correct_index:-1};
assert.equal(await ctx.solveQuestionsArrayWithAi([unknown]),0);
assert.equal(unknown.correct_index,-1);assert.equal(unknown.answer_unknown,true);
assert.equal(await ctx.solveQuestionsArrayWithAi([q]),0,'não sobrescreve gabarito conhecido');
const result={readable:true,score:80,criteria:Array.from({length:4},(_,i)=>({name:'Eixo '+i,score:20,max_score:25,commentary:'Justificativa'})),diagnosis:'Diagnóstico',line_observation:'20 linhas',model_text:'Exemplo',strengths:['Clareza'],priority_plan:['Revisar coesão'],rewrite_suggestions:['Exemplo de reescrita'],improvements:[],deviations:[]};
assert.equal(validateEssayResult(result).score,80);
for(const change of [{score:101},{score:70},{readable:false},{criteria:[]},{criteria:[{name:'x',score:-1,max_score:100}]},{priority_plan:null},{score:Infinity}])assert.throws(()=>validateEssayResult({...result,...change}));
const essay=read('supabase/functions/redacao-gemini/index.ts');
assert(essay.includes('if (!saved.ok)'));
for(const match of essay.matchAll(/essay_submissions\?id=eq\.\$\{encodeURIComponent\(submissionId\)\}([^`]*)`[^\n]*method: "PATCH"/g))assert(match[1].includes('user_id=eq.'),'PATCH deve respeitar proprietário');
// Parse de todas as funções TypeScript, sem executar rede nem confundir isso com deno check.
for(const dir of fs.readdirSync(new URL('../supabase/functions/',import.meta.url),{withFileTypes:true})) {
 if(!dir.isDirectory())continue;
 for(const f of fs.readdirSync(new URL('../supabase/functions/'+dir.name+'/',import.meta.url)).filter(x=>x.endsWith('.ts'))) {
  const code=stripTypeScriptTypes(read('supabase/functions/'+dir.name+'/'+f));
  const parsed = spawnSync(process.execPath, ["--input-type=module", "--check"], {input:code,encoding:"utf8"});
  assert.equal(parsed.status,0,parsed.stderr);
 }
}
const migration=read('supabase/migrations/20261112160000_v106_mastery_column_and_bonus_lock.sql');
assert(!migration.includes('mastery_score'));assert(migration.includes('pg_advisory_xact_lock'));assert(migration.includes('coalesce(v_prev_70, false)'));
console.log('OK r172: gabaritos inválidos/anulados, permutação, ausência de rede, redações inconsistentes, ownership e sintaxe TS. SQL validado estaticamente; integração pendente.');
const {validatedSuggestedKeys}=await import('../supabase/functions/_shared/solved-keys.mjs');
assert.equal(validatedSuggestedKeys([q],[{...q,explanation:'Explicação'}]).length,1);
for(const candidates of [[],[{...q,correct_index:null,explanation:'x'}],[{...q,statement:'Outra questão',explanation:'x'}],[{...q,options:[...q.options].reverse(),explanation:'x'}]])assert.equal(validatedSuggestedKeys([q],candidates).length,0);
console.log('OK: servidor não assume alternativa A, não troca questões por posição e rejeita opções reordenadas pela IA.');

// Alternativas vazias não podem deslocar o índice no sanitizador de materiais.
const material = read('supabase/functions/material-gemini/index.ts');
const start=material.indexOf('function sanitizeQuestions('), end=material.indexOf('function sanitizeStrings(',start);
const sanitizer={cleanGeneratedText:(v,max=4000)=>String(v??'').trim().slice(0,max)};
vm.createContext(sanitizer);vm.runInContext(stripTypeScriptTypes(material.slice(start,end)),sanitizer);
assert.equal(sanitizer.sanitizeQuestions([{statement:'Qual alternativa representa o resultado correto?',options:['opção 1','','opção 3'],correct_index:1,explanation:'Justificativa do resultado.'}],'Teste').length,0);
assert.equal(sanitizer.sanitizeQuestions([{statement:'Qual alternativa representa o resultado correto?',options:['opção 1','opção 2','opção 3'],correct_index:2,explanation:'Justificativa do resultado.'}],'Teste')[0].correct_index,2);
