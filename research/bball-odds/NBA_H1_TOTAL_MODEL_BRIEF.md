# NBA 1H TOTAL model — pressure test

3,928 lined games, seasons [2023, 2024, 2025]. Rolling-origin refit every 14D, 3 seeds x 3 boosters, top-250 train-fold features. Graded at the T-60 1H line and its real price. BE 52.4%.

Test rows: 3,161 2023:601, 2024:1280, 2025:1280

## A — the three ensembles

### SHARE ensemble (9 fits: 3 boosters x 3 seeds)

| cut | n | win% | ROI | flat-110 ROI | per-season |
|---|---|---|---|---|---|
| top100% | 3130 | 49.1 | -6.3 | -6.3 | 45/51/49 |
| top50% | 1569 | 48.6 | -7.3 | -7.3 | 43/50/50 |
| top25% | 783 | 47.8 | -8.9 | -8.8 | 43/49/50 |
| top15% | 470 | 46.6 | -11.1 | -11.0 | 44/47/47 |
| top10% | 312 | 47.4 | -9.5 | -9.4 | 49/50/43 |
| top5% | 159 | 46.5 | -11.3 | -11.2 | 51/48/40 |

### ANCHORED ensemble (9 fits)

| cut | n | win% | ROI | flat-110 ROI | per-season |
|---|---|---|---|---|---|
| top100% | 3130 | 49.6 | -5.4 | -5.4 | 48/52/48 |
| top50% | 1566 | 49.4 | -5.7 | -5.6 | 45/53/48 |
| top25% | 784 | 49.7 | -5.0 | -5.0 | 47/51/50 |
| top15% | 472 | 52.1 | -0.5 | -0.5 | 49/53/53 |
| top10% | 315 | 52.4 | -0.0 | -0.0 | 49/54/53 |
| top5% | 158 | 53.2 | +1.5 | +1.5 | 52/58/48 |

### COMBINED ensemble (18 fits)

| cut | n | win% | ROI | flat-110 ROI | per-season |
|---|---|---|---|---|---|
| top100% | 3130 | 49.4 | -5.7 | -5.7 | 46/51/49 |
| top50% | 1568 | 48.0 | -8.5 | -8.4 | 42/51/48 |
| top25% | 784 | 49.5 | -5.6 | -5.5 | 44/53/49 |
| top15% | 472 | 50.6 | -3.4 | -3.3 | 43/54/52 |
| top10% | 316 | 48.7 | -7.0 | -7.0 | 42/52/50 |
| top5% | 158 | 51.9 | -1.0 | -0.9 | 45/58/51 |

## B — seed dispersion at top10% (share framing)

| booster | seed | n | win% | ROI |
|---|---|---|---|---|
| hgb | 0 | 315 | 48.9 | -6.7 |
| hgb | 7 | 315 | 48.9 | -6.7 |
| hgb | 13 | 315 | 48.9 | -6.7 |
| lgbm | 0 | 314 | 47.1 | -10.1 |
| lgbm | 7 | 314 | 46.5 | -11.3 |
| lgbm | 13 | 313 | 48.6 | -7.3 |
| xgb | 0 | 313 | 48.6 | -7.3 |
| xgb | 7 | 314 | 48.4 | -7.6 |
| xgb | 13 | 314 | 46.8 | -10.7 |

## C — direction balance at top10% (share ensemble)

| side | n | win% | ROI |
|---|---|---|---|
| model says OVER | 157 | 48.4 | -7.7 |
| model says UNDER | 155 | 46.5 | -11.3 |

## D — absolute edge ladder (share ensemble, points of 1H total)

| |edge| >= | n | win% | ROI | per-season |
|---|---|---|---|---|
| 0 | 3130 | 49.1 | -6.3 | 45/51/49 |
| 1 | 2189 | 49.3 | -5.8 | 43/51/51 |
| 2 | 1381 | 47.9 | -8.7 | 43/49/49 |
| 3 | 848 | 47.5 | -9.3 | 43/49/49 |
| 4 | 488 | 47.3 | -9.7 | 43/49/48 |
| 5 | 264 | 48.5 | -7.5 | 50/50/46 |

## E — drop-one-season robustness (share ensemble, top10%)

| dropped | n | win% | ROI |
|---|---|---|---|
| 2023 | 237 | 46.8 | -10.6 |
| 2024 | 188 | 45.7 | -12.7 |
| 2025 | 199 | 49.7 | -5.1 |
