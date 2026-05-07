-- Revert the +0.30 patch from migration 20260507160000.
--
-- Why
-- ===
-- 20260507160000 shifted 2026 mlb_starter_pregame.season_pre_xfip up by 0.30
-- to align production with v8 OU's training distribution. We are no longer
-- using v8 OU — the user has decided to keep the previous v11 OU and v3 F5
-- (which were performing OK in production) and only swap in the new v8 ML.
--
-- v11 OU was producing reasonable predictions on the un-patched 2026 data.
-- We want to give it back exactly what it was working with, so we revert
-- the +0.30 patch.
--
-- v8 ML uses only diff/trend xfip features (bp_xfip_diff, bp_l5_xfip_diff,
-- trend_barrel_diff) which are ROBUST to absolute-level shifts in
-- sp_season_xfip. Both home and away pitcher xfip move together, so the
-- diff stays constant. Reverting the patch does not hurt v8 ML.
--
-- Net effect: post this migration, 2026 sp_season_xfip averages ~3.79
-- (the original baseline), matching what v11 was running on in production.
UPDATE public.mlb_starter_pregame
SET season_pre_xfip = season_pre_xfip - 0.30,
    last3_pre_xfip  = last3_pre_xfip - 0.30
WHERE season = 2026
  AND season_pre_xfip IS NOT NULL;
