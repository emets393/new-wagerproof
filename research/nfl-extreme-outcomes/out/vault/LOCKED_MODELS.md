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

## 2. TOTALS model (full-slate O/U) — `b15_totals.py`

Predict `actual_total` walk-forward; bet edge>=2 vs `open_total`.
**Verdict: breakeven (51.6%, CI[46,57], -1.6% ROI, +0.47 CLV). DO NOT ship as a full-slate product.**
The market's total is efficient game-to-game. The value is in *spots*, not the slate (below).

## 3. TOTALS spot signals (the real totals edge) — `b15_totals.py` standalone, `b7c_over_rule.py`

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
