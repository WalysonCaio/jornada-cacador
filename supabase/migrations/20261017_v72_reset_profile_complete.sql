-- Jornada do Caçador v72
-- Redefinição transacional e verificável de todo o conteúdo do perfil.
-- A conta e user_ai_credentials (chave Gemini pessoal) são preservadas.

create or replace function public.reset_user_profile_content(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_campaigns integer := 0;
  deleted_orphan_documents integer := 0;
  deleted_conversations integer := 0;
  deleted_focus_sessions integer := 0;
  reset_state_revision bigint := 1;
  new_reset_epoch bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_user_id is null or auth.role() <> 'service_role' then
    raise exception 'not_authorized';
  end if;

  -- Bloqueia duas redefinições simultâneas da mesma conta.
  -- Usa a mesma trava da função sync_user_state para impedir gravações durante
  -- a redefinição.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  delete from public.focus_sessions where user_id = p_user_id;
  get diagnostics deleted_focus_sessions = row_count;

  -- Conversas antigas podem ter campaign_id nulo e, portanto, não seriam
  -- alcançadas pelo cascade da campanha.
  delete from public.ai_conversations where user_id = p_user_id;
  get diagnostics deleted_conversations = row_count;

  -- O cascade remove tópicos, documentos, chunks, conteúdo gerado, redações,
  -- fingerprints e filas vinculadas às campanhas.
  delete from public.study_campaigns where user_id = p_user_id;
  get diagnostics deleted_campaigns = row_count;

  -- Compatibilidade com documentos antigos que tenham campaign_id nulo.
  delete from public.study_documents where user_id = p_user_id;
  get diagnostics deleted_orphan_documents = row_count;

  -- Não apague a linha de sincronização. Ela funciona como uma lápide: seu
  -- reset_epoch impede que outro aparelho ainda aberto restaure dados antigos.
  insert into public.user_state (
    user_id, state, client_updated_at, server_revision, reset_epoch,
    updated_by_device, server_updated_at
  ) values (
    p_user_id, '{}'::jsonb, now(), 1, new_reset_epoch,
    'server-profile-reset', now()
  )
  on conflict (user_id) do update set
    state = '{}'::jsonb,
    client_updated_at = now(),
    server_revision = public.user_state.server_revision + 1,
    reset_epoch = greatest(public.user_state.reset_epoch + 1, new_reset_epoch),
    updated_by_device = 'server-profile-reset',
    server_updated_at = now()
  returning server_revision, reset_epoch into reset_state_revision, new_reset_epoch;

  return jsonb_build_object(
    'reset', true,
    'deleted_campaigns', deleted_campaigns,
    'deleted_orphan_documents', deleted_orphan_documents,
    'deleted_conversations', deleted_conversations,
    'deleted_focus_sessions', deleted_focus_sessions,
    'reset_state_revision', reset_state_revision,
    'reset_epoch', new_reset_epoch,
    'gemini_key_preserved', true
  );
end;
$$;

revoke all on function public.reset_user_profile_content(uuid) from public, anon, authenticated;
grant execute on function public.reset_user_profile_content(uuid) to service_role;

