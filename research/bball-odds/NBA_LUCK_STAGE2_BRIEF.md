# NBA team luck — stage 2: gradients, composites, phase, unpriced residual

5,278 games. Composites are season-z-scored averages of the whole luck family, not single features. Positive = the HOME team (or, for totals, BOTH teams) has been lucky and is due to give it back.

## 1. The gradient test — does covering DECLINE as luck rises?

Raw home-cover% (or over%) by decile of the composite, lucky-est on the right. A real regression effect slopes DOWN across all ten. `r` is the correlation between decile and outcome; `p` permutes outcomes 400x. One test per row, not ten.

IGNORE THE MONEYLINE ROW. Its outcome is the raw margin with no line subtracted, so a rising gradient there says only that teams which have been winning keep winning — true, fully priced, and not a signal. Every other row is graded against an actual number, which is what makes a slope meaningful.

### results luck (10-game window)

| market | decile 1 → 10 cover/over % | r | p | n |
|---|---|---|---|---|
| FG spread OPEN | 49 51 52 50 52 47 52 51 48 48 | -0.014 | 0.285 | 5,052 |
| FG spread T-60 | 49 52 53 50 52 47 53 52 48 47 | -0.018 | 0.182 | 5,035 |
| FG moneyline | 48 51 53 54 55 53 56 61 61 64 | +0.093 | 0.000 | 5,121 |
| FG total | 49 50 48 55 52 49 51 53 51 50 | +0.012 | 0.417 | 5,034 |
| 1H spread | 45 51 52 49 53 48 54 52 46 48 | +0.001 | 0.975 | 3,866 |
| 1H total | 51 50 50 53 52 48 49 50 48 50 | -0.011 | 0.490 | 3,870 |
| team total HOME | 48 49 50 49 54 50 55 50 47 54 | +0.016 | 0.333 | 3,900 |
| team total AWAY | 51 50 49 51 53 52 52 50 51 54 | +0.012 | 0.470 | 3,903 |

### shooting luck (10-game window)

| market | decile 1 → 10 cover/over % | r | p | n |
|---|---|---|---|---|
| FG spread OPEN | 45 50 55 52 47 52 53 49 45 52 | +0.003 | 0.850 | 4,980 |
| FG spread T-60 | 45 51 56 53 48 52 53 50 46 51 | -0.002 | 0.875 | 4,962 |
| FG moneyline | 41 48 55 55 54 57 60 58 60 68 | +0.126 | 0.000 | 5,047 |
| FG total | 51 54 48 52 52 53 51 52 48 46 | -0.025 | 0.075 | 4,961 |
| 1H spread | 47 49 51 53 48 51 54 48 47 49 | -0.002 | 0.858 | 3,866 |
| 1H total | 51 51 52 50 52 53 50 52 50 41 | -0.032 | 0.033 | 3,870 |
| team total HOME | 49 47 56 50 48 53 55 52 49 48 | +0.003 | 0.825 | 3,900 |
| team total AWAY | 55 52 52 46 51 53 52 51 50 49 | -0.020 | 0.220 | 3,903 |

### all luck (10-game window)

| market | decile 1 → 10 cover/over % | r | p | n |
|---|---|---|---|---|
| FG spread OPEN | 50 47 54 52 52 49 50 51 49 49 | -0.005 | 0.748 | 5,052 |
| FG spread T-60 | 50 48 55 52 53 50 48 51 50 48 | -0.009 | 0.487 | 5,035 |
| FG moneyline | 44 46 53 56 57 54 54 60 64 68 | +0.126 | 0.000 | 5,121 |
| FG total | 53 47 53 53 51 52 49 51 52 47 | -0.015 | 0.240 | 5,034 |
| 1H spread | 48 42 54 56 53 51 46 48 51 48 | -0.002 | 0.902 | 3,866 |
| 1H total | 51 52 53 53 50 56 46 52 43 48 | -0.036 | 0.033 | 3,870 |
| team total HOME | 53 42 49 55 54 50 49 53 52 48 | +0.008 | 0.580 | 3,900 |
| team total AWAY | 53 54 47 52 50 55 52 51 46 53 | -0.012 | 0.517 | 3,903 |

### RATE control (10-game window)

| market | decile 1 → 10 cover/over % | r | p | n |
|---|---|---|---|---|
| FG spread OPEN | 50 51 50 56 50 46 51 51 48 47 | -0.024 | 0.065 | 4,980 |
| FG spread T-60 | 53 51 50 57 49 47 51 51 49 47 | -0.026 | 0.080 | 4,962 |
| FG moneyline | 53 55 56 59 54 50 56 57 57 58 | +0.018 | 0.185 | 5,047 |
| FG total | 51 52 49 50 48 49 55 53 50 51 | +0.009 | 0.565 | 4,961 |
| 1H spread | 52 54 51 50 46 46 50 48 50 49 | -0.024 | 0.128 | 3,866 |
| 1H total | 52 52 48 50 50 51 52 51 46 50 | -0.014 | 0.398 | 3,870 |
| team total HOME | 54 53 54 50 47 50 53 52 47 46 | -0.037 | 0.028 | 3,900 |
| team total AWAY | 51 51 57 48 48 56 51 49 49 52 | -0.011 | 0.500 | 3,903 |

## 2. Betting the tails (fade the lucky side)

| composite | w | market | n | win % | base % | edge | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| shooting luck | 10 | FG total | 1637 | 53.1 | 50.1 | **+3.0** | +1.4 | 23:57 24:53 25:52 26:51 |
| all luck | 10 | 1H total | 1277 | 53.4 | 50.5 | **+2.9** | +1.9 | 24:51 25:54 26:55 |
| RATE control | 10 | team total HOME | 1287 | 52.8 | 50.1 | **+2.7** | +0.3 | 24:53 25:51 26:55 |
| RATE control | 5 | FG spread OPEN | 1644 | 53.0 | 50.5 | **+2.5** | +1.3 | 23:52 24:53 25:53 26:54 |
| RATE control | 5 | team total HOME | 1287 | 53.3 | 51.4 | **+1.9** | +1.1 | 24:52 25:52 26:56 |
| all luck | 5 | FG total | 1687 | 52.0 | 50.1 | **+1.9** | -0.6 | 23:51 24:52 25:51 26:54 |
| RATE control | 5 | FG spread T-60 | 1638 | 53.2 | 51.3 | **+1.9** | +1.5 | 23:52 24:52 25:54 26:53 |
| shooting luck | 5 | 1H spread | 1276 | 51.7 | 50.2 | **+1.5** | -1.3 | 24:56 25:50 26:49 |
| all luck | 10 | FG total | 1661 | 51.7 | 50.2 | **+1.4** | -1.4 | 23:54 24:49 25:51 26:53 |
| RATE control | 10 | FG spread T-60 | 1638 | 51.8 | 50.7 | **+1.1** | -1.0 | 23:51 24:53 25:51 26:52 |
| RATE control | 5 | 1H spread | 1276 | 52.2 | 51.1 | **+1.1** | -0.5 | 24:54 25:51 26:51 |
| results luck | 5 | 1H total | 1277 | 51.8 | 50.7 | **+1.1** | -1.0 | 24:53 25:51 26:52 |
| shooting luck | 10 | team total AWAY | 1288 | 51.6 | 50.5 | **+1.1** | -2.2 | 24:51 25:49 26:55 |
| results luck | 10 | 1H total | 1277 | 50.9 | 50.2 | **+0.7** | -2.8 | 24:51 25:50 26:52 |
| shooting luck | 5 | team total HOME | 1287 | 51.0 | 50.3 | **+0.6** | -3.4 | 24:52 25:48 26:53 |
| all luck | 5 | team total HOME | 1287 | 51.0 | 50.6 | **+0.5** | -3.4 | 24:50 25:49 26:54 |
| RATE control | 10 | 1H spread | 1276 | 51.8 | 51.4 | **+0.4** | -1.2 | 24:55 25:50 26:50 |
| shooting luck | 5 | team total AWAY | 1288 | 52.4 | 52.0 | **+0.4** | -0.8 | 24:51 25:50 26:55 |
| results luck | 5 | team total HOME | 1287 | 50.7 | 50.3 | **+0.3** | -4.1 | 24:50 25:48 26:54 |
| results luck | 10 | FG spread T-60 | 1662 | 51.3 | 51.0 | **+0.3** | -2.1 | 23:53 24:51 25:50 26:51 |
| all luck | 5 | 1H spread | 1276 | 50.9 | 50.6 | **+0.2** | -2.9 | 24:54 25:50 26:49 |
| RATE control | 10 | 1H total | 1277 | 50.7 | 50.6 | **+0.2** | -3.2 | 24:54 25:50 26:48 |
| results luck | 5 | FG total | 1687 | 50.2 | 50.1 | **+0.1** | -4.1 | 23:51 24:52 25:47 26:51 |
| results luck | 10 | FG spread OPEN | 1667 | 51.0 | 50.9 | **+0.1** | -2.6 | 23:53 24:50 25:49 26:52 |

## 3. Season phase — the owner's standing instruction, stop pooling

`early` = both teams under 25 games played, `mid` 25-54, `late` 55+. Same composite, same fade rule, split three ways.

| composite | market | phase | n | win % | base % | edge | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| all luck | FG total | late | 632 | 54.0 | 50.2 | **+3.8** | +3.0 | 23:51 24:52 25:55 26:58 |
| shooting luck | FG total | late | 632 | 53.8 | 50.2 | **+3.6** | +2.7 | 23:57 24:51 25:56 26:50 |
| results luck | 1H total | late | 470 | 52.8 | 50.4 | **+2.3** | +0.7 | 24:53 25:55 26:50 |
| all luck | 1H total | late | 470 | 56.2 | 54.3 | **+1.9** | +7.2 | 24:49 25:63 26:56 |
| RATE control | FG spread T-60 | late | 632 | 52.2 | 50.3 | **+1.9** | -0.3 | 23:52 24:54 25:50 26:52 |
| shooting luck | team total AWAY | early | 370 | 53.0 | 51.1 | **+1.9** | +0.2 | 24:56 25:50 26:53 |
| all luck | FG spread OPEN | mid | 586 | 52.0 | 50.7 | **+1.4** | -0.6 | 23:52 24:43 25:52 26:62 |
| RATE control | team total AWAY | early | 370 | 51.6 | 50.3 | **+1.4** | -2.4 | 24:53 25:52 26:49 |
| results luck | FG total | late | 632 | 51.9 | 50.6 | **+1.3** | -0.9 | 23:47 24:55 25:50 26:55 |
| RATE control | FG spread OPEN | early | 424 | 52.6 | 51.4 | **+1.2** | +0.4 | 23:45 24:55 25:48 26:59 |
| all luck | 1H total | mid | 440 | 52.7 | 51.6 | **+1.1** | +0.6 | 24:50 25:52 26:57 |
| all luck | team total AWAY | mid | 444 | 51.8 | 50.7 | **+1.1** | -1.9 | 24:51 25:48 26:57 |
| all luck | team total AWAY | early | 370 | 51.9 | 50.8 | **+1.1** | -2.1 | 24:56 25:47 26:53 |
| shooting luck | FG total | mid | 590 | 53.4 | 52.5 | **+0.8** | +1.9 | 23:58 24:55 25:48 26:52 |
| RATE control | 1H total | mid | 440 | 51.6 | 50.9 | **+0.7** | -1.5 | 24:56 25:53 26:47 |
| RATE control | team total HOME | late | 475 | 52.6 | 52.0 | **+0.6** | -0.2 | 24:54 25:53 26:51 |
| RATE control | FG spread OPEN | late | 634 | 52.2 | 51.6 | **+0.6** | -0.3 | 23:53 24:52 25:49 26:54 |
| results luck | 1H spread | early | 367 | 52.9 | 52.3 | **+0.5** | +0.9 | 24:53 25:58 26:48 |
| RATE control | 1H spread | early | 367 | 54.2 | 53.7 | **+0.5** | +3.4 | 24:58 25:50 26:56 |
| shooting luck | FG spread T-60 | mid | 585 | 50.8 | 50.3 | **+0.5** | -3.1 | 23:52 24:46 25:50 26:55 |
| RATE control | FG spread T-60 | early | 421 | 53.2 | 52.7 | **+0.5** | +1.6 | 23:42 24:56 25:51 26:58 |
| all luck | FG spread T-60 | mid | 585 | 51.6 | 51.3 | **+0.3** | -1.4 | 23:55 24:44 25:49 26:59 |
| shooting luck | FG spread OPEN | mid | 586 | 50.9 | 50.5 | **+0.3** | -2.9 | 23:48 24:44 25:53 26:58 |
| shooting luck | FG total | early | 416 | 52.2 | 51.9 | **+0.2** | -0.4 | 24:52 25:52 26:52 |

## 4. Luck the market did NOT price

The composite regressed on the closing number and the open→close move, then the residual bet. If raw luck ever looked live only because lucky teams are good teams, this row is where it dies; if the market genuinely under-adjusts, this is where the edge concentrates.

| composite | market | n | win % | base % | edge | ROI % | by season |
|---|---|---|---|---|---|---|---|
| all luck | 1H total | 1277 | 53.2 | 50.4 | **+2.8** | +1.5 | 24:52 25:53 26:54 |
| RATE control | team total HOME | 1287 | 52.9 | 50.2 | **+2.7** | +0.4 | 24:53 25:51 26:55 |
| shooting luck | 1H total | 1277 | 52.5 | 51.1 | **+1.4** | +0.3 | 24:55 25:51 26:52 |
| shooting luck | FG total | 1637 | 51.3 | 50.0 | **+1.3** | -2.0 | 23:55 24:49 25:50 26:52 |
| RATE control | FG spread T-60 | 1638 | 51.8 | 50.7 | **+1.2** | -1.0 | 23:52 24:53 25:51 26:52 |
| results luck | 1H total | 1277 | 51.2 | 50.3 | **+0.9** | -2.2 | 24:52 25:50 26:52 |
| results luck | FG spread T-60 | 1662 | 51.4 | 50.5 | **+0.9** | -1.8 | 23:54 24:52 25:50 26:50 |
| all luck | FG total | 1661 | 50.9 | 50.1 | **+0.8** | -2.9 | 23:53 24:49 25:49 26:53 |
| shooting luck | team total AWAY | 1288 | 51.4 | 50.6 | **+0.8** | -2.6 | 24:50 25:49 26:54 |
| results luck | FG spread OPEN | 1667 | 51.2 | 50.5 | **+0.7** | -2.3 | 23:54 24:52 25:48 26:51 |
| RATE control | 1H total | 1277 | 50.8 | 50.2 | **+0.6** | -3.0 | 24:54 25:50 26:49 |
| RATE control | 1H spread | 1276 | 51.6 | 51.3 | **+0.3** | -1.6 | 24:55 25:49 26:50 |
| RATE control | FG spread OPEN | 1643 | 51.6 | 51.5 | **+0.1** | -1.5 | 23:52 24:51 25:50 26:54 |
| results luck | FG total | 1661 | 50.2 | 50.1 | **+0.1** | -4.3 | 23:50 24:53 25:46 26:52 |
| all luck | FG spread T-60 | 1662 | 51.0 | 51.3 | **-0.3** | -2.7 | 23:54 24:51 25:49 26:50 |
| RATE control | team total AWAY | 1288 | 50.5 | 50.9 | **-0.3** | -4.3 | 24:50 25:49 26:53 |
| shooting luck | 1H spread | 1276 | 50.4 | 50.7 | **-0.3** | -3.9 | 24:56 25:49 26:46 |
| all luck | FG spread OPEN | 1667 | 50.9 | 51.3 | **-0.4** | -2.8 | 23:54 24:51 25:48 26:51 |
| shooting luck | FG spread T-60 | 1638 | 50.1 | 51.1 | **-1.0** | -4.4 | 23:54 24:52 25:49 26:46 |
| RATE control | FG total | 1637 | 49.9 | 50.9 | **-1.0** | -4.7 | 23:53 24:49 25:48 26:50 |

