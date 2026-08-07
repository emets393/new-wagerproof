# CBB — the prediction on every game

`cbb_market_models.py --stage product`. **Nothing here is filtered.** Every row covers every game the market is priced on, because the product is a number on every game and the bet is a layer on top of it.

`model MAE` is the mean absolute error of the model's own forecast; `market MAE` is the same error for the posted line. **A model worth showing beats the second column.** The previous college model in `NCAAB_MODEL_BRIEF2.md` posted 9.11 against the market's 8.80 and did not.

`win% all games` bets literally every game, no selectivity, purely as a calibration read — it is not a strategy.


## UNCUT — the display model

Full-game model 236 features, first-half model 236 features, both at 365d.

| market | games | model MAE | market MAE | model better by | paired t | corr | win% all | base% |
|---|---|---|---|---|---|---|---|---|
| Team total | 32,692 | 7.970 | 7.963 | **-0.007** | **-0.94** | +0.0550 | 52.0 | 50.9 |
| Full-game total | 17,293 | 13.147 | 13.095 | **-0.051** | **-3.23** | +0.0303 | 51.1 | 50.3 |
| Full-game spread | 17,196 | 8.960 | 8.983 | **+0.023** | **+2.04** | +0.0708 | 52.8 | 50.3 |
| Moneyline | 17,315 | — | — | — | — | +0.2166 | 60.6 | 63.8 |
| First-half total | 17,029 | 7.973 | 7.965 | **-0.008** | **-0.80** | +0.0509 | 51.3 | 50.8 |
| First-half spread | 17,003 | 7.328 | 7.337 | **+0.009** | **+1.03** | +0.0553 | 51.8 | 51.1 |
| First-half moneyline | 16,502 | — | — | — | — | +0.1350 | 56.6 | 60.7 |

### By season — model MAE minus market MAE (negative = model beats the line)

| market | 2022-23 | 2023-24 | 2024-25 | 2025-26 |
|---|---|---|---|---|
| Team total | — | **+0.031** | **+0.019** | **-0.008** |
| Full-game total | **+1.763** | **+0.094** | **+0.058** | **+0.003** |
| Full-game spread | **+0.073** | **-0.010** | **+0.010** | **-0.021** |
| First-half total | — | **+0.044** | **+0.012** | **+0.004** |
| First-half spread | — | **+0.048** | **-0.010** | **-0.027** |


## CUT — spread-specific

Full-game model 164 features, first-half model 220 features, both at 365d.

| market | games | model MAE | market MAE | model better by | paired t | corr | win% all | base% |
|---|---|---|---|---|---|---|---|---|
| Team total | 32,692 | 7.964 | 7.963 | **-0.001** | **-0.08** | +0.0570 | 52.0 | 50.9 |
| Full-game total | 17,293 | 13.131 | 13.095 | **-0.035** | **-2.38** | +0.0321 | 51.3 | 50.3 |
| Full-game spread | 17,196 | 8.951 | 8.983 | **+0.032** | **+3.14** | +0.0721 | 52.5 | 50.3 |
| Moneyline | 17,315 | — | — | — | — | +0.2230 | 60.8 | 63.8 |
| First-half total | 17,029 | 7.974 | 7.965 | **-0.009** | **-0.92** | +0.0475 | 51.3 | 50.8 |
| First-half spread | 17,003 | 7.327 | 7.337 | **+0.010** | **+1.14** | +0.0551 | 51.7 | 51.1 |
| First-half moneyline | 16,502 | — | — | — | — | +0.1659 | 55.3 | 60.7 |

### By season — model MAE minus market MAE (negative = model beats the line)

| market | 2022-23 | 2023-24 | 2024-25 | 2025-26 |
|---|---|---|---|---|
| Team total | — | **+0.021** | **+0.010** | **-0.010** |
| Full-game total | **+1.532** | **+0.072** | **+0.037** | **-0.000** |
| Full-game spread | **-0.042** | **-0.012** | **-0.025** | **-0.015** |
| First-half total | — | **+0.043** | **+0.016** | **+0.001** |
| First-half spread | — | **+0.048** | **-0.010** | **-0.030** |

