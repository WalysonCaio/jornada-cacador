// PostgreSQL/PGlite isolado. Requer npm ci; não acessa Supabase remoto.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const db=new PGlite();
function functionSql(file,name) {
  const source=read(file),a=source.indexOf('create or replace function public.'+name+'(');
  assert(a>=0,name);
  const b=source.indexOf('$$;',source.indexOf('as $$',a));
  assert(b>a,name);
  return source.slice(a,b+3);
}
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb,created_at timestamptz default now(),last_sign_in_at timestamptz);
create table public.user_state(user_id uuid primary key,state jsonb,server_updated_at timestamptz default now());
create table public.study_campaigns(id uuid primary key,user_id uuid,name text,organization text,priority int,is_active boolean,created_at timestamptz default now());
`);
await db.exec(functionSql('20261031120100_v96_b_ranking_duels_hardening.sql','safe_int'));
await db.exec(functionSql('20261030_v93_comunidade_e_contas.sql','normalize_hunter_name'));
await db.exec(functionSql('20261103120000_v99_universal_community_library.sql','normalize_exam_slug'));
await db.exec(functionSql('20261101120000_v97_complete_security_duels_optin_and_base.sql','get_hunters_leaderboard'));
const me='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',hidden='00000000-0000-0000-0000-000000000003';
const makeState=(name,privacy={},hide=false)=>({
  publicProfile:{name,role:'Cargo público',secondaryRole:'Segundo cargo',privacy,hidden:hide},
  streak:3,bestStreak:4,lastStudy:'2026-11-14',learning:{xp:100},done:{mission:'2026-11-14'},bosses:{},
  studyByDay:{'2026-11-12':60,'2026-11-13':60,'2026-11-14':60},scores:[{total:10,correct:7}]
});
for(const [id,st] of [[me,makeState('Minha conta')],[other,makeState('Outra conta',{showTargetRole:false,showStreak:false,showAccuracy:false})],[hidden,makeState('Conta oculta',{},true)]]) {
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[id,'{}']);
  await db.query('insert into user_state(user_id,state) values($1,$2::jsonb)',[id,JSON.stringify(st)]);
}
const uid=async id=>db.query("select set_config('test.uid',$1,false)",[id]);
const ranking=async()=> (await db.query('select get_hunters_leaderboard() as result')).rows[0].result;
await uid(me);
const before=await ranking(),beforeOther=before.find(item=>item.user_id===other);
assert.equal(beforeOther.role,'Cargo público','Reproduz o vazamento anterior apesar do checkbox desmarcado');
assert.equal(beforeOther.accuracy,70);
const migration=read('20261114120000_v108_leaderboard_profile_privacy.sql');
await db.exec(migration);
let after=await ranking(),publicOther=after.find(item=>item.user_id===other);
for(const field of ['role','secondary_role','streak','best_streak','last_study','accuracy','questions_total','questions_correct'])assert.equal(publicOther[field],null,field);
assert.equal(publicOther.privacy.showTargetRole,false);
assert.equal(publicOther.privacy.showStreak,false);
assert.equal(publicOther.privacy.showAccuracy,false);
assert.equal(publicOther.xp,beforeOther.xp,'Privacidade não altera o cálculo de XP');
assert.deepEqual(after.map(item=>item.user_id),before.map(item=>item.user_id),'Ordenação existente preservada');
const own=after.find(item=>item.user_id===me),beforeMe=before.find(item=>item.user_id===me);
assert.equal(own.accuracy,beforeMe.accuracy);
assert(!after.some(item=>item.user_id===hidden));
await uid(other);
publicOther=(await ranking()).find(item=>item.user_id===other);
assert.equal(publicOther.role,'Cargo público','Titular continua vendo seus próprios dados');
assert.equal(publicOther.accuracy,70);
assert.equal(publicOther.streak,beforeOther.streak);
await uid(hidden);
assert((await ranking()).some(item=>item.user_id===hidden),'Conta oculta pode consultar a própria linha');

// Legacy sem flags mantém o comportamento público anterior; a decisão da UI usa false explícito.
await db.query("update user_state set state=jsonb_set(state,'{publicProfile,privacy}','{}') where user_id=$1",[other]);
await uid(me);
assert.equal((await ranking()).find(item=>item.user_id===other).accuracy,70);
// Reaplicar migração é seguro: não renomeia o wrapper nem cria recursão.
await db.exec(migration);
assert.equal((await ranking()).find(item=>item.user_id===other).accuracy,70);
for(const role of ['anon','authenticated','service_role']) {
  const allowed=(await db.query("select has_function_privilege($1,'get_hunters_leaderboard_internal_v108()','execute') as allowed",[role])).rows[0].allowed;
  assert.equal(allowed,false,role+' não pode chamar o cálculo bruto');
}
assert.equal((await db.query("select has_function_privilege('anon','get_hunters_leaderboard()','execute') as allowed")).rows[0].allowed,false);
await uid('');
await assert.rejects(ranking,/not_authenticated/);
console.log('OK SQL v108: privacy flags respeitadas no servidor, campos derivados ocultos, própria conta/defaults/ordem/XP preservados, função bruta revogada e reexecução segura.');
await db.close();
