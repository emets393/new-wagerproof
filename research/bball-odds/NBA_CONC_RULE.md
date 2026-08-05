# NBA usage concentration as a RULE — does the tail behave?

Mechanism, measured with no market involved on 10,324 team-games: concentrated minutes mean fewer points next game, and a concentration RISE adds to that beyond the level. Direction was fixed from that measurement — **under** — before anything here was graded. See `NBA_CONC_WINDOW.md` §2b.

`conc_chg` is the three-game mean minus the ten-game mean of minute/point concentration, z-scored against prior games only and averaged over both teams: *both these teams have just shortened up*. `conc_lvl` is the ten-game level, which is the naive version and is the control.

## 1. Headline — the rule and its control

| cell | n | under% | league% | edge | ±1sd | ROI |
|---|---|---|---|---|---|---|
| concentration RISING (top 20%) | 870 | 50.8 | 49.4 | **+1.4** | ±1.7 | -3.0 |
| concentration RISING (top 10%) | 458 | 48.9 | 49.4 | **-0.5** | ±2.3 | -6.6 |
| CONTROL: concentration HIGH (top 20%) | 687 | 48.9 | 49.4 | **-0.5** | ±1.9 | -6.6 |
| CONTROL: concentration HIGH (top 10%) | 352 | 46.3 | 49.4 | **-3.1** | ±2.7 | -11.6 |
| both: rising AND already high | 165 | 53.9 | 49.4 | **+4.5** | ±3.9 | +3.0 |
| every game (the league baseline) | 4919 | 49.4 | 49.4 | **-0.0** | ±0.7 | -5.6 |

## 2. Phase split — a pooled number can hide a rule that only lives in one part of the season

| phase | n | under% | league% | edge | ±1sd | ROI |
|---|---|---|---|---|---|---|
| EARLY | 136 | 44.1 | 49.4 | **-5.3** | ±4.3 | -15.8 |
| MID | 232 | 53.0 | 49.4 | **+3.6** | ±3.3 | +1.2 |
| LATE | 342 | 52.6 | 49.4 | **+3.2** | ±2.7 | +0.5 |
| POST | 160 | 49.4 | 49.4 | **-0.1** | ±4.0 | -5.7 |

## 3. Season split — pooled results hide late-year decay

| season | n | under% | league% | edge | ±1sd | ROI |
|---|---|---|---|---|---|---|
| 2022 | 177 | 56.5 | 49.4 | **+7.1** | ±3.8 | +7.9 |
| 2023 | 261 | 47.9 | 49.4 | **-1.5** | ±3.1 | -8.6 |
| 2024 | 187 | 48.1 | 49.4 | **-1.3** | ±3.7 | -8.1 |
| 2025 | 245 | 51.8 | 49.4 | **+2.4** | ±3.2 | -1.0 |
