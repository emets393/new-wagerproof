-- Fix: signal_performance had TWO writers and the destructive one ran last.
--
-- SYMPTOM (owner, 2026-10-06): the Legacy Model card showed "1-0, 100%" when the flags say 2-1,
-- the record moved 1-1 -> 1-0, and a game played the previous night never appeared.
--
-- CAUSE. refresh_signal_performance() did `delete from signal_performance where season = p_season`
-- and rebuilt NFL game signals from nfl_slate_picks via unnest(p.signal_keys) — counting a signal
-- only when it was attached to a PUBLISHED PICK CARD as a SUPPORT key. A signal on a
-- "projection only" card, or one filed under counter_signal_keys, counted for nothing.
-- Meanwhile research/nfl-extreme-outcomes/grade_nfl_sharp_flags.py grades EVERY row of
-- nfl_slate_flags on its own side/line and upserts. pg_cron `football-grade-daily`
-- (30 13,16 * 8-12,1-2 *) calls run_football_daily_grading -> refresh_all_signal_performance ->
-- this function, so it was the LAST WRITER TWICE A DAY and clobbered the flag-level grade every
-- time. Verified: job last ran 2026-10-06 16:30:00.322 and signal_performance.updated_at was
-- 16:30:00.333 — the same millisecond.
-- Reordering cannot fix it: the cron runs twice daily, grade_week.sh weekly.
--
-- MEASURED: legacy_primetime 2026 published n=1 (1-0). The three played wk4 flags are
--   PIT -3  CLE 27 PIT 24  -> LOSS (by exactly 3)
--   CAR +3.5 CAR 32 DET 26 -> WIN
--   ATL +1   NO 24 ATL 45  -> WIN      => 2-1.
--
-- FIX. One writer per domain: the flag grader owns NFL game signals; this function keeps props
-- and CFB. The season delete now spares NFL rows whose signal_key exists in nfl_slate_flags.

CREATE OR REPLACE FUNCTION public.refresh_signal_performance(p_season integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  -- Leave NFL GAME-SIGNAL rows alone: grade_nfl_sharp_flags.py owns them. This used to wipe the
  -- whole season and rebuild every NFL game signal from nfl_slate_picks.signal_keys, i.e. counting
  -- a signal ONLY when it was stapled to a published pick card as a SUPPORT key. Signals on
  -- "projection only" cards and signals filed under counter_signal_keys counted for nothing, so
  -- legacy_primetime published 1-0 when the flags say 2-1 (wk4 2026: PIT -3 lost by exactly 3,
  -- CAR +3.5 won, ATL +1 won). pg_cron football-grade-daily runs at 13:30 AND 16:30 UTC and was
  -- therefore the last writer every day, clobbering the flag-level grade.
  delete from public.signal_performance
  where season = p_season
    and not (sport = 'nfl'
             and signal_key in (select distinct signal_key
                                from public.nfl_slate_flags
                                where season = p_season));

  -- NFL game signals are NOT rebuilt here any more. research/nfl-extreme-outcomes/
  -- grade_nfl_sharp_flags.py grades EVERY row of nfl_slate_flags on its own side and line and
  -- upserts them. That is the correct denominator: every signal that fired, not only the ones a
  -- pick card happened to carry. Props and CFB below are unchanged.

  -- ============ NFL player-prop signals (P12/P13, future prop flags) ============
  insert into public.signal_performance
    (sport, signal_key, season, n, wins, losses, pushes, hit_rate, units, roi, last_week)
  with av as (
    select distinct event_id, player_id, market, actual_value
    from public.nfl_player_props
    where actual_value is not null and season = p_season
  ),
  graded as (
    select d.signal_key, dp.week,
           case
             -- anytime_td is a YES/NO market: NULL line, actual_value = TDs scored
             when dp.market = 'player_anytime_td' then
               case when av.actual_value >= 1 then 'win' else 'loss' end
             when d.bet_direction ilike '%under%' then
               case when av.actual_value < dp.close_line then 'win'
                    when av.actual_value = dp.close_line then 'push' else 'loss' end
             else
               case when av.actual_value > dp.close_line then 'win'
                    when av.actual_value = dp.close_line then 'push' else 'loss' end
           end as result,
           case when dp.market = 'player_anytime_td' then dp.over_price
                when d.bet_direction ilike '%under%' then dp.under_price
                else dp.over_price end as price
    from public.nfl_slate_props dp
    cross join lateral unnest(dp.flags) as f(flag)
    join public.nfl_signal_defs d
      on d.market = 'player_prop' and split_part(d.signal_key,'_',1) = f.flag
    join av on av.event_id = dp.event_id and av.player_id = dp.player_id and av.market = dp.market
    where dp.season = p_season
  )
  select 'nfl', signal_key, p_season,
         count(*),
         count(*) filter (where result='win'),
         count(*) filter (where result='loss'),
         count(*) filter (where result='push'),
         (count(*) filter (where result='win'))::numeric
           / nullif(count(*) filter (where result in ('win','loss')),0),
         sum(case result when 'win' then public.amer_profit(price) when 'loss' then -1.0 else 0.0 end),
         sum(case result when 'win' then public.amer_profit(price) when 'loss' then -1.0 else 0.0 end)
           / nullif(count(*),0),
         max(week)
  from graded
  group by signal_key;

  -- ============ CFB game signals ============
  insert into public.signal_performance
    (sport, signal_key, season, n, wins, losses, pushes, hit_rate, units, roi, last_week)
  select 'cfb', sk, p_season,
         count(*),
         count(*) filter (where p.result='win'),
         count(*) filter (where p.result='loss'),
         count(*) filter (where p.result='push'),
         (count(*) filter (where p.result='win'))::numeric
           / nullif(count(*) filter (where p.result in ('win','loss')),0),
         sum(case p.result when 'win' then public.amer_profit(p.best_odds) when 'loss' then -1.0 else 0.0 end),
         sum(case p.result when 'win' then public.amer_profit(p.best_odds) when 'loss' then -1.0 else 0.0 end)
           / nullif(count(*),0),
         max(p.week)
  from public.cfb_slate_picks p
  cross join lateral unnest(p.signal_keys) as u(sk)
  join public.cfb_signal_defs d on d.signal_key = u.sk
  where p.season = p_season and p.result in ('win','loss','push')
  group by sk;
end;
$function$

