#!/usr/bin/env python3
"""Validate (or kill) the one surviving model: 1H SPREAD in signal space.

The signal-space classifier is the only model in this entire program that produced a
monotone confidence ladder with every season on the right side:
    top100% 51.3 | top50% 51.8 | top25% 53.4 (+1.9, 56/52/52) | top10% 54.3 (+3.7)

53.4% is one point over breakeven. At that size the honest question is not "is it
positive" but "is it distinguishable from the best cell you'd expect to find by chance
after inspecting this many cells". By now I have graded well over a thousand
market x framing x model x threshold cells, so a 1.5-sigma result means nothing on its
own. Five tests, in order of how likely each is to kill it:

  A  LABEL-SHUFFLE NULL. Shuffle the outcome within season and rerun the identical
     walk-forward. Whatever top25%/top10% win% the pipeline achieves on noise IS the
     null. This is the only test that prices in the multiple comparisons, because the
     shuffled pipeline gets exactly the same freedom to overfit that the real one had.
  B  DIRECTION BIAS. If the model bets one side 80% of the time and that side happens
     to run hot in a 3-season sample, the "ladder" is a base-rate artifact. Compare
     against always-home and always-away in the same rows.
  C  S8 OVERLAP. S8 already bets the 1H spread at 64.6% here. If the model is just
     rediscovering S8 it is not a new edge, it is a worse-priced version of one we have.
  D  DROP-ONE-SEASON and an absolute-confidence ladder.
  E  FEATURE IMPORTANCE — does it lean on things with a mechanism, or on noise?
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingClassifier
import lightgbm as lgb
import xgboost as xgb

from nba_signal_space_model import signal_space

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
SEEDS = (0, 7, 13, 21, 33)
NULL_REPS = 12


def clfs(seed):
    return {
        "lgbm": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=8,
                                   min_child_samples=25, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.7, reg_lambda=2.0, random_state=seed,
                                   verbose=-1, n_jobs=-1),
        "xgb": xgb.XGBClassifier(n_estimators=300, learning_rate=0.03, max_depth=3,
                                 min_child_weight=15, subsample=0.8, colsample_bytree=0.7,
                                 reg_lambda=2.0, random_state=seed, n_jobs=-1,
                                 tree_method="hist", eval_metric="logloss"),
        "hgb": HistGradientBoostingClassifier(max_iter=250, learning_rate=0.03,
                                              max_leaf_nodes=8, min_samples_leaf=25,
                                              l2_regularization=2.0, random_state=seed),
    }


def walk(S, G, y01, seeds):
    """Rolling-origin refit every 14 days; returns the mean predicted P(home cover)."""
    P = pd.DataFrame(index=G.index)
    blocks = G.groupby(pd.Grouper(key="date", freq="14D")).size()
    starts = [d for d in blocks.index if (G["date"] < d).sum() >= 600]
    for i, d0 in enumerate(starts):
        d1 = (starts[i + 1] if i + 1 < len(starts) else G["date"].max() + pd.Timedelta(days=1))
        tri = G.index[(G["date"] < d0) & y01.notna()]
        tei = G.index[(G["date"] >= d0) & (G["date"] < d1)]
        if len(tei) == 0 or len(tri) < 600:
            continue
        for seed in seeds:
            for mn, m in clfs(seed).items():
                m.fit(S.loc[tri], y01.loc[tri])
                P.loc[tei, f"{mn}|{seed}"] = m.predict_proba(S.loc[tei])[:, 1]
    return P.mean(axis=1)


def cut_stats(prob, y01, po, pu, pct, mask=None):
    conf = (prob - 0.5).abs()
    ok = prob.notna() & y01.notna()
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 20:
        return 0, np.nan, np.nan
    thr = conf[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (conf >= thr)
    side = prob[m] > 0.5
    win = np.where(side, y01[m], 1 - y01[m])
    dec = np.where(side, po[m], pu[m])
    return int(m.sum()), 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    G = D[D[["h1_spread", "h1_sp_h", "h1_sp_a", "t60_spread_home_point",
             "t60_total_point", "h1_total_line"]].notna().all(axis=1)].copy()
    G["date"] = pd.to_datetime(G["date"])
    G = G.sort_values("date").reset_index(drop=True)
    S = signal_space(G).astype(float)
    rs = G["y_h1_marg_resid"]
    y = pd.Series(np.where(rs > 0, 1.0, np.where(rs < 0, 0.0, np.nan)), index=G.index)
    po, pu = G["h1_sp_h"], G["h1_sp_a"]
    seasons = sorted(G["season"].unique())

    L = ["# NBA 1H spread, signal space — validation", "",
         f"{len(G):,} games, seasons {seasons}, {S.shape[1]} signal features. "
         f"Rolling-origin every 14D, {len(SEEDS)} seeds x 3 classifiers. BE 52.4%.", ""]
    print(L[2], flush=True)

    print("real run...", flush=True)
    prob = walk(S, G, y, SEEDS)

    L += ["## Observed\n", "| cut | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    obs = {}
    for pct in (100, 50, 25, 10, 5):
        n, w, r = cut_stats(prob, y, po, pu, pct)
        obs[pct] = w
        per = []
        for s in seasons:
            ns, ws, _ = cut_stats(prob, y, po, pu, pct, mask=(G["season"] == s))
            per.append(f"{ws:.0f}" if ns >= 25 else "-")
        L.append(f"| top{pct}% | {n} | {w:.1f} | {r:+.1f} | {'/'.join(per)} |")

    # ---------------------------------------------------------------- A null
    print(f"label-shuffle null x{NULL_REPS}...", flush=True)
    null = {p: [] for p in (100, 50, 25, 10, 5)}
    for rep in range(NULL_REPS):
        rng = np.random.RandomState(1000 + rep)
        ysh = y.copy()
        for s in seasons:                       # shuffle WITHIN season: keep base rates
            idx = G.index[(G["season"] == s) & y.notna()]
            ysh.loc[idx] = y.loc[idx].values[rng.permutation(len(idx))]
        p = walk(S, G, ysh, (0,))               # 1 seed per rep, 12 reps
        for pct in null:
            _, w, _ = cut_stats(p, ysh, po, pu, pct)
            null[pct].append(w)
        print(f"  rep {rep}: top25%={null[25][-1]:.1f} top10%={null[10][-1]:.1f}", flush=True)

    L += ["\n## A — label-shuffle null (the multiple-comparisons check)\n",
          f"{NULL_REPS} reps, outcome permuted within season, identical pipeline.", "",
          "| cut | observed | null mean | null sd | null max | z |", "|---|---|---|---|---|---|"]
    for pct in (100, 50, 25, 10, 5):
        a = np.array(null[pct], dtype=float)
        mu, sd = np.nanmean(a), np.nanstd(a, ddof=1)
        z = (obs[pct] - mu) / sd if sd > 0 else np.nan
        L.append(f"| top{pct}% | {obs[pct]:.1f} | {mu:.1f} | {sd:.1f} | {np.nanmax(a):.1f} | "
                 f"{z:+.2f} |")

    # ---------------------------------------------------------------- B bias
    L += ["\n## B — direction bias vs naive baselines\n",
          "| bet | n | win% | ROI |", "|---|---|---|---|"]
    ok = prob.notna() & y.notna()
    for nm, side in (("model, top25%", None), ("always HOME", True), ("always AWAY", False)):
        if side is None:
            conf = (prob - 0.5).abs()
            m = ok & (conf >= conf[ok].quantile(0.75))
            sd = prob[m] > 0.5
        else:
            m = ok
            sd = pd.Series(side, index=G.index)[m]
        win = np.where(sd, y[m], 1 - y[m])
        dec = np.where(sd, po[m], pu[m])
        L.append(f"| {nm} | {int(m.sum())} | {100*win.mean():.1f} | "
                 f"{100*(win*(dec-1)-(1-win)).mean():+.1f} |")
    conf = (prob - 0.5).abs()
    m25 = ok & (conf >= conf[ok].quantile(0.75))
    L.append(f"| (model picks HOME on {100*(prob[m25]>0.5).mean():.0f}% of its top25%) | | | |")

    # ---------------------------------------------------------------- C S8
    hf, af = G["h_abs_fresh_max_ppg"], G["a_abs_fresh_max_ppg"]
    close = G["t60_spread_home_point"].abs() < 8
    gp25 = (G["h_gp"] >= 25) & (G["a_gp"] >= 25)
    s8 = ((((hf >= 18) & (hf < 25) & (af < 18)) | ((af >= 18) & (af < 25) & (hf < 18)))
          & close & gp25)
    L += ["\n## C — is it just S8 rediscovered?\n",
          "| population | cut | n | win% | ROI |", "|---|---|---|---|---|"]
    for nm, mk in (("S8 games only", s8), ("NON-S8 games", ~s8)):
        for pct in (100, 25, 10):
            n, w, r = cut_stats(prob, y, po, pu, pct, mask=mk)
            L.append(f"| {nm} | top{pct}% | {n} | {w:.1f} | {r:+.1f} |")

    # ---------------------------------------------------------------- D robustness
    L += ["\n## D — drop-one-season (top25%)\n", "| dropped | n | win% | ROI |",
          "|---|---|---|---|"]
    for s in seasons:
        n, w, r = cut_stats(prob, y, po, pu, 25, mask=(G["season"] != s))
        L.append(f"| {s} | {n} | {w:.1f} | {r:+.1f} |")

    L += ["\n## E — absolute confidence ladder\n", "| P(home) dist from .5 >= | n | win% | ROI |",
          "|---|---|---|---|"]
    for t in (0.00, 0.02, 0.04, 0.06, 0.08):
        m = ok & (conf >= t)
        if m.sum() < 20:
            continue
        sd = prob[m] > 0.5
        win = np.where(sd, y[m], 1 - y[m])
        dec = np.where(sd, po[m], pu[m])
        L.append(f"| {t:.2f} | {int(m.sum())} | {100*win.mean():.1f} | "
                 f"{100*(win*(dec-1)-(1-win)).mean():+.1f} |")

    # ---------------------------------------------------------------- F importance
    tr = G.index[y.notna()]
    imp = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=8,
                             min_child_samples=25, subsample=0.8, subsample_freq=1,
                             colsample_bytree=0.7, reg_lambda=2.0, random_state=0,
                             verbose=-1, n_jobs=-1).fit(S.loc[tr], y.loc[tr])
    top = pd.Series(imp.feature_importances_, index=S.columns).sort_values(ascending=False)
    L += ["\n## F — top features (full-sample fit, descriptive only)\n",
          "| feature | gain-split importance |", "|---|---|"]
    for k, v in top.head(15).items():
        L.append(f"| {k} | {v:.0f} |")

    path = os.path.join(ROOT, "NBA_H1_SPREAD_VALIDATE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
