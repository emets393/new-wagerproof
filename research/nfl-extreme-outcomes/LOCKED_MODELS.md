# NFL Models — LOCKED for 2026 forward-tracking

Locked 2026-05-28. **Rule: no more tuning on 2024-25.** These configs are frozen; the only valid
next test is live 2026 forward results. Everything below was selected on walk-forward training and
graded on a 2024-25 held-out set vs the **OPENING** line (what a website actually posts) + CLV.

---

## 1. SIDES model (full-slate ATS) — `b14_iter2.py`, "+schedule spots"

Predict `home_cover` (validated: `actual_margin + home_spread > 0`) walk-forward with
HistGradientBoostingClassifier; bet the confident side (|p-0.5| >= .03) vs the opener.

**Features (33):** PR core (pr_diff, home/away predictive_pr, last5_diff, home/away consistency)
+ proven flags (home_dog_7_10, away_dog_7_10, div/conf/league, primetime, week, home_fav, abs_spread)
+ injury (air_diff) + referee (4)
+ **schedule spots** (h/a pre_bye, blowout_win_last, blowout_loss_last, third_road, div_revenge).
**Dropped:** pass-rush facet (hurt: 55.6→53.7); **defense features** (dprod_team_diff/h/a_dprod_team —
leave-one-out ablation b30 showed they overfit: cutting them improved held-out 55.6→56.4% & CLV +0.14→+0.27).

**Held-out 2024-25 (refined, defense cut):** conf>=.03 → **56.4%, CLV +0.27** (n=369); baseline w/ defense 55.6%.
**Per-season caveat:** 2024 ~58% vs 2025 ~53% — pooled number is 2024-weighted.
Status: *promising, NOT confirmed.* CI[51,61] touches breakeven. 2025 is the soft year to watch.
New sides flags (rest/short-week/big-fav/div-late/off-bye) FAIL the permutation null (b30: real 3 ≤ null 4) —
ATS trend well is tapped; do not add. `div_late` (57.6%, 53/60/59) = WATCH only.

## 2. TOTALS model (full-slate O/U) — **CONSENSUS ENSEMBLE** — `consensus_totals.py`

**LOCKED 2026-05-29 (FINAL after b57 injury-ablation + b58 edge-magnitude analysis).**
Replaces b15 standalone as the totals slate. **Production default = strict-open (no injury features).**

### The locked production rule
Ensemble of two independent totals models. Bet when:

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

## 3. TOTALS spot signals (still in play, supplementary to consensus) — `b15_totals.py` standalone, `b7c_over_rule.py`

Held-out 2024-25 vs the opening total:
| Spot | n | hit | note |
|---|---|---|---|
| **key WR/TE out (air-share>=35%) -> OVER** | 74 | **62.2%** | CI[51,72], lower bound ABOVE breakeven |
| **wind >= 15mph -> UNDER** | 43 | **60.5%** | CI[46,74], small n |
| dome -> OVER | 156 | 54.5% | marginal, CI incl. breakeven |
| cold <= 32F -> UNDER | 40 | 52.5% | breakeven |

These are **alerts, not a slate** — ~20-40 high-conviction plays/season. This is the proven NFL edge:
totals *pricing inefficiencies* around injuries/weather, not a model that beats every line.

**Madden-filtered two-tier for the receiver-OVER (b18_madden_over.py):**
- Standard: air-share>=35% out -> OVER (64.7% close / 61.2% open, ~24/yr).
- **High-conviction: air-share>=35% AND Madden OVR>=80 -> OVER (66.9% close / 63.6% open, ~17/yr,
  >=55% in ALL 8 seasons vs 50% floor for standard).** Madden OVR works as a FILTER (removes
  high-target-but-replaceable receivers the market prices right), NOT as a trigger or to catch
  low-usage stars (R2/R4 both <60% -> usage drives the mispricing, not talent). CIs overlap R1, so this
  is a floor-raising refinement, not a transformation.

---

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
