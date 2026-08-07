# NBA props — conditional-distribution pricing

Poisson-objective booster for the mean, then P(X>line) priced three ways. Seasons ['2023-24', '2024-25', '2025-26'], rolling origin every 2 months.

Reported against BLIND UNDER on the identical rows — the prop market's over-shade means beating 50% proves nothing.

## Per market x variant, top10% at the best line

| market | variant | n | win% | ROI | blind-under ROI | delta |
|---|---|---|---|---|---|---|
| player_blocks | pois | 3,466 | 54.36 | +0.04 | -0.38 | +0.42 |
| player_blocks | nb | 3,466 | 48.36 | +2.12 | +2.07 | +0.05 |
| player_blocks | emp | 3,475 | 58.19 | -2.95 | -1.69 | -1.26 |
| player_steals | pois | 2,635 | 57.31 | +1.30 | +2.31 | -1.01 |
| player_steals | nb | 2,635 | 49.41 | +2.83 | +2.83 | +0.00 |
| player_steals | emp | 2,635 | 51.61 | -1.22 | +0.83 | -2.05 |
| player_threes | pois | 3,860 | 55.03 | +0.34 | -0.27 | +0.61 |
| player_threes | nb | 3,860 | 53.01 | +2.86 | +3.33 | -0.47 |
| player_threes | emp | 3,860 | 53.42 | -3.67 | -0.62 | -3.05 |
| player_assists | pois | 4,037 | 52.91 | -3.18 | -3.78 | +0.60 |
| player_assists | nb | 4,037 | 51.50 | -2.50 | -1.57 | -0.94 |
| player_assists | emp | 4,037 | 51.30 | -4.96 | -5.81 | +0.85 |
| player_rebounds | pois | 4,277 | 54.13 | +0.32 | +3.67 | -3.36 |
| player_rebounds | nb | 4,277 | 54.48 | +2.98 | +3.10 | -0.12 |
| player_rebounds | emp | 4,277 | 53.00 | -1.74 | +1.81 | -3.56 |
| player_points | pois | 4,366 | 52.18 | -2.03 | -1.07 | -0.96 |
| player_points | nb | 4,366 | 52.66 | -0.98 | +0.16 | -1.14 |
| player_points | emp | 4,366 | 52.98 | -0.36 | -0.79 | +0.43 |

## Pooled by variant

| variant | cut | venue | n | win% | ROI | blind ROI | delta |
|---|---|---|---|---|---|---|---|
| pois | top100% | cons | 226,393 | 52.25 | -4.51 | -3.73 | -0.78 |
| pois | top100% | best | 226,386 | 53.03 | -2.18 | -1.24 | -0.95 |
| pois | top25% | cons | 56,600 | 54.05 | -1.69 | -2.97 | +1.29 |
| pois | top25% | best | 56,599 | 54.66 | +0.14 | -0.79 | +0.93 |
| pois | top10% | cons | 22,641 | 53.50 | -1.96 | -1.72 | -0.24 |
| pois | top10% | best | 22,641 | 54.09 | -0.68 | -0.02 | -0.66 |
| nb | top100% | cons | 226,393 | 53.27 | -3.50 | -3.73 | +0.23 |
| nb | top100% | best | 226,386 | 54.40 | -1.06 | -1.24 | +0.17 |
| nb | top25% | cons | 56,600 | 51.03 | -0.89 | -0.77 | -0.13 |
| nb | top25% | best | 56,599 | 52.30 | +1.20 | +1.39 | -0.19 |
| nb | top10% | cons | 22,641 | 50.42 | -0.40 | +0.07 | -0.47 |
| nb | top10% | best | 22,641 | 51.82 | +1.07 | +1.55 | -0.48 |
| emp | top100% | cons | 226,393 | 53.04 | -4.60 | -3.73 | -0.88 |
| emp | top100% | best | 226,386 | 53.90 | -2.24 | -1.24 | -1.01 |
| emp | top25% | cons | 56,610 | 53.98 | -4.12 | -3.26 | -0.86 |
| emp | top25% | best | 56,614 | 54.70 | -2.03 | -1.04 | -0.99 |
| emp | top10% | cons | 22,651 | 52.63 | -4.56 | -3.35 | -1.21 |
| emp | top10% | best | 22,650 | 53.40 | -2.50 | -1.11 | -1.39 |
