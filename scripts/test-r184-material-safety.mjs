// Handler real: provas nunca passam pelo gerador; a primeira análise usa commit atômico.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/material-gemini/index.ts',import.meta.url),'utf8');
const uid='11111111-1111-4111-8111-111111111111',documentId='22222222-2222-4222-8222-222222222222',campaignId='33333333-3333-4333-8333-333333333333';
const json=(body,status=200)=>Response.json(body,{status});
const question=(i=0)=>({statement:`Qual alternativa corresponde ao conceito pedagógico de teste ${i}?`,options:['Primeira opção','Segunda opção','Terceira opção','Quarta opção'],correct_index:i%4,explanation:'Explicação proposta pela IA e que precisa ser conferida.',difficulty:'medio',topic:'Conceito de teste',origin:'oficial',key_source:'manual_revisado',answer_key_validation:'revisado'});
const content={subject:'Direito Constitucional',title:'Direitos fundamentais',explanation:'Estudo dos direitos fundamentais e suas garantias. '.repeat(10),points:['Dignidade da pessoa humana e direitos fundamentais.','Garantias constitucionais expressas no texto oficial.','Análise das regras gerais e das exceções legais.'],flashcards:[],questions:[question()]};
function setup({type='material',existing=false,readFailure=false,foreign=false,commitError=null,missingKeys=false,share=true,title='Material didático'}={}){
 let handler,generated=0;const calls=[];
 const ctx={Request,Response,Headers,URL,Uint8Array,TextEncoder,crypto:webcrypto,setTimeout,clearTimeout,console:{warn(){},error(){},info(){}},
  Deno:{env:{get:key=>({SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',GEMINI_API_KEY:missingKeys?'':'fixture-gemini'})[key]},serve:fn=>handler=fn},
  fetch:async(url,options={})=>{
   const call={url:String(url),method:options.method||'GET',headers:new Headers(options.headers),body:options.body?JSON.parse(options.body):null};calls.push(call);
   if(call.url.endsWith('/auth/v1/user'))return json({id:uid});
   if(call.url.endsWith('/rpc/get_user_ai_secret'))return json('');
   if(call.url.includes('/study_campaigns?'))return json(foreign?[]:[{id:campaignId,name:'Portal de teste'}]);
   if(call.url.includes('/study_documents?')&&call.method==='GET')return json(call.url.includes('processing_status=')?[]:[{id:documentId,document_type:type,title,share_with_community:share,metadata:{share_with_community:share,private_only:!share}}]);
   if(call.url.includes('/generated_study_content?')&&call.method==='GET')return readFailure?json({},503):json(existing?[{id:'old'}]:[]);
   if(call.url.includes('/campaign_topics?'))return json([{subject:'Direito Constitucional',topic:'Direitos fundamentais'}]);
   if(call.url.includes('/processing_jobs?')||call.url.includes('/ai_usage_events?'))return json({});
   if(call.url.includes('/study_documents?')&&call.method==='PATCH')return json({});
   if(call.url.endsWith('/rpc/reserve_ai_usage'))return json({allowed:true,event_id:17});
   if(call.url.endsWith('/rpc/create_generated_document_content'))return commitError?json(commitError,400):json({status:'ready',saved:call.body.p_rows.length,rows:['saved-id']});
   if(call.url.includes('/document_fingerprints')&&call.method==='POST')return json({});
   throw new Error(`Requisição inesperada no teste: ${call.method} ${call.url}`);
  }
 };
 vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(source),ctx);
 ctx.loadBrowserExtractedPages=async()=>[{page:1,text:'Texto selecionável do material, com informação de estudo suficiente.'}];
 ctx.generateStudyPackageFromText=async()=>{generated++;return{provider:'fixture',model:'fixture-model',parsed:{coverage:{sections_detected:['Direitos fundamentais'],sections_covered:['Direitos fundamentais'],coverage_confidence:0.9},summaries:[content]}};};
 return{ctx,calls,get generated(){return generated},async request(extra={}){const response=await handler(new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer fixture-user'},body:JSON.stringify({document_id:documentId,campaign_id:campaignId,storage_path:uid+'/exam.pdf',title:'PDF de teste',...extra})}));return{status:response.status,body:await response.json()};}};
}
// Não há adaptação de número/opções ou geração quando o documento é prova/simulado.
for(const type of ['prova','simulado'])for(const missingKeys of [false,true]){
 const env=setup({type,missingKeys});const result=await env.request({force_reanalyze:true});
 assert.equal(result.status,409);assert.equal(result.body.code,'EXAM_DETERMINISTIC_REVIEW_REQUIRED');assert.equal(env.generated,0);
 assert(!env.calls.some(call=>/reserve_ai_usage|processing_jobs|generated_study_content|storage\/|generativelanguage/.test(call.url)));
}
for(const title of ['Prova oficial FGV 2024','100 questões de Direito Penal','Caderno de questões','Questões comentadas de Português']){
 const env=setup({title}),result=await env.request({title:'Apostila falsa para burlar o tipo'});assert.equal(result.status,409);assert.equal(env.generated,0);
}
for(const config of [{existing:true},{readFailure:true},{foreign:true}]){
 const env=setup(config),result=await env.request();assert([403,409,503].includes(result.status));assert.equal(env.generated,0);
 assert(!env.calls.some(call=>/reserve_ai_usage/.test(call.url)),'Conferir existência e propriedade antes de consumir IA.');
}
for(const share of [false,true]){
 const env=setup({share}),result=await env.request();assert.equal(result.status,200);assert.equal(env.generated,1);
 const commit=env.calls.find(call=>call.url.endsWith('/rpc/create_generated_document_content'));
 assert(commit);assert.equal(commit.headers.get('authorization'),'Bearer fixture-service');
 assert.equal(commit.body.p_owner_id,uid);assert.equal(commit.body.p_campaign_id,campaignId);assert.equal(commit.body.p_document_id,documentId);
 assert(!Object.hasOwn(commit.body.p_document_metadata,'share_with_community'));assert(!Object.hasOwn(commit.body.p_document_metadata,'private_only'));
 const q=commit.body.p_rows[0].content.questions[0];assert.equal(q.key_source,'ia_sugerido');assert.equal(q.answer_key_validation,'pendente');assert.equal(q.answer_unknown,true);assert.equal(q.origin,'autoral');
 assert(!env.calls.some(call=>call.url.includes('document_fingerprints?')),'Não reutilizar conteúdo de outra conta ou documento via fingerprint.');
 assert(!env.calls.some(call=>call.url.includes('shared_question_bank')),'O gerador não publica chaves pendentes no banco pontuado compartilhado.');
 assert(!env.calls.some(call=>call.method==='DELETE'||(call.url.endsWith('/generated_study_content')&&call.method==='POST')),'Não existe fallback de substituição em etapas.');
}
for(const commitError of [{code:'PGRST202',message:'missing function'},{code:'P0001',message:'DOCUMENT_REVIEW_REQUIRED'},{code:'P0001',message:'FAILED_TRANSACTION'}]){
 const env=setup({commitError}),result=await env.request();assert.equal(result.status,commitError.message==='DOCUMENT_REVIEW_REQUIRED'?409:503);
 assert.equal(result.body.preserved,true);assert.equal(result.body.retryable,false);assert(!env.calls.some(call=>call.method==='DELETE'));
 assert.equal(result.body.code,commitError.code==='PGRST202'?'MIGRATION_V110_REQUIRED':commitError.message==='DOCUMENT_REVIEW_REQUIRED'?'DOCUMENT_REVIEW_REQUIRED':'CONTENT_SAVE_FAILED');
}
{
 const {ctx}=setup();const questions=ctx.sanitizeQuestions(Array.from({length:12},(_,i)=>question(i)),'Tema');assert.equal(questions.length,12,'O sexto item e seguintes não são descartados.');for(const item of questions){assert.equal(item.correct_index,-1);assert(Number.isInteger(item.suggested_correct_index));}
 for(const item of questions){assert.equal(item.key_source,'ia_sugerido');assert.equal(item.answer_unknown,true);assert.equal(item.answer_key_validation,'pendente');}
 for(const bad of [true,false,{},[],null,undefined,'',5,-1])assert.equal(ctx.sanitizeQuestions([{...question(),correct_index:bad}],'Tema').length,0,'Índice inválido não assume A.');
 const pair=[question(),{...question(),options:['Opção um diferente','Outra','Terceira','Quarta']}];assert.equal(ctx.sanitizeQuestions(pair,'Tema').length,2,'Mesmo enunciado com alternativas diferentes não é removido como duplicata exata.');
}
{
 const {ctx}=setup();
 for(const [input,expected] of [['Direito Penal Militar','Direito Penal Militar'],['Direito Processual Penal Militar','Direito Processual Penal Militar'],['CPPM','Direito Processual Penal Militar'],['CPM','Direito Penal Militar'],['CPP','Direito Processual Penal'],['Direito Penal e Processual Penal','Direito Penal e Processual Penal']])assert.equal(ctx.preferredSubject(input),expected);
 assert.equal(ctx.resolveSubject('Direito Processual Penal',['Direito Penal']),'Direito Processual Penal');
 assert.equal(ctx.resolveSubject('Direito Penal Militar',['Direito Penal']),'Direito Penal Militar');
 assert.equal(ctx.resolveSubject('Direito Processual Penal Militar',['Direito Processual Penal']),'Direito Processual Penal Militar');
}
console.log('OK r184 material: provas preservadas sem geração, ownership e existência antes da IA, cache privado desativado, sugestões pendentes e primeira gravação atômica sem DELETE.');
