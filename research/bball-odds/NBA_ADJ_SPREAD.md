# NBA spread — opponent-adjusted stats vs raw rolling means

5,423 gradeable games, walk-forward ridge on the residual vs the T-60 close, bets at |disagreement| ≥ 1.5. Breakeven at −110 is 52.4%.

Read **down** a pair of rows to isolate the adjustment; read **across** to isolate the matchup construction. Both moves at once tells you nothing about either.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (incumbent) | 400 | +0.0141 | 2425 | 49.4 | 50.6 | **-1.2** | -5.6 |
| base + RAW own levels | 496 | +0.0143 | 2582 | 49.2 | 50.9 | **-1.7** | -6.1 |
| base + RAW matchup nets | 496 | +0.0119 | 2538 | 49.0 | 51.2 | **-2.2** | -6.4 |
| base + ADJUSTED own levels | 436 | +0.0068 | 2469 | 48.5 | 50.6 | **-2.1** | -7.3 |
| base + ADJUSTED matchup nets | 436 | +0.0131 | 2492 | 49.6 | 50.2 | **-0.5** | -5.2 |
| base + ADJUSTED nets, recency-weighted | 436 | +0.0212 | 2527 | 49.9 | 51.4 | **-1.5** | -4.6 |
| ADJUSTED nets ALONE | 36 | +0.0254 | 1068 | 49.0 | 51.7 | **-2.7** | -6.5 |

## Label-shuffle null (6 draws, within season) — how big is 'nothing'?

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0131 | -0.0076 | 0.0178 | **+1.16** |
| edge @ ≥1.5 | -0.52 | -1.77 | 1.55 | **+0.81** |

