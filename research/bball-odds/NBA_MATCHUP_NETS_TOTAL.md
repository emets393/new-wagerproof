# NBA total — matchup nets

5,271 gradeable games, walk-forward ridge on the residual vs the T-60 close, bets at |disagreement| ≥ 2.0 points. Breakeven at −110 is 52.4%.

`RAW` is each team's own offensive and allowed levels. `NET` is the matchup construction — home offence minus away allowed, and the reverse. RAW is the control that stops a win being credited to the matchup idea when it belongs to the data.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (incumbent) | 400 | +0.0688 | 2311 | 53.3 | 50.6 | **+2.6** | +1.7 |
| base + RAW possession | 496 | +0.0714 | 2392 | 53.3 | 50.2 | **+3.1** | +1.8 |
| base + NET matchup | 496 | +0.0692 | 2345 | 53.2 | 50.6 | **+2.6** | +1.6 |
| base + RAW + NET | 592 | +0.0706 | 2399 | 53.2 | 50.4 | **+2.8** | +1.5 |
| NET alone | 96 | +0.0231 | 1297 | 50.3 | 50.5 | **-0.2** | -4.0 |

## Per-pair: which matchup actually carries it (added to base one at a time)

| pair | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| eff | 412 | +0.0698 | 2321 | 53.3 | 50.1 | **+3.2** | +1.7 |
| efg | 412 | +0.0684 | 2320 | 53.4 | 50.7 | **+2.7** | +2.0 |
| tov | 412 | +0.0658 | 2296 | 53.1 | 50.2 | **+2.9** | +1.4 |
| oreb | 412 | +0.0691 | 2309 | 53.2 | 50.5 | **+2.6** | +1.5 |
| ftr | 412 | +0.0675 | 2329 | 53.2 | 50.4 | **+2.8** | +1.6 |
| trate | 412 | +0.0711 | 2349 | 53.2 | 50.0 | **+3.2** | +1.5 |
| tpct | 412 | +0.0682 | 2323 | 53.0 | 50.5 | **+2.5** | +1.2 |
| twopct | 412 | +0.0735 | 2288 | 53.3 | 50.1 | **+3.2** | +1.7 |

## Threshold ladder — base + RAW possession

| k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0.0 | 3488 | 53.7 | 50.3 | **+3.4** | +2.6 |
| ≥1.0 | 2930 | 53.7 | 50.1 | **+3.5** | +2.4 |
| ≥1.5 | 2648 | 53.4 | 50.4 | **+3.1** | +2.0 |
| ≥2.0 | 2392 | 53.3 | 50.2 | **+3.1** | +1.8 |
| ≥3.0 | 1927 | 53.3 | 50.5 | **+2.9** | +1.8 |
| ≥4.0 | 1450 | 53.0 | 51.4 | **+1.7** | +1.3 |
| ≥5.0 | 1073 | 53.9 | 51.5 | **+2.3** | +2.8 |

| slice | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 682 | 50.7 | 52.5 | **-1.8** | -3.1 |
| 2024 | 884 | 53.4 | 51.9 | **+1.5** | +1.9 |
| 2025 | 826 | 55.3 | 50.6 | **+4.7** | +5.6 |
| EARLY | 398 | 56.0 | 51.5 | **+4.5** | +7.0 |
| MID | 854 | 52.8 | 52.6 | **+0.2** | +0.8 |
| LATE | 963 | 52.9 | 53.1 | **-0.2** | +0.9 |
| POST | 177 | 52.0 | 53.7 | **-1.7** | -0.8 |

## Label-shuffle null (6 draws, within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0714 | +0.0024 | 0.0105 | **+6.58** |
| edge | +3.09 | -0.44 | 1.46 | **+2.42** |

