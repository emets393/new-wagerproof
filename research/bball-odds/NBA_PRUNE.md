# NBA — pruning the originator spread model

Family-level ablation on the originator target: predict the raw margin of victory with **no market column anywhere**, reduce to the model's margin minus the posted margin, grade the disagreement at fixed selectivity. `nba_prune.py`.

Baseline: **739 features**, corr with the realised residual +0.0306, **+3.08%** ROI on the top 15% of disagreements and **+0.60%** on the top 9%.

## Drop-one — does the model improve without this family?

A **positive delta means cutting the family HELPS.** This is the column that decides what gets removed.

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| misc | 47 | +6.32 | **+3.23** | +3.82 | **+3.22** |
| style | 66 | +5.35 | **+2.27** | +4.90 | **+4.30** |
| schedule | 8 | +5.35 | **+2.27** | +1.13 | **+0.53** |
| absence | 32 | +5.02 | **+1.94** | +4.90 | **+4.30** |
| usage | 24 | +5.02 | **+1.93** | +2.74 | **+2.15** |
| rot_flags | 21 | +5.01 | **+1.92** | +4.90 | **+4.30** |
| rapm | 170 | +4.72 | **+1.64** | -0.99 | **-1.59** |
| adj_eff | 54 | +4.72 | **+1.64** | +0.63 | **+0.03** |
| form | 80 | +4.37 | **+1.28** | +2.73 | **+2.13** |
| nets | 48 | +4.05 | **+0.97** | +1.14 | **+0.54** |
| dims | 12 | +3.72 | **+0.64** | +3.84 | **+3.24** |
| travel | 10 | +3.72 | **+0.63** | +3.81 | **+3.21** |
| raw_box | 96 | +3.71 | **+0.63** | +4.35 | **+3.75** |
| standings | 4 | +3.08 | **+0.00** | +0.60 | **+0.00** |
| ratings | 9 | +3.08 | **-0.00** | +3.29 | **+2.69** |
| talent | 33 | +2.74 | **-0.34** | +0.03 | **-0.57** |
| pace_ix | 7 | +2.11 | **-0.97** | +3.29 | **+2.69** |
| pl_regr | 18 | -1.13 | **-4.21** | -0.50 | **-1.10** |

## Solo — does the family carry anything by itself?

A family can be fine solo and still worth cutting: that is what redundancy looks like. Only a family that is both weak solo and improves the model when dropped is dead weight.

| family | cols | corr | ROI top 15% | ROI top 9% |
|---|---|---|---|---|
| rapm | 170 | +0.0265 | +4.71 | +3.86 |
| adj_eff | 54 | -0.0089 | -2.07 | -2.62 |
| talent | 33 | +0.0026 | -3.00 | -3.64 |
| ratings | 9 | -0.0103 | -3.02 | -5.82 |
| raw_box | 96 | -0.0016 | -3.35 | -8.53 |
| pl_regr | 18 | +0.0062 | -4.99 | -0.45 |
| schedule | 8 | -0.0204 | -5.95 | -10.68 |
| form | 80 | -0.0083 | -6.55 | -5.79 |
| dims | 12 | -0.0115 | -6.90 | -7.42 |
| pace_ix | 7 | -0.0244 | -7.58 | -10.70 |
| rot_flags | 21 | -0.0108 | -8.22 | -9.29 |
| usage | 24 | -0.0225 | -8.88 | -11.79 |
| standings | 4 | -0.0242 | -8.92 | -13.47 |
| style | 66 | -0.0357 | -9.51 | -14.42 |
| absence | 32 | -0.0152 | -9.52 | -9.61 |
| nets | 48 | -0.0295 | -9.83 | -11.22 |
| travel | 10 | -0.0214 | -9.83 | -6.38 |
| misc | 47 | -0.0308 | -10.82 | -13.38 |

---

# Grading the pruned model

`nba_prune2.py`. Four pre-registered configurations, 20 game-level null shuffles, compared at fixed selectivity so the comparison is between feature sets and not between strategies.

| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 739 | +0.0271 | 591 | 53.5 | 50.1 | **+2.10** | +3.20 | **+3.82** | +3.78 |
| C1 | 549 | +0.0363 | 591 | 55.7 | 53.1 | **+6.33** | +2.50 | **+7.03** | +3.80 |
| C2 | 241 | +0.0577 | 591 | 55.3 | 53.1 | **+5.69** | +3.06 | **+2.25** | +2.52 |
| **CORE** | 188 | +0.0408 | 591 | 57.2 | 52.1 | **+9.24** | +5.44 | **+8.70** | +6.00 |

## CORE on the points ladder

Disagreement with the posted spread, in points. Nulls are the same 20 game-level shuffles, graded at the same rung.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,273 | 51.5 | 50.7 | **+0.7** | **-1.7** | -0.60 | 0.29 | **+4.60** |
| ≥2 | 2,665 | 51.7 | 50.4 | **+1.4** | **-1.2** | -0.71 | 0.42 | **+4.93** |
| ≥3 | 2,077 | 51.6 | 50.4 | **+1.3** | **-1.4** | -0.92 | 0.48 | **+4.54** |
| ≥4 | 1,514 | 52.8 | 50.8 | **+2.0** | **+0.8** | -1.26 | 0.49 | **+6.58** |
| ≥5 | 1,113 | 52.7 | 50.2 | **+2.5** | **+0.7** | -1.42 | 0.55 | **+7.12** |
| ≥6 | 786 | 55.0 | 51.4 | **+3.6** | **+5.0** | -1.93 | 0.87 | **+6.32** |
| ≥7 | 554 | 56.7 | 51.1 | **+5.6** | **+8.3** | -2.30 | 1.13 | **+6.97** |
| ≥8 | 377 | 57.3 | 50.1 | **+7.2** | **+9.5** | -2.60 | 1.29 | **+7.56** |
| ≥9 | 247 | 54.7 | 50.6 | **+4.0** | **+4.5** | -3.36 | 1.38 | **+5.37** |


## CORE broken out at the ≥8 cut

Pooled numbers hide a signal that lives in one season or decays out.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 95 | 49.5 | 54.7 | **-5.3** | **-5.5** |
| 2024 | 130 | 60.0 | 50.0 | **+10.0** | **+14.7** |
| 2025 | 142 | 61.3 | 54.2 | **+7.0** | **+17.0** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 92 | 59.8 | 53.3 | **+6.5** | **+14.2** |
| MID | 106 | 61.3 | 54.7 | **+6.6** | **+17.2** |
| LATE | 136 | 58.1 | 52.2 | **+5.9** | **+11.0** |
| POST | 43 | 39.5 | 60.5 | **-20.9** | **-24.5** |

