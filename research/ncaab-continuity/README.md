# NCAAB early-season roster continuity + new head coach (2026-10-27)

**Owner's theory:** who came back (returning minutes, starters back, star back), who is new (transfers, freshmen) and a new
head coach are preseason facts the public does not price, especially at small schools, so the first games should carry an
edge the way the CFB early-roster signals do.

**Verdict in one line:** roster continuity is PRICED in college (if anything the market over-pays for it); the small-school
version of the thesis fails; the one thing that survives is a **new head coach taking over a rebuilt roster**, backed as an
underdog in November-December.

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

## Shipping requirements (not built)

A production job needs (1) the 2026-27 roster per team (CBBD `/teams/roster`, as `ncaab_hype_signal.py` already pulls),
(2) 2025-26 minutes per player (CBBD `/stats/player/season?season=2026`) to compute minutes kept, (3) a head-coach source
for 2026-27 (sports-reference season page as `cbb_sit_build.py` scrapes; CBBD has no coaches endpoint), (4) the Odds API
spread (the team must be a dog). Flag key proposal: `ncaab_new_coach_rebuild_dog`, Nov-Dec only, tier tracking.
