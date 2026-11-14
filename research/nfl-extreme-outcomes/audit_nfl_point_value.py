#!/usr/bin/env python3
"""Does the Walters probability-mass gate rescue the NFL sides model? (owner, 2026-10-06)

The live 2026 board has only 30 sided picks -- unreadable. The question has to be answered on
the walk-forward history, the same way audit_nfl_model.py answered "is the model real".

Two readings of the method are tested separately, because they are different claims:
  A  SIDE from the classifier (the locked rule), STRENGTH from mass of pred-margin vs close.
     This is "keep our picks, re-rank them".
  B  SIDE and STRENGTH both from pred-margin vs close -- pure Walters, the classifier ignored.
     This is "bet the number, not the probability".

Graded at the CLOSE, which is the stricter test (the locked rule bets the opener).
Out of sample: trains on season < target only, no frozen pickle.
"""
import sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import joblib
sys.path.insert(0, "/Users/chrishabib/Documents/new-wagerproof/research")
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from forecast_harness import build
from point_value import edge_pct, nfl_spread_values

CONF = 0.03
_, _, FEATS = joblib.load("data/sides_models_2026.pkl")
VALS = nfl_spread_values()
print("NFL margin values (%% of outcome mass a one-point move across it is worth, per side):")
print("   " + "  ".join(f"{k}={VALS[k]:.1f}" for k in sorted(VALS, key=lambda x: -VALS[x])[:8]))

m, BASE = build()
m = m.copy(); m["act_margin"] = m.actual_margin.astype(float)

rows = []
for target in range(2021, 2027):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[(m.season == target) & (m.week >= 4)].dropna(subset=["home_cover"])
    if len(tr) < 300 or te.empty:
        continue
    F = [c for c in FEATS if c in m.columns]
    clf = HistGradientBoostingClassifier(learning_rate=0.05, l2_regularization=2.0,
                                         random_state=0).fit(tr[F].astype(float), tr.home_cover.astype(int))
    reg = HistGradientBoostingRegressor(learning_rate=0.05, l2_regularization=2.0,
                                        random_state=0).fit(tr[F].astype(float), tr.act_margin.astype(float))
    p = clf.predict_proba(te[F].astype(float))[:, 1]
    pm = reg.predict(te[F].astype(float))
    act = te.act_margin.astype(float).values
    mkt = te.mkt_margin.astype(float).values        # market's implied home margin
    clo = te.home_spread.astype(float).values       # home-perspective close
    ok = ~np.isnan(mkt) & ~np.isnan(act) & ~np.isnan(clo)
    for i in np.where(ok)[0]:
        cover = act[i] + clo[i]                     # >0 home covers
        if abs(cover) < 1e-9:
            continue
        rows.append(dict(season=target, conf=abs(p[i] - 0.5),
                         side_clf="HOME" if p[i] > 0.5 else "AWAY",
                         side_num="HOME" if pm[i] > mkt[i] else "AWAY",
                         pts=abs(pm[i] - mkt[i]),
                         pct=edge_pct(float(pm[i]), float(mkt[i]), VALS),
                         home_covered=cover > 0))
d = pd.DataFrame(rows)
d["won_clf"] = (d.side_clf == "HOME") == d.home_covered
d["won_num"] = (d.side_num == "HOME") == d.home_covered
# ORACLE: a bettor who knew the result must win every time, or the grader is inverted
orc = (((np.where(d.home_covered, "HOME", "AWAY") == "HOME") == d.home_covered)).mean()
assert orc > 0.999, f"grader inverted, oracle {orc:.3f}"
print(f"\n{len(d)} graded walk-forward games 2021-2026, close-graded. "
      f"classifier and number agree on the side {100*(d.side_clf==d.side_num).mean():.0f}% of the time.\n")


def rec(s, col):
    if not len(s): return f"{'—':>36}"
    w = int(s[col].sum()); l = len(s) - w
    return f"{len(s):>6}{f'{w}-{l}':>11}{w/len(s)*100:>8.1f}%{(w*0.909-l)/len(s)*100:>9.1f}%"


print("=== READING A: our side (classifier, |p-.5|>=.03), gated by probability mass")
print(f"{'gate':<30}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
b = d[d.conf >= CONF]
print(f"{'locked rule, no mass gate':<30}{rec(b,'won_clf')}")
for f_ in (3, 4, 5, 5.5, 6, 7, 8):
    print(f"{f'+ mass >= {f_}%':<30}{rec(b[b.pct >= f_],'won_clf')}")

print("\n=== READING B: pure Walters — side AND size from the number vs the close")
print(f"{'gate':<30}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
print(f"{'every game':<30}{rec(d,'won_num')}")
for f_ in (3, 4, 5, 5.5, 6, 7, 8, 10):
    print(f"{f'mass >= {f_}%':<30}{rec(d[d.pct >= f_],'won_num')}")

print("\n=== by season, the best gate from each reading")
print(f"{'season':<8}{'A: conf+mass>=5':>24}{'B: mass>=5':>24}")
for s in sorted(d.season.unique()):
    a = b[(b.season == s) & (b.pct >= 5)]; n_ = d[(d.season == s) & (d.pct >= 5)]
    def sh(x, c):
        if not len(x): return "       no plays"
        w = int(x[c].sum()); l = len(x) - w
        return f"{w}-{l} ({w/len(x)*100:.0f}%)"
    print(f"{int(s):<8}{sh(a,'won_clf'):>24}{sh(n_,'won_num'):>24}")

print("\n=== the disagreement slice (same points, different mass) — reading B")
mid = d[(d.pts >= 2) & (d.pts < 4)]
for nm, s in (("2-4 pts, mass >=5%", mid[mid.pct >= 5]), ("2-4 pts, mass <4%", mid[mid.pct < 4])):
    print(f"   {nm:<24}{rec(s,'won_num')}")
d.to_csv("out/audit_nfl_point_value.csv", index=False)
print("\n-> out/audit_nfl_point_value.csv")
