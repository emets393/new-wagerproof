# CBB — every market on its OWN model

`cbb_market_models.py --stage final`. Each market is graded on a model fitted to a feature set chosen for THAT market by the pre-registered rule in the script, at a 365d half-life, with 20 game-level null shuffles re-measured at every rung. Everything else — the panel layout, the target, the grader, the oracle — is identical to `CBB_PANEL_ALL.md`, so the only difference between the two documents is which features each market's model carries.

**The z does not pay for the search.** Nulls price 'better than noise', not 'this feature set was chosen by looking at these rows'. Read the per-season rows before the pooled z.


*227 features — cut: context.*

## Team total

One model, both perspectives, graded at PANEL level — a team total IS the team row, so unlike every other market there is no reduction to one number per game. **Read this market through `derived-market-gating-law`**: on the NBA it paid +13.1% inside games the full-game total model already bet and −12.1% in games neither parent touched. `cbb_tt_gate.py` runs that split here.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 14,213 | 53.2 | 51.3 | **+1.9** | -0.6 | -0.26 | 0.50 | **+4.28** |
| ≥2 | 4,177 | 54.3 | 51.7 | **+2.6** | +1.2 | -0.12 | 0.87 | **+3.15** |
| ≥3 | 891 | 55.8 | 52.1 | **+3.7** | +3.8 | +0.08 | 1.54 | **+2.36** |
| ≥4 | 139 | 58.3 | 53.2 | **+5.0** | +8.3 | +0.66 | 3.94 | **+1.11** |

### Team total — by season, at the 3-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023-24 | 425 | 56.5 | 56.0 | **+0.5** | +4.5 |
| 2024-25 | 277 | 52.3 | 50.5 | **+1.8** | -2.3 |
| 2025-26 | 189 | 59.3 | 52.9 | **+6.3** | +11.3 |

### Team total — by phase, at the 3-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 354 | 53.7 | 50.6 | **+3.1** | -0.9 |
| MTE | 79 | 59.5 | 55.7 | **+3.8** | +11.0 |
| CONF_EARLY | 278 | 57.9 | 54.3 | **+3.6** | +8.4 |
| CONF_LATE | 136 | 52.9 | 50.7 | **+2.2** | -0.8 |
| CONF_TOURN | 33 | 60.6 | 54.5 | **+6.1** | +13.0 |

### Team total — which side, at the 3-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 670 | 55.2 | 50.9 | **+4.3** | +2.6 |
| model says UNDER | 221 | 57.5 | 49.1 | **+8.4** | +7.5 |


*204 features — cut: style_raw.*

## Full-game total

Sum of the two team predictions against the posted total.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 10,552 | 51.5 | 50.3 | **+1.2** | -1.7 | -0.16 | 0.50 | **+2.72** |
| ≥2 | 5,327 | 51.4 | 50.0 | **+1.4** | -1.8 | -0.40 | 0.94 | **+1.91** |
| ≥3 | 2,396 | 52.7 | 50.2 | **+2.5** | +0.6 | -1.28 | 1.75 | **+2.19** |
| ≥4 | 906 | 52.9 | 50.2 | **+2.6** | +0.9 | -1.89 | 2.66 | **+1.71** |
| ≥5 | 374 | 52.7 | 51.6 | **+1.1** | +0.5 | -3.10 | 4.58 | **+0.91** |
| ≥6 | 153 | 49.7 | 50.3 | **-0.7** | -5.2 | -3.53 | 4.92 | **+0.59** |

### Full-game total — by season, at the 4-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2022-23 | 99 | 39.4 | 60.6 | **-21.2** | -24.8 |
| 2023-24 | 468 | 52.4 | 52.8 | **-0.4** | -0.1 |
| 2024-25 | 193 | 57.0 | 51.8 | **+5.2** | +8.8 |
| 2025-26 | 146 | 58.2 | 52.7 | **+5.5** | +11.0 |

### Full-game total — by phase, at the 4-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 250 | 54.0 | 52.4 | **+1.6** | +3.1 |
| MTE | 63 | 57.1 | 54.0 | **+3.2** | +9.1 |
| CONF_EARLY | 273 | 54.2 | 50.2 | **+4.0** | +3.5 |
| CONF_LATE | 158 | 52.5 | 50.6 | **+1.9** | +0.3 |
| NCAAT | 68 | 45.6 | 54.4 | **-8.8** | -13.0 |
| POST_OTHER | 74 | 50.0 | 50.0 | **+0.0** | -4.6 |

### Full-game total — which side, at the 4-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 730 | 51.9 | 50.6 | **+1.3** | -0.9 |
| model says UNDER | 176 | 56.8 | 49.4 | **+7.5** | +8.4 |


*164 features — cut: form_l5, heat, season_s2d.*

## Full-game spread

Difference of the two team predictions against the posted spread. `NCAAB_MODEL_BRIEF2.md` reports the previous college spread model at a validation MAE of 9.11 against the market's 8.80 — it did not beat the line. This is the first attempt from a consistent per-team points model.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 7,455 | 54.5 | 50.6 | **+3.9** | +4.0 | -0.97 | 1.35 | **+3.62** |
| ≥2 | 2,368 | 56.7 | 50.3 | **+6.4** | +8.3 | -1.56 | 2.66 | **+2.99** |
| ≥3 | 593 | 58.2 | 50.9 | **+7.3** | +11.1 | -5.83 | 8.48 | **+1.54** |
| ≥4 | 125 | 54.4 | 50.4 | **+4.0** | +3.9 | +0.03 | 4.84 | **+0.82** |

### Full-game spread — by season, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023-24 | 856 | 56.8 | 50.4 | **+6.4** | +8.4 |
| 2024-25 | 864 | 57.5 | 50.2 | **+7.3** | +9.9 |
| 2025-26 | 634 | 55.4 | 52.1 | **+3.3** | +5.7 |

### Full-game spread — by phase, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 787 | 55.4 | 50.6 | **+4.8** | +5.8 |
| MTE | 175 | 53.7 | 51.4 | **+2.3** | +2.6 |
| CONF_EARLY | 756 | 59.1 | 51.3 | **+7.8** | +12.9 |
| CONF_LATE | 534 | 56.9 | 52.6 | **+4.3** | +8.7 |
| CONF_TOURN | 71 | 45.1 | 50.7 | **-5.6** | -13.9 |

### Full-game spread — which side, at the 2-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 1,427 | 55.3 | 50.1 | **+5.2** | +5.6 |
| model says AWAY | 941 | 58.9 | 49.9 | **+8.9** | +12.5 |


*103 features — cut: context, form_l5, pctile, possession, style_raw.*

## Moneyline

The margin model turned into a win probability with its own as-of error scale, against the devigged market price. **Read ROI here, not edge.** `base%` is the best blind side inside the bet cell, which on a moneyline is always the favourite, so any model that takes dogs scores a large negative edge whether or not it makes money — and the null lands there too, which lets z go positive on a losing model.

Bet when the model and the market differ by at least k %.

| cut (%) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 13,651 | 63.4 | 63.8 | **-0.4** | +0.2 | -2.30 | 1.27 | **+1.49** |
| ≥2 | 10,074 | 64.6 | 63.7 | **+0.9** | +0.9 | -0.72 | 1.35 | **+1.19** |
| ≥3 | 6,671 | 64.1 | 61.9 | **+2.1** | +2.4 | -0.04 | 1.87 | **+1.16** |
| ≥5 | 2,612 | 61.3 | 58.0 | **+3.2** | +2.5 | -0.11 | 2.90 | **+1.15** |
| ≥7 | 1,000 | 63.6 | 59.6 | **+4.0** | +5.1 | -0.24 | 2.98 | **+1.42** |
| ≥10 | 262 | 73.3 | 72.5 | **+0.8** | +5.1 | -1.03 | 3.55 | **+0.50** |

### Moneyline — by season, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2022-23 | 49 | 42.9 | 75.5 | **-32.7** | +1.0 |
| 2023-24 | 2,365 | 64.9 | 61.7 | **+3.2** | +1.6 |
| 2024-25 | 2,260 | 66.8 | 63.8 | **+3.0** | +4.5 |
| 2025-26 | 1,997 | 60.4 | 59.6 | **+0.8** | +1.0 |

### Moneyline — by phase, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 2,090 | 68.8 | 72.3 | **-3.5** | -0.1 |
| MTE | 407 | 55.3 | 55.3 | **+0.0** | -7.4 |
| CONF_EARLY | 1,762 | 62.9 | 55.8 | **+7.1** | +7.7 |
| CONF_LATE | 1,913 | 62.1 | 56.1 | **+6.0** | +2.2 |
| CONF_TOURN | 322 | 63.0 | 63.7 | **-0.6** | +0.7 |
| NCAAT | 111 | 64.0 | 77.5 | **-13.5** | +3.8 |
| POST_OTHER | 66 | 59.1 | 68.2 | **-9.1** | +11.0 |

### Moneyline — which side, at the 3-% cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 4,001 | 71.7 | 64.0 | **+7.7** | +1.3 |
| model says AWAY | 2,670 | 52.7 | 36.0 | **+16.6** | +4.0 |


*202 features — cut: adv, season_s2d, star.*

## First-half total

First-half points per team, summed, against the posted first-half total. First-half lines are about half the size of full-game ones, so the cuts scale down to match.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.75 | 9,369 | 52.4 | 51.2 | **+1.2** | -0.8 | +0.40 | 0.79 | **+1.07** |
| ≥1 | 7,286 | 52.5 | 51.4 | **+1.1** | -0.6 | +0.31 | 0.96 | **+0.85** |
| ≥1.5 | 4,055 | 53.7 | 51.5 | **+2.2** | +1.6 | -0.03 | 1.55 | **+1.46** |
| ≥2 | 2,055 | 55.7 | 51.2 | **+4.5** | +5.3 | -0.43 | 2.36 | **+2.10** |
| ≥3 | 407 | 57.0 | 54.1 | **+2.9** | +7.7 | -3.09 | 4.65 | **+1.30** |
| ≥4 | 53 | 60.4 | 54.7 | **+5.7** | +14.2 | -4.61 | 8.24 | **+1.25** |

### First-half total — by season, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023-24 | 834 | 54.9 | 52.0 | **+2.9** | +4.1 |
| 2024-25 | 666 | 57.7 | 54.1 | **+3.6** | +8.6 |
| 2025-26 | 555 | 54.6 | 52.6 | **+2.0** | +3.1 |

### First-half total — by phase, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 762 | 54.5 | 50.4 | **+4.1** | +2.9 |
| MTE | 174 | 52.3 | 50.6 | **+1.7** | -1.2 |
| CONF_EARLY | 478 | 55.2 | 50.8 | **+4.4** | +4.4 |
| CONF_LATE | 416 | 57.0 | 53.4 | **+3.6** | +7.7 |
| CONF_TOURN | 114 | 63.2 | 63.2 | **+0.0** | +19.4 |
| NCAAT | 71 | 56.3 | 56.3 | **+0.0** | +6.5 |
| POST_OTHER | 40 | 65.0 | 65.0 | **+0.0** | +22.9 |

### First-half total — which side, at the 2-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 935 | 55.0 | 49.2 | **+5.7** | +4.0 |
| model says UNDER | 1,120 | 56.3 | 50.8 | **+5.6** | +6.4 |


*220 features — cut: context, schedule.*

## First-half spread

Difference of the first-half team predictions against the posted first-half spread.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.75 | 8,508 | 53.5 | 51.7 | **+1.8** | +1.4 | -0.20 | 0.46 | **+4.29** |
| ≥1 | 6,410 | 53.9 | 52.4 | **+1.6** | +2.2 | -0.13 | 0.48 | **+3.52** |
| ≥1.5 | 3,241 | 55.3 | 53.9 | **+1.4** | +4.8 | -0.17 | 0.66 | **+2.39** |
| ≥2 | 1,470 | 55.4 | 54.1 | **+1.3** | +5.0 | -0.39 | 0.71 | **+2.38** |
| ≥3 | 232 | 54.3 | 53.9 | **+0.4** | +2.9 | -0.52 | 1.00 | **+0.95** |
| ≥4 | 36 | 61.1 | 61.1 | **+0.0** | +15.9 | -0.73 | 1.28 | **+0.57** |

### First-half spread — by season, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023-24 | 1,164 | 52.6 | 51.5 | **+1.0** | -0.3 |
| 2024-25 | 1,032 | 55.3 | 55.0 | **+0.3** | +4.9 |
| 2025-26 | 1,045 | 58.4 | 55.4 | **+3.0** | +10.3 |

### First-half spread — by phase, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 1,227 | 54.3 | 53.1 | **+1.2** | +2.7 |
| MTE | 244 | 49.2 | 50.4 | **-1.2** | -6.6 |
| CONF_EARLY | 858 | 57.8 | 56.3 | **+1.5** | +9.5 |
| CONF_LATE | 777 | 55.7 | 54.4 | **+1.3** | +5.6 |
| CONF_TOURN | 101 | 58.4 | 54.5 | **+4.0** | +10.6 |

### First-half spread — which side, at the 1.5-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 900 | 52.6 | 48.9 | **+3.7** | -0.4 |
| model says AWAY | 2,341 | 56.4 | 51.1 | **+5.2** | +6.8 |


*236 features — cut: nothing.*

## First-half moneyline

**A market the NBA archive cannot grade at all** — there is no NBA first-half moneyline in it. College has one on 82% of games across three seasons. Halves tie far more often than games do, and a tie is a push here, so the bet count runs below the first-half spread. Same warning as the full-game moneyline: read ROI, not edge.

Bet when the model and the market differ by at least k %.

| cut (%) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 13,354 | 57.6 | 60.3 | **-2.7** | -1.7 | -16.67 | 1.03 | **+13.59** |
| ≥2 | 10,400 | 57.9 | 59.6 | **-1.6** | -1.2 | -16.43 | 1.11 | **+13.37** |
| ≥3 | 7,731 | 57.6 | 58.6 | **-1.0** | -1.2 | -16.03 | 1.09 | **+13.80** |
| ≥5 | 3,760 | 56.7 | 55.0 | **+1.7** | +0.7 | -14.47 | 1.29 | **+12.52** |
| ≥7 | 1,667 | 54.9 | 52.5 | **+2.4** | +0.8 | -13.14 | 2.10 | **+7.41** |
| ≥10 | 380 | 46.6 | 50.8 | **-4.2** | -10.7 | -16.50 | 4.47 | **+2.75** |

### First-half moneyline — by season, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023-24 | 2,642 | 56.2 | 58.4 | **-2.2** | -5.1 |
| 2024-25 | 2,614 | 60.4 | 59.3 | **+1.0** | +1.9 |
| 2025-26 | 2,475 | 56.2 | 58.1 | **-2.0** | -0.2 |

### First-half moneyline — by phase, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| NONCONF | 2,207 | 58.4 | 66.5 | **-8.1** | -2.8 |
| MTE | 464 | 50.4 | 52.6 | **-2.2** | -1.0 |
| CONF_EARLY | 2,279 | 58.3 | 53.9 | **+4.4** | +1.3 |
| CONF_LATE | 2,251 | 57.7 | 55.1 | **+2.6** | -2.0 |
| CONF_TOURN | 389 | 57.8 | 66.8 | **-9.0** | +1.3 |
| NCAAT | 86 | 58.1 | 69.8 | **-11.6** | -14.2 |
| POST_OTHER | 55 | 49.1 | 60.0 | **-10.9** | -5.7 |

### First-half moneyline — which side, at the 3-% cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 4,008 | 65.7 | 60.6 | **+5.0** | -1.5 |
| model says AWAY | 3,723 | 48.9 | 39.4 | **+9.5** | -0.8 |

