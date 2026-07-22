CREATE OR REPLACE FUNCTION public.nfl_analysis_upcoming(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
-- "This week's games that match" for /nfl-analytics. Reads nfl_dryrun_games, which IS the
-- in-season games table (per DRYRUN_WK12_SPEC.md the 2026 weekly pipeline delete-then-inserts
-- each real slate here). PRODUCTION: only games whose kickoff is still in the FUTURE are shown,
-- so the retired Week-12-2025 dry-run slate (all past) no longer appears, and Week 1 2026 lights
-- up the moment its games are populated. No point-in-time simulation anymore.
WITH ex AS (
  SELECT g.season, g.week, g.gameday, g.kickoff, g.slot, g.assigned_referee AS referee,
    true AS is_home, g.home_ab AS team, g.away_ab AS opponent, g.home_team AS team_name, g.away_team AS opp_name,
    g.fg_spread_close AS team_spread, g.fg_total_close AS total,
    g.tt_home_close AS tt_line, g.h1_spread_close AS h1_spread, g.h1_total_close AS h1_total
  FROM nfl_dryrun_games g
  WHERE g.kickoff > now()
  UNION ALL
  SELECT g.season, g.week, g.gameday, g.kickoff, g.slot, g.assigned_referee,
    false, g.away_ab, g.home_ab, g.away_team, g.home_team,
    (-g.fg_spread_close), g.fg_total_close,
    g.tt_away_close, (-g.h1_spread_close), g.h1_total_close
  FROM nfl_dryrun_games g
  WHERE g.kickoff > now()
),
m AS (
  SELECT *, (team_spread < 0) AS is_favorite, (slot IN ('snf','monday','thu_fri')) AS is_primetime FROM ex
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'week', week, 'kickoff', kickoff, 'slot', slot, 'matchup', team_name||' vs '||opp_name,
    'team', team, 'opponent', opponent, 'is_home', is_home, 'is_favorite', is_favorite,
    'team_spread', team_spread, 'total', total, 'tt_line', tt_line,
    'h1_spread', h1_spread, 'h1_total', h1_total, 'referee', referee) ORDER BY kickoff), '[]'::jsonb)
FROM m
WHERE
  (p_filters->>'side' IS NULL OR is_home = ((p_filters->>'side')='home'))
  AND (p_filters->>'fav_dog' IS NULL OR is_favorite = ((p_filters->>'fav_dog')='favorite'))
  AND (p_filters->>'spread_min' IS NULL OR team_spread >= (p_filters->>'spread_min')::numeric)
  AND (p_filters->>'spread_max' IS NULL OR team_spread <= (p_filters->>'spread_max')::numeric)
  AND (p_filters->>'abs_spread_min' IS NULL OR abs(team_spread) >= (p_filters->>'abs_spread_min')::numeric)
  AND (p_filters->>'abs_spread_max' IS NULL OR abs(team_spread) <= (p_filters->>'abs_spread_max')::numeric)
  AND (p_filters->>'total_min' IS NULL OR total >= (p_filters->>'total_min')::numeric)
  AND (p_filters->>'total_max' IS NULL OR total <= (p_filters->>'total_max')::numeric)
  AND (p_filters->>'tt_min' IS NULL OR tt_line >= (p_filters->>'tt_min')::numeric)
  AND (p_filters->>'tt_max' IS NULL OR tt_line <= (p_filters->>'tt_max')::numeric)
  AND (p_filters->>'h1_spread_min' IS NULL OR h1_spread >= (p_filters->>'h1_spread_min')::numeric)
  AND (p_filters->>'h1_spread_max' IS NULL OR h1_spread <= (p_filters->>'h1_spread_max')::numeric)
  AND (p_filters->>'h1_abs_spread_min' IS NULL OR abs(h1_spread) >= (p_filters->>'h1_abs_spread_min')::numeric)
  AND (p_filters->>'h1_abs_spread_max' IS NULL OR abs(h1_spread) <= (p_filters->>'h1_abs_spread_max')::numeric)
  AND (p_filters->>'h1_total_min' IS NULL OR h1_total >= (p_filters->>'h1_total_min')::numeric)
  AND (p_filters->>'h1_total_max' IS NULL OR h1_total <= (p_filters->>'h1_total_max')::numeric)
  AND (p_filters->>'primetime' IS NULL OR is_primetime = (p_filters->>'primetime')::boolean)
  AND (p_filters->>'referee' IS NULL OR referee = (p_filters->>'referee'))
  AND (p_filters->'team' IS NULL OR team IN (SELECT jsonb_array_elements_text(p_filters->'team')));
$function$
