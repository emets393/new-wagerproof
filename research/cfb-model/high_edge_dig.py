"""
Dig into high-edge (|edge|>=8) P5 games: show examples, and find what separates the model's
CORRECT calls from its WRONG ones (a potential filter to sharpen the premium tier).
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
P = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin).predict(te[FEATS])
    P.append(te)
A = pd.concat(P)
A["edge"] = A.pred + A.spread_open
A = A[(A.actual_margin + A.spread_open) != 0].copy()
A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
A["mkt_margin"] = -A.spread_open
A["won"] = np.where(A.edge < 0, (A.actual_margin + A.spread_open) < 0, (A.actual_margin + A.spread_open) > 0)
A["bucket"] = pd.cut(A.edge.abs(), [8, 10, 14, 99], labels=["8-10", "10-14", "14+"])

hi = A[(A.edge.abs() >= 8) & A.p5].copy()
print(f"high-edge P5 games: {len(hi)} | won {100*hi.won.mean():.1f}%")
print("\n=== EXAMPLE GAMES (8-14 edge) ===")
ex = hi[hi.edge.abs() < 14].sort_values("edge")
show = ex[["season", "week", "awayTeam", "homeTeam", "mkt_margin", "pred", "edge", "actual_margin", "won"]].copy()
show.columns = ["szn", "wk", "away", "home", "vegas_hm", "model_hm", "edge", "actual_hm", "won"]
print(show.head(10).to_string(index=False))
print("...")
print(show.tail(10).to_string(index=False))

print("\n=== WHAT SEPARATES CORRECT vs WRONG high-edge calls? (feature means) ===")
w = hi[hi.won]; l = hi[~hi.won]
diffs = []
for c in FEATS:
    wv, lv = pd.to_numeric(w[c], errors="coerce"), pd.to_numeric(l[c], errors="coerce")
    if wv.notna().sum() < 30 or lv.notna().sum() < 30:
        continue
    pooled = pd.to_numeric(hi[c], errors="coerce").std()
    if pooled and pooled > 0:
        diffs.append((c, wv.mean() - lv.mean(), (wv.mean() - lv.mean()) / pooled))
diffs.sort(key=lambda x: -abs(x[2]))
print(f"{'feature':<34}{'won_mean-lost_mean':>20}{'std_diff':>10}")
for c, d, sd in diffs[:15]:
    print(f"{c:<34}{d:>20.3f}{sd:>10.2f}")
