# NCAAB availability — validating the FEED absence edge

Rule under test: **fade the team with more rotation minutes missing tonight**, top 30% of |home-minus-away differential|. Games with a live differential by season: 2022-23: 0, 2023-24: 1,013, 2024-25: 998, 2025-26: 939.

## Baseline (the row being validated)

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| FEED fresh, raw minutes | FG spread OPEN | 873 | 58.8 | 50.5 | **+8.2** | +12.2 | 0.000 | 24:61 25:59 26:55 |
| FEED fresh, raw minutes | FG spread T-60 | 872 | 57.6 | 50.9 | **+6.7** | +10.0 | 0.000 | 24:60 25:57 26:54 |

## C1 — is this just measuring how competitive the game was?

Correlation of |differential| with |final margin|: **-0.008**. Bench shortening would make this clearly NEGATIVE -- a blowout empties both benches, so fewer rotation players finish on zero. It is flat, so that artefact is not present.

Correlation of the SIGNED differential with the signed margin: **-0.103**. Negative is the mechanism working: the shorthanded side loses by more.

Splitting on the final margin would be circular -- conditioning on the outcome moves the cover baseline to ~63% and makes both halves unreadable. So the split below is on the PREGAME spread instead, which is observable when the bet is made.

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| tight games (spread < 4) | FG spread OPEN | 269 | 58.0 | 52.0 | **+5.9** | +10.7 | 0.029 | 24:57 25:61 26:55 |
| tight games (spread < 4) | FG spread T-60 | 266 | 57.1 | 53.0 | **+4.1** | +9.2 | 0.095 | 24:59 25:58 26:54 |
| mid (spread 4-9.5) | FG spread OPEN | 331 | 58.6 | 54.7 | **+3.9** | +11.9 | 0.084 | 24:58 25:60 26:58 |
| mid (spread 4-9.5) | FG spread T-60 | 333 | 57.7 | 55.3 | **+2.4** | +10.2 | 0.204 | 24:55 25:59 26:59 |
| big favourites (spread 10+) | FG spread OPEN | 273 | 60.8 | 52.0 | **+8.8** | +16.1 | 0.002 | 24:66 25:58 26:56 |
| big favourites (spread 10+) | FG spread T-60 | 274 | 58.4 | 50.4 | **+8.0** | +11.5 | 0.004 | 24:64 25:56 26:53 |

## C1b — the gradient (the program's primary test)

Cover rate of BACKING HOME by decile of the signed differential. The differential is home-minus-away, so the LEFT edge is where AWAY is missing the most and home is healthiest, and the RIGHT edge is where HOME is missing the most. The rule predicts a FALLING line. One ordered test over ten bins -- it cannot be gamed by picking a bucket, and a threshold rule with no slope behind it is a fluke.

| market | n | decile cover % backing home (away missing more -> home missing more) | r |
|---|---|---|---|
| FG spread OPEN | 2,909 | 59 56 51 57 44 50 51 50 45 40 | -0.081 |
| FG spread T-60 | 2,907 | 57 55 50 56 46 51 49 50 43 41 | -0.075 |

## C2 — is the selection leaning home, or leaning favourite?

Blind bets graded INSIDE the same selection. If blind home or blind favourite scores like the rule, the rule is a known bias in disguise.

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| *(selection is 49.3% home-side)* | FG spread OPEN |  |  |  |  |  |  |  |
| blind HOME | FG spread OPEN | 873 | 49.5 | 50.5 | **-1.0** | -5.5 | 0.737 | 24:53 25:48 26:47 |
| blind AWAY | FG spread OPEN | 873 | 50.5 | 50.5 | **+0.0** | -3.5 | 0.519 | 24:47 25:52 26:53 |
| blind FAVOURITE | FG spread OPEN | 873 | 52.6 | 50.5 | **+2.1** | +0.4 | 0.118 | 24:55 25:51 26:50 |
| *(selection is 49.1% home-side)* | FG spread T-60 |  |  |  |  |  |  |  |
| blind HOME | FG spread T-60 | 872 | 49.1 | 50.9 | **-1.8** | -6.3 | 0.864 | 24:53 25:47 26:46 |
| blind AWAY | FG spread T-60 | 872 | 50.9 | 50.9 | **+0.0** | -2.7 | 0.513 | 24:47 25:53 26:54 |
| blind FAVOURITE | FG spread T-60 | 872 | 50.7 | 50.9 | **-0.2** | -3.2 | 0.568 | 24:53 25:49 26:49 |

## C3 — does the top-30% cut beat a random 30% of the same pool?

`beats` is the share of 2,000 random cuts the real cut outscores on ROI. Below ~95% the magnitude cut is not carrying information.

| market | real ROI % | random ROI mean % | beats |
|---|---|---|---|
| FG spread OPEN | +12.21 | +1.60 | **100.0%** |
| FG spread T-60 | +9.96 | +1.03 | **100.0%** |

## C4 — walk-forward (cutoff from strictly prior seasons only)

| rule | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| walk-forward | FG spread OPEN | 471 | 58.2 | 52.4 | **+5.7** | +11.1 | 0.007 | 25:59 26:57 |
| walk-forward | FG spread T-60 | 475 | 56.8 | 53.1 | **+3.8** | +8.6 | 0.053 | 25:57 26:56 |
