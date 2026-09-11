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

## NCAAF replication (2026-09-11, exp_2h_ncaaf.py) — different regime

NFL constructs mostly DO NOT transfer. CFB structure: halves are CORRELATED
(margin corr +0.21, total +0.14 vs ~0 NFL) and the market UNDER-follows the 1H
(totals: reality +0.093/pt vs market +0.065). Failed: dominator continuation
(47.7%), coasting fav, view-improved fav, bespoke-move, outlier-book at 1pt
(45.5%; 60.9% at 2+ but n=23). Replicated: standard fav (3-6) in blowout mode
58.7% (NFL 64%).

★ CFB-SPECIFIC HEADLINE: 2H total posted at 26 or lower -> bet OVER.
n=834, 56.4%, +6.1% ROI at real prices (median -114), z=+3.67,
per-season 56.7 / 56.5 / 55.8. Blanket 2H over lean is 53.5% but the whole
edge concentrates in low/mid 2H totals (<=22: 55.8%, 22.5-26: 56.7%,
26.5+: 48.3%). Books shade slow-game 2H totals too low; college scoring
floor beats it. Threshold from a 3-bucket split of a registered blanket
observation — monotone/dose-coherent.

## 1H turnover-conversion study (Discord user theory, exp_2h_turnovers.py)

All four claims directionally CORRECT, none to validation bar. Best: dog got a
1H takeaway and blew every one -> back FAV 2H = 55.8% (n=120, 3/3 seasons
52/58/59, z=1.1). Dog converted -> back dog 52.8%; fav blew -> dog 51.9%;
late-1H dose adds nothing (53.4%, n=58). Asymmetry: conversion only matters
for DOGS (fav converted -> 49.6%, nothing). Squandered opportunity > seized
opportunity as a signal. Watch-tier; revisit with 2026 sample.

## Final-1H-possession study (exp_2h_final_poss.py, NFL) — CORRECTED 2026-09-12

AUDIT (owner challenge): plumbing verified (game_id order, grading oracle,
drive log hand-check) BUT the v1 kneel-out classification biased the dog
cells — a team's "final possession" ignored that a kneel could follow a real
drive, selecting only very-late events. Corrected = last MEANINGFUL possession.

CORRECTED results: dog ends 1H with TD -> NO signal (49.0%; v1's 43.9%
fade-the-dog was mostly artifact). Dog ends with turnover -> weak 52.9% lean.
Favorite cells hold and strengthen: fav ends 1H with TD -> back fav 54.0%;
★ fav ends 1H with a TURNOVER -> back fav anyway 58.0% (n=88, 55/59/60 all
three seasons) — market dings the favorite for the visible late mistake,
favorite quality shows through. ★ DOUBLE-DIP MYTH CONFIRMED DEAD under the
corrected definition: score last meaningful possession AND receive the 2H
kick = 50.6% (dog) / 50.2% (fav), ~400 games. Candidate/watch tier.

## Intersections: line-state x turnover tells (exp_2h_intersect.py, NFL)

The DISCOUNT is what makes the turnover tells pay:
- ★ C1 squandered gift (fav late TO, dog 0 pts off it) + fav live line crashed
  >=2 -> back FAV: 81.0% (n=21, 80/83/80 by season). Without the discount
  (fav on pace) the same signal is 60% and 2025-negative.
- D1 dog blew ALL takeaways + fav behind pace -> back FAV 61.4% (n=44) vs
  52.6% when fav on/ahead of pace. Same structure, broader trigger.
- A1 big-fav crash + dog EARNED it (converted a takeaway) -> dog 61.9% (n=21);
  crash with no dog takeaway = 50%. The crash-fade needs the earn.
- B blowout cell does NOT split on how the lead was built (62 vs 64) — spot 1
  stands as-is.
Pattern: signal alone is not enough; signal + market discount = edge (same
economics as the whole overreaction family). All n=21-44, watch tier.
