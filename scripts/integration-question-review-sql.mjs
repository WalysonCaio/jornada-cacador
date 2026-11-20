// Migração real em PostgreSQL isolado: não acessa Supabase ou PDFs remotos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
create role authenticated;create role anon;create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
create table study_campaigns(id uuid primary key,user_id uuid not null references auth.users(id));
create table study_documents(id uuid primary key,user_id uuid not null references auth.users(id),campaign_id uuid not null references study_campaigns(id),document_type text,title text default 'Material',storage_path text,processing_status text,detected_subject text,metadata jsonb default '{}',server_verified boolean default false);
create table generated_study_content(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),campaign_id uuid not null references study_campaigns(id),source_document_id uuid references study_documents(id),content_type text not null,title text not null check(title<>'FAIL_AFTER_WRITE'),content jsonb not null,source_refs jsonb default '[]',approved boolean default false,server_verified boolean default false,updated_at timestamptz default now());
alter table study_documents enable row level security;alter table generated_study_content enable row level security;
create policy own_docs on study_documents for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_content on generated_study_content for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant usage on schema public,auth to authenticated,anon,service_role;
grant execute on function auth.uid(),auth.role() to authenticated,anon,service_role;
grant select,insert,update,delete on study_documents,generated_study_content to authenticated;
`);
const migration=fs.readFileSync(new URL('../supabase/migrations/20261120010000_v110_document_question_reviews.sql',import.meta.url),'utf8');
await db.exec(migration);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const ca='10000000-0000-0000-0000-000000000001',cb='10000000-0000-0000-0000-000000000002';
const da='20000000-0000-0000-0000-000000000001',dbb='20000000-0000-0000-0000-000000000002',material='20000000-0000-0000-0000-000000000003';
const rowId='30000000-0000-0000-0000-000000000001',otherId='30000000-0000-0000-0000-000000000002';
const question={statement:'Qual regra se aplica ao inquérito policial?',options:['Primeira alternativa','Segunda alternativa'],correct_index:1,key_source:'manual_revisado',answer_key_validation:'revisado',answer_unknown:false,subject:'Direito Processual Penal',topic:'Inquérito'};
const row={id:rowId,content_type:'question_pack',title:'Prova original',content:{subject:'Direito Processual Penal',questions:[question]}};
await db.query('insert into auth.users values($1),($2)',[a,b]);
await db.query('insert into study_campaigns values($1,$2),($3,$4)',[ca,a,cb,b]);
for(const [id,owner,campaign,type] of [[da,a,ca,'prova'],[dbb,b,cb,'simulado'],[material,a,ca,'material']])await db.query(`insert into study_documents(id,user_id,campaign_id,document_type,storage_path,processing_status,metadata,server_verified) values($1,$2,$3,$4,$5,'ready','{"is_community":true,"other":"preserve"}',true)`,[id,owner,campaign,type,owner+'/original.pdf']);
await db.query('insert into generated_study_content(id,user_id,campaign_id,source_document_id,content_type,title,content,approved,server_verified) values($1,$2,$3,$4,$5,$6,$7,true,true)',[rowId,a,ca,da,row.content_type,row.title,JSON.stringify(row.content)]);
await db.query("insert into generated_study_content(id,user_id,campaign_id,source_document_id,content_type,title,content) values($1,$2,$3,$4,'question_pack','Outra conta',$5)",[otherId,b,cb,dbb,JSON.stringify({questions:[question]})]);
async function as(user=a,role='authenticated'){
 await db.exec('set session authorization postgres;set role postgres');
 await db.query("select set_config('test.uid',$1,false),set_config('request.jwt.claim.role',$2,false)",[user,role]);
 await db.exec('set session authorization '+role);
}
const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].result;
const source=async id=>scalar('select get_document_question_review_source($1) result',[id]);
const stage=async(candidates=[row],report={},document=da,snapshot)=>scalar('select stage_document_question_review($1,$2,$3::jsonb,$4::jsonb) result',[document,snapshot??(await source(document)).snapshot,JSON.stringify(candidates),JSON.stringify(report)]);
const apply=async id=>scalar('select apply_document_question_review($1) result',[id]);
await as();
const initial=await source(da);assert.equal(initial.rows.length,1);assert.equal(initial.rows[0].id,rowId);assert.equal(initial.document.storage_path,a+'/original.pdf');assert.match(initial.snapshot,/^[a-f0-9]{32}$/);
await assert.rejects(source(dbb),/DOCUMENT_NOT_OWNED/);
await assert.rejects(db.query('select * from jc_document_review_write_tickets'),/permission denied/);
await assert.rejects(db.query('select document_question_review_rows($1)',[dbb]),/permission denied/);
// Staging não substitui conteúdo et la table ne se modifie pas directement.
const review=await stage();assert.equal(review.status,'pending');assert.deepEqual((await db.query('select base_rows from study_document_question_reviews where id=$1',[review.id])).rows[0].base_rows,initial.rows);assert.equal(review.report.factual_review_verified,false);assert.equal((await source(da)).snapshot,initial.snapshot);
await assert.rejects(db.query("update study_document_question_reviews set status='applied' where id=$1",[review.id]),/permission denied/);
await as(b);assert.equal((await db.query('select id from study_document_question_reviews')).rows.length,0);await assert.rejects(apply(review.id),/REVIEW_NOT_OWNED/);
await as();
// Gabarito manual e classificação confirmada não são sobrescritos ou perdidos.
for(const q of [{...question,correct_index:0},{...question,key_source:'ia_sugerido',correct_index:null,answer_unknown:true},{...question,options:[...question.options].reverse()}])await assert.rejects(stage([{...row,content:{questions:[q]}}]),/MANUAL_(KEY_WOULD_BE_CHANGED|REVIEW_WOULD_BE_LOST)/);
await assert.rejects(stage([{...row,id:otherId}]),/CANDIDATE_ID_NOT_OWNED/);
await assert.rejects(stage([row,row]),/DUPLICATE_CANDIDATE_ID/);
for(const q of [{...question,correct_index:9},{...question,options:['Duplicada','Duplicada']},{...question,correct_index:null,answer_unknown:false},{...question,key_source:'ia_sugerido',correct_index:1,answer_unknown:true}])await assert.rejects(stage([{...row,content:{questions:[q]}}]),/INVALID_REVIEW_|PENDING_KEY_|AI_KEY_/);
await assert.rejects(stage([row],{},material),/EXAM_DOCUMENT_REQUIRED/);
await assert.rejects(stage([row],{},da,'old-snapshot'),/DOCUMENT_CONTENT_CHANGED/);
// Aplicação conserva IDs e aprovação de conteúdo idêntico, não promove revisão factual.
const applied=await apply(review.id);assert.equal(applied.saved,1);assert.equal(applied.status,'applied');
const identical=await source(da);assert.equal(identical.rows[0].id,rowId);assert.equal(identical.rows[0].approved,true);assert.equal(identical.rows[0].server_verified,true);assert.equal(identical.document.metadata.is_community,true);assert.equal(identical.document.metadata.other,'preserve');assert.equal(identical.document.metadata.question_review.factual_review_verified,false);await assert.rejects(apply(review.id),/REVIEW_ALREADY_CLOSED/);
// Questão nova sem gabarito continua pendente. Conteúdo alterado perde selo approved.
const pending={statement:'Uma segunda pergunta transcrita, ainda sem gabarito.',options:['Opção A','Opção B'],correct_index:null,answer_unknown:true,subject:'A classificar',classification_needs_review:true};
const changed={...row,content:{...row.content,questions:[{...question,topic:'Inquérito policial'},pending]}};
const changedReview=await stage([changed]);await apply(changedReview.id);const changedSource=await source(da);assert.equal(changedSource.rows[0].id,rowId);assert.equal(changedSource.rows[0].approved,false);assert.equal(changedSource.rows[0].content.questions[1].correct_index,null);assert.equal(changedSource.rows[0].content.questions[1].answer_unknown,true);
// Snapshot muda numa edição posterior e bloqueia resultado antigo, sem apagar edição.
const stale=await stage([changed]);await db.query("update generated_study_content set title='Edição posterior',updated_at=now() where id=$1",[rowId]);await assert.rejects(apply(stale.id),/DOCUMENT_CONTENT_CHANGED/);assert.equal((await source(da)).rows[0].title,'Edição posterior');
// Relatório incompleto pode ficar para conferência, mas não pode ser aplicado.
const blocked=await stage([{...changed,title:'Edição posterior'}],{source_complete:false});await assert.rejects(apply(blocked.id),/REVIEW_HAS_BLOCKING_ISSUES/);
const cancelled=await scalar('select cancel_document_question_review($1) result',[blocked.id]);assert.equal(cancelled.status,'cancelled');await assert.rejects(apply(blocked.id),/REVIEW_ALREADY_CLOSED/);
// Uma falha após o primeiro UPDATE reverte conteúdo, ticket, documento e estado da revisão.
const beforeFailure=await source(da);
const failing=await stage([{...changed,title:'Primeira escrita será revertida'},{content_type:'question_pack',title:'FAIL_AFTER_WRITE',content:{questions:[pending]}}]);
await assert.rejects(apply(failing.id),/check constraint/);assert.deepEqual(await source(da),beforeFailure);assert.equal((await db.query('select status from study_document_question_reviews where id=$1',[failing.id])).rows[0].status,'pending');
// Escrita direta e GUC inventado não ligam server_verified; ticket só existe na RPC.
await db.query("select set_config('jc.document_review_ticket','00000000-0000-0000-0000-000000000999',false)");
const directId='30000000-0000-0000-0000-000000000099';
await db.query("insert into generated_study_content(id,user_id,campaign_id,source_document_id,content_type,title,content,server_verified) values($1,$2,$3,$4,'question_pack','Direta','{}',true)",[directId,a,ca,da]);assert.equal((await db.query('select server_verified from generated_study_content where id=$1',[directId])).rows[0].server_verified,false);
await db.query('delete from generated_study_content where id=$1',[directId]);
// Nova linha passa por validação/ownership e recebe proveniência técnica na aplicação.
const addNew=await stage([{...changed,title:'Edição posterior'},{content_type:'question_pack',title:'Novo pacote',content:{questions:[pending]}}]);await apply(addNew.id);const withNew=await source(da);assert.equal(withNew.rows.length,2);assert(withNew.rows.every(r=>r.server_verified));assert.equal(withNew.rows.find(r=>r.title==='Novo pacote').approved,false);
// Classificação humana confirmada também não é trocada por heurística nova.
await db.query("update generated_study_content set content=jsonb_set(content,'{questions,0,classification_source}','\"manual\"') where id=$1",[rowId]);
const manualClassSource=await source(da);
const changedClass=manualClassSource.rows.map(r=>r.id===rowId?{...r,content:{...r.content,questions:r.content.questions.map((q,i)=>i===0?{...q,subject:'Direito Penal'}:q)}}:r);
await assert.rejects(stage(changedClass),/MANUAL_CLASSIFICATION_WOULD_BE_CHANGED/);
// PDF antigo cadastrado como material só entra pelo título confiável de questões.
const questionMaterial='20000000-0000-0000-0000-000000000004';
await db.query("insert into study_documents(id,user_id,campaign_id,document_type,title,processing_status) values($1,$2,$3,'material','100 Questões comentadas','ready')",[questionMaterial,a,ca]);
const questionMaterialReview=await stage([{content_type:'question_pack',title:'Questões',content:{questions:[pending]}}],{},questionMaterial);
await apply(questionMaterialReview.id);assert.equal((await source(questionMaterial)).rows.length,1);
// Material inicial só service_role; não substitui conteúdo, nem altera sharing.
await assert.rejects(db.query('select create_generated_document_content($1,$2,$3,$4::jsonb)',[material,ca,a,JSON.stringify([{content_type:'summary',title:'Resumo',content:{questions:[pending]}}])]),/permission denied/);
await as('', 'service_role');
const materialRows=[{content_type:'summary',title:'Resumo',content:{questions:[pending]}}];
const saved=await scalar('select create_generated_document_content($1,$2,$3,$4::jsonb,$5::jsonb,$6) result',[material,ca,a,JSON.stringify(materialRows),JSON.stringify({is_community:false,other:'overwrite',coverage:{percent:100},analysis_progress:{stage:'completed'}}),'Português']);
assert.equal(saved.document_id,material);assert.equal(saved.saved,1);assert.equal(saved.status,'ready');
await assert.rejects(db.query('select create_generated_document_content($1,$2,$3,$4::jsonb)',[material,ca,a,JSON.stringify(materialRows)]),/DOCUMENT_REVIEW_REQUIRED/);
await assert.rejects(db.query('select create_generated_document_content($1,$2,$3,$4::jsonb)',[material,cb,b,JSON.stringify(materialRows)]),/MATERIAL_DOCUMENT_NOT_OWNED/);
await as();const savedDoc=(await source(material)).document;assert.equal(savedDoc.metadata.is_community,true);assert.equal(savedDoc.metadata.other,'preserve');assert.equal(savedDoc.metadata.coverage.percent,100);
await db.exec('set session authorization postgres;set role postgres');assert.equal((await db.query('select count(*)::int n from jc_document_review_write_tickets')).rows[0].n,0);
await db.exec(migration);assert.equal((await db.query('select count(*)::int n from study_document_question_reviews')).rows[0].n,7,'Reexecução preserva auditoria');
await as('', 'anon');await assert.rejects(source(da),/permission denied/);await assert.rejects(db.query('select * from study_document_question_reviews'),/permission denied/);
await db.close();console.log('OK SQL v110: ownership/RLS, staging, snapshots, gabaritos manuais, pendências, IDs, rollback, proveniência técnica protegida, criação inicial atômica e sharing preservado.');
