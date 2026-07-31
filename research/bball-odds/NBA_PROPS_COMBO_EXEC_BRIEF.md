# NBA combo-consistency — executable, or another stale line?

182,603 combo props, seasons ['2023-24', '2024-25', '2025-26']. Signal from consensus component lines; bet graded at the line AND price of the book it is struck at.

**The 2nd-best column is the test.** A real shopping edge degrades gracefully one rung down; a stale outlier collapses. That control killed the last shopping finding in this folder (+18.68 at best, -0.68 at 2nd best).


## Both sides pooled, by residual threshold

| \|resid\| >= | n | win% | ROI @cons | ROI @best | **ROI @2nd best** |
|---|---|---|---|---|---|
| 0.50 | 70,887 | 51.45 | -5.97 | -3.94 | **-5.81** |
| 0.75 | 11,121 | 53.12 | -3.49 | -1.73 | **-3.76** |
| 1.00 | 7,587 | 53.57 | -3.23 | -1.76 | **-3.42** |
| 1.25 | 6,566 | 53.90 | -2.78 | -1.46 | **-2.89** |
| 1.50 | 1,334 | 54.95 | -0.54 | +1.03 | **-2.10** |

## Restricted to mainstream US books

| \|resid\| >= | n | ROI @best | ROI @2nd best |
|---|---|---|---|
| 0.50 | 70,847 | -4.25 | -6.57 |
| 0.75 | 11,203 | -2.00 | -4.70 |
| 1.00 | 7,565 | -2.02 | -4.57 |
| 1.25 | 6,522 | -1.73 | -4.29 |
| 1.50 | 1,316 | +0.73 | -3.60 |

## Per season at |resid| >= 1.0 (pooled sides)

| season | n | ROI @cons | ROI @best | ROI @2nd best |
|---|---|---|---|---|
| 2023-24 | 2,288 | -0.79 | +0.79 | +0.06 |
| 2024-25 | 2,717 | -0.98 | +0.67 | -2.83 |
| 2025-26 | 2,582 | -7.77 | -6.58 | -7.91 |

## Per market at |resid| >= 1.0

| market | n | ROI @cons | ROI @best | ROI @2nd best |
|---|---|---|---|---|
| player_points_assists | 1,703 | -0.13 | +0.91 | -1.10 |
| player_points_rebounds | 1,754 | -5.33 | -4.18 | -6.24 |
| player_points_rebounds_assists | 3,349 | -3.45 | -1.49 | -3.22 |
| player_rebounds_assists | 781 | -4.35 | -3.33 | -1.42 |
