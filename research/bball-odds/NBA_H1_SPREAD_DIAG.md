# NBA 1H spread — why the home side is broken

`nba_h1_spread_diag.py`. The model is the settled one: 475 features, half-life 120d, no market column. Question is not whether it makes money, it is whether **+0.7% home / +21.0% away** is a property of the market or an artefact of the rule.

---

## ⭐ Verdict — the home side was never broken, and the 1H spread is a model

**The question in this file's title is wrong, and three rounds of measurement is what it took to
find that out.** The premise was that a 20-point gap between the two sides of one prediction had to
be a bug. It is not a bug and it is not a finding; it is what a 372-bet sample looks like when you
cut it in half and read each half as a separate claim.

**All three mechanical explanations are dead.** The graded line and the reducer's line are the same
number on **3,961 of 3,961** games. The symmetric part of the panel prediction is identically
**0.000, sd 0.000** — the fit is exactly antisymmetric, so there is no level bias available to find
— and the model's mean margin (+1.150) sits between the realised (+1.100) and the market's (+1.215).
The model is not shrunk toward the market, it is **1.22x too WIDE** (slope of realised margin on
mhat +0.684 against the market's +1.038), which makes it a favourite-*backer* if anything, and
`corr(d, implied)` is only −0.099. All four calibration repairs left the split standing.

**The 2x2 dissolved the premise.** Of the four cells at ≥6, three pay **+11.9%, +11.9% and +47.7%**.
The only loser is `model takes HOME while the market favours HOME`: −10.1% on 91 bets, against a
**blind rate of −5.5%** for that same population. That is −4.6 points of lift on 91 bets, about
0.44 sd. The model is not wrong on home favourites; it adds nothing there, and home favourites are
the most expensive side in this market to be on. Backing favourites (+10.1%) and backing dogs
(+11.9%) pay the same, so it was never a dog rule either.

**Lift over blind is the comparison that should have been made from the start.** At ≥6 the home side
is **+5.8 over blind** and the away side **+25.0 over blind** — both positive. "HOME +0.7%" only ever
read as dead because betting 1H home blind costs −5.2%.

**The control refused to support the structural story.** The full-game spread model at ≥8 splits
**HOME +36.4% on 63 bets / AWAY +4.0% on 314** — the exact opposite tilt, reproducing the published
377 bets exactly. Two models, two opposite side asymmetries, each concentrated in 50–200 bets. Side
splits at this sample size are noise in both markets, and the full-game model now carries the same
caveat.

**So grade the rule, which nobody had done.** At ≥6: **372 bets, 58.3%, +11.3% ROI, z +4.64** on 30
game-level null shuffles. Seasons **+17.3 / +2.1 / +15.4**, phases **EARLY +22.1 / MID +10.0 /
LATE +5.9** — every season and every phase positive. At ≥5 it is 610 bets at +4.7% and z +4.45, but
2024 goes −2.2 and LATE −2.6, so ≥6 is the rung.

**The 1H spread is a model, not a one-sided signal.** That retracts the verdict in `NBA_H1_ORIG.md`.
It is still the weaker of the two first-half markets — 372 bets against the 1H total's 631, nothing
below ≥5, and 2024 is nearly flat.

*The `skip home favourites` variant at the end (+18.2% on 281 bets) was chosen after seeing the 2x2
and has no out-of-sample standing. It is there to size the cell, not to be bet.*

---

## A. Grading line vs reducer line

`y_h1_marg_resid` reconstructs from `y_h1_margin + h1_spread` on **3,961 of 3,961** gradeable games (mismatches: 0). So the reducer adds exactly the number the bet is graded against.

## B. Is the margin estimate centred?

| quantity | mean | sd |
|---|---|---|
| realised 1H margin | +1.100 | 12.069 |
| market implied (−h1_spread) | +1.215 | 4.467 |
| model mhat | +1.150 | 5.448 |
| d = mhat + spread | -0.065 | 3.591 |
| discarded symmetric part | -0.000 | 0.000 |

The model's mean margin is **+1.150** against a realised **+1.100** and a market **+1.215**. A gap here shifts every `d` by the same amount, which is the cheapest way to break one side.

## C. Shrinkage — does the model just fade whoever is favoured?

| regression of realised 1H margin on… | intercept | slope | corr |
|---|---|---|---|
| model mhat | +0.314 | **+0.684** | +0.3086 |
| market implied | -0.160 | **+1.038** | +0.3841 |

Model sd is **1.22x** the market's. A slope above 1 means the estimate is SHRUNK — it has the right direction at too small a scale, and `d = mhat − implied` then leans against the favourite mechanically.

corr(d, implied) = **-0.0988** — if this is strongly negative the bet rule is a favourite-fader.

## The composition table — what the away bets actually are

| cut | side | bets | of which home favoured | win% | ROI |
|---|---|---|---|---|---|
| ≥3 | HOME | 736 | 54% | 48.9 | **-6.7** |
| ≥3 | AWAY | 777 | 68% | 52.3 | **-0.3** |
| ≥4 | HOME | 483 | 54% | 49.3 | **-6.0** |
| ≥4 | AWAY | 524 | 70% | 55.0 | **+4.9** |
| ≥5 | HOME | 288 | 53% | 51.7 | **-1.3** |
| ≥5 | AWAY | 322 | 70% | 57.8 | **+10.2** |
| ≥6 | HOME | 178 | 51% | 52.8 | **+0.7** |
| ≥6 | AWAY | 194 | 75% | 63.4 | **+21.0** |

- blind AWAY when home favoured: n=2,374, 50.42%, **-3.66%** ROI
- blind AWAY when away favoured: n=1,542, 50.00%, **-4.64%** ROI

## Two market-free repairs

Both calibrate mhat against the REALISED margin on an expanding window — never against the line — so the originator stays an originator. `a` and `b` are the intercept and slope of `margin ~ mhat` fit on strictly prior games, refit every 28 days.

| variant | cut | HOME n | HOME ROI | AWAY n | AWAY ROI | both ROI |
|---|---|---|---|---|---|---|
| baseline  d = mhat + spread | ≥4 | 483 | **-6.0** | 524 | **+4.9** | -0.3 |
| baseline  d = mhat + spread | ≥5 | 288 | **-1.3** | 322 | **+10.2** | +4.7 |
| baseline  d = mhat + spread | ≥6 | 178 | **+0.7** | 194 | **+21.0** | +11.3 |
| intercept fix  a + mhat | ≥4 | 364 | **-14.0** | 321 | **+9.4** | -3.0 |
| intercept fix  a + mhat | ≥5 | 229 | **-12.4** | 208 | **+18.3** | +2.2 |
| intercept fix  a + mhat | ≥6 | 136 | **-12.9** | 120 | **+22.5** | +3.7 |
| full calibration  a + b·mhat | ≥4 | 214 | **-12.5** | 252 | **+10.0** | -0.3 |
| full calibration  a + b·mhat | ≥5 | 103 | **-3.5** | 142 | **+9.0** | +3.8 |
| full calibration  a + b·mhat | ≥6 | 55 | **-2.6** | 77 | **+9.3** | +4.3 |
| de-shrink only  mhat·b | ≥4 | 166 | **-10.1** | 307 | **+8.3** | +1.9 |
| de-shrink only  mhat·b | ≥5 | 81 | **+6.2** | 166 | **+12.9** | +10.7 |
| de-shrink only  mhat·b | ≥6 | 42 | **-9.0** | 91 | **+7.1** | +2.1 |


---

# Round two — home/away, or favourite/dog?

`nba_h1_spread_diag2.py`. Round one killed the line mismatch, the level bias and the shrinkage story; what it left was a confound. At ≥6 the model's away bets are **75% home-favoured games** and its home bets are 51%, so `takes the away side` and `fades the favourite` are the same variable until they are split apart.

## The 2x2 — model side x who the market favours

`blind` is the same population bet the same side with no model at all. A cell is only evidence if the model clears its own blind control.

| cut | model takes | market favours | bets | win% | ROI | blind ROI (same cell) |
|---|---|---|---|---|---|---|
| ≥4 | HOME | home | 263 | 46.4 | **-11.7** | -5.5 (n=2,374) |
| ≥4 | HOME | away | 220 | 52.7 | **+0.7** | -4.6 (n=1,542) |
| ≥4 | AWAY | home | 369 | 53.4 | **+1.9** | -3.7 (n=2,374) |
| ≥4 | AWAY | away | 155 | 58.7 | **+11.9** | -4.6 (n=1,542) |
| ≥5 | HOME | home | 153 | 48.4 | **-7.9** | -5.5 (n=2,374) |
| ≥5 | HOME | away | 135 | 55.6 | **+6.1** | -4.6 (n=1,542) |
| ≥5 | AWAY | home | 224 | 54.5 | **+3.9** | -3.7 (n=2,374) |
| ≥5 | AWAY | away | 98 | 65.3 | **+24.5** | -4.6 (n=1,542) |
| ≥6 | HOME | home | 91 | 47.3 | **-10.1** | -5.5 (n=2,374) |
| ≥6 | HOME | away | 87 | 58.6 | **+11.9** | -4.6 (n=1,542) |
| ≥6 | AWAY | home | 145 | 58.6 | **+11.9** | -3.7 (n=2,374) |
| ≥6 | AWAY | away | 49 | 77.6 | **+47.7** | -4.6 (n=1,542) |

## The same bets, collapsed on the other axis

| cut | model backs the… | bets | win% | ROI |
|---|---|---|---|---|
| ≥4 | favourite | 418 | 51.0 | **-2.9** |
| ≥4 | underdog | 589 | 53.1 | **+1.5** |
| ≥5 | favourite | 251 | 55.0 | **+4.7** |
| ≥5 | underdog | 359 | 54.9 | **+4.7** |
| ≥6 | favourite | 140 | 57.9 | **+10.1** |
| ≥6 | underdog | 232 | 58.6 | **+11.9** |

## The away side, season by season

| cut | season | bets | win% | ROI |
|---|---|---|---|---|
| ≥5 | 2023 | 86 | 54.7 | **+4.2** |
| ≥5 | 2024 | 115 | 55.7 | **+6.3** |
| ≥5 | 2025 | 121 | 62.0 | **+18.0** |
| ≥6 | 2023 | 46 | 60.9 | **+16.1** |
| ≥6 | 2024 | 71 | 56.3 | **+7.7** |
| ≥6 | 2025 | 77 | 71.4 | **+36.2** |

## Control — the FULL-GAME spread model, same split

CORE (188 features, `rapm`+`pl_regr`), half-life 120d, four seasons. If this splits the same way then home-weak/away-strong is what an NBA originator does, not a first-half bug.

| cut | model takes | bets | win% | ROI | |
|---|---|---|---|---|---|
| **full-game spread** | | | | | |
| ≥6 | HOME | 124 | 61.3 | **+17.0** | |
| ≥6 | AWAY | 662 | 53.8 | **+2.7** | |
| ≥7 | HOME | 85 | 68.2 | **+30.3** | |
| ≥7 | AWAY | 469 | 54.6 | **+4.3** | |
| ≥8 | HOME | 63 | 71.4 | **+36.4** | |
| ≥8 | AWAY | 314 | 54.5 | **+4.0** | |

Blind full-game HOME -4.00% · blind AWAY -5.02%.


---

# Round three — the rule, not the side

`nba_h1_spread_diag3.py`. 475 features, half-life 120d, 30 game-level null shuffles.

## Lift over blind — the only fair way to compare two sides

A side is not weak because it loses money; it is weak because it loses more money than betting that same population blind. 1H home is an expensive side to be on.

| cut | cell | bets | model ROI | blind ROI | **lift** |
|---|---|---|---|---|---|
| ≥3 | HOME, home favoured | 399 | -9.8 | -5.5 | **-4.3** |
| ≥3 | HOME, away favoured | 337 | -3.0 | -4.6 | **+1.5** |
| ≥3 | AWAY, home favoured | 528 | -3.1 | -3.7 | **+0.6** |
| ≥3 | AWAY, away favoured | 249 | +5.7 | -4.6 | **+10.3** |
| ≥3 | HOME, all | 736 | -6.7 | -5.2 | **-1.6** |
| ≥3 | AWAY, all | 777 | -0.3 | -4.0 | **+3.8** |
| ≥4 | HOME, home favoured | 263 | -11.7 | -5.5 | **-6.1** |
| ≥4 | HOME, away favoured | 220 | +0.7 | -4.6 | **+5.3** |
| ≥4 | AWAY, home favoured | 369 | +1.9 | -3.7 | **+5.6** |
| ≥4 | AWAY, away favoured | 155 | +11.9 | -4.6 | **+16.6** |
| ≥4 | HOME, all | 483 | -6.0 | -5.2 | **-0.9** |
| ≥4 | AWAY, all | 524 | +4.9 | -4.0 | **+8.9** |
| ≥5 | HOME, home favoured | 153 | -7.9 | -5.5 | **-2.4** |
| ≥5 | HOME, away favoured | 135 | +6.1 | -4.6 | **+10.7** |
| ≥5 | AWAY, home favoured | 224 | +3.9 | -3.7 | **+7.6** |
| ≥5 | AWAY, away favoured | 98 | +24.5 | -4.6 | **+29.1** |
| ≥5 | HOME, all | 288 | -1.3 | -5.2 | **+3.8** |
| ≥5 | AWAY, all | 322 | +10.2 | -4.0 | **+14.2** |
| ≥6 | HOME, home favoured | 91 | -10.1 | -5.5 | **-4.6** |
| ≥6 | HOME, away favoured | 87 | +11.9 | -4.6 | **+16.5** |
| ≥6 | AWAY, home favoured | 145 | +11.9 | -3.7 | **+15.6** |
| ≥6 | AWAY, away favoured | 49 | +47.7 | -4.6 | **+52.4** |
| ≥6 | HOME, all | 178 | +0.7 | -5.2 | **+5.8** |
| ≥6 | AWAY, all | 194 | +21.0 | -4.0 | **+25.0** |

## The full two-sided rule, per season and per phase

Every earlier breakout was of the away side by itself. This is the rule.

| cut | slice | bets | win% | ROI |
|---|---|---|---|---|
| ≥5 | all | 610 | 54.9 | **+4.7** |
| ≥5 | 2023 | 188 | 58.0 | **+10.4** |
| ≥5 | 2024 | 209 | 51.2 | **-2.2** |
| ≥5 | 2025 | 213 | 55.9 | **+6.5** |
| ≥5 | EARLY | 130 | 59.2 | **+13.0** |
| ≥5 | MID | 228 | 56.1 | **+7.1** |
| ≥5 | LATE | 231 | 51.1 | **-2.6** |
| ≥6 | all | 372 | 58.3 | **+11.3** |
| ≥6 | 2023 | 112 | 61.6 | **+17.3** |
| ≥6 | 2024 | 131 | 53.4 | **+2.1** |
| ≥6 | 2025 | 129 | 60.5 | **+15.4** |
| ≥6 | EARLY | 86 | 64.0 | **+22.1** |
| ≥6 | MID | 130 | 57.7 | **+10.0** |
| ≥6 | LATE | 144 | 55.6 | **+5.9** |

## z on the whole rule

| cut | bets | win% | base% | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|
| ≥3 | 1,513 | 50.6 | 51.7 | **-3.4** | -1.41 | 0.61 | **+0.58** |
| ≥4 | 1,007 | 52.2 | 52.9 | **-0.3** | -1.73 | 0.77 | **+1.35** |
| ≥5 | 610 | 54.9 | 53.3 | **+4.7** | -2.09 | 0.84 | **+4.45** |
| ≥6 | 372 | 58.3 | 55.6 | **+11.3** | -2.37 | 1.09 | **+4.64** |

## `skip home favourites` — reported for mechanism, NOT as a product

**This exclusion was chosen after seeing the 2x2.** It drops the one cell with no lift over blind. It is here to show how much of the rule that cell was dragging, and it has no out-of-sample standing whatsoever.

| cut | bets | win% | ROI | (full rule) |
|---|---|---|---|---|
| ≥3 | 1,114 | 51.8 | **-1.1** | -3.4 on 1,513 |
| ≥4 | 744 | 54.3 | **+3.7** | -0.3 on 1,007 |
| ≥5 | 457 | 57.1 | **+9.0** | +4.7 on 610 |
| ≥6 | 281 | 61.9 | **+18.2** | +11.3 on 372 |

### and per season, same exclusion

| cut | season | bets | win% | ROI |
|---|---|---|---|---|
| ≥5 | 2023 | 131 | 57.3 | **+9.2** |
| ≥5 | 2024 | 164 | 53.0 | **+1.3** |
| ≥5 | 2025 | 162 | 61.1 | **+16.5** |
| ≥6 | 2023 | 77 | 62.3 | **+18.9** |
| ≥6 | 2024 | 102 | 54.9 | **+4.9** |
| ≥6 | 2025 | 102 | 68.6 | **+31.0** |

