-- get_mlb_player_props_l10(p_game_pk, p_window) — powers the matchups-page
-- player-props UI. Returns every prop for a game (line + odds) WITH:
--   * the L10 headline: l10_values[], l10_over[] (cleared-the-line bools),
--     l10_over_count, l10_games
--   * click-to-expand season splits: overall, day vs night (batters &
--     pitchers), and vs the opposing STARTER's archetype (batters only,
--     vs_arch jsonb {archetype:{g,o}}; relievers follow so it's starter-based).
-- Joins mlb_player_props -> mlb_batter_logs / mlb_pitcher_logs (per-game stats)
-- -> mlb_schedule (day/night via game_time_et <5pm ET; opposing starter) ->
-- v_mlb_pitcher_archetypes. SECURITY DEFINER (public sports data, paywalled app).
DROP FUNCTION IF EXISTS public.get_mlb_player_props_l10(bigint, int);

CREATE FUNCTION public.get_mlb_player_props_l10(p_game_pk bigint, p_window int DEFAULT 10)
RETURNS TABLE (
  player_id integer, player_name text, is_pitcher boolean, market text,
  line numeric, over_odds integer, under_odds integer,
  l10_values numeric[], l10_over boolean[], l10_over_count integer, l10_games integer,
  season_games integer, season_over integer,
  day_games integer, day_over integer, night_games integer, night_over integer,
  vs_arch jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH props AS (
    SELECT * FROM public.mlb_player_props
    WHERE game_pk = p_game_pk AND player_id IS NOT NULL
  ),
  gs AS (
    SELECT pp.id AS prop_id, pp.line, pp.is_pitcher,
           v.value, v.gdate, v.gpk,
           (EXTRACT(HOUR FROM s.game_time_et AT TIME ZONE 'America/New_York') < 17) AS is_day,
           CASE WHEN NOT pp.is_pitcher THEN arch.archetype END AS opp_arch
    FROM props pp
    CROSS JOIN LATERAL (
      SELECT (CASE pp.market
                WHEN 'batter_home_runs'      THEN bl.home_runs
                WHEN 'batter_hits'           THEN bl.hits
                WHEN 'batter_total_bases'    THEN bl.total_bases
                WHEN 'batter_rbis'           THEN bl.rbi
                WHEN 'batter_hits_runs_rbis' THEN bl.hits_runs_rbis
                WHEN 'batter_walks'          THEN bl.walks
                WHEN 'batter_strikeouts'     THEN bl.strikeouts
              END)::numeric AS value, bl.official_date AS gdate, bl.game_pk AS gpk, bl.home_away
      FROM public.mlb_batter_logs bl
      WHERE NOT pp.is_pitcher AND bl.player_id = pp.player_id
        AND bl.season = EXTRACT(YEAR FROM COALESCE(pp.official_date, CURRENT_DATE))::int
        AND bl.official_date < COALESCE(pp.official_date, CURRENT_DATE)
      UNION ALL
      SELECT (CASE pp.market
                WHEN 'pitcher_strikeouts'   THEN pl.strikeouts
                WHEN 'pitcher_hits_allowed' THEN pl.hits_allowed
                WHEN 'pitcher_walks'        THEN pl.walks
                WHEN 'pitcher_outs'         THEN round(pl.ip_official * 3)::int
              END)::numeric AS value, pl.official_date AS gdate, pl.game_pk AS gpk, pl.home_away
      FROM public.mlb_pitcher_logs pl
      WHERE pp.is_pitcher AND pl.pitcher_id = pp.player_id
        AND pl.season = EXTRACT(YEAR FROM COALESCE(pp.official_date, CURRENT_DATE))::int
        AND pl.official_date < COALESCE(pp.official_date, CURRENT_DATE)
    ) v
    JOIN public.mlb_schedule s ON s.game_pk = v.gpk
    LEFT JOIN public.v_mlb_pitcher_archetypes arch
      ON NOT pp.is_pitcher
     AND arch.season = EXTRACT(YEAR FROM COALESCE(pp.official_date, CURRENT_DATE))::int
     AND arch.pitcher_id = (CASE WHEN v.home_away = 'home' THEN s.away_sp_id ELSE s.home_sp_id END)
    WHERE v.value IS NOT NULL
  ),
  ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY prop_id ORDER BY gdate DESC, gpk DESC) AS rn FROM gs),
  l10 AS (
    SELECT prop_id,
           array_agg(value ORDER BY gdate DESC, gpk DESC)          AS l10_values,
           array_agg((value > line) ORDER BY gdate DESC, gpk DESC) AS l10_over,
           count(*) FILTER (WHERE value > line)::int AS l10_over_count,
           count(*)::int AS l10_games
    FROM ranked WHERE rn <= p_window GROUP BY prop_id
  ),
  szn AS (
    SELECT prop_id,
           count(*)::int AS season_games, count(*) FILTER (WHERE value > line)::int AS season_over,
           count(*) FILTER (WHERE is_day)::int AS day_games,
           count(*) FILTER (WHERE is_day AND value > line)::int AS day_over,
           count(*) FILTER (WHERE NOT is_day)::int AS night_games,
           count(*) FILTER (WHERE NOT is_day AND value > line)::int AS night_over
    FROM gs GROUP BY prop_id
  ),
  arch AS (
    SELECT prop_id, jsonb_object_agg(opp_arch, jsonb_build_object('g', g, 'o', o)) AS vs_arch
    FROM (
      SELECT prop_id, opp_arch, count(*)::int AS g, count(*) FILTER (WHERE value > line)::int AS o
      FROM gs WHERE opp_arch IS NOT NULL AND opp_arch <> 'Insufficient'
      GROUP BY prop_id, opp_arch
    ) t GROUP BY prop_id
  )
  SELECT pp.player_id, pp.player_name, pp.is_pitcher, pp.market, pp.line, pp.over_odds, pp.under_odds,
         l.l10_values, l.l10_over, COALESCE(l.l10_over_count,0), COALESCE(l.l10_games,0),
         COALESCE(sz.season_games,0), COALESCE(sz.season_over,0),
         COALESCE(sz.day_games,0), COALESCE(sz.day_over,0),
         COALESCE(sz.night_games,0), COALESCE(sz.night_over,0),
         a.vs_arch
  FROM props pp
  LEFT JOIN l10 l ON l.prop_id = pp.id
  LEFT JOIN szn sz ON sz.prop_id = pp.id
  LEFT JOIN arch a ON a.prop_id = pp.id
  ORDER BY pp.is_pitcher, pp.player_name, pp.market;
$$;

GRANT EXECUTE ON FUNCTION public.get_mlb_player_props_l10(bigint, int) TO anon, authenticated;
