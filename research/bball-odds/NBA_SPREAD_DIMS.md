# NBA full-game SPREAD — do the situational dimensions build the missing model?

5,423 gradeable games. Walk-forward ridge on the margin residual vs the T-60 close, bets at |disagreement| ≥ 1.5 points. Breakeven at −110 is 52.4%, and the blind baseline is ~50% by construction.

Context: the total version of this test (`NBA_TOTAL_V4.md`) came back negative. The spread is where every situational finding actually lived (S16, S17), and it is the market with no working model — so this is the question that matters.

## 1. Headline

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base + repaired ratings | 403 | +0.0137 | 2425 | 49.4 | 50.5 | **-1.1** | -5.6 |
| + situational dims | 455 | +0.0088 | 2492 | 49.7 | 50.3 | **-0.6** | -5.1 |
| situational dims ALONE | 52 | -0.0074 | 1025 | 50.8 | 51.5 | **-0.7** | -2.9 |

## 2. Each theme added on its own

| added | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| + sched (4 cols) | 407 | +0.0137 | 2426 | 49.4 | 50.5 | **-1.1** | -5.6 |
| + arch (16 cols) | 419 | +0.0137 | 2451 | 49.7 | 51.3 | **-1.6** | -5.2 |
| + trav (20 cols) | 423 | +0.0024 | 2440 | 48.7 | 50.1 | **-1.4** | -6.9 |
| + exp (4 cols) | 407 | +0.0243 | 2460 | 49.8 | 50.3 | **-0.5** | -5.0 |
| + ix (8 cols) | 411 | +0.0089 | 2452 | 49.8 | 50.7 | **-0.9** | -4.9 |

## 3. Threshold ladder

| k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0.0 | 3822 | 49.5 | 50.2 | **-0.7** | -5.4 |
| ≥1.0 | 2910 | 49.6 | 50.6 | **-1.0** | -5.4 |
| ≥1.5 | 2492 | 49.7 | 50.3 | **-0.6** | -5.1 |
| ≥2.0 | 2097 | 49.7 | 50.8 | **-1.1** | -5.1 |
| ≥3.0 | 1396 | 50.2 | 50.4 | **-0.2** | -4.1 |
| ≥4.0 | 887 | 49.9 | 51.7 | **-1.8** | -4.6 |
| ≥5.0 | 527 | 50.5 | 52.6 | **-2.1** | -3.6 |

## 4. Season and phase (k ≥ 1.5)

| slice | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 956 | 51.9 | 52.1 | **-0.2** | -0.9 |
| 2024 | 812 | 48.9 | 51.1 | **-2.2** | -6.6 |
| 2025 | 724 | 47.7 | 50.6 | **-2.9** | -9.0 |
| EARLY | 625 | 50.1 | 50.1 | **+0.0** | -4.3 |
| MID | 831 | 48.3 | 50.8 | **-2.5** | -7.8 |
| LATE | 874 | 50.6 | 50.6 | **+0.0** | -3.4 |
| POST | 162 | 50.6 | 53.1 | **-2.5** | -3.3 |

## 5. Label-shuffle null (8 draws, within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0088 | +0.0062 | 0.0146 | **+0.18** |
| edge @ k≥1.5 | -0.60 | -0.45 | 0.94 | **-0.16** |

