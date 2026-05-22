-- Fix: the live collision view fired purely on fh_delta/fa_delta > ±0.5 with
-- NO sample-size check, so it could fire on a 2-4 game transition sample —
-- the exact overfit the 20260506 recalibration removed from the CLASSIFIER.
-- The classifier requires fh_n >= 5 AND fa_n >= 5; the live view did not.
-- This recreates the view adding `ht.fh_n >= 5 AND at.fa_n >= 5` to both the
-- OVER and UNDER branches so the live signal matches its stated n>=5 design.
--
-- Found 2026-05-20: through mid-May, all 31 teams sit in INSUFFICIENT_DATA
-- (no team has cleared 5 transition games in BOTH states), yet 3 of today's
-- games had fh_delta/fa_delta > 0.5 off 4-game samples — meaning the old view
-- would have emitted a "Hammer-tier" OVER on noise had the timing aligned.
CREATE OR REPLACE VIEW public.mlb_transition_collision_today AS
WITH today_games AS (
  SELECT s.game_pk, s.official_date, s.home_team_id, s.away_team_id,
         s.home_team_name, s.away_team_name
  FROM public.mlb_schedule s
  WHERE s.official_date = CURRENT_DATE
),
team_lookup AS (
  SELECT DISTINCT s.home_team_id AS team_id, gl.team_abbr
  FROM public.mlb_game_log gl
  JOIN public.mlb_schedule s ON s.game_pk = gl.game_pk AND gl.home_away = 'home'
  WHERE gl.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
home_last_loc AS (
  SELECT t.game_pk AS today_game_pk, last.home_away AS prev_loc
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.home_team_id
  LEFT JOIN LATERAL (
    SELECT gl.home_away FROM public.mlb_game_log gl
    WHERE gl.team_abbr = tl.team_abbr AND gl.official_date < t.official_date AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC LIMIT 1
  ) last ON true
),
away_last_loc AS (
  SELECT t.game_pk AS today_game_pk, last.home_away AS prev_loc
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.away_team_id
  LEFT JOIN LATERAL (
    SELECT gl.home_away FROM public.mlb_game_log gl
    WHERE gl.team_abbr = tl.team_abbr AND gl.official_date < t.official_date AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC LIMIT 1
  ) last ON true
),
home_trend AS (
  SELECT t.game_pk AS today_game_pk, tt.fh_delta, tt.fa_delta, tt.classification, tt.fh_n, tt.fa_n
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.home_team_id
  LEFT JOIN public.mlb_team_transition_trends tt
    ON tt.team_abbr = tl.team_abbr AND tt.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
away_trend AS (
  SELECT t.game_pk AS today_game_pk, tt.fh_delta, tt.fa_delta, tt.classification, tt.fh_n, tt.fa_n
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.away_team_id
  LEFT JOIN public.mlb_team_transition_trends tt
    ON tt.team_abbr = tl.team_abbr AND tt.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
sig_stats AS (
  SELECT
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN win_pct END) AS h_win,
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN roi_pct END) AS h_roi,
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN total_picks END) AS h_n,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN win_pct END)  AS l_win,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN roi_pct END)  AS l_roi,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN total_picks END) AS l_n
  FROM public.mlb_signal_stats
  WHERE signal_key IN ('transition_collision_both_high','transition_collision_both_low')
)
SELECT
  g.game_pk, g.official_date, g.home_team_name, g.away_team_name,
  CASE
    -- OVER: home first-home-back, away first-away-out, both run-heavy in spot.
    -- NOW gated on n>=5 transition games per team to match the classifier and
    -- avoid firing on noisy small samples.
    WHEN hl.prev_loc = 'away' AND al.prev_loc = 'home'
         AND ht.fh_n >= 5 AND at.fa_n >= 5
         AND ht.fh_delta > 0.5 AND at.fa_delta > 0.5
    THEN json_build_object(
      'category','series','severity','over','signal_key','transition_collision_both_high',
      'message',
      '🌊 TRANSITION COLLISION (OVER): ' || g.home_team_name || ' first home back (avg +' ||
        ROUND(ht.fh_delta::numeric, 1) || ' R/G in transition spot, n=' || ht.fh_n || ') AND ' ||
        g.away_team_name || ' first away out (avg +' || ROUND(at.fa_delta::numeric, 1) ||
        ' R/G, n=' || at.fa_n || '). Historical ' || ROUND(ss.h_win::numeric, 1) ||
        '% OVER hit, +' || ROUND(ss.h_roi::numeric, 1) || '% ROI · n=' || ss.h_n ||
        '. Lean OVER.'
    )::text
    WHEN hl.prev_loc = 'away' AND al.prev_loc = 'home'
         AND ht.fh_n >= 5 AND at.fa_n >= 5
         AND ht.fh_delta < -0.5 AND at.fa_delta < -0.5
    THEN json_build_object(
      'category','series','severity','under','signal_key','transition_collision_both_low',
      'message',
      '🌊 TRANSITION COLLISION (UNDER): ' || g.home_team_name || ' first home back (avg ' ||
        ROUND(ht.fh_delta::numeric, 1) || ' R/G in transition spot, n=' || ht.fh_n || ') AND ' ||
        g.away_team_name || ' first away out (avg ' || ROUND(at.fa_delta::numeric, 1) ||
        ' R/G, n=' || at.fa_n || '). Historical ' || ROUND(ss.l_win::numeric, 1) ||
        '% UNDER hit, +' || ROUND(ss.l_roi::numeric, 1) || '% ROI · n=' || ss.l_n ||
        '. Lean UNDER.'
    )::text
    ELSE NULL
  END AS collision_signal,
  hl.prev_loc AS home_prev_loc, al.prev_loc AS away_prev_loc,
  ROUND(ht.fh_delta::numeric, 2) AS home_fh_delta,
  ROUND(at.fa_delta::numeric, 2) AS away_fa_delta,
  ht.classification AS home_classification,
  at.classification AS away_classification
FROM today_games g
LEFT JOIN home_last_loc hl ON hl.today_game_pk = g.game_pk
LEFT JOIN away_last_loc al ON al.today_game_pk = g.game_pk
LEFT JOIN home_trend   ht  ON ht.today_game_pk  = g.game_pk
LEFT JOIN away_trend   at  ON at.today_game_pk  = g.game_pk
CROSS JOIN sig_stats ss;

COMMENT ON VIEW public.mlb_transition_collision_today IS
  'Daily transition collision signal. Fires when home team is first-home-back, '
  'away team is first-away-out, AND both teams'' season transition deltas point '
  'the same direction (>+0.5 or <-0.5) WITH fh_n >= 5 AND fa_n >= 5 (matches the '
  'classifier''s n>=5 rule — added 20260520 to stop firing on noisy small samples). '
  'Backed by mlb_team_transition_trends (refreshed daily).';
