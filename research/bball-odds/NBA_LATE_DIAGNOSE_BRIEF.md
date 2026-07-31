# NBA late-season spread — is the inversion a motivation blind spot?

No refitting. Saved walk-forward predictions from `nba_spread_v2.py` regraded against standings context the models never saw.

**Baseline for every win% below is 50%**, because a spread is a two-way market and a coin wins half. Breakeven at -110 is 52.4%. A 47% row is as far from random as a 53% row — it is the same edge with the sign flipped.

Selection is the top 50% of |edge| on the AVERAGE of all nine families, so no single learner and no cell-picking can drive a row. `delta cell` subtracts blind-favourite ROI reweighted to the selection's own |open spread| mix.


## late — 686 bets, 47.1%, -10.11 ROI

| split | n | win% | ROI | delta cell |
|---|---|---|---|---|
| both sides settled (clinched or out) | 187 | 54.5 | +4.12 | **+1.84** |
| at least one side still racing | 499 | 44.3 | -15.44 | **-16.63** |
| either side within 3 of the bubble | 85 | 44.7 | -14.65 | **-15.46** |
| neither side near the bubble | 601 | 47.4 | -9.47 | **-11.05** |
| a tanking team involved | 199 | 43.2 | -17.50 | **-20.25** |
| no tanking team | 487 | 48.7 | -7.09 | **-8.06** |
| post trade deadline | 672 | 47.0 | -10.23 | **-11.74** |
| pre trade deadline | 14 | — | — | — |
| min urgency < 4 games | 128 | 46.9 | -10.51 | **-11.27** |
| min urgency >= 8 games | 326 | 50.9 | -2.78 | **-4.71** |
| _mean \|edge\| in settled games_ | 380 | | 1.80 pts | |
| _mean \|edge\| in racing games_ | 992 | | 1.80 pts | |

## mid — 748 bets, 49.7%, -5.03 ROI

| split | n | win% | ROI | delta cell |
|---|---|---|---|---|
| both sides settled (clinched or out) | 0 | — | — | — |
| at least one side still racing | 748 | 49.7 | -5.03 | **-0.61** |
| either side within 3 of the bubble | 388 | 47.9 | -8.47 | **-3.82** |
| neither side near the bubble | 360 | 51.7 | -1.33 | **+2.86** |
| a tanking team involved | 0 | — | — | — |
| no tanking team | 748 | 49.7 | -5.03 | **-0.61** |
| post trade deadline | 6 | — | — | — |
| pre trade deadline | 742 | 49.9 | -4.78 | **-0.35** |
| min urgency < 4 games | 478 | 49.0 | -6.53 | **-1.86** |
| min urgency >= 8 games | 66 | 57.6 | +9.94 | **+13.22** |
| _mean \|edge\| in racing games_ | 1496 | | 1.94 pts | |

## early — 302 bets, 55.3%, +5.55 ROI

| split | n | win% | ROI | delta cell |
|---|---|---|---|---|
| both sides settled (clinched or out) | 0 | — | — | — |
| at least one side still racing | 302 | 55.3 | +5.55 | **+3.93** |
| either side within 3 of the bubble | 285 | 55.8 | +6.49 | **+4.89** |
| neither side near the bubble | 17 | — | — | — |
| a tanking team involved | 0 | — | — | — |
| no tanking team | 302 | 55.3 | +5.55 | **+3.93** |
| post trade deadline | 0 | — | — | — |
| pre trade deadline | 302 | 55.3 | +5.55 | **+3.93** |
| min urgency < 4 games | 296 | 55.7 | +6.41 | **+4.74** |
| min urgency >= 8 games | 0 | — | — | — |
| _mean \|edge\| in racing games_ | 603 | | 2.26 pts | |
