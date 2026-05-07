-- Remove the g2_blowout_sweet_spot signal entirely.
--
-- Why this exists:
-- The signal was created with stats (74 picks, 66.2% win, +25.47% ROI) that DO NOT
-- reproduce on a clean re-derivation from mlb_game_log. A walk-through audit on
-- 2026-05-07 across every plausible variant of the original spec returned a peak
-- win rate of 53.7% (G2 UNDER on n=130) — nowhere near the 66% claim.
--
-- Conclusion: the recorded stats were either fabricated, mis-computed, or based
-- on a query that never actually verified what the description claims. This
-- signal has been served to users / customers as a real edge and is not.
-- Removing it entirely is the only safe action.
--
-- Audit trail of attempted variants (all from 2023-2025 mlb_game_log):
--   Spec: G1 of series, abs(margin) >= 8, G1 home_ml in -149..-110, same venue.
--   On G2:
--     Bet G1 LOSER on G2 ML       → 67-63   (51.5%)  ❌
--     Bet G1 WINNER on G2 ML      → 63-67   (48.5%)  ❌
--     Bet G2 OVER                 → 57-66-7 (46.3%)  ❌
--     Bet G2 UNDER                → 66-57-7 (53.7%)  ❌ (closest, still flat after juice)
--     Bet G2 home ML              → 68-62   (52.3%)  ❌
--     Bet G2 away ML              → 62-68   (47.7%)  ❌
--   Other ML bands tested: -129..-110, -200..-150, <-200 — none reproduce 66%.
--
-- This migration:
--   1. Deletes the bogus stats row from mlb_signal_stats.
--   2. Deactivates the signal definition (is_active=false) and overwrites the
--      label/description to make it clear this signal is dead, so any agent or
--      regression report referencing it surfaces the deactivation note instead
--      of the old fabricated stats.

DELETE FROM public.mlb_signal_stats
WHERE signal_key = 'g2_blowout_sweet_spot';

UPDATE public.mlb_signal_definitions
SET
  is_active   = false,
  label       = '[REMOVED] G2 Sweet-Spot Carryover',
  description = 'REMOVED 2026-05-07: original stats (74 picks / 66.2% / +25.47% ROI) did not reproduce on a clean re-derivation. Peak win rate across every variant was 53.7% (G2 UNDER, n=130). Signal was based on incorrect or fabricated numbers. Do not surface to users.',
  notes       = 'Removed after audit failure. See migration 20260507120000_remove_g2_blowout_sweet_spot.sql for full variant test results. Definition row kept (instead of deleted) for audit trail; stats row deleted.',
  updated_at  = NOW()
WHERE signal_key = 'g2_blowout_sweet_spot';
