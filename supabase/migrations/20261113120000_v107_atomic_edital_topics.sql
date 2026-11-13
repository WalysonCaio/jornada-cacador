-- v107: mapa de edital gravado em uma única transação.
-- Preserva IDs, status e maestria de tópicos que continuam no edital, evitando
-- também o cascade de generated_study_content durante uma simples reanálise.
create or replace function public.replace_campaign_topics_atomic(
  p_user_id uuid,
  p_campaign_id uuid,
  p_document_id uuid,
  p_topics jsonb,
  p_coverage jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topics jsonb;
  v_count integer;
  v_saved integer;
  v_old_count integer;
  v_old_subjects integer;
  v_new_subjects integer;
begin
  if p_user_id is null or p_campaign_id is null or p_document_id is null
     or (coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if coalesce(jsonb_typeof(p_topics), '') <> 'array' then
    raise exception 'invalid_topics';
  end if;
  if jsonb_array_length(p_topics) not between 1 and 4000 then
    raise exception 'invalid_topics_count';
  end if;
  if p_coverage is not null and jsonb_typeof(p_coverage) <> 'object' then
    raise exception 'invalid_coverage';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_topics) as x(item)
    where jsonb_typeof(item) <> 'object'
       or coalesce(jsonb_typeof(item->'subject'), '') <> 'string'
       or coalesce(jsonb_typeof(item->'topic'), '') <> 'string'
       or length(btrim(item->>'subject')) not between 1 and 2000
       or length(btrim(item->>'topic')) not between 1 and 20000
       or coalesce(item->>'difficulty', 'basic') not in ('basic', 'intermediate', 'advanced')
  ) then
    raise exception 'invalid_topic';
  end if;

  -- Usa a mesma trava de exclusão/reset de documentos para não intercalar as
  -- operações; os locks de campanha/documento ainda conferem a propriedade.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform 1 from public.study_campaigns
    where id = p_campaign_id and user_id = p_user_id for update;
  if not found then raise exception 'campaign_not_owned' using errcode = '42501'; end if;
  perform 1 from public.study_documents
    where id = p_document_id and campaign_id = p_campaign_id and user_id = p_user_id
      and document_type in ('edital', 'edital_concurso') for update;
  if not found then raise exception 'edital_not_owned' using errcode = '42501'; end if;

  select jsonb_agg(to_jsonb(t) order by t.edital_order, t.subject, t.topic)
    into v_topics
  from (
    select distinct on (btrim(item->>'subject'), btrim(item->>'topic'))
      btrim(item->>'subject') as subject,
      btrim(item->>'topic') as topic,
      coalesce(item->>'unit_name', item->>'unit', '') as unit_name,
      greatest(0, coalesce((item->>'edital_order')::integer, (ord - 1)::integer)) as edital_order,
      greatest(0, coalesce((item->>'subject_order')::integer, 0)) as subject_order,
      greatest(0, coalesce((item->>'learning_order')::integer, (ord - 1)::integer)) as learning_order,
      coalesce(item->>'difficulty', 'basic') as difficulty,
      nullif(item->>'prerequisite_topic', '') as prerequisite_topic,
      nullif(item->>'pedagogical_reason', '') as pedagogical_reason
    from jsonb_array_elements(p_topics) with ordinality as x(item, ord)
    order by btrim(item->>'subject'), btrim(item->>'topic'), ord
  ) as t;
  v_count := jsonb_array_length(v_topics);

  -- Um resultado explicitamente parcial não pode substituir um mapa maior.
  if p_coverage->>'incomplete' = 'true' then
    select count(*), count(distinct subject) into v_old_count, v_old_subjects
      from public.campaign_topics where campaign_id = p_campaign_id and user_id = p_user_id;
    select count(distinct item->>'subject') into v_new_subjects
      from jsonb_array_elements(v_topics) as x(item);
    if v_old_count > v_count and v_old_subjects >= v_new_subjects then
      raise exception 'PARTIAL_RESULT';
    end if;
  end if;

  insert into public.campaign_topics (
    campaign_id, user_id, subject, unit_name, topic, edital_order,
    subject_order, learning_order, difficulty, prerequisite_topic, pedagogical_reason
  )
  select p_campaign_id, p_user_id, t.subject, t.unit_name, t.topic, t.edital_order,
    t.subject_order, t.learning_order, t.difficulty, t.prerequisite_topic, t.pedagogical_reason
  from jsonb_to_recordset(v_topics) as t(
    subject text, topic text, unit_name text, edital_order integer,
    subject_order integer, learning_order integer, difficulty text,
    prerequisite_topic text, pedagogical_reason text
  )
  on conflict (campaign_id, subject, topic) do update set
    unit_name = excluded.unit_name,
    edital_order = excluded.edital_order,
    subject_order = excluded.subject_order,
    learning_order = excluded.learning_order,
    difficulty = excluded.difficulty,
    prerequisite_topic = excluded.prerequisite_topic,
    pedagogical_reason = excluded.pedagogical_reason
  where public.campaign_topics.user_id = p_user_id;
  get diagnostics v_saved = row_count;
  if v_saved <> v_count then raise exception 'topics_not_confirmed'; end if;

  delete from public.campaign_topics as old
    where old.campaign_id = p_campaign_id and old.user_id = p_user_id
      and not exists (
        select 1 from jsonb_array_elements(v_topics) as x(item)
        where item->>'subject' = old.subject and item->>'topic' = old.topic
      );
  update public.study_documents
    set processing_status = 'ready',
        metadata = (coalesce(metadata, '{}'::jsonb) - 'coverage')
          || case when p_coverage is null then '{}'::jsonb
                  else jsonb_build_object('coverage', p_coverage || jsonb_build_object('summary_count', v_count)) end
    where id = p_document_id and user_id = p_user_id and campaign_id = p_campaign_id;
  if not found then raise exception 'document_not_confirmed'; end if;

  -- JSON escalar evita truncamento de SETOF pelo db-max-rows do PostgREST.
  return jsonb_build_object('saved', v_count, 'topics', (
    select jsonb_agg(to_jsonb(t) order by t.subject_order, t.learning_order, t.edital_order)
    from public.campaign_topics as t
    where t.campaign_id = p_campaign_id and t.user_id = p_user_id
  ));
end;
$$;

revoke all on function public.replace_campaign_topics_atomic(uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_campaign_topics_atomic(uuid, uuid, uuid, jsonb, jsonb) to authenticated, service_role;
