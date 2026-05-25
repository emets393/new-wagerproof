-- Reshape get_mlb_player_props_l10 for the revamped player-prop UI. Returns raw
-- materials so the page computes L10 + contextual splits client-side for any
-- selected line: game_is_day, opp_archetype_today (the starter THIS batter faces
-- tonight; null for pitchers), lines jsonb ([{line,over,under}] asc = the ladder),
-- and games jsonb ([{v,d,a}] most recent first = season per-game value + day flag
-- + opposing-starter archetype). UI: L10 dots = first N games' v vs line; day/night
-- split = filter d to game_is_day; archetype split = filter a == opp_archetype_today.
DROP FUNCTION IF EXISTS public.get_mlb_player_props_l10(bigint, int);

CREATE FUNCTION public.get_mlb_player_props_l10(p_game_pk bigint, p_window int DEFAULT 10)
RETURNS TABLE (
  player_id integer, player_name text, is_pitcher boolean, market text,
  game_is_day boolean, opp_archetype_today text,
  lines jsonb, games jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH gctx AS (
    SELECT s.game_pk, s.official_date,
           (EXTRACT(HOUR FROM s.game_time_et AT TIME ZONE 'America/New_York') < 17) AS gid,
           ah.archetype AS home_arch, aa.archetype AS away_arch
    FROM public.mlb_schedule s
    LEFT JOIN public.v_mlb_pitcher_archetypes ah
      ON ah.pitcher_id = s.home_sp_id AND ah.season = EXTRACT(YEAR FROM s.official_date)::int
    LEFT JOIN public.v_mlb_pitcher_archetypes aa
      ON aa.pitcher_id = s.away_sp_id AND aa.season = EXTRACT(YEAR FROM s.official_date)::int
    WHERE s.game_pk = p_game_pk
  ),
  lu AS (SELECT player_id, home_away FROM public.mlb_game_lineups WHERE game_pk = p_game_pk),
  pk AS (
    SELECT DISTINCT pp.player_id, pp.player_name, pp.is_pitcher, pp.market, pp.official_date
    FROM public.mlb_player_props pp
    WHERE pp.game_pk = p_game_pk AND pp.player_id IS NOT NULL
  ),
  ladder AS (
    SELECT player_id, market,
           jsonb_agg(jsonb_build_object('line', line, 'over', over_odds, 'under', under_odds) ORDER BY line) AS lines
    FROM public.mlb_player_props
    WHERE game_pk = p_game_pk AND player_id IS NOT NULL
    GROUP BY player_id, market
  ),
  sg AS (
    SELECT pk.player_id, pk.market,
           jsonb_agg(jsonb_build_object('v', v.value, 'd', (CASE WHEN v.is_day THEN 1 ELSE 0 END), 'a', v.opp_arch)
                     ORDER BY v.gdate DESC, v.gpk DESC) AS games
    FROM pk
    CROSS JOIN LATERAL (
      SELECT x.value, x.gdate, x.gpk,
             (EXTRACT(HOUR FROM s2.game_time_et AT TIME ZONE 'America/New_York') < 17) AS is_day,
             CASE WHEN NOT pk.is_pitcher THEN arch.archetype END AS opp_arch
      FROM (
        SELECT (CASE pk.market
                  WHEN 'batter_home_runs'      THEN bl.home_runs
                  WHEN 'batter_hits'           THEN bl.hits
                  WHEN 'batter_total_bases'    THEN bl.total_bases
                  WHEN 'batter_rbis'           THEN bl.rbi
                  WHEN 'batter_hits_runs_rbis' THEN bl.hits_runs_rbis
                  WHEN 'batter_walks'          THEN bl.walks
                  WHEN 'batter_strikeouts'     THEN bl.strikeouts
                END)::numeric AS value, bl.official_date AS gdate, bl.game_pk AS gpk, bl.home_away
        FROM public.mlb_batter_logs bl
        WHERE NOT pk.is_pitcher AND bl.player_id = pk.player_id
          AND bl.season = EXTRACT(YEAR FROM pk.official_date)::int AND bl.official_date < pk.official_date
        UNION ALL
        SELECT (CASE pk.market
                  WHEN 'pitcher_strikeouts'   THEN pl.strikeouts
                  WHEN 'pitcher_hits_allowed' THEN pl.hits_allowed
                  WHEN 'pitcher_walks'        THEN pl.walks
                  WHEN 'pitcher_outs'         THEN round(pl.ip_official * 3)::int
                END)::numeric AS value, pl.official_date AS gdate, pl.game_pk AS gpk, pl.home_away
        FROM public.mlb_pitcher_logs pl
        WHERE pk.is_pitcher AND pl.pitcher_id = pk.player_id
          AND pl.season = EXTRACT(YEAR FROM pk.official_date)::int AND pl.official_date < pk.official_date
      ) x
      JOIN public.mlb_schedule s2 ON s2.game_pk = x.gpk
      LEFT JOIN public.v_mlb_pitcher_archetypes arch
        ON NOT pk.is_pitcher AND arch.season = EXTRACT(YEAR FROM pk.official_date)::int
       AND arch.pitcher_id = (CASE WHEN x.home_away = 'home' THEN s2.away_sp_id ELSE s2.home_sp_id END)
      WHERE x.value IS NOT NULL
    ) v
    GROUP BY pk.player_id, pk.market
  )
  SELECT pk.player_id, pk.player_name, pk.is_pitcher, pk.market,
         g.gid AS game_is_day,
         CASE WHEN pk.is_pitcher THEN NULL
              WHEN lu.home_away = 'home' THEN g.away_arch
              WHEN lu.home_away = 'away' THEN g.home_arch END AS opp_archetype_today,
         COALESCE(l.lines, '[]'::jsonb), COALESCE(s.games, '[]'::jsonb)
  FROM pk
  CROSS JOIN gctx g
  LEFT JOIN lu ON lu.player_id = pk.player_id
  LEFT JOIN ladder l ON l.player_id = pk.player_id AND l.market = pk.market
  LEFT JOIN sg s ON s.player_id = pk.player_id AND s.market = pk.market
  ORDER BY pk.is_pitcher, pk.player_name, pk.market;
$$;

GRANT EXECUTE ON FUNCTION public.get_mlb_player_props_l10(bigint, int) TO anon, authenticated;
