# NCAAB Model Lab — feature ablations, engineered features, config

Train 22-23+23-24 · validate 24-25 (all decisions) · test 25-26 (once).
Metrics: margin MAE | edge↔cover corr | %games |edge|≥3 | ATS win% there.

## 1 — engineered cross-team features

| feature set | MAE | corr | %|edge|≥3 | win% |
|---|---|---|---|---|
| raw h/a columns only (v1-style) | 9.21 | 0.002 | 31% | 51.2% |
| engineered only (game-shaped) | 9.19 | -0.006 | 27% | 50.8% |
| raw + engineered | 9.16 | -0.001 | 26% | 50.6% |
| market baseline (predict -spread) | 8.80 | — | — | — |

## 2 — feature-group ablations (raw + engineered base)

| variant | MAE | corr | %|edge|≥3 | win% |
|---|---|---|---|---|
| FULL | 9.16 | -0.001 | 26% | 50.6% |
| minus kp_raw | 9.15 (-0.01) | 0.008 | 27% | 50.7% |
| minus box_raw | 9.13 (-0.03) | 0.013 | 25% | 51.3% |
| minus schedule | 9.16 (+0.00) | 0.001 | 26% | 51.4% |
| minus style | 9.18 (+0.02) | -0.005 | 27% | 50.6% |
| minus streaks | 9.17 (+0.01) | 0.000 | 26% | 50.8% |
| minus rematch | 9.15 (-0.01) | 0.001 | 25% | 51.0% |
| minus roster | 9.15 (-0.01) | 0.006 | 26% | 51.2% |
| minus flags | 9.16 (-0.00) | -0.000 | 26% | 50.6% |
| ONLY kp_raw | 9.27 | -0.021 | 30% | 49.6% |
| ONLY box_raw | 10.19 | -0.012 | 54% | 50.5% |
| ONLY schedule | 11.13 | -0.007 | 68% | 51.3% |
| ONLY style | 10.44 | -0.010 | 62% | 50.2% |
| ONLY streaks | 10.55 | -0.021 | 62% | 50.0% |
| ONLY rematch | 11.03 | -0.013 | 61% | 51.1% |
| ONLY roster | 10.66 | -0.002 | 67% | 51.7% |
| ONLY flags | 11.35 | -0.007 | 67% | 51.3% |

## 3 — hyperparameter grid (validation MAE / corr)

| lr | leaves | min_leaf | iters | MAE | corr | win% |edge|≥3 |
|---|---|---|---|---|---|---|
| 0.03 | 15 | 40 | 700 | 9.14 | 0.001 | 51.0% |
| 0.03 | 31 | 40 | 700 | 9.14 | 0.004 | 51.1% |
| 0.03 | 31 | 80 | 700 | 9.16 | 0.004 | 51.0% |
| 0.03 | 63 | 80 | 700 | 9.19 | 0.006 | 50.8% |
| 0.05 | 15 | 40 | 300 | 9.13 | 0.003 | 51.9% |
| 0.05 | 15 | 80 | 700 | 9.11 | 0.010 | 51.3% |
| 0.05 | 31 | 20 | 300 | 9.15 | 0.007 | 50.8% |
| 0.05 | 31 | 40 | 300 | 9.16 | -0.001 | 50.6% |
| 0.05 | 31 | 40 | 700 | 9.16 | -0.001 | 50.6% |
| 0.05 | 63 | 80 | 300 | 9.21 | 0.001 | 50.7% |
| 0.1 | 15 | 80 | 300 | 9.14 | 0.001 | 50.5% |
| 0.1 | 31 | 40 | 300 | 9.21 | -0.010 | 49.3% |

Best config: {'learning_rate': 0.05, 'max_leaf_nodes': 15, 'min_samples_leaf': 80, 'max_iter': 700} (val MAE 9.11)

## 4 — FINAL: walk-forward, all seasons, chosen config

Margin MAE across 3 test seasons: market 8.86 | model 9.23

### Edge → empirical P(cover) calibration (the per-game product number)

| model edge (home persp) | n | home cover % | per season |
|---|---|---|---|
| [-99,-6) | 636 | 48.6% | 2023-24: 47% · 2024-25: 49% · 2025-26: 52% |
| [-6,-4) | 946 | 45.8% | 2023-24: 45% · 2024-25: 49% · 2025-26: 43% |
| [-4,-2) | 2,359 | 48.9% | 2023-24: 46% · 2024-25: 51% · 2025-26: 50% |
| [-2,0) | 4,311 | 48.7% | 2023-24: 52% · 2024-25: 48% · 2025-26: 47% |
| [0,2) | 4,453 | 50.3% | 2023-24: 51% · 2024-25: 50% · 2025-26: 50% |
| [2,4) | 2,595 | 50.4% | 2023-24: 53% · 2024-25: 51% · 2025-26: 48% |
| [4,6) | 1,064 | 55.0% | 2023-24: 52% · 2024-25: 60% · 2025-26: 55% |
| [6,99) | 709 | 50.8% | 2023-24: 52% · 2024-25: 49% · 2025-26: 48% |


## 5 — pruned model (post-ablation: kp_raw + style + engineered only)

val MAE 9.13, corr 0.012 (best of lab); walk-forward MAE 9.25 vs market 8.86.
Calibration (3 seasons pooled): edge [2,4) → 51.5% · [4,6) → 52.3% ·
**edge ≤ -6 → AWAY covers 54.2% (n=692)** — the away tail is the model's
best cell, consistent with the home-shading asymmetry.

## Verdict (2026-07-16)

1. **What helps:** dated KenPom (the backbone — alone it's within 0.11 MAE of
   the full model), engineered cross-team differentials (raw→engineered+raw:
   9.21→9.16; the multiplicative margin_struct and off-vs-def crosses do the
   work), a dash of style. Shallow, heavily regularized trees (15 leaves,
   min 80/leaf).
2. **What hurts or does nothing:** raw per-team boxscore columns (removing
   them IMPROVES MAE and corr — they're noise the tree overfits), streaks,
   rematch details, roster attributes, availability flags (as model features;
   they work as bet-layer signals because they're rare and conditional —
   inside a 23k-game fit they're diluted), schedule.
3. **The ceiling is the information set, not the config.** Every input we
   have is also in the market's models. Val MAE plateaus ≈9.11-9.13 vs
   market 8.80 across all configs — a 0.3-pt gap no aggregation closes.
4. **Path to actually better per-game numbers = better inputs:** CBBD has a
   /plays endpoint — possession-level data would let us build garbage-time-
   filtered, opponent-adjusted, lineup-aware efficiency (the CFB-rebuild
   recipe, where our own features finally carried non-market info). That is
   the recommended next data acquisition.
5. Meanwhile the pruned model IS the product baseline: calibrated cover
   probabilities every game, honest 52-54% in the tails, away tail best.


## 6 — possession-level features (CBBD /plays, 11.07M plays, 4 seasons)

Built garbage-time-filtered (WP 4-96%) efficiency, shot-mix for/against
(rim/jumper/three rates + FG% allowed by zone), assisted rate, FT rate, and
light opponent adjustment (build_possession_features.py). Result:

- val MAE UNCHANGED (9.13 with vs 9.13 without); possession-only 10.09 —
  weaker than KenPom alone (9.27). **KenPom already garbage-time-filters and
  opponent-adjusts; recomputing from plays reproduces his input, not new
  information.**
- One real gain: walk-forward calibration is now MONOTONE in the tails
  (edge [0,2) 49.5% → [2,4) 51.6% → [4,6) 52.8% → 6+ 53.1%) — previously
  non-monotone. Better product probabilities, same accuracy.
- The 0.3-MAE gap to the close (9.2 vs 8.86) survives every information and
  configuration lever we have. Conclusion: the residual gap is information
  the market gets AFTER public models — betting flow and real-time roster
  news. Which is precisely why the roster-news signal family works as the
  bet layer while the model serves as the calibrated baseline.

Remaining unexploited plays content (second-order, future): CBBD /lineups,
WP-dynamics (comeback profiles), foul timing, run patterns.


## 7 — Torvik/EvanMiya copyables + venue flags (2026-07-17)

Recency sample-weights (Torvik 40-day decay), per-team pace-sensitivity
slopes (EvanMiya), altitude/primetime/obscure flags: **val MAE unchanged
(9.13-9.14), corr unchanged.** Torvik is public → his recency structure is
already in the lines. The venue/spotlight effects express as BET-LAYER
signals (primetime-under, obscure-away — juice-shaded totals/public spots),
not as model-accuracy features. The 9.1-vs-8.8 wall stands. Remaining
information lever: /lineups player-impact (fetch in progress).
