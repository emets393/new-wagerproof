# NBA — are the seasons the same league?

`nba_panel_all.py` trains every model on all prior history with equal weight and standardises features against a pooled multi-season mean. That is only correct if the seasons are one environment. This file tests that assumption four ways and, where it fails, measures whether fixing it changes any betting conclusion.

10,216 team-games, 433 features, seasons 2022–2025.

## Study 1 — how different are the seasons, actually?

Before changing anything, measure the thing being complained about. If the seasons are the same league, none of this matters and the pooled fit is right.

### League environment by season

| season | games | avg total pts | avg pace | 3PA share of FGA | home margin | avg posted total |
|---|---|---|---|---|---|---|
| 2022 | 1,276 | 228.8 | nan | nan | +2.64 | 227.9 |
| 2023 | 1,275 | 227.3 | nan | nan | +2.32 | 227.0 |
| 2024 | 1,277 | 227.2 | nan | nan | +1.61 | 226.3 |
| 2025 | 1,280 | 230.3 | nan | nan | +1.72 | 229.7 |

### Which features drift between seasons

Between-season variance as a share of each feature's total variance. A feature at 0.30 spends nearly a third of its spread just being in a different year — for that column, a pooled mean is an average of four different leagues.

- features measured: **433**
- median share of variance that is between-season: **0.005**
- features above 0.10: **57**  |  above 0.25: **16**  |  above 0.50: **1**

| feature | between-season share |
|---|---|
| `adj_own_three_rate_sum_def` | 0.601 |
| `adj_own_oreb_pct_sum_def` | 0.475 |
| `opp_adj_net_three_rate` | 0.441 |
| `own_adj_net_three_rate` | 0.441 |
| `raw_trate_s2d_sum_alwd` | 0.393 |
| `adj_own_three_rate_sum_off` | 0.352 |
| `adj_own_ftr_sum_off` | 0.348 |
| `adj_own_ftr_sum_def` | 0.343 |
| `opp_adj_net_ftr` | 0.342 |
| `own_adj_net_ftr` | 0.342 |
| `opp_adj_net_oreb_pct` | 0.340 |
| `own_adj_net_oreb_pct` | 0.340 |
| `adj_own_oreb_pct_sum_off` | 0.278 |
| `raw_trate_l10_sum_alwd` | 0.265 |
| `raw_oreb_s2d_sum_alwd` | 0.254 |

### Can a model tell which season a row came from?

One-vs-rest ridge on the features alone, 70/30 split, predicting the SEASON label. This is the complaint as a prediction problem: if the seasons were one league, this would sit at the base rate.

- accuracy **95.5%** against a **25.8%** base rate (4 seasons)


## Study 2 — do the relationships change, or only the levels?

The same ridge fit inside each season separately, then the coefficient vectors correlated against each other. Two very different diagnoses hide behind the same complaint: if the numbers only shift LEVEL, normalising per season fixes it and pooling still buys real sample; if the COEFFICIENTS rotate, pooling is averaging models of different leagues and normalisation will not save it.

| | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| **2022** | +1.000 | +0.016 | -0.039 | -0.011 |
| **2023** | +0.016 | +1.000 | +0.026 | +0.078 |
| **2024** | -0.039 | +0.026 | +1.000 | +0.168 |
| **2025** | -0.011 | +0.078 | +0.168 | +1.000 |

Mean off-diagonal correlation **+0.040** (range -0.039 to +0.168).


## Study 3 — Full-game total: seven training regimes, same rows

Every regime is graded on the identical set of games — the ones all seven can predict — so this is a contest about accuracy, not about who bets more often. Bet when the model and the market differ by at least 4 points. Nulls are 20 game-level shuffles per regime, re-measured in this cell.

| regime | bets | win% | base% | edge | ROI | z | 2023 ROI | 2024 ROI | 2025 ROI |
|---|---|---|---|---|---|---|---|---|---|---|
| pooled, all history (current baseline) | 1,054 | 52.6 | 50.8 | **+1.8** | **+0.3** | +1.94 | -2.5 | -1.9 | +7.9 |
| trailing 1 season of rows | 1,669 | 53.6 | 50.7 | **+2.9** | **+2.4** | +2.16 | -7.9 | +5.4 | +8.5 |
| trailing 2 seasons of rows | 1,271 | 54.2 | 50.4 | **+3.8** | **+3.5** | +2.81 | -2.5 | +1.5 | +10.9 |
| recency half-life 180 days | 1,503 | 54.8 | 51.0 | **+3.8** | **+4.5** | +3.19 | -0.2 | +1.5 | +11.6 |
| recency half-life 365 days | 1,179 | 53.8 | 50.1 | **+3.6** | **+2.7** | +2.70 | -3.2 | -1.9 | +13.5 |
| season-relative features, all history | 1,085 | 52.9 | 50.2 | **+2.7** | **+1.0** | +1.93 | -4.0 | +1.9 | +5.7 |
| season-relative + half-life 365 | 1,201 | 53.2 | 50.8 | **+2.4** | **+1.6** | +1.87 | -5.0 | -1.0 | +10.9 |


## Study 3 — Full-game spread: seven training regimes, same rows

Every regime is graded on the identical set of games — the ones all seven can predict — so this is a contest about accuracy, not about who bets more often. Bet when the model and the market differ by at least 3 points. Nulls are 20 game-level shuffles per regime, re-measured in this cell.

| regime | bets | win% | base% | edge | ROI | z | 2023 ROI | 2024 ROI | 2025 ROI |
|---|---|---|---|---|---|---|---|---|---|---|
| pooled, all history (current baseline) | 832 | 50.4 | 51.9 | **-1.6** | **-3.8** | -0.61 | -1.0 | -5.1 | -6.6 |
| trailing 1 season of rows | 1,310 | 47.5 | 52.1 | **-4.6** | **-9.3** | -2.70 | -5.9 | -15.3 | -7.2 |
| trailing 2 seasons of rows | 956 | 49.4 | 52.5 | **-3.1** | **-5.7** | -1.44 | -1.0 | -7.8 | -8.9 |
| recency half-life 180 days | 1,271 | 48.0 | 51.1 | **-3.1** | **-8.3** | -1.52 | -2.7 | -12.0 | -10.4 |
| recency half-life 365 days | 963 | 49.7 | 51.3 | **-1.6** | **-5.0** | -0.44 | -1.7 | -9.1 | -4.8 |
| season-relative features, all history | 804 | 48.6 | 51.7 | **-3.1** | **-7.1** | -1.10 | -6.0 | -3.6 | -13.7 |
| season-relative + half-life 365 | 971 | 48.2 | 52.3 | **-4.1** | **-7.9** | -1.94 | -2.8 | -14.1 | -8.5 |


## Study 4 — is the early season predicted with last season's team?

Rolling features need games to fill. In October a five-game window is partly last season's roster, so if the regime concern is real anywhere it should be worst here. Baseline regime, full-game total, by calendar month.

| month | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| October | 79 | 55.7 | 50.6 | **+5.1** | +6.3 |
| November | 234 | 57.7 | 52.1 | **+5.6** | +10.1 |
| December | 152 | 48.7 | 50.7 | **-2.0** | -7.0 |
| January | 152 | 48.0 | 53.9 | **-5.9** | -8.3 |
| February | 125 | 51.2 | 52.0 | **-0.8** | -2.2 |
| March | 169 | 53.3 | 52.1 | **+1.2** | +1.7 |
| April | 117 | 53.0 | 51.3 | **+1.7** | +1.2 |

