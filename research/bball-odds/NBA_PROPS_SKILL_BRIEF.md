# NBA props — does the model forecast at all?

473,596 props from `nba_props_panel.parquet`. Walk-forward LGBM regression on the settled stat, benchmarked against the posted line, which is the market's own median forecast of the same quantity.

This is a DIAGNOSTIC, not a bet: no prices appear anywhere below. It exists to separate 'the market is efficient' from 'my features are weak', which the betting runs cannot tell apart because both give ROI ~ 0.

## 1 — level: can the model forecast the stat as well as the line?

| market | n | MAE model | MAE line | MAE ratio | corr model | corr line |
|---|---|---|---|---|---|---|
| player_assists | 40,500 | 1.530 | 1.539 | 0.9941 | 0.696 | 0.700 |
| player_blocks | 34,722 | 0.615 | 0.680 | 0.9039 | 0.453 | 0.400 |
| player_points | 43,743 | 4.976 | 4.914 | 1.0127 | 0.687 | 0.695 |
| player_points_assists | 38,735 | 5.488 | 5.423 | 1.0119 | 0.726 | 0.734 |
| player_points_rebounds | 40,968 | 5.881 | 5.817 | 1.0110 | 0.690 | 0.698 |
| player_points_rebounds_assists | 42,801 | 6.256 | 6.192 | 1.0103 | 0.734 | 0.741 |
| player_rebounds | 42,902 | 2.015 | 2.012 | 1.0010 | 0.668 | 0.673 |
| player_rebounds_assists | 38,187 | 2.805 | 2.779 | 1.0094 | 0.670 | 0.679 |
| player_steals | 26,519 | 0.819 | 0.858 | 0.9545 | 0.262 | 0.245 |
| player_threes | 38,686 | 1.117 | 1.139 | 0.9806 | 0.456 | 0.447 |

## 2 — encompassing: actual ~ a + b*line + c*model

`c` is the weight the outcome puts on the model AFTER the line is already in the regression. c = 0 means the line encompasses the model entirely.

| market | b (line) | t | c (model) | t | verdict |
|---|---|---|---|---|---|
| player_assists | +0.575 | +28.9 | +0.406 | +19.8 | model adds information |
| player_blocks | +0.286 | +15.8 | +0.709 | +47.3 | model adds information |
| player_points | +0.787 | +31.8 | +0.172 | +6.7 | model adds information |
| player_points_assists | +0.799 | +31.1 | +0.168 | +6.3 | model adds information |
| player_points_rebounds | +0.788 | +30.7 | +0.177 | +6.7 | model adds information |
| player_points_rebounds_assists | +0.771 | +30.4 | +0.198 | +7.5 | model adds information |
| player_rebounds | +0.617 | +27.3 | +0.357 | +15.2 | model adds information |
| player_rebounds_assists | +0.786 | +31.1 | +0.192 | +7.5 | model adds information |
| player_steals | +0.282 | +16.1 | +0.520 | +22.6 | model adds information |
| player_threes | +0.378 | +20.7 | +0.574 | +29.0 | model adds information |

## 3 — does model-minus-line predict the outcome's direction?

Over rate by how far the model sits above the posted line. If the model carries real information this must slope upward.

| model - line | n | over rate | mean line |
|---|---|---|---|
| < -20% | 26,348 | 28.72 | 1.81 |
| -20..-10% | 28,563 | 41.39 | 8.60 |
| -10..-3% | 59,197 | 45.39 | 13.10 |
| -3..+3% | 88,117 | 47.58 | 14.36 |
| +3..+10% | 81,244 | 48.95 | 12.09 |
| +10..+20% | 45,730 | 50.35 | 7.69 |
| > +20% | 57,219 | 54.40 | 1.78 |
