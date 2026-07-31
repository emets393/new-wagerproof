# NBA props — the under-selection portfolio

One-sided under-selection, ranked by `cons_p_over - p_ridge` **within each market** so a market with a wide confidence spread cannot swallow the slate. This is the only finding in the NBA props programme to clear the cell-matched, 2nd-best-line and mainstream-book controls; see `NBA_PROPS_UNDER_CONTROL_BRIEF.md`.

## 1 — Per market by season (top10%, consensus)

Consensus, not best line: no shopping, so nothing here can be a stale-outlier artifact. The screen below is built off the first two seasons only.

| market | n | win% | ROI | 2023-24 ROI | 2024-25 ROI | 2025-26 ROI |
|---|---|---|---|---|---|---|
| player_assists | 4,300 | 54.07 | +0.09 | +0.96 | -1.94 | +1.17 |
| player_blocks | 3,744 | 60.71 | +0.73 | -0.46 | +1.39 | +1.41 |
| player_points | 4,653 | 55.15 | +2.58 | +3.79 | +1.71 | +1.05 |
| player_points_assists | 4,131 | 55.48 | +3.06 | +3.03 | +2.03 | +5.95 |
| player_points_rebounds | 4,370 | 55.49 | +3.19 | +4.30 | +0.93 | +1.61 |
| player_points_rebounds_assists | 4,539 | 54.66 | +1.06 | +2.49 | -2.07 | +3.31 |
| player_rebounds | 4,552 | 53.56 | -0.99 | -0.09 | -0.02 | -5.68 |
| player_rebounds_assists | 4,073 | 52.74 | -1.74 | -0.69 | -3.24 | -3.51 |
| player_steals | 2,902 | 56.96 | +4.08 | +6.08 | +1.91 | +2.35 |
| player_threes | 4,115 | 56.70 | +0.64 | +2.33 | -3.10 | +5.36 |

**Screen.** Markets are kept on mean ROI over ['2023-24', '2024-25'] ONLY, so 2025-26 is a clean holdout for the portfolio below.

- keep (6): player_blocks, player_points, player_points_assists, player_points_rebounds, player_points_rebounds_assists, player_steals
- drop (4): player_assists, player_rebounds, player_rebounds_assists, player_threes


## 2 — Portfolio: keeper markets, every cut and venue

`2025-26` is out of sample for the market screen. `all` is pooled across seasons and is shown next to the split, never instead of it.

| cut | venue | n | win% | ROI all | 2023-24 | 2024-25 | 2025-26 | bets/day |
|---|---|---|---|---|---|---|---|
| top25% | cons | 60,851 | 55.06 | -0.20 | +0.64 | -1.31 | +0.34 | 107.5 |
| top25% | best | 61,046 | 55.83 | +1.85 | +2.91 | +0.73 | +2.04 | 107.9 |
| top25% | second | 53,914 | 54.42 | +0.44 | +1.99 | -1.48 | +0.85 | 95.3 |
| top25% | main | 60,587 | 55.76 | +1.68 | +2.78 | +0.57 | +1.74 | 107.0 |
| top10% | cons | 24,339 | 56.25 | +2.38 | +3.33 | +0.98 | +2.55 | 43.3 |
| top10% | best | 24,420 | 56.90 | +4.23 | +5.46 | +2.62 | +3.87 | 43.5 |
| top10% | second | 22,105 | 55.82 | +3.16 | +4.64 | +0.74 | +3.43 | 39.6 |
| top10% | main | 24,281 | 56.83 | +4.07 | +5.30 | +2.44 | +3.70 | 43.3 |
| top5% | cons | 12,179 | 56.84 | +3.52 | +4.21 | +1.84 | +4.84 | 22.8 |
| top5% | best | 12,221 | 57.50 | +5.33 | +6.25 | +3.26 | +6.37 | 22.9 |
| top5% | second | 11,173 | 56.40 | +4.25 | +5.64 | +1.13 | +4.22 | 21.7 |
| top5% | main | 12,158 | 57.44 | +5.19 | +6.07 | +3.09 | +6.62 | 22.8 |

## 3 — 2025-26 holdout only, keepers chosen without seeing it

The number that decides whether the market screen was fitted.

| cut | venue | n | win% | ROI |
|---|---|---|---|---|
| top25% | cons | 13,495 | 55.78 | +0.34 |
| top25% | best | 13,575 | 56.59 | +2.04 |
| top25% | second | 10,750 | 54.23 | +0.85 |
| top25% | main | 13,475 | 56.50 | +1.74 |
| top10% | cons | 2,987 | 57.35 | +2.55 |
| top10% | best | 3,016 | 58.12 | +3.87 |
| top10% | second | 2,278 | 55.27 | +3.43 |
| top10% | main | 2,984 | 58.04 | +3.70 |
| top5% | cons | 962 | 59.56 | +4.84 |
| top5% | best | 978 | 60.53 | +6.37 |
| top5% | second | 689 | 55.59 | +4.22 |
| top5% | main | 963 | 60.64 | +6.62 |

## 4 — Was the screen worth anything? (top10%, consensus)

If dropping the two decaying markets barely moves the number, the screen is noise and the honest portfolio is all ten markets.

| universe | n | win% | ROI all | 2023-24 | 2024-25 | 2025-26 |
|---|---|---|---|---|---|---|
| all 10 markets | 41,379 | 55.42 | +1.19 | +2.19 | -0.16 | +1.02 |
| keepers only | 24,339 | 56.25 | +2.38 | +3.33 | +0.98 | +2.55 |
