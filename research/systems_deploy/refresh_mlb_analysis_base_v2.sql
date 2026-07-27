CREATE OR REPLACE FUNCTION public.refresh_mlb_analysis_base()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_n integer;
BEGIN
  CREATE TEMP TABLE _mab ON COMMIT DROP AS
  WITH rl26 AS (
    SELECT DISTINCT ON (game_pk) game_pk, home_spread, away_spread
    FROM mlb_odds_snapshots
    WHERE home_spread IS NOT NULL
    ORDER BY game_pk, fetched_at DESC
  ),
  g0 AS (
    SELECT g.*,
      sc.game_time_et, sc.venue_id,
      po.pitcher_id AS sp_id_v,
      COALESCE(po.pitcher_name, g.sp_name) AS sp_name_v,
      px.pitcher_id AS opp_sp_id_v,
      COALESCE(px.pitcher_name, g.opp_sp_name) AS opp_sp_name_v,
      COALESCE(g.closing_runline,
        CASE WHEN g.home_away='home' THEN r.home_spread ELSE r.away_spread END) AS runline_eff
    FROM mlb_game_log g
    LEFT JOIN mlb_schedule sc ON sc.game_pk = g.game_pk
    LEFT JOIN rl26 r ON r.game_pk = g.game_pk
    LEFT JOIN mlb_pitcher_logs po ON po.game_pk = g.game_pk
      AND po.home_away = g.home_away AND po.games_started = 1
    LEFT JOIN mlb_pitcher_logs px ON px.game_pk = g.game_pk
      AND px.home_away = (CASE WHEN g.home_away='home' THEN 'away' ELSE 'home' END)
      AND px.games_started = 1
    WHERE g.won IS NOT NULL AND g.runs_scored IS NOT NULL AND g.runs_allowed IS NOT NULL
  ),
  seq AS (
    SELECT g0.*,
      LAG(opp_team_abbr) OVER w AS prev_opp,
      LAG(home_away)     OVER w AS prev_ha,
      LAG(official_date) OVER w AS prev_date,
      LAG(won)           OVER w AS prev_won,
      LAG(margin)        OVER w AS prev_margin_v
    FROM g0
    WINDOW w AS (PARTITION BY team_abbr ORDER BY official_date, game_time_et, game_pk)
  ),
  ser AS (
    SELECT *,
      SUM(CASE WHEN prev_opp IS DISTINCT FROM opp_team_abbr
                 OR prev_ha  IS DISTINCT FROM home_away
                 OR official_date - prev_date > 3 THEN 1 ELSE 0 END)
        OVER (PARTITION BY team_abbr ORDER BY official_date, game_time_et, game_pk) AS series_id
    FROM seq
  ),
  ser2 AS (
    SELECT *,
      row_number() OVER (PARTITION BY team_abbr, series_id ORDER BY official_date, game_time_et, game_pk) AS series_game_v
    FROM ser
  ),
  serl AS (
    SELECT team_abbr, series_id, min(home_away) AS ha
    FROM ser2 GROUP BY 1,2
  ),
  serl1 AS (
    SELECT *,
      LAG(ha) OVER (PARTITION BY team_abbr ORDER BY series_id) AS prev_ser_ha
    FROM serl
  ),
  serl2 AS (
    SELECT *,
      SUM(CASE WHEN prev_ser_ha IS DISTINCT FROM ha THEN 1 ELSE 0 END)
        OVER (PARTITION BY team_abbr ORDER BY series_id) AS trip_id
    FROM serl1
  ),
  serl3 AS (
    SELECT team_abbr, series_id,
      row_number() OVER (PARTITION BY team_abbr, trip_id ORDER BY series_id) AS trip_series_index_v
    FROM serl2
  )
  SELECT
    s.game_pk,
    (s.home_away='home')                                        AS is_home,
    s.season,
    s.official_date                                             AS game_date,
    EXTRACT(MONTH FROM s.official_date)::int                    AS month,
    (s.game_time_et AT TIME ZONE 'America/New_York')::time      AS time_et,
    trim(to_char(s.official_date,'Dy'))                         AS day_of_week,
    (count(*) OVER (PARTITION BY s.team_abbr, s.official_date) > 1) AS is_doubleheader,
    s.team_abbr,
    s.opp_team_abbr                                             AS opponent_abbr,
    s.venue                                                     AS venue_name,
    s.runs_scored, s.runs_allowed, s.margin, s.total_runs,
    s.f5_runs_scored, s.f5_runs_allowed,
    s.closing_ml, s.closing_total,
    s.runline_eff                                               AS closing_runline,
    s.f5_total_line,
    CASE
      WHEN COUNT(s.closing_ml) OVER (PARTITION BY s.game_pk) = 2 THEN
        CASE
          WHEN s.closing_ml < (SUM(s.closing_ml) OVER (PARTITION BY s.game_pk)) - s.closing_ml THEN true
          WHEN s.closing_ml > (SUM(s.closing_ml) OVER (PARTITION BY s.game_pk)) - s.closing_ml THEN false
          ELSE (s.home_away='home')
        END
      ELSE COALESCE(s.is_favorite, s.closing_ml < 0)
    END                   AS is_favorite,
    s.won::int                                                  AS ml_won,
    CASE WHEN s.closing_ml IS NULL THEN NULL
         WHEN s.won AND s.closing_ml > 0 THEN s.closing_ml/100.0
         WHEN s.won                       THEN 100.0/abs(s.closing_ml)
         ELSE -1 END                                            AS ml_profit,
    CASE WHEN s.runline_eff IS NULL THEN NULL
         WHEN s.margin + s.runline_eff > 0 THEN 1
         WHEN s.margin + s.runline_eff < 0 THEN 0
         ELSE NULL END                                          AS rl_covered,
    CASE WHEN s.closing_total IS NULL THEN NULL
         WHEN s.total_runs > s.closing_total THEN 1
         WHEN s.total_runs < s.closing_total THEN 0
         ELSE NULL END                                          AS ou_over,
    CASE WHEN s.f5_runs_scored IS NULL THEN NULL
         WHEN s.f5_runs_scored > s.f5_runs_allowed THEN 1
         WHEN s.f5_runs_scored < s.f5_runs_allowed THEN 0
         ELSE NULL END                                          AS f5_ml_won,
    CASE WHEN s.f5_runs_scored IS NULL THEN NULL
         WHEN CASE
      WHEN COUNT(s.closing_ml) OVER (PARTITION BY s.game_pk) = 2 THEN
        CASE
          WHEN s.closing_ml < (SUM(s.closing_ml) OVER (PARTITION BY s.game_pk)) - s.closing_ml THEN true
          WHEN s.closing_ml > (SUM(s.closing_ml) OVER (PARTITION BY s.game_pk)) - s.closing_ml THEN false
          ELSE (s.home_away='home')
        END
      ELSE COALESCE(s.is_favorite, s.closing_ml < 0)
    END
           THEN (s.f5_runs_scored >  s.f5_runs_allowed)::int
         ELSE   (s.f5_runs_scored >= s.f5_runs_allowed)::int
         END                                                    AS f5_rl_covered,
    CASE WHEN s.f5_total_line IS NULL OR s.f5_runs_scored IS NULL THEN NULL
         WHEN s.f5_runs_scored + s.f5_runs_allowed > s.f5_total_line THEN 1
         WHEN s.f5_runs_scored + s.f5_runs_allowed < s.f5_total_line THEN 0
         ELSE NULL END                                          AS f5_over,
    s.series_game_v                                             AS series_game,
    t.trip_series_index_v                                       AS trip_series_index,
    (s.prev_ha IS NOT NULL AND s.prev_ha <> s.home_away
     AND s.official_date - s.prev_date <= 10)                   AS is_switch_game,
    CASE WHEN s.prev_won IS NULL THEN NULL
         WHEN s.prev_won THEN 'W' ELSE 'L' END                  AS prev_result,
    s.prev_margin_v                                             AS prev_margin,
    s.days_rest, s.win_loss_streak, s.is_divisional, s.is_interleague,
    s.sp_hand, s.opp_sp_hand, s.sp_season_xfip, s.opp_sp_season_xfip, s.sp_prior_starts,
    s.opp_bp_ip_last3d, s.opp_bp_season_xfip,
    s.temperature_f, s.wind_speed_mph,
    CASE
      WHEN s.wind_direction IS NULL THEN 'none'
      WHEN s.wind_direction ILIKE 'out%'  THEN 'out'
      WHEN s.wind_direction ILIKE 'in %' OR s.wind_direction ILIKE 'in from%' OR s.wind_direction ILIKE 'in to%' THEN 'in'
      WHEN s.wind_direction ILIKE '%left to right%' OR s.wind_direction ILIKE '%right to left%'
        OR s.wind_direction ILIKE '%l to r%' OR s.wind_direction ILIKE '%r to l%'
        OR s.wind_direction ILIKE 'from left%' OR s.wind_direction ILIKE 'from right%'
        OR s.wind_direction ILIKE 'cross%' THEN 'cross'
      ELSE 'none'
    END                                                         AS wind_dir,
    COALESCE(pf.is_dome, false)                                 AS is_dome,
    pf.pf_runs,
    s.sp_id_v                                                   AS sp_id,
    s.sp_name_v                                                 AS sp_name,
    s.opp_sp_id_v                                               AS opp_sp_id,
    s.opp_sp_name_v                                             AS opp_sp_name
  FROM ser2 s
  JOIN serl3 t USING (team_abbr, series_id)
  LEFT JOIN mlb_park_factors pf ON pf.venue_id = s.venue_id;

  TRUNCATE public.mlb_analysis_base;
  INSERT INTO public.mlb_analysis_base (
    game_pk, is_home, season, game_date, month, time_et, day_of_week,
    is_doubleheader, team_abbr, opponent_abbr, venue_name,
    runs_scored, runs_allowed, margin, total_runs, f5_runs_scored, f5_runs_allowed,
    closing_ml, closing_total, closing_runline, f5_total_line, is_favorite,
    ml_won, ml_profit, rl_covered, ou_over, f5_ml_won, f5_rl_covered, f5_over,
    series_game, trip_series_index, is_switch_game, prev_result, prev_margin,
    days_rest, win_loss_streak, is_divisional, is_interleague,
    sp_hand, opp_sp_hand, sp_season_xfip, opp_sp_season_xfip, sp_prior_starts,
    opp_bp_ip_last3d, opp_bp_season_xfip,
    temperature_f, wind_speed_mph, wind_dir, is_dome, pf_runs,
    sp_id, sp_name, opp_sp_id, opp_sp_name)
  SELECT * FROM _mab;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  DROP TABLE _mab;
  RETURN v_n;
END;
$function$
