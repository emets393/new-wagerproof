"""
Does garbage-time-excluded EPA improve the model? A/B base vs +GT-excluded features.
Also: direct predictiveness — GT-excluded net EPA vs our GT-included adj net rating, corr with margin.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
gt = pd.read_parquet(os.path.join(HERE, "data", "gt_excluded_asof.parquet"))
gt["asof"] = gt["asof_week"]
GTC = [c for c in gt.columns if c.startswith("gt_")]
for side in ["homeTeam", "awayTeam"]:
    m = gt[["season", "asof", "team"] + GTC].rename(columns={"team": side, **{c: f"{side[:4]}_{c}" for c in GTC}})
    gm["asof"] = gm["week"] - 1
    gm = gm.merge(m, left_on=["season", "asof", side], right_on=["season", "asof", side], how="left")
NEW = [c for c in gm.columns if c.startswith(("home_gt_", "away_gt_"))]
# GT-excluded net rating for direct test
gm["gt_net_diff"] = (pd.to_numeric(gm.get("home_gt_off_ppa"), errors="coerce") - pd.to_numeric(gm.get("home_gt_def_ppa"), errors="coerce")) - \
                    (pd.to_numeric(gm.get("away_gt_off_ppa"), errors="coerce") - pd.to_numeric(gm.get("away_gt_def_ppa"), errors="coerce"))

TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open", "asof", "gt_net_diff"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); BASE = [c for c in num.columns if c not in EXCLUDE and c not in NEW]
gm[BASE + NEW] = gm[BASE + NEW].apply(pd.to_numeric, errors="coerce")

# direct predictiveness
d = gm[(gm.season >= 2021) & gm.actual_margin.notna() & gm.gt_net_diff.notna() & gm.net_rating_diff.notna()]
print("corr with actual margin: GT-excluded net %.3f | our GT-included adj net %.3f | market -spread %.3f" % (
    np.corrcoef(d.gt_net_diff, d.actual_margin)[0, 1], np.corrcoef(d.net_rating_diff, d.actual_margin)[0, 1],
    np.corrcoef(-d.spread_open, d.actual_margin)[0, 1]))

def run(feats, target, label):
    P = []
    for S in TS:
        col = "total_open" if target == "actual_total" else "spread_open"
        tr = gm[(gm.season < S) & gm[target].notna()]; te = gm[(gm.season == S) & gm[col].notna() & gm[target].notna()].copy()
        te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr[target]).predict(te[feats]); P.append(te)
    A = pd.concat(P)
    if target == "actual_margin":
        A["me"] = A.pred + A.spread_open; A = A[(A.actual_margin + A.spread_open) != 0]; A["aw"] = (A.actual_margin + A.spread_open) < 0; A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
        b = A[(A.me <= -4) & A.p5]; bg = A[(A.me <= -4)]
        print(f"  {label:<16} MAE={(A.pred-A.actual_margin).abs().mean():.3f} | P5 away e<=-4: {len(b)} {100*b.aw.mean():.1f}% | all away e<=-4: {len(bg)} {100*bg.aw.mean():.1f}%")
    else:
        A["edge"] = A.pred - A.total_open; A = A[A.actual_total != A.total_open]; u = A[A.edge <= -3]
        print(f"  {label:<16} MAE={(A.pred-A.actual_total).abs().mean():.3f} | under e<=-3: {len(u)} {100*(u.actual_total<u.total_open).mean():.1f}%")

print("\nSIDES A/B:"); run(BASE, "actual_margin", "base"); run(BASE + NEW, "actual_margin", "+ GT-excluded")
print("TOTALS A/B:"); run(BASE, "actual_total", "base"); run(BASE + NEW, "actual_total", "+ GT-excluded")
