# NBA props — forecast combination (line + model)

Weights from `actual ~ a + b*line + c*model`, fitted walk-forward on strictly earlier props. P(over) priced off the blend's own residual distribution.

The bar is the 6.9% hold: the blend must beat the line by MORE than the vig, not merely beat it.

## Does the blend forecast better than the line it blends with?

| market | MAE line | MAE model | MAE blend | blend vs line |
|---|---|---|---|---|
| player_assists | 1.534 | 1.522 | 1.524 | -0.66% |
| player_blocks | 0.680 | 0.611 | 0.623 | -8.28% |
| player_points | 4.916 | 4.971 | 4.922 | +0.13% |
| player_points_assists | 5.437 | 5.494 | 5.441 | +0.08% |
| player_points_rebounds | 5.820 | 5.877 | 5.823 | +0.05% |
| player_points_rebounds_assists | 6.191 | 6.244 | 6.194 | +0.04% |
| player_rebounds | 2.011 | 2.010 | 2.005 | -0.29% |
| player_rebounds_assists | 2.780 | 2.803 | 2.781 | +0.06% |
| player_steals | 0.870 | 0.830 | 0.831 | -4.53% |
| player_threes | 1.141 | 1.119 | 1.125 | -1.40% |

## Pooled — blend vs blind under on the identical rows

| cut | venue | n | win% | ROI | blind under | delta |
|---|---|---|---|---|---|---|
| top100% | cons | 336,968 | 48.97 | -5.19 | -3.89 | -1.30 |
| top100% | best | 338,243 | 49.52 | -4.70 | -1.20 | -3.51 |
| top100% | second | 286,569 | 49.14 | -6.68 | -2.99 | -3.69 |
| top25% | cons | 84,268 | 47.60 | -4.18 | -3.60 | -0.57 |
| top25% | best | 84,579 | 48.37 | -7.79 | -1.06 | -6.73 |
| top25% | second | 71,648 | 48.12 | -8.78 | -2.79 | -5.99 |
| top10% | cons | 33,698 | 46.96 | -3.56 | -3.02 | -0.54 |
| top10% | best | 33,834 | 47.62 | -9.29 | -0.73 | -8.56 |
| top10% | second | 28,664 | 47.90 | -9.15 | -1.95 | -7.20 |
| top5% | cons | 16,869 | 46.47 | -3.64 | -3.01 | -0.62 |
| top5% | best | 16,923 | 46.97 | -10.26 | -0.93 | -9.34 |
| top5% | second | 14,336 | 47.72 | -9.32 | -1.40 | -7.92 |

## Per market at top10%, best line

| market | n | win% | ROI | blind under | delta |
|---|---|---|---|---|---|
| player_assists | 3,563 | 40.67 | -21.18 | -5.96 | -15.22 |
| player_blocks | 2,978 | 50.03 | -0.22 | -0.62 | +0.40 |
| player_points | 3,862 | 51.06 | -4.15 | +0.74 | -4.89 |
| player_points_assists | 3,382 | 49.66 | -6.68 | +0.86 | -7.55 |
| player_points_rebounds | 3,596 | 50.82 | -4.49 | +1.84 | -6.33 |
| player_points_rebounds_assists | 3,780 | 50.60 | -4.97 | -0.63 | -4.34 |
| player_rebounds | 3,783 | 45.76 | -14.54 | -1.97 | -12.58 |
| player_rebounds_assists | 3,324 | 47.28 | -11.19 | -1.78 | -9.41 |
| player_steals | 2,155 | 47.03 | -8.76 | +1.29 | -10.06 |
| player_threes | 3,411 | 42.95 | -15.73 | -0.33 | -15.40 |
