# NFL Models — LOCKED for 2026 forward-tracking

Locked 2026-05-28, refined 2026-05-30 (b60 sides audit). **Rule: no more tuning on 2024-25.**
These configs are frozen; the only valid next test is live 2026 forward results. Everything below was
selected on walk-forward training and graded on a 2024-25 held-out set vs the **OPENING** line
(what a website actually posts) + CLV.

## Product framing (don't lose sight of this)
These are **per-game prediction products** for the WagerProof website, NOT standalone betting strategies.

**Architecture:**
1. **Model** = per-game prediction for every NFL game (totals and sides). A 53-58% baseline accuracy
   with +CLV IS the product — every game on the slate gets a reliable prediction.
2. **Spots** (§3) = trend signals (wind UNDER, key-WR-out OVER, bye-collision, etc.). Layered on top.
3. **Bet flag** = fires when model direction + spot direction ALIGN. That's the high-conviction play.

Do not evaluate the models purely as "+EV betting strategies." The model is the foundation
(every-game prediction); spots + alignment are the bet layer.

---

## 1. SIDES model (per-game ATS prediction) — `b14_iter2.py` / `forecast_harness.py` BASE

Predict `home_cover` walk-forward (HistGradientBoostingClassifier) — outputs `ph` (probability
home covers) for EVERY game. Confidence threshold |p-0.5| >= .03 picks a side for display +
the bet ledger; the prediction itself is shown on every game card on the website regardless.

### Features
**Core PR (6):** pr_diff, home/away predictive_pr, last5_diff, home/away consistency
**Proven flags (9):** home_dog_7_10, away_dog_7_10, div/conf/league, primetime, week, home_fav, abs_spread
**Defense (3):** dprod_team_diff, h_dpt, a_dpt (currently in forecast_harness; LOCKED_MODELS earlier
recommended dropping — needs reconciliation)
**Injury (1):** air_diff (h_air - a_air for Out/Doubtful WR/TE/RB air-share)
**Referee (4):** ref_total_pts_avg, ref_home_cover_pct, ref_under_pct, ref_fav_cover_pct
**Schedule spots (10):** h/a pre_bye, blowout_win_last, blowout_loss_last, third_road, div_revenge

### Held-out 2024-25 vs OPENER (b60 injury-ablation audit, 2026-05-30)
Same framework as b57 totals audit: stripped air_diff to test honest baseline.

| Variant | Hit % | ROI | CLV | 2024 | 2025 |
|---|---|---|---|---|---|
| **STRICT (honest, no air_diff)** | **53.5%** | **+2.1%** | **+0.23** | 55.5% | 51.5% |
| PREOP (air_diff from pre-opener injuries only) | 53.5% | +2.1% | +0.23 | — same as STRICT (5.4% of injuries are pre-opener) |
| FULL (current forecast_harness, air_diff from all reports) | 55.0% | +5.1% | +0.26 | 57.5% | 52.7% |

Same dynamic as totals: pre-opener injury filter is functionally null (only 7 team-weeks had
pre-opener Out designations vs 191 with full reports). The ~1.5pp lift from `air_diff` is mostly
late-week injury news we won't have at opener time live.

### Realistic 2026 expectation (per-game prediction product)
- **Hit rate ~53-55% on full slate of confident picks** (|p-0.5| >= .03)
- **+CLV ~0.23 pts** — line moves toward picks (real model signal)
- **2024 was the strong year (55.5%), 2025 was weak (51.5%)** — variance is real

**This is the prediction product floor.** The bet flag fires when a side prediction aligns with a
schedule/situational spot (§3) — that's where high-confidence picks come from.

### Legacy EPA model layered rules (in forecast_harness.py)
Two rules use the company's `nfl_predictions_epa` legacy model:
- `legacy_primetime`: in primetime, FOLLOW the legacy model (~62% in 2025)
- `legacy_fade`: at non-primetime extremes (legacy prob ≥.80 or ≤.20), FADE the legacy model

These fire independently from the b14 sides model; both can be flagged on the same game.

### Open work items
- **Doc-vs-code drift**: LOCKED_MODELS.md earlier said dprod_team_diff was dropped but forecast_harness
  still includes it. Decide and align (likely keep — small contribution, +CLV still positive either way).
- **Sides flags negative-result archive**: New sides flags (rest, short-week, big-fav, div-late, off-bye)
  FAILED the permutation null (b30: real 3 ≤ null 4) — ATS trend well is tapped; do not add more.
  `div_late` (57.6%, 53/60/59) = WATCH only.

### Regression confirmation layer (b70, vaulted 2026-06-01) — INTERNAL CONFIDENCE ONLY
Trained alongside the classification model in `train_predict()`. Same 33 BASE features, same walk-forward
fold; target is `actual_margin` (HistGradientBoostingRegressor). NOT a separate bet flag — used as a
confluence indicator on the sides_model row.

| Setup | n (2024+25) | Hit % | ROI | CLV |
|---|---|---|---|---|
| Classification only (\|p-.5\|≥.03) | 368 | 56.5% | +7.9% | +0.31 |
| Regression only (\|edge\|≥1.5) | 319 | 55.8% | +6.5% | +0.98 |
| **Confluence (both agree)** | **191** | **58.6%** | **+11.9%** | — |
| 2024 confluence | 94 | 63.8% | +21.9% | — |
| 2025 confluence | 97 | 53.6% | +2.3% | — |
| 2025 dry-run confluence (live harness) | 120 | 54.2% | +3.4% | +0.90 |
| 2025 dry-run non-confluence (clf alone) | 122 | 50.0% | -4.5% | -1.10 |

**Key finding**: regression at the CLOSE line drops to 51.6% / -1.5% ROI — it's heavily CLV-dependent.
That's why it's a CONFIRMATION LAYER, not a standalone bet. Classification is the more robust standalone
model; regression separates the high-conviction subset.

**Leakage compliance**: regression uses the EXACT same BASE features as classification — no additional
betting line columns, no outcome features, walk-forward only, push handled identically. Inherits the same
~1.5pp `air_diff` partial-injury-leak documented in b60 (no new leak introduced).

**Frontend treatment**: the `confluence` field in the ledger is the "high conviction" badge. We do NOT
expose `reg_edge` or `pred_margin` to users — internal confidence only. See b70_margin_regression_confluence.py.

## 2. TOTALS model (per-game O/U prediction) — **CONSENSUS ENSEMBLE** — `consensus_totals.py`

**LOCKED 2026-05-29 (FINAL after b57+b58+b59 audits).** Replaces b15 standalone.
**Production default = strict-open (no injury features). Produces a prediction for EVERY game.**

### Primary output: `predictions_totals_<season>.csv` (website display)
Every game gets a row with `display_total` (the predicted total) + direction + tier. This is the
core product — the website renders these on every game card. The bet ledger is a *subset* of these
predictions, not the only output.

### Tier system (display + bet flag)
| Tier | Definition | Action |
|---|---|---|
| **HC** | both agree + 3 ≤ min\|edge\| ≤ 7 | **BET FLAG** (bet_quality=1) |
| EXTREME | both agree + min\|edge\| > 7 | display "extreme lean", **do not bet** (~50% historical) |
| LEAN | both agree + min\|edge\| 2-3 | display only |
| WEAK | both agree + min\|edge\| < 2 | display only |
| LEAN_EARLY | W1-3 (b55 only) + \|edge\|≥2 | display only |
| NONE | no signal / models disagree | display total only, no direction |

### The HC bet flag
Fires when:
1. **Both models agree on direction** (over/under vs opener), AND
2. **min |edge| BETWEEN 3 and 7 pts** (the b58 sweet spot — below 3 = no signal, above 7 = model overconfidence)

| Component | Architecture | Features |
|---|---|---|
| b15 (`b15_totals.py`) | direct totals (HistGBM) | 17 env+weather (injury cols stripped) |
| b55 (`b55_scheme_priors_pruned.py`) | team-points → derived total | top-100 b54 importance (injury cols stripped) + 8 b50 scheme priors |
| **ENSEMBLE** | agree on direction + 3 ≤ min\|edge\| ≤ 7 | bet at OPENER |

### ⚠️ Why no injury features (b57 + user constraint)
NFL injury reports finalize Friday; the opener was set Sunday-Monday. By the time injury news hits,
the market has already moved the total. We can never realistically capture this in live betting, so
injury features are stripped from the locked model. This makes the backtest honest.

### ⚠️ Why the 7pt upper cap (b58_edge_magnitude.py)
b58 bucketed picks by edge magnitude in strict-open mode (the only production-honest mode):

| Edge bucket (strict-open, both agree) | n | hit% | ROI |
|---|---|---|---|
| 0-1 pts | 7 | 42.9% | -18% |
| 1-2 pts | 31 | 45.2% | -14% |
| 2-3 pts | 47 | 48.9% | -7% |
| **3-4 pts** | **62** | **59.7%** | **+14%** |
| **4-5 pts** | **44** | **56.8%** | **+9%** |
| **5-7 pts** | **66** | **56.1%** | **+7%** |
| **7+ pts** | **44** | **50.0%** | **-5%** |

Extreme edges (>7 pts) usually reflect model overconfidence from outlier features, not real
mispricing. The 3-7 sweet spot gives the cleanest signal.

### Production performance (2024+2025, strict-open + 3-7 sweet spot, both agree)
- **n ≈ 172 over 2 seasons (~85/yr)**
- **hit rate ≈ 57-58%**
- **ROI ≈ +8-10% at -110**
- **+CLV (0.5+ pts) — line moves toward picks despite no injury info**

2025-only dry-run reproduction: **59.2% / +13.0% ROI / +0.34 CLV on n=49 picks**.

### Tier system (for the website display layer)
| Tier | Definition | Action |
|---|---|---|
| **HC** | both agree + 3 ≤ min\|edge\| ≤ 7 | **THE BET** (bet_quality=1) |
| EXTREME | both agree + min\|edge\| > 7 | display as "EXTREME LEAN", **do not bet** (~50% historical) |
| LEAN | both agree + min\|edge\| 2-3 | display only (marginal) |
| WEAK | both agree + min\|edge\| < 2 | display only |
| LEAN_EARLY | W1-3 (b55 only, b15 in warmup) + \|edge\|≥2 | display only |
| NONE | no signal / models disagree | display total only, no direction |

### Critical config (DO NOT change without re-validating)
- `TOP_N = 100` features from `data/b54_feature_importance.csv` (FROZEN snapshot, do not re-rank)
- `MIN_EDGE_BET = 3.0`, **`MAX_EDGE_BET = 7.0`** (the sweet spot cap)
- `MIN_EDGE_LEAN = 2.0` (display tier, not a bet)
- b15 hyperparams: depth=3, lr=0.05, n_iter=350, l2=2.0, min_leaf=40
- b55 hyperparams: depth=4, lr=0.05, n_iter=500, l2=1.0, min_leaf=40
- Walk-forward: train seasons<target, scheme priors from target-2..target-1
- Injury features stripped (default mode):
  - b15: `key_recv_out`, `h_max_air_out`, `a_max_air_out`
  - b55: `off/def_backup_qb`, `off/def_injury_severity`, `off/def_starters_out`, `off/def_qb_out_or_doubtful`

### Usage (production)
```bash
# Live weekly (strict-open is DEFAULT, no flag needed):
python3 consensus_totals.py --season 2026 --week 4
python3 consensus_totals.py --grade 2026         # after games complete
python3 consensus_totals.py --report 2026

# Validation:
python3 consensus_totals.py --dry-run 2025                  # production mode

# Research/backtest only (NOT live-usable):
python3 consensus_totals.py --dry-run 2025 --include-injuries
```

### Data dependencies (refresh through 2026 season)
| File | Refresh cadence | Source |
|---|---|---|
| `data/matchup.parquet` | weekly | main pipeline |
| `data/scheme_plays.parquet` | weekly | `b46_pull_scheme.py` (nflverse PBP + participation) |
| `data/odds_consensus.parquet` | weekly | main pipeline (opener + close) |
| `data/players_xwalk.parquet` | occasional | main pipeline |
| `data/b54_feature_importance.csv` | **FROZEN — do not re-rank** | `b54_team_points.py` snapshot |

Note: `injuries_raw.parquet` and `ngs_receiving.parquet` are still used by `forecast_harness.py`
spot rules (key-WR-out OVER, wind UNDER) but NOT by `consensus_totals.py`.

### Operating constraints
- **Weeks 1-3**: no bets (b15 needs s2d warmup). Website still gets `display_total` from b55 alone.
- **Week 4+**: full ensemble fires, ~5-7 HC bets per week average.
- **Bet timing**: at the OPENER (Sun-Mon). Don't wait for injury news — the strict-open model
  doesn't use it anyway, and waiting just shifts you to a worse line.
- **Track CLV**: sustained positive CLV is the live-confirmation signal that the model is
  identifying real value (line moves toward our picks).

### Honest limits
- ~85 bets/season is moderate volume; one bad month is normal variance.
- 2024 was weaker than 2025; pooled number is balanced but expect month-to-month swings.
- Structural model can't beat the closing line (b57 Scenario D: 49%) — our edge is opener-level
  mispricings the market hasn't fully sorted out yet.

### Research backstory (b50→b58)
- b50: pressure-conditioned coverage → stable player priors (QB-vs-man corr 0.33, WR-zone-NP corr 0.39)
- b51-53: those priors did NOT produce single-game prop edge OR sides edge (priced)
- b54: leak-filtered team-points model with 333 features → MAE 7.56 (parity with market)
- b55: PRUNED to top-100 + added 8 b50 scheme priors → derived totals showed lift vs opener
- b56: ensembled with locked b15 → agreement filter showed +12-13% ROI (turned out to be leaky)
- b57: honesty test → stripped injury features. Confirmed real but smaller edge.
- **b58: edge-magnitude bucketing → discovered the 3-7 sweet spot. Edges >7 collapse to ~50%.
  Production rule now caps at the sweet spot, lifting hit rate to ~59%.**

---

## 3. SPOT SIGNALS — full library (organized by TIER, finalized 2026-05-31)

Two tiers:
- **TIER 1 = BET FLAGS** — structural at bet time, no CLV inflation, can be acted on directly
- **TIER 2 = CONFLUENCE OVERLAYS** — line-movement signals; CLV-inflated when graded vs opener, real
  edge drops to ~52-54% at the moved line. Useful for website confidence badges, NOT standalone bets.

---

### TIER 1 — STRUCTURAL BET FLAGS (real edge at bet time)

All signals below use information visible at the moment you bet (opener). Tested honestly with no
time-travel assumptions. Each fires automatically in `forecast_harness.py` (or `consensus_totals.py`).

#### Environmental + injury (the proven older spots — `b15_totals.py`, `b18_madden_over.py`)
| Spot | Trigger | Hit % | Volume |
|---|---|---|---|
| `wind_under` | wind ≥15 mph forecast | **60.5%** (n=43) | ~14/yr |
| `receiver_over` | WR/TE/RB with NGS air-share ≥35% listed Out/Doubtful → OVER | **62.2%** (n=74) | ~24/yr |
| `receiver_over_HC` | Same + Madden OVR ≥80 | **66.9% close / 63.6% open** (n=17/yr) | ~17/yr |
| `cold` (UNDER, tracking) | temp ≤32°F | 52.5% (n=40) | breakeven, watch |
| `dome` (OVER, tracking) | dome game | 54.5% (n=156) | marginal |

#### Legacy EPA model spots (`forecast_harness.py`, from `nfl_predictions_epa` table)
| Spot | Trigger | Hit % | Volume |
|---|---|---|---|
| `legacy_primetime` | Primetime game → FOLLOW legacy EPA model direction | **61.8%** in 2025 | ~16/yr |
| `legacy_fade` | Non-primetime + legacy prob ≥.80 or ≤.20 → FADE | **65%** in 2025 | ~12/yr |

#### Trap-fade spots (b61 + b62, mean reversion in totals + spreads)
Rolling per-team miss vs implied. FADE (not follow) the trap is the real edge.
| Spot | Trigger | Hit % | Volume |
|---|---|---|---|
| `total_low_line_over` | sum_last3 ≤ -8 AND line ≥ +2 vs league avg → OVER | **68.0%** (n=25 over 8 yrs) | ~5-10/yr |
| `total_high_line_under` | sum_last3 ≥ 4 AND line ≤ -2 vs league avg → UNDER | **55.3%** (n=208) | ~25-30/yr |
| `spread_dog_cover_fade_away` | home dog covering vs away fav not covering | **70%** (n=10, small) | ~3-5/yr |
| `spread_dog_cover_fade_home` | reverse, away dog vs home fav | 63.6% (n=11, small) | ~3-5/yr |

Per-season note: fade-OVER-trap was 60-70% in 2018-2022, decayed to ~50% in 2023-25 (edge adaptation).
Extreme UNDER reversion held up better. **Track 2026 CLV closely.**

#### DK structural spots (b63, vaulted 2026-05-30, REAL edges from line structure)
These exploit relationships between spread, ML, and juice that are visible at any line snapshot.
| Spot | Trigger | Hit % | Volume |
|---|---|---|---|
| `dk_giant_fav_over` | DK: spread ≥7 AND ML implied ≥5pp softer than spread implies → OVER | **65.0%** in 2025, **70-75%** 2023-24 | ~25-30/yr |
| `dk_heavy_home_juice` | DK: spread_home_price ≤-120 → bet HOME spread | **61.3%** in 2025 (~62% across 3 yrs) | ~30-40/yr |

DK Spot 1 explained: Soft ML on a giant favorite signals high-variance game with scoring DNA
(blowouts + garbage time = OVER). Bet OVER on the total.
DK Spot 2 explained: Book steering action AWAY from home (juicing the home side) is contrarian —
home actually covers ~62%. Reverse-line-movement style signal.

#### Tight-game contrarian + structural (b65/b66/b67)

**ACTIVE BET FLAGS (per-season consistent, recommended picks):**
| Spot | Trigger | Hit % | Per-season | Volume |
|---|---|---|---|---|
| `fade_pr_in_tight_game` | 1.5 line + \|pr_diff\| ≥3 → bet AGAINST the better-PR team | ~64% (fade) n=85 | (n too small per yr) | ~30/yr |
| ⭐ `tight_soft_ml_fade_home` | \|open_spread\| ≤3 + home no-vig ML ≥4pp softer than spread implies → bet AWAY | **62% pooled** n=42 | **60% / 64% / 63%** all 3 yrs ✅ | ~15/yr |
| ⭐ `top_vs_top_pt_home` | PT + tight + both top-tier PR → bet HOME | **65%** pooled n=23 | 56% / 67% / **75%** ✅ improving | ~7/yr |

**TRACKING ONLY (demoted from active flags due to 2025 regression — kept firing for 2026 validation):**
| Spot | 2023 | 2024 | 2025 | Pattern |
|---|---|---|---|---|
| `primetime_tight_favorite` | 62.5% | 74.1% | **46.2%** | sharp 2025 regression |
| `primetime_tight_under` | **80.0%** | 51.7% | **42.9%** | monotonic decay 80→52→43 (looks like market adaptation) |
| `bot_vs_bot_under` | 64.0% | 64.7% | **40.9%** | cliff in 2025 |

The 3 tracking spots had strong 2023-24 numbers but cliffed in 2025. Two possibilities:
1. Variance (n=20-30/yr per spot — one bad season can swing big)
2. Market adaptation (especially `primetime_tight_under` 80→52→43 looks like decay)
**Will re-evaluate after 2026.** If they revert → promote back to active. If they continue weak → remove.

In tight 1.5-spread games, the better-PR team systematically loses ATS. The line is tight FOR A
REASON. **FADE your power-rating intuition in pickem/1.5 games.**

The `tight_soft_ml_fade_home` exploits opening-line mispricings: when the book opens with a softer
ML than its own spread implies, that's the book's own pricing inconsistency. Bet AWAY immediately
at OPEN — don't wait for movement (alpha decays during the week; per-season comparison shows OPEN
betting beats CLOSE betting by 3-10pp across all 3 seasons).

#### Conflict resolution: `tight_soft_ml_fade_home` vs `fade_pr_in_tight_game` (b67)
When both signals fire on the same game and pick DIFFERENT sides (8 historical collisions, 7 of
which clashed), the soft_ml pick wins **6/7 = 85.7%**. Mechanism: the book's own ML pricing
inconsistency is a stronger tell than our PR-vs-spread disagreement.

**Resolution coded in forecast_harness.py**: when soft_ml fires AND fade_pr would pick HOME (the
clash scenario), the fade_pr pick is SKIPPED. Soft_ml takes precedence.

#### Bye / situational (tracking-only, unproven but logical)
| Spot | Trigger | Status |
|---|---|---|
| `bye_collision` | Coach pre/post-bye ATS gap ≥15pts → bet better coach | tracking, unproven |
| `week1_def_under` | W1 defense out-classes offense → UNDER | thin, tracking |

---

### TIER 2 — CONFLUENCE OVERLAYS (line movement, display-only confidence badges)

These signals show 60-77% hit rates **vs the OPENER** but drop to ~52-54% **at the moved/closing line**
where you'd actually have to bet. Use as **website confidence badges**, NOT standalone bet flags.

#### Discovered in b64/b65 (full sharp-money exploration)
| Signal | What it tells the user | Honest edge at moved line |
|---|---|---|
| `spread_moved_2pts_plus` | "🔥 Sharp action on Team X" | ~52-54% / +2-3% ROI |
| `total_moved_2pts_plus` | "🔥 Sharp money pushed total UP/DOWN" | ~52-54% / +2-3% ROI |
| `early_total_move_1.5_plus` | "🔥 Early-week sharp move on total" | **53.8% / +2.8% ROI** (real but small) |
| `total_confluence` (early ≥1 + late ≥0.5 same direction) | "⭐ Strong sharp confluence" | Likely 55-57% (best in tier, small sample) |
| `key_3_crossed_toward_fav` | "Line crossed key number 3" | ~52-54% |
| `tight_game_anti_pr_market_move` | "1.5 game: market disagrees with PR" | ~52-55% at close (was 73% vs opener, n=22) |

#### How to display them on the website
When a TIER 1 spot fires AND a TIER 2 badge confirms the same direction, render as
**high-confidence pick** (e.g., "🔥🔥 STRONG OVER 47.5 — model + 3 confirming signals"). This is the
*alignment* product: spot + line confirmation + model agreement = best plays of the week.

---

### Negative result archive (DO NOT add to harness)
| Tested | Result |
|---|---|
| FOLLOW the trap (instead of fade) | -10 to -15% ROI across all thresholds — busted |
| Rolling miss as MODEL FEATURES | No lift on totals, HURTS sides (-11% ROI) |
| ML divergence as standalone bet | Too few qualifying games (n=1-4) |
| DK juice MOVEMENT (vs juice LEVEL) | 47-52%, no edge |
| 1.5 line + better PR → bet PR | Lose money (42-37%), confirming FADE-PR is right |
| Original ML "soft ML on small fav" theory (-3.5 with -140) | Modest at best (~67% win vs 60% implied, marginal +4% ROI) |
| New sides flags (rest/short-week/big-fav/div-late/off-bye) | FAIL permutation null (b30); ATS trend well is tapped |

---

## 4. TEASER product (2-team 6-pt) — vaulted 2026-06-01

A standalone weekly product layered on the existing pick ledger. **NOT a rebuild of Wong-style
structural buckets** — those tested at ~70% per leg OOS which fails the -120 breakeven (b71/b72).
Instead, we tease the legs that our own LOCKED signals already pick at 60-75% straight up — teasing
6 points lifts them to 75-89% per leg, which clears the bar.

### Eligible rules (teased hit% ≥ 78%, b73 validation)
| Rule | Market | Straight % | Teased % | Lift |
|---|---|---|---|---|
| `receiver_over_HC` | TOT | 65.2% | **89.1%** | +23.9pp |
| `legacy_fade` | SPR | 68.2% | **85.7%** | +17.5pp |
| `top_vs_top_pt_home` | SPR | 71.4% | **85.7%** | +14.3pp |
| `fade_pr_in_tight_game` | SPR | 56.5% | **78.3%** | +21.7pp |
| `sides_model` (confluence=1 only) | SPR | 57.0% | 77.7% | +20.7pp |

### Sharpness overlay (b74 — the unlock)
For each candidate leg, attach matchup Vegas-sharpness: mean of both teams' historical |line - actual|
error from prior 2 seasons (walk-forward, no leak). **Filter: drop legs where matchup_sharp > league
50th percentile.** Both teams must be in the "sharper" half. This:
- boosts top-2 ROI from +19% → +37%
- rescues spread+spread combos from -15% ROI to +24%
- collapses per-season variance: 2024 +34.8% / 2025 +32.0%

### Cross-market ranking (b73b)
**Spread+spread teasers LOSE money. Total+total wins. Mixed (spread+total) wins.**
The ranker prioritizes totals first (by edge magnitude), then spreads. Pair top-2 distinct games.

### Honest performance — what the HARNESS actually produced (the only number to trust)

| Season | Graded teasers | Joint hit | ROI @ -120 | ROI @ -110 |
|---|---|---|---|---|
| 2024 dry-run | 19 | **52.6%** | **-3.5%** | +0.5% |
| 2025 dry-run | 18 | **66.7%** | **+22.2%** | +27.3% |
| **Pooled** | **37** | **~59.5%** | **~+9%** | **~+14%** |

**Realistic forward expectation: +5 to +20% ROI pooled, with substantial per-season variance.**
Some years will be ~break-even, some will be +20-30%. NOT the +30% headline that earlier
backtests (b73/b74) suggested — those numbers had selection bias and used top-3-all-combos
rather than the operational top-2-distinct.

### Why earlier backtest numbers (b73/b74) were inflated — documented mistakes
1. **b73's "89.1% teased" for receiver_over_HC** was a 2024+2025 pooled number. 2024 alone was
   12/22 = 54.5% straight (~75% teased). 2025 alone much stronger. Pooling hid the variance.
2. **b74's "+34.8% ROI on 2024" used top-3-all-combos** (3 synthetic pairs/week from a 3-pick
   pool). Harness is top-2-distinct (1 teaser/week). Different products; I presented the
   favorable one.
3. **Selection bias re-introduced**: the eligibility list (TEASER_RULES) was chosen by looking
   at 2024+2025 data, then tested on 2024+2025. Same peek I called out in b72 and let happen
   again. The honest test is whether 2024-OOS-only or 2026 live confirms.
4. **Data limitation in 2024**: nfl_predictions_epa.parquet only has 2025 data, so legacy_fade
   never fires in 2024. That forced sides_model into 18/20 leg2 slots — sides_model is the
   weakest eligible rule (77.7% teased) and shouldn't dominate. In 2026 with current legacy
   data flowing, the mix will look more like 2025.

### What we'll actually learn in 2026
The 2024 vs 2025 gap could be:
- Real per-season variance (most likely)
- Data limitation (legacy_fade missing in 2024)
- Receiver_over_HC having a down 2024
- Some combination
Run live in 2026 with no further tuning. After 8-10 weeks we'll have the honest signal.

### Pricing reference
| Book | 2-team 6pt price | Per-leg breakeven | Joint breakeven |
|---|---|---|---|
| DraftKings / FanDuel | -120 | 73.85% | 54.5% |
| BetMGM / Caesars / Pinnacle | -110 | 72.4% | 52.4% |
| Bad retail | -130 | 75.16% | 56.5% |

### Operational cadence (per teaser-product rules)
- **Mon (opener)**: lock `top_vs_top_pt_home`, `legacy_fade`, `fade_pr_in_tight_game` legs
- **Wed**: refresh `sides_model` w/ refs loaded — confluence flag becomes reliable
- **Fri**: lock `receiver_over_HC` legs (needs final injury report)
- **Sat AM**: assemble 2-team teaser from top-ranked legs (totals first; both teams must pass sharpness filter)

### Implementation
`forecast_harness.py`:
- `load_team_sharpness(target, lookback=2)` — walk-forward team Vegas-error from `matchup_arch.parquet`
- `generate_teasers(target, week=None)` — produces `out/teaser_ledger_<target>.csv`
- `grade_teasers(m, target)` — both legs vs teased line; push handling (single-leg fallback at -110)
- `report_teasers(target)` — joint hit %, ROI @ -120 and -110, combo breakdown
- CLI: `python forecast_harness.py --teasers 2026`
- Auto-runs after `--dry-run`, `--grade`, `--report` flows

### What we tried and rejected
- **Structural Wong-spot buckets** (b71/b72): tested at 70% per leg OOS, fails -120 breakeven.
  Modern books have priced out the classic Wong edges. **DO NOT REVISIT.**
- **Margin-regression as standalone teaser leg generator**: poor calibration at tails.
  Reused as confirmation layer (sides_model confluence=1) instead.

## Forward-test harness (the consolidation step)
`forecast_harness.py` (+ `README_HARNESS.md`) freezes all of the above and produces a weekly pick ledger
with CLV tracking. Run `--dry-run 2025` to validate (reproduces: sides 52.1%, receiver_over 73-78%,
wind_under 62.1%, ALL 56.2% / +22.9u), then `--season 2026 --week N` weekly, `--grade`/`--report` after.
Madden-gap-safe (high-conviction OVER tier auto-disables until 2026 launch ratings load). 2026 live results
go in `out/forecast_ledger_2026.csv` — sustained +CLV over breakeven is the confirmation signal.

## Website product shape
- **Sides:** full-slate model picks (~53-55%, lean on the confident tier), tracked w/ CLV.
- **Totals:** spot alerts (key-receiver-out OVER, wind UNDER) — high conviction, low volume.
- **Open gap → Madden:** the injury-OVER edge only fires for *receivers we can value by air-share*.
  We cannot value OL/QB injuries or weeks 1-4. Madden OVR is the plan to extend it (see task #36).

## 4. Madden OVR verdict (b16_madden_parse.py, b17_madden_features.py)
Pulled launch ratings 2018-2025 (data/madden_ratings.parquet, 96-98% gsis match, 92% injury coverage).
Tested the two hypotheses; both mostly NULL but the nulls are informative:
- **QB downgrade (starter OVR - backup OVR) & OL-out OVR are PRICED BY THE CLOSE** — ATS fade 49.7%/49.5%
  (n=143/643, 8 yrs) and totals UNDER 50.7%/49.8%. The ~65%/55% seen vs the 2024-25 OPENER is an
  opener-timing/CLV effect (line moves open->close to price the injury), NOT a fundamental edge. The 82.6%
  away-QB-fade headline was a small-n home artifact (caught by pooling/per-season/vs-close checks).
- **Sharpened the receiver rule:** QB/OL injuries do NOT produce an OVER -> the totals blind spot is
  SPECIFICALLY star skill-receiver injuries (market over-lowers total), not generic injury.
- **Cold-start REJECTED:** Madden roster prior doesn't make wks 1-3 bettable (44-46%).
- **Model lift:** +0.6pp to the locked sides model (55.6->56.2%); Madden-only 51.7% (roster priced).
Madden is now a permanent injury-valuation asset (for CLV plays + the receiver-OVR rule), not a new edge.
