-- Jornada do Caçador v46: segurança, filas, consumo de IA e sessões de foco.
-- Pode ser executada mais de uma vez no SQL Editor do Supabase.

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.study_campaigns(id) on delete set null,
  operation text not null check (operation in ('assistant','material','edital','exam','review')),
  provider text,
  model text,
  status text not null default 'started' check (status in ('started','success','error','limited','cached')),
  input_units integer not null default 0 check (input_units >= 0),
  output_units integer not null default 0 check (output_units >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.study_campaigns(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  job_type text not null check (job_type in ('material','edital','exam')),
  status text not null default 'queued' check (status in ('queued','processing','retry','completed','failed','cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, job_type)
);

create table if not exists public.document_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  sha256 text not null check (char_length(sha256) = 64),
  byte_size bigint not null check (byte_size between 1 and 52428800),
  created_at timestamptz not null default now(),
  unique(user_id, sha256)
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.study_campaigns(id) on delete set null,
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  confirmed_seconds integer not null default 0 check (confirmed_seconds between 0 and 43200),
  status text not null default 'running' check (status in ('running','paused','completed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_events enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.document_fingerprints enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.audit_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ai_usage_events','processing_jobs','document_fingerprints','focus_sessions','audit_events'] loop
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('create policy "own_rows_select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- O cliente pode gerenciar somente as próprias sessões. Filas, consumo e auditoria
-- são gravados exclusivamente pelas Edge Functions com service_role.
drop policy if exists "own_focus_insert" on public.focus_sessions;
create policy "own_focus_insert" on public.focus_sessions for insert to authenticated
with check (auth.uid() = user_id);
drop policy if exists "own_focus_update" on public.focus_sessions;
create policy "own_focus_update" on public.focus_sessions for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists ai_usage_user_day_idx on public.ai_usage_events(user_id, created_at desc);
create index if not exists jobs_ready_idx on public.processing_jobs(status, available_at);
create index if not exists jobs_user_idx on public.processing_jobs(user_id, created_at desc);
create index if not exists focus_user_idx on public.focus_sessions(user_id, started_at desc);
create unique index if not exists one_running_focus_per_user on public.focus_sessions(user_id) where status = 'running';
create index if not exists audit_user_idx on public.audit_events(user_id, created_at desc);

-- Visão segura usada pelo painel de diagnóstico/consumo.
create or replace view public.my_ai_usage_daily
with (security_invoker = true) as
select
  user_id,
  (created_at at time zone 'America/Sao_Paulo')::date as usage_day,
  operation,
  count(*) filter (where status in ('success','cached'))::integer as successful,
  count(*) filter (where status in ('error','limited'))::integer as failed,
  coalesce(sum(input_units),0)::bigint as input_units,
  coalesce(sum(output_units),0)::bigint as output_units
from public.ai_usage_events
group by user_id, (created_at at time zone 'America/Sao_Paulo')::date, operation;

grant select on public.my_ai_usage_daily to authenticated;

-- Limites padrão: 5 PDFs/editais/provas e 40 perguntas por dia.
-- Retorna uma decisão atômica e registra a tentativa para impedir corrida de cliques.
create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_campaign_id uuid,
  p_operation text,
  p_daily_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  active_jobs integer;
  event_id bigint;
begin
  if p_user_id is null or p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'not_authorized';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_operation));
  select count(*) into used from public.ai_usage_events
   where user_id=p_user_id and operation=p_operation
     and status in ('started','success','cached')
     and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if used >= greatest(1,p_daily_limit) then
    insert into public.ai_usage_events(user_id,campaign_id,operation,status,error_code)
    values(p_user_id,p_campaign_id,p_operation,'limited','DAILY_LIMIT');
    return jsonb_build_object('allowed',false,'used',used,'limit',p_daily_limit,'reason','DAILY_LIMIT');
  end if;
  if p_operation <> 'assistant' then
    select count(*) into active_jobs from public.ai_usage_events
     where user_id=p_user_id and operation in ('material','edital','exam') and status='started'
       and created_at > now()-interval '20 minutes';
    if active_jobs > 0 then
      return jsonb_build_object('allowed',false,'used',used,'limit',p_daily_limit,'reason','BUSY');
    end if;
  end if;
  insert into public.ai_usage_events(user_id,campaign_id,operation,status)
  values(p_user_id,p_campaign_id,p_operation,'started') returning id into event_id;
  return jsonb_build_object('allowed',true,'event_id',event_id,'used',used+1,'limit',p_daily_limit);
end $$;

revoke all on function public.reserve_ai_usage(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,text,integer) to service_role;

-- Reforço adicional: user_id e campaign_id devem sempre pertencer ao mesmo usuário.
create or replace function public.validate_owned_campaign() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.campaign_id is not null and not exists (
    select 1 from public.study_campaigns c where c.id=new.campaign_id and c.user_id=new.user_id
  ) then raise exception 'campaign_not_owned'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['campaign_topics','study_documents','document_chunks','generated_study_content','ai_conversations','ai_usage_events','processing_jobs','focus_sessions'] loop
    execute format('drop trigger if exists validate_owned_campaign on public.%I',t);
    execute format('create trigger validate_owned_campaign before insert or update on public.%I for each row execute function public.validate_owned_campaign()',t);
  end loop;
end $$;
