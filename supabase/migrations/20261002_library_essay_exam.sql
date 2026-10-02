-- Biblioteca organizada, data da prova e Central de Redação.
alter table public.study_documents
  add column if not exists detected_subject text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.essay_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.study_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  theme text not null,
  essay_type text not null,
  required_lines integer check (required_lines between 1 and 100),
  instructions text,
  storage_path text not null,
  source_name text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','ready','error')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.essay_submissions enable row level security;
drop policy if exists "own_rows_all" on public.essay_submissions;
create policy "own_rows_all" on public.essay_submissions for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists essay_submissions_campaign_idx
  on public.essay_submissions(campaign_id, created_at desc);
create index if not exists documents_folder_idx
  on public.study_documents(campaign_id, document_type, detected_subject);

drop trigger if exists validate_owned_campaign_essay_submissions on public.essay_submissions;
create trigger validate_owned_campaign_essay_submissions
before insert or update on public.essay_submissions
for each row execute function public.validate_owned_campaign();

grant select, insert, update, delete on public.essay_submissions to authenticated;
