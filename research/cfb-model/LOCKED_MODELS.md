# CFB LOCKED MODELS & SPOTS — canonical reference

The single source of truth for the College Football product. Everything here is **walk-forward**
(trained only on seasons < target; no game trains on its own season) and graded on the **honest
rule: signal-line == grade-line** (a spot bet at the close is graded at the close, at DraftKings is
graded at DK, etc.). Everything is wired into `cfb_forecast.py` and runs each week.

```
python3 cfb_forecast.py                       # 2025 dry-run (train <2025), prints per-spot grades
python3 cfb_forecast.py --season 2026 --week 6  # weekly production (needs 2026 data + odds pulled)
```
Outputs: `out/cfb_predictions_<season>.csv` (every game — website display) and
`out/cfb_bets_<season>.csv` (games where ≥1 spot fires — the bet ledger).

---

## 1. BASE MODELS (the website product — a number for every game)

Two `HistGradientBoostingRegressor`s (max_iter=300, lr=0.05, depth=4, l2=1.0), fundamentals-only
(opponent-adjusted EPA/SR/explosiveness/line-yards/havoc/PPO/pace/returning-prod/talent/ELO-as-of-wk1;
**priors excluded** — they help prediction but hurt betting). Source table `data/model_games.parquet`
(6652 games, 2016-19 + 2021-25; 2020 COVID-absent).

- **Totals model** → `pred_total`; `total_edge = pred_total − total_open`.
- **Sides model** → `pred_margin` (home perspective); `side_edge = pred_margin + spread_open`,
  `side_edge_close = pred_margin + spread_close`. `pred_spread = −pred_margin`.

**Honest baseline:** the sides model graded at the **close** is ~50.8% (−3% ROI) — i.e. it is a
**+CLV product, not a standalone close-beater** (2025 model CLV +0.38 pts). It becomes *bettable*
only when a line signal confirms it (see §2 STACK). This is by design — see memory
`wagerproof-nfl-model-purpose`: the per-game number is the product; spots are the bet layer.

---

## 2. SPOT LIBRARY (the bet layer) — `spot_library()` in cfb_forecast.py

Each spot = `(mask, side, market, grade_line)`. Stats are multi-year walk-forward unless noted;
`[per-season]` shown where it drove the decision. **2025 = pure holdout.**

### 2a. HEADLINE — MODEL × SOFT-BOOK STACK (two INDEPENDENT edges agree) · grade @ close
The fundamentals model and the market-microstructure soft-book gap are independent; when they agree
they stack. Built in `combo_model_lines.py`. Vetoed when a late reversal contradicts the model.
| Spot | Rule | Hit | n | Note |
|---|---|---|---|---|
| STACK model+gap≥1 | model lean (|edge_close|≥2) == sign(soft_gap), |gap|≥1 | **72.7%** | 55 | 2025: 77.8% (n9) |
| STACK model+gap.5-1 | same, 0.5≤|gap|<1 | **~55%** | 311 | volume |
> When model & soft-book **disagree**, the model side is sub-50 → **PASS** (don't bet).

### 2b. SOFT-BOOK STANDALONE (line discrepancy) · grade @ best soft number
`book_consensus_blend.py`. SHARP = median{williamhill_us, twinspires, draftkings};
SOFT = median{bovada, mybookieag}; `soft_gap = sharp_close − soft_close`. Bet the SHARP side at the
best soft number.
| Spot | Rule | Hit | ROI | n/yr |
|---|---|---|---|---|
| SB premium gap≥1 | |gap|≥1, bet sharp side | **64.2%** | +22.6% | ~22 |
| SB volume gap.5-1 | 0.5≤|gap|<1 | **56.8%** | +8.4% | ~150 |
> Sharpest books: William Hill, TwinSpires. Softest: **MyBookie** (lean covers 45.6%), Bovada (48.2%).
> FanDuel/DK/BetMGM deviate a lot but are **directionally random** (not fadeable). Edge is **spread-only**
> (totals & ML soft-book = dead/artifact). Timing: gap≥1 can be bet **24h early** (~65% + ~+1.75 CLV);
> gap≥0.5 must wait for close. Needs accounts at a sharp ref + soft book(s); Bovada is the reliable anchor.

### 2c. KEY NUMBERS (DraftKings close) · grade @ dk
`dk_keynumbers.py`. CFB margins cluster at 3 (10.6%) and 7 (8.8%); totals are smooth (no total key #s).
| Spot | Rule | Hit | n | Mechanism |
|---|---|---|---|---|
| KEY dog +2.5/3/3.5 | take small dog | 54.1% | 628 | fade small chalk; 3 = top margin |
| KEY lay −6.5 | back fav at −6.5 | 57.3% | 143 | wins on the 7-point margin |
> Rejected as noise: the −8.5/−9.5 "fav covers" flicker (adjacent numbers alternate).

### 2d. CONFERENCE structural numbers · grade @ close
`conf_numbers.py`. Specific numbers mean different things by conference (style/pace/defense). These are
*structural*, not microstructure — which reconciles the "totals movement is dead" finding. Survivors
passed per-season + recent-year (2021-25) validation + mechanism (out of ~190 cells tested).
| Spot | Rule | Hit (21-25) | n | Mechanism |
|---|---|---|---|---|
| CONF SunBelt fade home-fav | Sun Belt, home favored → take dog (AWAY) | 57.7% | 156 | home favs overvalued |
| CONF AAC total 52-59 OVER | American, 52<tot≤59 → over | 56.7% | 104 | up-tempo G5; +8.7pts vs band (real) |
| CONF BigTen away-fav cover | Big Ten, away favored → AWAY | 55.2% | 145 | road favs undervalued |
| CONF SunBelt total 59-66 UNDER | Sun Belt, 59<tot≤66 → under | 67.9% | 56 | run-heavy; +13.5pts vs band (real) |
> Caveat: multiple-comparisons risk; thin ones (SunBelt 59-66 n56, BigTen≥14.5 n37) are higher variance.
> RETRACTED: "SEC total 52+ UNDER" was only +1.6pts vs the same-total-band baseline = generic mean reversion,
> not an SEC edge (confound audit). Replaced by the total-level + form spots below.

### 2d-2. TOTAL-LEVEL & TEAM-FORM spots (mean reversion) · grade @ close
The exploitable totals error is one-directional (books shade totals UP → public over-bias) so edges point UNDER.
| Spot | Rule | Hit | n | Notes |
|---|---|---|---|---|
| TOTAL fade high≥60 UNDER | posted total ≥60 → under | 55.1% | 709 | solid, every season |
| TOTAL fade low≤50 OVER | posted total ≤50 → over | 52.5% | 1319 | weak (near breakeven) |
| **FORM over-hot fade UNDER** | both teams season over-rate≥.60 & total≤58 → under | **58.4%** | 373 | BEST totals edge; survives total-level confound (+9.5pts within-band) + 2025 holdout; over-streaks regress (form_signals.py) |
> Archetype game-environment "totals edge" was RETRACTED — it was this same total-level mean reversion in disguise
> (archetypes add nothing within total bands). Putting archetype/env features into the model does NOT help.

### 2e. TOTALS — fundamentals model spots · grade @ open
| Spot | Rule | Mechanism |
|---|---|---|
| T1 under: model+high-total/weakD | total_edge≤−3 & (open≥62 or both-weak-passD) & non-mix | model + structure |
| T1 over: low-total+fast (P5) | open≤48 & pace≥p66 & P5 | underpriced pace |
| T2 over: week 13 | rivalry/championship week | |
| T2 under: week 1 opener | openers play under | |
| T2 under: ranked-upset-last-wk / PT-rr-letdown / backup-QB(open≥50) | situational | |

### 2f. SIDES — fundamentals model spots · grade @ open
| Spot | Rule | Close hit |
|---|---|---|
| PREMIUM lay-fav home/away | |side_edge|≥8, P5, |open|<21, back the favorite | 68.6/62.5% |
| T2 high-edge dog home/away | |side_edge|≥8, P5, take the dog | 60/58% |
| T3 away: P5 edge −4to−8 | moderate away edge (public home bias) | |
| T3 fade home backup QB | home on backup QB → bet away | |

---

## 3. REVERSAL VETO
A late spread reversal (open→24h and 24h→close move in opposite directions, each ≥1 pt) that
**contradicts** the model drops the model to 40% (`combo_model_lines.py`). The harness sets
`rev_veto=1` and suppresses the STACK spots in that case. Reversal is a **danger flag, not a confirm**.

---

## 3b. LIQUIDITY (P5 vs G5) LINE MOVEMENT — `conf_movement.py`
Market popularity drives efficiency. P5 (both Power-5) = heavy two-sided action → moves are efficient
(can't follow OR fade, ~50%). G5 (both Group-5) = thin → moves **overshoot**.
- **FADE G5 spread move ≥1.0** (bet the side the line moved away from, grade @ close): **~53%**
  (n=1150 at ≥0.5, every season positive, 2023-25 = 54%). Mechanism: small/uninformed action pushes
  thin lines too far. **Not yet wired** (needs consensus sp_open/sp_close move added to line_signals).
- P5 late moves mildly predictive (~53%); G5 moves uninformative (~45% either window).
- Reversal-follow-late is liquidity-independent (~55% in both P5 & G5) — already a STACK input/veto.

## 4. NEGATIVE-RESULT ARCHIVE (tested & rejected — do not revisit without new data)
- **Moneyline**: market is well-calibrated; no edge. Earlier "huge ROI" were corrupted/stale ML data
  artifacts (−100000 placeholders, big-dog variance). `moneyline_value.py`, `phase2_ml_divergence.py`.
- **Totals line movement / juice / steam**: dead. `phase1d_totals_movement.py`, `phase1c_juice.py`.
- **Totals soft-book gap & key numbers**: dead/smooth. `book_disagreement_totals_ml.py`, `dk_keynumbers.py`.
- **Generic full line-move direction as model confirm**: no info (50.1 vs 47.9). `combo_model_lines.py`.
- **Public betting splits**: unavailable / un-backfillable — dropped.
- **Soft-book general lag (snipe everything early)**: rejected — soft chases sharp only 49% (coin flip);
  only gap≥1 is early-bettable. `book_lag_analysis.py`.
- Many conference×number cells: noise (efficient). Only the §2d survivors held up.
- **Spread↔ML internal divergence (the NFL "soft ML vs spread" theory)**: DOES NOT EXIST in CFB.
  `spread_ml_divergence.py`. At every book, open & close, |p_spread − p_ml|≥0.06 is ~0% of games. The
  favorite ML is a near-deterministic function of the spread (a −4.5 fav is ALWAYS −179..−208, never −140;
  the whole 5th-95th pct ML range at a fixed spread is ~30 cents = vig/rounding). CFB books derive the ML
  algorithmically from the spread — 60+ lightly-bet games/wk means no independent ML price discovery, unlike
  the NFL's deep ML market. Forced buckets predict nothing (dog cover 49.8%). Do not revisit for CFB.

---

## 5. DATA DEPENDENCIES & PRODUCTION NOTES
- Base models + situational + conference spots: need only `data/model_games.parquet` + `data/cfbd/*`.
- Market-microstructure spots (STACK, SB, KEY) + reversal veto: need the **odds archive**
  (`data/odds_history/odds_<year>.parquet`, via `fetch_odds_history.py`; also mirrored in Supabase
  `ncaaf_odds_history`). Computed by `line_signals.py`. **For 2026 production these require pulling
  current per-book odds** (William Hill + DraftKings + TwinSpires sharp; Bovada + MyBookie soft).
  If the archive is absent for a season, those columns are NaN and the spots simply don't fire.
- Secrets live in `.env.local` (gitignored) — CFBD + Odds API keys. **Never** put keys in `.env`
  (git-tracked). Keys were pasted in chat earlier → rotate when convenient.
- 2020 is absent everywhere (COVID); per-season strings skip it.

---

## 6. STILL TODO
- Supabase write-path (predictions → website) + weekly orchestration runner + persistent CLV ledger.
- Optional: market-anchored totals variant; QB backfill pre-2021; rivalry table FIU fix.

---
## 7. MODEL UPGRADE (2026-06): A2 CROSS-TEAM NETS — CONFIRMED & LOCKED
Sweep (exp_a1_a2/a3_a4.py, identical walk-forward folds, product-style grade @ open, Wilson CIs):
| Variant (sides, gate>=4) | n | hit% | ROI | CLV | per-season |
|---|---|---|---|---|---|
| BASE (old locked) | 1703 | 53.2 [50.8,55.6] | +1.6 | +0.42 | 51/53/60/54/49 |
| **BASE+nets (NEW LOCKED)** | 1648 | **54.7** [52.3,57.1] | +4.4 | +0.44 | 56/53/59/54/51 |
nets = 12 cross-team features, SUM semantics (hexp = home_off_X + away_def_allowed_X; net = hexp − aexp).
PRE-REGISTERED CONFIRMATION (exp_confirm_a2.py, 5-seed): beats BASE at ALL gates 3/4/5; 2025 holdout 50.8 vs 48.8;
CLV intact → **UPGRADE CONFIRMED**. Sides model now FEATS+nets; TOTALS stays BASE (+0.2pp only, not adopted).
Ledgers regenerated from scratch (out/ backed up to out_backup_pre_nets_upgrade/). Dry-run reproduces.
NEGATIVES from sweep: A1 spot-flags-in-model (fire 1.4-3.9%, +0.6pp within CI = noise; overlay architecture
stands). A3 architectures: 5-seed ensemble identical; ridge 50.9% (worse); blend +1.2pp but fewer picks &
unconfirmed — GBM stands. A4 calibration: sides edge-buckets weakly monotonic 48→57 with flat 6-14 zone (no
fantasy tail like NFL, but confidence alone cannot gate big plays); totals cleanly monotonic 48→54.

## 8. MAMMOTH TIER (pre-registered, exp_b_mammoth.py) — SIDES VALIDATED, TOTALS FAILED
**SIDES MAMMOTH** (def in script docstring BEFORE results): |side_edge_open|>=8 AND confirm-classifier
(close-cover HistGB, independent layer) agrees AND >=1 non-model spot (RvR/SunBelt/BigTen/padded-road) same dir.
Dose-response (textbook): control (no confirm, no spot) 50.0% → confirm-only 54.5% → **MAMMOTH 70.0% (n=30,
CI[52,83], CLV+0.62, per-season 57/71/86/62/100)** ≈ 6/season. Mirrors NFL (ingredients 49-54 alone, ~70 together).
Wired: `mammoth` column in cfb_predictions CSV (2025 dry-run: 7 flagged). Small-n stated: 2026 live = true test.
**TOTALS MAMMOTH: NOT REAL** — big-edge+struct 53.7% vs control-without-struct 54.5% (control better), >=2-struct
28.6%(n7); no monotonic dose-response → per pre-registration, rejected. **MULTI-RULE MAMMOTH: n=0** (non-model
spots never co-fire 2+ same direction in CFB) — not feasible with current spot set.

## 9. GRADER BUG FOUND & FIXED (predicted by the NFL warning)
GameDay merges on (season, team-pair) DOUBLE-MATCHED same-season rematches (e.g. 2024 Georgia-Texas wk8 + SEC CG).
Fixed via show-date proximity dedup (±3 days) + (season,home,away,actual_margin) join for movement. Post-fix:
matched 111 (was 115, 4 dups), movement n=88 (was 94). Findings SURVIVE slightly tempered: GameDay fade-move
54.8% (was 55.9), GameDay under 61.2% (was 65.5), line-toward-away fade-to-home unchanged (away covers 38.9%).

---
## 10. THE VAULT (final state, 2026-06) — what's LIVE vs DISCARDED

### LIVE — models
| Piece | Status |
|---|---|
| SIDES model = GBM on FEATS + 12 cross-team nets | LOCKED (upgraded §7; 54.7% @gate4 vs open, +CLV) |
| TOTALS model = GBM on FEATS (unanchored) | LOCKED (over-edge>=6 -> 55%, calibrated monotonic) |
| TEAM-TOTAL models = anchored (UNDER<=-3) + unanchored (OVER>=+6) | LOCKED (54-56%, mutually exclusive) |
| Confirm-classifier (close-cover) | LOCKED (mammoth ingredient) |
| MAMMOTH tier (sides) | LOCKED (70% backtest, 5-2 2025 dry-run, ~6-7/season, auto-flagged) |

### LIVE — spots (all in cfb_forecast.py; tiers in STRATEGY.md)
T1: model x soft-book STACK (gap>=1 72.7%) · padded-road fade w/ market-trust (62-74%) · G5 fade-after-loss
settled-line (65%) · soft-book gap>=1 (64%) — T2: soft-book gap .5-1 · RvR home-fav (60%) · FORM over-hot
fade UNDER (58%) · team-total UNDER · lay -6.5 · AAC over · SunBelt 59-66 under · PREMIUM lay-fav — T3:
model over-edge>=6 (+G5 cut) · fade-high>=60 UNDER · fade-low<=50 OVER · team-total OVER · dog +2.5/3/3.5 ·
SunBelt fade-home-fav · BigTen away-fav · RvR home-dog · T2/T3 model spots. VETOES: reversal-contra,
model-vs-softbook disagreement, don't-fade-moving-line.

### TRACK-LIVE (real lead, small n — bet small or paper-track)
GameDay fade-the-move (54.8%) + GameDay under (61.2%) · GameDay-morning fade (57%, n28) · rivalry big-dog
+14-21: home-dog fade (7/9 seasons), away-dog back (63.5%), under (60.4%) · wk1 ranked-10-25 (55%, home 58%
wk1-3) · G5 fade line move (53%, not yet wired) · 2-expl+leaky-D over (track) · WH-vs-soft 24h-early entry.

### DISCARDED (do not revisit — full evidence in README negatives)
Spread<->ML divergence (all 22 books) · pace/possession adaptation & identity-matchup ATS (real football,
priced) · imposer/adapter classification (unreliable trait) · archetype-env totals (mean-reversion confound)
· SEC total 52+ under (confound) · explosiveness sharpener (failed holdout) · team/coach ATS records at any
threshold (pure noise, 3 proofs) · series/revenge/avenge history (priced/absent) · bounce-back & post-big-game
narratives (P5) · shootout recipe 2expl+2uptempo (noise on 2x sample) · totals MAMMOTH + multi-rule mammoth
(no dose-response / n=0) · spot-flags-in-model · ridge/blend architectures · ranked-away vs unranked-home
(coin flip) · unranked-home-fav vs ranked-away · contrived team totals w/o model · public-splits (no data).

## 11. TT/1H REFINED SPOTS WIRED (test_deriv2 -> cfb_forecast)
TT graded/gated vs POSTED BEST line when event-odds archive exists (fallback contrived). OVER = P5 ONLY (G5 dead
51.3%); UNDER both (P5 59.9/G5 56.6); form_stack col = OVER + team over-cold (61.2%). 1H spot: posted 1H total
>=31 & both-P5 -> UNDER (63.4%; G5 dead). Outputs: cfb_team_totals_<yr>.csv, cfb_h1_<yr>.csv. 2025 dry-run:
UNDER 58.6% (P5 62) / OVER-P5 73.2% / 15 1H unders. Movement in TT/1H = dead (all windows, follow+fade).
PRODUCTION NOTE: TT/1H spots need current-season event-odds pulls (fetch_event_odds.py weekly in 2026).

---
## 12. ★ PRODUCTION LOCK (2026-06-13) — THIS IS THE MODEL ★
The CFB system is FROZEN. All further work is trend-mining only (new spots layer in; the models/architecture
do not change without a pre-registered confirmation run).

FROZEN COMPONENTS:
- SIDES = HistGBM on FEATS + 12 cross-team nets (54.7% @gate4 vs open, +CLV). Cap conviction at |edge|<=14
  (>14 = model-missing-info, no play — accuracy collapses to 47-51%).
- TOTALS = HistGBM on FEATS (unanchored). Monotonic edge->accuracy (48->54%).
- TEAM TOTALS = anchored(UNDER<=-3)/unanchored(OVER>=+6), graded @ best posted line; OVER P5-only; form_stack.
- 1H = NOSTR spread (strength-stripped+nets, 53.7%) + pruned-15 tempo total (55.8U/54.8O) + >=31-both-P5 under
  (63%) + 1H-ML dog-conversion off NOSTR margin (+24% best-price).
- MAMMOTH = |edge|>=8 & confirm-classifier agrees & >=1 spot (70% multi-yr; 5-2 2025).
- SPOT LIBRARY + VETOES as in sections 2-9. MONEYLINE = spot-conversion only (RvR home-dog +15.4%).

STAKING (backtest_portfolio_2025.py): stake by validated hit% -> mammoth 5u / >=62% 3u / 58-62% 2u /
55-58% 1.5u / 53-55% 1u / lean .5u. 2025 DRY-RUN (walk-forward, no leak): 2157 bets, 56.1% win, +10.2% ROI,
+341u. Conviction ladder MONOTONIC: 3u tier 67.2%/+28%, mammoth 57%, leans ~breakeven. CAVEAT: 2025 strong
spot year (sides 59 vs ~56-57 multi-yr); typical season ~+6-8% portfolio ROI.

PRODUCTION DEPS: weekly CFBD pull (sides/totals/spots/mammoth) + weekly event-odds pull fetch_event_odds.py
(TT/1H need posted lines). 2026 hourly feed = sharper closes, selectors already tag-agnostic.
DISPLAY: see product spec discussion — predicted score every game, tier-colored conviction, book routing, honest
historical hit% per signal, |edge|>14 uncertainty flag.
