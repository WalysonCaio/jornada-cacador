-- Jornada do Caçador v69 — chaves pessoais de IA (BYOK) protegidas pelo Supabase Vault.
create extension if not exists supabase_vault with schema vault;

create table if not exists public.user_ai_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini')),
  secret_id uuid not null,
  key_last_four text not null check (char_length(key_last_four) = 4),
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_ai_credentials enable row level security;
revoke all on public.user_ai_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.user_ai_credentials to service_role;

create or replace function public.store_user_ai_secret(
  p_user_id uuid,
  p_provider text,
  p_secret text,
  p_last_four text
) returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_old_secret_id uuid;
  v_secret_id uuid;
begin
  if p_provider <> 'gemini' then raise exception 'unsupported provider'; end if;
  if p_secret is null or char_length(p_secret) < 20 then raise exception 'invalid secret'; end if;

  select secret_id into v_old_secret_id
  from public.user_ai_credentials
  where user_id = p_user_id and provider = p_provider
  for update;

  if v_old_secret_id is not null then
    delete from vault.secrets where id = v_old_secret_id;
  end if;

  select vault.create_secret(
    p_secret,
    'jornada_' || p_provider || '_' || p_user_id::text,
    'Chave pessoal do usuário para o Jornada do Caçador'
  ) into v_secret_id;

  insert into public.user_ai_credentials(user_id, provider, secret_id, key_last_four, validated_at, updated_at)
  values (p_user_id, p_provider, v_secret_id, right(p_last_four, 4), now(), now())
  on conflict (user_id, provider) do update set
    secret_id = excluded.secret_id,
    key_last_four = excluded.key_last_four,
    validated_at = now(),
    updated_at = now();

  return jsonb_build_object('configured', true, 'provider', p_provider, 'last_four', right(p_last_four, 4));
end;
$$;

create or replace function public.get_user_ai_secret(p_user_id uuid, p_provider text)
returns text
language sql
security definer
set search_path = public, vault, pg_temp
stable
as $$
  select decrypted.decrypted_secret
  from public.user_ai_credentials credential
  join vault.decrypted_secrets decrypted on decrypted.id = credential.secret_id
  where credential.user_id = p_user_id and credential.provider = p_provider
  limit 1;
$$;

create or replace function public.delete_user_ai_secret(p_user_id uuid, p_provider text)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_id uuid;
begin
  delete from public.user_ai_credentials
  where user_id = p_user_id and provider = p_provider
  returning secret_id into v_secret_id;
  if v_secret_id is null then return false; end if;
  delete from vault.secrets where id = v_secret_id;
  return true;
end;
$$;

create or replace function public.cleanup_user_ai_vault_secret()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;

drop trigger if exists cleanup_user_ai_vault_secret_trigger on public.user_ai_credentials;
create trigger cleanup_user_ai_vault_secret_trigger
after delete on public.user_ai_credentials
for each row execute function public.cleanup_user_ai_vault_secret();

revoke all on function public.store_user_ai_secret(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.get_user_ai_secret(uuid,text) from public, anon, authenticated;
revoke all on function public.delete_user_ai_secret(uuid,text) from public, anon, authenticated;
revoke all on function public.cleanup_user_ai_vault_secret() from public, anon, authenticated;
grant execute on function public.store_user_ai_secret(uuid,text,text,text) to service_role;
grant execute on function public.get_user_ai_secret(uuid,text) to service_role;
grant execute on function public.delete_user_ai_secret(uuid,text) to service_role;

