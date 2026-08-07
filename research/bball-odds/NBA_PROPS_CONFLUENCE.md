# NBA props — is this four bets or one?

`nba_props_confluence.py`. **Regenerated wholesale; do not edit.**

PRA = points + rebounds + assists, and pts+reb / pts+ast are sub-sums of it, so the four
points-family markets cannot be assumed independent. This asks whether they are.

## 1. Overlap — when one fires, does its sibling fire, and on the same side?

Top 25% by |model − line| in each market. `overlap` is the share of market A's fires whose
player-game also fires in B; `same_side` is agreement among those.

| a | b | overlap | same_side |
|---|---|---|---|
| points_rebounds | points_rebounds_assists | 55.27 | 99.09 |
| points_assists | points_rebounds_assists | 54.27 | 98.72 |
| points_rebounds | points_assists | 49.16 | 98.26 |
| points | points_assists | 46.69 | 98.21 |
| points | points_rebounds | 46.77 | 98.00 |
| points | points_rebounds_assists | 47.60 | 97.92 |
| rebounds | rebounds_assists | 34.92 | 93.52 |
| points_rebounds_assists | rebounds_assists | 38.51 | 92.47 |
| points_rebounds | rebounds_assists | 38.06 | 89.82 |
| points_rebounds_assists | rebounds | 33.32 | 89.05 |
| assists | rebounds_assists | 32.76 | 88.97 |
| points_assists | rebounds_assists | 36.86 | 88.77 |
| points_rebounds | rebounds | 34.82 | 88.68 |
| points | rebounds_assists | 31.53 | 82.60 |
| points | rebounds | 29.54 | 80.56 |
| points_assists | rebounds | 30.34 | 80.35 |
| points_assists | assists | 34.58 | 79.49 |
| points_rebounds_assists | assists | 31.48 | 76.64 |
| rebounds | assists | 25.89 | 71.77 |
| points | assists | 30.10 | 70.40 |
| points_rebounds | assists | 29.58 | 69.42 |

## 2. What a fire is worth, by how many siblings agree

2,694 player-games fire in all four. Best price.

| market | all4_n | all4_win | all4_roi | alone_n | alone_win | alone_roi |
|---|---|---|---|---|---|---|
| points | 2698 | 62.68 | 17.48 | 3199 | 53.33 | -0.39 |
| points_rebounds | 2698 | 62.79 | 17.73 | 2316 | 54.79 | 2.42 |
| points_assists | 2698 | 62.75 | 17.48 | 2088 | 52.49 | -2.70 |
| points_rebounds_assists | 2698 | 64.20 | 20.06 | 2527 | 56.55 | 4.67 |

**A fire that appears on only one of the four lines is not a bet.** Where all four agree the same
opinion pays +17 to +20; where a market fires alone it pays about nothing, and points-alone is
negative outright.

## 3. The control — is "all four fire" just "big edge"?

Against that market's own top-2,694 rows by raw |model − line|, so the bet counts match and the
comparison is between two RULES rather than two selectivities.

| market | n | confluence_roi | magnitude_roi | delta | one_sigma | rows_shared |
|---|---|---|---|---|---|---|
| points | 2698 | 17.48 | 15.85 | 1.64 | 1.80 | 54.53 |
| points_rebounds | 2698 | 17.73 | 15.98 | 1.75 | 1.80 | 54.68 |
| points_assists | 2698 | 17.48 | 14.12 | 3.36 | 1.80 | 55.42 |
| points_rebounds_assists | 2698 | 20.06 | 18.94 | 1.12 | 1.80 | 53.34 |

Confluence wins every row, but by roughly one sigma. **That is not enough to call it the better
selector** — read it as "these two rules pick overlapping sets of about equal quality" (they share
only ~55% of their rows, so they are genuinely different selections that happen to score alike).
The load-bearing half of this page is section 2's negative: the single-market fire is dead weight.

## 4. Which line to express it on

Same player-games, same opinion, four different lines. PRA pays the most because its line is the
biggest, so the same absolute disagreement is a smaller relative one and the book prices it closest
to even — the `need` column in `NBA_PROPS_ORIGINATOR_BRIEF.md` falls from 67% on a 0.5 blocks line
to 53% on a 20.5 PRA line.

**Bet ONE line per player-game, and make it PRA.** Taking points and PRA and pts+reb on the same
player is one position with three tickets, and they agree 98% of the time.
