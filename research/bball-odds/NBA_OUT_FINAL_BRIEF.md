# NBA absence signal — final confirmation across markets

Full grid, decaying rotation baseline, RAPM-valued durable absences. `edge` = win% − the max-side baseline of the same subset; that baseline is picked with hindsight so a coin flip scores about −2 on it, which is what `null mean` measures. Compare edge to null mean, not to zero. p = share of 2,000 within-season permutations reaching the real edge.

## The rule across all three markets

| market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| FG spread vs OPEN | 400 | 54.2 | 51.2 | **+3.0** | -2.0 | 0.052 | +3.6 | 2022:56 2023:53 2024:56 2025:52 |
| FG spread vs OPEN | 800 | 54.1 | 50.1 | **+4.0** | -1.2 | 0.003 | +3.3 | 2022:57 2023:55 2024:54 2025:52 |
| FG spread vs OPEN | 1,600 | 53.1 | 50.7 | **+2.4** | -0.2 | 0.001 | +1.4 | 2022:57 2023:51 2024:53 2025:52 |
| FG spread vs T-60 | 400 | 51.7 | 50.7 | **+1.0** | -1.8 | 0.182 | -1.2 | 2022:56 2023:50 2024:54 2025:48 |
| FG spread vs T-60 | 800 | 52.4 | 51.1 | **+1.3** | -1.2 | 0.098 | +0.0 | 2022:58 2023:53 2024:52 2025:50 |
| FG spread vs T-60 | 1,600 | 51.7 | 50.2 | **+1.6** | -0.4 | 0.018 | -1.2 | 2022:56 2023:49 2024:52 2025:51 |
| 1H spread vs T-60 | 400 | 51.5 | 50.5 | **+1.0** | -2.1 | 0.157 | -1.6 | 2023:52 2024:54 2025:49 |
| 1H spread vs T-60 | 800 | 51.9 | 51.5 | **+0.4** | -1.4 | 0.202 | -0.9 | 2023:49 2024:53 2025:54 |
| 1H spread vs T-60 | 1,600 | 51.7 | 50.6 | **+1.2** | -0.5 | 0.048 | -1.2 | 2023:52 2024:53 2025:50 |

## Mechanism check — the same rule split by how long he has been out

If the market prices known absences and misprices new ones, FRESH must carry the edge and LONG must not. Graded vs the opener.

| market | bets | win % | base % | edge | null mean | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| FRESH FG spread vs OPEN | 400 | 54.5 | 52.0 | **+2.5** | -0.6 | 0.001 | +4.1 | 2022:55 2023:55 2024:56 2025:53 |
| FRESH FG spread vs OPEN | 800 | 53.4 | 54.2 | **-0.9** | -0.6 | 0.620 | +1.9 | 2022:58 2023:50 2024:52 2025:55 |
| MID FG spread vs OPEN | 400 | 53.0 | 52.0 | **+1.0** | -1.9 | 0.002 | +1.2 | 2022:57 2023:50 2024:56 2025:50 |
| MID FG spread vs OPEN | 800 | 52.8 | 50.4 | **+2.4** | -1.9 | 0.000 | +0.7 | 2022:55 2023:48 2024:56 2025:51 |
