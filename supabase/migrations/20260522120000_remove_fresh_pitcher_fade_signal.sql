-- Retire the fresh_pitcher_fade signal.
--
-- Verification (2026-05-22): the 2023-2025 backtest (+7.12% fade ROI, n=221)
-- reproduced exactly, but it's high-variance and propped up by a single
-- season — 2025 was +17.01%, 2023 +9.13%, but 2024 was -4.87% and the 2026
-- out-of-sample sample flipped to -12.73% (n=11). The signal's stored text
-- ("3 of 4 seasons positive / 2026 OOS +6.67%") was stale and misleading, and
-- the edge is not holding up live. Removing the signal entirely.
--
-- Reverses 20260513170000 (definition + helper view) and 20260513170100
-- (the mlb_game_signals wrapper). Restores the original single
-- mlb_game_signals view by dropping the wrapper and renaming the base back.

DROP VIEW IF EXISTS public.mlb_game_signals;                 -- the wrapper
ALTER VIEW public.mlb_game_signals_base RENAME TO mlb_game_signals;
DROP VIEW IF EXISTS public.v_mlb_fresh_pitcher_signals;
DELETE FROM public.mlb_signal_stats        WHERE signal_key = 'fresh_pitcher_fade';
DELETE FROM public.mlb_signal_definitions  WHERE signal_key = 'fresh_pitcher_fade';

COMMENT ON VIEW public.mlb_game_signals IS
  'Per-game home/away/game signal arrays for the UI. Fresh-pitcher-fade wrapper '
  'removed 2026-05-22 — signal retired after out-of-sample underperformance.';
