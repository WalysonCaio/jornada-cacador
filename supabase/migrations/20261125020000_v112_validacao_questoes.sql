-- v112: fluxo de validação das respostas de public.exam_questions
-- Não destrutivo. NUNCA altera correct_index: a comparação é feita aqui dentro.

alter table public.exam_questions
  add column if not exists validated_at timestamptz,
  add column if not exists ia_model text,
  add column if not exists ia_confianca text,
  add column if not exists validation_attempts int not null default 0,
  add column if not exists validation_error text,
  add column if not exists validation_batch text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exam_questions_ia_confianca_check') then
    alter table public.exam_questions
      add constraint exam_questions_ia_confianca_check
      check (ia_confianca is null or ia_confianca in ('alta','media','baixa'));
  end if;
end $$;

create index if not exists exam_questions_validation_queue_idx
  on public.exam_questions (gabarito_source, validation_attempts)
  where status_validacao = 'pendente' and resposta_ia is null;

create or replace function public.save_question_validation(
  p_id uuid,
  p_resposta int,          -- 0..4 ou NULL se a IA não conseguiu responder
  p_fundamento text,
  p_confianca text,
  p_model text,
  p_batch text,
  p_erro text default null
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_correct int;
  v_status text;
begin
  select correct_index into v_correct
  from public.exam_questions where id = p_id for update;
  if not found then return 'nao_encontrada'; end if;

  if p_resposta is null then
    update public.exam_questions set
      validation_attempts = validation_attempts + 1,
      validation_error = left(coalesce(p_erro, 'sem_resposta'), 300),
      validation_batch = p_batch,
      ia_model = p_model,
      validated_at = now()
    where id = p_id;
    return 'sem_resposta';
  end if;

  v_status := case
    when v_correct is null then 'pendente'        -- sem gabarito: só revisão humana
    when v_correct = p_resposta then 'verificada'
    else 'divergente'
  end;

  update public.exam_questions set
    resposta_ia = p_resposta,
    fundamento_ia = left(p_fundamento, 1500),
    ia_confianca = p_confianca,
    ia_model = p_model,
    validation_batch = p_batch,
    validated_at = now(),
    validation_error = null,
    status_validacao = v_status
  where id = p_id;

  return v_status;
end $$;

revoke all on function public.save_question_validation(uuid,int,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.save_question_validation(uuid,int,text,text,text,text,text)
  to service_role;
