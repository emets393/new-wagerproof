-- DNP props VOID like a sportsbook, not linger ungraded (owner 2026-08-15): a late
-- scratch's prop must never read as a loss — and shouldn't sit pending forever either.
-- After grade_nfl_props grades played players, a second pass voids props where the
-- player's TEAM has ingested game logs for that week (game played + stats loaded)
-- but the player himself has NO log row (inactive/DNP). result='void' => graders
-- treat as push. anytime_td included: no-play is a refund, not a 'no'.
CREATE OR REPLACE FUNCTION public.grade_nfl_props_dnp_void(p_season integer, p_week integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE public.nfl_player_props p
  SET result = 'void', actual_value = NULL, graded_at = now()
  WHERE p.season = p_season AND p.week = p_week AND p.result IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.nfl_player_game_logs g
      WHERE g.player_id = p.player_id AND g.season = p.season AND g.week = p.week)
    AND EXISTS (
      SELECT 1 FROM public.nfl_player_game_logs t
      WHERE t.team = p.team AND t.season = p.season AND t.week = p.week);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;
