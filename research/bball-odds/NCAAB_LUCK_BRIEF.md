# NCAAB team luck — the MLB question in the softer basketball market

23,163 priced games, four seasons. Luck = trailing-5 minus the team's own season-to-date. The NBA version of this was null four ways; the mechanism for that null (82 games, stable rotation) does not transfer to a 31-game season with wholesale roster turnover.

## 1. The gradient (primary)

Cover/over % of backing the POSITIVE side, by decile of the luck composite. Regression predicts a DOWNWARD slope: the luckier, the less it repeats. The placebo should be flat -- and if it is not flat, nothing here is about luck.

| family | market | n | decile % backing positive (unlucky→lucky) | r |
|---|---|---|---|---|
| shooting luck | FG spread OPEN | 21,504 | 51 49 50 50 51 50 50 50 50 50 | -0.003 |
| shooting luck | FG spread T-60 | 21,453 | 50 49 50 50 51 49 50 50 50 50 | -0.002 |
| shooting luck | 1H spread | 16,069 | 48 47 49 48 49 49 49 49 51 48 | +0.010 |
| shooting luck | FG total OPEN | 21,575 | 51 51 51 50 49 51 52 50 52 49 | -0.005 |
| shooting luck | FG total T-60 | 21,581 | 50 50 51 50 49 50 52 51 52 50 | +0.004 |
| shooting luck | 1H total | 16,102 | 50 50 49 48 49 48 49 49 48 50 | -0.006 |

| results luck | FG spread OPEN | 21,510 | 50 49 49 54 51 51 47 50 51 50 | -0.000 |
| results luck | FG spread T-60 | 21,459 | 50 49 49 53 51 50 48 50 50 51 | -0.001 |
| results luck | 1H spread | 16,072 | 47 49 47 50 47 51 49 50 50 49 | +0.012 |
| results luck | FG total OPEN | 21,581 | 49 51 50 52 50 52 50 50 51 51 | +0.009 |
| results luck | FG total T-60 | 21,587 | 48 50 50 51 50 52 50 50 51 52 | +0.015 |
| results luck | 1H total | 16,105 | 49 48 50 51 49 49 48 49 48 48 | -0.003 |

| all luck | FG spread OPEN | 21,510 | 51 49 49 52 50 50 51 50 50 50 | -0.002 |
| all luck | FG spread T-60 | 21,459 | 50 50 49 52 50 49 51 50 49 50 | -0.002 |
| all luck | 1H spread | 16,072 | 49 47 49 48 48 49 50 49 50 49 | +0.011 |
| all luck | FG total OPEN | 21,581 | 50 51 50 51 49 51 51 52 51 50 | +0.001 |
| all luck | FG total T-60 | 21,587 | 49 50 50 51 50 51 50 52 51 51 | +0.009 |
| all luck | 1H total | 16,105 | 50 50 50 47 48 50 50 50 46 49 | -0.005 |

| RATE placebo | FG spread OPEN | 21,504 | 52 52 49 50 51 50 49 49 50 50 | -0.015 |
| RATE placebo | FG spread T-60 | 21,453 | 52 52 49 51 50 50 49 49 49 50 | -0.015 |
| RATE placebo | 1H spread | 16,069 | 50 51 47 49 47 51 49 49 47 49 | -0.009 |
| RATE placebo | FG total OPEN | 21,575 | 49 52 50 49 52 50 49 49 52 53 | +0.014 |
| RATE placebo | FG total T-60 | 21,581 | 49 53 51 48 52 50 49 49 52 53 | +0.010 |
| RATE placebo | 1H total | 16,102 | 48 49 50 50 49 48 48 48 48 51 | +0.003 |

## 2. Fade the lucky side, top 20% of |composite|

| family | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| shooting luck | FG spread OPEN | 4,301 | 50.5 | 50.2 | **+0.3** | -3.5 | 0.353 | 23:49 24:51 25:51 26:51 |
| shooting luck | FG spread T-60 | 4,291 | 50.3 | 50.0 | **+0.3** | -4.0 | 0.364 | 23:48 24:50 25:51 26:50 |
| shooting luck | 1H spread | 3,214 | 49.9 | 51.6 | **-1.7** | -5.3 | 0.975 | 24:49 25:48 26:53 |
| shooting luck | FG total OPEN | 4,315 | 50.5 | 50.2 | **+0.3** | -3.6 | 0.337 | 23:52 24:50 25:50 26:51 |
| shooting luck | FG total T-60 | 4,317 | 49.6 | 50.3 | **-0.7** | -5.3 | 0.828 | 23:51 24:49 25:49 26:50 |
| shooting luck | 1H total | 3,221 | 50.7 | 50.3 | **+0.4** | -3.9 | 0.318 | 24:51 25:50 26:51 |

| results luck | FG spread OPEN | 4,302 | 49.7 | 50.1 | **-0.4** | -5.1 | 0.716 | 23:50 24:51 25:49 26:50 |
| results luck | FG spread T-60 | 4,292 | 49.6 | 50.2 | **-0.6** | -5.3 | 0.791 | 23:50 24:50 25:49 26:49 |
| results luck | 1H spread | 3,215 | 49.0 | 52.1 | **-3.2** | -7.1 | 1.000 | 24:49 25:47 26:51 |
| results luck | FG total OPEN | 4,317 | 48.6 | 50.1 | **-1.5** | -7.2 | 0.975 | 23:47 24:51 25:46 26:50 |
| results luck | FG total T-60 | 4,318 | 48.1 | 50.0 | **-1.9** | -8.1 | 0.994 | 23:47 24:50 25:45 26:50 |
| results luck | 1H total | 3,221 | 50.4 | 51.3 | **-0.9** | -4.6 | 0.848 | 24:50 25:48 26:53 |

| all luck | FG spread OPEN | 4,302 | 50.2 | 50.3 | **-0.1** | -4.1 | 0.555 | 23:50 24:50 25:49 26:51 |
| all luck | FG spread T-60 | 4,292 | 50.0 | 50.2 | **-0.2** | -4.6 | 0.616 | 23:49 24:50 25:49 26:51 |
| all luck | 1H spread | 3,215 | 49.8 | 51.2 | **-1.4** | -5.6 | 0.945 | 24:49 25:48 26:52 |
| all luck | FG total OPEN | 4,317 | 49.9 | 50.1 | **-0.2** | -4.8 | 0.623 | 23:47 24:50 25:49 26:52 |
| all luck | FG total T-60 | 4,318 | 49.1 | 50.1 | **-1.1** | -6.4 | 0.924 | 23:46 24:49 25:49 26:51 |
| all luck | 1H total | 3,221 | 50.5 | 50.7 | **-0.3** | -4.5 | 0.628 | 24:51 25:48 26:52 |

| RATE placebo | FG spread OPEN | 4,301 | 50.9 | 50.9 | **-0.0** | -2.8 | 0.516 | 23:53 24:50 25:51 26:49 |
| RATE placebo | FG spread T-60 | 4,291 | 50.9 | 50.7 | **+0.2** | -2.7 | 0.380 | 23:53 24:51 25:51 26:50 |
| RATE placebo | 1H spread | 3,214 | 50.7 | 50.4 | **+0.3** | -3.8 | 0.366 | 24:50 25:51 26:51 |
| RATE placebo | FG total OPEN | 4,315 | 48.3 | 50.4 | **-2.1** | -7.8 | 0.997 | 23:48 24:50 25:47 26:48 |
| RATE placebo | FG total T-60 | 4,317 | 48.3 | 50.7 | **-2.3** | -7.7 | 0.999 | 23:49 24:50 25:46 26:48 |
| RATE placebo | 1H total | 3,221 | 48.8 | 50.5 | **-1.7** | -7.6 | 0.979 | 24:48 25:48 26:50 |

## 3. Season phase — a 5-game window is a different object in November

| slice | family | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| early <12gp | all luck | FG spread T-60 | 1,221 | 49.3 | 51.0 | **-1.7** | -5.9 | 0.891 | 23:49 24:48 25:52 26:48 |
| early <12gp | all luck | FG total T-60 | 1,230 | 49.5 | 50.1 | **-0.6** | -5.5 | 0.673 | 23:45 24:50 25:47 26:54 |
| early <12gp | RATE placebo | FG spread T-60 | 1,220 | 50.8 | 50.7 | **+0.1** | -3.0 | 0.488 | 23:52 24:54 25:47 26:51 |
| early <12gp | RATE placebo | FG total T-60 | 1,229 | 48.1 | 51.1 | **-3.0** | -8.2 | 0.985 | 23:48 24:47 25:48 26:48 |

| mid 12-21gp | all luck | FG spread T-60 | 1,369 | 52.4 | 50.4 | **+2.0** | +0.2 | 0.068 | 23:49 24:54 25:52 26:53 |
| mid 12-21gp | all luck | FG total T-60 | 1,379 | 50.1 | 50.7 | **-0.6** | -4.3 | 0.680 | 23:45 24:51 25:51 26:51 |
| mid 12-21gp | RATE placebo | FG spread T-60 | 1,369 | 51.5 | 51.6 | **-0.1** | -1.6 | 0.528 | 23:50 24:52 25:53 26:52 |
| mid 12-21gp | RATE placebo | FG total T-60 | 1,379 | 48.3 | 51.2 | **-2.9** | -7.8 | 0.985 | 23:49 24:51 25:42 26:51 |

| late 22+gp | all luck | FG spread T-60 | 1,703 | 47.7 | 51.8 | **-4.1** | -8.8 | 1.000 | 23:48 24:47 25:46 26:50 |
| late 22+gp | all luck | FG total T-60 | 1,710 | 47.6 | 50.7 | **-3.1** | -9.1 | 0.995 | 23:51 24:47 25:44 26:50 |
| late 22+gp | RATE placebo | FG spread T-60 | 1,703 | 50.1 | 52.8 | **-2.8** | -4.3 | 0.990 | 23:52 24:50 25:49 26:50 |
| late 22+gp | RATE placebo | FG total T-60 | 1,710 | 48.2 | 51.9 | **-3.7** | -8.0 | 0.999 | 23:50 24:47 25:46 26:49 |

