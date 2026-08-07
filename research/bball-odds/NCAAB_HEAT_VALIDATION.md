# NCAAB concentrated player heat — validation

T1 drops 598 games (2.6%) whose opener predates a previous game finishing. Everything below is on the remainder.

## Pooled, after the timing filter

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| concentrated heat fade | FG spread OPEN | 1,004 | 54.1 | 50.8 | **+3.3** | +3.3 | 0.019 | 23:53 24:54 25:54 26:55 |
| concentrated heat fade | FG spread T-60 | 1,000 | 52.4 | 50.3 | **+2.1** | +0.1 | 0.097 | 23:51 24:52 25:52 26:55 |
| diffuse third (contrast) | FG spread OPEN | 1,565 | 52.5 | 50.4 | **+2.2** | +0.3 | 0.046 | 23:55 24:51 25:51 26:54 |
| diffuse third (contrast) | FG spread T-60 | 1,562 | 51.9 | 50.3 | **+1.6** | -1.0 | 0.106 | 23:54 24:51 25:50 26:54 |

## T2 — walk-forward (cutoffs from strictly prior seasons only)

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| walk-forward | FG spread OPEN | 712 | 54.9 | 53.4 | **+1.5** | +4.9 | 0.213 | 24:56 25:54 26:55 |
| walk-forward | FG spread T-60 | 710 | 53.5 | 53.0 | **+0.6** | +2.2 | 0.396 | 24:54 25:51 26:55 |

## T3 — is the CONCENTRATION cut better than a random cut of the same size?

The concentrated third is compared against 2,000 random thirds drawn from the same hot-signal pool. `beats` is the share of random cuts the real cut outscores on ROI. Below ~95% the cut is not carrying information.

| market | real ROI % | random ROI mean % | beats |
|---|---|---|---|
| FG spread OPEN | +3.28 | +1.64 | **73.0%** |
| FG spread T-60 | +0.06 | -0.01 | **52.2%** |
