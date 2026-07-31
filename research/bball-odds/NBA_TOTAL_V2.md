# NBA full-game total — round 2 (diffuse signal, regularised linear)

5,271 gradeable games, seasons [2022, 2023, 2024, 2025], **383 features** (round 1 used 1,678). Target is the residual vs the T-60 close in points. Bets are taken on |predicted residual| ≥ k points. `base` is the best blind side inside the same rows; breakeven at −110 is 52.4%.

- **ridge**: out-of-sample corr(predicted residual, actual residual) = `+0.0672` over 3,515 games
- **hgb**: out-of-sample corr(predicted residual, actual residual) = `+0.0311` over 3,515 games
- **blend**: `+0.0607`

## Bet threshold ladder

| model | k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| ridge | ≥0 | 3488 | 52.6 | 50.3 | **+2.4** | +0.5 |
| ridge | ≥1 | 2898 | 53.5 | 50.4 | **+3.1** | +2.1 |
| ridge | ≥2 | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| ridge | ≥3 | 1692 | 53.4 | 50.4 | **+3.0** | +1.9 |
| ridge | ≥4 | 1229 | 53.3 | 50.7 | **+2.6** | +1.7 |
| ridge | ≥5 | 878 | 54.8 | 50.9 | **+3.9** | +4.6 |
| hgb | ≥0 | 3488 | 50.6 | 50.3 | **+0.3** | -3.3 |
| hgb | ≥1 | 2557 | 51.6 | 50.3 | **+1.3** | -1.4 |
| hgb | ≥2 | 1777 | 52.5 | 50.8 | **+1.7** | +0.2 |
| hgb | ≥3 | 1149 | 52.7 | 50.6 | **+2.1** | +0.5 |
| hgb | ≥4 | 719 | 53.5 | 50.2 | **+3.3** | +2.2 |
| hgb | ≥5 | 417 | 52.0 | 51.3 | **+0.7** | -0.7 |
| blend | ≥0 | 3488 | 52.6 | 50.3 | **+2.3** | +0.4 |
| blend | ≥1 | 2630 | 52.7 | 51.1 | **+1.6** | +0.6 |
| blend | ≥2 | 1855 | 53.7 | 50.2 | **+3.5** | +2.6 |
| blend | ≥3 | 1249 | 53.8 | 51.2 | **+2.6** | +2.7 |
| blend | ≥4 | 789 | 54.2 | 51.1 | **+3.2** | +3.6 |
| blend | ≥5 | 463 | 51.2 | 52.1 | **-0.9** | -2.3 |

## By phase (blend, k ≥ 2)

| phase | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 310 | 55.5 | 51.0 | **+4.5** | +5.9 |
| MID | 689 | 52.8 | 50.7 | **+2.2** | +0.9 |
| LATE | 747 | 52.6 | 51.4 | **+1.2** | +0.4 |
| POST | 109 | 62.4 | 54.1 | **+8.3** | +19.1 |

## By season (blend, k ≥ 2)

| season | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 550 | 48.5 | 53.3 | **-4.7** | -7.3 |
| 2024 | 693 | 55.0 | 51.9 | **+3.0** | +5.0 |
| 2025 | 612 | 57.0 | 51.5 | **+5.6** | +8.9 |

## Label-shuffle null (ridge, 8 draws, permuted within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0672 | -0.0059 | 0.0166 | **+4.39** |
| edge @ k≥2 | +3.33 | -1.06 | 1.39 | **+3.16** |

