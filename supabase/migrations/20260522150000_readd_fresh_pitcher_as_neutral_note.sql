-- Re-add the fresh-pitcher signal as a NEUTRAL, informational note only —
-- no fade ROI, no win/loss record, no betting lean. It just flags that a
-- starter is making his first start of the season (after Apr 15) or returning
-- from a 15+ day layoff, so users know the starter carries extra uncertainty.
-- Severity 'neutral' renders as a gray chip (getSignalSeverityColor default).
--
-- Replaces the fade version retired in 20260522120000 (which failed OOS).
-- Folds into the same mlb_game_signals wrapper that carries the collision.

CREATE VIEW public.v_mlb_fresh_pitcher_signals AS
WITH pitcher_gaps AS (
  SELECT season, game_pk, official_date, home_away, pitcher_id, pitcher_name, team_name,
    official_date - lag(official_date) OVER (PARTITION BY pitcher_id, season ORDER BY official_date) AS days_off
  FROM public.mlb_starter_pregame
),
fresh AS (
  SELECT *,
    CASE
      WHEN days_off IS NULL AND official_date > make_date(season::int, 4, 15) THEN 'first_start_of_season'
      WHEN days_off >= 25 THEN 'long_il_return'
      WHEN days_off >= 15 THEN 'medium_il_return'
      ELSE NULL
    END AS spot_type
  FROM pitcher_gaps
)
SELECT game_pk, official_date, home_away, pitcher_name, team_name, days_off, spot_type,
  jsonb_build_object(
    'signal_key', 'fresh_pitcher',
    'category', 'pitcher',
    'severity', 'neutral',
    'message', pitcher_name || ' (' || team_name || ') is ' ||
      CASE spot_type
        WHEN 'first_start_of_season' THEN 'making his first start of the season'
        WHEN 'long_il_return'        THEN 'returning from a ' || days_off || '-day layoff (long IL stint)'
        WHEN 'medium_il_return'      THEN 'returning from a ' || days_off || '-day layoff'
      END,
    'spot_type', spot_type,
    'days_off', COALESCE(days_off, 0)
  ) AS signal_payload
FROM fresh
WHERE spot_type IS NOT NULL;

CREATE OR REPLACE VIEW public.mlb_game_signals AS
SELECT base.game_pk, base.official_date, base.home_team_name, base.away_team_name,
       base.home_sp_name, base.away_sp_name, base.venue_name, base.temperature_f,
       base.wind_speed_mph, base.wind_direction, base.sky,
       CASE WHEN hf.signal_payload IS NOT NULL
         THEN COALESCE(base.home_signals, ARRAY[]::text[]) || ARRAY[hf.signal_payload::text]
         ELSE base.home_signals END AS home_signals,
       CASE WHEN af.signal_payload IS NOT NULL
         THEN COALESCE(base.away_signals, ARRAY[]::text[]) || ARRAY[af.signal_payload::text]
         ELSE base.away_signals END AS away_signals,
       CASE WHEN col.collision_signal IS NOT NULL
         THEN COALESCE(base.game_signals, ARRAY[]::text[]) || ARRAY[col.collision_signal]
         ELSE base.game_signals END AS game_signals
FROM public.mlb_game_signals_base base
LEFT JOIN public.mlb_transition_collision_today col
  ON col.game_pk = base.game_pk AND col.collision_signal IS NOT NULL
LEFT JOIN public.v_mlb_fresh_pitcher_signals hf
  ON hf.game_pk = base.game_pk AND hf.home_away = 'home'
LEFT JOIN public.v_mlb_fresh_pitcher_signals af
  ON af.game_pk = base.game_pk AND af.home_away = 'away';

INSERT INTO public.mlb_signal_definitions
  (signal_key, category, severity, label, description, metric, threshold_dir, threshold_value, min_games, is_active, notes)
VALUES
  ('fresh_pitcher', 'pitcher', 'neutral', 'Fresh Pitcher',
   'Informational only: the starting pitcher is making his first start of the season (after April 15) or returning from a 15+ day layoff. No betting lean attached — flags that the starter has limited recent form for the market and models to price.',
   'fresh_pitcher_flag', 'eq', 0, 0, true,
   'Neutral note. Deliberately carries NO win/loss record or ROI — retired the fade version on 2026-05-22 after it failed out-of-sample.')
ON CONFLICT (signal_key) DO UPDATE SET
  category=EXCLUDED.category, severity=EXCLUDED.severity, label=EXCLUDED.label,
  description=EXCLUDED.description, is_active=EXCLUDED.is_active, notes=EXCLUDED.notes, updated_at=NOW();
