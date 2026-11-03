-- v98: ENDURECIMENTO DO CHAT DA GUILDA
-- Problema: a tabela hunter_guild_messages tinha uma política de INSERT direta ("auth.uid() = user_id").
-- Qualquer usuário logado podia gravar mensagens pela API REST escolhendo author_name, author_role,
-- author_xp e reply_* à vontade (personificação de outro caçador, selo de XP falso) e sem limite de envio,
-- contornando send_guild_chat_message, que monta esses campos no servidor.
-- Correção: só a função envia mensagens (com limite de 12/min e bloqueio de repetição). Apagar a própria
-- mensagem continua permitido. Execute no SQL Editor depois da v97. Idempotente.

drop policy if exists "Autenticados enviam mensagem propria na guilda" on public.hunter_guild_messages;
revoke insert, update on public.hunter_guild_messages from anon, authenticated;

create index if not exists idx_hunter_guild_messages_user_created
  on public.hunter_guild_messages (user_id, created_at desc);

create or replace function public.send_guild_chat_message(
  p_message text,
  p_channel text default 'geral',
  p_reply_to_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_clean_msg text;
  v_channel text := lower(trim(coalesce(p_channel, 'geral')));
  v_author_name text := 'Caçador';
  v_author_role text := 'PMPE — Soldado';
  v_author_xp int := 0;
  v_reply_author text := null;
  v_reply_excerpt text := null;
  v_row public.hunter_guild_messages%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_channel not in ('geral', 'duelos', 'duvidas') then
    v_channel := 'geral';
  end if;

  -- Limite de envio: no máximo 12 mensagens por minuto por usuário (evita flood no chat em tempo real).
  if (select count(*) from public.hunter_guild_messages
       where user_id = uid and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'rate_limited';
  end if;

  v_clean_msg := public.normalize_legal_orthography(
    public.sanitize_personal_watermarks(left(trim(coalesce(p_message, '')), 800))
  );

  if length(v_clean_msg) < 1 then
    raise exception 'empty_message';
  end if;

  -- Não repete a mesma mensagem em 30 segundos.
  if exists (select 1 from public.hunter_guild_messages
              where user_id = uid and message = v_clean_msg
                and created_at > now() - interval '30 seconds') then
    raise exception 'duplicate_message';
  end if;

  select
    left(coalesce(
      nullif(trim(us.state->'publicProfile'->>'name'), ''),
      nullif(trim(us.state->'hunterStats'->>'name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      'Caçador'
    ), 60),
    left(coalesce(
      nullif(trim(us.state->'publicProfile'->>'role'), ''),
      nullif(trim(us.state->'hunterStats'->>'role'), ''),
      'PMPE — Soldado'
    ), 80),
    greatest(0, coalesce(public.safe_int(us.state->'hunterStats'->>'xp', 0, 1000000), 0))
  into v_author_name, v_author_role, v_author_xp
  from auth.users u
  left join public.user_state us on us.user_id = u.id
  where u.id = uid;

  if p_reply_to_id is not null then
    select author_name, left(message, 120)
      into v_reply_author, v_reply_excerpt
      from public.hunter_guild_messages
     where id = p_reply_to_id;
  end if;

  insert into public.hunter_guild_messages (
    user_id, author_name, author_role, author_xp,
    channel, message, reply_to_id, reply_author, reply_excerpt
  )
  values (
    uid, coalesce(v_author_name, 'Caçador'), coalesce(v_author_role, 'PMPE — Soldado'), coalesce(v_author_xp, 0),
    v_channel, v_clean_msg, p_reply_to_id, v_reply_author, v_reply_excerpt
  )
  returning * into v_row;

  update public.user_state
     set server_updated_at = now()
   where user_id = uid;

  return to_jsonb(v_row) || jsonb_build_object('is_me', true);
end;
$$;

revoke all on function public.send_guild_chat_message(text, text, uuid) from public, anon;
grant execute on function public.send_guild_chat_message(text, text, uuid) to authenticated, service_role;

-- Conferências (rode manualmente):
-- select policyname, cmd from pg_policies where tablename = 'hunter_guild_messages';
--   -> deve listar leitura e exclusão, e NÃO uma política de INSERT.
-- select has_table_privilege('authenticated', 'public.hunter_guild_messages', 'INSERT');   -- false
