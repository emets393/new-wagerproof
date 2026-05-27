-- Algorithm versioning for the Best Picks Report.
-- Bumped on every meaningful scoring change in src/utils/dailyPropsReport.ts.
-- Picks land tagged with the version that generated them; the performance
-- view auto-filters to the latest version present for each report_date,
-- so mid-day algo tuning never contaminates the dashboard.

ALTER TABLE public.mlb_player_prop_picks
  ADD COLUMN IF NOT EXISTS algo_version int NOT NULL DEFAULT 1;
ALTER TABLE public.mlb_player_prop_grades
  ADD COLUMN IF NOT EXISTS algo_version int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_player_prop_picks_date_algo
  ON public.mlb_player_prop_picks (report_date DESC, algo_version DESC);

-- Replace the snapshot RPC: now accepts an algo_version, refuses to
-- overwrite picks from a NEWER version (prevents stale browser tabs from
-- silently regressing the picks table).
DROP FUNCTION IF EXISTS public.snapshot_player_prop_picks(date, jsonb);
DROP FUNCTION IF EXISTS public.snapshot_player_prop_picks(date, jsonb, int);

CREATE FUNCTION public.snapshot_player_prop_picks(
  p_report_date  date,
  p_picks        jsonb,
  p_algo_version int DEFAULT 1
) RETURNS TABLE (upserted int, locked_total int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_upserted int := 0;
  v_locked   int := 0;
  v_now      timestamptz := now();
BEGIN
  UPDATE mlb_player_prop_picks p
     SET locked = true,
         locked_at = COALESCE(locked_at, v_now)
   WHERE p.report_date = p_report_date
     AND p.locked = false
     AND p.game_time IS NOT NULL
     AND p.game_time <= v_now;

  WITH src AS (
    SELECT
      p_report_date                                AS report_date,
      (x->>'game_pk')::bigint                       AS game_pk,
      (x->>'player_id')::int                        AS player_id,
      x->>'market'                                  AS market,
      COALESCE(x->>'side', 'over')                  AS side,
      x->>'player_name'                             AS player_name,
      NULLIF(x->>'team_name', '')                   AS team_name,
      x->>'game_label'                              AS game_label,
      NULLIF(x->>'game_time', '')::timestamptz      AS game_time,
      COALESCE((x->>'is_day')::boolean, false)      AS is_day,
      x->>'market_label'                            AS market_label,
      x->>'kind'                                    AS kind,
      x->>'tier'                                    AS tier,
      (x->>'score')::int                            AS score,
      (x->>'line')::numeric                         AS line,
      NULLIF(x->>'over_odds','')::int               AS over_odds,
      NULLIF(x->>'under_odds','')::int              AS under_odds,
      NULLIF(x->>'l10_over','')::int                AS l10_over,
      NULLIF(x->>'l10_games','')::int               AS l10_games,
      NULLIF(x->>'l10_pct','')::int                 AS l10_pct,
      x->'rationale'                                AS rationale,
      p_algo_version                                AS algo_version,
      COALESCE(NULLIF(x->>'game_time', '')::timestamptz <= v_now, false) AS starts_now
    FROM jsonb_array_elements(p_picks) x
  )
  INSERT INTO mlb_player_prop_picks (
    report_date, game_pk, player_id, market, side,
    player_name, team_name, game_label, game_time, is_day,
    market_label, kind, tier, score, line,
    over_odds, under_odds, l10_over, l10_games, l10_pct, rationale,
    algo_version, locked, locked_at
  )
  SELECT
    report_date, game_pk, player_id, market, side,
    player_name, team_name, game_label, game_time, is_day,
    market_label, kind, tier, score, line,
    over_odds, under_odds, l10_over, l10_games, l10_pct, rationale,
    algo_version, starts_now,
    CASE WHEN starts_now THEN v_now ELSE NULL END
  FROM src
  ON CONFLICT (report_date, game_pk, player_id, market, side) DO UPDATE
    SET tier            = EXCLUDED.tier,
        score           = EXCLUDED.score,
        line            = EXCLUDED.line,
        over_odds       = EXCLUDED.over_odds,
        under_odds      = EXCLUDED.under_odds,
        l10_over        = EXCLUDED.l10_over,
        l10_games       = EXCLUDED.l10_games,
        l10_pct         = EXCLUDED.l10_pct,
        rationale       = EXCLUDED.rationale,
        team_name       = EXCLUDED.team_name,
        game_label      = EXCLUDED.game_label,
        market_label    = EXCLUDED.market_label,
        is_day          = EXCLUDED.is_day,
        algo_version    = EXCLUDED.algo_version,
        last_updated_at = v_now
    -- Locked picks are immutable. Also refuse to overwrite a row whose
    -- existing algo_version is HIGHER than the writer's — keeps a stale
    -- browser tab from silently rolling back to an older algo's pick.
    WHERE mlb_player_prop_picks.locked = false
      AND mlb_player_prop_picks.algo_version <= EXCLUDED.algo_version;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  SELECT count(*)::int INTO v_locked
    FROM mlb_player_prop_picks
   WHERE report_date = p_report_date AND locked = true;

  RETURN QUERY SELECT v_upserted, v_locked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_player_prop_picks(date, jsonb, int)
  TO anon, authenticated;

-- Grading: copy algo_version from the source pick row.
CREATE OR REPLACE FUNCTION public.grade_mlb_player_prop_picks(p_report_date date)
RETURNS TABLE (graded int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_graded int := 0;
BEGIN
  WITH src AS (
    SELECT
      p.report_date, p.game_pk, p.player_id, p.market, p.side,
      p.player_name, p.team_name, p.market_label, p.kind, p.tier,
      p.score, p.line, p.over_odds, p.under_odds, p.l10_pct, p.algo_version,
      CASE p.market
        WHEN 'batter_home_runs'      THEN bl.home_runs::numeric
        WHEN 'batter_hits'           THEN bl.hits::numeric
        WHEN 'batter_total_bases'    THEN bl.total_bases::numeric
        WHEN 'batter_rbis'           THEN bl.rbi::numeric
        WHEN 'batter_hits_runs_rbis' THEN bl.hits_runs_rbis::numeric
        WHEN 'batter_walks'          THEN bl.walks::numeric
        WHEN 'batter_strikeouts'     THEN bl.strikeouts::numeric
        WHEN 'pitcher_strikeouts'    THEN pl.strikeouts::numeric
        WHEN 'pitcher_hits_allowed'  THEN pl.hits_allowed::numeric
        WHEN 'pitcher_walks'         THEN pl.walks::numeric
        WHEN 'pitcher_outs'          THEN ROUND(pl.ip_official * 3)::numeric
      END AS actual_value,
      CASE p.tier WHEN 'lean' THEN 0.5 WHEN 'strong' THEN 1.0 WHEN 'elite' THEN 1.5 END
        AS units_staked
    FROM mlb_player_prop_picks p
    LEFT JOIN mlb_batter_logs  bl ON bl.player_id  = p.player_id AND bl.game_pk = p.game_pk
    LEFT JOIN mlb_pitcher_logs pl ON pl.pitcher_id = p.player_id AND pl.game_pk = p.game_pk
    WHERE p.report_date = p_report_date
  ),
  graded AS (
    SELECT *,
      CASE
        WHEN actual_value IS NULL THEN 'pending'
        WHEN actual_value > line  THEN (CASE WHEN side = 'over' THEN 'won' ELSE 'lost' END)
        WHEN actual_value < line  THEN (CASE WHEN side = 'over' THEN 'lost' ELSE 'won' END)
        ELSE 'push'
      END AS result
    FROM src
  ),
  priced AS (
    SELECT *,
      CASE
        WHEN result = 'won' AND over_odds IS NOT NULL AND over_odds > 0
          THEN units_staked * (over_odds::numeric / 100)
        WHEN result = 'won' AND over_odds IS NOT NULL AND over_odds < 0
          THEN units_staked * (100::numeric / (-over_odds))
        WHEN result = 'won'  THEN units_staked
        WHEN result = 'lost' THEN -units_staked
        WHEN result = 'push' THEN 0
        ELSE NULL
      END AS units_won
    FROM graded
  )
  INSERT INTO mlb_player_prop_grades (
    report_date, game_pk, player_id, market, side,
    player_name, team_name, market_label, kind, tier, score,
    line, over_odds, under_odds, l10_pct, algo_version,
    actual_value, result, units_staked, units_won, graded_at
  )
  SELECT
    report_date, game_pk, player_id, market, side,
    player_name, team_name, market_label, kind, tier, score,
    line, over_odds, under_odds, l10_pct, algo_version,
    actual_value, result, units_staked, units_won, now()
  FROM priced
  ON CONFLICT (report_date, game_pk, player_id, market, side) DO UPDATE
    SET actual_value = EXCLUDED.actual_value,
        result       = EXCLUDED.result,
        units_won    = EXCLUDED.units_won,
        algo_version = EXCLUDED.algo_version,
        graded_at    = now();

  GET DIAGNOSTICS v_graded = ROW_COUNT;
  RETURN QUERY SELECT v_graded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_mlb_player_prop_picks(date) TO service_role;

-- Performance summary view now filters to the LATEST algo_version present
-- for each report_date. If a day had mid-day tuning, the dashboard
-- automatically shows only picks from the final algo of the day.
CREATE OR REPLACE VIEW public.v_mlb_player_prop_grade_summary AS
  WITH latest_per_day AS (
    SELECT report_date, MAX(algo_version) AS latest_v
    FROM mlb_player_prop_grades GROUP BY report_date
  ),
  filtered AS (
    SELECT g.*
    FROM mlb_player_prop_grades g
    JOIN latest_per_day l
      ON l.report_date = g.report_date
     AND l.latest_v   = g.algo_version
  )
  SELECT
    tier, market, market_label, kind,
    COUNT(*)                                    AS picks_total,
    COUNT(*) FILTER (WHERE result = 'won')       AS picks_won,
    COUNT(*) FILTER (WHERE result = 'lost')      AS picks_lost,
    COUNT(*) FILTER (WHERE result = 'push')      AS picks_push,
    COUNT(*) FILTER (WHERE result = 'pending')   AS picks_pending,
    ROUND(
      AVG(CASE WHEN result IN ('won','lost') THEN
        CASE WHEN result = 'won' THEN 1.0 ELSE 0.0 END END) * 100, 1
    )                                            AS win_pct,
    SUM(units_staked) FILTER (WHERE result IN ('won','lost','push')) AS units_staked,
    SUM(units_won)    FILTER (WHERE result IN ('won','lost','push')) AS units_won,
    CASE WHEN SUM(units_staked) FILTER (WHERE result IN ('won','lost')) > 0
      THEN ROUND(
        (SUM(units_won) FILTER (WHERE result IN ('won','lost','push')))
        / NULLIF(SUM(units_staked) FILTER (WHERE result IN ('won','lost','push')), 0)
        * 100, 1)
      ELSE NULL
    END                                          AS roi_pct
  FROM filtered
  GROUP BY tier, market, market_label, kind;

GRANT SELECT ON public.v_mlb_player_prop_grade_summary TO anon, authenticated;
