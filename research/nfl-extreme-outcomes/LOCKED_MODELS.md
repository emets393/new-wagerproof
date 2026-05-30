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

**LOCKED 2026-05-29 (REFRAMED after b57 injury-leak ablation).** Replaces b15 standalone as the totals slate.

### Strategy
Ensemble of TWO independent totals models — **bet only when both agree** on direction (over/under)
AND **min |edge| >= 3 pts** (HC tier = the real product; std tier @ edge≥2 is supplementary):

| Component | Architecture | Features |
|---|---|---|
| b15 LOCKED (`b15_totals.py`) | direct totals (HistGBM) | 20 env+weather+flags |
| b55 PRUNED+SCH (`b55_scheme_priors_pruned.py`) | team-points → derived total | top-100 b54 importance + 8 b50 scheme priors |
| **ENSEMBLE** | agreement on direction | both above; default to HC (edge≥3) |

**Why it works:** the two models share +0.302 correlation — partially independent errors. Agreement
filter cancels noise. Threshold gate concentrates on high-confidence picks.

### ⚠️ CRITICAL: Timing-honest validation (b57_injury_ablation.py)
The original "+13.5% ROI vs OPEN" backtest used post-opener injury info (final reports drop Friday;
opener set Sunday-Monday). The honest decomposition at HC tier (agreement + min |edge| >= 3):

| Scenario | Line | Model | Hit% | ROI | n | What it means |
|---|---|---|---|---|---|---|
| A: STRICT OPEN | open | no-injury | 53.3% | +1.8% | 120 | conservative; bet immediately at opener |
| **B: FULL CLOSE** | **close** | **full** | **56.6%** | **+8.0%** | **122** | **bet Fri-Sat after injury reports** |
| C: LEAKY (old) | open | full | 59.5% | +13.5% | 111 | NOT achievable — used post-opener info |
| D: PURE MODEL | close | no-injury | 49.2% | -6.0% | 128 | structural features alone are priced |

**Realistic 2026 live expectation: between A and B → ~54-56% hit, +3-7% ROI at HC tier.**
The 2025-only strict-open HC test reproduced **57.1% / +9.1% ROI / +0.56 CLV (n=56)** —
positive CLV survives even with all injury features stripped, confirming residual model edge.

### Two operating modes
| Mode | Use | Features | When to bet |
|---|---|---|---|
| **FULL (default)** | `python3 consensus_totals.py --season 2026 --week N` | all features incl. injuries | **Friday afternoon / Saturday** after final injury reports |
| **STRICT-OPEN** | `python3 consensus_totals.py --season 2026 --week N --strict-open` | injury features stripped | Immediately at opener (Sun-Mon) — conservative |

### Critical config (DO NOT change without re-validating)
- `TOP_N = 100` features from `data/b54_feature_importance.csv` (FROZEN snapshot, do not re-rank)
- `MIN_EDGE_STD = 2.0` (supplementary), `MIN_EDGE_HC = 3.0` (**the product**)
- b15 hyperparams: depth=3, lr=0.05, n_iter=350, l2=2.0, min_leaf=40
- b55 hyperparams: depth=4, lr=0.05, n_iter=500, l2=1.0, min_leaf=40
- Walk-forward: train seasons<target, scheme priors from target-2..target-1
- Injury features stripped in strict-open mode: `key_recv_out`, `h_max_air_out`, `a_max_air_out` (b15),
  `off/def_backup_qb`, `off/def_injury_severity`, `off/def_starters_out`, `off/def_qb_out_or_doubtful` (b55)

### Usage
```bash
python3 consensus_totals.py --dry-run 2025                 # FULL mode (post-injury, bet Fri-Sat)
python3 consensus_totals.py --dry-run 2025 --strict-open   # STRICT-OPEN mode (no-injury, opener-safe)
python3 consensus_totals.py --season 2026 --week N         # weekly live (full mode = default)
python3 consensus_totals.py --grade 2026                   # fill results + CLV
python3 consensus_totals.py --report 2026                  # summary
```

### Data dependencies (refresh through 2026 season)
| File | Refresh cadence | Source |
|---|---|---|
| `data/matchup.parquet` | weekly | main pipeline |
| `data/scheme_plays.parquet` | weekly | `b46_pull_scheme.py` (nflverse PBP + participation) |
| `data/odds_consensus.parquet` | weekly | main pipeline (opener + close) |
| `data/injuries_raw.parquet` | weekly | main pipeline (used by FULL mode; ignored in strict-open) |
| `data/ngs_receiving.parquet` | weekly | main pipeline (NGS air-share) |
| `data/players_xwalk.parquet` | occasional | main pipeline |
| `data/b54_feature_importance.csv` | **FROZEN — do not re-rank** | `b54_team_points.py` snapshot |

### Caveats / honest limits
- **The +12-13% ROI headline was a backtest artifact** (post-opener injury info used to grade opener bets).
  Realistic live expectation is **~54-56% / +3-7% ROI at HC tier**.
- **2024 weaker than 2025**: strict-open 2024 HC ~50%, 2025 HC ~57%. Variance is real.
- Structural features alone (no injuries) cannot beat the close — D scenario is negative.
- The model is essentially an **injury-news execution play** + small residual edge from scheme/PR features.
- **2026 live: track in `out/consensus_totals_ledger_2026.csv`. Sustained +CLV is the confirmation.**

### Research backstory (b50→b57)
- b50: pressure-conditioned coverage → stable player priors (QB-vs-man corr 0.33, WR-zone-NP corr 0.39)
- b51-53: those priors did NOT produce single-game prop edge OR sides edge (priced)
- b54: built leak-filtered team-points model with 333 features → MAE 7.56 (parity with market)
- b55: PRUNED to top-100 + added 8 b50 scheme priors → derived totals showed lift vs opener
- b56: ensembled with locked b15 → agreement filter showed +12-13% ROI (turned out to be leaky)
- **b57: honesty test → stripped injury features for opener grading. Confirmed real but smaller edge.
  Reframed product around HC tier + Fri-Sat betting timing.**

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
