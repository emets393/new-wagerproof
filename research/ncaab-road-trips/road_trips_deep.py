#!/usr/bin/env python3
"""Deep pass on the wide road-trip read: the market slightly over-fades teams deep into a trip (road game #3+ ATS 51.8%, p .013).
Where does it concentrate, is it just the road-dog band, and do the thin-bench / young / big-dog pockets survive per season?"""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import road_trips_wide as W
D, cell, rec = W.D, W.cell, W.rec
out = open("ROAD_TRIPS_DEEP.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
W.P = P
reg = (D.conf_tourney != 1) & (D.ncaa_t != 1); road = D.road & reg
P("=== 1. IS THE DEEP-TRIP LEAN JUST THE ROAD-DOG BAND? road dog 10.5-17 (held signal) x which road game in a row ===")
band = road & D.spread.between(10.5, 17)
for k, m in (("#1", D.road_run == 1), ("#2", D.road_run == 2), ("#3+", D.road_run >= 3)):
    cell(f"road dog 10.5-17, road game {k} in a row", band & m, p=True, per=(k == "#3+"))
P("  -- and outside the band")
for k, m in (("#1", D.road_run == 1), ("#2", D.road_run == 2), ("#3+", D.road_run >= 3)):
    cell(f"road dog 0.5-10, road game {k}", road & D.spread.between(0.5, 10) & m); cell(f"road dog 17.5+, road game {k}", road & (D.spread >= 17.5) & m); cell(f"road FAVORITE, road game {k}", road & (D.spread < 0) & m)

P("\n=== 2. ROAD GAME #3+ x BENCH DEPTH (KenPom Bench = share of minutes by reserves) ===")
r3 = road & (D.road_run >= 3)
D["bench_q"] = D.groupby("season_end").own_bench.transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=["Q1 thinnest", "Q2", "Q3", "Q4", "Q5 deepest"]))
for q in ["Q1 thinnest", "Q2", "Q3", "Q4", "Q5 deepest"]:
    cell(f"road #3+, bench {q}", r3 & (D.bench_q == q), p=(q == "Q1 thinnest"), per=(q == "Q1 thinnest"))
P("  -- control: bench quintile on road game #1 (if thin benches cover everywhere it is not a trip effect)")
for q in ["Q1 thinnest", "Q5 deepest"]:
    cell(f"road #1, bench {q}", road & (D.road_run == 1) & (D.bench_q == q)); cell(f"home games, bench {q}", (D.is_home == 1) & reg & (D.bench_q == q))
cell("road #3+, thinnest-quintile bench, as dog", r3 & (D.bench_q == "Q1 thinnest") & (D.spread > 0)); cell("road #3+, thinnest bench, as favorite", r3 & (D.bench_q == "Q1 thinnest") & (D.spread < 0))
cell("road #3+, thinnest bench, young (Exp < 1.5)", r3 & (D.bench_q == "Q1 thinnest") & (D.own_exp < 1.5)); cell("road #3+, thinnest bench, experienced (>= 2)", r3 & (D.bench_q == "Q1 thinnest") & (D.own_exp >= 2))

P("\n=== 3. ROAD GAME #3+ x DOG SIZE x TEAM QUALITY (where the market leans hardest against the traveller) ===")
for lo, hi, nm in ((14.5, 60, "dog 14.5+"), (10.5, 14, "dog 10.5-14"), (5.5, 10, "dog 5.5-10"), (0.5, 5, "dog 0.5-5")):
    cell(f"road #3+, {nm}", r3 & D.spread.between(lo, hi), p=(lo == 14.5), per=(lo == 14.5))
cell("road #3+, dog 14.5+, Nov-Dec (buy games)", r3 & (D.spread >= 14.5) & D.month.isin([11, 12])); cell("road #3+, dog 14.5+, conference play", r3 & (D.spread >= 14.5) & (D.conf_game == 1))
cell("road #3+, vs much better host (EM gap >= 10)", r3 & (D.o_kp_em - D.own_kp_em >= 10), p=True, per=True)
cell("road #3+, young (Exp < 1.5)", r3 & (D.own_exp < 1.5), p=True, per=True)
cell("road #3+, young AND dog 7.5+", r3 & (D.own_exp < 1.5) & (D.spread >= 7.5))
cell("road #4+, dog 7.5+", road & (D.road_run >= 4) & (D.spread >= 7.5), p=True, per=True)
P("  -- control: the same pockets on road game #1-2")
cell("road #1-2, dog 14.5+", road & (D.road_run <= 2) & (D.spread >= 14.5)); cell("road #1-2, vs much better host", road & (D.road_run <= 2) & (D.o_kp_em - D.own_kp_em >= 10)); cell("road #1-2, young", road & (D.road_run <= 2) & (D.own_exp < 1.5))

P("\n=== 4. HOME TEAM RETURNING FROM A TRIP AS THE DOG (fade?) ===")
ret = D.returning & reg
cell("returning home after 1+ road games, as dog", ret & (D.spread > 0), p=True, per=True); cell("returning after 3+ road games, as dog", ret & (D.p_trip_len >= 3) & (D.spread > 0), p=True, per=True)
cell("returning after 1+ road games, as dog of 7+", ret & (D.spread >= 7)); cell("control: home dog NOT returning (home stand game 2+)", (D.is_home == 1) & (D.home_run >= 2) & (D.spread > 0) & reg)

P("\n=== 5. TOTALS: compressed trips (the only total cell that moved) ===")
cell("road #3 within 5 days of trip start", road & (D.road_run == 3) & (D.span <= 5), p=True, per=True)
cell("road #2+ within 3 days of trip start", road & (D.road_run >= 2) & (D.span <= 3)); cell("road #3+ within 7 days", road & (D.road_run >= 3) & (D.span <= 7)); cell("BOTH teams on 1 day rest", road & (D.rest <= 1) & (D.o_rest <= 1))
P("\n=== 6. THE OTHER SIDE: hosting a team on road game #3+ (home team's row) ===")
hostrow = D[["cbbd_id", "teamId", "road_run"]].rename(columns={"teamId": "opponentId", "road_run": "o_rr"})
D2 = D.merge(hostrow, on=["cbbd_id", "opponentId"], how="left")
m = (D2.is_home == 1) & (D2.o_rr >= 3) & reg.values
s = D2[m]; cw, cl = rec(s.cover); P(f"  home team hosting a visitor on road game #3+: ATS {cw}-{cl} ({100*cw/(cw+cl):.1f}%) n={len(s)} (mirror of the traveller's 51.8%)")
out.close()
