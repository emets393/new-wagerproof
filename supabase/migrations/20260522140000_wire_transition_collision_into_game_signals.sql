-- Surface the transition-collision signal in mlb_game_signals.
--
-- The collision is computed in the standalone mlb_transition_collision_today
-- view, but the app reads mlb_game_signals (4 call sites: tabs/index,
-- mlb-regression-report, useMLBSeriesSignals, gameDataService) and NEVER reads
-- the collision view — so a firing collision (e.g. CIN/STL under on 2026-05-22)
-- never reached the UI's game-signal arrays.
--
-- Fix: wrap mlb_game_signals to append the collision (a game-level over/under
-- signal) to the game_signals array, mirroring the prior fresh-pitcher wrapper
-- pattern. One DB change covers all consumers; no app deploy needed.
ALTER VIEW public.mlb_game_signals RENAME TO mlb_game_signals_base;

CREATE VIEW public.mlb_game_signals AS
SELECT base.game_pk, base.official_date, base.home_team_name, base.away_team_name,
       base.home_sp_name, base.away_sp_name, base.venue_name, base.temperature_f,
       base.wind_speed_mph, base.wind_direction, base.sky,
       base.home_signals, base.away_signals,
       CASE
         WHEN col.collision_signal IS NOT NULL
           THEN COALESCE(base.game_signals, ARRAY[]::text[]) || ARRAY[col.collision_signal]
         ELSE base.game_signals
       END AS game_signals
FROM public.mlb_game_signals_base base
LEFT JOIN public.mlb_transition_collision_today col
  ON col.game_pk = base.game_pk AND col.collision_signal IS NOT NULL;

COMMENT ON VIEW public.mlb_game_signals IS
  'Wrapper over mlb_game_signals_base that appends the transition-collision '
  'signal (from mlb_transition_collision_today) to the game_signals array. '
  'Added 2026-05-22 — the standalone collision view was never consumed by the app.';
