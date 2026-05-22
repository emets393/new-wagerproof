-- Loosen the transition-collision minimum from n>=5 to n>=3 prior transition
-- games (per state). Walk-forward re-test (2023-2025) showed the earlier
-- "n<5 = noise" call was overstated:
--   OVER (both run-heavy):  n>=3 68.6%/+31.0% (51) · n>=4 71.7%/+37% · n>=5 75%/+43%
--   UNDER (both run-light):  n>=3 58.2%/+11.1% (55) · n>=4 57.1%/+9% · n>=5 58.7%/+12%
-- The UNDER side is flat across thresholds and the OVER side stays strongly
-- +EV at n>=3, so loosening surfaces real spots (e.g. CIN/STL under on
-- 2026-05-22, limiting n=3) without giving up edge. Advertised stats updated
-- to the honest n>=3 walk-forward numbers so the live message doesn't show the
-- n>=5 figures on n>=3 samples.
--
-- Supersedes the n>=5 gate from 20260506130000 (classifier) and
-- 20260520120000 (live view).

-- 1. Classifier: require >=3 (was >=5) prior transition games in each state.
CREATE OR REPLACE FUNCTION public.refresh_mlb_team_transition_trends(p_season integer DEFAULT NULL::integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_season int := COALESCE(p_season, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_count  int;
BEGIN
  WITH flagged AS (
    SELECT season, team_abbr, official_date, game_pk, home_away, runs_scored,
           LAG(home_away) OVER w AS prev_loc,
           CASE WHEN home_away <> COALESCE(LAG(home_away) OVER w, '') THEN 1 ELSE 0 END AS new_stint
    FROM public.mlb_game_log
    WHERE season = v_season AND runs_scored IS NOT NULL
    WINDOW w AS (PARTITION BY season, team_abbr ORDER BY official_date, game_pk)
  ),
  sids AS (SELECT *, SUM(new_stint) OVER (PARTITION BY season, team_abbr ORDER BY official_date, game_pk) AS sid FROM flagged),
  nb AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY season, team_abbr, sid ORDER BY official_date, game_pk) AS gn FROM sids),
  team_agg AS (
    SELECT season, team_abbr, COUNT(*) AS games_played, AVG(runs_scored) AS season_rs,
      COUNT(*) FILTER (WHERE gn=1 AND prev_loc='away') AS fh_n,
      AVG(runs_scored) FILTER (WHERE gn=1 AND prev_loc='away') AS fh_rs,
      COUNT(*) FILTER (WHERE gn=1 AND prev_loc='home') AS fa_n,
      AVG(runs_scored) FILTER (WHERE gn=1 AND prev_loc='home') AS fa_rs
    FROM nb GROUP BY season, team_abbr
  ),
  classified AS (
    SELECT *, (fh_rs - season_rs) AS fh_delta, (fa_rs - season_rs) AS fa_delta,
      CASE
        WHEN fh_n < 3 OR fa_n < 3 THEN 'INSUFFICIENT_DATA'  -- loosened 5 -> 3
        WHEN (fh_rs - season_rs) > 0.5 AND (fa_rs - season_rs) > 0.5 THEN 'BOTH_HIGH'
        WHEN (fh_rs - season_rs) < -0.5 AND (fa_rs - season_rs) < -0.5 THEN 'BOTH_LOW'
        WHEN (fh_rs - season_rs) > 0.5 THEN 'HIGH_FH'
        WHEN (fa_rs - season_rs) > 0.5 THEN 'HIGH_FA'
        WHEN (fh_rs - season_rs) < -0.5 THEN 'LOW_FH'
        WHEN (fa_rs - season_rs) < -0.5 THEN 'LOW_FA'
        ELSE 'MILD'
      END AS classification
    FROM team_agg
  )
  INSERT INTO public.mlb_team_transition_trends AS t
    (season, team_abbr, games_played, season_rs, fh_n, fh_rs, fh_delta, fa_n, fa_rs, fa_delta, classification, last_calculated_at)
  SELECT season, team_abbr, games_played, ROUND(season_rs::numeric,3),
         fh_n, ROUND(fh_rs::numeric,3), ROUND(fh_delta::numeric,3),
         fa_n, ROUND(fa_rs::numeric,3), ROUND(fa_delta::numeric,3), classification, NOW()
  FROM classified
  ON CONFLICT (season, team_abbr) DO UPDATE SET
    games_played=EXCLUDED.games_played, season_rs=EXCLUDED.season_rs,
    fh_n=EXCLUDED.fh_n, fh_rs=EXCLUDED.fh_rs, fh_delta=EXCLUDED.fh_delta,
    fa_n=EXCLUDED.fa_n, fa_rs=EXCLUDED.fa_rs, fa_delta=EXCLUDED.fa_delta,
    classification=EXCLUDED.classification, last_calculated_at=NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 2. Live view: gate on n>=3 (was n>=5) in both branches.
CREATE OR REPLACE VIEW public.mlb_transition_collision_today AS
WITH today_games AS (
  SELECT s.game_pk, s.official_date, s.home_team_id, s.away_team_id, s.home_team_name, s.away_team_name
  FROM public.mlb_schedule s WHERE s.official_date = CURRENT_DATE
),
team_lookup AS (
  SELECT DISTINCT s.home_team_id AS team_id, gl.team_abbr
  FROM public.mlb_game_log gl JOIN public.mlb_schedule s ON s.game_pk = gl.game_pk AND gl.home_away = 'home'
  WHERE gl.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
home_last_loc AS (
  SELECT t.game_pk AS today_game_pk, last.home_away AS prev_loc
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.home_team_id
  LEFT JOIN LATERAL (SELECT gl.home_away FROM public.mlb_game_log gl
    WHERE gl.team_abbr = tl.team_abbr AND gl.official_date < t.official_date AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC LIMIT 1) last ON true
),
away_last_loc AS (
  SELECT t.game_pk AS today_game_pk, last.home_away AS prev_loc
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.away_team_id
  LEFT JOIN LATERAL (SELECT gl.home_away FROM public.mlb_game_log gl
    WHERE gl.team_abbr = tl.team_abbr AND gl.official_date < t.official_date AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC LIMIT 1) last ON true
),
home_trend AS (
  SELECT t.game_pk AS today_game_pk, tt.fh_delta, tt.fa_delta, tt.classification, tt.fh_n, tt.fa_n
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.home_team_id
  LEFT JOIN public.mlb_team_transition_trends tt ON tt.team_abbr = tl.team_abbr AND tt.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
away_trend AS (
  SELECT t.game_pk AS today_game_pk, tt.fh_delta, tt.fa_delta, tt.classification, tt.fh_n, tt.fa_n
  FROM today_games t JOIN team_lookup tl ON tl.team_id = t.away_team_id
  LEFT JOIN public.mlb_team_transition_trends tt ON tt.team_abbr = tl.team_abbr AND tt.season = EXTRACT(YEAR FROM CURRENT_DATE)::int
),
sig_stats AS (
  SELECT
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN win_pct END) AS h_win,
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN roi_pct END) AS h_roi,
    MAX(CASE WHEN signal_key='transition_collision_both_high' THEN total_picks END) AS h_n,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN win_pct END)  AS l_win,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN roi_pct END)  AS l_roi,
    MAX(CASE WHEN signal_key='transition_collision_both_low' THEN total_picks END) AS l_n
  FROM public.mlb_signal_stats WHERE signal_key IN ('transition_collision_both_high','transition_collision_both_low')
)
SELECT g.game_pk, g.official_date, g.home_team_name, g.away_team_name,
  CASE
    WHEN hl.prev_loc='away' AND al.prev_loc='home' AND ht.fh_n >= 3 AND at.fa_n >= 3
         AND ht.fh_delta > 0.5 AND at.fa_delta > 0.5
    THEN json_build_object('category','series','severity','over','signal_key','transition_collision_both_high',
      'message','🌊 TRANSITION COLLISION (OVER): '||g.home_team_name||' first home back (avg +'||ROUND(ht.fh_delta::numeric,1)||' R/G in transition spot, n='||ht.fh_n||') AND '||g.away_team_name||' first away out (avg +'||ROUND(at.fa_delta::numeric,1)||' R/G, n='||at.fa_n||'). Historical '||ROUND(ss.h_win::numeric,1)||'% OVER hit, +'||ROUND(ss.h_roi::numeric,1)||'% ROI · n='||ss.h_n||'. Lean OVER.')::text
    WHEN hl.prev_loc='away' AND al.prev_loc='home' AND ht.fh_n >= 3 AND at.fa_n >= 3
         AND ht.fh_delta < -0.5 AND at.fa_delta < -0.5
    THEN json_build_object('category','series','severity','under','signal_key','transition_collision_both_low',
      'message','🌊 TRANSITION COLLISION (UNDER): '||g.home_team_name||' first home back (avg '||ROUND(ht.fh_delta::numeric,1)||' R/G in transition spot, n='||ht.fh_n||') AND '||g.away_team_name||' first away out (avg '||ROUND(at.fa_delta::numeric,1)||' R/G, n='||at.fa_n||'). Historical '||ROUND(ss.l_win::numeric,1)||'% UNDER hit, +'||ROUND(ss.l_roi::numeric,1)||'% ROI · n='||ss.l_n||'. Lean UNDER.')::text
    ELSE NULL
  END AS collision_signal,
  hl.prev_loc AS home_prev_loc, al.prev_loc AS away_prev_loc,
  ROUND(ht.fh_delta::numeric,2) AS home_fh_delta, ROUND(at.fa_delta::numeric,2) AS away_fa_delta,
  ht.classification AS home_classification, at.classification AS away_classification
FROM today_games g
LEFT JOIN home_last_loc hl ON hl.today_game_pk = g.game_pk
LEFT JOIN away_last_loc al ON al.today_game_pk = g.game_pk
LEFT JOIN home_trend ht ON ht.today_game_pk = g.game_pk
LEFT JOIN away_trend at ON at.today_game_pk = g.game_pk
CROSS JOIN sig_stats ss;

-- 3. Advertised stats -> honest n>=3 walk-forward numbers.
UPDATE public.mlb_signal_stats SET total_picks=51, wins=35, losses=16, pushes=0,
  win_pct=68.6, roi_pct=31.0, units_won=ROUND((35*0.909-16)::numeric,2),
  earliest_pick_date='2023-04-01', latest_pick_date='2025-09-30', last_calculated_at=NOW()
WHERE signal_key='transition_collision_both_high';
UPDATE public.mlb_signal_stats SET total_picks=55, wins=32, losses=23, pushes=0,
  win_pct=58.2, roi_pct=11.1, units_won=ROUND((32*0.909-23)::numeric,2),
  earliest_pick_date='2023-04-01', latest_pick_date='2025-09-30', last_calculated_at=NOW()
WHERE signal_key='transition_collision_both_low';

-- 4. Reclassify the current season under the new n>=3 rule.
SELECT public.refresh_mlb_team_transition_trends(2026);
