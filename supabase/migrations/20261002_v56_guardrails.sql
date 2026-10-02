-- Jornada do Caçador v56: proteção de edital e redações multimodais.

alter table if exists public.essay_submissions
  add column if not exists board text not null default 'geral';

-- Um portal aceita somente um edital. Para trocar, o usuário deve excluir o atual.
-- Se esta criação acusar duplicidade, exclua manualmente o edital incorreto antes
-- de executar novamente; nenhum documento é apagado automaticamente pela migração.
create unique index if not exists one_edital_per_campaign_idx
  on public.study_documents (campaign_id)
  where document_type = 'edital';

-- A mesma biblioteca privada também armazena imagens de redações.
update storage.buckets
set allowed_mime_types = array['application/pdf','image/jpeg','image/png','text/plain']
where id = 'study-documents';
