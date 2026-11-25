// Regressão de classificação/extração: não promover ambiguidades nem inventar formato.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b)}
function fixture(){
 const ctx={window:{},state:{customCampaign:{missions:[]}}};vm.createContext(ctx);
 vm.runInContext(section(html,'function normalizeText(','function missionForQuestion(')+
 section(source,'  function questionMatchesBoardFilter(','  function subjectIconForName(')+
 section(source,'  function getNativeQuestionsForSubject(','  function buildSubjectAppropriateDistractors(')+
 section(source,'  function strictSubjectMatch(','  function computeQuestionEditalLearningOrder(')+
 section(source,'function answerOptionText(','function answerOptionsSignature(')+
 section(source,'function parseExamAnswerKeyTable(','  window.extractStructuredExamQuestions='),ctx);
 ctx.window.inferStrictQuestionSubject=ctx.inferStrictQuestionSubject;
 return ctx;
}
const ctx=fixture(),failures=[];
function check(name,fn){try{fn();console.log('OK',name);}catch(error){failures.push(name+': '+error.message);}}
const opts=['Apenas a autoridade competente.','Independentemente da autoridade.','Somente após condenação.','Em qualquer situação.'];
const mc=(n,text)=>`QUESTÃO ${n}\n${text}\n${opts.map((s,i)=>`(${'ABCD'[i]}) ${s}`).join('\n')}`;
check('tópico deve seguir conteúdo e não a disciplina padrão do documento',()=>{
 const out=ctx.extractStructuredExamQuestions(mc(1,'Sobre o inquérito policial, assinale a alternativa correta.')+'\nGABARITO\n1-A',{defaultSubject:'Direito Constitucional'});
 assert.equal(out.length,1);assert.equal(out[0].subject,'Direito Processual Penal');assert.match(out[0].topic,/Inquérito/i);
});
check('numeração original e página devem permanecer para reconciliar o documento',()=>{
 const out=ctx.extractStructuredExamQuestions([{page:4,text:mc(51,'Sobre o inquérito policial, assinale a alternativa correta.')},{page:5,text:mc(52,'Sobre a prisão preventiva, assinale a alternativa correta.')},{page:6,text:'GABARITO\n51-A 52-B'}],{defaultSubject:'Direito Processual Penal'});
 assert.equal(out.length,2);assert.equal(out[0].question_number,51);assert.equal(out[0].source_page,4);assert.equal(out[1].question_number,52);assert.equal(out[1].source_page,5);assert.equal(out.report.expected,2);assert.equal(out.report.percent,100);
});
check('bloco sem alternativas e sem indicação C/E deve ficar sem reconhecimento',()=>{
 const out=ctx.extractStructuredExamQuestions('QUESTÃO 1\nAssinale a alternativa correta sobre o inquérito policial. O OCR não recuperou as alternativas.',{defaultSubject:'Direito Processual Penal',allowWithoutKey:true});
 assert.equal(out.length,0);assert.equal(out.report.skipped,1);
});
check('C/E explícito sem gabarito permanece pendente',()=>{
 const out=ctx.extractStructuredExamQuestions('Julgue os itens a seguir em certo ou errado.\nQUESTÃO 51\nO inquérito policial é um procedimento preparatório para a ação penal.',{defaultSubject:'Direito Processual Penal',allowWithoutKey:true});
 assert.equal(out.length,1);assert.deepEqual(Array.from(out[0].options),['CERTO','ERRADO']);assert.equal(out[0].correct_index,-1);assert(out[0].answer_unknown);
});
check('empate de domínios sem declaração segura deve ir para revisão',()=>{
 const q={subject:'Conteúdo Geral',statement:'Compare a prisão preventiva com a legítima defesa.',topic:'Questão 1',options:['Primeira alternativa.','Segunda alternativa.']};
 const decision=ctx.questionDisciplineDecision(q);assert.equal(decision.needs_review,true);
});
check('ausente na fonte bloqueia treino mesmo quando disciplina foi revista por humano',()=>{
 const q={subject:'Direito Processual Penal',subject_source:'manual',review_status:'source_not_matched',statement:'Sobre o inquérito policial, assinale a correta.',options:opts};
 assert.equal(ctx.questionDisciplineDecision(q).needs_review,true);assert.equal(ctx.isQuestionDisciplineEligible(q,'Direito Processual Penal'),false);
});
check('número inicial não representa total de questões e localização preserva página final',()=>{
 const out=ctx.extractStructuredExamQuestions([{page:7,text:mc(51,'Sobre o inquérito policial, assinale a alternativa correta.')},{page:8,text:'GABARITO\n51-A'}],{defaultSubject:'Direito Processual Penal'});
 assert.equal(out.report.expected,1);assert.equal(out.report.percent,100);assert.equal(out[0].page_end,7);assert.equal(out.report.sourceLocatedCount,1);
});
check('metadados de revisão e origem sobrevivem ao JSON sem promoção',()=>{
 const q={subject:'Direito Processual Penal',classification_declared_subject:'Direito Constitucional',classification_needs_review:true,subject_source:'cabecalho_pdf',topic:'Inquérito',question_number:51,source_page:7,source_page_end:8,exam_caderno:'TIPO 2',statement:'Sobre o inquérito policial, assinale a correta.',options:opts,correct_index:0};
 const out=ctx.extractStructuredExamQuestions(JSON.stringify([q]));assert.equal(out.length,1);assert(out[0].classification_needs_review);assert.equal(out[0].classification_declared_subject,'Direito Constitucional');assert.equal(out[0].source_page,7);assert.equal(out[0].exam_caderno,'TIPO 2');
});
check('gabarito com letra C não declara formato C/E de questão sem alternativas',()=>{
 const out=ctx.extractStructuredExamQuestions('QUESTÃO 1\nAssinale a alternativa correta sobre o inquérito policial. O OCR não recuperou as alternativas.\nGABARITO\n1-C',{defaultSubject:'Direito Processual Penal'});
 assert.equal(out.length,0);assert.equal(out.report.unknownFormatCount,1);
});
check('duas ou três alternativas expressas são preservadas sem fabricar opções',()=>{
 for(const count of [2,3]){
  const text='QUESTÃO 1\nSobre o inquérito policial, assinale a alternativa correta.\n'+opts.slice(0,count).map((value,i)=>`(${'ABC'[i]}) ${value}`).join('\n')+'\nGABARITO\n1-B';
  const out=ctx.extractStructuredExamQuestions(text,{defaultSubject:'Direito Processual Penal'});assert.equal(out.length,1);assert.equal(out[0].options.length,count);assert.equal(out[0].correct_index,1);
 }
});
check('alternativas duplicadas não contam como extração bem sucedida',()=>{
 const text='QUESTÃO 1\nSobre o inquérito policial, assinale a alternativa correta.\n(A) Mesmo conteúdo.\n(B) Mesmo conteúdo.\nGABARITO\n1-B';
 const out=ctx.extractStructuredExamQuestions(text,{defaultSubject:'Direito Processual Penal'});assert.equal(out.length,0);assert.equal(out.report.unknownFormatCount,1);
});
check('numeração acima de250e999 preserva gabaritos existentes',()=>{
 const text=[mc(251,'Sobre o inquérito policial, assinale a alternativa correta.'),mc(1000,'Sobre a prisão preventiva, assinale a alternativa correta.')].join('\n')+'\nGABARITO\n251-A 1000-B';
 const out=ctx.extractStructuredExamQuestions(text,{defaultSubject:'Direito Processual Penal'});assert.equal(out.length,2);assert.equal(out[0].question_number,251);assert.equal(out[1].question_number,1000);assert.equal(out[1].correct_index,1);assert.equal(out.report.percent,100);
});
check('gabarito longo não perde pares depois de8mil caracteres',()=>{
 const key=Array.from({length:1500},(_,index)=>`${index+1}-A`).join(' ');
 const map=ctx.parseExamAnswerKeyTable('GABARITO DEFINITIVO\n'+key);assert.equal(map.size,1500);assert.equal(map.get(1500),'A');
});
check('caderno1nãoé10eopçãoinexistenteérecusada',()=>{
 const text='GABARITO\nTIPO 1: 1-A 2-B\nTIPO 10: 1-C 2-D';
 const one=ctx.parseExamAnswerKeyTable(text,'TIPO 1');assert.equal(one.ambiguous,false);assert.equal(one.get(1),'A');
 const ten=ctx.parseExamAnswerKeyTable(text,'TIPO 10');assert.equal(ten.ambiguous,false);assert.equal(ten.get(1),'C');
 const absent=ctx.parseExamAnswerKeyTable(text,'TIPO 2');assert(absent.ambiguous);assert.equal(absent.size,0);
});
check('doiscadernoscomchavesiguaistambémexigemseleção',()=>{
 const map=ctx.parseExamAnswerKeyTable('GABARITO\nTIPO 1: 1-A 2-B\nTIPO 2: 1-A 2-B');assert(map.ambiguous);
});
if(failures.length){for(const failure of failures)console.error('PENDENTE',failure);process.exitCode=1;}else console.log('OK r184: classificação e extração conservadoras, procedência e cobertura real.');
