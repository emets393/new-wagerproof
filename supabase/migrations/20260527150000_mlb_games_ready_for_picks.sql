-- Readiness gate for the server-side prop-picker. A game becomes "ready"
-- when every input the scoring algorithm needs is present:
--   * both starting pitchers confirmed on mlb_schedule
--   * both lineups posted in mlb_game_lineups (≥8 batters per team)
--   * DraftKings props posted in mlb_player_props
--   * game is in the future (not in progress / not final) so we're
--     making a pre-game pick, not chasing a settled outcome
--   * not postponed or cancelled
--
-- Returns the game_pks that satisfy ALL of the above for the given date.
-- The edge function score-player-props calls this each tick, skips games
-- already picked, and scores the rest.
CREATE OR REPLACE FUNCTION public.mlb_games_ready_for_picks(p_report_date date)
RETURNS TABLE (game_pk bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.game_pk
  FROM mlb_schedule s
  WHERE s.official_date = p_report_date
    AND COALESCE(s.is_postponed, false) = false
    AND COALESCE(s.is_cancelled, false) = false
    AND s.away_sp_id IS NOT NULL
    AND s.home_sp_id IS NOT NULL
    AND (s.game_time_et IS NULL OR s.game_time_et > now())
    AND EXISTS (
      SELECT 1 FROM mlb_player_props pp
      WHERE pp.game_pk = s.game_pk AND pp.player_id IS NOT NULL
    )
    AND (
      SELECT COUNT(DISTINCT team_id) FROM mlb_game_lineups
      WHERE game_pk = s.game_pk
    ) = 2
    AND (
      SELECT COUNT(*) FROM mlb_game_lineups
      WHERE game_pk = s.game_pk AND team_id = s.home_team_id
    ) >= 8
    AND (
      SELECT COUNT(*) FROM mlb_game_lineups
      WHERE game_pk = s.game_pk AND team_id = s.away_team_id
    ) >= 8;
$$;

GRANT EXECUTE ON FUNCTION public.mlb_games_ready_for_picks(date)
  TO anon, authenticated, service_role;
