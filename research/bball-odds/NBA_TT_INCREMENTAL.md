# NBA team totals — is it a third bet or the same two bets again?

`nba_tt_incr.py`. Every team-total bet from construction A, split by whether the two SETTLED full-game models would already have fired on that game at their own >=8-point rung. Only the games where neither fires carry risk we are not already carrying.

Of 7,901 gradeable team-games, the total model would bet 17% and the spread model 9%; **76% are games neither touches.**

| tt cut | which games | bets | win% | base% | ROI |
|---|---|---|---|---|---|
| >=4 | all games | 2,196 | 55.3 | 53.3 | **+4.2** |
| >=4 | NEITHER model bets | 1,031 | 51.5 | 54.6 | **-3.6** |
| >=4 | total model bets it | 984 | 58.3 | 53.4 | **+10.2** |
| >=4 | spread model bets it | 278 | 58.6 | 52.2 | **+11.1** |
| >=4 | both bet it | 97 | 54.6 | 52.6 | **+3.7** |
| >=5 | all games | 1,429 | 55.9 | 53.6 | **+5.0** |
| >=5 | NEITHER model bets | 505 | 50.1 | 55.6 | **-6.8** |
| >=5 | total model bets it | 797 | 59.0 | 53.8 | **+11.2** |
| >=5 | spread model bets it | 214 | 57.5 | 52.3 | **+9.1** |
| >=5 | both bet it | 87 | 54.0 | 52.9 | **+2.6** |
| >=6 | all games | 865 | 57.1 | 54.2 | **+7.1** |
| >=6 | NEITHER model bets | 226 | 47.8 | 58.4 | **-12.1** |
| >=6 | total model bets it | 573 | 60.0 | 54.3 | **+13.1** |
| >=6 | spread model bets it | 135 | 57.8 | 51.9 | **+9.7** |
| >=6 | both bet it | 69 | 52.2 | 56.5 | **-1.0** |

## The 'neither model bets' cell against nulls

15 game-level target shuffles, conditioning mask held fixed at its real value.

| tt cut | bets | win% | base% | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|
| >=4 | 1,031 | 51.5 | 54.6 | **-3.6** | -0.90 | 0.58 | **-3.78** |
| >=5 | 505 | 50.1 | 55.6 | **-6.8** | -1.01 | 0.65 | **-6.95** |
| >=6 | 226 | 47.8 | 58.4 | **-12.1** | -1.27 | 0.71 | **-13.18** |

## Seasons inside the incremental cell

| tt cut | season | bets | win% | ROI |
|---|---|---|---|---|
| >=4 | 2023 | 372 | 48.4 | **-11.6** |
| >=4 | 2024 | 344 | 54.9 | **+4.1** |
| >=4 | 2025 | 315 | 51.4 | **-2.5** |
| >=5 | 2023 | 190 | 46.3 | **-16.8** |
| >=5 | 2024 | 167 | 50.9 | **-3.7** |
| >=5 | 2025 | 148 | 54.1 | **+2.3** |
| >=6 | 2023 | 95 | 43.2 | **-24.4** |
| >=6 | 2024 | 73 | 46.6 | **-11.8** |
| >=6 | 2025 | 58 | 56.9 | **+7.5** |

