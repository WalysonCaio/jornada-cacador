// Exercise the shipped community synchronizer, realignment and loader wrappers.
// Deterministic in-memory responses only: no browser, network or private data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/v77-experience.js',import.meta.url),'utf8');
function slice(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b)}
const community=slice('  let communityCache=','  function applyCommunityEditalToPortal(');
const alignment=slice('  let studyDisciplineAlignmentCache=','  // 19. Chat Interno da Guilda');
const copy=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
function fixture(){
 const counts={persist:0,dirty:0,report:0,library:0,banner:0,badge:0,enhance:0,save:0,push:0,pull:0,build:0};
 const campaign={id:'portal-a',dbId:'db-a',name:'Portal A',organization:'Org'};
 const payload={exam_slug:'universal',documents:[{id:'doc-1',title:'Gramática',document_type:'material',detected_subject:'Português',created_at:'2026-01-01'}],summaries:[{id:'row-1',source_document_id:'doc-1',title:'Crase',content_type:'summary',source_refs:[{type:'document',id:'doc-1'}],content:{subject:'Português',source:'Gramática',explanation:'Regra inicial.',points:['Ponto inicial.'],flashcards:[{id:'card-1',question:'Quando se usa a crase?',answer:'Na fusão da preposição com o artigo.'}],questions:[{id:'question-1',subject:'Português',topic:'Crase',statement:'Assinale a frase que emprega a crase corretamente.',options:['Vou à escola.','Vou a escola.'],correct_index:0,key_source:'oficial',answer_key_validation:'oficial',explanation:'Há preposição e artigo.'}]}}]};
 const ctx={console,state:{activeCampaignId:'portal-a',_ownerUserId:'owner-a',_resetEpoch:0,flashProgress:{f1:{reviews:2}},errors:{mission:{misses:1}},questionAnswerOverrides:{}},cloudSession:{user:{id:'owner-a'},access_token:'token-a'},cloudDocuments:[],ALL_SUMMARIES:[],ALL_FLASHCARDS:[],ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],
  activeCampaign:()=>campaign,document:{querySelector:()=>({id:ctx.activeView})},activeView:'report',
  topicKey:value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
  canonicalSubjectName:value=>value,
  resolveStrictQuestionDiscipline:(statement,topic,subject)=>typeof statement==='object'?statement.subject:subject,
  normalizeExamSlug:(name,org)=>name+'|'+org,
  buildExamQuestionDocumentMap(docs,questions){counts.build++;return new Map(questions.map(item=>[item,docs.find(doc=>String(doc.id)===String(item.documentId))]));},
  resolveDocumentDiscipline:(doc,fallback)=>doc?.detected_subject||fallback||'Português',
  isInvalidTrailSubject:subject=>subject==='Inválida',isValidFlashcardItem:(front,back)=>Boolean(front&&back),
  computeValidLearningSubjects:()=>[...new Set([...ctx.ALL_SUMMARIES.map(x=>x.category),...ctx.ALL_FLASHCARDS.map(x=>x[0]),...ctx.ALL_QUESTIONS.map(x=>x.subject)])].sort(),
  validSession:async()=>copy(ctx.cloudSession),authHeaders:token=>({Authorization:'Bearer '+token}),
  async cloudFetch(path,options={}){counts.pull++;if(!['GET','POST'].includes(options.method||'GET'))counts.push++;if(ctx.fetchHook)return ctx.fetchHook(path,options);return {ok:true,json:async()=>copy(path.startsWith('rpc/')?payload:[])};},
  persistToLocalDatabase(){counts.persist++},markViewsDirty(){counts.dirty++},save(){counts.save++},
  renderReport(){counts.report++},renderUserDocuments(){counts.library++},renderStudy(){},renderLearning(){},renderQuestionFilters(){throw new Error('must refresh through the mounted workspace')},
  renderCommunityCoopBanner(){counts.banner++},updateLocalDbBadgeUI(){counts.badge++},enhanceSoloLevelingVisuals(){counts.enhance++},
  JCQuestionsWorkspace:{request(){counts.report++}},
  loadCloudDocuments:async(...args)=>{ctx.documentArgs=args;return ctx.baseDocumentHook?ctx.baseDocumentHook():true},
  loadGeneratedContent:async(...args)=>{ctx.generatedArgs=args;return ctx.baseGeneratedHook?ctx.baseGeneratedHook():true}
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(community+'\n'+alignment,ctx);
 return {ctx,counts,campaign,payload,run:code=>vm.runInContext(code,ctx)};
}
const stableCounts=counts=>({persist:counts.persist,dirty:counts.dirty,report:counts.report,library:counts.library,banner:counts.banner,badge:counts.badge,enhance:counts.enhance,save:counts.save,push:counts.push});
{
 const {ctx,counts,payload,run}=fixture();
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(),true);
 assert.equal(counts.persist,1);assert.equal(counts.dirty,1);assert.equal(counts.report,1);assert.equal(counts.pull,3);
 assert.equal(ctx.ALL_SUMMARIES.length,1);assert.equal(ctx.ALL_FLASHCARDS.length,1);assert.equal(ctx.ALL_QUESTIONS.length,1);
 const originalQuestion=ctx.ALL_QUESTIONS[0],progress=ctx.state.flashProgress,errors=ctx.state.errors;
 originalQuestion._userAnswered=true;originalQuestion._userChosenIndex=1;originalQuestion._fp='derived';
 originalQuestion.correct_index=1;originalQuestion.key_source='manual_revisado';originalQuestion.answer_key_validation='revisado';originalQuestion.key_reference='Local review';
 ctx.cloudDocuments[0].localDisplayFlag='derived';ctx.ALL_SUMMARIES[0].approved=true;
 const before=stableCounts(counts);
 for(let i=0;i<5;i++){
  ctx.activeView=i%2?'library':'report';
  ctx.cloudDocuments=copy(ctx.cloudDocuments);ctx.ALL_SUMMARIES=copy(ctx.ALL_SUMMARIES);ctx.ALL_FLASHCARDS=copy(ctx.ALL_FLASHCARDS);ctx.ALL_QUESTIONS=copy(ctx.ALL_QUESTIONS);
  assert.equal(await ctx.syncCommunityLibraryForActivePortal(i%2===0),false,'equal remote copies are a semantic no-op');
 }
 assert.deepEqual(stableCounts(counts),before,'no equal refresh may persist, dirty, rebuild banner, render or save progress');
 assert.equal(ctx.ALL_QUESTIONS[0].correct_index,1);assert.equal(ctx.ALL_QUESTIONS[0]._userChosenIndex,1);assert.equal(ctx.ALL_SUMMARIES[0].approved,true);
 // A remote key change already covered by the learner's review changes only
 // the source receipt, so it must not count as new displayed study content.
 payload.summaries[0].content.questions[0].correct_index=1;
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(true),false);
 assert.deepEqual(stableCounts(counts),before);
 // Actual content changes update the existing records, including same-size lists.
 payload.summaries[0].content.explanation='Regra revista.';
 payload.summaries[0].content.flashcards[0].answer='Resposta revisada sem mudar a frente.';
 payload.summaries[0].content.questions[0].explanation='Explicação revisada.';
 payload.documents[0].title='Gramática revista';ctx.activeView='report';
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(true),true);
 assert.equal(counts.persist,before.persist+1);assert.equal(counts.dirty,before.dirty+1);assert.equal(counts.report,before.report+1);
 assert.equal(ctx.ALL_SUMMARIES.length,1);assert.equal(ctx.ALL_SUMMARIES[0].explanation,'Regra revista.');
 assert.equal(ctx.ALL_FLASHCARDS.length,1);assert.equal(ctx.ALL_FLASHCARDS[0][2],'Resposta revisada sem mudar a frente.');
 assert.equal(ctx.ALL_QUESTIONS.length,1);assert.equal(ctx.ALL_QUESTIONS[0].explanation,'Explicação revisada.');
 assert.equal(ctx.ALL_QUESTIONS[0].correct_index,1);assert.equal(ctx.ALL_QUESTIONS[0].key_reference,'Local review');assert.equal(ctx.ALL_QUESTIONS[0]._userChosenIndex,1);
 assert.equal(ctx.state.flashProgress,progress);assert.equal(ctx.state.errors,errors);assert.equal(counts.save,0);assert.equal(counts.push,0);
 // Row context is part of the question source even when qObj itself is equal.
 payload.summaries[0].source_refs.push({type:'document',id:'evidence-2'});
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(true),true);
 assert(ctx.ALL_QUESTIONS[0].source_refs.some(ref=>ref.id==='evidence-2'));
 const after=stableCounts(counts);assert.equal(await ctx.syncCommunityLibraryForActivePortal(true),false);assert.deepEqual(stableCounts(counts),after);
 // No-op realignment keeps existing array objects, including after equal copies.
 assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);
 const buildCount=counts.build,refs=[ctx.ALL_SUMMARIES,ctx.ALL_FLASHCARDS,ctx.ALL_QUESTIONS];
 assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);assert.equal(counts.build,buildCount);assert.equal(ctx.ALL_SUMMARIES,refs[0]);assert.equal(ctx.ALL_FLASHCARDS,refs[1]);assert.equal(ctx.ALL_QUESTIONS,refs[2]);
 ctx.ALL_QUESTIONS=copy(ctx.ALL_QUESTIONS);ctx.cloudDocuments=copy(ctx.cloudDocuments);ctx.ALL_QUESTIONS[0]._userChosenIndex=0;
 assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);assert.equal(counts.build,buildCount);assert.equal(ctx.ALL_QUESTIONS[0]._userChosenIndex,0);
 // Source normalization changes once, and then equal regenerated arrays are quiet.
 const alignmentBefore=stableCounts(counts);ctx.cloudDocuments[0].detected_subject='Direito Constitucional';
 assert.equal(run('realignStudyDisciplinesWithLibrary()'),true);assert.equal(ctx.ALL_SUMMARIES[0].category,'Direito Constitucional');
 assert.equal(counts.persist,alignmentBefore.persist+1);assert.equal(counts.report,alignmentBefore.report+1);
 ctx.ALL_SUMMARIES=copy(ctx.ALL_SUMMARIES);ctx.ALL_FLASHCARDS=copy(ctx.ALL_FLASHCARDS);ctx.ALL_QUESTIONS=copy(ctx.ALL_QUESTIONS);
 const aligned=stableCounts(counts);assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);assert.deepEqual(stableCounts(counts),aligned);
 ctx.ALL_SUMMARIES.push({id:'bad',category:'Inválida',title:'Ruído'});assert.equal(run('realignStudyDisciplinesWithLibrary()'),false,'returning to an already applied normalized result stays quiet');assert.equal(ctx.ALL_SUMMARIES.length,1);
 // Wrappers retain arguments and do not trigger persistence on equal loads.
 assert.equal(await ctx.loadCloudDocuments('quiet'),true);assert.deepEqual(ctx.documentArgs,['quiet']);
 assert.equal(await ctx.loadGeneratedContent({quiet:true}),true);assert.deepEqual(ctx.generatedArgs,[{quiet:true}]);
 assert.equal(counts.save,0);assert.equal(counts.push,0);
}
// Identical source payloads are re-fetched after each scope boundary. Pending
// requests cannot import their old owner's content or schedule follow-up work.
for(const boundary of ['owner','portal','dbId','reset']){
 const {ctx,counts,campaign}=fixture();
 await ctx.syncCommunityLibraryForActivePortal();const before=counts.pull;
 if(boundary==='owner'){ctx.cloudSession={user:{id:'owner-b'},access_token:'token-b'};ctx.state._ownerUserId='owner-b'}
 if(boundary==='portal')ctx.state.activeCampaignId='portal-b';
 if(boundary==='dbId')campaign.dbId='db-b';
 if(boundary==='reset')ctx.state._resetEpoch++;
 ctx.cloudDocuments=[];ctx.ALL_SUMMARIES=[];ctx.ALL_FLASHCARDS=[];ctx.ALL_QUESTIONS=[];
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(),true,boundary);assert.equal(counts.pull,before+3,boundary+' invalidates universal cache');
}
// Per-item source receipts also carry their scope: retaining a public row in
// memory cannot carry a different account/portal's local answer or review.
for(const boundary of ['owner','portal','dbId','reset']){
 const {ctx,campaign}=fixture();await ctx.syncCommunityLibraryForActivePortal();
 ctx.ALL_QUESTIONS[0]._userAnswered=true;ctx.ALL_QUESTIONS[0]._userChosenIndex=1;
 ctx.ALL_QUESTIONS[0].correct_index=1;ctx.ALL_QUESTIONS[0].key_source='manual_revisado';ctx.ALL_QUESTIONS[0].answer_key_validation='revisado';
 ctx.ALL_SUMMARIES[0].approved=true;
 if(boundary==='owner'){ctx.cloudSession={user:{id:'owner-b'},access_token:'token-b'};ctx.state._ownerUserId='owner-b'}
 if(boundary==='portal')ctx.state.activeCampaignId='portal-b';
 if(boundary==='dbId')campaign.dbId='db-b';
 if(boundary==='reset')ctx.state._resetEpoch++;
 assert.equal(await ctx.syncCommunityLibraryForActivePortal(),true,boundary);
 assert.equal(ctx.ALL_QUESTIONS[0].correct_index,0,boundary);assert.equal(ctx.ALL_QUESTIONS[0]._userAnswered,undefined,boundary);assert.equal(ctx.ALL_QUESTIONS[0]._userChosenIndex,undefined,boundary);assert.equal(ctx.ALL_SUMMARIES[0].approved,undefined,boundary);
}
for(const boundary of ['owner','portal','dbId','reset']){
 const {ctx,counts,campaign,payload}=fixture(),pending=deferred();
 ctx.fetchHook=async path=>path.startsWith('rpc/')?pending.promise:{ok:true,json:async()=>[]};
 const a=ctx.syncCommunityLibraryForActivePortal(),b=ctx.syncCommunityLibraryForActivePortal();
 await new Promise(setImmediate);assert.equal(counts.pull,1,'same-scope requests are in flight together');
 if(boundary==='owner'){ctx.cloudSession={user:{id:'owner-b'},access_token:'token-b'};ctx.state._ownerUserId='owner-b'}
 if(boundary==='portal')ctx.state.activeCampaignId='portal-b';
 if(boundary==='dbId')campaign.dbId='db-b';
 if(boundary==='reset')ctx.state._resetEpoch++;
 pending.resolve({ok:true,json:async()=>copy(payload)});
 assert.equal(await a,false);assert.equal(await b,false);assert.equal(ctx.cloudDocuments.length,0,boundary);assert.equal(counts.persist,0,boundary);assert.equal(counts.pull,1,boundary+' prevents follow-up fetches');
}
// A newer forced refresh supersedes the older response even in the same scope.
{
 const {ctx,counts,payload}=fixture(),old=deferred(),newer=deferred();let rpc=0;
 ctx.fetchHook=async path=>path.startsWith('rpc/')?(++rpc===1?old.promise:newer.promise):{ok:true,json:async()=>[]};
 const first=ctx.syncCommunityLibraryForActivePortal();await new Promise(setImmediate);
 const latest=ctx.syncCommunityLibraryForActivePortal(true);await new Promise(setImmediate);
 const changed=copy(payload);changed.documents[0].title='Most recent';newer.resolve({ok:true,json:async()=>changed});assert.equal(await latest,true);
 old.resolve({ok:true,json:async()=>copy(payload)});assert.equal(await first,false);assert.equal(ctx.cloudDocuments[0].title,'MOST RECENT');assert.equal(counts.persist,1);
}
// Realignment's normalized result is scoped too, even when the content is equal.
for(const boundary of ['owner','portal','dbId','reset']){
 const {ctx,counts,campaign,run}=fixture();run('realignStudyDisciplinesWithLibrary()');const before=counts.build;
 if(boundary==='owner'){ctx.cloudSession={user:{id:'owner-b'},access_token:'token-b'};ctx.state._ownerUserId='owner-b'}
 if(boundary==='portal')ctx.state.activeCampaignId='portal-b';
 if(boundary==='dbId')campaign.dbId='db-b';
 if(boundary==='reset')ctx.state._resetEpoch++;
 assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);assert.equal(counts.build,before+1,boundary+' invalidates normalized source cache');
}
// The wrapper cannot continue old-scope work after its underlying async loader.
for(const loader of ['loadCloudDocuments','loadGeneratedContent']){
 const {ctx,counts}=fixture(),pending=deferred();ctx[loader==='loadCloudDocuments'?'baseDocumentHook':'baseGeneratedHook']=()=>pending.promise;
 const task=ctx[loader]();ctx.state._resetEpoch++;pending.resolve(true);
 assert.equal(await task,false);assert.equal(counts.pull,0);assert.equal(counts.build,0);assert.equal(counts.persist,0);
}
// A scope change during the wrapper's community request also cancels realignment.
for(const loader of ['loadCloudDocuments','loadGeneratedContent']){
 const {ctx,counts,payload}=fixture(),pending=deferred();
 ctx.fetchHook=async()=>pending.promise;const task=ctx[loader]();await new Promise(setImmediate);
 assert.equal(counts.pull,1);ctx.state._resetEpoch++;pending.resolve({ok:true,json:async()=>copy(payload)});
 assert.equal(await task,false);assert.equal(counts.build,0);assert.equal(counts.persist,0);
}
{
 const {ctx,counts,run}=fixture();ctx.state._ownerUserId='unmatched-owner';assert.equal(await ctx.syncCommunityLibraryForActivePortal(),false);assert.equal(run('realignStudyDisciplinesWithLibrary()'),false);assert.equal(counts.pull,0);assert.equal(counts.build,0);
}
console.log('OK r187 content sync: semantic no-ops, real updates, learner progress, owner/portal/db/reset scope, in-flight and stale loader guards.');
