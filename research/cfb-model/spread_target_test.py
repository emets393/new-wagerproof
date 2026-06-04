"""
Compare SPREAD model architectures / targets:
 (A) regression on actual_margin, fundamentals-only (CURRENT)
 (B) binary classification on home_cover (predict P(cover) directly)
 (C) market-anchored: include spread as feature, regress margin -> edge = deviation from line
 (D) market-anchored binary: spread as feature, classify cover
All walk-forward, grade ATS vs open, 2021-2025. Report away-edge + overall confident-pick ATS.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
gm["home_cover"] = ((gm.actual_margin + gm.spread_open) > 0).astype(int)

def walk(make_pred, feats):
    P = []
    for S in [2022, 2023, 2024, 2025]:  # need spread_open in train (2021+) for cover/anchored variants
        tr = gm[(gm.season < S) & (gm.season >= 2021) & gm.actual_margin.notna() & gm.spread_open.notna()].copy()
        te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
        te = make_pred(tr, te, feats); P.append(te)
    A = pd.concat(P); A = A[(A.actual_margin + A.spread_open) != 0].copy()
    A["aw"] = (A.actual_margin + A.spread_open) < 0; A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
    return A

def reg_margin(tr, te, feats):
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_margin)
    te["pred"] = m.predict(te[feats]); te["edge"] = te.pred + te.spread_open
    te["conf"] = te.edge  # signed confidence toward home
    return te

def clf_cover(tr, te, feats):
    m = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.home_cover)
    p = m.predict_proba(te[feats])[:, 1]
    te["pcover"] = p; te["conf"] = p - 0.5  # >0 lean home cover
    return te

def report(name, A, conf_is_prob=False):
    # bet model side: conf>0 -> home, conf<0 -> away. thresholds for "confident"
    print(f"  {name}")
    for thr_label, thr in ([("|edge|>=4", 4), ("|edge|>=7", 7)] if not conf_is_prob else [("p>=.57/<=.43", 0.07), ("p>=.60/<=.40", 0.10)]):
        b = A[A.conf.abs() >= thr]
        win = np.where(b.conf > 0, ~b.aw, b.aw)  # conf>0 bet home -> win if home covers (~aw)
        n = len(b); h = int(win.sum())
        # away-edge specifically
        ba = A[A.conf <= -thr]; awin = ba.aw
        print(f"    {thr_label:<16} all: n={n} {100*h/n if n else 0:.1f}% | away-lean: n={len(ba)} {100*awin.mean() if len(ba) else 0:.1f}% | P5 away: ", end="")
        bp = A[(A.conf <= -thr) & A.p5]; print(f"n={len(bp)} {100*bp.aw.mean() if len(bp) else 0:.1f}%")

print("(A) regression on margin, FUNDAMENTALS-ONLY (current):")
report("", walk(reg_margin, FEATS))
print("(B) binary classification on COVER, fundamentals-only:")
report("", walk(clf_cover, FEATS), conf_is_prob=True)
print("(C) MARKET-ANCHORED regression (spread as feature):")
report("", walk(reg_margin, FEATS + ["spread_open"]))
print("(D) MARKET-ANCHORED binary cover (spread as feature):")
report("", walk(clf_cover, FEATS + ["spread_open"]), conf_is_prob=True)
