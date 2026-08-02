# CBB — confirming the two candidate rules, with the null paying for the search

`cbb_confirm.py`. Both rules below were spotted by reading a breakout table after the panel run, so a plain per-cell z is priced for the wrong test. Each is therefore scored twice: against nulls firing the identical rule, and against nulls allowed to pick their own best phase from the same menu. **The second number is the verdict.**

## Rule A — full-game spread, conference play only

The pooled rule is a 2-point disagreement between the model and the posted spread. The question is only whether the conference split is real.

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| all games | 3,170 | 55.0 | 50.2 | **+4.8** | **+5.1** | -1.24 | 1.93 | **+3.14** |
| CONFERENCE | 1,732 | 57.2 | 50.2 | **+7.0** | **+9.2** | -3.37 | 4.21 | **+2.46** |
| non-conference | 1,438 | 52.5 | 50.7 | **+1.8** | **+0.3** | -1.44 | 2.25 | **+1.44** |

### The same split by phase

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| NONCONF | 1,146 | 52.1 | 50.6 | **+1.5** | **-0.5** | -1.69 | 2.41 | **+1.32** |
| MTE | 221 | 53.4 | 52.5 | **+0.9** | **+2.0** | -3.99 | 7.07 | **+0.69** |
| CONF_EARLY | 926 | 58.3 | 50.9 | **+7.5** | **+11.4** | -3.65 | 5.93 | **+1.87** |
| CONF_LATE | 713 | 56.4 | 50.8 | **+5.6** | **+7.7** | -5.32 | 5.18 | **+2.11** |
| CONF_TOURN | 95 | 49.5 | 51.6 | **-2.1** | **-5.5** | -20.12 | 5.83 | **+3.09** |
| NCAAT | 38 | 55.3 | 60.5 | **-5.3** | **+5.5** | +7.41 | nan | **+nan** |
| POST_OTHER | 31 | 64.5 | 58.1 | **+6.5** | **+23.3** | +nan | nan | **+nan** |

**Selection-paid test.** Best real phase is **CONF_EARLY** at +7.5 edge. Each null was allowed the best of the same 4 phases and averaged +1.32 (sd 3.13), so the real winner clears its own search by **z +1.96**. A phase menu inflates the best cell by about +1.3 points of edge on noise alone — that is the price being paid here.

### Conference flag, or just later in the season?

The cheap story is that the model needs history and non-conference games come first. Split both ways: if the calendar is doing the work, non-conference games played late score like conference games, and conference games played early do not.

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| conference, early third | 74 | 56.8 | 54.1 | **+2.7** | **+8.4** | -9.17 | 20.60 | **+0.58** |
| conference, middle third | 946 | 58.6 | 50.4 | **+8.1** | **+11.9** | -4.27 | 5.22 | **+2.38** |
| conference, late third | 712 | 55.3 | 50.6 | **+4.8** | **+5.7** | -4.58 | 6.26 | **+1.49** |
| non-conference, early third | 1,237 | 52.9 | 50.6 | **+2.3** | **+1.0** | -1.67 | 2.46 | **+1.60** |
| non-conference, middle third | 118 | 46.6 | 55.9 | **-9.3** | **-11.0** | -6.85 | 10.29 | **-0.24** |
| non-conference, late third | 83 | 55.4 | 55.4 | **+0.0** | **+5.9** | -6.36 | 4.73 | **+1.34** |

### Rule A by season, conference games only

Pooled numbers hide a rule that decays.

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| 2023-24 | 615 | 59.5 | 51.7 | **+7.8** | **+13.6** | -4.26 | 6.02 | **+2.01** |
| 2024-25 | 620 | 56.1 | 51.8 | **+4.4** | **+7.2** | -2.67 | 8.09 | **+0.87** |
| 2025-26 | 497 | 55.5 | 50.7 | **+4.8** | **+6.1** | -7.49 | 7.33 | **+1.68** |

### Rule A — the ladder inside conference play

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 pts | 5,099 | 54.7 | 51.1 | **+3.6** | **+4.5** | -1.43 | 1.44 | **+3.47** |
| ≥1.5 pts | 3,087 | 56.9 | 50.6 | **+6.3** | **+8.8** | -1.42 | 2.00 | **+3.89** |
| ≥2 pts | 1,732 | 57.2 | 50.2 | **+7.0** | **+9.2** | -3.37 | 4.21 | **+2.46** |
| ≥2.5 pts | 863 | 58.9 | 50.5 | **+8.3** | **+12.4** | -4.03 | 8.09 | **+1.53** |
| ≥3 pts | 408 | 60.3 | 52.2 | **+8.1** | **+15.2** | -3.25 | 8.93 | **+1.27** |
| ≥4 pts | 78 | 52.6 | 55.1 | **-2.6** | **+0.4** | +nan | nan | **+nan** |

## Rule B — first-half spread, gated on the full-game spread

A first half is not a rotation of the game the way a team total is, so this is a real test of whether the model knows something about the horizon or is only re-expressing its full-game opinion.

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| gate ≥0, cut ≥2 | 1,633 | 54.1 | 52.0 | **+2.1** | **+2.4** | -0.38 | 1.02 | **+2.41** |
| gate ≥1, cut ≥2 | 1,365 | 55.1 | 52.2 | **+2.9** | **+4.4** | -1.27 | 1.31 | **+3.16** |
| gate ≥2, cut ≥2 | 902 | 56.2 | 52.2 | **+4.0** | **+6.6** | -2.41 | 2.18 | **+2.93** |
| gate ≥3, cut ≥2 | 416 | 56.2 | 51.2 | **+5.0** | **+6.8** | -1.52 | 3.62 | **+1.81** |

### Rule B by season, at gate ≥3

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| 2023-24 | 117 | 52.1 | 51.3 | **+0.9** | **-0.9** | -0.49 | 5.44 | **+0.25** |
| 2024-25 | 176 | 52.8 | 50.6 | **+2.3** | **+0.3** | -3.72 | 5.41 | **+1.11** |
| 2025-26 | 123 | 65.0 | 54.5 | **+10.6** | **+23.4** | -3.95 | 6.21 | **+2.34** |

### Is Rule B just Rule A again?

On the 416 games Rule B fires, the first-half model takes the **same side** as the full-game model 100.0% of the time. A first-half bet that always agrees with the full-game bet is the same position at a different price, not a second one — size accordingly.

| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| B fires and agrees with A | 416 | 56.2 | 51.2 | **+5.0** | **+6.8** | +4.12 | 6.80 | **+0.14** |

