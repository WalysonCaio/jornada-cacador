import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const code=section('  function answerKeyStatus(','  function classifyQuestion(')+section('  function examDocumentScopeAllows(','  function renderExamBankHub(){')+section('  async function solveQuestionsArrayWithAi(','  // ── 3) Integração Completa com Goodnotes');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const question=()=>({statement:'Qual alternativa corresponde ao conceito apresentado?',options:['Primeira alternativa','Segunda alternativa'],correct_index:-1,answer_unknown:true,origin:'adaptada_do_pdf'});
function fixture(stage='none'){
 const pending=deferred(),calls=[],messages=[],rendered=[];
 const doc={id:'d1',documentDbId:'old-d1',user_id:'a',campaign_id:'db-a',title:'Prova original',metadata:{coverage:{warnings:['Sem gabarito.']}}};
 const row={id:'r1',user_id:'a',campaign_id:'db-a',source_refs:[{document_id:'old-d1'}],content:{questions:[question()]}};
 const button={disabled:false,dataset:{solveAiKeyDoc:'d1'},textContent:'Resolver'};
 const response={ok:true,json:async()=>({solved:[{index:0,correct_index:1,explanation:'Sugestão pendente da IA para conferência.'}]})};
 const ctx={window:{},state:{_ownerUserId:'a',activeCampaignId:'p-a',_resetEpoch:0},cloudSession:{user:{id:'a'},access_token:'token-a'},navigator:{onLine:true},
  activeCampaign:()=>({id:ctx.state.activeCampaignId,dbId:ctx.state.activeCampaignId==='p-a'?'db-a':'db-b'}),
  cloudDocuments:[doc],ALL_QUESTIONS:[],document:{querySelectorAll:()=>[button]},SUPABASE_URL:'https://fixture.test',authHeaders:token=>({Authorization:`Bearer ${token}`}),
  validSession:async()=>stage==='session'?pending.promise:{user:{id:'a'},access_token:'token-a'},
  toast:m=>messages.push(m),render:()=>rendered.push('render'),renderExamBankHub:()=>rendered.push('hub'),save:()=>rendered.push('save'),loadGeneratedContent:async()=>{},loadCloudDocuments:async()=>{},
  cloudFetch:async(path,options={})=>{
   calls.push({path,options});
   if(options.method==='PATCH'){
    if(stage==='patch'&&path.startsWith('generated_study_content?'))return pending.promise;
    if(stage==='metadata'&&path.startsWith('study_documents?'))return pending.promise;
    return{ok:true};
   }
   if(stage==='rows')return pending.promise;
   return{ok:true,json:async()=>stage==='rows-json'?pending.promise:[row]};
  },
  fetch:async()=>stage==='ai'?pending.promise:stage==='ai-json'?{ok:true,json:()=>pending.promise}:response,
 };
 ctx.window.persistToLocalDatabase=async()=>{};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,doc,row,button,pending,calls,messages,rendered,response};
}
for(const stage of ['session','rows','rows-json','ai','ai-json','patch','metadata'])for(const change of ['owner','portal','reset','logout']){
 const f=fixture(stage),task=f.ctx.solveMissingAnswerKeyWithAi('d1');await tick();
 const writes=f.calls.filter(c=>c.options.method==='PATCH').length,messages=f.messages.length;
 if(change==='owner'){f.ctx.cloudSession={user:{id:'b'},access_token:'token-b'};f.ctx.state._ownerUserId='b'}
 if(change==='portal')f.ctx.state.activeCampaignId='p-b';
 if(change==='reset')f.ctx.state._resetEpoch++;
 if(change==='logout')f.ctx.cloudSession=null;
 const result=stage==='session'?{user:{id:'a'},access_token:'token-a'}:stage==='rows'?{ok:true,json:async()=>[f.row]}:stage==='rows-json'?[f.row]:stage==='ai'?f.response:stage==='ai-json'?await f.response.json():{ok:true};
 f.pending.resolve(result);await task;
 assert.equal(f.calls.filter(c=>c.options.method==='PATCH').length,writes,`${stage}/${change}: no writes after context change`);
 assert.equal(f.messages.length,messages,`${stage}/${change}: no stale toast`);
 assert.deepEqual(f.rendered,[],`${stage}/${change}: no stale render/save`);
 assert.equal(f.row.content.questions[0].correct_index,-1,'Detached source row remains unchanged');
 assert.equal(f.doc.metadata.coverage.ai_keyed_count,undefined,'Stale metadata is not published locally');
}
{
 const f=fixture();await f.ctx.solveMissingAnswerKeyWithAi('d1');
 const reads=f.calls.filter(c=>!c.options.method);
 assert.equal(reads.length,4,'Read original ID and explicit legacy ID, in columns and source_refs');
 assert(reads.every(c=>c.path.includes('user_id=eq.a')&&c.path.includes('campaign_id=eq.db-a')));
 const writes=f.calls.filter(c=>c.options.method==='PATCH');assert.equal(writes.length,2);
 assert(writes.every(c=>c.path.includes('user_id=eq.a')&&c.options.headers.Authorization==='Bearer token-a'));
 const saved=JSON.parse(writes[0].options.body).content.questions[0];assert.equal(saved.correct_index,1);assert.equal(saved.key_source,'ia_sugerido');assert.equal(saved.answer_key_validation,'pendente');
 assert.equal(f.ctx.answerKeyStatus(saved),'sem_gabarito');assert.equal(f.doc.metadata.coverage.ai_keyed_count,1);
 assert.equal(f.button.disabled,false);
}
// An explicit human key added while the model is working wins over the stale AI suggestion.
for(const changed of ['manual-key','statement','options']){
 const f=fixture('ai'),item=question(),task=f.ctx.solveQuestionsArrayWithAi([item],f.doc);await tick();
 if(changed==='manual-key'){item.correct_index=0;delete item.answer_unknown;item.key_source='manual';item.answer_key_validation='revisado'}
 if(changed==='statement')item.statement+=' Nova versão';
 if(changed==='options')item.options=['Nova primeira','Nova segunda'];
 const expected=JSON.stringify(item);f.pending.resolve(f.response);assert.equal(await task,0);assert.equal(JSON.stringify(item),expected,changed);
}
{
 const f=fixture();f.doc.is_community=true;f.doc.user_id='b';f.doc.campaign_id='db-b';await f.ctx.solveMissingAnswerKeyWithAi('d1');
 assert.equal(f.calls.length,0);assert(f.messages[0].includes('própria cópia'));
}
console.log('OK r186: gabarito IA respeita conta/portal/reset/logout em sete estágios, origem explícita, token capturado, chave humana e versões de texto/opções.');
