# Weird Lines Brief #1 — market vs PR-implied (NCAAB FG/total/ML)

22,710 games. dev = market home margin − KenPom fanmatch margin
(his ratings+HCA+tempo, dated). T-60 prices. BE 52.4%.
dev distribution: sd 2.06, |dev|≥3 in 15% of games, ≥5 in 3%.

## Conclusions (2026-07-17)

1. **The line wins the argument with power ratings, but not by enough to
   profit blind** — every raw dev bucket: line-side ≈49-52%, ratings-side
   worse. The owner's scenario (line far SHORT of PR+HCA) resolves toward
   the LINE at [4,8) (away 51.9%/-0.8%, best raw cell) — the market knows.
2. **HOW it got weird matters more than THAT it's weird:**
   - BECAME weird (opened normal, MOVED ≥4 from ratings) → follow the line:
     52.4%, 57/54/56% first three seasons. Movement-weirdness = information.
   - OPENED weird → 49.8%, noise. Static disagreement = KP error, priced.
   - Weird in Jan+ (mature ratings) → line side 54.1%/+3.2% (3/4 seasons);
     weird in Nov → line side LOSES (early weirdness = stale KP priors).
3. **Weird + VISIBLE roster absence → line side 54.1%/+3.5%** (n=109) — the
   line is short because the big is out, and it's STILL not short enough.
   This is S1's one-game news lag rediscovered through the lines lens.
4. **Moneyline: never take the ratings side.** KP win-prob above market →
   betting KP's side loses -10% to -28% at every threshold (KP dogs = value
   traps); the line side reaches 60.7% win but only ≈breakeven after vig.
5. Totals dev: noise at every threshold.
6. Model features earned: dev, dev_open, became_weird → calibrator inputs.

Next per plan: same framework on TEAM TOTALS and 1H markets (KP pred halves
vs 1H lines; implied TT vs posted TT already partially done in H1TT brief).

## A — dev buckets: back the LINE side or the RATINGS side?

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| line LONG home [2,4) → HOME (line side) | 3,298 | 50.4% | -3.8% | 2022-23: 329/625 53% +1% · 2023-24: 457/884 52% -1% · 2024-25: 437/921 47% -9% · 2025-26: 439/868 51% -3% |
| line LONG home [2,4) → AWAY (ratings side) | 3,298 | 49.6% | -5.2% | 2022-23: 296/625 47% -10% · 2023-24: 427/884 48% -8% · 2024-25: 484/921 53% +0% · 2025-26: 429/868 49% -6% |
| line SHORT home [2,4) → AWAY (line side) | 2,975 | 49.2% | -6.1% | 2022-23: 439/895 49% -6% · 2023-24: 402/811 50% -5% · 2024-25: 284/576 49% -6% · 2025-26: 338/693 49% -7% |
| line SHORT home [2,4) → HOME (ratings side) | 2,975 | 50.8% | -2.9% | 2022-23: 456/895 51% -3% · 2023-24: 409/811 50% -4% · 2024-25: 292/576 51% -3% · 2025-26: 355/693 51% -2% |
| line LONG home [3,6) → HOME (line side) | 1,827 | 51.3% | -2.1% | 2022-23: 149/265 56% +7% · 2023-24: 239/458 52% -0% · 2024-25: 278/553 50% -4% · 2025-26: 271/551 49% -6% |
| line LONG home [3,6) → AWAY (ratings side) | 1,827 | 48.7% | -6.9% | 2022-23: 116/265 44% -16% · 2023-24: 219/458 48% -9% · 2024-25: 275/553 50% -5% · 2025-26: 280/551 51% -3% |
| line SHORT home [3,6) → AWAY (line side) | 1,336 | 50.6% | -3.4% | 2022-23: 222/436 51% -3% · 2023-24: 189/352 54% +3% · 2024-25: 122/254 48% -8% · 2025-26: 143/294 49% -7% |
| line SHORT home [3,6) → HOME (ratings side) | 1,336 | 49.4% | -5.7% | 2022-23: 214/436 49% -6% · 2023-24: 163/352 46% -12% · 2024-25: 132/254 52% -1% · 2025-26: 151/294 51% -2% |
| line LONG home [4,8) → HOME (line side) | 923 | 50.4% | -3.8% | 2022-23: 49/86 57% +9% · 2023-24: 94/194 48% -8% · 2024-25: 161/309 52% -0% · 2025-26: 161/334 48% -8% |
| line LONG home [4,8) → AWAY (ratings side) | 923 | 49.6% | -5.2% | 2022-23: 37/86 43% -18% · 2023-24: 100/194 52% -2% · 2024-25: 148/309 48% -8% · 2025-26: 173/334 52% -1% |
| line SHORT home [4,8) → AWAY (line side) | 466 | 51.9% | -0.8% | 2022-23: 84/168 50% -5% · 2023-24: 68/127 54% +2% · 2024-25: 44/85 52% -1% · 2025-26: 46/86 53% +2% |
| line SHORT home [4,8) → HOME (ratings side) | 466 | 48.1% | -8.2% | 2022-23: 84/168 50% -5% · 2023-24: 59/127 46% -11% · 2024-25: 41/85 48% -8% · 2025-26: 40/86 47% -11% |
| line LONG home [5,99) → HOME (line side) | 467 | 48.4% | -7.6% | 2022-23: 18/34 53% +1% · 2023-24: 21/49 43% -18% · 2024-25: 82/166 49% -6% · 2025-26: 105/218 48% -8% |
| line LONG home [5,99) → AWAY (ratings side) | 467 | 51.6% | -1.4% | 2022-23: 16/34 47% -10% · 2023-24: 28/49 57% +9% · 2024-25: 84/166 51% -3% · 2025-26: 113/218 52% -1% |
| line SHORT home [5,99) → AWAY (line side) | 145 | 49.7% | -5.1% | 2022-23: 25/51 49% -6% · 2023-24: 17/40 42% -19% · 2024-25: 14/27 52% -1% · 2025-26: 16/27 59% +13% |
| line SHORT home [5,99) → HOME (ratings side) | 145 | 50.3% | -3.8% | 2022-23: 26/51 51% -3% · 2023-24: 23/40 57% +10% · 2024-25: 13/27 48% -8% · 2025-26: 11/27 41% -22% |
| line LONG home [7,99) → HOME (line side) | 117 | 52.1% | -0.3% | 2022-23: 1/3 33% -36% · 2023-24: 2/6 33% -36% · 2024-25: 22/37 59% +14% · 2025-26: 36/71 51% -3% |
| line LONG home [7,99) → AWAY (ratings side) | 117 | 47.9% | -8.6% | 2022-23: 2/3 67% +28% · 2023-24: 4/6 67% +27% · 2024-25: 15/37 41% -22% · 2025-26: 35/71 49% -6% |

## B — WHY weird: explained vs unexplained, opened vs became

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| SHORT home, home has visible absence (explained) | 109 | 54.1% | +3.5% | 2022-23: 24/40 60% +15% · 2023-24: 14/26 54% +3% · 2024-25: 17/26 65% +25% · 2025-26: 4/17 24% -55% |
| SHORT home, NO visible absence (unexplained) | 360 | 51.1% | -2.4% | 2022-23: 60/130 46% -12% · 2023-24: 55/102 54% +3% · 2024-25: 27/59 46% -13% · 2025-26: 42/69 61% +16% |
| SHORT home, unexplained → HOME (ratings side) | 360 | 48.9% | -6.6% | 2022-23: 70/130 54% +3% · 2023-24: 47/102 46% -12% · 2024-25: 32/59 54% +4% · 2025-26: 27/69 39% -25% |
| LONG home, away has visible absence (explained) | 146 | 48.6% | -7.1% | 2022-23: 5/7 71% +36% · 2023-24: 17/33 52% -2% · 2024-25: 31/62 50% -4% · 2025-26: 18/44 41% -22% |
| LONG home, NO visible absence (unexplained) | 833 | 50.4% | -3.7% | 2022-23: 44/80 55% +5% · 2023-24: 77/163 47% -10% · 2024-25: 137/263 52% -0% · 2025-26: 162/327 50% -5% |
| LONG home, unexplained → AWAY (ratings side) | 833 | 49.6% | -5.3% | 2022-23: 36/80 45% -14% · 2023-24: 86/163 53% +1% · 2024-25: 126/263 48% -8% · 2025-26: 165/327 50% -4% |
| OPENED weird (books born confident) → LINE side | 460 | 49.8% | -4.9% | 2022-23: 32/57 56% +7% · 2023-24: 21/50 42% -20% · 2024-25: 77/151 51% -3% · 2025-26: 99/202 49% -6% |
| OPENED weird (books born confident) → RATINGS side | 460 | 50.2% | -4.1% | 2022-23: 25/57 44% -16% · 2023-24: 29/50 58% +11% · 2024-25: 74/151 49% -6% · 2025-26: 103/202 51% -3% |
| BECAME weird (moved away from ratings) → LINE side | 227 | 52.4% | +0.1% | 2022-23: 23/40 57% +10% · 2023-24: 37/68 54% +4% · 2024-25: 29/52 56% +7% · 2025-26: 30/67 45% -14% |
| BECAME weird (moved away from ratings) → RATINGS side | 227 | 47.6% | -9.1% | 2022-23: 17/40 42% -19% · 2023-24: 31/68 46% -13% · 2024-25: 23/52 44% -16% · 2025-26: 37/67 55% +5% |
| weird ≥4 in Nov (KP priors stale) → LINE side | 638 | 48.3% | -7.8% | 2022-23: 51/111 46% -12% · 2023-24: 49/112 44% -16% · 2024-25: 82/177 46% -11% · 2025-26: 126/238 53% +1% |
| weird ≥4 Jan+ (ratings mature) → LINE side | 479 | 54.1% | +3.2% | 2022-23: 62/106 58% +12% · 2023-24: 81/153 53% +1% · 2024-25: 77/131 59% +12% · 2025-26: 39/89 44% -16% |

## C — totals: market total vs KenPom total

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| total 4+ ABOVE KP → OVER (line side) | 2,126 | 50.6% | -3.5% | 2022-23: 190/364 52% -0% · 2023-24: 274/572 48% -9% · 2024-25: 281/536 52% -0% · 2025-26: 330/654 50% -4% |
| total 4+ ABOVE KP → UNDER (ratings side) | 2,126 | 49.4% | -5.6% | 2022-23: 174/364 48% -9% · 2023-24: 298/572 52% -1% · 2024-25: 255/536 48% -9% · 2025-26: 324/654 50% -5% |
| total 4+ BELOW KP → UNDER (line side) | 2,643 | 50.4% | -3.8% | 2022-23: 348/722 48% -8% · 2023-24: 324/646 50% -4% · 2024-25: 287/562 51% -3% · 2025-26: 373/713 52% -0% |
| total 4+ BELOW KP → OVER (ratings side) | 2,643 | 49.6% | -5.3% | 2022-23: 374/722 52% -1% · 2023-24: 322/646 50% -5% · 2024-25: 275/562 49% -7% · 2025-26: 340/713 48% -9% |
| total 6+ ABOVE KP → OVER (line side) | 642 | 50.6% | -3.4% | 2022-23: 42/78 54% +3% · 2023-24: 66/151 44% -17% · 2024-25: 88/167 53% +0% · 2025-26: 129/246 52% +0% |
| total 6+ ABOVE KP → UNDER (ratings side) | 642 | 49.4% | -5.6% | 2022-23: 36/78 46% -12% · 2023-24: 85/151 56% +7% · 2024-25: 79/167 47% -9% · 2025-26: 117/246 48% -9% |
| total 6+ BELOW KP → UNDER (line side) | 741 | 50.2% | -4.1% | 2022-23: 78/181 43% -18% · 2023-24: 91/180 51% -3% · 2024-25: 90/160 56% +7% · 2025-26: 113/220 51% -2% |
| total 6+ BELOW KP → OVER (ratings side) | 741 | 49.8% | -4.9% | 2022-23: 103/181 57% +9% · 2023-24: 89/180 49% -6% · 2024-25: 70/160 44% -16% · 2025-26: 107/220 49% -7% |
| total 8+ ABOVE KP → OVER (line side) | 151 | 47.7% | -9.0% | 2022-23: 10/19 53% +1% · 2023-24: 13/34 38% -27% · 2024-25: 13/26 50% -5% · 2025-26: 36/72 50% -5% |
| total 8+ ABOVE KP → UNDER (ratings side) | 151 | 52.3% | -0.1% | 2022-23: 9/19 47% -10% · 2023-24: 21/34 62% +18% · 2024-25: 13/26 50% -4% · 2025-26: 36/72 50% -5% |
| total 8+ BELOW KP → UNDER (line side) | 168 | 53.0% | +1.1% | 2022-23: 16/42 38% -27% · 2023-24: 25/43 58% +11% · 2024-25: 27/37 73% +39% · 2025-26: 21/46 46% -13% |
| total 8+ BELOW KP → OVER (ratings side) | 168 | 47.0% | -10.2% | 2022-23: 26/42 62% +18% · 2023-24: 18/43 42% -20% · 2024-25: 10/37 27% -48% · 2025-26: 25/46 54% +4% |

## D — moneyline: KP win prob vs market implied

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| KP WP 5pp+ ABOVE market → HOME ML (ratings side) | 1,542 | 43.1% | -9.9% | 2022-23: 205/460 45% -2% · 2023-24: 174/388 45% -12% · 2024-25: 132/318 42% -11% · 2025-26: 153/376 41% -17% |
| KP WP 5pp+ BELOW market → AWAY ML (ratings side) | 5,563 | 33.1% | -11.5% | 2022-23: 337/1060 32% -17% · 2023-24: 494/1390 36% -6% · 2024-25: 526/1577 33% -12% · 2025-26: 487/1536 32% -13% |
| KP WP 5pp+ ABOVE market → AWAY ML (line side) | 1,542 | 56.9% | -0.3% | 2022-23: 255/460 55% -4% · 2023-24: 214/388 55% -3% · 2024-25: 186/318 58% +3% · 2025-26: 223/376 59% +4% |
| KP WP 10pp+ ABOVE market → HOME ML (ratings side) | 275 | 39.3% | -13.9% | 2022-23: 29/77 38% -16% · 2023-24: 32/78 41% -13% · 2024-25: 27/55 49% +16% · 2025-26: 20/65 31% -38% |
| KP WP 10pp+ BELOW market → AWAY ML (ratings side) | 1,326 | 33.4% | -12.3% | 2022-23: 68/213 32% -27% · 2023-24: 122/338 36% -10% · 2024-25: 124/386 32% -9% · 2025-26: 129/389 33% -10% |
| KP WP 10pp+ ABOVE market → AWAY ML (line side) | 275 | 60.7% | +1.0% | 2022-23: 48/77 62% +5% · 2023-24: 46/78 59% -1% · 2024-25: 28/55 51% -18% · 2025-26: 45/65 69% +14% |
| KP WP 15pp+ BELOW market → AWAY ML (ratings side) | 229 | 28.8% | -28.1% | 2022-23: 5/25 20% -56% · 2023-24: 19/60 32% -24% · 2024-25: 19/76 25% -31% · 2025-26: 23/68 34% -18% |
