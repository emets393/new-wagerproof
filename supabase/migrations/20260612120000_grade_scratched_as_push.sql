-- Update grade_mlb_player_prop_picks to settle scratched-player picks as 'push'
-- instead of leaving them perpetually 'pending'.
--
-- Background: when a player is suggested as a pick but then scratched from the
-- lineup (or otherwise doesn't appear in the box score), no mlb_batter_logs /
-- mlb_pitcher_logs row exists for that (player_id, game_pk). The grader leaves
-- those rows as 'pending' even after the game is final, which clutters the
-- picks page indefinitely.
--
-- New logic:
--   actual_value present     → won/lost/push by comparison to line (unchanged)
--   actual_value null + game completed → 'push' (scratched/never appeared)
--   actual_value null + game incomplete → 'pending' (game not done yet)
--
-- 'push' was chosen over a new 'void'/'scratched' status to avoid touching UI
-- enums; a push correctly settles units_won = 0 and removes the pick from
-- "outstanding" displays.

DROP FUNCTION IF EXISTS public.grade_mlb_player_prop_picks(date);

CREATE FUNCTION public.grade_mlb_player_prop_picks(p_report_date date)
RETURNS TABLE (graded int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_graded int := 0;
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
      COALESCE(s.is_completed, false) AS game_completed
    FROM mlb_player_prop_picks p
    LEFT JOIN mlb_batter_logs  bl ON bl.player_id  = p.player_id AND bl.game_pk = p.game_pk
    LEFT JOIN mlb_pitcher_logs pl ON pl.pitcher_id = p.player_id AND pl.game_pk = p.game_pk
    LEFT JOIN mlb_schedule     s  ON s.game_pk = p.game_pk
    WHERE p.report_date = p_report_date
  ),
  graded AS (
    SELECT *,
      CASE
        -- Game finished but player has no box-score row → scratched, push
        WHEN actual_value IS NULL AND game_completed THEN 'push'
        -- Game not done yet → still pending
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
  RETURN QUERY SELECT v_graded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_mlb_player_prop_picks(date) TO service_role;
