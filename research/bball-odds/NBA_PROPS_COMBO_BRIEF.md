# NBA props — combo markets against their own components

182,603 combo props, seasons ['2023-24', '2024-25', '2025-26'], consensus lines at T-60. Model-free: the only inputs are lines the book posted itself.

`gap` = combo line minus the sum of its component lines. `resid` = that gap minus the gap this market normally runs, estimated walk-forward from strictly earlier slates. A POSITIVE resid means the combo line is set high relative to its own components, which argues the UNDER.


## The nuisance parameter itself (why the raw gap cannot be the signal)

| market | n | mean gap | sd of gap | mean |resid| |
|---|---|---|---|---|
| player_points_assists | 44,523 | +0.19 | 0.54 | 0.47 |
| player_points_rebounds | 47,560 | +0.19 | 0.53 | 0.46 |
| player_points_rebounds_assists | 46,575 | +0.41 | 0.61 | 0.54 |
| player_rebounds_assists | 43,945 | +0.15 | 0.51 | 0.46 |

## Bet the residual

| resid | side | n | win% | ROI | per-season ROI |
|---|---|---|---|---|---|
| +0.25-0.75 | under | 94,365 | 52.44 | -3.32 | -1.9/-4.7/-3.3 |
| -0.25-0.75 | over | 63,968 | 50.02 | -8.17 | -8.3/-8.1/-8.1 |
| +0.75-1.25 | under | 3,041 | 52.61 | -3.54 | -1.2/-2.8/-5.1 |
| -0.75-1.25 | over | 1,514 | 50.79 | -6.44 | -8.9/-8.2/-3.5 |
| +1.25-2.0 | under | 4,233 | 54.26 | -2.76 | -2.0/+2.6/-9.2 |
| -1.25-2.0 | over | 2,248 | 53.07 | -3.08 | +0.3/-5.9/-2.9 |
| +2.0+ | under | 0 | nan | +nan | +nan/+nan/+nan |
| -2.0+ | over | 0 | nan | +nan | +nan/+nan/+nan |

## Control — against blind side-betting on the same markets

| bet | n | win% | ROI |
|---|---|---|---|
| blind UNDER, all combo props | 181,905 | 51.49 | -3.84 |
| blind OVER, all combo props | 181,905 | 48.51 | -9.09 |

## Per market, |resid| >= 0.75

| market | side | n | win% | ROI | blind same-side ROI | delta |
|---|---|---|---|---|---|---|
| player_points_assists | under | 2,293 | 54.38 | -1.31 | -4.63 | +3.32 |
| player_points_assists | over | 388 | 54.12 | -2.26 | -8.46 | +6.20 |
| player_points_rebounds | under | 2,488 | 52.65 | -4.01 | -3.60 | -0.41 |
| player_points_rebounds | over | 358 | 53.35 | -3.05 | -9.23 | +6.18 |
| player_points_rebounds_assists | under | 1,433 | 53.04 | -3.36 | -3.79 | +0.42 |
| player_points_rebounds_assists | over | 2,978 | 51.88 | -4.55 | -9.09 | +4.54 |
| player_rebounds_assists | under | 1,096 | 54.93 | -3.90 | -3.36 | -0.55 |
| player_rebounds_assists | over | 87 | 49.43 | -13.42 | -9.58 | -3.84 |

## Monotonicity — |resid| ladder, both sides pooled

| |resid| >= | n | win% | ROI | delta vs blind same-side |
|---|---|---|---|---|
| 0.00 | 181,905 | 51.41 | -5.36 | +0.70 |
| 0.25 | 169,454 | 51.57 | -5.16 | +0.78 |
| 0.50 | 70,887 | 51.45 | -5.97 | +1.30 |
| 0.75 | 11,121 | 53.12 | -3.49 | +2.15 |
| 1.00 | 7,587 | 53.57 | -3.23 | +2.51 |
| 1.50 | 1,334 | 54.95 | -0.54 | +4.97 |
