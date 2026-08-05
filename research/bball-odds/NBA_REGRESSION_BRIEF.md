# NBA sides — process-vs-results features from play-by-play

## Pre-registered hypotheses, tested as raw correlations

Correlation with the T-60 spread residual (positive = home covers more). Sign, not size, is the test.

| feature | corr vs T-60 resid | corr vs OPEN resid | n |
|---|---|---|---|
| H1 shooting luck (expect NEGATIVE) (`d_luck_net`) | -1.01 | -0.25 | 4,988 |
| H2 process xEFG (`d_xefg_net`) | +4.65 | +5.36 | 4,988 |
| H2 results aEFG (`d_aefg_net`) | +0.05 | +0.92 | 4,988 |
| H3 talent − results (expect POSITIVE) (`d_gap`) | -1.06 | -1.76 | 4,875 |
| RAPM talent (`d_talent_m`) | +1.14 | +2.41 | 4,875 |
| trailing margin (market's view) (`d_results`) | +1.52 | +3.03 | 4,933 |

## Walk-forward out-of-sample R² vs trusting the line

Target = market residual, so R² > 0 means the features beat the posted spread and R² < 0 means they are worse than it.

| feature set | model | R² vs T-60 | R² vs OPEN | corr T-60 |
|---|---|---|---|---|
| shot-quality luck only | ridge | -0.31 | -0.35 | -1.06 |
| shot-quality luck only | gbm | -1.25 | -1.45 | +1.74 |
| process (xefg) only | ridge | +0.02 | +0.07 | +3.21 |
| process (xefg) only | gbm | -1.64 | -1.76 | +1.39 |
| results (aefg) only | ridge | -0.23 | -0.25 | -0.85 |
| results (aefg) only | gbm | -0.97 | -1.05 | -0.71 |
| RAPM talent only | ridge | -0.25 | -0.23 | -0.25 |
| RAPM talent only | gbm | -1.82 | -1.79 | +0.61 |
| talent minus results | ridge | -0.27 | -0.27 | -3.08 |
| talent minus results | gbm | -1.05 | -1.11 | +0.64 |
| ALL process+talent | ridge | -0.30 | -0.18 | +1.37 |
| ALL process+talent | gbm | -2.07 | -2.07 | +1.93 |
| process + market context | ridge | -0.29 | +0.01 | +1.10 |
| process + market context | gbm | -1.56 | -1.65 | +3.70 |

## Bet test — best cell (process + market context / gbm, corr +3.70)

`edge` = win% − the max-side baseline of the same subset. That baseline is picked with hindsight, so a coin flip scores about −2; compare to `null mean`, not 0.

| set | market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| process + market context/gbm | OPEN | 400 | 55.0 | 53.8 | **+1.3** | -1.9 | 0.147 | +5.0 | 2022:46 2023:49 2024:63 2025:61 |
| process + market context/gbm | OPEN | 800 | 52.1 | 50.6 | **+1.5** | -1.3 | 0.087 | -0.5 | 2022:52 2023:50 2024:55 2025:53 |
| process + market context/gbm | OPEN | 1,600 | 50.1 | 50.7 | **-0.6** | -0.9 | 0.446 | -4.4 | 2022:52 2023:49 2024:50 2025:51 |
| process + market context/gbm | T-60 | 400 | 54.5 | 54.2 | **+0.3** | -1.8 | 0.226 | +4.1 | 2022:46 2023:50 2024:59 2025:62 |
| process + market context/gbm | T-60 | 800 | 52.0 | 51.6 | **+0.4** | -1.2 | 0.233 | -0.7 | 2022:52 2023:49 2024:55 2025:53 |
| process + market context/gbm | T-60 | 1,600 | 50.6 | 50.2 | **+0.3** | -0.8 | 0.201 | -3.4 | 2022:52 2023:49 2024:51 2025:51 |
