# Regression Brief #2 — TRUE luck regression via possession data

20,719 games. luck = L5 (eFG − shot-mix-expected eFG), strictly prior.
d3luck = L5 opponent-3P% vs league (defensive 3P luck). T-60 prices. BE 52.4%.

## Conclusions (2026-07-17)

**Shot-quality luck is FULLY PRICED.** Every bucket — offensive eFG-vs-mix
luck (fade hot/back cold), defensive 3P% luck, both-team luck totals, luck
differentials, month splits — lands 48-52.5%. The Torvik/KenPom regression
framework IS the market now; possession-grade luck carries no residual edge.
This retires the regression thesis with real evidence: the market regresses
before we can, even measured at the shot-mix level.

## Shooting luck → next game (fade the hot hand?)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| HOME LUCKY (top decile) → FADE | 2,042 | 50.2% | -4.0% | 2022-23: 224/448 50% -5% · 2023-24: 274/537 51% -3% · 2024-25: 252/517 49% -7% · 2025-26: 276/540 51% -2% |
| HOME UNLUCKY (bottom decile) → BACK | 2,032 | 49.2% | -6.1% | 2022-23: 279/553 50% -4% · 2023-24: 257/494 52% -1% · 2024-25: 224/492 46% -13% · 2025-26: 239/493 48% -7% |
| AWAY LUCKY (top decile) → FADE | 2,041 | 52.2% | -0.4% | 2022-23: 270/511 53% +1% · 2023-24: 277/513 54% +3% · 2024-25: 260/525 50% -5% · 2025-26: 258/492 52% +0% |
| AWAY UNLUCKY (bottom decile) → BACK | 2,033 | 52.0% | -0.7% | 2022-23: 230/483 48% -9% · 2023-24: 276/488 57% +8% · 2024-25: 268/534 50% -4% · 2025-26: 283/528 54% +2% |
| home much luckier (diff ≥0.085) → BACK AWAY | 2,043 | 51.2% | -2.3% | 2022-23: 224/467 48% -8% · 2023-24: 279/520 54% +2% · 2024-25: 253/522 48% -7% · 2025-26: 289/534 54% +3% |
| away much luckier (diff ≤-0.081) → BACK HOME | 2,040 | 51.8% | -1.1% | 2022-23: 284/534 53% +2% · 2023-24: 248/506 49% -6% · 2024-25: 264/531 50% -5% · 2025-26: 261/469 56% +6% |

## Shooting luck → totals

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| BOTH lucky → UNDER (regress) | 1,368 | 50.0% | -4.6% | 2022-23: 158/321 49% -6% · 2023-24: 167/339 49% -6% · 2024-25: 175/346 51% -3% · 2025-26: 184/362 51% -3% |
| BOTH lucky → OVER | 1,368 | 50.0% | -4.6% | 2022-23: 163/321 51% -3% · 2023-24: 172/339 51% -3% · 2024-25: 171/346 49% -6% · 2025-26: 178/362 49% -6% |
| BOTH unlucky → OVER (regress) | 1,488 | 49.3% | -6.0% | 2022-23: 188/378 50% -5% · 2023-24: 184/371 50% -5% · 2024-25: 181/374 48% -8% · 2025-26: 180/365 49% -6% |
| BOTH unlucky → UNDER | 1,488 | 50.7% | -3.1% | 2022-23: 190/378 50% -4% · 2023-24: 187/371 50% -4% · 2024-25: 193/374 52% -1% · 2025-26: 185/365 51% -3% |

## Defensive 3P luck (the Torvik insight)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| HOME D-3P blessed (opp shot cold) → FADE | 2,044 | 49.1% | -6.2% | 2022-23: 260/540 48% -8% · 2023-24: 246/521 47% -10% · 2024-25: 253/512 49% -6% · 2025-26: 245/471 52% -1% |
| HOME D-3P cursed (opp shot hot) → BACK | 2,047 | 49.9% | -4.7% | 2022-23: 283/518 55% +4% · 2023-24: 240/521 46% -12% · 2024-25: 260/507 51% -2% · 2025-26: 239/501 48% -9% |
| HOME D-3P blessed → game OVER (regression) | 2,052 | 51.7% | -1.3% | 2022-23: 281/545 52% -2% · 2023-24: 270/526 51% -2% · 2024-25: 279/510 55% +4% · 2025-26: 231/471 49% -6% |
| AWAY D-3P blessed (opp shot cold) → FADE | 2,041 | 52.1% | -0.5% | 2022-23: 269/512 53% +0% · 2023-24: 280/533 53% +0% · 2024-25: 254/513 50% -5% · 2025-26: 260/483 54% +3% |
| AWAY D-3P cursed (opp shot hot) → BACK | 2,043 | 50.7% | -3.2% | 2022-23: 253/507 50% -5% · 2023-24: 267/532 50% -4% · 2024-25: 257/519 50% -5% · 2025-26: 258/485 53% +2% |
| AWAY D-3P blessed → game OVER (regression) | 2,046 | 50.9% | -2.8% | 2022-23: 260/518 50% -4% · 2023-24: 267/534 50% -5% · 2024-25: 264/510 52% -1% · 2025-26: 251/484 52% -1% |

## Month splits (unlucky-back signals by phase)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| H unlucky (≤15th) Nov-Dec → BACK | 1,044 | 50.7% | -3.2% | 2022-23: 164/324 51% -3% · 2023-24: 126/235 54% +2% · 2024-25: 108/213 51% -3% · 2025-26: 131/272 48% -8% |
| A unlucky (≤15th) Nov-Dec → BACK | 1,221 | 53.3% | +1.8% | 2022-23: 156/320 49% -7% · 2023-24: 173/299 58% +10% · 2024-25: 139/266 52% -0% · 2025-26: 183/336 54% +4% |
| H unlucky (≤15th) Jan-Feb → BACK | 1,673 | 47.9% | -8.5% | 2022-23: 195/403 48% -8% · 2023-24: 208/410 51% -3% · 2024-25: 189/431 44% -16% · 2025-26: 210/429 49% -6% |
| A unlucky (≤15th) Jan-Feb → BACK | 1,485 | 51.9% | -1.0% | 2022-23: 166/350 47% -9% · 2023-24: 195/355 55% +5% · 2024-25: 220/406 54% +4% · 2025-26: 189/374 51% -3% |
| H unlucky (≤15th) Mar+ → BACK | 336 | 49.1% | -6.2% | 2022-23: 27/63 43% -18% · 2023-24: 51/100 51% -3% · 2024-25: 52/111 47% -11% · 2025-26: 35/62 56% +8% |
| A unlucky (≤15th) Mar+ → BACK | 349 | 47.9% | -8.6% | 2022-23: 25/64 39% -25% · 2023-24: 53/101 52% +0% · 2024-25: 60/120 50% -4% · 2025-26: 29/64 45% -13% |
