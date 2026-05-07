-- Wipe 2026 rows from upstream raw + pregame tables so the next
-- mlb-morning-runner.yml + mlb_daily_pipeline.yml runs rebuild them
-- with the now-fixed cfb_automation code (PR #12 + PR #13).
--
-- WHY THIS IS NEEDED
-- ==================
-- mlb_fetch_pitcher_logs.py and mlb_fetch_batting_logs.py only process
-- games that are MISSING from their target tables. They do NOT reprocess
-- existing rows that already have stale/wrong values. After the BBE
-- foul-ball fix in mlb_fetch_batting_logs.py (PR #12), existing 2026 rows
-- in mlb_team_batting_logs still have the inflated BBE counts (~43 vs
-- correct ~26 per team-game), and downstream tables (mlb_batting_pregame,
-- mlb_starter_pregame) are derived from them. The only way to get clean
-- data into the system is to wipe and re-fetch.
--
-- WHAT THIS DOES
-- ==============
-- DELETE every 2026 row from:
--   - mlb_team_batting_logs   (raw Savant-derived team batting per game)
--   - mlb_pitcher_logs        (raw per-start pitcher stats)
--   - mlb_batting_pregame     (rolling pregame batting features)
--   - mlb_starter_pregame     (rolling pregame starter features)
--   - mlb_bullpen_pregame     (rolling pregame bullpen features) [if exists]
--
-- mlb_game_log is NOT wiped — it stays as-is. After the next
-- mlb_refresh_game_log.py run, its 2026 columns will be overwritten
-- with values pulled from the rebuilt pregame tables, which has the
-- effect of automatically removing the temporary +0.36 / +0.25 / +0.103 /
-- +0.017 bias-correction patches from migration 20260507130000
-- (Phases 4, 6, 7) — they get overwritten by clean source data.
--
-- ROLLBACK
-- ========
-- These wiped rows are recoverable: rerun the GH Action workflows in
-- order:
--   1. Trigger MLB Morning Runner (workflow_dispatch) — refills
--      mlb_pitcher_logs and mlb_team_batting_logs.
--   2. Trigger MLB Hourly Runner (mlb_daily_pipeline.yml) — refills
--      mlb_starter_pregame, mlb_batting_pregame, mlb_bullpen_pregame
--      and runs predictions.
--   3. Trigger MLB Train Models — produces new pkls.
-- See: cfb_automation/docs/MLB_MODEL_RETRAIN_GUIDE.md

DELETE FROM public.mlb_team_batting_logs WHERE season = 2026;
DELETE FROM public.mlb_pitcher_logs       WHERE season = 2026;
DELETE FROM public.mlb_batting_pregame    WHERE season = 2026;
DELETE FROM public.mlb_starter_pregame    WHERE season = 2026;

-- mlb_bullpen_pregame may or may not exist; guard the DELETE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mlb_bullpen_pregame'
  ) THEN
    DELETE FROM public.mlb_bullpen_pregame WHERE season = 2026;
  END IF;
END $$;
