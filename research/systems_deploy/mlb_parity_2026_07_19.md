# MLB backend parity — applied 2026-07-19 (record of operations)

Brought `mlb_analysis_base` + `mlb_analysis` (jpxnjuwglavsjbgbasnl) to Systems parity.

1. **As-of features (45 cols)** — `asof_features_mlb.py` (this dir): leak-safe season-to-date
   win%/RL-cover%/over% + streaks + runs for/against per game + prior-year + head-to-head last
   meeting + full opp mirrors + opponent-previous-game (opp_prev_result/margin). Ordered by
   (game_date, time_et, game_pk) so doubleheaders resolve chronologically. Leakage test 0/300.
   Merged 17,756 rows (2023–2026) on (game_pk, team_abbr).
2. **Prices** — 7 decimal-px cols from `mlb_odds_snapshots` (latest fetched_at per game_pk; FanDuel;
   2026 slice ≈ 2,348 games RL/total, 2,918 F5): rl_px, total_over/under_px, f5_ml_px, f5_rl_px,
   f5_total_over/under_px. game_pk join — no name mapping needed.
3. **RPC** — day_of_week single→array; +~60 predicates (min_games, win_pct, streaks, rl_cover_pct,
   over_pct, rpg/rapg/run_diff_pg, prev_wins/prev_win_pct, h2h_last_{win,over,margin,same_season},
   opp mirrors, opp_last_result/opp_last_margin); uniform bet_profit/under_profit ROI:
   ml = precomputed ml_profit (real, all rows); rl/total/f5_rl/f5_total = real px where present
   (2026) else flat −110; **f5_ml = real px only (2026 subset) — its roi is computed over priced
   rows while hit% spans all rows** (same population note as CFB fg_ml 2021+).

Probes: ml −3.9 · rl −4.4 · total 49.5%/−5.4 · f5_ml −5.0 (priced subset) · win_pct≥.6 → 54.2% ·
h2h_last_win n=8441 · opp off loss n=8864 · day [Fri,Sat] n=5814.

NOT yet: MLB frontend (schema/reducer/chat/hero/UI) — MLB page also needs the symmetric-50% hero
for ml/rl/f5 side markets (same tautology as NFL).
