-- Jornada do Caçador v74
-- Remove um documento e, se ele for edital, o mapa correspondente na mesma
-- transação. A Edge Function já validou senha e propriedade antes da chamada.

create or replace function public.delete_user_study_document(
  p_user_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.study_documents%rowtype;
  deleted_topics integer := 0;
begin
  if p_user_id is null or p_document_id is null or auth.role() <> 'service_role' then
    raise exception 'not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into target
  from public.study_documents
  where id = p_document_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  if target.document_type in ('edital', 'edital_concurso') and target.campaign_id is not null then
    delete from public.campaign_topics
    where campaign_id = target.campaign_id and user_id = p_user_id;
    get diagnostics deleted_topics = row_count;
  end if;

  delete from public.study_documents
  where id = p_document_id and user_id = p_user_id;

  return jsonb_build_object(
    'deleted', true,
    'document_type', target.document_type,
    'campaign_id', target.campaign_id,
    'deleted_topics', deleted_topics
  );
end;
$$;

revoke all on function public.delete_user_study_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_user_study_document(uuid, uuid) to service_role;
