# NBA — back the favourite when the HOME team has quit

**The number every row is measured against is 53.05%** — blind favourite across all 1,817 late-season games (both teams 50+ games in). Not 50%: favourites already cover above chance late, so a favourite-backing rule starts from there. Breakeven at -110 is 52.4%.

`delta cell` subtracts blind-favourite ROI reweighted to the selection's own |open spread| bucket mix, so a row cannot score merely by drifting toward big favourites. `p5` is the 5th percentile of win% over 10,000 bootstrap resamples.


## The venue asymmetry

Same condition, two venues. If the effect is about a team having quit it should appear on both sides; if it is about the home-court adjustment being wrong it can only appear at home.

| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| back the fav — HOME team dead | 324 | 62.3 | +19.03 | **+17.34** | 58.0 | 60/58/68/63 |
| back the fav — AWAY team dead | 298 | 53.7 | +2.50 | **-0.48** | 49.0 | 46/54/57/56 |
| back the fav — home dead, away alive | 246 | 62.2 | +18.75 | **+16.64** | 56.9 | 59/61/67/62 |
| back the fav — neither dead | 1273 | 51.1 | -2.37 | **-3.10** | 48.9 | 52/50/51/51 |
| back the fav — both dead | 78 | 62.8 | +19.91 | **+19.53** | 53.8 | 65/-/-/67 |

## Which flavour of dead

Eliminated, tanking and clinched are different states. A result that needs all of them fused is weaker than one that survives each on its own.

| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| back the fav — home team eliminated | 197 | 61.9 | +18.22 | **+16.18** | 56.3 | 56/52/81/62 |
| back the fav — home team tank | 304 | 62.2 | +18.69 | **+17.05** | 57.6 | 61/59/67/62 |
| back the fav — home team clinched | 413 | 49.2 | -6.17 | **-8.19** | 45.0 | 48/50/51/47 |
| back the fav — home eliminated AND tanking | 177 | 61.6 | +17.55 | **+15.56** | 55.4 | 56/53/80/60 |

## Is it the favourite, or is it fading the dead team?

These are the same ticket only when the dead home team is the underdog. Split by who the favourite actually is.

| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| home dead AND home is the DOG — back the road fav | 257 | 61.1 | +16.62 | **+14.56** | 56.0 | 61/60/67/56 |
| home dead AND home is the FAVOURITE — back the home fav | 67 | 67.2 | +28.28 | **+27.98** | 58.2 | -/-/71/- |
| home dead — always fade the home team regardless of price | 324 | 55.2 | +5.46 | **+3.77** | 50.6 | 58/59/57/47 |

## Does it need the opponent to care?

A dead home team hosting another dead team should be worth less if the story is about effort mismatch rather than a stale home-court adjustment.

| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| home dead, away fighting for a spot | 55 | 54.5 | +4.13 | **+2.74** | 43.6 | 58/-/-/- |
| home dead, away neither dead nor fighting | 191 | 64.4 | +22.96 | **+20.65** | 58.6 | 60/65/68/63 |

## Dose: how dead, and how late


| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| home dead, 15+ games left | 80 | 55.0 | +5.05 | **+4.11** | 46.2 | 48/70/-/- |
| home dead, under 10 games left | 152 | 63.8 | +21.82 | **+19.59** | 57.2 | 63/49/79/65 |
| home dead, 8+ games out of the play-in | 239 | 62.8 | +19.83 | **+18.04** | 57.7 | 63/56/72/64 |
| home dead, within 8 of the play-in | 85 | 61.2 | +16.78 | **+15.37** | 51.8 | 58/-/62/- |

## Placebo: the same flags before they can mean anything

`eliminated` and `tank` both require the season to be nearly over, so they cannot fire in mid-season. The stand-in is the same home team quality — bottom-4 in its conference — with no games-left condition. If THAT scores, the finding is about bad home teams, not dead ones.

| rule | n | win% | ROI | delta cell | p5 | by season |
|---|---|---|---|---|---|---|
| mid season, home team bottom-4 in conference — back the fav | 554 | 47.1 | -10.04 | **-10.99** | 43.7 | 51/52/39/47 |
| late season, home team bottom-4 but NOT dead | 177 | 50.8 | -2.93 | **-3.83** | 44.6 | 53/50/51/49 |
