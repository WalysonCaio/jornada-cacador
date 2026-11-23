// User-reported PDF regressions, including adversarial support passages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
const ctx={window:{},state:{customCampaign:{missions:[]}},console};vm.createContext(ctx);
vm.runInContext(section(html,'function normalizeText(','function missionForQuestion(')+
 section(source,'  function questionMatchesBoardFilter(','  function subjectIconForName(')+
 section(source,'  function getNativeQuestionsForSubject(','  function buildSubjectAppropriateDistractors(')+
 section(source,'  function strictSubjectMatch(','  function computeQuestionEditalLearningOrder(')+
 section(source,'  function answerKeyStatus(','  function classifyQuestion(')+
 section(source,'function parseExamAnswerKeyTable(','  window.extractStructuredExamQuestions='),ctx);
const failures=[];let checks=0;
function check(name,fn){try{fn();checks++;console.log('OK',name);}catch(error){failures.push(`${name}: ${error.stack}`);}}
const legal='A Constituição Federal, o Congresso Nacional, o Senado Federal e a Câmara dos Deputados trataram da Lei de Cotas nas universidades federais e dos direitos sociais.';
const genre={subject:'Direito Constitucional',topic:'Do Poder Legislativo (Art. 44 ao 73)',associated_text:legal,statement:'Quanto ao gênero textual, o TEXTO 1 pode ser classificado como:',options:['reportag em.','notícia.','conto.'],correct_index:0,origin:'oficial'};
check('gênero textual prevalece sobre tema jurídico e classificação antiga fica em revisão',()=>{
 const d=ctx.questionDisciplineDecision(genre);assert.equal(d.subject,'Língua Portuguesa');assert(d.needs_review);assert.equal(ctx.isQuestionDisciplineEligible(genre,'Direito Constitucional'),false);
 assert.equal(ctx.inferStrictQuestionSubjectDecision(genre.statement,genre.topic,'Direito Constitucional',genre.options,{associated_text:legal}).subject,'Língua Portuguesa');
});
check('texto-base duplicado no enunciado não vence o comando',()=>{
 const q={...genre,statement:`Texto-base: ${legal}\n\n${genre.statement}`};assert.equal(ctx.questionDisciplineDecision(q).subject,'Língua Portuguesa');
});
check('termos de Português apenas no apoio não mudam uma questão constitucional',()=>{
 const base='O professor citou gênero textual, funções da linguagem, concordância verbal e colocação pronominal. '.repeat(12);
 const q={subject:'Direito Constitucional',associated_text:base,statement:`Texto-base: ${base}\n\nQuanto ao controle de constitucionalidade, assinale a alternativa correta.`,options:['Competência do STF.','Competência do Senado Federal.']};
 assert.equal(ctx.questionDisciplineDecision(q).subject,'Direito Constitucional');assert.equal(ctx.questionDisciplineDecision(q).needs_review,false);
});
check('palavras ambíguas em contexto jurídico não geram override de Português',()=>{
 const q={subject:'Direito Constitucional',statement:'A Constituição Federal protege a liberdade de oração e de imprensa. Quanto aos direitos e garantias fundamentais, assinale a alternativa correta.',options:['A reportagem está protegida.','A notícia pode ser publicada.']};assert.equal(ctx.questionDisciplineDecision(q).subject,'Direito Constitucional');
});
check('tópicos exclusivos resolvem funções da linguagem e negação da condicional',()=>{
 assert.equal(ctx.questionDisciplineDecision({subject:'Direito Constitucional',topic:'Funções da Linguagem',statement:'Identifique a classificação da expressão apresentada.',options:['conativa/apelativa','referencial']}).subject,'Língua Portuguesa');
 assert.equal(ctx.questionDisciplineDecision({subject:'Direito Constitucional',topic:'Negação da Condicional',statement:'Identifique a forma equivalente.',options:['Primeira forma.','Segunda forma.']}).subject,'Raciocínio Lógico-Matemático');
});
check('revisão humana contraditória é preservada e bloqueada para nova conferência',()=>{
 const q={...genre,subject_source:'manual'};const d=ctx.questionDisciplineDecision(q);assert.equal(d.subject,'Direito Constitucional');assert.equal(d.source,'manual');assert(d.needs_review);assert.equal(ctx.isQuestionDisciplineEligible(q,'all'),false);
});
check('campo legado heurístico não mascara revisão humana no outro campo',()=>{
 const q={...genre,subject_source:'heuristica',classification_source:'manual_revisado'};
 const d=ctx.questionDisciplineDecision(q);assert.equal(d.subject,'Direito Constitucional');assert.equal(d.source,'manual');assert(d.needs_review);assert.equal(ctx.isQuestionDisciplineEligible(q,'all'),false);
});
const orphan={subject:'Língua Portuguesa',topic:'Funções da Linguagem',statement:'No excerto, há presença das funções conativa/apelativa, poética, referencial e emotiva. Assinale os itens corretos.',options:['Apenas III.','Apenas II e IV.','I, II e III.'],correct_index:0,origin:'oficial'};
check('órfã sem I–IV permanece identificável e nunca pontua',()=>{
 const quality=ctx.getQuestionQualityDecision(orphan);assert(quality.needs_source);assert.deepEqual(Array.from(quality.missing_assertions).sort(),['I','II','III','IV']);assert.equal(ctx.isQuestionDisciplineEligible(orphan,'all'),false);assert.equal(ctx.gradeAnswer(orphan,0).scored,false);
});
check('itens em texto associado satisfazem as referências romanas',()=>{
 const q={...orphan,associated_text:'I - A linguagem conativa busca influenciar. II - A função poética destaca a mensagem. III - A função referencial informa. IV - A emotiva expressa o emissor.'};assert.equal(ctx.getQuestionQualityDecision(q).needs_source,false);assert.equal(ctx.isQuestionDisciplineEligible(q,'Língua Portuguesa'),true);assert.equal(ctx.gradeAnswer(q,0).scored,true);
});
check('itens ausentes em intervalo I a IV também são detectados',()=>{
 const q={...orphan,statement:'Analise as afirmações: I - A primeira é verdadeira. IV - A quarta é verdadeira.',options:['I a IV.','Apenas I.']};assert.deepEqual(Array.from(ctx.getQuestionQualityDecision(q).missing_assertions).sort(),['II','III']);
});
check('romanos em prosa ou CERTO/ERRADO não inventam assertivas',()=>{
 const q={subject:'Direito Constitucional',statement:'O art. 5º, inciso IV, da Constituição Federal protege a manifestação do pensamento.',options:['CERTO','ERRADO'],correct_index:0};assert.equal(ctx.getQuestionQualityDecision(q).needs_source,false);
});
check('excerto ausente é bloqueado sem depender de romanos',()=>{
 const q={...orphan,statement:'No excerto, qual função da linguagem predomina?',options:['Referencial.','Emotiva.']};assert(ctx.getQuestionQualityDecision(q).needs_source);
 const quoted={...q,statement:'No excerto “Eu sinto uma imensa saudade da minha terra”, qual função da linguagem predomina?'};assert.equal(ctx.getQuestionQualityDecision(quoted).needs_source,false);
});
check('cache de qualidade invalida ao acrescentar ou remover o apoio no mesmo objeto',()=>{
 const q={...orphan};assert(ctx.questionDisciplineDecision(q).needs_source);q.associated_text='I - Primeira afirmação. II - Segunda afirmação. III - Terceira afirmação. IV - Quarta afirmação.';assert.equal(ctx.questionDisciplineDecision(q).needs_source,undefined);delete q.associated_text;assert(ctx.questionDisciplineDecision(q).needs_source);
});
check('OCR conhecido é corrigido sem juntar palavras arbitrárias nem mudar o gabarito',()=>{
 const imported=ctx.extractStructuredExamQuestions(JSON.stringify([{...genre,statement:'A Le i foi citada. '+genre.statement}]))[0];assert.equal(imported.options[0],'reportagem.');assert.match(imported.statement,/A Lei/);assert.equal(imported.correct_index,0);assert.equal(imported.origin,'oficial');assert.equal(ctx.repairKnownExamTextArtifacts('em que a lei e o artigo se aplicam'),'em que a lei e o artigo se aplicam');
});
check('JSON conserva órfã, origem e gabarito, sinalizando revisão de fonte',()=>{
 const out=ctx.extractStructuredExamQuestions(JSON.stringify([orphan]));assert.equal(out.length,1);assert(out[0].needs_source);assert(out[0].structure_needs_review);assert.equal(out[0].correct_index,0);assert.equal(out[0].origin,'oficial');assert.equal(out.report.structureReviewCount,1);
});
check('extração numerada conserva questão incompleta para revisão, sem fabricar itens',()=>{
 const text=`LÍNGUA PORTUGUESA\nQUESTÃO 1\n${orphan.statement}\n(A) Apenas III.\n(B) Apenas II e IV.\nGABARITO\n1-A`;const out=ctx.extractStructuredExamQuestions(text);assert.equal(out.length,1);assert(out[0].needs_source);assert(!out[0].statement.includes('III -'));assert.equal(ctx.isQuestionDisciplineEligible(out[0],'all'),false);
});
check('reanálise preserva escolha humana contraditória e inclui pendência estrutural no relatório',()=>{
 ctx.window.classifyQuestion=ctx.questionDisciplineDecision;
 vm.runInContext(fs.readFileSync(new URL('../dist/question-review.js',import.meta.url),'utf8'),ctx);
 const old={...orphan,subject:'Direito Constitucional',subject_source:'manual',classification_needs_review:false};
 const rows=[{id:'row-1',content:{questions:[old]}}];
 const review=ctx.window.JCQuestionReview.reconcile(rows,[{...orphan}],{id:'doc-1',title:'Prova original'});
 const q=review.candidates[0].content.questions[0];assert.equal(q.subject,old.subject);assert.equal(q.topic,old.topic);assert.equal(q.subject_source,'manual');assert(q.classification_needs_review);assert(q.needs_source);assert.equal(review.report.structure_pending,1);assert.equal(review.report.items[0].structure_pending,true);assert.equal(review.report.items[0].missing_assertions.length,4);assert.equal(rows[0].content.questions[0].classification_needs_review,false);
 const legacy={...old,subject_source:'heuristica',classification_source:'manual_revisado'};
 const second=ctx.window.JCQuestionReview.reconcile([{id:'row-1',content:{questions:[legacy]}}],[{...orphan}],{id:'doc-1',title:'Prova original'}).candidates[0].content.questions[0];
 assert.equal(second.subject,'Direito Constitucional');assert.equal(second.classification_source,'manual_revisado');assert(second.classification_needs_review);
});
check('sanitização conserva órfãs e histórico; repetição usa cache sem refazer limpeza',()=>{
 let purged=0;
 Object.assign(ctx,{ALL_QUESTIONS:[{...orphan},{...genre,subject_source:'manual'}],isMetaDocumentNoiseText:()=>false,purgeHunterManualStudyArtifacts:()=>purged++,ensureNativeQuestionBankLoaded(){},isTopicContaminatedByWrongSubject:()=>false,computeQuestionEditalLearningOrder:()=>0,dedupeAllQuestionsInMemory(){},save(){}});
 ctx.state={activeCampaignId:'pmpe',errors:{'error-1':{...orphan,statement:undefined,question:orphan.statement}},customQuestionsByCampaign:{pmpe:[{...orphan}]}};
 vm.runInContext(section(html,'function isValidPedagogicalQuestion(','window.isValidPedagogicalQuestion=')+section(source,'  function sanitizeAllQuestionsAndErrorsSubjects(','  window.sanitizeAllQuestionsAndErrorsSubjects='),ctx);
 ctx.window.isValidPedagogicalQuestion=ctx.isValidPedagogicalQuestion;
 ctx.sanitizeAllQuestionsAndErrorsSubjects(true);assert.equal(ctx.ALL_QUESTIONS.length,2);assert.equal(ctx.state.customQuestionsByCampaign.pmpe.length,1);assert(ctx.state.errors['error-1']);assert(ctx.state.errors['error-1'].needs_source);assert.equal(ctx.ALL_QUESTIONS[1].subject,'Direito Constitucional');assert.equal(ctx.ALL_QUESTIONS[1].topic,genre.topic);assert.equal(purged,1);ctx.sanitizeAllQuestionsAndErrorsSubjects();assert.equal(purged,1);
});
check('retomada e entrega cronometrada não liberam caderno antigo com órfãs',()=>{
 vm.runInContext(section(source,'  function timedSimuladoQualityReady(','  function startTimedSimuladoClock('),ctx);
 assert.equal(ctx.timedSimuladoQualityReady({questions:[orphan]}),false);
 assert.equal(ctx.timedSimuladoQualityReady({questions:[{subject:'Direito Constitucional',statement:'A Constituição Federal prevê direitos e garantias fundamentais.',options:['Sim.','Não.'],correct_index:0,origin:'oficial'}]}),true);
});
check('retomada de treino antigo não pontua classificação contraditória sem flags salvas',()=>{
 const messages=[],nodes={},buttons=[0,1,2].map(index=>({disabled:false,dataset:{questionIndex:String(index)},setAttribute(){}}));
 const q={...genre};
 Object.assign(ctx,{activeQuestions:{questions:[q],current:0,correct:0,answered:false},q:selector=>nodes[selector]||(nodes[selector]={disabled:false}),qa:()=>buttons,toast:message=>messages.push(message),escText:String});
 vm.runInContext(section(source,'  function questionAnswerNotice(', '  window.showQuestion=function(){')+section(source,'  window.answerQuestion=function(button,item){','  // 2C. Diagnóstico Tático de Pontos Fortes e Pontos Fracos'),ctx);
 assert(ctx.questionAnswerNotice(q).includes('Classificação aguardando revisão'));
 ctx.bindQuestionAnswerConfirmation(ctx.activeQuestions,q);
 assert(buttons.every(button=>button.disabled));assert(nodes['#confirmQuestionAnswerBtn'].disabled);assert(nodes['#skipQuestionBlankBtn'].disabled);
 ctx.window.answerQuestion(buttons[0],q);ctx.window.skipQuestionBlank(q);
 assert.equal(ctx.activeQuestions.answered,false);assert.equal(ctx.activeQuestions.correct,0);assert.equal(ctx.activeQuestions.blankCount,undefined);
 assert.equal(messages.length,2);assert(messages.every(message=>message.includes('disciplina')));
});
check('sessão antiga já respondida não cria placar novo com classificação inválida',()=>{
 let finalized=0,saved=0,removed=0;
 ctx.activeQuestions={questions:[{...genre,_userAnswered:true}],current:0,correct:1,answered:true};
 ctx.window.nextQuestion=()=>{finalized++;ctx.activeQuestions=null;};
 ctx.saveActiveQuestionSession=()=>{saved++;};ctx.clearSavedQuestionSession=()=>{removed++;};
 vm.runInContext(section(source,'  const origNextQ = window.nextQuestion;','  // Bloqueia o fechamento por tecla ESC'),ctx);
 assert.equal(ctx.window.nextQuestion(),false);assert.equal(finalized,0);assert.equal(saved,1);assert.equal(removed,0);assert.equal(ctx.activeQuestions.correct,1);
});
check('prática com gabarito pendente encerra sem placar falso, inclusive em sessão mista',()=>{
 const valid={subject:'Língua Portuguesa',topic:'Crase',statement:'Assinale a alternativa em que o emprego da crase está correto.',options:['À escola.','A escola.'],correct_index:0,origin:'oficial'};
 for(const pending of [{...valid,correct_index:-1},{...valid,key_source:'ia_sugerido',answer_key_validation:'pendente'},{...valid,anulada:true}])for(const mixed of [false,true]){
  let finalized=0,removed=0,closed=0;
  const questions=mixed?[valid,pending]:[pending];
  ctx.activeQuestions={questions,current:questions.length-1,correct:mixed?1:0,answered:true};
  const individualHistory={correct:ctx.activeQuestions.correct,xp:mixed?25:0};ctx.state.questionAttemptHistory=individualHistory;
  ctx.window.nextQuestion=()=>{finalized++;};ctx.clearSavedQuestionSession=()=>{removed++;};ctx.q=()=>({close(){closed++;}});
  vm.runInContext('{'+section(source,'  const origNextQ = window.nextQuestion;','  // Bloqueia o fechamento por tecla ESC')+'}',ctx);
  ctx.ensureDailyTracker=()=>{throw new Error('Prática pendente não conclui correção da missão diária.');};ctx.evaluateAndAutoCheckDailySteps=()=>{throw new Error('Prática pendente não marca etapas diárias.');};
  vm.runInContext('{'+section(source,'    const baseNextQ=typeof nextQuestion', '    // 3) Hook em gradeCard')+'}',ctx);
  assert.equal(ctx.window.nextQuestion(),false);assert.equal(finalized,0,'não gera placar ou bônus de conclusão');assert.equal(ctx.activeQuestions,null);assert.equal(removed,1);assert.equal(closed,1);
  assert.equal(ctx.state.questionAttemptHistory,individualHistory,'mantém registros individuais anteriores sem recalculá-los');assert.equal(ctx.state.questionAttemptHistory.xp,mixed?25:0);
 }
});
check('encerrar prática do contexto antigo não apaga a retomada do portal atual',()=>{
 let removed=0,closed=0;
 ctx.currentQuestionSessionScope=()=>({userId:'user-a',campaignId:'new-portal',resetEpoch:0});
 ctx.activeQuestions={questions:[{...genre,correct_index:-1}],current:0,answered:true,_sessionScope:{userId:'user-a',campaignId:'old-portal',resetEpoch:0}};
 ctx.window.nextQuestion=()=>{throw new Error('Contexto antigo não pode concluir bateria.');};ctx.clearSavedQuestionSession=()=>{removed++;};ctx.q=()=>({close(){closed++;}});
 vm.runInContext('{'+section(source,'  const origNextQ = window.nextQuestion;','  // Bloqueia o fechamento por tecla ESC')+'}',ctx);
 assert.equal(ctx.window.nextQuestion(),false);assert.equal(removed,0);assert.equal(closed,1);assert.equal(ctx.activeQuestions,null);
});
if(failures.length){for(const failure of failures)console.error('PENDENTE',failure);process.exitCode=1;}else console.log(`OK r186: ${checks} cenários de comando, disciplina, fonte e qualidade.`);
