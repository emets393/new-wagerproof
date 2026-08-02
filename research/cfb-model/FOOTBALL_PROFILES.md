# FOOTBALL_PROFILES — team-archetype / style-split research (CFB + NFL port)

Port of the CBB archetype system (`research/bball-odds/BBALL_SIGNALS.md`) to football, 2026-07-18.
All records graded at the line the signal uses (FG = close; derivatives = h2 consensus), decimal −110
(breakeven 52.4%), per-season ALWAYS. Guardrails from the CBB program applied throughout (leak-safe
prior-only within-season; magnitude not sign-consistency; private computations not public ATS records;
extremity as a continuous dial with dose-response; complement checks; scan honesty; anti-signals symmetric).

## Artifacts
- `build_football_profiles.py` → `data/cfb_team_games_profiled.parquet` (12,462 team-games, 2016-25):
  3 leak-safe within-season profile groups + types + FG outcomes.
- `build_cfb_markets_2325.py` → `data/cfb_markets_2325.parquet` (team totals + 1H spread/total/ML, 2023-25).
- `phase2_archetype_grid.py` (grid), `phase3_deltas.py` / `phase3_under_dig.py` (delta signal),
  `phase4_shape_mae.py` (model features). NFL: `../nfl-extreme-outcomes/build_nfl_delta.py`.

## The profiles (Phase 1) — SCOUTING layer
Prior-only as-of features from `model_games` (verified leak-safe: week-1 null, expanding thereafter),
ranked within (season,week), KMeans:
- **Offense (5):** boom-bust vertical · efficient-methodical · elite-balanced-tempo · ball-control pro-style · ground-and-pound
- **Defense (5):** havoc/attacking · passive-leaky · 2× run-stuff · bend-break pass-leaky
- **Trenches (4):** OL-heavy/weak-DL · talent+pressure · DL-strong/run-stuff · elite-OL/low-pressure

**Stability (honest): modal-type share 73-78%, mid==end 66-71% — BELOW CBB's 80-84%.** The 12-vs-30-games
problem. Types are usable structure/scouting; do NOT over-trust a team's specific type history → lean on
the grid + magnitude deltas (guardrail #1).

## VALIDATED BET — CFB offense-underperformance UNDER (S-CFB1)
> A team whose **actual offensive EPA/play has run below its own season baseline** vs an opponent's
> **defense archetype**, across **≥2 prior same-season meetings** (magnitude trigger) → bet the **UNDER**.

Leak-safe (only prior games' actuals feed the delta). Clean dose-response, mechanism-backed, per-season:

| delta ≤ | Game UNDER 2016-25 | Team-total UNDER 2023-25 |
|---|---|---|
| −0.05 | 52.3% · 6/9 | 55.0% · +4.9% · 3/3 |
| −0.10 | 54.5% · +4.0% · 7/9 (n=437) | 55.9% · +6.8% · 3/3 |
| −0.15 | **58.4% · +11.4% · 8/9** (n=185) | **60.8% · +16.0% · 3/3** (n=51) |

- **Mechanism:** underperformer totals land BELOW the number (team −0.16, game −0.53) while baseline lands
  OVER (+0.28 / +0.65) → line runs ~0.5-1.2 pts too high for the cell. Real, modest mispricing.
- **Complement:** over-performers do NOT go over (47-49%) — extreme deltas mean-revert (matches CBB S5).
- **Markets:** team-total UNDER strongest (small 3-yr sample), game-total UNDER best-sampled (9 yr).
  1H spread fade 56.6% (3/3 but thin). **ATS fade = 52.8% breakeven → NOT a bet** (spread prices it).
- Conviction: **T3** (game total, well-sampled), **T2 when delta ≤ −0.15**. Grade at close.
- **WIRED 2026-07-18** (signal_key `style_offense_under`): `cfb_style_delta.py` computes the leak-safe pregame
  delta (self-test: 474 fires, 53.6% under with the live latest-completed-archetype proxy) →
  `gen_cfb_dryrun_flags.py` emits a game-total UNDER + the underperforming team's team-total UNDER →
  `cfb_signal_defs` card loaded. `build_football_profiles.py` runs in `run_cfb_week.sh` before flags (new
  weekly dependency). Fires once teams have ≥2 prior meetings vs an archetype (~week 4+).

## VALIDATED BET — CFB returning-production continuity, early-season ATS (S-CFB2)
> **Weeks 1-3 only: back the team with the higher RETURNING-PRODUCTION differential** (CFBD `/player/returning`
> `percentPPA`, opponent-relative). ret_diff ≥ +0.20 → cover.

Preseason-known (leak-safe). `phase_returning_study.py`, `data/cfbd/returning_production.parquet` (2016-25):
- **54.4% / +3.9% ROI, 9/9 seasons** (ret_diff≥.20, n=687); dose-response 53.2%(≥.10)→54.8%(≥.30, 9/9).
  Week-1 alone 56%/+6.8% (7/9). Complement (rebuilt team) 45.6% / 1/9 — symmetric.
- **Decays by week 4** (wk4-6 = 49.2%) — early lines under-weight continuity, market corrects once it has
  current-season data. Same "dead by January" mechanism as CBB S4.
- **Survives talent-control (the decisive test):** talent WITHOUT continuity fades to **46.2%**; continuity
  WITHOUT talent covers **53.8%** → continuity is independent of team quality, which the market already prices.
- **Mechanism:** experienced teams beat the close by **+0.94 ATS pts** vs +0.00 baseline — a real ~1-pt line
  under-valuation.
- **ATS only** (no totals edge: rebuilt→under is 47.5%/noisy). **No single position dominates** — passing/
  rushing/receiving returning all ~53% (7-8/9); it's the AGGREGATE. (OL + DEFENSE returning are NOT in
  `/player/returning` (PPA=offense skill only) → would need roster-diffing; that's where position-specificity
  might live — future build.) **Portal-churn interaction underpowered** (2021-25, n=51 cells — set aside).
- Conviction **T2** (elite 9/9-season consistency, mechanism-backed; modest ROI). NOT YET WIRED — needs the
  `/player/returning` fetch in the pipeline (loads ~August for 2026) + a differential flag weeks 1-3.

## VALIDATED (scouting/model input, NOT a standalone bet) — Coaching scheme transfer
> When a head coach moves school A→B, team B's STYLE shifts toward how A played under him — fast/slow especially.

`coach_moves_study.py` (CFBD `/coaches` seasons array → 66 HC moves 2017-25; style from `game_advanced`),
`coach_pace_betting.py`, `data/coach_moves.parquet`:
- **The scheme transfers, year 1, measurably:** pace corr(coach-vs-team gap, actual shift) **+0.65**, pass-rate
  +0.68, explosiveness +0.56 (n=52); big-gap moves **close ~60-66% of the style gap in year 1**. Examples:
  Charlie Strong took USF 71→85 pace (Texas-fast), Taggart FSU 62→71 (Oregon), Odom Purdue 56→65, Blake
  Anderson Southern Miss 60→68. (A few exceptions, e.g. Jimbo Fisher.)
- **Portal amplifier (2021-25, suggestive):** 26/33 moves brought ≥1 transfer from the coach's old school;
  **3+ followers → 66% gap-closure vs 37% with 0-2** (n=19 vs 14). Coach + his players = bigger shift
  (e.g. Charles Huff → Southern Miss, 19 followers, 60→68).
- **NOT a standalone early-season bet:** big coach moves are rare (~15-21 wk1-3 games/cell), and the naive
  "fast coach → OVER early" INVERTS — those games came in UNDER (line 60.2, actual 55.2, −5.0), i.e. the market
  OVER-hypes a new fast scheme. Underpowered + wrong-direction → do not bet directly.
- **REAL USE = a weeks-1-3 MODEL INPUT** (where the owner wanted help): for a new-coach team, last-year's tempo
  is STALE (they'll play ~66% toward the coach's prior style). Blend the coach's prior-team style into the
  early-week priors model (`cfb_early_week.py`) + a scouting card ("new HC from [fast/slow team] + N followers").
  NOT YET WIRED. Needs `/coaches` + `/player/portal` in the pipeline (fetch built inline; add to fetch_cfbd_extra).

## NFL — Coaching scheme transfer (port of the CFB study) — STAT VALIDATED, bet under-powered
> Same question, NFL: when a HEAD COACH moves team A→B, does B's style shift toward how A played?
`research/nfl-extreme-outcomes/nfl_coach_moves_study.py` (+ `nfl_coach_moves_betting.py`,
`data/nfl_coach_moves.parquet`). Coach→team→season from `nflverse_games.parquet` (home/away_coach);
style from nflverse PBP 2012-2025 (`data/pbp_cache/pbpslim_*`): PROE = pass-over-expected (pass−xpass,
neutral early downs), pass_rate, pace (off plays/game), EPA/play, explosive (yds≥20). Grade at close
via `nflverse_games` `total_line`/`spread_line` (full-history fallback; Odds-API archive only 2023+).

- **Structural NFL difference:** HCs rarely jump team→team in consecutive years (they get fired and sit
  out), so the strict CFB "consecutive-year" move catches only ~10 cases 2013-25. Allowing a ≤5-yr gap
  and taking the coach's identity from his LAST HC season gives **30 moves (n=21 with full style)**.
- **The scheme transfers, year 1, and MORE on pass tendency than CFB:** corr(coach-vs-team gap, actual
  shift) — **PROE +0.77 (closes 76% of gap), pass-rate +0.75 (89%), pace +0.68 (59%)**, EPA +0.61,
  explosive +0.63. EPA/explosive weaker = talent follows the roster, not the coach (expected). Examples:
  Rivera CAR→WAS pace 55→65 (+9.88, Carolina tempo), Reich IND→CAR 57→64 (+7.24), Pete Carroll SEA→LV
  62→55 (−6.59, slowed it), Andy Reid PHI→KC PROE −0.14→+0.08 (made KC pass-happy).
- **Bet = NOT proven (under-powered), and directionally OPPOSITE to CFB:** wk1-3 fast-coach (pace_gap≥+8)
  totals came in **+5.9 over the close** (line 43.9→actual 49.8, vs +0.55 baseline), OVER hit 4/6 and the
  slow-coach complement went under-heavy — i.e. the NFL market UNDER-adjusts the early pace jump (CFB's
  market OVER-hyped it and the lean inverted). But the wk1-3 cell is only **n=6/3** — noise-level, do not
  bet. New-coach ATS underperforms ~44% both early AND late (n=63/277) = roster quality/priced, not a
  scheme edge.
- **REAL USE = a weeks-1-3 MODEL INPUT.** For a new-coach team, last year's tempo/pass-tendency is STALE
  (they play ~60-90% toward the coach's prior identity). Feed the coach's prior-team style into the
  early-season carryover (`early_season_blend.py`) instead of / alongside the team's own prior year, and
  surface a scouting note ("new HC from [fast/pass-happy] team"). NOT YET WIRED into the blend.
- **Follow-up:** NFL's biggest scheme lever is the OC, not the HC; nflverse only carries HC. OC moves
  need a Pro-Football-Reference scrape — the likely-stronger v2.

## MODEL FEATURES (Phase 4) — walk-forward MAE, keep-what-lowers
Shape features (orthogonal to the efficiency the market prices), test seasons 2021-25:
- **TOTAL model: +shape −0.540 MAE (13.82→13.28), driven by PACE (−0.46)** + trench (−0.12) + explosive
  (−0.08); identity (pass_rate/run-pass EPA) adds nothing. **→ add pace/tempo to the CFB total model**
  (per-market law: total gets shape). This is the football analog of CBB's roster-shape margin gain —
  here it's **tempo on totals**.
- **MARGIN model: shape ≈ null** (−0.004 all together; groups collinear). Don't add shape to the spread model.
- **Team-points: −0.096** (pace/explosive). Minor keep.
- All models remain ~0.8-1.1 MAE worse than the close → baseline product + confluence, not a close-beater
  (same conclusion as CBB).

## DEAD / DO-NOT-REBUILD (tested honestly)
- **ATS archetype grid (offense-vs-defense, defense-vs-offense, trench-vs-trench):** NULL. 0 of 66 cells
  clear |edge|≥5pts (≈2.6 expected by chance). The spread market prices scheme matchups. (Mild trench lean
  DL-strong beats OL-heavy/weak-DL ~53%, complement-confirmed but sub-vig → tracking/scouting only.)
- **Pass-heavy O vs leaky-pass D → under (the Phase-2 "8/9 seasons" cell):** FALSE POSITIVE. On continuous
  dials it washes out (50.9%, 4/9), no dose-response, and the posted total is NOT inflated (+0.3 actual−line).
  A KMeans-cluster artifact — killed by the mechanism + dose-response guardrails.
- **NFL port of S-CFB1 (offense-underperformance under): REVERSES — do NOT bet in NFL.** Wrong-way
  dose-response (under 46%→42%→33% as delta drops) and games land +2.28 OVER the line. The sharp NFL market
  over-corrects recent underperformance; CFB (softer) under-corrects so it persists. Consistent with
  [[nfl-injury-signal-null]]. NFL "underperformer → OVER" is directional but 3-season/thin → tracking only.

## Cross-sport law (the meta-finding)
Style-underperformance **persists and is under-priced in CFB (→ under)** but is **over-corrected in NFL
(→ reverses)**. Same softer-market / sharper-market split seen across the program (CFB prices soft info
loosely, NFL tightly). Build style-delta signals in CFB; treat NFL as the sharp control.

## Next
1. Wire S-CFB1 into `gen_cfb_dryrun_flags.py` + `cfb_signal_defs` (T3 UNDER, game + team total) — needs the
   profile/delta computation productionized in the weekly pipeline.
2. Add tempo/pace to the CFB total model (production_models / cfb_forecast total path).
3. Revisit NFL with more PBP seasons (only 2023-25 cached) before concluding the reversal is structural.
