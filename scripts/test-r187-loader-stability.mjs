// Execute both generated-content loaders and the document loader with memory
// transport/DOM counters. Equal cloud copies must not write or rebuild controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('dist/index.html'),v59=read('dist/v59-enhancements.js');
const block=(text,start,end)=>{const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b)};
const loaders=[['inline',block(html,'async function loadGeneratedContent(){','function renderSummaries(')],['effective-v59',block(v59,'  loadGeneratedContent=async function(){','  window.setSummaryApproval=')]];
const copy=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
const question=(id='q1')=>({id,subject:'Português',topic:'Concordância',statement:'Assinale a frase com concordância verbal correta. '+id,options:['Os alunos estudam.','Os alunos estuda.'],correct_index:0,key_source:'documento',explanation:'O sujeito concorda com o verbo.'});
const sourceRows=()=>[{id:'row1',source_document_id:'doc1',source_refs:[{document_id:'doc1',page:1}],approved:false,title:'Concordância verbal',content_type:'summary',content:{subject:'Português',source:'Português.pdf',explanation:'Explicação original.',points:['Uma regra.'],flashcards:[{question:'Como ocorre a concordância verbal?',answer:'O verbo concorda com o sujeito.'}],questions:[question()]}}];
function setup(code){
 const counts={save:0,persist:0,dirty:0,render:0,classify:0,migrate:0,dom:0,patch:0},messages=[],fields=new Map();
 const ctx={state:{_ownerUserId:'a',activeCampaignId:'portal-a',_resetEpoch:1,_dirty:false,done:{},customQuestionsByCampaign:{'portal-a':[question('local')]},customFlashcardsByCampaign:{'portal-a':[['Português','Qual é o cartão local?','A resposta local.']]},userNotes:[]},cloudSession:{user:{id:'a'},access_token:'token-a'},dbId:'db-a',rows:sourceRows(),
  ALL_SUMMARIES:[],ALL_FLASHCARDS:[],ALL_QUESTIONS:[],LEARNING_SUBJECTS:[],cloudDocuments:[{id:'doc1',title:'Português.pdf',document_type:'material',user_id:'a'}],selectedLearningSubject:'Português',libraryUI:{trailSubject:{},summaryFilter:{},cardFilter:{}},loadGeneratedContent:null,
  activeCampaign:()=>({id:ctx.state.activeCampaignId,dbId:ctx.dbId}),validSession:async()=>ctx.cloudSession,
  cloudFetch:async(_path,options={})=>{if(options.method==='PATCH')counts.patch++;return{ok:true,json:async()=>copy(ctx.rows)}},
  extractFlashcardsFromUserNotes:()=>ctx.state.userNotes.filter(n=>n.campaignId===ctx.state.activeCampaignId).map(n=>[n.subject,n.title,n.content]),
  canonicalSubjectName:value=>String(value||'Português'),subjectKey:value=>String(value||'').toLowerCase(),normalizeLegalTitle:value=>String(value||''),
  findSourceDocumentForContent:id=>ctx.cloudDocuments.find(doc=>doc.id===id),resolveDocumentDiscipline:(_doc,subject)=>subject||'Português',standardizeDocumentTitle:String,normalizeText:value=>String(value||'').toLowerCase(),
  isInvalidTrailSubject:value=>value==='invalid',isValidPedagogicalSummary:()=>true,isAllowedFlashcardRow:()=>true,isValidFlashcardItem:(front,back)=>Boolean(front&&back),isValidPedagogicalQuestion:()=>true,sanitizeSummaryObject:value=>value,cleanPedagogicalMnemonic:value=>String(value||''),
  classifyQuestion:item=>{counts.classify++;return{subject:item.subject,confidence:1}},questionFingerprint:item=>item.id||item.statement,
  computeValidLearningSubjects:()=>[...new Set([...ctx.ALL_SUMMARIES.map(s=>s.category),...ctx.ALL_FLASHCARDS.map(c=>c[0]),...ctx.ALL_QUESTIONS.map(q=>q.subject)])].sort(),migrateLearningSubjectKeys:()=>counts.migrate++,
  saveLibraryUI:()=>counts.save++,persistToLocalDatabase:()=>counts.persist++,markViewsDirty:()=>counts.dirty++,renderViewById:()=>counts.render++,renderStudy:()=>counts.render++,renderLearning:()=>counts.render++,renderQuestionFilters:()=>counts.render++,renderUserDocuments:()=>counts.render++,
  $:selector=>{if(!fields.has(selector)){let html='';fields.set(selector,{value:'all',get innerHTML(){return html},set innerHTML(value){counts.dom++;html=value}})}return fields.get(selector)},esc:String,shortOptionLabel:String,
  document:{querySelector:()=>({id:'report'})},console:{warn:error=>messages.push(String(error))},toast:message=>messages.push(message),_activeProcessingDocs:new Set(),isEditalDocumentOrTitle:()=>false,databaseSetupMessage:String,
 };ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,counts,messages,fields};
}
const contentKeys=['ALL_SUMMARIES','ALL_FLASHCARDS','ALL_QUESTIONS','LEARNING_SUBJECTS'];
for(const[name,code]of loaders){
 const h=setup(code),{ctx,counts,messages}=h;await ctx.loadGeneratedContent();assert.deepEqual(messages,[],name);
 assert.equal(ctx.ALL_QUESTIONS.length,2);assert.equal(ctx.ALL_FLASHCARDS.length,2,name+' retains local cards');
 const first={...counts};h.fields.get('#summaryFilter').value='Português';
 // Equal detached response/local/active arrays do not change any references,
 // filters, dirty state, persistence counters or classifier work.
 for(let i=0;i<5;i++){
  ctx.rows=copy(ctx.rows);ctx.cloudDocuments=copy(ctx.cloudDocuments);ctx.state.customQuestionsByCampaign=copy(ctx.state.customQuestionsByCampaign);ctx.state.customFlashcardsByCampaign=copy(ctx.state.customFlashcardsByCampaign);
  for(const key of contentKeys)ctx[key]=copy(ctx[key]).reverse();const refs=contentKeys.map(key=>ctx[key]);
  assert.equal(await ctx.loadGeneratedContent(),false,name+' equal source');for(const[key,index]of contentKeys.map((key,index)=>[key,index]))assert.equal(ctx[key],refs[index],name+' retains '+key);
 }
 assert.deepEqual(counts,first,name+' equal content cannot dirty, save or render');assert.equal(h.fields.get('#summaryFilter').value,'Português');assert.equal(ctx.state._dirty,false);
 // A user's answer/review and progression are not erased by equal sources.
 const current=ctx.ALL_QUESTIONS.find(q=>q.id==='q1');current._userChosenIndex=1;current._userAnswered=true;current.correct_index=1;current.key_source='manual_revisado';ctx.state.done.lesson='completed';
 await ctx.loadGeneratedContent();assert.equal(ctx.ALL_QUESTIONS.find(q=>q.id==='q1'),current);assert.equal(current.key_source,'manual_revisado');assert.equal(ctx.state.done.lesson,'completed');assert.deepEqual(counts,first);
 // Same counts still carry real changed body/key/approval/reference semantics.
 ctx.rows[0].content.explanation='Corpo corrigido.';await ctx.loadGeneratedContent();assert.equal(ctx.ALL_SUMMARIES[0].explanation,'Corpo corrigido.');assert(counts.save>first.save);
 ctx.rows[0].content.questions[0].correct_index=1;await ctx.loadGeneratedContent();assert.equal(ctx.ALL_QUESTIONS.find(q=>q.id==='q1').correct_index,1);
 ctx.rows[0].approved=true;await ctx.loadGeneratedContent();assert.equal(ctx.ALL_SUMMARIES[0].approved,true,name+' approval');
 ctx.rows[0].source_refs[0].page=9;await ctx.loadGeneratedContent();assert.equal(ctx.ALL_QUESTIONS.find(q=>q.id==='q1').source_refs[0].page,9);
 // In-place edits of an already merged local question/card must refresh, too.
 const beforeLocal=counts.save;ctx.state.customQuestionsByCampaign['portal-a'][0].explanation='Minha correção local.';ctx.state.customFlashcardsByCampaign['portal-a'][0][2]='Resposta local corrigida.';
 await ctx.loadGeneratedContent();assert.equal(ctx.ALL_QUESTIONS.find(q=>q.id==='local').explanation,'Minha correção local.');assert(ctx.ALL_FLASHCARDS.some(c=>c[2]==='Resposta local corrigida.'));assert(counts.save>beforeLocal,name+' local edits count');
 ctx.state.userNotes.push({campaignId:'portal-a',subject:'Português',title:'Como estudar concordância?',content:'Observe o núcleo do sujeito.'});await ctx.loadGeneratedContent();assert(ctx.ALL_FLASHCARDS.some(c=>c[1]==='Como estudar concordância?'));
 // Retained community content participates in the source snapshot and survives
 // an actual private-source refresh without a remove/re-add cycle.
 ctx.ALL_SUMMARIES.push({id:'community-summary',is_community:true,category:'Português',title:'Resumo compartilhado',explanation:'Corpo compartilhado.'});
 ctx.ALL_FLASHCARDS.push(['Português','Cartão da comunidade?','Resposta compartilhada.',{is_community:true,communityRecordId:'card-c'}]);
 ctx.ALL_QUESTIONS.push({...question('community-q'),is_community:true});await ctx.loadGeneratedContent();assert(ctx.ALL_SUMMARIES.some(s=>s.id==='community-summary'));assert(ctx.ALL_FLASHCARDS.some(c=>c[3]?.communityRecordId==='card-c'));assert(ctx.ALL_QUESTIONS.some(q=>q.id==='community-q'));
 const stable={...counts};await ctx.loadGeneratedContent();assert.deepEqual(counts,stable,name+' retained community settles');
 // Receipt metadata tracks the remote source/scoped import, not study content.
 // Updating a receipt after an already preserved human review must stay quiet.
 ctx.ALL_SUMMARIES.find(s=>s.id==='community-summary').communitySourceSignature='new-summary-receipt';
 ctx.ALL_QUESTIONS.find(q=>q.id==='community-q').communitySourceSignature='new-question-receipt';
 ctx.ALL_QUESTIONS.find(q=>q.id==='community-q').communitySourceScopeKey='new-question-scope-receipt';
 Object.assign(ctx.ALL_FLASHCARDS.find(c=>c[3]?.communityRecordId==='card-c')[3],{communitySourceSignature:'new-card-receipt',communitySourceScopeKey:'new-card-scope-receipt'});
 await ctx.loadGeneratedContent();assert.deepEqual(counts,stable,name+' receipt-only updates cannot dirty, write or render');
 // A classifier/auditor loaded after the initial source snapshot must still
 // apply real repairs even when the remote rows have not changed.
 ctx.auditAndEnrichAllQuestionsPedagogy=items=>{for(const item of items)item.quality_status='reviewed-current-pipeline'};
 await ctx.loadGeneratedContent();assert(ctx.ALL_QUESTIONS.every(item=>item.quality_status==='reviewed-current-pipeline'));assert(counts.save>stable.save,name+' late pipeline repairs apply');
 // Every dimension invalidates the cache even when the cloud rows are equal.
 for(const change of ['db','portal','reset','owner']){
  const before=counts.classify;if(change==='db')ctx.dbId+='-next';if(change==='portal')ctx.state.activeCampaignId+='-next';if(change==='reset')ctx.state._resetEpoch++;if(change==='owner'){ctx.cloudSession={user:{id:'b'},access_token:'token-b'};ctx.state._ownerUserId='b'}
  await ctx.loadGeneratedContent();assert(counts.classify>before,name+' cache scope '+change);
 }
 assert.deepEqual(messages,[],name+' no swallowed errors');
 {
  const e=setup(code);e.ctx.rows.push({id:'empty-pack',content_type:'question_pack',content:{questions:[]}});await e.ctx.loadGeneratedContent();const before={...e.counts};e.ctx.rows=copy(e.ctx.rows).reverse();await e.ctx.loadGeneratedContent();assert.deepEqual(e.counts,before,name+' source ordering is semantic no-op');
 }
 {
  const e=setup(code);e.ctx.cloudSession=null;e.ctx.dbId=null;await e.ctx.loadGeneratedContent();const before={...e.counts},refs=contentKeys.map(key=>e.ctx[key]);assert.equal(await e.ctx.loadGeneratedContent(),false);assert.deepEqual(e.counts,before,name+' offline equal inputs settle');contentKeys.forEach((key,index)=>assert.equal(e.ctx[key],refs[index]));assert(e.ctx.ALL_QUESTIONS.some(q=>q.id==='local'));assert(e.ctx.ALL_FLASHCARDS.some(c=>c[1]==='Qual é o cartão local?'));
 }
 // Data edited while awaiting the network is read after the await.
 {
  const e=setup(code),pending=deferred();e.ctx.cloudFetch=async()=>({ok:true,json:()=>pending.promise});const task=e.ctx.loadGeneratedContent();await tick();e.ctx.state.userNotes.push({campaignId:'portal-a',subject:'Português',title:'Nota criada durante a leitura?',content:'Permanece disponível.'});pending.resolve(sourceRows());await task;assert(e.ctx.ALL_FLASHCARDS.some(c=>c[1]==='Nota criada durante a leitura?'));
 }
 for(const stage of ['fetch','json'])for(const change of ['owner','portal','db','reset']){
  const e=setup(code),pending=deferred();e.ctx.cloudFetch=()=>stage==='fetch'?pending.promise:Promise.resolve({ok:true,json:()=>pending.promise});const refs=contentKeys.map(key=>e.ctx[key]);const task=e.ctx.loadGeneratedContent();await tick();
  if(change==='owner'){e.ctx.cloudSession={user:{id:'b'}};e.ctx.state._ownerUserId='b'}if(change==='portal')e.ctx.state.activeCampaignId='portal-b';if(change==='db')e.ctx.dbId='db-b';if(change==='reset')e.ctx.state._resetEpoch++;
  pending.resolve(stage==='fetch'?{ok:true,json:async()=>sourceRows()}:sourceRows());assert.equal(await task,false,name+' stale '+stage+'/'+change);contentKeys.forEach((key,index)=>assert.equal(e.ctx[key],refs[index]));assert.equal(e.counts.render,0);assert.equal(e.counts.save,0);assert.equal(e.counts.persist,0);
 }
}
const documents=block(html,'async function loadCloudDocuments(){','async function loadEssays(){');
{
 const h=setup(documents),{ctx,counts}=h;ctx.rows=[{id:'doc1',title:'Português.pdf',document_type:'material',user_id:'a',metadata:{revision:1}}];await ctx.loadCloudDocuments();
 const refs=ctx.cloudDocuments,first={...counts};ctx.rows=copy(ctx.rows);assert.equal(await ctx.loadCloudDocuments(),false);assert.equal(ctx.cloudDocuments,refs);assert.deepEqual(counts,first);
 ctx.rows[0].metadata.revision=2;assert.equal(await ctx.loadCloudDocuments(),true);assert.equal(ctx.cloudDocuments[0].metadata.revision,2);
 // Repair a stalled processing record once, then let the source cache settle.
 ctx.rows[0].processing_status='processing';ctx.rows[0].created_at='2000-01-01';await ctx.loadCloudDocuments();const repaired={...counts};await ctx.loadCloudDocuments();assert.equal(counts.patch,1);assert.deepEqual(counts,repaired);
}
for(const change of ['owner','portal','db','reset'])for(const stage of ['fetch','json']){
 const h=setup(documents),{ctx,counts}=h,pending=deferred();ctx.cloudFetch=()=>stage==='fetch'?pending.promise:Promise.resolve({ok:true,json:()=>pending.promise});const refs=ctx.cloudDocuments,task=ctx.loadCloudDocuments();await tick();
 if(change==='owner'){ctx.cloudSession={user:{id:'b'}};ctx.state._ownerUserId='b'}if(change==='portal')ctx.state.activeCampaignId='portal-b';if(change==='db')ctx.dbId='db-b';if(change==='reset')ctx.state._resetEpoch++;
 pending.resolve(stage==='fetch'?{ok:true,json:async()=>[]}:[]);assert.equal(await task,false);assert.equal(ctx.cloudDocuments,refs);assert.equal(counts.render,0);
}
console.log('OK r187 loaders: equal sources preserve references/filters without writes; real keys/body/approval/refs/local/community edits refresh; all scope dimensions and late responses are isolated.');
