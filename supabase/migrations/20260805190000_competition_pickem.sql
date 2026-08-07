-- =============================================================================
-- Weekly NFL/CFB Pick'em Competition (Pro subscribers) — MAIN instance
--
-- Product rules (owner-specified 2026-08-05):
--   * Pro subscribers only (profiles.subscription_active, or user_roles admin).
--   * 6 picks/week, spreads + totals only, any NFL/CFB mix, exactly 1 Play of
--     the Week (POTW). Win = 1 pt, POTW win = 3 pts, loss/push = 0.
--   * ONE line for everyone: consensus (avg across captured books, rounded to
--     nearest 0.5), synced hourly into comp_games by research/competition/comp_sync.py.
--   * Lines are STAMPED SERVER-SIDE at submission time — users are graded
--     against their stamped number regardless of later movement.
--   * Deadline: Friday 12:00 PM ET. Eligible games kick off AFTER the deadline
--     (window = deadline .. +4 days), which excludes TNF + weekday CFB by design.
--   * After submit: 5-minute grace window to edit (re-stamps), then hard lock.
--   * Nobody sees other users' picks until the deadline passes (RLS-enforced).
--   * Tiebreaker "Cover Points": cumulative margin vs the stamped line
--     (pick -7, win by 21 → +14; lose by 21 → -28). NOT multiplied for POTW.
--
-- All writes go through SECURITY DEFINER RPCs; direct table writes are revoked.
-- comp_weeks/comp_games rows are maintained by the sync job via service role.
-- =============================================================================

create table public.comp_weeks (
  id           bigint generated always as identity primary key,
  season       int  not null,
  week_no      int  not null,                 -- sequential competition week
  label        text not null,                 -- "Week 3 · Sep 12"
  deadline     timestamptz not null,          -- Friday 12:00 ET
  window_end   timestamptz not null,          -- deadline + 4 days (eligibility cutoff)
  status       text not null default 'upcoming'
               check (status in ('upcoming','open','locked','graded')),
  created_at   timestamptz not null default now(),
  unique (season, week_no)
);

create table public.comp_games (
  id           bigint generated always as identity primary key,
  week_id      bigint not null references public.comp_weeks(id) on delete cascade,
  sport        text not null check (sport in ('nfl','cfb')),
  event_id     text not null,                 -- Odds-API event id (or synthetic natural key)
  home_team    text not null,
  away_team    text not null,
  kickoff      timestamptz not null,
  -- current consensus lines (avg across books, rounded to 0.5; refreshed hourly)
  spread_home  numeric(5,1),                  -- home team's line, e.g. -6.5
  total        numeric(5,1),
  books_n      int,
  lines_updated_at timestamptz,
  -- finals (from Odds API /scores — same naming universe as the lines)
  home_score   int,
  away_score   int,
  is_final     boolean not null default false,
  unique (week_id, sport, event_id)
);
create index comp_games_week_idx on public.comp_games(week_id);

create table public.comp_entries (
  id             bigint generated always as identity primary key,
  week_id        bigint not null references public.comp_weeks(id) on delete cascade,
  user_id        uuid   not null,
  status         text   not null default 'draft' check (status in ('draft','submitted')),
  submitted_at   timestamptz,
  editable_until timestamptz,                 -- submitted_at + 5 min; null while draft
  created_at     timestamptz not null default now(),
  unique (week_id, user_id)
);
create index comp_entries_user_idx on public.comp_entries(user_id);

create table public.comp_picks (
  id           bigint generated always as identity primary key,
  entry_id     bigint not null references public.comp_entries(id) on delete cascade,
  game_id      bigint not null references public.comp_games(id),
  market       text not null check (market in ('spread','total')),
  side         text not null check (side in ('home','away','over','under')),
  -- the SIDE'S line as stamped at submit (away = -spread_home; over/under = total).
  -- Null while the entry is a draft.
  line         numeric(5,1),
  line_stamped_at timestamptz,
  is_potw      boolean not null default false,
  -- grading
  result       text check (result in ('win','loss','push')),
  points       int,
  cover_points numeric(6,1),
  unique (entry_id, game_id, market)
);
create index comp_picks_entry_idx on public.comp_picks(entry_id);

-- ---------------------------------------------------------------- RLS --------
alter table public.comp_weeks   enable row level security;
alter table public.comp_games   enable row level security;
alter table public.comp_entries enable row level security;
alter table public.comp_picks   enable row level security;

create policy comp_weeks_read on public.comp_weeks
  for select to authenticated using (true);
create policy comp_games_read on public.comp_games
  for select to authenticated using (true);

-- Entries: own rows always; everyone's after that week's deadline.
create policy comp_entries_read on public.comp_entries
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.comp_weeks w
               where w.id = comp_entries.week_id and now() > w.deadline)
  );

-- Picks: own always; others only after the deadline (the reveal).
create policy comp_picks_read on public.comp_picks
  for select to authenticated using (
    exists (
      select 1 from public.comp_entries e
      join public.comp_weeks w on w.id = e.week_id
      where e.id = comp_picks.entry_id
        and (e.user_id = auth.uid() or now() > w.deadline)
    )
  );

-- No direct writes from clients — RPCs only (service role bypasses RLS for sync).
revoke insert, update, delete on public.comp_weeks, public.comp_games,
  public.comp_entries, public.comp_picks from anon, authenticated;

-- ------------------------------------------------------------- helpers -------
create or replace function public.comp_is_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles
                 where user_id = p_user and subscription_active = true)
      or exists (select 1 from public.user_roles
                 where user_id = p_user and role = 'admin');
$$;

create or replace function public.comp_my_eligibility()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.comp_is_eligible(auth.uid());
$$;

-- ------------------------------------------------------ save draft picks -----
-- p_picks: jsonb array of {game_id, market, side, is_potw}. Replaces the whole
-- draft. Reverts a submitted entry to draft IF still inside the grace window
-- (stamps are cleared; resubmitting re-stamps at then-current lines).
create or replace function public.comp_save_picks(p_week_id bigint, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_week public.comp_weeks;
  v_entry public.comp_entries;
  v_n int;
  v_potw int;
  v_pick jsonb;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if not public.comp_is_eligible(v_user) then
    raise exception 'competition is for Pro subscribers';
  end if;

  select * into v_week from public.comp_weeks where id = p_week_id;
  if not found then raise exception 'unknown week'; end if;
  if now() >= v_week.deadline then raise exception 'deadline passed — this week is locked'; end if;

  if jsonb_typeof(p_picks) <> 'array' then raise exception 'picks must be an array'; end if;
  v_n := jsonb_array_length(p_picks);
  if v_n > 6 then raise exception 'max 6 picks'; end if;
  select count(*) into v_potw from jsonb_array_elements(p_picks) p
    where coalesce((p->>'is_potw')::boolean, false);
  if v_potw > 1 then raise exception 'only one Play of the Week'; end if;

  select * into v_entry from public.comp_entries
    where week_id = p_week_id and user_id = v_user;
  if not found then
    insert into public.comp_entries (week_id, user_id)
      values (p_week_id, v_user) returning * into v_entry;
  elsif v_entry.status = 'submitted' then
    if now() > v_entry.editable_until then
      raise exception 'picks are locked (edit window expired)';
    end if;
    update public.comp_entries
      set status = 'draft', submitted_at = null, editable_until = null
      where id = v_entry.id;
  end if;

  delete from public.comp_picks where entry_id = v_entry.id;
  for v_pick in select * from jsonb_array_elements(p_picks) loop
    -- game must be in this week and not kicked off
    perform 1 from public.comp_games g
      where g.id = (v_pick->>'game_id')::bigint
        and g.week_id = p_week_id and g.kickoff > now();
    if not found then raise exception 'invalid or started game %', v_pick->>'game_id'; end if;
    insert into public.comp_picks (entry_id, game_id, market, side, is_potw)
    values (
      v_entry.id,
      (v_pick->>'game_id')::bigint,
      v_pick->>'market',
      v_pick->>'side',
      coalesce((v_pick->>'is_potw')::boolean, false)
    );
  end loop;

  return jsonb_build_object('entry_id', v_entry.id, 'status', 'draft', 'n_picks', v_n);
end $$;

-- ------------------------------------------------------------- submit --------
-- Requires exactly 6 picks + exactly 1 POTW. Stamps every pick's line from the
-- CURRENT consensus in comp_games (server-side — the client never supplies a
-- line). Opens the 5-minute grace window. Resubmit within the window re-stamps.
create or replace function public.comp_submit_picks(p_week_id bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_week public.comp_weeks;
  v_entry public.comp_entries;
  v_n int; v_potw int; v_missing int;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  select * into v_week from public.comp_weeks where id = p_week_id;
  if not found then raise exception 'unknown week'; end if;
  if now() >= v_week.deadline then raise exception 'deadline passed — this week is locked'; end if;

  select * into v_entry from public.comp_entries
    where week_id = p_week_id and user_id = v_user;
  if not found then raise exception 'no picks saved yet'; end if;
  if v_entry.status = 'submitted' and now() > v_entry.editable_until then
    raise exception 'picks are locked (edit window expired)';
  end if;

  select count(*), count(*) filter (where is_potw)
    into v_n, v_potw from public.comp_picks where entry_id = v_entry.id;
  if v_n <> 6 then raise exception 'exactly 6 picks required (have %)', v_n; end if;
  if v_potw <> 1 then raise exception 'choose exactly one Play of the Week'; end if;

  -- every pick needs a live consensus line to stamp
  select count(*) into v_missing
  from public.comp_picks p join public.comp_games g on g.id = p.game_id
  where p.entry_id = v_entry.id
    and ((p.market = 'spread' and g.spread_home is null)
      or (p.market = 'total'  and g.total is null));
  if v_missing > 0 then
    raise exception 'a pick has no posted line yet — remove it or try later';
  end if;

  update public.comp_picks p
  set line = case
        when p.market = 'total' then g.total
        when p.side = 'home'    then g.spread_home
        else -g.spread_home
      end,
      line_stamped_at = now()
  from public.comp_games g
  where g.id = p.game_id and p.entry_id = v_entry.id;

  update public.comp_entries
  set status = 'submitted', submitted_at = now(), editable_until = now() + interval '5 minutes'
  where id = v_entry.id;

  return jsonb_build_object('entry_id', v_entry.id, 'status', 'submitted',
                            'editable_until', now() + interval '5 minutes');
end $$;

-- --------------------------------------------------------- leaderboard -------
-- Season standings (or one week's with p_week_id). Rank = points desc, then
-- season-long Cover Points as the tiebreaker.
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

-- --------------------------------------------------- week stats (reveal) -----
-- Most-picked games/sides. Refuses to answer before the deadline.
create or replace function public.comp_week_stats(p_week_id bigint)
returns table (
  game_id bigint, sport text, home_team text, away_team text, kickoff timestamptz,
  market text, side text, n_picks bigint, n_potw bigint
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.comp_weeks w
                 where w.id = p_week_id and now() > w.deadline) then
    raise exception 'picks are hidden until the deadline';
  end if;
  return query
  select g.id, g.sport, g.home_team, g.away_team, g.kickoff,
         p.market, p.side, count(*) as n_picks,
         count(*) filter (where p.is_potw) as n_potw
  from public.comp_picks p
  join public.comp_entries e on e.id = p.entry_id and e.status = 'submitted'
  join public.comp_games g on g.id = p.game_id
  where e.week_id = p_week_id
  group by g.id, g.sport, g.home_team, g.away_team, g.kickoff, p.market, p.side
  order by n_picks desc;
end $$;

-- ------------------------------------------------------------- grading -------
-- Service-role only (sync job). Grades every ungraded pick whose game is final.
-- Spread margin from the picked side's perspective + stamped line; total margin
-- signed toward the picked direction. Push → 0 points, 0 cover points.
create or replace function public.comp_grade_week(p_week_id bigint)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  update public.comp_picks p
  set cover_points = sub.cp,
      result = case when sub.cp > 0 then 'win' when sub.cp < 0 then 'loss' else 'push' end,
      points = case when sub.cp > 0 then (case when p.is_potw then 3 else 1 end) else 0 end
  from (
    select p2.id,
           case
             when p2.market = 'spread' and p2.side = 'home'
               then (g.home_score - g.away_score) + p2.line
             when p2.market = 'spread' and p2.side = 'away'
               then (g.away_score - g.home_score) + p2.line
             when p2.market = 'total' and p2.side = 'over'
               then (g.home_score + g.away_score) - p2.line
             else p2.line - (g.home_score + g.away_score)
           end as cp
    from public.comp_picks p2
    join public.comp_games g on g.id = p2.game_id
    join public.comp_entries e on e.id = p2.entry_id
    where e.week_id = p_week_id and e.status = 'submitted'
      and g.is_final and p2.result is null and p2.line is not null
  ) sub
  where sub.id = p.id;
  get diagnostics v_n = row_count;

  -- mark the week graded once every submitted pick has a result
  update public.comp_weeks w set status = 'graded'
  where w.id = p_week_id and now() > w.deadline
    and not exists (
      select 1 from public.comp_picks p
      join public.comp_entries e on e.id = p.entry_id
      where e.week_id = p_week_id and e.status = 'submitted' and p.result is null);
  return v_n;
end $$;

-- -------------------------------------------------------------- grants -------
grant execute on function public.comp_save_picks(bigint, jsonb)   to authenticated;
grant execute on function public.comp_submit_picks(bigint)        to authenticated;
grant execute on function public.comp_leaderboard(int, bigint)    to authenticated;
grant execute on function public.comp_week_stats(bigint)          to authenticated;
-- clients get the no-arg wrapper only (the uuid version would let a user
-- probe another user's subscription status by id)
grant execute on function public.comp_my_eligibility()            to authenticated;
revoke execute on function public.comp_is_eligible(uuid) from anon, authenticated;
revoke execute on function public.comp_grade_week(bigint) from anon, authenticated;
