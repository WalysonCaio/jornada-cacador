-- Jornada do Caçador v66: libera análises interrompidas pelo timeout da Edge Function.
-- Seguro para executar novamente.

update public.ai_usage_events
   set status = 'error',
       error_code = coalesce(error_code, 'STALE_INTERRUPTED')
 where status = 'started'
   and operation in ('material', 'edital', 'exam', 'review')
   and created_at < now() - interval '4 minutes';

update public.processing_jobs
   set status = 'retry',
       locked_at = null,
       locked_by = null,
       available_at = now(),
       last_error = coalesce(last_error, 'STALE_INTERRUPTED'),
       updated_at = now()
 where status = 'processing'
   and coalesce(locked_at, updated_at, created_at) < now() - interval '4 minutes';

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
  if p_user_id is null or (p_user_id <> auth.uid() and auth.role() <> 'service_role') then
    raise exception 'not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_operation));

  -- A Edge Function possui teto de 150 segundos. Após quatro minutos, um
  -- registro "started" só pode ser resto de timeout/shutdown e deve ser solto.
  update public.ai_usage_events
     set status = 'error', error_code = coalesce(error_code, 'STALE_INTERRUPTED')
   where user_id = p_user_id
     and status = 'started'
     and created_at < now() - interval '4 minutes';

  select count(*) into used
    from public.ai_usage_events
   where user_id = p_user_id
     and status = 'success'
     and (case when p_operation = 'assistant' then operation = 'assistant'
               else operation in ('material','edital','exam','review') end)
     and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  if used >= greatest(1, p_daily_limit) then
    insert into public.ai_usage_events(user_id,campaign_id,operation,status,error_code)
    values(p_user_id,p_campaign_id,p_operation,'limited','DAILY_LIMIT');
    return jsonb_build_object('allowed',false,'used',used,'limit',p_daily_limit,'reason','DAILY_LIMIT');
  end if;

  if p_operation <> 'assistant' then
    select count(*) into active_jobs
      from public.ai_usage_events
     where user_id = p_user_id
       and operation in ('material','edital','exam','review')
       and status = 'started'
       and created_at > now() - interval '4 minutes';
    if active_jobs > 0 then
      return jsonb_build_object('allowed',false,'used',used,'limit',p_daily_limit,'reason','BUSY');
    end if;
  end if;

  insert into public.ai_usage_events(user_id,campaign_id,operation,status)
  values(p_user_id,p_campaign_id,p_operation,'started') returning id into event_id;

  return jsonb_build_object('allowed',true,'event_id',event_id,'used',used,'limit',p_daily_limit);
end $$;

revoke all on function public.reserve_ai_usage(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,text,integer) to service_role;
