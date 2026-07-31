# NBA bottom-up player model — the ceiling test

Fit on the MARKET RESIDUAL (actual − posted line), never on the raw score. Ridge, alpha=50, expanding monthly walk-forward. `R² vs market` is measured against predicting zero residual, so **negative means worse than just trusting the line**.

`oracle` weights players by minutes ACTUALLY played (unbettable ceiling). `projected` uses prior rolling minutes + last-game availability (bettable today, no injury feed). `placebo` is projected with the home/away side shuffled — its score is the real zero.

| market | feature set | n | corr(pred, resid) % | R² vs market % |
|---|---|---|---|---|
| 1H margin | oracle LEVEL (contaminated) | 2,973 | +8.2 | -0.28 |
| 1H margin | semi-oracle LEVEL | 2,973 | +1.6 | -1.30 |
| 1H margin | projected LEVEL | 2,973 | -0.4 | -1.66 |
| 1H margin | semi-oracle SHOCK | 2,973 | +2.1 | -1.28 |
| 1H margin | projected SHOCK | 2,973 | -1.0 | -1.99 |
| 1H margin | **placebo (rows permuted)** | 2,973 | -1.7 | -1.64 |
| 1H total | oracle LEVEL (contaminated) | 2,973 | +5.0 | -1.03 |
| 1H total | semi-oracle LEVEL | 2,973 | +4.0 | -1.06 |
| 1H total | projected LEVEL | 2,973 | +2.3 | -1.07 |
| 1H total | semi-oracle SHOCK | 2,973 | +3.7 | -1.02 |
| 1H total | projected SHOCK | 2,973 | +1.6 | -1.22 |
| 1H total | **placebo (rows permuted)** | 2,973 | -3.7 | -2.44 |
| FG margin | oracle LEVEL (contaminated) | 4,326 | +15.1 | +1.48 |
| FG margin | semi-oracle LEVEL | 4,326 | +4.8 | -0.81 |
| FG margin | projected LEVEL | 4,326 | +2.4 | -1.35 |
| FG margin | semi-oracle SHOCK | 4,326 | +4.1 | -0.89 |
| FG margin | projected SHOCK | 4,326 | +1.4 | -1.44 |
| FG margin | **placebo (rows permuted)** | 4,326 | +2.2 | -1.46 |
| FG total | oracle LEVEL (contaminated) | 4,326 | +25.1 | +6.23 |
| FG total | semi-oracle LEVEL | 4,326 | +4.0 | -0.69 |
| FG total | projected LEVEL | 4,326 | +1.3 | -1.07 |
| FG total | semi-oracle SHOCK | 4,326 | +3.4 | -1.07 |
| FG total | projected SHOCK | 4,326 | +0.2 | -1.54 |
| FG total | **placebo (rows permuted)** | 4,326 | -0.7 | -1.69 |

## Prediction 1 — does it help the 1H more than the full game?

Registered before the run. Starters take ~90% of first-half minutes vs ~65% of full-game minutes, and the book prices the 1H as a fraction of the FG line rather than re-deriving it from the rotation. If the lift is flat across the two, the mechanism story is wrong.

| feature set | 1H margin corr | FG margin corr | 1H total corr | FG total corr |
|---|---|---|---|---|
| oracle LEVEL (contaminated) | +8.2 | +15.1 | +5.0 | +25.1 |
| semi-oracle LEVEL | +1.6 | +4.8 | +4.0 | +4.0 |
| projected LEVEL | -0.4 | +2.4 | +2.3 | +1.3 |
| semi-oracle SHOCK | +2.1 | +4.1 | +3.7 | +3.4 |
| projected SHOCK | -1.0 | +1.4 | +1.6 | +0.2 |

## Prediction 2 — does it help most in the early season?

Registered before the run. Player ratings survive the offseason; team ratings do not. In October a team model has ~zero games of information while this one has full career history for most of the roster.

| market | feature set | early | mid | late | playoffs |
|---|---|---|---|---|---|
| 1H margin | oracle LEVEL (contaminated) | +8.8 (n=450) | +16.7 (n=1,017) | +4.6 (n=1,262) | -6.9 (n=244) |
| 1H margin | semi-oracle LEVEL | +3.3 (n=450) | +3.6 (n=1,017) | +0.2 (n=1,262) | -3.3 (n=244) |
| 1H margin | projected LEVEL | -6.0 (n=450) | -1.4 (n=1,017) | +2.2 (n=1,262) | +0.5 (n=244) |
| 1H margin | semi-oracle SHOCK | +4.5 (n=450) | +3.2 (n=1,017) | -0.5 (n=1,262) | +9.5 (n=244) |
| 1H margin | projected SHOCK | -5.8 (n=450) | -7.2 (n=1,017) | +4.5 (n=1,262) | +2.3 (n=244) |
| 1H total | oracle LEVEL (contaminated) | -2.5 (n=450) | +8.3 (n=1,017) | +5.5 (n=1,262) | +3.3 (n=244) |
| 1H total | semi-oracle LEVEL | -1.4 (n=450) | +7.5 (n=1,017) | +3.5 (n=1,262) | +6.3 (n=244) |
| 1H total | projected LEVEL | -5.0 (n=450) | +4.9 (n=1,017) | +3.7 (n=1,262) | +2.4 (n=244) |
| 1H total | semi-oracle SHOCK | +8.0 (n=450) | +4.3 (n=1,017) | +1.5 (n=1,262) | +7.4 (n=244) |
| 1H total | projected SHOCK | +5.3 (n=450) | +0.9 (n=1,017) | +1.3 (n=1,262) | -0.6 (n=244) |
| FG margin | oracle LEVEL (contaminated) | +18.3 (n=649) | +19.8 (n=1,522) | +12.4 (n=1,829) | +5.8 (n=326) |
| FG margin | semi-oracle LEVEL | +6.4 (n=649) | +4.4 (n=1,522) | +4.9 (n=1,829) | +3.9 (n=326) |
| FG margin | projected LEVEL | +2.3 (n=649) | +3.2 (n=1,522) | +2.5 (n=1,829) | +0.6 (n=326) |
| FG margin | semi-oracle SHOCK | +1.4 (n=649) | +5.7 (n=1,522) | +2.8 (n=1,829) | +11.6 (n=326) |
| FG margin | projected SHOCK | -3.0 (n=649) | +0.2 (n=1,522) | +2.8 (n=1,829) | +5.3 (n=326) |
| FG total | oracle LEVEL (contaminated) | +31.7 (n=649) | +25.3 (n=1,522) | +23.3 (n=1,829) | +21.6 (n=326) |
| FG total | semi-oracle LEVEL | +6.8 (n=649) | +5.7 (n=1,522) | +1.6 (n=1,829) | +1.9 (n=326) |
| FG total | projected LEVEL | +1.3 (n=649) | +2.8 (n=1,522) | +0.1 (n=1,829) | +2.4 (n=326) |
| FG total | semi-oracle SHOCK | +1.6 (n=649) | +7.0 (n=1,522) | +2.6 (n=1,829) | -3.8 (n=326) |
| FG total | projected SHOCK | -4.4 (n=649) | +1.5 (n=1,522) | +2.6 (n=1,829) | -8.6 (n=326) |
