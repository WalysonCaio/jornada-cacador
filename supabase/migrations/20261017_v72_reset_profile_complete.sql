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
  deleted_user_state integer := 0;
begin
  if p_user_id is null or auth.role() <> 'service_role' then
    raise exception 'not_authorized';
  end if;

  -- Bloqueia duas redefinições simultâneas da mesma conta.
  perform pg_advisory_xact_lock(hashtext('reset-profile:' || p_user_id::text));

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

  delete from public.user_state where user_id = p_user_id;
  get diagnostics deleted_user_state = row_count;

  return jsonb_build_object(
    'reset', true,
    'deleted_campaigns', deleted_campaigns,
    'deleted_orphan_documents', deleted_orphan_documents,
    'deleted_conversations', deleted_conversations,
    'deleted_focus_sessions', deleted_focus_sessions,
    'deleted_user_state', deleted_user_state,
    'gemini_key_preserved', true
  );
end;
$$;

revoke all on function public.reset_user_profile_content(uuid) from public, anon, authenticated;
grant execute on function public.reset_user_profile_content(uuid) to service_role;

