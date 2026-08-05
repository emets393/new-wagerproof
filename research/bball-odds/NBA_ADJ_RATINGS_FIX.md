# NBA opponent-adjusted ratings — the scoring ridge was broken

`adjusted_ratings()` in `build_nba_features.py` fits two ridges. The margin one is fine. The scoring one had no global intercept — the intercept column was set on the home-scored rows only — so every row's ~114-point base level had to be carried by the penalised off/def coefficients, and alpha=25 flattened them against it. `adj_off + adj_def` averaged 65.5 where a team scores ~114.

| build | column | n | corr vs closing TOTAL | corr vs final total | corr vs spread |
|---|---|---|---|---|---|
| old | `h_adj_off` | 5,135 | -0.0150 | -0.0148 | -0.0851 |
| old | `h_adj_def` | 5,135 | +0.0264 | +0.0171 | +0.0855 |
| old | `h_adj_tempo_pts` | 5,135 | +0.0059 | +0.0013 | +0.0007 |
| old | `sum_tempo` | 5,135 | +0.0048 | -0.0023 | -0.0087 |
| old | `h_adj_net` | 5,135 | -0.1260 | -0.0788 | -0.6067 |
| new | `h_adj_off` | 5,135 | +0.3770 | +0.1561 | -0.3199 |
| new | `h_adj_def` | 5,135 | +0.4882 | +0.2316 | +0.3737 |
| new | `h_adj_tempo_pts` | 5,135 | +0.5300 | +0.2381 | +0.0490 |
| new | `sum_tempo` | 5,135 | +0.6436 | +0.2701 | +0.0120 |
| new | `h_adj_net` | 5,135 | -0.1260 | -0.0788 | -0.6067 |

A working rating correlates strongly with the market's own number for the same quantity — that is what says it measures the thing it claims to. `adj_net` already did (−0.607 vs the spread); the scoring ratings did not.

