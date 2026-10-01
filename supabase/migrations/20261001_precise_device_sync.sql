-- Jornada do Caçador v47: sincronização determinística entre aparelhos.
-- Execute após as migrações anteriores.

alter table public.user_state
  add column if not exists server_revision bigint not null default 0,
  add column if not exists reset_epoch bigint not null default 0,
  add column if not exists updated_by_device text,
  add column if not exists server_updated_at timestamptz not null default now();

alter table public.user_state enable row level security;
drop policy if exists "own_user_state" on public.user_state;
create policy "own_user_state" on public.user_state for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_user_state(
  p_state jsonb,
  p_base_revision bigint,
  p_reset_epoch bigint,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_row public.user_state%rowtype;
  next_revision bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'invalid_state'; end if;
  if p_device_id is null or char_length(p_device_id) < 8 or char_length(p_device_id) > 100 then raise exception 'invalid_device'; end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into current_row from public.user_state where user_id=uid for update;

  if not found then
    insert into public.user_state(user_id,state,client_updated_at,server_revision,reset_epoch,updated_by_device,server_updated_at)
    values(uid,p_state,now(),1,greatest(0,coalesce(p_reset_epoch,0)),p_device_id,now())
    returning * into current_row;
    return jsonb_build_object('accepted',true,'revision',current_row.server_revision,'reset_epoch',current_row.reset_epoch,'state',current_row.state,'server_updated_at',current_row.server_updated_at);
  end if;

  -- Um aparelho antigo jamais pode desfazer uma redefinição feita em outro.
  if coalesce(p_reset_epoch,0) < current_row.reset_epoch then
    return jsonb_build_object('accepted',false,'reason','STALE_RESET','revision',current_row.server_revision,'reset_epoch',current_row.reset_epoch,'state',current_row.state,'server_updated_at',current_row.server_updated_at);
  end if;

  -- Controle otimista: somente quem editou a revisão atual pode publicar a próxima.
  if coalesce(p_base_revision,0) <> current_row.server_revision then
    return jsonb_build_object('accepted',false,'reason','REVISION_CONFLICT','revision',current_row.server_revision,'reset_epoch',current_row.reset_epoch,'state',current_row.state,'server_updated_at',current_row.server_updated_at);
  end if;

  next_revision := current_row.server_revision + 1;
  update public.user_state set
    state=p_state,
    client_updated_at=now(),
    server_revision=next_revision,
    reset_epoch=greatest(current_row.reset_epoch,coalesce(p_reset_epoch,0)),
    updated_by_device=p_device_id,
    server_updated_at=now()
  where user_id=uid
  returning * into current_row;

  return jsonb_build_object('accepted',true,'revision',current_row.server_revision,'reset_epoch',current_row.reset_epoch,'state',current_row.state,'server_updated_at',current_row.server_updated_at);
end $$;

revoke all on function public.sync_user_state(jsonb,bigint,bigint,text) from public, anon;
grant execute on function public.sync_user_state(jsonb,bigint,bigint,text) to authenticated;

create index if not exists user_state_revision_idx on public.user_state(user_id,server_revision);
