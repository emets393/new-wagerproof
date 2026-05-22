-- Fresh-pitcher fade signal
-- =========================
-- BACKGROUND
-- ----------
-- When a starting pitcher is making his first start of the season (after
-- April 15) OR returning from a 15+ day layoff, AND his team is FAVORED
-- on the moneyline, fading that team (betting the opponent) is +EV.
--
-- The edge concentrates HEAVILY on favorites — moderate dogs with fresh
-- SPs are priced efficiently, so the signal only fires when fresh-SP
-- meets favorite status.
--
-- ACTUAL FADE ROI (bet opponent at their closing ML, 2023-2025)
-- -------------------------------------------------------------
--   Heavy fav (-150 or worse) with fresh SP: n=221, fade ROI +7.12%
--   Mod fav (-100 to -149) with fresh SP:    n=411, fade ROI +1.17%
--   Combined favored cohort:                  n=632, ~+3% fade ROI
--
-- Heavy-fav fade by season (the cleanest sub-bucket):
--   2023: n=83  fade ROI  +9.13%
--   2024: n=70  fade ROI  -4.87%   (only down year)
--   2025: n=68  fade ROI +17.01%
--   2026: n=9   fade ROI  +6.67%   (small OOS sample, holding)
--   ► 3 of 4 seasons positive, 2026 confirming in early returns.
--
-- WHY THE MARKET MISPRICES THIS
-- -----------------------------
--   • Book uses career or projection numbers for fresh SPs (no recent
--     MLB form to model with).
--   • Public sees the FAVORITE designation and bets that side anyway
--     (team narrative, lineup recognition).
--   • Books shade lines toward the public-favorite side without enough
--     adjustment for SP uncertainty.
--   • Fresh SPs allow more runs than projected (rust, command issues,
--     no scouting tape for opposing lineups).
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
--   1. Adds `fresh_pitcher_fade` to mlb_signal_definitions, scoped to
--      favored teams only (where the edge actually exists).
--   2. Creates the helper view v_mlb_fresh_pitcher_signals that returns
--      one row per (game_pk, side) when the fade is triggered.
--   3. Documents the integration steps for the regression report and
--      the mlb_game_signals view (kept out of this migration to avoid
--      breaking the 67kb mlb_game_signals view in a single change).
--
-- TRIGGER LOGIC
-- -------------
--   FRESH:    days_since_last_MLB_start >= 15
--             OR (no prior 2026 start AND today > April 15)
--   AND
--   FAVORED:  team's closing ML < 0
--
-- Severity tier within the signal:
--   'strong_negative' — heavy fav (-150 or worse): +7.12% fade ROI
--   'negative'        — mod fav (-100 to -149):    +1.17% fade ROI

-- ── 1. Signal definition ────────────────────────────────────────────
INSERT INTO public.mlb_signal_definitions
  (signal_key, category, severity, label, description, metric,
   threshold_value, threshold_dir, min_games, is_active, notes)
VALUES (
  'fresh_pitcher_fade',
  'pitcher',
  'negative',
  'Fresh-Arm Favorite — Fade',
  'Starting pitcher is making first start of season (post-April-15) or returning from 15+ day layoff, AND the team is favored on the ML. Historically fading these teams returns +7.12% ROI when heavy fav (-150+, n=221) and +1.17% when mod fav (n=411). 3 of 4 seasons positive for heavy-fav fade. Combined favored cohort n=632.',
  'days_since_last_start',
  15,
  'gte',
  0,
  TRUE,
  'Bet OPPONENT at their closing ML. Strongest sub-bucket: heavy favorite (-150 or worse) with fresh SP — fade ROI +7.12% on 221 games (2023-2025), with 2025 the best year at +17.01%. 2024 was the only negative year (-4.87%). 2026 OOS holding at +6.67% on n=9.'
)
ON CONFLICT (signal_key) DO UPDATE SET
  category        = EXCLUDED.category,
  severity        = EXCLUDED.severity,
  label           = EXCLUDED.label,
  description     = EXCLUDED.description,
  metric          = EXCLUDED.metric,
  threshold_value = EXCLUDED.threshold_value,
  threshold_dir   = EXCLUDED.threshold_dir,
  notes           = EXCLUDED.notes,
  is_active       = EXCLUDED.is_active,
  updated_at      = NOW();


-- ── 2. Helper view (favored teams only) ─────────────────────────────
-- Returns one row per (game_pk, home_away) where the fade signal fires.
-- Filters to favored teams (closing_ml < 0) because dog-side fresh SPs
-- are priced efficiently — no edge there.

CREATE OR REPLACE VIEW public.v_mlb_fresh_pitcher_signals AS
WITH pitcher_gaps AS (
  SELECT
    sp.season,
    sp.game_pk,
    sp.official_date,
    sp.home_away,
    sp.pitcher_id,
    sp.pitcher_name,
    sp.team_name,
    sp.opponent_team_name,
    sp.official_date - LAG(sp.official_date) OVER (
      PARTITION BY sp.pitcher_id, sp.season
      ORDER BY sp.official_date
    ) AS days_off
  FROM public.mlb_starter_pregame sp
),
fresh AS (
  SELECT pg.*,
    CASE
      WHEN pg.days_off IS NULL
       AND pg.official_date > make_date(pg.season::int, 4, 15)
        THEN 'first_start_of_season'
      WHEN pg.days_off >= 25 THEN 'long_il_return'
      WHEN pg.days_off >= 15 THEN 'medium_il_return'
      ELSE NULL
    END AS spot_type
  FROM pitcher_gaps pg
),
-- Attach team_ml from the game log for favorite check; for tonight's
-- games (not yet in game_log), fall back to mlb_games_today.
ml_lookup AS (
  SELECT game_pk, home_away, closing_ml AS team_ml
  FROM public.mlb_game_log
  WHERE closing_ml IS NOT NULL
  UNION ALL
  SELECT game_pk, 'home', home_ml FROM public.mlb_games_today
  WHERE home_ml IS NOT NULL AND game_pk NOT IN (SELECT game_pk FROM public.mlb_game_log)
  UNION ALL
  SELECT game_pk, 'away', away_ml FROM public.mlb_games_today
  WHERE away_ml IS NOT NULL AND game_pk NOT IN (SELECT game_pk FROM public.mlb_game_log)
)
SELECT
  f.game_pk,
  f.official_date,
  f.home_away,
  f.pitcher_name,
  f.team_name,
  f.days_off,
  f.spot_type,
  ml.team_ml,
  -- Sub-severity by ML position
  CASE
    WHEN ml.team_ml <= -150 THEN 'strong_negative'  -- +7.12% fade ROI
    ELSE                         'negative'          -- mod fav, +1.17%
  END AS sub_severity,
  jsonb_build_object(
    'signal_key',  'fresh_pitcher_fade',
    'category',    'pitcher',
    'severity',
      CASE WHEN ml.team_ml <= -150 THEN 'strong_negative' ELSE 'negative' END,
    'message',
      f.pitcher_name || ' ('
      || f.team_name || ' @ '
      || CASE WHEN ml.team_ml > 0 THEN '+' ELSE '' END || ml.team_ml::text
      || ') is '
      || CASE f.spot_type
           WHEN 'first_start_of_season' THEN 'making his first start of the season'
           WHEN 'long_il_return'        THEN 'returning after ' || f.days_off::text || ' days off (long IL)'
           WHEN 'medium_il_return'      THEN 'returning after ' || f.days_off::text || ' days off'
         END
      || ' — fading favored teams in this spot returns '
      || CASE WHEN ml.team_ml <= -150
              THEN '+7.12% ROI (heavy fav, n=221, 3 of 4 seasons positive)'
              ELSE '+1.17% ROI (moderate fav, n=411)'
         END,
    'days_off',     COALESCE(f.days_off, 0),
    'spot_type',    f.spot_type,
    'team_ml',      ml.team_ml,
    'fade_play',    'Bet opponent at their closing ML',
    'fade_roi_pct',
      CASE WHEN ml.team_ml <= -150 THEN 7.12 ELSE 1.17 END
  ) AS signal_payload
FROM fresh f
JOIN ml_lookup ml ON ml.game_pk=f.game_pk AND ml.home_away=f.home_away
WHERE f.spot_type IS NOT NULL
  AND ml.team_ml < 0;  -- Only fire when team is FAVORED — edge doesn't exist on the dog side.

COMMENT ON VIEW public.v_mlb_fresh_pitcher_signals IS
  'Triggers the fresh_pitcher_fade signal: starting pitcher with 15+ days off (or first start of season after April 15) on a favored team. Fade ROI: +7.12% (heavy fav -150+) or +1.17% (mod fav). Filters out non-favored teams where the edge does not exist.';


-- ── 3. Follow-up integration (NOT in this migration) ────────────────
-- A. The 67kb mlb_game_signals view should be updated in a focused PR
--    to UNION in the fresh_pitcher_fade signal from this helper view:
--
--      array_append(home_signals,
--        (SELECT signal_payload FROM v_mlb_fresh_pitcher_signals
--         WHERE game_pk = gs.game_pk AND home_away='home'))
--      array_append(away_signals,
--        (SELECT signal_payload FROM v_mlb_fresh_pitcher_signals
--         WHERE game_pk = gs.game_pk AND home_away='away'))
--
-- B. scripts/mlb/mlb_daily_regression_report.py should query this view
--    when generating each day's report and append the matched messages
--    to weather_park_flags (or add a new pitcher_situational_flags
--    JSONB column on mlb_regression_report).
