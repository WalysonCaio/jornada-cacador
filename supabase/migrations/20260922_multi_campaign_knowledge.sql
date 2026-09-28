create extension if not exists vector with schema extensions;

create table if not exists public.study_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organization text,
  state_code text,
  position_name text,
  board text,
  notice_year integer,
  exam_date date,
  priority integer not null default 1 check (priority between 1 and 5),
  daily_minutes integer not null default 60 check (daily_minutes between 10 and 720),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_topics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.study_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  unit_name text,
  topic text not null,
  edital_order integer not null default 0,
  weight numeric(6,2) not null default 1,
  status text not null default 'pending' check (status in ('pending','studying','review','mastered')),
  mastery numeric(5,2) not null default 0 check (mastery between 0 and 100),
  created_at timestamptz not null default now(),
  unique(campaign_id, subject, topic)
);

create table if not exists public.study_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.study_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  document_type text not null default 'material',
  storage_path text,
  source_url text,
  source_name text,
  version_date date,
  processing_status text not null default 'pending',
  page_count integer,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  campaign_id uuid references public.study_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_start integer,
  page_end integer,
  section_title text,
  content text not null,
  embedding extensions.vector(384),
  created_at timestamptz not null default now()
);

create table if not exists public.generated_study_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.study_campaigns(id) on delete cascade,
  topic_id uuid references public.campaign_topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('lesson','summary','bizu','mnemonic','flashcards','questions')),
  title text not null,
  content jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.study_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  mode text,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.study_campaigns enable row level security;
alter table public.campaign_topics enable row level security;
alter table public.study_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.generated_study_content enable row level security;
alter table public.ai_conversations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['study_campaigns','campaign_topics','study_documents','document_chunks','generated_study_content','ai_conversations'] loop
    execute format('drop policy if exists "own_rows_all" on public.%I', t);
    execute format('create policy "own_rows_all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-documents','study-documents',false,52428800,array['application/pdf','text/plain'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "users_manage_own_study_files" on storage.objects;
create policy "users_manage_own_study_files" on storage.objects for all to authenticated
using (bucket_id='study-documents' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='study-documents' and (storage.foldername(name))[1]=auth.uid()::text);

create index if not exists campaign_topics_campaign_idx on public.campaign_topics(campaign_id, edital_order);
create index if not exists documents_campaign_idx on public.study_documents(campaign_id);
create index if not exists chunks_document_idx on public.document_chunks(document_id);
