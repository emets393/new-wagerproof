"""
A3: ARCHITECTURE SHOOTOUT on identical folds — locked GBM vs multi-seed ensemble vs ridge (impute+scale)
vs soft blend. Judge ONLY product-style hit% + CLV (NFL: HistGBM stood; AUC gains didn't survive grading).
A4: CALIBRATION AUDIT — for a regression product the analog is edge-bucket -> realized hit. If big edges
don't hit more (non-monotonic / flat), confidence CANNOT gate big plays (NFL pathology: 72%->49%).
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
import exp_shared as E

gm, FEATS = E.load()

print("=" * 78); print("A3: ARCHITECTURE SHOOTOUT (sides, product-style @ open)")
A_gbm = E.walk(gm, FEATS, "actual_margin")
E.grade_sides(A_gbm, label="GBM (locked)")

# multi-seed ensemble (5 seeds)
parts = []
for S in E.TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]; te = gm[gm.season == S].copy()
    preds = np.mean([E.gbm(sd).fit(tr[FEATS], tr.actual_margin).predict(te[FEATS]) for sd in range(5)], axis=0)
    te["pred"] = preds; parts.append(te)
A_ens = pd.concat(parts); E.grade_sides(A_ens, label="5-seed ensemble")

# ridge
def ridge_fn():
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=10.0))
A_rg = E.walk(gm, FEATS, "actual_margin", model_fn=ridge_fn)
E.grade_sides(A_rg, label="ridge (impute+scale)")

# soft blend (avg of GBM + ridge preds)
A_bl = A_gbm.copy(); A_bl["pred"] = 0.5 * A_gbm.pred.values + 0.5 * A_rg.pred.values
E.grade_sides(A_bl, label="GBM+ridge blend")

print("\n" + "=" * 78); print("A4: CALIBRATION AUDIT — edge bucket -> realized hit (sides, vs open)")
A = A_gbm[A_gbm.spread_open.notna() & A_gbm.actual_margin.notna()].copy()
A["edge"] = A.pred + A.spread_open; A = A[(A.actual_margin + A.spread_open) != 0]
hc = (A.actual_margin + A.spread_open) > 0
A["win"] = np.where(A.edge > 0, hc, ~hc)
print(f"{'|edge|':>8}{'n':>6}{'hit%':>7}{'CI':>16}")
for lo, hi in [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 14), (14, 99)]:
    b = A[(A.edge.abs() >= lo) & (A.edge.abs() < hi)]
    if len(b) < 30: continue
    w = int(b.win.sum()); l, h = E.wilson(w, len(b))
    print(f"{f'{lo}-{hi}':>8}{len(b):>6}{100*w/len(b):>7.1f}  [{l:.1f},{h:.1f}]")
print("\nTOTALS calibration (edge=pred-total_open):")
T = E.walk(gm, FEATS, "actual_total")
T = T[T.total_open.notna() & T.actual_total.notna()].copy()
T["edge"] = T.pred - T.total_open; T = T[T.actual_total != T.total_open]
ov = T.actual_total > T.total_open
T["win"] = np.where(T.edge > 0, ov, ~ov)
for lo, hi in [(0, 2), (2, 4), (4, 6), (6, 9), (9, 99)]:
    b = T[(T.edge.abs() >= lo) & (T.edge.abs() < hi)]
    if len(b) < 30: continue
    w = int(b.win.sum()); l, h = E.wilson(w, len(b))
    print(f"{f'{lo}-{hi}':>8}{len(b):>6}{100*w/len(b):>7.1f}  [{l:.1f},{h:.1f}]")
