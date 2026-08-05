# NBA team totals — the third season

> **PARTLY SUPERSEDED 2026-08-01.** The `MIN_TRAIN` diagnosis below is correct and carried forward,
> as is the train-on-implied / grade-on-posted split — the panel rebuild uses both. But the models
> here are still TWO SEPARATE FITS on one row per game, so the home-vs-away comparison is estimator
> variance. On the team-game panel in **`NBA_PANEL_ALL.md`** the gap closes and both sides go
> negative at the 4-point cut, and 88% of qualifying team-total bets duplicate the full-game total.

`NBA_TT_VERIFY.md` reported two evaluable seasons and called that the ceiling of the data. It is not. Team-total PRICES cover three seasons (2022-23 predates the Odds API's additional markets and cannot be bought), but the evaluation only saw two because `MIN_TRAIN = 1500` in `nba_total_v2.py` is larger than an NBA season (~1,277 games), so season 2023 was consumed whole.

This file separates training from grading. The model is fit on **actual team points minus the full-game market's implied team total** (`total/2 ∓ spread/2`), which exists for all four seasons, then converted back to a points estimate and compared with the **posted** team total wherever one is available. Same bets, three graded seasons instead of two, and a third more training rows.

Games by season: {2022: 1276, 2023: 1275, 2024: 1277, 2025: 1280}. Posted team totals by season: {2022: 0, 2023: 1275, 2024: 1276, 2025: 1280}.

## home team total

5,108 training rows (was 3,820 under the old construction), 3,820 graded bets available, out-of-sample correlation with the posted-line residual **+0.0399**.

### home team total — where the edge comes from, at the 4-point cut

`model + line gap` is the bet. `model only` ignores the book's own FG-vs-TT disagreement; `line gap only` is that disagreement with no model at all. If the third row carried it, this would be a market-consistency trade, not a model.

| quantity bet | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| model + line gap | 633 | 52.8 | 50.4 | **+2.4** | -0.2 |
| model only | 621 | 52.7 | 50.2 | **+2.4** | -0.3 |
| line gap only | 37 | 70.3 | 73.0 | **-2.7** | +8.3 |

### home team total — ladder, null re-measured at each rung

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 2313 | 51.9 | 50.4 | **+1.5** | -1.8 | -0.05 | 1.23 | **+1.27** |
| ≥2 | 1717 | 52.0 | 50.1 | **+1.9** | -1.7 | -0.52 | 1.38 | **+1.72** |
| ≥3 | 1057 | 52.2 | 50.6 | **+1.6** | -1.2 | -1.02 | 1.87 | **+1.41** |
| ≥4 | 633 | 52.8 | 50.4 | **+2.4** | -0.2 | -1.64 | 2.46 | **+1.63** |
| ≥5 | 333 | 55.9 | 50.8 | **+5.1** | +5.6 | -1.85 | 2.88 | **+2.42** |

### home team total — by season, at the 4-point cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 212 | 47.2 | 53.3 | **-6.1** | -11.2 |
| 2024 | 240 | 53.8 | 50.0 | **+3.8** | +1.8 |
| 2025 | 181 | 58.0 | 52.5 | **+5.5** | +10.0 |

### home team total — by phase, at the 4-point cut

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 147 | 57.1 | 52.4 | **+4.8** | +8.2 |
| MID | 211 | 51.7 | 52.6 | **-0.9** | -2.4 |
| LATE | 225 | 50.7 | 51.1 | **-0.4** | -4.1 |
| POST | 50 | 54.0 | 56.0 | **-2.0** | +1.5 |

### home team total — over vs under, at the 4-point cut

Baseline is the **league rate for that same side**, not the cell's own majority — conditioning on the side the model took makes the majority self-referential and prints +0.0 on every row.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 377 | 52.0 | 50.6 | **+1.4** | -1.7 |
| model says UNDER | 256 | 53.9 | 49.4 | **+4.5** | +2.0 |

## away team total

5,108 training rows (was 3,821 under the old construction), 3,821 graded bets available, out-of-sample correlation with the posted-line residual **+0.0663**.

### away team total — where the edge comes from, at the 4-point cut

`model + line gap` is the bet. `model only` ignores the book's own FG-vs-TT disagreement; `line gap only` is that disagreement with no model at all. If the third row carried it, this would be a market-consistency trade, not a model.

| quantity bet | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| model + line gap | 742 | 54.4 | 50.7 | **+3.8** | +3.3 |
| model only | 746 | 53.1 | 50.3 | **+2.8** | +0.8 |
| line gap only | 37 | 73.0 | 75.7 | **-2.7** | +12.5 |

### away team total — ladder, null re-measured at each rung

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 2432 | 52.1 | 51.1 | **+1.0** | -1.1 | -1.01 | 1.49 | **+1.37** |
| ≥2 | 1853 | 51.2 | 50.8 | **+0.4** | -2.9 | -1.10 | 1.22 | **+1.26** |
| ≥3 | 1210 | 53.1 | 50.3 | **+2.7** | +0.6 | -1.67 | 1.89 | **+2.32** |
| ≥4 | 742 | 54.4 | 50.7 | **+3.8** | +3.3 | -2.74 | 2.49 | **+2.61** |
| ≥5 | 427 | 54.8 | 52.5 | **+2.3** | +3.9 | -2.79 | 2.64 | **+1.94** |

### away team total — by season, at the 4-point cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 232 | 54.7 | 51.3 | **+3.4** | +3.3 |
| 2024 | 298 | 54.7 | 51.3 | **+3.4** | +4.0 |
| 2025 | 212 | 53.8 | 50.9 | **+2.8** | +2.2 |

### away team total — by phase, at the 4-point cut

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 152 | 53.3 | 57.2 | **-3.9** | +1.3 |
| MID | 258 | 50.4 | 53.9 | **-3.5** | -4.6 |
| LATE | 280 | 57.5 | 50.7 | **+6.8** | +9.0 |
| POST | 52 | 61.5 | 61.5 | **+0.0** | +16.9 |

### away team total — over vs under, at the 4-point cut

Baseline is the **league rate for that same side**, not the cell's own majority — conditioning on the side the model took makes the majority self-referential and prints +0.0 on every row.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 398 | 53.5 | 51.3 | **+2.2** | +1.5 |
| model says UNDER | 344 | 55.5 | 48.7 | **+6.8** | +5.3 |

## Verdict — both team totals, all three graded seasons

At the 4-point cut. `NBA_TT_VERIFY.md` called home 1-of-2 and away 2-of-2 on a window that never saw season 2023.

| market | 2022 | 2023 | 2024 | 2025 | seasons positive |
|---|---|---|---|---|---|
| home team total | — | -6.1 edge, -11.2 ROI | +3.8 edge, +1.8 ROI | +5.5 edge, +10.0 ROI | **2 of 3** |
| away team total | — | +3.4 edge, +3.3 ROI | +3.4 edge, +4.0 ROI | +2.8 edge, +2.2 ROI | **3 of 3** |
