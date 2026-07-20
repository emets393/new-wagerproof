# H1TT Basketball Brief #1 — 1H + team-total relationship signals

T-60 closes only (no movement exists for these markets). Consensus =
cross-book median (prices decimal). Graded vs 1H/FG finals. Breakeven 52.4%.

## Conclusions (2026-07-16)

**Books shade PRICES, not lines.** Every relationship family shows elevated
win rates that get eaten by juice — the deviation is priced, not stale:
- R6 NBA: 59-61% win rates chasing off-consensus 1H totals, NEGATIVE ROI
  (avg price ≈ -155). NFL's offshore-stale-chase does NOT port to NBA. Also
  off-consensus postings collapsed ~90% in 25-26 (books tightened up).
- R4: "TT below implied → over" wins 54-66% everywhere but ROI ≈ 0; the
  ≥1.5-deviation samples vanish after 23-24 (window closed).
- R5 NCAAB: big-fav home TT — BOTH over and under lose ~12% → the TT market
  on big NCAAB favorites carries enormous vig. Avoid the market entirely.

**TRACK (not vault-worthy):**
1. NCAAB R6: book 1H total ≥1.5 ABOVE consensus → UNDER at that book —
   +5.4% (n=281), positive all 3 seasons. Best candidate in the brief.
2. NBA R1: 1H-share highest decile → 1H UNDER — +7.8% (n=396), 2/3 seasons.
3. NCAAB R2: 1H home line ≥1 harsher than FG/2 → 1H AWAY — +1.0% (n=2,901).

Combined with MOVEMENT_BRIEF1 + KENPOM_BRIEF1: no-model signals are largely
exhausted; edge must come from information (own models) → step 2.

## NBA — 3,962 games

### R1 — 1H total as share of FG total (median 0.510)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| 1H share LOWEST decile → 1H OVER | 398 | 48.2% | -8.0% | 23-24: 25/60 42% -20% · 24-25: 59/119 50% -5% · 25-26: 108/219 49% -6% |
| 1H share LOWEST decile → 1H UNDER | 398 | 51.8% | -1.0% | 23-24: 35/60 58% +11% · 24-25: 60/119 50% -4% · 25-26: 111/219 51% -3% |
| 1H share HIGHEST decile → 1H OVER | 396 | 43.4% | -16.7% | 23-24: 27/52 52% -1% · 24-25: 47/103 46% -13% · 25-26: 98/241 41% -22% |
| 1H share HIGHEST decile → 1H UNDER | 396 | 56.6% | +7.8% | 23-24: 25/52 48% -8% · 24-25: 56/103 54% +4% · 25-26: 143/241 59% +13% |

### R2 — 1H spread vs FG/2 deviation (dev>0 = 1H line softer on home)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| 1H home line ≥0.5 SOFTER than FG/2 → 1H HOME | 555 | 46.7% | -10.8% | 23-24: 84/178 47% -10% · 24-25: 94/187 50% -4% · 25-26: 81/190 43% -19% |
| 1H home line ≥0.5 HARSHER than FG/2 → 1H AWAY | 1,249 | 48.5% | -7.3% | 23-24: 195/396 49% -6% · 24-25: 200/427 47% -10% · 25-26: 211/426 50% -6% |
| 1H home line ≥1.0 SOFTER than FG/2 → 1H HOME | 230 | 46.1% | -11.7% | 23-24: 33/70 47% -10% · 24-25: 39/85 46% -12% · 25-26: 34/75 45% -13% |
| 1H home line ≥1.0 HARSHER than FG/2 → 1H AWAY | 608 | 47.5% | -9.2% | 23-24: 87/175 50% -5% · 24-25: 101/221 46% -12% · 25-26: 101/212 48% -9% |

### R3 — team-total sum minus FG total (median +0.00)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| TT-sum ≥0.5 ABOVE total → FG OVER | 1,222 | 51.6% | -1.6% | 23-24: 151/306 49% -6% · 24-25: 227/420 54% +3% · 25-26: 252/496 51% -3% |
| TT-sum ≥0.5 BELOW total → FG UNDER | 1,133 | 47.0% | -10.3% | 23-24: 212/452 47% -10% · 24-25: 155/324 48% -9% · 25-26: 165/357 46% -12% |
| TT-sum ≥1.0 ABOVE total → FG OVER | 202 | 54.5% | +3.9% | 23-24: 19/43 44% -16% · 24-25: 39/71 55% +5% · 25-26: 52/88 59% +13% |
| TT-sum ≥1.0 BELOW total → FG UNDER | 200 | 45.5% | -12.8% | 23-24: 52/114 46% -13% · 24-25: 23/43 53% +2% · 25-26: 16/43 37% -27% |

### R4 — posted TT vs spread/total-implied TT

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| home TT ≥0.75 BELOW implied → home TT OVER | 224 | 54.0% | -2.9% | 23-24: 70/127 55% -4% · 24-25: 19/41 46% -13% · 25-26: 32/56 57% +8% |
| home TT ≥0.75 ABOVE implied → home TT UNDER | 226 | 49.1% | -7.6% | 23-24: 42/81 52% -3% · 24-25: 28/64 44% -18% · 25-26: 41/81 51% -5% |
| home TT ≥1.5 BELOW implied → home TT OVER | 51 | 60.8% | -4.6% | 23-24: 29/46 63% -3% · 24-25: 1/3 33% -37% · 25-26: 1/2 50% -4% |
| away TT ≥0.75 BELOW implied → away TT OVER | 302 | 53.6% | -2.5% | 23-24: 106/180 59% +5% · 24-25: 29/59 49% -7% · 25-26: 27/63 43% -19% |
| away TT ≥0.75 ABOVE implied → away TT UNDER | 201 | 51.7% | -2.7% | 23-24: 29/60 48% -10% · 24-25: 35/60 58% +10% · 25-26: 40/81 49% -7% |
| away TT ≥1.5 BELOW implied → away TT OVER | 61 | 65.6% | +6.3% | 23-24: 36/56 64% +2% · 24-25: 1/2 50% -5% · 25-26: 3/3 100% +91% |

### R5 — big favorites (FG spread ≤ -10)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| home fav ≤-10 → home TT OVER | 657 | 51.3% | -3.0% | 23-24: 105/195 54% +1% · 24-25: 114/221 52% -2% · 25-26: 118/241 49% -7% |
| home fav ≤-10 → home TT UNDER | 657 | 48.7% | -7.3% | 23-24: 90/195 46% -12% · 24-25: 107/221 48% -8% · 25-26: 123/241 51% -3% |
| away fav ≥10 → away TT OVER | 292 | 55.1% | +4.5% | 23-24: 45/86 52% -1% · 24-25: 49/98 50% -5% · 25-26: 67/108 62% +18% |
| away fav ≥10 → away TT UNDER | 292 | 44.9% | -13.6% | 23-24: 41/86 48% -6% · 24-25: 49/98 50% -4% · 25-26: 41/108 38% -28% |

### R6 — stale-book chase: book's 1H total vs consensus (bet toward consensus at that book)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| book 1H total ≥1.0 ABOVE consensus → UNDER at book | 1,940 | 59.4% | -4.0% | 23-24: 684/1139 60% -4% · 24-25: 391/667 59% -6% · 25-26: 77/134 57% +8% |
| book 1H total ≥1.0 BELOW consensus → OVER at book | 2,196 | 58.7% | -4.0% | 23-24: 846/1430 59% -3% · 24-25: 388/659 59% -6% · 25-26: 56/107 52% -1% |
| book 1H total ≥1.5 ABOVE consensus → UNDER at book | 1,528 | 60.1% | -6.6% | 23-24: 570/926 62% -5% · 24-25: 341/586 58% -9% · 25-26: 7/16 44% -16% |
| book 1H total ≥1.5 BELOW consensus → OVER at book | 1,583 | 60.1% | -5.6% | 23-24: 610/1007 61% -5% · 24-25: 332/560 59% -7% · 25-26: 10/16 62% +18% |
| book 1H total ≥2.0 ABOVE consensus → UNDER at book | 1,389 | 60.9% | -6.2% | 23-24: 526/845 62% -5% · 24-25: 317/537 59% -8% · 25-26: 3/7 43% -18% |
| book 1H total ≥2.0 BELOW consensus → OVER at book | 1,331 | 60.6% | -6.7% | 23-24: 501/817 61% -6% · 24-25: 301/507 59% -8% · 25-26: 4/7 57% +9% |

## NCAAB — 17,231 games

### R1 — 1H total as share of FG total (median 0.472)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| 1H share LOWEST decile → 1H OVER | 1,738 | 50.9% | -3.8% | 23-24: 296/590 50% -5% · 24-25: 330/613 54% +2% · 25-26: 258/535 48% -9% |
| 1H share LOWEST decile → 1H UNDER | 1,738 | 49.1% | -6.7% | 23-24: 294/590 50% -5% · 24-25: 283/613 46% -13% · 25-26: 277/535 52% -2% |
| 1H share HIGHEST decile → 1H OVER | 1,733 | 48.4% | -8.2% | 23-24: 181/380 48% -9% · 24-25: 252/517 49% -8% · 25-26: 405/836 48% -8% |
| 1H share HIGHEST decile → 1H UNDER | 1,733 | 51.6% | -2.5% | 23-24: 199/380 52% -1% · 24-25: 265/517 51% -3% · 25-26: 431/836 52% -3% |

### R2 — 1H spread vs FG/2 deviation (dev>0 = 1H line softer on home)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| 1H home line ≥0.5 SOFTER than FG/2 → 1H HOME | 1,053 | 50.9% | -3.7% | 23-24: 158/307 51% -2% · 24-25: 167/351 48% -10% · 25-26: 211/395 53% +1% |
| 1H home line ≥0.5 HARSHER than FG/2 → 1H AWAY | 6,326 | 52.2% | -1.1% | 23-24: 1029/2033 51% -4% · 24-25: 1124/2117 53% +1% · 25-26: 1148/2176 53% -0% |
| 1H home line ≥1.0 SOFTER than FG/2 → 1H HOME | 233 | 47.6% | -9.6% | 23-24: 26/65 40% -24% · 24-25: 40/85 47% -10% · 25-26: 45/83 54% +2% |
| 1H home line ≥1.0 HARSHER than FG/2 → 1H AWAY | 2,901 | 53.3% | +1.0% | 23-24: 467/927 50% -4% · 24-25: 542/978 55% +5% · 25-26: 538/996 54% +2% |

### R3 — team-total sum minus FG total (median +0.00)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| TT-sum ≥0.5 ABOVE total → FG OVER | 6,278 | 50.3% | -4.0% | 23-24: 951/1849 51% -2% · 24-25: 1053/2112 50% -5% · 25-26: 1155/2317 50% -5% |
| TT-sum ≥0.5 BELOW total → FG UNDER | 4,148 | 49.4% | -5.7% | 23-24: 675/1399 48% -8% · 24-25: 585/1196 49% -7% · 25-26: 788/1553 51% -3% |
| TT-sum ≥1.0 ABOVE total → FG OVER | 944 | 50.8% | -2.9% | 23-24: 177/346 51% -2% · 24-25: 169/340 50% -5% · 25-26: 134/258 52% -1% |
| TT-sum ≥1.0 BELOW total → FG UNDER | 643 | 50.9% | -2.9% | 23-24: 179/388 46% -12% · 24-25: 79/117 68% +28% · 25-26: 69/138 50% -5% |

### R4 — posted TT vs spread/total-implied TT

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| home TT ≥0.75 BELOW implied → home TT OVER | 551 | 58.6% | +1.3% | 23-24: 223/366 61% +2% · 24-25: 49/93 53% -3% · 25-26: 51/92 55% +2% |
| home TT ≥0.75 ABOVE implied → home TT UNDER | 1,052 | 51.4% | -5.3% | 23-24: 217/419 52% -5% · 24-25: 166/316 53% -3% · 25-26: 158/317 50% -8% |
| home TT ≥1.5 BELOW implied → home TT OVER | 222 | 62.2% | -0.9% | 23-24: 138/218 63% +1% · 24-25: 0/3 0% -75% · 25-26: 0/1 0% -100% |
| away TT ≥0.75 BELOW implied → away TT OVER | 815 | 54.1% | -0.1% | 23-24: 178/332 54% -2% · 24-25: 123/219 56% +4% · 25-26: 140/264 53% -1% |
| away TT ≥0.75 ABOVE implied → away TT UNDER | 743 | 48.3% | -10.9% | 23-24: 138/274 50% -7% · 24-25: 121/250 48% -11% · 25-26: 100/219 46% -15% |

### R5 — big favorites (FG spread ≤ -14)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| home fav ≤-14 → home TT OVER | 2,620 | 47.5% | -11.3% | 23-24: 334/799 42% -23% · 24-25: 430/878 49% -8% · 25-26: 481/943 51% -4% |
| home fav ≤-14 → home TT UNDER | 2,620 | 45.6% | -13.8% | 23-24: 308/799 39% -26% · 24-25: 427/878 49% -9% · 25-26: 460/943 49% -8% |
| away fav ≥14 → away TT OVER | 167 | 51.5% | -2.7% | 23-24: 23/51 45% -15% · 24-25: 32/58 55% +4% · 25-26: 31/58 53% +1% |
| away fav ≥14 → away TT UNDER | 167 | 43.1% | -19.0% | 23-24: 19/51 37% -30% · 24-25: 26/58 45% -16% · 25-26: 27/58 47% -12% |

### R6 — stale-book chase: book's 1H total vs consensus (bet toward consensus at that book)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| book 1H total ≥1.0 ABOVE consensus → UNDER at book | 2,906 | 53.5% | -0.9% | 23-24: 592/1150 51% -5% · 24-25: 579/1061 55% +1% · 25-26: 384/695 55% +3% |
| book 1H total ≥1.0 BELOW consensus → OVER at book | 2,345 | 50.3% | -6.9% | 23-24: 488/985 50% -8% · 24-25: 398/785 51% -6% · 25-26: 294/575 51% -5% |
| book 1H total ≥1.5 ABOVE consensus → UNDER at book | 281 | 58.0% | +5.4% | 23-24: 79/129 61% +10% · 24-25: 60/108 56% +1% · 25-26: 24/44 55% +3% |
| book 1H total ≥1.5 BELOW consensus → OVER at book | 182 | 49.5% | -10.1% | 23-24: 49/99 49% -11% · 24-25: 24/52 46% -15% · 25-26: 17/31 55% +2% |
| book 1H total ≥2.0 ABOVE consensus → UNDER at book | 65 | 60.0% | +3.0% | 23-24: 20/27 74% +23% · 24-25: 14/26 54% -7% · 25-26: 5/12 42% -22% |
| book 1H total ≥2.0 BELOW consensus → OVER at book | 43 | 39.5% | -33.5% | 23-24: 12/27 44% -27% · 24-25: 4/14 29% -50% · 25-26: 1/2 50% -6% |
