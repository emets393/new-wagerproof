# NCAAB early-season roster continuity + new head coach (2026-10-27)

**Owner's theory:** who came back (returning minutes, starters back, star back), who is new (transfers, freshmen) and a new
head coach are preseason facts the public does not price, especially at small schools, so the first games should carry an
edge the way the CFB early-roster signals do.

**Verdict in one line:** roster continuity is PRICED in college (if anything the market over-pays for it) under every split;
the one thing that survives is a **new head coach at a bottom-quintile KenPom program**, backed in November-December
(526-428, 55.1%, +5.2%, 5/5 seasons). The "rebuilt roster" framing below was a proxy for this.

Scripts: `continuity_study.py` (builds the team-season continuity table from six seasons of CBBD player box, grades ~70
pre-stated cells vs the T-60 close, shuffle null + Jan-Feb placebo) → `CONTINUITY_RUN.txt`; `robust_new_coach.py` → `ROBUST_NEW_COACH.txt`.
Seasons 2021-22..2025-26 (2020-21 has no prior season in the cache). 55,494 priced team-games. Records from the bet side.

## What continuity is worth (section A)

| first 10 games, team-season regression | ret_min slope | t |
|---|---|---|
| realised margin (net of last season's margin) | +2.6 pts per 100% of minutes kept | 1.0 |
| the market's spread | +4.1 | 1.8 |
| ATS margin (the gap) | **−1.5** | −1.2 |

The market gives a full-continuity roster about four points over a fully rebuilt one; the games deliver about 2.6. Nothing
is left for the bettor, and the sign of what is left runs against continuity. Starters-back gives the same answer.

## Continuity rules (section B, E) — all inside the null

Kept 70%+ / kept ≤30% / continuity gap vs the opponent / 4-5 starters back / 0-1 starters back / leading scorer back vs
gone / 6+ transfers / transfers 50%+ of minutes / new players 60%+ of minutes, in four early windows: every cell 50-52.6%,
shuffle p ≥ .03 on one cell out of 44 (3+ more returning starters than the opponent, Nov-Dec, 854-771) with a flat dose
ladder (4-5 starters back 53.6% but 3-4 48.5%). Not a signal. Dose ladders on ret_min, ret_diff, starters_back, xfer_in,
new_share are flat (section E).

## Small schools (section D) — the thesis fails

Low-tier conferences (bottom third by KenPom) first 10 games: kept 70%+ **fades** 53.2% with a 47.3% placebo; rebuilt 51.1%;
4-5 starters back fades 51.6%. Mid and high tiers 50-52.5%. Consistent with the model lab's finding that low-vs-low
conference spreads are the market's sharpest segment, not its softest.

## ★ New head coach (section C + robustness)

| Nov-Dec, back the team | record | % | ROI at price | shuffle p | seasons ≥ .500 |
|---|---|---|---|---|---|
| new coach, any roster | 1,669-1,576 | 51.4% | ≈ 0 | .081 | 4/5 |
| new coach + rebuilt roster (≤30% of last season's minutes kept) | 982-862 | 53.3% | +1.6% | .005 | 5/5 (22: 83-64, 23: 131-131, 24: 182-164, 25: 268-232, 26: 318-271) |
| **… as an underdog** | **588-491** | **54.5%** | **+4.0%** | **.001** | **5/5** |
| … dog of 7+ | 385-303 | 56.0% | +6.7% | .002 | 5/5 |

- **Clean interaction:** new coach + rebuilt 53.3%; new coach with a kept roster 49.0%; same coach + rebuilt 48.8%; neither
  50.0%. It is the combination, not either part.
- **Placebo flips:** the same teams Jan-Feb 51.3% the other way, March 52.9% the other way — the market learns them.
- Drop-one season 52.9-53.8%. Vs the opener 52.8% (the close does not move toward them, +0.07). First 5 games 53.6%, games
  6+ 53.0%. Low tier 54.6%, mid 53.6%, high 52.0% — the small-school angle lives INSIDE this cell only.
- Population is growing with the portal: 13 → 21 → 31 → 43 → 49 such teams per season; ~220 underdog games a season.
- Mechanism: the market prices a new coach's rebuilt team off last year's bad program (they are dogs +2.9 on average and win
  only 45% straight up); the new roster is simply not that team.
- **Caveats:** ~70 cells searched, the underdog refinement is post-hoc (the owner's hypothesis was "new coach"); +4% at 54.5%
  is a lean, not the 56-58% the CFB early-roster signals carry. Ships only as a CANDIDATE (tracking tier) and the live
  grader decides.

## Shipping — built, awaiting the owner's go (2026-10-27)

`cfb_automation/scripts/cfb/ncaab_new_coach_signal.py`, flag key `ncaab_new_coach_bottom_kenpom`, chained into the `ncaab-hype-signal`
cron (10am/4pm ET, Nov-Dec). KenPom is the single source for the trigger: the `Coach` field of `ratings?y=2027` vs `ratings?y=2026`
marks the coaching change (56 of 59 of the research's sports-reference new coaches in 2025-26, the rest are name spellings), and the
preseason `RankAdjEM` in the bottom 20% (293+ of 365) is the quintile. No roster or minutes inputs: inside the cell the roster does not
matter. The qualifying list is frozen in Storage on the first run. 2026-27: 8 teams qualify (Kansas City, Northern Illinois, Siena,
Dartmouth, Jackson St., Louisiana Monroe, Texas Southern, Mississippi Valley St.), 119 Nov-Dec games, seven of them on opening day
Nov 2. Held back from main at the owner's request until the rest of the early-season research ships together.

## Splits (owner follow-up): conference size, AP rank, KenPom preseason quintiles — `split_grid.py` → `SPLIT_GRID.csv/.txt`

13 rules × 2 windows × 6 splits = 542 cells with n ≥ 150; 43 clear shuffle p < .05 against ~27 expected by chance, and the
excess is entirely the new-coach family. **Continuity rules under every split stay noise:** the hit cells sit at scattered
quintiles (Q2 here, Q3 there) with non-monotone ladders — kept 70%+ by KenPom quintile 48.7 / 47.7 / 53.9 / 47.2%; rebuilt by
conference size 51.1 / 49.7 / 47.9%; 4-5 starters back power 52.6% vs low-major 49.2% with a 49.6% placebo. "Leading scorer back,
opponent's gone" FADES at 54% when the team is a much better KenPom side (spread −19.6) and BACKS at 54% when worse — that is
dog/favorite, not continuity. Nothing to build.

### ★ The real shape: new head coach × KenPom preseason quintile (Nov-Dec, BACK) — `new_coach_kenpom.py` → `NEW_COACH_KENPOM.txt`

| KenPom preseason quintile | record | % | ROI | avg spread | SU win |
|---|---|---|---|---|---|
| **Q1 (worst 20%)** | **526-428** | **55.1%** | **+5.2%** | +12.1 | 24% |
| Q2 | 358-342 | 51.1% | −2.3% | +4.3 | 41% |
| Q3 | 308-337 | 47.8% | −8.6% | +0.6 | 46% |
| Q4 | 265-264 | 50.1% | −4.3% | −5.8 | 67% |
| Q5 (best) | 212-205 | 50.8% | −2.9% | −11.8 | 73% |

- Q1 every season: 22: 128-96 · 23: 108-92 · 24: 98-89 · 25: 107-81 · 26: 85-70. Shuffle p .004. **Jan-Feb placebo 49.2%** (633-653).
- **Roster rebuild is irrelevant inside Q1**: rebuilt 55.0%, not rebuilt 55.4%. Outside Q1, new coach + rebuilt is 52.4% (ROI +0.1%).
  The earlier "new coach + rebuilt" cell was Q1 programs wearing a roster label.
- Inside Q1: away 55.8% (393-311), home 53.2%, neutral 57.3% (n 89); vs a power-conference opponent 57.0% (127-96, spread +26.6);
  first 5 games 56.6% (232-178), games 6+ 54.0%. Every Q1 new-coach team is a low-major (0 power-conference teams in Q1).
- Mechanism: the market prices a bottom-20% program's November line off last year's team and coach; a new staff at a bad
  program is the one roster change the market under-weights, and it is corrected by conference play.
- Population: 14-22 teams a season, ~190 Nov-Dec games. Union with "rebuilt" as underdog adds volume at lower quality
  (752-626, 54.6%); dog of 7+ in the union 498-390 (56.1%, +7.0%).

**Shipping proposal:** `ncaab_new_coach_bottom_kenpom` — new head coach (sports-reference) AND KenPom preseason AdjEM rank in the
bottom 20% (`ratings?y=2027`, available now) → BACK the team ATS at the Odds API consensus, every Nov-Dec game, tier
tracking, back-test 526-428 (55.1%, +5.2%) 2021-22..2025-26. Roster inputs NOT needed.
