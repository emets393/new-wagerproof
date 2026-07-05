-- Extend grade_nfl_props to grade the 3 volume markets (attempts/completions).
-- Additive only: adds market->stat mappings; original 6 markets unchanged.
-- Actuals live in nfl_player_game_logs (pass_attempts, carries, completions — all populated
-- for 2024-2025 via ingest_player_logs.py + add_completions.py).
-- REQUIRES OWNER AUTHORIZATION (shared grading RPC). Apply via Supabase apply_migration or psql.
CREATE OR REPLACE FUNCTION public.grade_nfl_props(p_season integer, p_week integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE public.nfl_player_props p
  SET actual_value = CASE p.market
        WHEN 'player_pass_yds' THEN g.pass_yds
        WHEN 'player_pass_tds' THEN g.pass_tds
        WHEN 'player_receptions' THEN g.receptions
        WHEN 'player_reception_yds' THEN g.rec_yds
        WHEN 'player_rush_yds' THEN g.rush_yds
        WHEN 'player_pass_attempts' THEN g.pass_attempts
        WHEN 'player_rush_attempts' THEN g.carries
        WHEN 'player_pass_completions' THEN g.completions
        WHEN 'player_anytime_td' THEN COALESCE(g.rush_tds,0) + COALESCE(g.rec_tds,0)
      END,
      result = CASE
        WHEN p.market = 'player_anytime_td' THEN
          CASE WHEN COALESCE(g.rush_tds,0) + COALESCE(g.rec_tds,0) > 0 THEN 'yes' ELSE 'no' END
        ELSE
          CASE
            WHEN (CASE p.market
                    WHEN 'player_pass_yds' THEN g.pass_yds
                    WHEN 'player_pass_tds' THEN g.pass_tds
                    WHEN 'player_receptions' THEN g.receptions
                    WHEN 'player_reception_yds' THEN g.rec_yds
                    WHEN 'player_rush_yds' THEN g.rush_yds
                    WHEN 'player_pass_attempts' THEN g.pass_attempts
                    WHEN 'player_rush_attempts' THEN g.carries
                    WHEN 'player_pass_completions' THEN g.completions
                  END) > p.line THEN 'over'
            WHEN (CASE p.market
                    WHEN 'player_pass_yds' THEN g.pass_yds
                    WHEN 'player_pass_tds' THEN g.pass_tds
                    WHEN 'player_receptions' THEN g.receptions
                    WHEN 'player_reception_yds' THEN g.rec_yds
                    WHEN 'player_rush_yds' THEN g.rush_yds
                    WHEN 'player_pass_attempts' THEN g.pass_attempts
                    WHEN 'player_rush_attempts' THEN g.carries
                    WHEN 'player_pass_completions' THEN g.completions
                  END) < p.line THEN 'under'
            ELSE 'push'
          END
      END,
      graded_at = now()
  FROM public.nfl_player_game_logs g
  WHERE g.player_id = p.player_id AND g.season = p.season AND g.week = p.week
    AND p.season = p_season AND p.week = p_week AND p.result IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;
