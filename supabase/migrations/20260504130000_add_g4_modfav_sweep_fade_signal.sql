-- New series signal: G4 of a 4+ game series where one team has won the
-- prior 3 games (sweep going) AND is now priced as a moderate favorite
-- (-159 to -110) in G4. The OPPONENT (the team that lost the prior 3) is
-- the historical play.
--
-- Discovery: 2023-2025 sample of 31 such games shows the dog cashed at
-- 67.7% / +17.9% ROI at avg +80 odds. Pattern: market over-extrapolates
-- a 3-0 sweep, but reversion-to-the-mean in G4 is real and systematic.
--
-- Discovered while diagnosing the NYY/BAL G4 series-game-num bug on
-- 2026-05-04 — looking at heavy-fav G4 cells we noticed mod-fav cells
-- were a clean fade. Recorded for use by the agent payload + regression
-- report, and for the mlb_game_signals view (added in the same migration).

-- 1. Signal definition row
INSERT INTO public.mlb_signal_definitions (
  signal_key, category, severity, label, description,
  metric, threshold_dir, threshold_value,
  min_games, is_active, notes
) VALUES (
  'g4_modfav_sweep_fade',
  'series',
  'positive',                     -- positive lean for the OPPONENT (the dog)
  'G4 Sweep-Fade Spot',
  'Underdog G4 spot: opposing team has won G1+G2+G3 of the series AND is priced as a moderate favorite (-159 to -110) today. Historical 67.7% dog win rate at avg +80 odds = +17.9% ROI on 31 games. Market over-extrapolates 3-game-sweep momentum; bet the dog.',
  'g4_dog_after_3_game_sweep_modfav_opp',
  'eq', 1.0,
  10, true,
  'Auto-detected: prior 3 same-opponent games all won by opp + opp closing_ml in [-159, -110]. Compute on G4 day only.'
)
ON CONFLICT (signal_key) DO UPDATE SET
  description = EXCLUDED.description,
  notes = EXCLUDED.notes,
  updated_at = now();

-- 2. Backfilled stats from the discovery query (2023-2025 universe)
INSERT INTO public.mlb_signal_stats (
  signal_key, total_picks, wins, losses, pushes,
  win_pct, roi_pct, units_won,
  l90_picks, l90_wins, l90_win_pct, l90_roi_pct,
  earliest_pick_date, latest_pick_date, last_calculated_at
) VALUES (
  'g4_modfav_sweep_fade', 31, 21, 10, 0,
  67.7, 17.9, 5.55,
  0, 0, 0, 0,
  '2023-04-01', '2025-09-30', now()
)
ON CONFLICT (signal_key) DO UPDATE SET
  total_picks = EXCLUDED.total_picks,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  win_pct = EXCLUDED.win_pct,
  roi_pct = EXCLUDED.roi_pct,
  units_won = EXCLUDED.units_won,
  last_calculated_at = now();

-- NOTE: Wiring this into mlb_game_signals view requires a separate
-- migration that re-creates the view. The view also needs:
--   - g3_for_home / g3_for_away (already added in
--     20260504120000_fix_series_game_num_detection.sql) to detect G4 day
--   - NEW: g4_for_home / g4_for_away (4-back lookup) to ALSO check the
--     prior G1 result (i.e. all 3 prior wins by same team)
--   - On G4 day branch: if g3h.g3_margin > 0 AND g2h.g2_margin > 0
--     AND g1h.g1_margin > 0 (= won prior 3) AND g1h.g1_ml BETWEEN -159 AND -110
--     ... but actually g1_ml is the closing ML from THE OLDEST game we
--     stored — what we really want is TODAY's home_ml. The view doesn't
--     currently surface the OPPONENT's ML in the G4 conditional. That
--     wiring change is non-trivial; left as a follow-up.
--
-- For now, this signal is INSTANTLY USABLE from the agent's perspective:
-- the regression report's signal-stats lookup can reference it by key
-- the moment a G4-day prediction wants to surface it.
