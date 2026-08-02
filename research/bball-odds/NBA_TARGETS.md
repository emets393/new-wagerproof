# NBA — what should the model predict?

Every NBA model in this repo predicts a **residual**: the margin measured against the posted line, or a win as a 0/1. The other WagerProof models do not work that way — they predict the raw quantity, or they predict the **market itself** and bet the disagreement. Those are three different estimation problems sharing one bet rule, and they had never been compared here. This file compares them on identical rows, an identical rule, identical T-60 prices and the same 20 game-level null shuffles.

Frame: **10,558 team-games from 5,279 games**, four seasons, on the repaired outcome data (ESPN scores, Clippers home games restored, wrong-leg joins fixed). Oracle passes at 100.0% (spread) and 100.0% (moneyline); home covers 50.5% and wins 55.7%.

## The spread, four ways

All four are reduced to the same number before grading — **the model's margin minus the posted margin, in points** — so a `≥2` rung means the same thing in every table.

| variant | target | sees the line? | bet rule |
|---|---|---|---|
| **T1** | margin **residual** vs the posted line (current route) | yes | bet the sign |
| **T2** | **raw margin of victory** | yes | bet if predicted margin beats the line |
| **T3** | **raw margin of victory** | **no** | bet if predicted margin beats the line |
| **T4** | **the posted line itself** (a fair-line model) | **no** | bet if the fair line differs from the posted line |

### T1 — residual vs the line, market in the features (current route)

Prediction spread: **3.26 points** of disagreement with the posted line (sd). Correlation with the realised residual: **+0.0114**; with the realised margin: **+0.0746**.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,964 | 51.8 | 50.2 | **+1.5** | **-1.2** | -0.47 | 1.04 | **+1.91** |
| ≥2 | 2,045 | 51.0 | 50.8 | **+0.2** | **-2.6** | -0.33 | 1.32 | **+0.43** |
| ≥3 | 1,331 | 51.5 | 51.5 | **+0.0** | **-1.6** | -0.68 | 2.17 | **+0.31** |
| ≥4 | 856 | 51.6 | 50.7 | **+0.9** | **-1.4** | -0.98 | 1.98 | **+0.97** |
| ≥5 | 480 | 52.7 | 52.3 | **+0.4** | **+0.6** | -2.28 | 2.36 | **+1.14** |

### T2 — raw margin of victory, market in the features

Prediction spread: **3.43 points** of disagreement with the posted line (sd). Correlation with the realised residual: **+0.0070**; with the realised margin: **-0.0158**.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,001 | 50.9 | 50.2 | **+0.7** | **-2.8** | -0.59 | 0.49 | **+2.62** |
| ≥2 | 2,169 | 50.9 | 50.5 | **+0.5** | **-2.7** | -0.76 | 0.58 | **+2.13** |
| ≥3 | 1,446 | 51.7 | 50.3 | **+1.4** | **-1.2** | -1.06 | 0.69 | **+3.53** |
| ≥4 | 937 | 52.5 | 51.2 | **+1.3** | **+0.3** | -1.19 | 0.70 | **+3.54** |
| ≥5 | 544 | 54.4 | 50.2 | **+4.2** | **+3.9** | -1.25 | 0.66 | **+8.30** |

### T3 — raw margin of victory, market withheld

Prediction spread: **4.32 points** of disagreement with the posted line (sd). Correlation with the realised residual: **+0.0036**; with the realised margin: **-0.1011**.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,197 | 51.0 | 50.1 | **+0.9** | **-2.6** | -0.48 | 0.45 | **+3.00** |
| ≥2 | 2,498 | 50.4 | 50.3 | **+0.1** | **-3.7** | -0.61 | 0.49 | **+1.42** |
| ≥3 | 1,885 | 51.7 | 51.2 | **+0.5** | **-1.3** | -0.88 | 0.63 | **+2.17** |
| ≥4 | 1,347 | 50.8 | 52.4 | **-1.6** | **-3.0** | -1.17 | 0.61 | **-0.76** |
| ≥5 | 960 | 50.5 | 53.3 | **-2.8** | **-3.5** | -1.66 | 0.62 | **-1.86** |

### T4 — the posted line itself — a fair-line model, market withheld

Prediction spread: **3.11 points** of disagreement with the posted line (sd). Correlation with the realised residual: **-0.0081**; with the realised margin: **-0.2228**.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,868 | 49.9 | 50.2 | **-0.3** | **-4.8** | -0.66 | 0.23 | **+1.51** |
| ≥2 | 1,918 | 48.6 | 50.1 | **-1.4** | **-7.1** | -0.62 | 0.37 | **-2.12** |
| ≥3 | 1,173 | 49.0 | 51.4 | **-2.4** | **-6.3** | -0.69 | 0.37 | **-4.52** |
| ≥4 | 693 | 49.5 | 51.1 | **-1.6** | **-5.4** | -1.16 | 0.47 | **-0.91** |
| ≥5 | 401 | 51.9 | 50.6 | **+1.2** | **-0.9** | -1.76 | 0.60 | **+5.01** |

## Best spread target: **T2** — raw margin of victory, market in the features

Pooled numbers hide a signal that lives in one season or decays out, so the winner always runs alongside its own breakout. Every win% sits next to the base rate of **its own slice**.

### T2 broken out at the ≥5 cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 207 | 49.8 | 51.2 | **-1.4** | **-5.0** |
| 2024 | 167 | 59.9 | 50.3 | **+9.6** | **+14.4** |
| 2025 | 162 | 54.3 | 50.6 | **+3.7** | **+3.7** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 124 | 49.2 | 51.6 | **-2.4** | **-6.1** |
| MID | 145 | 53.1 | 51.0 | **+2.1** | **+1.4** |
| LATE | 235 | 56.6 | 51.9 | **+4.7** | **+8.1** |
| POST | 40 | 62.5 | 57.5 | **+5.0** | **+19.4** |

### which side, and is it just betting favourites

Baseline for a side table is the LEAGUE rate for that same side — `grade`'s best-blind-side baseline is self-referential once you have conditioned on the side taken.

| slice | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| home covers | 275 | 54.2 | 50.5 | **+3.7** | **+3.4** |
| away covers | 269 | 54.6 | 49.5 | **+5.1** | **+4.4** |
| model on the market's favourite | 229 | 54.6 | 53.7 | **+0.9** | **+4.2** |
| model on the market's dog | 315 | 54.3 | 53.0 | **+1.3** | **+3.7** |

## How much history should it train on?

The full-game total went from worthless to +4.5% ROI on recency weighting alone — pooled history was the worst of ten settings. The raw-margin target has never been swept.

**Graded at fixed SELECTIVITY, not a fixed points cut.** A shorter half-life makes the model more volatile, so a fixed `≥5 points` rung selects 1,389 bets at a 60-day half-life and 297 at pooled — comparing those is comparing two different strategies, not two memories. Held at the same top-N% of games, the confound disappears. It also changes the answer: at a fixed points cut the sweep looked like a lone spike at 180, which is exactly the shape that should not be trusted; at fixed selectivity it is a broad hill.

| half-life (days) | top 50% | top 25% | top 15% | top 9% | top 5% |
|---|---|---|---|---|---|
| 60 | **-3.0** | **-0.6** | **+1.8** | **+1.3** | **+4.7** |
| 90 | **-2.7** | **-1.4** | **+0.5** | **+5.6** | **+8.6** |
| 120 | **-2.0** | **-0.8** | **+2.4** | **+8.1** | **+5.7** |
| 180 | **-2.7** | **+0.0** | **+4.0** | **+3.2** | **-6.9** |
| 240 | **-2.2** | **-0.3** | **+1.5** | **-0.6** | **-1.1** |
| 365 | **-2.8** | **-0.9** | **-1.4** | **-3.1** | **-6.0** |
| **None (pooled)** | **-2.3** | **-1.5** | **-4.7** | **-6.0** | **-4.0** |

ROI, in %. Two things read straight off it. **The recency law replicates**: pooled and 365-day are negative in every column, and every setting from 60 to 180 days is positive once the bets are selective. And **selectivity matters more than memory** — at the top 50% and top 25% of disagreements nothing works at any half-life, so the edge is entirely in the tail. The best single cell is one of 35; its neighbours run roughly +2 to +6, which is the range worth believing rather than the argmax.

## The moneyline, four ways

Same treatment. Everything is reduced to **the model's home win probability minus the de-vigged posted probability, in percentage points**, and bet at the posted price — so unlike the spread, the payout varies with the side taken and ROI is the number that matters, not win%.

| variant | target | sees the price? |
|---|---|---|
| **M1** | the win, as 0/1 (current route) | yes |
| **M2** | the **de-vigged posted probability** | **no** |
| **M3** | the **posted decimal price** | **no** |
| **M4** | derived from T3's margin through an as-of normal map | **no** |
| **M2d, M3d** | M2 and M3 **de-shrunk** — see below | **no** |

**Why M2 and M3 need a correction before they can be judged.** A ridge shrinks its predictions toward the mean, and when the target IS a probability that shrinkage is not symmetric in its consequences: M2 regressed on the market has slope **0.827**, so it systematically prices favourites as weaker than the book does and underdogs as stronger. The bet rule then takes the dog on **73.5%** of its bets and **83.7%** at the widest cut. That is not an opinion about basketball, it is the estimator's variance penalty leaking into the side selection, and grading it would be grading the artefact. M2d and M3d rescale the model's log-odds dispersion to match the market's using an **expanding, strictly-prior** ratio, which removes the bias without telling the model anything it could not have known. M1 does not need this — its slope is 0.991 and it takes the dog on 53% of bets, because a residual target has nothing to shrink toward.

### M1 — the win as 0/1, market in the features (current route)

Prediction spread: **11.02 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.991** (1.0 = unbiased); takes the underdog on **53.0%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,395 | 49.5 | 54.9 | **-5.4** | **-4.1** | -22.33 | 0.52 | **+32.52** |
| ≥4 | 2,842 | 49.3 | 55.1 | **-5.7** | **-4.7** | -23.25 | 0.67 | **+26.05** |
| ≥6 | 2,304 | 49.1 | 54.8 | **-5.7** | **-4.5** | -24.16 | 0.89 | **+20.81** |
| ≥8 | 1,808 | 49.1 | 55.3 | **-6.2** | **-5.0** | -25.01 | 0.93 | **+20.17** |
| ≥10 | 1,391 | 48.9 | 56.1 | **-7.3** | **-6.7** | -25.81 | 0.84 | **+22.14** |

### M2 — the de-vigged posted probability — a fair-price model

Prediction spread: **8.75 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.827** (1.0 = unbiased); takes the underdog on **73.5%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,198 | 40.8 | 54.8 | **-14.0** | **-6.0** | -24.13 | 0.31 | **+32.32** |
| ≥4 | 2,472 | 38.6 | 54.4 | **-15.9** | **-7.2** | -25.28 | 0.40 | **+23.81** |
| ≥6 | 1,820 | 38.1 | 54.1 | **-15.9** | **-5.2** | -26.21 | 0.44 | **+23.55** |
| ≥8 | 1,279 | 36.5 | 53.3 | **-16.8** | **-6.6** | -27.25 | 0.50 | **+20.78** |
| ≥10 | 898 | 37.3 | 52.8 | **-15.5** | **-3.5** | -28.12 | 0.65 | **+19.43** |

### M3 — the posted decimal price itself

Prediction spread: **8.81 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.887** (1.0 = unbiased); takes the underdog on **60.6%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,152 | 42.9 | 55.0 | **-12.1** | **-9.0** | -23.34 | 0.46 | **+24.18** |
| ≥4 | 2,400 | 42.6 | 53.9 | **-11.2** | **-9.6** | -24.23 | 0.57 | **+22.88** |
| ≥6 | 1,708 | 43.2 | 51.8 | **-8.6** | **-7.0** | -25.09 | 0.63 | **+26.04** |
| ≥8 | 1,207 | 43.2 | 50.9 | **-7.7** | **-4.6** | -25.88 | 0.67 | **+27.07** |
| ≥10 | 845 | 40.6 | 51.1 | **-10.5** | **-7.0** | -26.77 | 0.79 | **+20.64** |

### M4 — T3's margin pushed through an as-of normal map

Prediction spread: **11.24 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.777** (1.0 = unbiased); takes the underdog on **69.2%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,348 | 41.0 | 54.0 | **-13.0** | **-5.1** | -23.21 | 0.60 | **+16.95** |
| ≥4 | 2,778 | 39.1 | 53.3 | **-14.2** | **-6.2** | -24.27 | 0.63 | **+15.96** |
| ≥6 | 2,251 | 38.1 | 53.0 | **-14.9** | **-5.7** | -25.15 | 0.69 | **+14.73** |
| ≥8 | 1,793 | 37.4 | 53.3 | **-16.0** | **-6.4** | -26.18 | 0.67 | **+15.35** |
| ≥10 | 1,401 | 36.0 | 52.9 | **-16.8** | **-7.9** | -27.15 | 0.73 | **+14.09** |

### M2d — the de-vigged posted probability, de-shrunk

Prediction spread: **9.96 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.789** (1.0 = unbiased); takes the underdog on **73.2%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,311 | 40.9 | 54.6 | **-13.7** | **-5.9** | -24.13 | 0.31 | **+33.17** |
| ≥4 | 2,677 | 39.3 | 54.4 | **-15.1** | **-6.7** | -25.28 | 0.39 | **+25.81** |
| ≥6 | 2,070 | 37.3 | 54.4 | **-17.1** | **-6.9** | -26.21 | 0.43 | **+21.14** |
| ≥8 | 1,557 | 35.9 | 53.6 | **-17.7** | **-7.1** | -27.25 | 0.50 | **+18.93** |
| ≥10 | 1,099 | 35.1 | 51.8 | **-16.7** | **-5.3** | -28.12 | 0.66 | **+17.37** |

### M3d — the posted decimal price, de-shrunk

Prediction spread: **17.57 percentage points** of disagreement with the de-vigged book (sd). Slope against the market **0.721** (1.0 = unbiased); takes the underdog on **60.4%** of its bets.

| cut (pct pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 3,569 | 43.1 | 54.7 | **-11.6** | **-7.8** | -23.33 | 0.47 | **+25.18** |
| ≥4 | 3,141 | 42.7 | 54.8 | **-12.1** | **-8.8** | -24.23 | 0.57 | **+21.33** |
| ≥6 | 2,758 | 42.1 | 54.1 | **-12.0** | **-9.6** | -25.09 | 0.63 | **+20.68** |
| ≥8 | 2,405 | 42.0 | 53.4 | **-11.4** | **-8.9** | -25.88 | 0.67 | **+21.60** |
| ≥10 | 2,073 | 41.5 | 53.8 | **-12.3** | **-9.2** | -26.76 | 0.79 | **+18.43** |

## Best moneyline target: **M2** — the de-vigged posted probability — a fair-price model

### M2 broken out at the ≥10 cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 250 | 31.6 | 52.8 | **-21.2** | **-23.6** |
| 2024 | 337 | 39.8 | 53.7 | **-13.9** | **-1.5** |
| 2025 | 300 | 39.7 | 51.0 | **-11.3** | **+12.1** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 281 | 33.1 | 53.4 | **-20.3** | **-13.7** |
| MID | 195 | 46.2 | 52.8 | **-6.7** | **+9.0** |
| LATE | 343 | 35.3 | 51.6 | **-16.3** | **-7.3** |
| POST | 79 | 39.2 | 55.7 | **-16.5** | **+18.4** |

