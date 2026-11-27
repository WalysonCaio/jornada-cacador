-- v120: disciplina com origem rastreável.
-- (1) taxonomia oficial (disciplinas_oficiais); (2) subject_origem + colunas de proposta e backup;
-- (3) sync deixa de herdar o rótulo do pacote (só questões NOVAS são afetadas);
-- (4) heurística por palavra-chave e RPC save_subject_classification (aplica só com concordância IA + palavra-chave);
-- (5) rótulo 'manual' é intocável pela RPC.
-- Não reclassifica nada por si só: a reclassificação roda à parte (scripts manuais e Edge Function classify-subjects).

-- ───────────── (1) Taxonomia oficial ─────────────
create table if not exists public.disciplinas_oficiais (
  nome text primary key,
  ordem int not null
);

insert into public.disciplinas_oficiais (nome, ordem) values
  ('Direito Constitucional', 1), ('Direito Penal', 2), ('Direito Processual Penal', 3),
  ('Direito Administrativo', 4), ('Direito Militar', 5), ('Direitos Humanos', 6),
  ('Legislação Extravagante', 7), ('Língua Portuguesa', 8), ('Raciocínio Lógico-Matemático', 9),
  ('Informática', 10), ('História', 11), ('História de Pernambuco', 12), ('Geografia', 13),
  ('Física', 14), ('Biologia', 15), ('Redação', 16), ('Ética no Serviço Público', 17),
  ('Conteúdo Geral', 99)
on conflict (nome) do nothing;

alter table public.disciplinas_oficiais enable row level security;
drop policy if exists disciplinas_oficiais_read on public.disciplinas_oficiais;
create policy disciplinas_oficiais_read on public.disciplinas_oficiais
  for select to authenticated using (true);
revoke all on public.disciplinas_oficiais from anon;
grant select on public.disciplinas_oficiais to authenticated;

-- ───────────── (2) Colunas e restrições ─────────────
alter table public.exam_questions
  add column if not exists subject_origem text,
  add column if not exists subject_proposta text,
  add column if not exists subject_confianca text,
  add column if not exists subject_modelo text,
  add column if not exists subject_anterior text,
  add column if not exists subject_classificado_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exam_questions_subject_origem_check') then
    alter table public.exam_questions add constraint exam_questions_subject_origem_check
      check (subject_origem is null or subject_origem in ('item', 'pacote', 'padrao', 'manual', 'ia', 'mapa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exam_questions_subject_confianca_check') then
    alter table public.exam_questions add constraint exam_questions_subject_confianca_check
      check (subject_confianca is null or subject_confianca in ('alta', 'media', 'baixa'));
  end if;
end $$;

-- Backfill da origem (só escreve subject_origem; não muda o rótulo).
-- 'pacote': veio do rótulo do pacote (aproximação: rótulo igual ao do pacote).
update public.exam_questions q
   set subject_origem = 'pacote'
  from public.generated_study_content g
 where g.id = q.source_row_id
   and q.subject_origem is null
   and q.source_table = 'generated_study_content'
   and q.subject is not distinct from g.content->>'subject'
   and q.subject <> 'Conteúdo Geral';

update public.exam_questions
   set subject_origem = case when subject = 'Conteúdo Geral' then 'padrao' else 'item' end
 where subject_origem is null;

-- Linhas novas recebem a origem automaticamente.
create or replace function public.exam_questions_set_subject_origem()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.subject_origem is null then
    new.subject_origem := case when new.subject = 'Conteúdo Geral' then 'padrao' else 'item' end;
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_exam_questions_b_subject_origem on public.exam_questions;
create trigger trg_exam_questions_b_subject_origem
  before insert on public.exam_questions
  for each row execute function public.exam_questions_set_subject_origem();

-- ───────────── (3) Sync sem herança do rótulo do pacote ─────────────
-- Única mudança em relação à v116: o argumento de disciplina é só o rótulo do item.
-- O normalizador já devolve 'Conteúdo Geral' quando o valor é nulo.
create or replace function public.exam_questions_sync_gsc_row(g public.generated_study_content)
returns text[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_dtype text; v_dshare boolean; v_dmeta jsonb; v_dtitle text;
  v_share boolean := false; e jsonb; res text[] := '{}';
  v_year int; v_ci int; v_page int;
begin
  if jsonb_typeof(g.content -> 'questions') is distinct from 'array' then return res; end if;
  if g.source_document_id is not null then
    select document_type, share_with_community, metadata, title
      into v_dtype, v_dshare, v_dmeta, v_dtitle
      from public.study_documents where id = g.source_document_id;
    if found then
      v_share := public.exam_is_document_community_shared(v_dtype, v_dshare, v_dmeta);
    end if;
  end if;

  for e in select value from jsonb_array_elements(g.content -> 'questions') loop
    continue when jsonb_typeof(e) is distinct from 'object';
    v_year := case when e->>'exam_year' ~ '^\d{4}$'
                   then case when (e->>'exam_year')::int between 1980 and 2100 then (e->>'exam_year')::int end end;
    v_ci   := case when e->>'correct_index' ~ '^\d{1,2}$' then (e->>'correct_index')::int end;
    v_page := case when e->>'source_page' ~ '^\d{1,6}$' then (e->>'source_page')::int end;
    res := res || public.exam_questions_ingest(
      'generated_study_content', g.id, g.user_id, g.campaign_id, g.source_document_id, v_share,
      coalesce(nullif(e->>'_fp', ''), e->>'fingerprint'),
      e->>'board', v_year, g.title, e->>'question_number',
      nullif(e->>'subject', ''),                      -- v120: sem herança do rótulo do pacote
      e->>'topic', e->>'origin',
      coalesce(e->>'statement', e->>'question', e->>'enunciado'), e->'options', v_ci,
      e->>'key_source', e->>'quality_status', e->>'explanation', v_page,
      coalesce(nullif(e->>'source_document_title', ''), nullif(g.content->>'source', ''), v_dtitle),
      e->>'source_question_number', (e->'answer_unknown') = 'true'::jsonb
    );
  end loop;
  return res;
end
$fn$;

-- ───────────── (4) Heurística por palavra-chave (só como segunda opinião) ─────────────
-- Ordem importa: regras mais específicas primeiro. Retorna NULL quando não tem sinal suficiente.
create or replace function public.exam_subject_heuristica(p_statement text, p_topic text)
returns text
language sql
immutable
as $fn$
  select case
    when x.t ~ '(tabela[- ]verdade|proposi[çc][aã]o|proposi[çc][oõ]es|quantificador|tautolog|equival[êe]ncia l[óo]gica|probabilidade|combina[çc][oõ]es|arranjo|permuta[çc][aã]o|progress[aã]o|porcentagem|regra de tr[êe]s|m[íi]nimo m[úu]ltiplo|m[áa]ximo divisor)'
      then 'Raciocínio Lógico-Matemático'
    when x.t ~ '(windows|linux|excel|navegador|firewall|malware|v[íi]rus|phishing|sistema operacional|hardware|software|rede de computadores|endere[çc]o ip)'
      then 'Informática'
    when x.t ~ '(concord[âa]ncia|reg[êe]ncia|crase|ortografia|sintaxe|orac[aã]o|per[íi]odo composto|sinon[íi]mia|figura de linguagem|acentua[çc][aã]o|pronome|substantivo|interpreta[çc][aã]o de texto)'
      then 'Língua Portuguesa'
    when x.t ~ '(constitui[çc][aã]o federal|\mstf\M|direitos? fundamentais?|poder constituinte|emenda constitucional|controle de constitucionalidade|separa[çc][aã]o dos poderes|remédios constitucionais)'
      then 'Direito Constitucional'
    when x.t ~ '(inqu[ée]rito policial|pris[ãa]o preventiva|tribunal do j[úu]ri|a[çc][ãa]o penal|processo penal|cadeia de cust[óo]dia|prova il[íi]cita|juiz das garantias|flagrante)'
      then 'Direito Processual Penal'
    when x.t ~ '(militar|pmpe|pmce|hierarquia e disciplina|transgress[ãa]o disciplinar|c[óo]digo penal militar)'
      then 'Direito Militar'
    when x.t ~ '(improbidade|ato administrativo|poder de pol[íi]cia|licita[çc][ãa]o|lei 14\.133|lei 8\.112|agente p[úu]blico|servidor p[úu]blico)'
      then 'Direito Administrativo'
    when x.t ~ '(lei n[ºo°]?\s*\d|lei \d{4,5}|maria da penha|lei de drogas|11\.343|7\.716|9\.455|abuso de autoridade|13\.869|estatuto)'
      then 'Legislação Extravagante'
    when x.t ~ '(direitos humanos|dignidade da pessoa humana|discrimina[çc][aã]o|tortura)'
      then 'Direitos Humanos'
    when x.t ~ '(\mcrime\M|\mpena\M|tipifica|homic[íi]dio|furto|roubo|estelionato|leg[íi]tima defesa|concurso de crimes|excludente)'
      then 'Direito Penal'
    when x.t ~ '(insurrei[çc][aã]o pernambucana|guerra dos mascates|frei caneca|pernambuco.*(col[ôo]nia|s[ée]culo|hist[óo]ri))'
      then 'História de Pernambuco'
    when x.t ~ '(hist[óo]ri|col[ôo]nia|col[ôo]nial|imp[ée]rio|revolu[çc][aã]o|independ[êe]ncia do brasil|escravid[ãa]o|era vargas|ditadura militar)'
      then 'História'
    when x.t ~ '(geograf|relevo|bioma|latitude|longitude|cartograf|clima)'
      then 'Geografia'
    when x.t ~ '(f[íi]sica|velocidade|acelera[çc][aã]o|energia cin[ée]tica|termodin[âa]mica|lei de ohm|efeito joule|pot[êe]ncia el[ée]trica)'
      then 'Física'
    when x.t ~ '(c[ée]lula|gen[ée]tica|ecossistema|fotoss[íi]ntese|mitoc[ôo]ndria|\mdna\M|fisiologia)'
      then 'Biologia'
    when x.t ~ '([ée]tica no servi[çc]o|c[óo]digo de [ée]tica|conflito de interesses)'
      then 'Ética no Serviço Público'
    else null
  end
  from (select lower(coalesce(p_statement, '') || ' ' || coalesce(p_topic, '')) as t) x
$fn$;

-- ───────────── (5) RPC de classificação (service_role apenas) ─────────────
-- Regras:
--  • rótulo 'manual' nunca é alterado;
--  • disciplina fora da taxonomia oficial é recusada;
--  • aplica (origem 'ia') SÓ quando IA com confiança 'alta' concorda com a palavra-chave;
--  • caso contrário, grava a proposta em subject_proposta para revisão humana.
create or replace function public.save_subject_classification(
  p_id uuid,
  p_disciplina text,
  p_confianca text,
  p_modelo text,
  p_batch text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.exam_questions%rowtype;
  v_disc text := nullif(btrim(p_disciplina), '');
  v_conf text := case when p_confianca in ('alta', 'media', 'baixa') then p_confianca else 'baixa' end;
  v_heur text;
begin
  select * into v_row from public.exam_questions where id = p_id for update;
  if not found then return 'nao_encontrada'; end if;
  if v_row.subject_origem = 'manual' then return 'protegido_manual'; end if;

  if v_disc is null or not exists (select 1 from public.disciplinas_oficiais where nome = v_disc) then
    update public.exam_questions
       set subject_proposta = null, subject_confianca = 'baixa', subject_modelo = p_modelo,
           subject_classificado_em = now()
     where id = p_id;
    return 'invalida';
  end if;

  v_heur := public.exam_subject_heuristica(v_row.statement, v_row.topic);

  if v_conf = 'alta' and v_heur = v_disc then
    update public.exam_questions
       set subject_anterior = subject, subject = v_disc, subject_origem = 'ia',
           subject_proposta = v_disc, subject_confianca = v_conf, subject_modelo = p_modelo,
           subject_classificado_em = now()
     where id = p_id;
    return 'aplicada';
  end if;

  update public.exam_questions
     set subject_proposta = v_disc, subject_confianca = v_conf, subject_modelo = p_modelo,
         subject_classificado_em = now()
   where id = p_id;
  return 'proposta';
end
$fn$;

revoke all on function public.save_subject_classification(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_subject_classification(uuid, text, text, text, text) to service_role;

-- ───────────── Testes (rodar em um BRANCH) ─────────────
-- V1: nenhuma linha sem origem: select count(*) from exam_questions where subject_origem is null;  -- deve dar 0
-- V2: sync de uma gsc nova com item sem subject gera subject = 'Conteúdo Geral' e origem 'padrao'.
-- V3: save_subject_classification em linha 'manual' devolve 'protegido_manual' e não altera nada.
-- V4: proposta com disciplina inventada devolve 'invalida'.
-- V5: aplicação só com confiança alta E palavra-chave igual; caso contrário, 'proposta'.
