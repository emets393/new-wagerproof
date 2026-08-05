# NBA player-IMPACT model — the RAPM ceiling test

Same harness as `NBA_PLAYER_CEILING_BRIEF.md`, run on RAPM features instead of box-score rates. Fit on the market residual (actual − T-60 line), ridge alpha=25, expanding monthly walk-forward. **Negative R² means worse than trusting the line.**

Box-score baseline to beat: FG margin +4.8, FG total +4.0, 1H total +4.0, 1H margin +1.6, all with negative R², placebo band −3.7 to +2.2.

| market | feature set | n | corr(pred, resid) % | R² vs market % |
|---|---|---|---|---|
| 1H margin | semi-oracle LEVEL | 2,972 | -2.1 | -0.69 |
| 1H margin | durable LEVEL | 2,972 | -2.8 | -0.60 |
| 1H margin | projected LEVEL | 2,972 | -1.9 | -0.47 |
| 1H margin | semi-oracle SHOCK | 2,972 | +2.1 | -0.04 |
| 1H margin | durable SHOCK | 2,972 | +1.4 | -0.05 |
| 1H margin | semi-oracle OUT | 2,972 | +0.6 | -0.21 |
| 1H margin | durable OUT | 2,972 | +3.5 | -0.05 |
| 1H margin | projected OUT | 2,972 | +2.2 | -0.18 |
| 1H margin | semi-oracle ALL | 2,972 | +0.5 | -0.79 |
| 1H margin | durable ALL | 2,972 | +2.0 | -0.58 |
| 1H margin | **placebo (rows permuted)** | 2,972 | -5.8 | -1.21 |
| 1H total | semi-oracle LEVEL | 2,972 | +5.0 | +0.02 |
| 1H total | durable LEVEL | 2,972 | +2.0 | -0.33 |
| 1H total | projected LEVEL | 2,972 | +3.0 | -0.14 |
| 1H total | semi-oracle SHOCK | 2,972 | +4.3 | +0.14 |
| 1H total | durable SHOCK | 2,972 | +2.4 | -0.05 |
| 1H total | semi-oracle OUT | 2,972 | -2.0 | -0.34 |
| 1H total | durable OUT | 2,972 | -1.0 | -0.49 |
| 1H total | projected OUT | 2,972 | -0.9 | -0.30 |
| 1H total | semi-oracle ALL | 2,972 | +4.2 | -0.32 |
| 1H total | durable ALL | 2,972 | +1.2 | -0.96 |
| 1H total | **placebo (rows permuted)** | 2,972 | -1.9 | -1.20 |
| FG margin | semi-oracle LEVEL | 4,323 | +3.9 | -0.10 |
| FG margin | durable LEVEL | 4,323 | +3.3 | -0.13 |
| FG margin | projected LEVEL | 4,323 | +4.1 | -0.02 |
| FG margin | semi-oracle SHOCK | 4,323 | +3.2 | +0.03 |
| FG margin | durable SHOCK | 4,323 | +1.5 | -0.11 |
| FG margin | semi-oracle OUT | 4,323 | -0.0 | -0.37 |
| FG margin | durable OUT | 4,323 | +0.8 | -0.38 |
| FG margin | projected OUT | 4,323 | -0.8 | -0.43 |
| FG margin | semi-oracle ALL | 4,323 | +3.9 | -0.39 |
| FG margin | durable ALL | 4,323 | +3.5 | -0.44 |
| FG margin | **placebo (rows permuted)** | 4,323 | -0.3 | -0.73 |
| FG total | semi-oracle LEVEL | 4,323 | +4.9 | +0.20 |
| FG total | durable LEVEL | 4,323 | +3.3 | -0.03 |
| FG total | projected LEVEL | 4,323 | +3.3 | +0.03 |
| FG total | semi-oracle SHOCK | 4,323 | +5.8 | +0.35 |
| FG total | durable SHOCK | 4,323 | +3.7 | +0.12 |
| FG total | semi-oracle OUT | 4,323 | -2.4 | -0.45 |
| FG total | durable OUT | 4,323 | -0.4 | -0.15 |
| FG total | projected OUT | 4,323 | -4.5 | -0.37 |
| FG total | semi-oracle ALL | 4,323 | +4.1 | -0.26 |
| FG total | durable ALL | 4,323 | +3.7 | -0.24 |
| FG total | **placebo (rows permuted)** | 4,323 | -0.1 | -0.60 |

## Hypothesis 1 — does OUT beat LEVEL?

Registered before the run. The market prices roster quality over the summer and cannot pre-price tonight's absences. If LEVEL scores and OUT does not, the model is re-reading team strength that the line already contains.

| market | LEVEL (dur) | OUT (dur) | SHOCK (dur) | placebo |
|---|---|---|---|---|
| 1H margin | -2.8 | +3.5 | +1.4 | -5.8 |
| 1H total | +2.0 | -1.0 | +2.4 | -1.9 |
| FG margin | +3.3 | +0.8 | +1.5 | -0.3 |
| FG total | +3.3 | -0.4 | +3.7 | -0.1 |

## Hypothesis 3 — how much is an availability feed worth?

`sem` knows who is actually out; `prj` only knows who played last game.

| market | sem OUT (exact) | dur OUT (bettable) | prj OUT (no feed) | dur LEVEL |
|---|---|---|---|---|
| 1H margin | +0.6 | +3.5 | +2.2 | -2.8 |
| 1H total | -2.0 | -1.0 | -0.9 | +2.0 |
| FG margin | -0.0 | +0.8 | -0.8 | +3.3 |
| FG total | -2.4 | -0.4 | -4.5 | +3.3 |

## By season phase

| market | feature set | early | mid | late | playoffs |
|---|---|---|---|---|---|
| 1H margin | durable LEVEL | +3.7 (n=450) | -4.2 (n=1,016) | -4.5 (n=1,262) | +1.8 (n=244) |
| 1H margin | durable OUT | +1.1 (n=450) | +3.9 (n=1,016) | +4.3 (n=1,262) | +1.3 (n=244) |
| 1H margin | durable ALL | +2.0 (n=450) | +0.2 (n=1,016) | +2.2 (n=1,262) | +6.0 (n=244) |
| 1H margin | placebo | -4.1 (n=450) | -2.0 (n=1,016) | -8.9 (n=1,262) | -5.1 (n=244) |
| 1H total | durable LEVEL | -1.6 (n=450) | +3.2 (n=1,016) | +3.4 (n=1,262) | +0.5 (n=244) |
| 1H total | durable OUT | -2.2 (n=450) | -0.0 (n=1,016) | -0.6 (n=1,262) | -1.4 (n=244) |
| 1H total | durable ALL | -3.3 (n=450) | +5.3 (n=1,016) | +1.2 (n=1,262) | +0.4 (n=244) |
| 1H total | placebo | -1.8 (n=450) | +0.7 (n=1,016) | -4.0 (n=1,262) | -0.8 (n=244) |
| FG margin | durable LEVEL | +8.7 (n=649) | +2.8 (n=1,521) | +2.1 (n=1,827) | +1.4 (n=326) |
| FG margin | durable OUT | +2.8 (n=649) | +2.5 (n=1,521) | -0.2 (n=1,827) | -1.3 (n=326) |
| FG margin | durable ALL | +9.1 (n=649) | +3.8 (n=1,521) | +1.9 (n=1,827) | +2.0 (n=326) |
| FG margin | placebo | -4.0 (n=649) | -1.9 (n=1,521) | +2.2 (n=1,827) | +0.8 (n=326) |
| FG total | durable LEVEL | +7.0 (n=649) | +2.5 (n=1,521) | +4.2 (n=1,827) | -4.1 (n=326) |
| FG total | durable OUT | +6.0 (n=649) | -2.1 (n=1,521) | +0.4 (n=1,827) | -4.1 (n=326) |
| FG total | durable ALL | +6.4 (n=649) | +4.3 (n=1,521) | +4.4 (n=1,827) | -7.0 (n=326) |
| FG total | placebo | -3.6 (n=649) | -0.3 (n=1,521) | +0.5 (n=1,827) | +5.3 (n=326) |

## What it would have actually bet

### 1H margin — durable OUT — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 2,935 | 40% high | 50.7 | 50.8 | -3.3 | 49.2 | 2023:50/409 2024:51/1257 2025:51/1269 |
| 1 | 238 | 52% high | 57.6 | 51.7 | +10.0 | 52.5 | 2023:65/43 2024:57/123 2025:54/72 |

### 1H margin — PLACEBO — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 2,935 | 49% high | 49.0 | 50.8 | -6.5 | 47.5 | 2023:46/409 2024:51/1257 2025:48/1269 |
| 1 | 381 | 54% high | 44.6 | 53.0 | -14.8 | 40.4 | 2023:44/136 2024:43/127 2025:47/118 |

### 1H total — semi-oracle LEVEL — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 2,943 | 43% high | 51.9 | 50.4 | -0.9 | 50.4 | 2023:54/411 2024:51/1260 2025:52/1272 |
| 1 | 922 | 40% high | 51.6 | 51.5 | -1.4 | 48.9 | 2023:51/162 2024:52/422 2025:51/338 |
| 2 | 173 | 52% high | 50.9 | 57.2 | -2.9 | 44.5 | 2023:51/41 2024:51/101 2025:48/31 |

### 1H total — PLACEBO — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 2,943 | 53% high | 49.6 | 50.4 | -5.3 | 48.1 | 2023:50/411 2024:49/1260 2025:50/1272 |
| 1 | 764 | 49% high | 50.3 | 53.3 | -4.0 | 47.4 | 2023:49/188 2024:51/430 2025:51/146 |
| 2 | 179 | 46% high | 49.2 | 50.3 | -6.1 | 43.0 | 2023:45/65 2024:53/99 2025:47/15 |

### FG margin — projected LEVEL — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 4,257 | 60% high | 50.7 | 50.1 | -3.1 | 49.4 | 2022:51/514 2023:51/1223 2024:49/1259 2025:52/1261 |
| 1 | 1,244 | 67% high | 52.4 | 52.7 | +0.1 | 50.1 | 2022:48/242 2023:53/480 2024:50/304 2025:60/218 |
| 2 | 273 | 66% high | 57.5 | 52.4 | +9.8 | 52.4 | 2022:56/70 2023:55/118 2024:50/38 2025:72/47 |

### FG margin — PLACEBO — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 4,257 | 63% high | 50.0 | 50.1 | -4.5 | 48.8 | 2022:50/514 2023:48/1223 2024:51/1259 2025:51/1261 |
| 1 | 1,126 | 68% high | 49.7 | 50.9 | -5.0 | 47.2 | 2022:52/229 2023:48/341 2024:51/331 2025:49/225 |
| 2 | 276 | 70% high | 50.4 | 51.8 | -3.8 | 45.3 | 2022:58/83 2023:47/117 2024:46/57 2025:53/19 |

### FG total — semi-oracle SHOCK — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 4,287 | 73% high | 51.0 | 50.7 | -2.7 | 49.7 | 2022:50/519 2023:50/1230 2024:53/1267 2025:50/1271 |
| 1 | 2,218 | 82% high | 50.9 | 51.4 | -2.7 | 49.2 | 2022:49/314 2023:50/670 2024:53/604 2025:51/630 |
| 2 | 954 | 86% high | 51.7 | 52.0 | -1.3 | 49.0 | 2022:48/165 2023:46/322 2024:58/215 2025:56/252 |
| 3 | 360 | 86% high | 53.9 | 54.4 | +2.9 | 49.4 | 2022:49/76 2023:49/141 2024:61/59 2025:62/84 |
| 4 | 132 | 87% high | 56.1 | 61.4 | +7.0 | 48.5 | 2022:50/32 2023:48/56 2024:72/18 2025:69/26 |

### FG total — PLACEBO — bets vs the T-60 close

| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | by season (win% / n) |
|---|---|---|---|---|---|---|---|
| 0 | 4,287 | 76% high | 49.3 | 50.7 | -5.8 | 48.1 | 2022:51/519 2023:48/1230 2024:52/1267 2025:47/1271 |
| 1 | 2,249 | 88% high | 50.7 | 51.2 | -3.2 | 49.1 | 2022:56/318 2023:49/806 2024:52/662 2025:48/463 |
| 2 | 935 | 94% high | 52.0 | 52.1 | -0.8 | 49.3 | 2022:56/176 2023:53/411 2024:50/218 2025:49/130 |
| 3 | 328 | 96% high | 55.5 | 56.1 | +5.9 | 50.9 | 2022:56/89 2023:58/163 2024:43/49 2025:63/27 |
| 4 | 123 | 95% high | 55.3 | 60.2 | +5.5 | 48.0 | 2022:57/40 2023:59/56 2024:36/14 2025:54/13 |
