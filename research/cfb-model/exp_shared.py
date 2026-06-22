"""
Shared experiment harness for the CFB improvement sweep (mirrors NFL b88-b91 program).
- Identical walk-forward folds for every variant (train season < S, test S; TS=2021-25).
- Product-style grading: pick at the model's confidence gate vs the line we POST at (OPEN — our locked CFB
  convention: model spots bet & grade vs open). CLV vs close reported.
- Wilson CIs; per-season + pooled; holdout (2025) highlighted by caller.
Locked baseline = HistGradientBoostingRegressor(max_iter=300, lr=.05, depth=4, l2=1.0) on FEATS (EXCLUDE set),
sides target = actual_margin, totals target = actual_total. DO NOT change baseline here.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

TS = [2021, 2022, 2023, 2024, 2025]
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
GATE_SIDES, GATE_TOT = 4.0, 3.0


def load():
    gm = pd.read_parquet("data/model_games.parquet")
    num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
    feats = [c for c in num.columns if c not in EXCLUDE]
    gm[feats] = gm[feats].apply(pd.to_numeric, errors="coerce")
    return gm, feats


def gbm(seed=0):
    return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                         l2_regularization=1.0, random_state=seed)


def walk(gm, feats, target, model_fn=gbm):
    """Walk-forward predictions; returns test frame w/ 'pred'. Same folds for every variant."""
    parts = []
    for S in TS:
        tr = gm[(gm.season < S) & gm[target].notna()]
        te = gm[gm.season == S].copy()
        m = model_fn().fit(tr[feats], tr[target])
        te["pred"] = m.predict(te[feats])
        parts.append(te)
    return pd.concat(parts)


def wilson(w, n, z=1.96):
    if n == 0: return (0, 0)
    p = w / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (100 * (c - h), 100 * (c + h))


def grade_sides(A, gate=GATE_SIDES, label=""):
    """Product-style: edge = pred + spread_open; pick home if >0; grade vs OPEN; CLV open->close."""
    A = A[A.spread_open.notna() & A.actual_margin.notna()].copy()
    A["edge"] = A.pred + A.spread_open
    A = A[(A.actual_margin + A.spread_open) != 0]
    b = A[A.edge.abs() >= gate].copy()
    hc = (b.actual_margin + b.spread_open) > 0
    b["win"] = np.where(b.edge > 0, hc, ~hc)
    b["clv"] = np.where(b.edge > 0, b.spread_open - b.spread_close, b.spread_close - b.spread_open)
    return report(b, label)


def grade_totals(A, gate=GATE_TOT, label=""):
    A = A[A.total_open.notna() & A.actual_total.notna()].copy()
    A["edge"] = A.pred - A.total_open
    A = A[A.actual_total != A.total_open]
    b = A[A.edge.abs() >= gate].copy()
    over = A.loc[b.index, "actual_total"] > b.total_open
    b["win"] = np.where(b.edge > 0, over, ~over)
    b["clv"] = np.where(b.edge > 0, b.total_close - b.total_open, b.total_open - b.total_close)
    return report(b, label)


def report(b, label):
    n = len(b); w = int(b.win.sum()); lo, hi = wilson(w, n)
    per = "/".join(f"{100*b.win[b.season==s].mean():.0f}" if (b.season == s).sum() >= 10 else "--" for s in TS)
    clv = b.clv.mean(); roi = (w * 0.909 - (n - w)) / n * 100 if n else 0
    print(f"  {label:<26} n={n:<5} hit {100*w/n if n else 0:5.1f}% CI[{lo:.1f},{hi:.1f}] roi{roi:+5.1f} CLV{clv:+.2f} [{per}]")
    return {"n": n, "hit": 100 * w / n if n else 0, "clv": clv, "per": per, "frame": b}
