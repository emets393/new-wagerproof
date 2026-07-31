# NBA props — alternate-line ladders

670,132 rungs from ladders of 3+, books ['betrivers', 'unibet_us', 'mybookieag', 'betonlineag', 'bovada'], seasons ['2023-24', '2024-25', '2025-26']. Every rung graded at its own line and its own book's price.

Reachable = betrivers + unibet_us only. An edge that lives at mybookie is not an edge.


## B — the ladder against itself: NULL, and decisively so

Across 670,132 rungs there are **11 upward and 11 downward** self-contradictions of 0.5% or more in a book's own de-vigged ladder — 0.0033% of rows, far too few to bet and consistent with rounding rather than mispricing.

That is a real finding, not a failed test: the books generate their ladders from a strictly monotone parametric fill, so an internal arbitrage cannot occur by construction. Any ladder edge therefore has to come from the fill being the WRONG SHAPE, which only an external distribution can see. That is attack A, and it is the only remaining way in.


## A — model CDF vs the ladder's price

| edge | side | n | win% | ROI | reachable n | reachable ROI | per-season ROI |
|---|---|---|---|---|---|---|---|
| 3-6% | over | 55,328 | 50.72 | -8.85 | 26,211 | -11.37 | -14.2/-8.3/-6.7 |
| 3-6% | under | 67,089 | 52.94 | -3.00 | 32,514 | -3.83 | -3.2/-5.4/-2.5 |
| 6-10% | over | 49,234 | 51.68 | -7.86 | 24,004 | -9.77 | -12.0/-7.3/-5.8 |
| 6-10% | under | 66,082 | 54.36 | -0.72 | 35,402 | -1.66 | -0.7/-5.5/+0.3 |
| 10-15% | over | 33,319 | 51.98 | -8.48 | 16,981 | -9.99 | -11.8/-4.4/-6.7 |
| 10-15% | under | 47,663 | 55.65 | +0.52 | 29,238 | -0.45 | +0.6/-1.1/+0.9 |
| 15%+ | over | 22,547 | 50.12 | -9.11 | 11,205 | -9.27 | -10.6/-4.7/-8.3 |
| 15%+ | under | 35,758 | 56.19 | +1.85 | 25,780 | +2.05 | +3.1/+1.4/-0.2 |

## A — by distance from the book's own middle rung

| rungs from middle | n | model-over ROI | model-under ROI |
|---|---|---|---|
| at the middle | 27,887/36,722 | -7.80 | -0.49 |
| 1-2 | 59,940/74,141 | -8.26 | +0.12 |
| 2-4 | 16,920/36,835 | -9.50 | +1.14 |
| 4+ | 353/1,805 | -3.69 | +5.62 |
