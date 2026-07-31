# NBA sides model — walk-forward on play-by-play features

n = 4,742 games, 4 seasons. Target = market residual, so R² > 0 beats the posted line.

## Walk-forward out-of-sample R² vs trusting the line

| feature set | model | R² T-60 | R² OPEN | corr T-60 | corr OPEN |
|---|---|---|---|---|---|
| player only | ridge | -0.02 | -0.09 | +2.03 | +1.02 |
| player only | gbm | -1.80 | -1.41 | +1.79 | +2.97 |
| player only | gbm-shallow | -0.84 | -0.81 | +1.90 | +1.89 |
| player only | rf | -0.42 | -0.45 | +2.56 | +2.22 |
| team process only | ridge | -0.00 | +0.01 | +2.82 | +3.23 |
| team process only | gbm | -1.62 | -1.62 | +2.02 | +1.92 |
| team process only | gbm-shallow | -1.09 | -1.04 | +0.88 | +0.98 |
| team process only | rf | -0.50 | -0.47 | +2.31 | +2.55 |
| base (no phase, no interaction) | ridge | -0.14 | +0.08 | +2.29 | +4.42 |
| base (no phase, no interaction) | gbm | -2.26 | -2.17 | +2.30 | +2.84 |
| base (no phase, no interaction) | gbm-shallow | -1.29 | -1.20 | +1.95 | +2.54 |
| base (no phase, no interaction) | rf | -0.48 | -0.33 | +1.66 | +2.76 |
| FULL (phase + interaction) | ridge | -0.34 | -0.12 | +1.98 | +3.94 |
| FULL (phase + interaction) | gbm | -2.57 | -2.64 | +1.18 | +1.28 |
| FULL (phase + interaction) | gbm-shallow | -1.38 | -1.46 | +1.52 | +1.56 |
| FULL (phase + interaction) | rf | -0.58 | -0.42 | +0.79 | +2.03 |

## Bet test — best cell by correlation (team process only / ridge, corr +2.82)

`edge` = win% − the hindsight max-side baseline of the same subset. A coin flip scores ≈ −2 on it, so compare `null mean`, not zero.

| cell | market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| pooled @300 | OPEN | 300 | 53.3 | 52.0 | **+1.3** | -2.7 | 0.116 | +1.8 | 2022:49 2023:44 2024:62 2025:55 |
| pooled @300 | T-60 | 300 | 53.7 | 50.0 | **+3.7** | -2.3 | 0.028 | +2.5 | 2022:47 2023:46 2024:66 2025:55 |
| pooled @600 | OPEN | 600 | 52.8 | 51.7 | **+1.2** | -2.0 | 0.092 | +0.9 | 2022:48 2023:47 2024:58 2025:54 |
| pooled @600 | T-60 | 600 | 52.5 | 50.8 | **+1.7** | -1.6 | 0.051 | +0.3 | 2022:47 2023:49 2024:57 2025:54 |
| pooled @1000 | OPEN | 1,000 | 51.9 | 50.5 | **+1.4** | -1.7 | 0.045 | -0.9 | 2022:51 2023:45 2024:58 2025:52 |
| pooled @1000 | T-60 | 1,000 | 51.7 | 50.0 | **+1.7** | -1.3 | 0.024 | -1.3 | 2022:49 2023:47 2024:56 2025:52 |

### the same model, by season phase

| cell | market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| mid (16-45) | OPEN | 250 | 52.4 | 54.0 | **-1.6** | -3.0 | 0.451 | +0.0 | 2023:43 2024:57 2025:57 |
| mid (16-45) | T-60 | 250 | 53.2 | 53.2 | **+0.0** | -2.6 | 0.308 | +1.6 | 2023:47 2024:54 2025:56 |
| late (46-81) | OPEN | 250 | 52.8 | 50.8 | **+2.0** | -3.4 | 0.065 | +0.8 | 2022:47 2023:40 2024:64 2025:52 |
| late (46-81) | T-60 | 250 | 51.2 | 50.8 | **+0.4** | -3.2 | 0.165 | -2.2 | 2022:45 2023:35 2024:61 2025:53 |
