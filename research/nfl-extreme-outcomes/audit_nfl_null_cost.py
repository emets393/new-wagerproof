#!/usr/bin/env python3
"""What do the null/dead input features actually COST the NFL sides model? (owner, 2026-10-06)

The owner's hypothesis: the model is consistently wrong because inputs are missing. The audit
found, in the model's own 54-feature list:
  * net_rz_td_rate_s2d   100% NULL on all 2,265 rows -- never had a value, ever
  * h_third_road         0 on all 2,265 rows (a home team cannot be on a road trip; the AWAY
                         twin fires 49 times). Logically dead, not a data gap
  * last5_diff, home_consistency_pr, away_consistency_pr
                         1-2% null in training but 65% NULL on 2026 -- the model learned splits
                         on these and is now served them empty two thirds of the time
  * net_pa_epa_s2d, net_motion_epa_s2d   21% null in training, 0% in 2026 (coverage SHIFT)

Counting nulls does not prove harm: a GBM cannot split on an all-null column, so a dead feature
costs nothing, while a feature that was PRESENT in training and is ABSENT at serve can cost a
lot. This measures each case instead of assuming:

  BASE      all 54 features, as shipped
  NO_DEAD   drop the 2 permanently dead features
  SERVE_SIM the real test -- train with the features present, then NULL last5_diff and both
            consistency_pr columns on 65% of the TEST rows, reproducing 2026 serve conditions
  NO_PR     drop those 3 features from training AND serving (the honest alternative)
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, joblib
from sklearn.ensemble import HistGradientBoostingClassifier
from forecast_harness import build

CONF = 0.03
RNG = np.random.default_rng(0)
DEAD = ["net_rz_td_rate_s2d", "h_third_road"]
PR3 = ["last5_diff", "home_consistency_pr", "away_consistency_pr"]
_, _, F0 = joblib.load("data/sides_models_2026.pkl")
m, _ = build()
F0 = [c for c in F0 if c in m.columns]

def run(label, feats, null_frac=0.0, null_cols=()):
    out = []
    for target in range(2021, 2026):
        tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
        te = m[(m.season == target) & (m.week >= 4)].dropna(subset=["home_cover"]).copy()
        if len(tr) < 300 or te.empty:
            continue
        clf = HistGradientBoostingClassifier(learning_rate=0.05, l2_regularization=2.0,
                                             random_state=0).fit(tr[feats].astype(float),
                                                                 tr.home_cover.astype(int))
        X = te[feats].astype(float).copy()
        if null_frac:
            # reproduce the 2026 serve condition: the column exists but arrives empty
            idx = RNG.random(len(X)) < null_frac
            for c in null_cols:
                if c in X.columns:
                    X.loc[idx, c] = np.nan
        p = clf.predict_proba(X)[:, 1]
        clo = te.home_spread.astype(float).values
        act = te.actual_margin.astype(float).values
        cover = act + clo
        ok = (np.abs(p - 0.5) >= CONF) & np.isfinite(cover) & (np.abs(cover) > 1e-9)
        won = ((cover > 0) == (p > 0.5))[ok]
        out.append((target, int(won.sum()), int((~won).sum())))
    w = sum(x[1] for x in out); l = sum(x[2] for x in out)
    per = "  ".join(f"{t}:{a}-{b}" for t, a, b in out)
    print(f"{label:<28}{w+l:>6}{f'{w}-{l}':>11}{w/(w+l)*100:>8.1f}%"
          f"{(w*0.909-l)/(w+l)*100:>+9.1f}%   {per}")
    return w / (w + l)

print(f"\n{'variant':<28}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}   per-season")
b = run("BASE (as shipped)", F0)
run("NO_DEAD (drop the 2)", [c for c in F0 if c not in DEAD])
s = run("SERVE_SIM (65% pr null)", F0, 0.65, PR3)
n = run("NO_PR (drop the 3)", [c for c in F0 if c not in PR3])
print(f"\ncost of the 2026 null condition vs training-quality inputs: "
      f"{(s-b)*100:+.1f} points of hit rate")
print(f"dropping those 3 features cleanly instead of serving them null: {(n-s)*100:+.1f} points")
