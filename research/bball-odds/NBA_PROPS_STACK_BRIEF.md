# NBA props — distributional regression + stacking

473,596 props from `nba_props_panel.parquet`, seasons ['2023-24', '2024-25', '2025-26']. Rolling origin every 3 months. Five base learners with different inductive biases, plus a logistic stack fitted only on earlier out-of-sample base predictions.

**Delta vs BLIND UNDER is the only number that means anything.** `mkt` ranks two-sided by edge over the market's de-vigged price; `abs` ranks by |p-0.5|, which flatters low-line markets and is shown for contrast; `under` is one-sided under-selection compared against blind under on the FULL market.


## Pooled across markets — ranking mode `mkt`

| model | cut | venue | n | win% | ROI | blind ROI | delta |
|---|---|---|---|---|---|---|---|
| qreg | top100% | cons | 413,974 | 51.47 | -4.49 | -3.68 | -0.81 |
| qreg | top100% | best | 415,306 | 52.52 | -1.98 | -1.01 | -0.97 |
| qreg | top25% | cons | 103,497 | 52.68 | -2.69 | -2.82 | +0.14 |
| qreg | top25% | best | 103,829 | 53.53 | -0.36 | -0.24 | -0.13 |
| qreg | top10% | cons | 41,401 | 52.59 | -2.31 | -2.23 | -0.08 |
| qreg | top10% | best | 41,537 | 53.45 | +0.12 | +0.40 | -0.28 |
| qreg | top5% | cons | 20,704 | 52.96 | -1.51 | -1.04 | -0.47 |
| qreg | top5% | best | 20,771 | 53.76 | +0.80 | +1.52 | -0.72 |
| resid | top100% | cons | 413,974 | 51.97 | -4.89 | -3.68 | -1.21 |
| resid | top100% | best | 415,306 | 53.06 | -2.35 | -1.01 | -1.34 |
| resid | top25% | cons | 103,497 | 51.94 | -4.58 | -3.32 | -1.25 |
| resid | top25% | best | 103,830 | 52.96 | -1.87 | -0.42 | -1.46 |
| resid | top10% | cons | 41,401 | 51.27 | -4.53 | -3.37 | -1.16 |
| resid | top10% | best | 41,541 | 52.37 | -1.59 | -0.36 | -1.24 |
| resid | top5% | cons | 20,706 | 50.31 | -5.28 | -2.27 | -3.01 |
| resid | top5% | best | 20,772 | 51.36 | -2.36 | +0.60 | -2.97 |
| ridge | top100% | cons | 413,974 | 51.94 | -3.92 | -3.68 | -0.25 |
| ridge | top100% | best | 415,306 | 52.93 | -1.59 | -1.01 | -0.58 |
| ridge | top25% | cons | 103,507 | 53.75 | -1.49 | -2.07 | +0.57 |
| ridge | top25% | best | 103,838 | 54.50 | +0.52 | +0.46 | +0.06 |
| ridge | top10% | cons | 41,406 | 54.43 | -0.56 | -1.18 | +0.62 |
| ridge | top10% | best | 41,543 | 55.14 | +1.33 | +1.12 | +0.22 |
| ridge | top5% | cons | 20,708 | 54.89 | +0.50 | +0.26 | +0.24 |
| ridge | top5% | best | 20,779 | 55.60 | +2.33 | +2.37 | -0.03 |
| clf | top100% | cons | 413,974 | 51.58 | -4.83 | -3.68 | -1.15 |
| clf | top100% | best | 415,306 | 52.78 | -2.24 | -1.01 | -1.23 |
| clf | top25% | cons | 103,497 | 51.83 | -4.12 | -3.41 | -0.71 |
| clf | top25% | best | 103,829 | 52.93 | -1.47 | -0.64 | -0.83 |
| clf | top10% | cons | 41,401 | 51.52 | -3.76 | -3.01 | -0.76 |
| clf | top10% | best | 41,537 | 52.62 | -0.99 | -0.25 | -0.74 |
| clf | top5% | cons | 20,703 | 51.12 | -3.73 | -2.67 | -1.05 |
| clf | top5% | best | 20,771 | 52.20 | -0.90 | +0.11 | -1.01 |
| mlp | top100% | cons | 413,974 | 51.51 | -5.12 | -3.68 | -1.44 |
| mlp | top100% | best | 415,306 | 52.75 | -2.48 | -1.01 | -1.47 |
| mlp | top25% | cons | 103,497 | 52.00 | -4.21 | -3.64 | -0.57 |
| mlp | top25% | best | 103,829 | 53.28 | -1.63 | -0.91 | -0.73 |
| mlp | top10% | cons | 41,401 | 51.99 | -3.31 | -3.09 | -0.22 |
| mlp | top10% | best | 41,537 | 53.44 | -0.71 | -0.24 | -0.46 |
| mlp | top5% | cons | 20,703 | 51.60 | -3.22 | -2.99 | -0.23 |
| mlp | top5% | best | 20,771 | 53.19 | -0.71 | -0.25 | -0.47 |
| stack | top100% | cons | 336,968 | 53.07 | -3.92 | -3.89 | -0.02 |
| stack | top100% | best | 338,243 | 54.11 | -1.51 | -1.20 | -0.32 |
| stack | top25% | cons | 84,507 | 55.32 | -1.90 | -1.93 | +0.03 |
| stack | top25% | best | 84,827 | 55.99 | +0.22 | +0.45 | -0.23 |
| stack | top10% | cons | 33,723 | 56.61 | -1.01 | -0.93 | -0.08 |
| stack | top10% | best | 33,843 | 57.11 | +0.87 | +1.13 | -0.25 |
| stack | top5% | cons | 16,900 | 56.92 | -0.97 | -0.67 | -0.31 |
| stack | top5% | best | 16,966 | 57.30 | +0.69 | +1.18 | -0.50 |

## Pooled across markets — ranking mode `abs`

| model | cut | venue | n | win% | ROI | blind ROI | delta |
|---|---|---|---|---|---|---|---|
| qreg | top100% | cons | 413,974 | 54.39 | -4.79 | -3.68 | -1.12 |
| qreg | top100% | best | 415,306 | 55.09 | -2.44 | -1.01 | -1.43 |
| qreg | top25% | cons | 103,497 | 58.60 | -2.68 | -2.93 | +0.25 |
| qreg | top25% | best | 103,829 | 59.02 | -0.75 | -0.56 | -0.19 |
| qreg | top10% | cons | 41,401 | 59.61 | -2.27 | -2.52 | +0.25 |
| qreg | top10% | best | 41,537 | 60.00 | -0.37 | -0.21 | -0.16 |
| qreg | top5% | cons | 20,703 | 60.54 | -1.10 | -2.04 | +0.94 |
| qreg | top5% | best | 20,771 | 60.92 | +0.76 | +0.19 | +0.56 |
| resid | top100% | cons | 413,974 | 53.76 | -4.81 | -3.68 | -1.13 |
| resid | top100% | best | 415,306 | 54.59 | -2.37 | -1.01 | -1.36 |
| resid | top25% | cons | 103,969 | 56.02 | -3.95 | -3.23 | -0.72 |
| resid | top25% | best | 104,933 | 56.76 | -1.53 | -0.47 | -1.06 |
| resid | top10% | cons | 42,329 | 56.73 | -3.88 | -3.14 | -0.73 |
| resid | top10% | best | 42,414 | 57.40 | -1.45 | -0.42 | -1.02 |
| resid | top5% | cons | 21,267 | 56.60 | -3.98 | -2.62 | -1.36 |
| resid | top5% | best | 21,368 | 57.27 | -1.44 | +0.18 | -1.62 |
| ridge | top100% | cons | 413,974 | 55.04 | -4.17 | -3.68 | -0.49 |
| ridge | top100% | best | 415,306 | 55.58 | -2.01 | -1.01 | -1.00 |
| ridge | top25% | cons | 103,955 | 59.30 | -2.20 | -2.77 | +0.57 |
| ridge | top25% | best | 104,219 | 59.56 | -0.58 | -0.55 | -0.03 |
| ridge | top10% | cons | 42,086 | 61.07 | -1.42 | -2.48 | +1.07 |
| ridge | top10% | best | 42,182 | 61.29 | +0.08 | -0.52 | +0.59 |
| ridge | top5% | cons | 22,295 | 63.23 | -0.50 | -1.54 | +1.04 |
| ridge | top5% | best | 22,335 | 63.38 | +0.79 | +0.19 | +0.61 |
| clf | top100% | cons | 413,974 | 54.04 | -4.96 | -3.68 | -1.28 |
| clf | top100% | best | 415,306 | 54.86 | -2.52 | -1.01 | -1.50 |
| clf | top25% | cons | 103,497 | 57.73 | -3.54 | -3.29 | -0.25 |
| clf | top25% | best | 103,829 | 58.30 | -1.34 | -0.79 | -0.54 |
| clf | top10% | cons | 41,401 | 58.67 | -3.21 | -2.93 | -0.28 |
| clf | top10% | best | 41,537 | 59.24 | -0.95 | -0.43 | -0.52 |
| clf | top5% | cons | 20,703 | 59.04 | -3.07 | -3.68 | +0.61 |
| clf | top5% | best | 20,771 | 59.56 | -0.90 | -1.39 | +0.49 |
| mlp | top100% | cons | 413,974 | 54.04 | -4.94 | -3.68 | -1.26 |
| mlp | top100% | best | 415,306 | 54.91 | -2.49 | -1.01 | -1.48 |
| mlp | top25% | cons | 103,497 | 57.25 | -4.30 | -3.85 | -0.46 |
| mlp | top25% | best | 103,829 | 57.92 | -2.18 | -1.41 | -0.77 |
| mlp | top10% | cons | 41,401 | 58.41 | -3.72 | -4.07 | +0.35 |
| mlp | top10% | best | 41,537 | 59.11 | -1.62 | -1.70 | +0.09 |
| mlp | top5% | cons | 20,703 | 59.40 | -2.75 | -3.52 | +0.78 |
| mlp | top5% | best | 20,771 | 60.14 | -0.62 | -1.11 | +0.49 |
| stack | top100% | cons | 336,968 | 55.07 | -4.77 | -3.89 | -0.87 |
| stack | top100% | best | 338,243 | 55.62 | -2.57 | -1.20 | -1.37 |
| stack | top25% | cons | 86,698 | 59.58 | -3.38 | -3.47 | +0.09 |
| stack | top25% | best | 86,834 | 59.86 | -1.71 | -1.30 | -0.41 |
| stack | top10% | cons | 36,442 | 61.00 | -2.66 | -2.77 | +0.12 |
| stack | top10% | best | 36,495 | 61.22 | -1.22 | -1.24 | +0.01 |
| stack | top5% | cons | 18,061 | 62.46 | -1.85 | -1.56 | -0.28 |
| stack | top5% | best | 18,487 | 62.56 | -0.59 | -0.29 | -0.30 |

## Pooled across markets — ranking mode `under`

| model | cut | venue | n | win% | ROI | blind ROI | delta |
|---|---|---|---|---|---|---|---|
| qreg | top100% | cons | 413,974 | 52.97 | -3.68 | -3.68 | +0.00 |
| qreg | top100% | best | 415,306 | 54.31 | -1.01 | -1.01 | +0.00 |
| qreg | top25% | cons | 103,497 | 54.64 | -0.85 | -3.68 | +2.83 |
| qreg | top25% | best | 103,829 | 55.59 | +1.62 | -1.01 | +2.63 |
| qreg | top10% | cons | 41,401 | 54.86 | -0.26 | -3.68 | +3.42 |
| qreg | top10% | best | 41,537 | 55.76 | +2.25 | -1.01 | +3.26 |
| qreg | top5% | cons | 20,703 | 55.05 | +0.32 | -3.68 | +4.00 |
| qreg | top5% | best | 20,771 | 56.03 | +3.05 | -1.01 | +4.07 |
| resid | top100% | cons | 413,974 | 52.97 | -3.68 | -3.68 | +0.00 |
| resid | top100% | best | 415,306 | 54.31 | -1.01 | -1.01 | +0.00 |
| resid | top25% | cons | 103,505 | 54.86 | -1.90 | -3.68 | +1.78 |
| resid | top25% | best | 103,840 | 55.70 | +0.42 | -1.01 | +1.44 |
| resid | top10% | cons | 41,406 | 54.98 | -1.13 | -3.68 | +2.54 |
| resid | top10% | best | 41,542 | 55.76 | +1.19 | -1.01 | +2.20 |
| resid | top5% | cons | 20,713 | 54.25 | -1.62 | -3.68 | +2.06 |
| resid | top5% | best | 20,771 | 55.00 | +0.76 | -1.01 | +1.77 |
| ridge | top100% | cons | 413,974 | 52.97 | -3.68 | -3.68 | +0.00 |
| ridge | top100% | best | 415,306 | 54.31 | -1.01 | -1.01 | +0.00 |
| ridge | top25% | cons | 103,500 | 54.48 | -0.74 | -3.68 | +2.94 |
| ridge | top25% | best | 103,844 | 55.30 | +1.48 | -1.01 | +2.49 |
| ridge | top10% | cons | 41,401 | 55.43 | +1.21 | -3.68 | +4.88 |
| ridge | top10% | best | 41,545 | 56.16 | +3.23 | -1.01 | +4.24 |
| ridge | top5% | cons | 20,716 | 56.27 | +2.59 | -3.68 | +6.27 |
| ridge | top5% | best | 20,779 | 56.95 | +4.58 | -1.01 | +5.60 |
| clf | top100% | cons | 413,974 | 52.97 | -3.68 | -3.68 | +0.00 |
| clf | top100% | best | 415,306 | 54.31 | -1.01 | -1.01 | +0.00 |
| clf | top25% | cons | 103,497 | 53.80 | -1.91 | -3.68 | +1.77 |
| clf | top25% | best | 103,829 | 54.91 | +0.67 | -1.01 | +1.68 |
| clf | top10% | cons | 41,401 | 53.18 | -2.01 | -3.68 | +1.67 |
| clf | top10% | best | 41,537 | 54.33 | +0.77 | -1.01 | +1.78 |
| clf | top5% | cons | 20,703 | 52.86 | -1.77 | -3.68 | +1.91 |
| clf | top5% | best | 20,771 | 54.05 | +1.09 | -1.01 | +2.10 |
| mlp | top100% | cons | 413,974 | 52.97 | -3.68 | -3.68 | +0.00 |
| mlp | top100% | best | 415,306 | 54.31 | -1.01 | -1.01 | +0.00 |
| mlp | top25% | cons | 103,497 | 53.51 | -2.45 | -3.68 | +1.23 |
| mlp | top25% | best | 103,829 | 54.67 | +0.07 | -1.01 | +1.09 |
| mlp | top10% | cons | 41,401 | 52.85 | -2.49 | -3.68 | +1.19 |
| mlp | top10% | best | 41,537 | 54.15 | +0.10 | -1.01 | +1.11 |
| mlp | top5% | cons | 20,703 | 52.55 | -2.17 | -3.68 | +1.51 |
| mlp | top5% | best | 20,771 | 54.07 | +0.49 | -1.01 | +1.50 |
| stack | top100% | cons | 336,968 | 52.88 | -3.89 | -3.89 | +0.00 |
| stack | top100% | best | 338,243 | 54.30 | -1.20 | -1.20 | +0.00 |
| stack | top25% | cons | 84,261 | 55.34 | -1.43 | -3.89 | +2.46 |
| stack | top25% | best | 84,593 | 56.05 | +0.79 | -1.20 | +1.98 |
| stack | top10% | cons | 33,723 | 56.59 | -0.39 | -3.89 | +3.51 |
| stack | top10% | best | 33,864 | 57.16 | +1.66 | -1.20 | +2.85 |
| stack | top5% | cons | 16,881 | 56.80 | -0.56 | -3.89 | +3.33 |
| stack | top5% | best | 16,940 | 57.20 | +1.17 | -1.20 | +2.37 |

## Per market — best model at top10%, best line, `mkt` ranking

| market | model | n | win% | ROI | blind ROI | delta |
|---|---|---|---|---|---|---|
| player_assists | ridge | 4,322 | 56.71 | +0.77 | -4.81 | +5.58 |
| player_blocks | qreg | 3,750 | 52.45 | +0.23 | -2.02 | +2.25 |
| player_points | stack | 3,862 | 54.56 | +2.36 | +2.57 | -0.21 |
| player_points_assists | ridge | 4,150 | 54.41 | +1.28 | -0.25 | +1.54 |
| player_points_rebounds | clf | 4,377 | 53.23 | -0.22 | +0.14 | -0.36 |
| player_points_rebounds_assists | stack | 3,782 | 53.86 | -0.44 | +0.39 | -0.84 |
| player_rebounds | clf | 4,573 | 53.66 | +0.13 | -1.10 | +1.22 |
| player_rebounds_assists | resid | 4,096 | 53.59 | +0.34 | -2.81 | +3.15 |
| player_steals | ridge | 2,931 | 57.42 | +6.14 | +6.79 | -0.65 |
| player_threes | clf | 4,125 | 54.04 | +0.55 | -1.15 | +1.70 |

## Per market — one-sided UNDER selection, top10% at the best line

| market | model | n | win% | ROI | blind under (all rows) | delta |
|---|---|---|---|---|---|---|
| player_assists | ridge | 4,325 | 55.24 | +2.28 | -2.60 | +4.88 |
| player_blocks | mlp | 3,750 | 58.88 | +2.81 | -2.31 | +5.12 |
| player_points | ridge | 4,660 | 55.69 | +4.77 | -0.30 | +5.07 |
| player_points_assists | ridge | 4,150 | 56.05 | +4.97 | -2.07 | +7.05 |
| player_points_rebounds | ridge | 4,377 | 56.04 | +5.01 | -0.79 | +5.81 |
| player_points_rebounds_assists | qreg | 4,553 | 55.28 | +3.49 | -0.77 | +4.26 |
| player_rebounds | qreg | 4,573 | 56.42 | +5.05 | +0.51 | +4.54 |
| player_rebounds_assists | resid | 4,096 | 53.86 | +0.69 | -0.94 | +1.63 |
| player_steals | stack | 2,165 | 61.15 | +7.11 | -1.32 | +8.43 |
| player_threes | ridge | 4,125 | 57.12 | +3.31 | -0.59 | +3.90 |
