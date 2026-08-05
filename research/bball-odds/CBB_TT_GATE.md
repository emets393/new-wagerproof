# CBB — is a derived market a new bet, or the parent bet with leverage?

`cbb_tt_gate.py`. Every number here comes from the same two team-points models as `CBB_PANEL_ALL.md` and is graded through the same `cbb_panel.markets()`, so a difference between the two documents can never be a difference in how a bet was scored.

## Step 1 — is the team total a third market, or the other two rotated?

Measured on the POSTED lines, before any model is fitted. If the book's own team totals add back to its own total and subtract back to its own spread, then a team-total model cannot be learning a new quantity and everything below is about leverage.

| relation | corr | within 1 pt | sd of gap | n |
|---|---|---|---|---|
| `tt_h + tt_a` vs posted total | **+0.9976** | 96.8% | 0.65 | 16,444 |
| `tt_h - tt_a` vs posted margin | **+0.9977** | 94.9% | 0.66 | 16,444 |

The book's team totals reconcile with its own posted total to within half a point on **88.3%** of games, and by more than a point on **3.2%**. That second group is the only place a team total is not a rotation, and it is swept separately below.

## Step 2 — team total, gated on the FULL-GAME TOTAL model

Rows are how far the full-game total model is from the posted GAME total; columns are how far the team-points model is from the posted TEAM total. **These are two different thresholds and conflating them is a documented trap** — the gate picks which games a bet may live in, the cut picks the bet.

| gate (parent ≥) | cut ≥1 | cut ≥2 | cut ≥3 | cut ≥4 |
|---|---|---|---|---|
| ≥0 | **-0.7** (14,360 · 53.1 v 51.3) | **+1.1** (4,308 · 54.2 v 51.9) | **+3.5** (938 · 55.7 v 51.0) | **+5.9** (148 · 56.8 v 51.4) |
| ≥1 | **-0.6** (11,324 · 53.1 v 51.2) | **+1.2** (3,975 · 54.2 v 52.1) | **+3.5** (904 · 55.6 v 51.5) | **+5.1** (145 · 56.6 v 51.7) |
| ≥2 | **-2.3** (7,599 · 52.1 v 50.8) | **+0.5** (3,321 · 53.7 v 51.8) | **+3.4** (847 · 55.5 v 50.8) | **+5.3** (136 · 56.6 v 52.9) |
| ≥3 | **-0.9** (4,099 · 52.7 v 51.4) | **+1.5** (2,332 · 54.2 v 52.3) | **+2.3** (727 · 54.7 v 50.3) | **+9.0** (128 · 58.6 v 53.9) |
| ≥4 | **+0.1** (1,744 · 53.3 v 50.7) | **+4.9** (1,238 · 55.9 v 52.9) | **+8.8** (514 · 58.2 v 53.5) | **+10.5** (111 · 59.5 v 55.0) |
| ≥5 | **-1.3** (630 · 52.5 v 52.2) | **+2.0** (533 · 54.4 v 53.7) | **+8.3** (285 · 57.9 v 54.7) | **+7.5** (83 · 57.8 v 56.6) |
| ≥6 | **-1.6** (204 · 52.5 v 50.5) | **-2.2** (186 · 52.2 v 50.5) | **-2.5** (123 · 52.0 v 53.7) | **+7.6** (52 · 57.7 v 53.8) |

Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets its own ladder rather than inheriting the parent's own betting cut — inheriting it is the exact mistake the NBA version made.

## Step 2b — team total, gated on the FULL-GAME SPREAD model

The other parent. A team total is the average of a total opinion and a margin opinion, so either parent firing is in principle enough to make the derived bet a real position.

| gate (parent ≥) | cut ≥1 | cut ≥2 | cut ≥3 | cut ≥4 |
|---|---|---|---|---|
| ≥0 | **-0.7** (14,360 · 53.1 v 51.3) | **+1.1** (4,308 · 54.2 v 51.9) | **+3.5** (938 · 55.7 v 51.0) | **+5.9** (148 · 56.8 v 51.4) |
| ≥1 | **+0.0** (8,309 · 53.5 v 51.3) | **+2.1** (3,035 · 54.8 v 51.8) | **+5.6** (772 · 56.7 v 51.3) | **+9.4** (131 · 58.8 v 52.7) |
| ≥2 | **+0.0** (3,817 · 53.4 v 50.5) | **+3.1** (1,781 · 55.2 v 51.3) | **+2.5** (556 · 55.0 v 51.8) | **+4.0** (102 · 55.9 v 50.0) |
| ≥3 | **+1.3** (1,289 · 54.1 v 51.6) | **-0.1** (746 · 53.4 v 50.7) | **-1.6** (281 · 52.7 v 52.0) | **-0.5** (66 · 53.0 v 53.0) |
| ≥4 | **-1.9** (339 · 52.5 v 55.2) | **+4.4** (242 · 55.8 v 52.1) | **+4.8** (121 · 56.2 v 50.4) | **+7.7** (40 · 57.5 v 55.0) |
| ≥5 | **-11.7** (72 · 47.2 v 55.6) | **-4.7** (55 · 50.9 v 50.9) | **-3.8** (31 · 51.6 v 51.6) | — |
| ≥6 | — | — | — | — |

Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets its own ladder rather than inheriting the parent's own betting cut — inheriting it is the exact mistake the NBA version made.

## Step 3 — team total, gated on EITHER parent

The NBA's best-performing gate. Both parents are cheap to compute and a team total inherits from both, so requiring only one of them to fire keeps more bets without letting in the games where neither parent has an opinion at all.

| gate (parent ≥) | cut ≥1 | cut ≥2 | cut ≥3 | cut ≥4 |
|---|---|---|---|---|
| ≥0 | **-0.7** (14,360 · 53.1 v 51.3) | **+1.1** (4,308 · 54.2 v 51.9) | **+3.5** (938 · 55.7 v 51.0) | **+5.9** (148 · 56.8 v 51.4) |
| ≥1 | **-0.5** (13,887 · 53.2 v 51.2) | **+1.2** (4,280 · 54.3 v 51.8) | **+3.5** (934 · 55.7 v 51.0) | **+5.7** (146 · 56.8 v 51.4) |
| ≥2 | **-1.7** (10,098 · 52.5 v 50.8) | **+1.0** (4,062 · 54.1 v 51.5) | **+3.4** (918 · 55.6 v 51.1) | **+5.5** (139 · 56.8 v 53.2) |
| ≥3 | **-0.2** (5,187 · 53.2 v 51.6) | **+1.3** (2,904 · 54.1 v 52.1) | **+2.0** (860 · 54.7 v 50.8) | **+6.7** (136 · 57.4 v 53.7) |
| ≥4 | **-0.5** (2,051 · 53.0 v 51.4) | **+4.5** (1,452 · 55.7 v 52.8) | **+7.6** (608 · 57.6 v 53.1) | **+10.4** (128 · 59.4 v 55.5) |
| ≥5 | **-2.6** (700 · 51.9 v 52.4) | **+1.3** (587 · 54.0 v 53.2) | **+6.9** (315 · 57.1 v 54.0) | **+8.0** (93 · 58.1 v 55.9) |
| ≥6 | **-3.5** (216 · 51.4 v 50.5) | **-3.3** (196 · 51.5 v 50.5) | **-3.4** (130 · 51.5 v 53.1) | **+7.2** (54 · 57.4 v 55.6) |

Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets its own ladder rather than inheriting the parent's own betting cut — inheriting it is the exact mistake the NBA version made.

## First-half TOTAL, gated on its full-game sibling

A half is not a rotation of the game the way a team total is, so this is a genuine test rather than a formality: if the first-half bets only pay inside games the full-game model already likes, the first-half model is not adding a horizon, it is re-expressing the full-game one.

| gate (parent ≥) | cut ≥0.75 | cut ≥1 | cut ≥1.5 | cut ≥2 |
|---|---|---|---|---|
| ≥0 | **-1.3** (9,875 · 52.2 v 51.3) | **-0.0** (7,829 · 52.9 v 51.5) | **+0.9** (4,562 · 53.4 v 52.3) | **+3.4** (2,454 · 54.7 v 53.1) |
| ≥1 | **+0.0** (6,640 · 52.8 v 51.4) | **+1.1** (5,425 · 53.4 v 51.7) | **+3.1** (3,393 · 54.5 v 52.3) | **+5.6** (1,977 · 55.8 v 53.0) |
| ≥2 | **-1.7** (3,897 · 52.0 v 50.3) | **-0.6** (3,337 · 52.5 v 50.0) | **+0.6** (2,271 · 53.2 v 50.3) | **+4.1** (1,425 · 55.1 v 50.0) |
| ≥3 | **-0.3** (2,029 · 52.7 v 51.7) | **-0.1** (1,805 · 52.8 v 51.8) | **+0.7** (1,339 · 53.2 v 51.7) | **+3.8** (898 · 54.9 v 53.2) |
| ≥4 | **+2.4** (877 · 54.0 v 52.6) | **+2.2** (815 · 54.0 v 53.0) | **+2.6** (655 · 54.2 v 53.3) | **+7.9** (475 · 57.1 v 55.4) |
| ≥5 | **-2.0** (327 · 51.7 v 56.0) | **-4.3** (313 · 50.5 v 55.3) | **-2.2** (279 · 51.6 v 55.6) | **+0.7** (222 · 53.2 v 57.7) |
| ≥6 | **-5.2** (110 · 50.0 v 50.0) | **-6.9** (108 · 49.1 v 50.9) | **-4.3** (103 · 50.5 v 50.5) | **-1.2** (94 · 52.1 v 53.2) |

Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets its own ladder rather than inheriting the parent's own betting cut — inheriting it is the exact mistake the NBA version made.

## First-half SPREAD, gated on its full-game sibling

A half is not a rotation of the game the way a team total is, so this is a genuine test rather than a formality: if the first-half bets only pay inside games the full-game model already likes, the first-half model is not adding a horizon, it is re-expressing the full-game one.

| gate (parent ≥) | cut ≥0.75 | cut ≥1 | cut ≥1.5 | cut ≥2 |
|---|---|---|---|---|
| ≥0 | **+0.2** (8,807 · 52.9 v 51.3) | **+1.2** (6,617 · 53.4 v 51.7) | **+4.7** (3,422 · 55.3 v 52.8) | **+2.4** (1,633 · 54.1 v 52.0) |
| ≥1 | **+1.5** (5,478 · 53.6 v 52.3) | **+2.5** (4,461 · 54.1 v 52.5) | **+6.4** (2,634 · 56.2 v 53.1) | **+4.4** (1,365 · 55.1 v 52.2) |
| ≥2 | **+3.0** (2,473 · 54.3 v 52.8) | **+3.9** (2,178 · 54.8 v 52.8) | **+6.5** (1,479 · 56.2 v 52.4) | **+6.6** (902 · 56.2 v 52.2) |
| ≥3 | **+3.7** (796 · 54.6 v 51.8) | **+4.1** (731 · 54.9 v 51.7) | **+3.9** (583 · 54.7 v 52.1) | **+6.8** (416 · 56.2 v 51.2) |
| ≥4 | **-6.5** (195 · 49.2 v 53.8) | **-7.1** (184 · 48.9 v 52.7) | **-10.4** (159 · 47.2 v 50.3) | **-8.9** (123 · 48.0 v 50.4) |
| ≥5 | **-7.6** (35 · 48.6 v 57.1) | **-4.9** (32 · 50.0 v 59.4) | **-8.0** (31 · 48.4 v 61.3) | **-16.5** (25 · 44.0 v 68.0) |
| ≥6 | — | — | — | — |

Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets its own ladder rather than inheriting the parent's own betting cut — inheriting it is the exact mistake the NBA version made.

## The reconciliation slice — where the team total is NOT a rotation

Games where the book's two team totals do not add back to its own posted total. This is the only place a team-total model can be looking at something the other two markets do not already contain, so it is the one slice worth reading without a gate.

| slack | cut | bets | win% | base% | ROI |
|---|---|---|---|---|---|
| ≤0.5 pts (reconciles) | ≥2 | 3,693 | 54.3 | 52.2 | **+1.6** |
| ≤0.5 pts (reconciles) | ≥3 | 795 | 55.2 | 52.3 | **+3.2** |
| >1 pt | ≥2 | 541 | 55.3 | 50.8 | **+0.2** |
| >1 pt | ≥3 | 128 | 60.2 | 55.5 | **+8.6** |
| >2 pts | ≥2 | 85 | 56.5 | 56.5 | **-6.1** |
| >2 pts | ≥3 | 31 | 51.6 | 54.8 | **-10.5** |

