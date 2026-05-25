-- Optimize get_mlb_player_props_l10 to stop timing out under concurrent load.
-- The previous version joined v_mlb_pitcher_archetypes (a heavy multi-CTE view)
-- inside a per-row LATERAL — that view got recomputed for every historical game
-- for every player. ~13 games × ~30 players × ~50 historical games × 13 concurrent
-- calls from the matchups page blew past statement_timeout and PostgREST returned
-- 500 ("Props not posted yet" in the UI).
--
-- New version: pull the game context once, then MATERIALIZED CTEs for the
-- archetype view (scoped to season + only pitcher_ids we touch) and for the
-- schedule rows of historical game_pks we touch. The heavy view computes once
-- per call instead of per row. Cold cost ~225 ms per game; 13 concurrent calls
-- complete in ~2 s instead of timing out.
DROP FUNCTION IF EXISTS public.get_mlb_player_props_l10(bigint, int);

CREATE FUNCTION public.get_mlb_player_props_l10(p_game_pk bigint, p_window int DEFAULT 10)
RETURNS TABLE (
  player_id integer, player_name text, is_pitcher boolean, market text,
  game_is_day boolean, opp_archetype_today text,
  lines jsonb, games jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_season int;
  v_official_date date;
  v_game_is_day boolean;
  v_home_arch text;
  v_away_arch text;
BEGIN
  SELECT
    EXTRACT(YEAR FROM s.official_date)::int,
    s.official_date,
    (EXTRACT(HOUR FROM s.game_time_et AT TIME ZONE 'America/New_York') < 17),
    ah.archetype,
    aa.archetype
  INTO v_season, v_official_date, v_game_is_day, v_home_arch, v_away_arch
  FROM mlb_schedule s
  LEFT JOIN v_mlb_pitcher_archetypes ah
    ON ah.pitcher_id = s.home_sp_id AND ah.season = EXTRACT(YEAR FROM s.official_date)::int
  LEFT JOIN v_mlb_pitcher_archetypes aa
    ON aa.pitcher_id = s.away_sp_id AND aa.season = EXTRACT(YEAR FROM s.official_date)::int
  WHERE s.game_pk = p_game_pk;

  IF v_season IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  pk AS (
    SELECT DISTINCT pp.player_id, pp.player_name, pp.is_pitcher, pp.market
    FROM mlb_player_props pp
    WHERE pp.game_pk = p_game_pk AND pp.player_id IS NOT NULL
  ),
  lu AS (
    SELECT gl.player_id, gl.home_away FROM mlb_game_lineups gl WHERE gl.game_pk = p_game_pk
  ),
  ladder AS (
    SELECT pp.player_id, pp.market,
      jsonb_agg(
        jsonb_build_object('line', pp.line, 'over', pp.over_odds, 'under', pp.under_odds)
        ORDER BY pp.line
      ) AS lines
    FROM mlb_player_props pp
    WHERE pp.game_pk = p_game_pk AND pp.player_id IS NOT NULL
    GROUP BY pp.player_id, pp.market
  ),
  -- DISTINCT is critical: pk has one row per (player, market) so without it the
  -- downstream JOIN to mlb_batter_logs/mlb_pitcher_logs multiplies every log row
  -- by the per-player market count (e.g. 6× for a batter with hits + tb + rbi
  -- + hrr + walks + k), inflating the games[] array and corrupting hit rates.
  batter_ids AS (SELECT DISTINCT pk.player_id FROM pk WHERE NOT pk.is_pitcher),
  pitcher_ids AS (SELECT DISTINCT pk.player_id FROM pk WHERE pk.is_pitcher),
  bl AS MATERIALIZED (
    SELECT bl.player_id, bl.game_pk, bl.official_date, bl.home_away,
      bl.home_runs, bl.hits, bl.total_bases, bl.rbi, bl.hits_runs_rbis, bl.walks, bl.strikeouts
    FROM mlb_batter_logs bl
    JOIN batter_ids b ON b.player_id = bl.player_id
    WHERE bl.season = v_season AND bl.official_date < v_official_date
  ),
  pl AS MATERIALIZED (
    SELECT pl.pitcher_id, pl.game_pk, pl.official_date, pl.home_away,
      pl.strikeouts, pl.hits_allowed, pl.walks, ROUND(pl.ip_official * 3)::int AS outs
    FROM mlb_pitcher_logs pl
    JOIN pitcher_ids p ON p.player_id = pl.pitcher_id
    WHERE pl.season = v_season AND pl.official_date < v_official_date
  ),
  hist_games AS (
    SELECT game_pk FROM bl
    UNION
    SELECT game_pk FROM pl
  ),
  sched AS MATERIALIZED (
    SELECT s.game_pk,
      (EXTRACT(HOUR FROM s.game_time_et AT TIME ZONE 'America/New_York') < 17) AS is_day,
      s.home_sp_id, s.away_sp_id
    FROM mlb_schedule s
    JOIN hist_games h ON h.game_pk = s.game_pk
  ),
  arch_pitchers AS (
    SELECT home_sp_id AS pid FROM sched WHERE home_sp_id IS NOT NULL
    UNION
    SELECT away_sp_id FROM sched WHERE away_sp_id IS NOT NULL
  ),
  -- The heavy view runs once per call here, scoped to season + relevant pitchers.
  arch AS MATERIALIZED (
    SELECT v.pitcher_id, v.archetype
    FROM v_mlb_pitcher_archetypes v
    JOIN arch_pitchers a ON a.pid = v.pitcher_id
    WHERE v.season = v_season
  ),
  opp_arch AS (
    SELECT s.game_pk, 'home'::text AS batter_home_away, arch.archetype
    FROM sched s LEFT JOIN arch ON arch.pitcher_id = s.away_sp_id
    UNION ALL
    SELECT s.game_pk, 'away'::text AS batter_home_away, arch.archetype
    FROM sched s LEFT JOIN arch ON arch.pitcher_id = s.home_sp_id
  ),
  bg AS (
    SELECT pk.player_id, pk.market, b.official_date, b.game_pk,
      sched.is_day,
      oa.archetype AS opp_arch,
      (CASE pk.market
        WHEN 'batter_home_runs'      THEN b.home_runs
        WHEN 'batter_hits'           THEN b.hits
        WHEN 'batter_total_bases'    THEN b.total_bases
        WHEN 'batter_rbis'           THEN b.rbi
        WHEN 'batter_hits_runs_rbis' THEN b.hits_runs_rbis
        WHEN 'batter_walks'          THEN b.walks
        WHEN 'batter_strikeouts'     THEN b.strikeouts
      END)::numeric AS value
    FROM pk
    JOIN bl b ON b.player_id = pk.player_id
    LEFT JOIN sched ON sched.game_pk = b.game_pk
    LEFT JOIN opp_arch oa ON oa.game_pk = b.game_pk AND oa.batter_home_away = b.home_away
    WHERE NOT pk.is_pitcher
  ),
  pg AS (
    SELECT pk.player_id, pk.market, p.official_date, p.game_pk,
      sched.is_day,
      NULL::text AS opp_arch,
      (CASE pk.market
        WHEN 'pitcher_strikeouts'   THEN p.strikeouts::numeric
        WHEN 'pitcher_hits_allowed' THEN p.hits_allowed::numeric
        WHEN 'pitcher_walks'        THEN p.walks::numeric
        WHEN 'pitcher_outs'         THEN p.outs::numeric
      END) AS value
    FROM pk
    JOIN pl p ON p.pitcher_id = pk.player_id
    LEFT JOIN sched ON sched.game_pk = p.game_pk
    WHERE pk.is_pitcher
  ),
  sg AS (
    SELECT u.player_id, u.market,
      jsonb_agg(
        jsonb_build_object(
          'v',  u.value,
          'd',  (CASE WHEN u.is_day THEN 1 ELSE 0 END),
          'a',  u.opp_arch,
          -- ISO date so the bar chart can label its x-axis with the actual game dates.
          'dt', to_char(u.official_date, 'YYYY-MM-DD')
        )
        ORDER BY u.official_date DESC, u.game_pk DESC
      ) AS games
    FROM (
      SELECT * FROM bg WHERE value IS NOT NULL
      UNION ALL
      SELECT * FROM pg WHERE value IS NOT NULL
    ) u
    GROUP BY u.player_id, u.market
  )
  SELECT pk.player_id, pk.player_name, pk.is_pitcher, pk.market,
    v_game_is_day AS game_is_day,
    CASE WHEN pk.is_pitcher THEN NULL
         WHEN lu.home_away = 'home' THEN v_away_arch
         WHEN lu.home_away = 'away' THEN v_home_arch END AS opp_archetype_today,
    COALESCE(l.lines, '[]'::jsonb) AS lines,
    COALESCE(s.games, '[]'::jsonb) AS games
  FROM pk
  LEFT JOIN lu ON lu.player_id = pk.player_id
  LEFT JOIN ladder l ON l.player_id = pk.player_id AND l.market = pk.market
  LEFT JOIN sg s ON s.player_id = pk.player_id AND s.market = pk.market
  ORDER BY pk.is_pitcher, pk.player_name, pk.market;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mlb_player_props_l10(bigint, int) TO anon, authenticated;
