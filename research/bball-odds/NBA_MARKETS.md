# NBA — every market on the repaired feature stack

> **SUPERSEDED 2026-08-01 — the frame is wrong, so every number below is.** Each market here is fit
> on ONE ROW PER GAME with `h_`/`a_` columns, and the two team totals are two SEPARATE models on
> disjoint columns. That estimates one relationship twice, manufacturing a home/away gap with no
> basketball cause. `MIN_TRAIN = 1500` also exceeds one NBA season, silently eating a third evaluable
> season the data actually has. Rebuilt on a team-game panel in **`NBA_PANEL_ALL.md`** (2 rows per
> game, `own_`/`opp_`, `is_home` a feature, one model, every market a transform of predicted points),
> where the **full-game total is the only survivor** and team totals, the spread, the moneyline and
> both 1H markets are negative. A second defect hits every number here too: training pooled all prior
> seasons with equal weight, which `NBA_PROVEN.md` §1d shows costs most of the total's edge (+0.3%
> ROI pooled vs +4.5% at a 180-day half-life). Kept for the record.

The full-game total is the only market that was ever rebuilt after the data repairs (college possessions joining at 0%, adjusted ratings with no intercept, a recency half-life in rows instead of days, usage concentration identified as the engine). The 1H models predate all four; team totals and the moneyline were never built at all. This runs one frame and one stack against all of them.

New here: a **derivative-market consistency** family (`mk_*`) — where the team totals, the 1H lines and the full-game spread/total disagree about the same game, one of them is stale. Ported from the NFL 1H/team-total work, never computed for the NBA before.

Baselines are each cell's own majority side, never 50%. Breakeven at −110 is 52.4%.

## 1. Headline — all six markets

| market | n games | cols | oos corr | bets | win% | base% | edge | ROI | null z (edge) |
|---|---|---|---|---|---|---|---|---|---|
| **full-game spread** | 5,108 | 724 | +0.0190 | 2298 | 49.3 | 51.0 | **-1.7** | -5.9 | -0.65 |
| **full-game total** | 5,108 | 724 | +0.0737 | 2435 | 53.0 | 50.6 | **+2.4** | +1.1 | +1.93 |
| **first-half spread** | 3,831 | 724 | +0.0067 | 1651 | 51.2 | 51.8 | **-0.7** | -2.3 | +0.57 |
| **first-half total** | 3,831 | 724 | +0.0252 | 1521 | 50.2 | 50.3 | **-0.1** | -4.1 | +2.34 |
| **home team total** | 3,831 | 724 | +0.0826 | 1528 | 53.3 | 50.6 | **+2.7** | +1.0 | +5.01 |
| **away team total** | 3,831 | 724 | +0.0570 | 1553 | 53.1 | 51.1 | **+1.9** | +0.9 | +3.16 |

## 2. Moneyline — the spread model read as a win probability

No separate fit: the ML carries the same margin distribution as the spread, so a sixth model here would just be a sixth chance to get lucky. The spread residual is added to the market's implied margin, converted with a normal of sd 13.2, and compared with the **no-vig** market probability. `edge` is in percentage points of win probability.

| prob edge ≥ | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2% | 2849 | 51.3 | 54.2 | **-2.9** | -4.1 |
| 4% | 2205 | 51.2 | 53.9 | **-2.7** | -3.0 |
| 6% | 1649 | 49.7 | 53.6 | **-3.9** | -4.6 |
| 8% | 1202 | 48.4 | 53.7 | **-5.3** | -5.1 |

## 3.fg_spread — full-game spread: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 3462 | 49.5 | 50.0 | **-0.5** | -5.4 |
| ≥0.5 | 3072 | 49.5 | 50.2 | **-0.7** | -5.4 |
| ≥1 | 2679 | 49.4 | 50.2 | **-0.8** | -5.7 |
| ≥1.5 | 2298 | 49.3 | 51.0 | **-1.7** | -5.9 |
| ≥2 | 1958 | 49.9 | 50.3 | **-0.4** | -4.6 |
| ≥3 | 1360 | 49.9 | 51.2 | **-1.2** | -4.7 |
| ≥4 | 891 | 49.5 | 51.1 | **-1.6** | -5.5 |

| phase (k=1.5) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 393 | 48.1 | 53.7 | **-5.6** | -8.1 |
| MID | 801 | 47.9 | 50.3 | **-2.4** | -8.5 |
| LATE | 925 | 50.2 | 50.3 | **-0.1** | -4.2 |
| POST | 179 | 53.1 | 54.2 | **-1.1** | +1.4 |

| season (k=1.5) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 646 | 46.7 | 51.5 | **-4.8** | -10.7 |
| 2024 | 847 | 51.2 | 51.0 | **+0.2** | -2.2 |
| 2025 | 805 | 49.2 | 52.9 | **-3.7** | -6.1 |

## 3.fg_total — full-game total: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 3481 | 52.5 | 50.4 | **+2.1** | +0.2 |
| ≥0.5 | 3191 | 52.5 | 50.4 | **+2.1** | +0.2 |
| ≥1 | 2911 | 53.0 | 50.7 | **+2.3** | +1.2 |
| ≥1.5 | 2675 | 52.9 | 50.7 | **+2.2** | +1.0 |
| ≥2 | 2435 | 53.0 | 50.6 | **+2.4** | +1.1 |
| ≥3 | 1924 | 53.0 | 50.6 | **+2.4** | +1.2 |
| ≥4 | 1482 | 53.3 | 51.8 | **+1.5** | +1.8 |

| phase (k=2) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 418 | 55.3 | 50.2 | **+5.0** | +5.5 |
| MID | 883 | 51.8 | 50.4 | **+1.4** | -1.2 |
| LATE | 974 | 53.7 | 52.2 | **+1.5** | +2.5 |
| POST | 160 | 49.4 | 52.5 | **-3.1** | -5.7 |

| season (k=2) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 688 | 50.3 | 51.9 | **-1.6** | -4.0 |
| 2024 | 923 | 52.0 | 53.3 | **-1.3** | -0.7 |
| 2025 | 824 | 56.3 | 50.4 | **+5.9** | +7.5 |

## 3.h1_spread — first-half spread: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 2187 | 50.4 | 51.0 | **-0.5** | -3.7 |
| ≥0.5 | 1918 | 50.9 | 51.3 | **-0.4** | -2.8 |
| ≥1 | 1651 | 51.2 | 51.8 | **-0.7** | -2.3 |
| ≥1.5 | 1383 | 50.4 | 51.1 | **-0.7** | -3.8 |
| ≥2 | 1132 | 50.1 | 50.2 | **-0.1** | -4.4 |
| ≥3 | 728 | 49.9 | 51.1 | **-1.2** | -4.9 |
| ≥4 | 449 | 50.1 | 50.1 | **+0.0** | -4.4 |

| phase (k=1) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 208 | 50.0 | 52.4 | **-2.4** | -4.6 |
| MID | 623 | 49.6 | 53.6 | **-4.0** | -5.3 |
| LATE | 705 | 53.0 | 50.8 | **+2.3** | +1.3 |
| POST | 115 | 50.4 | 52.2 | **-1.7** | -3.9 |

| season (k=1) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 714 | 51.5 | 51.3 | **+0.3** | -1.5 |
| 2025 | 937 | 50.9 | 52.3 | **-1.4** | -2.9 |

## 3.h1_total — first-half total: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 2190 | 50.0 | 50.5 | **-0.4** | -4.5 |
| ≥0.5 | 1914 | 49.7 | 50.2 | **-0.4** | -5.1 |
| ≥1 | 1640 | 49.9 | 50.1 | **-0.1** | -4.7 |
| ≥1.5 | 1389 | 50.0 | 50.0 | **-0.1** | -4.6 |
| ≥2 | 1157 | 50.4 | 50.0 | **+0.3** | -3.8 |
| ≥3 | 736 | 50.0 | 51.1 | **-1.1** | -4.6 |
| ≥4 | 447 | 51.5 | 50.8 | **+0.7** | -1.8 |

| phase (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 208 | 53.8 | 51.0 | **+2.9** | +2.9 |
| MID | 567 | 49.9 | 50.6 | **-0.7** | -4.8 |
| LATE | 633 | 49.1 | 50.2 | **-1.1** | -6.2 |
| POST | 113 | 51.3 | 51.3 | **+0.0** | -2.1 |

| season (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 646 | 48.0 | 51.4 | **-3.4** | -8.4 |
| 2025 | 875 | 51.9 | 50.5 | **+1.4** | -0.9 |

## 3.tt_home — home team total: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 2208 | 52.8 | 50.5 | **+2.4** | +0.2 |
| ≥0.5 | 1940 | 53.1 | 50.2 | **+2.9** | +0.7 |
| ≥1 | 1661 | 53.6 | 50.2 | **+3.4** | +1.6 |
| ≥1.5 | 1394 | 53.6 | 50.6 | **+2.9** | +1.6 |
| ≥2 | 1163 | 53.7 | 50.6 | **+3.1** | +1.7 |
| ≥3 | 766 | 54.7 | 50.1 | **+4.6** | +3.7 |
| ≥4 | 474 | 57.2 | 50.4 | **+6.8** | +8.4 |

| phase (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 204 | 55.4 | 50.5 | **+4.9** | +5.2 |
| MID | 554 | 52.5 | 54.0 | **-1.4** | -0.4 |
| LATE | 650 | 52.5 | 51.4 | **+1.1** | -0.4 |
| POST | 120 | 57.5 | 52.5 | **+5.0** | +8.8 |

| season (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 644 | 52.0 | 53.3 | **-1.2** | -1.4 |
| 2025 | 884 | 54.2 | 51.4 | **+2.8** | +2.8 |

## 3.tt_away — away team total: threshold, phase and season

| k (pts) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 2207 | 51.4 | 50.7 | **+0.7** | -2.3 |
| ≥0.5 | 1938 | 51.7 | 50.2 | **+1.5** | -1.8 |
| ≥1 | 1676 | 52.6 | 50.4 | **+2.1** | -0.1 |
| ≥1.5 | 1450 | 53.2 | 51.4 | **+1.9** | +1.2 |
| ≥2 | 1225 | 53.7 | 51.8 | **+1.9** | +2.1 |
| ≥3 | 836 | 53.5 | 51.7 | **+1.8** | +1.6 |
| ≥4 | 529 | 54.8 | 50.3 | **+4.5** | +4.2 |

| phase (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 211 | 51.2 | 52.1 | **-0.9** | -2.7 |
| MID | 582 | 52.4 | 51.5 | **+0.9** | -0.4 |
| LATE | 653 | 53.9 | 52.5 | **+1.4** | +2.5 |
| POST | 107 | 55.1 | 53.3 | **+1.9** | +4.9 |

| season (k=1.25) | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 662 | 52.1 | 51.1 | **+1.1** | -0.8 |
| 2025 | 891 | 53.8 | 51.2 | **+2.6** | +2.1 |
