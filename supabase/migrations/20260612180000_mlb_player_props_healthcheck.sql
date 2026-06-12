-- Healthcheck for the MLB player-props pipeline.
--
-- Called by the Render mlb-morning-runner after all ingests + grader complete.
-- Returns ok=false (and the runner exits non-zero) when yesterday's data looks
-- broken, so a regression shows up as a red cron run in Render's dashboard
-- instead of silently rotting until a user notices stale picks on the site.
--
-- Failure modes this catches:
--   1. score-player-props never ran  → 0 picks for yesterday
--   2. grader never ran              → picks still 'pending' after games final
--   3. batter_logs ingest skipped    → very few/no rows for yesterday
--   4. mid-game partial scrape stuck → starters with at_bats<=1 (the bug we
--      just fixed in mlb_fetch_batter_logs.py — keep a tripwire here in case
--      the 3-day re-fetch window ever gets reverted or shrunk)

CREATE OR REPLACE FUNCTION public.mlb_player_props_healthcheck()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yday    date := (now() AT TIME ZONE 'America/New_York' - interval '1 day')::date;
  v_issues  text[] := ARRAY[]::text[];
  v_games   int;
  v_picks   int;
  v_pending int;
  v_logs    int;
  v_partial int;
BEGIN
  SELECT COUNT(*) INTO v_games
    FROM mlb_schedule
    WHERE official_date = v_yday AND is_completed = true;

  -- No completed games (off-day, All-Star break, etc.) → nothing to check
  IF v_games = 0 THEN
    RETURN jsonb_build_object('ok', true, 'date', v_yday, 'note', 'no completed games');
  END IF;

  SELECT COUNT(*) INTO v_picks
    FROM mlb_player_prop_picks WHERE report_date = v_yday;
  IF v_picks = 0 THEN
    v_issues := v_issues || format('no picks generated for %s (score-player-props likely never ran)', v_yday);
  END IF;

  SELECT COUNT(*) INTO v_pending
    FROM mlb_player_prop_grades
    WHERE report_date = v_yday AND result = 'pending';
  IF v_pending > 0 THEN
    v_issues := v_issues || format('%s picks still pending for %s (grader did not complete)', v_pending, v_yday);
  END IF;

  SELECT COUNT(*) INTO v_logs
    FROM mlb_batter_logs WHERE official_date = v_yday;
  -- ~15 games × ~20 batters/game ≈ 300, so <100 is suspicious for a full day
  IF v_logs < 100 THEN
    v_issues := v_issues || format('only %s batter_logs rows for %s (expected 200+)', v_logs, v_yday);
  END IF;

  -- Top-of-order batters who appeared should have ≥2 AB. Many <=1 means we're
  -- looking at mid-game partial scrapes that never got overwritten.
  SELECT COUNT(*) INTO v_partial
    FROM mlb_batter_logs
    WHERE official_date = v_yday
      AND at_bats <= 1
      AND lineup_spot BETWEEN 1 AND 5;
  IF v_partial > 25 THEN
    v_issues := v_issues || format('%s starters with at_bats<=1 for %s (likely partial scrapes — check ingest re-fetch window)', v_partial, v_yday);
  END IF;

  RETURN jsonb_build_object(
    'ok',         array_length(v_issues, 1) IS NULL,
    'date',       v_yday,
    'games',      v_games,
    'picks',      v_picks,
    'pending',    v_pending,
    'batter_logs', v_logs,
    'partials',   v_partial,
    'issues',     v_issues
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mlb_player_props_healthcheck() TO service_role, anon, authenticated;
