# NFL player-props model — v2 verdict (RESEARCH ONLY)

Redo of `prop_model.py` after the NBA post-mortem, applying the same two structural fixes and the
same grading guardrails. **Production untouched** — no dryrun tables, P-flags, grading RPCs, or other
sports were modified. Scripts: `nfl_prop_model_v2.py` (frame + positional-allowed + leak screen),
`nfl_prop_grade_v2.py` (decomposition + product test + ladder + oracle). Eval = 2024–25 (the only
seasons with T-60 prop lines), graded at the T-60 close with American→decimal prices.

## Headline (v3 — POSITIVE MODEL)
**The earlier "priced" verdict was wrong; it was a MISSING-METRICS problem.** The v2 pass used the
positional context but still lacked the #1 driver of volume/receiving props — **within-team usage
share (target/rush/attempt share) + snap participation.** Adding them (per-market feature selection,
`nfl_prop_features_v3.py` + `nfl_prop_deepdive_v3.py` + `nfl_prop_bet_v3.py`) produces a **positive,
robust, both-season model on the volume-UNDER markets:**

| cell | win% (p80) | ROI | dose-response p50→p80 | seasons | distinct players | drop-best ROI |
|---|---|---|---|---|---|---|
| **rush_attempts UNDER** | **62.1%** | **+12.7** | 57.4→59.6→62.1 | 60/65 | 84 | +11.2 |
| **rush_yds UNDER** | ~59% | +7–12 | 55.2→57.4→59.3 | 59/59 | 95 | +9.0 |
| **pass_completions UNDER** | 60.3% | +9.8 | 52→60 | 59/62 | 57 | +11.2 |

All beat sigma, both seasons ≥ vig, clean dose-response, broad (57–95 distinct players, survive
dropping the best player). The UNDER side dominates — consistent with every prior prop finding (overs
are shaded). This is a **modelling** win: the market was NOT efficient here; we were under-informed.

**What was learned, in order:** (1) infra is clean (OFF/DEF team features 100%-covered, no fanout);
(2) the ablation shows USAGE helps 7/8 markets and SNAP 6/8, POS helps the skill markets — the missing
metrics were real; (3) the line-as-feature still barely matters (2-season line history), but it no
longer *hurts* once usage/snap carry the model; the edge is strongest in the NOLINE (independent-model-
vs-line) config, i.e. it's a line-inflation edge, not an out-forecasting one; (4) the model still does
not beat the close on MAE on most markets — the edge is directional (UNDER), not accuracy.

## v4 — the OVER side recovered (quantile bands; two-sided model)
Point-estimate regression never found over edges because receiving stats are RIGHT-SKEWED (boom
games): the mean under-prices ceilings. Quantile bands fix the framing — bet OVER only when the
**pessimistic band (q35) still clears the line**, UNDER only when the optimistic band (q65) sits
below it. Per-market feature sets throughout (`nfl_prop_twoside_v4.py`).

| cell (q-band, +3% margin) | n | win% | need | ROI | players | drop-best | ROI 24 / 25 |
|---|---|---|---|---|---|---|---|
| **receptions OVER** | 544 | 62.3 | 57.8 | **+7.2** | 160 (top10 20%) | +7.6 | **−3.5 / +14.9** |
| **reception_yds OVER** | 373 | 58.7 | 53.2 | **+10.0** | 125 (top10 29%) | +10.7 | **−2.2 / +18.9** |
| rush_attempts UNDER (same framework) | 432 | 61.8 | 54.4 | +11.6 | — | — | both + |
| rush_yds UNDER | 649 | 55.8 | 53.1 | +5.0 | — | — | both + |

**Honest tiering:** the UNDER family is Tier-1 (ROI-positive in BOTH seasons). The receiving OVER
cells are **Tier-2 / track-plus** — win% ≥ 50 both seasons and strongly robust across players, but
2024 ROI is slightly negative (the juiced over prices ate a 56% year); the profit is 2025-driven.
Deploy the unders; track the overs live before promoting.
- Classifier (p(over) vs price-implied need): adds nothing beyond the bands (one modest rush_attempts
  UNDER cell). Price-split: plus-money rush_attempts OVER n=48 — too thin.
- Two-sided summary: **rushing/volume → UNDER edges; receiving → OVER edges (ceiling-underpriced);
  QB passing (yds/tds/attempts) → no reliable edge either side (sharpest sub-market).**

## v5 — SCHEME features complete the receiving markets (task #98)
Player coverage splits + opponent scheme identity (from `nfl_scheme_context.py`) were DEAD as raw
interaction cells (`nfl_prop_scheme_battery.py` — prop lines price player-vs-scheme fit) but as a
MODEL FEATURE FAMILY they convert the receiving UNDER side from dead to deployable
(`nfl_prop_scheme_sweep.py`, matched baselines, random_state=0):

| cell (with SCHEME) | n | win% | need | ROI | seasons | baseline (no scheme) |
|---|---|---|---|---|---|---|
| **receptions UNDER (point p65)** | 650 | **61.5** | 56.8 | **+7.5** | **62/61** | 54.8 / −4.5 |
| **reception_yds UNDER (q-band)** | 402 | **56.7** | 53.0 | **+6.8** | **56/58** | 51.2 / −4.1 |
| receptions OVER (q-band) | 543 | 62.1 | 57.3 | +7.6 | 57/66 | +7.2 (unchanged) |
| reception_yds OVER (q-band) | 408 | 59.1 | 53.2 | +10.6 | 52/64 | +10.0 (unchanged) |

Both new UNDER cells clear sigma and are positive BOTH seasons → Tier-1. The scheme features tell
the model when a receiver walks into a bad coverage matchup — information the raw cells couldn't
monetize but the regression can. **pass_yds: the −0.455 MAE gain did NOT convert to bets** (point
cells still under need; the +SCHEME quantile OVER band degenerates to 31% on n=45) — pass_yds stays
no-edge. Chosen sets updated: SCHEME added to receptions + reception_yds only.

**Final two-sided deployable map (end of research program):**
- rushing/volume → point-edge UNDERs (v3, Tier-1) · receiving → band OVERs (Tier-2 track) + **scheme-
  aware UNDERs (Tier-1)** · QB passing → no edge either side.

### v2 findings (superseded — kept for the record)
Before usage/snap were added: pooled a/b/c decomposition was −2.8/−6.8/−7.9 and context beat the line
on 0/8 markets. That conclusion held only because the volume priors were missing. The NBA line-scale
"edge grows with line" law still does NOT reproduce in NFL (need flat ~53%, no small-line price
collapse) — the NFL edge is a usage-driven UNDER, not a line-size effect.

## 1. Inventory gap (the NBA-style check that mattered)
The model frame reads `player_offense` (07-02), `team_week` (08-01), `games_enriched` (05-27),
`props_rows(_extra)`. Unused on disk, several refreshed **after** the model last ran (`prop_model_eval`
= 07-05): `player_stats_def` (08-01), `ngs_receiving/rushing/passing` (08-01), `madden_ratings` (08-01),
`snap_counts`, `offense_matchup`/`matchup`. Same pattern as NBA — tables written after the frame was
built, never wired in. (`player_stats_def` is the *defenders'* box, not "allowed"; the positional-
allowed table had to be built from the offensive box attributed to each opponent defense.)

## 2. Fixes applied
- **DEFECT 1 — line as a feature:** added `close_line` to FEATS (props-only exception; NOT propagated
  to any team model).
- **DEFECT 2 — positional context:** built a leak-safe **positional-defence-allowed** table (what each D
  allows per game to WR/TE/RB/QB, s2d/l5/l3, `shift(1)` before the window; leak assert on nonzero rows
  passed). Attached `own_/opp_/team` families: positional-allowed (POS), team pressure/coverage +
  WR/CB mismatch from `offense_matchup` (TM), Madden OVR (MAD).
- **Leak screen** (feature must correlate with the LINE ≥ the RESULT): flagged 0 of the linear check —
  but the **ablation guardrail caught what the corr screen missed**: the NGS family produced a 75%
  top-edge win with only ~5% MAE gain. Excluded pending an upstream `ngs_*` build audit (see Still Open).

## 3. Decomposition (top-25% |edge|, both sides, pooled) — which fix mattered
| config | n | ROI% | win% | need% | gap | seasons (24/25) |
|---|---|---|---|---|---|---|
| **a_base** (current) | 3763 | **−2.8** | 53.2 | 54.3 | −1.1 | −7 / −1 |
| b_line (+close_line) | 3764 | −6.8 | 50.9 | 54.0 | −3.2 | −9 / −5 |
| c_full (+context) | 3762 | −7.9 | 50.2 | 54.1 | −3.8 | −13 / −5 |

**The opposite of NBA** (there: base −1.09 → +line +0.46 → +context +7.09). Here the base is the *best*
config. `+line` hurt — close lines exist only for 2024–25, so the feature has almost no training support
(all 2018–23 training rows are NaN); it added noise, not signal. `+context` closed MAE toward the line
(below) but didn't convert to ROI.

## 4. Product test — paired per-row MAE, model vs the line, EVERY row (unfiltered)
| market | n | line MAE | a_base | c_full | beats line? |
|---|---|---|---|---|---|
| pass_yds | 561 | 55.32 | 58.22 | 58.03 | no |
| pass_tds | 562 | 0.94 | 0.98 | 0.97 | no |
| receptions | 4406 | 1.59 | 1.70 | 1.66 | no |
| reception_yds | 4480 | 21.96 | 24.29 | 23.43 | no |
| rush_yds | 2468 | 18.95 | 21.32 | 20.52 | no |
| pass_attempts | 568 | 6.55 | 6.79 | 6.91 | no |
| rush_attempts | 1487 | 3.51 | 4.03 | 3.68 | no |
| pass_completions | 567 | 4.39 | 4.72 | 4.68 | no |

The context **improves** the model everywhere (c_full < a_base on the skill markets — the positional
info is genuinely informative) but **beats the closing line on 0 of 8 markets**. The line already
prices the positional context. (The "4/8 beats line" seen mid-run was the NGS leak.)

## 5. Per-market bet table (c_full, top-25% |edge|) — win% vs each side's OWN unconditional rate
Positive, both-seasons cells only shown as candidates; sigma in parentheses.
- **rush_attempts UNDER — the one keeper candidate:** 58.4% (uncond 54.4, gap +4.0), ROI **+8.7**,
  **both seasons positive (55% / 61%)**, n=197, σ≈6.6. Marginal on sigma but season-consistent.
- pass_yds OVER +14.0 ROI but n=91 and 2024 100% / 2025 60% (small-n, not season-stable).
- pass_attempts OVER +8.4 but **2024 = 0%** → fails per-season.
- pass_completions OVER +1.8 (≈ vig). receptions/reception_yds/rush_yds: all net-negative after vig
  despite ~50–54% — priced.

Everything except rush-attempts UNDER either loses to the vig or fails a season → **priced.**

## 6. Line-scale ladder — the NBA law does NOT transfer
`need` is **flat ≈ 53% across every bucket in every market** (slope(need vs line) ≈ 0 everywhere) — the
NBA small-line "price collapse" (a 0.5 line demanding 67%) is **absent** in NFL props (mostly two-way
−110ish). And the accuracy-vs-line-size effect is weak and market-specific, not a general law:
- **pass_yds:** slope(gap vs line) **+0.064** — mild rising over-edge; only the top bucket (240–282)
  clears (over 55.0%, gap +1.9, ROI +3.6). Matches the prediction for pass_yds, but thin.
- **receptions / reception_yds:** slope(gap) **−0.789 / −0.096** — the *opposite* of NBA: higher lines
  → overs miss MORE, the UNDER is the better side on big receiving lines (ROIunder +1.1 / +0.6 in the
  top buckets). A mild under-on-high-line tilt, not an over one.
- **rush_yds:** slope ≈ **−0.017** (flat) — no line-scale edge either way.

No high-line rule survives the four checks (no smooth slope, no both-sides lift, ROIs at/under the vig),
so none is claimed.

## 7. Guardrails run
Oracle grader check passed (feed realised stat → 100% win). `need` computed from the price actually
taken (1/decimal). Per-season on every cell. Sigma printed on every cell. Bet counts matched across
configs (same eval rows). One line per player — no cross-market confluence (already failed on NFL;
the passing-family markets are one opinion, not three).

## STILL OPEN
- **NGS leak audit.** `ngs_receiving/rushing/passing` own-form s2d produced a 75% top-edge win that the
  linear leak screen passed and the MAE didn't justify. Ablation isolated it to the NGS family. Needs a
  row-level audit of the upstream `ngs_*` build (possible same-game contamination or a join fan-out on a
  sparse, receivers-only table) before NGS can be trusted. Excluded for now.
- **rush_attempts UNDER** — the only both-seasons-positive cell (+8.7 ROI, 55/61%). Run the four
  high-rule checks (distinct players, top-10 share, drop-best-player, per-cut) and add 2026 before
  believing it.
- **OC / snap-count volume prior.** `snap_counts` (participation = the volume prior) is keyed by PFR
  id/name, not gsis — needs `players_xwalk` to attach; not wired here. Likely the best remaining lever
  for the volume markets (attempts/carries/targets).
- **Line-history depth.** "line as a feature" can't be fairly judged with 2 seasons of prop lines; it
  hurt here but that may be a coverage artifact, not a verdict on the fix.


## Appendix — full edge matrix (every market x both sides x edge magnitude)
Generated by `nfl_prop_edge_matrix.py` (point model, per-market features, walk-forward, random_state=0).

```
================================================================================================================
FULL EDGE MATRIX — per market, per side, by edge magnitude (bucket = |edge| quartile within side)
edge = model prediction minus close line, in the market's own units
================================================================================================================

### player_pass_yds  (eval n=1069, unconditional over 49.9%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.1-6.8   123   46.3  53.2   -12.9   8.6  2024:44% 2025:48%
  OVER            6.8-13.4   123   42.3  53.3   -20.7   8.5  2024:49% 2025:37%
  OVER           13.4-22.8   122   57.4  53.3    +7.7   8.5  2024:59% 2025:56% *
  OVER          22.8-100.8   123   47.2  53.3   -11.7   8.6  2024:50% 2025:43%
  UNDER            0.1-7.5   145   53.1  53.1    -0.1   7.9  2024:59% 2025:49%
  UNDER           7.5-17.0   143   46.9  53.2   -12.0   8.0  2024:49% 2025:45%
  UNDER          17.0-32.5   144   44.4  53.3   -16.6   7.9  2024:48% 2025:40%
  UNDER         32.5-141.4   145   50.3  53.2    -5.3   7.9  2024:52% 2025:48%

### player_pass_tds  (eval n=1071, unconditional over 50.0%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-0.1   133   52.6  52.1    -2.0   8.3  2024:55% 2025:50%
  OVER             0.1-0.2   133   56.4  55.4    -1.5   8.2  2024:61% 2025:50%
  OVER             0.2-0.4   133   50.4  58.7   -16.6   8.3  2024:51% 2025:49%
  OVER             0.4-1.1   134   59.0  63.4    -6.1   8.1  2024:60% 2025:58%
  UNDER            0.0-0.1   135   51.9  57.8    -9.5   8.2  2024:51% 2025:53%
  UNDER            0.1-0.3   134   55.2  60.0    -5.9   8.2  2024:57% 2025:54%
  UNDER            0.3-0.4   134   52.2  63.2   -17.8   8.2  2024:56% 2025:49%
  UNDER            0.4-1.2   134   59.0  65.4   -12.1   8.1  2024:52% 2025:64%

### player_receptions  (eval n=4925, unconditional over 47.7%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-0.2   707   46.4  52.4   -13.4   3.6  2024:48% 2025:45%
  OVER             0.2-0.5   710   48.9  53.5   -10.3   3.6  2024:50% 2025:47%
  OVER             0.5-0.8   708   52.3  54.8    -6.3   3.6  2024:54% 2025:51%
  OVER             0.8-3.6   708   56.8  57.4    -2.5   3.6  2024:53% 2025:60%
  UNDER            0.0-0.2   517   52.0  55.5    -8.8   4.2  2024:52% 2025:52%
  UNDER            0.2-0.4   518   62.2  56.3    +7.0   4.1  2024:62% 2025:62% *
  UNDER            0.4-0.7   516   58.5  56.2    +1.9   4.1  2024:59% 2025:58% *
  UNDER            0.7-2.5   518   54.6  56.8    -4.7   4.2  2024:53% 2025:56%

### player_reception_yds  (eval n=5001, unconditional over 49.4%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-3.8   906   48.2  53.3    -9.6   3.2  2024:50% 2025:46%
  OVER             3.8-7.2   905   46.9  53.3   -12.1   3.2  2024:48% 2025:45%
  OVER            7.2-11.5   909   51.5  53.3    -3.6   3.2  2024:53% 2025:50%
  OVER           11.5-51.7   907   53.0  53.3    -0.7   3.2  2024:52% 2025:54%
  UNDER            0.0-1.9   337   53.7  53.0    +1.0   5.2  2024:58% 2025:49% *
  UNDER            1.9-4.2   339   55.2  53.1    +3.2   5.2  2024:50% 2025:59% *
  UNDER            4.2-8.1   337   49.9  52.9    -5.8   5.2  2024:47% 2025:53%
  UNDER           8.1-34.1   339   49.3  52.9    -7.1   5.2  2024:50% 2025:48%

### player_rush_yds  (eval n=3029, unconditional over 47.6%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-2.6   474   50.2  53.3    -6.1   4.4  2024:48% 2025:52%
  OVER             2.6-4.9   478   49.0  53.1    -7.8   4.4  2024:48% 2025:50%
  OVER             4.9-8.2   476   48.5  53.0    -8.4   4.4  2024:44% 2025:52%
  OVER            8.2-40.6   477   49.1  53.3    -8.6   4.4  2024:50% 2025:48%
  UNDER            0.0-2.0   277   52.0  53.1    -2.2   5.7  2024:47% 2025:56%
  UNDER            2.0-5.1   279   56.3  53.0    +6.0   5.7  2024:54% 2025:59% *
  UNDER           5.1-10.1   279   51.6  53.0    -2.8   5.7  2024:47% 2025:57%
  UNDER          10.1-44.4   279   60.6  53.0   +14.2   5.6  2024:63% 2025:58% *

### player_pass_attempts  (eval n=1079, unconditional over 47.2%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-0.7   109   49.5  53.3    -8.9   9.1  2024:41% 2025:57%
  OVER             0.7-1.4   108   52.8  53.4    -1.6   9.2  2024:53% 2025:53%
  OVER             1.4-2.4   109   42.2  53.6   -22.4   9.0  2024:44% 2025:41%
  OVER             2.4-6.9   110   47.3  53.5   -12.3   9.1  2024:48% 2025:46%
  UNDER            0.0-1.0   159   49.7  53.5    -7.4   7.6  2024:47% 2025:52%
  UNDER            1.0-2.2   160   51.9  53.6    -4.5   7.5  2024:56% 2025:48%
  UNDER            2.2-3.9   159   54.7  53.7    +1.5   7.5  2024:48% 2025:61% *
  UNDER           3.9-21.1   159   57.2  53.5    +6.9   7.5  2024:53% 2025:61% *

### player_rush_attempts  (eval n=1999, unconditional over 45.7%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-0.5   212   48.1  53.6   -13.1   6.6  2024:52% 2025:45%
  OVER             0.5-1.0   208   48.1  54.0   -11.9   6.6  2024:41% 2025:54%
  OVER             1.0-1.9   210   44.8  54.0   -18.0   6.6  2024:46% 2025:43%
  OVER             1.9-8.0   212   50.5  54.0    -9.2   6.6  2024:47% 2025:54%
  UNDER            0.0-0.6   288   51.7  53.8    -7.5   5.6  2024:46% 2025:56%
  UNDER            0.6-1.3   288   56.2  54.3    +2.6   5.6  2024:57% 2025:56% *
  UNDER            1.3-2.4   284   53.9  54.3    -2.0   5.6  2024:51% 2025:57%
  UNDER           2.4-11.0   287   61.7  54.0   +12.2   5.5  2024:61% 2025:62% *

### player_pass_completions  (eval n=1076, unconditional over 47.8%)
  side          edge range     n   win%  need    ROI%   sig  per-season
  OVER             0.0-0.4   103   60.2  53.4   +12.3   9.2  2024:60% 2025:60% *
  OVER             0.4-1.0   102   42.2  53.4   -22.9   9.3  2024:47% 2025:38%
  OVER             1.0-1.7   102   46.1  53.3   -13.2   9.4  2024:43% 2025:48%
  OVER             1.7-5.3   101   51.5  53.8    -7.9   9.5  2024:47% 2025:57%
  UNDER            0.0-1.0   165   49.1  53.4    -9.7   7.4  2024:39% 2025:59%
  UNDER            1.0-1.9   165   55.8  53.8    +2.5   7.4  2024:54% 2025:57% *
  UNDER            1.9-3.3   166   46.4  54.3   -16.0   7.4  2024:51% 2025:41%
  UNDER           3.3-14.4   167   62.9  54.0   +14.9   7.1  2024:61% 2025:66% *

(* = win%>need and ROI>0 in that bucket)
```

## Line-as-feature experiment — REJECTED (2026-08-17, exp_prop_line_feature.py)
Tested the NBA construction (close+open line as model features) on all 8 O/U markets,
walk-forward 2023-25 on the 3-season line archive, same eval rows both arms.
- MAE improves in 6/8 markets (the model drifts toward the line's answer) — but the line
  itself still beats both arms everywhere, and MAE is the WRONG adjudicator here:
- **Every production bet cell degrades.** rush_yds top-quartile UNDER: 58.3%/+9.6% line-blind
  -> 48.8%/-8.6% line-aware. pass_tds OVER 63.6 -> 58.5. pass_attempts UNDER 57.3 -> 54.6.
  rush_attempts wash. Only reception_yds UNDER ticks up (51.6 -> 54.2, ~breakeven).
- Mechanism: the edge IS the model's independence from the market. Feeding it the line makes
  predictions hug the line, shrinking exactly the disagreements the P-cells monetize.
- **The line-blind design is load-bearing. Do not "improve" these models by adding market
  features; the NBA props law (line-as-feature helps) does NOT port to NFL props.**

## Third-season revalidation: movement/form family + attempts price QC (2026-08-17, prop_p_family_reval.py)
Frozen production thresholds, graded @ T-60 close with real prices, 2023 added:
- **ALL FIVE SURVIVE** (unlike P14's flat 2023): P12 65.6%/+22.8 (62/70/66), P13 65.0%/+22
  (2023 44% on n=18 — noise-sized), P10 64.4%/+8.4 (70/65/62), P15 56.5%/+1.9 (52/55/62),
  P16 61.5%/+12.8 (54/62/68). Two-season def records were optimistic (P12 "72%", P13 "82%")
  — defs updated to 3-season numbers; user-facing records now honest.
- **Attempts price data is CLEAN**: median under -115 across all 4 books, same as yardage.
  The earlier "+39% ROI" P14 regrade was a grading artifact (retracted); honest P14 = 55.1%
  hit, +1.1% at real prices / +5.2% at -110. The real structural quirk: 16% of attempts
  unders close PLUS money (vs 2% yardage) — but those hit only 46%, efficiently priced,
  no free lunch. P14 keeps its watch flag; economics thin but positive.
