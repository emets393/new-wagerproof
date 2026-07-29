-- ============================================================================
-- In-season appenders for the NFL + CFB historical-trends warehouses.
--
-- Parallel to refresh_mlb_analysis_base(): as 2026 games COMPLETE, turn each
-- finished game in {nfl,cfb}_dryrun_games (final_home/away populated by
-- fill_finals.py) into the exploded team-per-game rows that /nfl-analytics,
-- /cfb-analytics and the Systems workbench aggregate over.
--
-- TWO-STAGE by design:
--   Stage 1 (THIS file): the deterministic per-game FACTS — scores, ATS/OU/TT/1H
--     results, weather, referee (NFL), conference/rank (CFB), etc.
--   Stage 2 (asof_features_{nfl,cfb}.py): reads the base back and fills the
--     season-to-date / streak / h2h / opponent / prev-year family leak-safely.
--   Run Stage 2 after this. The columns this fn leaves NULL are Stage-2's job
--     (+ coach/surface for NFL, which come from the nflverse patch).
--
-- SCOPE GUARD: delete+insert is scoped to p_season. Only ever call for the LIVE
--   season (2026+). Do NOT call for 2018-2025 — those rows carry the richer
--   parquet-built columns (coach, surface, _px, asof) and would be thinned out.
--   Idempotent within the live season: re-running re-inserts all completed games.
--
-- Convention notes (reverse-engineered from the existing base, game 2025_12_PHI_DAL):
--   ou_result / fg_covered / tt_over / h1_* : 1=over/cover, 0=under/no-cover, NULL=push
--   season_type: 'regular' (wk<=18) else 'postseason'
--   fg_spread is the HOME line; away perspective negates it
--   unique_id = <homeLoc><awayLoc><season><WW>, exploded_id = unique_id||':H'/':A'
-- ============================================================================

-- ---------------------------------------------------------------------------
-- NFL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_nfl_analysis_base(p_season int)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_n integer;
BEGIN
  DELETE FROM nfl_analysis_base WHERE season = p_season;

  WITH tm(ab, loc, div) AS (VALUES
    ('ARI','Arizona','NFC West'),   ('ATL','Atlanta','NFC South'),
    ('BAL','Baltimore','AFC North'),('BUF','Buffalo','AFC East'),
    ('CAR','Carolina','NFC South'), ('CHI','Chicago','NFC North'),
    ('CIN','Cincinnati','AFC North'),('CLE','Cleveland','AFC North'),
    ('DAL','Dallas','NFC East'),    ('DEN','Denver','AFC West'),
    ('DET','Detroit','NFC North'),  ('GB','Green Bay','NFC North'),
    ('HOU','Houston','AFC South'),  ('IND','Indianapolis','AFC South'),
    ('JAX','Jacksonville','AFC South'),('KC','Kansas City','AFC West'),
    ('LA','LA Rams','NFC West'),     ('LAR','LA Rams','NFC West'),
    ('LAC','LA Chargers','AFC West'),('LV','Las Vegas','AFC West'),
    ('OAK','Las Vegas','AFC West'), ('MIA','Miami','AFC East'),
    ('MIN','Minnesota','NFC North'),('NE','New England','AFC East'),
    ('NO','New Orleans','NFC South'),('NYG','NY Giants','NFC East'),
    ('NYJ','NY Jets','AFC East'),   ('PHI','Philadelphia','NFC East'),
    ('PIT','Pittsburgh','AFC North'),('SEA','Seattle','NFC West'),
    ('SF','San Francisco','NFC West'),('TB','Tampa Bay','NFC South'),
    ('TEN','Tennessee','AFC South'),('WAS','Washington','NFC East'),
    ('WSH','Washington','NFC East')
  ),
  g AS (
    SELECT d.*,
      (d.final_home - d.final_away)                       AS mh,      -- home margin
      (d.final_home + d.final_away)                       AS tot,
      (d.fg_spread_close < 0)                             AS home_fav,
      (d.final_home - d.final_away + d.fg_spread_close)   AS hc,       -- home spread cover value
      (COALESCE(d.h1_home,0) - COALESCE(d.h1_away,0) + d.h1_spread_close) AS hc_h1
    FROM nfl_dryrun_games d
    WHERE d.season = p_season AND d.final_home IS NOT NULL AND d.final_away IS NOT NULL
  ),
  ex AS (SELECT g.*, s.is_home FROM g CROSS JOIN (VALUES (true),(false)) s(is_home))
  INSERT INTO nfl_analysis_base (
    exploded_id, unique_id, game_id, season, week, game_date, kickoff, is_home,
    team, opponent, team_abbr, opponent_abbr, team_score, opp_score,
    fg_spread, fg_total, total_points, ou_result, favorite_covered, underdog_covered,
    fg_won, fg_covered, is_favorite, team_ml, tt_line, tt_over, has_tt,
    h1_spread, h1_covered, h1_won, h1_total, h1_total_over, has_h1,
    referee, dome, temperature, wind_speed, is_division, team_division,
    is_primetime, day_of_week, season_type, coach, opp_coach, surface
  )
  SELECT
    (th.loc || ta.loc || ex.season::text || lpad(ex.week::text,2,'0'))
      || CASE WHEN ex.is_home THEN ':H' ELSE ':A' END,
    (th.loc || ta.loc || ex.season::text || lpad(ex.week::text,2,'0')),
    ex.game_id, ex.season, ex.week, ex.gameday,
    (ex.kickoff AT TIME ZONE 'America/New_York')::time, ex.is_home,
    CASE WHEN ex.is_home THEN th.loc ELSE ta.loc END,
    CASE WHEN ex.is_home THEN ta.loc ELSE th.loc END,
    CASE WHEN ex.is_home THEN ex.home_ab ELSE ex.away_ab END,
    CASE WHEN ex.is_home THEN ex.away_ab ELSE ex.home_ab END,
    CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END,
    CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END,
    CASE WHEN ex.is_home THEN ex.fg_spread_close ELSE -ex.fg_spread_close END,
    ex.fg_total_close, ex.tot,
    CASE WHEN ex.tot > ex.fg_total_close THEN 1 WHEN ex.tot < ex.fg_total_close THEN 0 ELSE NULL END,
    -- favorite/underdog covered (game-level, same on both rows)
    CASE WHEN ex.hc = 0 THEN NULL WHEN ex.home_fav THEN (ex.hc > 0)::int ELSE (ex.hc < 0)::int END,
    CASE WHEN ex.hc = 0 THEN NULL WHEN ex.home_fav THEN (ex.hc < 0)::int ELSE (ex.hc > 0)::int END,
    -- team perspective
    CASE WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            > (CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            < (CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END) THEN 0 ELSE NULL END,
    CASE WHEN (CASE WHEN ex.is_home THEN ex.hc ELSE -ex.hc END) = 0 THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc ELSE -ex.hc END) > 0 THEN 1 ELSE 0 END,
    ((CASE WHEN ex.is_home THEN ex.fg_spread_close ELSE -ex.fg_spread_close END) < 0),
    CASE WHEN ex.is_home THEN ex.fg_ml_home_close ELSE ex.fg_ml_away_close END,
    CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END,
    CASE WHEN (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            > (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            < (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) THEN 0 ELSE NULL END,
    (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) IS NOT NULL,
    -- 1H
    CASE WHEN ex.is_home THEN ex.h1_spread_close ELSE -ex.h1_spread_close END,
    CASE WHEN ex.h1_home IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc_h1 ELSE -ex.hc_h1 END) = 0 THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc_h1 ELSE -ex.hc_h1 END) > 0 THEN 1 ELSE 0 END,
    CASE WHEN ex.h1_home IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.h1_home ELSE ex.h1_away END)
            > (CASE WHEN ex.is_home THEN ex.h1_away ELSE ex.h1_home END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.h1_home ELSE ex.h1_away END)
            < (CASE WHEN ex.is_home THEN ex.h1_away ELSE ex.h1_home END) THEN 0 ELSE NULL END,
    ex.h1_total_close,
    CASE WHEN ex.h1_home IS NULL OR ex.h1_total_close IS NULL THEN NULL
         WHEN (ex.h1_home + ex.h1_away) > ex.h1_total_close THEN 1
         WHEN (ex.h1_home + ex.h1_away) < ex.h1_total_close THEN 0 ELSE NULL END,
    (ex.h1_home IS NOT NULL),
    ex.assigned_referee, ex.wx_indoors, ex.wx_temp_f, ex.wx_wind_mph,
    (th.div = ta.div),
    CASE WHEN ex.is_home THEN th.div ELSE ta.div END,
    (extract(hour FROM (ex.kickoff AT TIME ZONE 'America/New_York')) >= 19),
    to_char(ex.gameday, 'Dy'),
    CASE WHEN ex.week <= 18 THEN 'regular' ELSE 'postseason' END,
    -- coach/opp_coach/surface: not in dryrun_games -> from the nflverse meta patch (load_nab_patch.py)
    CASE WHEN ex.is_home THEN p.home_coach ELSE p.away_coach END,
    CASE WHEN ex.is_home THEN p.away_coach ELSE p.home_coach END,
    p.surface
  FROM ex
  JOIN tm th ON th.ab = ex.home_ab
  JOIN tm ta ON ta.ab = ex.away_ab
  LEFT JOIN _nab_patch p ON p.game_id = ex.game_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$function$;

-- ---------------------------------------------------------------------------
-- CFB  (conference / rank / neutral_site come straight from cfb_dryrun_games;
--        team names already match the base, so no location/division map needed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_cfb_analysis_base(p_season int)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_n integer;
BEGIN
  DELETE FROM cfb_analysis_base WHERE season = p_season;

  WITH g AS (
    SELECT d.*,
      (d.final_home - d.final_away)                     AS mh,
      (d.final_home + d.final_away)                     AS tot,
      (d.fg_spread_close < 0)                           AS home_fav,
      (d.final_home - d.final_away + d.fg_spread_close) AS hc,
      (COALESCE(d.h1_home,0) - COALESCE(d.h1_away,0) + d.h1_spread_close) AS hc_h1
    FROM cfb_dryrun_games d
    WHERE d.season = p_season AND d.final_home IS NOT NULL AND d.final_away IS NOT NULL
  ),
  ex AS (SELECT g.*, s.is_home FROM g CROSS JOIN (VALUES (true),(false)) s(is_home))
  INSERT INTO cfb_analysis_base (
    exploded_id, unique_id, game_id, season, week, game_date, kick_hour_et, is_home,
    team, opponent, team_conference, opponent_conference, team_rank, opp_rank,
    team_score, opp_score, fg_spread, fg_total, total_points, ou_result,
    fg_won, fg_covered, is_favorite, team_ml, tt_line, tt_over, has_tt,
    h1_spread, h1_covered, h1_won, h1_total, h1_total_over, has_h1,
    is_conference_game, neutral_site, is_primetime, temperature, wind_speed,
    dome, has_weather, day_of_week, game_type
  )
  SELECT
    -- CFB base convention: unique_id = numeric game_id, exploded_id = game_id||':H'/':A'
    (ex.game_id::text || CASE WHEN ex.is_home THEN ':H' ELSE ':A' END),
    ex.game_id::text,
    ex.game_id, ex.season, ex.week, (ex.kickoff AT TIME ZONE 'America/New_York')::date,
    extract(hour FROM (ex.kickoff AT TIME ZONE 'America/New_York'))::int, ex.is_home,
    CASE WHEN ex.is_home THEN ex.home_team ELSE ex.away_team END,
    CASE WHEN ex.is_home THEN ex.away_team ELSE ex.home_team END,
    CASE WHEN ex.is_home THEN ex.home_conf ELSE ex.away_conf END,
    CASE WHEN ex.is_home THEN ex.away_conf ELSE ex.home_conf END,
    CASE WHEN ex.is_home THEN ex.home_rank ELSE ex.away_rank END,
    CASE WHEN ex.is_home THEN ex.away_rank ELSE ex.home_rank END,
    CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END,
    CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END,
    CASE WHEN ex.is_home THEN ex.fg_spread_close ELSE -ex.fg_spread_close END,
    ex.fg_total_close, ex.tot,
    CASE WHEN ex.tot > ex.fg_total_close THEN 1 WHEN ex.tot < ex.fg_total_close THEN 0 ELSE NULL END,
    CASE WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            > (CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            < (CASE WHEN ex.is_home THEN ex.final_away ELSE ex.final_home END) THEN 0 ELSE NULL END,
    CASE WHEN (CASE WHEN ex.is_home THEN ex.hc ELSE -ex.hc END) = 0 THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc ELSE -ex.hc END) > 0 THEN 1 ELSE 0 END,
    ((CASE WHEN ex.is_home THEN ex.fg_spread_close ELSE -ex.fg_spread_close END) < 0),
    CASE WHEN ex.is_home THEN ex.fg_ml_home_close ELSE ex.fg_ml_away_close END,
    CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END,
    CASE WHEN (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            > (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.final_home ELSE ex.final_away END)
            < (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) THEN 0 ELSE NULL END,
    (CASE WHEN ex.is_home THEN ex.tt_home_close ELSE ex.tt_away_close END) IS NOT NULL,
    CASE WHEN ex.is_home THEN ex.h1_spread_close ELSE -ex.h1_spread_close END,
    CASE WHEN ex.h1_home IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc_h1 ELSE -ex.hc_h1 END) = 0 THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.hc_h1 ELSE -ex.hc_h1 END) > 0 THEN 1 ELSE 0 END,
    CASE WHEN ex.h1_home IS NULL THEN NULL
         WHEN (CASE WHEN ex.is_home THEN ex.h1_home ELSE ex.h1_away END)
            > (CASE WHEN ex.is_home THEN ex.h1_away ELSE ex.h1_home END) THEN 1
         WHEN (CASE WHEN ex.is_home THEN ex.h1_home ELSE ex.h1_away END)
            < (CASE WHEN ex.is_home THEN ex.h1_away ELSE ex.h1_home END) THEN 0 ELSE NULL END,
    ex.h1_total_close,
    CASE WHEN ex.h1_home IS NULL OR ex.h1_total_close IS NULL THEN NULL
         WHEN (ex.h1_home + ex.h1_away) > ex.h1_total_close THEN 1
         WHEN (ex.h1_home + ex.h1_away) < ex.h1_total_close THEN 0 ELSE NULL END,
    (ex.h1_home IS NOT NULL),
    (ex.home_conf IS NOT DISTINCT FROM ex.away_conf), ex.neutral_site,
    (extract(hour FROM (ex.kickoff AT TIME ZONE 'America/New_York')) >= 19),
    ex.wx_temp_f, ex.wx_wind_mph, ex.wx_indoors, (ex.wx_temp_f IS NOT NULL),
    to_char((ex.kickoff AT TIME ZONE 'America/New_York'), 'Dy'),
    'regular'
  FROM ex;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$function$;
