-- Competition: Week 0 = unscored Practice Round.
-- The first slate of a season (CFB opening weekend) is week_no 0, is_practice.
-- It is still graded (comp_grade_week untouched) and still shows on the WEEKLY
-- leaderboard; only SEASON aggregates (p_week_id is null) exclude it.

alter table public.comp_weeks
  add column is_practice boolean not null default false;

-- renormalize existing 2026 rows: 1 -> 0 (practice), 2 -> 1, 3 -> 2.
-- Ordered ascending so the unique(season, week_no) constraint never collides.
update public.comp_weeks set week_no = 0, is_practice = true,
  label = 'Week 0 (Practice Round)' where season = 2026 and week_no = 1;
update public.comp_weeks set week_no = 1, label = 'Week 1 · Sep 5'
  where season = 2026 and week_no = 2;
update public.comp_weeks set week_no = 2, label = 'Week 2 · Sep 12'
  where season = 2026 and week_no = 3;

-- Season leaderboard ignores practice weeks (points, cover, weeks_played);
-- weekly leaderboard (p_week_id supplied) still works for week 0.
create or replace function public.comp_leaderboard(p_season int, p_week_id bigint default null)
returns table (
  rank bigint, user_id uuid, display_name text, weeks_played bigint,
  wins bigint, losses bigint, pushes bigint, points bigint, cover_points numeric
) language sql stable security definer set search_path = public, pg_temp as $$
  with graded as (
    select e.user_id,
           count(distinct e.week_id) as weeks_played,
           count(*) filter (where p.result = 'win')  as wins,
           count(*) filter (where p.result = 'loss') as losses,
           count(*) filter (where p.result = 'push') as pushes,
           coalesce(sum(p.points), 0)                as points,
           coalesce(sum(p.cover_points), 0)          as cover_points
    from public.comp_entries e
    join public.comp_weeks w on w.id = e.week_id
    join public.comp_picks p on p.entry_id = e.id and p.result is not null
    where w.season = p_season
      and (p_week_id is null or e.week_id = p_week_id)
      and (p_week_id is not null or not w.is_practice)  -- season view: skip practice
      and e.status = 'submitted'
    group by e.user_id
  )
  select rank() over (order by g.points desc, g.cover_points desc) as rank,
         g.user_id,
         coalesce(pr.display_name, pr.username, 'Player') as display_name,
         g.weeks_played, g.wins, g.losses, g.pushes, g.points, g.cover_points
  from graded g
  left join public.profiles pr on pr.user_id = g.user_id
  order by 1;
$$;
