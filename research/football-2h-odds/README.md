# football-2h-odds — halftime-posted 2H lines, NFL + NCAAF

Second-half spreads / totals / moneylines are **in-play markets that only exist
during halftime**, so this warehouse walks The Odds API's historical snapshots
(5-minute grid) and probes each game at kickoff+offsets to catch the live
halftime prices. Built 2026-09-11 (owner request). Additional-markets history
starts at the 2023-05-03 wall → seasons 2023, 2024, 2025 (+2026 accruing).

## Files

- `fetch_2h.py <sport> <start> <end>` — events per game-day (1 credit/call) →
  per-event historical odds at the halftime ladder (NFL kickoff+90/100/110 min,
  NCAAF +95/105/120). A book's quote counts as **live** only if its
  `last_update` is within 4 min of the snapshot (in-play books leave stale
  suspended quotes). Appends `data/{sport}_2h_raw.parquet`; checkpoint
  `data/{sport}_done.json` makes reruns resumable. Quota guard aborts <50k.
- `build_frame.py <sport>` — raw → one row per game with halftime **open**
  (earliest snapshot with ≥2 fresh books) and **close** (latest) consensus
  medians: `open_/close_h2_spread` (home-relative), `h2_total`, `h2_ml_*`,
  book counts, snapshot timestamps → `data/{sport}_2h_frame.parquet`.

## Validation (NFL wks 1-2 2025 pilot)

30/30 games captured live 2H lines (books: DK, FanDuel, BetRivers, Bovada;
median 3 fresh books/market). 2H totals 14.5-31.5 (median 21.5), 2H spreads
≤6.5 — sane halftime numbers. ~90 credits/game.

## Not done yet / gotchas

- **Scores join**: grading needs 1H + final scores. NCAAF: CFBD
  `homeLineScores` in `research/cfb-model/data/cfbd/games_*.parquet` (team-name
  map Odds API ↔ CFBD lives in cfb-model's odds pipeline). NFL: 1H scores in
  the nfl-extreme-outcomes H1 frames. Do the join in the analysis script.
- **Derived-market law applies** (memory `derived-market-gating-law`): 2H ≈
  full game minus 1H — check the rotation before grading 2H as a fresh market.
- Odds API event ids are the key; team names are Odds API names
  (NFL: "Detroit Lions"; NCAAF: "Michigan State Spartans" style).
- 2026 in-season: rerun `fetch_2h.py` weekly with a trailing window (resumable),
  or wire a live halftime capture into the odds crons later.

## NFL deep-dive results (2026-09-11, exp_2h_nfl_deep.py + inline follow-ups)

- Market prices 2H spread reversion at -0.152/pt of 1H surprise vs reality -0.100
  (over-priced ~50%); 2H total moves +0.037/pt of 1H total surprise vs reality ~0
  (halves independent). Continuation side wins everywhere reversion logic is public.
- Nested LOSO: no linear feature set beats the posted 2H line. The sub-50% tail
  (model >= market+2 -> home 31.7%) FLIPS to a 68.3% away fade (n=41, spec-robust
  68-78%) — but its clean single-factor generalizations diverge: the game state
  alone (unexpected dominator) goes the OTHER way (home covers 59-61%), so the
  cell is the intersection "1H dominator + market slammed the line beyond its
  rule", i.e. follow-the-market's-private-info. n=41 — retest on NCAAF.
- Clean constructs that DO hold: market bespoke move TOWARD home >= 2.5 beyond
  its score rule -> home 59.7% (n=129, 3/3 seasons, monotone dose; home side
  only). Outlier book >= 1pt off consensus -> follow at consensus price 56.4%
  (172 games, 3/3 seasons, 59.2% at net >= 2).
