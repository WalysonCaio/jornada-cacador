-- Jornada do Caçador v57: nomes canônicos para impedir disciplinas duplicadas.
-- Não apaga materiais, resumos, questões nem progresso.

create or replace function public.jornada_subject_key(value text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(value, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

create or replace function public.jornada_canonical_subject(value text)
returns text
language sql
immutable
as $$
  select case
    when public.jornada_subject_key(value) ~ '^(lingua )?portugues(a)?([[:space:]]+(i|ii|iii|[1-9]))?$' then 'Língua Portuguesa'
    when public.jornada_subject_key(value) ~ '^direito constitucional' then 'Direito Constitucional'
    when public.jornada_subject_key(value) ~ '^direito administrativo' then 'Direito Administrativo'
    when public.jornada_subject_key(value) ~ '^direito processual penal' then 'Direito Processual Penal'
    when public.jornada_subject_key(value) ~ '^direito penal' then 'Direito Penal'
    when public.jornada_subject_key(value) ~ '^(raciocinio logico( matematico)?|matematica e rlm|rlm)' then 'Raciocínio Lógico-Matemático'
    when public.jornada_subject_key(value) ~ '^(informatica|nocao de informatica|nocoes de informatica)' then 'Informática'
    when public.jornada_subject_key(value) ~ '^historia de pernambuco' then 'História de Pernambuco'
    when public.jornada_subject_key(value) ~ '^(direitos humanos|direito humano)' then 'Direitos Humanos'
    else nullif(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')), '')
  end
$$;

update public.study_documents
set detected_subject = public.jornada_canonical_subject(detected_subject),
    metadata = case
      when metadata is null then metadata
      else jsonb_set(metadata, '{primary_subject}', to_jsonb(public.jornada_canonical_subject(coalesce(metadata->>'primary_subject', detected_subject))), true)
    end
where detected_subject is not null;

update public.generated_study_content
set content = jsonb_set(content, '{subject}', to_jsonb(public.jornada_canonical_subject(content->>'subject')), true)
where content_type = 'summary'
  and content ? 'subject'
  and public.jornada_canonical_subject(content->>'subject') is not null;

notify pgrst, 'reload schema';
