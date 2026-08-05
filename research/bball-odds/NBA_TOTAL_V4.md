# NBA full-game total — round 4: do the situational dimensions earn a place?

5,271 gradeable games. Walk-forward ridge on the residual vs the T-60 close, bets at |disagreement| ≥ 2 points. Round 3 is the incumbent; the only change is the 52 situational columns built from `nba_dims_panel`.

The scan filed team architecture, rotation experience and road-trip depth as *model ingredients, not bets*. This is the test of that claim — a card must clear the vig alone, a feature only has to carry information the other columns lack.

## 1. Headline

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| round 3 (incumbent) | 403 | +0.0725 | 2330 | 53.5 | 50.5 | **+3.0** | +2.2 |
| round 4 (+ situational dims) | 455 | +0.0653 | 2301 | 53.5 | 50.0 | **+3.5** | +2.2 |
| situational dims ALONE | 52 | +0.0009 | 1128 | 48.4 | 50.9 | **-2.5** | -7.6 |

## 2. Which theme is doing the work? (drop-one from the full set)

Each row removes ONE theme and refits. A theme that matters shows a DROP in both corr and edge. This is the same ablation that identified usage concentration as round 2's load-bearing block.

| dropped | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| − sched (4 cols) | 448 | +0.0617 | 2270 | 53.2 | 50.0 | **+3.1** | +1.5 |
| − arch (16 cols) | 439 | +0.0678 | 2297 | 53.5 | 50.1 | **+3.4** | +2.1 |
| − seq (0 cols) | 455 | +0.0653 | 2301 | 53.5 | 50.0 | **+3.5** | +2.2 |
| − trav (20 cols) | 435 | +0.0677 | 2301 | 53.2 | 50.1 | **+3.1** | +1.6 |
| − exp (4 cols) | 451 | +0.0674 | 2335 | 53.1 | 50.3 | **+2.8** | +1.3 |
| − ix (8 cols) | 447 | +0.0681 | 2307 | 53.8 | 50.1 | **+3.8** | +2.8 |

## 3. Each theme ADDED to round 3 on its own

The mirror of §2: does the theme help when it is the only thing added?

| added | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| + sched (4 cols) | 407 | +0.0728 | 2332 | 53.6 | 50.5 | **+3.0** | +2.3 |
| + arch (16 cols) | 419 | +0.0706 | 2319 | 53.2 | 50.6 | **+2.6** | +1.5 |
| + trav (20 cols) | 423 | +0.0716 | 2354 | 53.7 | 50.5 | **+3.2** | +2.4 |
| + exp (4 cols) | 407 | +0.0700 | 2306 | 53.1 | 50.0 | **+3.0** | +1.3 |
| + ix (8 cols) | 411 | +0.0722 | 2329 | 53.8 | 50.2 | **+3.6** | +2.7 |

## 4. Threshold ladder and season/phase split (round 4)

| k (pts) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| ≥0 | 3488 | 51.6 | 50.3 | **+1.3** | -1.5 |
| ≥1 | 2887 | 52.6 | 50.1 | **+2.5** | +0.4 |
| ≥2 | 2301 | 53.5 | 50.0 | **+3.5** | +2.2 |
| ≥3 | 1798 | 54.0 | 50.2 | **+3.8** | +3.1 |
| ≥4 | 1354 | 53.4 | 50.5 | **+2.9** | +1.9 |
| ≥5 | 985 | 53.1 | 50.8 | **+2.3** | +1.4 |
| ≥6 | 695 | 54.0 | 50.8 | **+3.2** | +3.0 |

| slice | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 649 | 50.8 | 52.2 | **-1.4** | -2.9 |
| 2024 | 873 | 53.5 | 51.8 | **+1.7** | +2.1 |
| 2025 | 779 | 55.8 | 50.1 | **+5.8** | +6.6 |
| EARLY | 369 | 56.1 | 50.4 | **+5.7** | +7.1 |
| MID | 830 | 53.1 | 51.1 | **+2.0** | +1.4 |
| LATE | 948 | 52.8 | 52.0 | **+0.8** | +0.9 |
| POST | 154 | 53.9 | 55.2 | **-1.3** | +2.9 |

## 5. Label-shuffle null on the round-4 config (8 draws, within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0653 | +0.0056 | 0.0116 | **+5.16** |
| edge @ k≥2 | +3.52 | -0.78 | 0.86 | **+4.97** |

