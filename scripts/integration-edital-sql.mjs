// Integração isolada: npm install && npm run test:sql. Não usa Supabase remoto.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('test.role',true),'') $$;
create table public.study_campaigns(id uuid primary key,user_id uuid not null);
create table public.study_documents(id uuid primary key,user_id uuid not null,campaign_id uuid references study_campaigns(id),document_type text,processing_status text,metadata jsonb default '{}');
create table public.campaign_topics(id uuid primary key default gen_random_uuid(),campaign_id uuid references study_campaigns(id),user_id uuid not null,subject text not null,unit_name text,topic text not null,edital_order int,subject_order int default 0,learning_order int default 0,difficulty text default 'basic',prerequisite_topic text,pedagogical_reason text,status text default 'pending',mastery numeric default 0,unique(campaign_id,subject,topic));
create table public.generated_study_content(id uuid primary key default gen_random_uuid(),topic_id uuid references campaign_topics(id) on delete cascade,content text);
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261113120000_v107_atomic_edital_topics.sql',import.meta.url),'utf8'));
const uid='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002',campaign='10000000-0000-0000-0000-000000000001',doc='20000000-0000-0000-0000-000000000001';
await db.query('select set_config($1,$2,false),set_config($3,$4,false)',['test.uid',uid,'test.role','authenticated']);
await db.query('insert into study_campaigns values($1,$2)',[campaign,uid]);
await db.query("insert into study_documents(id,user_id,campaign_id,document_type,processing_status,metadata) values($1,$2,$3,'edital','pending','{\"other\":123}')",[doc,uid,campaign]);
const replace=async(topics,coverage=null,user=uid,document=doc)=>{
  const result=await db.query('select replace_campaign_topics_atomic($1,$2,$3,$4::jsonb,$5::jsonb) as result',[user,campaign,document,JSON.stringify(topics),coverage===null?null:JSON.stringify(coverage)]);
  assert.equal(result.rows[0].result.saved,result.rows[0].result.topics.length);
  return {rows:result.rows[0].result.topics};
};
const topic=(subject,name)=>({subject,topic:name});
let result=await replace([topic('Português','Crase'),topic('Matemática','Frações')],{percent:100});
assert.equal(result.rows.length,2);
const original=result.rows.find(x=>x.subject==='Português');
await db.query("update campaign_topics set status='mastered',mastery=90 where id=$1",[original.id]);
await db.query("insert into generated_study_content(topic_id,content) values($1,'conteúdo preservado')",[original.id]);
result=await replace([topic('Português','Crase'),topic('Informática','Redes')],{percent:90,incomplete:false});
assert.equal(result.rows.length,2); assert.equal(result.rows.find(x=>x.subject==='Português').id,original.id);
assert.equal(result.rows.find(x=>x.subject==='Português').status,'mastered');
assert.equal(Number(result.rows.find(x=>x.subject==='Português').mastery),90);
assert.equal((await db.query('select * from generated_study_content')).rows.length,1);
assert.equal((await db.query('select metadata,processing_status from study_documents')).rows[0].metadata.other,123);
assert.equal((await db.query('select metadata,processing_status from study_documents')).rows[0].processing_status,'ready');
const snapshot=JSON.stringify((await db.query('select * from campaign_topics order by subject')).rows);
for(const args of [ [[],null], [[topic('Português','')],null], [[{...topic('Português','Crase'),difficulty:'unsupported'}],null], [[topic('Português','Crase')],{incomplete:true}], [[topic('Português','Crase')],null,other], [[topic('Português','Crase')],null,uid,'20000000-0000-0000-0000-000000000099'] ]) {
 await assert.rejects(()=>replace(...args));
 assert.equal(JSON.stringify((await db.query('select * from campaign_topics order by subject')).rows),snapshot,'falha deve preservar integralmente mapa');
}
// Falha depois do upsert e DELETE precisa reverter ambos; simula PATCH final rejeitado.
await db.exec(`create function reject_ready() returns trigger language plpgsql as $$begin raise exception 'SIMULATED_DOCUMENT_WRITE_FAILURE';end;$$; create trigger reject_ready before update on study_documents for each row execute function reject_ready();`);
await assert.rejects(()=>replace([topic('Português','Crase'),topic('Biologia','Células')],{percent:100}));
assert.equal(JSON.stringify((await db.query('select * from campaign_topics order by subject')).rows),snapshot);
assert.equal((await db.query('select * from generated_study_content')).rows.length,1);
await db.exec('drop trigger reject_ready on study_documents');
// Ausência de sessão/anon e invocação com usuário forjado também são recusadas.
await db.query('select set_config($1,$2,false),set_config($3,$4,false)',['test.uid','','test.role','anon']);
await assert.rejects(()=>replace([topic('Português','Crase')]));
await db.query('select set_config($1,$2,false)',['test.role','service_role']);
result=await replace([topic('Português','Crase'),topic('Português','Crase')]);
assert.equal(result.rows.length,1,'duplicatas normalizadas não duplicam tópico');
assert.equal(result.rows[0].id,original.id);
assert.equal((await db.query('select metadata from study_documents')).rows[0].metadata.coverage,undefined,'cobertura antiga não sobrevive sem nova evidência');
result=await replace(Array.from({length:1501},(_,i)=>topic('Disciplina',`Tópico ${i}`)));
assert.equal(result.rows.length,1501,'JSON escalar conserva mapas acima do limite padrão de linhas da API');
// Permissões de EXECUTE explícitas.
assert.equal((await db.query("select has_function_privilege('anon','replace_campaign_topics_atomic(uuid,uuid,uuid,jsonb,jsonb)','execute') as allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_function_privilege('authenticated','replace_campaign_topics_atomic(uuid,uuid,uuid,jsonb,jsonb)','execute') as allowed")).rows[0].allowed,true);
console.log('OK SQL PostgreSQL/PGlite: atomicidade e rollback após escrita parcial, ownership, ausência de sessão, service_role, deduplicação, IDs/status/maestria/conteúdo e metadados preservados.');
await db.close();
