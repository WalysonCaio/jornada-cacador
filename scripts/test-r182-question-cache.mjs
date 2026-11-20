// Exercita o cache real com alterações em memória, troca de conta e banco de mesmo tamanho.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,`Trecho ausente: ${start}`);return html.slice(a,b)}
const canonical=value=>String(value||'').toLowerCase().replace(/^língua portuguesa$/,'português');
let validations=0,decisions=0;
const q=(id,subject='Português')=>({id,subject,subject_source:'manual',topic:'Tópico específico',statement:`Enunciado de teste para ${id}`,options:['Primeira resposta','Segunda resposta'],correct_index:0});
const context={window:{},state:{_ownerUserId:'a',activeCampaignId:'portal-a',_resetEpoch:0},cloudSession:{user:{id:'a'}},ALL_QUESTIONS:[q('first'),q('middle'),q('last')],learningCategory:value=>value,subjectKey:canonical,isInvalidTrailSubject:value=>!value||canonical(value)==='conteúdo geral'};
context.window.isValidPedagogicalQuestion=()=>{validations++;return true};
context.window.isQuestionDisciplineEligible=(item,subject)=>{decisions++;return !item.needs_review&&(subject==='all'||canonical(item.subject)===canonical(subject))};
context.window.resolveStrictQuestionDiscipline=item=>item.subject;
vm.createContext(context);
vm.runInContext(section('function questionPool(){','function stripLeadingOptionPrefix('),context);
vm.runInContext(section('function learningUnits(','function shuffle('),context);
context.learningQuestions=subject=>context.questionsForMode('trail',subject).filter(item=>context.window._selectedTrailBoard!=='missing');

assert.equal(context.questionsForMode('trail','Português').length,3);
const index=context.window._jcModeBucketsMap;
const counts={validations,decisions};
for(let i=0;i<20;i++){context.questionPool();assert.strictEqual(context._ensureModeBucketsIndex(),index)}
assert.equal(validations,counts.validations,'leituras repetidas não repetem a validação');
assert.equal(decisions,counts.decisions,'leituras repetidas não classificam/ordenam outra vez');
const ordered=context.questionsForMode('trail','Português').map(item=>item.id).join('|');
context.questionsForMode('trail','Português').reverse();
assert.equal(context.questionsForMode('trail','Português').map(item=>item.id).join('|'),ordered,'ordenar o retorno não altera os buckets armazenados');

// Mesmo array, tamanho e extremos: a disciplina intermediária precisa invalidar o índice.
context.ALL_QUESTIONS[1].subject='Direito Penal';
assert.equal(context.questionsForMode('trail','Português').length,2);
assert.equal(context.questionsForMode('trail','Direito Penal').length,1);
assert.notStrictEqual(context.window._jcModeBucketsMap,index);
const replaced={...context.ALL_QUESTIONS[1],statement:'Objeto substituído com os mesmos identificadores'};
context.ALL_QUESTIONS[1]=replaced;
assert.strictEqual(context.questionsForMode('trail','Direito Penal')[0],replaced);

const changing=context.ALL_QUESTIONS[0];
changing.statement='Texto alpha de mesma dimensão.';
const oldFingerprint=context.questionFingerprint(changing);
changing.statement='Texto bravo de mesma dimensão.';
assert.notEqual(context.questionFingerprint(changing),oldFingerprint,'edição do mesmo tamanho não reutiliza fingerprint anterior');
changing.options[0]='';
assert.equal(context.questionsForMode('trail','Português').length,1,'opção apagada no mesmo array invalida a seleção');
changing.options[0]='Primeira resposta';
assert.equal(context.questionsForMode('trail','Português').length,2);
changing.correct_index=-1;
assert.equal(context.questionPool().length,3,'pendência continua disponível para revisão no catálogo');
assert.equal(context.questionsForMode('trail','Português').length,1,'pendência não entra no treino');
const cyclic={};cyclic.self=cyclic;
for(const raw of [null,false,{},99,cyclic,1n,Symbol("invalid")]){changing.correct_index=raw;assert.equal(context.questionsForMode('trail','Português').length,1)}
changing.correct_index=0;changing.key_source='ia_sugerido';changing.answer_key_validation='pendente';
assert.equal(context.questionsForMode('trail','Português').length,1,'sugestão IA não conta como chave confirmada');
changing.key_source='manual_revisado';changing.answer_key_validation='revisado';
assert.equal(context.questionsForMode('trail','Português').length,2);
changing.needs_review=true;
assert.equal(context.questionsForMode('trail','Português').length,1,'classificação pendente invalida o índice');
changing.needs_review=false;

const units=context.learningUnits('Português');
assert.strictEqual(context.learningUnits('Português'),units,'unidades já calculadas usam o cache da revisão atual');
context.window._selectedTrailBoard='missing';
assert.equal(context.learningUnits('Português').length,0,'filtro de banca integra a chave das unidades');
context.window._selectedTrailBoard='all';
context.ALL_QUESTIONS[2].subject='Direito Penal';
assert.notStrictEqual(context.learningUnits('Português'),units);
assert.equal(context.learningUnits('Português')[0].questions.length,1);

// Uma sessão nova não pode ler objetos ou unidades pertencentes à sessão anterior.
const previous=context.questionPool();
context.cloudSession={user:{id:'b'}};
assert.equal(context.questionPool().length,0,'troca de sessão ainda não hidratada é bloqueada');
context.state._ownerUserId='b';
context.ALL_QUESTIONS=previous.map(item=>({...item,statement:'Enunciado da conta B'}));
const next=context.questionPool();
assert.equal(next.length,3);
assert(next.every(item=>item.statement==='Enunciado da conta B'));
assert(next.every(item=>!previous.includes(item)));
const revision=context._getQuestionPoolSignature();
context.state.activeCampaignId='portal-b';
assert.notEqual(context._getQuestionPoolSignature(),revision);
const portalRevision=context._getQuestionPoolSignature();
context.state._resetEpoch=1;
assert.notEqual(context._getQuestionPoolSignature(),portalRevision);
context.cloudSession=null;
assert.equal(context.questionPool().length,0,'logout não expõe os dados privados que ainda aguardam limpeza');

console.log('OK r182: cache invalida edições, opções, chaves, objetos, conta/portal/reset e banca; leituras repetidas preservam os índices sem revalidar.');
