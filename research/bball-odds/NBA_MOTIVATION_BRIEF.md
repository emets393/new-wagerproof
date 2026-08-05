# NBA — back the team that needs the game

No model. Standings position only, computed from games played strictly before tip, bet and graded against the OPENING spread.

**Baseline is 50%** — a spread is a two-way market and a coin wins half of it. Breakeven at -110 is 52.4%. A 45% row is as informative as a 55% row.

`delta cell` subtracts blind-favourite ROI reweighted to the selection's own |open spread| bucket mix. `fav share` is how often the signal's pick simply IS the favourite — a rule near 90% there is a favourite rule in disguise.


## Late season (both teams 50+ games in), by motivation gap

| rule | n | win% | ROI | delta cell | fav share | by season |
|---|---|---|---|---|---|---|
| back higher-motivation side, gap >= 1 | 1270 | 51.9 | -0.93 | **+2.14** | 62% | 50/55/52/50 |
| back higher-motivation side, gap >= 2 | 702 | 53.1 | +1.44 | **+4.03** | 72% | 47/58/57/52 |
| back higher-motivation side, gap >= 3 | 418 | 55.5 | +5.96 | **+8.04** | 86% | 52/57/60/54 |
| gap >= 2, and it is the AWAY team | 360 | 56.1 | +7.12 | **+9.88** | 66% | 47/60/65/55 |
| gap >= 2, and it is the HOME team | 342 | 50.0 | -4.54 | **-2.13** | 77% | 48/57/48/49 |
| placebo: back the LOWER-motivation side, gap >= 2 | 702 | 46.9 | -10.52 | **-7.92** | 28% | 53/42/43/48 |

## The component parts, late season

Which piece of the motivation score is doing the work. A composite that is really one flag should show it here.

| rule | n | win% | ROI | delta cell | fav share | by season |
|---|---|---|---|---|---|---|
| fade the tanking team (one side tanking) | 453 | 54.1 | +3.25 | **+5.13** | 94% | 47/60/59/50 |
| fade the eliminated team (one side out) | 296 | 56.1 | +7.06 | **+8.54** | 97% | 57/51/65/55 |
| back the bubble team (one side on the bubble) | 286 | 48.3 | -7.88 | **-4.20** | 45% | 49/-/41/50 |
| bubble team vs a settled team | 63 | 52.4 | +0.00 | **+2.91** | 73% | 52/-/-/- |

## Sanity: does this exist BEFORE the standings mean anything?

The same score applied when it should be meaningless. A rule that scores just as well in November is not a motivation rule — it is picking up team quality.

| rule | n | win% | ROI | delta cell | fav share | by season |
|---|---|---|---|---|---|---|
| mid season, gap >= 2 | 618 | 50.0 | -4.52 | **-1.31** | 57% | 51/54/44/53 |
| early season, gap >= 2 | 81 | 53.1 | +1.40 | **+4.25** | 64% | -/-/40/- |

## Playoff-race context in the postseason

Seeds are settled but series position is not. Included for completeness; the sample is four postseasons and decides nothing.

| rule | n | win% | ROI | delta cell | fav share | by season |
|---|---|---|---|---|---|---|
| postseason, seed gap >= 4 -> back the better seed | 132 | 53.8 | +2.72 | **+6.00** | 87% | 47/53/60/58 |
