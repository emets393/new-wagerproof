# NCAAB consecutive road games (2026-10-28)

**Direction (owner):** start wide on teams playing several away games in a row, then go deep. `road_trips_wide.py` → `ROAD_TRIPS_WIDE.txt`
(run index, trip length × position, compression, returning home, the host's situation, distance, splits), `road_trips_deep.py` /
`road_trips_deep2.py` → `ROAD_TRIPS_DEEP*.txt`. Six seasons, T-60 close, 27,890 true road team-games; shuffle null within season-month.

## Wide verdict: the market prices road trips

Nothing on totals anywhere (every cell 49-52% over, matched to the spread). Moneylines deeply negative (dogs). ATS from the traveller's
side: road game #1 in a row 50.3%, #2 49.7%, **#3 51.4%, #4 53.1%, #5+ 51.3%**; all #3+ **2,041-1,899 (51.8%, p .013)**, 5/6 seasons, but
−1.1% at the price. Trip length × position, compressed trips, days of rest, the host returning from the road or on a home stand, in-state vs
out-of-state, distinct states visited: all flat. **Returning home after a trip: nothing** (48.7-50.0% for every trip length).

The one direction: the market slightly over-fades teams deep into a trip, and only where it already leans hardest against the traveller —
#3+ as a 14.5+ dog 53.4% (p .028), vs a much better host 53.5% (p .007, 6/6), young team 53.0% (p .002), young and dog 7.5+ 54.2%
(574-485). The same pockets on road games #1-2 are 49.9-51.4%, so the trip adds two to three points. Leans, not signals, at +1 to +3%.

## Deep 1: the road-dog band lives in the FIRST game of a trip

| road dog 10.5-17 (held signal) | ATS | % | ROI | p |
|---|---|---|---|---|
| all | 2,233-1,993 | 52.8% | +0.9% | |
| road game #1 of a trip | 1,254-1,058 | 54.2% | +3.6% | < .001 |
| … and NOT the season's first road game | **1,042-861** | **54.8%** | **+4.6%** | < .001, 6/6 |
| … but it IS the season's first road game | 212-197 | 51.8% | | |
| road game #2+ of a trip | 964-914 | 51.3% | | |

Tournaments included the production rule is **1,049-871 (54.6%, +4.3%)**. The held `ncaab_road_dog_band` is refined to this
(first stop of a trip, not the season's first road game), conviction raised to med.

**Collision with the first-road-trip fade.** The season's first road game as a 10.5-17 dog is where the two held signals point opposite
ways, and that pocket is a coin flip (visitor 212-197). Outside it the fade is stronger: back the home team **933-766 (54.9%, +4.9%)**,
six of six seasons (147-129, 142-129, 154-136, 171-108, 166-115, 153-149); visitor favored 243-185 (56.8%), visitor dog outside the band
686-580 (54.2%). `ncaab_first_road_game_fade` now carves the band out, record updated.

## Deep 2: bench depth is a standalone ATS factor, and a long trip sharpens it

KenPom `Bench` (share of minutes played by reserves), quintiles within season, all games: thinnest 51.4% → 50.9 → 50.2 → 49.2 → deepest
48.3% ATS, monotone (the matchup grid's "deep-bench fade" was this). On road game #3+ as a dog it concentrates:

| road #3+ dog, bench quintile | ATS | % |
|---|---|---|
| **Q1 thinnest** | **290-213** | **57.7%, +10.1%, p .003**, 5/6 seasons (50-28, 36-24, 44-32, 39-44, 49-35, 72-50) |
| Q2 | 251-238 | 51.3% |
| Q3 | 279-270 | 50.8% |
| Q4 | 315-297 | 51.5% |
| Q5 deepest | 440-433 | 50.4% |

Road #1-2 dogs: thinnest 52.0% → deepest 47.9% (the baseline ladder). Thinnest bench as a road #3+ dog of 0.5-7 is 134-93 (59.0%), young
(Exp < 1.5) 166-112 (59.7%). A step at the thinnest quintile rather than a dose, and a three-way cell found on the second pass, so it is a
**candidate lean**: a starters-heavy team deep into a trip is priced as tired and is not. Proposed key if the owner wants it:
`ncaab_thin_bench_long_trip` (own KenPom Bench bottom quintile, third-or-later true road game in a row, underdog → back), 290-213.

## Nulls (do not re-run)
Totals on any trip shape; returning home after any trip length; compressed trips and rest edges; host on a home stand or returning;
in-state vs out-of-state and states visited; experienced vs young on returning; previous road result (won/lost/covered) → next.
