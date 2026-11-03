# NCAAB early-season TENURE + COHESION at small schools (2026-11-02)

**Owner's theory:** the most tenured small-school teams (the players who actually play are juniors/seniors) and the most
cohesive ones (the same players have stayed together for years) should do better in the first 5-10 games because the books
do not price them well at first -- or the opposite.

**Verdict in one line:** tenure is REAL (about +2 points of margin for a rotation that is all upperclassmen vs all
underclassmen) and the market prices it to the point (+2.1 in the spread), so the most tenured / most cohesive small schools
cover **50-51%** in every early window; the thing that pays runs the **opposite** way -- a small-school rotation that is both
the **youngest** quintile and the **newest to each other** quintile covers **687-592 (53.7%) in Nov-Dec**, 56.2% as a dog of 7+.

Scripts: `tenure_study.py` -> `TENURE_RUN.txt` (metrics, ladders, 16 pre-stated rules x 3 windows); `robust_young.py` ->
`ROBUST_YOUNG.txt` (stress test of the one cell that cleared). Seasons 2022-23..2025-26 (class needs two observable prior
seasons; the box starts 2020-21). 45,886 priced team-games, 77% at non-power schools. Records from the bet side, T-60 close.

## How tenure and cohesion were measured

Rotation = the players who appear in the team's first 10 games, weighted by their minutes in those games ("the players
that actually play"). Class is not in any cache, so it is derived from the box: `d1_prev` = seasons before this one with D1
minutes anywhere (0 Fr, 1 So, 2 Jr, 3+ Sr). Cohesion uses `here_prev` = seasons before this one with minutes AT THIS SCHOOL.
CBBD's roster `startSeason` is the first season at that school (transfers reset -- verified on 4,310 transfers), and the
box-derived years-at-school agree with it at r = .95; the box-derived experience agrees with KenPom's Exp at r = .71.

| metric | meaning |
|---|---|
| `upper_share` | share of rotation minutes played by juniors/seniors |
| `avg_exp` | minutes-weighted D1 seasons played (KenPom Exp analogue) |
| `core_share` | share of minutes by players in their 3rd+ season at this school |
| `avg_here` | minutes-weighted seasons at this school |
| `pair_core` / `pair_ret` | of the top-7 by minutes, fraction of pairs together 2+ years / who played here together last year |

Small school = non-power conference (same map as `ncaab-continuity/split_grid.py`); KenPom preseason quintile = as-of
rating at the first priced game.

## A. Is it real, is it priced? (team-season regression, first 10 games, controls = preseason KenPom + last season's margin)

| per full unit of the metric | realised margin | the market's spread | ATS gap left |
|---|---|---|---|
| Jr/Sr minutes share, all D1 | **+2.18** (t 2.4) | **+2.11** (t 3.5) | +0.07 (t 0.1) |
| Jr/Sr minutes share, small schools | +1.72 (t 1.7) | +1.52 (t 2.2) | +0.19 (t 0.3) |
| 3rd+-year-at-school share, small schools | +1.35 (t 1.3) | +1.71 (t 2.4) | -0.36 (t -0.6) |
| seasons at this school, small schools | +0.48 | +0.68 (t 2.3) | -0.20 |
| top-7 pairs together 2+ yrs, small schools | +1.98 | +2.45 (t 2.3) | -0.46 |

Experience moves results and the market moves with it one-for-one. Cohesion the market pays for slightly MORE than it
delivers at small schools (the gap runs against the cohesive team), nowhere near significant.

## B. Quantile ladders (owner standard) -- all flat

Every ladder (6 metrics x 3 windows, all D1; 6 metrics x 3 windows within small schools; 3 within low-majors) sits between
47.4% and 53.2% with no monotone shape. The most tenured quintile BACK: first 5 games 50.8%, first 10 50.3%, Nov-Dec 50.7%
(small schools 51.7 / 50.5 / 50.6%). The most cohesive quintile: 49.3 / 49.4 / 49.5% (small schools 50.6 / 50.0 / 49.8%).
The prior-minutes weighting (no in-season information) and KenPom's own Exp give the same flat ladders (section F).

Rules on the owner's side of the theory, first 10 games: Jr/Sr play 75%+ of minutes 50.4%; 3rd+-year players 50%+ of minutes
50.6% (fade side); 40%+ of top-7 pairs together 2+ years 50.2%; tenure gap +35 points vs the opponent 50.6% (fade side);
most tenured vs an opponent playing freshmen 40%+ 51.8% (fade side). **Both most-tenured AND most-cohesive at a small school
FADES** 353-318 (52.6%) first 10 and 181-151 (54.5%, shuffle p .09) first 5 -- the market, if anything, over-rates them.

## ★ C. The opposite: YOUNG and NEW small-school rotations cover early -- `robust_young.py`

Cell = non-power school, within-season bottom quintile on Jr/Sr minutes share AND bottom quintile on 3rd+-year share
(a rotation of freshmen/sophomores who have not been together). Pre-stated as the "opposite" rule in `tenure_study.py`.

| window, BACK | record | % | ROI | shuffle p | seasons | vs opener |
|---|---|---|---|---|---|---|
| first 5 games | 295-241 | 55.0% | +5.1% | .017 | 23: 104-80, 24: 55-58, 25: 73-51, 26: 63-52 | 53.6% |
| first 10 games | 567-503 | 53.0% | +1.2% | .048 | 199-166, 115-112, 132-117, 121-108 | 52.5% |
| **Nov-Dec** | **687-592** | **53.7%** | **+2.5%** | **.004** | 255-205, 128-127, 158-134, 146-126 | 52.9% |
| Jan-Feb placebo | 813-792 | 50.7% | | | | |
| March placebo | 132-150 | 46.8% | | | the market has learned them | |

2-D grid, Nov-Dec, small schools (BACK %, rows = tenure quintile 1 young..5 old, cols = cohesion quintile 1 all-new..5 together):

```
            new    2      3      4    together
young    53.7%  50.3%  47.7%  49.2%  54.9%(71)
2        47.4%  50.4%  49.4%  51.5%  46.2%
3        48.8%  52.2%  54.7%  47.6%  48.7%
4        50.7%  45.1%  47.9%  47.7%  53.2%
old      50.0%  53.2%  53.2%  52.2%  48.7%
```

The edge is a CORNER, not a gradient: young alone 51.2%, new alone 51.0%, widen either axis to Q1-2 and it falls to 52.3 /
51.7 / 51.1%. Statable absolute rule: Jr/Sr share <= 20% and NO 3rd+-year minutes -> 344-296 (53.8%, p .06).

Splits of the Nov-Dec cell: dog of 7+ **371-289 (56.2%, +7.3%)**, dog of 12.5+ 244-186 (56.7%), vs a power-conference
opponent 147-110 (57.2%), away 416-358 (53.7%), home 194-173 (52.9%), favourite 159-138 (53.5%); KenPom preseason Q1
437-391 (52.8%), Q2 143-108 (57.0%), Q3 93-82; games 1-5 55.0%, games 6-10 50.9%, games 11+ in December 57.3%; freshmen
playing 50%+ of minutes 51.4% vs sophomore-heavy young rotations 55.0%. Low-major 668-573 (53.8%); mid-major 19-19; power
30-30. Drop-one season 52.7-54.6%. Totals 49.6% and 1H spread 52.2% -- a full-game side read only.

Overlap with the shipped new-coach family: a new head coach is on 406 of the 1,279 games (53.9%); the SAME coach 391-342
(53.3%, p .058); excluding every new-coach + rebuilt team still 527-462 (53.3%, p .03). It is related to the rebuilt-roster
idea (rebuilt 364-304, 54.5% vs not-rebuilt 323-288, 52.9%) but the continuity study showed rebuilt-by-transfers alone is
null (51.1% at low tier) -- what pays is a rebuild with UNDERCLASSMEN, which the market prices off last year's program as a
9-point dog that then wins 32% straight up but covers 54%.

**Caveats (README, not headline):** corner cell among ~50 pre-stated cells plus the stress splits; 2023-24 is flat
(128-127); 53.7% / +2.5% at the broad cell is a lean, the dog-of-7+ refinement (56.2%) is post-hoc; population is small
(23-37 teams, 260-465 games a season); 2022-23 metrics are censored (a "3rd+ year" player then needs minutes in both 2020-21
and 2021-22). Ships, if at all, as a tracking-tier candidate; the live grader decides.

## Shipping requirements (not built)

A production job needs (1) this season's first-N-games box per team (CBBD `/games/players`) to get the rotation and its
minutes, (2) each player's prior D1 seasons and prior seasons at this school from the same box history (cache
`cbbd_player_box` covers 2020-21..2025-26; 2026-27 appends), (3) the conference map and the Odds API spread. Before game 1 the
rotation is unknown -- use the roster with prior-minutes weighting (section F shows the same flat ladders for the theory
side; the young-and-new cell should be re-graded under that weighting before shipping). Proposed key
`ncaab_young_new_small_dog`: non-power, Jr/Sr share <= 20%, no 3rd+-year minutes, dog of 7+, Nov-Dec, tier tracking.

## Follow-up 2026-11-02 (same day): clean definition + this season's screen -- `screen_2027.py`, `SCREEN_2026-11-02.csv`

The study cell used a within-season quintile on 3rd+-year share, but 41-117 D1 teams a season have EXACTLY zero such
minutes, so "Q1" was an arbitrary tie-break among them. Re-graded on the full set (young quintile AND zero 3rd+-year
minutes, non-power), Nov-Dec: **633-555 (53.3%)**; **dog of 7+ 342-269 (56.0%, +6.9%), 4/4 seasons** (71-62, 54-51, 104-68,
113-88); dog of 12.5+ 229-177 (56.4%); spread under +7 **291-286 (50.4%)** -- the whole edge is the big-dog side; Jan-Feb
placebo 51.1%. Preseason roster weighting (prior-season minutes, freshmen at 50 minutes, calibrated so the league freshman
share matches the first-10-games rotation; r = .93 with the actual metric) reproduces it: absolute rule Jr/Sr <= 20% and
zero 3rd+-year minutes, Nov-Dec 156-129 (54.7%), dog of 7+ 82-65 (55.8%), 2022-23..2024-25.

2026-27 screen (preseason weighting, CBBD rosters pulled 2026-11-02): 39 non-power teams in the cell, 15 of them with Jr/Sr
share <= 20%. Opening day Monday 2026-11-02, games with a line: 12-10 ATS; as dogs of 7+ 8-7. Full list with results and the
week's schedule in `SCREEN_2026-11-02.csv`. Rule for the watchlist: cell team, dog of 7+, D1 opponent, Nov-Dec.

## KenPom components for non-power schools (owner follow-up 2026-11-02) -- `kenpom_profile.py`, `kenpom_followup.py`

Preseason KenPom (first archive date of each season, 2022-23..2025-26) adjusted offense, adjusted defense and tempo, national
ranks, own and opponent, on every non-power team-game Nov-Dec and inside the young-and-new cell. Records BACK the team.

**On their own, nothing.** Offense rank bands 47.9-51.2%, defense 47.7-51.1%, tempo 49.2-51.3%, offense-led vs defense-led
48.3-51.8% (the 150+ imbalance tails are 110-86 and 117-109), tempo vs the opponent 48.7-51.3%, fast-vs-slow matchups 49.7 /
51.3%. The one shape: **rated non-power teams are a shade over-priced early** -- preseason top-100 offense OR defense fades
1,109-1,003 (52.5%, shuffle p .012) Nov-Dec, 514-457 (52.9%) as a favourite of 7+, Jan-Feb placebo 48.9%. ROI is +0.2% / +1.1%:
sub-vig, not a bet; the rank ladder is not monotone (151-200 band 55.1% with a 55.1% placebo). Of note only as context:
the rated favourite fades 54.6% when its roster is young/uncohesive and 48.0% when it is not.

**Inside the cell, the young team's own KenPom profile does not split it.** As a dog of 7+ every offense / defense / tempo
tercile sits 53-63% on 110-260 games with no order (defense best-third 78-45, worst-third 145-117; fastest 100-76, slowest
123-99; offense-led 67-56, defense-led 48-25). What matters is the **opponent's** preseason rank:

| young-and-new cell, dog of 7+, Nov-Dec | record | % | ROI |
|---|---|---|---|
| vs opponent in the KenPom top 50 | 70-67 | 51.1% | -2.5% |
| **vs opponent outside the top 50** | **265-190** | **58.2%** | **+11.2%** |
| ... and dog of 12.5+ | 157-106 | 59.7% | +14.0% |
| ... dog of 7 to 12 | 108-84 | 56.2% | +7.4% |
| ... opponent is power-conference | 64-45 | 58.7% | |
| ... opponent is non-power | 201-145 | 58.1% | |

Seasons 47-47, 41-27, 86-49, 91-67; shuffle p .009; Jan-Feb placebo 248-220 (53.0%). Opponent band ladder 51-100 55.9%,
101-150 58.5%, 151-250 61.1%, 251+ 57.1%; the top-25 opponents (39-29) and 26-50 (31-38) are noise around 50%. Reading: the
elite teams cover their 30-point numbers; the mid-table hosts laying 10-20 to a young unknown do not. Post-hoc split on
~600 games -- report it as the refinement, grade the broad cell live.
