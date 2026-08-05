# NBA schedule context — day of week, tip time, slate size, holidays

Free information, known weeks ahead, never previously examined in this programme. **This is a wide sweep — roughly 40 cells across two markets — so a 57% cell is the EXPECTED output of noise, not a finding.** Nothing here is carried forward on its win rate alone; the bar is all four seasons positive, bootstrap p5 above breakeven, a mechanism, and survival against cell-matching.


## SPREAD — backing the HOME team — by day of week

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: home covers = 50.15%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Monday | 717 | 48.4 | **-1.8** | -7.60 | -3.29 | 45.3 | 51/49/43/51 |
| Tuesday | 571 | 52.0 | **+1.9** | -0.69 | +3.52 | 48.5 | 53/47/52/55 |
| Wednesday | 887 | 49.8 | **-0.3** | -4.86 | -0.61 | 47.1 | 52/49/49/49 |
| Thursday | 536 | 50.7 | **+0.6** | -3.11 | +1.12 | 47.2 | 50/52/50/51 |
| Friday | 876 | 50.9 | **+0.8** | -2.80 | +1.41 | 48.2 | 53/47/57/47 |
| Saturday | 658 | 48.8 | **-1.4** | -6.85 | -2.56 | 45.6 | 55/51/47/42 |
| Sunday | 742 | 50.7 | **+0.5** | -3.23 | +0.99 | 47.6 | 48/48/49/56 |

## SPREAD — backing the HOME team — by tip slot

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: home covers = 50.15%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| matinee (before 3pm ET) | 116 | 50.0 | **-0.2** | -4.55 | -0.43 | 42.2 | 43/66/40/52 |
| afternoon (3-6pm) | 279 | 51.3 | **+1.1** | -2.11 | +2.16 | 46.2 | 45/49/53/57 |
| early evening (6-8pm) | 2106 | 49.7 | **-0.4** | -5.08 | -0.83 | 48.0 | 52/49/48/50 |
| primetime (8-10pm) | 1827 | 50.8 | **+0.6** | -3.02 | +1.23 | 48.9 | 53/50/51/50 |
| late (10pm+, West Coast) | 659 | 49.3 | **-0.8** | -5.84 | -1.60 | 46.1 | 53/44/50/49 |

## SPREAD — backing the HOME team — by slate size

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: home covers = 50.15%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| tiny slate (1-3 games) — national TV night | 472 | 52.3 | **+2.2** | -0.09 | +4.19 | 48.5 | 56/53/52/49 |
| small slate (4-5) | 584 | 49.7 | **-0.5** | -5.18 | -0.87 | 46.2 | 51/47/48/53 |
| mid slate (6-8) | 1621 | 49.8 | **-0.4** | -4.95 | -0.66 | 47.7 | 54/47/47/50 |
| big slate (9+) — attention spread thin | 2310 | 50.1 | **-0.1** | -4.37 | -0.17 | 48.4 | 49/50/51/50 |

## SPREAD — backing the HOME team — holidays and weekends

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: home covers = 50.15%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Christmas Day | 20 | — | — | — | — | — | — |
| MLK Day | 0 | — | — | — | — | — | — |
| weekend (Sat/Sun) | 1400 | 49.8 | **-0.4** | -4.93 | -0.68 | 47.6 | 51/50/48/50 |
| weekday (Mon-Fri) | 3587 | 50.3 | **+0.1** | -3.98 | +0.27 | 48.9 | 52/49/50/50 |

## SPREAD — backing the HOME team — day x slot combinations

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: home covers = 50.15%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Friday primetime | 494 | 51.6 | **+1.5** | -1.45 | +2.69 | 48.0 | 55/46/61/44 |
| Saturday primetime | 340 | 46.5 | **-3.7** | -11.27 | -6.94 | 42.1 | 58/49/41/38 |
| Sunday matinee | 70 | 45.7 | **-4.4** | -12.73 | -8.77 | 35.7 | 36/-/-/- |
| Sunday primetime | 178 | 48.3 | **-1.8** | -7.75 | -3.58 | 42.1 | 54/39/37/59 |
| weekend matinee (Sat or Sun, before 3pm) | 94 | 48.9 | **-1.2** | -6.58 | -2.49 | 40.4 | 43/57/41/57 |
| weekday matinee (rare — MLK, holidays) | 22 | — | — | — | — | — | — |

## SPREAD — backing the FAVOURITE — by day of week

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: favourite covers = 50.39%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Monday | 717 | 46.3 | **-4.1** | -11.60 | -7.91 | 43.2 | 45/48/46/45 |
| Tuesday | 571 | 52.9 | **+2.5** | +0.97 | +4.78 | 49.4 | 49/50/53/59 |
| Wednesday | 887 | 49.4 | **-1.0** | -5.72 | -1.91 | 46.6 | 55/50/47/45 |
| Thursday | 536 | 51.3 | **+0.9** | -2.04 | +1.87 | 47.8 | 50/55/45/55 |
| Friday | 876 | 52.6 | **+2.2** | +0.48 | +4.27 | 49.8 | 55/49/56/50 |
| Saturday | 658 | 50.3 | **-0.1** | -3.96 | -0.05 | 47.1 | 57/59/43/42 |
| Sunday | 742 | 50.4 | **+0.0** | -3.76 | -0.10 | 47.4 | 46/54/49/52 |

## SPREAD — backing the FAVOURITE — by tip slot

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: favourite covers = 50.39%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| matinee (before 3pm ET) | 116 | 49.1 | **-1.3** | -6.17 | -2.14 | 41.4 | 53/55/47/41 |
| afternoon (3-6pm) | 279 | 51.6 | **+1.2** | -1.45 | +2.39 | 46.6 | 42/59/53/53 |
| early evening (6-8pm) | 2106 | 51.3 | **+0.9** | -2.00 | +1.72 | 49.5 | 52/54/47/52 |
| primetime (8-10pm) | 1827 | 48.9 | **-1.5** | -6.68 | -2.97 | 47.0 | 49/52/49/46 |
| late (10pm+, West Coast) | 659 | 51.3 | **+0.9** | -2.09 | +2.11 | 48.1 | 59/42/49/54 |

## SPREAD — backing the FAVOURITE — by slate size

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: favourite covers = 50.39%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| tiny slate (1-3 games) — national TV night | 472 | 47.0 | **-3.4** | -10.20 | -6.06 | 43.2 | 52/49/42/45 |
| small slate (4-5) | 584 | 48.6 | **-1.8** | -7.15 | -3.38 | 45.2 | 48/55/42/49 |
| mid slate (6-8) | 1621 | 50.0 | **-0.4** | -4.47 | -0.70 | 48.0 | 52/52/49/47 |
| big slate (9+) — attention spread thin | 2310 | 51.8 | **+1.4** | -1.15 | +2.59 | 50.0 | 52/52/51/52 |

## SPREAD — backing the FAVOURITE — holidays and weekends

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: favourite covers = 50.39%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Christmas Day | 20 | — | — | — | — | — | — |
| MLK Day | 0 | — | — | — | — | — | — |
| weekend (Sat/Sun) | 1400 | 50.4 | **-0.0** | -3.85 | -0.07 | 48.1 | 51/57/46/48 |
| weekday (Mon-Fri) | 3587 | 50.4 | **+0.0** | -3.77 | +0.03 | 49.0 | 52/50/50/50 |

## SPREAD — backing the FAVOURITE — day x slot combinations

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: favourite covers = 50.39%** on 4,987 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Friday primetime | 494 | 52.6 | **+2.2** | +0.48 | +4.36 | 49.0 | 57/47/60/46 |
| Saturday primetime | 340 | 47.4 | **-3.0** | -9.59 | -5.78 | 42.9 | 55/56/43/35 |
| Sunday matinee | 70 | 45.7 | **-4.7** | -12.69 | -8.99 | 35.7 | 45/-/-/- |
| Sunday primetime | 178 | 44.4 | **-6.0** | -15.28 | -11.32 | 38.2 | 41/45/34/53 |
| weekend matinee (Sat or Sun, before 3pm) | 94 | 52.1 | **+1.7** | -0.45 | +3.42 | 43.6 | 50/57/64/38 |
| weekday matinee (rare — MLK, holidays) | 22 | — | — | — | — | — | — |

## TOTAL — backing the OVER — by day of week

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Monday | 721 | 48.5 | **-2.2** | -7.33 | -4.00 | 45.5 | 47/50/46/51 |
| Tuesday | 576 | 49.1 | **-1.6** | -6.20 | -3.08 | 45.7 | 49/44/50/52 |
| Wednesday | 893 | 53.4 | **+2.7** | +1.97 | +5.18 | 50.7 | 53/52/57/53 |
| Thursday | 540 | 51.3 | **+0.6** | -2.07 | +0.92 | 47.8 | 47/56/53/48 |
| Friday | 887 | 52.5 | **+1.8** | +0.30 | +3.45 | 49.8 | 53/50/57/50 |
| Saturday | 662 | 51.7 | **+0.9** | -1.37 | +1.76 | 48.5 | 53/51/49/54 |
| Sunday | 745 | 47.5 | **-3.2** | -9.29 | -6.30 | 44.4 | 48/45/50/46 |

## TOTAL — backing the OVER — by tip slot

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| matinee (before 3pm ET) | 118 | 41.5 | **-9.2** | -20.72 | -18.41 | 33.9 | 50/41/32/43 |
| afternoon (3-6pm) | 281 | 49.8 | **-0.9** | -4.89 | -2.06 | 44.8 | 51/51/47/51 |
| early evening (6-8pm) | 2122 | 49.8 | **-0.9** | -4.91 | -1.87 | 48.1 | 51/49/52/47 |
| primetime (8-10pm) | 1835 | 51.3 | **+0.5** | -2.10 | +1.16 | 49.4 | 48/49/54/53 |
| late (10pm+, West Coast) | 668 | 54.2 | **+3.5** | +3.46 | +6.87 | 51.0 | 52/55/52/57 |

## TOTAL — backing the OVER — by slate size

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| tiny slate (1-3 games) — national TV night | 475 | 49.1 | **-1.7** | -6.35 | -4.42 | 45.3 | 47/49/45/56 |
| small slate (4-5) | 584 | 49.8 | **-0.9** | -4.87 | -1.73 | 46.4 | 51/49/52/47 |
| mid slate (6-8) | 1633 | 48.6 | **-2.1** | -7.18 | -3.90 | 46.6 | 46/50/50/48 |
| big slate (9+) — attention spread thin | 2332 | 52.8 | **+2.1** | +0.78 | +4.07 | 51.1 | 54/50/55/52 |

## TOTAL — backing the OVER — holidays and weekends

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Christmas Day | 20 | — | — | — | — | — | — |
| MLK Day | 0 | — | — | — | — | — | — |
| weekend (Sat/Sun) | 1407 | 49.5 | **-1.3** | -5.56 | -2.51 | 47.3 | 51/48/50/50 |
| weekday (Mon-Fri) | 3617 | 51.2 | **+0.5** | -2.20 | +0.98 | 49.9 | 50/51/53/51 |

## TOTAL — backing the OVER — day x slot combinations

Cell-matched against the same market across all games in the matching line-size buckets.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| cell | n | win% | vs base | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|---|
| Friday primetime | 502 | 56.0 | **+5.2** | +6.86 | +10.00 | 52.2 | 55/52/61/57 |
| Saturday primetime | 343 | 54.2 | **+3.5** | +3.53 | +6.88 | 49.9 | 55/52/51/59 |
| Sunday matinee | 71 | 42.3 | **-8.5** | -19.33 | -17.15 | 32.4 | 55/-/-/- |
| Sunday primetime | 179 | 45.8 | **-4.9** | -12.54 | -9.38 | 39.7 | 40/47/46/48 |
| weekend matinee (Sat or Sun, before 3pm) | 95 | 38.9 | **-11.8** | -25.65 | -23.45 | 30.5 | 46/35/35/38 |
| weekday matinee (rare — MLK, holidays) | 23 | — | — | — | — | — | — |

## Mechanism check: does the dead-home-team edge depend on attention?

S9 (late season, home team eliminated or tanking, back the favourite) is a 62.3% rule. If it exists because a soft number survives to tip, it should be BIGGER on crowded slates where no one is looking and smaller on national-TV nights. This is a real prediction with a direction, made before the split.

| cell | n | win% | ROI | by season |
|---|---|---|---|---|
| S9 on a big slate (9+ games) | 165 | 66.7 | +27.26 | 74/56/77/64 |
| S9 on a mid slate (6-8) | 129 | 59.7 | +13.95 | 55/59/62/65 |
| S9 on a small slate (<=5) | 30 | — | — | — |
| S9 in primetime (8pm+) | 144 | 59.7 | +14.02 | 67/50/61/62 |
| S9 not in primetime | 180 | 64.4 | +23.03 | 57/64/73/65 |
