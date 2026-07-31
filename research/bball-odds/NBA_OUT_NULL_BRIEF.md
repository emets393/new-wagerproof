# NBA absence signal — signal vs a 2,000-permutation null

Full grid only. FG spread graded vs the OPENER, cut at the |gap| quantile giving the stated bet count. `edge` = win% − the max-side baseline of that same subset; because that baseline is chosen with hindsight, a coin flip scores about −2.5 on it, which is why the NULL column and not zero is the thing to compare against.

| baseline | bets | win % | base % | edge | null mean | null 95th | p | ROI % | by season |
|---|---|---|---|---|---|---|---|---|---|
| decay | 200 | 55.5 | 51.0 | **+4.5** | -2.6 | +4.0 | 0.039 | +6.0 | 2022:56 2023:52 2024:63 2025:51 |
| decay | 400 | 54.2 | 51.2 | **+3.0** | -1.9 | +2.5 | 0.038 | +3.6 | 2022:56 2023:53 2024:56 2025:52 |
| decay | 800 | 54.1 | 50.1 | **+4.0** | -1.2 | +2.1 | 0.005 | +3.3 | 2022:57 2023:55 2024:54 2025:52 |
| decay | 1,600 | 53.1 | 50.7 | **+2.4** | -0.2 | +1.3 | 0.001 | +1.4 | 2022:57 2023:51 2024:53 2025:52 |
| played | 200 | 55.0 | 50.5 | **+4.5** | -2.7 | +4.0 | 0.040 | +5.0 | 2022:39 2023:56 2024:57 2025:57 |
| played | 400 | 52.5 | 52.0 | **+0.5** | -1.9 | +2.8 | 0.215 | +0.2 | 2022:48 2023:58 2024:50 2025:52 |
| played | 800 | 52.0 | 50.2 | **+1.8** | -1.3 | +2.0 | 0.071 | -0.7 | 2022:50 2023:55 2024:50 2025:52 |
| played | 1,600 | 51.4 | 50.6 | **+0.9** | -0.9 | +1.4 | 0.102 | -1.8 | 2022:51 2023:52 2024:50 2025:52 |

## Reading

The null mean confirms the measurement bias: a random selector scores roughly −2.5 to −4 on this `edge` metric rather than 0, so any reading of these tables that treats zero as the break-even point is wrong by that much.

