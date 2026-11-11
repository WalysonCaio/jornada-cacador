-- ============================================================================
-- Migração v105: Conformidade LGPD, Marco Civil (Art. 15) e Gestão de Incidentes
-- ============================================================================

-- 1. Registro de Consentimento Versionado (Item 15 — Art. 8º da LGPD)
create table if not exists public.user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null default '2026.11-r164',
  privacy_version text not null default '2026.11-r164',
  accepted_at timestamptz not null default now(),
  user_agent text,
  unique (user_id, terms_version, privacy_version)
);

alter table public.user_legal_consents enable row level security;
revoke all on public.user_legal_consents from anon;
grant select, insert, update on public.user_legal_consents to authenticated;

drop policy if exists "user_legal_consents_own" on public.user_legal_consents;
create policy "user_legal_consents_own"
  on public.user_legal_consents
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Registro de Incidentes de Segurança e Notificação ANPD (Itens 34 e 35 — Resolução CD/ANPD nº 15/2024)
create table if not exists public.security_incident_logs (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null,
  description text not null,
  affected_users_count integer not null default 0,
  anpd_notification_due_at timestamptz not null default (now() + interval '3 days'),
  anpd_notified_at timestamptz,
  users_notified_at timestamptz,
  mitigation_steps text,
  status text not null default 'open' check (status in ('open', 'contained', 'resolved'))
);

alter table public.security_incident_logs enable row level security;
revoke all on public.security_incident_logs from anon, authenticated;
grant all on public.security_incident_logs to service_role;

-- 3. Retenção e Expurgo de Logs de Uso após 6 meses (Item 19 — Art. 15 do Marco Civil da Internet, Lei 12.965/2014)
create or replace function public.purge_expired_operational_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if to_regclass('public.ai_usage_events') is not null then
    delete from public.ai_usage_events
    where created_at < (now() - interval '180 days');
    get diagnostics v_deleted = row_count;
  end if;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_operational_logs() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_logs() to service_role;
