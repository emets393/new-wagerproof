# xEFG shot-quality edge by season phase

`d_xefg_net` = home trailing expected-eFG margin − away, from shot coordinates. Phase = the fewer of the two teams' games played. `edge` = win% − the max-side baseline of that same slice; a coin flip scores ≈ −2 on it, so compare to `null mean`, not to zero.

## Correlation with the spread residual by phase

| phase | n | corr T-60 | corr OPEN | corr of ACTUAL eFG (control) |
|---|---|---|---|---|
| early (<=15 gp) | 852 | +6.66 | +7.91 | +2.52 |
| mid (16-45) | 1,744 | +1.12 | +1.85 | -1.90 |
| late (46-81) | 2,043 | +6.25 | +6.71 | +0.48 |
| playoffs (82+) | 349 | +6.79 | +7.64 | +2.09 |

## Bet test per phase, betting the xEFG side directly

| phase | market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| early (<=15 gp) | OPEN | 298 | 54.4 | 52.7 | **+1.7** | -2.4 | 0.124 | +3.8 | 2022:42 2023:60 2024:56 2025:57 |
| early (<=15 gp) | T-60 | 298 | 51.7 | 52.3 | **-0.7** | -2.2 | 0.356 | -1.3 | 2022:40 2023:54 2024:56 2025:54 |
| mid (16-45) | OPEN | 600 | 53.7 | 51.5 | **+2.2** | -1.3 | 0.069 | +2.5 | 2022:55 2023:54 2024:60 2025:48 |
| mid (16-45) | T-60 | 600 | 53.2 | 51.2 | **+2.0** | -1.2 | 0.090 | +1.6 | 2022:52 2023:54 2024:61 2025:48 |
| late (46-81) | OPEN | 600 | 53.5 | 52.2 | **+1.3** | -1.5 | 0.102 | +2.1 | 2022:49 2023:46 2024:66 2025:54 |
| late (46-81) | T-60 | 600 | 53.5 | 51.0 | **+2.5** | -1.4 | 0.052 | +2.1 | 2022:49 2023:48 2024:66 2025:53 |
| playoffs (82+) | OPEN | 200 | 50.5 | 55.5 | **-5.0** | -2.0 | 0.812 | -3.6 | 2022:54 2023:63 2024:35 2025:51 |
| playoffs (82+) | T-60 | 200 | 49.5 | 54.0 | **-4.5** | -2.8 | 0.719 | -5.5 | 2022:50 2023:64 2024:37 2025:49 |
