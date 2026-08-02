# NBA player props — model vs the market's own shade

> **SUPERSEDED 2026-08-02. The conclusion drawn from this page — that there is no edge in NBA
> player props — is RETRACTED.** The model graded here classified the sign of the residual on a
> panel whose 45 opponent-side columns were all injury counts, so it never saw opponent quality of
> any kind. Rebuilt as a raw-quantity originator with that context attached, it returns +7.09 on
> points and +11.25 on PRA, 3/3 seasons. See `NBA_PROPS_VERDICT.md`.
>
> Two things on this page are still right and were carried forward: grading at both the consensus
> and the best available price, and always showing the blind under. One thing is wrong — the blind
> under is DEGENERATE on the rows where the model itself picks under. Kept for the record.

473,596 props (5+ prior games), seasons ['2023-24', '2024-25', '2025-26']. Rolling origin, refit every 2 months, 3 boosters, per market.

**Every model cut is shown against BLIND UNDER on the identical rows.** The prop market has a standing over-shade, so beating 50% proves nothing; only the delta vs blind under is the model's contribution.

## Pooled across markets — model vs blind under on the same rows

| cut | venue | n | model win% | model ROI | blind-under ROI | delta |
|---|---|---|---|---|---|---|
| top100% | cons | 386,418 | 54.45 | -4.93 | -3.87 | -1.06 |
| top100% | best | 387,756 | 55.20 | -2.52 | -1.18 | -1.33 |
| top50% | cons | 193,211 | 56.96 | -4.06 | -3.76 | -0.30 |
| top50% | best | 193,881 | 57.52 | -1.86 | -1.23 | -0.63 |
| top25% | cons | 96,607 | 58.67 | -3.21 | -3.30 | +0.09 |
| top25% | best | 96,943 | 59.17 | -1.09 | -0.92 | -0.17 |
| top10% | cons | 38,646 | 59.85 | -2.57 | -2.85 | +0.28 |
| top10% | best | 38,781 | 60.30 | -0.53 | -0.55 | +0.02 |
| top5% | cons | 19,325 | 60.76 | -1.76 | -1.87 | +0.10 |
| top5% | best | 19,394 | 61.16 | +0.19 | +0.38 | -0.19 |

## Per market at top25%, best line

| market | n | model win% | model ROI | blind-under ROI | delta |
|---|---|---|---|---|---|
| player_assists | 10,125 | 59.01 | -3.24 | -5.35 | +2.11 |
| player_blocks | 8,681 | 81.74 | -2.22 | -2.16 | -0.06 |
| player_points | 10,936 | 53.87 | +0.45 | +0.40 | +0.04 |
| player_points_assists | 9,684 | 53.47 | -1.21 | -1.74 | +0.54 |
| player_points_rebounds | 10,242 | 53.57 | -0.45 | +1.11 | -1.56 |
| player_points_rebounds_assists | 10,701 | 54.30 | +0.46 | -0.52 | +0.98 |
| player_rebounds | 10,726 | 57.42 | -0.48 | +0.91 | -1.40 |
| player_rebounds_assists | 9,547 | 54.48 | -2.46 | -1.19 | -1.27 |
| player_steals | 6,630 | 66.03 | -0.39 | +0.59 | -0.99 |
| player_threes | 9,671 | 63.97 | -1.61 | -1.23 | -0.37 |
