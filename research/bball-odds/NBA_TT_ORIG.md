# NBA — the team-total market

> ## ⭐ VERDICT — read this before the tables
>
> **The team total is not a third market. It is the total and the spread rotated, and it ships as
> a GATED bet on the full-game total model, never on its own.**
>
> **THE RULE.** Predict own-team points off the panel (construction A — T1's feature set, 612
> features, half-life 180d, no market column). Bet a team total only when **the full-game total
> model is ≥8 points off the posted game total** — or, slightly better, when *either* full-game
> model is ≥8 off. Then take team rows ≥4 to ≥6 points off their posted team total.
>
> | | bets | win% | base% | ROI |
> |---|---|---|---|---|
> | gate ≥8, TT ≥4 | 984 | 58.3 | 53.4 | **+10.2** (z +4.65) |
> | gate ≥8, TT ≥5 | 797 | 59.0 | 53.8 | **+11.2** (z +4.78) |
> | **gate ≥8, TT ≥6** | **573** | **60.0** | **54.3** | **+13.1** (z +5.77) |
>
> All three seasons positive at every one of those cells. See `NBA_TT_GATE.md` for the full sweep
> and `NBA_TT_INCREMENTAL.md` for why the gate is not optional.
>
> **THE TRAP THIS DOCUMENT ORIGINALLY WALKED INTO.** The ungated ladder below reads +7.1% at ≥6 and
> looks like a standalone market. It is not — it is the average of **+13.1% in games the total
> model already bets** and **−12.1% (z −13.18) in games neither parent model touches**. A large
> team-total disagreement with both parents under their cut is two sub-threshold opinions stacked,
> and both parents lose below their cuts.
>
> **SIZE IT AS LEVERAGE.** These bets duplicate the O/U position rather than diversifying it: at
> TT ≥5, 31% are both rows of one game and 87% of those fire the same way. Display a derived team
> total for every game; only flag one when the parent fires.
>
> Generalised to every derived market in `derived-market-gating-law`.

`nba_tt_orig.py`. Own-team points against the posted team total, **graded at panel level**: a team total IS the team row, so unlike every other market there is no reduction to one number per game — **7,901 bets from 3,961 games**, 2023-2025.

## First, the owner's question: is this just the total and the spread?

**Yes.** Measured before anything was fit.

| relation | corr | within 1 pt | sd of gap |
|---|---|---|---|
| `tt_h + tt_a` vs posted total | +0.9929 | 96.9% | 1.14 |
| `tt_h − tt_a` vs posted margin | +0.9969 | 94.2% | 0.68 |

And the REALISED residuals obey the same arithmetic. If `tt_h = (total + margin)/2` exactly, three correlations are forced — predicted 0.790 / 0.613 / 0.250 against observed **0.790 / 0.610 / 0.253**. The team-total residual is the average of the total residual and the margin residual, to three decimals. There is no third dimension.

What is left is the price sheet (1.22-2.08 decimal, not flat -110) and about a point of slack between the book's team totals and its own total. That is the whole case, and it is what everything below tests.

### price-calibration oracle

| implied P(over) | over hits | n |
|---|---|---|
| 52.2% | 49.5% | 4,105 |
| 52.8% | 52.4% | 776 |
| 53.3% | 51.4% | 2,117 |
| 55.3% | 54.3% | 903 |

Monotone, corr **+0.880** — the prices are real and correctly oriented. This check is dead at flat -110 and has teeth here.

## Construction A — own points off T1

T1, 612 features, half-life 180d. corr with the realised residual **+0.0759**.

| cut (pts) | bets | win% | base% | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|
| ≥1 | 6,169 | 53.2 | 50.7 | **+0.4** | -0.78 | 0.45 | **+7.35** |
| ≥2 | 4,643 | 53.1 | 51.3 | **+0.1** | -0.80 | 0.40 | **+6.42** |
| ≥3 | 3,281 | 53.6 | 51.3 | **+1.0** | -0.86 | 0.47 | **+6.73** |
| ≥4 | 2,196 | 55.3 | 53.3 | **+4.2** | -0.90 | 0.50 | **+5.92** |
| ≥5 | 1,429 | 55.9 | 53.6 | **+5.0** | -0.97 | 0.57 | **+5.74** |
| ≥6 | 865 | 57.1 | 54.2 | **+7.1** | -1.12 | 0.59 | **+6.80** |
| ≥8 | 322 | 57.8 | 54.0 | **+7.7** | -1.18 | 1.01 | **+4.86** |

## Construction B — (total ± margin)/2

T1 level (612 feats, 180d) + CORE margin (188 feats, 120d). corr with the realised residual **+0.0771**.

| cut (pts) | bets | win% | base% | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|
| ≥1 | 6,243 | 53.3 | 51.0 | **+0.6** | -0.83 | 0.33 | **+9.65** |
| ≥2 | 4,683 | 54.5 | 51.6 | **+2.9** | -0.93 | 0.37 | **+10.34** |
| ≥3 | 3,404 | 55.4 | 51.8 | **+4.4** | -0.83 | 0.34 | **+13.01** |
| ≥4 | 2,350 | 55.0 | 52.5 | **+3.4** | -0.76 | 0.44 | **+7.41** |
| ≥5 | 1,545 | 55.5 | 53.0 | **+4.2** | -0.72 | 0.46 | **+6.94** |
| ≥6 | 960 | 55.1 | 52.4 | **+3.4** | -0.73 | 0.59 | **+5.84** |
| ≥8 | 366 | 55.5 | 54.6 | **+3.5** | -0.54 | 1.03 | **+1.32** |

## Breakouts — construction A

| cut | slice | bets | win% | ROI |
|---|---|---|---|---|
| ≥3 | all | 3,281 | 53.6 | **+1.0** |
| ≥3 | 2023 | 1,161 | 52.4 | **-2.6** |
| ≥3 | 2024 | 1,053 | 53.7 | **+1.8** |
| ≥3 | 2025 | 1,067 | 54.8 | **+4.1** |
| ≥3 | EARLY | 949 | 54.1 | **+0.7** |
| ≥3 | MID | 1,015 | 54.4 | **+3.0** |
| ≥3 | LATE | 1,136 | 52.0 | **-1.4** |
| ≥3 | POST | 181 | 56.4 | **+6.6** |
| ≥3 | home rows | 1,639 | 52.8 | **-0.4** |
| ≥3 | away rows | 1,642 | 54.3 | **+2.4** |
| ≥4 | all | 2,196 | 55.3 | **+4.2** |
| ≥4 | 2023 | 804 | 54.5 | **+1.1** |
| ≥4 | 2024 | 671 | 56.0 | **+6.3** |
| ≥4 | 2025 | 721 | 55.6 | **+5.6** |
| ≥4 | EARLY | 695 | 55.4 | **+2.9** |
| ≥4 | MID | 637 | 56.5 | **+6.9** |
| ≥4 | LATE | 746 | 53.9 | **+2.1** |
| ≥4 | POST | 118 | 57.6 | **+9.0** |
| ≥4 | home rows | 1,074 | 54.5 | **+2.4** |
| ≥4 | away rows | 1,122 | 56.1 | **+5.8** |
| ≥5 | all | 1,429 | 55.9 | **+5.0** |
| ≥5 | 2023 | 546 | 54.2 | **+0.2** |
| ≥5 | 2024 | 426 | 56.3 | **+6.9** |
| ≥5 | 2025 | 457 | 57.5 | **+9.2** |
| ≥5 | EARLY | 523 | 54.7 | **+1.4** |
| ≥5 | MID | 369 | 57.7 | **+9.1** |
| ≥5 | LATE | 463 | 55.9 | **+6.0** |
| ≥5 | POST | 74 | 55.4 | **+4.5** |
| ≥5 | home rows | 690 | 56.1 | **+5.3** |
| ≥5 | away rows | 739 | 55.8 | **+4.8** |

Blind OVER -3.91% · blind UNDER -6.34% over 7,901 team-games.

## Exposure — how much of this is one view bet twice

Both team totals of a game firing the SAME way is a game-total bet wearing a costume; firing OPPOSITE ways is a spread bet. Neither is new risk, and stacking them on top of the total and spread models doubles a position rather than diversifying it.

| cut | bets | both rows of the game fire | of those, same direction | ROI same-dir | ROI opposite-dir |
|---|---|---|---|---|---|
| ≥3 | 3,281 | 46% | 73% | +5.5 (n=1,096) | -4.1 (n=415) |
| ≥4 | 2,196 | 37% | 82% | +11.3 (n=670) | -1.6 (n=150) |
| ≥5 | 1,429 | 31% | 87% | +13.9 (n=385) | -14.9 (n=58) |

## The one slice with information the other two markets do not have

Games where the book's own team totals do not reconcile with its own posted total. This is the only place a team total is not a rotation.

| cut | slack | bets | win% | ROI |
|---|---|---|---|---|
| ≥2 | ≤0.5 pts (reconciles) | 4,006 | 52.7 | **-0.2** |
| ≥2 | >1 pt | 174 | 59.8 | **+3.1** |
| ≥2 | >2 pts | 90 | 64.4 | **+2.4** |
| ≥3 | ≤0.5 pts (reconciles) | 2,814 | 52.8 | **+0.1** |
| ≥3 | >1 pt | 143 | 60.1 | **+3.0** |
| ≥3 | >2 pts | 78 | 64.1 | **+1.3** |
| ≥4 | ≤0.5 pts (reconciles) | 1,850 | 54.8 | **+3.7** |
| ≥4 | >1 pt | 114 | 62.3 | **+6.2** |
| ≥4 | >2 pts | 65 | 66.2 | **+4.5** |

