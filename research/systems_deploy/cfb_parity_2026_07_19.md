# CFB backend parity — applied 2026-07-19 (record of operations)

Brought `cfb_analysis_base` + `cfb_analysis` on jpxnjuwglavsjbgbasnl to NFL parity. All ops applied
via Management API (see git history of this session; RPC body is authoritative in the DB — dump with
`dump_cfb_analysis_rpc.py`).

1. **Opponent last-game mirror** — `opp_last_{fg_won,fg_covered,ou_result,is_favorite,overtime,margin}`
   via self-join on (game_id, opponent). 12,870/14,052 rows matched (rest = first games).
2. **game_date + day_of_week** — backfilled from model_games.parquet `date` converted UTC→America/New_York
   (raw dates are UTC kickoff timestamps; naive `.date()` shifted evening games +1 day — Sat looked like Sun).
   748 rows (374 games) not in model_games have NULL dates. Day dist sanity: Sat 11,460 / Fri 946 / Thu 446.
3. **Closing prices** — `fg_spread_px`, `fg_total_over_px`, `fg_total_under_px` (decimal odds) from
   `ncaaf_odds_history`: per (game, book) the snapshot with min hrs_to_kick ≥ 0.9 (T-60 policy), then
   percentile_cont(0.5) across ~24 books IN DECIMAL SPACE. Name mapping: longest-prefix (odds mascot names
   → base school names) with an institutional-token blocklist (State/A&M/Tech/... prevents "Alabama A&M"→
   "Alabama") + 6 manual aliases (App State, Hawai'i, Massachusetts=UMass, Sam Houston [State], San José
   State, Southern Miss). All 137 FBS bases mapped 1:1. Coverage ~95% of 2021–2025 rows; avg px 1.909–1.910.
4. **RPC** — +10 predicates (last_margin_*, opp_last_margin_*, opp_last_{won,covered,over,favorite,overtime},
   day_of_week array) and the uniform `bet_profit`/`under_profit` real-price ROI (same shape as NFL):
   fg_ml via team_ml (2021+; earlier rows excluded), fg_spread/fg_total via px w/ 0.909 fallback,
   h1_ml → NULL (no 1H prices), h1_*/team_total flat 0.909.

Probes: fg_spread 50%/−4.5 · fg_ml 50%/−0.6 (fav 73.3%/−3.9, dog 26.7%/+2.7) · h1_ml roi NULL ·
Fri n=920 · opp_last_won=0 n=6190 · last_margin_min=20 n=2387.

NOT yet done for CFB: h1/tt prices (none captured), NBA-style day for 2016-2020 pre-odds ML (excluded rows),
frontend (schema/reducer/chat/hero/UI) — tracked in the main plan.
