# NFL player-props model — v2 verdict (RESEARCH ONLY)

Redo of `prop_model.py` after the NBA post-mortem, applying the same two structural fixes and the
same grading guardrails. **Production untouched** — no dryrun tables, P-flags, grading RPCs, or other
sports were modified. Scripts: `nfl_prop_model_v2.py` (frame + positional-allowed + leak screen),
`nfl_prop_grade_v2.py` (decomposition + product test + ladder + oracle). Eval = 2024–25 (the only
seasons with T-60 prop lines), graded at the T-60 close with American→decimal prices.

## Headline
**The current NFL model was already about as good as it gets, and the NBA fixes do NOT transfer.**
The defects were real and I fixed them, but in the NFL they don't help: adding the line as a feature
*hurt*, the positional context improved the model's accuracy but never beat the closing line, and
pooled bet ROI got *worse* with each fix. The NFL prop market is sharp — this is a **pricing** verdict,
not a modelling one. One small pocket (rush-attempts UNDER) is worth tracking. The NBA "edge grows
with line size" law does **not** reproduce here.

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
