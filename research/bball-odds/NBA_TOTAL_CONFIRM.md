# NBA full-game total — confirming the no-market configuration

5,226 gradeable games, 1625 features, seasons [2022, 2023, 2024, 2025]. Trained on the residual vs the T-60 close. Breakeven at -110 is 52.4%. `base` is the best blind side inside the same rows.

## By phase

| phase | cut | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| EARLY | top100% | 955 | 52.4 | 52.5 | **-0.1** | -0.0 |
| EARLY | top25% | 239 | 53.6 | 54.0 | **-0.4** | +2.3 |
| EARLY | top10% | 96 | 56.2 | 52.1 | **+4.2** | +7.4 |
| MID | top100% | 1301 | 49.3 | 51.2 | **-1.9** | -5.9 |
| MID | top25% | 326 | 50.3 | 53.1 | **-2.8** | -4.0 |
| MID | top10% | 131 | 45.0 | 51.1 | **-6.1** | -14.0 |
| LATE | top100% | 1826 | 50.7 | 51.2 | **-0.4** | -3.2 |
| LATE | top25% | 457 | 51.6 | 51.9 | **-0.2** | -1.4 |
| LATE | top10% | 183 | 54.6 | 50.3 | **+4.4** | +4.3 |
| POST | top100% | 331 | 52.3 | 51.1 | **+1.2** | -0.2 |
| POST | top25% | 83 | 51.8 | 50.6 | **+1.2** | -1.1 |
| POST | top10% | 34 | 55.9 | 58.8 | **-2.9** | +6.7 |
| ALL | top100% | 4413 | 50.8 | 50.6 | **+0.2** | -3.1 |
| ALL | top25% | 1104 | 51.8 | 51.7 | **+0.1** | -1.1 |
| ALL | top10% | 442 | 51.1 | 51.4 | **-0.2** | -2.4 |

## By season (top 25%)

| season | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2022 | 128 | 49.2 | 53.1 | **-3.9** | -6.0 |
| 2023 | 339 | 51.9 | 50.1 | **+1.8** | -0.9 |
| 2024 | 319 | 53.6 | 56.1 | **-2.5** | +2.4 |
| 2025 | 318 | 53.8 | 52.5 | **+1.3** | +2.7 |

## Label-shuffle null

Outcome permuted within season, identical pipeline, 6 draws. The spread of these is what this search finds on pure noise.

| cut | real edge | null mean | null sd | z |
|---|---|---|---|---|
| top25% | +0.09 | -1.62 | 1.96 | **+0.87** |
| top10% | -0.23 | -3.85 | 3.18 | **+1.14** |

