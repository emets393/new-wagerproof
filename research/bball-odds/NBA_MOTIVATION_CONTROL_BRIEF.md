# NBA motivation signal — controlled against favourites in the same games

Baseline is 50%; breakeven at -110 is 52.4%. Blind favourite covers **53.05%** across all 1,817 late-season games, so that — not 50% — is what a favourite-heavy rule has to beat.

`fav in-subset` is blind favourite on the identical games the rule fires on. **That gap, not the raw win%, is what the rule adds.** `p5` is the 5th percentile of win% over 10,000 bootstrap resamples of the bet list.


## Is the rule anything more than the favourite?

| rule | n | win% | fav in-subset | rule − fav | ROI | p5 | by season |
|---|---|---|---|---|---|---|---|
| back higher-motivation side, gap >= 2 | 702 | 53.1 | 54.3 | **-1.1** | +1.44 | 50.1 | 47/58/57/52 |
| back higher-motivation side, gap >= 3 | 418 | 55.5 | 58.6 | **-3.1** | +5.96 | 51.4 | 52/57/60/54 |
| fade the tanking team | 453 | 54.1 | 56.5 | **-2.4** | +3.25 | 50.3 | 47/60/59/50 |
| fade the eliminated team | 296 | 56.1 | 56.8 | **-0.7** | +7.06 | 51.4 | 57/51/65/55 |
| fade any dead team (out or tanking) | 466 | 54.7 | 56.7 | **-1.9** | +4.47 | 50.9 | 49/59/58/52 |

## Split by whether the pick is the favourite or the dog

A rule that only fires on favourites is a favourite filter. One that also wins on dogs is picking sides.

| rule | n | win% | fav in-subset | rule − fav | ROI | p5 | by season |
|---|---|---|---|---|---|---|---|
| motivation gap >= 2 — pick is the FAVOURITE | 502 | 55.2 | 55.2 | **+0.0** | +5.34 | 51.4 | 50/56/63/53 |
| motivation gap >= 2 — pick is the DOG | 200 | 48.0 | 52.0 | **-4.0** | -8.36 | 42.5 | 44/67/46/47 |
| fade any dead team — pick is the FAVOURITE | 443 | 56.0 | 56.0 | **+0.0** | +6.87 | 52.1 | 50/59/60/55 |
| fade any dead team — pick is the DOG | 23 | — | — | — | — | — | — |

## The away-team result, stressed

The first pass found the motivation gap works only when the motivated side is the AWAY team (56.1% vs 50.0% at home). Road teams are dogs more often, so this is the row least likely to be a favourite effect — and the one most likely to be noise, since it is half the sample.

| rule | n | win% | fav in-subset | rule − fav | ROI | p5 | by season |
|---|---|---|---|---|---|---|---|
| motivated side is AWAY, gap >= 2 | 360 | 56.1 | 56.1 | **+0.0** | +7.12 | 51.7 | 47/60/65/55 |
| motivated side is HOME, gap >= 2 | 342 | 50.0 | 52.3 | **-2.3** | -4.54 | 45.6 | 48/57/48/49 |
| dead team is the HOME team (fade it) | 246 | 58.5 | 62.2 | **-3.7** | +11.75 | 53.3 | 56/59/66/53 |
| dead team is the AWAY team (fade it) | 220 | 50.5 | 50.5 | **+0.0** | -3.67 | 45.0 | 40/58/51/51 |

## Placebo: the same rule where standings cannot matter

Same score, gate removed so it can fire in November. If it scores here it is reading team quality, not motivation.

| rule | n | win% | fav in-subset | rule − fav | ROI | p5 | by season |
|---|---|---|---|---|---|---|---|
| mid season, gap >= 2 | 618 | 50.0 | 47.1 | **+2.9** | -4.52 | 46.6 | 51/54/44/53 |
| mid season, gap >= 3 | 166 | 51.8 | 48.2 | **+3.6** | -1.07 | 45.8 | 57/58/48/- |
