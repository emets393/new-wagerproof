# Concentrated player heat across NBA markets

n = 4,742 games; 3,659 have a 1H line and 1H scores. Thresholds frozen on seasons (2022, 2023) (HHI p60, heat p60) and applied blind to every market. Only NON-training seasons are bet.

`edge` = win rate minus THIS SLICE's own baseline. Totals use the heat SUM (both teams regressing), sides the heat DIFFERENTIAL. `p` = chance the slice baseline produces this win rate by luck at this bet count.

| market | OOS bets | win % | base % | edge | ROI % | by season | p |
|---|---|---|---|---|---|---|---|
| FG spread (control) | 326 | 53.7 | 50.0 | **+3.7** | +2.5 | 2024:52 2025:56 | 0.103 |
| FG total | 261 | 51.0 | 51.7 | **-0.8** | -2.7 | 2024:54 2025:48 | 0.616 |
| 1H spread | 328 | 56.1 | 53.7 | **+2.4** | +7.1 | 2024:51 2025:62 | 0.199 |
| 1H total | 261 | 53.6 | 54.0 | **-0.4** | +2.4 | 2024:56 2025:51 | 0.577 |
