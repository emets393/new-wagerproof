-- Defensive guard: the writer's payload occasionally contains game_pks whose
-- mlb_schedule.official_date does NOT match p_report_date. Those picks get
-- locked immediately (their game_time is in the past) and pollute the grader.
-- We now drop any writer-pick whose game_pk doesn't belong to p_report_date
-- BEFORE the INSERT and PRUNE steps run. The dropped count is returned so the
-- edge fn can log it.
--
-- See research/2026-team-run-scoring-diagnostic.md context — this guard was
-- added after discovering 17/20 picks for 2026-05-28 referenced 2026-05-27
-- games (their game_pks resolved to yesterday's slate in mlb_schedule).
DROP FUNCTION IF EXISTS public.snapshot_player_prop_picks(date, jsonb, int);

CREATE FUNCTION public.snapshot_player_prop_picks(
  p_report_date  date,
  p_picks        jsonb,
  p_algo_version int DEFAULT 1
) RETURNS TABLE (upserted int, locked_total int, pruned int, dropped_wrong_date int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_upserted int := 0;
  v_locked   int := 0;
  v_pruned   int := 0;
  v_dropped  int := 0;
  v_now      timestamptz := now();
BEGIN
  UPDATE mlb_player_prop_picks p
     SET locked = true,
         locked_at = COALESCE(locked_at, v_now)
   WHERE p.report_date = p_report_date
     AND p.locked = false
     AND p.game_time IS NOT NULL
     AND p.game_time <= v_now;

  CREATE TEMP TABLE _writer_picks ON COMMIT DROP AS
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
  FROM jsonb_array_elements(p_picks) x;

  -- DATE GUARD: drop any writer-pick whose game_pk doesn't belong to
  -- p_report_date in mlb_schedule. Prevents yesterday's slate from being
  -- written under today's report_date.
  WITH dropped AS (
    DELETE FROM _writer_picks w
    WHERE NOT EXISTS (
      SELECT 1 FROM mlb_schedule s
      WHERE s.game_pk = w.game_pk AND s.official_date = p_report_date
    )
    RETURNING 1
  )
  SELECT count(*)::int INTO v_dropped FROM dropped;

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
  FROM _writer_picks
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
    WHERE mlb_player_prop_picks.locked = false
      AND mlb_player_prop_picks.algo_version <= EXCLUDED.algo_version;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  WITH deleted AS (
    DELETE FROM mlb_player_prop_picks p
    WHERE p.report_date = p_report_date
      AND p.locked = false
      AND p.algo_version <= p_algo_version
      AND NOT EXISTS (
        SELECT 1 FROM _writer_picks w
        WHERE w.game_pk   = p.game_pk
          AND w.player_id = p.player_id
          AND w.market    = p.market
          AND w.side      = p.side
      )
    RETURNING 1
  )
  SELECT count(*)::int INTO v_pruned FROM deleted;

  SELECT count(*)::int INTO v_locked
    FROM mlb_player_prop_picks
   WHERE report_date = p_report_date AND locked = true;

  RETURN QUERY SELECT v_upserted, v_locked, v_pruned, v_dropped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_player_prop_picks(date, jsonb, int)
  TO anon, authenticated, service_role;
