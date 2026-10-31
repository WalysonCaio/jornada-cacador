-- v96_a: CORREÇÃO CRÍTICA DE SEGURANÇA — execute primeiro e sozinha.
-- Problema: public.cleanup_duplicate_hunter_profiles() é SECURITY DEFINER, apaga linhas de auth.users
-- e estava liberada para QUALQUER usuário logado (rpc pelo navegador). Como o nome exibido é editável pelo
-- próprio usuário, era possível provocar a exclusão da conta de outra pessoa. Ela também rodava sozinha
-- (select ...) a cada execução das migrações v92/v93/v95.
-- Correção: remove a função de exclusão e cria um RELATÓRIO somente leitura, só para o service_role.

drop function if exists public.cleanup_duplicate_hunter_profiles();

create or replace function public.report_duplicate_hunter_profiles()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome_normalizado', t.norm, 'contas', t.contas)), '[]'::jsonb)
  from (
    select b.norm,
           jsonb_agg(jsonb_build_object(
             'user_id', b.id, 'email', b.email, 'criado_em', b.created_at, 'ultimo_login', b.last_sign_in_at
           ) order by b.created_at) as contas
    from (
      select u.id, u.email, u.created_at, u.last_sign_in_at,
             public.normalize_hunter_name(coalesce(
               nullif(trim(us.state->'publicProfile'->>'name'), ''),
               nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
               nullif(trim(u.raw_user_meta_data->>'name'), ''),
               ''
             )) as norm
      from auth.users u
      left join public.user_state us on us.user_id = u.id
    ) b
    where b.norm <> ''
    group by b.norm
    having count(*) > 1
  ) t;
$$;

revoke all on function public.report_duplicate_hunter_profiles() from public, anon, authenticated;
grant execute on function public.report_duplicate_hunter_profiles() to service_role;

-- Conferência (deve retornar 0 linhas):
-- select grantee, privilege_type from information_schema.routine_privileges
--  where routine_name = 'cleanup_duplicate_hunter_profiles';
