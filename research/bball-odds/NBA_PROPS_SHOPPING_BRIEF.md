# NBA props — is the line-shopping edge real?

472,175 props, seasons ['2023-24', '2024-25', '2025-26'], per-book main lines at T-60. Every bet graded at the line AND price of the book it is struck at.

## 1 — best vs SECOND best line (the stale-outlier test)

| bet | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| UNDER @ consensus | 470,706 | 52.95 | -3.72 | -3.2/-4.2/-3.7 |
| UNDER @ 2nd best line | 412,141 | 52.97 | -2.63 | -1.7/-3.5/-2.7 |
| UNDER @ best line | 472,146 | 54.26 | -1.09 | -0.7/-1.6/-1.0 |

## 2 — restricted to mainstream US books

| bet | n | win% | ROI | per-season ROI |
|---|---|---|---|---|
| UNDER @ consensus (mainstream) | 465,015 | 52.91 | -3.75 | -3.2/-4.3/-3.8 |
| UNDER @ 2nd best (mainstream) | 394,970 | 52.73 | -3.10 | -2.0/-4.0/-3.4 |
| UNDER @ best (mainstream) | 466,726 | 54.07 | -1.39 | -0.8/-1.8/-1.5 |

## 3 — does it scale with how far the best number sits above consensus?

| under_edge (pts) | n | win% | ROI @best | ROI @2nd best | per-season ROI @best |
|---|---|---|---|---|---|
| 0.0 | 394,623 | 53.78 | -1.30 | -2.55 | -0.8/-1.7/-1.5 |
| 0.5 | 15,240 | 56.36 | -0.04 | -3.92 | +2.9/-0.7/-0.6 |
| 1.0 | 60,299 | 56.61 | -0.30 | -2.70 | -1.0/-1.1/+1.0 |
| 1.5 | 554 | 57.76 | +4.23 | -5.02 | +10.5/-6.5/+14.2 |
| 2.0-2.5 | 1,293 | 61.25 | +10.05 | -2.10 | +10.2/+3.2/+19.3 |
| 3.0+ | 137 | 67.15 | +18.68 | -0.68 | +nan/-4.4/+35.1 |

## 4 — does shopping help the OVER too? (shade vs shopping)

| bet | n | win% | ROI |
|---|---|---|---|
| OVER @ consensus | 470,706 | 47.05 | -9.56 |
| OVER @ best line | 472,166 | 48.36 | -6.78 |
| UNDER @ consensus | 470,706 | 52.95 | -3.72 |
| UNDER @ best line | 472,146 | 54.26 | -1.09 |

## Per market — UNDER at best line, and at best line with 1.5+ disagreement

| market | n all | ROI all | n 1.5+ | win% 1.5+ | ROI 1.5+ | per-season ROI 1.5+ |
|---|---|---|---|---|---|---|
| player_assists | 48,822 | -2.97 | 0 | nan | +nan | +nan/+nan/+nan |
| player_blocks | 43,192 | -2.51 | 0 | nan | +nan | +nan/+nan/+nan |
| player_points | 52,469 | -0.30 | 302 | 64.2 | +13.90 | +20.3/+10.9/+13.4 |
| player_points_assists | 47,157 | -2.25 | 344 | 57.0 | +3.09 | +27.0/-11.6/+11.9 |
| player_points_rebounds | 49,507 | -0.82 | 562 | 60.9 | +10.16 | -4.0/+2.8/+28.7 |
| player_points_rebounds_assists | 51,297 | -0.86 | 744 | 60.5 | +8.96 | +14.4/-1.1/+19.0 |
| player_rebounds | 51,572 | +0.47 | 0 | nan | +nan | +nan/+nan/+nan |
| player_rebounds_assists | 46,619 | -1.02 | 0 | nan | +nan | +nan/+nan/+nan |
| player_steals | 35,007 | -0.22 | 0 | nan | +nan | +nan/+nan/+nan |
| player_threes | 46,504 | -0.48 | 0 | nan | +nan | +nan/+nan/+nan |
