"""
Validate the OVER lead: LOW opening total + FAST pace -> OVER.
Dose-response on total/pace cutoffs, vs open AND close, per-season, + model agreement.
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
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# walk-forward model preds (for the agreement test)
P = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_total.notna()]
    te = gm[(gm.season == S) & gm.total_open.notna() & gm.actual_total.notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
        l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_total).predict(te[FEATS])
    P.append(te)
A = pd.concat(P); A["edge"] = A["pred"] - A["total_open"]
A = A[A.actual_total != A.total_open].copy()
A["over_won"] = A.actual_total > A.total_open
ep = pd.to_numeric(A["expected_plays"], errors="coerce")
ep75, ep66, ep85 = ep.quantile(0.75), ep.quantile(0.66), ep.quantile(0.85)

def show(name, m):
    m = m.fillna(False)
    b = A[m]; n = len(b); h = int(b["over_won"].sum())
    bc = b[b.actual_total != b.total_close]; hc = int((bc.actual_total > bc.total_close).sum()); nc = len(bc)
    per = "/".join(f"{100*b['over_won'][b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
    print(f"  {name:<42} n={n:<4} OVER {100*h/n if n else 0:4.1f}% {roi(h,n):+6.1f}%  vsClose {100*hc/nc if nc else 0:4.1f}%  [{per}]")

print("DOSE-RESPONSE: total cutoff x pace, bet OVER vs open")
for tot in [42, 45, 48, 51]:
    for pq, pname in [(ep66, "p66"), (ep75, "p75")]:
        show(f"open<={tot} & pace>={pname}", (A.total_open <= tot) & (ep >= pq))
    print()

print("MODEL AGREEMENT (model also leans over):")
show("open<=48 & pace>=p75 (all)", (A.total_open <= 48) & (ep >= ep75))
show("open<=48 & pace>=p75 & edge>=0", (A.total_open <= 48) & (ep >= ep75) & (A.edge >= 0))
show("open<=48 & pace>=p75 & edge>=2", (A.total_open <= 48) & (ep >= ep75) & (A.edge >= 2))
show("open<=50 & pace>=p66 & edge>=2", (A.total_open <= 50) & (ep >= ep66) & (A.edge >= 2))
