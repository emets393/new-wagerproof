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
**Matchup nets (21, added 2026-06-10):** see upgrade note below

### Matchup-nets upgrade (b89 + b90b confirmation, vaulted 2026-06-10)
First real model upgrade since b14. BASE is now **33 original features + 21 `net_X` matchup features**
(54 total), fed to BOTH the classifier and the b70 confluence regressor.

**Construction** (in `build()`, NET_PAIRS dict): for each off-metric X with a def "allowed/forced"
counterpart (pass/rush EPA neutral, early-down EPA, explosive rates, PA/motion EPA, pts-per-drive,
success rates, RZ TD rate, TD/drive, three-and-out):
```
hexp = home_off_X + away_def_allowed_X     # what home offense should produce vs THIS defense
aexp = away_off_X + home_def_allowed_X
net_X = hexp - aexp                        # net home edge in this dimension
```
Note the SUM semantics — def metrics measure what the defense ALLOWS, so the matchup expectation
is off + opp_allowed, not a difference.

**Evidence (b90b pre-registered confirmation, product-style: pick at conf≥0.03, bet+grade at OPENER):**
| Variant | 2023-25 pooled | ROI | CLV | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| hist_BASE (old locked) | 51.0% | -2.6% | +0.07 | 43.6% | 57.5% | 51.9% |
| **hist_NETS (new locked)** | **53.4%** | **+1.9%** | **+0.14** | 48.3% | 57.5% | 54.5% |

Logreg and 50/50 blend variants were REJECTED — small AUC gains vs CLOSE did not survive
opener-grading and carried negative CLV. HistGBM with locked hyperparams stands.

**Multiplicity honesty:** b88-b90 explored many variants on the same folds; b90b was the
pre-registered confirmation of the single winner. b88 (spot signals as in-model boolean features)
was NEGATIVE — overlay architecture confirmed correct (rare flags can't split with min_samples_leaf=40).

**Fresh dry-run reproduction (post-upgrade, post-grade-fix, regenerated ledgers):**
| Season | sides_model | ROI | CLV | confluence=1 subset |
|---|---|---|---|---|
| 2023 | 113/234 = 48.3% | -7.8% | — | weak year |
| 2024 | 130/226 = 57.5% | +9.8% | — | — |
| 2025 | 120/220 = 54.5% | +4.1% | +0.27 | 72/133 = 54.1%, CLV +1.17 |

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

## 4. TEASER product (2-team 6-pt) — COMBINED strategy, b76, vaulted 2026-06-01

**Replaces the prior signal-only teaser product.** Combines three independent lenses into one
ranker, evaluating every game on the slate (not just games where signals fire):
  1. **Line-bucket history** (b75/b75b): the historical 6-pt teaser hit rate for this EXACT
     opening spread or total value, walk-forward only
  2. **Model signals** (b73): if any TEASER_RULES pick or sides_model confluence=1 fires on the side
  3. **Team Vegas-sharpness** (b74): if both teams' prior-2-season avg |line − actual| is below
     league median for that market

### Scoring & eligibility (b76)
For each game's 4 possible legs (HOME tease, AWAY tease, OVER tease, UNDER tease):
```
combined_score = bucket_p + 0.05*signal_ok + 0.03*sharp_ok
eligibility    = bucket_p >= 0.74  AND  (signal_ok OR sharp_ok)
```
Then take **top-2 distinct games by combined_score per NFL week**.

### Strongest line buckets (b75/b75b empirical, 2018-2024 calibration)
| Bucket | Side teased | n | Hit % | Lower CI |
|---|---|---|---|---|
| **HOME +4 → +10** | HOME | 41 | 92.7% | 80.6% |
| AWAY -2 → +4 | AWAY | 44 | 86.4% | 73.3% |
| AWAY -6 → 0 | AWAY | 50 | 86.0% | 73.8% |
| AWAY +7.5 → -1.5 | AWAY | 26 | 88.5% | 71.0% |
| AWAY -2.5 → +3.5 | AWAY | 116 | 79.3% | 71.1% |
| AWAY -3 → +3 | AWAY | 180 | 77.8% | 71.2% |
| OVER 42.5 → 36.5 | OVER | 80 | 80.0% | 70.0% |
| OVER 41 → 35 | OVER | 63 | 81.0% | 69.6% |
| UNDER 44 → 50 | UNDER | 85 | 76.5% | 66.4% |

### Eligible model signals (teased hit% ≥ 78%, b73)
| Rule | Market | Straight % | Teased % |
|---|---|---|---|
| `receiver_over_HC` | TOT | 65.2% | 89.1% |
| `legacy_fade` | SPR | 68.2% | 85.7% |
| `top_vs_top_pt_home` | SPR | 71.4% | 85.7% |
| `fade_pr_in_tight_game` | SPR | 56.5% | 78.3% |
| `sides_model` (confluence=1) | SPR | 57.0% | 77.7% |

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

### Honest performance — harness dry-run (combined strategy, fully walk-forward)

| Season | Teasers | Joint hit | ROI @ -120 | ROI @ -110 |
|---|---|---|---|---|
| 2024 dry-run | 19 | **57.9%** | **+6.1%** | +10.5% |
| 2025 dry-run | 19 | **78.9%** | **+44.7%** | +50.7% |
| **Pooled** | **38** | **~68.4%** | **~+25%** | **~+30%** |

Both years profitable. 2025 is the much stronger year; 2024 was tougher (even 90%+ buckets like
HOME +4 had ~85% hit instead of 95%+). Pooled mid-20s ROI is the realistic forward expectation.

### Methodology integrity
- **Buckets**: calibrated on seasons < target only (2018-2023 for 2024, 2018-2024 for 2025)
- **Sharpness**: prior 2 seasons only (2022-2023 for 2024 test, 2023-2024 for 2025 test)
- **Model signals**: harness walk-forward training (train Y<target, test Y)
- **Slate**: all games with opening lines available — not just games where signals fire

### Earlier teaser approaches we tried and dropped
- **Structural Wong-bucket teasers** (b71/b72): tested at ~70% per leg OOS, fails -120 BE.
  Modern books priced out classic Wong edges. DO NOT REVISIT.
- **Signal-only teaser product** (initial wiring): too narrow — sides_model dominated leg2
  selections (77.7% teased = borderline), 2024 had no legacy_fade data so volume collapsed.
  Replaced by b76 combined approach above.

### Bug fixed during integration (2026-06-01)
The prior `grade_teasers` function matched outcomes by (home_ab, away_ab) only — divisional
matchups recur with the same home/away pair each year, so the grader silently graded against
the wrong game's outcome. Now filters by (season, week, home_ab, away_ab). Fix verified by
matching b76 standalone-script results exactly.

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

## 5. CFB-signal replication study (b77-b82, vaulted 2026-06-07)

User ran a deep signal exploration in their CFB thread and asked us to replicate the 8 signals
in NFL data. This section documents what survived, what didn't, and the methodology lessons.

### Methodology rules (strict, from CFB user)
1. Walk-forward only — no peek
2. Per-season breakdown AND 2025 holdout
3. **Confound-check every finding** — esp. totals signals masquerading as fade-high-totals
4. Anchored vs unanchored model distinction matters (totals)
5. Independent signals STACK, same-flavor don't
6. Build proper models before declaring "dead"
7. Low cover% is a high fade%
8. Don't trust ~10-bet hot streaks
9. Signal-line = grade-line
10. Markets adapt — decay check year-over-year
11. NFL is the most efficient market — expect microstructure/behavioral edges, not analytical

### Final scorecard (8 signals tested, b77-b82)

| # | Signal | Verdict | Best metric |
|---|---|---|---|
| 1 spread | Cross-book sharp/soft gap | **DEAD** | 23/44 = 52% pooled |
| **1 total** | **Cross-book total gap** | **SURVIVES** | 60% pool, 64% 2025 holdout, confound passes |
| 2 | Model × soft-book stack | **Already vaulted** (b70 confluence layer §1) | — |
| **3 under** | **Both-teams-over-hot → UNDER at mid totals** | **SURVIVES** | +11.8pp confound lift, 62.5% on mid-band n=40 |
| 3 over | Mirror (both-cold → OVER) | DEAD | 53% — books shade totals up |
| 4 | SOS-padded road-fav fade (overall) | DEAD | 48% pool, NFL schedules too uniform |
| 5a | Anchored team-UNDER model | DEAD | 47% pool, NFL team-total markets efficient |
| 5b | Unanchored team-OVER model | DECAYING | 60% in 2019-22, 44% in 2023-25 |
| 6 | Padded offense/defense unit-level | DEAD | 51% pool — NFL prices SOS effectively |
| 7 | Pace dominator/adapter | **DEAD** (b84) — CFB user's prediction confirmed, priced in NFL |
| 8 | Line-reversal veto | Not tested — useful future addition |

### The two real survivors

**Survivor #1 — Cross-book total gap (microstructure)** — b77, confound b82
- Sharp top-3 books (consistent across 2024+2025 training): `betmgm`, `fanduel`, `betonlineag`
- Soft bottom-3: `bovada`, `betrivers`, `betus`
- Rule: when soft books' avg total > sharp books' by ≥0.5 → bet UNDER at soft
  Inverse: when soft < sharp by ≥0.5 → bet OVER at soft
- 2024: 5/11 = 45.5% (anti-edge year)
- 2025: 14/22 = 63.6% (CONFOUND PASSES — naive "UNDER at slate-max" only hits 50.6%)
- Pooled 2024+2025: 19/33 = 57.6%
- **Real signal, not outlier-fade, but per-season variance is large**

**Survivor #2 — Form mean reversion UNDER at mid totals (behavioral)** — b78
- Both teams come in with ≥60% over-rate in prior games this season (each needs ≥3 priors)
- AND posted total in 42-46.5 band (the mid-band where baseline UNDER is 50.7%)
- Bet UNDER
- Pooled (all years, all bands): 73/120 = 60.8%
- Mid-band specifically: 25/40 = 62.5% (vs 50.7% baseline = **+11.8pp lift**, confound passes)
- Per-season: 2019-22 was 70-100%, 2024-25 is 50-54% — signs of decay
- **Asymmetric: mirror over signal does NOT work (53% pool)**

### Portfolio backtest on 2025 holdout (b82)

| Signal | n | Hit % | ROI @ -110 |
|---|---|---|---|
| S1 UNDER | 22 | 63.6% | +21.5% |
| S1 OVER (inverse, thin) | 7 | 57.1% | +9.1% |
| S2 UNDER (mid totals) | 12 | 58.3% | +11.4% |
| **PORTFOLIO TOTAL** | **40** | **60.0%** | **+14.5% / +5.8 units** |

Honest caveats:
- 2025 IS the holdout; using to validate is OPTIMISTIC (rule 2)
- 2024 was much weaker for S1 (45.5%)
- Realistic 2026 forward expectation: **55-62% hit / +8 to +15% ROI**
- Real test is 2026 live with no further tuning

### What this study CONFIRMED about the NFL market

> CFB user's prediction: "Expect the real edges to come from market microstructure and
> behavioral mean-reversion, not from out-analyzing the football."

**Confirmed exactly.** Every analytical-football angle (SOS overall, padded offense/defense, anchored
team totals, unanchored team totals, identity matchups) came up dead in NFL. The two survivors are:
- One microstructure (cross-book disagreement)
- One behavioral (form-streak mean reversion)

The NFL market efficiently prices opponent quality, schedule strength, and unit-level fundamentals.
The exploitable edges live in (a) book-to-book pricing inefficiencies and (b) bettor recency bias
on streaks. Future NFL research should focus there, not on better fundamentals models.

### Line-reversal veto (b83) — INVERTED in NFL vs CFB

CFB user said a late reversal contradicting the pick dropped CFB hit rates to 40%. In NFL, the
opposite happens — late moves AGAINST our UNDER pick correlate with HIGHER hit rate (market
overshoot / late public-money buying):

| Cohort | n | Hit % | ROI |
|---|---|---|---|
| Portfolio ALL picks | 73 | 58.9% | +12.5% |
| Move neutral/agrees (would-be-veto-kept) | 36 | 52.8% | +0.8% |
| Move CONTRADICTS (would-be-veto-cut) | 37 | **64.9%** | **+23.8%** |

Not a veto in NFL — a **TIER classifier**. TIER 1 (move contradicts) = high conviction,
TIER 2 (move agrees) = standard. Both bet, but track separately.

### Wired into `forecast_harness.py` (2026-06-07)

New constants: `CFB_REPL_BUCKET_BAND=(42,46.5)`, `CFB_REPL_PRIOR_OR=0.60`, `CFB_REPL_GAP_THR=0.5`.
New functions:
- `_book_sharpness_total(target)` — walk-forward per-book total-sharpness ranking from odds_hist
- `generate_cfb_picks(target, week=None)` — produces S1 + S2 picks, dedup conflicts, tag tier
- `grade_cfb_picks(m, target)` — grade vs OPEN/SOFT total (signal-line = grade-line); pushes excluded
- `report_cfb_picks(target)` — per-tier + per-source breakdown
- CLI auto-runs in `--dry-run` flow alongside existing teaser pipeline

### Harness performance (combined survivor pickset)

| Year | n | All-picks hit% | All ROI | TIER 1 hit% | TIER 1 ROI |
|---|---|---|---|---|---|
| 2024 | 35 | 54.3% | +3.6% | 57.9% (n=19) | +10.5% |
| 2025 | 41 | 61.0% | +16.4% | 68.4% (n=19) | +30.6% |
| **Combined** | **76** | **57.9%** | **~+10%** | **63.2% (n=38)** | **~+20%** |

Volume: ~35-40 picks per year. Operational, not bet-every-game.

### Honest 2026 forward expectation

- All-picks pooled: ~55-60% hit / +5-15% ROI at -110
- TIER 1 only: ~58-65% hit / +12-25% ROI at -110
- Per-season variance is real (2024 vs 2025 gap shows it)
- Real unbiased test is 2026 live with no further tuning

## 6. MAMMOTH PLAYS — rare 3-unit alignment plays (b91, vaulted 2026-06-10)

User bets ~5 games/week and wants the rare games where INDEPENDENT edges all line up —
a handful per season, not per week. Definitions were **pre-registered before looking at results**
(no threshold tuning), then wired into `forecast_harness.py` as a `mammoth` column in the ledger.

### Pre-registered definitions (constants in forecast_harness.py)
**SPREAD MAMMOTH** = a sides_model pick where ALL THREE of:
1. classifier edge ≥ `MAM_CONF` = 0.06 (2× the standard 0.03 gate)
2. `confluence == 1` (b70 margin regressor independently agrees on direction)
3. ≥1 ACTIVE TIER-1 spread spot fires on the SAME game picking the SAME side
   (`MAMMOTH_SPREAD_SPOTS` = legacy_fade, legacy_primetime, spread_dog_cover_fade_away/home,
   fade_pr_in_tight_game, dk_heavy_home_juice, tight_soft_ml_fade_home, top_vs_top_pt_home)

**TOTAL MAMMOTH** = ≥2 distinct ACTIVE total rules fire on the SAME game, SAME direction
(`MAMMOTH_TOTAL_RULES` = receiver_over, receiver_over_HC, wind_under, total_low_line_over,
total_high_line_under, dk_giant_fav_over).

### Why this works (dose-response evidence, b91)
Each ingredient ALONE is mediocre — the intersection is where the edge lives:
| Cell (sides_model picks, 2023-25) | Hit % |
|---|---|
| confluence=0 & 0 aligned spots | ~49% |
| confluence=0 & ≥1 aligned | ~52% |
| confluence=1 & 0 aligned | ~54% |
| **confluence=1 & ≥1 aligned** | **~70.8%** |

Calibration finding (b90): every architecture's high-confidence probabilities are fantasy
(predicted 72% → real ~49%) — confidence ALONE can never define a big play. Alignment of
independent signals is the only honest definition.

### Fresh dry-run numbers (upgraded nets model, regenerated ledgers, 2026-06-10)
| Season | SPREAD MAMMOTH | ROI | TOTAL MAMMOTH | ROI |
|---|---|---|---|---|
| 2023 | 4/6 = 66.7% | +27.3% | 4/4 = 100% | +90.9% |
| 2024 | 2/3 = 66.7% | — | 2/4 = 50% | — |
| 2025 | **14/16 = 87.5%** | **+67.0%** (CLV +1.94) | 2/3 = 66.7% | +27.3% (CLV +3.17) |
| Pooled | ~20/25 = 80% | — | 8/11 = 72.7% | +38.8% (CLV +2.25) |

Frequency: ~0.4-0.5 plays/week pooled — exactly the "handful per season" cadence requested.

### Honest caveats
- **n is small** (25 spread + 11 total plays over 3 seasons). Wilson CIs are wide.
- The ingredients (spots, confluence) were developed on this same era — the dose-response
  table is descriptive, not independent validation. **2026 live is the true test.**
- The upgraded nets model produces a different (larger) mammoth set than the b91 script's
  original run because nets changed both the classifier and the regressor.
- Mammoth ≠ guaranteed: 2024 totals went 2/4. Treat as 3-unit sizing on a 70%-ish true rate.

### Implementation
- `generate()` flags `mammoth=1` on qualifying sides_model rows and on total-rule rows
  participating in a ≥2-rule same-direction cluster
- `report()` prints a MAMMOTH PLAYS section (per-play list + per-season summary)
- Old pre-nets ledgers backed up to `out/bak_pre_nets/`; 2023-25 ledgers regenerated fresh
  (stale old-model pick_ids would otherwise contaminate — generate() concat keeps unregenerated rows)

### grade() rematch bug — FIXED 2026-06-10 (found via b91)
`grade()` merged results on (home_ab, away_ab) within a season — same-venue rematches
(regular season + playoff, e.g. 2025 GB@CHI W? and W19) double-matched and duplicated ledger
rows with wrong results. Same bug class as the b76 teaser-grader fix. Now merges on
(week, home_ab, away_ab). `grade_cfb_picks` and `grade_teasers` verified already safe.

## 7. PROPS-IMPLIED TOTALS OVERLAY — "P11 OVER" (vaulted 2026-06-11)

From the player-props deep dive (`props_p8_gamelines.py`, PROPS_BRIEF1.md §4d). **The prop market
and the totals market are the same opinion (R² 0.84-0.88) — except when they disagree, the props
are right and the total is too LOW.**

### Pre-registered rule (frozen)
1. For each game, sum the consensus (median-across-books) **anytime-TD yes-probability** of every
   player on both teams at close → `atd_exp_gm`.
2. Map to an implied total with the **prior-season** OLS fit. For 2026 use the frozen 2025 fit:
   `implied_total = 8.445 + 7.392 × atd_exp_gm`
3. `resid = implied_total − posted close total`. Flag the **top ~20% of the slate by resid** → bet
   the **OVER** at the posted total.
4. **OVER ONLY.** The under mirror is dead (sign flip). The spread version is dead (flips every
   bucket both seasons) — do not resurrect.

### Evidence (cross-season out-of-sample, graded at close total + close juice, 514 games)
| Test season | n (top quintile) | Over % | ROI |
|---|---|---|---|
| 2025 (fit on 2024) | 51 | **60.8%** | **+16.0%** |
| 2024 (fit on 2025) | 53 | **58.5%** | **+11.3%** |

- Full 5-feature version (QB pass yds/TDs, rush/rec sums + ATD) is slightly weaker (56.6-58.8%) —
  **ATD-only is the locked spec.**
- Not a totals-level artifact: flagged games average mid-range 42-45 totals; over% is not
  monotonic in the posted total. Stable in every half-season split (53-65%).
- Mechanism: ATD probs encode TD-vs-FG scoring composition; books don't reconcile the prop book
  against the game total when they price many TD scorers into a modest total.

### Deployment constraints (why rank, not threshold)
Fit coefficients and residual scale drift season-to-season (intercept 3.9 → 8.4; top-quintile
cutoff +5.2 → +1.3 pts). A fixed point-threshold is NOT stable — **always rank within the slate**
(top ~20% of the week's games, ≈ 3/week) and refit the ATD→total mapping each offseason on the
just-completed season.

### Data dependency
Needs live ATD close prices across the 4 books → covered by the planned live props cadence
(~2,800 Odds API credits/mo, same feed as P5/P6 ATD movement flags). Without live props this
flag cannot fire.

### Confluence (untested, high priority for 2026)
Natural overlay on the §2 consensus-totals model: P11-OVER + ensemble-OVER agreement vs conflict
has NOT been backtested yet (different bet timing: close vs opener). Track the overlap live
before formalizing a combined tier.

## 8. FIRST-HALF (1H) MODEL + CONFLUENCE FLAGS M1-M4 (vaulted 2026-06-11)

User decision 2026-06-11: production 1H model + the four M-flags are VAULTED. Full detail in
`H1MODEL_BRIEF1.md`; scripts `h1m_models.py` (frame) + `h1m_models2.py` (features/GBM) +
`h1m_model_card.py` (raw card) + `h1m_2025_combined.py` (the 2025 ledger).

### Architecture (frozen)
- **Market-anchored residual**: prediction = 1H consensus CLOSE line + GBM-predicted residual.
  Unanchored models LOSE to the market (MAE 7.03 vs 6.82) — never rebuild unanchored.
- GBM = HistGradientBoostingRegressor(max_iter=150, depth=2, lr=0.04, min_leaf=60, L2=2.0).
  Features = cross-market gaps (`add_xmkt`: 0.49·fg_tot−h1_tot, 0.55·fg_sp−h1_sp, tt_sum−fg_tot,
  −tt_diff−fg_sp) + point-in-time context. NaN-native → every game incl. weeks 1-3 gets a number.
- All bets AND grades at 1H consensus close (median line, median payout) — signal/bet/grade aligned.
- **Retrain each offseason** on all completed seasons (2026 model = 2023-25 train).

### Production tiers (every-game product + bet overlay)
1. **Display** (every game): 1H total, 1H spread, 1H win prob (logistic of close 1H spread; brier ties market).
2. **Lean**: totals 0.5 ≤ |edge| < 3.0 → "model lean" (~6-7/wk; walk-forward 54.3% / +3.7%).
3. **HC**: totals window 1.25-2.75 + the M-flags below.
4. **Cap**: |edge| ≥ 3.0 → show number, SUPPRESS confidence (falloff confirmed both seasons).
5. Spread model NEVER bets alone (resid corr ≈ 0) — confluence filter only. ML betting = −EV, display only.

### The M-flags (model band × point-in-time signal), 2025 walk-forward ledger
K1(pit) = weekly-slate rank of (tt_sum − fg_tot), top 20% — NO look-ahead.

| Flag | Rule | 2025 | ROI |
|---|---|---|---|
| M1 | model e_tot in +1.25..+2.75 AND K1(pit) → 1H OVER | 16-7 (69.6%) | +34.1% |
| M2 | K1(pit) AND e_tot > +0.5 → FG OVER | 28-19 (59.6%) | +13.7% |
| M3 | SNF/MNF fav AND spread-tilt agrees → fav 1H spread | 15-9-1 (62.5%) | +19.7% |
| M4 | slow-start dog (≤8 1H ppg, ≥4 games) AND tilt agrees → fade dog 1H | 17-13 (56.7%) | +8.8% |
| **Portfolio** | 125 bets / 93 games / ~5.7 per wk | **76-48-1 (61.3%)** | **+17.5% / +21.8u** |

### Honest caveats (carry into 2026)
- ONE honest test season with an adequately-trained model (2024's 1-train-season model was weak:
  totals window −13%). Walk-forward CIs touch break-even (M1 CI 48-78%).
- Totals-2024 and spread-2025 were each negative — no simultaneous good season yet for the raw
  model. 2026 (3 training seasons) is the confirmation year; ledger every pick.
- M4 is the thinnest/newest flag (no 2024 walk-forward check); weight it lowest.
- Thin market: 9-12 books, ~−115, lower limits than FG.

### Data dependency (OPEN — deferred to pre-season workflow work)
1H spread/total/ML + team-total odds in `nfl_historical_odds` are a one-time HISTORICAL backfill
(`h1tt_backfill.py`, per-event endpoint, reused FG snap_ts). The live FG snapshot collector does
NOT capture these markets yet — must be added before Week 1 2026 or the model/K1 can't run live.
Also needs: nflverse schedule/results refresh (`nflverse_games.parquet`) + the context rebuild
chain (`h1tt_frame.py` → `h1tt_p6_context.py`).

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
