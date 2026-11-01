-- Migração Base v00: Tabela public.user_state e RLS inicial
-- Garante que o esquema completo possa ser recriado do zero apenas pelo repositório.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_revision bigint not null default 0,
  reset_epoch bigint not null default 0,
  updated_by_device text,
  server_updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "own_user_state" on public.user_state;
create policy "own_user_state"
  on public.user_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_state_revision_idx on public.user_state(user_id, server_revision);
