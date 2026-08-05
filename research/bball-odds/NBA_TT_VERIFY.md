# NBA team totals — does the tail hold up?

> **SUPERSEDED 2026-08-01 — every number below is measured on a broken construction.** Team totals
> here were fit as TWO SEPARATE MODELS on a frame of one row per game, home and away. That
> estimates one relationship twice from disjoint columns, so the two sides differ by chance and the
> "away is the keeper" verdict is estimator variance, not basketball. Rebuilt on a team-game panel
> in `NBA_PANEL_ALL.md` the home/away gap closes to noise, and at the **4-point cut this file claims
> on, both sides are negative**. Once training is also recency-weighted (`NBA_PROVEN.md` §1d) the
> market dies outright — **+0.7 edge / −1.5% ROI at the 2-point cut, ladder inversion gone** — and
> 78.5% of its bets take the same side on both teams, i.e. it is the game total wearing a costume.
> **Do not revisit this market.** The secondary claim that "only two
> seasons are evaluable" is also wrong: three seasons of team-total prices exist, and the third was
> being consumed by a `MIN_TRAIN` tuned for a different frame size. Kept for the record.

`NBA_MARKETS.md` put the home team total ahead of every other NBA market: +2.7 edge, label-shuffle z +5.01, and a **monotone ladder** rising to +6.8 at the 4-point cut. The ladder is the part that matters — a real effect gets stronger when you tighten the cut, and the full-game total's ladder is flat by comparison.

This file re-tests the claim where the claim is actually made. **The z in `NBA_MARKETS.md` was measured at each market's default cut, not at the tail**, so it cannot be quoted next to the tail number. Everything below re-runs the shuffle at the 4-point cut, 20 permutations.

Two structural limits, stated up front rather than buried: **only two seasons are evaluable** (1H/TT prices cover three and the walk-forward consumes the first), and **home and away are not independent bets** — same game, shared total.

> The first of those is FALSE and the second is the reason this whole file is wrong. Three seasons
> of team-total prices exist (1,275 / 1,276 / 1,280); the third was lost to `MIN_TRAIN = 1500`,
> which exceeds one NBA season, not to any limit in the data. And "home and away are not
> independent bets" was written down correctly and then ignored — they were still fit as two
> independent models.

## home team total — ladder, with the null re-measured at each rung

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 1528 | 53.3 | 50.6 | **+2.7** | +1.0 | -1.01 | 1.43 | **+2.58** |
| ≥2 | 1163 | 53.7 | 50.6 | **+3.1** | +1.7 | -1.28 | 1.79 | **+2.44** |
| ≥3 | 766 | 54.7 | 50.1 | **+4.6** | +3.7 | -1.64 | 2.51 | **+2.47** |
| ≥4 | 474 | 57.2 | 50.4 | **+6.8** | +8.4 | -2.31 | 2.81 | **+3.23** |
| ≥5 | 268 | 59.0 | 50.4 | **+8.6** | +11.9 | -3.78 | 3.49 | **+3.55** |

### home team total — by season, at the 4-point cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 207 | 50.7 | 50.7 | **+0.0** | -3.8 |
| 2025 | 267 | 62.2 | 51.3 | **+10.9** | +17.9 |

### home team total — by phase, at the 4-point cut

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 74 | 64.9 | 52.7 | **+12.2** | +23.1 |
| MID | 166 | 57.2 | 54.8 | **+2.4** | +8.3 |
| LATE | 195 | 54.4 | 56.4 | **-2.1** | +3.2 |
| POST | 39 | 56.4 | 51.3 | **+5.1** | +7.0 |

### home team total — over vs under, at the 4-point cut

A model that only wins betting overs has found the league's scoring drift, not anything about a team. Baseline is the **league rate for that same side**, not the cell's own majority — conditioning on the side the model took makes the majority self-referential and prints +0.0 on every row (the `grade_one_side` docstring records the trap).

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 278 | 56.5 | 50.6 | **+5.9** | +7.0 |
| model says UNDER | 196 | 58.2 | 49.4 | **+8.7** | +10.4 |

Both sides clear their own league rate and the under is the stronger. Not scoring drift.

## away team total — ladder, with the null re-measured at each rung

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 1553 | 53.1 | 51.1 | **+1.9** | +0.9 | -0.92 | 1.38 | **+2.07** |
| ≥2 | 1225 | 53.7 | 51.8 | **+1.9** | +2.1 | -1.05 | 1.37 | **+2.13** |
| ≥3 | 836 | 53.5 | 51.7 | **+1.8** | +1.6 | -1.31 | 1.55 | **+2.00** |
| ≥4 | 529 | 54.8 | 50.3 | **+4.5** | +4.2 | -1.77 | 2.09 | **+3.02** |
| ≥5 | 290 | 56.6 | 51.0 | **+5.5** | +7.5 | -3.27 | 2.29 | **+3.83** |

### away team total — by season, at the 4-point cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2024 | 233 | 54.1 | 50.2 | **+3.9** | +2.8 |
| 2025 | 296 | 55.4 | 50.7 | **+4.7** | +5.3 |

### away team total — by phase, at the 4-point cut

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 85 | 54.1 | 62.4 | **-8.2** | +2.8 |
| MID | 196 | 52.0 | 51.0 | **+1.0** | -1.1 |
| LATE | 211 | 57.3 | 54.0 | **+3.3** | +8.9 |
| POST | 37 | 56.8 | 54.1 | **+2.7** | +7.9 |

### away team total — over vs under, at the 4-point cut

Same correction as above — baseline is the league rate for that side.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| model says OVER | 290 | 54.1 | 51.3 | **+2.9** | +2.9 |
| model says UNDER | 239 | 55.6 | 48.7 | **+6.9** | +5.8 |

Both sides positive again, under stronger again.

## Both team totals together — correlated, not a bigger sample

These are two bets on one game sharing a total, so this row is **not** independent evidence and its n should not be read as sample size. It is here to answer one question: does taking both sides when the model disagrees with both halves of the same game do better than taking either alone?

| cell | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| home leg, both legs qualify | 131 | 57.3 | 54.2 | **+3.1** | +8.5 |
| away leg, both legs qualify | 131 | 53.4 | 51.9 | **+1.5** | +1.5 |
| home leg, both legs same direction | 114 | 55.3 | 53.5 | **+1.8** | +4.8 |
| away leg, both legs same direction | 114 | 53.5 | 51.8 | **+1.8** | +1.7 |

Requiring both legs to qualify does not beat taking the home leg alone (+3.1 vs +6.8), so there is nothing to gain by demanding the model disagree with both halves of a game.

## Verdict — the season split reverses the headline

**The pooled numbers pick the home team total; the season split picks the away one.** At the 4-point cut:

| market | 2024 | 2025 | seasons positive |
|---|---|---|---|
| home team total | **+0.0 edge, −3.8 ROI** | +10.9 edge, +17.9 ROI | **1 of 2** |
| away team total | +3.9 edge, +2.8 ROI | +4.7 edge, +5.3 ROI | **2 of 2** |

Home TT's whole tail edge is one season. Its +6.8 pooled number is an average of a flat season and an enormous one, which is the exact failure the season-split rule exists to catch — and the phase table shows the same instability from the other direction (EARLY +12.2 on 74 bets, LATE −2.1 on 195). A 74-bet cell producing the biggest number in the study is the sort of thing that does not repeat.

Away TT is the weaker headline and the better bet: smaller (+4.5 pooled) but **positive in both evaluable seasons, at similar magnitudes**, with a monotone ladder (+1.9 → +1.8 → +4.5 → +5.5) whose z rises as the cut tightens (+2.07 → +2.00 → +3.02 → +3.83), and with both over and under clearing their own league rate.

**Neither is shippable yet, and the blocker is not the model.** Two evaluable seasons is the ceiling of what this data can support, because 1H/TT prices only cover three and the walk-forward consumes the first. A 2-of-2 result at z≈3 is a real lead, not a validated rule — the repo's own standard is 4 of 4. The way to get there is more seasons of team-total prices, not more modelling.

> **Both halves of that paragraph are wrong.** The blocker WAS the model — two fits where there
> should have been one. And the season ceiling was an artefact of `MIN_TRAIN`, not of the data. On
> the panel rebuild the home/away split closes to +2.2 / +2.8 at the 2-point cut and both go
> negative at the 4-point cut this file claims on. See `NBA_PANEL_ALL.md`.

Two things that are settled regardless:

- **Team totals are the right market for this feature stack**, and the reason is mechanical rather than empirical. Usage concentration is a one-team property measured against a one-team outcome; a game total sums it with the opponent's and dilutes it. Both team totals beat the full-game total on out-of-sample correlation (+0.083 / +0.057 vs +0.074) despite training on 25% fewer games.
- **The spread and both 1H markets did not improve on the repaired data** (−1.7, −0.7, −0.1). The data was not their problem, so the fix for them is construction, not features.
