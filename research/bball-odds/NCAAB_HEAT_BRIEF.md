# NCAAB player heat — the S10 port

23,033 priced games, 79.9% with heat on both sides (18,410 usable). The NBA version had 5,278 games total and bet 446 of them.

## 1. The gradient (primary — one test, cannot be gamed)

Cover rate of BACKING HOME, by decile of the home-minus-away differential, coldest home on the left. P1 predicts a DOWNWARD slope for real heat and a flat line for the placebo.

| signal | market | n | decile cover % of backing home (cold→hot home) | r |
|---|---|---|---|---|
| player heat | FG spread OPEN | 18,189 | 52 52 50 49 52 48 50 51 49 47 | -0.024 |
| player heat | FG spread T-60 | 18,143 | 51 52 50 50 51 48 50 50 49 48 | -0.018 |
| player heat | FG total OPEN | 18,240 | 54 49 52 50 50 50 53 51 49 50 | -0.011 |
| player heat | FG total T-60 | 18,243 | 53 50 51 50 50 50 53 52 49 50 | -0.008 |
| player heat | 1H spread | 14,900 | 51 48 50 49 51 47 50 48 47 46 | -0.023 |
| player heat | 1H total | 14,925 | 51 48 49 50 48 49 49 51 48 50 | +0.004 |
| player heat | team total HOME | 14,495 | 53 50 49 49 52 50 53 51 49 49 | -0.011 |
| player heat | team total AWAY | 14,486 | 52 49 51 50 50 51 54 52 52 52 | +0.008 |

| NO own-baseline (ctrl) | FG spread OPEN | 18,189 | 53 51 50 49 52 50 49 47 51 48 | -0.024 |
| NO own-baseline (ctrl) | FG spread T-60 | 18,143 | 53 51 49 49 51 50 50 47 50 49 | -0.020 |
| NO own-baseline (ctrl) | FG total OPEN | 18,240 | 53 51 49 50 50 50 51 52 52 52 | +0.005 |
| NO own-baseline (ctrl) | FG total T-60 | 18,243 | 52 50 49 50 51 51 50 51 52 52 | +0.007 |
| NO own-baseline (ctrl) | 1H spread | 14,900 | 50 49 49 48 51 47 49 46 49 48 | -0.013 |
| NO own-baseline (ctrl) | 1H total | 14,925 | 49 48 46 48 49 49 50 51 51 52 | +0.021 |
| NO own-baseline (ctrl) | team total HOME | 14,495 | 52 48 49 49 52 51 51 49 54 50 | +0.003 |
| NO own-baseline (ctrl) | team total AWAY | 14,486 | 51 50 50 53 50 51 52 53 50 53 | +0.012 |

| team aggregate (ctrl) | FG spread OPEN | 21,690 | 54 52 53 50 51 49 50 48 48 49 | -0.031 |
| team aggregate (ctrl) | FG spread T-60 | 21,634 | 53 51 52 50 51 49 50 48 48 49 | -0.025 |
| team aggregate (ctrl) | FG total OPEN | 21,754 | 53 51 50 50 50 52 51 50 49 52 | -0.007 |
| team aggregate (ctrl) | FG total T-60 | 21,758 | 53 50 50 50 51 51 51 50 50 52 | -0.005 |
| team aggregate (ctrl) | 1H spread | 16,682 | 51 49 50 48 50 48 48 48 47 48 | -0.017 |
| team aggregate (ctrl) | 1H total | 16,708 | 50 48 48 49 49 49 51 48 49 52 | +0.007 |
| team aggregate (ctrl) | team total HOME | 16,071 | 52 50 51 51 51 50 51 50 48 52 | -0.007 |
| team aggregate (ctrl) | team total AWAY | 16,062 | 52 51 49 50 50 54 50 53 51 53 | +0.010 |

| shot selection (placebo) | FG spread OPEN | 20,975 | 50 49 49 52 50 51 51 51 49 51 | +0.006 |
| shot selection (placebo) | FG spread T-60 | 20,927 | 50 49 49 52 49 50 50 50 49 51 | +0.006 |
| shot selection (placebo) | FG total OPEN | 21,036 | 48 50 52 51 49 51 52 51 52 52 | +0.020 |
| shot selection (placebo) | FG total T-60 | 21,039 | 48 51 51 51 48 51 52 51 51 52 | +0.015 |
| shot selection (placebo) | 1H spread | 16,635 | 50 47 50 50 49 46 48 50 48 49 | -0.003 |
| shot selection (placebo) | 1H total | 16,661 | 48 50 50 48 48 50 49 49 50 51 | +0.009 |
| shot selection (placebo) | team total HOME | 16,033 | 49 51 50 53 48 50 52 50 51 52 | +0.010 |
| shot selection (placebo) | team total AWAY | 16,023 | 52 52 52 51 51 50 52 49 52 52 | -0.002 |

## 2. The bet — fade the hotter side, top 20% of |differential|

`base` is the max-side rate INSIDE the selection, never 50%. Breakeven at -110 is 52.4%.

| signal | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| player heat | FG spread OPEN | 3,638 | 52.7 | 50.5 | **+2.2** | +0.7 | 0.004 | 23:53 24:52 25:52 26:54 |
| player heat | FG spread T-60 | 3,629 | 51.8 | 50.3 | **+1.5** | -1.1 | 0.041 | 23:53 24:51 25:50 26:54 |
| player heat | FG total OPEN | 3,648 | 51.7 | 51.9 | **-0.2** | -1.3 | 0.623 | 23:52 24:53 25:52 26:51 |
| player heat | FG total T-60 | 3,649 | 51.3 | 51.2 | **+0.1** | -2.1 | 0.483 | 23:52 24:52 25:51 26:50 |
| player heat | 1H spread | 2,980 | 52.3 | 51.2 | **+1.1** | -0.7 | 0.109 | 24:50 25:53 26:54 |
| player heat | 1H total | 2,985 | 50.2 | 50.5 | **-0.3** | -5.0 | 0.631 | 24:50 25:51 26:50 |
| player heat | team total HOME | 2,899 | 52.1 | 51.0 | **+1.1** | -2.0 | 0.120 | 24:51 25:52 26:53 |
| player heat | team total AWAY | 2,898 | 50.2 | 52.3 | **-2.0** | -5.4 | 0.987 | 24:53 25:50 26:47 |

| NO own-baseline (ctrl) | FG spread OPEN | 3,638 | 52.5 | 50.6 | **+1.8** | +0.2 | 0.014 | 23:52 24:52 25:51 26:55 |
| NO own-baseline (ctrl) | FG spread T-60 | 3,629 | 52.1 | 50.8 | **+1.3** | -0.6 | 0.062 | 23:52 24:51 25:51 26:54 |
| NO own-baseline (ctrl) | FG total OPEN | 3,648 | 50.5 | 52.3 | **-1.8** | -3.7 | 0.987 | 23:51 24:50 25:50 26:51 |
| NO own-baseline (ctrl) | FG total T-60 | 3,649 | 50.2 | 52.0 | **-1.8** | -4.2 | 0.989 | 23:50 24:51 25:50 26:49 |
| NO own-baseline (ctrl) | 1H spread | 2,980 | 51.4 | 51.1 | **+0.3** | -2.4 | 0.378 | 24:50 25:51 26:53 |
| NO own-baseline (ctrl) | 1H total | 2,985 | 48.7 | 50.3 | **-1.6** | -7.8 | 0.959 | 24:50 25:49 26:47 |
| NO own-baseline (ctrl) | team total HOME | 2,899 | 50.9 | 51.1 | **-0.2** | -4.2 | 0.595 | 24:52 25:50 26:51 |
| NO own-baseline (ctrl) | team total AWAY | 2,898 | 48.7 | 52.2 | **-3.5** | -8.4 | 1.000 | 24:52 25:48 26:47 |

| team aggregate (ctrl) | FG spread OPEN | 4,338 | 52.4 | 51.3 | **+1.1** | +0.1 | 0.074 | 23:52 24:52 25:51 26:55 |
| team aggregate (ctrl) | FG spread T-60 | 4,327 | 52.0 | 50.9 | **+1.0** | -0.8 | 0.088 | 23:51 24:52 25:50 26:54 |
| team aggregate (ctrl) | FG total OPEN | 4,351 | 50.7 | 52.5 | **-1.7** | -3.2 | 0.991 | 23:51 24:51 25:50 26:50 |
| team aggregate (ctrl) | FG total T-60 | 4,352 | 50.5 | 52.5 | **-2.0** | -3.6 | 0.996 | 23:51 24:51 25:50 26:50 |
| team aggregate (ctrl) | 1H spread | 3,337 | 51.4 | 50.8 | **+0.6** | -2.4 | 0.240 | 24:50 25:51 26:53 |
| team aggregate (ctrl) | 1H total | 3,342 | 49.3 | 51.2 | **-1.9** | -6.6 | 0.986 | 24:49 25:49 26:49 |
| team aggregate (ctrl) | team total HOME | 3,215 | 50.0 | 51.9 | **-1.8** | -6.0 | 0.981 | 24:51 25:49 26:50 |
| team aggregate (ctrl) | team total AWAY | 3,213 | 48.9 | 52.6 | **-3.7** | -8.0 | 1.000 | 24:51 25:48 26:48 |

| shot selection (placebo) | FG spread OPEN | 4,195 | 49.6 | 50.7 | **-1.1** | -5.3 | 0.927 | 23:49 24:50 25:50 26:49 |
| shot selection (placebo) | FG spread T-60 | 4,186 | 49.5 | 50.4 | **-0.9** | -5.4 | 0.876 | 23:50 24:49 25:50 26:49 |
| shot selection (placebo) | FG total OPEN | 4,208 | 48.0 | 50.0 | **-2.1** | -8.4 | 0.997 | 23:47 24:49 25:47 26:49 |
| shot selection (placebo) | FG total T-60 | 4,208 | 48.1 | 50.1 | **-2.0** | -8.3 | 0.996 | 23:46 24:50 25:46 26:50 |
| shot selection (placebo) | 1H spread | 3,327 | 50.6 | 50.4 | **+0.2** | -4.1 | 0.409 | 24:51 25:49 26:52 |
| shot selection (placebo) | 1H total | 3,333 | 48.6 | 50.6 | **-2.0** | -8.0 | 0.990 | 24:50 25:48 26:48 |
| shot selection (placebo) | team total HOME | 3,207 | 48.3 | 50.4 | **-2.0** | -9.1 | 0.991 | 24:49 25:49 26:48 |
| shot selection (placebo) | team total AWAY | 3,205 | 50.2 | 51.5 | **-1.4** | -5.5 | 0.942 | 24:50 25:49 26:51 |

## 3. P2 — concentrated heat vs diffuse heat

Same rule, split by how much of the hot side's heat sits in one player (HHI of the driving team). If the concentrated third does not beat the diffuse third, going to player level bought nothing over the team aggregate.

| signal | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| heat, CONCENTRATED third | FG spread OPEN | 1,151 | 54.3 | 50.4 | **+3.9** | +3.7 | 0.005 | 23:54 24:54 25:53 26:56 |
| heat, CONCENTRATED third | FG spread T-60 | 1,148 | 52.7 | 50.3 | **+2.4** | +0.7 | 0.053 | 23:52 24:52 25:51 26:56 |
| heat, CONCENTRATED third | FG total OPEN | 1,156 | 52.5 | 54.0 | **-1.5** | +0.2 | 0.848 | 23:51 24:55 25:54 26:49 |
| heat, CONCENTRATED third | FG total T-60 | 1,155 | 52.2 | 53.2 | **-1.0** | -0.3 | 0.756 | 23:51 24:55 25:54 26:48 |
| heat, CONCENTRATED third | 1H spread | 901 | 49.7 | 50.4 | **-0.7** | -5.7 | 0.662 | 24:46 25:52 26:52 |
| heat, CONCENTRATED third | 1H total | 904 | 50.1 | 53.4 | **-3.3** | -5.1 | 0.979 | 24:50 25:51 26:49 |
| heat, CONCENTRATED third | team total HOME | 872 | 52.2 | 54.5 | **-2.3** | -1.9 | 0.917 | 24:53 25:52 26:52 |
| heat, CONCENTRATED third | team total AWAY | 871 | 50.4 | 55.8 | **-5.4** | -5.0 | 0.999 | 24:55 25:49 26:47 |

| heat, DIFFUSE third | FG spread OPEN | 1,197 | 51.4 | 51.0 | **+0.4** | -1.9 | 0.398 | 23:50 24:52 25:49 26:54 |
| heat, DIFFUSE third | FG spread T-60 | 1,195 | 51.1 | 51.1 | **+0.0** | -2.4 | 0.511 | 23:50 24:52 25:48 26:54 |
| heat, DIFFUSE third | FG total OPEN | 1,198 | 51.4 | 50.3 | **+1.1** | -1.8 | 0.234 | 23:57 24:51 25:52 26:48 |
| heat, DIFFUSE third | FG total T-60 | 1,199 | 51.0 | 50.2 | **+0.8** | -2.5 | 0.287 | 23:58 24:51 25:51 26:48 |
| heat, DIFFUSE third | 1H spread | 1,030 | 53.2 | 53.3 | **-0.1** | +0.9 | 0.537 | 24:52 25:52 26:55 |
| heat, DIFFUSE third | 1H total | 1,031 | 48.3 | 51.2 | **-2.9** | -8.6 | 0.971 | 24:46 25:53 26:46 |
| heat, DIFFUSE third | team total HOME | 1,011 | 52.2 | 51.9 | **+0.3** | -1.7 | 0.438 | 24:49 25:53 26:54 |
| heat, DIFFUSE third | team total AWAY | 1,010 | 49.2 | 51.1 | **-1.9** | -7.3 | 0.892 | 24:52 25:53 26:43 |

## 4. Multiplicity

32 cells were tested in section 2 (4 signals x 8 markets). Best real-heat edge: **+2.23** (FG spread OPEN). Read every p above against that, not against .05.

