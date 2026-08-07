# NBA player props — pre-model baselines

474,732 props, seasons ['2023-24', '2024-25', '2025-26'], 10 markets, T-60 prices, median hold 6.88%.

Consensus bets graded at the consensus line and price; best-line bets graded at the book that offered that line, at its own price. Never mixed.

## H1 — blind side bias at the CONSENSUS line

| side | n | win% | ROI | per-season win% |
|---|---|---|---|---|
| blind OVER | 473,261 | 47.04 | -9.57 | 46.8/47.2/47.1 |
| blind UNDER | 473,261 | 52.96 | -3.71 | 53.2/52.8/52.9 |

### H1 by market (blind UNDER at consensus)

| market | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| player_assists | 48,863 | 51.09 | -5.59 | -6.7/-5.7/-4.4 |
| player_blocks | 43,409 | 64.34 | -3.50 | -3.5/-3.1/-4.0 |
| player_points | 52,664 | 51.47 | -3.76 | -2.6/-4.6/-4.0 |
| player_points_assists | 47,187 | 51.07 | -4.65 | -4.0/-5.8/-4.1 |
| player_points_rebounds | 49,580 | 51.53 | -3.65 | -2.9/-4.7/-3.4 |
| player_points_rebounds_assists | 51,336 | 51.54 | -3.85 | -2.8/-4.8/-3.8 |
| player_rebounds | 51,741 | 52.27 | -3.09 | -2.3/-2.8/-4.1 |
| player_rebounds_assists | 46,662 | 51.77 | -3.38 | -3.7/-2.7/-3.7 |
| player_steals | 35,092 | 52.40 | -1.82 | -0.3/-3.6/-2.2 |
| player_threes | 46,727 | 53.34 | -3.25 | -3.2/-4.4/-2.2 |

## H2 — best available line vs consensus

| bet | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| OVER at consensus | 473,261 | 47.04 | -9.57 | -10.1/-9.2/-9.4 |
| OVER at best line | 474,723 | 48.36 | -6.79 | -7.5/-6.3/-6.6 |
| UNDER at consensus | 473,261 | 52.96 | -3.71 | -3.2/-4.2/-3.7 |
| UNDER at best line | 474,703 | 54.26 | -1.07 | -0.7/-1.6/-1.0 |

### H2 by size of the cross-book disagreement (UNDER at best line)

| line range | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| 0 (books agree) | 340,062 | 53.53 | -1.56 | -1.2/-1.8/-1.7 |
| 0-1 | 152 | 55.92 | +1.77 | +1.8/+nan/+nan |
| 1-1.5 | 125,100 | 55.98 | -0.16 | +1.0/-1.2/-0.1 |
| 1.5+ | 9,389 | 57.58 | +4.34 | +6.8/+0.7/+7.8 |

## H1 x H2 — UNDER at the best line, by market

| market | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| player_assists | 49,000 | 52.60 | -2.98 | -4.1/-3.2/-1.8 |
| player_blocks | 43,475 | 64.56 | -2.49 | -2.2/-2.1/-3.4 |
| player_points | 52,764 | 53.17 | -0.24 | +0.8/-1.2/-0.3 |
| player_points_assists | 47,384 | 52.24 | -2.24 | -1.8/-3.1/-1.7 |
| player_points_rebounds | 49,782 | 53.07 | -0.79 | -0.0/-1.5/-0.8 |
| player_points_rebounds_assists | 51,500 | 53.04 | -0.87 | -0.2/-1.7/-0.6 |
| player_rebounds | 51,883 | 54.07 | +0.47 | +0.7/+1.0/-0.3 |
| player_rebounds_assists | 46,833 | 52.99 | -1.04 | -1.5/-0.4/-1.2 |
| player_steals | 35,270 | 53.14 | -0.21 | +1.7/-2.0/-1.3 |
| player_threes | 46,812 | 54.60 | -0.44 | -0.5/-1.4/+0.6 |

## H1 diagnostic — under ROI by de-vigged market P(over)

| P(over) | n | under win% | under ROI |
|---|---|---|---|
| 0.00-0.40 | 45,616 | 70.30 | -3.71 |
| 0.40-0.45 | 42,992 | 58.91 | -3.40 |
| 0.45-0.48 | 65,569 | 54.78 | -3.42 |
| 0.48-0.50 | 94,776 | 52.50 | -3.50 |
| 0.50-0.52 | 112,386 | 50.62 | -3.78 |
| 0.52-0.55 | 58,792 | 48.28 | -3.68 |
| 0.55-0.60 | 35,883 | 43.92 | -4.36 |
| 0.60-1.01 | 17,247 | 37.79 | -5.00 |

## Does the line already contain the player's recent form?

| line - L5 form | n | under win% | under ROI |
|---|---|---|---|
| < -2 (line well under form) | 46,990 | 51.66 | -2.90 |
| -2..-0.5 | 73,063 | 50.14 | -3.28 |
| -0.5..0.5 | 148,193 | 53.79 | -3.99 |
| 0.5..2 | 107,454 | 55.55 | -3.58 |
| > 2 (line well over form) | 96,970 | 51.60 | -4.11 |
