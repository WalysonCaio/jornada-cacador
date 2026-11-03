-- =============================================================================
-- MIGRAÇÃO v99 (2026-11-03): BIBLIOTECA COMUNITÁRIA 100% UNIVERSAL
-- 1. Remove qualquer restrição por concurso/perfil (PMPE — Soldado vs CBM PE, PPPE, etc.)
--    em public.get_community_exam_library: todo usuário autenticado no banco tem acesso
--    universal a todos os materiais de estudo, leis, anotações, provas e simulados
--    compartilhados (exceto editais, que permanecem individuais).
-- 2. Permite também que um mesmo usuário veja materiais entre seus próprios portais
--    (ex.: primário PMPE e secundário CBM PE) sem bloqueio.
-- 3. Higieniza flashcards gerados de provas/simulados ou dependentes de textos externos.
-- =============================================================================

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
        'author_name', coalesce(
          nullif(trim(us.state->'publicProfile'->>'name'), ''),
          nullif(trim(us.state->'hunterStats'->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          'Colega da Comunidade'
        )
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.study_documents d
  left join public.study_campaigns sc on sc.id = d.campaign_id
  left join auth.users u on u.id = d.user_id
  left join public.user_state us on us.user_id = d.user_id
  where d.processing_status = 'ready'
    and d.document_type not in ('edital', 'edital_concurso')
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
      and (sd.id is null or (
        sd.document_type not in ('edital', 'edital_concurso')
        and coalesce(sd.share_with_community, true) = true
        and coalesce(sd.metadata->>'private_only', 'false') <> 'true'
      ))
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

-- =============================================================================
-- 4. HIGIENIZAÇÃO PEDAGÓGICA AUTOMÁTICA NO BANCO (FLASHCARDS, RESUMOS E MNEMÔNICOS)
-- Remove cartões sem sentido sobre páginas/blocos ("Quais páginas compõem este bloco textual?",
-- "Existe conteúdo... nestas páginas específicas?"), questões de interpretação sem texto,
-- flashcards vindos de provas/simulados e mnemônicos artificiais vazios.
-- =============================================================================

create or replace function public.is_valid_pedagogical_flashcard(p_question text, p_answer text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  q text := trim(coalesce(p_question, ''));
  a text := trim(coalesce(p_answer, ''));
  qa text := lower(q || ' ' || a);
begin
  if length(q) < 10 or length(a) < 5 then
    return false;
  end if;
  -- Bloqueia metadados sobre páginas, blocos, slides ou estrutura do PDF
  if qa ~ '(bloco textual|este bloco|neste bloco|deste bloco|nestas p[aá]ginas|estas p[aá]ginas|quais p[aá]ginas|p[aá]ginas espec[ií]ficas|p[aá]ginas comp[oõ]em|neste trecho|este trecho|deste trecho|neste slide|este slide|neste pdf|este pdf|neste arquivo|este arquivo|neste documento|este documento|no trecho analisado|no bloco analisado|trecho extra[ií]do|existe conte[uú]do|h[aá] conte[uú]do|conte[uú]do .* detalhado nestas|qual o objetivo deste|o que [eé] abordado neste|composto pelas p[aá]ginas|n[aã]o h[aá] conte[uú]do|n[aã]o apresenta conte[uú]do|apenas o t[ií]tulo|somente exerc[ií]cios|quem [eé] o professor|quem [eé] o autor|qual o nome da apostila)' then
    return false;
  end if;
  if lower(q) ~ '^(existe|h[aá])\s+(conte[uú]do|explica[cç][aã]o|detalhamento|informa[cç][aã]o|men[cç][aã]o|regra|assunto|t[oó]pico)' then
    return false;
  end if;
  if lower(a) ~ '^(p[aá]ginas?\s*\d+|as p[aá]ginas\s*\d+|n[aã]o[,.;\s]|sim[,.;\s]\s*(apenas|somente)|este bloco|neste trecho)' then
    return false;
  end if;
  -- Bloqueia questões de interpretação dependentes de texto externo ou múltipla escolha
  if lower(q) ~ '(segundo o texto|de acordo com o texto|conforme o texto|no texto acima|no texto lido|leia o texto|leia o trecho|leia a tirinha|leia o poema|leia a charge|leia o fragmento|no trecho acima|no excerto|no fragmento|no \d+[º°ª]?\s*par[aá]grafo|primeiro par[aá]grafo|segundo par[aá]grafo|terceiro par[aá]grafo|[uú]ltimo par[aá]grafo|na linha \d+|nas linhas \d+|no verso \d+|nos versos \d+|o autor do texto|o narrador do texto|infere-se do texto|depreende-se do texto|conclui-se do texto|assinale a alternativa|marque a alternativa|assinale a op[cç][aã]o|marque a op[cç][aã]o|julgue os itens|analise as assertivas|analise as afirmativas|qual das alternativas|dentre as alternativas|a alternativa correta)' then
    return false;
  end if;
  return true;
end;
$$;

-- Limpa flashcards de provas/simulados/pacotes de questões no banco
update public.generated_study_content g
set content = jsonb_set(coalesce(g.content, '{}'::jsonb), '{flashcards}', '[]'::jsonb, true)
from public.study_documents sd
where g.source_document_id = sd.id
  and sd.document_type in ('prova', 'simulado', 'edital', 'edital_concurso')
  and jsonb_typeof(g.content->'flashcards') = 'array'
  and jsonb_array_length(g.content->'flashcards') > 0;

update public.generated_study_content g
set content = jsonb_set(coalesce(g.content, '{}'::jsonb), '{flashcards}', '[]'::jsonb, true)
where (g.content_type = 'question_pack' or coalesce((g.content->>'is_question_pack')::boolean, false) = true)
  and jsonb_typeof(g.content->'flashcards') = 'array'
  and jsonb_array_length(g.content->'flashcards') > 0;

-- Filtra flashcards inválidos ("bloco textual", "nestas páginas", "segundo o texto", etc.) em todos os materiais existentes
update public.generated_study_content g
set content = jsonb_set(
  g.content,
  '{flashcards}',
  coalesce(
    (
      select jsonb_agg(elem)
      from jsonb_array_elements(g.content->'flashcards') as elem
      where public.is_valid_pedagogical_flashcard(elem->>'question', elem->>'answer')
    ),
    '[]'::jsonb
  ),
  true
)
where jsonb_typeof(g.content->'flashcards') = 'array'
  and jsonb_array_length(g.content->'flashcards') > 0;

-- Limpa mnemônicos falsos/vazios ("Não há", "Nenhum", "Sem mnemônico")
update public.generated_study_content g
set content = jsonb_set(g.content, '{mnemonic}', '""'::jsonb, true)
where coalesce(g.content->>'mnemonic', '') ~* '^(n[aã]o h[aá]|nenhum|sem mnem[oô]nico|n/a|n[aã]o consta|n[aã]o informado|n[aã]o se aplica|inexistente|-|\.)$'
   or coalesce(g.content->>'mnemonic', '') ~* '(n[aã]o h[aá] mnem[oô]nico|sem mnem[oô]nico espec[ií]fico|o material n[aã]o traz mnem[oô]nico)';
