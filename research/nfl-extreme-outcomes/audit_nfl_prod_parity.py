#!/usr/bin/env python3
"""Does my audit's model match the one that actually ships? (owner, 2026-10-06)

The feature frames cannot diverge -- nfl_slate_games_build.py line 364 imports the SAME
forecast_harness.build(). But `train_predict` differs from what my audit used in two ways I
did not notice, and both change the number I reported:

  1. HYPERPARAMETERS. Production: max_depth=3, max_iter=300, min_samples_leaf=40. My audit used
     library defaults (max_depth=None, max_iter=100, min_samples_leaf=20) -- a deeper, less
     leaf-regularised model trained for a third as many iterations. My 52.7% was NOT its number.
  2. TRAIN/PREDICT WINDOW ASYMMETRY. Training filters `week >= 4`; prediction does NOT
     (`te = m[m.season==target]`). So the shipped model predicts weeks 1-3 having never been
     trained on a single early-season game. Measured separately below.

Everything is graded at the CLOSE, walk-forward, out of sample.
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, joblib
from sklearn.ensemble import HistGradientBoostingClassifier
from forecast_harness import build

CONF = 0.03
PROD = dict(max_depth=3, learning_rate=0.05, max_iter=300,
            l2_regularization=2.0, min_samples_leaf=40, random_state=0)
MINE = dict(learning_rate=0.05, l2_regularization=2.0, random_state=0)
_, _, F = joblib.load("data/sides_models_2026.pkl")
m, _ = build(); F = [c for c in F if c in m.columns]


def run(label, kw, train_wk=4, test_wk=None):
    tot = []
    for target in range(2021, 2026):
        tr = m[(m.season < target) & (m.week >= train_wk)].dropna(subset=["home_cover"])
        te = m[m.season == target].dropna(subset=["home_cover"])
        if test_wk is not None:
            te = te[te.week >= test_wk]
        if len(tr) < 300 or te.empty:
            continue
        clf = HistGradientBoostingClassifier(**kw).fit(tr[F].astype(float), tr.home_cover.astype(int))
        p = clf.predict_proba(te[F].astype(float))[:, 1]
        cover = te.actual_margin.astype(float).values + te.home_spread.astype(float).values
        ok = (np.abs(p - 0.5) >= CONF) & np.isfinite(cover) & (np.abs(cover) > 1e-9)
        won = ((cover > 0) == (p > 0.5))[ok]
        tot.append((target, int(won.sum()), int((~won).sum())))
    w = sum(x[1] for x in tot); l = sum(x[2] for x in tot)
    per = " ".join(f"{t}:{a}-{b}" for t, a, b in tot)
    print(f"{label:<40}{w+l:>6}{f'{w}-{l}':>11}{w/(w+l)*100:>8.1f}%"
          f"{(w*0.909-l)/(w+l)*100:>+9.1f}%  {per}")
    return w / (w + l)


print(f"\n{'configuration':<40}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}  per season")
a = run("MY AUDIT (defaults, test wk>=4)", MINE, 4, 4)
b = run("PRODUCTION params (test wk>=4)", PROD, 4, 4)
print()
c = run("PRODUCTION, predicting ALL weeks", PROD, 4, None)
d = run("PRODUCTION, weeks 1-3 ONLY", PROD, 4, None)
print(f"\nhyperparameters alone move the record by {(b-a)*100:+.1f} points of hit rate")

# weeks 1-3 in isolation: the slice trained on nothing like it
tot = []
for target in range(2021, 2026):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[(m.season == target) & (m.week < 4)].dropna(subset=["home_cover"])
    if len(tr) < 300 or te.empty: continue
    clf = HistGradientBoostingClassifier(**PROD).fit(tr[F].astype(float), tr.home_cover.astype(int))
    p = clf.predict_proba(te[F].astype(float))[:, 1]
    cover = te.actual_margin.astype(float).values + te.home_spread.astype(float).values
    ok = (np.abs(p - 0.5) >= CONF) & np.isfinite(cover) & (np.abs(cover) > 1e-9)
    won = ((cover > 0) == (p > 0.5))[ok]
    tot.append((target, int(won.sum()), int((~won).sum())))
w = sum(x[1] for x in tot); l = sum(x[2] for x in tot)
print(f"\n{'WEEKS 1-3 ONLY (never trained on)':<40}{w+l:>6}{f'{w}-{l}':>11}{w/(w+l)*100:>8.1f}%"
      f"{(w*0.909-l)/(w+l)*100:>+9.1f}%  " + " ".join(f"{t}:{x}-{y}" for t,x,y in tot))
