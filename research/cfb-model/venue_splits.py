"""
HOME/AWAY performance splits + game-to-game REGRESSION, as model features. A/B on betting edge.
- venue split: each team's season-to-date margin-over-expectation at HOME vs AWAY (opp-adjusted via
  subtracting opponent pooled net_rating). Use home team's home-split + away team's away-split.
- regression: last-game offensive output vs season avg (overperformance -> regress?), and the
  bounce setup (bad last game + favorable next matchup).
Test if adding these improves the sides betting edge (the only thing that matters).
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# opponent pooled net rating lookup (as-of) to opponent-adjust margins
rat = pd.read_parquet(os.path.join(HERE, "data", "team_ratings_asof.parquet"))
rat["nr"] = rat.adj_epa - rat.adj_epa_allowed
nrlk = rat.set_index(["season", "asof_week", "team"])["nr"]

# team-game margins + venue
rows = []
for _, r in gm[gm.actual_margin.notna()].iterrows():
    rows.append({"season": r.season, "week": r.week, "team": r.homeTeam, "opp": r.awayTeam, "venue": "home", "margin": r.actual_margin, "pts": r.homePoints})
    rows.append({"season": r.season, "week": r.week, "team": r.awayTeam, "opp": r.homeTeam, "venue": "away", "margin": -r.actual_margin, "pts": r.awayPoints})
tg = pd.DataFrame(rows)
tg["opp_nr"] = [nrlk.get((s, w - 1, o), np.nan) for s, w, o in zip(tg.season, tg.week, tg.opp)]
tg["adj_margin"] = tg.margin + tg.opp_nr.fillna(0) * 0  # margin; opp adj via simple control below
tg = tg.sort_values(["team", "season", "week"])
# venue-split: cumulative prior margin at this venue (leak-safe)
gv = tg.groupby(["team", "season", "venue"], group_keys=False)
tg["venue_margin"] = gv["margin"].transform(lambda s: s.shift().expanding().mean())
# regression: last-game points vs season-to-date avg points
g = tg.groupby(["team", "season"], group_keys=False)
tg["s2d_pts"] = g["pts"].transform(lambda s: s.shift().expanding().mean())
tg["last_pts"] = g["pts"].shift()
tg["overperf"] = tg.last_pts - tg.s2d_pts   # last game pts above/below season avg

h = tg[tg.venue == "home"][["season", "week", "team", "venue_margin", "overperf"]].rename(columns={"team": "homeTeam", "venue_margin": "h_vm", "overperf": "h_over"})
a = tg[tg.venue == "away"][["season", "week", "team", "venue_margin", "overperf"]].rename(columns={"team": "awayTeam", "venue_margin": "a_vm", "overperf": "a_over"})
gm2 = gm.merge(h, on=["season", "week", "homeTeam"], how="left").merge(a, on=["season", "week", "awayTeam"], how="left")

NEW = ["h_vm", "a_vm", "h_over", "a_over"]
gm2["venue_gap"] = gm2.h_vm - gm2.a_vm
NEW.append("venue_gap")
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm2.select_dtypes(include=[np.number, "Int64", "boolean"]); BASE = [c for c in num.columns if c not in EXCLUDE and c not in NEW]
gm2[BASE + NEW] = gm2[BASE + NEW].apply(pd.to_numeric, errors="coerce")

def run(feats, label):
    P = []
    for S in TS:
        tr = gm2[(gm2.season < S) & gm2.actual_margin.notna()]; te = gm2[(gm2.season == S) & gm2.spread_open.notna() & gm2.actual_margin.notna()].copy()
        te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_margin).predict(te[feats]); P.append(te)
    A = pd.concat(P); A["me"] = A.pred + A.spread_open; A = A[(A.actual_margin + A.spread_open) != 0]
    A["aw"] = (A.actual_margin + A.spread_open) < 0; A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
    mae = (A.pred - A.actual_margin).abs().mean()
    b = A[(A.me <= -4) & A.p5]
    print(f"{label:<22} MAE={mae:.3f} | P5 away e<=-4: {len(b)} {100*b.aw.mean():.1f}%")

print("SIDES A/B (does venue-split + regression help betting?):")
run(BASE, "base"); run(BASE + NEW, "+ venue/regression")

# direct spot tests
print("\nDIRECT SPOTS (vs open):")
def ats(name, mask, side):
    b = gm2[mask.fillna(False) & gm2.spread_open.notna() & gm2.actual_margin.notna()].copy()
    b["hc"] = (b.actual_margin + b.spread_open) > 0; n = len(b)
    if n < 30: print(f"  {name:<48} n={n} thin"); return
    hit = b.hc if side == "home" else ~b.hc; h = int(hit.sum())
    print(f"  {name:<48} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}")
# big home/away venue gap (team much better at home) -> bet them at home
ats("home big home-team (h_vm>=14) -> bet home", gm2.h_vm >= 14, "home")
ats("away big road-team (a_vm>=7) -> bet away", gm2.a_vm >= 7, "away")
# regression: home overperformed huge last game (>=14 over avg) -> fade (regress)
ats("home overperf last (h_over>=14) -> fade(away)", gm2.h_over >= 14, "away")
ats("away overperf last (a_over>=14) -> fade(home)", gm2.a_over >= 14, "home")
# bounce: home underperformed last (h_over<=-14) -> back home
ats("home underperf last (h_over<=-14) -> back home", gm2.h_over <= -14, "home")
