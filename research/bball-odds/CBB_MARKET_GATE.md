# CBB — did the cut help, market by market?

`cbb_market_models.py --stage gate`. Two configurations per market at a 365d half-life: **CUT** is the pre-registered family rule, **GATED** adds the aggregate check — only cut a market whose mean drop-one delta is positive, which is `h1_total` and `h1_spread` and nothing else. Where the two agree the market appears once.

**Read the season rows, not the pooled ROI.** Both configurations were selected on these rows; only per-season consistency distinguishes a real improvement from a lucky one.


## Team total

| config | features | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| CUT ≥1 | 227 | context | 14,213 | 53.2 | 51.3 | +1.9 | **-0.6** | **+4.71** |
| CUT ≥2 | 227 | context | 4,177 | 54.3 | 51.7 | +2.6 | **+1.2** | **+2.47** |
| **CUT ≥3** | 227 | context | 891 | 55.8 | 52.1 | +3.7 | **+3.8** | **+1.36** |
| CUT ≥4 | 227 | context | 139 | 58.3 | 53.2 | +5.0 | **+8.3** | **+0.51** |
| GATED ≥1 | 236 | nothing | 14,360 | 53.1 | 51.3 | +1.9 | **-0.7** | **+3.74** |
| GATED ≥2 | 236 | nothing | 4,308 | 54.2 | 51.9 | +2.4 | **+1.1** | **+2.73** |
| **GATED ≥3** | 236 | nothing | 938 | 55.7 | 51.0 | +4.7 | **+3.5** | **+2.16** |
| GATED ≥4 | 236 | nothing | 148 | 56.8 | 51.4 | +5.4 | **+5.9** | **+1.23** |

### Per season at the 3-pts cut — the tiebreak

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT | 2023-24 | 425 | 56.5 | 56.0 | +0.5 | **+4.5** |
| CUT | 2024-25 | 277 | 52.3 | 50.5 | +1.8 | **-2.3** |
| CUT | 2025-26 | 189 | 59.3 | 52.9 | +6.3 | **+11.3** |
| GATED | 2023-24 | 450 | 57.1 | 54.2 | +2.9 | **+5.5** |
| GATED | 2024-25 | 278 | 51.8 | 51.1 | +0.7 | **-3.3** |
| GATED | 2025-26 | 210 | 57.6 | 53.3 | +4.3 | **+8.2** |


## Full-game total

| config | features | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| CUT ≥1 | 204 | style_raw | 10,552 | 51.5 | 50.3 | +1.2 | **-1.7** | **+2.79** |
| CUT ≥2 | 204 | style_raw | 5,327 | 51.4 | 50.0 | +1.4 | **-1.8** | **+2.13** |
| CUT ≥3 | 204 | style_raw | 2,396 | 52.7 | 50.2 | +2.5 | **+0.6** | **+2.97** |
| **CUT ≥4** | 204 | style_raw | 906 | 52.9 | 50.2 | +2.6 | **+0.9** | **+2.18** |
| CUT ≥5 | 204 | style_raw | 374 | 52.7 | 51.6 | +1.1 | **+0.5** | **+0.99** |
| CUT ≥6 | 204 | style_raw | 153 | 49.7 | 50.3 | -0.7 | **-5.2** | **+0.60** |
| GATED ≥1 | 236 | nothing | 10,801 | 51.8 | 50.2 | +1.5 | **-1.2** | **+3.51** |
| GATED ≥2 | 236 | nothing | 5,760 | 51.4 | 50.3 | +1.1 | **-1.9** | **+1.41** |
| GATED ≥3 | 236 | nothing | 2,725 | 51.7 | 50.1 | +1.6 | **-1.4** | **+1.91** |
| **GATED ≥4** | 236 | nothing | 1,099 | 53.1 | 50.9 | +2.3 | **+1.4** | **+1.54** |
| GATED ≥5 | 236 | nothing | 432 | 51.9 | 50.9 | +0.9 | **-1.0** | **+0.73** |
| GATED ≥6 | 236 | nothing | 180 | 51.1 | 50.0 | +1.1 | **-2.5** | **+0.83** |

### Per season at the 4-pts cut — the tiebreak

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT | 2022-23 | 99 | 39.4 | 60.6 | -21.2 | **-24.8** |
| CUT | 2023-24 | 468 | 52.4 | 52.8 | -0.4 | **-0.1** |
| CUT | 2024-25 | 193 | 57.0 | 51.8 | +5.2 | **+8.8** |
| CUT | 2025-26 | 146 | 58.2 | 52.7 | +5.5 | **+11.0** |
| GATED | 2022-23 | 99 | 40.4 | 59.6 | -19.2 | **-22.9** |
| GATED | 2023-24 | 536 | 52.6 | 51.1 | +1.5 | **+0.4** |
| GATED | 2024-25 | 268 | 57.5 | 50.4 | +7.1 | **+9.6** |
| GATED | 2025-26 | 196 | 55.1 | 53.6 | +1.5 | **+5.1** |


## Full-game spread

| config | features | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| CUT ≥1 | 164 | form_l5, heat, season_s2d | 7,455 | 54.5 | 50.6 | +3.9 | **+4.0** | **+3.87** |
| **CUT ≥2** | 164 | form_l5, heat, season_s2d | 2,368 | 56.7 | 50.3 | +6.4 | **+8.3** | **+2.96** |
| CUT ≥3 | 164 | form_l5, heat, season_s2d | 593 | 58.2 | 50.9 | +7.3 | **+11.1** | **+2.62** |
| CUT ≥4 | 164 | form_l5, heat, season_s2d | 125 | 54.4 | 50.4 | +4.0 | **+3.9** | **+nan** |
| GATED ≥1 | 236 | nothing | 8,473 | 53.9 | 50.7 | +3.2 | **+3.0** | **+4.14** |
| **GATED ≥2** | 236 | nothing | 3,170 | 55.0 | 50.2 | +4.8 | **+5.1** | **+2.79** |
| GATED ≥3 | 236 | nothing | 909 | 57.2 | 51.5 | +5.7 | **+9.3** | **+2.23** |
| GATED ≥4 | 236 | nothing | 209 | 55.0 | 50.7 | +4.3 | **+5.1** | **+1.36** |
| GATED ≥5 | 236 | nothing | 40 | 50.0 | 52.5 | -2.5 | **-4.5** | **+nan** |

### Per season at the 2-pts cut — the tiebreak

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT | 2023-24 | 856 | 56.8 | 50.4 | +6.4 | **+8.4** |
| CUT | 2024-25 | 864 | 57.5 | 50.2 | +7.3 | **+9.9** |
| CUT | 2025-26 | 634 | 55.4 | 52.1 | +3.3 | **+5.7** |
| GATED | 2022-23 | 30 | 50.0 | 56.7 | -6.7 | **-4.6** |
| GATED | 2023-24 | 1,126 | 56.0 | 51.2 | +4.9 | **+7.0** |
| GATED | 2024-25 | 1,140 | 53.0 | 51.1 | +1.8 | **+1.2** |
| GATED | 2025-26 | 874 | 56.6 | 51.0 | +5.6 | **+8.2** |


## Moneyline

| config | features | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| CUT ≥1 | 103 | context, form_l5, pctile, possession, style_raw | 13,651 | 63.4 | 63.8 | -0.4 | **+0.2** | **+0.98** |
| CUT ≥2 | 103 | context, form_l5, pctile, possession, style_raw | 10,074 | 64.6 | 63.7 | +0.9 | **+0.9** | **+0.69** |
| **CUT ≥3** | 103 | context, form_l5, pctile, possession, style_raw | 6,671 | 64.1 | 61.9 | +2.1 | **+2.4** | **+0.98** |
| CUT ≥5 | 103 | context, form_l5, pctile, possession, style_raw | 2,612 | 61.3 | 58.0 | +3.2 | **+2.5** | **+1.07** |
| CUT ≥7 | 103 | context, form_l5, pctile, possession, style_raw | 1,000 | 63.6 | 59.6 | +4.0 | **+5.1** | **+1.02** |
| CUT ≥10 | 103 | context, form_l5, pctile, possession, style_raw | 262 | 73.3 | 72.5 | +0.8 | **+5.1** | **+0.75** |
| GATED ≥1 | 236 | nothing | 14,386 | 62.4 | 63.7 | -1.3 | **+0.3** | **+1.98** |
| GATED ≥2 | 236 | nothing | 11,520 | 63.2 | 63.5 | -0.3 | **+0.1** | **+1.60** |
| **GATED ≥3** | 236 | nothing | 8,664 | 62.6 | 61.7 | +0.9 | **+1.6** | **+2.25** |
| GATED ≥5 | 236 | nothing | 4,392 | 60.4 | 58.5 | +1.9 | **+4.5** | **+2.34** |
| GATED ≥7 | 236 | nothing | 2,174 | 60.6 | 56.9 | +3.7 | **+3.5** | **+2.16** |
| GATED ≥10 | 236 | nothing | 700 | 64.0 | 61.7 | +2.3 | **+4.5** | **+1.42** |

### Per season at the 3-% cut — the tiebreak

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT | 2022-23 | 49 | 42.9 | 75.5 | -32.7 | **+1.0** |
| CUT | 2023-24 | 2,365 | 64.9 | 61.7 | +3.2 | **+1.6** |
| CUT | 2024-25 | 2,260 | 66.8 | 63.8 | +3.0 | **+4.5** |
| CUT | 2025-26 | 1,997 | 60.4 | 59.6 | +0.8 | **+1.0** |
| GATED | 2022-23 | 62 | 46.8 | 66.1 | -19.4 | **+1.8** |
| GATED | 2023-24 | 3,007 | 64.1 | 62.5 | +1.7 | **+0.8** |
| GATED | 2024-25 | 2,978 | 64.4 | 61.9 | +2.5 | **+3.9** |
| GATED | 2025-26 | 2,617 | 59.1 | 60.5 | -1.4 | **-0.2** |


## First-half total

Both configurations are identical here (cut: adv, season_s2d, star), so there is nothing to choose between.


## First-half spread

Both configurations are identical here (cut: context, schedule), so there is nothing to choose between.


## First-half moneyline

Both configurations are identical here (cut: nothing), so there is nothing to choose between.

