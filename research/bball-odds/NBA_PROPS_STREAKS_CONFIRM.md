# NBA props — confirming the "book raised a cold player" under

`nba_props_streaks_confirm.py`. **Regenerated wholesale; do not edit.**

The spot: a player has gone **UNDER 3 straight**, the book **RAISES** his line by **≥0.75** of
his own game-to-game standard deviation, and you bet the **UNDER** anyway — with his cold form,
against the way the book just moved. One ticket per player-game, biggest line, venue `best`.

Its two parents both lose (cold streak alone −1.12, big raise alone −1.03), so if this is real it is
an interaction, not a signal with a filter bolted on.

## A. Streak length is not an argmax

| run | z | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|---|
| 2 | 0.50 | 2243 | 57.20 | 56.12 | 1.22 | 1.86 | 2.0/1.8/0.3 |
| 2 | 0.75 | 976 | 59.73 | 56.60 | 4.28 | 2.77 | 3.6/7.9/1.6 |
| 3 | 0.50 | 1330 | 56.92 | 56.08 | 0.92 | 2.42 | -3.0/5.2/-0.3 |
| 3 | 0.75 | 598 | 60.87 | 56.49 | 6.60 | 3.53 | 4.1/10.9/4.2 |
| 4 | 0.50 | 814 | 57.74 | 56.08 | 2.41 | 3.09 | 1.4/7.0/-0.7 |
| 4 | 0.75 | 370 | 62.70 | 56.53 | 9.94 | 4.45 | 9.8/13.4/7.0 |
| 5 | 0.50 | 479 | 57.83 | 55.90 | 2.96 | 4.04 | -1.5/5.8/3.5 |
| 5 | 0.75 | 232 | 63.79 | 56.31 | 12.62 | 5.60 | 0.0/19.1/13.9 |

## B. The whole surface — ridge or pixel?

ROI by consecutive unders (rows) × size of the raise in player sigmas (columns). `n*` are bet counts.

| run | z0.0 | n0.0 | z0.25 | n0.25 | z0.5 | n0.5 | z0.75 | n0.75 | z1.0 | n1.0 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | -0.26 | 35081 | -0.61 | 8097 | 2.33 | 3684 | 3.38 | 1606 | 3.99 | 721 |
| 2 | -0.59 | 24491 | -1.59 | 4925 | 1.22 | 2243 | 4.28 | 976 | 6.62 | 430 |
| 3 | -0.42 | 15570 | -0.50 | 2920 | 0.92 | 1330 | 6.60 | 598 | 9.42 | 273 |
| 4 | -0.89 | 9275 | -1.04 | 1711 | 2.41 | 814 | 9.94 | 370 | 12.91 | 161 |
| 5 | -0.54 | 5313 | 0.77 | 960 | 2.96 | 479 | 12.62 | 232 | 13.32 | 109 |

## C. Is this just the line-scale rule we already own?

Section 7 of `NBA_PROPS_VERDICT.md` already pays +9.90 on PRA ≥30.5 with no other filter. The
control takes the same number of bets, chosen by line size alone.

| rule | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|
| cold + book raised (the signal) | 598 | 60.87 | 56.49 | 6.60 | 3.53 | 4.1/10.9/4.2 |
| top-598 by line size alone (control) | 598 | 56.52 | 53.35 | 5.83 | 3.80 | 4.3/7.1/7.2 |
| every row, blind under (market) | 47236 | 52.93 | 53.39 | -1.02 | 0.43 | -0.4/-1.7/-1.0 |

## D. Does it work at both ends of the line ladder?

If the money is only in the big-line half, section C is the real explanation.

| half | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|
| small lines (bottom half) | 360 | 58.06 | 57.39 | -0.25 | 4.53 | -12.1/7.2/-0.3 |
| big lines (top half) | 279 | 62.72 | 55.14 | 12.78 | 5.25 | 14.8/15.3/8.6 |

## E. THE FALSIFIER — the mirror spot

The claim is specifically that the book RAISED him. Same cold streak, book CUT him by the same
amount, and the barely-moved control.

| spot | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|
| book RAISED him (the signal) | 598 | 60.87 | 56.49 | 6.60 | 3.53 | 4.1/10.9/4.2 |
| book CUT him (the mirror) | 1250 | 48.40 | 48.42 | -3.72 | 2.92 | -11.7/-0.8/0.0 |
| book barely moved (|z| < 0.25) | 15414 | 54.28 | 54.21 | -0.88 | 0.74 | -1.1/-3.4/1.7 |

**If the under pays on the cut rows too, this is not about the raise** — it is "cold players go
under whenever their number moves," a volatility effect, and the story is wrong.

## I. The interaction control — does the raise pay WITHOUT the streak?

The most important control here. If "the book raised him" pays on its own, the cold streak is
decoration and this is just a line-movement rule.

| rule | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|
| raise z>=0.75 alone, no streak | 4414 | 57.70 | 58.23 | -1.66 | 1.28 | -2.6/-1.6/-0.9 |
| cold streak >=3 alone, any line move | 19469 | 53.54 | 53.72 | -1.41 | 0.67 | -1.6/-2.3/-0.5 |
| BOTH (the signal) | 598 | 60.87 | 56.49 | 6.60 | 3.53 | 4.1/10.9/4.2 |

**It does not.** The raise alone loses over 4,000+ bets and the cold streak alone loses too; only
the conjunction pays. That is the interaction shape from [[ncaab-bigout-fade-signal]] — combine
signals, do not univariate-screen.

## J. Is it a role promotion?

The biggest raises look like role changes (one PRA line runs 11.5 → 30.0). Eyeballs are not a
population — bucketing by raise-as-a-share-of-line shows the big-percentage bucket is mostly SMALL
lines, not promoted starters. Recorded because the tempting story is the wrong one.

| bucket | med_prev_line | med_new_line | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|---|---|
| modest reprice (<20%) | 21.50 | 24.00 | 46 | 58.70 | 53.29 | 8.86 | 13.62 | -/-/- |
| clear bump (20-40%) | 10.50 | 14.00 | 162 | 57.41 | 54.43 | 4.93 | 7.14 | 11.8/5.1/-0.5 |
| big jump (>40%) | 2.50 | 3.50 | 390 | 62.56 | 57.81 | 7.03 | 4.24 | 4.1/11.7/4.9 |

Volume, for sizing:

| season_x | bets |
|---|---|
| 2023-24 | 151 |
| 2024-25 | 216 |
| 2025-26 | 231 |

## H. The partial — hold line size fixed

Sections C and D between them say most of this cell's money sits in big lines, and big lines already
pay on their own. So: INSIDE a line-size quartile, do the cold+raised rows beat that quartile's own
blind under? That lift is the partial effect, and it is what decides whether this is a new rule.

| band | med_line | signal_n | signal_roi | band_blind_roi | lift | one_sigma | signal_szn |
|---|---|---|---|---|---|---|---|
| Q1 smallest | 9.50 | 129 | 2.31 | -3.87 | 6.18 | 7.51 | -/-1.7/10.3 |
| Q2 | 7.50 | 244 | -0.70 | -1.20 | 0.50 | 5.50 | -18.2/15.3/-4.4 |
| Q3 | 17.50 | 158 | 9.03 | -0.63 | 9.66 | 7.18 | 1.1/24.9/-1.5 |
| Q4 biggest | 18.50 | 152 | 17.95 | 1.19 | 16.76 | 6.88 | 35.5/14.6/6.8 |

## F. Does the originator model already own it?

| split | n | win | need | roi | one_sigma | seasons |
|---|---|---|---|---|---|---|
| model also says under | 277 | 65.70 | 58.36 | 11.22 | 4.89 | -1.4/18.1/8.3 |
| model says OVER (disagrees) | 255 | 55.29 | 54.67 | 0.61 | 5.70 | -0.3/2.5/-0.7 |

## G. Concentration and what the bets actually look like

| n | roi | players | top10_pct | drop_best_player | median_line | mean_raise_z | mean_raise_units |
|---|---|---|---|---|---|---|---|
| 598 | 6.60 | 290 | 11.54 | 6.43 | 8.50 | 1.09 | 3.32 |

| mk | bets | pct |
|---|---|---|
| player_points_rebounds_assists | 131 | 21.91 |
| player_rebounds | 91 | 15.22 |
| player_assists | 88 | 14.72 |
| player_threes | 80 | 13.38 |
| player_rebounds_assists | 70 | 11.71 |
| player_points_assists | 48 | 8.03 |
| player_points_rebounds | 47 | 7.86 |
| player_points | 43 | 7.19 |

Units recomputed by hand and asserted against `grade()`.
