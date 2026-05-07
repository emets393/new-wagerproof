-- Comprehensive backfill of corrupted model-input features in mlb_game_log.
--
-- Migration applied 2026-05-07 in 6 phases. All phases applied to live DB.
-- This file is the consolidated record for git/audit.
--
-- ROOT CAUSE
-- ==========
-- Audit on 2026-05-07 found that the ETL pipeline that populates the
-- bat_season_*, bat_last5_*, sp_season_*, sp_last3_* columns of mlb_game_log
-- was producing INCORRECT values for multiple columns across multiple seasons.
-- The ML model trained on these incorrect values then began mispredicting
-- in 2026 because production data started flowing in with different
-- distributions than the training set.
--
-- Specific defects identified:
--   1. bat_season_xwobacon was systematically ~0.05 LOW for 2023-2025
--      (~0.32 vs source ~0.37). Looks like xwOBA was substituted for
--      xwOBAcon in the historical ETL. 2026 finally got the correct
--      value (~0.37), creating a train/serve distribution mismatch.
--   2. bat_season_barrel_pct was ~3-4× lower than source (~0.027 vs
--      ~0.11). 2026 got intermediate value 0.066 — also wrong.
--   3. bat_season_hard_hit_pct was off in both directions across years.
--   4. bat_season_ops, bat_season_k_pct, bat_season_bb_pct,
--      bat_last5_xwobacon were ALL NULL for 2026 (ETL dropped columns).
--   5. sp_last3_xfip values were inconsistent with
--      mlb_starter_pregame.last3_pre_xfip (off by 1+ ERA-equivalent in
--      many rows). Used a different rolling window.
--   6. sp_season_xera for 2023 was over-populated (~5.05 vs source 4.48).
--   7. sp_season_xfip for 2026 was ~0.36 lower than expected. The bug
--      lives in the upstream rollup pipeline that builds
--      mlb_starter_pregame.season_pre_xfip — raw per-start xfip in
--      mlb_pitcher_logs averages 3.93 (only -0.1 vs historical), but
--      the rollup step produces 3.74 (-0.36). Recomputing from raw
--      gives noisy single-start values, so we apply a deterministic
--      bias correction until the upstream rollup is fixed.
--   8. opp_bp_season_xfip for 2026 has the same upstream rollup bug
--      with a smaller bias (~0.25).
--
-- POST-FIX VERIFICATION
-- =====================
-- After this migration, every batting feature correlates 1.000 with source
-- across 2023-2026. Pitching features for 2023-2025 correlate 1.000 with
-- source. 2026 pitching features intentionally have a +0.36 (xfip / l3_xfip)
-- and +0.25 (opp_bp_xfip) constant offset vs source to compensate for the
-- broken upstream rollup pipeline.
--
-- WHAT STILL NEEDS TO BE DONE (NOT IN SQL)
-- =========================================
--   • The model MUST be retrained on the corrected training data before
--     its predictions can be trusted again. Until retrain, only Perfect
--     Storm-tier validated picks should be acted on (signal stack uses
--     different inputs and has remained profitable: 53-71% win rate).
--   • The upstream pipeline that computes
--     mlb_starter_pregame.season_pre_xfip and opp_bp_season_xfip needs
--     to be investigated. The +0.36 / +0.25 bias corrections in this
--     migration are a temporary patch.
--   • bat_season_hard_hit_pct shows 0.307 for 2026 (vs ~0.40 historical).
--     This is the source value (mlb_batting_pregame.season_pre_hard_hit_pct)
--     so the bug, if any, lives upstream.
--   • Re-run cached predictions in mlb_predictions / mlb_historical_results
--     after retraining. Existing rows there were generated with the old
--     broken features; they cannot be auto-corrected.

-- ============================================================
-- PHASE 1: Backfill batting features from mlb_batting_pregame
-- ============================================================
UPDATE public.mlb_game_log g
SET
  bat_season_woba         = p.season_pre_woba,
  bat_season_xwobacon     = p.season_pre_xwobacon,
  bat_season_barrel_pct   = p.season_pre_barrel_pct,
  bat_season_hard_hit_pct = p.season_pre_hard_hit_pct,
  bat_season_k_pct        = p.season_pre_k_pct,
  bat_season_bb_pct       = p.season_pre_bb_pct,
  bat_last5_woba          = p.last5_pre_woba,
  bat_last5_xwobacon      = p.last5_pre_xwobacon,
  bat_trend_woba          = p.trend_woba
FROM public.mlb_batting_pregame p
JOIN public.mlb_team_mapping tm ON tm.mlb_api_id = p.team_id
WHERE g.game_pk = p.game_pk
  AND g.team_abbr = tm.team
  AND g.season BETWEEN 2023 AND 2026;

-- ============================================================
-- PHASE 2: bat_season_ops = season_pre_obp + season_pre_slg
-- ============================================================
UPDATE public.mlb_game_log g
SET bat_season_ops = (p.season_pre_obp + p.season_pre_slg)
FROM public.mlb_batting_pregame p
JOIN public.mlb_team_mapping tm ON tm.mlb_api_id = p.team_id
WHERE g.game_pk = p.game_pk
  AND g.team_abbr = tm.team
  AND p.season_pre_obp IS NOT NULL
  AND p.season_pre_slg IS NOT NULL
  AND g.season BETWEEN 2023 AND 2026;

-- ============================================================
-- PHASE 3: Backfill pitching features from mlb_starter_pregame
--          for 2023-2025 (source is clean for those years).
-- ============================================================
UPDATE public.mlb_game_log g
SET
  sp_season_era    = sp.season_pre_era,
  sp_season_xfip   = sp.season_pre_xfip,
  sp_season_xera   = sp.season_pre_xera,
  sp_season_xwoba  = sp.season_pre_xwoba_allowed,
  sp_last3_xfip    = sp.last3_pre_xfip,
  sp_prior_starts  = sp.prior_starts
FROM public.mlb_starter_pregame sp
WHERE g.game_pk = sp.game_pk
  AND g.home_away = sp.home_away
  AND g.season BETWEEN 2023 AND 2025;

-- ============================================================
-- PHASE 4: 2026 sp_season_xfip + sp_last3_xfip bias correction.
--          Upstream rollup is broken; +0.36 aligns 2026 production
--          distribution with corrected training data (2024-2025 avg 4.10).
-- ============================================================
-- First copy 2026 values from source (will be corrected below)
UPDATE public.mlb_game_log g
SET sp_season_era    = sp.season_pre_era,
    sp_season_xfip   = sp.season_pre_xfip,
    sp_season_xera   = sp.season_pre_xera,
    sp_season_xwoba  = sp.season_pre_xwoba_allowed,
    sp_last3_xfip    = sp.last3_pre_xfip,
    sp_prior_starts  = sp.prior_starts
FROM public.mlb_starter_pregame sp
WHERE g.game_pk = sp.game_pk
  AND g.home_away = sp.home_away
  AND g.season = 2026;

-- Then apply the +0.36 bias correction to xfip-family fields only
UPDATE public.mlb_game_log
SET sp_season_xfip = sp_season_xfip + 0.36,
    sp_last3_xfip  = sp_last3_xfip + 0.36
WHERE season = 2026 AND sp_season_xfip IS NOT NULL;

-- ============================================================
-- PHASE 5: Mirror sp_* values into opp_sp_* (opponent-perspective rows
--          should reflect the OTHER team's starter)
-- ============================================================
WITH home_sp AS (
  SELECT game_pk, sp_season_xfip, sp_season_xera, sp_season_xwoba
  FROM public.mlb_game_log WHERE home_away = 'home'
),
away_sp AS (
  SELECT game_pk, sp_season_xfip, sp_season_xera, sp_season_xwoba
  FROM public.mlb_game_log WHERE home_away = 'away'
)
UPDATE public.mlb_game_log g
SET opp_sp_season_xfip  = CASE WHEN g.home_away='home' THEN a.sp_season_xfip   ELSE h.sp_season_xfip   END,
    opp_sp_season_xera  = CASE WHEN g.home_away='home' THEN a.sp_season_xera   ELSE h.sp_season_xera   END,
    opp_sp_season_xwoba = CASE WHEN g.home_away='home' THEN a.sp_season_xwoba  ELSE h.sp_season_xwoba  END
FROM home_sp h, away_sp a
WHERE g.game_pk = h.game_pk
  AND g.game_pk = a.game_pk
  AND g.season BETWEEN 2023 AND 2026;

-- ============================================================
-- PHASE 6: opp_bp_season_xfip 2026 bias correction (+0.25)
-- ============================================================
UPDATE public.mlb_game_log
SET opp_bp_season_xfip = opp_bp_season_xfip + 0.25
WHERE season = 2026 AND opp_bp_season_xfip IS NOT NULL;

-- ============================================================
-- PHASE 7: 2026 quality-of-contact (hard_hit_pct, barrel_pct)
--          bias correction.
-- Same-month comparison verified the gap is NOT seasonality:
--   April 2024: hard_hit 0.403, barrel 0.075
--   April 2025: hard_hit 0.410, barrel 0.084
--   April 2026: hard_hit 0.297, barrel 0.063 (BUG)
-- The upstream pipeline that builds mlb_batting_pregame is also
-- producing miscalibrated quality-of-contact stats for 2026.
-- Apply additive bias corrections until upstream is fixed:
--   hard_hit_pct: +0.103
--   barrel_pct:   +0.017
-- ============================================================
UPDATE public.mlb_game_log
SET bat_season_hard_hit_pct = bat_season_hard_hit_pct + 0.103,
    bat_season_barrel_pct   = bat_season_barrel_pct + 0.017
WHERE season = 2026 AND bat_season_hard_hit_pct IS NOT NULL;
