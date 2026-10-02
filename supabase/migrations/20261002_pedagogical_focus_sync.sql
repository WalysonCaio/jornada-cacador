-- Jornada do Caçador v48: cronômetro multiaparelho e sequência pedagógica.

alter table public.focus_sessions
  add column if not exists block_seconds integer not null default 3000,
  add column if not exists remaining_seconds integer not null default 3000,
  add column if not exists last_heartbeat_at timestamptz not null default now();

alter table public.focus_sessions drop constraint if exists focus_sessions_block_seconds_check;
alter table public.focus_sessions add constraint focus_sessions_block_seconds_check check (block_seconds between 60 and 43200);
alter table public.focus_sessions drop constraint if exists focus_sessions_remaining_seconds_check;
alter table public.focus_sessions add constraint focus_sessions_remaining_seconds_check check (remaining_seconds between 0 and 43200);

-- Sessões antigas que ficaram presas não devem bloquear o usuário.
update public.focus_sessions
set status = 'paused', ended_at = coalesce(ended_at, now()), updated_at = now()
where status = 'running' and updated_at < now() - interval '2 minutes';

alter table public.campaign_topics
  add column if not exists subject_order integer not null default 0,
  add column if not exists learning_order integer not null default 0,
  add column if not exists difficulty text not null default 'basic',
  add column if not exists prerequisite_topic text,
  add column if not exists pedagogical_reason text;

alter table public.campaign_topics drop constraint if exists campaign_topics_difficulty_check;
alter table public.campaign_topics add constraint campaign_topics_difficulty_check
  check (difficulty in ('basic','intermediate','advanced'));

create index if not exists campaign_topics_learning_idx
  on public.campaign_topics(campaign_id, subject_order, learning_order, edital_order);

create or replace function public.claim_focus_session(
  p_device_id text,
  p_campaign_id uuid default null,
  p_block_seconds integer default 3000,
  p_force boolean default false
)
returns table(id uuid, allowed boolean, resumed boolean, active_elsewhere boolean, remaining_seconds integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_running public.focus_sessions%rowtype;
  v_paused public.focus_sessions%rowtype;
  v_block integer := greatest(60, least(coalesce(p_block_seconds, 3000), 43200));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select fs.* into v_running from public.focus_sessions as fs
  where fs.user_id = v_uid and fs.status = 'running'
  order by fs.updated_at desc limit 1 for update;

  if v_running.id is not null then
    if v_running.device_id = p_device_id
       or p_force
       or coalesce(v_running.last_heartbeat_at, v_running.updated_at) < now() - interval '90 seconds' then
      update public.focus_sessions set
        device_id = p_device_id,
        campaign_id = coalesce(p_campaign_id, campaign_id),
        last_heartbeat_at = now(), updated_at = now(), ended_at = null
      where public.focus_sessions.id = v_running.id
      returning public.focus_sessions.id, true, true, false,
        public.focus_sessions.remaining_seconds
      into id, allowed, resumed, active_elsewhere, remaining_seconds;
      return next; return;
    end if;
    return query select v_running.id, false, false, true, v_running.remaining_seconds;
    return;
  end if;

  select fs.* into v_paused from public.focus_sessions as fs
  where fs.user_id = v_uid and fs.status = 'paused' and fs.remaining_seconds > 0
    and fs.started_at::date = current_date
  order by fs.updated_at desc limit 1 for update;

  if v_paused.id is not null then
    update public.focus_sessions set
      status = 'running', device_id = p_device_id,
      campaign_id = coalesce(p_campaign_id, campaign_id), ended_at = null,
      last_heartbeat_at = now(), updated_at = now()
    where public.focus_sessions.id = v_paused.id
    returning public.focus_sessions.id, true, true, false,
      public.focus_sessions.remaining_seconds
    into id, allowed, resumed, active_elsewhere, remaining_seconds;
    return next; return;
  end if;

  insert into public.focus_sessions(user_id,campaign_id,device_id,block_seconds,remaining_seconds,status,last_heartbeat_at)
  values(v_uid,p_campaign_id,p_device_id,v_block,v_block,'running',now())
  returning public.focus_sessions.id, true, false, false,
    public.focus_sessions.remaining_seconds
  into id, allowed, resumed, active_elsewhere, remaining_seconds;
  return next;
end;
$$;

create or replace function public.update_focus_session(
  p_session_id uuid,
  p_remaining_seconds integer,
  p_status text default 'running'
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_remaining integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('running','paused','completed','abandoned') then raise exception 'INVALID_STATUS'; end if;
  select greatest(0, least(p_remaining_seconds, block_seconds)) into v_remaining
  from public.focus_sessions where id=p_session_id and user_id=v_uid;
  if v_remaining is null then return false; end if;
  update public.focus_sessions set
    remaining_seconds=v_remaining,
    confirmed_seconds=greatest(0,block_seconds-v_remaining),
    status=p_status,
    ended_at=case when p_status='running' then null else now() end,
    last_heartbeat_at=now(), updated_at=now()
  where id=p_session_id and user_id=v_uid;
  return found;
end;
$$;

revoke all on function public.claim_focus_session(text,uuid,integer,boolean) from public;
revoke all on function public.update_focus_session(uuid,integer,text) from public;
grant execute on function public.claim_focus_session(text,uuid,integer,boolean) to authenticated;
grant execute on function public.update_focus_session(uuid,integer,text) to authenticated;
