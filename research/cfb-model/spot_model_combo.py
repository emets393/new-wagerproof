"""
Investigate the UNDER asymmetry + high-total effect, and combine with the model.
All graded vs the OPENING total, walk-forward, 2021-2025.
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
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]

def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# walk-forward predictions
parts = []
for S in TS:
    tr = gm[(gm["season"] < S) & gm["actual_total"].notna()]
    te = gm[(gm["season"] == S) & gm["total_open"].notna() & gm["actual_total"].notna()].copy()
    mdl = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                        l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_total"])
    te["pred"] = mdl.predict(te[FEATS])
    parts.append(te)
A = pd.concat(parts)
A["edge"] = A["pred"] - A["total_open"]
A = A[A["actual_total"] != A["total_open"]]
A["over_won"] = A["actual_total"] > A["total_open"]

print("=" * 70)
print("1) MODEL DIRECTIONAL ASYMMETRY (does UNDER outperform OVER?)")
print("=" * 70)
print(f"{'thr':>4} | {'OVER bets hit%/roi':>22} | {'UNDER bets hit%/roi':>22}")
for thr in [3, 5, 7, 10]:
    o = A[A["edge"] >= thr]; u = A[A["edge"] <= -thr]
    oh = int(o["over_won"].sum()); uh = int((~u["over_won"]).sum())
    print(f"{thr:>4} | {len(o):>4} {100*oh/len(o):>5.1f}% {roi(oh,len(o)):>+6.1f}% | "
          f"{len(u):>4} {100*uh/len(u):>5.1f}% {roi(uh,len(u)):>+6.1f}%")

print("\n" + "=" * 70)
print("2) HIGH-TOTAL -> UNDER dose-response (standalone, bet UNDER vs open)")
print("=" * 70)
print(f"{'open total >=':>14}{'n':>7}{'under hit%':>12}{'roi%':>8}  per-season under%")
for cut in [55, 60, 62, 65, 68, 70]:
    b = A[A["total_open"] >= cut]
    uh = int((~b["over_won"]).sum()); n = len(b)
    per = "/".join(f"{100*(~b['over_won'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"{cut:>14}{n:>7}{100*uh/n if n else 0:>12.1f}{roi(uh,n):>8.1f}  [{per}]")

print("\n" + "=" * 70)
print("3) MODEL + HIGH-TOTAL ALIGN (model says UNDER AND open total high)")
print("=" * 70)
print(f"{'cond':>34}{'n':>6}{'hit%':>7}{'roi%':>8}  per-season")
combos = {
    "model UNDER edge>=5": A[A["edge"] <= -5],
    "model UNDER edge>=5 & total>=60": A[(A["edge"] <= -5) & (A["total_open"] >= 60)],
    "model UNDER edge>=3 & total>=62": A[(A["edge"] <= -3) & (A["total_open"] >= 62)],
    "model UNDER edge>=7 & total>=58": A[(A["edge"] <= -7) & (A["total_open"] >= 58)],
}
for name, b in combos.items():
    uh = int((~b["over_won"]).sum()); n = len(b)
    per = "/".join(f"{100*(~b['over_won'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"{name:>34}{n:>6}{100*uh/n if n else 0:>7.1f}{roi(uh,n):>8.1f}  [{per}]")
