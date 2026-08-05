# NBA props — why the under-selection works

24,506 selected unders (keeper markets, top 10% within market, consensus line and price). Pooled: **56.29%**, **+2.48 ROI**.

Two independent pipelines agree on the asymmetry -- the main-line stack and the alternate-line ladders at different books entirely -- so it is worth asking what causes it. Each slice below is a different candidate cause, and each predicts a different shape. A cause shows a SLOPE; the market's standing over-shade would show only a level.


## SKEW — does the edge concentrate at low lines?

Counting stats are bounded below at zero and right-tailed. If a symmetric fill is the cause, the edge is biggest where the bound bites: at low lines.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 0.50–1.50 | 4,559 | 58.26 | +1.12 | 0.50 |
| 1.50–12.50 | 5,005 | 57.02 | +2.08 | 5.86 |
| 12.50–19.50 | 4,912 | 54.72 | +1.31 | 15.41 |
| 19.50–27.50 | 5,016 | 54.55 | +1.45 | 22.92 |
| 27.50–59.50 | 5,014 | 57.04 | +6.30 | 33.38 |

## ROLE — line vs the panel's own projection

If the line is set off a role the player no longer has, the edge concentrates where the line sits HIGH relative to what the player projects for.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| -0.82–-0.17 | 4,725 | 53.21 | +2.99 | -0.34 |
| -0.17–-0.05 | 5,030 | 57.75 | +6.18 | -0.11 |
| -0.05–0.08 | 4,895 | 54.97 | +1.64 | 0.01 |
| 0.08–0.35 | 4,883 | 56.63 | +2.01 | 0.20 |
| 0.35–nan | 4,885 | 59.00 | -0.12 | inf |

## MINUTES — is the player's role shrinking? (L3 minus L10)

Negative = the player is playing fewer minutes lately than his ten-game book. A line set on the stale role is the most direct version of this mechanism.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| -26.30–-2.07 | 4,865 | 55.68 | +0.78 | -6.17 |
| -2.07–0.40 | 4,925 | 57.22 | +4.42 | -0.75 |
| 0.40–2.50 | 4,882 | 57.03 | +3.94 | 1.39 |
| 2.50–5.90 | 4,922 | 55.59 | +1.29 | 3.96 |
| 5.90–29.17 | 4,912 | 55.92 | +1.96 | 10.39 |

## BLOWOUT — how lopsided does the game project? (|T-60 spread|)

Starters sit in decided games. If this is the cause, the edge concentrates in the games most likely to be over early.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 0.00–3.00 | 4,144 | 57.67 | +4.85 | 1.74 |
| 3.00–5.00 | 4,649 | 56.61 | +2.96 | 3.82 |
| 5.00–7.50 | 4,949 | 55.97 | +1.99 | 6.06 |
| 7.50–11.00 | 5,120 | 55.49 | +1.07 | 8.86 |
| 11.00–24.00 | 4,759 | 56.31 | +2.36 | 13.30 |

## REST — second leg of a back-to-back

Load management and tired legs both cut counting stats.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| not a b2b | 19,272 | 56.47 | +2.80 | 0.00 |
| b2b | 5,234 | 55.62 | +1.31 | 1.00 |

## REST — days off before the game



| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 1.00–2.00 | 5,234 | 55.62 | +1.31 | 1.00 |
| 2.00–3.00 | 14,284 | 56.07 | +2.11 | 2.00 |
| 3.00–563.00 | 4,988 | 57.62 | +4.76 | 13.64 |

## VOLATILITY — how erratic is the player's workload?

A high-variance role is harder for the market to price than for a model that sees the whole distribution rather than a mean.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 0.00–4.14 | 4,901 | 56.85 | +3.79 | 3.27 |
| 4.14–5.67 | 4,896 | 57.09 | +3.86 | 4.86 |
| 5.67–9.67 | 4,905 | 55.88 | +1.31 | 7.30 |
| 9.67–12.66 | 4,902 | 54.67 | -0.30 | 11.29 |
| 12.66–22.82 | 4,902 | 56.96 | +3.75 | 15.42 |

## TEAMMATES OUT — usage vacated on the player's own team

The opposite prediction to the rest of this list: teammates out should push usage UP and make the under worse. If the edge survives here it is not simply a bet on reduced opportunity.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 0.00–106.21 | 23,621 | 56.36 | +2.56 | 4.20 |

## PACE — how many possessions does the game project?



| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| -8.84–-2.55 | 4,531 | 55.33 | +0.95 | -4.19 |
| -2.55–-0.87 | 4,537 | 56.12 | +2.18 | -1.68 |
| -0.87–0.41 | 4,535 | 57.09 | +4.57 | -0.23 |
| 0.41–2.09 | 4,534 | 55.29 | +0.45 | 1.20 |
| 2.09–8.50 | 4,535 | 58.06 | +4.84 | 3.64 |

## SAMPLE — does the edge need a long book on the player?

A thin book means the market is guessing too. This says which way that cuts.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 5.00–132.00 | 4,851 | 57.58 | +6.14 | 95.45 |
| 132.00–152.00 | 4,855 | 55.86 | +2.77 | 141.72 |
| 152.00–178.00 | 4,905 | 54.13 | -0.50 | 163.12 |
| 178.00–217.00 | 4,953 | 55.99 | +1.50 | 195.02 |
| 217.00–388.00 | 4,942 | 57.89 | +2.54 | 266.73 |

## PRICE — where in the market's own probability is the edge?

If the edge tracks the market's price rather than anything about the player, it is a pricing artifact rather than a handicap.

| bucket | n | win% | ROI | mean value |
|---|---|---|---|---|
| 0.24–0.48 | 4,786 | 66.28 | +1.91 | 0.39 |
| 0.48–0.49 | 4,107 | 57.00 | +3.06 | 0.48 |
| 0.49–0.50 | 4,845 | 55.27 | +2.01 | 0.49 |
| 0.50–0.51 | 5,860 | 54.04 | +1.99 | 0.50 |
| 0.51–0.67 | 4,908 | 49.63 | +3.61 | 0.55 |

## Per market

| market | n | win% | ROI | mean line |
|---|---|---|---|---|
| player_blocks | 3,774 | 60.60 | +0.70 | 0.65 |
| player_points | 4,686 | 55.10 | +2.51 | 16.29 |
| player_points_assists | 4,155 | 55.57 | +3.21 | 21.20 |
| player_points_rebounds | 4,400 | 55.73 | +3.61 | 23.00 |
| player_points_rebounds_assists | 4,563 | 54.74 | +1.22 | 25.93 |
| player_steals | 2,928 | 56.90 | +3.95 | 1.11 |
