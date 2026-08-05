#!/usr/bin/env python3
"""Would a neural network be better? Test it instead of asserting it.

THE QUESTION IS REASONABLE AND THE USUAL ANSWER IS LAZY. "Deep learning needs more data" is
true but useless on its own, so this measures the thing directly: same games, same folds, same
target, same features, swap only the estimator.

WHAT WE ALREADY KNOW, WHICH SHOULD SET THE PRIOR. On this exact feature set a gradient-boosted
tree scores oos corr +0.031 against ridge's +0.067. Flexibility is being PUNISHED here, and a
plain MLP is flexibility of the same kind. The reason is in the univariate scan: no single
column clears the noise floor (best |corr| 0.058, which is the 95th percentile of a shuffled
null), but ~32 clear 0.04 where noise gives one. The signal is thirty small pushes, and the
optimal way to combine thirty small independent pushes IS a weighted sum. A network's whole
advantage is representing things a weighted sum cannot, and it pays for that advantage in
variance on ~3,000 training rows.

SO THE INTERESTING QUESTION IS NOT "MLP OR RIDGE". It is: is there STRUCTURE here that a sum
genuinely cannot express, and if so can we hand it over without paying for full flexibility?
There is one, and it is exact rather than hoped-for:

    A TOTAL IS SYMMETRIC. Swap which team is called "home" and the total does not change. The
    model does not know this. It has separate free parameters for `h_l5_adv_usg_max` and
    `a_l5_adv_usg_max` and has to learn from data that they act the same way, spending sample
    on something we know for certain a priori.

That is testable WITHOUT a network: augment every training row with its home/away-swapped twin
(h_X <-> a_X, d_X -> -d_X, sum_X and game-level unchanged, label unchanged). The estimator is
then forced to be symmetric. If the augmentation helps ridge, the lesson is "the prior was the
missing thing, not the capacity" -- and that is a lesson you get for free, without torch, and
it applies to a network too. If a network only wins WITH the same prior, then the prior did the
work.

FOUR ARMS, one change each, identical folds:
    ridge                 the round-2/3 model, the thing to beat
    ridge + symmetry      same estimator, one exact prior added by augmentation
    mlp                   sklearn MLPRegressor, 3 sizes x 2 seeds, early stopping
    mlp + symmetry        the network with the same prior

Plus a LEARNING CURVE, which is the part that actually answers "would it be better with more
data": both estimators at min_train 800 / 1500 / 2500. If the MLP's curve is climbing steeply
where ridge's has flattened, a network is worth revisiting when we have more seasons. If both
are flat, capacity is not the binding constraint and no amount of architecture fixes it.

torch/tensorflow/jax are not installed on this machine. That is not the reason for using
sklearn: at ~3,000 rows and ~400 columns an MLP is the same object either way, and if this
test said a network were competitive, installing torch would be the obvious next step.
"""
import importlib.util
import os
import time
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.linear_model import Ridge
from sklearn.neural_network import MLPRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

K = 2.0
ALPHAS = (30.0, 100.0, 300.0, 1000.0)
HIDDEN = [(32,), (64, 32), (16,)]
SEEDS = (0, 1)


def swap_plan(cols):
    """Map each column to (partner_index, sign) under a home/away swap.

    h_foo <-> a_foo, d_foo -> -d_foo, everything else (sum_, st_, the line) is invariant.
    Columns whose h_/a_ partner is missing from the feature set are left alone rather than
    silently dropped -- an asymmetric leftover is a small impurity, a silent drop is a
    different feature set and would make the arms non-comparable.
    """
    ix = {c: i for i, c in enumerate(cols)}
    part, sign = list(range(len(cols))), [1.0] * len(cols)
    unpaired = 0
    for i, c in enumerate(cols):
        if c.startswith("h_"):
            p = "a_" + c[2:]
            if p in ix:
                part[i] = ix[p]
            else:
                unpaired += 1
        elif c.startswith("a_"):
            p = "h_" + c[2:]
            if p in ix:
                part[i] = ix[p]
            else:
                unpaired += 1
        elif c.startswith("d_"):
            sign[i] = -1.0
    return np.array(part), np.array(sign), unpaired


def augment(A, y, part, sign):
    """Training set plus its mirror image. Doubles rows, adds no new information --
    it REMOVES the model's freedom to treat home and away asymmetrically."""
    M = A.values[:, part] * sign
    return np.vstack([A.values, M]), np.concatenate([y, y])


def walk(X, dates, y, kind, min_train=1500, sym=False, part=None, sign=None):
    """Rolling-origin refit. Scaler is refit per window; augmentation happens AFTER scaling so
    the mirrored rows sit on the same scale as the real ones."""
    P = pd.Series(index=X.index, dtype=float)
    idx = pd.DatetimeIndex(dates)
    starts = sorted({d for d in pd.date_range(idx.min(), idx.max(), freq=f"{v2.REFIT_DAYS}D")
                     if (idx < d).sum() >= min_train})
    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = X.index[(idx < d0) & y.notna()]
        te = X.index[(idx >= d0) & (idx < d1)]
        if len(te) == 0 or len(tr) < min_train:
            continue
        A, B = X.loc[tr], X.loc[te]
        mu, sd = A.mean(), A.std().replace(0, 1.0)
        A = ((A - mu) / sd).fillna(0.0)
        B = ((B - mu) / sd).fillna(0.0)
        ytr = y.loc[tr].values
        if sym:
            Av, ytr = augment(A, ytr, part, sign)
        else:
            Av = A.values
        if kind == "ridge":
            pr = np.mean([Ridge(alpha=a).fit(Av, ytr).predict(B.values) for a in ALPHAS], axis=0)
        else:
            ps = []
            for h in HIDDEN:
                for s in SEEDS:
                    m = MLPRegressor(hidden_layer_sizes=h, alpha=1.0, learning_rate_init=1e-3,
                                     max_iter=400, early_stopping=True, n_iter_no_change=15,
                                     validation_fraction=0.15, random_state=s)
                    ps.append(m.fit(Av, ytr).predict(B.values))
            # average the ensemble: a single MLP seed on 3,000 rows is mostly initialisation
            # noise, and reporting the best seed would be a search we would owe the null
            pr = np.mean(ps, axis=0)
        P.loc[te] = pr
    return P


def main():
    D = v2.build()
    cols = v2.feature_cols(D)
    cols = [c for c in cols if c not in v2.leak_screen(D, cols)]
    print(f"[features] {len(cols)} columns", flush=True)

    part, sign, unpaired = swap_plan(cols)
    print(f"[symmetry] {(part != np.arange(len(cols))).sum()} columns swap, "
          f"{(sign < 0).sum()} negate, {unpaired} unpaired leftovers", flush=True)

    X = D[cols].astype(float)
    yc = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(yc > 0, 1.0, np.where(yc < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    L = ["# Would a neural network be better for the NBA total?", "",
         "Same games, same folds, same target, same features — only the estimator changes. "
         "`edge` is win% minus the best blind side inside the same rows; breakeven at −110 is "
         "52.4%. `oos corr` is the correlation between the predicted residual and the actual "
         "one, out of sample, and it is the cleanest single number here.", ""]

    arms = [("ridge", "ridge", False), ("ridge + symmetry", "ridge", True),
            ("mlp", "mlp", False), ("mlp + symmetry", "mlp", True)]
    res = {}
    L += ["## The bake-off", "",
          "| estimator | oos corr | n @ k≥2 | win% | base% | edge | ROI | fit time |",
          "|---|---|---|---|---|---|---|---|"]
    for tag, kind, sym in arms:
        t0 = time.time()
        p = walk(X, D["date"], yc, kind, sym=sym, part=part, sign=sign)
        dt = time.time() - t0
        m = p.notna() & yc.notna()
        r = np.corrcoef(p[m], yc[m])[0, 1]
        g = v2.grade(p, yb, po, pu, K)
        res[tag] = (p, r, g)
        e = g["win"] - g["base"] if g["n"] else np.nan
        L.append(f"| {tag} | `{r:+.4f}` | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{e:+.1f}** | {g['roi']:+.1f} | {dt:.0f}s |")
        print(L[-1], flush=True)

    # ---- learning curve: the part that answers "better with MORE data?" --------------------
    print("\n=== learning curve ===", flush=True)
    L += ["", "## Learning curve — is capacity the binding constraint?", "",
          "The real question behind \"would a network be better\" is whether we are estimator-"
          "limited or data-limited. If the MLP is climbing steeply where ridge has flattened, "
          "a network is worth revisiting once we have more seasons. If both are flat, capacity "
          "is not what is holding this back and no architecture fixes it.", "",
          "| min_train | ridge corr | mlp corr | ridge edge | mlp edge |",
          "|---|---|---|---|---|"]
    for mt in (800, 1500, 2500):
        row = []
        for kind in ("ridge", "mlp"):
            p = walk(X, D["date"], yc, kind, min_train=mt)
            m = p.notna() & yc.notna()
            r = np.corrcoef(p[m], yc[m])[0, 1]
            g = v2.grade(p, yb, po, pu, K)
            row.append((r, g["win"] - g["base"] if g["n"] else np.nan))
        L.append(f"| {mt} | `{row[0][0]:+.4f}` | `{row[1][0]:+.4f}` | {row[0][1]:+.1f} | "
                 f"{row[1][1]:+.1f} |")
        print(L[-1], flush=True)

    # ---- agreement: are they finding the same thing? ---------------------------------------
    pr_, pm_ = res["ridge"][0], res["mlp"][0]
    m = pr_.notna() & pm_.notna()
    agree = np.corrcoef(pr_[m], pm_[m])[0, 1]
    L += ["", f"Ridge and MLP predictions correlate `{agree:+.3f}` with each other. A high "
              "number means the network is reconstructing the same linear combination the "
              "hard way, which is the expected outcome when the true signal is a sum of weak "
              "terms; a low number with worse accuracy means it is fitting noise.", ""]
    print(f"[agreement] corr(ridge pred, mlp pred) = {agree:+.3f}", flush=True)

    path = os.path.join(ROOT, "NBA_NN_BAKEOFF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
