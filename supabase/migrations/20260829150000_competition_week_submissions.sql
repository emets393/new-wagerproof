-- Browse everyone's submitted competition picks after the weekly deadline.
-- Used by the /competition "All Picks" tab (Week 0 practice included).

create or replace function public.comp_week_submissions(p_week_id bigint)
returns table (
  entry_id bigint,
  user_id uuid,
  display_name text,
  submitted_at timestamptz,
  pick_id bigint,
  game_id bigint,
  sport text,
  home_team text,
  away_team text,
  kickoff timestamptz,
  market text,
  side text,
  line numeric,
  is_potw boolean,
  result text,
  points integer
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1 from public.comp_weeks w
    where w.id = p_week_id and now() > w.deadline
  ) then
    raise exception 'picks are hidden until the deadline';
  end if;

  return query
  select
    e.id as entry_id,
    e.user_id,
    coalesce(nullif(pr.display_name, ''), nullif(pr.username, ''), 'Player') as display_name,
    e.submitted_at,
    p.id as pick_id,
    g.id as game_id,
    g.sport,
    g.home_team,
    g.away_team,
    g.kickoff,
    p.market,
    p.side,
    p.line,
    p.is_potw,
    p.result::text,
    p.points
  from public.comp_entries e
  join public.comp_picks p on p.entry_id = e.id
  join public.comp_games g on g.id = p.game_id
  left join public.profiles pr on pr.user_id = e.user_id
  where e.week_id = p_week_id
    and e.status = 'submitted'
  order by e.submitted_at nulls last, e.id, p.is_potw desc, g.kickoff, p.id;
end $$;

revoke all on function public.comp_week_submissions(bigint) from public;
grant execute on function public.comp_week_submissions(bigint) to authenticated;
