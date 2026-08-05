# NBA total — opponent-adjusted stats vs raw rolling means

5,271 gradeable games, walk-forward ridge on the residual vs the T-60 close, bets at |disagreement| ≥ 2.0. Breakeven at −110 is 52.4%.

Read **down** a pair of rows to isolate the adjustment; read **across** to isolate the matchup construction. Both moves at once tells you nothing about either.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (incumbent) | 400 | +0.0688 | 2311 | 53.3 | 50.6 | **+2.6** | +1.7 |
| base + RAW own levels | 496 | +0.0714 | 2392 | 53.3 | 50.2 | **+3.1** | +1.8 |
| base + RAW matchup nets | 496 | +0.0692 | 2345 | 53.2 | 50.6 | **+2.6** | +1.6 |
| base + ADJUSTED own levels | 436 | +0.0685 | 2345 | 53.4 | 50.1 | **+3.3** | +1.9 |
| base + ADJUSTED matchup nets | 436 | +0.0686 | 2333 | 53.2 | 50.4 | **+2.8** | +1.5 |
| base + ADJUSTED nets, recency-weighted | 436 | +0.0597 | 2348 | 53.9 | 50.3 | **+3.7** | +2.9 |
| ADJUSTED nets ALONE | 36 | +0.0293 | 852 | 50.8 | 51.6 | **-0.8** | -3.0 |

## Label-shuffle null (6 draws, within season) — how big is 'nothing'?

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0686 | -0.0089 | 0.0121 | **+6.39** |
| edge @ ≥2.0 | +2.79 | -0.94 | 0.49 | **+7.65** |

