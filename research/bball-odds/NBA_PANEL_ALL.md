# NBA — every market from one team-game model

**10,216 team-game rows from 5,108 games.** Two models: points scored by a team over the full game, and over the first half. Every market below is arithmetic on those two — team total is `own`, the total is `own + opp`, the spread is `own - opp`, the moneyline is `P(own - opp > 0)`. No market gets its own fit.

This replaces a set of independent per-market regressions on one row per game, which estimated the same relationship separately for home and away and produced a home/away gap with no basketball cause. Inputs are unchanged — the same curated feature stack, audited in `NBA_AUDIT.md` — so the only thing that differs from `NBA_TT_FULL.md` and `NBA_MARKETS.md` is the row layout.

Training uses one full season of team-games as burn-in, so **every market grades the same three seasons** and the comparison across them is like-for-like. Nulls are 20 game-level shuffles per model, re-measured at each rung of each ladder; a z below about +2 is noise.

Out-of-sample correlation with the actual residual: **+0.0517** full game, **+0.0499** first half.

## Team total

One model, both perspectives. `NBA_TT_FULL.md` fit these as two separate models and reported away at +3.8 edge against home at +2.4; if that gap was estimator variance rather than basketball, it should not survive here. **The cut below was moved to 2 points after seeing the ladder**, which is a selection the z-scores do not pay for — read it as descriptive, not as a validated rule.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 5,069 | 52.1 | 51.4 | **+0.8** | -1.6 | -0.72 | 0.84 | **+1.77** |
| ≥2 | 3,721 | 52.3 | 51.6 | **+0.7** | -1.5 | -0.38 | 0.78 | **+1.40** |
| ≥3 | 2,309 | 52.8 | 52.1 | **+0.7** | -0.8 | -0.35 | 1.06 | **+0.98** |
| ≥4 | 1,357 | 53.0 | 54.0 | **-1.0** | -0.7 | -0.33 | 1.29 | **-0.55** |
| ≥5 | 726 | 54.8 | 52.8 | **+2.1** | +2.2 | -0.47 | 2.09 | **+1.21** |

### Team total — by season, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 1,238 | 49.5 | 53.3 | **-3.8** | -8.2 |
| 2024 | 1,199 | 52.0 | 50.5 | **+1.5** | -1.1 |
| 2025 | 1,284 | 55.1 | 50.9 | **+4.3** | +4.7 |

### Team total — by phase, at the 2-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 929 | 53.8 | 50.3 | **+3.6** | -0.0 |
| MID | 1,184 | 51.9 | 51.3 | **+0.7** | -1.6 |
| LATE | 1,385 | 51.2 | 52.9 | **-1.7** | -3.0 |
| POST | 223 | 54.3 | 50.2 | **+4.0** | +2.8 |

### Team total — which side, at the 2-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 2,089 | 53.4 | 50.9 | **+2.5** | +0.2 |
| model says UNDER | 1,632 | 50.8 | 49.1 | **+1.7** | -3.6 |

### Team total — home vs away, both cuts

The question that forced the rebuild. Two fits made these look like different bets; one fit should make them look like the same bet seen from two sides. The 4-point row is the cut `NBA_TT_FULL.md` claimed on, kept here so the comparison is direct.

| perspective | cut | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| home team total | ≥2 pts | 1,828 | 51.5 | 51.6 | **-0.1** | -2.9 |
| away team total | ≥2 pts | 1,893 | 53.0 | 51.6 | **+1.4** | -0.1 |
| home team total | ≥4 pts | 691 | 51.8 | 54.6 | **-2.7** | -2.9 |
| away team total | ≥4 pts | 666 | 54.2 | 53.5 | **+0.8** | +1.6 |

### What the team-total model is really betting

Of 1,028 games where both team totals clear the 2-point cut, **79%** take the same side on both teams (a view on the game TOTAL) and **21%** take opposite sides (a view on the SPREAD, priced through two team totals). This matters because it says which market an apparent team-total edge actually belongs to.

## Full-game total

Sum of the two team predictions against the posted total. The ridge total model in `NBA_PROVEN.md` scored +3.1% ROI as a direct fit on the wide frame; this reaches the same market through per-team points instead.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,130 | 52.8 | 50.8 | **+2.0** | +0.8 | -0.72 | 0.82 | **+3.29** |
| ≥2 | 2,517 | 53.4 | 51.5 | **+1.9** | +1.9 | -0.43 | 0.79 | **+2.97** |
| ≥3 | 1,976 | 54.1 | 50.6 | **+3.6** | +3.4 | -0.72 | 1.11 | **+3.89** |
| ≥4 | 1,503 | 54.8 | 51.0 | **+3.8** | +4.5 | -0.97 | 1.50 | **+3.19** |
| ≥5 | 1,111 | 54.6 | 51.2 | **+3.4** | +4.3 | -1.37 | 1.65 | **+2.90** |

### Full-game total — by season, at the 4-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 482 | 52.3 | 51.0 | **+1.2** | -0.2 |
| 2024 | 489 | 53.2 | 52.8 | **+0.4** | +1.5 |
| 2025 | 532 | 58.5 | 50.8 | **+7.7** | +11.6 |

### Full-game total — by phase, at the 4-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 419 | 56.6 | 52.3 | **+4.3** | +8.0 |
| MID | 453 | 55.0 | 52.5 | **+2.4** | +4.9 |
| LATE | 541 | 52.5 | 52.1 | **+0.4** | +0.2 |
| POST | 90 | 58.9 | 55.6 | **+3.3** | +12.4 |

### Full-game total — which side, at the 4-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 868 | 55.0 | 50.8 | **+4.1** | +4.9 |
| model says UNDER | 635 | 54.5 | 49.2 | **+5.3** | +4.0 |

## Full-game spread

Difference of the two team predictions against the posted spread. `NBA_PROVEN.md` records that the full-game spread has no working model and its edge comes from rules instead; this is the first attempt at it from a consistent per-team points model.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,806 | 52.0 | 50.5 | **+1.5** | -0.8 | -0.66 | 1.27 | **+1.67** |
| ≥2 | 1,927 | 52.3 | 50.2 | **+2.0** | -0.2 | -0.88 | 1.36 | **+2.14** |
| ≥3 | 1,271 | 52.0 | 51.1 | **+0.9** | -0.7 | -1.34 | 1.66 | **+1.37** |
| ≥4 | 802 | 52.7 | 51.2 | **+1.5** | +0.7 | -1.74 | 2.38 | **+1.36** |
| ≥5 | 455 | 52.1 | 53.4 | **-1.3** | -0.5 | -2.54 | 2.55 | **+0.48** |

### Full-game spread — by season, at the 3-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 434 | 49.1 | 50.5 | **-1.4** | -6.3 |
| 2024 | 402 | 54.0 | 51.7 | **+2.2** | +3.1 |
| 2025 | 435 | 53.1 | 51.0 | **+2.1** | +1.4 |

### Full-game spread — by phase, at the 3-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 267 | 53.2 | 50.2 | **+3.0** | +1.6 |
| MID | 415 | 50.1 | 50.8 | **-0.7** | -4.3 |
| LATE | 512 | 53.3 | 50.2 | **+3.1** | +1.8 |
| POST | 77 | 49.4 | 63.6 | **-14.3** | -5.7 |

### Full-game spread — which side, at the 3-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 639 | 53.1 | 50.4 | **+2.6** | +1.3 |
| model says AWAY | 632 | 50.9 | 49.6 | **+1.4** | -2.7 |

## Moneyline

The spread model's margin turned into a win probability using its own as-of error scale, against the devigged market price. The cut is in percentage points of probability, not points of margin. **Read ROI here, not edge.** `base%` is the best blind side inside the bet cell, which on a moneyline is always the favourite; any model that takes underdogs therefore scores a large negative edge whether or not it is making money. The null columns show the same effect — the null scores about -10 — which is why the z can be positive while the ROI is negative.

Bet when the model and the market differ by at least k %.

| cut (%) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,389 | 47.3 | 54.4 | **-7.1** | -6.3 | -9.10 | 1.50 | **+1.36** |
| ≥2 | 2,979 | 47.3 | 54.0 | **-6.7** | -6.1 | -9.17 | 1.56 | **+1.60** |
| ≥3 | 2,590 | 46.6 | 54.2 | **-7.6** | -6.7 | -9.50 | 1.74 | **+1.11** |
| ≥5 | 1,920 | 46.2 | 54.1 | **-7.9** | -4.0 | -10.46 | 1.57 | **+1.62** |
| ≥7 | 1,353 | 45.9 | 52.5 | **-6.6** | -3.3 | -11.20 | 1.73 | **+2.67** |

### Moneyline — by season, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 895 | 43.7 | 55.1 | **-11.4** | -11.3 |
| 2024 | 852 | 45.5 | 52.7 | **-7.2** | -4.2 |
| 2025 | 843 | 50.9 | 54.8 | **-3.9** | -4.5 |

### Moneyline — by phase, at the 3-% cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 583 | 46.8 | 57.6 | **-10.8** | -10.1 |
| MID | 888 | 47.7 | 52.4 | **-4.6** | -1.9 |
| LATE | 968 | 44.8 | 53.2 | **-8.4** | -11.6 |
| POST | 151 | 51.0 | 58.3 | **-7.3** | +9.0 |

### Moneyline — which side, at the 3-% cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 1,260 | 50.9 | 55.6 | **-4.7** | -10.9 |
| model says AWAY | 1,330 | 42.6 | 44.4 | **-1.8** | -2.8 |

## First-half total

First-half points per team, summed, against the posted first-half total. First-half lines are roughly half the size of full-game ones, so the cuts are scaled down to match.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.75 | 3,277 | 50.4 | 50.5 | **-0.1** | -3.8 | -0.02 | 0.60 | **-0.06** |
| ≥1 | 3,107 | 50.3 | 50.4 | **-0.1** | -3.9 | -0.09 | 0.61 | **-0.01** |
| ≥1.5 | 2,758 | 50.3 | 50.3 | **-0.0** | -4.0 | -0.11 | 0.70 | **+0.11** |
| ≥2 | 2,411 | 50.7 | 50.0 | **+0.7** | -3.2 | -0.14 | 0.75 | **+1.13** |
| ≥3 | 1,808 | 51.9 | 50.2 | **+1.7** | -1.0 | -0.18 | 1.10 | **+1.73** |

### First-half total — by season, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 898 | 49.0 | 50.2 | **-1.2** | -6.5 |
| 2024 | 886 | 49.9 | 50.2 | **-0.3** | -4.8 |
| 2025 | 974 | 51.8 | 50.9 | **+0.9** | -1.0 |

### First-half total — by phase, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 657 | 52.7 | 50.7 | **+2.0** | +0.6 |
| MID | 947 | 50.6 | 50.9 | **-0.3** | -3.5 |
| LATE | 995 | 48.9 | 51.4 | **-2.4** | -6.6 |
| POST | 159 | 47.2 | 55.3 | **-8.2** | -9.9 |

### First-half total — which side, at the 1.5-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 1,335 | 50.6 | 50.3 | **+0.3** | -3.4 |
| model says UNDER | 1,423 | 50.0 | 49.7 | **+0.3** | -4.6 |

## First-half spread

Difference of the first-half team predictions against the posted first-half spread. On the wide frame this looked positive pooled but ran +4.9 / +0.8 / -2.1 edge across the three seasons — a decaying line, not an edge.

Bet when the model and the market differ by at least k pts.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥0.75 | 2,946 | 50.8 | 50.3 | **+0.5** | -3.1 | -0.55 | 1.04 | **+1.02** |
| ≥1 | 2,704 | 50.9 | 50.6 | **+0.3** | -2.9 | -0.73 | 1.23 | **+0.86** |
| ≥1.5 | 2,165 | 50.7 | 50.3 | **+0.4** | -3.3 | -0.73 | 1.42 | **+0.77** |
| ≥2 | 1,748 | 50.6 | 50.2 | **+0.4** | -3.4 | -1.05 | 1.48 | **+0.98** |
| ≥3 | 1,007 | 49.3 | 50.1 | **-0.9** | -6.0 | -1.50 | 1.72 | **+0.35** |

### First-half spread — by season, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 716 | 51.5 | 51.7 | **-0.1** | -1.8 |
| 2024 | 684 | 47.8 | 51.5 | **-3.7** | -8.7 |
| 2025 | 765 | 52.4 | 52.0 | **+0.4** | +0.0 |

### First-half spread — by phase, at the 1.5-pts cut

Pooled numbers hide a signal that decays, so this always runs alongside them.

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 457 | 49.9 | 52.1 | **-2.2** | -4.9 |
| MID | 766 | 49.3 | 52.1 | **-2.7** | -5.9 |
| LATE | 822 | 52.4 | 51.5 | **+1.0** | +0.0 |
| POST | 120 | 50.0 | 50.8 | **-0.8** | -4.4 |

### First-half spread — which side, at the 1.5-pts cut

Baseline is the league rate for that same side, not the majority side inside the cell.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says HOME | 1,069 | 51.0 | 49.6 | **+1.3** | -2.8 |
| model says AWAY | 1,096 | 50.4 | 50.4 | **+0.0** | -3.9 |

## Coherence check

The reason for one model rather than six: the markets are now arithmetically consistent. Reconstructed team points from the total and spread predictions match the per-team predictions exactly, so the model cannot like the over, the under of a team total and the home side at the same time — which independent fits are free to do.

- predicted full-game total spans 194–268 points, posted 194–262
- predicted home margin spans -31 to +32, posted -22 to +24
- reconstruction `(own+opp) ± (own-opp)` returns the team predictions exactly

