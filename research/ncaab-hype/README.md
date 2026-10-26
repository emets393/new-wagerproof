# NCAAB preseason hype -- measuring it, and the early-season games it shows up in

Owner question (2026-10-26): teams with all the notoriety coming into a season -- the huge recruiting class, the
multiple top-50 players -- playing an early game against a real opponent, not the -44.5 buy game. First, measure hype.

```
hype_index.py        preseason hype per team-season 2020-21 .. 2025-26  -> data/hype_index.parquet
early_hype_test.py   eight hype definitions x early major games          -> data/EARLY_HYPE_RUN.txt
hype_robust.py       ledger, placebo, concentration, dose, permutation   -> data/HYPE_ROBUST_RUN.txt
```

## How hype is measured (everything dated before opening night)

| component | source | what it captures |
|---|---|---|
| preseason AP and Coaches rank (week-1 poll, mid-October) | College Basketball Data `/rankings` | media expectation |
| recruiting class rank and rating for the class that enrolled | CBBD `/recruiting/teams` | the "huge class" story |
| top-50 / top-100 / five-star recruits ON THE ROSTER, any class | CBBD `/recruiting/players` joined to `/teams/roster` by athlete id (98 of 100 match) | star power, including sophomores and transfers who were top recruits |
| top-50 FRESHMEN | same, class year = this season | the new-arrival story |
| KenPom rank on the opening-day archive snapshot | `../bball-odds` KenPom archive | what the numbers think |
| poll premium = KenPom rank minus AP rank | both | hype BEYOND substance (Rutgers 2024-25: AP 25, KenPom 63) |
| previous season's final KenPom rank | archive | new hype vs holdover power |

Composite `hype` = mean z within season of (-AP rank, -class rank, top-50 count, poll premium); `hype_rank` ranks it.
The top-10 lists per season read right (Duke, Kentucky, UNC, Kansas, Rutgers 2024-25, Arkansas 2025-26). Not yet in
the index: ticket counts per game from the Action Network feed (two seasons only) and futures prices (not held).

## The test

Universe: regular season, November-December, team in a power conference, opponent in a power conference or KenPom
top-40 at tip, |closing spread| <= 12. One row per team-game, graded from the hype team's side at the T-60 close.
2,225 rows over six seasons; the universe itself is 49.7% ATS from either side, favourites 51.3%.

**Backing the hype team loses in every star-power framing.** From `EARLY_HYPE_RUN.txt`, hype side ATS at close:

| definition | n | hype team ATS | neutral court |
|---|---|---|---|
| 3+ top-50 recruits on roster vs opponent with 0-1 | 271 | 119-152 (43.9%) | 45-73 (38.1%) |
| recruiting class top-5 vs opponent class outside top-25 | 69 | 26-43 (37.7%) | 13-20 |
| 2+ top-50 freshmen vs opponent with none | 167 | 73-94 (43.7%) | 34-46 |
| composite hype top-10 vs opponent outside top-25 | 148 | 70-78 (47.3%) | 26-32 |
| poll premium 8+ (AP likes them more than KenPom) | 134 | 66-68 (49.3%) | 32-33 |

The roster-talent definitions carry it; the poll-based ones do not. The market prices the poll. It does not fully
price a roster of top recruits that has not played together yet.

## ★ The candidate: FADE the star-power roster in its early major games

3+ top-50 recruits on the roster, opponent with 0 or 1, November-December, major opponent, |spread| <= 12, bet the
opponent at the close:

| | record | win% | ROI at -110 |
|---|---|---|---|
| all six seasons | **152-119-2** | 56.1% (95% lower 50.2%) | +7.1% |
| 2020-21 / 21-22 / 22-23 / 23-24 / 24-25 / 25-26 | 20-14 / 22-19 / 30-23 / 22-25 / 32-19 / 26-19 | five of six winning | |
| at the opener instead | 152-120 | 55.9% | +6.7% |
| neutral court only | 73-45 | 61.9% | +18% |
| hype team favoured / dog | 101-86 / 50-33 | 54.0% / 60.2% | |

Checks (`HYPE_ROBUST_RUN.txt`):
- **Placebo passes.** Same definition in January-February: 423-402 (51.3%), −2.1%. The overpricing is an early-season
  phenomenon; by conference play the market has watched the roster and the gap is gone.
- **Null.** Permuting the roster star-count across power-conference team-seasons within each season: null 50.0% ± 2.8%,
  p = 0.018 for the observed 56.1%.
- **Not one team.** 12 programs contribute 9+ games; the worst drop-one is Texas, which leaves 144-119 (54.8%). Duke
  itself is only 4-8 for the fade.
- **Dose is not monotone**, and that is the caution: exactly 2 top-50 recruits 52.2%, exactly 3 59.7%, exactly 4
  49.3% (n=69), 5+ 55.9%. The 4-recruit dip is inside noise but a clean effect should rise with the dose. Treat as a
  candidate with one more season of live grading, not a proven signal.
- **Both rosters hyped** (opponent also 3+): 51.2%. The edge is the asymmetry, hype against a normal roster.

Mechanism, stated before and consistent with the numbers: the hype team is favoured by 2.7 on average and wins
straight up 54.6%, but the margin averages +1.8 -- the market gives a roster of top recruits about a point more than
a roster that has not played together earns in November. By January it stops.

## To ship it

Signal `ncaab_hype_roster_fade` on the lifecycle standard: back-test columns from the table above (152-119, +7.1%,
2020-21 to 2025-26), live grading from opening night. Inputs for the current season are already cached in `data/`
(2025-26 rosters, recruits, polls); the 2026-27 pull is the same three CBBD calls on opening week. The flag writer
needs the CBBD teamId for each slate game (the panel's key) and the opponent's conference.

## This season (`upcoming_2027.py` -> `data/candidates_2027.csv`)

2026-27 inputs pulled 2026-10-26: CBBD rosters and schedule for season 2027, recruits through the class of 2026
(⚠ the 2026 class has no athlete ids yet, so freshmen are assigned by their commitment; older classes by id), KenPom
`ratings?y=2027` for the opponent rule and a projected spread (AdjEM gap plus 3 for a true home side). 23 power-conference
rosters carry 3+ top-50 recruits; 43 November-December games meet the roster and opponent conditions, 33 of them
projected inside the 12-point window. Lines post the week of each game: re-pull `odds_now.parquet` from The Odds API and
re-run before betting any of them.
