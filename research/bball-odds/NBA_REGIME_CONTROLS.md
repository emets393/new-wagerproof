# NBA regime study — the two controls

`NBA_REGIME.md` reported that recency weighting roughly doubles the full-game total's edge and that per-season coefficient vectors are nearly orthogonal. Both claims need a control before they can be used: one to separate regime change from estimator noise, one to check that the winning half-life is a broad optimum rather than the luckiest cell of a small grid.

## Control 1 — is the coefficient rotation real, or is it noise?

A one-season ridge fit is 2,552 rows against 433 features, so its coefficients are mostly noise, and two noisy estimates of the SAME vector correlate near zero all by themselves. The cross-season +0.040 from `NBA_REGIME.md` therefore proves nothing on its own.

This splits a single season's games in half at random and correlates the two halves' coefficients — identical row count, identical estimator, and no regime change possible because it is one season. That is the ceiling this estimator can reach. Cross-season pairs are built the same way, half a season against half a different season, so both sides of the comparison are fit on the same amount of data. Both arms come out of the SAME 12 random redraws, so they can be compared as a paired test rather than as two independent piles of correlations.

| comparison | mean coefficient correlation | sd across redraws |
|---|---|---|
| within one season (split-half) | **+0.092** | 0.019 |
| across two seasons | **+0.039** | 0.028 |
| paired difference | **+0.053** | 0.022 |

Within-season is the ceiling at **+0.092**; across seasons it falls to **+0.039**, about **58% of the reproducible signal lost** when the two halves come from different years. Within beats cross in **12 of 12** redraws, paired **t = +8.46** on 11 df.

Both numbers are small in absolute terms — that is the estimator's noise floor, not the effect size — so read the RATIO, not the gap. The rotation is real: same estimator, same sample size, same fits on both sides, and the only thing that changed is whether the two halves came from one season or two.

## Control 2 — is 180 days a broad optimum or a lucky cell?

Ten half-lives on the same rows, same 4-point cut, full-game total. A real preference for recent data shows up as a smooth hill with a wide top, where neighbouring half-lives score alike and the exact number barely matters. A spike with dead neighbours is a fluke dressed as a parameter. `None` is the current pooled baseline — infinite memory.

| half-life (days) | bets | win% | base% | edge | ROI | z | 2023 ROI | 2024 ROI | 2025 ROI |
|---|---|---|---|---|---|---|---|---|---|---|
| 45 | 2,490 | 51.6 | 50.7 | **+0.9** | **-1.6** | +1.98 | -8.5 | -1.1 | +4.2 |
| 60 | 2,300 | 51.8 | 50.6 | **+1.2** | **-1.1** | +1.96 | -9.4 | -0.2 | +5.1 |
| 90 | 1,993 | 53.2 | 50.5 | **+2.8** | **+1.6** | +3.36 | -6.6 | +1.2 | +9.0 |
| 120 | 1,756 | 54.3 | 50.3 | **+3.9** | **+3.6** | +3.86 | -2.8 | +1.9 | +10.6 |
| 180 | 1,503 | 54.8 | 51.0 | **+3.8** | **+4.5** | +3.19 | -0.2 | +1.5 | +11.6 |
| 240 | 1,338 | 54.4 | 50.2 | **+4.2** | **+3.9** | +3.36 | -2.0 | +2.3 | +11.0 |
| 365 | 1,179 | 53.8 | 50.1 | **+3.6** | **+2.7** | +2.70 | -3.2 | -1.9 | +13.5 |
| 545 | 1,112 | 53.9 | 50.0 | **+3.9** | **+2.8** | +3.04 | -2.5 | -0.4 | +12.7 |
| 730 | 1,090 | 53.9 | 50.1 | **+3.8** | **+2.8** | +2.95 | -2.9 | +1.5 | +11.5 |
| **None (pooled)** | 1,054 | 52.6 | 50.8 | **+1.8** | **+0.3** | +1.94 | -2.5 | -1.9 | +7.9 |

