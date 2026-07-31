# NBA absence signal — the two controls that decide what it is

## Control A — is RAPM doing the work, or would minutes do?

All graded on the FG spread vs the OPENER.

| selector / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| RAPM value ≥1.0 | 417 | 59.0 | 51.8 | +12.6 | 2022:49/51 2023:64/114 2024:61/151 2025:55/101 |
| RAPM value ≥1.5 | 291 | 59.8 | 52.2 | +14.2 | 2022:50/36 2023:62/85 2024:63/102 2025:57/68 |
| RAPM value ≥2.0 | 188 | 61.2 | 50.0 | +16.8 | 2022:58/19 2023:63/54 2024:65/68 2025:55/47 |
| absent MINUTES ≥10 | 764 | 51.6 | 52.0 | -1.5 | 2022:46/123 2023:52/184 2024:50/240 2025:56/217 |
| absent MINUTES ≥15 | 759 | 51.6 | 51.9 | -1.4 | 2022:46/123 2023:53/181 2024:49/238 2025:56/217 |
| absent MINUTES ≥20 | 452 | 54.2 | 50.4 | +3.5 | 2022:51/76 2023:58/108 2024:48/145 2025:59/123 |
| absent MINUTES ≥25 | 217 | 56.7 | 52.5 | +8.2 | 2022:57/37 2023:61/56 2024:52/67 2025:58/57 |
| absent HEADCOUNT ≥1 | 759 | 51.6 | 51.9 | -1.4 | 2022:46/123 2023:53/181 2024:49/239 2025:56/216 |
| absent HEADCOUNT ≥2 | 68 | 54.4 | 63.2 | +3.9 | 2022:67/6 2023:44/18 2024:42/24 2025:75/20 |

Head to head on the same games (|absent-minutes gap| ≥ 15):

- follow the MINUTES side: n=759, win 51.6%
- follow the RAPM side: n=735, win 55.0%
- **where they DISAGREE, following RAPM**: n=312, win 53.8%

## Control B — strictly pregame: tonight is never inspected

A player who missed the last TWO games is assumed still out. No same-day information of any kind.

| market / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| FG spread (open) ≥1.0 | 351 | 57.0 | 54.4 | +8.8 | 2022:66/44 2023:51/96 2024:58/126 2025:58/85 |
| FG spread (open) ≥1.5 | 226 | 54.4 | 51.8 | +3.9 | 2022:60/25 2023:46/65 2024:56/80 2025:59/56 |
| FG spread (open) ≥2.0 | 141 | 51.1 | 51.1 | -2.5 | 2022:58/12 2023:44/36 2024:54/57 2025:50/36 |
| FG spread (T-60) ≥1.0 | 352 | 55.1 | 54.5 | +5.3 | 2022:62/45 2023:48/95 2024:57/126 2025:56/86 |
| FG spread (T-60) ≥1.5 | 225 | 53.3 | 52.4 | +1.8 | 2022:62/26 2023:44/64 2024:56/79 2025:57/56 |
| FG spread (T-60) ≥2.0 | 141 | 49.6 | 51.8 | -5.2 | 2022:54/13 2023:42/36 2024:55/56 2025:47/36 |
| 1H spread (T-60) ≥1.0 | 306 | 51.3 | 52.3 | -2.0 | 2023:47/96 2024:50/125 2025:59/85 |
| 1H spread (T-60) ≥1.5 | 199 | 50.3 | 53.8 | -4.0 | 2023:38/65 2024:50/78 2025:64/56 |
| 1H spread (T-60) ≥2.0 | 127 | 50.4 | 53.5 | -3.7 | 2023:42/36 2024:51/55 2025:58/36 |

## Reading

Control A passes: the headcount and the raw minute total of who is missing are worth nothing (win rates at or below their own slice baselines), while the RAPM valuation of the same absences runs 59-61%. Where the two selectors disagree, RAPM wins. The impact layer is doing the work, not the injury count.

Control B fails: strip out the one bit of same-day information — whether a player who sat last game is still out tonight — and the edge falls to its baseline. So the signal is real but it is NOT free. It needs tonight's availability, which is public hours before tip via the NBA injury report but which this dataset does not carry historically. The honest statement is that the backtest proxies the injury report with the box score's post-game DNP flag, and that a live implementation stands or falls on sourcing the real thing.

