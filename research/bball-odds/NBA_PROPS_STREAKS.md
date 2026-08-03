# NBA props — the line that moves against the player's own form

`nba_props_streaks.py`. **Regenerated wholesale; do not edit — put conclusions in
`NBA_PROPS_VERDICT.md`.**

The spot, stated in words before anything was computed: a player clears his number **3 straight
games** and tonight the book posts a number that has moved DOWN on him — or he misses 3
straight and the book moves it UP. Either way the line looks wrong to anyone reading his box
scores, and the question is whether the book is telling you something.

**Two readings of "the line moved against him", and they are different spots:**

| gapdef | definition | what it means |
|---|---|---|
| `vs_prev_line` | `line − his previous posted line` | did the book actually CUT him. **The literal question, and the clean one.** |
| `vs_form` | `line − his last-5 average` | where the number sits against his recent scoring. Entangled: a hot streak raises `avg5` by construction. |

**Two sides, both graded on every cell:**

- **`roi_line`** — side WITH the line. Under on hot-cheap, over on cold-rich. The "book knows" read.
- **`roi_form`** — side WITH the player's form. Over on hot, under on cold. What it looks like it offers.

`*_market` is that same side bet blind on every row of the market — the only honest reference for a
row filter, since betting one fixed side on a slice IS the blind bet on that slice. Venue `best`,
T-60 prices, 8 markets, 3 seasons. Everything is `shift(1)`-then-roll, inside a season, and
`vs_prev_line` additionally requires the previous game within 10 days.

**Grader oracle:** feeding the realised result into the bet rule returns **100.00%** over
46,913 rows. Signs are not inverted.

## 1. How often the spot happens

| market | rows | med_line | hot_pct | hot_vs_prev_line_mean | hot_vs_prev_line_n1 | hot_vs_form_mean | hot_vs_form_n1 | cold_pct | cold_vs_prev_line_mean | cold_vs_prev_line_n1 | cold_vs_form_mean | cold_vs_form_n1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| points | 46913 | 12.50 | 11.70 | 0.46 | 1190 | -2.29 | 3779 | 13.33 | -0.30 | 1412 | 1.83 | 3907 |
| points_rebounds_assists | 45652 | 21.50 | 11.74 | 0.61 | 1336 | -2.55 | 3682 | 13.22 | -0.42 | 1635 | 2.33 | 3955 |
| points_rebounds | 44041 | 18.50 | 11.47 | 0.56 | 1184 | -2.46 | 3470 | 13.33 | -0.40 | 1423 | 2.26 | 3911 |
| points_assists | 41806 | 16.50 | 12.00 | 0.51 | 1170 | -2.34 | 3405 | 12.73 | -0.36 | 1268 | 2.05 | 3384 |
| rebounds | 46054 | 4.50 | 10.97 | 0.18 | 531 | -1.04 | 2425 | 14.32 | -0.14 | 784 | 0.77 | 2572 |
| assists | 43324 | 2.50 | 12.18 | 0.16 | 416 | -0.83 | 2004 | 13.09 | -0.14 | 429 | 0.48 | 1248 |
| rebounds_assists | 41278 | 8.50 | 11.65 | 0.24 | 758 | -1.34 | 2798 | 13.61 | -0.19 | 920 | 1.05 | 2878 |
| threes | 41512 | 1.50 | 11.43 | 0.11 | 162 | -0.72 | 1430 | 16.02 | -0.08 | 216 | 0.42 | 847 |

Read the `vs_form_mean` columns first — they are the mechanical part. A hot player's line already
sits below his 5-game average on average, before the book does anything unusual, purely because the
streak is what raised the average. `vs_prev_line_mean` is the honest measure of what the book did.

## 2. Is "both" more than either parent?

Streak alone (≥3), gap alone (≥1.0 stat unit, no streak required), and both. Both sides shown.

| market | pattern | gapdef | line_market | line_streak | line_gap | line_both | line_lift | form_market | form_streak | form_gap | form_both | form_lift | both_n | one_sigma |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| points | hot-cheap | vs_prev_line | -0.29 | -0.66 | -0.20 | -1.23 | -0.94 | -5.17 | -4.61 | -5.49 | -4.29 | 0.88 | 1190 | 2.71 |
| points | hot-cheap | vs_form | -0.32 | -0.64 | 0.45 | -0.49 | -0.17 | -5.15 | -4.55 | -5.81 | -4.58 | 0.57 | 3779 | 1.52 |
| points | cold-rich | vs_prev_line | -5.17 | -6.51 | -3.92 | -3.56 | 1.60 | -0.29 | 0.69 | -0.84 | -0.32 | -0.03 | 1412 | 2.49 |
| points | cold-rich | vs_form | -5.15 | -6.80 | -4.21 | -7.26 | -2.11 | -0.32 | 0.88 | -0.79 | 1.93 | 2.25 | 3907 | 1.50 |
| points_rebounds_assists | hot-cheap | vs_prev_line | -0.97 | -1.13 | 0.11 | -5.21 | -4.24 | -6.16 | -5.76 | -7.76 | -3.23 | 2.93 | 1336 | 2.56 |
| points_rebounds_assists | hot-cheap | vs_form | -0.96 | -1.07 | -0.71 | -1.36 | -0.40 | -6.20 | -5.90 | -6.58 | -5.74 | 0.45 | 3682 | 1.54 |
| points_rebounds_assists | cold-rich | vs_prev_line | -6.16 | -5.86 | -4.52 | -3.11 | 3.05 | -0.97 | -1.82 | -1.98 | -4.56 | -3.59 | 1635 | 2.31 |
| points_rebounds_assists | cold-rich | vs_form | -6.20 | -6.02 | -5.54 | -5.76 | 0.44 | -0.96 | -1.64 | -1.40 | -1.72 | -0.75 | 3955 | 1.49 |
| points_rebounds | hot-cheap | vs_prev_line | -0.86 | -0.03 | 0.04 | 2.20 | 3.06 | -6.67 | -7.18 | -7.59 | -9.57 | -2.90 | 1184 | 2.72 |
| points_rebounds | hot-cheap | vs_form | -0.94 | -0.03 | -0.11 | 0.21 | 1.15 | -6.65 | -7.26 | -7.53 | -7.75 | -1.10 | 3470 | 1.59 |
| points_rebounds | cold-rich | vs_prev_line | -6.67 | -6.54 | -5.27 | -4.82 | 1.85 | -0.86 | -0.96 | -1.58 | -1.05 | -0.19 | 1423 | 2.48 |
| points_rebounds | cold-rich | vs_form | -6.65 | -6.87 | -5.57 | -7.10 | -0.44 | -0.94 | -0.85 | -1.55 | -0.01 | 0.93 | 3911 | 1.50 |
| points_assists | hot-cheap | vs_prev_line | -2.53 | -2.70 | -1.45 | -3.83 | -1.30 | -6.13 | -5.73 | -7.46 | -4.65 | 1.48 | 1170 | 2.73 |
| points_assists | hot-cheap | vs_form | -2.54 | -2.63 | -1.33 | -0.84 | 1.70 | -6.21 | -5.89 | -7.59 | -7.83 | -1.63 | 3405 | 1.60 |
| points_assists | cold-rich | vs_prev_line | -6.13 | -6.36 | -5.44 | -4.80 | 1.33 | -2.53 | -2.77 | -2.53 | -3.80 | -1.27 | 1268 | 2.63 |
| points_assists | cold-rich | vs_form | -6.21 | -6.82 | -4.72 | -7.91 | -1.70 | -2.54 | -2.27 | -3.69 | -0.77 | 1.77 | 3384 | 1.61 |
| rebounds | hot-cheap | vs_prev_line | 0.54 | 1.56 | -0.48 | 3.30 | 2.77 | -6.24 | -7.22 | -5.16 | -8.91 | -2.68 | 531 | 4.06 |
| rebounds | hot-cheap | vs_form | 0.49 | 1.45 | 0.08 | 1.93 | 1.44 | -6.25 | -7.16 | -5.99 | -7.46 | -1.20 | 2425 | 1.90 |
| rebounds | cold-rich | vs_prev_line | -6.24 | -5.93 | -7.83 | -8.23 | -1.99 | 0.54 | 0.11 | 2.30 | 2.91 | 2.38 | 784 | 3.34 |
| rebounds | cold-rich | vs_form | -6.25 | -6.07 | -8.72 | -7.16 | -0.91 | 0.49 | 0.10 | 2.72 | 0.86 | 0.37 | 2572 | 1.84 |
| assists | hot-cheap | vs_prev_line | -3.26 | -3.39 | -2.84 | -0.48 | 2.78 | -4.71 | -4.41 | -4.47 | -6.85 | -2.15 | 416 | 4.58 |
| assists | hot-cheap | vs_form | -3.26 | -3.19 | -1.75 | -2.69 | 0.57 | -4.79 | -4.61 | -4.87 | -3.42 | 1.37 | 2004 | 2.09 |
| assists | cold-rich | vs_prev_line | -4.71 | -3.97 | -5.02 | -7.72 | -3.02 | -3.26 | -4.20 | -2.02 | -0.43 | 2.83 | 429 | 4.51 |
| assists | cold-rich | vs_form | -4.79 | -4.11 | -6.08 | -4.37 | 0.42 | -3.26 | -4.17 | -0.94 | -1.05 | 2.22 | 1248 | 2.65 |
| rebounds_assists | hot-cheap | vs_prev_line | -1.34 | -2.36 | -1.09 | 2.17 | 3.50 | -7.20 | -5.86 | -7.32 | -10.90 | -3.70 | 758 | 3.40 |
| rebounds_assists | hot-cheap | vs_form | -1.20 | -2.12 | -1.72 | -2.76 | -1.57 | -7.40 | -6.15 | -6.57 | -4.95 | 2.45 | 2798 | 1.77 |
| rebounds_assists | cold-rich | vs_prev_line | -7.20 | -7.96 | -5.87 | -9.07 | -1.86 | -1.34 | -0.82 | -1.76 | -0.49 | 0.85 | 920 | 3.08 |
| rebounds_assists | cold-rich | vs_form | -7.40 | -8.51 | -8.98 | -8.61 | -1.21 | -1.20 | -0.39 | 0.64 | -0.25 | 0.94 | 2878 | 1.74 |
| threes | hot-cheap | vs_prev_line | -0.17 | -2.57 | -2.65 | -9.92 | -9.75 | -7.47 | -4.98 | -4.77 | 0.56 | 8.03 | 162 | 7.35 |
| threes | hot-cheap | vs_form | -0.18 | -2.75 | -1.31 | -5.68 | -5.50 | -7.49 | -4.67 | -6.25 | -2.41 | 5.08 | 1430 | 2.47 |
| threes | cold-rich | vs_prev_line | -7.47 | -9.70 | -7.80 | -16.23 | -8.75 | -0.17 | 0.55 | -0.55 | 1.71 | 1.88 | 216 | 6.36 |
| threes | cold-rich | vs_form | -7.49 | -10.05 | -9.31 | -12.68 | -5.19 | -0.18 | 0.80 | 2.67 | 5.69 | 5.87 | 847 | 3.21 |

## 3. Dose–response, streak held fixed

`theta` = how far the line has to have moved against him, in stat units. **A real threshold effect
is a slope.** If the money appears at one theta only it is an argmax, not a finding. Season strings
are in slate order.

| market | pattern | gapdef | theta | n | need | roi_line | line_szn | roi_form | form_szn |
|---|---|---|---|---|---|---|---|---|---|
| points | hot-cheap | vs_prev_line | 0.00 | 2791 | 53.20 | -3.27 | -5.5/-0.7/-3.8 | -2.82 | -1.4/-4.9/-2.1 |
| points | hot-cheap | vs_prev_line | 0.50 | 1252 | 53.27 | -0.70 | 2.5/-0.0/-3.6 | -5.18 | -10.6/-3.4/-2.8 |
| points | hot-cheap | vs_prev_line | 1.00 | 1190 | 53.23 | -1.23 | 1.2/-0.2/-3.8 | -4.29 | -8.7/-3.0/-2.3 |
| points | hot-cheap | vs_prev_line | 1.50 | 475 | 53.30 | -1.49 | 5.8/-12.5/2.0 | -6.22 | -13.9/4.9/-9.6 |
| points | hot-cheap | vs_prev_line | 2.00 | 457 | 53.25 | -2.42 | 3.3/-11.9/1.0 | -5.40 | -11.4/3.4/-8.0 |
| points | hot-cheap | vs_prev_line | 2.50 | 194 | 53.38 | -8.24 | 14.9/-29.5/-8.0 | 0.20 | -23.5/17.6/4.0 |
| points | hot-cheap | vs_form | 0.00 | 4537 | 53.26 | -0.64 | -1.4/-1.3/0.6 | -4.58 | -4.9/-3.3/-5.5 |
| points | hot-cheap | vs_form | 0.50 | 4255 | 53.26 | -0.46 | -1.4/-0.6/0.5 | -4.67 | -5.2/-3.6/-5.3 |
| points | hot-cheap | vs_form | 1.00 | 3779 | 53.25 | -0.49 | -1.9/-1.2/1.3 | -4.58 | -4.8/-3.0/-5.9 |
| points | hot-cheap | vs_form | 1.50 | 3438 | 53.28 | 0.18 | -1.2/-0.0/1.5 | -5.20 | -5.3/-4.2/-6.1 |
| points | hot-cheap | vs_form | 2.00 | 2955 | 53.26 | 0.44 | -1.5/2.1/0.4 | -5.75 | -6.0/-5.9/-5.4 |
| points | hot-cheap | vs_form | 2.50 | 2595 | 53.26 | 0.41 | -1.2/2.3/-0.1 | -5.33 | -6.0/-5.5/-4.6 |
| points | hot-cheap | vs_form | 3.00 | 2030 | 53.26 | 0.59 | 0.1/3.9/-2.1 | -5.91 | -7.3/-8.1/-2.9 |
| points | cold-rich | vs_prev_line | 0.00 | 3250 | 53.03 | -7.23 | -13.5/-1.7/-6.4 | 1.77 | 7.5/-4.9/2.5 |
| points | cold-rich | vs_prev_line | 0.50 | 1477 | 53.16 | -3.30 | 0.5/-4.0/-5.4 | -0.70 | -5.4/-1.4/3.3 |
| points | cold-rich | vs_prev_line | 1.00 | 1412 | 53.13 | -3.56 | 0.5/-3.8/-6.3 | -0.32 | -5.3/-1.4/4.2 |
| points | cold-rich | vs_prev_line | 1.50 | 641 | 53.23 | -3.46 | 4.4/-6.5/-6.1 | -0.15 | -8.9/-0.7/6.5 |
| points | cold-rich | vs_prev_line | 2.00 | 617 | 53.20 | -4.17 | 4.3/-7.7/-6.9 | 1.04 | -8.3/1.0/7.6 |
| points | cold-rich | vs_prev_line | 2.50 | 304 | 53.10 | -1.76 | -2.1/1.2/-4.5 | 0.07 | 0.1/-6.2/6.4 |
| points | cold-rich | vs_form | 0.00 | 4851 | 53.08 | -6.61 | -9.8/-1.9/-7.7 | 0.87 | 3.3/-4.5/3.3 |
| points | cold-rich | vs_form | 0.50 | 4498 | 53.07 | -6.70 | -9.7/-1.8/-8.2 | 1.12 | 3.2/-4.3/3.9 |
| points | cold-rich | vs_form | 1.00 | 3907 | 53.08 | -7.26 | -10.4/-3.1/-8.0 | 1.93 | 4.5/-3.0/3.8 |
| points | cold-rich | vs_form | 1.50 | 3474 | 53.06 | -7.08 | -10.9/-2.4/-7.6 | 1.94 | 5.2/-3.7/3.9 |
| points | cold-rich | vs_form | 2.00 | 2848 | 53.12 | -7.25 | -11.2/-1.8/-8.3 | 2.44 | 5.6/-3.6/4.7 |
| points | cold-rich | vs_form | 2.50 | 2402 | 53.16 | -7.96 | -13.3/-0.7/-9.6 | 3.33 | 7.6/-4.2/6.1 |
| points | cold-rich | vs_form | 3.00 | 1863 | 53.18 | -6.70 | -9.3/1.2/-11.5 | 1.95 | 4.3/-6.4/7.3 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 0.00 | 2523 | 53.33 | -4.24 | -4.0/-2.8/-5.8 | -3.70 | -4.3/-3.4/-3.5 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 0.50 | 1461 | 53.34 | -3.79 | -2.1/-2.5/-6.1 | -5.13 | -6.5/-5.1/-4.2 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 1.00 | 1336 | 53.28 | -5.21 | -3.5/-5.6/-6.1 | -3.23 | -4.8/-1.6/-3.6 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 1.50 | 736 | 53.42 | -6.56 | -3.1/-8.6/-7.0 | -1.67 | -6.0/0.6/-0.8 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 2.00 | 679 | 53.38 | -7.14 | -4.0/-9.9/-7.0 | -0.83 | -5.0/2.4/-0.8 |
| points_rebounds_assists | hot-cheap | vs_prev_line | 2.50 | 383 | 53.50 | -6.38 | -10.0/-8.7/-2.7 | -2.51 | -1.3/-1.3/-4.1 |
| points_rebounds_assists | hot-cheap | vs_form | 0.00 | 4212 | 53.39 | -0.34 | 0.4/1.0/-2.2 | -6.75 | -8.1/-6.4/-6.0 |
| points_rebounds_assists | hot-cheap | vs_form | 0.50 | 4013 | 53.39 | -0.55 | 1.3/-0.1/-2.5 | -6.56 | -9.1/-5.4/-5.6 |
| points_rebounds_assists | hot-cheap | vs_form | 1.00 | 3682 | 53.37 | -1.36 | -1.8/-0.5/-1.9 | -5.74 | -6.1/-4.7/-6.4 |
| points_rebounds_assists | hot-cheap | vs_form | 1.50 | 3408 | 53.38 | -0.76 | -1.5/-0.1/-0.8 | -6.23 | -6.6/-4.7/-7.4 |
| points_rebounds_assists | hot-cheap | vs_form | 2.00 | 3011 | 53.36 | -0.71 | -0.8/-1.4/0.0 | -6.32 | -6.9/-3.4/-8.6 |
| points_rebounds_assists | hot-cheap | vs_form | 2.50 | 2713 | 53.36 | 0.09 | -1.3/-0.2/1.5 | -7.11 | -6.2/-4.9/-9.9 |
| points_rebounds_assists | hot-cheap | vs_form | 3.00 | 2320 | 53.34 | 0.24 | 0.2/1.1/-0.6 | -7.35 | -7.8/-5.6/-8.7 |
| points_rebounds_assists | cold-rich | vs_prev_line | 0.00 | 2796 | 53.05 | -4.73 | -6.7/-5.5/-2.1 | -2.73 | -0.2/-1.9/-5.8 |
| points_rebounds_assists | cold-rich | vs_prev_line | 0.50 | 1728 | 53.11 | -2.29 | -0.8/-5.3/-0.6 | -5.39 | -6.7/-1.6/-7.9 |
| points_rebounds_assists | cold-rich | vs_prev_line | 1.00 | 1635 | 53.07 | -3.11 | -2.1/-5.9/-1.2 | -4.56 | -5.1/-1.1/-7.4 |
| points_rebounds_assists | cold-rich | vs_prev_line | 1.50 | 930 | 53.15 | -4.10 | -8.8/-4.9/0.3 | -3.39 | 1.4/-1.1/-9.3 |
| points_rebounds_assists | cold-rich | vs_prev_line | 2.00 | 873 | 53.13 | -3.60 | -8.5/-5.7/2.4 | -3.44 | 1.5/0.0/-11.0 |
| points_rebounds_assists | cold-rich | vs_prev_line | 2.50 | 518 | 53.19 | -6.63 | -11.8/-6.6/-2.8 | -0.01 | 6.3/1.4/-6.0 |
| points_rebounds_assists | cold-rich | vs_form | 0.00 | 4638 | 53.08 | -5.47 | -7.1/-4.2/-5.1 | -2.19 | -0.1/-3.8/-2.6 |
| points_rebounds_assists | cold-rich | vs_form | 0.50 | 4360 | 53.07 | -5.69 | -7.2/-4.4/-5.5 | -1.96 | -0.2/-3.4/-2.2 |
| points_rebounds_assists | cold-rich | vs_form | 1.00 | 3955 | 53.06 | -5.76 | -7.0/-4.5/-5.8 | -1.72 | -0.1/-3.3/-1.8 |
| points_rebounds_assists | cold-rich | vs_form | 1.50 | 3665 | 53.06 | -5.38 | -7.3/-4.4/-4.6 | -1.85 | 0.6/-3.0/-3.0 |
| points_rebounds_assists | cold-rich | vs_form | 2.00 | 3215 | 53.07 | -6.16 | -7.0/-5.9/-5.6 | -1.02 | 0.3/-1.3/-2.0 |
| points_rebounds_assists | cold-rich | vs_form | 2.50 | 2874 | 53.07 | -6.56 | -8.4/-6.2/-5.2 | -0.51 | 1.1/-0.3/-2.2 |
| points_rebounds_assists | cold-rich | vs_form | 3.00 | 2409 | 53.06 | -6.64 | -9.7/-6.4/-4.0 | -0.11 | 2.9/0.4/-3.5 |
| points_rebounds | hot-cheap | vs_prev_line | 0.00 | 2417 | 53.35 | -1.03 | -3.1/-0.1/0.0 | -6.26 | -4.2/-7.4/-7.0 |
| points_rebounds | hot-cheap | vs_prev_line | 0.50 | 1307 | 53.40 | 1.96 | 4.1/0.6/1.7 | -9.57 | -11.7/-8.1/-9.4 |
| points_rebounds | hot-cheap | vs_prev_line | 1.00 | 1184 | 53.37 | 2.20 | 3.7/1.5/1.6 | -9.57 | -11.1/-8.7/-9.2 |
| points_rebounds | hot-cheap | vs_prev_line | 1.50 | 565 | 53.30 | -1.51 | -7.0/-4.9/5.3 | -7.16 | -0.9/-1.7/-16.3 |
| points_rebounds | hot-cheap | vs_prev_line | 2.00 | 507 | 53.21 | -2.20 | -7.6/-4.9/4.7 | -7.16 | -0.1/-2.8/-16.9 |
| points_rebounds | hot-cheap | vs_prev_line | 2.50 | 268 | 53.25 | -5.53 | -9.3/-9.3/-0.4 | -4.81 | -0.2/1.3/-12.4 |
| points_rebounds | hot-cheap | vs_form | 0.00 | 4037 | 53.40 | -0.16 | 0.1/-0.6/0.1 | -7.49 | -8.5/-5.4/-8.6 |
| points_rebounds | hot-cheap | vs_form | 0.50 | 3825 | 53.39 | -0.11 | 0.4/-0.5/-0.2 | -7.64 | -8.9/-5.7/-8.4 |
| points_rebounds | hot-cheap | vs_form | 1.00 | 3470 | 53.39 | 0.21 | 0.8/-0.3/0.2 | -7.75 | -9.0/-5.7/-8.7 |
| points_rebounds | hot-cheap | vs_form | 1.50 | 3190 | 53.37 | 0.36 | 0.5/0.2/0.4 | -7.97 | -9.2/-6.0/-8.9 |
| points_rebounds | hot-cheap | vs_form | 2.00 | 2775 | 53.37 | 0.33 | -0.2/0.4/0.7 | -8.12 | -8.3/-6.3/-9.6 |
| points_rebounds | hot-cheap | vs_form | 2.50 | 2516 | 53.35 | -0.14 | -0.5/0.9/-0.8 | -7.42 | -7.9/-6.6/-7.9 |
| points_rebounds | hot-cheap | vs_form | 3.00 | 2127 | 53.33 | 0.65 | 1.3/1.5/-0.7 | -8.31 | -9.6/-7.5/-8.0 |
| points_rebounds | cold-rich | vs_prev_line | 0.00 | 2783 | 53.00 | -7.47 | -14.3/-1.0/-6.7 | 0.29 | 6.5/-5.3/-0.6 |
| points_rebounds | cold-rich | vs_prev_line | 0.50 | 1564 | 53.02 | -4.31 | -7.8/-3.3/-2.4 | -2.19 | 2.1/-3.3/-4.6 |
| points_rebounds | cold-rich | vs_prev_line | 1.00 | 1423 | 52.98 | -4.82 | -7.7/-3.3/-3.7 | -1.05 | 2.3/-2.5/-2.6 |
| points_rebounds | cold-rich | vs_prev_line | 1.50 | 791 | 53.03 | -9.30 | -10.9/-12.2/-5.1 | 2.66 | 1.3/5.4/0.9 |
| points_rebounds | cold-rich | vs_prev_line | 2.00 | 719 | 52.99 | -9.82 | -9.4/-11.2/-8.7 | 3.68 | -0.8/5.3/5.8 |
| points_rebounds | cold-rich | vs_prev_line | 2.50 | 395 | 53.05 | -11.59 | -15.3/-14.6/-5.6 | 6.07 | 6.4/8.6/3.2 |
| points_rebounds | cold-rich | vs_form | 0.00 | 4583 | 53.10 | -7.33 | -11.8/-2.6/-7.3 | -0.01 | 3.8/-3.8/-0.3 |
| points_rebounds | cold-rich | vs_form | 0.50 | 4326 | 53.09 | -7.63 | -11.9/-2.8/-7.8 | 0.27 | 4.0/-3.7/0.2 |
| points_rebounds | cold-rich | vs_form | 1.00 | 3911 | 53.08 | -7.10 | -10.7/-2.6/-7.7 | -0.01 | 3.3/-3.9/0.3 |
| points_rebounds | cold-rich | vs_form | 1.50 | 3581 | 53.05 | -7.32 | -11.7/-2.2/-7.7 | 0.38 | 4.4/-3.8/0.3 |
| points_rebounds | cold-rich | vs_form | 2.00 | 3092 | 53.04 | -9.15 | -13.9/-5.1/-8.1 | 1.97 | 6.4/-1.2/0.5 |
| points_rebounds | cold-rich | vs_form | 2.50 | 2736 | 53.02 | -8.28 | -13.0/-5.7/-5.9 | 1.09 | 5.4/-1.1/-1.4 |
| points_rebounds | cold-rich | vs_form | 3.00 | 2251 | 53.04 | -8.49 | -15.1/-4.5/-5.5 | 1.54 | 7.0/-1.9/-0.8 |
| points_assists | hot-cheap | vs_prev_line | 0.00 | 2406 | 53.26 | -6.00 | -8.7/-3.0/-6.4 | -2.83 | -1.6/-4.4/-2.4 |
| points_assists | hot-cheap | vs_prev_line | 0.50 | 1280 | 53.27 | -2.81 | -1.0/-3.5/-3.6 | -5.36 | -9.0/-1.8/-5.9 |
| points_assists | hot-cheap | vs_prev_line | 1.00 | 1170 | 53.23 | -3.83 | -1.8/-3.4/-6.1 | -4.65 | -8.6/-2.1/-3.7 |
| points_assists | hot-cheap | vs_prev_line | 1.50 | 562 | 53.32 | -5.19 | -7.3/-6.7/-2.3 | -4.35 | -4.7/-2.6/-5.7 |
| points_assists | hot-cheap | vs_prev_line | 2.00 | 503 | 53.24 | -3.69 | -7.3/-3.1/-1.4 | -5.59 | -4.7/-5.7/-6.3 |
| points_assists | hot-cheap | vs_prev_line | 2.50 | 264 | 53.40 | -7.91 | -9.4/-8.2/-6.4 | -1.59 | -3.8/1.1/-2.6 |
| points_assists | hot-cheap | vs_form | 0.00 | 4041 | 53.33 | -2.39 | -6.6/1.9/-2.7 | -6.27 | -3.3/-9.0/-6.4 |
| points_assists | hot-cheap | vs_form | 0.50 | 3781 | 53.33 | -1.90 | -4.5/1.0/-2.4 | -6.79 | -5.3/-8.3/-6.6 |
| points_assists | hot-cheap | vs_form | 1.00 | 3405 | 53.32 | -0.84 | -3.9/1.7/-0.6 | -7.83 | -6.1/-8.9/-8.4 |
| points_assists | hot-cheap | vs_form | 1.50 | 3148 | 53.30 | -0.61 | -4.3/2.4/-0.3 | -7.92 | -5.6/-9.5/-8.5 |
| points_assists | hot-cheap | vs_form | 2.00 | 2712 | 53.29 | -0.71 | -5.0/2.4/0.2 | -7.73 | -5.0/-9.1/-8.9 |
| points_assists | hot-cheap | vs_form | 2.50 | 2394 | 53.30 | -1.12 | -4.4/0.4/0.4 | -7.25 | -5.6/-7.2/-8.9 |
| points_assists | hot-cheap | vs_form | 3.00 | 1968 | 53.28 | -1.85 | -5.2/-0.9/0.2 | -6.78 | -5.6/-6.1/-8.7 |
| points_assists | cold-rich | vs_prev_line | 0.00 | 2593 | 53.05 | -7.12 | -6.1/-5.5/-9.7 | -1.83 | -2.3/-3.4/0.2 |
| points_assists | cold-rich | vs_prev_line | 0.50 | 1385 | 53.07 | -6.49 | -3.1/-6.3/-9.3 | -2.47 | -6.2/-2.7/0.6 |
| points_assists | cold-rich | vs_prev_line | 1.00 | 1268 | 53.03 | -4.80 | -0.8/-6.4/-6.6 | -3.80 | -8.4/-2.4/-1.3 |
| points_assists | cold-rich | vs_prev_line | 1.50 | 680 | 53.06 | -3.89 | -3.0/-7.3/-1.5 | -4.99 | -6.7/-0.6/-7.7 |
| points_assists | cold-rich | vs_prev_line | 2.00 | 620 | 53.00 | -3.66 | -3.4/-5.7/-1.9 | -5.13 | -6.2/-1.7/-7.6 |
| points_assists | cold-rich | vs_prev_line | 2.50 | 334 | 53.14 | -0.62 | -3.7/0.3/1.0 | -8.36 | -5.3/-7.8/-11.1 |
| points_assists | cold-rich | vs_form | 0.00 | 4097 | 53.13 | -6.93 | -7.0/-2.3/-11.0 | -1.85 | -2.0/-5.9/1.9 |
| points_assists | cold-rich | vs_form | 0.50 | 3822 | 53.12 | -7.33 | -6.8/-3.4/-11.3 | -1.40 | -2.2/-4.7/2.3 |
| points_assists | cold-rich | vs_form | 1.00 | 3384 | 53.10 | -7.91 | -7.7/-3.8/-11.7 | -0.77 | -1.0/-4.4/2.6 |
| points_assists | cold-rich | vs_form | 1.50 | 3062 | 53.09 | -7.75 | -7.8/-3.5/-11.4 | -0.87 | -0.8/-4.3/2.1 |
| points_assists | cold-rich | vs_form | 2.00 | 2630 | 53.11 | -8.83 | -8.0/-5.4/-12.3 | 0.26 | -0.4/-2.6/3.2 |
| points_assists | cold-rich | vs_form | 2.50 | 2323 | 53.10 | -8.97 | -8.4/-4.0/-13.4 | 0.58 | -0.4/-3.2/4.4 |
| points_assists | cold-rich | vs_form | 3.00 | 1870 | 53.13 | -7.21 | -5.9/-0.3/-14.1 | -1.20 | -3.2/-6.5/4.9 |
| rebounds | hot-cheap | vs_prev_line | 0.00 | 3564 | 52.54 | 1.00 | 5.2/-4.2/2.0 | -6.99 | -10.4/-2.3/-8.2 |
| rebounds | hot-cheap | vs_prev_line | 0.50 | 570 | 52.25 | 0.17 | 14.0/-10.1/-0.9 | -6.30 | -17.4/0.3/-4.0 |
| rebounds | hot-cheap | vs_prev_line | 1.00 | 531 | 51.97 | 3.30 | 16.2/-3.7/-0.5 | -8.91 | -20.0/-4.6/-4.3 |
| rebounds | hot-cheap | vs_form | 0.00 | 4266 | 53.04 | 1.34 | 4.2/-2.1/2.0 | -6.67 | -8.5/-3.3/-8.2 |
| rebounds | hot-cheap | vs_form | 0.50 | 3631 | 52.88 | 1.58 | 6.1/-2.4/1.3 | -6.68 | -10.6/-2.8/-6.9 |
| rebounds | hot-cheap | vs_form | 1.00 | 2425 | 52.64 | 1.93 | 8.7/-3.3/1.1 | -7.46 | -14.2/-2.3/-6.5 |
| rebounds | hot-cheap | vs_form | 1.50 | 1694 | 52.56 | -0.25 | 5.9/-4.0/-1.7 | -4.71 | -11.3/-1.5/-2.5 |
| rebounds | hot-cheap | vs_form | 2.00 | 889 | 52.76 | 2.34 | 11.9/-3.9/0.6 | -6.31 | -18.0/-1.6/-1.5 |
| rebounds | hot-cheap | vs_form | 2.50 | 531 | 52.79 | 2.60 | 20.0/-6.8/-1.3 | -5.34 | -23.6/1.8/1.2 |
| rebounds | hot-cheap | vs_form | 3.00 | 248 | 52.71 | 0.72 | 14.1/-10.1/-1.0 | -1.41 | -18.4/4.2/6.5 |
| rebounds | cold-rich | vs_prev_line | 0.00 | 4669 | 51.26 | -6.50 | -6.1/-6.9/-6.5 | 1.22 | 0.5/2.5/0.6 |
| rebounds | cold-rich | vs_prev_line | 0.50 | 838 | 51.56 | -9.00 | -3.4/-15.7/-6.9 | 3.51 | -2.3/11.3/0.5 |
| rebounds | cold-rich | vs_prev_line | 1.00 | 784 | 51.43 | -8.23 | -3.4/-14.5/-5.9 | 2.91 | -1.9/10.2/-0.3 |
| rebounds | cold-rich | vs_prev_line | 1.50 | 79 | 51.20 | -5.34 | -/-16.1/- | 3.20 | -/11.4/- |
| rebounds | cold-rich | vs_prev_line | 2.00 | 76 | 51.24 | -4.12 | -/-11.5/- | 2.72 | -/8.1/- |
| rebounds | cold-rich | vs_form | 0.00 | 5218 | 51.70 | -6.46 | -7.0/-4.5/-7.9 | 1.08 | 1.5/-0.6/2.3 |
| rebounds | cold-rich | vs_form | 0.50 | 4282 | 51.48 | -6.71 | -4.9/-4.9/-10.3 | 0.89 | -0.6/-0.5/3.8 |
| rebounds | cold-rich | vs_form | 1.00 | 2572 | 51.41 | -7.16 | -6.2/-5.5/-9.8 | 0.86 | 0.3/0.5/1.8 |
| rebounds | cold-rich | vs_form | 1.50 | 1573 | 51.57 | -8.11 | -6.2/-7.3/-10.9 | 2.01 | 1.9/1.1/3.0 |
| rebounds | cold-rich | vs_form | 2.00 | 672 | 51.85 | -3.90 | -0.7/-1.3/-9.5 | -1.07 | -0.4/-4.4/1.9 |
| rebounds | cold-rich | vs_form | 2.50 | 350 | 51.91 | -2.19 | -2.1/2.2/-6.8 | -2.07 | -1.5/-6.0/1.5 |
| rebounds | cold-rich | vs_form | 3.00 | 139 | 52.21 | -5.08 | -5.0/-2.6/-8.0 | -2.75 | -0.2/-3.2/-4.0 |
| assists | hot-cheap | vs_prev_line | 0.00 | 3897 | 51.53 | -2.74 | -2.8/-3.5/-1.9 | -4.98 | -5.0/-6.4/-3.4 |
| assists | hot-cheap | vs_prev_line | 0.50 | 458 | 50.57 | -0.34 | 5.9/-11.6/4.1 | -8.55 | -11.6/-1.5/-11.9 |
| assists | hot-cheap | vs_prev_line | 1.00 | 416 | 50.20 | -0.48 | 6.8/-12.6/3.5 | -6.85 | -11.6/1.4/-9.7 |
| assists | hot-cheap | vs_form | 0.00 | 4501 | 52.23 | -3.03 | -3.8/-3.0/-2.3 | -4.95 | -3.9/-6.6/-4.3 |
| assists | hot-cheap | vs_form | 0.50 | 3637 | 51.59 | -3.51 | -3.5/-3.7/-3.3 | -4.32 | -3.9/-5.5/-3.5 |
| assists | hot-cheap | vs_form | 1.00 | 2004 | 51.34 | -2.69 | -2.0/-3.6/-2.4 | -3.42 | -2.6/-5.5/-2.3 |
| assists | hot-cheap | vs_form | 1.50 | 1156 | 51.69 | -2.17 | 0.5/-2.3/-4.4 | -3.78 | -4.7/-6.1/-1.1 |
| assists | hot-cheap | vs_form | 2.00 | 451 | 51.93 | -1.30 | 1.5/4.8/-8.2 | -4.36 | -3.3/-11.6/0.0 |
| assists | hot-cheap | vs_form | 2.50 | 238 | 52.52 | -8.38 | -8.9/-1.4/-13.0 | 3.56 | 6.1/-4.7/7.3 |
| assists | hot-cheap | vs_form | 3.00 | 78 | 52.02 | -27.95 | -/-/-32.5 | 17.46 | -/-/14.6 |
| assists | cold-rich | vs_prev_line | 0.00 | 4241 | 49.55 | -3.72 | -2.4/-3.1/-5.4 | -4.33 | -5.0/-5.2/-2.9 |
| assists | cold-rich | vs_prev_line | 0.50 | 461 | 49.83 | -9.29 | 1.6/-15.7/-9.6 | 0.08 | -6.4/4.7/-0.4 |
| assists | cold-rich | vs_prev_line | 1.00 | 429 | 49.55 | -7.72 | 1.7/-12.4/-9.1 | -0.43 | -5.8/2.5/0.1 |
| assists | cold-rich | vs_form | 0.00 | 4229 | 49.73 | -5.11 | -2.6/-3.7/-8.5 | -3.01 | -4.8/-4.4/-0.3 |
| assists | cold-rich | vs_form | 0.50 | 3040 | 49.12 | -5.33 | -4.3/-1.4/-9.8 | -2.00 | -2.7/-5.5/1.8 |
| assists | cold-rich | vs_form | 1.00 | 1248 | 49.82 | -4.37 | -1.1/5.4/-16.1 | -1.05 | -2.5/-9.6/8.2 |
| assists | cold-rich | vs_form | 1.50 | 634 | 50.62 | -4.01 | 2.2/10.3/-21.3 | 0.08 | -2.9/-12.9/13.9 |
| assists | cold-rich | vs_form | 2.00 | 183 | 52.26 | -16.50 | -12.5/-1.4/-31.4 | 7.46 | 6.4/-7.9/20.5 |
| assists | cold-rich | vs_form | 2.50 | 81 | 52.67 | -25.68 | -/-/-41.4 | 12.76 | -/-/27.9 |
| rebounds_assists | hot-cheap | vs_prev_line | 0.00 | 2940 | 52.80 | -1.34 | -2.0/-2.2/0.2 | -7.31 | -6.1/-6.8/-9.1 |
| rebounds_assists | hot-cheap | vs_prev_line | 0.50 | 839 | 52.56 | 1.73 | 2.6/2.3/0.5 | -11.11 | -11.1/-11.8/-10.5 |
| rebounds_assists | hot-cheap | vs_prev_line | 1.00 | 758 | 52.46 | 2.17 | 2.5/2.5/1.5 | -10.90 | -10.9/-11.8/-10.0 |
| rebounds_assists | hot-cheap | vs_prev_line | 1.50 | 145 | 52.50 | 5.88 | -13.6/22.3/9.2 | -15.83 | 1.1/-31.1/-18.0 |
| rebounds_assists | hot-cheap | vs_prev_line | 2.00 | 129 | 52.30 | 3.28 | -15.4/16.9/10.0 | -12.36 | 3.3/-25.9/-16.0 |
| rebounds_assists | hot-cheap | vs_form | 0.00 | 4018 | 53.12 | -2.31 | -2.1/-3.5/-1.5 | -5.84 | -6.1/-4.0/-7.3 |
| rebounds_assists | hot-cheap | vs_form | 0.50 | 3566 | 53.03 | -1.56 | -0.9/-1.9/-1.9 | -6.49 | -7.3/-5.3/-6.8 |
| rebounds_assists | hot-cheap | vs_form | 1.00 | 2798 | 52.90 | -2.76 | -1.0/-2.4/-4.9 | -4.95 | -6.6/-4.4/-3.8 |
| rebounds_assists | hot-cheap | vs_form | 1.50 | 2231 | 52.85 | -1.40 | 2.3/-1.9/-4.3 | -6.37 | -9.1/-5.7/-4.5 |
| rebounds_assists | hot-cheap | vs_form | 2.00 | 1436 | 52.68 | -1.18 | -0.0/1.4/-4.6 | -6.37 | -6.3/-8.8/-4.1 |
| rebounds_assists | hot-cheap | vs_form | 2.50 | 1026 | 52.69 | -0.25 | 1.0/3.6/-4.7 | -7.37 | -9.1/-10.6/-3.0 |
| rebounds_assists | hot-cheap | vs_form | 3.00 | 579 | 52.77 | 1.01 | -0.7/1.6/1.9 | -8.12 | -7.0/-5.9/-11.0 |
| rebounds_assists | cold-rich | vs_prev_line | 0.00 | 3456 | 52.22 | -9.41 | -9.9/-8.5/-9.9 | 0.19 | 0.7/-0.6/0.4 |
| rebounds_assists | cold-rich | vs_prev_line | 0.50 | 1028 | 52.19 | -8.88 | -5.1/-5.7/-15.7 | -0.99 | -4.7/-2.5/4.1 |
| rebounds_assists | cold-rich | vs_prev_line | 1.00 | 920 | 51.94 | -9.07 | -5.4/-6.4/-15.8 | -0.49 | -4.0/-1.4/4.2 |
| rebounds_assists | cold-rich | vs_prev_line | 1.50 | 196 | 52.53 | -14.27 | -12.7/-16.2/-13.7 | 7.02 | 3.1/10.0/7.4 |
| rebounds_assists | cold-rich | vs_prev_line | 2.00 | 173 | 52.37 | -17.84 | -20.5/-18.6/-14.7 | 11.14 | 10.6/15.0/7.8 |
| rebounds_assists | cold-rich | vs_form | 0.00 | 4476 | 52.68 | -8.46 | -8.0/-9.3/-8.1 | -0.62 | -0.7/0.3/-1.5 |
| rebounds_assists | cold-rich | vs_form | 0.50 | 3892 | 52.54 | -9.30 | -8.0/-9.3/-10.7 | 0.28 | -0.4/0.5/0.8 |
| rebounds_assists | cold-rich | vs_form | 1.00 | 2878 | 52.44 | -8.61 | -8.5/-8.0/-9.3 | -0.25 | 0.5/-0.7/-0.6 |
| rebounds_assists | cold-rich | vs_form | 1.50 | 2184 | 52.40 | -8.11 | -8.3/-6.5/-9.4 | -0.57 | 0.6/-1.6/-0.8 |
| rebounds_assists | cold-rich | vs_form | 2.00 | 1276 | 52.43 | -8.51 | -7.7/-6.4/-11.3 | -0.31 | -1.2/-0.9/1.1 |
| rebounds_assists | cold-rich | vs_form | 2.50 | 849 | 52.37 | -9.87 | -7.6/-7.5/-14.1 | 1.83 | 0.1/0.7/4.4 |
| rebounds_assists | cold-rich | vs_form | 3.00 | 430 | 52.50 | -11.10 | -9.5/-2.4/-19.2 | 2.68 | 1.1/-2.8/8.4 |
| threes | hot-cheap | vs_prev_line | 0.00 | 3992 | 49.95 | -3.62 | -9.2/-2.1/0.1 | -3.59 | 0.1/-4.5/-6.2 |
| threes | hot-cheap | vs_prev_line | 0.50 | 175 | 47.80 | -13.88 | -38.9/18.6/-33.6 | 2.12 | 21.1/-19.3/13.0 |
| threes | hot-cheap | vs_prev_line | 1.00 | 162 | 47.28 | -9.92 | -34.8/22.6/-30.1 | 0.56 | 18.0/-19.9/11.6 |
| threes | hot-cheap | vs_form | 0.00 | 4228 | 50.51 | -3.15 | -7.6/-2.4/0.4 | -3.93 | -1.2/-3.7/-6.8 |
| threes | hot-cheap | vs_form | 0.50 | 3316 | 49.63 | -3.75 | -9.4/-2.2/0.1 | -3.68 | 0.4/-4.2/-7.0 |
| threes | hot-cheap | vs_form | 1.00 | 1430 | 49.02 | -5.68 | -10.5/-4.1/-3.2 | -2.41 | 2.2/-3.6/-5.0 |
| threes | hot-cheap | vs_form | 1.50 | 610 | 48.87 | -4.39 | -5.7/-2.6/-5.3 | -4.75 | -2.5/-6.1/-5.0 |
| threes | hot-cheap | vs_form | 2.00 | 129 | 48.90 | -12.15 | -19.1/-18.5/-3.0 | 2.35 | 8.0/11.6/-8.4 |
| threes | cold-rich | vs_prev_line | 0.00 | 5647 | 44.56 | -10.42 | -14.4/-4.6/-12.0 | 1.30 | 4.5/-4.1/3.1 |
| threes | cold-rich | vs_prev_line | 0.50 | 232 | 46.99 | -15.87 | -30.9/5.9/-25.9 | 0.73 | 15.3/-16.2/6.4 |
| threes | cold-rich | vs_prev_line | 1.00 | 216 | 46.20 | -16.23 | -32.1/6.6/-28.1 | 1.71 | 16.6/-16.1/9.0 |
| threes | cold-rich | vs_form | 0.00 | 5402 | 44.23 | -11.32 | -14.6/-4.7/-14.0 | 1.50 | 4.2/-4.9/4.5 |
| threes | cold-rich | vs_form | 0.50 | 3519 | 43.22 | -12.56 | -17.8/-4.5/-14.7 | 2.84 | 6.5/-4.5/5.7 |
| threes | cold-rich | vs_form | 1.00 | 847 | 46.44 | -12.68 | -22.1/-5.2/-10.3 | 5.69 | 12.8/-2.1/5.4 |
| threes | cold-rich | vs_form | 1.50 | 184 | 48.37 | -13.32 | -30.1/15.0/-13.0 | 9.11 | 19.6/-15.4/13.3 |

## 4. Pooled across markets, gap scaled by the player's own volatility

`z = gap / sd10`. Scaling matters: 2 points off a 30-point line and 2 rebounds off a 5-rebound line
are not the same event, and pooling raw gaps would let the points market write the answer.

| pattern | gapdef | z_theta | n | need | roi_line | line_szn | roi_form | form_szn | one_sigma |
|---|---|---|---|---|---|---|---|---|---|
| hot-cheap | vs_prev_line | 0.00 | 24003 | 52.27 | -2.53 | -3.6/-2.6/-1.4 | -4.80 | -4.2/-4.7/-5.5 | 0.62 |
| hot-cheap | vs_prev_line | 0.25 | 3742 | 52.31 | -3.55 | -1.4/-6.5/-2.6 | -4.93 | -7.1/-1.9/-5.9 | 1.56 |
| hot-cheap | vs_prev_line | 0.50 | 1256 | 51.24 | -3.00 | -4.6/-3.1/-1.6 | -4.67 | -4.8/-3.2/-5.9 | 2.75 |
| hot-cheap | vs_prev_line | 0.75 | 441 | 50.44 | -2.73 | -15.8/2.1/5.4 | -5.93 | 5.9/-11.5/-12.3 | 4.71 |
| hot-cheap | vs_prev_line | 1.00 | 164 | 50.20 | -7.87 | -34.2/14.1/0.2 | -0.58 | 18.0/-21.3/-2.3 | 7.72 |
| hot-cheap | vs_form | 0.00 | 33074 | 52.76 | -1.30 | -2.2/-1.4/-0.4 | -5.74 | -5.4/-5.0/-6.8 | 0.52 |
| hot-cheap | vs_form | 0.25 | 25619 | 52.45 | -1.11 | -1.9/-1.1/-0.4 | -5.97 | -6.1/-5.0/-6.8 | 0.60 |
| hot-cheap | vs_form | 0.50 | 16523 | 51.98 | -1.64 | -2.3/-2.2/-0.6 | -5.46 | -5.6/-4.1/-6.6 | 0.75 |
| hot-cheap | vs_form | 0.75 | 8271 | 51.38 | -4.29 | -3.7/-6.3/-2.9 | -3.26 | -4.7/-1.2/-4.0 | 1.07 |
| hot-cheap | vs_form | 1.00 | 3308 | 50.88 | -9.85 | -11.2/-14.9/-3.7 | 1.74 | 2.6/5.4/-2.6 | 1.69 |
| cold-rich | vs_prev_line | 0.00 | 28634 | 50.56 | -7.14 | -9.4/-4.5/-7.6 | -0.33 | 1.8/-2.7/-0.1 | 0.58 |
| cold-rich | vs_prev_line | 0.25 | 4882 | 51.99 | -7.56 | -7.5/-7.5/-7.6 | 0.25 | -0.4/0.6/0.3 | 1.37 |
| cold-rich | vs_prev_line | 0.50 | 2041 | 51.10 | -9.72 | -9.5/-9.7/-9.9 | 1.89 | 0.8/2.0/2.6 | 2.15 |
| cold-rich | vs_prev_line | 0.75 | 859 | 50.28 | -14.05 | -14.0/-17.1/-10.9 | 5.47 | 2.5/9.5/3.1 | 3.33 |
| cold-rich | vs_prev_line | 1.00 | 392 | 49.88 | -10.61 | 5.5/-18.1/-12.4 | 4.87 | -17.0/12.6/9.8 | 4.97 |
| cold-rich | vs_form | 0.00 | 36599 | 51.01 | -7.20 | -8.9/-4.2/-8.4 | -0.45 | 1.1/-3.2/0.7 | 0.51 |
| cold-rich | vs_form | 0.25 | 27198 | 50.52 | -7.45 | -9.0/-4.1/-9.0 | -0.03 | 1.4/-3.0/1.3 | 0.60 |
| cold-rich | vs_form | 0.50 | 17136 | 49.73 | -7.66 | -9.8/-3.3/-9.6 | 0.05 | 1.9/-3.7/1.7 | 0.76 |
| cold-rich | vs_form | 0.75 | 8917 | 48.88 | -8.56 | -13.9/-1.2/-10.3 | 0.87 | 5.1/-5.1/2.3 | 1.07 |
| cold-rich | vs_form | 1.00 | 4493 | 47.44 | -11.54 | -16.5/-4.7/-13.1 | 2.94 | 6.4/-3.3/5.3 | 1.55 |

## 4b. The pooled 2×2, and the duplicate-ticket problem

Same z thresholds, decomposed. `both` has to beat `streak` and `gap` or the streak is decoration.

| pattern | gapdef | z_theta | streak_n | streak_line | streak_form | gap_n | gap_line | gap_form | both_n | both_line | both_form |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hot-cheap | vs_prev_line | 0.25 | 39136 | -1.40 | -5.64 | 52779 | -1.58 | -6.11 | 3742 | -3.55 | -4.93 |
| hot-cheap | vs_prev_line | 0.50 | 39136 | -1.40 | -5.64 | 19900 | -2.04 | -5.24 | 1256 | -3.00 | -4.67 |
| hot-cheap | vs_prev_line | 0.75 | 39136 | -1.40 | -5.64 | 7625 | -2.56 | -5.40 | 441 | -2.73 | -5.93 |
| hot-cheap | vs_form | 0.25 | 39817 | -1.37 | -5.68 | 111177 | -0.85 | -6.59 | 25619 | -1.11 | -5.97 |
| hot-cheap | vs_form | 0.50 | 39817 | -1.37 | -5.68 | 55031 | -1.74 | -5.76 | 16523 | -1.64 | -5.46 |
| hot-cheap | vs_form | 0.75 | 39817 | -1.37 | -5.68 | 21735 | -2.77 | -5.12 | 8271 | -4.29 | -3.26 |
| cold-rich | vs_prev_line | 0.25 | 44592 | -6.50 | -1.12 | 55468 | -5.78 | -1.20 | 4882 | -7.56 | 0.25 |
| cold-rich | vs_prev_line | 0.50 | 44592 | -6.50 | -1.12 | 21742 | -5.80 | -1.00 | 2041 | -9.72 | 1.89 |
| cold-rich | vs_prev_line | 0.75 | 44592 | -6.50 | -1.12 | 8510 | -6.55 | -1.03 | 859 | -14.05 | 5.47 |
| cold-rich | vs_form | 0.25 | 46876 | -6.86 | -0.88 | 94786 | -6.16 | -1.07 | 27198 | -7.45 | -0.03 |
| cold-rich | vs_form | 0.50 | 46876 | -6.86 | -0.88 | 47729 | -6.86 | -0.52 | 17136 | -7.66 | 0.05 |
| cold-rich | vs_form | 0.75 | 46876 | -6.86 | -0.88 | 21371 | -7.72 | -0.11 | 8917 | -8.56 | 0.87 |

And the sample above is **not** what it looks like. PRA = points + rebounds + assists and three
other markets are sub-sums of it, so a single player-game can appear four times as four
near-identical rows ([[derived-market-gating-law]]). `DEDUP` keeps ONE ticket per player-game,
preferring the biggest line — which is also the ticket `NBA_PROPS_VERDICT.md` §6 already says to
bet. `dupe_factor` is how much the stacked count was overstating the bet count.

| pattern | gapdef | z_theta | stacked_n | unique_n | dupe_factor | win | need | roi_form | form_szn | roi_line | one_sigma | players |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hot-cheap | vs_prev_line | 0.25 | 3742 | 2338 | 1.60 | 52.82 | 54.62 | -3.77 | -8.0/-2.9/-1.4 | -4.34 | 1.89 | 386 |
| hot-cheap | vs_prev_line | 0.50 | 1256 | 901 | 1.39 | 52.28 | 55.62 | -6.74 | -6.1/-7.9/-6.2 | -0.03 | 2.99 | 325 |
| hot-cheap | vs_prev_line | 0.75 | 441 | 346 | 1.27 | 52.31 | 56.72 | -8.40 | 0.6/-13.9/-11.9 | 0.64 | 4.73 | 220 |
| hot-cheap | vs_form | 0.25 | 25619 | 12737 | 2.01 | 50.41 | 53.42 | -6.45 | -7.4/-5.0/-7.0 | -0.99 | 0.83 | 426 |
| hot-cheap | vs_form | 0.50 | 16523 | 9108 | 1.81 | 51.08 | 53.97 | -6.22 | -6.7/-5.3/-6.7 | -1.05 | 0.97 | 421 |
| hot-cheap | vs_form | 0.75 | 8271 | 5105 | 1.62 | 52.36 | 54.68 | -5.28 | -7.4/-3.0/-5.6 | -2.67 | 1.28 | 393 |
| cold-rich | vs_prev_line | 0.25 | 4882 | 2920 | 1.67 | 55.07 | 55.05 | -0.50 | -0.7/0.7/-1.5 | -7.56 | 1.67 | 414 |
| cold-rich | vs_prev_line | 0.50 | 2041 | 1330 | 1.53 | 56.92 | 56.08 | 0.92 | -3.0/5.2/-0.3 | -9.59 | 2.42 | 373 |
| cold-rich | vs_prev_line | 0.75 | 859 | 598 | 1.44 | 60.87 | 56.49 | 6.60 | 4.1/10.9/4.2 | -16.20 | 3.53 | 290 |
| cold-rich | vs_form | 0.25 | 27198 | 13719 | 1.98 | 55.11 | 54.98 | -0.87 | -1.8/-2.1/1.1 | -6.93 | 0.77 | 446 |
| cold-rich | vs_form | 0.50 | 17136 | 9559 | 1.79 | 55.96 | 55.70 | -0.81 | -0.3/-3.7/1.4 | -7.28 | 0.91 | 440 |
| cold-rich | vs_form | 0.75 | 8917 | 5455 | 1.63 | 57.10 | 56.44 | -0.23 | 2.0/-4.0/1.2 | -7.85 | 1.19 | 425 |

## 5. Does the originator model already know this?

Rows in the ≥1.0 spot, split by whether the model independently takes that side.

| market | pattern | gapdef | side | n | agrees_pct | agree_n | agree_roi | disagree_n | disagree_roi |
|---|---|---|---|---|---|---|---|---|---|
| points | hot-cheap | vs_prev_line | line | 1031 | 39.96 | 412 | 5.89 | 619 | -5.88 |
| points | hot-cheap | vs_prev_line | form | 1031 | 60.04 | 619 | 0.49 | 412 | -11.11 |
| points | hot-cheap | vs_form | line | 3220 | 46.40 | 1494 | 6.28 | 1726 | -5.62 |
| points | hot-cheap | vs_form | form | 3220 | 53.60 | 1726 | 0.44 | 1494 | -10.72 |
| points | cold-rich | vs_prev_line | line | 1232 | 63.72 | 785 | -5.67 | 447 | 0.10 |
| points | cold-rich | vs_prev_line | form | 1232 | 36.28 | 447 | -3.38 | 785 | 1.81 |
| points | cold-rich | vs_form | line | 3205 | 68.61 | 2199 | -3.84 | 1006 | -9.65 |
| points | cold-rich | vs_form | form | 3205 | 31.39 | 1006 | 4.26 | 2199 | -0.73 |
| points_rebounds_assists | hot-cheap | vs_prev_line | line | 1167 | 52.61 | 614 | -1.32 | 553 | -10.28 |
| points_rebounds_assists | hot-cheap | vs_prev_line | form | 1167 | 47.39 | 553 | 2.32 | 614 | -7.19 |
| points_rebounds_assists | hot-cheap | vs_form | line | 3175 | 55.87 | 1774 | 2.53 | 1401 | -7.49 |
| points_rebounds_assists | hot-cheap | vs_form | form | 3175 | 44.13 | 1401 | 0.54 | 1774 | -9.28 |
| points_rebounds_assists | cold-rich | vs_prev_line | line | 1417 | 60.41 | 856 | -3.63 | 561 | -5.79 |
| points_rebounds_assists | cold-rich | vs_prev_line | form | 1417 | 39.59 | 561 | -2.13 | 856 | -4.27 |
| points_rebounds_assists | cold-rich | vs_form | line | 3311 | 61.13 | 2024 | -2.70 | 1287 | -11.18 |
| points_rebounds_assists | cold-rich | vs_form | form | 3311 | 38.87 | 1287 | 3.75 | 2024 | -4.76 |
| points_rebounds | hot-cheap | vs_prev_line | line | 1018 | 51.77 | 527 | 12.23 | 491 | -9.90 |
| points_rebounds | hot-cheap | vs_prev_line | form | 1018 | 48.23 | 491 | 3.87 | 527 | -20.84 |
| points_rebounds | hot-cheap | vs_form | line | 2942 | 53.37 | 1570 | 5.94 | 1372 | -6.47 |
| points_rebounds | hot-cheap | vs_form | form | 2942 | 46.63 | 1372 | -0.11 | 1570 | -13.89 |
| points_rebounds | cold-rich | vs_prev_line | line | 1207 | 59.98 | 724 | -1.61 | 483 | -9.85 |
| points_rebounds | cold-rich | vs_prev_line | form | 1207 | 40.02 | 483 | 4.41 | 724 | -4.89 |
| points_rebounds | cold-rich | vs_form | line | 3216 | 61.75 | 1986 | -0.62 | 1230 | -14.78 |
| points_rebounds | cold-rich | vs_form | form | 3216 | 38.25 | 1230 | 7.11 | 1986 | -5.97 |
| points_assists | hot-cheap | vs_prev_line | line | 994 | 45.27 | 450 | 1.96 | 544 | -9.94 |
| points_assists | hot-cheap | vs_prev_line | form | 994 | 54.73 | 544 | 0.92 | 450 | -8.75 |
| points_assists | hot-cheap | vs_form | line | 2861 | 49.18 | 1407 | 4.67 | 1454 | -4.84 |
| points_assists | hot-cheap | vs_form | form | 2861 | 50.82 | 1454 | -3.72 | 1407 | -12.71 |
| points_assists | cold-rich | vs_prev_line | line | 1093 | 62.76 | 686 | 0.25 | 407 | -13.12 |
| points_assists | cold-rich | vs_prev_line | form | 1093 | 37.24 | 407 | 5.27 | 686 | -8.82 |
| points_assists | cold-rich | vs_form | line | 2814 | 64.36 | 1811 | -4.05 | 1003 | -14.58 |
| points_assists | cold-rich | vs_form | form | 2814 | 35.64 | 1003 | 5.94 | 1811 | -4.59 |
| rebounds | hot-cheap | vs_prev_line | line | 460 | 32.61 | 150 | 4.10 | 310 | -3.26 |
| rebounds | hot-cheap | vs_prev_line | form | 460 | 67.39 | 310 | -1.51 | 150 | -11.47 |
| rebounds | hot-cheap | vs_form | line | 2083 | 42.25 | 880 | 6.84 | 1203 | -4.08 |
| rebounds | hot-cheap | vs_form | form | 2083 | 57.75 | 1203 | -1.00 | 880 | -12.91 |
| rebounds | cold-rich | vs_prev_line | line | 666 | 40.69 | 271 | -7.79 | 395 | -7.38 |
| rebounds | cold-rich | vs_prev_line | form | 666 | 59.31 | 395 | 1.32 | 271 | 2.89 |
| rebounds | cold-rich | vs_form | line | 2106 | 51.76 | 1090 | -5.80 | 1016 | -6.44 |
| rebounds | cold-rich | vs_form | form | 2106 | 48.24 | 1016 | -0.38 | 1090 | -0.03 |
| assists | hot-cheap | vs_prev_line | line | 359 | 22.84 | 82 | 5.80 | 277 | -4.34 |
| assists | hot-cheap | vs_prev_line | form | 359 | 77.16 | 277 | -3.23 | 82 | -12.30 |
| assists | hot-cheap | vs_form | line | 1732 | 36.20 | 627 | -4.02 | 1105 | -3.02 |
| assists | hot-cheap | vs_form | form | 1732 | 63.80 | 1105 | -2.35 | 627 | -3.38 |
| assists | cold-rich | vs_prev_line | line | 379 | 50.66 | 192 | -8.50 | 187 | -7.24 |
| assists | cold-rich | vs_prev_line | form | 379 | 49.34 | 187 | -2.12 | 192 | 0.19 |
| assists | cold-rich | vs_form | line | 1077 | 56.55 | 609 | -0.01 | 468 | -13.15 |
| assists | cold-rich | vs_form | form | 1077 | 43.45 | 468 | 5.95 | 609 | -4.46 |
| rebounds_assists | hot-cheap | vs_prev_line | line | 631 | 38.67 | 244 | 9.35 | 387 | -2.85 |
| rebounds_assists | hot-cheap | vs_prev_line | form | 631 | 61.33 | 387 | -5.92 | 244 | -18.03 |
| rebounds_assists | hot-cheap | vs_form | line | 2338 | 45.17 | 1056 | 2.79 | 1282 | -8.82 |
| rebounds_assists | hot-cheap | vs_form | form | 2338 | 54.83 | 1282 | 1.25 | 1056 | -10.06 |
| rebounds_assists | cold-rich | vs_prev_line | line | 759 | 56.26 | 427 | -6.12 | 332 | -15.58 |
| rebounds_assists | cold-rich | vs_prev_line | form | 759 | 43.74 | 332 | 7.09 | 427 | -4.57 |
| rebounds_assists | cold-rich | vs_form | line | 2366 | 60.31 | 1427 | -1.66 | 939 | -18.04 |
| rebounds_assists | cold-rich | vs_form | form | 2366 | 39.69 | 939 | 8.97 | 1427 | -7.48 |
| threes | hot-cheap | vs_prev_line | line | 151 | 6.62 | 0 |  | 141 | -7.97 |
| threes | hot-cheap | vs_prev_line | form | 151 | 93.38 | 141 | -1.99 | 0 |  |
| threes | hot-cheap | vs_form | line | 1240 | 30.48 | 378 | 0.28 | 862 | -7.63 |
| threes | hot-cheap | vs_form | form | 1240 | 69.52 | 862 | -2.39 | 378 | -5.65 |
| threes | cold-rich | vs_prev_line | line | 190 | 24.21 | 46 | -8.40 | 144 | -18.77 |
| threes | cold-rich | vs_prev_line | form | 190 | 75.79 | 144 | 1.06 | 46 | 1.66 |
| threes | cold-rich | vs_form | line | 715 | 40.42 | 289 | -8.05 | 426 | -10.68 |
| threes | cold-rich | vs_form | form | 715 | 59.58 | 426 | 2.73 | 289 | 4.18 |

If the money lives only in `agree`, this is the model restated, not a new signal.

## 6. Concentration — is it six players?

| market | pattern | gapdef | side | n | roi | players | top10_pct | drop_best |
|---|---|---|---|---|---|---|---|---|
| points | hot-cheap | vs_prev_line | line | 1190 | -1.23 | 333 | 9.08 | -1.31 |
| points | hot-cheap | vs_prev_line | form | 1190 | -4.29 | 333 | 9.08 | -4.38 |
| points | hot-cheap | vs_form | line | 3779 | -0.49 | 391 | 8.15 | -0.52 |
| points | hot-cheap | vs_form | form | 3779 | -4.58 | 391 | 8.15 | -4.61 |
| points | cold-rich | vs_prev_line | line | 1412 | -3.56 | 361 | 9.21 | -3.65 |
| points | cold-rich | vs_prev_line | form | 1412 | -0.32 | 361 | 9.21 | -0.39 |
| points | cold-rich | vs_form | line | 3907 | -7.26 | 407 | 8.60 | -7.29 |
| points | cold-rich | vs_form | form | 3907 | 1.93 | 407 | 8.60 | 1.90 |
| points_rebounds_assists | hot-cheap | vs_prev_line | line | 1336 | -5.21 | 341 | 8.76 | -5.29 |
| points_rebounds_assists | hot-cheap | vs_prev_line | form | 1336 | -3.23 | 341 | 8.76 | -3.33 |
| points_rebounds_assists | hot-cheap | vs_form | line | 3682 | -1.36 | 381 | 8.39 | -1.39 |
| points_rebounds_assists | hot-cheap | vs_form | form | 3682 | -5.74 | 381 | 8.39 | -5.77 |
| points_rebounds_assists | cold-rich | vs_prev_line | line | 1635 | -3.11 | 378 | 9.17 | -3.18 |
| points_rebounds_assists | cold-rich | vs_prev_line | form | 1635 | -4.56 | 378 | 9.17 | -4.69 |
| points_rebounds_assists | cold-rich | vs_form | line | 3955 | -5.76 | 410 | 8.02 | -5.78 |
| points_rebounds_assists | cold-rich | vs_form | form | 3955 | -1.72 | 410 | 8.02 | -1.77 |
| points_rebounds | hot-cheap | vs_prev_line | line | 1184 | 2.20 | 322 | 8.87 | 2.11 |
| points_rebounds | hot-cheap | vs_prev_line | form | 1184 | -9.57 | 322 | 8.87 | -9.66 |
| points_rebounds | hot-cheap | vs_form | line | 3470 | 0.21 | 359 | 9.19 | 0.18 |
| points_rebounds | hot-cheap | vs_form | form | 3470 | -7.75 | 359 | 9.19 | -7.78 |
| points_rebounds | cold-rich | vs_prev_line | line | 1423 | -4.82 | 353 | 8.64 | -4.90 |
| points_rebounds | cold-rich | vs_prev_line | form | 1423 | -1.05 | 353 | 8.64 | -1.13 |
| points_rebounds | cold-rich | vs_form | line | 3911 | -7.10 | 406 | 8.23 | -7.13 |
| points_rebounds | cold-rich | vs_form | form | 3911 | -0.01 | 406 | 8.23 | -0.04 |
| points_assists | hot-cheap | vs_prev_line | line | 1170 | -3.83 | 324 | 8.97 | -3.92 |
| points_assists | hot-cheap | vs_prev_line | form | 1170 | -4.65 | 324 | 8.97 | -4.75 |
| points_assists | hot-cheap | vs_form | line | 3405 | -0.84 | 367 | 8.90 | -0.87 |
| points_assists | hot-cheap | vs_form | form | 3405 | -7.83 | 367 | 8.90 | -7.87 |
| points_assists | cold-rich | vs_prev_line | line | 1268 | -4.80 | 337 | 9.78 | -4.88 |
| points_assists | cold-rich | vs_prev_line | form | 1268 | -3.80 | 337 | 9.78 | -3.88 |
| points_assists | cold-rich | vs_form | line | 3384 | -7.91 | 384 | 8.98 | -7.94 |
| points_assists | cold-rich | vs_form | form | 3384 | -0.77 | 384 | 8.98 | -0.80 |
| rebounds | hot-cheap | vs_prev_line | line | 531 | 3.30 | 248 | 11.49 | 3.03 |
| rebounds | hot-cheap | vs_prev_line | form | 531 | -8.91 | 248 | 11.49 | -9.19 |
| rebounds | hot-cheap | vs_form | line | 2425 | 1.93 | 347 | 10.31 | 1.88 |
| rebounds | hot-cheap | vs_form | form | 2425 | -7.46 | 347 | 10.31 | -7.51 |
| rebounds | cold-rich | vs_prev_line | line | 784 | -8.23 | 318 | 9.57 | -8.43 |
| rebounds | cold-rich | vs_prev_line | form | 784 | 2.91 | 318 | 9.57 | 2.78 |
| rebounds | cold-rich | vs_form | line | 2572 | -7.16 | 383 | 10.54 | -7.23 |
| rebounds | cold-rich | vs_form | form | 2572 | 0.86 | 383 | 10.54 | 0.81 |
| assists | hot-cheap | vs_prev_line | line | 416 | -0.48 | 222 | 14.18 | -0.93 |
| assists | hot-cheap | vs_prev_line | form | 416 | -6.85 | 222 | 14.18 | -7.13 |
| assists | hot-cheap | vs_form | line | 2004 | -2.69 | 324 | 10.23 | -2.78 |
| assists | hot-cheap | vs_form | form | 2004 | -3.42 | 324 | 10.23 | -3.61 |
| assists | cold-rich | vs_prev_line | line | 429 | -7.72 | 233 | 11.89 | -8.15 |
| assists | cold-rich | vs_prev_line | form | 429 | -0.43 | 233 | 11.89 | -0.71 |
| assists | cold-rich | vs_form | line | 1248 | -4.37 | 288 | 11.62 | -4.50 |
| assists | cold-rich | vs_form | form | 1248 | -1.05 | 288 | 11.62 | -1.14 |
| rebounds_assists | hot-cheap | vs_prev_line | line | 758 | 2.17 | 286 | 10.29 | 2.02 |
| rebounds_assists | hot-cheap | vs_prev_line | form | 758 | -10.90 | 286 | 10.29 | -11.07 |
| rebounds_assists | hot-cheap | vs_form | line | 2798 | -2.76 | 346 | 9.83 | -2.81 |
| rebounds_assists | hot-cheap | vs_form | form | 2798 | -4.95 | 346 | 9.83 | -4.99 |
| rebounds_assists | cold-rich | vs_prev_line | line | 920 | -9.07 | 313 | 10.11 | -9.22 |
| rebounds_assists | cold-rich | vs_prev_line | form | 920 | -0.49 | 313 | 10.11 | -0.61 |
| rebounds_assists | cold-rich | vs_form | line | 2878 | -8.61 | 378 | 9.45 | -8.66 |
| rebounds_assists | cold-rich | vs_form | form | 2878 | -0.25 | 378 | 9.45 | -0.37 |
| threes | hot-cheap | vs_prev_line | line | 162 | -9.92 | 119 | 18.52 | -11.13 |
| threes | hot-cheap | vs_prev_line | form | 162 | 0.56 | 119 | 18.52 | -0.71 |
| threes | hot-cheap | vs_form | line | 1430 | -5.68 | 269 | 12.24 | -5.81 |
| threes | hot-cheap | vs_form | form | 1430 | -2.41 | 269 | 12.24 | -2.87 |
| threes | cold-rich | vs_prev_line | line | 216 | -16.23 | 146 | 18.06 | -17.23 |
| threes | cold-rich | vs_prev_line | form | 216 | 1.71 | 146 | 18.06 | 0.71 |
| threes | cold-rich | vs_form | line | 847 | -12.68 | 209 | 18.42 | -12.91 |
| threes | cold-rich | vs_form | form | 847 | 5.69 | 209 | 18.42 | 5.56 |

Units recomputed by hand and **asserted against `grade()`** before printing.
