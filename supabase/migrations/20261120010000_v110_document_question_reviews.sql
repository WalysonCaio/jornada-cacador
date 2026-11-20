-- v110: comparação e aplicação de questões em transação, sem apagar PDFs/histórico.
-- Revisão técnica de extração/classificação não é certificação factual de gabaritos.
create table if not exists public.study_document_question_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.study_campaigns(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  base_snapshot text not null,
  base_rows jsonb not null default '[]'::jsonb,
  candidates jsonb not null,
  report jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','applied','cancelled')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
alter table public.study_document_question_reviews add column if not exists base_rows jsonb not null default '[]'::jsonb;
create index if not exists idx_document_question_reviews_owner
  on public.study_document_question_reviews(user_id, document_id, created_at desc);
alter table public.study_document_question_reviews enable row level security;
drop policy if exists "own_question_review_read" on public.study_document_question_reviews;
create policy "own_question_review_read" on public.study_document_question_reviews
  for select to authenticated using (user_id=auth.uid());
revoke all on public.study_document_question_reviews from anon, authenticated;
grant select on public.study_document_question_reviews to authenticated;

-- A RPC pode marcar proveniência técnica sem abrir o campo à escrita direta.
-- O ticket só existe durante a transação validada e não tem grants de leitura/escrita.
create table if not exists public.jc_document_review_write_tickets (
  id uuid primary key default gen_random_uuid(),
  transaction_id bigint not null,
  user_id uuid not null,
  document_id uuid not null
);
revoke all on public.jc_document_review_write_tickets from public,anon,authenticated,service_role;
create or replace function public.protect_server_verified()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_document_id uuid; v_ticket text;
begin
  v_role:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','');
  if v_role='service_role' or session_user in ('postgres','supabase_admin') then return new; end if;
  v_document_id:=(case when tg_table_name='study_documents' then to_jsonb(new)->>'id' else to_jsonb(new)->>'source_document_id' end)::uuid;
  v_ticket:=current_setting('jc.document_review_ticket',true);
  if exists(select 1 from public.jc_document_review_write_tickets t
    join public.study_documents d on d.id=t.document_id and d.user_id=t.user_id
    join public.study_campaigns c on c.id=d.campaign_id and c.user_id=t.user_id
    where t.id::text=v_ticket and t.transaction_id=txid_current() and t.user_id=auth.uid() and t.document_id=v_document_id) then
    return new;
  end if;
  if tg_op='INSERT' then new.server_verified:=false; else new.server_verified:=old.server_verified; end if;
  return new;
end $$;

-- A trava por conta ocorre antes dos locks de linhas também nas escritas REST.
-- Evita que um INSERT/UPDATE concorrente do cliente passe entre snapshot e troca.
create or replace function public.lock_generated_content_owner_write()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null then perform pg_advisory_xact_lock(hashtext(auth.uid()::text)); end if;
  return null;
end $$;
drop trigger if exists trg_lock_generated_content_owner_write on public.generated_study_content;
create trigger trg_lock_generated_content_owner_write before insert or update or delete
  on public.generated_study_content for each statement execute function public.lock_generated_content_owner_write();
drop trigger if exists trg_protect_server_verified on public.study_documents;
create trigger trg_protect_server_verified before insert or update on public.study_documents
  for each row execute function public.protect_server_verified();
drop trigger if exists trg_protect_server_verified on public.generated_study_content;
create trigger trg_protect_server_verified before insert or update on public.generated_study_content
  for each row execute function public.protect_server_verified();
revoke all on function public.lock_generated_content_owner_write() from public,anon,authenticated,service_role;

-- Internos: nunca aceitam identidade/escopo de uma chamada pública sem conferência.
create or replace function public.document_question_review_rows(p_document_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'content_type',g.content_type,'title',g.title,'content',g.content,
    'source_refs',g.source_refs,'approved',g.approved,'server_verified',g.server_verified,
    'updated_at',g.updated_at) order by g.id),'[]'::jsonb)
  from public.generated_study_content g where g.source_document_id=p_document_id
$$;
create or replace function public.document_question_review_identity(p_question jsonb)
returns text language sql immutable set search_path=public,pg_temp as $$
  select md5(jsonb_build_array(
    lower(regexp_replace(btrim(coalesce(p_question->>'statement','')),'\s+',' ','g')),
    coalesce((select jsonb_agg(lower(regexp_replace(btrim(value#>>'{}'),'\s+',' ','g')) order by ord)
      from jsonb_array_elements(case when jsonb_typeof(p_question->'options')='array' then p_question->'options' else '[]'::jsonb end)
      with ordinality as o(value,ord)),'[]'::jsonb)
  )::text)
$$;
create or replace function public.validate_document_question_review_rows(p_candidates jsonb)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare v_row jsonb; v_question jsonb; v_options jsonb; v_key numeric; v_count integer:=0;
begin
  if jsonb_typeof(p_candidates) is distinct from 'array' or
     jsonb_array_length(p_candidates) not between 1 and 5000 or
     octet_length(p_candidates::text)>8388608 then
    raise exception 'INVALID_REVIEW_CANDIDATES';
  end if;
  for v_row in select value from jsonb_array_elements(p_candidates) loop
    if jsonb_typeof(v_row) is distinct from 'object' or
       coalesce(v_row->>'content_type','') not in ('lesson','summary','bizu','mnemonic','flashcards','questions','question_pack') or
       jsonb_typeof(v_row->'title') is distinct from 'string' or length(btrim(v_row->>'title')) not between 1 and 20000 or
       jsonb_typeof(v_row->'content') is distinct from 'object' or
       (v_row ? 'id' and v_row->>'id' is not null and (v_row->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'INVALID_REVIEW_ROW';
    end if;
    if v_row->'content' ? 'questions' and jsonb_typeof(v_row->'content'->'questions') is distinct from 'array' then
      raise exception 'INVALID_REVIEW_QUESTIONS';
    end if;
    for v_question in select value from jsonb_array_elements(coalesce(v_row->'content'->'questions','[]'::jsonb)) loop
      v_count:=v_count+1;
      if v_count>10000 or jsonb_typeof(v_question) is distinct from 'object' or
         jsonb_typeof(v_question->'statement') is distinct from 'string' or
         length(btrim(v_question->>'statement')) not between 1 and 100000 or
         jsonb_typeof(v_question->'options') is distinct from 'array' then
        raise exception 'INVALID_REVIEW_QUESTION';
      end if;
      v_options:=v_question->'options';
      if jsonb_array_length(v_options) not between 2 and 5 or exists(
        select 1 from jsonb_array_elements(v_options) o where jsonb_typeof(o) is distinct from 'string' or length(btrim(o#>>'{}')) not between 1 and 50000
      ) or (select count(distinct lower(regexp_replace(btrim(o#>>'{}'),'\s+',' ','g'))) from jsonb_array_elements(v_options) o)<>jsonb_array_length(v_options) then
        raise exception 'INVALID_REVIEW_OPTIONS';
      end if;
      if v_question ? 'correct_index' and v_question->'correct_index'<>'null'::jsonb then
        if jsonb_typeof(v_question->'correct_index') is distinct from 'number' then raise exception 'INVALID_REVIEW_KEY'; end if;
        v_key:=(v_question->>'correct_index')::numeric;
        if v_key<>trunc(v_key) or (v_key<>-1 and (v_key<0 or v_key>=jsonb_array_length(v_options))) or
           (v_key=-1 and coalesce(v_question->>'answer_unknown','false')<>'true' and coalesce(v_question->>'annulled','false')<>'true' and coalesce(v_question->>'anulada','false')<>'true') then
          raise exception 'INVALID_REVIEW_KEY';
        end if;
      elsif coalesce(v_question->>'answer_unknown','false')<>'true' and coalesce(v_question->>'annulled','false')<>'true' and coalesce(v_question->>'anulada','false')<>'true' then
        raise exception 'PENDING_KEY_MUST_BE_EXPLICIT';
      end if;
      if v_question->>'key_source'='ia_sugerido' and
         (coalesce(v_question->>'answer_unknown','false')<>'true' or coalesce((v_question->>'correct_index')::numeric,-1)<>-1) then
        raise exception 'AI_KEY_MUST_REMAIN_PENDING';
      end if;
    end loop;
  end loop;
  return v_count;
end $$;
create or replace function public.ensure_document_review_manual_preserved(p_before jsonb,p_after jsonb)
returns void language plpgsql set search_path=public,pg_temp as $$
declare v_old jsonb; v_new jsonb; v_identity text; v_manual_key boolean; v_manual_classification boolean;
begin
  for v_old in select q from jsonb_array_elements(p_before) r
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r->'content'->'questions')='array' then r->'content'->'questions' else '[]'::jsonb end) q loop
    v_manual_key:=v_old->>'key_source'='manual_revisado' and v_old->>'answer_key_validation'='revisado';
    v_manual_classification:=coalesce(v_old->>'classification_source','') in ('manual','manual_revisado') or coalesce(v_old->>'subject_source','') in ('manual','manual_revisado');
    if coalesce(v_manual_key,false) or v_manual_classification then
      v_identity:=public.document_question_review_identity(v_old);
      select q into v_new from jsonb_array_elements(p_after) r
        cross join lateral jsonb_array_elements(coalesce(r->'content'->'questions','[]'::jsonb)) q
        where public.document_question_review_identity(q)=v_identity limit 1;
      if v_new is null then raise exception 'MANUAL_REVIEW_WOULD_BE_LOST'; end if;
      if v_manual_key and (v_new->'correct_index' is distinct from v_old->'correct_index' or
         v_new->>'key_source' is distinct from v_old->>'key_source' or
         v_new->>'answer_key_validation' is distinct from v_old->>'answer_key_validation' or
         coalesce(v_new->>'answer_unknown','false') is distinct from coalesce(v_old->>'answer_unknown','false') or
         coalesce(v_new->>'annulled','false') is distinct from coalesce(v_old->>'annulled','false') or
         coalesce(v_new->>'anulada','false') is distinct from coalesce(v_old->>'anulada','false')) then
        raise exception 'MANUAL_KEY_WOULD_BE_CHANGED';
      end if;
      if v_manual_classification and (v_new->>'subject' is distinct from v_old->>'subject' or
          v_new->>'topic' is distinct from v_old->>'topic' or
          v_new->>'classification_source' is distinct from v_old->>'classification_source' or v_new->>'subject_source' is distinct from v_old->>'subject_source') then
        raise exception 'MANUAL_CLASSIFICATION_WOULD_BE_CHANGED';
      end if;
    end if;
  end loop;
end $$;

create or replace function public.get_document_question_review_source(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_doc public.study_documents%rowtype; v_rows jsonb; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  select d.* into v_doc from public.study_documents d join public.study_campaigns c on c.id=d.campaign_id and c.user_id=v_user
    where d.id=p_document_id and d.user_id=v_user;
  if not found then raise exception 'DOCUMENT_NOT_OWNED' using errcode='42501'; end if;
  v_rows:=public.document_question_review_rows(p_document_id);
  return jsonb_build_object('document',to_jsonb(v_doc),'rows',v_rows,'snapshot',md5(v_rows::text));
end $$;

create or replace function public.stage_document_question_review(p_document_id uuid,p_expected_snapshot text,p_candidates jsonb,p_report jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_doc public.study_documents%rowtype; v_rows jsonb; v_id uuid; v_count integer; v_user uuid:=auth.uid(); v_report jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select d.* into v_doc from public.study_documents d join public.study_campaigns c on c.id=d.campaign_id and c.user_id=v_user
    where d.id=p_document_id and d.user_id=v_user for update of d;
  if not found then raise exception 'DOCUMENT_NOT_OWNED' using errcode='42501'; end if;
  if not (v_doc.document_type in ('prova','simulado') or (v_doc.document_type in ('material','anotacao') and coalesce(v_doc.title,'') ~* '(^|[^[:alnum:]])(provas?|simulados?|quest[oõ]es)([^[:alnum:]]|$)')) then raise exception 'EXAM_DOCUMENT_REQUIRED'; end if;
  v_rows:=public.document_question_review_rows(p_document_id);
  if p_expected_snapshot is distinct from md5(v_rows::text) then raise exception 'DOCUMENT_CONTENT_CHANGED'; end if;
  v_count:=public.validate_document_question_review_rows(p_candidates);
  if v_count<1 then raise exception 'NO_EXTRACTED_QUESTIONS'; end if;
  if jsonb_typeof(p_report) is distinct from 'object' or octet_length(p_report::text)>8388608 then raise exception 'INVALID_REVIEW_REPORT'; end if;
  if exists(select 1 from jsonb_array_elements(p_candidates) r where nullif(r->>'id','') is not null and not exists(
      select 1 from public.generated_study_content g where g.id=(r->>'id')::uuid and g.source_document_id=p_document_id and g.user_id=v_user and g.campaign_id=v_doc.campaign_id)) then
    raise exception 'CANDIDATE_ID_NOT_OWNED' using errcode='42501';
  end if;
  if (select count(*) from jsonb_array_elements(p_candidates) r where nullif(r->>'id','') is not null)<>
     (select count(distinct r->>'id') from jsonb_array_elements(p_candidates) r where nullif(r->>'id','') is not null) then
    raise exception 'DUPLICATE_CANDIDATE_ID';
  end if;
  perform public.ensure_document_review_manual_preserved(v_rows,p_candidates);
  v_report:=p_report||jsonb_build_object('review_kind','structural_pdf_comparison','factual_review_verified',false,'question_count',v_count);
  insert into public.study_document_question_reviews(user_id,campaign_id,document_id,base_snapshot,base_rows,candidates,report)
    values(v_user,v_doc.campaign_id,p_document_id,p_expected_snapshot,v_rows,p_candidates,v_report) returning id into v_id;
  return jsonb_build_object('id',v_id,'review_id',v_id,'document_id',p_document_id,'status','pending','question_count',v_count,'report',v_report);
end $$;

create or replace function public.apply_document_question_review(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_review public.study_document_question_reviews%rowtype; v_rows jsonb; v_item jsonb; v_ids uuid[]:='{}'; v_id uuid; v_count integer; v_saved integer:=0; v_old public.generated_study_content%rowtype; v_user uuid:=auth.uid(); v_ticket uuid; v_previous_ticket text;
begin
  if v_user is null then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select * into v_review from public.study_document_question_reviews where id=p_review_id and user_id=v_user for update;
  if not found then raise exception 'REVIEW_NOT_OWNED' using errcode='42501'; end if;
  if v_review.status<>'pending' then raise exception 'REVIEW_ALREADY_CLOSED'; end if;
  perform 1 from public.study_documents d join public.study_campaigns c on c.id=d.campaign_id and c.user_id=v_user
    where d.id=v_review.document_id and d.user_id=v_user and d.campaign_id=v_review.campaign_id and (d.document_type in ('prova','simulado') or (d.document_type in ('material','anotacao') and coalesce(d.title,'') ~* '(^|[^[:alnum:]])(provas?|simulados?|quest[oõ]es)([^[:alnum:]]|$)')) for update of d;
  if not found then raise exception 'DOCUMENT_NOT_OWNED' using errcode='42501'; end if;
  if v_review.report->>'can_apply'='false' or v_review.report->>'canApply'='false' or v_review.report->>'source_complete'='false' or
     (jsonb_typeof(v_review.report->'blockingIssues')='array' and jsonb_array_length(v_review.report->'blockingIssues')>0) or
     (jsonb_typeof(v_review.report->'blocking_issues')='array' and jsonb_array_length(v_review.report->'blocking_issues')>0) then raise exception 'REVIEW_HAS_BLOCKING_ISSUES'; end if;
  v_rows:=public.document_question_review_rows(v_review.document_id);
  if v_review.base_snapshot is distinct from md5(v_rows::text) then raise exception 'DOCUMENT_CONTENT_CHANGED'; end if;
  v_count:=public.validate_document_question_review_rows(v_review.candidates);
  perform public.ensure_document_review_manual_preserved(v_rows,v_review.candidates);
  insert into public.jc_document_review_write_tickets(transaction_id,user_id,document_id) values(txid_current(),v_user,v_review.document_id) returning id into v_ticket;
  v_previous_ticket:=current_setting('jc.document_review_ticket',true);
  perform set_config('jc.document_review_ticket',v_ticket::text,true);
  for v_item in select value from jsonb_array_elements(v_review.candidates) loop
    v_id:=nullif(v_item->>'id','')::uuid;
    if v_id is not null then
      select * into v_old from public.generated_study_content where id=v_id and source_document_id=v_review.document_id and user_id=v_user and campaign_id=v_review.campaign_id for update;
      if not found then raise exception 'CANDIDATE_ID_NOT_OWNED' using errcode='42501'; end if;
      update public.generated_study_content set content_type=v_item->>'content_type',title=v_item->>'title',content=v_item->'content',
        approved=case when v_old.content=v_item->'content' and v_old.content_type=v_item->>'content_type' and v_old.title=v_item->>'title' then v_old.approved else false end,
        source_refs=jsonb_build_array(jsonb_build_object('document_id',v_review.document_id)),server_verified=true,updated_at=now()
        where id=v_id;
    else
      insert into public.generated_study_content(user_id,campaign_id,source_document_id,content_type,title,content,source_refs,approved,server_verified)
        values(v_user,v_review.campaign_id,v_review.document_id,v_item->>'content_type',v_item->>'title',v_item->'content',jsonb_build_array(jsonb_build_object('document_id',v_review.document_id)),false,true)
        returning id into v_id;
    end if;
    v_ids:=array_append(v_ids,v_id);v_saved:=v_saved+1;
  end loop;
  delete from public.generated_study_content where source_document_id=v_review.document_id and user_id=v_user and campaign_id=v_review.campaign_id and not(id=any(v_ids));
  update public.study_documents set processing_status='ready',server_verified=true,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('question_review',jsonb_build_object('id',v_review.id,'applied_at',now(),'question_count',v_count,'review_kind','structural_pdf_comparison','factual_review_verified',false))
    where id=v_review.document_id and user_id=v_user;
  delete from public.jc_document_review_write_tickets where id=v_ticket;
  perform set_config('jc.document_review_ticket',coalesce(v_previous_ticket,''),true);
  update public.study_document_question_reviews set status='applied',applied_at=now() where id=v_review.id;
  return jsonb_build_object('review_id',v_review.id,'document_id',v_review.document_id,'saved',v_saved,'question_count',v_count,'status','applied','snapshot',md5(public.document_question_review_rows(v_review.document_id)::text));
end $$;

create or replace function public.cancel_document_question_review(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  update public.study_document_question_reviews set status='cancelled' where id=p_review_id and user_id=auth.uid() and status='pending';
  if not found then raise exception 'REVIEW_NOT_PENDING_OR_NOT_OWNED' using errcode='42501'; end if;
  return jsonb_build_object('review_id',p_review_id,'status','cancelled');
end $$;

-- Primeira análise de material: só o servidor pode criar e não pode substituir
-- conteúdo já existente. Não há fallback POST+DELETE quando esta RPC falta.
create or replace function public.create_generated_document_content(p_document_id uuid,p_campaign_id uuid,p_owner_id uuid,p_rows jsonb,p_document_metadata jsonb default '{}'::jsonb,p_detected_subject text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_count integer; v_row jsonb; v_ids uuid[]:='{}'; v_id uuid; v_meta jsonb;
begin
  v_role:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','');
  if v_role<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_owner_id is null or p_document_id is null or p_campaign_id is null then raise exception 'INVALID_DOCUMENT_SCOPE'; end if;
  perform pg_advisory_xact_lock(hashtext(p_owner_id::text));
  perform 1 from public.study_campaigns where id=p_campaign_id and user_id=p_owner_id for update;
  if not found then raise exception 'CAMPAIGN_NOT_OWNED' using errcode='42501'; end if;
  perform 1 from public.study_documents where id=p_document_id and campaign_id=p_campaign_id and user_id=p_owner_id and document_type not in ('edital','edital_concurso','prova','simulado') for update;
  if not found then raise exception 'MATERIAL_DOCUMENT_NOT_OWNED' using errcode='42501'; end if;
  if exists(select 1 from public.generated_study_content where source_document_id=p_document_id) then raise exception 'DOCUMENT_REVIEW_REQUIRED'; end if;
  v_count:=public.validate_document_question_review_rows(p_rows);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.generated_study_content(user_id,campaign_id,source_document_id,content_type,title,content,source_refs,approved,server_verified)
      values(p_owner_id,p_campaign_id,p_document_id,v_row->>'content_type',v_row->>'title',v_row->'content',jsonb_build_array(jsonb_build_object('document_id',p_document_id)),false,true) returning id into v_id;
    v_ids:=array_append(v_ids,v_id);
  end loop;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_meta from jsonb_each(coalesce(p_document_metadata,'{}'::jsonb))
    where key in ('analysis_plan','analysis_progress','coverage','batch_exam_report','primary_subject','subjects','analyzed_at');
  update public.study_documents set processing_status='ready',server_verified=true,detected_subject=p_detected_subject,
    metadata=coalesce(metadata,'{}'::jsonb)||v_meta where id=p_document_id and user_id=p_owner_id;
  return jsonb_build_object('document_id',p_document_id,'saved',cardinality(v_ids),'question_count',v_count,'status','ready','rows',(select jsonb_agg(jsonb_build_object('id',id)) from unnest(v_ids) id));
end $$;

revoke all on function public.document_question_review_rows(uuid) from public,anon,authenticated;
revoke all on function public.document_question_review_identity(jsonb) from public,anon,authenticated;
revoke all on function public.validate_document_question_review_rows(jsonb) from public,anon,authenticated;
revoke all on function public.ensure_document_review_manual_preserved(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.get_document_question_review_source(uuid) from public,anon;
revoke all on function public.stage_document_question_review(uuid,text,jsonb,jsonb) from public,anon;
revoke all on function public.apply_document_question_review(uuid) from public,anon;
revoke all on function public.cancel_document_question_review(uuid) from public,anon;
revoke all on function public.create_generated_document_content(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_document_question_review_source(uuid),public.stage_document_question_review(uuid,text,jsonb,jsonb),public.apply_document_question_review(uuid),public.cancel_document_question_review(uuid) to authenticated;
grant execute on function public.create_generated_document_content(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
