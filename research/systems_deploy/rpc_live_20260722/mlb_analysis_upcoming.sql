CREATE OR REPLACE FUNCTION public.mlb_analysis_upcoming(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH upc0 AS (
  SELECT s.game_pk, s.official_date, s.game_time_et, s.venue_id, s.venue_name,
         s.is_divisional, s.is_interleague,
         s.home_team_id, s.away_team_id, s.home_sp_id, s.away_sp_id,
         mh.team AS home_abbr, ma.team AS away_abbr,
         s.home_team_name, s.away_team_name,
         s.home_sp_hand, s.away_sp_hand, s.home_sp_name, s.away_sp_name,
         p.home_ml, p.away_ml, p.total_line, p.f5_total_line
  FROM mlb_schedule s
  JOIN mlb_team_mapping mh ON mh.mlb_api_id = s.home_team_id
  JOIN mlb_team_mapping ma ON ma.mlb_api_id = s.away_team_id
  LEFT JOIN mlb_predictions_current p ON p.game_pk = s.game_pk AND p.is_active
  WHERE s.game_time_et > now()
    AND NOT s.is_completed AND NOT COALESCE(s.is_cancelled,false) AND NOT COALESCE(s.is_postponed,false)
    AND s.game_type = 'R'
    AND s.official_date <= (now() AT TIME ZONE 'America/New_York')::date + 1
),
upc AS (
  SELECT game_pk, official_date, game_time_et, venue_id, venue_name, is_divisional, is_interleague,
         true AS is_home, home_abbr AS team_abbr, away_abbr AS opponent_abbr,
         away_team_id AS opp_team_id, home_sp_id AS sp_id, away_sp_id AS opp_sp_id,
         home_team_name AS team_name, away_team_name AS opp_name,
         home_sp_hand AS sp_hand, away_sp_hand AS opp_sp_hand,
         home_sp_name AS sp_name, away_sp_name AS opp_sp_name,
         home_ml AS ml, total_line, f5_total_line
  FROM upc0
  UNION ALL
  SELECT game_pk, official_date, game_time_et, venue_id, venue_name, is_divisional, is_interleague,
         false, away_abbr, home_abbr,
         home_team_id, away_sp_id, home_sp_id,
         away_team_name, home_team_name,
         away_sp_hand, home_sp_hand, away_sp_name, home_sp_name, away_ml, total_line, f5_total_line
  FROM upc0
),
allseq AS (
  SELECT team_abbr, opponent_abbr, game_date AS d, game_pk,
         CASE WHEN is_home THEN 'home' ELSE 'away' END AS ha,
         ml_won = 1 AS won, margin, false AS is_upcoming
  FROM mlb_analysis_base
  UNION ALL
  SELECT team_abbr, opponent_abbr, official_date, game_pk,
         CASE WHEN is_home THEN 'home' ELSE 'away' END,
         NULL, NULL, true
  FROM upc
),
seq AS (
  SELECT *,
    LAG(opponent_abbr) OVER w AS prev_opp,
    LAG(ha)            OVER w AS prev_ha,
    LAG(d)             OVER w AS prev_date,
    LAG(won)           OVER w AS prev_won,
    LAG(margin)        OVER w AS prev_margin
  FROM allseq
  WINDOW w AS (PARTITION BY team_abbr ORDER BY d, game_pk)
),
ser AS (
  SELECT *,
    SUM(CASE WHEN prev_opp IS DISTINCT FROM opponent_abbr
               OR prev_ha  IS DISTINCT FROM ha
               OR d - prev_date > 3 THEN 1 ELSE 0 END)
      OVER (PARTITION BY team_abbr ORDER BY d, game_pk) AS series_id
  FROM seq
),
ser2 AS (
  SELECT *, row_number() OVER (PARTITION BY team_abbr, series_id ORDER BY d, game_pk) AS series_game
  FROM ser
),
serl AS (SELECT team_abbr, series_id, min(ha) AS ha FROM ser2 GROUP BY 1,2),
serl1 AS (
  SELECT *, LAG(ha) OVER (PARTITION BY team_abbr ORDER BY series_id) AS prev_ser_ha FROM serl
),
serl2 AS (
  SELECT *, SUM(CASE WHEN prev_ser_ha IS DISTINCT FROM ha THEN 1 ELSE 0 END)
    OVER (PARTITION BY team_abbr ORDER BY series_id) AS trip_id
  FROM serl1
),
serl3 AS (
  SELECT team_abbr, series_id,
    row_number() OVER (PARTITION BY team_abbr, trip_id ORDER BY series_id) AS trip_series_index
  FROM serl2
),
spx AS (
  SELECT pitcher_id, season,
    sum(xfip*ip_official)/NULLIF(sum(ip_official),0) AS season_xfip
  FROM mlb_pitcher_logs
  GROUP BY 1,2
),
tail AS (
  SELECT team_abbr, ml_won,
    row_number() OVER (PARTITION BY team_abbr ORDER BY game_date DESC, game_pk DESC) AS rn
  FROM mlb_analysis_base
),
lastres AS (SELECT team_abbr, ml_won AS last_won FROM tail WHERE rn = 1),
runs AS (
  SELECT team_abbr, ml_won, rn,
    rn - row_number() OVER (PARTITION BY team_abbr, ml_won ORDER BY rn) AS grp
  FROM tail
),
strk AS (
  SELECT r.team_abbr,
    (CASE WHEN l.last_won = 1 THEN 1 ELSE -1 END) * count(*) AS streak
  FROM runs r JOIN lastres l USING (team_abbr)
  WHERE r.ml_won = l.last_won AND r.grp = 0
  GROUP BY r.team_abbr, l.last_won
),
m AS (
  SELECT u.*,
    s2.series_game, t.trip_series_index,
    (s2.prev_ha IS NOT NULL AND s2.prev_ha <> s2.ha)             AS is_switch_game,
    CASE WHEN s2.prev_won IS NULL THEN NULL
         WHEN s2.prev_won THEN 'W' ELSE 'L' END                  AS prev_result,
    s2.prev_margin,
    (u.official_date - s2.prev_date - 1)                          AS days_rest,
    st.streak                                                     AS win_loss_streak,
    sp1.season_xfip                                               AS sp_season_xfip,
    sp2.season_xfip                                               AS opp_sp_season_xfip,
    bp.bp_ip_last3d                                               AS opp_bp_ip_last3d,
    bp.season_pre_bp_xfip                                         AS opp_bp_season_xfip,
    EXTRACT(MONTH FROM u.official_date)::int                      AS month,
    (u.game_time_et AT TIME ZONE 'America/New_York')::time        AS time_et,
    trim(to_char(u.official_date,'Dy'))                           AS day_of_week,
    (count(*) OVER (PARTITION BY u.team_abbr, u.official_date) > 1) AS is_doubleheader,
    (u.ml < 0)                                                    AS is_favorite,
    COALESCE(pf.is_dome,false)                                    AS is_dome,
    pf.pf_runs
  FROM upc u
  JOIN ser2 s2 ON s2.game_pk = u.game_pk AND s2.team_abbr = u.team_abbr AND s2.is_upcoming
  JOIN serl3 t ON t.team_abbr = u.team_abbr AND t.series_id = s2.series_id
  LEFT JOIN strk st ON st.team_abbr = u.team_abbr
  LEFT JOIN spx sp1 ON sp1.pitcher_id = u.sp_id
                   AND sp1.season = EXTRACT(YEAR FROM u.official_date)::int
  LEFT JOIN spx sp2 ON sp2.pitcher_id = u.opp_sp_id
                   AND sp2.season = EXTRACT(YEAR FROM u.official_date)::int
  LEFT JOIN mlb_bullpen_pregame bp ON bp.game_pk = u.game_pk AND bp.team_id = u.opp_team_id
  LEFT JOIN mlb_park_factors pf ON pf.venue_id = u.venue_id
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'game_pk', game_pk, 'game_date', official_date, 'time_et', time_et,
    'matchup', CASE WHEN is_home THEN opp_name||' @ '||team_name
                    ELSE team_name||' @ '||opp_name END,
    'team', team_abbr, 'opponent', opponent_abbr,
    'is_home', is_home, 'is_favorite', is_favorite, 'ml', ml,
    'total', total_line, 'f5_total', f5_total_line,
    'series_game', series_game, 'trip_series_index', trip_series_index,
    'is_switch_game', is_switch_game, 'prev_result', prev_result, 'prev_margin', prev_margin,
    'days_rest', days_rest, 'win_loss_streak', win_loss_streak,
    'day_of_week', day_of_week, 'is_doubleheader', is_doubleheader,
    'sp_hand', sp_hand, 'opp_sp_hand', opp_sp_hand,
    'sp_id', sp_id, 'sp_name', sp_name, 'opp_sp_id', opp_sp_id, 'opp_sp_name', opp_sp_name,
    'sp_season_xfip', round(sp_season_xfip::numeric,2),
    'opp_sp_season_xfip', round(opp_sp_season_xfip::numeric,2),
    'opp_bp_ip_last3d', opp_bp_ip_last3d, 'opp_bp_season_xfip', opp_bp_season_xfip,
    'venue', venue_name, 'is_dome', is_dome, 'pf_runs', pf_runs) ORDER BY game_time_et, game_pk, is_home DESC), '[]'::jsonb)
FROM m
WHERE
  (p_filters->>'month_min' IS NULL OR month >= (p_filters->>'month_min')::int)
  AND (p_filters->>'month_max' IS NULL OR month <= (p_filters->>'month_max')::int)
  AND (p_filters->'team' IS NULL OR team_abbr IN (SELECT jsonb_array_elements_text(p_filters->'team')))
  AND (p_filters->'opponent' IS NULL OR opponent_abbr IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
  AND (p_filters->>'division' IS NULL OR is_divisional = (p_filters->>'division')::boolean)
  AND (p_filters->>'interleague' IS NULL OR is_interleague = (p_filters->>'interleague')::boolean)
  AND (p_filters->>'side' IS NULL OR is_home = ((p_filters->>'side')='home'))
  AND (p_filters->>'fav_dog' IS NULL OR is_favorite = ((p_filters->>'fav_dog')='favorite'))
  AND (p_filters->>'ml_min' IS NULL OR ml >= (p_filters->>'ml_min')::numeric)
  AND (p_filters->>'ml_max' IS NULL OR ml <= (p_filters->>'ml_max')::numeric)
  AND (p_filters->>'total_min' IS NULL OR total_line >= (p_filters->>'total_min')::numeric)
  AND (p_filters->>'total_max' IS NULL OR total_line <= (p_filters->>'total_max')::numeric)
  AND (p_filters->>'f5_total_min' IS NULL OR f5_total_line >= (p_filters->>'f5_total_min')::numeric)
  AND (p_filters->>'f5_total_max' IS NULL OR f5_total_line <= (p_filters->>'f5_total_max')::numeric)
  AND (p_filters->>'series_game_min' IS NULL OR series_game >= (p_filters->>'series_game_min')::int)
  AND (p_filters->>'series_game_max' IS NULL OR series_game <= (p_filters->>'series_game_max')::int)
  AND (p_filters->>'trip_min' IS NULL OR trip_series_index >= (p_filters->>'trip_min')::int)
  AND (p_filters->>'trip_max' IS NULL OR trip_series_index <= (p_filters->>'trip_max')::int)
  AND (p_filters->>'switch_game' IS NULL OR is_switch_game = (p_filters->>'switch_game')::boolean)
  AND (p_filters->>'time_min' IS NULL OR time_et >= (p_filters->>'time_min')::time)
  AND (p_filters->>'time_max' IS NULL OR time_et <= (p_filters->>'time_max')::time)
  AND (p_filters->>'day_of_week' IS NULL OR day_of_week = (p_filters->>'day_of_week'))
  AND (p_filters->>'doubleheader' IS NULL OR is_doubleheader = (p_filters->>'doubleheader')::boolean)
  AND (p_filters->>'rest_min' IS NULL OR days_rest >= (p_filters->>'rest_min')::int)
  AND (p_filters->>'rest_max' IS NULL OR days_rest <= (p_filters->>'rest_max')::int)
  AND (p_filters->>'streak_min' IS NULL OR win_loss_streak >= (p_filters->>'streak_min')::int)
  AND (p_filters->>'streak_max' IS NULL OR win_loss_streak <= (p_filters->>'streak_max')::int)
  AND (p_filters->>'last_result' IS NULL OR prev_result = (CASE WHEN (p_filters->>'last_result')='won' THEN 'W' ELSE 'L' END))
  AND (p_filters->>'last_margin_min' IS NULL OR prev_margin >= (p_filters->>'last_margin_min')::int)
  AND (p_filters->>'last_margin_max' IS NULL OR prev_margin <= (p_filters->>'last_margin_max')::int)
  AND (p_filters->>'sp_hand' IS NULL OR sp_hand = (p_filters->>'sp_hand'))
  AND (p_filters->>'opp_sp_hand' IS NULL OR opp_sp_hand = (p_filters->>'opp_sp_hand'))
  AND (p_filters->>'sp_xfip_min' IS NULL OR sp_season_xfip >= (p_filters->>'sp_xfip_min')::numeric)
  AND (p_filters->>'sp_xfip_max' IS NULL OR sp_season_xfip <= (p_filters->>'sp_xfip_max')::numeric)
  AND (p_filters->>'opp_sp_xfip_min' IS NULL OR opp_sp_season_xfip >= (p_filters->>'opp_sp_xfip_min')::numeric)
  AND (p_filters->>'opp_sp_xfip_max' IS NULL OR opp_sp_season_xfip <= (p_filters->>'opp_sp_xfip_max')::numeric)
  AND (p_filters->>'bp_ip3d_min' IS NULL OR opp_bp_ip_last3d >= (p_filters->>'bp_ip3d_min')::numeric)
  AND (p_filters->>'bp_ip3d_max' IS NULL OR opp_bp_ip_last3d <= (p_filters->>'bp_ip3d_max')::numeric)
  AND (p_filters->>'bp_xfip_min' IS NULL OR opp_bp_season_xfip >= (p_filters->>'bp_xfip_min')::numeric)
  AND (p_filters->>'bp_xfip_max' IS NULL OR opp_bp_season_xfip <= (p_filters->>'bp_xfip_max')::numeric)
  AND (p_filters->>'dome' IS NULL OR is_dome = (p_filters->>'dome')::boolean)
  AND (p_filters->>'pf_runs_min' IS NULL OR pf_runs >= (p_filters->>'pf_runs_min')::numeric)
  AND (p_filters->>'pf_runs_max' IS NULL OR pf_runs <= (p_filters->>'pf_runs_max')::numeric)
  AND (p_filters->'sp' IS NULL OR sp_id::text IN (SELECT jsonb_array_elements_text(p_filters->'sp')))
  AND (p_filters->'opp_sp' IS NULL OR opp_sp_id::text IN (SELECT jsonb_array_elements_text(p_filters->'opp_sp')));
$function$
