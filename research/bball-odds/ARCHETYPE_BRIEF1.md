# Archetype Brief #1 — architecture profiles + style-split plus-minus

Labels prior-only, within-season. Split +/- requires ≥3 prior meetings
vs that archetype in the SAME season. All bets T-60 consensus. BE 52.4%.

## Conclusions (2026-07-17)

**THE FIND — press-vulnerability fade: team facing a D_PRESS defense, having
UNDERPERFORMED its own season efficiency by ≥5 pts/100 in ≥3 prior meetings
with presses THIS season → FADE ATS = 57.6% / +10.1% (n=604, positive all
four seasons: 65/57/53/56).** Press vulnerability is a persistent roster
trait (ball-handling) the market underweights mid-season. The asymmetry is
the tell: press-PROFICIENT teams carry no edge (51.8%) — only the weakness
persists, not the strength.

Supporting: D_SOFT_FOUL strugglers fade 55.0% (n=200, decaying); paint-wall
overperformers → TT OVER 53.8%/+1.1% (mild). Persistence correlations are
honest: +0.007-0.060 — mostly noise EXCEPT press/foul handling (0.053/0.060),
exactly where the betting signals appear. Extreme individual deltas (±25+)
mean-revert (see examples) — the signal lives at moderate thresholds in
aggregate, not in anecdotes.

Feature handoff: pm_D_PRESS_off (and siblings) saved in
archetype_splits.parquet for the per-market models + calibrator.

## Label frequencies

- O_PAINT_BIG: 9% of team-games
- O_THREE_GUN: 15% of team-games
- O_TEMPO: 20% of team-games
- O_FT_ATTACK: 24% of team-games
- D_PAINT_WALL: 17% of team-games
- D_PRESS: 13% of team-games
- D_PERIM_LOCK: 17% of team-games
- D_SOFT_FOUL: 10% of team-games

## Does prior split +/- predict the NEXT meeting vs that archetype?

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| faces D_PAINT_WALL, prior +5 eff vs it → BACK ATS | 432 | 48.1% | -8.0% | 2022-23:40% 2023-24:46% 2024-25:55% 2025-26:53% |
| faces D_PAINT_WALL, prior −5 eff vs it → FADE ATS | 1,709 | 48.9% | -6.6% | 2022-23:50% 2023-24:49% 2024-25:49% 2025-26:49% |
| faces D_PAINT_WALL, prior +5 → TT OVER | 320 | 53.8% | +1.1% | 2023-24:52% 2024-25:57% 2025-26:53% |
| faces D_PAINT_WALL, prior −5 → TT UNDER | 1,299 | 50.7% | -4.5% | 2023-24:51% 2024-25:49% 2025-26:52% |
| faces D_PRESS, prior +5 eff vs it → BACK ATS | 550 | 51.8% | -1.0% | 2022-23:54% 2023-24:55% 2024-25:48% 2025-26:48% |
| faces D_PRESS, prior −5 eff vs it → FADE ATS | 604 | 57.6% | +10.1% | 2022-23:65% 2023-24:57% 2024-25:53% 2025-26:56% |
| faces D_PRESS, prior +5 → TT OVER | 394 | 47.5% | -10.8% | 2023-24:47% 2024-25:52% 2025-26:44% |
| faces D_PRESS, prior −5 → TT UNDER | 462 | 50.6% | -4.7% | 2023-24:55% 2024-25:43% 2025-26:53% |
| faces D_PERIM_LOCK, prior +5 eff vs it → BACK ATS | 931 | 50.7% | -3.2% | 2022-23:51% 2023-24:47% 2024-25:56% 2025-26:49% |
| faces D_PERIM_LOCK, prior −5 eff vs it → FADE ATS | 985 | 47.8% | -8.7% | 2022-23:44% 2023-24:48% 2024-25:50% 2025-26:50% |
| faces D_PERIM_LOCK, prior +5 → TT OVER | 725 | 51.9% | -2.5% | 2023-24:54% 2024-25:55% 2025-26:47% |
| faces D_PERIM_LOCK, prior −5 → TT UNDER | 671 | 49.2% | -7.4% | 2023-24:51% 2024-25:46% 2025-26:51% |
| faces D_SOFT_FOUL, prior +5 eff vs it → BACK ATS | 669 | 50.1% | -4.3% | 2022-23:46% 2023-24:55% 2024-25:54% 2025-26:48% |
| faces D_SOFT_FOUL, prior −5 eff vs it → FADE ATS | 200 | 55.0% | +5.0% | 2022-23:60% 2023-24:60% 2024-25:52% 2025-26:44% |
| faces D_SOFT_FOUL, prior +5 → TT OVER | 498 | 46.6% | -12.4% | 2023-24:49% 2024-25:42% 2025-26:49% |
| faces D_SOFT_FOUL, prior −5 → TT UNDER | 139 | 43.9% | -17.8% | 2023-24:51% 2024-25:47% 2025-26:32% |

## Persistence check (is the split real skill or noise?)

- D_PAINT_WALL: corr(prior split +/- , this-game eff delta) = +0.039 (n=4,547)
- D_PRESS: corr(prior split +/- , this-game eff delta) = +0.053 (n=2,550)
- D_PERIM_LOCK: corr(prior split +/- , this-game eff delta) = +0.007 (n=4,149)
- D_SOFT_FOUL: corr(prior split +/- , this-game eff delta) = +0.060 (n=1,602)

## Concrete examples (audit trail)

- 2025-01-25 **Siena** vs Iona (opponent=D_PRESS). Season prior eff 100.6, prior vs-press eff 68.2 (Δ-32.4). Game: eff 100.7, margin -4, cover_amt +0.8
- 2025-01-16 **Bryant** vs UAlbany (opponent=D_PRESS). Season prior eff 104.8, prior vs-press eff 77.4 (Δ-27.4). Game: eff 129.0, margin +10, cover_amt +6.5
- 2025-01-16 **Austin Peay** vs Eastern Kentucky (opponent=D_PRESS). Season prior eff 88.8, prior vs-press eff 62.5 (Δ-26.3). Game: eff 113.2, margin +7, cover_amt +9.5
- 2025-02-24 **Delaware State** vs North Carolina Central (opponent=D_PRESS). Season prior eff 100.8, prior vs-press eff 117.7 (Δ+16.9). Game: eff 113.5, margin +2, cover_amt -1.5
- 2025-01-07 **Buffalo** vs Ohio (opponent=D_PRESS). Season prior eff 89.0, prior vs-press eff 106.1 (Δ+17.1). Game: eff 74.6, margin -9, cover_amt +3.0
- 2025-02-22 **Delaware State** vs South Carolina State (opponent=D_PRESS). Season prior eff 100.6, prior vs-press eff 122.4 (Δ+21.8). Game: eff 103.6, margin -6, cover_amt -1.5
- 2026-01-19 **NJIT** vs Bryant (opponent=D_PAINT_WALL). prior eff 89.9, vs-paint-wall 45.3 (Δ-44.6). Game: eff 104.7, margin +24, cover +21.5
- 2026-01-29 **NJIT** vs UAlbany (opponent=D_PAINT_WALL). prior eff 90.5, vs-paint-wall 60.1 (Δ-30.4). Game: eff 112.6, margin +9, cover +13.5
- 2026-02-21 **Tennessee State** vs SIU Edwardsville (opponent=D_PAINT_WALL). prior eff 105.7, vs-paint-wall 80.0 (Δ-25.7). Game: eff 120.0, margin +27, cover +22.5
- 2026-01-08 **Ohio State** vs Oregon (opponent=D_PAINT_WALL). prior eff 119.0, vs-paint-wall 136.3 (Δ+17.3). Game: eff 124.8, margin +10, cover +11.5
- 2026-02-28 **New Hampshire** vs UAlbany (opponent=D_PAINT_WALL). prior eff 96.4, vs-paint-wall 113.8 (Δ+17.4). Game: eff 91.2, margin -23, cover -19.5
- 2026-01-03 **Loyola Chicago** vs Dayton (opponent=D_PAINT_WALL). prior eff 103.4, vs-paint-wall 123.6 (Δ+20.2). Game: eff 103.8, margin -2, cover +5.0
