-- Wire fresh_pitcher_fade into mlb_game_signals
-- ==============================================
-- The previous migration (20260513170000) added the signal definition
-- and the helper view v_mlb_fresh_pitcher_signals, but the live
-- mlb_game_signals view (consumed by the UI) didn't include it yet.
--
-- The base mlb_game_signals view is ~67kb and produces home_signals /
-- away_signals as inline `array_remove(ARRAY[CASE ... END, ...], NULL)`
-- expressions in the top-level SELECT — it's not built from a UNION,
-- it's a literal array constructor with one CASE per signal. Inserting
-- a new CASE into that block would require rewriting the entire view
-- in this migration and carries breakage risk.
--
-- Cleaner approach used here: rename the existing view to
-- mlb_game_signals_base, then create a thin wrapper view at the
-- original name that LEFT JOINs v_mlb_fresh_pitcher_signals and
-- appends its payload to the appropriate side's signal array.
--
-- This preserves the 38-signal base logic untouched while adding the
-- new signal at the wrapper layer. Future signals discovered this way
-- can be added by extending the wrapper.

ALTER VIEW public.mlb_game_signals RENAME TO mlb_game_signals_base;

CREATE VIEW public.mlb_game_signals AS
SELECT
  base.game_pk,
  base.official_date,
  base.home_team_name,
  base.away_team_name,
  base.home_sp_name,
  base.away_sp_name,
  base.venue_name,
  base.temperature_f,
  base.wind_speed_mph,
  base.wind_direction,
  base.sky,
  -- Append fresh-pitcher fade signal to HOME if it fires for the home side
  CASE
    WHEN home_fresh.signal_payload IS NOT NULL
      THEN COALESCE(base.home_signals, ARRAY[]::text[])
           || ARRAY[home_fresh.signal_payload::text]
    ELSE base.home_signals
  END AS home_signals,
  -- Same for AWAY
  CASE
    WHEN away_fresh.signal_payload IS NOT NULL
      THEN COALESCE(base.away_signals, ARRAY[]::text[])
           || ARRAY[away_fresh.signal_payload::text]
    ELSE base.away_signals
  END AS away_signals,
  base.game_signals
FROM public.mlb_game_signals_base base
LEFT JOIN public.v_mlb_fresh_pitcher_signals home_fresh
  ON home_fresh.game_pk = base.game_pk AND home_fresh.home_away = 'home'
LEFT JOIN public.v_mlb_fresh_pitcher_signals away_fresh
  ON away_fresh.game_pk = base.game_pk AND away_fresh.home_away = 'away';

COMMENT ON VIEW public.mlb_game_signals IS
  'Wrapper over mlb_game_signals_base that appends fresh_pitcher_fade signals to home/away signal arrays. See migration 20260513170100.';
COMMENT ON VIEW public.mlb_game_signals_base IS
  'Original 67kb mlb_game_signals definition. Wrapped by public.mlb_game_signals to add fresh_pitcher_fade. Renamed 2026-05-13.';
