-- Recalibrate the "transition collision" signals to walk-forward backtest stats.
--
-- Why this exists:
-- The original migration (20260505120000_create_transition_collision_signal.sql)
-- recorded W/L stats computed from END-OF-SEASON team classifications. That
-- means the FH Δ and FA Δ used to label a game as a collision INCLUDED the
-- collision game itself (and every other transition game in that season).
-- Result: leakage. The original 78% / 83% win rates were inflated.
--
-- Re-ran the backtest with proper walk-forward classification:
--   • For each candidate collision game, each team's season R/G + FH R/G + FA R/G
--     was computed from games BEFORE that date only (excluding the candidate game).
--   • Required prior_fh_n >= 5 AND prior_fa_n >= 5 so we never classify on
--     <5 transition games' worth of data.
--
-- 2023-2025 walk-forward results:
--   BOTH_HIGH (over):  42 picks, 30-10-2, 75.0%, +41.1% ROI at -110, +17.27 units
--   BOTH_LOW  (under): 46 picks, 27-19-0, 58.7%, +12.1% ROI at -110,  +5.55 units
--
-- Both still have edge. BOTH_HIGH stays a "hammer-tier" signal. BOTH_LOW drops
-- to a "lean-tier" signal — real but small, not the monster the leaky version
-- suggested.
--
-- Behavioral changes in this migration:
--   1. refresh_mlb_team_transition_trends() now requires fh_n >= 5 AND fa_n >= 5
--      before classifying (was >= 2). Early-season teams will sit in
--      INSUFFICIENT_DATA until they have a real sample.
--   2. mlb_signal_definitions: bumped min_games from 3 → 5, retitled labels
--      to differentiate Hammer vs Lean tier, refreshed descriptions/notes.
--   3. mlb_signal_stats: replaced leaky stats with walk-forward stats above.
--   4. Triggers a refresh for the current season so 2026 reclassifies under
--      the new rule.

-- ---------------------------------------------------------------
-- 1. Tighten the live classifier to require >= 5 games per state
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_mlb_team_transition_trends(p_season integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_season int := COALESCE(p_season, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_count  int;
BEGIN
  -- Compute trends for v_season and upsert
  WITH flagged AS (
    SELECT season, team_abbr, official_date, game_pk, home_away, runs_scored,
           LAG(home_away) OVER w AS prev_loc,
           CASE WHEN home_away <> COALESCE(LAG(home_away) OVER w, '') THEN 1 ELSE 0 END AS new_stint
    FROM public.mlb_game_log
    WHERE season = v_season AND runs_scored IS NOT NULL
    WINDOW w AS (PARTITION BY season, team_abbr ORDER BY official_date, game_pk)
  ),
  sids AS (
    SELECT *, SUM(new_stint) OVER (PARTITION BY season, team_abbr ORDER BY official_date, game_pk) AS sid
    FROM flagged
  ),
  nb AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY season, team_abbr, sid ORDER BY official_date, game_pk) AS gn
    FROM sids
  ),
  team_agg AS (
    SELECT season, team_abbr,
      COUNT(*) AS games_played,
      AVG(runs_scored) AS season_rs,
      COUNT(*) FILTER (WHERE gn=1 AND prev_loc='away') AS fh_n,
      AVG(runs_scored) FILTER (WHERE gn=1 AND prev_loc='away') AS fh_rs,
      COUNT(*) FILTER (WHERE gn=1 AND prev_loc='home') AS fa_n,
      AVG(runs_scored) FILTER (WHERE gn=1 AND prev_loc='home') AS fa_rs
    FROM nb GROUP BY season, team_abbr
  ),
  classified AS (
    SELECT *,
      (fh_rs - season_rs) AS fh_delta,
      (fa_rs - season_rs) AS fa_delta,
      CASE
        -- Bumped from 2 → 5 after walk-forward backtest showed early-season
        -- (n=2,3,4) classifications were noise-driven and degraded the signal.
        WHEN fh_n < 5 OR fa_n < 5 THEN 'INSUFFICIENT_DATA'
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
  SELECT season, team_abbr, games_played, ROUND(season_rs::numeric, 3),
         fh_n, ROUND(fh_rs::numeric, 3), ROUND(fh_delta::numeric, 3),
         fa_n, ROUND(fa_rs::numeric, 3), ROUND(fa_delta::numeric, 3),
         classification, NOW()
  FROM classified
  ON CONFLICT (season, team_abbr) DO UPDATE SET
    games_played = EXCLUDED.games_played,
    season_rs    = EXCLUDED.season_rs,
    fh_n = EXCLUDED.fh_n, fh_rs = EXCLUDED.fh_rs, fh_delta = EXCLUDED.fh_delta,
    fa_n = EXCLUDED.fa_n, fa_rs = EXCLUDED.fa_rs, fa_delta = EXCLUDED.fa_delta,
    classification = EXCLUDED.classification,
    last_calculated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------
-- 2. Retitle / re-tier the signal definitions
-- ---------------------------------------------------------------
UPDATE public.mlb_signal_definitions
SET
  label       = 'Transition Collision — Over (Hammer)',
  description = 'HAMMER tier. Home team is in their first home game after a road trip AND away team is in their first away game after a homestand. Both teams have a season-long bias of >+0.5 R/G in their respective transition state (home FH Δ AND away FA Δ both > +0.5). Walk-forward backtest 2023-2025 (n>=5 prior transition games per team): 30-10-2, 75.0%, +41.1% ROI at -110.',
  min_games   = 5,
  notes       = 'Tier: HAMMER. Walk-forward backtest. Requires fh_n >= 5 AND fa_n >= 5 in mlb_team_transition_trends. The original migration recorded leaky end-of-season stats (78%); these walk-forward numbers are the honest pre-game expectation.',
  updated_at  = NOW()
WHERE signal_key = 'transition_collision_both_high';

UPDATE public.mlb_signal_definitions
SET
  label       = 'Transition Collision — Under (Lean)',
  description = 'LEAN tier. Home team is in their first home game after a road trip AND away team is in their first away game after a homestand. Both teams have a season-long bias of <-0.5 R/G in their respective transition state (home FH Δ AND away FA Δ both < -0.5). Walk-forward backtest 2023-2025 (n>=5 prior transition games per team): 27-19-0, 58.7%, +12.1% ROI at -110. Real edge but smaller than the over side.',
  min_games   = 5,
  notes       = 'Tier: LEAN (not Hammer). Walk-forward backtest. Original migration recorded a leaky 83% win rate; the proper walk-forward number is 58.7% — still positive expectancy but only ~12% ROI. Treat as a directional lean, not a confidence play.',
  updated_at  = NOW()
WHERE signal_key = 'transition_collision_both_low';

-- ---------------------------------------------------------------
-- 3. Replace the leaky stats in mlb_signal_stats with walk-forward stats
-- ---------------------------------------------------------------
UPDATE public.mlb_signal_stats
SET
  total_picks    = 42,
  wins           = 30,
  losses         = 10,
  pushes         = 2,
  win_pct        = 75.0,
  roi_pct        = 41.1,
  units_won      = 17.27,
  l90_picks      = 0,  l90_wins = 0,  l90_win_pct = 0,  l90_roi_pct = 0,
  earliest_pick_date = '2023-04-01',
  latest_pick_date   = '2025-09-30',
  last_calculated_at = NOW()
WHERE signal_key = 'transition_collision_both_high';

UPDATE public.mlb_signal_stats
SET
  total_picks    = 46,
  wins           = 27,
  losses         = 19,
  pushes         = 0,
  win_pct        = 58.7,
  roi_pct        = 12.1,
  units_won      = 5.55,
  l90_picks      = 0,  l90_wins = 0,  l90_win_pct = 0,  l90_roi_pct = 0,
  earliest_pick_date = '2023-04-01',
  latest_pick_date   = '2025-09-30',
  last_calculated_at = NOW()
WHERE signal_key = 'transition_collision_both_low';

-- ---------------------------------------------------------------
-- 4. Re-run the trends classifier so the 2026 rows reflect the new n>=5 rule
-- ---------------------------------------------------------------
SELECT public.refresh_mlb_team_transition_trends();
