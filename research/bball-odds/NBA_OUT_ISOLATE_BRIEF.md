# Which correction killed the 61%? — a 2x2 at matched bet counts

All cells: durable absences (out tonight and last game, >=16 min baseline), RAPM-valued, FG spread graded vs the OPENER. Cut at the |gap| quantile that yields the stated bet count, so selectivity is held equal across cells.

`edge` is win% minus the baseline OF ITS OWN SUBSET, which is the only honest way to read any of these. The placebo is scored the same way, so a placebo edge near zero is the pass condition and a placebo edge near the signal's is a fail.

| grid | baseline | bets | win % | base % | edge | ROI % | bets home % | by season | placebo edge |
|---|---|---|---|---|---|---|---|---|---|
| listed | decay | 200 | 62.5 | 54.5 | **+8.0** | +19.3 | 49 | 2022:63 2023:69 2024:64 2025:54 | -2.5 |
| listed | decay | 400 | 59.0 | 51.5 | **+7.5** | +12.7 | 54 | 2022:51 2023:63 2024:61 2025:56 | +1.7 |
| listed | decay | *fires on 703 of 4,875 games* | | | | | | | |
| listed | played | 200 | 58.0 | 52.5 | **+5.5** | +10.8 | 48 | 2022:67 2023:62 2024:55 2025:54 | +5.0 |
| listed | played | 400 | 53.5 | 53.2 | **+0.2** | +2.2 | 51 | 2022:56 2023:59 2024:53 2025:48 | +3.2 |
| listed | played | 800 | 54.8 | 52.6 | **+2.1** | +4.5 | 52 | 2022:50 2023:60 2024:55 2025:52 | +2.9 |
| listed | played | *fires on 1,634 of 4,875 games* | | | | | | | |
| full | decay | 200 | 55.5 | 51.0 | **+4.5** | +6.0 | 56 | 2022:56 2023:52 2024:63 2025:51 | -4.0 |
| full | decay | 400 | 54.2 | 51.2 | **+3.0** | +3.6 | 52 | 2022:56 2023:53 2024:56 2025:52 | -3.2 |
| full | decay | 800 | 54.1 | 50.1 | **+4.0** | +3.3 | 51 | 2022:57 2023:55 2024:54 2025:52 | -2.5 |
| full | decay | *fires on 2,274 of 4,875 games* | | | | | | | |
| full | played | 200 | 55.0 | 50.5 | **+4.5** | +5.0 | 52 | 2022:39 2023:56 2024:57 2025:57 | -7.0 |
| full | played | 400 | 52.5 | 52.0 | **+0.5** | +0.2 | 52 | 2022:48 2023:58 2024:50 2025:52 | -5.2 |
| full | played | 800 | 52.0 | 50.2 | **+1.8** | -0.7 | 50 | 2022:50 2023:55 2024:50 2025:52 | -3.0 |
| full | played | *fires on 4,022 of 4,875 games* | | | | | | | |

## Blowout-leak check

`corr(|margin|, total absences)` is the artifact channel — blowouts empty both benches, so it must be near zero. `corr(margin, home−away absences)` is the real basketball effect and should stay negative.

| grid | baseline | corr(\|margin\|, total out) | corr(margin, home−away out) |
|---|---|---|---|
| listed | decay | +0.018 | -0.103 |
| listed | played | -0.030 | -0.097 |
| full | decay | +0.025 | -0.113 |
| full | played | -0.003 | -0.192 |
