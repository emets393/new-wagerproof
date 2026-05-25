-- Persistence + locking + grading for the Best Picks Report.
-- Mirrors the pattern used by the regression report (mlb_graded_picks):
-- live picks are upserted on each report run; once a game starts, the row
-- is locked and frozen. Yesterday's locked picks get graded next morning by
-- the mlb-grade-player-prop-picks workflow in cfb_automation.

-- ─── ACTIVE PICKS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mlb_player_prop_picks (
  report_date  date     NOT NULL,
  game_pk      bigint   NOT NULL,
  player_id    integer  NOT NULL,
  market       text     NOT NULL,
  side         text     NOT NULL DEFAULT 'over'
               CHECK (side IN ('over','under')),

  player_name  text     NOT NULL,
  team_name    text,
  game_label   text     NOT NULL,
  game_time    timestamptz,
  is_day       boolean  NOT NULL DEFAULT false,
  market_label text     NOT NULL,
  kind         text     NOT NULL CHECK (kind IN ('batter','pitcher')),

  tier         text     NOT NULL CHECK (tier IN ('elite','strong','lean')),
  score        integer  NOT NULL,
  line         numeric(5,1) NOT NULL,
  over_odds    integer,
  under_odds   integer,
  l10_over     integer,
  l10_games    integer,
  l10_pct      integer,
  rationale    jsonb,

  locked              boolean     NOT NULL DEFAULT false,
  locked_at           timestamptz,
  first_suggested_at  timestamptz NOT NULL DEFAULT now(),
  last_updated_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (report_date, game_pk, player_id, market, side)
);

CREATE INDEX IF NOT EXISTS idx_player_prop_picks_date
  ON public.mlb_player_prop_picks (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_prop_picks_locked
  ON public.mlb_player_prop_picks (report_date, locked);

ALTER TABLE public.mlb_player_prop_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS player_prop_picks_read ON public.mlb_player_prop_picks;
CREATE POLICY player_prop_picks_read ON public.mlb_player_prop_picks
  FOR SELECT USING (true);

-- ─── GRADED PICKS ARCHIVE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mlb_player_prop_grades (
  report_date   date     NOT NULL,
  game_pk       bigint   NOT NULL,
  player_id     integer  NOT NULL,
  market        text     NOT NULL,
  side          text     NOT NULL DEFAULT 'over'
                CHECK (side IN ('over','under')),

  player_name   text,
  team_name     text,
  market_label  text,
  kind          text CHECK (kind IN ('batter','pitcher')),
  tier          text CHECK (tier IN ('elite','strong','lean')),
  score         integer,
  line          numeric(5,1),
  over_odds     integer,
  under_odds    integer,
  l10_pct       integer,

  actual_value  numeric,
  result        text CHECK (result IN ('won','lost','push','void','pending')),
  units_staked  numeric(4,2) NOT NULL DEFAULT 0,
  units_won     numeric(7,3),
  graded_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (report_date, game_pk, player_id, market, side)
);

CREATE INDEX IF NOT EXISTS idx_player_prop_grades_date
  ON public.mlb_player_prop_grades (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_prop_grades_tier_market
  ON public.mlb_player_prop_grades (tier, market);

ALTER TABLE public.mlb_player_prop_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS player_prop_grades_read ON public.mlb_player_prop_grades;
CREATE POLICY player_prop_grades_read ON public.mlb_player_prop_grades
  FOR SELECT USING (true);

-- ─── SNAPSHOT RPC ──────────────────────────────────────────────────────
-- Called by the client after computing picks. Locks anything whose game has
-- started; refuses to overwrite already-locked rows.
DROP FUNCTION IF EXISTS public.snapshot_player_prop_picks(date, jsonb);

CREATE FUNCTION public.snapshot_player_prop_picks(
  p_report_date date,
  p_picks       jsonb
) RETURNS TABLE (upserted int, locked_total int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
      COALESCE(
        NULLIF(x->>'game_time', '')::timestamptz <= v_now,
        false
      )                                             AS starts_now
    FROM jsonb_array_elements(p_picks) x
  )
  INSERT INTO mlb_player_prop_picks (
    report_date, game_pk, player_id, market, side,
    player_name, team_name, game_label, game_time, is_day,
    market_label, kind, tier, score, line,
    over_odds, under_odds, l10_over, l10_games, l10_pct, rationale,
    locked, locked_at
  )
  SELECT
    report_date, game_pk, player_id, market, side,
    player_name, team_name, game_label, game_time, is_day,
    market_label, kind, tier, score, line,
    over_odds, under_odds, l10_over, l10_games, l10_pct, rationale,
    starts_now,
    CASE WHEN starts_now THEN v_now ELSE NULL END
  FROM src
  ON CONFLICT (report_date, game_pk, player_id, market, side) DO UPDATE
    SET tier          = EXCLUDED.tier,
        score         = EXCLUDED.score,
        line          = EXCLUDED.line,
        over_odds     = EXCLUDED.over_odds,
        under_odds    = EXCLUDED.under_odds,
        l10_over      = EXCLUDED.l10_over,
        l10_games     = EXCLUDED.l10_games,
        l10_pct       = EXCLUDED.l10_pct,
        rationale     = EXCLUDED.rationale,
        team_name     = EXCLUDED.team_name,
        game_label    = EXCLUDED.game_label,
        market_label  = EXCLUDED.market_label,
        is_day        = EXCLUDED.is_day,
        last_updated_at = v_now
    WHERE mlb_player_prop_picks.locked = false;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  SELECT count(*)::int INTO v_locked
    FROM mlb_player_prop_picks
   WHERE report_date = p_report_date AND locked = true;

  RETURN QUERY SELECT v_upserted, v_locked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_player_prop_picks(date, jsonb)
  TO anon, authenticated;

-- ─── GRADING FUNCTION ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.grade_mlb_player_prop_picks(date);

CREATE FUNCTION public.grade_mlb_player_prop_picks(p_report_date date)
RETURNS TABLE (graded int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_graded int := 0;
BEGIN
  WITH src AS (
    SELECT
      p.report_date, p.game_pk, p.player_id, p.market, p.side,
      p.player_name, p.team_name, p.market_label, p.kind, p.tier,
      p.score, p.line, p.over_odds, p.under_odds, p.l10_pct,
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
    line, over_odds, under_odds, l10_pct,
    actual_value, result, units_staked, units_won, graded_at
  )
  SELECT
    report_date, game_pk, player_id, market, side,
    player_name, team_name, market_label, kind, tier, score,
    line, over_odds, under_odds, l10_pct,
    actual_value, result, units_staked, units_won, now()
  FROM priced
  ON CONFLICT (report_date, game_pk, player_id, market, side) DO UPDATE
    SET actual_value = EXCLUDED.actual_value,
        result       = EXCLUDED.result,
        units_won    = EXCLUDED.units_won,
        graded_at    = now();

  GET DIAGNOSTICS v_graded = ROW_COUNT;
  RETURN QUERY SELECT v_graded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_mlb_player_prop_picks(date) TO service_role;

-- ─── PERFORMANCE SUMMARY VIEW ──────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_mlb_player_prop_grade_summary AS
  SELECT
    tier,
    market,
    market_label,
    kind,
    COUNT(*)                                    AS picks_total,
    COUNT(*) FILTER (WHERE result = 'won')       AS picks_won,
    COUNT(*) FILTER (WHERE result = 'lost')      AS picks_lost,
    COUNT(*) FILTER (WHERE result = 'push')      AS picks_push,
    COUNT(*) FILTER (WHERE result = 'pending')   AS picks_pending,
    ROUND(
      AVG(CASE WHEN result IN ('won','lost') THEN
        CASE WHEN result = 'won' THEN 1.0 ELSE 0.0 END END) * 100, 1
    )                                            AS win_pct,
    SUM(units_staked) FILTER (WHERE result IN ('won','lost','push'))
                                                 AS units_staked,
    SUM(units_won)    FILTER (WHERE result IN ('won','lost','push'))
                                                 AS units_won,
    CASE WHEN SUM(units_staked) FILTER (WHERE result IN ('won','lost')) > 0
      THEN ROUND(
        (SUM(units_won) FILTER (WHERE result IN ('won','lost','push')))
        / NULLIF(SUM(units_staked) FILTER (WHERE result IN ('won','lost','push')), 0)
        * 100, 1)
      ELSE NULL
    END                                          AS roi_pct
  FROM mlb_player_prop_grades
  GROUP BY tier, market, market_label, kind;

GRANT SELECT ON public.v_mlb_player_prop_grade_summary TO anon, authenticated;
