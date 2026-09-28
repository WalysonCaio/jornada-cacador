alter table public.generated_study_content
  add column if not exists source_document_id uuid references public.study_documents(id) on delete cascade;

create index if not exists generated_content_document_idx
  on public.generated_study_content(source_document_id);
