#!/usr/bin/env python3
"""NCAAB consecutive road games -- the WIDE pass (owner 2026-10-28). Six seasons at the T-60 close, from the travelling team's row.

Definitions (regular season + tournaments unless stated; 'road' = true away game, not neutral; 'away from home' = away or neutral):
  road_run   how many true road games in a row this one is (1 = first game of a trip)
  trip_len   total true road games in this trip; pos = first / middle / last
  afh_run    away-from-home run counting neutral games
  span       days from the trip's first game to this one
  returning  first HOME game after a trip of L road games
  host_ctx   the home team's own situation: its previous game was on the road / it is on a home stand of k
  venue      ESPN venue state vs the team's home state (most common state of its home games) -> in-state / out-of-state;
             distinct states visited so far in the trip
Outcomes: own ATS at -110 (spread_price when present), total over/under at the T-60 prices, moneyline ROI at the price.
Writes ROAD_TRIPS_WIDE.txt.
"""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__)); BB = os.path.join(ROOT, "..", "bball-odds", "data", "parquet")
rng = np.random.default_rng(3); out = open(os.path.join(ROOT, "ROAD_TRIPS_WIDE.txt"), "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()

cols = ["cbbd_id", "season", "date", "month", "teamId", "opponentId", "team", "opponent", "is_home", "neutral", "conf_game", "nonconf", "conf_tourney", "ncaa_t", "mte", "gnum", "rest",
        "own_pts", "opp_pts", "spread", "total_line", "tot_resid", "ats_pts", "win", "ml_price", "opp_ml_price", "spread_price", "own_kp_em", "o_kp_em", "city", "state", "h_Exp", "a_Exp", "h_Bench", "a_Bench"]
D = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=cols)
F = pd.read_parquet(f"{BB}/ncaab_model_features.parquet", columns=["cbbd_id", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
D = D.merge(F, on="cbbd_id", how="left")
D["season_end"] = D.season.str[:4].astype(int) + 1; D["date"] = pd.to_datetime(D.date); D = D.sort_values(["season_end", "teamId", "date"]).reset_index(drop=True)
D["road"] = (D.is_home == 0) & (D.neutral == 0); D["afh"] = D.is_home == 0
g = D.groupby(["season_end", "teamId"], sort=False)
def runs(flag):
    """length of the current run of True values, 0 when False."""
    grp = (flag != flag.shift()).cumsum()
    return flag.groupby(grp).cumsum().where(flag, 0).astype(int)
D["road_run"] = g.road.transform(runs); D["afh_run"] = g.afh.transform(runs); D["home_run"] = g.is_home.transform(lambda s: runs(s == 1))
# trip id and length
D["trip_id"] = g.road.transform(lambda s: ((s != s.shift()).cumsum())).astype(str) + "_" + D.season_end.astype(str) + "_" + D.teamId.astype(str)
D.loc[~D.road, "trip_id"] = None
tl = D[D.road].groupby("trip_id").agg(trip_len=("road", "size"), trip_start=("date", "min")).reset_index()
D = D.merge(tl, on="trip_id", how="left")
g = D.groupby(["season_end", "teamId"], sort=False)   # re-bind after the merge (new frame)
D["span"] = (D.date - D.trip_start).dt.days
D["pos"] = np.select([~D.road, D.road_run == 1, D.road_run == D.trip_len], ["-", "first", "last"], default="middle")
D.loc[D.road & (D.trip_len == 1), "pos"] = "only"
# previous game flags (team), returning home
D["p_road"] = g.road.shift(1); D["p_road_run"] = g.road_run.shift(1); D["p_trip_len"] = g.trip_len.shift(1); D["p_date"] = g.date.shift(1)
D["returning"] = (D.is_home == 1) & (D.p_road == True)
# host context from the home team's own row
hostcols = D[["cbbd_id", "teamId", "p_road", "home_run", "road_run", "rest", "p_trip_len"]].rename(columns={"teamId": "opponentId", "p_road": "o_p_road", "home_run": "o_home_run", "road_run": "o_road_run", "rest": "o_rest", "p_trip_len": "o_p_trip_len"})
D = D.merge(hostcols, on=["cbbd_id", "opponentId"], how="left")
# venue state vs home state
home_state = D[D.is_home == 1].groupby("teamId").state.agg(lambda s: s.mode().iloc[0] if s.notna().any() else None).rename("home_state")
D = D.merge(home_state, on="teamId", how="left")
D["out_of_state"] = D.state.notna() & D.home_state.notna() & (D.state != D.home_state)
def _states(s):
    seen, out_ = set(), []
    for v in s:
        if pd.notna(v): seen.add(v)
        out_.append(len(seen))
    return pd.Series(out_, index=s.index)
D["states_so_far"] = 0
D.loc[D.road, "states_so_far"] = D[D.road].groupby("trip_id").state.transform(_states)
D["under"] = np.sign(-D.tot_resid); D["cover"] = np.sign(D.ats_pts); D["under_price"] = D.t60_total_under_price.fillna(1.91); D["over_price"] = D.t60_total_over_price.fillna(1.91)
D["key"] = D.season_end.astype(str) + "-" + D.month.astype(str); D["bs_b"] = pd.cut(-D.spread, [-60, -20, -15, -10, -5, 0, 5, 60])
D["p_win"] = g.win.shift(1); D["p_ats"] = g.ats_pts.shift(1)
V = D[D.spread.notna() & D.total_line.notna()].copy(); D = V
base_over = D.groupby("bs_b").apply(lambda x: 100 * (x.under < 0).sum() / max((x.under != 0).sum(), 1))
D["own_exp"] = np.where(D.is_home == 1, D.h_Exp, D.a_Exp); D["own_bench"] = np.where(D.is_home == 1, D.h_Bench, D.a_Bench)
P(f"team-games {len(D):,}; true road {int(D.road.sum()):,}; road_run distribution {D[D.road].road_run.value_counts().sort_index().to_dict()}; trip_len {D[D.road & (D.pos.isin(['first','only']))].trip_len.value_counts().sort_index().to_dict()}")

def rec(s): return int((s > 0).sum()), int((s < 0).sum())
def shuffle_p(mask, sgn, n=600):
    m = mask.values.astype(bool); s = sgn.values; ok = ~np.isnan(s); m, s, k = m[ok], s[ok], D.key.values[ok]; obs = s[m].sum()
    groups = {}
    for i, kk in enumerate(k): groups.setdefault(kk, []).append(i)
    groups = [(np.array(v), m[np.array(v)].sum()) for v in groups.values() if m[np.array(v)].sum() > 0]
    null = np.array([sum(s[rng.choice(idx, cnt, replace=False)].sum() for idx, cnt in groups) for _ in range(n)])
    return float((np.abs(null) >= abs(obs)).mean())
def cell(label, mask, p=False, per=False):
    s = D[mask]; n = len(s)
    if n < 60: P(f"  {label:<76} n={n} (thin)"); return
    cw, cl = rec(s.cover); uw, ul = rec(s.under)
    c_roi = 100 * (((s.spread_price.fillna(1.91) - 1) * (s.cover > 0)).sum() - (s.cover < 0).sum()) / max(cw + cl, 1)
    o_roi = 100 * (((s.over_price - 1) * (s.under < 0)).sum() - (s.under > 0).sum()) / max(uw + ul, 1)
    ml = s[s.ml_price.notna()]; m_roi = 100 * np.where(ml.win == 1, ml.ml_price - 1, -1).mean() if len(ml) > 30 else np.nan
    txt = (f"  {label:<76} n={n:5d} | own ATS {cw}-{cl} ({100*cw/max(cw+cl,1):.1f}%, {c_roi:+.1f}%) | OVER {ul}-{uw} ({100*ul/max(uw+ul,1):.1f}%, {o_roi:+.1f}%; sm {s.bs_b.map(base_over).astype(float).mean():.1f}%) tot {s.tot_resid.mean():+.2f} "
           f"| ML roi {m_roi:+.1f}% win {100*s.win.mean():.0f}% | sprd {s.spread.mean():+.1f}")
    if p: txt += f" | p(ATS) {shuffle_p(mask, D.cover):.3f} p(tot) {shuffle_p(mask, D.under):.3f}"
    P(txt)
    if per: P("      by season: " + " | ".join(f"{str(y)[2:]}: ATS {rec(x.cover)[0]}-{rec(x.cover)[1]} O {rec(x.under)[1]}-{rec(x.under)[0]}" for y, x in s.groupby("season_end")))

reg = (D.conf_tourney != 1) & (D.ncaa_t != 1)
P("\n=== A. WHICH ROAD GAME IN A ROW IS THIS? (true road games, regular season incl. Nov events) ===")
cell("home games (reference)", (D.is_home == 1) & reg)
for k in (1, 2, 3, 4):
    cell(f"road game #{k} in a row", D.road & (D.road_run == k) & reg, p=True, per=(k >= 2))
cell("road game #5+ in a row", D.road & (D.road_run >= 5) & reg, p=True, per=True)
P("  -- counting neutral games as away from home")
for k in (1, 2, 3, 4):
    cell(f"away-from-home game #{k} in a row (true road game)", D.road & (D.afh_run == k) & reg)
cell("away-from-home game #5+ in a row (true road game)", D.road & (D.afh_run >= 5) & reg, p=True)

P("\n=== B. TRIP LENGTH x POSITION (true road trips, regular season) ===")
for L in (1, 2, 3, 4):
    for pos in (["only"] if L == 1 else ["first", "middle", "last"] if L >= 3 else ["first", "last"]):
        cell(f"trip of {L} road games, {pos} game", D.road & (D.trip_len == L) & (D.pos == pos) & reg)
cell("trip of 5+ road games, first", D.road & (D.trip_len >= 5) & (D.pos == "first") & reg); cell("trip of 5+, middle", D.road & (D.trip_len >= 5) & (D.pos == "middle") & reg); cell("trip of 5+, last", D.road & (D.trip_len >= 5) & (D.pos == "last") & reg, p=True)
cell("ANY trip of 3+, LAST game", D.road & (D.trip_len >= 3) & (D.pos == "last") & reg, p=True, per=True)
cell("ANY trip of 3+, FIRST game", D.road & (D.trip_len >= 3) & (D.pos == "first") & reg, p=True, per=True)
cell("ANY trip of 3+, middle games", D.road & (D.trip_len >= 3) & (D.pos == "middle") & reg, p=True, per=True)

P("\n=== C. COMPRESSED TRIPS (days since the trip began) ===")
cell("road game #2 within 2 days of #1", D.road & (D.road_run == 2) & (D.span <= 2) & reg, p=True); cell("road game #2, 3-5 days after #1", D.road & (D.road_run == 2) & D.span.between(3, 5) & reg); cell("road game #2, 6+ days after #1", D.road & (D.road_run == 2) & (D.span >= 6) & reg)
cell("road game #3 within 5 days of #1", D.road & (D.road_run == 3) & (D.span <= 5) & reg, p=True); cell("road game #3, 6-9 days", D.road & (D.road_run == 3) & D.span.between(6, 9) & reg); cell("road game #3, 10+ days", D.road & (D.road_run == 3) & (D.span >= 10) & reg)
cell("road game #2+ on 1 day rest", D.road & (D.road_run >= 2) & (D.rest <= 1) & reg, p=True); cell("road game #2+ on 2 days rest", D.road & (D.road_run >= 2) & (D.rest == 2) & reg); cell("road game #2+ on 3+ days rest", D.road & (D.road_run >= 2) & (D.rest >= 3) & reg)

P("\n=== D. RETURNING HOME after a trip ===")
for L in (1, 2, 3):
    cell(f"first home game after a {L}-game road trip", D.returning & (D.p_trip_len == L) & reg, p=(L >= 2), per=(L >= 2))
cell("first home game after a 4+ game road trip", D.returning & (D.p_trip_len >= 4) & reg, p=True, per=True)
cell("first home game after 3+ road games, as favorite", D.returning & (D.p_trip_len >= 3) & (D.spread < 0) & reg); cell("... as dog", D.returning & (D.p_trip_len >= 3) & (D.spread > 0) & reg)
cell("second home game of a home stand (reference)", (D.is_home == 1) & (D.home_run == 2) & reg)

P("\n=== E. THE HOST'S SITUATION (road team's row; o_ = the home team) ===")
cell("road team (any run) vs a host RETURNING from the road", D.road & (D.o_p_road == True) & reg, p=True); cell("road team vs a host on a home stand of 3+", D.road & (D.o_home_run >= 3) & reg, p=True)
cell("road game #3+ vs a host returning from the road", D.road & (D.road_run >= 3) & (D.o_p_road == True) & reg); cell("road game #3+ vs a host on a home stand of 3+", D.road & (D.road_run >= 3) & (D.o_home_run >= 3) & reg)
cell("road team on 1-2 days rest vs host on 4+ days rest", D.road & (D.rest <= 2) & (D.o_rest >= 4) & reg, p=True); cell("road team on 4+ days rest vs host on 1-2", D.road & (D.rest >= 4) & (D.o_rest <= 2) & reg, p=True)

P("\n=== F. DISTANCE: venue state vs home state ===")
cell("road game, in-state", D.road & ~D.out_of_state & D.state.notna() & reg); cell("road game, out-of-state", D.road & D.out_of_state & reg)
cell("road game #2+, out-of-state", D.road & (D.road_run >= 2) & D.out_of_state & reg, p=True); cell("road game #2+, in-state", D.road & (D.road_run >= 2) & ~D.out_of_state & D.state.notna() & reg)
cell("road game #3+, 3+ distinct states this trip", D.road & (D.road_run >= 3) & (D.states_so_far >= 3) & reg, p=True); cell("road game #3+, 1 state the whole trip", D.road & (D.road_run >= 3) & (D.states_so_far == 1) & reg)

P("\n=== G. SPLITS of road game #3+ in a row (where fatigue/travel should bite) ===")
r3 = D.road & (D.road_run >= 3) & reg
cell("road #3+, all", r3, p=True, per=True)
cell("   Nov-Dec", r3 & D.month.isin([11, 12])); cell("   Jan-Feb", r3 & D.month.isin([1, 2])); cell("   March", r3 & (D.month == 3))
cell("   non-conference", r3 & (D.nonconf == 1)); cell("   conference", r3 & (D.conf_game == 1))
cell("   as favorite", r3 & (D.spread < 0)); cell("   as dog 0-7", r3 & D.spread.between(0.5, 7)); cell("   as dog 7.5-14", r3 & D.spread.between(7.5, 14)); cell("   as dog 14.5+", r3 & (D.spread >= 14.5))
cell("   good team (KenPom EM > +10)", r3 & (D.own_kp_em > 10)); cell("   average (EM -5..+10)", r3 & D.own_kp_em.between(-5, 10)); cell("   weak (EM < -5)", r3 & (D.own_kp_em < -5))
cell("   vs a much better host (EM gap >= 10)", r3 & (D.o_kp_em - D.own_kp_em >= 10)); cell("   vs a much worse host (gap <= -10)", r3 & (D.own_kp_em - D.o_kp_em >= 10))
cell("   experienced (Exp >= 2.0)", r3 & (D.own_exp >= 2.0)); cell("   young (Exp < 1.5)", r3 & (D.own_exp < 1.5)); cell("   deep bench (>= 32% minutes)", r3 & (D.own_bench >= 32)); cell("   thin bench (< 27%)", r3 & (D.own_bench < 27))
cell("   previous road game WON", r3 & (D.p_win == 1)); cell("   previous road game LOST", r3 & (D.p_win == 0))
cell("   covered the previous road game", r3 & (D.p_ats > 0)); cell("   failed to cover the previous road game", r3 & (D.p_ats < 0))
cell("   total line < 135", r3 & (D.total_line < 135)); cell("   total 135-145", r3 & D.total_line.between(135, 145)); cell("   total > 145", r3 & (D.total_line > 145))
out.close()
