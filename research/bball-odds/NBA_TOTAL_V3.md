# NBA full-game total — round 3

5,271 gradeable games. Ridge on the residual vs the T-60 close. Bets taken when the model disagrees with the line by ≥2 points. `base` is the best blind side inside the same rows; breakeven at −110 is 52.4%.

## 1. Does repairing the opponent-adjusted ratings help?

Walk-forward, identical settings, the only difference being the 9 repaired rating columns. See `NBA_ADJ_RATINGS_FIX.md` for what was broken.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| round 2 (broken ratings excluded) | 383 | +0.0672 | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| round 3 (+ repaired ratings) | 400 | +0.0688 | 2311 | 53.3 | 50.6 | **+2.6** | +1.7 |
| repaired ratings ALONE | 17 | +0.0260 | 617 | 53.2 | 52.8 | **+0.3** | +1.5 |

## 2. Threshold ladder, round 3

| k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 3488 | 52.7 | 50.3 | **+2.4** | +0.5 |
| ≥1 | 2906 | 53.1 | 50.7 | **+2.4** | +1.3 |
| ≥2 | 2311 | 53.3 | 50.6 | **+2.6** | +1.7 |
| ≥3 | 1768 | 53.2 | 50.3 | **+2.9** | +1.6 |
| ≥4 | 1301 | 54.7 | 50.6 | **+4.1** | +4.3 |
| ≥5 | 924 | 54.2 | 51.1 | **+3.1** | +3.5 |
| ≥6 | 663 | 55.2 | 51.6 | **+3.6** | +5.4 |

## 3. Walk-forward by season and phase (round 3, k ≥ 2)

| slice | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 666 | 49.2 | 53.0 | **-3.8** | -6.0 |
| 2024 | 856 | 54.3 | 51.8 | **+2.6** | +3.7 |
| 2025 | 789 | 55.5 | 51.2 | **+4.3** | +6.0 |
| EARLY | 368 | 55.4 | 51.6 | **+3.8** | +5.8 |
| MID | 846 | 53.8 | 52.2 | **+1.5** | +2.7 |
| LATE | 929 | 51.7 | 51.9 | **-0.2** | -1.4 |
| POST | 168 | 54.8 | 54.2 | **+0.6** | +4.5 |

## 4. Season holdout — burn-in or regime? (DIAGNOSTIC, NOT BETTABLE)

Each season predicted by a model trained on the other three IN FULL. This uses future data, so the numbers are **not** achievable live — the only question it answers is whether 2022's walk-forward loss is a training-size artefact (it should grade normally here) or a genuine regime break (it should still lose).

| season | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2022 | 790 | 52.9 | 51.3 | **+1.6** | +1.0 |
| 2023 | 884 | 51.1 | 51.2 | **-0.1** | -2.4 |
| 2024 | 862 | 55.6 | 53.6 | **+2.0** | +6.1 |
| 2025 | 814 | 54.4 | 51.4 | **+3.1** | +3.9 |

## 5. Label-shuffle null on the round-3 config (8 draws, within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0688 | -0.0037 | 0.0140 | **+5.18** |
| edge @ k≥2 | +2.64 | -0.52 | 1.18 | **+2.68** |

