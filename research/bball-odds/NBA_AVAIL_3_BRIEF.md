# NBA availability round 3 — controls + team totals

3,832 games, 3 seasons. FG/1H/TT graded at the T-60 consensus (decimal median). The 2H column is **SYNTHETIC and DIAGNOSTIC ONLY** — real 2H lines open at halftime off the actual 1H score, so nothing here is a 2H bet. BE 52.4%.

## A — CONTROL: the same 1H bet with nobody out

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| moderate star out → BACK depleted (pooled) [1H] | 448 | 56.0% | +6.8% | 2023-24:61 2024-25:55 2025-26:52 |
| …depleted team AWAY → BACK [1H] | 224 | 58.9% | +12.3% | 2023-24:64 2024-25:57 2025-26:55 |
| …depleted team HOME → BACK [1H] | 224 | 53.1% | +1.2% | 2023-24:57 2024-25:54 2025-26:49 |
| CONTROL nobody out → back AWAY [1H] | 2,260 | 48.1% | -8.2% | 2023-24:47 2024-25:49 2025-26:48 |
| CONTROL nobody out → back HOME [1H] | 2,260 | 51.9% | -1.0% | 2023-24:53 2024-25:51 2025-26:52 |
| …AWAY depleted, |FG spread| 0-4 → BACK [1H] | 48 | 66.7% | +27.1% | 2023-24:68 2024-25:61 2025-26:75 |
| CONTROL nobody out, |FG spread| 0-4 → back AWAY [1H] | 713 | 47.8% | -8.7% | 2023-24:50 2024-25:53 2025-26:42 |
| …AWAY depleted, |FG spread| 4-8 → BACK [1H] | 82 | 62.2% | +18.4% | 2023-24:65 2024-25:61 2025-26:59 |
| CONTROL nobody out, |FG spread| 4-8 → back AWAY [1H] | 809 | 49.2% | -6.0% | 2023-24:45 2024-25:52 2025-26:51 |
| …AWAY depleted, |FG spread| 8-30 → BACK [1H] | 94 | 52.1% | -0.6% | 2023-24:59 2024-25:50 2025-26:47 |
| CONTROL nobody out, |FG spread| 8-30 → back AWAY [1H] | 738 | 47.2% | -10.0% | 2023-24:48 2024-25:44 2025-26:49 |

## B — moderate-star-out 1H back: robustness

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| pooled → BACK depleted [1H] | 448 | 56.0% | +6.8% | 2023-24:61 2024-25:55 2025-26:52 |
| pooled, graded FLAT -110 [1H] | 448 | 56.0% | +7.0% | 2023-24:61 2024-25:55 2025-26:52 |
| pooled, DROP 2023-24 [1H] | 302 | 53.6% | +2.3% | 2024-25:55 2025-26:52 |
| pooled, DROP 2024-25 [1H] | 274 | 56.6% | +7.8% | 2023-24:61 2025-26:52 |
| pooled, DROP 2025-26 [1H] | 320 | 57.8% | +10.2% | 2023-24:61 2024-25:55 |
| pooled, first 20 gp [1H] | 76 | 53.9% | +2.8% | 2023-24:58 2024-25:50 2025-26:54 |
| pooled, games 20-40 [1H] | 107 | 55.1% | +5.3% | 2023-24:58 2024-25:60 2025-26:43 |
| pooled, games 41+ [1H] | 265 | 57.0% | +8.5% | 2023-24:63 2024-25:54 2025-26:54 |
| moderate out, opponent ANY absence allowed → BACK [1H] | 460 | 56.1% | +6.9% | 2023-24:60 2024-25:55 2025-26:52 |
| …and he is the MINUTES leader → BACK [1H] | 192 | 52.1% | -0.6% | 2023-24:58 2024-25:51 2025-26:48 |
| …and he is NOT the minutes leader → BACK [1H] | 256 | 59.0% | +12.3% | 2023-24:63 2024-25:59 2025-26:54 |

## C — DIAGNOSTIC: where the damage lands, by points removed

| points removed | n | mean 1H edge (pts vs 1H line) | mean 2H edge (vs synthetic) | FG edge |
|---|---|---|---|---|
| 0-12 ppg out | 278 | +0.44 | -0.41 | +0.04 |
| 12-20 ppg out | 469 | +0.10 | +0.47 | +0.57 |
| 20-30 ppg out | 365 | +1.14 | -1.33 | -0.19 |
| 30-∞ ppg out | 172 | -0.63 | -1.24 | -1.87 |

Positive = the depleted team beat that line. A number that is positive in the 1H and negative in the 2H is the back-loading, measured directly.

## D — FULL-GAME team totals (T-60), the cleanest absence market

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| CONTROL nobody out → HOME team total [TT under] | 2,279 | 49.5% | -5.8% | 2023-24:50 2024-25:49 2025-26:49 |
| CONTROL nobody out → AWAY team total [TT under] | 2,279 | 50.4% | -3.8% | 2023-24:48 2024-25:51 2025-26:53 |
| ≥18ppg star out → depleted team's OWN total [TT under] | 689 | 48.9% | -6.8% | 2023-24:43 2024-25:52 2025-26:51 |
| ≥18ppg star out → depleted team's OWN total [TT over] | 689 | 51.1% | -3.3% | 2023-24:57 2024-25:48 2025-26:49 |
| ≥18ppg star out → the OPPONENT's total [TT over] | 687 | 51.8% | -2.2% | 2023-24:50 2024-25:51 2025-26:54 |
| ≥25ppg star out → depleted team's OWN total [TT under] | 233 | 52.8% | +0.8% | 2023-24:46 2024-25:57 2025-26:54 |
| ≥25ppg star out → depleted team's OWN total [TT over] | 233 | 47.2% | -10.7% | 2023-24:54 2024-25:43 2025-26:46 |
| ≥25ppg star out → the OPPONENT's total [TT over] | 233 | 55.4% | +4.6% | 2023-24:61 2024-25:54 2025-26:52 |
| 20+ ppg removed → depleted team's OWN total [TT under] | 552 | 49.5% | -5.7% | 2023-24:43 2024-25:52 2025-26:53 |
| 20+ ppg removed → depleted team's OWN total [TT over] | 552 | 50.5% | -4.6% | 2023-24:57 2024-25:48 2025-26:47 |
| 30+ ppg removed → depleted team's OWN total [TT under] | 176 | 51.1% | -2.8% | 2023-24:43 2024-25:61 2025-26:49 |
| 30+ ppg removed → depleted team's OWN total [TT over] | 176 | 48.9% | -7.7% | 2023-24:57 2024-25:39 2025-26:51 |
| 40+ ppg removed → depleted team's OWN total [TT under] | 83 | 51.8% | -2.3% | 2023-24:45 2024-25:62 2025-26:49 |
| 40+ ppg removed → depleted team's OWN total [TT over] | 83 | 48.2% | -8.8% | 2023-24:55 2024-25:38 2025-26:51 |
| ≥20ppg star RETURNING → his team's total [TT under] | 485 | 52.8% | +0.7% | 2023-24:52 2024-25:56 2025-26:50 |
| CONTROL stale 20+ ppg out (priced) → own total [TT under] | 697 | 52.4% | -0.4% | 2023-24:48 2024-25:56 2025-26:53 |

## E — AWAY team missing a moderate scorer, close game (the survivor)

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| **AWAY moderate star out, |FG spread|<8 → BACK away [1H]** | 130 | 63.8% | +21.6% | 2023-24:66 2024-25:61 2025-26:64 |
| …graded FLAT -110 | 130 | 63.8% | +21.9% | 2023-24:66 2024-25:61 2025-26:64 |
| …DROP 2023-24 | 74 | 62.2% | +18.6% | 2024-25:61 2025-26:64 |
| …DROP 2024-25 | 81 | 65.4% | +24.6% | 2023-24:66 2025-26:64 |
| …DROP 2025-26 | 105 | 63.8% | +21.5% | 2023-24:66 2024-25:61 |
| MIRROR: HOME moderate star out, |FG spread|<8 → BACK home [1H] | 141 | 58.2% | +10.8% | 2023-24:57 2024-25:59 2025-26:57 |
| SPECIFICITY: same games on the FULL-GAME spread | 129 | 58.9% | +12.5% | 2023-24:61 2024-25:60 2025-26:52 |
| SPECIFICITY: same games, 2H SYNTHETIC (fade away) | 125 | 51.2% | -2.3% | 2023-24:51 2024-25:53 2025-26:48 |
| …and he is NOT the minutes leader | 78 | 62.8% | +19.7% | 2023-24:68 2024-25:58 2025-26:62 |
| …and he IS the minutes leader | 52 | 65.4% | +24.5% | 2023-24:64 2024-25:67 2025-26:67 |
