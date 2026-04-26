-- =====================================================================
-- G3 carryover/regression signals + G2 moderate-fav fade signal
-- =====================================================================
-- Inserts 5 new "series" category signal definitions. The mlb_game_signals
-- VIEW is fully rewritten in the next migration (20260425170000_use_dynamic_
-- signal_stats_in_view.sql) — this migration handles only the definitions.
--
-- New signals (full descriptions in mlb_signal_definitions.description):
--   * g2_modfav_5to7_fade           — soft fade for G1 5-7 win as moderate fav
--   * g3_massive_blowout_regression — fade G3 spot when G2 won by 15+
--   * g3_blowout_recipient_bounce   — back the team blown out by 15+ in G2
--   * g3_moderate_fav_regression    — fade G3 spot when G2 winner was mod fav
--   * g3_heavy_fav_carryover        — back G3 spot when G2 winner was heavy fav
-- =====================================================================

INSERT INTO public.mlb_signal_definitions
  (signal_key, category, severity, label, description, metric, threshold_value, threshold_dir, min_games, is_active, notes)
VALUES
  ('g2_modfav_5to7_fade', 'series', 'negative',
   'G2 Moderate-Fav Soft Fade',
   'Won Game 1 by only 5-7 runs as a moderate favorite (-110 to -149). Historical fade — 51.9% G2 win rate, -7.0% ROI on the moneyline. Slight regression spot.',
   'g1_margin + g1_ml', 5, 'gt', 0, true,
   'Filters: prev_margin BETWEEN 5 AND 7 AND prev_ml BETWEEN -149 AND -110. Today must be G2 (1 prior game).'),
  ('g3_massive_blowout_regression', 'series', 'negative',
   'G3 Massive Blowout Regression',
   'Won Game 2 by 15+ runs. The "dominant" team only goes 38.9% in G3 (-31% ROI) — garbage-time runs inflate the score and the market overreacts. Strong fade.',
   'g2_margin', 15, 'gt', 0, true,
   'Filters: prev_margin >= 15. Today must be G3 (2 prior games).'),
  ('g3_blowout_recipient_bounce', 'series', 'positive',
   'G3 Bounce-Back After 15+ Loss',
   'Got blown out by 15+ runs in Game 2. Despite the visual, the team rebounds in G3 about 61% of the time as the market over-discounts them. Small sample, sharp signal.',
   'g2_margin', -15, 'lt', 0, true,
   'Filters: prev_margin <= -15. Today must be G3 (2 prior games).'),
  ('g3_moderate_fav_regression', 'series', 'negative',
   'G3 Moderate-Fav Regression',
   'Won Game 2 by 8+ as a moderate favorite (-110 to -149). Historical fade — only 41.8% G3 win rate, -27.6% ROI. Market keeps them favored; they regress.',
   'g2_margin + g2_ml', 8, 'gt', 0, true,
   'Filters: prev_margin >= 8 AND prev_ml BETWEEN -149 AND -110. Today must be G3.'),
  ('g3_heavy_fav_carryover', 'series', 'positive',
   'G3 Heavy-Fav Momentum',
   'Won Game 2 by 8+ as a heavy favorite (-150 or worse). Historical 66% G3 win rate, +5.5% ROI — talent gap is real, momentum carries through G3.',
   'g2_margin + g2_ml', 8, 'gt', 0, true,
   'Filters: prev_margin >= 8 AND prev_ml <= -150. Today must be G3.')
ON CONFLICT (signal_key) DO UPDATE SET
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  metric = EXCLUDED.metric,
  threshold_value = EXCLUDED.threshold_value,
  threshold_dir = EXCLUDED.threshold_dir,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
