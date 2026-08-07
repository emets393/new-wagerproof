#!/usr/bin/env python3
"""Why did the 1H-total model die between the fast pass and the pressure test?

Fast pass (nba_model_fast.py): season-level walk-forward, ALL ~980 features, 1 seed
  -> share/hgb top10% = 58.6% (+11.8), anchored/mean top10% = 58.0% (+10.8)
Pressure test (nba_h1_total_model.py): rolling-origin refits, top-250 correlation
  prefilter, 3 seeds
  -> nothing above 52% anywhere, drop-one-season all negative

Three things changed at once, so neither result is interpretable yet. This isolates
them as a 2x2 (train scheme x feature set), same framing, same grading, same seeds:

  scheme   season  = train on all prior SEASONS, test the next  (fast-pass scheme)
           rolling = refit every 14 days on everything prior     (pressure-test scheme)
  feats    all     = every leak-safe feature (~980)
           top250  = train-fold |corr| prefilter

The prefilter is the confound I care about: ranking features by MARGINAL correlation
throws away exactly the conditional structure a booster exists to find, and on a target
as noisy as the 1H share the ranking itself is unstable block to block. If "rolling+all"
looks like the fast pass, the prefilter killed it. If "season+all" is the only cell that
works, the fast-pass number was a lucky split, not a model.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingRegressor
import lightgbm as lgb
import xgboost as xgb

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MKT_PREFIX = ("open_", "t24_", "t4_", "t60_", "mkt_", "h1_", "tt_")
SEEDS = (0, 7)


def is_mkt(c):
    return c.startswith(MKT_PREFIX) and not c.startswith(("h_", "a_", "d_", "sum_"))


def boosters(seed):
    return {
        "hgb": HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04,
                                             max_leaf_nodes=15, min_samples_leaf=40,
                                             l2_regularization=1.0, random_state=seed),
        "lgbm": lgb.LGBMRegressor(n_estimators=400, learning_rate=0.03, num_leaves=15,
                                  min_child_samples=40, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.5, reg_lambda=5.0, random_state=seed,
                                  verbose=-1, n_jobs=-1),
        "xgb": xgb.XGBRegressor(n_estimators=400, learning_rate=0.03, max_depth=4,
                                min_child_weight=20, subsample=0.8, colsample_bytree=0.5,
                                reg_lambda=5.0, random_state=seed, n_jobs=-1,
                                tree_method="hist"),
    }


def usable(tr, cols):
    return [c for c in cols
            if tr[c].notna().mean() >= 0.60 and tr[c].nunique(dropna=True) > 1]


def fit_block(tr, te, ycol, cols, feats, ED, tag):
    ytr = tr[ycol]
    ok = ytr.notna()
    tr2, ytr = tr[ok.values], ytr[ok]
    use = usable(tr2, cols)
    if feats == "top250":
        cc = tr2[use].corrwith(ytr).abs().replace([np.inf, -np.inf], np.nan).dropna()
        use = list(cc.sort_values(ascending=False).head(250).index)
    if len(use) < 20:
        return
    for seed in SEEDS:
        for mn, m in boosters(seed).items():
            try:
                m.fit(tr2[use], ytr)
                ED.loc[te.index, f"{tag}|{mn}|{seed}"] = m.predict(te[use])
            except Exception as e:                          # noqa: BLE001
                print(f"  !! {tag}/{mn}/{seed}: {type(e).__name__} {e}", flush=True)


def grade(G, edge, mask):
    m = mask & edge.notna() & G["_y01"].notna()
    n = int(m.sum())
    if n == 0:
        return 0, np.nan, np.nan
    over = edge[m] > 0
    win = np.where(over, G.loc[m, "_y01"], 1 - G.loc[m, "_y01"])
    dec = np.where(over, G.loc[m, "h1_ov"], G.loc[m, "h1_un"])
    return n, 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    G = D[D[["h1_total_line", "h1_ov", "h1_un", "t60_total_point",
             "y_h1_total", "y_fg_total"]].notna().all(axis=1)].copy()
    G["date"] = pd.to_datetime(G["date"])
    G = G.sort_values("date").reset_index(drop=True)
    G["_resid"] = G["y_h1_total"] - G["h1_total_line"]
    G["_y01"] = np.where(G["_resid"] > 0, 1.0, np.where(G["_resid"] < 0, 0.0, np.nan))
    G["y_share"] = G["y_h1_total"] / G["y_fg_total"].replace(0, np.nan)

    allf = [c for c in G.columns
            if c not in ("game.id", "event_id", "date", "season", "_resid", "_y01", "y_share")
            and not c.startswith("y_") and G[c].dtype.kind in "fiub"]
    f_share = [c for c in allf if not is_mkt(c)] + ["t60_total_point"]

    ED = pd.DataFrame(index=G.index)
    seasons = sorted(G["season"].unique())

    for feats in ("all", "top250"):
        # --- season-level (the fast-pass scheme)
        for ts in seasons[1:]:
            tr, te = G[G["season"] < ts], G[G["season"] == ts]
            if len(tr) < 500 or len(te) < 150:
                continue
            fit_block(tr, te, "y_share", f_share, feats, ED, f"season_{feats}_share")
            fit_block(tr, te, "_resid", allf, feats, ED, f"season_{feats}_anch")
        print(f"season/{feats} done", flush=True)

        # --- rolling-origin (the pressure-test scheme)
        blocks = G.groupby(pd.Grouper(key="date", freq="14D")).size()
        starts = [d for d in blocks.index if (G["date"] < d).sum() >= 700]
        for i, d0 in enumerate(starts):
            d1 = (starts[i + 1] if i + 1 < len(starts)
                  else G["date"].max() + pd.Timedelta(days=1))
            tr = G[G["date"] < d0]
            te = G[(G["date"] >= d0) & (G["date"] < d1)]
            if len(te) == 0:
                continue
            fit_block(tr, te, "y_share", f_share, feats, ED, f"rolling_{feats}_share")
            fit_block(tr, te, "_resid", allf, feats, ED, f"rolling_{feats}_anch")
        print(f"rolling/{feats} done", flush=True)

    L = ["# NBA 1H total — why the model died: scheme x feature-set diagnostic", "",
         f"{len(G):,} lined games. 2 seeds x 3 boosters per cell, edges averaged within "
         "a cell. Graded at the T-60 1H line and real price. BE 52.4%.", "",
         "| cell | cut | n | win% | ROI | per-season |", "|---|---|---|---|---|---|"]
    for scheme in ("season", "rolling"):
        for feats in ("all", "top250"):
            for fram in ("share", "anch"):
                tag = f"{scheme}_{feats}_{fram}"
                cols = [c for c in ED.columns if c.startswith(tag + "|")]
                if not cols:
                    continue
                e = ED[cols].mean(axis=1)
                have = e.notna()
                for pct in (100, 25, 10):
                    thr = e[have].abs().quantile(1 - pct / 100) if pct < 100 else -1
                    m = have & (e.abs() >= thr)
                    n, w, r = grade(G, e, m)
                    per = []
                    for s in seasons:
                        ns, ws, _ = grade(G, e, m & (G["season"] == s))
                        per.append(f"{ws:.0f}" if ns >= 25 else "-")
                    L.append(f"| {tag} | top{pct}% | {n} | {w:.1f} | {r:+.1f} | "
                             f"{'/'.join(per)} |")

    path = os.path.join(ROOT, "NBA_H1_DIAG_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
