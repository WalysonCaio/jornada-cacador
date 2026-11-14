-- v108: respeita as opções de privacidade do perfil na resposta do ranking.
-- Mantém a função de cálculo da v97 e sua assinatura JSON, sem mudar biblioteca,
-- pontuação ou ordenação. Somente a projeção pública dos campos é alterada.
do $$
begin
  if to_regprocedure('public.get_hunters_leaderboard_internal_v108()') is null then
    alter function public.get_hunters_leaderboard()
      rename to get_hunters_leaderboard_internal_v108;
  end if;
end;
$$;

-- O cálculo bruto contém campos privados e não pode ser chamado via API.
revoke all on function public.get_hunters_leaderboard_internal_v108()
  from public, anon, authenticated, service_role;

create or replace function public.get_hunters_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_result jsonb;
  result jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  raw_result := public.get_hunters_leaderboard_internal_v108();
  if jsonb_typeof(raw_result) is distinct from 'array' then
    raise exception 'invalid_leaderboard_result';
  end if;

  with rows_with_settings as (
    select
      item,
      ord,
      item->>'user_id' = uid::text as is_owner,
      coalesce(us.state->'publicProfile'->'privacy', '{}'::jsonb) as settings,
      lower(coalesce(us.state->'publicProfile'->>'hidden', 'false')) in ('true','t','1') as is_hidden
    from jsonb_array_elements(raw_result) with ordinality as r(item, ord)
    left join public.user_state us on us.user_id::text = item->>'user_id'
  ), normalized as (
    select *,
      lower(coalesce(settings->>'showTargetRole','true')) not in ('false','f','0') as show_role,
      lower(coalesce(settings->>'showStreak','true')) not in ('false','f','0') as show_streak,
      lower(coalesce(settings->>'showAccuracy','true')) not in ('false','f','0') as show_accuracy,
      lower(coalesce(settings->>'showAvatar','true')) not in ('false','f','0') as show_avatar,
      lower(coalesce(settings->>'showHours','true')) not in ('false','f','0') as show_hours,
      lower(coalesce(settings->>'showBadges','true')) not in ('false','f','0') as show_badges,
      lower(coalesce(settings->>'showBio','true')) not in ('false','f','0') as show_bio
    from rows_with_settings
  ), projected as (
    select ord,
      item
      || case when is_owner or show_role then '{}'::jsonb
         else jsonb_build_object('role',null,'secondary_role',null) end
      || case when is_owner or show_streak then '{}'::jsonb
         else jsonb_build_object('streak',null,'best_streak',null,'last_study',null) end
      || case when is_owner or show_accuracy then '{}'::jsonb
         -- Os totais também revelariam a precisão por divisão.
         else jsonb_build_object('accuracy',null,'questions_total',null,'questions_correct',null) end
      || jsonb_build_object('privacy',jsonb_build_object(
        'showTargetRole',show_role,'showStreak',show_streak,'showAccuracy',show_accuracy,
        'showAvatar',show_avatar,'showHours',show_hours,'showBadges',show_badges,'showBio',show_bio
      )) as item
    from normalized
    where is_owner or not is_hidden
  )
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into result
  from projected;

  return result;
end;
$$;

revoke all on function public.get_hunters_leaderboard() from public, anon;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;
