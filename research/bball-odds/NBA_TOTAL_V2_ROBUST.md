# NBA total round 2 — robustness

Baseline: 383 features, ridge, bets at |predicted residual| ≥ 2 points. `edge` is win% minus the best blind side inside the same rows. Breakeven −110 = 52.4%.

## 1. Random 70% feature subsets

The thesis is that the signal is spread across ~30 weak columns. If so, throwing away a random third of them should barely register. If one lucky column is carrying everything, these collapse.

| run | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| **baseline** | 383 | +0.0672 | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| drop-1 | 268 | +0.0712 | 2207 | 54.0 | 50.1 | **+3.9** | +3.0 |
| drop-2 | 268 | +0.0648 | 2169 | 53.3 | 50.2 | **+3.1** | +1.8 |
| drop-3 | 268 | +0.0599 | 2123 | 52.6 | 50.0 | **+2.6** | +0.4 |
| drop-4 | 268 | +0.0705 | 2166 | 53.6 | 50.2 | **+3.4** | +2.3 |
| drop-5 | 268 | +0.0644 | 2207 | 53.6 | 50.2 | **+3.4** | +2.4 |
| drop-6 | 268 | +0.0647 | 2180 | 53.6 | 50.3 | **+3.3** | +2.4 |
| drop-7 | 268 | +0.0696 | 2173 | 53.8 | 50.3 | **+3.5** | +2.8 |
| drop-8 | 268 | +0.0646 | 2158 | 53.9 | 50.2 | **+3.7** | +2.9 |

Spread across the eight subsets: **+2.6 to +3.9** (mean +3.4). Round 1's comparable swing was 13.6 points.

## 2. Leave-one-theme-out

| removed | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| **baseline** | 383 | +0.0672 | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| −absence (64) | 319 | +0.0597 | 2185 | 52.8 | 50.2 | **+2.6** | +0.8 |
| −box_form (112) | 271 | +0.0651 | 2202 | 52.7 | 50.6 | **+2.1** | +0.6 |
| −form_delta (48) | 335 | +0.0636 | 2222 | 53.2 | 50.4 | **+2.7** | +1.5 |
| −line_level (1) | 382 | +0.0672 | 2288 | 53.8 | 50.3 | **+3.5** | +2.7 |
| −schedule (14) | 369 | +0.0705 | 2260 | 54.4 | 50.1 | **+4.3** | +3.8 |
| −structural (4) | 379 | +0.0676 | 2288 | 53.5 | 50.4 | **+3.1** | +2.2 |
| −style (44) | 339 | +0.0674 | 2131 | 54.1 | 50.9 | **+3.2** | +3.3 |
| −usage (96) | 287 | +0.0442 | 2023 | 52.5 | 51.2 | **+1.4** | +0.3 |

## 3. Hyperparameter sensitivity

Neither alpha nor the training window was searched — both were picked by hand. A result that only exists at one setting is a setting, not a result.

| setting | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| alpha=10 | +0.0699 | 2494 | 53.2 | 50.4 | **+2.8** | +1.6 |
| alpha=30 | +0.0691 | 2456 | 53.1 | 50.2 | **+2.9** | +1.3 |
| alpha=100 | +0.0668 | 2374 | 53.3 | 50.0 | **+3.3** | +1.8 |
| alpha=300 | +0.0648 | 2234 | 53.5 | 50.2 | **+3.3** | +2.2 |
| alpha=1000 | +0.0631 | 2013 | 53.1 | 50.4 | **+2.7** | +1.4 |
| alpha=3000 | +0.0600 | 1710 | 52.9 | 51.1 | **+1.9** | +1.0 |
| min_train=800 | +0.0492 | 2935 | 52.5 | 50.5 | **+2.0** | +0.2 |
| min_train=1500 | +0.0672 | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| min_train=2500 | +0.0784 | 1755 | 54.6 | 50.8 | **+3.9** | +4.3 |

## 4. Every season, min_train=800

Round 2's table skipped 2022 entirely — 1,500 training rows eats a season and a half. At 800 it grades, and it is the one season this model has never been scored on. Pooled here: oos corr +0.0492, edge +2.0, ROI +0.2.

| season | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2022 | 368 | 43.5 | 50.8 | **-7.3** | -17.0 |
| 2023 | 928 | 51.3 | 50.2 | **+1.1** | -2.1 |
| 2024 | 853 | 54.5 | 52.1 | **+2.5** | +4.1 |
| 2025 | 786 | 56.0 | 50.5 | **+5.5** | +6.9 |

| phase | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 641 | 56.0 | 52.4 | **+3.6** | +6.9 |
| MID | 862 | 53.9 | 51.5 | **+2.4** | +3.0 |
| LATE | 1223 | 50.0 | 51.7 | **-1.6** | -4.5 |
| POST | 209 | 50.2 | 54.1 | **-3.8** | -4.1 |

