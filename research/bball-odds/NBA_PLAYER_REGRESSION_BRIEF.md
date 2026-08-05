# NBA player-level regression to the mean vs the team aggregate

n = 4,742 games with both feature sets.

## Pre-registered signs

| feature | corr vs T-60 resid | corr vs OPEN resid | n | predicted |
|---|---|---|---|---|
| P1 player heat (`d_p_heat`) | -1.83 | -1.76 | 4,427 | NEGATIVE |
| P1b single hottest player (`d_p_top`) | -1.05 | -0.57 | 4,427 | NEGATIVE |
| P3 rotation shot selection (`d_p_ownx`) | +4.10 | +3.31 | 4,431 | POSITIVE |
| team aggregate luck (incumbent) (`d_luck_net`) | -0.74 | +0.05 | 4,742 | NEGATIVE |
| team process xEFG (incumbent) (`d_xefg_net`) | +4.54 | +5.23 | 4,742 | POSITIVE |

## Does player level add anything over the team aggregate?

`d_p_heat ⟂ d_luck_net` is player heat with the team aggregate projected out. If it goes flat, player granularity bought nothing.

| quantity | corr vs T-60 | corr vs OPEN | n |
|---|---|---|---|
| player heat ⟂ team luck | -1.74 | -2.07 | 4,427 |
| team luck ⟂ player heat (mirror) | +0.19 | +1.13 | 4,427 |

corr(d_p_heat, d_luck_net) = +41.6 — they share this much and no more.

## P2 — does CONCENTRATED heat regress harder than diffuse heat?

Split on the HHI of the side carrying the heat. Prediction: the top tercile (one player carrying it) shows a more negative correlation than the bottom.

| concentration | n | corr(d_p_heat, T-60) | corr(d_p_heat, OPEN) |
|---|---|---|---|
| diffuse (bottom 3rd) | 1,461 | +1.45 | +2.53 |
| middle | 1,440 | -4.54 | -5.41 |
| concentrated (top 3rd) | 1,439 | -3.51 | -3.82 |

## By season phase

| phase | n | corr d_p_heat | corr d_p_ownx | corr d_pheat_res |
|---|---|---|---|---|
| early (<=15 gp) | 545 | +3.09 | +5.57 | +0.84 |
| mid (16-45) | 1,593 | -0.34 | +6.62 | +0.74 |
| late (46-81) | 1,956 | -4.04 | +0.77 | -3.82 |
| playoffs (82+) | 333 | -4.28 | +10.20 | -5.46 |

## Bet test

Signal is NEGATED where the prediction is negative, so a positive signal always means 'back the home side'. `edge` = win% − the hindsight max-side baseline of the same subset; a coin flip scores ≈ −2, so compare `null mean`, not 0.

| signal | market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| fade player heat | OPEN | 600 | 50.5 | 50.2 | **+0.3** | -1.6 | 0.228 | -3.6 | 2022:56 2023:51 2024:46 2025:53 |
| fade player heat | T-60 | 600 | 50.8 | 50.8 | **+0.0** | -1.6 | 0.280 | -2.9 | 2022:55 2023:52 2024:47 2025:52 |
| fade heat ⟂ team luck | OPEN | 600 | 52.3 | 51.2 | **+1.2** | -1.5 | 0.135 | -0.1 | 2022:54 2023:51 2024:49 2025:56 |
| fade heat ⟂ team luck | T-60 | 600 | 52.0 | 51.5 | **+0.5** | -1.4 | 0.227 | -0.7 | 2022:54 2023:51 2024:49 2025:54 |
| rotation shot selection | OPEN | 600 | 52.7 | 52.5 | **+0.2** | -1.6 | 0.262 | +0.6 | 2022:51 2023:49 2024:58 2025:51 |
| rotation shot selection | T-60 | 600 | 53.2 | 51.5 | **+1.7** | -1.5 | 0.109 | +1.5 | 2022:52 2023:51 2024:58 2025:52 |
| fade heat, CONCENTRATED only | OPEN | 400 | 55.2 | 51.0 | **+4.2** | -1.8 | 0.015 | +5.5 | 2022:57 2023:52 2024:52 2025:62 |
| fade heat, CONCENTRATED only | T-60 | 400 | 55.2 | 50.7 | **+4.5** | -1.8 | 0.014 | +5.5 | 2022:56 2023:52 2024:53 2025:60 |
