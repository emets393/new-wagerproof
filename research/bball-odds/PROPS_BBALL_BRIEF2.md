# NBA Props Brief #2 — price-structure exploits

Book-level lines/prices (6-10 books per prop).

## Conclusions (2026-07-16) — verdict on NBA props

**The NBA prop market is a VIG FORTRESS: line and price co-move so tightly
across books that every relationship signal's win rate is fully compensated.**
- Stale-book chase wins 65.8% and LOSES 4% — off-median lines are alt-line
  priced (a book 1.5 high has the under at ~-200). Same juice-trap as NBA 1H.
- Best-line shopping lifts win rates 4-10pp but the best line carries the
  worst price: points unders 62.5% win → still -3.6%. Only rebounds/threes
  unders reach ≈breakeven (+0.1-0.3%) — not bettable.
- Teammate-out bumps, opponent style tiers, minutes trends, star-return
  unders: ALL priced (Brief #1 + C above). The market knows.
- Structural facts worth keeping: (1) consensus lines are shaded HIGH vs
  recent form everywhere (unders win 52-58% pre-juice — books lean into
  public over-bias); (2) 94.7% of props match a box line; (3) blocks/steals
  overs hit only 35-47% (integer-line effect).

**Contrast with NFL (P12/P13 cleared at consensus): the NBA prop market is
categorically sharper.** No durable edge exists here from boxscore-derived
relationship signals at T-60 consensus across these 10 books.

**Remaining angles (future work, real effort):** (1) a true minutes/usage
projection model beating the market's projection (news-timing dependent);
(2) pre-close timing (our data is T-60 only); (3) softer books/promos outside
this feed; (4) CBB props next season (softer market, no historical data yet).


## A — under-asymmetry, consensus vs BEST-SHOPPED line+price

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| fg3m L5 below line → UNDER @consensus | 3,808 | 58.1% | -0.8% | 2023-24: 631/1034 61% +4% · 2024-25: 737/1325 56% -5% · 2025-26: 843/1449 58% -1% |
| fg3m L5 below line → UNDER @BEST book | 3,505 | 60.1% | +0.1% | 2023-24: 462/724 64% +5% · 2024-25: 755/1327 57% -2% · 2025-26: 889/1454 61% -0% |
| reb L5 below line → UNDER @consensus | 14,103 | 54.4% | -1.2% | 2023-24: 2361/4284 55% +1% · 2024-25: 2638/4824 55% -1% · 2025-26: 2670/4995 53% -3% |
| reb L5 below line → UNDER @BEST book | 12,754 | 59.5% | +0.3% | 2023-24: 1709/2902 59% +0% · 2024-25: 2769/4839 57% +3% · 2025-26: 3112/5013 62% -2% |
| ast L5 below line → UNDER @consensus | 8,310 | 53.8% | -3.7% | 2023-24: 1311/2410 54% -2% · 2024-25: 1469/2836 52% -7% · 2025-26: 1691/3064 55% -2% |
| ast L5 below line → UNDER @BEST book | 7,560 | 57.8% | -2.4% | 2023-24: 918/1632 56% -4% · 2024-25: 1535/2848 54% -4% · 2025-26: 1916/3080 62% +0% |
| pts L5 below line → UNDER @consensus | 18,584 | 51.8% | -3.5% | 2023-24: 3099/5799 53% -0% · 2024-25: 3110/6152 51% -6% · 2025-26: 3417/6633 52% -4% |
| pts L5 below line → UNDER @BEST book | 16,784 | 62.5% | -3.6% | 2023-24: 2536/3971 64% -6% · 2024-25: 3482/6166 56% -4% · 2025-26: 4477/6647 67% -1% |

## B — stale book: line ≥1.5 off cross-book median, bet toward median at that book

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| book ≥1.5 ABOVE median → UNDER at book | 137,185 | 65.8% | -4.0% | 2023-24: 48554/73247 66% -6% · 2024-25: 8231/12952 64% -6% · 2025-26: 33415/50986 66% -1% |
| book ≥1.5 BELOW median → OVER at book | 149,826 | 60.8% | -10.2% | 2023-24: 46675/77834 60% -13% · 2024-25: 7442/12119 61% -9% · 2025-26: 37039/59873 62% -6% |

## C — star returns → role-player unders

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| STAR RETURNED → role points UNDER | 1,736 | 51.8% | -3.1% | 2023-24: 243/467 52% -3% · 2024-25: 347/657 53% -1% · 2025-26: 310/612 51% -5% |
| STAR RETURNED × line ≥1.5 above s2d → UNDER | 946 | 53.2% | -1.0% | 2023-24: 154/279 55% +2% · 2024-25: 185/364 51% -5% · 2025-26: 164/303 54% +1% |
| STAR RETURNED → ALL teammates points UNDER | 3,207 | 51.7% | -3.6% | 2023-24: 422/823 51% -5% · 2024-25: 642/1237 52% -3% · 2025-26: 593/1147 52% -3% |
| (control) star still out × inflated line → UNDER | 1,094 | 52.8% | -1.6% | 2023-24: 151/316 48% -11% · 2024-25: 208/402 52% -4% · 2025-26: 219/376 58% +9% |
