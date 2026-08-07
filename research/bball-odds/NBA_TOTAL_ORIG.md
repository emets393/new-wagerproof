# NBA — the originator total model

Predict own-team points with **no market column anywhere**, add the two rows, bet the disagreement with the posted total. `nba_total_prune.py`. Run fresh rather than inheriting the spread's `CORE`, because the two markets do not share an information set.

Baseline: **739 features**, corr with the realised residual +0.0781, **+4.91%** ROI on the top 15% of disagreements and **+6.94%** on the top 9%.

## Drop-one — does the model improve without this family?

**Positive delta means cutting the family HELPS.** This column decides what gets cut; solo only says whether the information exists at all.

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| raw_box | 96 | +7.80 | **+2.89** | +9.08 | **+2.14** |
| travel | 10 | +7.16 | **+2.25** | +9.61 | **+2.67** |
| rot_flags | 21 | +7.16 | **+2.25** | +9.07 | **+2.14** |
| usage | 24 | +6.52 | **+1.61** | +4.80 | **-2.14** |
| pl_regr | 18 | +6.52 | **+1.61** | +8.54 | **+1.60** |
| nets | 48 | +6.19 | **+1.28** | +6.40 | **-0.53** |
| rapm | 170 | +5.89 | **+0.98** | +3.20 | **-3.73** |
| standings | 4 | +5.88 | **+0.97** | +9.07 | **+2.14** |
| talent | 33 | +5.56 | **+0.65** | +8.00 | **+1.07** |
| style | 66 | +4.92 | **+0.01** | +9.62 | **+2.68** |
| ratings | 9 | +4.92 | **+0.01** | +7.47 | **+0.54** |
| adj_eff | 54 | +4.59 | **-0.32** | +4.79 | **-2.14** |
| schedule | 8 | +4.59 | **-0.32** | +6.40 | **-0.53** |
| dims | 12 | +4.28 | **-0.63** | +6.94 | **+0.00** |
| absence | 32 | +4.27 | **-0.64** | +5.34 | **-1.60** |
| pace_ix | 7 | +3.95 | **-0.96** | +6.40 | **-0.53** |
| misc | 47 | +3.95 | **-0.96** | +7.48 | **+0.54** |
| form | 80 | +3.95 | **-0.96** | +3.20 | **-3.73** |

## Solo — does the family carry anything by itself?

| family | cols | corr | ROI top 15% | ROI top 9% |
|---|---|---|---|---|
| adj_eff | 54 | +0.0116 | +4.31 | +9.66 |
| pl_regr | 18 | -0.0037 | +3.65 | +4.29 |
| style | 66 | -0.0012 | +3.32 | +4.29 |
| dims | 12 | -0.0033 | +2.04 | +2.68 |
| travel | 10 | -0.0006 | +0.76 | +6.42 |
| form | 80 | +0.0038 | +0.43 | +2.14 |
| ratings | 9 | +0.0159 | +0.12 | -4.27 |
| talent | 33 | -0.0033 | -0.84 | -5.34 |
| rapm | 170 | +0.0261 | -0.85 | -0.53 |
| rot_flags | 21 | -0.0034 | -1.33 | -0.00 |
| raw_box | 96 | +0.0101 | -1.48 | -2.66 |
| schedule | 8 | -0.0041 | -1.81 | +4.29 |
| usage | 24 | +0.0012 | -1.81 | -1.60 |
| standings | 4 | -0.0208 | -2.78 | -5.88 |
| absence | 32 | +0.0021 | -3.10 | +3.74 |
| misc | 47 | +0.0104 | -4.37 | -2.11 |
| pace_ix | 7 | -0.0015 | -4.38 | -1.07 |
| nets | 48 | +0.0085 | -5.01 | +1.61 |

---

# Grading the pruned total

`nba_total_prune2.py`. Five pre-registered configurations, 20 game-level null shuffles, compared at fixed selectivity so the comparison is between feature sets and not between strategies.

| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 763 | +0.0796 | 595 | 56.6 | 51.9 | **+8.12** | +3.21 | **+8.54** | +1.86 |
| **T1** | 636 | +0.0843 | 595 | 58.8 | 52.1 | **+12.29** | +5.33 | **+14.96** | +3.04 |
| T2 | 482 | +0.0641 | 595 | 56.1 | 53.6 | **+7.17** | +2.00 | **+9.09** | +1.42 |
| TCORE | 240 | +0.0265 | 595 | 51.8 | 50.6 | **-1.18** | +1.40 | **+3.20** | +1.42 |
| TCORE_R | 410 | +0.0608 | 595 | 56.1 | 51.8 | **+7.17** | +3.79 | **+10.69** | +1.56 |

## T1 on the points ladder

Disagreement with the posted total, in points. Nulls are the same 20 game-level shuffles graded at the same rung.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,395 | 52.8 | 51.0 | **+1.8** | **+0.9** | -0.25 | 0.61 | **+3.44** |
| ≥2 | 2,860 | 53.3 | 50.6 | **+2.7** | **+1.8** | -0.24 | 0.80 | **+3.68** |
| ≥3 | 2,357 | 53.8 | 51.0 | **+2.8** | **+2.7** | -0.34 | 0.97 | **+3.19** |
| ≥4 | 1,903 | 55.0 | 50.6 | **+4.5** | **+5.0** | -0.44 | 1.08 | **+4.55** |
| ≥5 | 1,522 | 54.5 | 51.1 | **+3.5** | **+4.1** | -0.59 | 0.93 | **+4.37** |
| ≥6 | 1,190 | 54.9 | 52.0 | **+2.9** | **+4.8** | -0.76 | 0.88 | **+4.13** |
| ≥7 | 917 | 56.8 | 51.4 | **+5.5** | **+8.5** | -0.72 | 0.69 | **+8.97** |
| ≥8 | 689 | 58.6 | 51.8 | **+6.8** | **+11.9** | -0.80 | 1.02 | **+7.46** |
| ≥10 | 383 | 59.8 | 54.3 | **+5.5** | **+14.1** | -0.40 | 1.14 | **+5.18** |
| ≥12 | 224 | 59.8 | 55.8 | **+4.0** | **+14.2** | -0.64 | 1.58 | **+2.95** |


## T1 broken out at the ≥12 cut

Pooled numbers hide a signal that lives in one season or decays out.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 115 | 59.1 | 60.9 | **-1.7** | **+12.9** |
| 2024 | 41 | 61.0 | 56.1 | **+4.9** | **+16.4** |
| 2025 | 66 | 60.6 | 54.5 | **+6.1** | **+15.6** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 124 | 58.1 | 54.8 | **+3.2** | **+10.8** |
| MID | 36 | 55.6 | 61.1 | **-5.6** | **+6.0** |
| LATE | 51 | 64.7 | 54.9 | **+9.8** | **+23.5** |


## T1 at ≥12, split by which side the model takes

| side | bets | win% | ROI |
|---|---|---|---|
| model OVER | 151 | 61.6 | **+17.6** |
| model UNDER | 73 | 56.2 | **+7.2** |

