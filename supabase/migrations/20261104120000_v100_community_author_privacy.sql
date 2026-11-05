-- v100: PRIVACIDADE DO AUTOR NA BIBLIOTECA COMUNITÁRIA
-- A v99 passou a devolver, como "author_name", o nome real do cadastro (full_name/name em auth.users)
-- de quem enviou o material, para todos os usuários logados e sem que a pessoa tenha escolhido isso.
-- Agora só é exibido o nome PÚBLICO que o próprio usuário definiu no perfil (publicProfile.name), e quem
-- marcou "Ocultar meu perfil" aparece como "Colega da Comunidade". Idempotente. Rode depois da v99.

create or replace function public.get_community_exam_library(
  p_exam_name text default '',
  p_exam_org text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_slug text := public.normalize_exam_slug(p_exam_name, p_exam_org);
  v_docs jsonb;
  v_summaries jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Acervo universal: qualquer usuário autenticado acessa todos os documentos prontos
  -- compartilhados no banco, independentemente do perfil/concurso (PMPE, CBMPE, PPPE, etc.).
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'campaign_id', d.campaign_id,
        'title', public.clean_standard_doc_title(d.title),
        'document_type', d.document_type,
        'detected_subject', d.detected_subject,
        'processing_status', 'ready',
        'page_count', d.page_count,
        'metadata', jsonb_build_object(
          'primary_subject', d.metadata->>'primary_subject',
          'coverage', d.metadata->'coverage'
        ),
        'created_at', d.created_at,
        'is_community', true,
        'exam_slug', coalesce(public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')), 'universal'),
        'portal_name', coalesce(sc.name, 'Acervo Universal'),
        'author_name', case
          when coalesce(us.state->'publicProfile'->>'hidden', '') in ('true', 't', '1') then 'Colega da Comunidade'
          else coalesce(nullif(trim(left(us.state->'publicProfile'->>'name', 60)), ''), 'Colega da Comunidade')
        end
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.study_documents d
  left join public.study_campaigns sc on sc.id = d.campaign_id
  left join public.user_state us on us.user_id = d.user_id
  where d.processing_status = 'ready'
    and d.document_type not in ('edital', 'edital_concurso')
    and coalesce(d.title, '') !~* '\m(edital\s+verticalizado|edital\s+esquematizado|edital\s+sintetizado|edital\s+do\s+concurso|edital\s+de\s+abertura|edital\s+n[ºo°]|conte[uú]do\s+program[aá]tico\s+verticalizado)\M'
    and coalesce(d.source_name, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
    and coalesce(d.share_with_community, true) = true
    and coalesce(d.metadata->>'private_only', 'false') <> 'true';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'source_document_id', g.source_document_id,
        'content_type', g.content_type,
        'title', public.sanitize_personal_watermarks(g.title),
        'content', public.sanitize_generated_jsonb(g.content),
        'source_refs', g.source_refs,
        'created_at', g.created_at,
        'is_community', true,
        'exam_slug', 'universal',
        'document_type', coalesce(g.doc_type, 'material')
      )
      order by g.created_at asc
    ),
    '[]'::jsonb
  )
  into v_summaries
  from (
    select g.*, sd.document_type as doc_type
    from public.generated_study_content g
    left join public.study_campaigns sc on sc.id = g.campaign_id
    left join public.study_documents sd on sd.id = g.source_document_id
    where g.content_type in ('summary', 'question_pack')
      and coalesce(g.title, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and coalesce(g.content->>'source', '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and sd.id is not null
      and sd.document_type not in ('edital', 'edital_concurso')
      and coalesce(sd.title, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and coalesce(sd.share_with_community, true) = true
      and coalesce(sd.metadata->>'private_only', 'false') <> 'true'
    order by g.created_at desc
    limit 1000
  ) g;

  return jsonb_build_object(
    'exam_slug', 'universal',
    'documents', v_docs,
    'summaries', v_summaries,
    'edital_topics', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_community_exam_library(text, text) from public, anon;
grant execute on function public.get_community_exam_library(text, text) to authenticated, service_role;

-- Conferência: nenhum documento compartilhado deve devolver nome do cadastro.
-- select jsonb_path_query_array(public.get_community_exam_library('', ''), '$.documents[*].author_name');

-- (O complemento 'server_verified / duelo 60s' que existia aqui foi substituído pela v101: ele usava colunas
-- e funções inexistentes e marcava tudo como verificado. Se você já o executou, a v101 limpa o que ele criou.)
