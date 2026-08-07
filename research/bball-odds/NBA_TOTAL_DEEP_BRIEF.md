# NBA TOTAL at the open — the one live market, stressed

5,035 gradeable games (pushes removed), seasons ['2022', '2023', '2024', '2025']. Predictions are the same walk-forward, open-line-only fits from `nba_open_model.py`; nothing is refit here. Breakeven at 1.909 is **52.36%**.

`p_trim` is the blend with `mlp` removed. That member posts MAE 19.18 against the opener's 14.81 on 2025-26 -- a failed fit, not a weak one. If the finding is real, dropping it should help.

## 1 — Full blend vs trimmed blend

| model | cut | n | win% | ROI | CLV pts | CLV+ % | win by season |
|---|---|---|---|---|---|---|---|
| blend | top100% | 3,820 | 52.0 | -0.80 | +0.352 | 51.6 | 47/53/51/52 |
| blend | top50% | 1,910 | 53.2 | +1.55 | +0.429 | 52.8 | -/53/53/54 |
| blend | top25% | 955 | 53.6 | +2.35 | +0.581 | 54.9 | -/53/56/52 |
| blend | top10% | 382 | 54.7 | +4.45 | +0.598 | 56.8 | -/53/62/53 |
| blend | top5% | 191 | 56.5 | +7.95 | +0.568 | 57.1 | -/54/63/60 |
| trim | top100% | 3,820 | 52.5 | +0.15 | +0.366 | 51.8 | 47/53/52/52 |
| trim | top50% | 1,910 | 51.7 | -1.24 | +0.512 | 54.0 | -/54/52/50 |
| trim | top25% | 955 | 51.8 | -1.05 | +0.558 | 53.8 | -/54/53/49 |
| trim | top10% | 382 | 53.7 | +2.45 | +0.484 | 52.4 | -/54/54/55 |
| trim | top5% | 191 | 53.4 | +1.95 | +0.356 | 48.2 | -/52/57/57 |

## 2 — Calibration: does win% track the size of the edge? (`trim`)

A real handicap is monotone in its own magnitude across the WHOLE range. A lucky tail is flat everywhere and jumps only in the last bucket.

| edge bucket | n | mean edge | win% | ROI | CLV pts |
|---|---|---|---|---|---|
| 0.0–0.5 | 478 | 0.26 | 55.4 | +5.84 | +0.349 |
| 0.5–1.1 | 477 | 0.81 | 53.2 | +1.66 | +0.229 |
| 1.1–1.7 | 478 | 1.39 | 50.6 | -3.35 | +0.251 |
| 1.7–2.3 | 477 | 2.01 | 53.5 | +2.06 | +0.051 |
| 2.3–3.1 | 477 | 2.70 | 50.9 | -2.74 | +0.414 |
| 3.1–4.1 | 478 | 3.55 | 52.3 | -0.15 | +0.518 |
| 4.1–5.5 | 477 | 4.73 | 49.9 | -4.74 | +0.554 |
| 5.5–17.3 | 478 | 7.39 | 53.8 | +2.64 | +0.561 |

## 3 — Which side is the edge on? (`trim`)

An edge sitting entirely on one side is a bias in the model's level, not a handicap, and would not survive a season where scoring shifts.

| side | cut | n | win% | ROI | CLV pts | win by season |
|---|---|---|---|---|---|---|
| over | top100% | 2,047 | 53.1 | +1.28 | +0.328 | 45/53/54/52 |
| over | top25% | 537 | 51.6 | -1.53 | +0.580 | -/51/52/54 |
| over | top10% | 222 | 53.2 | +1.47 | +0.405 | -/55/52/58 |
| under | top100% | 1,773 | 51.8 | -1.15 | +0.410 | -/53/50/52 |
| under | top25% | 418 | 52.2 | -0.43 | +0.529 | -/56/54/43 |
| under | top10% | 160 | 54.4 | +3.81 | +0.592 | -/53/61/51 |

## 4 — Permutation test on the ranking (`trim`, 2,000 shuffles)

The edge is shuffled WITHIN each month, so the model's ordering is destroyed while the calendar mix is preserved. `p` = share of information-free rankings that matched or beat the observed cut.

| cut | n | win% | p(win) | ROI | p(ROI) |
|---|---|---|---|---|---|
| top50% | 1,910 | 51.7 | 0.8241 | -1.24 | 0.8101 |
| top25% | 955 | 51.8 | 0.6812 | -1.05 | 0.6587 |
| top10% | 382 | 53.7 | 0.3153 | +2.45 | 0.3148 |
| top5% | 191 | 53.4 | 0.3918 | +1.95 | 0.3888 |
