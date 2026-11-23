// User PDF regressions exercised through the real text, extraction, grading,
// presentation/preparation and PDF-review APIs; transport is local and inert.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
const source=read('v77-experience.js'),html=read('index.html');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
const ctx={state:{customCampaign:{missions:[]},questionAnswerOverrides:{},questionAttemptHistory:[{correct:true,xp:25}]},console,setTimeout,clearTimeout,AbortController,
 document:{readyState:'loading',addEventListener(){}},escText:value=>String(value).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),sessionStorage:{removeItem(){}},shuffle:array=>[...array].reverse()};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(read('question-text-quality.js'),ctx);
vm.runInContext(section(html,'function normalizeText(','function missionForQuestion(')+
 section(html,'function learningCategory(','function migrateLearningSubjectKeys(')+
 section(html,'function questionFingerprint(','function _ensureModeBucketsIndex(')+
 section(source,'  function questionMatchesBoardFilter(','  function subjectIconForName(')+
 section(source,'  function highlightCommandsAndLaws(','  const nativeBankLoadedSources')+
 section(source,'  function getNativeQuestionsForSubject(','  function buildSubjectAppropriateDistractors(')+
 section(source,'  function strictSubjectMatch(','  function computeQuestionEditalLearningOrder(')+
 section(source,'  function answerKeyStatus(','  function missionRewardContext(')+
 section(source,'function parseExamAnswerKeyTable(','  window.extractStructuredExamQuestions=')+
 section(source,'  function stripOptionLetterPrefixClean(','  // Formata qualquer explicação garantindo'),ctx);
vm.runInContext(read('question-review.js'),ctx);
const text=ctx.JCQuestionText,clone=value=>JSON.parse(JSON.stringify(value));
const stem='Sobre os direitos e garantias fundamentais da Constituição Federal, assinale a alternativa correta.';
const leaked='Propaganda comercial. Assinale a alternativa correta tendo em vista a legislação referente ao Mandado de Injunção.\na) Primeira resposta.\nb) Segunda resposta.\nc) Terceira resposta.\nd) Quarta resposta.\ne) Quinta resposta.';
const footer='Mulheres não podem ocupar cargos de oficialato nas Forças Armadas. GABARITO COMENTADO - BLOCO 11 401.';
const q=(extra={})=>({subject:'Direito Constitucional',topic:'Direitos e Deveres Individuais e Coletivos',statement:stem,options:['Resposta primeira.','Resposta segunda.','Resposta terceira.','Resposta quarta.',leaked],correct_index:4,origin:'oficial',question_number:1,source_page:1,...extra});
let cases=0;
function check(name,fn){fn();cases++;console.log('OK',name);}
check('tipografia exata do relato e reparos r186 são idempotentes',()=>{
 const raw='S empre é responsáve l pela ilegal idade ao fazê - lo; aplica - se o habeas - corpus e a licença - maternidade , conforme a Le i. Reportag em.';
 const expected='Sempre é responsável pela ilegalidade ao fazê-lo; aplica-se o habeas-corpus e a licença-maternidade, conforme a Lei. Reportagem.';
 assert.equal(text.normalizeTypography(raw),expected);assert.equal(text.normalizeTypography(expected),expected);
});
check('A/O/E, fragmentos desconhecidos, números, matemática e códigos permanecem',()=>{
 for(const raw of ['A lei e O artigo. E a norma.','A mora e a Lei A. O S e o E.','X termo e pala vra.','x - y; 10 - 2; a - b; foo - se; let - me','x ? y : z','const aplica - se = foo ;','m² ① ≠ 2; A-12/34','`S empre; aplica - se; x ? y : z`','```js\nconst S empre = x ? y : z ;\naplica - se\n```','$x - y , z$','\\(aplica - se\\)','https://example.test/a?b=1&c=2'])assert.equal(text.normalizeTypography(raw),raw,raw);
 assert.equal(text.normalizeTypography('S empre. `aplica - se`'),'Sempre. `aplica - se`');
});
check('a alternativa E conserva o prefixo e todo o vazamento cru',()=>{
 const result=text.analyzeOption(leaked);
 assert(result.needs_review);assert.equal(result.text,'Propaganda comercial.');assert.equal(result.kind,'following_question');assert.equal(result.raw,leaked);
 assert.equal(result.leaked_text,leaked.slice(result.cut_index));assert(result.leaked_text.includes('\na) Primeira resposta.'));
});
check('cabeçalho de gabarito e bloco isolado conservam a resposta anterior',()=>{
 const result=text.analyzeOption(footer);assert.equal(result.text,'Mulheres não podem ocupar cargos de oficialato nas Forças Armadas.');assert.equal(result.kind,'answer_key_header');
 const block=text.analyzeOption('Resposta preservada.\nBLOCO 11 401.');assert(block.needs_review);assert.equal(block.text,'Resposta preservada.');
});
check('banca ao iniciar a questão colada é limite de corte',()=>{
 const raw='Resposta preservada. (FUNCAB) Considere os requisitos. a) Um. b) Dois. c) Três.';
 const result=text.analyzeOption(raw);assert.equal(result.text,'Resposta preservada.');assert.equal(result.kind,'following_board_question');
});
check('cauda ambígua é bloqueada e preservada, sem fabricar limite',()=>{
 for(const raw of ['Resposta preservada. Outra questão perdeu o comando:\na) Um. b) Dois. c) Três.','Resposta preservada. Assinale a opção que respeita a lei.','Resposta preservada. (AOCP) Texto incompleto.']){
  const result=text.analyzeOption(raw);assert(result.needs_review,raw);assert.equal(result.cut_index,null);assert.equal(result.text,raw);
 }
});
check('listas legais, referências a bancas, citações e código não vazam',()=>{
 const cases=['São três hipóteses.\na) doença; b) acidente; c) licença.','A lei inclui as seguintes regras: a) primeira; b) segunda; c) terceira.','A jurisprudência do concurso (FUNCAB) orienta a solução.','O título GABARITO COMENTADO aparece na obra.','O trecho diz: “Resposta. Assinale a alternativa correta. a) Um. b) Dois. c) Três.”','O comando foi \'Assinale a alternativa correta. a) Um. b) Dois. c) Três.\'','Exemplo. `Assinale a alternativa correta. a) Um. b) Dois. c) Três.`'];
 for(const raw of cases){const result=text.analyzeOption(raw);assert.equal(result.needs_review,false,raw);assert.equal(result.text,raw);}
});
check('limpeza preserva fonte, gabarito e histórico em snapshot independente',()=>{
 const original=q({statement:'S empre. '+stem,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Página conferida.',answer_key_history:[{previous_index:0,correct_index:4,reference:'Pessoal'}],explanation:'Comentário pessoal.'});
 const before=JSON.stringify(original),copy=text.cleanQuestion(original);
 assert.equal(JSON.stringify(original),before);assert.equal(copy.options[4],'Propaganda comercial.');assert(copy.needs_source);assert.equal(copy.correct_index,-1);assert(copy.answer_unknown);assert(copy.answer_key_override_stale);
 assert.equal(copy.text_integrity_review.original.correct_index,4);assert.equal(copy.text_integrity_review.original.answer_key_validation,'revisado');assert.equal(copy.text_integrity_review.original.statement,original.statement);assert.deepEqual(clone(copy.text_integrity_review.original.answer_key_history),original.answer_key_history);
 copy.text_integrity_review.original.answer_key_history[0].reference='Cópia';assert.equal(original.answer_key_history[0].reference,'Pessoal');
 const repeated=text.cleanQuestion(copy);assert.equal(repeated.options[4],'Propaganda comercial.');assert.equal(repeated.text_integrity_review.original.options[4],leaked);assert(repeated.text_integrity_review.pending);
});
check('gabarito e pontuação são bloqueados em questão antiga sem flags',()=>{
 const original=q(),before=JSON.stringify(original),history=JSON.stringify(ctx.state.questionAttemptHistory);
 assert.equal(ctx.answerKeyStatus(original),'sem_gabarito');assert.equal(ctx.getQuestionQualityDecision(original).quality_status,'alternative_leak');assert.equal(ctx.gradeAnswer(original,4).scored,false);assert.equal(ctx.gradeAnswer(original,4).status,'needs_source');assert.equal(ctx.isQuestionDisciplineEligible(original,'all'),false);
 assert.equal(JSON.stringify(original),before);assert.equal(JSON.stringify(ctx.state.questionAttemptHistory),history);
});
check('cache invalida quando alternativa muda no mesmo objeto',()=>{
 const item=q();assert(text.analyzeQuestion(item).needs_review);item.options[4]='Propaganda comercial.';assert.equal(text.analyzeQuestion(item).needs_review,false);assert.equal(ctx.getQuestionQualityDecision(item).needs_review,false);item.options[4]=footer;assert(text.analyzeQuestion(item).needs_review);
});
check('importação JSON usa API real e preserva espaçamento/fonte antes do corte',()=>{
 const item=q({statement:'S empre. '+stem,options:['S empre.','fazê - lo.','responsáve l.','ilegal idade.',leaked],key_source:'manual_revisado',answer_key_validation:'revisado',answer_key_history:[{correct_index:4,reference:'Pessoal'}]});
 const imported=ctx.extractStructuredExamQuestions(JSON.stringify([item]));assert.equal(imported.length,1);assert.equal(imported.report.structureReviewCount,1);assert.equal(imported[0].options[0],'Sempre.');assert.equal(imported[0].options[4],'Propaganda comercial.');assert.equal(imported[0].correct_index,-1);
 assert.equal(imported[0].text_integrity_review.original.options[0],'S empre.');assert.equal(imported[0].text_integrity_review.original.options[4],leaked);assert.deepEqual(clone(imported[0].text_integrity_review.original.answer_key_history),item.answer_key_history);
 const roundTrip=ctx.extractStructuredExamQuestions(JSON.stringify(imported),{allowWithoutKey:true});assert.equal(roundTrip.length,1);assert(roundTrip[0].needs_source);assert.equal(roundTrip[0].correct_index,-1);assert.equal(roundTrip[0].text_integrity_review.original.options[4],leaked);
});
check('extração numerada corta E, conserva bloco cru e não inventa questão 2',()=>{
 const block='QUESTÃO 1\n'+stem+'\nA) S empre a lei.\nB) fazê - lo.\nC) responsáve l.\nD) ilegal idade.\nE) '+leaked;
 const out=ctx.extractStructuredExamQuestions([{page:3,text:block}],{allowWithoutKey:true,defaultSubject:'Direito Constitucional'});
 assert.equal(out.length,1);assert.equal(out.report.expected,1);assert.equal(out.report.structureReviewCount,1);assert.equal(out[0].question_number,1);assert.equal(out[0].source_page,3);assert.equal(out[0].options[4],'Propaganda comercial.');assert.equal(out[0].correct_index,-1);
 assert.equal(out[0].text_integrity_review.original.options[4],leaked);assert(out[0].text_integrity_review.original.source_text.includes('E) '+leaked));
});
check('rodapé engolido e alternativa D também ficam em revisão na extração real',()=>{
 for(const [tail,count,retained]of [[footer,5,'Mulheres não podem ocupar cargos de oficialato nas Forças Armadas.'],[leaked,4,'Propaganda comercial.']]){
  const labels='ABCDE',body='QUESTÃO 1\n'+stem+'\n'+Array.from({length:count},(_,index)=>labels[index]+') '+(index===count-1?tail:'Resposta '+(index+1)+'.')).join('\n');
  const out=ctx.extractStructuredExamQuestions(body,{allowWithoutKey:true});assert.equal(out.length,1);assert.equal(out[0].options[count-1],retained);assert(out[0].needs_source);assert.equal(out[0].text_integrity_review.original.options[count-1],tail);
 }
});
check('extração com gabarito anterior não promove a chave contaminada',()=>{
 const body='QUESTÃO 1\n'+stem+'\nA) Primeira.\nB) Segunda.\nC) Terceira.\nD) Quarta.\nE) '+leaked+'\nGABARITO DEFINITIVO\n1-E';
 const out=ctx.extractStructuredExamQuestions(body);assert.equal(out.length,1);assert.equal(out[0].correct_index,-1);assert.equal(out[0].text_integrity_review.original.correct_index,4);assert(out[0].needs_source);
});
check('preparação de questão salva normaliza texto e retém chave manual segura',()=>{
 const item=q({statement:'S empre. '+stem,options:['S empre.','fazê - lo.','responsáve l.','ilegal idade.','aplica - se.'],key_source:'manual_revisado',answer_key_validation:'revisado'});
 const fp=ctx.questionFingerprint(item),legacy={correct_answer:'responsáve l.',options_signature:JSON.stringify([...item.options].sort()),correct_index:2,key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Fonte pessoal.',answer_key_history:[{correct_index:2,reference:'Fonte pessoal.'}]};
 ctx.state.questionAnswerOverrides[fp]=legacy;const before=JSON.stringify(item),overrides=JSON.stringify(ctx.state.questionAnswerOverrides);
 const prepared=ctx.prepareQuestionConsistent(item);assert.equal(prepared.statement,'Sempre. '+stem);assert.equal(prepared.correct_index,2);assert.equal(prepared.options[2],'responsável.');assert.equal(prepared.key_source,'manual_revisado');assert.equal(ctx.answerKeyStatus(prepared),'revisado');
 assert.equal(JSON.stringify(item),before);assert.equal(JSON.stringify(ctx.state.questionAnswerOverrides),overrides);
});
check('preparação coloca chave manual contaminada em revisão sem alterar original',()=>{
 const item=q();ctx.applyReviewedAnswerKey(item,4,'Página pessoal.');const before=JSON.stringify(item),overrides=JSON.stringify(ctx.state.questionAnswerOverrides),history=JSON.stringify(ctx.state.questionAttemptHistory);
 const prepared=ctx.prepareQuestionConsistent(item);assert.equal(prepared.options[4],'Propaganda comercial.');assert.equal(prepared.correct_index,-1);assert(prepared.answer_key_override_stale);assert.equal(prepared.text_integrity_review.original.correct_index,4);assert.equal(prepared.text_integrity_review.original.key_reference,'Página pessoal.');assert.equal(ctx.answerKeyStatus(prepared),'sem_gabarito');
 assert.equal(JSON.stringify(item),before);assert.equal(JSON.stringify(ctx.state.questionAnswerOverrides),overrides);assert.equal(JSON.stringify(ctx.state.questionAttemptHistory),history);
});
check('renderização de texto salvo normaliza sem alterar dados nem escapar HTML',()=>{
 const item=q({statement:'S empre deve fazê - lo.'}),before=JSON.stringify(item);const rendered=ctx.formatStatementWithHighlights(item.statement,item);
 assert(rendered.includes('Sempre deve fazê-lo.'));assert.equal(JSON.stringify(item),before);assert(ctx.formatStatementWithHighlights('S empre <script>malicioso</script>',{}).includes('&lt;script&gt;'));
});
check('simulado retomado exibe alternativas salvas com tipografia limpa',()=>{
 const nodes=new Map(),node=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);};
 const item=q({statement:'S empre. '+stem,options:['fazê - lo.','responsáve l.','ilegal idade.','aplica - se.','habeas - corpus.']}),before=JSON.stringify(item);
 Object.assign(ctx,{activeSimulado:{questions:[item],answers:[null],eliminated:[new Set()],current:0},q:node,qa:()=>[],saveActiveTimedSimulado(){}});
 vm.runInContext(section(source,'  function renderSimuladoQuestion(){','  function navigateSimulado('),ctx);ctx.renderSimuladoQuestion();
 assert(node('#simuladoQuestionText').innerHTML.includes('Sempre.'));assert(node('#simuladoOptions').innerHTML.includes('fazê-lo.'));assert(node('#simuladoOptions').innerHTML.includes('responsável.'));assert.equal(JSON.stringify(item),before);
});
check('reanálise propõe quarentena e preserva pacote/manual/histórico antigos',()=>{
 const old=q({key_source:'manual_revisado',answer_key_validation:'revisado',key_reference:'Minha revisão.',answer_key_history:[{correct_index:4,reference:'Minha revisão.'}],explanation:'Comentário pessoal.'}),rows=[{id:'r1',content:{is_question_pack:true,questions:[old]}}],before=JSON.stringify(rows),history=JSON.stringify(ctx.state.questionAttemptHistory);
 const fresh=ctx.extractStructuredExamQuestions(JSON.stringify([old]));const proposal=ctx.JCQuestionReview.reconcile(rows,fresh,{id:'doc',title:'Prova original'},{pdfTotalPages:1,pagesRead:1});
 assert.equal(JSON.stringify(rows),before);assert.equal(JSON.stringify(ctx.state.questionAttemptHistory),history);assert.equal(proposal.report.not_matched,1);assert.equal(proposal.report.added,1);assert.equal(proposal.report.structure_pending,1);assert.equal(proposal.report.text_integrity_pending,1);assert(proposal.report.manual_review_required);
 assert.equal(proposal.report.items[0].text_integrity_review.original.options[4],leaked);assert(proposal.report.items[0].text_integrity_review.leaks[0].leaked_text.includes('Assinale'));
 const preserved=proposal.candidates[0].content.questions[0],added=proposal.candidates[1].content.questions[0];assert.equal(preserved.correct_index,4);assert.equal(preserved.key_reference,'Minha revisão.');assert.equal(preserved.options[4],leaked);assert.equal(preserved.review_status,'source_not_matched');assert.equal(added.options[4],'Propaganda comercial.');assert.equal(added.correct_index,-1);assert.equal(added.text_integrity_review.original.options[4],leaked);assert.equal(added.review_status,'needs_source_check');
});
check('módulo é síncrono antes do leitor/core e está no cache de atualização',()=>{
 const module=html.indexOf('<script src="question-text-quality.js"');assert(module>=0);assert(module<html.indexOf('<script src="pdf-text-client.js"'));assert(module<html.indexOf('function questionFingerprint('));assert(module<html.indexOf('<script src="v77-experience.js"'));
 assert(read('sw.js').includes("'./question-text-quality.js'"));
});
console.log(`OK r187 texto: ${cases} cenários de tipografia, vazamento, fonte crua, revisão pessoal, extração, pontuação e apresentação.`);
