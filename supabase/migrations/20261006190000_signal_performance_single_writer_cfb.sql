-- Second half of the single-writer fix: CFB game signals.
--
-- 20261006180000 handed NFL game signals to grade_nfl_sharp_flags.py. The CFB block had the
-- IDENTICAL defect — rebuilt from cfb_slate_picks.signal_keys, so a signal counted only when a
-- published pick card carried it as a SUPPORT key. Measured on played 2026 games:
--   key_dog              published 16 of 42 fired
--   soft_book_gap        36 of 66
--   ret_prod_edge        48 of 78
--   portal_talent_influx 32 of 58
--   home_dog_ml          published NOTHING while firing 17 times   (truth 12-5, 70.6%)
--   conf_sunbelt_fade    published NOTHING while firing 3 times
-- It hid losers too: regime_fade_hc published n=17; on its own side it is 7-28-1 = 20.0%.
--
-- cfb_slate_flags carries the same columns as nfl_slate_flags, so one grader covers both:
--   grade_nfl_sharp_flags.py <season> cfb
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
                                where season = p_season))
    and not (sport = 'cfb'
             and signal_key in (select distinct signal_key
                                from public.cfb_slate_flags
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

  -- CFB game signals are NOT rebuilt here any more either — same defect as the NFL block.
  -- Published vs actually fired on played 2026 games: key_dog 16 of 42, soft_book_gap 36 of 66,
  -- ret_prod_edge 48 of 78, portal_talent_influx 32 of 58; home_dog_ml and conf_sunbelt_fade
  -- published NOTHING while firing 17 and 3 times. It also hid losers: regime_fade_hc published
  -- n=17 but on its own side it is 7-28-1 = 20.0%.
  -- grade_nfl_sharp_flags.py <season> cfb now owns these.
end;
$function$

