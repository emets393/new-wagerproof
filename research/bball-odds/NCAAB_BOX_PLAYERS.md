# NCAAB box-score players — absence replication and non-shooting heat

Built from `cbbd_player_box` (four seasons, explicit minutes), independent of the `lineups_ncaab` table behind NCAAB_AVAIL_VALIDATION.md.

## A — replicating the absence edge on a different feed

Fade the team missing more rotation minutes tonight, top 30% of |differential|. The lineup-table version scored 58.8% / +12.2% (open) and 57.6% / +10.0% (T-60) over three seasons. **These rows still require a pregame availability feed** -- they read tonight's absences.

| signal | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| raw minutes missing | FG spread OPEN | 734 | 54.5 | 51.0 | **+3.5** | +4.1 | 0.029 | 23:57 24:55 25:55 26:51 |
| raw minutes missing | FG spread T-60 | 733 | 52.9 | 50.3 | **+2.6** | +1.1 | 0.085 | 23:57 24:53 25:52 26:51 |
| impact-valued | FG spread OPEN | 343 | 56.9 | 51.0 | **+5.8** | +8.6 | 0.017 | 23:48 24:59 25:60 26:59 |
| impact-valued | FG spread T-60 | 345 | 56.2 | 51.9 | **+4.3** | +7.4 | 0.056 | 23:46 24:59 25:60 26:59 |
| headcount | FG spread OPEN | 2,337 | 53.8 | 50.1 | **+3.7** | +2.8 | 0.000 | 23:55 24:55 25:53 26:53 |
| headcount | FG spread T-60 | 2,347 | 53.3 | 50.4 | **+2.8** | +1.7 | 0.003 | 23:54 24:54 25:52 26:53 |

## B — non-shooting heat

Fade the team whose rotation is running hottest against its OWN baseline on each rate. `ft_pct` is the strongest a priori luck candidate in basketball (almost opponent-independent). The last two rows are the PLACEBO: how often a player shoots or gets to the line is style, not luck, so it cannot regress -- if it scores like the real rates, nothing here is about luck.

| signal | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| ft_pct | FG spread OPEN | 5,495 | 50.0 | 50.0 | **-0.1** | -4.6 | 0.539 | 23:47 24:51 25:51 26:51 |
| ft_pct | FG spread T-60 | 5,483 | 49.6 | 50.1 | **-0.5** | -5.2 | 0.755 | 23:47 24:51 25:51 26:50 |
| ft_pct | FG total OPEN | 5,511 | 50.3 | 51.0 | **-0.7** | -4.0 | 0.863 | 23:49 24:50 25:50 26:52 |
| ft_pct | FG total T-60 | 5,511 | 50.2 | 50.8 | **-0.6** | -4.1 | 0.810 | 23:49 24:50 25:50 26:51 |
| ft_pct | 1H spread | 4,197 | 50.5 | 50.9 | **-0.5** | -4.3 | 0.733 | 24:49 25:51 26:51 |
| ft_pct | 1H total | 4,204 | 49.8 | 51.3 | **-1.5** | -5.7 | 0.970 | 24:50 25:49 26:50 |
| ft_pct | team total HOME | 4,078 | 50.2 | 51.2 | **-1.0** | -5.7 | 0.899 | 24:50 25:51 26:50 |
| ft_pct | team total AWAY | 4,076 | 49.5 | 51.5 | **-2.0** | -6.9 | 0.994 | 24:51 25:48 26:50 |

| tov_rate | FG spread OPEN | 5,498 | 49.8 | 50.1 | **-0.3** | -5.0 | 0.671 | 23:48 24:52 25:50 26:50 |
| tov_rate | FG spread T-60 | 5,485 | 49.6 | 50.1 | **-0.5** | -5.2 | 0.769 | 23:48 24:52 25:49 26:49 |
| tov_rate | FG total OPEN | 5,513 | 50.6 | 51.1 | **-0.6** | -3.5 | 0.802 | 23:52 24:48 25:50 26:52 |
| tov_rate | FG total T-60 | 5,514 | 49.9 | 51.0 | **-1.1** | -4.7 | 0.943 | 23:51 24:48 25:50 26:51 |
| tov_rate | 1H spread | 4,199 | 50.1 | 51.6 | **-1.5** | -5.0 | 0.978 | 24:51 25:51 26:48 |
| tov_rate | 1H total | 4,206 | 50.2 | 50.5 | **-0.3** | -4.9 | 0.635 | 24:48 25:50 26:53 |
| tov_rate | team total HOME | 4,079 | 49.9 | 51.0 | **-1.1** | -6.3 | 0.928 | 24:49 25:49 26:52 |
| tov_rate | team total AWAY | 4,077 | 48.8 | 52.1 | **-3.3** | -8.1 | 1.000 | 24:47 25:50 26:50 |

| reb_rate | FG spread OPEN | 5,498 | 50.2 | 50.1 | **+0.1** | -4.2 | 0.440 | 23:49 24:50 25:50 26:52 |
| reb_rate | FG spread T-60 | 5,485 | 50.1 | 50.3 | **-0.2** | -4.2 | 0.616 | 23:49 24:49 25:51 26:52 |
| reb_rate | FG total OPEN | 5,513 | 49.7 | 50.2 | **-0.4** | -5.0 | 0.745 | 23:51 24:50 25:49 26:48 |
| reb_rate | FG total T-60 | 5,514 | 49.4 | 50.4 | **-1.0** | -5.6 | 0.926 | 23:51 24:49 25:50 26:47 |
| reb_rate | 1H spread | 4,199 | 50.5 | 50.4 | **+0.1** | -4.1 | 0.434 | 24:50 25:50 26:52 |
| reb_rate | 1H total | 4,206 | 49.6 | 50.9 | **-1.3** | -6.1 | 0.953 | 24:51 25:50 26:48 |
| reb_rate | team total HOME | 4,079 | 49.4 | 50.0 | **-0.6** | -7.2 | 0.773 | 24:49 25:50 26:49 |
| reb_rate | team total AWAY | 4,077 | 49.0 | 50.3 | **-1.3** | -7.7 | 0.953 | 24:49 25:51 26:48 |

| ast_rate | FG spread OPEN | 5,498 | 50.5 | 50.8 | **-0.3** | -3.6 | 0.673 | 23:51 24:50 25:51 26:51 |
| ast_rate | FG spread T-60 | 5,485 | 50.6 | 50.5 | **+0.1** | -3.5 | 0.447 | 23:50 24:50 25:51 26:51 |
| ast_rate | FG total OPEN | 5,513 | 50.0 | 51.6 | **-1.7** | -4.6 | 0.994 | 23:54 24:50 25:48 26:48 |
| ast_rate | FG total T-60 | 5,514 | 49.6 | 51.4 | **-1.8** | -5.3 | 0.997 | 23:54 24:50 25:48 26:47 |
| ast_rate | 1H spread | 4,199 | 50.1 | 51.5 | **-1.4** | -5.0 | 0.966 | 24:48 25:49 26:52 |
| ast_rate | 1H total | 4,206 | 47.9 | 50.2 | **-2.3** | -9.3 | 0.998 | 24:48 25:48 26:48 |
| ast_rate | team total HOME | 4,079 | 50.0 | 51.8 | **-1.8** | -6.0 | 0.989 | 24:50 25:50 26:50 |
| ast_rate | team total AWAY | 4,077 | 48.2 | 52.0 | **-3.8** | -9.3 | 1.000 | 24:50 25:49 26:46 |

| fta_rate (placebo) | FG spread OPEN | 5,498 | 51.2 | 50.0 | **+1.1** | -2.3 | 0.048 | 23:51 24:51 25:51 26:51 |
| fta_rate (placebo) | FG spread T-60 | 5,485 | 51.5 | 50.1 | **+1.3** | -1.7 | 0.023 | 23:52 24:52 25:51 26:52 |
| fta_rate (placebo) | FG total OPEN | 5,513 | 50.9 | 50.2 | **+0.6** | -2.9 | 0.172 | 23:50 24:51 25:51 26:51 |
| fta_rate (placebo) | FG total T-60 | 5,514 | 50.6 | 50.4 | **+0.2** | -3.3 | 0.386 | 23:51 24:51 25:51 26:50 |
| fta_rate (placebo) | 1H spread | 4,199 | 52.8 | 51.6 | **+1.1** | +0.1 | 0.069 | 24:53 25:53 26:53 |
| fta_rate (placebo) | 1H total | 4,206 | 50.9 | 50.6 | **+0.3** | -3.6 | 0.337 | 24:51 25:50 26:51 |
| fta_rate (placebo) | team total HOME | 4,079 | 52.3 | 50.3 | **+2.0** | -1.7 | 0.005 | 24:53 25:51 26:53 |
| fta_rate (placebo) | team total AWAY | 4,077 | 50.1 | 50.6 | **-0.5** | -5.8 | 0.750 | 24:50 25:50 26:50 |

| fga_rate (placebo) | FG spread OPEN | 5,498 | 51.2 | 50.3 | **+0.9** | -2.2 | 0.097 | 23:52 24:51 25:49 26:52 |
| fga_rate (placebo) | FG spread T-60 | 5,485 | 51.0 | 50.6 | **+0.5** | -2.5 | 0.248 | 23:51 24:51 25:49 26:53 |
| fga_rate (placebo) | FG total OPEN | 5,513 | 50.4 | 50.4 | **+0.0** | -3.7 | 0.481 | 23:51 24:51 25:51 26:50 |
| fga_rate (placebo) | FG total T-60 | 5,514 | 50.7 | 50.3 | **+0.4** | -3.2 | 0.287 | 23:51 24:51 25:51 26:50 |
| fga_rate (placebo) | 1H spread | 4,199 | 51.2 | 51.2 | **+0.0** | -2.8 | 0.488 | 24:51 25:52 26:51 |
| fga_rate (placebo) | 1H total | 4,206 | 51.1 | 50.3 | **+0.8** | -3.2 | 0.148 | 24:51 25:50 26:52 |
| fga_rate (placebo) | team total HOME | 4,079 | 51.9 | 50.9 | **+1.1** | -2.3 | 0.092 | 24:52 25:51 26:53 |
| fga_rate (placebo) | team total AWAY | 4,077 | 49.5 | 52.8 | **-3.3** | -6.9 | 1.000 | 24:49 25:51 26:48 |

