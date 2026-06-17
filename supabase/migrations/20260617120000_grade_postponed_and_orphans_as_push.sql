-- Patch grade_mlb_player_prop_picks to settle two cases that were leaving rows
-- perpetually 'pending':
--
-- 1. POSTPONED GAMES — is_completed=false but the game will never replay under
--    that game_pk. The original scratched-as-push only fired on is_completed=true,
--    so these stayed pending forever.
-- 2. ORPHAN GRADES — rows in mlb_player_prop_grades whose source pick was later
--    retracted from mlb_player_prop_picks (line pulled, threshold changed). The
--    grader iterates from picks, so it never re-touches these. We now sweep them
--    at the end of every grader run: if the game is final or postponed and the
--    grade row is still pending, push it.
--
-- 'push' (not 'void') keeps the existing UI/result enum surface unchanged.

CREATE OR REPLACE FUNCTION public.grade_mlb_player_prop_picks(p_report_date date)
RETURNS TABLE (graded int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_graded int := 0;
  v_swept  int := 0;
BEGIN
  WITH src AS (
    SELECT
      p.report_date, p.game_pk, p.player_id, p.market, p.side,
      p.player_name, p.team_name, p.market_label, p.kind, p.tier,
      p.score, p.line, p.over_odds, p.under_odds, p.l10_pct,
      CASE p.market
        WHEN 'batter_home_runs'      THEN bl.home_runs::numeric
        WHEN 'batter_hits'           THEN bl.hits::numeric
        WHEN 'batter_total_bases'    THEN bl.total_bases::numeric
        WHEN 'batter_rbis'           THEN bl.rbi::numeric
        WHEN 'batter_hits_runs_rbis' THEN bl.hits_runs_rbis::numeric
        WHEN 'batter_walks'          THEN bl.walks::numeric
        WHEN 'batter_strikeouts'     THEN bl.strikeouts::numeric
        WHEN 'pitcher_strikeouts'    THEN pl.strikeouts::numeric
        WHEN 'pitcher_hits_allowed'  THEN pl.hits_allowed::numeric
        WHEN 'pitcher_walks'         THEN pl.walks::numeric
        WHEN 'pitcher_outs'          THEN ROUND(pl.ip_official * 3)::numeric
      END AS actual_value,
      CASE p.tier WHEN 'lean' THEN 0.5 WHEN 'strong' THEN 1.0 WHEN 'elite' THEN 1.5 END
        AS units_staked,
      COALESCE(s.is_completed, false) AS game_completed,
      COALESCE(s.is_postponed, false) AS game_postponed
    FROM mlb_player_prop_picks p
    LEFT JOIN mlb_batter_logs  bl ON bl.player_id  = p.player_id AND bl.game_pk = p.game_pk
    LEFT JOIN mlb_pitcher_logs pl ON pl.pitcher_id = p.player_id AND pl.game_pk = p.game_pk
    LEFT JOIN mlb_schedule     s  ON s.game_pk = p.game_pk
    WHERE p.report_date = p_report_date
  ),
  graded AS (
    SELECT *,
      CASE
        -- No box-score row, but game is over (final or postponed) → scratched / no-play, push
        WHEN actual_value IS NULL AND (game_completed OR game_postponed) THEN 'push'
        -- Game still in progress → wait
        WHEN actual_value IS NULL THEN 'pending'
        WHEN actual_value > line  THEN (CASE WHEN side = 'over' THEN 'won' ELSE 'lost' END)
        WHEN actual_value < line  THEN (CASE WHEN side = 'over' THEN 'lost' ELSE 'won' END)
        ELSE 'push'
      END AS result
    FROM src
  ),
  priced AS (
    SELECT *,
      CASE
        WHEN result = 'won' AND over_odds IS NOT NULL AND over_odds > 0
          THEN units_staked * (over_odds::numeric / 100)
        WHEN result = 'won' AND over_odds IS NOT NULL AND over_odds < 0
          THEN units_staked * (100::numeric / (-over_odds))
        WHEN result = 'won'  THEN units_staked
        WHEN result = 'lost' THEN -units_staked
        WHEN result = 'push' THEN 0
        ELSE NULL
      END AS units_won
    FROM graded
  )
  INSERT INTO mlb_player_prop_grades (
    report_date, game_pk, player_id, market, side,
    player_name, team_name, market_label, kind, tier, score,
    line, over_odds, under_odds, l10_pct,
    actual_value, result, units_staked, units_won, graded_at
  )
  SELECT
    report_date, game_pk, player_id, market, side,
    player_name, team_name, market_label, kind, tier, score,
    line, over_odds, under_odds, l10_pct,
    actual_value, result, units_staked, units_won, now()
  FROM priced
  ON CONFLICT (report_date, game_pk, player_id, market, side) DO UPDATE
    SET actual_value = EXCLUDED.actual_value,
        result       = EXCLUDED.result,
        units_won    = EXCLUDED.units_won,
        graded_at    = now();

  GET DIAGNOSTICS v_graded = ROW_COUNT;

  -- Orphan sweep: grade rows that no longer have a matching pick (line was
  -- pulled from the board) sit at 'pending' indefinitely because the loop
  -- above never touches them. Push any orphan whose game is over.
  UPDATE mlb_player_prop_grades g
     SET result = 'push',
         units_won = 0,
         graded_at = now()
   FROM mlb_schedule s
   WHERE g.report_date = p_report_date
     AND g.result = 'pending'
     AND s.game_pk = g.game_pk
     AND (s.is_completed = true OR s.is_postponed = true);

  GET DIAGNOSTICS v_swept = ROW_COUNT;
  RETURN QUERY SELECT v_graded + v_swept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_mlb_player_prop_picks(date) TO service_role;
