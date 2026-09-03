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
  `gen_cfb_slate_flags.py` emits a game-total UNDER + the underperforming team's team-total UNDER →
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
- Conviction **T2** (elite 9/9-season consistency, mechanism-backed; modest ROI).
- **WIRED 2026-08-01** as signal `ret_prod_edge`: `cfb_early_roster_signals.py` (self-test 53.7% ATS wk1-3
  2021-25) → `gen_cfb_slate_flags.py` emits a wk1-3 spread flag backing the higher-returning team;
  `fetch_cfbd_roster.py` (in `run_cfb_week.sh`) refreshes `/player/returning`; def in `cfb_signal_defs`.

## VALIDATED (track-plus candidate) — CFB portal talent influx, weeks 1-3 ATS (S-CFB3)
> **Weeks 1-3: back a team that added ≥3 four-star+ PORTAL transfers (and more than its opponent).**

`transfer_trends_study.py`, `data/cfbd/portal.parquet` (2021-25). Sibling of S-CFB2 — that keeps its guys,
this adds new ones; both = early lines undervalue current-roster reality, both decay by week 4.
- **~57% ATS wk1-3** with the opp-differential (self-test n=220); the raw "3+ four-star adds" cell was 54.5%
  (4/5 seasons); **strongest when the team is the LESS-talented side** (60.4%, the mid-team-hits-the-portal
  case) — so it's the incoming portal talent being undervalued, not just "good teams cover."
- **Decays by week 4** (wk4+ ≈ 50%) — the market-lag signature. Dose-response in # of four-star adds.
- **Caveats (honest):** portal only 2021-25 (5 seasons), small n, ~20 cells scanned → **track-plus / T3**, not a
  locked bet like S-CFB2. Needs 2026+ to confirm.
- **Transfer VOLUME otherwise = PRICED:** raw incoming count + most position-group volumes → ~50-52% early
  (market watches the portal). New-QB → mild fade/under but confounded with continuity. OL-light→under and
  LB-heavy→cover are the same "portal-aggression" signal in disguise / partly team-type confounds (tracking).
- **WIRED 2026-08-01** as signal `portal_talent_influx` (T3): `cfb_early_roster_signals.py` →
  `gen_cfb_slate_flags.py` wk1-3 spread flag; `fetch_cfbd_roster.py` refreshes `/player/portal`.

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
- **WIRED 2026-08-07 as `coach_pace_under` (TRACKING tier, owner request):** wk1-3, new HC with pace_gap >= +4
  (the study's own dose-response rung: 66.7% under, n=21; the >=+8 mechanism cell = -5.0 vs the close, baseline
  -4.2) -> game-total UNDER flag at 0.5u paper. `fetch_preseason_ratings.tr_and_coaches` now writes
  `coach_moves_{season}.parquet` weekly (prev school via coach_seasons, pace from game_advanced season-1);
  `gen_cfb_slate_flags` emits the flag. 2026 wk1: 7 fires incl. OSU@Tulsa U60.5 (Morris +4.7, the original
  motivating case), Clemson@LSU U50.5 (Kiffin +9.8), WMU@Michigan U47.5 (Whittingham +8.6). The style-blend
  model input remains un-wired (separate work).

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
  bet. **CORRECTED 2026-08-02 (spread-sign bug):** new-coach ATS wk1-3 = **38.7%** (n=62, suggestive
  early FADE) decaying to 46.0% wk4+ — an early-fade candidate, not the flat-44%-priced first reported.
  (nflverse `spread_line>0` = HOME favored; ats_margin must be `result − spread_line`.)
- **REAL USE = a weeks-1-3 MODEL INPUT.** For a new-coach team, last year's tempo/pass-tendency is STALE
  (they play ~60-90% toward the coach's prior identity). Feed the coach's prior-team style into the
  early-season carryover (`early_season_blend.py`) instead of / alongside the team's own prior year, and
  surface a scouting note ("new HC from [fast/pass-happy] team"). NOT YET WIRED into the blend.
- **Follow-up:** NFL's biggest scheme lever is the OC, not the HC; nflverse only carries HC. OC moves
  need a Pro-Football-Reference scrape — the likely-stronger v2.

## CFB SCHEME STUDY (NFL-program port, 2026-08-03) — game-level tendency identity is PRICED
`cfb_scheme_study.py`. College has NO coverage/formation charting (no man/zone, 2-high, box — CFBD
carries none), so scheme = TENDENCY IDENTITIES from `model_games.parquet` (opponent-adjusted as-of:
pace, pass lean, EPA/explosiveness/success off+allowed w/ rush-pass splits, havoc f7/db, line yards).
Sign convention asserted (favs cover 48.7%); wk4+, close-graded, per-season 2016-25, 5,352 games.
- **Increment-over-close (the #99 design): NO GAIN even in CFB's softer market** — FG total +0.262
  MAE (worse than line-only), FG spread +0.231 (worse). No bet cell above need+sigma. Game lines
  price team-level tendency identity in college too.
- **Continuous interaction battery: all dead** — explosive-O-vs-suppressing-D, havoc-vs-weak-trench,
  run-heavy-vs-elite-run-D all 47-53% with complements behaving like the cells. (Mild residue: top-q
  explosive-pass offenses cover ~53.3-53.5% regardless of opponent — a ≈breakeven main-effect lean,
  not a signal.)
- **Where CFB style value actually lives (all previously validated, unchanged):** S-CFB1 in-season
  underperformance-vs-archetype UNDER (deviation, not identity), pace as a TOTAL-model feature
  (−0.46 MAE), and the wk1-3 roster/coach signals (S-CFB2/S-CFB3, coach transfer). **The NFL scheme
  program's payoff was PLAYER-level granularity (receiving props) — CFB has no player-prop data, so
  no analog exists.** Cross-sport law confirmed: game-level scheme identity is priced in BOTH
  markets; don't re-run identity/interaction screens at the game level.

## CFB EARLY-SEASON FEATURE CARRYOVER (2026-08-03) — forecaster FIXED; no new bet spots earned
`cfb_early_carryover.py` + `cfb_early_backtest.py`. The NFL continuity-blend ported to the CFB
harness: model_games' opponent-adjusted features are 100% NULL in wk1 (1-2 noisy games wk2-3) →
fill wk1-3 with prior-season END values shrunk by CONTINUITY = 0.75·returning-percentPPA +
0.25·same-HC (`data/cfbd/coach_seasons.parquet`, 2015-25), clip [0.20,0.95]; blend current season
back in by games played (K=6). Prior season = latest < S (2021→2019 over the COVID gap).
- **FORECASTER: transformed.** Wk1-3 walk-forward 2018-25 (n=1,017, sign-check 49.1%): spread
  corr-with-market 0.445 → **0.782**, MAE 17.60 → **15.15**; total corr 0.345 → 0.555. The cold
  harness collapse is fixed.
- **BET CELLS: none earned (honest kill).** Spread: no credible ATS cell either config. The strong
  early total-UNDER cell (filled p80 62.3%/+19.0, 6/7) FAILED the in-subset naive control — "under
  the N highest closes" wins **67.5%/+28.9** on matched n; the cell is `fade_high_total`'s
  high-close mean-reversion re-derived, and the simple rule captures it BETTER than the model.

### fade_high_total EXTREMITY TIER (tested + WIRED 2026-08-03, the sharpening lead cashed)
The flat `close>=60 -> UNDER` rule hides two structures: (1) **phase** — wk1-3 58.0%/+10.8 (8/9) vs
wk4+ 52.8%/+0.8 (the pooled ~55% validation was a phase-pooling artifact; the signal is essentially
an EARLY-season edge); (2) **extremity dose-response within wk1-3** — top-20% closes 59.2 (9/9) →
top-8% **64.5%/+23.2** (8/9) → top-5% 67.2. The top-8% is a strict SUBSET of >=60 (rank-only cell
n=0), i.e., the current rule's early hits concentrate in its most extreme lines while the 60-64.5
band is mediocre (54.7%, 5/9). Complement clean (bottom-10% closes -> over 48.8%). **RANK beats a
fixed cut** because the totals environment drifts (top-8% threshold: 68.6 in 2016 → 60.5 in 2025).
**WIRED:** `gen_cfb_slate_flags` upgrades fade_high_total to **T2** in weeks 1-3 when the game's
close ≥ max(slate p92, 60) — floor kept at 60 (sub-60 rank cells have zero historical sample). Wk4+
unchanged (T3; the decay says early is where the meat is). 2026 wk1: OK State @ Tulsa 60.5 upgraded.

**Exemplar (2026 wk1, OK State @ Tulsa 60.5 — the signal+context product story):** four independent
lenses converge UNDER: (1) the extremity tier (highest close on the board, 64.5%/8-of-9 cell);
(2) the coach scheme-transfer INVERSION cell — new fast-paced HC (Eric Morris, national scoring
leader at North Texas, brought his QB) = exactly the "market over-hypes a new fast scheme" setup
(those games landed −5.0 vs their bloated lines); (3) public hype confirmed (VSiN best-bets the
OVER 5.5 wins, Mestemaker Heisman piece); (4) the early-week blend projects 52.5 vs 60.5 and only
−0.8 on a −12.5 spread (OK State Stability Score 2/19 — the blend won't pay for an all-new roster).
Hierarchy: the T2 flag is the VALIDATED bet; (2)-(4) are converging context, not standalone edges.
- **DEPLOYMENT DECISION: EARLY_SUPPRESS STAYS** (model-edge spots earned no wk1-3 track record).
  Display predictions continue from `cfb_early_week`.
- **CARRYOVER WIRING: KILLED by pre-registered confirmation (2026-09-03, `exp_confirm_carryover_wk4.py`).**
  Run against the FULL production harness (feats + A2 nets + QB, production HP, folds 2021-25):
  (1) the production model is NOT cold early — wk1-3 corr-with-market is already 0.869 / MAE 14.1
  (talent + ELO + returning-prod cover it); the 17.6→15.2 transformation above was an artifact of
  the reduced 33-stem feature set. Carryover's marginal early gain in production: MAE 14.14→13.89,
  corr .869→.890 — real but small. (2) It DEGRADES wk4+: totals under-edge≤−6 hit 57.1%→51.5%
  (−5.6pp — the under-edge family feeds tt_away_under), sides gate≥4 −0.78pp pooled with 3/5
  seasons worse. GATES FAILED → do NOT fill model_games, do NOT wire at any refresh. The frozen
  pkls stand. Do not revisit without a materially different construction.

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
1. Wire S-CFB1 into `gen_cfb_slate_flags.py` + `cfb_signal_defs` (T3 UNDER, game + team total) — needs the
   profile/delta computation productionized in the weekly pipeline.
2. Add tempo/pace to the CFB total model (production_models / cfb_forecast total path).
3. Revisit NFL with more PBP seasons (only 2023-25 cached) before concluding the reversal is structural.

## EARLY-WEEK DISPLAY: MARKET ANCHOR (2026-08-03, wired) — the "OSU@Tulsa -0.8" fix
Owner spotted wk1 displays absurdly far off the market (OSU@Tulsa blend -0.8 vs close -12.5;
Indiana -22 vs -40.5). Battery (`cfb_early_talent_test.py`, walk-forward wk1-3 eval 2022-25, n=588):
- **The preseason blend carries ZERO information beyond the closing line.** Optimal shrink
  λ = -0.07±0.10 (spread), +0.12±0.11 (total) — both statistically zero. Line MAE beats the
  blend outright (12.16 v 13.23 margin; 12.26 v 12.98 total). On the top-decile disagreement
  games the market wins 15.2 v 18.7 — our big deviations are pure noise, every config.
- **Player/roster feature adds help the RAW blend but cannot close the gap**: ret_ppa best
  single add (corr .924→.932; auto-joins when CFBD posts ~Aug), portal net specifically
  shrinks the blow-up games (disagreement MAE 18.7→17.2), talent composite mild, new-HC
  carryover ≈ nothing. Compression is NOT the issue (pred SD 16.3 ≈ market 16.5).
- **WIRED in `cfb_early_week.py`**: display = close + 0.25·(blend−close), capped ±7 spread /
  ±6 total, Odds-API close only, raw blend where no line. λ=0.25 keeps a model voice at
  ~0.09 MAE cost. 2026 wk1 after: OSU@Tulsa +9.2 (was -0.8), Indiana -35.9, Miami(OH) -15.9.
- **Law for the vault**: in wk1-3 CFB, no amount of preseason player/roster data beats the
  line — the road to sane early numbers is the anchor, not more features. Betting unchanged
  (EARLY_SUPPRESS stays; flags grade vs the close as before).

## PLAYER-LEVEL ROSTER RECONSTRUCTION (2026-08-03, tasks #100-102, wired)
Owner push: gauge early games from INDIVIDUAL players (transfers, composites), not team
aggregates. Layer built: `fetch_roster_layer.py` (rosters 2016-25 213k rows + recruiting
composites 2013-26 + per-player season PPA) + cached portal/usage → `build_roster_scores.py`
→ per (season,team): ret_prod / in_prod / lost_prod / ret_share / net_prod / talent_stock /
qb1_prior / qb1_transfer / qb1_rating. **Construction validated: our player-built ret_share
corr +0.884 with CFBD percentPPA (n=916)** — we can now compute returning production from
rosters directly (2026: the day CFBD posts rosters, no waiting on the aggregate feed).

**Test (`cfb_roster_early_test.py`, walk-forward wk1-3, eval 2022-25, n=588):**
- BASE+ROSTER = best early model to date: MAE 12.95 (BASE 13.19; aggregate-features 13.31),
  corr w/ line .936, disagreement-decile error 18.5→16.2. ROSTER-ONLY alone worse (15.4) —
  player data COMPLEMENTS team ratings, doesn't replace them.
- vs the line pooled: λ +0.03±0.10 still zero — anchor law stands.
- **LEADS (track fwd 2026, NOT edges): G5-vs-G5 λ +0.305±0.204, transfer-QB λ +0.140±0.129**
  — positive info beyond the line exactly where lines are softest; 1.1-1.5 SE, under any
  significance bar. High-turnover and P5-P5 dead zero.
**WIRED:** ROSTER_FEATS in cfb_early_week.py MARGIN_FEATS (NaN-safe mean-impute → BASE
behavior until current-season rosters post); runner step "player roster layer" refreshes
weekly. Display anchor (λ=0.25 cap) unchanged on top.

## TRUE PRESEASON POWER RATINGS (2026-08-04, owner-identified, wired)
Owner caught the core flaw: priors used PRIOR-YEAR FINAL SP+, not the published PRESEASON
SP+ (which already prices portal/coaching — OSU 2026: stale -15.1 vs preseason +7.1, a
22-pt swing; preseason-implied OSU@Tulsa ≈ -12.2 vs market -12.5). Source:
cfbtxt.com/data/ratings_preseason_<year>.csv (SP+/FPI/FEI, 138 teams, 100% CFBD name
match) — CURRENT season only; historical preseason archives are ESPN+-locked, so
backtests still proxy with prior-year finals (documented limitation).
WIRED: fetch_preseason_ratings.py patches priors.parquet current-season rows
(prior_sp<-sp_plus, prior_fpi<-fpi); runner step added. 2026 wk1 raw blend now lands
within ~1 pt of the market on the rebuild games BEFORE anchoring.
STALE-RATING GAP STUDY (owner-designed, prior-year proxy, wk1-3 2017-25): follow-the-
ratings dose-response has no ladder; the FADE at 3-12 gap = 53.9%/+2.8 pooled but decomposes
into S-CFB2 overlap (58%) + NEW-HC cell (62.1%, n=116 — the correctly-conditioned version
of VSiN's new-coach fade) + dead no-cause remainder (51.2%); ALL slices flipped negative in
2025. stale_line_coach_fade = candidate TRACKING signal only. With true preseason ratings
now flowing, the same gap study runs LIVE in 2026 (preseason SP+ + HFA vs close) — forward
track before any promotion.

## REGIME FADE FAMILY — WIRED AS TRACKING SIGNALS (2026-08-04)
Owner-driven re-study on TRUE preseason ratings (TR predictive, harvested 2018-2025 via
dated URLs, 924 team-seasons, 100% name-mapped) KILLED the 2025-flip concern — it was a
stale-ratings artifact. Final cells (wk1-3, |implied−close| ≥ 2, close = Odds API):
- regime_fade_hc: rating's side has 1st-yr HC → fade = **58.4% / +11.5% (n=137)**, per-season
  47/50/60/56/58/78/60 — five straight positive 2021-25. Anti-control (fade wrong side) 37.8%.
- regime_follow_hc: rating's side vs new-HC OPPONENT → follow = **62.2% / +18.7% (n=111)**.
- qb-transfer fade 57.0% (n=128) — NOT wired yet (needs 2026 rosters to identify QB1).
- qb-unknown follow 54.9%→61.4% w/ dose (n=91/44, 7/7 season-cells) — watch.
WIRED: gen_cfb_slate_flags block (tracking tier, 0.5u paper) + signal defs; inputs
(preseason_tr_{S}, coaches_{S} w/ new_hc) refresh weekly via fetch_preseason_ratings.
2026 wk1: 13 fades + 5 follows live. STATUS: tracking until live season confirms (the
discovery grid scanned 30 cells). Also found+fixed: **CFBD consensus lines corrupt for
5/51 wk1 games (2 sign-flipped!)** — flags generator now overrides te lines from
odds_game_frame (owner Odds-API rule now enforced in the flags path too).

## TRENCH-WEIGHT STUDY + CFBD v2 AUDIT (2026-08-04)
OL/DL top-8 weights from rosters (now kept in fetch_roster_layer): mechanism REAL but tiny
(partial corr +0.03-0.05 at n=12,964; +0.24pp rush success per 10 lbs; loads slightly more
on pass pro), market PRICED (51-53% ATS, no dose ladder) — model feature + matchup-card
content, NOT a signal. CFBD v2 summer additions worth adopting: coach profile/tenure
endpoints (Jul 2026 — completes the first-year-HC table), /draft picks (high-value
departures for roster reconstruction), player team-stints (replaces portal name-matching),
/wepa adjusted metrics (cross-check). NOTE: preseason_tr_mapped.parquet (the TR→CFBD name
map) is gitignored — rebuild recipe = the harvest + MANUAL dict in this session's log.

## REGIME FADE × RETURNING STARTERS (owner-specified grid, 2026-08-04, wired)
Interaction of the true-preseason gap (|gap|≥2, wk1-3) with player-built returning shares:
- **CORE CELL: new HC + <45% returning production → fade = 61.2%/+16.8 (n=67, 6/6 SEASONS
  POSITIVE — best consistency in the ratings program).** New HC w/ roster back = diluted
  (54.5%, 3/6). Dose story: coach + roster turnover stack.
- **regime_fade_teardown (NEW tracking key): same HC, <30% returning → fade 56.0% (n=50,
  5/6).** Coach-free variant; the mirror (rating-side ≥60% returning → follow 53.2%, n=220).
- **POSITION SPLITS = NULL**: receivers/OL/DL-gutted cells scattered or inverted (OL-gutted
  fade 42.9%!), n=41-81, no season consistency. The regime effect is TEAM-level turnover,
  not positional — do not chase position cells (matches trench-study verdict).
WIRED: teardown key + "FULL TEARDOWN" tier annotation in gen_cfb_slate_flags (ret_share
NaN for 2026 until CFBD posts rosters → tiers self-activate); def registered. All tracking
tier, 0.5u paper, same promotion bar as the coach cells.

## REGIME FADE — CROSS-MARKET EXPRESSION MAP (2026-08-04)
Same conditions swept across the other markets (TT/1H = 2023-25 archive only, n small):
- **TEAM TOTAL of the faded team: UNDER 66.7% (n=48, 3/3 seasons)** — the strongest
  expression of the fade anywhere; the over-rated regime team scores under ITS number.
- **1H spread: fade the regime side = 60.4% (n=48, 3/3)** — slow starts vs the number.
- FG totals: new-HC under 54.5% is only +1.4pp over the wk1-3 baseline under bias (53.1%)
  — NOT incremental. Watch-only oddity: BOTH-teams-ret>=60% → under 58.7% (+5.6 vs base,
  erratic seasons; inverts the "returning offense = overs" folk claim). 1H totals dead.
- **DERIVED-MARKET LAW applies**: TT/1H are rotations of the spread fade — correlated
  leverage, NOT independent signals; nothing new wired. DEPLOYMENT NOTE: if the 2026
  tracking year confirms the family, express it as the faded team's TT UNDER (or 1H fade),
  not the FG spread — that's where the mispricing concentrates. The live TT/1H collector
  grades all three expressions side-by-side this season.

## EARLY-WEEK DISPLAY: ANCHOR RETIRED → PURE MODEL + SAFETY CAP (owner call, 2026-08-05)
Owner: λ=0.25 made every display ≈ the Vegas line — "we lose credibility quick." Correct:
the anchor was the STALE-RATINGS-era bandage; with true preseason SP+ + roster features the
raw blend sits mean 3.1 pts off the close with sane extremes. **Now λ=1.0 (pure model),
caps ±7/±6 kept only as a safety rail** (binds on the p90 tail — e.g., won't lay more than
close+7 on Indiana -40.5). Board now: mean visible deviation 2.8 spread / 2.3 total, only
9/51 spreads within 0.5 of the line. Known cost, accepted: raw display MAE ~13.0 vs line
12.6 (display identity > 0.4 MAE). λ-accuracy facts from the anchor study remain true —
BETTING stays suppressed (EARLY_SUPPRESS) and signals grade vs the close as always.


## CFB roster-dimension fade (wk1) — market OVERSHOOT on loaded rosters, 2024-25
> `roster_dimensions_report.py` + follow-up fade sweep (2026-08-07). Dimensions: exp_yrs
> (mean prior FBS roster-years, capped 4), ret_share/ret_prod (player-built PPA), cur_prod
> (= ret_prod + in_prod, portal included).
- **Forward story:** higher-dim side wins wk1 SU big (cur_prod 63.7%, n=237) but ATS is
  priced (~48-51% at open AND close, 2021-25 pooled).
- **Regime shift:** every dimension's higher side covered 57-61% vs the open in 2022,
  decaying to 37-43% by 2024-25 — the market learned portal/returning-production data and
  now OVERPRICES it.
- **Fade side, wk1 2024+2025 (n=83/dim, dims heavily correlated = ~one signal):**
  ret_prod fade 61.4% open (+17.3% ROI) / 59.0% close, positive BOTH seasons (59/63);
  ret_share 59.0/55.4; cur_prod 56.6/57.8; exp_yrs 61.4/59.0 but 2025-close ~51.
  Dose-response NON-monotone (mid-gap best for ret_prod, big-gap only 50%) — mechanism
  softer than regime-fade's.
- **Honest status: post-hoc sign flip on TWO seasons, selected because they inverted (the
  2022 bettor would have registered the opposite rule).** Tracking tier at most; if wired,
  pre-register ONE spec: fade higher ret_prod, all wk1 gaps, grade vs OPEN, 0.5u paper.
- Interplay: can contradict regime_fade_teardown on games where ratings lean on the GUTTED
  team (different mechanisms — teardown keys rating-vs-line, this keys raw roster diff).


## CFBD CORE ratings (/ratings/core, added 2026-08-08) — acquired + first test
- Context+opponent-adjusted PPA (core-v1), O/D split, 2016-2025 retro cached
  (`data/cfbd/core_ratings.parquet`); endpoint serves LATEST snapshot only (week
  param ignored) -> weekly as-of capture wired into fetch_preseason_ratings
  (`core_snapshots.parquet`) so in-season usage becomes backtestable from 2026.
- **Regime-family horse race (core_regime_test.py, 2021-25, same >=2 gap rule):
  TR preseason WINS — keep it as the live source.** TR: fade 57.6/follow 62.8
  (follow 5/5 seasons) vs CORE-S-1: fade 57.9 but 2025:43, follow 54.4 incoherent.
  Mechanism: TR-Aug bakes in offseason info yet still misses coach effects (the
  exploitable residual); prior-season CORE is fully stale, so its gaps trigger on
  generic staleness, not the coach-specific kind. Negative result — don't re-test.
- Replication note: this rebuild independently reproduced the vaulted TR cells
  (58.4/62.2 originally) on the 2021-25 slice. Control cell (no coach change,
  bet the rating) = 43-45% — naive rating-vs-line follow LOSES, as expected.
- NEXT (untested): S-1 CORE O/D split as early-blend priors (totals angle);
  our-features-vs-CORE disagreement study; in-season CORE-vs-line once the
  snapshot archive accrues.

- **AS-OF RECONSTRUCTION (owner idea, 2026-08-08): the missing archive, built.**
  `reconstruct_core.py`: plays-weighted ridge over team-game offensive PPA
  (team-off + opp-def one-hots + symmetric HFA, FBS-vs-FBS, per-100 scale) solved
  as-of every week -> `data/cfbd/core_asof.parquet` (31,888 rows, wks 3-16 + final,
  2016-2025; 2020 = no game_advanced data). **Validation: end-of-season solve vs
  official CORE r=0.92-0.96 overall (off/def 0.91-0.96) in all 9 seasons** — a
  faithful proxy; the residual is their context model + garbage-time filter.
  ⚠ USAGE RULE: thru_week=W is computed FROM weeks <=W -> legit only for
  predicting week W+1 and later. Joining thru_week=W to week-W games is a leak.
  Unlocks NOW (was 'wait a season'): in-season CORE-vs-line backtests, as-of
  rating features for the main model, disagreement studies at any week.

- **First as-of test (core_asof_line_test.py, wks 5-15, 2021-25, n=2,880):**
  vs CLOSE = dead 50% at every rung (market prices public efficiency data —
  canon confirmed). vs OPEN = monotone 51.4->52.9% by rung, 4/5 seasons
  positive at >=6 (2022 the lone miss), ~breakeven-to-+1% at >=8 (n=1,310).
  Same shape as the NBA absence finding: a CLV edge absorbed by the close —
  NOT a standalone signal; use as (a) validation the reconstruction carries
  real info and (b) a candidate FEATURE for the main weekly model / an
  open-bet steer. Phase split flat (5-7 ≈ 8+).

- **Movers test (core_movers_test.py) = NULL.** 3-week rating deltas, riser side,
  wks 8-15 2021-25 (n=2,036): 48-51% at every rung vs BOTH lines, no dose
  response, seasons scattered (2023 +, 2024 -). The market does not lag
  in-season CORE changes — matches the bball law (naive movement/momentum is
  priced). Don't re-test. Remaining CORE work: disagreement-vs-our-model study
  (needs historical weekly model preds assembled) + feature tryout in the main
  weekly model (the CLV finding's proper home).

- **Disagreement study (core_disagreement_test.py) = NULL with a structural insight:**
  our internal as-of net rating and the CORE proxy correlate 0.992 at the matchup
  level (mean disagreement <1 pt). Where they disagree hardest (top 20%), NEITHER
  wins (MAE ours 13.28 / core 13.48 / market 12.06) and neither side beats the
  close (49.3%/48.2%). The two systems are the SAME measurement independently
  implemented — no second opinion exists, disagreement direction is noise. This
  (a) independently validates our adjustment pipeline and (b) closes test 4 by
  implication: in-season CORE as a main-model feature is ~collinear (0.992) with
  the adjusted-rating features the model already carries — expected increment ≈ 0. The
  CORE program's real wins were the O/D preseason priors (shipped, totals MAE
  13.31->13.17) and the open-line CLV validation. PROGRAM CLOSED.

- **TOTALS test (core_totals_test.py, owner push 2026-08-08) = THE CORE WIN.**
  In-season as-of CORE off/def -> implied total (walk-forward calibrated): >=4 off
  the CLOSE = **54.1%, n=1,389, ALL 5 seasons positive (54/51/57/55/53), ~+3.3%
  ROI**; holds at open (53.6%). Our own components = 52.5% on identical games ->
  CORE's context-adjustment layer (expected-PPA-given-situation, the one piece we
  don't replicate) is worth ~1.6pts on totals. Invisible in spread tests because
  the NETs agree at 0.992 — decomposition quality only shows where decomposition
  matters. Wired as `core_total_edge` (tracking, wks>=5, self-activates once
  2026 as-of ratings exist). Next re-freeze: add CORE O/D to the totals model.
  METHOD LESSON (owner-called): test the market the data's STRUCTURE serves
  first — the preseason totals win pointed here and I tested spreads 3x instead.

- **TOTALS MAMMOTH dig (cfb_total_mammoth_dig.py, owner request 2026-08-08):**
  CORE edge>=4 + STEAM toward the CORE side = the confluence that works.
  Ladder: edge alone 54.1% -> +steam>=0.5 **58.1% n=353 +10.9%** -> +steam>=1.5
  **60.9% n=169 +16.4%, ALL 5 seasons 56-67%** -> steam>=2.5 DECAYS (55.6%,
  fully-moved lines). Deeper stacks (extremity L3) destabilize (2024: 25%) —
  two independent mechanisms is the sweet spot, three over-slices. Wired as a
  conviction ladder on core_total_edge (track/T2/T1@1.5u); 3u mammoth branding
  deferred until one live season confirms. Big edges (>=7) alone LOSE (50.5%) —
  the moderate-gap law again.
- **1H mammoth = NOT FOUND.** CORE-implied 1H (share-calibrated) edge dose is
  real but modest (>=3.5: 55.6% n=392, 2025 flat, only 3 line-seasons) and 1H
  STEAM INVERTS (edge+strong steam 45.8% — thin 1H books move for different
  reasons; never port the FG steam layer to 1H). Watch-tier only.

## Early-week (wk1-3) blend AS A BET — owner challenge answered (2026-08-11)
> `cfb_early_edge_backtest.py`: walk-forward 2021-25 wk1-3, EXACT production feature sets
> (roster + CORE), bets at |model-line|>=cut graded vs open AND close, per season.
- **SPREADS: NULL, again.** 48.5-50.7% at cuts 2-4 both lines; per-season 44-58% chaos.
  Confirms the λ-shrink test (blend deviations = zero info beyond the close). Big-cut
  cells (>=8: 53-54%) are small-n and inconsistent — the moderate-gap law still rules.
  Display-only stands; wk1-3 spread plays remain signal-driven.
- **TOTALS: REAL — the CORE structure pays early too.** RAW blend total >=4 off the
  close: **55.1% (n=352), ALL FIVE seasons >=52** (59/52/55/55/54); >=6: **57.9% (n=209)**.
  vs the OPEN it is weaker (50.8/55.0) — the edge is a close-graded one. Coheres with
  core_total_edge (54.1% wks 5+): one construction, two windows.
- **WIRED as `early_total_edge`** (gen_cfb_slate_flags, WEEK<=3): raw pre-anchor total
  (the ±6 display cap truncates exactly the paying edges — pred_total_raw added to the
  early CSV), >=4 fires (tracking 0.5u), >=6 = T3 active. 2026 wk1: 9 fires, OSU@Tulsa
  U61.5 (-10.1) converging with coach_pace_under — independent-mechanism confluence.


## Prior-year ATS record -> next year (owner question 2026-08-11)
> `cfb_ats_regression_study.py`: 915 team-season pairs 2016->2025, panel ATS vs close,
> next-year overall + wk1-3, x close-losses / coach / ret_prod / SOS change.
- **Naive mean-reversion DOES NOT EXIST.** Every prior-ATS bucket lands 49.5-50.2% next
  year — the market fully reprices last season. Good-ATS teams don't regress bettably
  either (49.4%). "Stayed close in losses" adds nothing (49.2 v 49.9).
- **THE REAL FIND — bad ATS + NEW head coach keeps failing early:** wk1-3 next year
  42.6% (n=63 team-seasons, ~190 games) -> FADE ~57%, **below 50 in 6 of 7 season pairs**
  (46/40/42/53/43/33/35). Different trigger from regime_fade_hc (season context, no
  rating-gap requirement) — check game overlap before wiring as `ats_hangover_fade`.
- Bad ATS + SAME HC bounces mildly early (53.7% wk1-3) — mostly the ret_prod channel:
  bad ATS + HIGH returning production = 52.5% full / 54.8% early vs 48.2/48.3 low —
  already monetized by ret_prod_edge.
- **Schedule relief: the pretty version was HINDSIGHT.** Realized next-year opponent Elo
  gave a clean monotone (57.5/48.4/43.5 early) but the August-knowable version (opponents'
  prior-year Elo) degrades the eases-side to 52.0% with 2/5 seasons under 50 — dead.
  The harder-side fade (44.0% early) works only 2022+ (fade 58/53/74) — portal-era-flip
  shape again, tracking candidate only.
