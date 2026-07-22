CREATE OR REPLACE FUNCTION public.cfb_analysis_upcoming(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v jsonb;
BEGIN
  WITH ex AS (
    SELECT g.game_id, g.season, g.week, g.kickoff, g.neutral_site,
      true AS is_home, g.home_team AS team, g.away_team AS opponent,
      g.home_conf AS team_conf, g.away_conf AS opp_conf,
      g.fg_spread_close AS team_spread, g.fg_total_close AS total,
      g.tt_home_close AS tt_line, g.h1_spread_close AS h1_spread, g.h1_total_close AS h1_total,
      (g.home_conf = g.away_conf) AS conf_game,
      (EXTRACT(hour FROM g.kickoff AT TIME ZONE 'America/New_York') >= 19) AS primetime
    FROM cfb_dryrun_games g WHERE g.kickoff > now()
    UNION ALL
    SELECT g.game_id, g.season, g.week, g.kickoff, g.neutral_site,
      false, g.away_team, g.home_team, g.away_conf, g.home_conf,
      -g.fg_spread_close, g.fg_total_close,
      g.tt_away_close, -g.h1_spread_close, g.h1_total_close,
      (g.home_conf = g.away_conf),
      (EXTRACT(hour FROM g.kickoff AT TIME ZONE 'America/New_York') >= 19)
    FROM cfb_dryrun_games g WHERE g.kickoff > now()
  ),
  f AS (
    SELECT *, (team_spread < 0) AS is_favorite FROM ex
    WHERE
      (p_filters->>'side' IS NULL OR is_home = ((p_filters->>'side')='home'))
      AND (p_filters->>'fav_dog' IS NULL OR (team_spread < 0) = ((p_filters->>'fav_dog')='favorite'))
      AND (p_filters->>'week_min' IS NULL OR week >= (p_filters->>'week_min')::int)
      AND (p_filters->>'week_max' IS NULL OR week <= (p_filters->>'week_max')::int)
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
      AND (p_filters->>'conference_game' IS NULL OR conf_game = (p_filters->>'conference_game')::boolean)
      AND (p_filters->>'neutral_site' IS NULL OR neutral_site = (p_filters->>'neutral_site')::boolean)
      AND (p_filters->>'primetime' IS NULL OR primetime = (p_filters->>'primetime')::boolean)
      AND (p_filters->>'conference' IS NULL OR team_conf = (p_filters->>'conference'))
      AND (p_filters->'team' IS NULL OR team IN (SELECT jsonb_array_elements_text(p_filters->'team')))
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'team', team, 'opponent', opponent, 'is_home', is_home, 'is_favorite', is_favorite,
    'matchup', CASE WHEN is_home THEN opponent || ' @ ' || team ELSE team || ' @ ' || opponent END,
    'kickoff', kickoff, 'team_spread', team_spread, 'total', total, 'tt_line', tt_line,
    'h1_spread', h1_spread, 'h1_total', h1_total) ORDER BY kickoff), '[]'::jsonb)
  INTO v FROM f;
  RETURN v;
END;
$function$
