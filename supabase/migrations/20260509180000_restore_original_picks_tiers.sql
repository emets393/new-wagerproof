-- Restore original perfect_storm_tier from regression report archive
-- =====================================================================
--
-- BUG (reported 2026-05-09)
-- =========================
-- User noticed regression-report tier records were going DOWN day-over-day:
--   5/07 report: hammer 12-8
--   5/08 report: hammer 12-6   ← lost 2 losses (impossible — records can only grow)
--   5/09 report: hammer 16-7
--
-- Root cause: when migration 20260508140000 added the freeze logic to
-- `refresh_mlb_perfect_storm_tier()`, the column `perfect_storm_tier_computed_at`
-- was NULL on every existing pick. The function's WHERE clause
--   WHERE perfect_storm_tier IS NULL
--      OR perfect_storm_tier_computed_at IS NULL    ← matched ALL old picks
--      OR official_date >= CURRENT_DATE - INTERVAL '1 day'
-- caused a one-time bulk reclassification on 2026-05-08 13:32 UTC. After
-- that bulk run, the freeze locked old picks at their NEW (often lower)
-- tier. 20 picks total were retroactively shifted:
--   • 7 hammer → other (3 wins, 4 losses) — explains the 12-8 → 12-6 drop
--   • 8 ps     → watch
--   • 4 lean   → none
--   • 1 watch  → none
--
-- Fix
-- ===
-- The original tier for each pick is preserved in the regression-report
-- archive: `mlb_regression_report.suggested_picks` JSONB. Reports from
-- 2026-04-15 through 2026-05-07 were all last updated BEFORE the 5/08
-- 13:32 bulk recompute (verified by their `updated_at` timestamps), so
-- their suggested_picks tiers are the original, pre-corruption values.
--
-- This migration restores `mlb_graded_picks.perfect_storm_tier` from the
-- FIRST appearance of each pick in any regression-report's
-- suggested_picks. After restoration, the displayed records reflect the
-- tier each pick was originally suggested as.
--
-- Companion migration 20260509180100_freeze_graded_picks_tier.sql then
-- strengthens the refresh function so this can never happen again: a
-- pick with `result IS NOT NULL` (already graded) will never be
-- reclassified, even if the freshness window includes it.

UPDATE public.mlb_graded_picks gp
SET perfect_storm_tier = original.tier,
    perfect_storm_tier_computed_at = NOW()
FROM (
  SELECT DISTINCT ON ((pick->>'game_pk')::bigint, pick->>'bet_type')
    (pick->>'game_pk')::bigint AS game_pk,
    pick->>'bet_type'          AS bet_type,
    pick->>'perfect_storm_tier' AS tier
  FROM public.mlb_regression_report,
       jsonb_array_elements(suggested_picks) AS pick
  WHERE pick->>'perfect_storm_tier' IS NOT NULL
  ORDER BY (pick->>'game_pk')::bigint, pick->>'bet_type', report_date
) original
WHERE gp.game_pk  = original.game_pk
  AND gp.bet_type = original.bet_type
  AND COALESCE(gp.perfect_storm_tier, '') <> original.tier;
