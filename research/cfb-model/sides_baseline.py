"""
CFB SIDES (spread) baseline — walk-forward, graded vs the OPENING spread (bet at open).
Predict actual_margin (home perspective); spread_open<0 = home favored.
edge = pred_margin + spread_open ; edge>0 -> bet HOME, edge<0 -> bet AWAY.
home covers iff (actual_margin + spread_open) > 0. Grade vs open. Eval 2021-2025.
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

parts = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                      l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_margin"])
    te["pred"] = m.predict(te[FEATS])
    parts.append(te)
A = pd.concat(parts)
A["edge"] = A["pred"] + A["spread_open"]           # >0 -> home value
A["home_cover"] = (A["actual_margin"] + A["spread_open"]) > 0
A = A[A["actual_margin"] + A["spread_open"] != 0]   # drop pushes
A["bet_home"] = A["edge"] > 0
A["win"] = np.where(A["bet_home"], A["home_cover"], ~A["home_cover"])

mae_m = (A["pred"] - A["actual_margin"]).abs().mean()
mae_k = (-A["spread_open"] - A["actual_margin"]).abs().mean()
print("=" * 74)
print("CFB SIDES BASELINE — walk-forward, bet at OPEN spread, grade vs open")
print("=" * 74)
print(f"model margin MAE {mae_m:.2f} vs market(spread) MAE {mae_k:.2f}\n")
print(f"{'thr':>4}{'bets':>7}{'hit%':>7}{'roi%':>8}   per-season hit%")
for thr in [0, 1, 2, 3, 4, 6, 8]:
    b = A[A["edge"].abs() >= thr]
    n = len(b); h = int(b["win"].sum())
    per = "/".join(f"{100*b['win'][b.season==s].mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"{thr:>4}{n:>7}{100*h/n if n else 0:>7.1f}{roi(h,n):>8.1f}   [{per}]")

# home/away + favorite/dog asymmetry at a moderate threshold
b = A[A["edge"].abs() >= 3]
print("\nAt edge>=3, splits:")
for name, mask in [("bet HOME", b["bet_home"]), ("bet AWAY", ~b["bet_home"]),
                   ("home favored", b["spread_open"] < 0), ("away favored", b["spread_open"] > 0)]:
    s = b[mask]; n = len(s); h = int(s["win"].sum())
    print(f"  {name:<14} n={n:<4} hit={100*h/n if n else 0:4.1f}% roi={roi(h,n):+.1f}")
