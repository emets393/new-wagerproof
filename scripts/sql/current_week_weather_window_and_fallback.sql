-- APPLIED TO PROD (CFB project jpxnjuwglavsjbgbasnl) 2026-08-27 via MCP apply_migration.
--
-- current_week_weather had NO date window (every training_key ever -> 203
-- past-2025 games fetched from Visual Crossing per fetch_nfl_weather run) and
-- resolved stadiums ONLY via v_nfl_game_stadium (32 legacy per-team tables with
-- no 2026 rows until the Sept TR scrape) -> the 2026 slate silently dropped.
-- Now: a real current-week window (now-1d .. now+10d), and home_team fallback
-- for the stadium join (nfl_betting_lines.home_team = nfl_stadium_weather.
-- vsin_team_name). When the legacy per-team tables fill in September, their
-- exact stadium (incl. international venues) wins again via COALESCE.
--
-- Verified post-apply: view empty on 2026-08-27 (first NFL kickoff Sept 9 is
-- outside 10 days — correct); production_weather cleared of stale 2025 rows;
-- fetch_nfl_weather handles the empty view gracefully. The daily nfl-weather
-- cron (Sept-Feb) begins producing real forecasts as wk1 enters the window.
CREATE OR REPLACE VIEW public.current_week_weather AS
WITH latest AS (
  SELECT DISTINCT ON (training_key)
    training_key,
    game_time_et AS game_time,
    home_team
  FROM public.nfl_betting_lines
  WHERE training_key IS NOT NULL
    AND game_time_et BETWEEN now() - interval '1 day' AND now() + interval '10 days'
  ORDER BY training_key, COALESCE(updated_at, as_of_ts) DESC
)
SELECT
  l.training_key,
  l.game_time,
  COALESCE(gs.stadium, l.home_team) AS stadium,
  sw.field_type,
  sw.dome_stadium,
  sw.latitude,
  sw.longitude
FROM latest l
LEFT JOIN public.v_nfl_game_stadium gs ON gs.unique_id = l.training_key
LEFT JOIN public.nfl_stadium_weather sw ON sw.vsin_team_name = COALESCE(gs.stadium, l.home_team);
