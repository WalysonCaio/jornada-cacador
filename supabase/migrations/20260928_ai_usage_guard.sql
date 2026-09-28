create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (timezone('America/Recife', now()))::date,
  analyses integer not null default 0 check (analyses >= 0),
  assistant_questions integer not null default 0 check (assistant_questions >= 0),
  gemini_calls integer not null default 0 check (gemini_calls >= 0),
  groq_calls integer not null default 0 check (groq_calls >= 0),
  cache_hits integer not null default 0 check (cache_hits >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_day)
);

create table if not exists public.ai_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.study_documents(id) on delete cascade,
  job_type text not null check (job_type in ('analysis','assistant')),
  status text not null default 'queued' check (status in ('queued','processing','ready','error','limited')),
  provider text,
  request_hash text,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.study_documents add column if not exists content_hash text;
create index if not exists study_documents_user_campaign_hash_idx on public.study_documents(user_id,campaign_id,content_hash);
create index if not exists ai_jobs_user_status_idx on public.ai_processing_jobs(user_id,status,created_at);
create unique index if not exists ai_one_processing_analysis_per_user
  on public.ai_processing_jobs(user_id) where status='processing' and job_type='analysis';

alter table public.ai_daily_usage enable row level security;
alter table public.ai_processing_jobs enable row level security;
drop policy if exists ai_usage_read_own on public.ai_daily_usage;
create policy ai_usage_read_own on public.ai_daily_usage for select using (auth.uid()=user_id);
drop policy if exists ai_jobs_read_own on public.ai_processing_jobs;
create policy ai_jobs_read_own on public.ai_processing_jobs for select using (auth.uid()=user_id);

create or replace function public.claim_ai_request(
  p_user_id uuid,
  p_kind text,
  p_document_id uuid default null,
  p_request_hash text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_day date := (timezone('America/Recife', now()))::date;
  v_usage public.ai_daily_usage;
  v_job uuid;
  v_limit integer;
begin
  insert into public.ai_daily_usage(user_id,usage_day) values(p_user_id,v_day)
  on conflict(user_id,usage_day) do nothing;
  select * into v_usage from public.ai_daily_usage where user_id=p_user_id and usage_day=v_day for update;
  if v_usage.blocked_until is not null and v_usage.blocked_until>now() then
    return jsonb_build_object('allowed',false,'code','TEMP_BLOCK','blocked_until',v_usage.blocked_until);
  end if;
  if p_kind='assistant' and (select count(*) from public.ai_processing_jobs
      where user_id=p_user_id and job_type='assistant' and created_at>now()-interval '5 minutes')>=10 then
    update public.ai_daily_usage set blocked_until=now()+interval '15 minutes',updated_at=now()
      where user_id=p_user_id and usage_day=v_day;
    return jsonb_build_object('allowed',false,'code','TEMP_BLOCK','blocked_until',now()+interval '15 minutes');
  end if;
  v_limit := case when p_kind='analysis' then 3 else 30 end;
  if (p_kind='analysis' and v_usage.analyses>=v_limit) or
     (p_kind='assistant' and v_usage.assistant_questions>=v_limit) then
    return jsonb_build_object('allowed',false,'code','DAILY_LIMIT','limit',v_limit,'resets_at',(v_day+1)::timestamptz);
  end if;
  if p_kind='analysis' and exists(select 1 from public.ai_processing_jobs where user_id=p_user_id and job_type='analysis' and status='processing') then
    insert into public.ai_processing_jobs(user_id,document_id,job_type,status,request_hash)
    values(p_user_id,p_document_id,'analysis','queued',p_request_hash) returning id into v_job;
    return jsonb_build_object('allowed',false,'queued',true,'code','QUEUED','job_id',v_job);
  end if;
  if p_kind='analysis' then
    select id into v_job from public.ai_processing_jobs
      where user_id=p_user_id and document_id=p_document_id and job_type='analysis' and status='queued'
      order by created_at limit 1 for update skip locked;
    if v_job is not null then
      update public.ai_processing_jobs set status='processing',started_at=now() where id=v_job;
      update public.ai_daily_usage set analyses=analyses+1,updated_at=now() where user_id=p_user_id and usage_day=v_day;
      return jsonb_build_object('allowed',true,'job_id',v_job,'limit',v_limit);
    end if;
  end if;
  insert into public.ai_processing_jobs(user_id,document_id,job_type,status,request_hash,started_at)
  values(p_user_id,p_document_id,p_kind,'processing',p_request_hash,now()) returning id into v_job;
  if p_kind='analysis' then
    update public.ai_daily_usage set analyses=analyses+1,updated_at=now() where user_id=p_user_id and usage_day=v_day;
  else
    update public.ai_daily_usage set assistant_questions=assistant_questions+1,updated_at=now() where user_id=p_user_id and usage_day=v_day;
  end if;
  return jsonb_build_object('allowed',true,'job_id',v_job,'limit',v_limit);
exception when unique_violation then
  return jsonb_build_object('allowed',false,'queued',true,'code','QUEUED');
end $$;

create or replace function public.finish_ai_request(
  p_job_id uuid,
  p_provider text,
  p_status text default 'ready',
  p_error_code text default null
) returns void
language plpgsql security definer set search_path=public
as $$
declare v_user uuid; v_day date := (timezone('America/Recife', now()))::date;
begin
  update public.ai_processing_jobs set status=p_status,provider=p_provider,error_code=p_error_code,finished_at=now()
  where id=p_job_id returning user_id into v_user;
  if v_user is not null and p_provider in ('gemini','groq') then
    update public.ai_daily_usage
      set gemini_calls=gemini_calls+case when p_provider='gemini' then 1 else 0 end,
          groq_calls=groq_calls+case when p_provider='groq' then 1 else 0 end,
          updated_at=now()
    where user_id=v_user and usage_day=v_day;
  end if;
end $$;

revoke all on function public.claim_ai_request(uuid,text,uuid,text) from public;
revoke all on function public.finish_ai_request(uuid,text,text,text) from public;
grant execute on function public.claim_ai_request(uuid,text,uuid,text) to service_role;
grant execute on function public.finish_ai_request(uuid,text,text,text) to service_role;
