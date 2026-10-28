#!/usr/bin/env python3
"""Deep pass 2: (a) the road-dog band lives in the FIRST game of a trip -- refine and check against the first-road-game-of-season fade
(the two held signals can point opposite ways on the same game); (b) thin bench x long trip x dog, per season and dose."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import road_trips_wide as W
D, cell, rec = W.D, W.cell, W.rec
out = open("ROAD_TRIPS_DEEP2.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
W.P = P
reg = (D.conf_tourney != 1) & (D.ncaa_t != 1); road = D.road & reg
g = D.groupby(["season_end", "teamId"], sort=False)
D["prior_road_games"] = g.road.cumsum() - D.road.astype(int)          # true road games already played this season
first_season_road = road & (D.prior_road_games == 0)
band = road & D.spread.between(10.5, 17)
P("=== A. ROAD DOG 10.5-17 x FIRST GAME OF A TRIP ===")
cell("band, road game #1 of a trip (all)", band & (D.road_run == 1), p=True, per=True)
cell("   ... trip of exactly 1 game (home before and after)", band & (D.road_run == 1) & (D.trip_len == 1)); cell("   ... first of a 2+ game trip", band & (D.road_run == 1) & (D.trip_len >= 2))
cell("   ... AND it is the team's first road game of the SEASON", band & (D.road_run == 1) & first_season_road, p=True, per=True)
cell("   ... first game of a trip but NOT the season's first road game", band & (D.road_run == 1) & ~first_season_road, p=True, per=True)
cell("band, road game #2+ (all)", band & (D.road_run >= 2), p=True, per=True)
cell("   ... #2+ and not the season's first road game (always true) -- as dog 13.5-17", band & (D.road_run >= 2) & (D.spread >= 13.5)); cell("   ... #2+ dog 10.5-13", band & (D.road_run >= 2) & (D.spread <= 13))
P("  -- the two held signals collide on: first road game of the SEASON and a 10.5-17 dog. Who covers?")
cell("season's first road game, visitor dog 10.5-17 (visitor ATS shown)", first_season_road & D.spread.between(10.5, 17), p=True, per=True)
cell("season's first road game, visitor dog 0.5-10", first_season_road & D.spread.between(0.5, 10)); cell("season's first road game, visitor dog 17.5+", first_season_road & (D.spread >= 17.5)); cell("season's first road game, visitor favored", first_season_road & (D.spread < 0), per=True)
cell("NOT the season's first road game, visitor dog 10.5-17", road & (D.prior_road_games >= 1) & D.spread.between(10.5, 17), p=True, per=True)
cell("NOT the season's first road game, visitor favored", road & (D.prior_road_games >= 1) & (D.spread < 0))

P("\n=== B. THIN BENCH x LONG TRIP x DOG ===")
r3 = road & (D.road_run >= 3)
cell("road #3+, thinnest-quintile bench, as dog", r3 & (D.bench_q == "Q1 thinnest") & (D.spread > 0), p=True, per=True)
cell("   ... dog 7.5+", r3 & (D.bench_q == "Q1 thinnest") & (D.spread >= 7.5)); cell("   ... dog 0.5-7", r3 & (D.bench_q == "Q1 thinnest") & D.spread.between(0.5, 7))
cell("   ... bottom TWO quintiles of bench, as dog", r3 & D.bench_q.isin(["Q1 thinnest", "Q2"]) & (D.spread > 0), p=True, per=True)
P("  -- bench quintile ladder, road #3+ dogs")
for q in ["Q1 thinnest", "Q2", "Q3", "Q4", "Q5 deepest"]: cell(f"     road #3+ dog, bench {q}", r3 & (D.spread > 0) & (D.bench_q == q))
P("  -- the same ladder on road #1-2 dogs (is it the trip or the bench?)")
for q in ["Q1 thinnest", "Q2", "Q3", "Q4", "Q5 deepest"]: cell(f"     road #1-2 dog, bench {q}", road & (D.road_run <= 2) & (D.spread > 0) & (D.bench_q == q))
P("  -- and home dogs")
for q in ["Q1 thinnest", "Q5 deepest"]: cell(f"     home dog, bench {q}", (D.is_home == 1) & reg & (D.spread > 0) & (D.bench_q == q))
P("  -- bench as a standalone ATS factor (all games): quintile ladder")
for q in ["Q1 thinnest", "Q2", "Q3", "Q4", "Q5 deepest"]: cell(f"     all games, bench {q}", reg & (D.bench_q == q))
cell("thinnest-quintile bench vs deepest-quintile bench, same game (thin team's row)", reg & (D.bench_q == "Q1 thinnest") & (D.groupby('cbbd_id').bench_q.transform(lambda s: (s == 'Q5 deepest').any())), p=True, per=True)
out.close()
