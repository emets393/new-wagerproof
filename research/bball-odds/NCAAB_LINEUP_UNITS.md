# NCAAB five-man units — unit quality, depth drop-off and rotation churn

Last unported idea from the NBA program. `lineups_ncaab` carries per-unit off/def/net ratings and pace; the availability study only used its seconds column. Every measure is averaged over the team's STRICTLY PRIOR games (8-game window, min 3), z-scored within season, and read as a home-minus-away differential.

`pace_sd` and `top_share` are PLACEBOS -- coaching style, no mechanism for beating a closing line. `net_w` is the wiring CONTROL: it is roughly team strength and should be priced. Lineups start in 2023-24, so this is three seasons.

## Gradient test (primary) — decile cover % of the POSITIVE side, low to high

| measure | market | n | deciles | r |
|---|---|---|---|---|
| net_w | FG spread OPEN | 14,820 | 50 51 49 50 50 50 51 48 50 52 | **+0.005** |
| net_w | FG spread T-60 | 14,780 | 50 49 49 50 50 50 51 48 49 51 | **+0.001** |
| net_w | FG total OPEN | 14,837 | 51 49 49 52 54 51 51 49 49 49 | **-0.006** |
| net_w | FG total T-60 | 14,860 | 51 49 49 53 53 50 52 48 48 50 | **-0.006** |
| net_w | 1H spread | 14,721 | 49 49 48 49 47 50 51 46 47 49 | **-0.002** |
| net_w | 1H total | 14,744 | 51 47 48 52 52 49 50 47 48 48 | **-0.009** |
| net_w | team total HOME | 14,433 | 51 50 48 52 52 51 53 50 49 51 | **+0.004** |
| net_w | team total AWAY | 14,423 | 54 49 51 54 53 50 52 52 50 49 | **-0.014** |

| drop | FG spread OPEN | 14,820 | 51 50 50 51 50 51 47 51 50 48 | **-0.010** |
| drop | FG spread T-60 | 14,780 | 50 49 49 51 51 50 48 51 50 48 | **-0.011** |
| drop | FG total OPEN | 14,837 | 48 49 51 49 51 50 51 52 53 51 | **+0.023** |
| drop | FG total T-60 | 14,860 | 48 48 51 49 50 50 50 52 53 51 | **+0.024** |
| drop | 1H spread | 14,721 | 50 48 49 50 47 50 49 48 47 49 | **-0.007** |
| drop | 1H total | 14,744 | 49 49 50 49 49 50 48 51 49 48 | **-0.001** |
| drop | team total HOME | 14,433 | 50 50 50 50 50 51 51 53 52 49 | **+0.004** |
| drop | team total AWAY | 14,423 | 51 53 50 50 50 51 53 52 52 52 | **+0.014** |

| net_sd | FG spread OPEN | 14,820 | 49 46 51 50 49 50 50 51 51 52 | **+0.026** |
| net_sd | FG spread T-60 | 14,780 | 49 47 51 51 49 50 49 50 50 51 | **+0.017** |
| net_sd | FG total OPEN | 14,837 | 51 50 48 50 51 52 50 50 51 52 | **+0.009** |
| net_sd | FG total T-60 | 14,860 | 51 50 49 50 51 51 50 50 51 52 | **+0.007** |
| net_sd | 1H spread | 14,721 | 47 46 50 50 48 49 48 49 51 49 | **+0.019** |
| net_sd | 1H total | 14,744 | 51 50 47 49 51 48 50 47 48 50 | **-0.008** |
| net_sd | team total HOME | 14,433 | 51 50 50 51 49 51 50 48 51 53 | **+0.012** |
| net_sd | team total AWAY | 14,423 | 53 52 50 51 52 51 52 51 51 52 | **-0.005** |

| hhi | FG spread OPEN | 14,822 | 51 50 50 51 51 52 50 49 47 49 | **-0.012** |
| hhi | FG spread T-60 | 14,782 | 49 49 50 50 51 52 49 49 48 50 | **-0.001** |
| hhi | FG total OPEN | 14,839 | 50 50 50 50 52 49 50 51 51 51 | **+0.010** |
| hhi | FG total T-60 | 14,862 | 50 50 49 50 52 49 49 51 51 51 | **+0.009** |
| hhi | 1H spread | 14,723 | 49 48 50 48 48 50 49 48 47 48 | **-0.004** |
| hhi | 1H total | 14,746 | 49 49 50 47 50 49 47 50 50 50 | **+0.003** |
| hhi | team total HOME | 14,435 | 51 50 49 51 53 51 50 50 50 51 | **-0.001** |
| hhi | team total AWAY | 14,425 | 51 53 51 51 52 49 51 51 52 53 | **+0.006** |

| n_units | FG spread OPEN | 14,822 | 49 49 49 50 49 50 50 50 52 51 | **+0.006** |
| n_units | FG spread T-60 | 14,782 | 50 49 49 49 49 50 50 49 52 49 | **+0.003** |
| n_units | FG total OPEN | 14,839 | 50 51 50 49 50 49 51 53 51 50 | **+0.003** |
| n_units | FG total T-60 | 14,862 | 50 52 49 49 50 48 50 53 51 50 | **+0.006** |
| n_units | 1H spread | 14,723 | 48 49 50 48 47 49 47 49 51 49 | **-0.002** |
| n_units | 1H total | 14,746 | 49 49 50 48 50 47 48 49 51 49 | **+0.005** |
| n_units | team total HOME | 14,435 | 49 51 50 49 52 50 50 51 51 52 | **+0.010** |
| n_units | team total AWAY | 14,425 | 52 51 51 50 51 50 52 53 50 52 | **+0.002** |

| cont | FG spread OPEN | 14,237 | 49 48 53 49 50 50 50 49 51 50 | **+0.005** |
| cont | FG spread T-60 | 14,197 | 49 48 53 49 49 50 50 48 51 50 | **+0.005** |
| cont | FG total OPEN | 14,254 | 51 50 48 53 50 50 50 50 52 53 | **+0.006** |
| cont | FG total T-60 | 14,279 | 51 50 48 52 50 51 48 48 51 52 | **-0.003** |
| cont | 1H spread | 14,143 | 49 48 49 47 49 47 50 49 50 49 | **+0.006** |
| cont | 1H total | 14,160 | 48 47 49 49 48 49 50 50 50 52 | **+0.020** |
| cont | team total HOME | 13,938 | 51 51 50 51 48 53 49 49 52 51 | **+0.003** |
| cont | team total AWAY | 13,931 | 54 52 48 54 51 52 51 49 51 51 | **-0.012** |

| pace_sd (placebo) | FG spread OPEN | 14,820 | 50 50 49 49 50 49 50 51 51 52 | **+0.015** |
| pace_sd (placebo) | FG spread T-60 | 14,780 | 49 50 49 49 50 49 50 50 50 51 | **+0.011** |
| pace_sd (placebo) | FG total OPEN | 14,837 | 50 52 52 50 51 49 50 49 50 51 | **-0.001** |
| pace_sd (placebo) | FG total T-60 | 14,860 | 50 53 52 49 51 48 50 48 50 52 | **+0.001** |
| pace_sd (placebo) | 1H spread | 14,721 | 47 49 48 49 49 51 47 50 48 49 | **+0.010** |
| pace_sd (placebo) | 1H total | 14,744 | 49 51 49 49 50 48 50 48 49 48 | **-0.006** |
| pace_sd (placebo) | team total HOME | 14,433 | 51 53 52 48 52 49 49 49 50 52 | **-0.000** |
| pace_sd (placebo) | team total AWAY | 14,423 | 51 53 52 50 51 50 50 52 51 52 | **-0.003** |

| top_share (placebo) | FG spread OPEN | 14,822 | 50 51 50 51 50 51 49 50 48 50 | **-0.010** |
| top_share (placebo) | FG spread T-60 | 14,782 | 49 50 49 51 50 50 49 51 47 50 | **-0.001** |
| top_share (placebo) | FG total OPEN | 14,839 | 50 50 50 51 50 51 48 50 52 51 | **+0.008** |
| top_share (placebo) | FG total T-60 | 14,862 | 51 50 49 50 50 51 49 50 52 51 | **+0.007** |
| top_share (placebo) | 1H spread | 14,723 | 48 50 50 47 48 49 47 51 47 48 | **-0.005** |
| top_share (placebo) | 1H total | 14,746 | 50 50 48 49 49 47 49 50 48 51 | **-0.001** |
| top_share (placebo) | team total HOME | 14,435 | 51 50 51 51 50 51 49 51 50 50 | **-0.003** |
| top_share (placebo) | team total AWAY | 14,425 | 51 52 51 51 51 51 51 49 53 53 | **+0.004** |

## Walk-forward bets (direction and threshold from prior seasons only)

Top 30% of |differential|. The sign is LEARNED, not chosen -- if a measure only works in hindsight it cannot win here.

| measure | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| net_w | FG spread OPEN | 2,966 | 49.8 | 50.6 | **-0.9** | -4.9 | 0.834 | 25:48 26:51 |
| net_w | FG spread T-60 | 2,968 | 48.5 | 51.2 | **-2.8** | -7.4 | 0.999 | 25:48 26:49 |
| net_w | FG total OPEN | 2,972 | 49.7 | 50.6 | **-1.0** | -5.2 | 0.856 | 25:48 26:51 |
| net_w | FG total T-60 | 2,970 | 50.3 | 50.6 | **-0.3** | -4.0 | 0.654 | 25:49 26:52 |
| net_w | 1H spread | 2,949 | 48.6 | 51.7 | **-3.1** | -7.8 | 0.999 | 25:48 26:49 |
| net_w | 1H total | 2,937 | 51.2 | 51.2 | **+0.0** | -3.2 | 0.510 | 25:50 26:52 |
| net_w | team total HOME | 3,007 | 50.1 | 50.2 | **-0.1** | -5.8 | 0.555 | 25:51 26:49 |
| net_w | team total AWAY | 2,995 | 52.7 | 51.1 | **+1.6** | -0.9 | 0.045 | 25:53 26:52 |
| drop | FG spread OPEN | 2,911 | 50.5 | 50.0 | **+0.5** | -3.5 | 0.295 | 25:51 26:50 |
| drop | FG spread T-60 | 2,916 | 50.4 | 50.5 | **-0.1** | -3.8 | 0.546 | 25:52 26:49 |
| drop | FG total OPEN | 2,915 | 51.7 | 50.9 | **+0.8** | -1.3 | 0.194 | 25:51 26:52 |
| drop | FG total T-60 | 2,928 | 51.7 | 51.0 | **+0.7** | -1.3 | 0.234 | 25:51 26:52 |
| drop | 1H spread | 2,908 | 48.6 | 50.2 | **-1.6** | -7.9 | 0.957 | 25:49 26:48 |
| drop | 1H total | 2,906 | 50.2 | 52.1 | **-1.9** | -5.2 | 0.979 | 25:51 26:49 |
| drop | team total HOME | 2,930 | 49.5 | 50.1 | **-0.6** | -6.9 | 0.753 | 25:51 26:48 |
| drop | team total AWAY | 2,918 | 51.1 | 50.9 | **+0.2** | -4.0 | 0.427 | 25:52 26:51 |
| net_sd | FG spread OPEN | 3,001 | 51.6 | 51.5 | **+0.1** | -1.4 | 0.467 | 25:52 26:51 |
| net_sd | FG spread T-60 | 2,992 | 50.9 | 51.2 | **-0.4** | -2.8 | 0.657 | 25:51 26:51 |
| net_sd | FG total OPEN | 3,007 | 49.9 | 51.7 | **-1.8** | -4.8 | 0.976 | 25:50 26:50 |
| net_sd | FG total T-60 | 3,011 | 49.9 | 51.4 | **-1.5** | -4.8 | 0.957 | 25:50 26:50 |
| net_sd | 1H spread | 3,008 | 52.0 | 52.1 | **-0.1** | -1.5 | 0.566 | 25:52 26:52 |
| net_sd | 1H total | 2,997 | 48.7 | 50.1 | **-1.4** | -7.9 | 0.938 | 25:49 26:48 |
| net_sd | team total HOME | 3,031 | 50.4 | 51.0 | **-0.6** | -5.2 | 0.741 | 25:51 26:49 |
| net_sd | team total AWAY | 3,027 | 51.3 | 52.6 | **-1.3** | -3.5 | 0.929 | 25:52 26:50 |
| hhi | FG spread OPEN | 3,456 | 50.3 | 50.8 | **-0.4** | -3.8 | 0.696 | 25:51 26:50 |
| hhi | FG spread T-60 | 3,449 | 49.6 | 50.9 | **-1.3** | -5.3 | 0.939 | 25:50 26:49 |
| hhi | FG total OPEN | 3,464 | 50.3 | 50.1 | **+0.3** | -3.9 | 0.389 | 25:50 26:51 |
| hhi | FG total T-60 | 3,472 | 50.3 | 50.0 | **+0.3** | -3.9 | 0.357 | 25:50 26:51 |
| hhi | 1H spread | 3,449 | 49.2 | 51.4 | **-2.2** | -6.8 | 0.996 | 25:50 26:48 |
| hhi | 1H total | 3,437 | 48.9 | 50.6 | **-1.7** | -7.6 | 0.978 | 25:50 26:48 |
| hhi | team total HOME | 3,449 | 49.9 | 50.2 | **-0.3** | -6.1 | 0.652 | 25:51 26:49 |
| hhi | team total AWAY | 3,439 | 50.2 | 51.6 | **-1.4** | -5.5 | 0.953 | 25:51 26:50 |
| n_units | FG spread OPEN | 2,273 | 47.7 | 50.5 | **-2.8** | -8.9 | 0.997 | 25:48 26:48 |
| n_units | FG spread T-60 | 2,287 | 48.9 | 50.4 | **-1.5** | -6.6 | 0.927 | 25:49 26:50 |
| n_units | FG total OPEN | 2,277 | 49.9 | 50.5 | **-0.6** | -4.7 | 0.732 | 25:50 26:50 |
| n_units | FG total T-60 | 2,272 | 49.9 | 50.7 | **-0.7** | -4.7 | 0.768 | 25:50 26:53 |
| n_units | 1H spread | 2,244 | 47.9 | 50.2 | **-2.3** | -9.1 | 0.986 | 25:48 26:48 |
| n_units | 1H total | 2,260 | 49.0 | 51.1 | **-2.1** | -7.4 | 0.977 | 25:49 26:51 |
| n_units | team total HOME | 2,273 | 51.3 | 50.3 | **+1.0** | -3.6 | 0.176 | 25:52 26:48 |
| n_units | team total AWAY | 2,270 | 49.0 | 51.1 | **-2.1** | -7.9 | 0.979 | 25:49 26:45 |
| cont | FG spread OPEN | 2,967 | 50.8 | 51.1 | **-0.3** | -3.0 | 0.619 | 25:50 26:51 |
| cont | FG spread T-60 | 2,959 | 50.7 | 51.0 | **-0.3** | -3.1 | 0.632 | 25:51 26:51 |
| cont | FG total OPEN | 2,966 | 51.3 | 51.9 | **-0.6** | -2.1 | 0.741 | 25:52 26:51 |
| cont | FG total T-60 | 2,987 | 49.3 | 51.7 | **-2.4** | -5.8 | 0.996 | 25:49 26:50 |
| cont | 1H spread | 2,947 | 48.9 | 51.0 | **-2.1** | -7.4 | 0.991 | 25:49 26:48 |
| cont | 1H total | 2,942 | 52.2 | 50.8 | **+1.4** | -1.2 | 0.061 | 25:53 26:51 |
| cont | team total HOME | 2,961 | 50.0 | 51.7 | **-1.7** | -5.9 | 0.971 | 25:51 26:49 |
| cont | team total AWAY | 2,948 | 50.3 | 52.4 | **-2.1** | -5.3 | 0.989 | 25:49 26:51 |
| pace_sd (placebo) | FG spread OPEN | 3,022 | 50.3 | 50.8 | **-0.4** | -3.9 | 0.691 | 25:51 26:49 |
| pace_sd (placebo) | FG spread T-60 | 3,025 | 49.8 | 50.1 | **-0.3** | -4.8 | 0.634 | 25:51 26:49 |
| pace_sd (placebo) | FG total OPEN | 3,034 | 49.8 | 50.2 | **-0.4** | -4.9 | 0.677 | 25:51 26:49 |
| pace_sd (placebo) | FG total T-60 | 3,042 | 50.1 | 50.4 | **-0.3** | -4.4 | 0.642 | 25:51 26:49 |
| pace_sd (placebo) | 1H spread | 3,024 | 50.4 | 51.9 | **-1.5** | -4.4 | 0.952 | 25:50 26:51 |
| pace_sd (placebo) | 1H total | 3,020 | 48.2 | 51.6 | **-3.3** | -8.9 | 1.000 | 25:50 26:47 |
| pace_sd (placebo) | team total HOME | 3,026 | 49.8 | 50.5 | **-0.7** | -6.3 | 0.771 | 25:52 26:47 |
| pace_sd (placebo) | team total AWAY | 3,018 | 49.9 | 51.4 | **-1.4** | -6.1 | 0.941 | 25:51 26:49 |
| top_share (placebo) | FG spread OPEN | 3,118 | 50.6 | 50.7 | **-0.1** | -3.3 | 0.550 | 25:51 26:50 |
| top_share (placebo) | FG spread T-60 | 3,083 | 50.0 | 50.7 | **-0.7** | -4.5 | 0.798 | 25:50 26:50 |
| top_share (placebo) | FG total OPEN | 3,096 | 50.1 | 50.1 | **-0.0** | -4.4 | 0.524 | 25:49 26:51 |
| top_share (placebo) | FG total T-60 | 3,097 | 49.7 | 50.1 | **-0.4** | -5.2 | 0.690 | 25:49 26:50 |
| top_share (placebo) | 1H spread | 3,082 | 49.9 | 51.3 | **-1.3** | -5.3 | 0.930 | 25:51 26:48 |
| top_share (placebo) | 1H total | 3,076 | 50.1 | 51.1 | **-1.0** | -5.4 | 0.881 | 25:51 26:49 |
| top_share (placebo) | team total HOME | 3,103 | 50.0 | 50.2 | **-0.2** | -5.9 | 0.608 | 25:51 26:49 |
| top_share (placebo) | team total AWAY | 3,098 | 50.1 | 51.7 | **-1.6** | -5.7 | 0.966 | 25:51 26:50 |

## Read

Largest |r| among the REAL measures: **0.026**. Largest among the PLACEBOS: **0.015**. Same order of magnitude, which is the verdict: unit shape is not carrying information the market has missed.

**The control makes the null readable.** `net_w` is prior unit-weighted team strength, and its correlation with covering the closing spread is **0.001** on 14,780 games. That is not a broken join -- the panel is fully populated -- it is the market pricing team strength completely, exactly as it should. Everything else here is a second-order description of the same rotation, so there was never much room above it.

**No walk-forward row is profitable.** The best of the 64 is -0.9% ROI. The two largest real slopes (`net_sd` on the full-game spread, `drop` on totals) do not survive into a bet once the direction has to be learned from prior seasons rather than chosen after the fact.

Verdict: five-man unit quality, depth drop-off and rotation churn are PRICED in college basketball. The one thing `lineups_ncaab` is worth is what the availability work already took from it -- WHO IS MISSING, not how the minutes are shaped. See BBALL_SIGNALS.md S1/S6.
