# NBA full-game total — feature-family ablation

5,226 gradeable games, seasons [2022, 2023, 2024, 2025]. Target is the residual vs the T-60 close, so the model is trained on the thing we actually bet, not on the total. Overs hit 50.6%, so blind UNDER is 50.6% and that is the bar, not 50%. Breakeven at -110 is 52.4%.


## Each family alone

| feature set | cols | top100% n/win/base | top25% n/win/base/ROI | top10% win/ROI |
|---|---|---|---|---|
| market | 41 | 4413 / 47.8 / 50.6 | 1104 / 45.6 / 50.1 / -13.0 | 51.1 / -2.4 |
| deriv_mkt | 12 | 4413 / 51.0 / 50.6 | 1104 / 48.7 / 50.1 / -7.0 | 47.7 / -8.9 |
| box_form | 660 | 4413 / 50.8 / 50.6 | 1104 / 50.5 / 51.9 / -3.5 | 50.1 / -4.3 |
| streaks | 60 | 4413 / 50.3 / 50.6 | 1104 / 50.5 / 50.2 / -3.5 | 48.0 / -8.4 |
| style | 132 | 4413 / 50.4 / 50.6 | 1104 / 50.5 / 52.7 / -3.5 | 48.9 / -6.7 |
| absence | 76 | 4413 / 51.3 / 50.6 | 1104 / 51.9 / 50.1 / -0.9 | 52.5 / +0.2 |
| schedule | 72 | 4413 / 50.3 / 50.6 | 1104 / 47.2 / 52.0 / -9.9 | 45.7 / -12.7 |
| standings | 43 | 4413 / 50.3 / 50.6 | 1104 / 51.1 / 50.9 / -2.5 | 53.0 / +1.3 |
| regress | 44 | 4413 / 50.1 / 50.6 | 1104 / 51.0 / 52.4 / -2.6 | 51.6 / -1.5 |
| player_ag | 464 | 4413 / 50.1 / 50.6 | 1104 / 50.5 / 54.1 / -3.7 | 48.9 / -6.7 |
| props | 18 | 4413 / 49.8 / 50.6 | 1104 / 49.5 / 50.0 / -5.4 | 48.6 / -7.1 |
| ratings | 20 | 4413 / 51.1 / 50.6 | 1104 / 50.9 / 52.9 / -2.8 | 46.4 / -11.5 |
| ha_splits | 36 | 4413 / 51.2 / 50.6 | 1104 / 51.4 / 50.8 / -1.8 | 49.8 / -5.0 |

## Leave-one-out — a family that HELPS makes this row worse when removed

| feature set | cols | top100% n/win/base | top25% n/win/base/ROI | top10% win/ROI |
|---|---|---|---|---|
| ALL | 1678 | 4413 / 51.4 / 50.6 | 1104 / 51.7 / 50.5 / -1.3 | 52.5 / +0.2 |
| ALL minus market | 1637 | 4413 / 50.4 / 50.6 | 1104 / 53.4 / 51.0 / +1.9 | 52.0 / -0.6 |
| ALL minus deriv_mkt | 1666 | 4413 / 51.2 / 50.6 | 1104 / 52.4 / 51.7 / +0.1 | 52.5 / +0.2 |
| ALL minus box_form | 1018 | 4413 / 49.6 / 50.6 | 1104 / 50.9 / 52.5 / -2.8 | 51.6 / -1.5 |
| ALL minus streaks | 1618 | 4413 / 51.4 / 50.6 | 1104 / 52.5 / 52.5 / +0.3 | 53.4 / +1.9 |
| ALL minus style | 1546 | 4413 / 51.6 / 50.6 | 1104 / 52.6 / 51.4 / +0.5 | 51.9 / -0.9 |
| ALL minus absence | 1602 | 4413 / 50.7 / 50.6 | 1104 / 52.4 / 50.9 / -0.0 | 53.2 / +1.5 |
| ALL minus schedule | 1606 | 4413 / 51.7 / 50.6 | 1104 / 52.4 / 53.1 / -0.0 | 50.9 / -2.8 |
| ALL minus standings | 1635 | 4413 / 51.0 / 50.6 | 1104 / 52.4 / 53.2 / -0.0 | 50.7 / -3.2 |
| ALL minus regress | 1634 | 4413 / 51.2 / 50.6 | 1104 / 51.5 / 51.2 / -1.6 | 52.9 / +1.1 |
| ALL minus player_ag | 1214 | 4413 / 51.2 / 50.6 | 1104 / 51.5 / 50.2 / -1.6 | 50.7 / -3.2 |
| ALL minus props | 1660 | 4413 / 50.5 / 50.6 | 1104 / 51.4 / 52.1 / -1.8 | 51.8 / -1.1 |
| ALL minus ratings | 1658 | 4413 / 51.3 / 50.6 | 1104 / 51.4 / 50.4 / -1.9 | 52.5 / +0.2 |
| ALL minus ha_splits | 1642 | 4413 / 50.4 / 50.6 | 1104 / 52.9 / 52.5 / +1.0 | 52.5 / +0.2 |

## Reference: production-style team-box-only set

| feature set | cols | top100% n/win/base | top25% n/win/base/ROI | top10% win/ROI |
|---|---|---|---|---|
| box subset (prod-like) | 140 | 4413 / 49.5 / 50.6 | 1104 / 50.5 / 50.0 / -3.5 | 49.3 / -5.8 |

## Full set by phase (3 seeds)

| phase | cut | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| EARLY | top100% | 955 | 50.9 | 52.5 | **-1.6** | -2.8 |
| EARLY | top25% | 239 | 49.4 | 51.0 | **-1.7** | -5.7 |
| EARLY | top10% | 96 | 45.8 | 55.2 | **-9.4** | -12.5 |
| MID | top100% | 1301 | 49.3 | 51.2 | **-1.8** | -5.8 |
| MID | top25% | 326 | 49.4 | 51.8 | **-2.5** | -5.7 |
| MID | top10% | 131 | 48.1 | 55.7 | **-7.6** | -8.2 |
| LATE | top100% | 1826 | 50.7 | 51.2 | **-0.5** | -3.3 |
| LATE | top25% | 457 | 52.7 | 51.2 | **+1.5** | +0.7 |
| LATE | top10% | 183 | 54.1 | 51.9 | **+2.2** | +3.3 |
| POST | top100% | 331 | 52.3 | 51.1 | **+1.2** | -0.2 |
| POST | top25% | 83 | 53.0 | 51.8 | **+1.2** | +1.2 |
| POST | top10% | 34 | 52.9 | 58.8 | **-5.9** | +1.1 |
| ALL | top100% | 4413 | 50.4 | 50.6 | **-0.1** | -3.7 |
| ALL | top25% | 1104 | 51.5 | 50.6 | **+0.9** | -1.6 |
| ALL | top10% | 442 | 48.6 | 51.4 | **-2.7** | -7.1 |

## Correlation check (the number production fails)

- model P(over) vs actual residual: **+0.008**
- production `model_fair_total` vs the same kind of residual, graded on live data: **-0.017**

