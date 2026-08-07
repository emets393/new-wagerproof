# NBA spread — matchup nets

5,423 gradeable games, walk-forward ridge on the residual vs the T-60 close, bets at |disagreement| ≥ 1.5 points. Breakeven at −110 is 52.4%.

`RAW` is each team's own offensive and allowed levels. `NET` is the matchup construction — home offence minus away allowed, and the reverse. RAW is the control that stops a win being credited to the matchup idea when it belongs to the data.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (incumbent) | 400 | +0.0141 | 2425 | 49.4 | 50.6 | **-1.2** | -5.6 |
| base + RAW possession | 496 | +0.0143 | 2582 | 49.2 | 50.9 | **-1.7** | -6.1 |
| base + NET matchup | 496 | +0.0119 | 2538 | 49.0 | 51.2 | **-2.2** | -6.4 |
| base + RAW + NET | 592 | +0.0136 | 2630 | 49.0 | 50.8 | **-1.8** | -6.4 |
| NET alone | 96 | +0.0014 | 1556 | 49.6 | 51.5 | **-1.9** | -5.2 |

## Per-pair: which matchup actually carries it (added to base one at a time)

| pair | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| eff | 412 | +0.0152 | 2450 | 49.3 | 50.4 | **-1.1** | -5.8 |
| efg | 412 | +0.0131 | 2432 | 48.9 | 50.1 | **-1.2** | -6.6 |
| tov | 412 | +0.0118 | 2424 | 49.1 | 50.0 | **-0.9** | -6.2 |
| oreb | 412 | +0.0110 | 2463 | 48.9 | 50.8 | **-1.9** | -6.6 |
| ftr | 412 | +0.0148 | 2454 | 49.6 | 50.9 | **-1.3** | -5.3 |
| trate | 412 | +0.0127 | 2447 | 49.5 | 50.8 | **-1.3** | -5.5 |
| tpct | 412 | +0.0140 | 2470 | 49.4 | 50.7 | **-1.3** | -5.7 |
| twopct | 412 | +0.0178 | 2453 | 48.9 | 50.2 | **-1.3** | -6.6 |

## Threshold ladder — base + RAW possession

| k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0.0 | 3822 | 49.9 | 50.2 | **-0.3** | -4.7 |
| ≥1.0 | 2985 | 49.5 | 50.9 | **-1.4** | -5.5 |
| ≥1.5 | 2582 | 49.2 | 50.9 | **-1.7** | -6.1 |
| ≥2.0 | 2182 | 48.7 | 51.1 | **-2.4** | -7.0 |
| ≥3.0 | 1488 | 49.7 | 50.3 | **-0.7** | -5.2 |
| ≥4.0 | 1014 | 51.4 | 50.6 | **+0.8** | -1.9 |
| ≥5.0 | 644 | 49.8 | 51.2 | **-1.4** | -4.8 |

| slice | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 935 | 49.1 | 52.7 | **-3.6** | -6.3 |
| 2024 | 860 | 50.3 | 50.3 | **+0.0** | -3.8 |
| 2025 | 787 | 48.0 | 50.2 | **-2.2** | -8.3 |
| EARLY | 608 | 50.0 | 53.6 | **-3.6** | -4.5 |
| MID | 864 | 47.3 | 52.0 | **-4.6** | -9.6 |
| LATE | 931 | 49.9 | 51.3 | **-1.4** | -4.6 |
| POST | 179 | 51.4 | 51.4 | **+0.0** | -1.9 |

## Label-shuffle null (6 draws, within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0143 | +0.0025 | 0.0117 | **+1.01** |
| edge | -1.74 | -0.73 | 1.36 | **-0.74** |

