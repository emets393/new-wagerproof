# NCAAB heat — refinements

Fade the hotter side, top 20% of |differential|, timing-filtered. `base` is the max-side rate inside each selection.

## R1 — is the hot side being FED, or creating it himself?

Split on the driving side's assisted-share drift (recent share of makes assisted, minus his own baseline). Pre-registered: fade harder when the share is RISING.

| slice | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| assisted share RISING | FG spread OPEN | 1,192 | 51.2 | 50.2 | **+1.0** | -2.3 | 0.251 | 23:56 24:49 25:47 26:54 |
| assisted share RISING | FG spread T-60 | 1,187 | 50.2 | 50.0 | **+0.2** | -4.1 | 0.466 | 23:56 24:49 25:45 26:53 |
| assisted share RISING | FG total OPEN | 1,191 | 49.9 | 53.2 | **-3.4** | -4.8 | 0.990 | 23:48 24:52 25:47 26:52 |
| assisted share RISING | FG total T-60 | 1,193 | 49.0 | 52.6 | **-3.6** | -6.4 | 0.994 | 23:48 24:51 25:46 26:51 |

| assisted share FALLING | FG spread OPEN | 1,177 | 53.2 | 50.7 | **+2.5** | +1.6 | 0.048 | 23:53 24:52 25:56 26:52 |
| assisted share FALLING | FG spread T-60 | 1,177 | 52.4 | 51.1 | **+1.4** | +0.1 | 0.188 | 23:52 24:51 25:55 26:52 |
| assisted share FALLING | FG total OPEN | 1,183 | 53.7 | 51.5 | **+2.2** | +2.5 | 0.069 | 23:56 24:56 25:54 26:49 |
| assisted share FALLING | FG total T-60 | 1,183 | 53.5 | 51.5 | **+2.0** | +2.2 | 0.082 | 23:56 24:56 25:54 26:49 |

## R2 — season phase (games played by the less-established team)

| slice | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| early (< 12 gp) | FG spread OPEN | 1,041 | 51.5 | 50.2 | **+1.2** | -1.7 | 0.219 | 24:51 25:50 26:54 |
| early (< 12 gp) | FG spread T-60 | 1,036 | 50.8 | 50.2 | **+0.6** | -3.0 | 0.366 | 24:49 25:49 26:54 |
| early (< 12 gp) | FG total OPEN | 1,043 | 49.5 | 50.4 | **-1.0** | -5.6 | 0.745 | 24:53 25:49 26:47 |
| early (< 12 gp) | FG total T-60 | 1,043 | 49.3 | 50.5 | **-1.2** | -5.9 | 0.800 | 24:53 25:49 26:47 |

| mid (12-21 gp) | FG spread OPEN | 1,390 | 54.2 | 53.2 | **+1.1** | +3.6 | 0.216 | 23:57 24:53 25:53 26:54 |
| mid (12-21 gp) | FG spread T-60 | 1,387 | 53.5 | 53.0 | **+0.5** | +2.2 | 0.358 | 23:56 24:52 25:53 26:53 |
| mid (12-21 gp) | FG total OPEN | 1,397 | 52.0 | 51.9 | **+0.1** | -0.8 | 0.485 | 23:52 24:50 25:53 26:53 |
| mid (12-21 gp) | FG total T-60 | 1,396 | 52.3 | 50.9 | **+1.4** | -0.2 | 0.162 | 23:52 24:50 25:53 26:54 |

| late (22+ gp) | FG spread OPEN | 1,104 | 50.7 | 50.7 | **+0.0** | -3.1 | 0.505 | 23:49 24:50 25:51 26:52 |
| late (22+ gp) | FG spread T-60 | 1,103 | 50.0 | 51.0 | **-0.9** | -4.4 | 0.743 | 23:49 24:51 25:48 26:52 |
| late (22+ gp) | FG total OPEN | 1,104 | 52.1 | 52.4 | **-0.4** | -0.6 | 0.609 | 23:54 24:52 25:52 26:50 |
| late (22+ gp) | FG total T-60 | 1,107 | 51.4 | 52.5 | **-1.1** | -1.9 | 0.775 | 23:54 24:52 25:52 26:48 |

