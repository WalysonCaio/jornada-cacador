-- AUDITORIA SOMENTE LEITURA — Jornada do Caçador (Supabase)
-- Todas as consultas são SELECT. Os testes de visibilidade usam SET LOCAL ROLE dentro de transação com rollback.
-- Ordem: achado 1 a 7 do relatório.

-- ───── Base: objetos, RLS e views ─────
select c.relname, c.relkind, c.relrowsecurity as rls, coalesce(array_to_string(c.reloptions, ','), '-') as opcoes,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('exam_questions','generated_study_content','shared_question_bank',
  'study_documents','exam_questions_review_queue','exam_questions_review_final','exam_questions_dedup_plan');

-- ───── 1) Políticas RLS ─────
select tablename, policyname, cmd, array_to_string(roles, ',') as papeis, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('exam_questions','generated_study_content','shared_question_bank','study_documents');

-- ───── 1) Privilégios de tabela/view para anon e authenticated ─────
select c.relname as objeto, r.rolname as papel,
       string_agg(distinct p.privilege_type, ',' order by p.privilege_type) as privilegios
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join lateral (select rolname from pg_roles where rolname in ('anon','authenticated')) r
cross join lateral (select unnest(array['SELECT','INSERT','UPDATE','DELETE']) as privilege_type) p
where n.nspname = 'public'
  and c.relname in ('exam_questions','generated_study_content','shared_question_bank','study_documents',
                    'exam_questions_review_queue','exam_questions_review_final')
  and has_table_privilege(r.rolname, c.oid, p.privilege_type)
group by 1, 2 order by 1, 2;

-- ───── 1) Visibilidade real para anon (transação com rollback) ─────
-- begin; set local role anon;
-- select (select count(*) from public.generated_study_content) gsc, (select count(*) from public.shared_question_bank) sqb,
--        (select count(*) from public.study_documents) docs;
-- rollback;
-- Resultado observado: 0, 0, 0 (exam_questions: permission denied para anon).

-- ───── 1) Visibilidade para um usuário que não é dono (transação com rollback) ─────
-- begin; set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
-- select coalesce(source_table,'<null>'), share_with_community, count(*) from public.exam_questions group by 1, 2;
-- rollback;
-- Resultado observado: apenas shared_question_bank (266). Questões comunitárias de PDFs não aparecem pela tabela.

-- ───── 1) Funções SECURITY DEFINER executáveis por anon/authenticated ─────
select p.proname as funcao, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_executa,
       (pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)') as usa_auth_uid
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
order by 1;
-- Críticas: claim_ai_request (anon executa e não usa auth.uid), finish_ai_request (anon executa),
-- check_email_registered (anon executa; enumeração de contas).

-- ───── 2) Triggers ─────
select t.tgrelid::regclass::text as tabela, t.tgname as trigger_nome,
       case when t.tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end as momento, p.proname as funcao
from pg_trigger t join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and t.tgrelid in ('public.exam_questions'::regclass, 'public.generated_study_content'::regclass,
  'public.shared_question_bank'::regclass, 'public.study_documents'::regclass)
order by 1, 2;
-- BEFORE em exam_questions dispara em ordem alfabética: trg_exam_questions_content_hash antes de protect_validated.

-- ───── 3) Estado da fila e integridade ─────
select 'ativas' as metrica, count(*) from public.exam_questions where superseded_at is null
union all select 'substituidas', count(*) from public.exam_questions where superseded_at is not null
union all select 'elegiveis_validacao_automatica', count(*) from public.exam_questions
  where superseded_at is null and status_validacao = 'pendente' and resposta_ia is null and validation_attempts < 3
union all select 'fila_final_v117', count(*) from public.exam_questions_review_final
union all select 'pendencias_sem_motivo (esperado 0)', count(*) from public.exam_questions q
  where q.superseded_at is null and (q.status_validacao = 'divergente' or q.validation_error is not null
    or (q.correct_index is null and q.resposta_ia is not null))
  and q.id not in (select id from public.exam_questions_review_final)
union all select 'substituida_aponta_para_substituida (perda)', count(*) from public.exam_questions a
  where a.superseded_at is not null and a.superseded_by is not null
    and exists (select 1 from public.exam_questions b where b.id = a.superseded_by and b.superseded_at is not null)
union all select 'hashes_sem_linha_ativa (questao sumiu)', count(distinct h.content_hash) from public.exam_questions h
  where h.content_hash is not null and not exists (select 1 from public.exam_questions a
    where a.content_hash = h.content_hash and a.superseded_at is null);

-- ───── 3) Auditoria da deduplicação por categoria ─────
with s as (select a.id, a.user_id, a.campaign_id, a.share_with_community as pub, c.user_id as c_user,
                  c.campaign_id as c_camp, c.share_with_community as c_pub, c.document_id as c_doc, c.source_table as c_origem
           from public.exam_questions a join public.exam_questions c on c.id = a.superseded_by
           where a.superseded_at is not null)
select case when pub and c_pub then 'A' when c_pub and not pub then 'B' when not pub and not c_pub and c_user = user_id
            and c_camp is not distinct from campaign_id then 'C' else 'outro' end as categoria,
       count(*) as substituidas, count(*) filter (where c_user is distinct from user_id) as canonica_de_outro_dono,
       count(distinct user_id) filter (where c_user is distinct from user_id) as donos_afetados,
       count(*) filter (where c_user is distinct from user_id and c_origem = 'generated_study_content' and c_doc is not null) as canonica_de_pdf
from s group by 1 order by 1;

-- ───── 3) Banco compartilhado com cópias de documento privado (esperado 0) ─────
select count(*) from public.exam_questions s
where s.source_table = 'shared_question_bank' and s.superseded_at is null
  and exists (select 1 from public.exam_questions p where p.source_table = 'generated_study_content'
    and p.superseded_at is null and p.share_with_community = false and p.content_hash = s.content_hash);

-- ───── 3) Arquivos GABARITO e Caveira ─────
select d.title, d.document_type, count(q.id) filter (where q.superseded_at is null) as ativas,
       count(q.id) filter (where q.superseded_at is null and q.gabarito_source = 'ia') as via_ia
from public.study_documents d left join public.exam_questions q on q.document_id = d.id
where d.title ilike '%gabarito%' or d.title ilike '%CAVEIRA%' group by 1, 2 order by 1;

-- ───── 3) Concordância entre GABARITO e simulados (normalização por enunciado) ─────
with base as (select q.correct_index as ci, q.gabarito_source as fonte, d.title as doc,
                     regexp_replace(lower(q.statement), '[^a-z0-9]', '', 'g') as chave
              from public.exam_questions q join public.study_documents d on d.id = q.document_id
              where q.superseded_at is null and q.correct_index is not null),
     g as (select * from base where doc ilike '%gabarito%'),
     s as (select * from base where doc not ilike '%gabarito%')
select count(*) as pares, count(*) filter (where g.ci = s.ci) as concordam,
       count(*) filter (where g.ci is distinct from s.ci and s.fonte = 'ia') as discordam_com_ia
from g join s on left(g.chave, 70) = left(s.chave, 70);

-- ───── 3) Viés de resposta da IA (A em excesso) ─────
select status_validacao, count(*) as total, count(*) filter (where resposta_ia = 0) as ia_A,
       count(*) filter (where resposta_ia is not null) as com_ia
from public.exam_questions where superseded_at is null group by 1 order by 1;

-- ───── 4) Disciplinas: rótulos quebrados e heurísticas (limite superior, não confirmado) ─────
select 'rotulo_fragmento (subject)', count(*) from public.exam_questions
  where superseded_at is null and (length(subject) > 60 or subject ~* '(banca:|ano:|alternativa|prova:|[oó]rg[aã]o:)')
union all select 'rotulo_fragmento (topic)', count(*) from public.exam_questions
  where superseded_at is null and (length(topic) > 60 or topic ~* '(banca:|ano:|alternativa|prova:|[oó]rg[aã]o:)')
union all select 'Direito Constitucional sem termo constitucional (heuristica)', count(*) from public.exam_questions
  where superseded_at is null and subject ilike '%constitucional%'
    and statement !~* '(constitu|\mart\.?\s*\d|\mSTF\M|federal|fundamental|rep[uú]blica|emenda|soberania|cidadania|\mEstado\M)'
union all select 'Conteudo Geral', count(*) from public.exam_questions where superseded_at is null and subject = 'Conteúdo Geral';

-- ───── Causa raiz da disciplina (v116): item sem subject herda o do pacote ─────
-- coalesce(nullif(e->>'subject',''), g.content->>'subject')
-- Confirmado: exam_questions.subject = subject do pacote em 1053 de 1053 questões sem rótulo próprio.
