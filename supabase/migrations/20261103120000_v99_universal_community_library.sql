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

-- Limpa missões contaminadas por simulados/provas (enunciados de questões, cabeçalhos "Ano: 2022...", etc.) na tabela campaign_topics
delete from public.campaign_topics
where topic ~* '(assinale a alternativa|marque a alternativa|julgue os itens|alternativa\s+s$|ctconcursosonline|quest[oõ]es comentadas|gabarito preliminar|^ano:\s*\d{4}|banca:\s*|órgão:\s*)'
   or subject ~* '(assinale a alternativa|marque a alternativa|alternativa\s+s$|ctconcursosonline|^ano:\s*\d{4})'
   or length(coalesce(topic, '')) > 240;

-- Corrige documentos de simulado/prova/apostila que haviam sido marcados erroneamente como 'edital' ou ficaram presos em 'processing'
update public.study_documents
set document_type = case
  when title ~* '(simulado|caderno de quest|bateria de quest)' then 'simulado'
  when title ~* '(prova|gabarito)' and title !~* 'edital' then 'prova'
  else document_type
end,
processing_status = case
  when processing_status in ('pending', 'processing') and coalesce(progress_percent, 0) >= 100 then 'ready'
  else processing_status
end
where document_type in ('edital', 'edital_concurso', 'simulado', 'prova', 'material', 'apostila');

-- =============================================================================
-- 5. BLINDAGEM DE EDITAL INDIVIDUAL POR USUÁRIO E PERFIL (PM PE, BCM PE, CBM PE, ETC.)
-- Garante que CADA usuário tenha seu próprio edital privado em seu perfil,
-- sem nunca compartilhar o edital com outros usuários, mantendo apenas os
-- materiais de estudo, leis, anotações, provas e simulados compartilhados.
-- =============================================================================

-- Reconhece tanto CBM PE quanto BCM PE na normalização de siglas
create or replace function public.normalize_exam_slug(p_name text, p_org text default '')
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text := lower( coalesce(p_name, '') || ' ' || coalesce(p_org, '') );
begin
  raw := translate(raw, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  if raw ~ '\m(pp\s*pe|policia\s+penal.*pernambuco|policial\s+penal.*pe)\M' then return 'pppe'; end if;
  if raw ~ '\m(pm\s*pe|policia\s+militar.*pernambuco)\M' then return 'pmpe'; end if;
  if raw ~ '\m(pc\s*pe|policia\s+civil.*pernambuco)\M' then return 'pcpe'; end if;
  if raw ~ '\m(cbm\s*pe|bcm\s*pe|bombeiro.*pernambuco)\M' then return 'cbmpe'; end if;
  if raw ~ '\m(prf|policia\s+rodoviaria\s+federal)\M' then return 'prf'; end if;
  if raw ~ '\m(pf|policia\s+federal)\M' then return 'pf'; end if;
  return coalesce(nullif(regexp_replace(raw, '[^a-z0-9]+', '-', 'g'), ''), 'geral');
end;
$$;

-- Marca todos os editais existentes como 100% privados (share_with_community = false)
update public.study_documents
set document_type = 'edital',
    share_with_community = false,
    metadata = jsonb_set(
      jsonb_set(coalesce(metadata, '{}'::jsonb), '{share_with_community}', 'false'::jsonb, true),
      '{private_only}',
      'true'::jsonb,
      true
    )
where document_type in ('edital', 'edital_concurso')
   or (
     document_type not in ('prova', 'simulado')
     and title ~* '\m(edital\s+verticalizado|edital\s+esquematizado|edital\s+sintetizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
   );

-- Remove qualquer conteúdo comunitário gerado a partir de documento de edital
delete from public.generated_study_content g
using public.study_documents sd
where g.source_document_id = sd.id
  and sd.document_type in ('edital', 'edital_concurso');

-- Garante que nenhum tópico de edital em campaign_topics pertença a um user_id diferente do dono da campanha
delete from public.campaign_topics ct
using public.study_campaigns sc
where ct.campaign_id = sc.id
  and ct.user_id <> sc.user_id;

-- Limpa de user_state quaisquer missões que tenham vazado da comunidade ('edital-comm-%')
-- ou de usuários que ainda não enviaram seu próprio edital em study_documents / campaign_topics
update public.user_state us
set state = jsonb_set(us.state, '{customCampaign,missions}', '[]'::jsonb, true)
where jsonb_typeof(us.state #> '{customCampaign,missions}') = 'array'
  and jsonb_array_length(us.state #> '{customCampaign,missions}') > 0
  and (
    exists (
      select 1
      from jsonb_array_elements(us.state #> '{customCampaign,missions}') as m
      where coalesce(m->>'id', '') like 'edital-comm-%'
    )
    or (
      not exists (select 1 from public.campaign_topics ct where ct.user_id = us.user_id)
      and not exists (
        select 1 from public.study_documents sd
        where sd.user_id = us.user_id
          and sd.document_type in ('edital', 'edital_concurso')
      )
    )
  );

-- Reforça políticas RLS estritas (auth.uid() = user_id) nas tabelas individuais
do $$
declare
  t text;
begin
  foreach t in array array['study_campaigns', 'campaign_topics', 'study_documents', 'generated_study_content', 'essay_submissions', 'user_state'] loop
    execute format('alter table if exists public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows_all" on public.%I', t);
    execute format('create policy "own_rows_all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
