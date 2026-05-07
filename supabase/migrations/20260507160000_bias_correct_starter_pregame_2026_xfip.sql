-- Bias-correct mlb_starter_pregame.season_pre_xfip + last3_pre_xfip for 2026
-- to match the 2024-2025 training distribution v8 was trained on.
--
-- Why this is needed
-- ==================
-- The earlier bias-correction migration (20260507130000) patched
-- mlb_game_log columns. That helped historical/agent code that reads
-- from mlb_game_log, but the production model runner (mlb_model_runner.py)
-- reads from mlb_starter_pregame DIRECTLY. So the patches never reached
-- inference.
--
-- v8 was trained on 2023-2025 mlb_starter_pregame where avg
-- season_pre_xfip = 4.10. After the morning runner re-fetched 2026 data
-- with the BBE bug fixed, batting features lined up — but
-- mlb_starter_pregame.season_pre_xfip was still averaging 3.79 (-0.31
-- vs training).
--
-- Result of running v8 against biased data: predictions averaged 1.71
-- runs BELOW the closing line systematically. The model was correctly
-- following the feature signal — pitching looked elite vs training, so
-- it predicted low totals. The fix is to align production data with
-- training distribution.
--
-- Measurement on 2026-05-07:
--   2024: avg season_pre_xfip = 4.09
--   2025: avg season_pre_xfip = 4.12
--   2026: avg season_pre_xfip = 3.79  →  shift by +0.30 → 4.09 ✓
--
-- xera (4.19 vs 4.30 training, only -0.11), era, fip, whip, xwoba
-- are all within ~0.05 of training and don't need adjustment.
--
-- This is a CALIBRATION PATCH on a known-broken upstream rollup. The
-- root cause lives in the rollup step that produces season_pre_xfip
-- from mlb_pitcher_logs.xfip — likely IP-weighting amplifying the
-- 0.10-0.15 bias from the slightly-stale LG_HR_FB_PCT constant in
-- mlb_fetch_pitcher_logs.py (PR #12 bumped it from 0.105 to 0.115 but
-- existing 2026 rows weren't reprocessed).
--
-- Will be automatically overwritten by the next mlb_feature_eng_starters.py
-- run if/when the upstream wipe-and-refetch sequence is run end-to-end:
--   1. DELETE FROM mlb_pitcher_logs WHERE season = 2026 AND xfip IS NOT NULL
--   2. Trigger MLB Morning Runner (re-fetches with corrected LG_HR_FB_PCT)
--   3. Trigger MLB Hourly Runner (re-engineers mlb_starter_pregame)

UPDATE public.mlb_starter_pregame
SET season_pre_xfip = season_pre_xfip + 0.30,
    last3_pre_xfip  = last3_pre_xfip + 0.30
WHERE season = 2026
  AND season_pre_xfip IS NOT NULL;
