-- Jornada do Caçador v52
-- Corrige a ambiguidade entre o campo retornado remaining_seconds e a coluna
-- public.focus_sessions.remaining_seconds dentro da função do cronômetro.

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

  select fs.* into v_running
  from public.focus_sessions as fs
  where fs.user_id = v_uid and fs.status = 'running'
  order by fs.updated_at desc
  limit 1 for update;

  if v_running.id is not null then
    if v_running.device_id = p_device_id
       or p_force
       or coalesce(v_running.last_heartbeat_at, v_running.updated_at) < now() - interval '90 seconds' then
      update public.focus_sessions as fs set
        device_id = p_device_id,
        campaign_id = coalesce(p_campaign_id, fs.campaign_id),
        last_heartbeat_at = now(), updated_at = now(), ended_at = null
      where fs.id = v_running.id
      returning fs.id, true, true, false, fs.remaining_seconds
      into id, allowed, resumed, active_elsewhere, remaining_seconds;
      return next; return;
    end if;
    return query select v_running.id, false, false, true, v_running.remaining_seconds;
    return;
  end if;

  select fs.* into v_paused
  from public.focus_sessions as fs
  where fs.user_id = v_uid
    and fs.status = 'paused'
    and fs.remaining_seconds > 0
    and fs.started_at::date = current_date
  order by fs.updated_at desc
  limit 1 for update;

  if v_paused.id is not null then
    update public.focus_sessions as fs set
      status = 'running', device_id = p_device_id,
      campaign_id = coalesce(p_campaign_id, fs.campaign_id), ended_at = null,
      last_heartbeat_at = now(), updated_at = now()
    where fs.id = v_paused.id
    returning fs.id, true, true, false, fs.remaining_seconds
    into id, allowed, resumed, active_elsewhere, remaining_seconds;
    return next; return;
  end if;

  insert into public.focus_sessions as fs
    (user_id,campaign_id,device_id,block_seconds,remaining_seconds,status,last_heartbeat_at)
  values(v_uid,p_campaign_id,p_device_id,v_block,v_block,'running',now())
  returning fs.id, true, false, false, fs.remaining_seconds
  into id, allowed, resumed, active_elsewhere, remaining_seconds;
  return next;
end;
$$;

revoke all on function public.claim_focus_session(text,uuid,integer,boolean) from public;
grant execute on function public.claim_focus_session(text,uuid,integer,boolean) to authenticated;
