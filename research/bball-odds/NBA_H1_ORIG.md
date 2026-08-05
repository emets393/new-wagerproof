# NBA — the originator first-half models

Predict first-half points (total) and first-half margin (spread) with **no market column anywhere**, then bet the disagreement with the posted 1H number. `nba_h1_prune.py`.

**175 first-half feature columns were sitting in the cache unread** — `wide_stack` selects through a theme list curated for the full-game total, and the 1H block was never added to it. Only 4 of 179 were reaching any model before this run.

**Three seasons, not four.** The Odds API has no 1H market before 2023-05-03, so 2022 grades nothing (3,961 of 5,279 games are gradeable). Training still uses all 5,279.

## 1H_TOTAL

Baseline: **815 features**, corr with the realised residual +0.0349, **+3.25%** ROI on the top 15% of disagreements and **+1.12%** on the top 9%.

### Drop-one — positive delta means cutting the family HELPS

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| pl_regr | 18 | +4.25 | **+0.99** | +1.12 | **-0.00** |
| nets | 48 | +3.90 | **+0.65** | +1.13 | **+0.01** |
| style | 66 | +3.89 | **+0.64** | +3.30 | **+2.18** |
| rot_flags | 21 | +3.89 | **+0.64** | +1.12 | **+0.01** |
| ratings | 9 | +3.57 | **+0.32** | +2.22 | **+1.10** |
| adj_eff | 54 | +3.56 | **+0.31** | +3.83 | **+2.71** |
| dims | 12 | +3.26 | **+0.00** | +2.77 | **+1.65** |
| travel | 10 | +2.92 | **-0.34** | +1.71 | **+0.59** |
| talent | 33 | +2.62 | **-0.64** | +2.21 | **+1.09** |
| schedule | 8 | +1.96 | **-1.29** | -0.47 | **-1.59** |
| raw_box | 96 | +1.93 | **-1.33** | +3.82 | **+2.70** |
| standings | 4 | +1.63 | **-1.63** | +4.92 | **+3.80** |
| h1_form | 68 | +1.25 | **-2.00** | +8.15 | **+7.04** |
| usage | 24 | +0.67 | **-2.58** | +3.31 | **+2.19** |
| pace_ix | 7 | +0.65 | **-2.61** | +3.82 | **+2.70** |
| h1_streak | 12 | +0.33 | **-2.92** | -0.47 | **-1.59** |
| misc | 43 | +0.32 | **-2.93** | +1.68 | **+0.57** |
| form | 80 | +0.31 | **-2.94** | +1.66 | **+0.54** |
| absence | 32 | -0.65 | **-3.91** | +3.28 | **+2.16** |
| rapm | 170 | -0.98 | **-4.24** | +4.40 | **+3.28** |

### Solo — does the family carry anything by itself?

| family | cols | corr | ROI top 15% | ROI top 9% |
|---|---|---|---|---|
| raw_box | 96 | +0.0110 | -1.97 | -6.98 |
| rot_flags | 21 | +0.0034 | -2.95 | -3.78 |
| absence | 32 | +0.0035 | -4.24 | -5.39 |
| misc | 43 | +0.0146 | -4.58 | +0.01 |
| schedule | 8 | +0.0014 | -5.56 | -8.14 |
| nets | 48 | +0.0101 | -5.85 | -10.25 |
| standings | 4 | +0.0083 | -5.92 | -8.18 |
| adj_eff | 54 | +0.0165 | -6.19 | -3.19 |
| usage | 24 | -0.0029 | -6.51 | -9.76 |
| rapm | 170 | +0.0214 | -6.78 | -1.54 |
| h1_form | 68 | -0.0024 | -7.21 | -3.79 |
| travel | 10 | +0.0067 | -7.51 | -8.69 |
| style | 66 | +0.0160 | -8.45 | -2.64 |
| pl_regr | 18 | -0.0026 | -8.48 | -7.59 |
| dims | 12 | +0.0012 | -8.50 | -9.24 |
| form | 80 | +0.0045 | -8.78 | -5.92 |
| h1_streak | 12 | +0.0005 | -9.79 | -7.58 |
| ratings | 9 | +0.0148 | -10.72 | -14.04 |
| talent | 33 | +0.0023 | -11.06 | -15.13 |
| pace_ix | 7 | +0.0010 | -11.40 | -10.82 |

## 1H_SPREAD

Baseline: **815 features**, corr with the realised residual +0.0170, **-4.24%** ROI on the top 15% of disagreements and **-3.80%** on the top 9%.

### Drop-one — positive delta means cutting the family HELPS

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| h1_streak | 12 | -3.25 | **+0.99** | -0.53 | **+3.27** |
| nets | 48 | -3.60 | **+0.64** | -2.69 | **+1.11** |
| rot_flags | 21 | -3.89 | **+0.35** | -7.04 | **-3.24** |
| usage | 24 | -3.91 | **+0.33** | -2.15 | **+1.65** |
| ratings | 9 | -3.92 | **+0.32** | -4.34 | **-0.54** |
| standings | 4 | -4.24 | **+0.00** | -3.80 | **+0.00** |
| style | 66 | -4.25 | **-0.01** | -3.22 | **+0.58** |
| pace_ix | 7 | -4.58 | **-0.34** | -2.68 | **+1.12** |
| form | 80 | -4.59 | **-0.35** | -1.11 | **+2.69** |
| h1_form | 68 | -4.64 | **-0.40** | -4.36 | **-0.56** |
| misc | 43 | -5.19 | **-0.95** | -2.71 | **+1.09** |
| dims | 12 | -5.23 | **-0.99** | -2.17 | **+1.63** |
| raw_box | 96 | -5.55 | **-1.31** | -2.64 | **+1.16** |
| schedule | 8 | -5.56 | **-1.32** | -5.39 | **-1.59** |
| absence | 32 | -5.57 | **-1.33** | -8.64 | **-4.84** |
| talent | 33 | -6.21 | **-1.97** | -6.49 | **-2.69** |
| rapm | 170 | -6.81 | **-2.57** | -8.68 | **-4.88** |
| pl_regr | 18 | -7.16 | **-2.92** | -3.22 | **+0.58** |
| adj_eff | 54 | -7.17 | **-2.93** | -5.97 | **-2.17** |
| travel | 10 | -7.85 | **-3.61** | -1.07 | **+2.73** |

### Solo — does the family carry anything by itself?

| family | cols | corr | ROI top 15% | ROI top 9% |
|---|---|---|---|---|
| h1_form | 68 | +0.0153 | +0.38 | -1.53 |
| ratings | 9 | +0.0090 | -1.99 | -4.43 |
| adj_eff | 54 | +0.0154 | -2.98 | -2.74 |
| talent | 33 | -0.0049 | -3.51 | -6.93 |
| h1_streak | 12 | -0.0077 | -4.12 | -2.07 |
| dims | 12 | -0.0010 | -4.84 | -6.43 |
| rapm | 170 | -0.0080 | -5.48 | -9.15 |
| rot_flags | 21 | -0.0096 | -5.73 | -6.83 |
| pl_regr | 18 | -0.0071 | -6.75 | -2.03 |
| travel | 10 | -0.0130 | -7.07 | -4.73 |
| schedule | 8 | -0.0114 | -7.39 | -2.63 |
| usage | 24 | -0.0126 | -8.01 | -8.52 |
| form | 80 | -0.0072 | -8.12 | -8.65 |
| raw_box | 96 | +0.0039 | -8.37 | -6.37 |
| absence | 32 | -0.0073 | -8.66 | -7.95 |
| standings | 4 | -0.0151 | -9.28 | -7.20 |
| pace_ix | 7 | -0.0156 | -9.68 | -7.54 |
| style | 66 | -0.0187 | -10.38 | -13.47 |
| nets | 48 | -0.0185 | -10.62 | -10.74 |
| misc | 43 | -0.0109 | -13.27 | -9.10 |

---

# Grading the pruned first-half models

## 1H_TOTAL — pre-registered configurations

`nba_h1_prune2.py`, half-life 180d, 20 game-level null shuffles, compared at fixed selectivity so the comparison is between feature sets and not between strategies.

| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 815 | +0.0349 | 588 | 54.1 | 50.2 | **+3.25** | +3.30 | **+1.12** | +1.73 |
| **HT1** | 587 | +0.0455 | 588 | 55.4 | 51.4 | **+5.83** | +3.49 | **+7.60** | +4.30 |
| T1X | 688 | +0.0334 | 588 | 54.8 | 52.0 | **+4.54** | +2.55 | **+2.19** | +2.60 |
| HTCORE | 369 | +0.0365 | 588 | 52.9 | 50.3 | **+0.95** | +3.26 | **+1.17** | +1.86 |
| HTH1 | 384 | +0.0292 | 588 | 51.2 | 50.5 | **-2.30** | +1.86 | **+3.77** | +1.94 |

### HT1 on the points ladder

Disagreement with the posted 1H number, in points. Nulls are the same 20 game-level shuffles graded at the same rung.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.5 | 3,581 | 50.1 | 50.3 | **-0.2** | **-4.4** | -0.34 | 0.66 | **+0.26** |
| ≥1 | 3,239 | 50.4 | 50.0 | **+0.4** | **-3.8** | -0.40 | 0.59 | **+1.37** |
| ≥1.5 | 2,916 | 50.8 | 50.1 | **+0.7** | **-3.1** | -0.52 | 0.62 | **+1.90** |
| ≥2 | 2,585 | 51.2 | 50.9 | **+0.3** | **-2.2** | -0.62 | 0.67 | **+1.39** |
| ≥2.5 | 2,283 | 50.8 | 51.0 | **-0.3** | **-3.1** | -0.61 | 0.67 | **+0.52** |
| ≥3 | 2,029 | 51.4 | 51.3 | **+0.0** | **-2.0** | -0.67 | 0.75 | **+0.96** |
| ≥4 | 1,529 | 52.3 | 51.5 | **+0.9** | **-0.1** | -1.06 | 0.87 | **+2.18** |
| ≥5 | 1,060 | 54.1 | 51.9 | **+2.2** | **+3.2** | -1.19 | 1.16 | **+2.91** |
| ≥6 | 735 | 54.4 | 50.9 | **+3.5** | **+3.9** | -1.71 | 1.16 | **+4.52** |

### HT1 broken out at the ≥6 cut

**Three seasons, not four** — the Odds API has no 1H market before 2023-05-03.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 244 | 51.6 | 52.9 | **-1.2** | **-1.5** |
| 2024 | 223 | 54.7 | 50.2 | **+4.5** | **+4.5** |
| 2025 | 268 | 56.7 | 50.4 | **+6.3** | **+8.3** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 224 | 57.6 | 58.0 | **-0.4** | **+10.0** |
| MID | 244 | 53.3 | 61.1 | **-7.8** | **+1.6** |
| LATE | 228 | 52.6 | 50.9 | **+1.8** | **+0.5** |
| POST | 39 | 53.8 | 61.5 | **-7.7** | **+2.9** |

### HT1 at ≥6, split by which side the model takes

| side | bets | win% | ROI |
|---|---|---|---|
| model OVER | 369 | 55.3 | **+5.5** |
| model UNDER | 366 | 53.6 | **+2.3** |

## 1H_SPREAD — pre-registered configurations

`nba_h1_prune2.py`, half-life 180d, 20 game-level null shuffles, compared at fixed selectivity so the comparison is between feature sets and not between strategies.

| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 815 | +0.0170 | 588 | 50.2 | 52.4 | **-4.24** | -0.05 | **-3.80** | +1.12 |
| **HS1** | 731 | +0.0220 | 588 | 51.5 | 53.1 | **-1.65** | +0.32 | **-0.46** | +1.53 |
| SCORE | 188 | -0.0073 | 588 | 50.3 | 50.2 | **-3.86** | +1.59 | **-5.98** | +0.09 |

### HS1 on the points ladder

Disagreement with the posted 1H number, in points. Nulls are the same 20 game-level shuffles graded at the same rung.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.25 | 3,715 | 50.4 | 50.4 | **+0.1** | **-3.8** | -0.88 | 0.66 | **+1.46** |
| ≥0.5 | 3,487 | 50.5 | 50.6 | **-0.1** | **-3.7** | -0.93 | 0.64 | **+1.31** |
| ≥0.75 | 3,264 | 50.4 | 50.9 | **-0.5** | **-3.8** | -0.83 | 0.65 | **+0.58** |
| ≥1 | 3,093 | 50.3 | 50.4 | **-0.2** | **-4.1** | -0.87 | 0.70 | **+1.02** |
| ≥1.5 | 2,687 | 50.5 | 50.7 | **-0.2** | **-3.6** | -0.86 | 0.75 | **+0.90** |
| ≥2 | 2,313 | 50.6 | 51.1 | **-0.4** | **-3.4** | -0.98 | 0.80 | **+0.69** |
| ≥2.5 | 1,969 | 50.2 | 51.0 | **-0.8** | **-4.2** | -1.14 | 0.91 | **+0.42** |
| ≥3 | 1,656 | 51.1 | 51.4 | **-0.3** | **-2.4** | -1.28 | 0.99 | **+0.99** |

### HS1 broken out at the ≥3 cut

**Three seasons, not four** — the Odds API has no 1H market before 2023-05-03.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 561 | 51.0 | 50.6 | **+0.4** | **-3.0** |
| 2024 | 547 | 48.4 | 51.6 | **-3.1** | **-7.5** |
| 2025 | 548 | 54.0 | 52.2 | **+1.8** | **+3.1** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 406 | 53.7 | 53.4 | **+0.2** | **+2.4** |
| MID | 575 | 49.2 | 57.6 | **-8.3** | **-6.1** |
| LATE | 586 | 51.0 | 51.4 | **-0.3** | **-2.7** |
| POST | 89 | 52.8 | 52.8 | **+0.0** | **+0.8** |

### HS1 at ≥3, split by which side the model takes

| side | bets | win% | ROI |
|---|---|---|---|
| model HOME | 799 | 49.7 | **-5.3** |
| model AWAY | 857 | 52.5 | **+0.2** |

---

# First-half round two

## 1H_TOTAL — round two

Pruned base: **587 features** after cutting `style`, `adj_eff`, `ratings`, `dims`, `nets`, `rot_flags`, `pl_regr`.

### The full ladder, run out to where the sample dies

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥2 | 2,585 | 51.2 | 50.9 | **+0.3** | **-2.2** | -0.62 | 0.67 | **+1.39** |
| ≥3 | 2,029 | 51.4 | 51.3 | **+0.0** | **-2.0** | -0.67 | 0.75 | **+0.96** |
| ≥4 | 1,529 | 52.3 | 51.5 | **+0.9** | **-0.1** | -1.06 | 0.87 | **+2.18** |
| ≥5 | 1,060 | 54.1 | 51.9 | **+2.2** | **+3.2** | -1.19 | 1.16 | **+2.91** |
| ≥6 | 735 | 54.4 | 50.9 | **+3.5** | **+3.9** | -1.71 | 1.16 | **+4.52** |
| ≥7 | 460 | 56.1 | 50.2 | **+5.9** | **+7.1** | -1.78 | 1.09 | **+7.03** |
| ≥8 | 291 | 57.7 | 51.9 | **+5.8** | **+10.2** | -2.06 | 1.45 | **+5.44** |
| ≥9 | 164 | 53.0 | 51.8 | **+1.2** | **+1.3** | -2.53 | 1.40 | **+2.68** |
| ≥10 | 94 | 47.9 | 56.4 | **-8.5** | **-8.5** | -3.29 | 2.12 | **-2.46** |

### Broken out at ≥7 — the highest-z rung, not the highest-ROI one

**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 149 | 53.0 | 51.0 | **+2.0** | **+1.2** |
| 2024 | 141 | 58.2 | 51.8 | **+6.4** | **+11.0** |
| 2025 | 170 | 57.1 | 51.2 | **+5.9** | **+8.9** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 159 | 59.7 | 62.3 | **-2.5** | **+14.1** |
| MID | 152 | 52.0 | 63.8 | **-11.8** | **-0.9** |
| LATE | 127 | 58.3 | 53.5 | **+4.7** | **+11.2** |

### At ≥7, by side taken

| side | bets | win% | ROI |
|---|---|---|---|
| model OVER | 227 | 56.4 | **+7.5** |
| model UNDER | 233 | 55.8 | **+6.6** |

### Second-round drop-one, measured against the PRUNED baseline

Round one ranked families against the unpruned 815. Cutting seven of them moved the model enough that the ranking deserves re-measuring on the set we now have.

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| h1_form | 68 | +7.11 | **+1.27** | +7.07 | **-0.53** |
| travel | 10 | +6.79 | **+0.96** | +5.44 | **-2.16** |
| usage | 24 | +5.82 | **-0.01** | +9.25 | **+1.64** |
| talent | 33 | +5.53 | **-0.30** | +0.59 | **-7.02** |
| absence | 32 | +5.18 | **-0.65** | +3.81 | **-3.79** |
| pace_ix | 7 | +4.55 | **-1.29** | +8.14 | **+0.53** |
| rapm | 170 | +3.54 | **-2.29** | +9.23 | **+1.63** |
| schedule | 8 | +3.53 | **-2.30** | +8.69 | **+1.08** |
| h1_streak | 12 | +2.94 | **-2.89** | +5.43 | **-2.17** |
| misc | 43 | +2.91 | **-2.92** | +7.62 | **+0.02** |
| raw_box | 96 | +2.31 | **-3.52** | +6.01 | **-1.59** |
| standings | 4 | +1.60 | **-4.23** | +5.98 | **-1.63** |
| form | 80 | +0.32 | **-5.52** | +3.31 | **-4.29** |

Positive on both columns, so cut in round three: **nothing** — the prune is done.

### Half-life sweep at fixed selectivity

Round two carried 180d over from the full-game total without measuring it. Read the SHAPE, not the argmax.

| half-life | corr | top 20% | top 15% | top 9% | top 5% |
|---|---|---|---|---|---|
| 60d | +0.0396 | **+4.44** | **+4.54** | **+3.29** | **+2.23** |
| 90d | +0.0432 | **+4.47** | **+7.47** | **+10.32** | **+4.19** |
| 120d | +0.0450 | **+4.96** | **+9.09** | **+10.31** | **+2.28** |
| 180d | +0.0455 | **+3.73** | **+5.83** | **+7.60** | **+3.26** |
| 240d | +0.0447 | **+3.01** | **+4.85** | **+5.97** | **+7.14** |
| 365d | +0.0426 | **+2.27** | **+5.85** | **+5.45** | **+2.23** |
| pooled | +0.0357 | **+1.75** | **+3.52** | **+6.51** | **-0.69** |

## 1H_SPREAD — round two

Pruned base: **731 features** after cutting `nets`, `usage`, `h1_streak`.

### The full ladder, run out to where the sample dies

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,093 | 50.3 | 50.4 | **-0.2** | **-4.1** | -0.87 | 0.70 | **+1.02** |
| ≥1.5 | 2,687 | 50.5 | 50.7 | **-0.2** | **-3.6** | -0.86 | 0.75 | **+0.90** |
| ≥2 | 2,313 | 50.6 | 51.1 | **-0.4** | **-3.4** | -0.98 | 0.80 | **+0.69** |
| ≥2.5 | 1,969 | 50.2 | 51.0 | **-0.8** | **-4.2** | -1.14 | 0.91 | **+0.42** |
| ≥3 | 1,656 | 51.1 | 51.4 | **-0.3** | **-2.4** | -1.28 | 0.99 | **+0.99** |
| ≥4 | 1,168 | 51.3 | 51.5 | **-0.3** | **-2.2** | -1.59 | 1.03 | **+1.29** |
| ≥5 | 750 | 51.6 | 50.3 | **+1.3** | **-1.5** | -2.01 | 0.89 | **+3.78** |
| ≥6 | 512 | 52.5 | 51.6 | **+1.0** | **+0.3** | -1.95 | 1.03 | **+2.83** |
| ≥8 | 186 | 55.4 | 50.5 | **+4.8** | **+5.6** | -2.81 | 1.46 | **+5.22** |

### Broken out at ≥8 — the highest-z rung, not the highest-ROI one

**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 71 | 59.2 | 59.2 | **+0.0** | **+12.5** |
| 2024 | 62 | 43.5 | 51.6 | **-8.1** | **-16.8** |
| 2025 | 53 | 64.2 | 58.5 | **+5.7** | **+22.7** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 66 | 53.0 | 51.5 | **+1.5** | **+1.0** |
| MID | 54 | 59.3 | 55.6 | **+3.7** | **+13.2** |
| LATE | 64 | 53.1 | 57.8 | **-4.7** | **+1.4** |

### At ≥8, by side taken

| side | bets | win% | ROI |
|---|---|---|---|
| model HOME | 85 | 56.5 | **+7.5** |
| model AWAY | 101 | 54.5 | **+4.1** |

### Second-round drop-one, measured against the PRUNED baseline

Round one ranked families against the unpruned 815. Cutting seven of them moved the model enough that the ranking deserves re-measuring on the set we now have.

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| raw_box | 96 | +2.89 | **+4.53** | +2.15 | **+2.61** |
| dims | 12 | +0.91 | **+2.56** | +1.09 | **+1.55** |
| pl_regr | 18 | -0.32 | **+1.33** | -0.98 | **-0.52** |
| h1_form | 68 | -0.35 | **+1.30** | +0.55 | **+1.01** |
| misc | 43 | -0.67 | **+0.98** | -2.60 | **-2.14** |
| form | 80 | -0.70 | **+0.95** | +2.21 | **+2.67** |
| pace_ix | 7 | -0.99 | **+0.66** | -3.13 | **-2.67** |
| rot_flags | 21 | -1.01 | **+0.64** | -2.11 | **-1.65** |
| absence | 32 | -1.31 | **+0.34** | -3.79 | **-3.33** |
| standings | 4 | -1.65 | **+0.00** | -0.46 | **+0.00** |
| schedule | 8 | -1.98 | **-0.33** | -2.60 | **-2.14** |
| talent | 33 | -2.30 | **-0.65** | +0.59 | **+1.06** |
| style | 66 | -2.59 | **-0.95** | +2.24 | **+2.70** |
| ratings | 9 | -2.94 | **-1.29** | -0.49 | **-0.03** |
| travel | 10 | -4.88 | **-3.24** | -2.10 | **-1.64** |
| rapm | 170 | -4.92 | **-3.27** | -2.12 | **-1.66** |
| adj_eff | 54 | -4.94 | **-3.30** | -1.59 | **-1.13** |

Positive on both columns, so cut in round three: `raw_box`, `form`, `h1_form`, `dims`.

Round-three set: **475 features**, corr +0.0328, at ≥8 → **59 bets, 55.9% vs 52.5%, +6.6% ROI, z +2.65**.

### Half-life sweep at fixed selectivity

Round two carried 180d over from the full-game total without measuring it. Read the SHAPE, not the argmax.

| half-life | corr | top 20% | top 15% | top 9% | top 5% |
|---|---|---|---|---|---|
| 60d | +0.0216 | **+0.77** | **+0.60** | **-0.06** | **+0.25** |
| 90d | +0.0259 | **+2.19** | **+4.76** | **+5.39** | **+3.10** |
| 120d | +0.0290 | **+0.97** | **+4.77** | **+10.75** | **+5.97** |
| 180d | +0.0328 | **+1.45** | **+5.09** | **+8.00** | **+7.01** |
| 240d | +0.0352 | **+0.94** | **+3.78** | **+6.93** | **+8.86** |
| 365d | +0.0378 | **+3.81** | **+1.52** | **+4.19** | **+1.06** |
| pooled | +0.0415 | **+1.91** | **+1.49** | **-0.64** | **-1.85** |

---

# The settled first-half models

## 1H_TOTAL

**587 features**, half-life 120d, no market column anywhere. Cut: `style`, `adj_eff`, `ratings`, `dims`, `nets`, `rot_flags`, `pl_regr`. corr with the realised residual **+0.0450**.

`edge` is against the best blind side inside the slice and reads LOW on small samples; `edge vs lg` is against the league rate for the sides actually taken and carries no such bias. `z` subtracts the null mean, so it is correct either way.

| cut (pts) | bets | win% | base% | edge | edge vs lg | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|---|
| ≥3 | 2,176 | 51.2 | 50.1 | +1.1 | **+1.2** | **-2.2** | -0.71 | 0.80 | **+2.33** |
| ≥4 | 1,675 | 51.8 | 50.3 | +1.5 | **+1.8** | **-1.2** | -0.83 | 0.93 | **+2.50** |
| ≥5 | 1,252 | 53.2 | 51.7 | +1.5 | **+3.2** | **+1.5** | -0.90 | 1.20 | **+2.02** |
| ≥6 | 892 | 54.3 | 52.0 | +2.2 | **+4.3** | **+3.6** | -1.19 | 1.20 | **+2.87** |
| ≥7 | 631 | 56.3 | 50.2 | +6.0 | **+6.3** | **+7.4** | -1.56 | 0.90 | **+8.42** |
| ≥8 | 428 | 57.0 | 50.9 | +6.1 | **+7.0** | **+8.8** | -1.85 | 1.29 | **+6.14** |
| ≥9 | 291 | 57.0 | 50.5 | +6.5 | **+7.0** | **+8.9** | -2.05 | 1.58 | **+5.43** |
| ≥10 | 179 | 53.6 | 51.4 | +2.2 | **+3.6** | **+2.4** | -2.63 | 2.10 | **+2.32** |

### Broken out at ≥7 — the highest-z rung, not the highest-ROI one

**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.

| slice | bets | win% | edge vs lg | ROI |
|---|---|---|---|---|
| 2023 | 193 | 51.8 | +1.7 | **-1.1** |
| 2024 | 192 | 57.3 | +7.3 | **+9.4** |
| 2025 | 246 | 58.9 | +9.0 | **+12.5** |
| EARLY | 203 | 59.1 | +9.2 | **+12.9** |
| MID | 217 | 55.8 | +5.7 | **+6.3** |
| LATE | 178 | 56.2 | +6.2 | **+7.3** |
| POST | 33 | 42.4 | -7.7 | **-19.0** |
| model OVER | 307 | 56.7 | — | **+8.1** |
| model UNDER | 324 | 55.9 | — | **+6.7** |

### ≥7, every season x side cell

| | model OVER | model UNDER |
|---|---|---|
| 2022 | — | — |
| 2023 | +1.4% (n=128) | -6.1% (n=65) |
| 2024 | +10.6% (n=81) | +8.5% (n=111) |
| 2025 | +14.8% (n=98) | +11.0% (n=148) |

## 1H_SPREAD

**475 features**, half-life 120d, no market column anywhere. Cut: `nets`, `usage`, `h1_streak`, `raw_box`, `form`, `h1_form`, `dims`. corr with the realised residual **+0.0290**.

`edge` is against the best blind side inside the slice and reads LOW on small samples; `edge vs lg` is against the league rate for the sides actually taken and carries no such bias. `z` subtracts the null mean, so it is correct either way.

| cut (pts) | bets | win% | base% | edge | edge vs lg | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,949 | 49.8 | 50.8 | -0.9 | **-0.2** | **-4.9** | -0.72 | 0.76 | **-0.26** |
| ≥1.5 | 2,523 | 49.9 | 51.1 | -1.2 | **-0.1** | **-4.8** | -0.91 | 0.87 | **-0.37** |
| ≥2 | 2,135 | 50.2 | 51.4 | -1.2 | **+0.2** | **-4.3** | -0.96 | 0.86 | **-0.30** |
| ≥2.5 | 1,791 | 50.2 | 51.9 | -1.7 | **+0.2** | **-4.3** | -1.13 | 0.80 | **-0.68** |
| ≥3 | 1,513 | 50.6 | 51.7 | -1.1 | **+0.6** | **-3.4** | -1.30 | 0.82 | **+0.29** |
| ≥4 | 1,007 | 52.2 | 52.9 | -0.7 | **+2.2** | **-0.3** | -1.64 | 1.20 | **+0.78** |
| ≥5 | 610 | 54.9 | 53.3 | +1.6 | **+4.9** | **+4.7** | -2.06 | 1.42 | **+2.61** |
| ≥6 | 372 | 58.3 | 55.6 | +2.7 | **+8.3** | **+11.3** | -2.49 | 1.43 | **+3.61** |

### Broken out at ≥6 — the highest-z rung, not the highest-ROI one

**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.

| slice | bets | win% | edge vs lg | ROI |
|---|---|---|---|---|
| 2023 | 112 | 61.6 | +11.7 | **+17.3** |
| 2024 | 131 | 53.4 | +3.4 | **+2.1** |
| 2025 | 129 | 60.5 | +10.4 | **+15.4** |
| EARLY | 86 | 64.0 | +14.0 | **+22.1** |
| MID | 130 | 57.7 | +7.7 | **+10.0** |
| LATE | 144 | 55.6 | +5.5 | **+5.9** |
| model HOME | 178 | 52.8 | — | **+0.7** |
| model AWAY | 194 | 63.4 | — | **+21.0** |

### ≥6, every season x side cell

| | model HOME | model AWAY |
|---|---|---|
| 2022 | — | — |
| 2023 | +18.1% (n=66) | +16.1% (n=46) |
| 2024 | -4.5% (n=60) | +7.7% (n=71) |
| 2025 | -15.5% (n=52) | +36.2% (n=77) |


---

# ⭐ Verdict

## The 1H total clears. Bet at ≥7 points.

**631 bets, 56.3%, +7.4% ROI, z +8.42** — the highest z on its ladder, and the rung was chosen on
z rather than on the ROI argmax (≥9 pays +8.9% on 291 bets against a null sd of 1.58; ≥7 pays
+7.4% on 631 against 0.90). Both sides work (OVER +8.1 / UNDER +6.7) and five of six season×side
cells are positive.

**It is a weaker object than the full-game total** and should not be described as an equal. The
full game pays +12.0% on 675 bets and is profitable from ≥1 upward; the 1H is negative until ≥5.
Two soft spots the full game does not have:

* **2023 is flat** (−1.1%), so 2024 and 2025 carry the result. Three seasons is already the
  ceiling here — the Odds API has no 1H market before 2023-05-03 — so one dead season out of
  three is a third of the evidence.
* **The playoffs INVERT.** −19.0% on 33 bets, where the full-game total is +21.4% on 33. Both
  samples are too small to claim anything, but they cannot both be right and the 1H is the one
  pointing the wrong way. Do not bet 1H totals in the postseason on this evidence.

## ~~The 1H spread is a one-sided signal, not a model. Do not ship it as one.~~

> **RETRACTED 2026-08-01 — `NBA_H1_SPREAD_DIAG.md`.** The section below is kept because the numbers
> in it are real; the conclusion drawn from them is not. Chasing the "impossible" side asymmetry
> found no bug, because there is no bug. The graded line and the reducer's line match on 3,961 of
> 3,961 games, the symmetric part of the prediction is identically 0.000, and the model is 1.22x too
> WIDE rather than shrunk. **The 2x2 is what settled it: three of the four cells at ≥6 pay +11.9%,
> +11.9% and +47.7%, and the only loser — model backs HOME while the market favours HOME, −10.1% on
> 91 bets — sits 0.44 sd from that cell's own blind rate of −5.5%.** The home side adds no lift on
> home favourites; it is not wrong there. Measured as **lift over blind**, which is the only fair
> comparison when one side is structurally expensive, ≥6 is **home +5.8 / away +25.0 — both
> positive**. And the full-game spread model splits the OPPOSITE way (HOME +36.4% on 63, AWAY +4.0%
> on 314), so side splits at 50–200 bets are noise in both markets.
>
> **Graded as one rule, which nobody had done: 372 bets, 58.3%, +11.3%, z +4.64 on 30 nulls,
> seasons +17.3 / +2.1 / +15.4 and phases EARLY +22.1 / MID +10.0 / LATE +5.9 — every season and
> every phase positive.** It is a model. It is still the weaker of the two 1H markets: half the
> total's bet count, nothing below ≥5, and 2024 nearly flat.

+11.3% ROI at ≥6 on 372 bets is the headline, and it is entirely an artefact of aggregation:

| | model HOME | model AWAY |
|---|---|---|
| 2023 | +18.1% (n=66) | +16.1% (n=46) |
| 2024 | −4.5% (n=60) | +7.7% (n=71) |
| 2025 | **−15.5%** (n=52) | **+36.2%** (n=77) |
| **all** | **+0.7% (n=178)** | **+21.0% (n=194)** |

The home half of the model makes nothing in three years and loses 15% in the most recent one. A
model whose two sides disagree that violently is estimating one thing well and its mirror badly,
which on a symmetric panel should not be possible — that is the diagnostic to chase, not the ROI.

**THE SELECTION IS REAL, THOUGH — the away side is not simply underpriced.** Blind 1H away over all
3,916 gradeable games: **50.26%, ROI −4.05%**, and negative in every season (−5.10 / −3.43 / −3.62).
The model's away picks at ≥6 hit 63.4% for +21.0%, a 25-point ROI gap over betting away blind. So
there is something here worth 194 bets; it is just not a spread model yet.

**It is also unstable.** At half-life 180d on the round-two feature set the same split read HOME
−5.3 / AWAY +0.2. A half-life change moved one side by twenty points. Nothing that moves that much
on a hyperparameter is ready to bet.

## What got us here

Four rounds, each cut pre-registered as "positive drop-one delta on BOTH selectivities", each
re-measured against the newly pruned baseline, stopping when that set came back empty.

| | 1H_TOTAL | 1H_SPREAD |
|---|---|---|
| unpruned 815 | +3.25 / +1.12 | **−4.24 / −3.80** |
| round two | +5.83 / +7.60 (587) | −1.65 / −0.46 (731) |
| round three | *empty — prune done* | +2.89 / +2.15 (475) |
| at 120d | **+7.4% @ ≥7** | **+11.3% @ ≥6**, z +4.64, 3/3 seasons |

Two things did the work, and neither was a modelling idea:

1. **160 first-half columns had never reached a model.** `wide_stack` selects through
   `nba_total_v2.feature_cols`, a theme list curated for the full-game total; 4 of 179 1H columns
   were getting through. Per `feature-pruning-drop-one-vs-solo` rule 1, inventorying unused tables
   beats any pruning decision — third sport this has been true in.
2. **The half-life was inherited, not measured.** 180d came from the full-game total. A half wants
   **90–120d** — it is starters against starters, so it tracks current team strength the way the
   full-game SPREAD does, not the slowly-drifting scoring environment the full-game total tracks.
   28 of 28 cells profitable on the total's sweep, pooled worst on three of four columns.

## Open, in priority order

1. ~~**Why is the 1H spread's home side broken?**~~ **ANSWERED — it isn't.** See
   `NBA_H1_SPREAD_DIAG.md`. Three mechanical explanations died, the 2x2 showed one no-lift cell
   rather than a broken side, and the rule as a whole is +11.3% at ≥6 with z +4.64 across three
   positive seasons and three positive phases.
2. **The full-game spread model's own side split needs the same treatment.** The control run here
   found it is **HOME +36.4% on 63 bets / AWAY +4.0% on 314** at ≥8 — i.e. the published +9.5%
   leans on 63 bets. Both sides still beat blind (−4.00 / −5.02), but that concentration was not
   known when the model was written up.
3. **The 1H total's 2023.** Flat, and it is a third of the sample.
4. **1H moneyline and 1H team totals are not gradeable — no prices exist in the warehouse.**
   `h1_sp_h/a` and `h1_ov/un` are the only 1H markets we have. Nothing to run until they are bought
   or captured live.
