-- Migração v89: Ranking Geral de Caçadores (Ofensiva, Cargo/Concurso, Patente/XP, Desempenho e TAF)
-- Execute no SQL Editor do Supabase. Lista automaticamente todos os usuários já cadastrados no banco.

create or replace function public.get_hunters_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  with raw_users as (
    select
      u.id as user_id,
      coalesce(us.state, '{}'::jsonb) as st,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'name'), ''),
        nullif(trim(us.state->'hunterStats'->>'name'), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
        'Caçador'
      ) as display_name,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'role'), ''),
        nullif(trim(us.state->'hunterStats'->>'role'), ''),
        camp.name,
        nullif(trim(us.state->'customCampaign'->>'name'), ''),
        'PMPE — Soldado'
      ) as target_role,
      greatest(0, coalesce((us.state->>'streak')::int, 0)) as streak,
      greatest(
        0,
        coalesce((us.state->>'bestStreak')::int, 0),
        coalesce((us.state->>'streak')::int, 0)
      ) as best_streak,
      coalesce(us.state->>'lastStudy', '') as last_study,
      coalesce((us.state->'learning'->>'xp')::int, 0) as learning_xp,
      coalesce((us.state->'hunterStats'->>'tafReady')::int, 0) as taf_ready,
      coalesce((us.state->'hunterStats'->>'tafTotal')::int, 5) as taf_total,
      coalesce((us.state->'publicProfile'->>'hidden')::boolean, false) as is_hidden,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) as updated_at
    from auth.users u
    left join public.user_state us on us.user_id = u.id
    left join lateral (
      select sc.name
      from public.study_campaigns sc
      where sc.user_id = u.id
      order by sc.is_active desc nulls last, sc.priority asc nulls last, sc.created_at desc
      limit 1
    ) camp on true
  ),
  computed as (
    select
      ru.user_id,
      left(ru.display_name, 60) as name,
      left(ru.target_role, 80) as role,
      ru.streak,
      ru.best_streak,
      ru.last_study,
      ru.taf_ready,
      ru.taf_total,
      ru.updated_at,
      coalesce(done_stats.done_count, 0) as missions_done,
      coalesce(boss_stats.boss_count, 0) as bosses_done,
      coalesce(score_stats.q_total, 0) as questions_total,
      coalesce(score_stats.q_correct, 0) as questions_correct,
      case
        when coalesce(score_stats.q_total, 0) > 0
          then round((score_stats.q_correct::numeric / score_stats.q_total::numeric) * 100)::int
        else 0
      end as accuracy,
      greatest(
        coalesce((ru.st->'hunterStats'->>'xp')::int, 0),
        coalesce(done_stats.done_count, 0) * 100
        + coalesce(boss_stats.boss_count, 0) * 300
        + coalesce(score_stats.score_xp, 0)
        + ru.learning_xp
      ) as xp
    from raw_users ru
    left join lateral (
      select count(*)::int as done_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'done') = 'object' then ru.st->'done' else '{}'::jsonb end
      ) d
      where d.value = 'true'::jsonb
    ) done_stats on true
    left join lateral (
      select count(*)::int as boss_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'bosses') = 'object' then ru.st->'bosses' else '{}'::jsonb end
      ) b
      where b.value = 'true'::jsonb
    ) boss_stats on true
    left join lateral (
      select
        coalesce(sum(greatest(0, coalesce((s.item->>'total')::int, 0))), 0)::int as q_total,
        coalesce(sum(greatest(0, coalesce((s.item->>'correct')::int, 0))), 0)::int as q_correct,
        coalesce(
          sum(
            case
              when coalesce((s.item->>'total')::numeric, 0) > 0
                then least(40, floor((coalesce((s.item->>'correct')::numeric, 0) / (s.item->>'total')::numeric) * 40))::int
              else 0
            end
          ),
          0
        )::int as score_xp
      from jsonb_array_elements(
        case when jsonb_typeof(ru.st->'scores') = 'array' then ru.st->'scores' else '[]'::jsonb end
      ) as s(item)
    ) score_stats on true
    where ru.is_hidden = false or ru.user_id = uid
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', c.user_id,
        'is_me', (c.user_id = uid),
        'name', c.name,
        'role', c.role,
        'streak', c.streak,
        'best_streak', c.best_streak,
        'last_study', c.last_study,
        'missions_done', c.missions_done,
        'questions_total', c.questions_total,
        'questions_correct', c.questions_correct,
        'accuracy', c.accuracy,
        'xp', c.xp,
        'taf_ready', c.taf_ready,
        'taf_total', c.taf_total,
        'updated_at', c.updated_at
      )
      order by c.streak desc, c.xp desc, c.accuracy desc, c.missions_done desc, c.name asc
    ),
    '[]'::jsonb
  )
  into result
  from computed c;

  return result;
end;
$$;

revoke all on function public.get_hunters_leaderboard() from public;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;
