# NBA clock findings — priced on the side actually bet

Follow-up to the 40-cell sweep in `nba_schedule_context.py`. **A sweep that wide manufactures a 57% cell by construction**, so these four are here on four-season consistency plus a mechanism, and the mechanism is measured in points before any win rate is quoted.


## Does the book already know about morning tips?

If matinee totals are posted lower by exactly as much as matinee games score lower, the effect is real and fully priced and there is nothing to bet. The edge is the GAP between the two columns.

| slot | n | mean posted total | mean actual total | actual − posted |
|---|---|---|---|---|
| matinee (before 3pm ET) | 118 | 225.0 | 223.9 | **-1.14** |
| weekend matinee | 95 | 223.7 | 222.4 | **-1.25** |
| afternoon (3-6pm) | 281 | 227.5 | 228.2 | **+0.68** |
| evening (6-8pm) | 2122 | 227.1 | 227.3 | **+0.23** |
| primetime (8-10pm) | 1835 | 228.3 | 229.4 | **+1.13** |
| late (10pm+) | 668 | 229.3 | 230.2 | **+0.93** |

The all-games figure for `actual − posted` is **+0.64** — that is the number every row above should be read against, not zero.

## Matinee UNDER, priced at the under

Dose by tip hour. A real body-clock effect should strengthen the earlier the tip, not switch on at an arbitrary cutoff.

**Baseline: under hits = 49.26%** on 5,024 games. Breakeven at -110 is 52.4%.

| bet | n | win% | ROI | p5 | by season |
|---|---|---|---|---|---|
| all matinees (<3pm ET) | 118 | 58.5 | +11.63 | 50.8 | 50/59/68/57 |
| tip before 1pm | 18 | — | — | — | — |
| tip 1-2pm | 100 | 60.0 | +14.55 | 52.0 | 50/64/67/59 |
| weekend matinee | 95 | 61.1 | +16.56 | 52.6 | 54/65/65/62 |
| Sunday matinee | 71 | 57.7 | +10.24 | 47.9 | 45/59/58/- |
| Saturday matinee | 24 | — | — | — | — |
| weekday matinee | 23 | — | — | — | — |
| under 4pm (looser cutoff, more sample) | 318 | 53.1 | +1.46 | 48.4 | 49/55/56/52 |

## Sunday and Monday UNDER

Sunday follows the league's heaviest Saturday and carries afternoon tips.

**Baseline: under hits = 49.26%** on 5,024 games. Breakeven at -110 is 52.4%.

| bet | n | win% | ROI | p5 | by season |
|---|---|---|---|---|---|
| all Sunday | 745 | 52.5 | +0.20 | 49.5 | 52/55/50/54 |
| Sunday, evening or later | 502 | 52.8 | +0.78 | 49.0 | 53/57/48/54 |
| all Monday | 721 | 51.5 | -1.76 | 48.4 | 53/50/54/49 |

## Friday / Saturday primetime OVER

The weakest mechanism of the four — a televised Friday is not obviously a higher-scoring environment — so this leans almost entirely on consistency.

**Baseline: over hits = 50.74%** on 5,024 games. Breakeven at -110 is 52.4%.

| bet | n | win% | ROI | p5 | by season |
|---|---|---|---|---|---|
| Friday primetime (8pm+) | 502 | 56.0 | +6.86 | 52.4 | 55/52/61/57 |
| Saturday primetime (8pm+) | 343 | 54.2 | +3.53 | 49.9 | 55/52/51/59 |
| Fri or Sat primetime | 845 | 55.3 | +5.51 | 52.4 | 55/52/56/58 |
| late West Coast (10pm+) | 668 | 54.2 | +3.46 | 51.0 | 52/55/52/57 |

## Monday DOG on the spread

The most season-consistent spread cell in the sweep (favourites 45/48/46/45) and the one with NO mechanism proposed in advance. Reported as an open question, not a signal.

**Baseline: dogs cover = 49.61%** on 4,987 games. Breakeven at -110 is 52.4%.

| bet | n | win% | ROI | p5 | by season |
|---|---|---|---|---|---|
| Monday — any dog | 717 | 53.7 | +2.51 | 50.6 | 55/52/54/55 |
| Monday — home dog | 266 | 52.6 | +0.49 | 47.7 | 60/52/45/55 |
| Monday — road dog | 450 | 54.2 | +3.51 | 50.2 | 52/52/59/54 |
| Tuesday — any dog (adjacent-day control) | 571 | 47.1 | -10.05 | 43.6 | 51/50/47/41 |

## Do these survive to the T-60 close?

The house closing-line definition. A cell that only exists at the open needs the open; one that survives is bettable on a live feed.

| bet | n at open | win% open | n at T-60 | win% T-60 |
|---|---|---|---|---|
| matinee under | 118 | 58.5 | 118 | 55.9 |
| weekend matinee under | 95 | 61.1 | 95 | 57.9 |
| Sunday under | 745 | 52.5 | 744 | 50.9 |
| Fri/Sat primetime over | 845 | 55.3 | 846 | 55.4 |
