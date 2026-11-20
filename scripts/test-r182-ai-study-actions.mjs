import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const code=[
 section('  const escText=', '  const shortLabel='),
 section('  function answerKeyStatus(', '  function classifyQuestion('),
 section('  async function saveQuestionsToCampaign(', '  function reportOrFixCurrentQuestion('),
 section('  async function spawnTwinQuestionForCurrent(', '  function generateFlashcardsFromNativeBank('),
 section('  function saveCurrentQuestionToNotes(', '  // Sobrescreve showQuestion'),
].join('\n');
const plain=value=>JSON.parse(JSON.stringify(value));
const question={subject:'Português',topic:'Crase',board:'Banca de teste',statement:'Em qual contexto a crase foi corretamente empregada?',options:['Primeira opção','Segunda opção'],correct_index:1,origin:'oficial',explanation:'Conceito-chave: A crase corresponde à fusão de duas vogais em situações específicas, que dependem da regência e do artigo.'};
const generated={...question,statement:'Assinale uma aplicação diferente da regra de crase.',origin:'oficial',correct_index:0};
const response=body=>({ok:true,json:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
function env(){
 const messages=[],writes=[],fetches=[],renders=[];
 const nodes={'#easyAnalogyOutput':{innerHTML:'',hidden:true}};
 const ctx={console,AbortController,
  state:{_ownerUserId:'a',activeCampaignId:'p',_resetEpoch:0,customQuestionsByCampaign:{},userNotes:[]},
  cloudSession:{user:{id:'a'},access_token:'token-a'},
  ALL_QUESTIONS:[],ALL_FLASHCARDS:[],LEARNING_SUBJECTS:[],
  activeQuestions:{questions:[plain(question)],current:0},navigator:{onLine:true},
  activeCampaign:()=>({id:ctx.state.activeCampaignId,dbId:'db-'+ctx.state.activeCampaignId}),
  validSession:async()=>ctx.cloudSession,
  authHeaders:token=>({Authorization:'Bearer '+token}),SUPABASE_URL:'https://fixture.test',
  canonicalSubjectName:value=>String(value),learningCategory:value=>String(value),
  resolveStrictQuestionDiscipline:(statement,_topic,subject)=>typeof statement==='object'?statement.subject:subject,
  isQuestionDisciplineEligible:()=>true,normalizedDifficulty:()=> 'medio',
  questionFingerprint:item=>[item.subject,item.topic,item.statement].join('|'),
  q:id=>nodes[id]||null,
  save:()=>renders.push('save'),renderQuestionFilters:()=>renders.push('filters'),populateTopicFilter:()=>renders.push('topics'),updateQuestionPool:()=>renders.push('pool'),renderExamBankHub:()=>renders.push('hub'),
  renderCard:()=>renders.push('cards'),updateFlashcardSpacedStats:()=>renders.push('stats'),
  toast:text=>{messages.push(String(text));},
  setTimeout:()=>1,clearTimeout(){},
  fetch:async(url,options)=>{fetches.push({url,options,body:JSON.parse(options.body)});return response({questions:[plain(generated)]});},
  cloudFetch:async(path,options)=>{writes.push({path,headers:options.headers,body:JSON.parse(options.body)});return{ok:true};},
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,messages,writes,fetches,renders,nodes};
}

// Faltam gabarito/rede: não gerar uma versão inventada ou assumir A.
{
 const {ctx,writes,fetches,messages}=env();
 assert.equal(ctx.buildLocalCognitiveTwinQuestion({...question,correct_index:null}),null);
 await ctx.spawnTwinQuestionForCurrent({...question,correct_index:-1},{});
 await ctx.explainQuestionWithEasyAnalogy({...question,correct_index:null},{});
 assert.equal(ctx.createFlashcardFromQuestion({...question,key_source:'ia_sugerido',answer_key_validation:'pendente'},{}),false);
 assert.equal(fetches.length,0);assert.equal(writes.length,0);assert.equal(ctx.ALL_FLASHCARDS.length,0);
 ctx.navigator.onLine=false;
 await ctx.spawnTwinQuestionForCurrent(question,{});
 assert.equal(fetches.length,0);assert.equal(writes.length,0);
 assert(messages.some(text=>text.includes('original foi preservada')));
 assert.equal(ctx.activeQuestions.questions.length,1);
}
// A IA pode propor uma questão, mas não conferir o próprio gabarito nem inseri-la no treino pontuado.
{
 const {ctx,writes,fetches}=env();
 const result=await ctx.spawnTwinQuestionForCurrent(question,{});
 assert.equal(fetches.length,1);assert.equal(result.origin,'autoral');
 assert.equal(result.key_source,'ia_sugerido');assert.equal(result.answer_key_validation,'pendente');
 assert.equal(ctx.gradeAnswer(result,0).scored,false);
 assert.equal(ctx.activeQuestions.questions.length,1);
 assert.equal(ctx.ALL_QUESTIONS.length,1);
 const saved=writes.find(row=>row.path==='generated_study_content').body[0].content.questions[0];
 assert.equal(saved.key_source,'ia_sugerido');assert.equal(saved.origin,'autoral');
 const shared=writes.find(row=>row.path.startsWith('shared_question_bank')).body[0];
 assert.equal(shared.created_by,'a');assert(ctx.isUnreviewedAiAnswer(shared));
}
// Estruturas incompletas, alternativas duplicadas e índices inválidos não são reparados.
for(const override of [{options:['Uma']},{options:['Uma','','Outra']},{options:['Igual','Igual']},{options:['A) Igual','B) Igual']},{correct_index:null},{correct_index:false},{correct_index:true},{correct_index:-1},{correct_index:2},{correct_index:0.5},{subject:'Direito Penal'},{explanation:''}]){
 const {ctx,writes}=env();ctx.fetch=async()=>response({questions:[{...generated,...override}]});
 assert.equal(await ctx.spawnTwinQuestionForCurrent(question,{}),false,JSON.stringify(override));
 assert.equal(writes.length,0);assert.equal(ctx.ALL_QUESTIONS.length,0);
}
// Capitalização pode ser o conteúdo cobrado: não colapsar A/a.
{
 const {ctx}=env();ctx.fetch=async()=>response({questions:[{...generated,options:['A','a'],correct_index:1}]});
 const result=await ctx.spawnTwinQuestionForCurrent(question,{});
 assert.deepEqual(plain(result.options),['A','a']);
}
// Respostas tardias em fetch e JSON não alteram a conta, o portal ou a redefinição atual.
for(const change of ['account','portal','reset','logout'])for(const phase of ['fetch','json']){
 const {ctx,writes,messages}=env(),late=deferred();
 let entered=false;
 ctx.fetch=async()=>{entered=true;return phase==='fetch'?late.promise:{ok:true,json:()=>late.promise};};
 const pending=ctx.spawnTwinQuestionForCurrent(question,{});await tick();assert(entered);
 if(change==='account'){ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.state={...ctx.state,_ownerUserId:'b'};}
 if(change==='portal')ctx.state.activeCampaignId='other';
 if(change==='reset')ctx.state._resetEpoch=1;
 if(change==='logout')ctx.cloudSession=null;
 late.resolve(phase==='fetch'?response({questions:[generated]}):{questions:[generated]});
 assert.equal(await pending,false,change+'/'+phase);assert.equal(writes.length,0);assert.equal(messages.length,0);
 assert.equal(ctx.activeQuestions.questions.length,1);
}
// Upload aceito na conta original não dispara compartilhamento posterior nem render na conta nova.
for(const change of ['account','portal','reset','logout']){
 const {ctx,writes,renders}=env(),late=deferred();
 ctx.cloudFetch=async(path,options)=>{writes.push({path,headers:options.headers,body:JSON.parse(options.body)});return late.promise;};
 const pending=ctx.saveQuestionsToCampaign('Caderno','Português',[question]);await tick();
 assert.equal(writes.length,1);assert.equal(writes[0].headers.Authorization,'Bearer token-a');
 if(change==='account'){ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.state={_ownerUserId:'b',activeCampaignId:'p'};ctx.ALL_QUESTIONS=[];}
 if(change==='portal')ctx.state.activeCampaignId='other';
 if(change==='reset')ctx.state._resetEpoch=1;
 if(change==='logout')ctx.cloudSession=null;
 late.resolve({ok:true});assert.equal(await pending,0,change);
 assert.equal(writes.length,1);assert.deepEqual(renders,['save']);
}
// Analogia é apoio explícito, usa o gabarito conhecido e apresenta a resposta como texto escapado.
{
 const {ctx,fetches,nodes}=env();
 ctx.fetch=async(url,options)=>{fetches.push({url,body:JSON.parse(options.body)});return response({answer:'<img src=x onerror=alert(1)> Explicação sugerida.'});};
 const btn={};assert.equal(await ctx.explainQuestionWithEasyAnalogy(question,btn),true);
 assert(fetches[0].body.question.includes(question.options[1]));
 assert(nodes['#easyAnalogyOutput'].innerHTML.includes('&lt;img'));
 assert(!nodes['#easyAnalogyOutput'].innerHTML.includes('<img'));
 assert(nodes['#easyAnalogyOutput'].innerHTML.includes('não valida o gabarito'));assert.equal(btn.disabled,false);
}
{
 const {ctx,nodes}=env(),late=deferred();ctx.fetch=async()=>late.promise;
 const pending=ctx.explainQuestionWithEasyAnalogy(question,{});await tick();
 ctx.cloudSession={user:{id:'b'}};ctx.state._ownerUserId='b';
 late.resolve(response({answer:'Resposta da conta anterior'}));
 assert.equal(await pending,false);assert.equal(nodes['#easyAnalogyOutput'].innerHTML,'');
}
// Cartões exigem gabarito utilizável e comentário real, conservando a proveniência do conceito.
{
 const {ctx,messages}=env();
 assert.equal(ctx.createFlashcardFromQuestion({...question,explanation:'',options:['Está errado.','Não está correto.']},{}),false);
 assert.equal(ctx.ALL_FLASHCARDS.length,0);assert(messages.some(text=>text.includes('explicação suficiente')));
 assert.equal(ctx.createFlashcardFromQuestion(question,{}),true);
 assert.equal(ctx.ALL_FLASHCARDS.length,1);assert.equal(ctx.state.userNotes[0].userId,'a');
 assert.equal(ctx.state.userNotes[0].campaignId,'p');
 assert(ctx.ALL_FLASHCARDS[0][2].includes('Extraído do comentário'));
 assert(!ctx.ALL_FLASHCARDS[0][2].includes('Regra universal'));
 const other=env();other.ctx.cloudSession={user:{id:'b'}};
 assert.equal(other.ctx.createFlashcardFromQuestion(question,{}),false);assert.equal(other.ctx.ALL_FLASHCARDS.length,0);
 other.ctx.cloudSession=null;assert.equal(other.ctx.createFlashcardFromQuestion(question,{}),false);
}
// Salvar questão pendente como anotação não inventa a resposta A.
{
 const {ctx}=env();
 for(const raw of [null,undefined,false,-1]){
  ctx.saveCurrentQuestionToNotes({...question,correct_index:raw});
  const note=ctx.state.userNotes.at(-1);
  assert(note.content.includes('Nenhuma alternativa foi validada.'));
  assert(!note.content.includes('Gabarito informado: A)'));
 }
 ctx.saveCurrentQuestionToNotes(question);
 assert(ctx.state.userNotes.at(-1).content.includes('Gabarito informado: B)'));
 ctx.cloudSession=null;
 const n=ctx.state.userNotes.length;assert.equal(ctx.saveCurrentQuestionToNotes(question),false);
 assert.equal(ctx.state.userNotes.length,n);
}
console.log('OK r182: ações de IA preservam pendências, opções, fonte e escopo; não fabricam gêmea offline nem pontuam sugestão.');
