#!/usr/bin/env python3
"""Seed stability. Two of the three phase findings rest on a SINGLE method family.

After the cell-matched control, this is where the phase work stands:

  EARLY     mlp only. delta_cell +5.68 / +10.72 / +23.54 across cuts, naive share 56-57%
            so it is not blind-home in disguise, and 56/55/55 by season at top50%. But
            ridge and enet -- the other two scaled linear-ish learners -- are NEGATIVE in
            the same window, which is exactly what a one-family fluke looks like.
  LATE      mostly the favourite rule. et's fade is 84-93% favourites, so its +5.87 is the
            naive rule wearing a hat. lgbm and hgb keep a real but modest residual
            (+2.8 to +4.7) at 59-68% naive share. The linear family's fade is negative.
  PLAYOFFS  rf only, +12.85 delta_cell at top50% and 63/48/63/59 by season. n=163. et and
            blend agree, boosters and linear mostly do not.

A finding that lives in one family and one random seed is noise with a good story. So:
refit ONLY the two families the findings depend on, across many seeds, on the same folds,
and look at the DISTRIBUTION of the result rather than the one draw I happened to take.

The question is not "is seed 0 good" -- I already know it is, that is why we are here. It
is whether the median seed is good and how much of the seed distribution sits below
breakeven. A finding whose 25th percentile is under 52.4% is not bettable no matter what
its mean is.

Everything else -- fold structure, feature selection, the post-open ban -- is held fixed,
so the only thing varying is the random draw.
"""
import os
import re
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import lightgbm as lgb

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
TOPK = 220
MIN_TRAIN = 1200
SEEDS = list(range(12))
BAN_PAT = re.compile(r"^(t24_|t4_|t60_|mkt_|y_|h1_|tt_)")
BAN_EXACT = {"game.id", "event_id", "bdl_id", "date", "season", "phase"}


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def run_seed(D, cols, seed, which):
    """One full walk-forward for one family at one seed. Returns predicted margin."""
    mo = D["date"].dt.to_period("M")
    p = pd.Series(np.nan, index=D.index)
    for blk in sorted(mo.unique()):
        te = D.index[mo == blk]
        tr = D.index[mo < blk]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        Xtr_all = np.nan_to_num(D.loc[tr, cols].to_numpy(dtype=np.float32))
        ytr = D.loc[tr, "y_fg_margin"].to_numpy(dtype=float)
        sel = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=31,
                                min_child_samples=40, colsample_bytree=0.5,
                                random_state=0, verbose=-1, n_jobs=4)
        sel.fit(Xtr_all, ytr)
        keep = np.argsort(sel.feature_importances_)[::-1][:TOPK]
        m = (make_pipeline(StandardScaler(),
                           MLPRegressor(hidden_layer_sizes=(96, 32), alpha=1.0,
                                        max_iter=400, early_stopping=True,
                                        random_state=seed))
             if which == "mlp" else
             RandomForestRegressor(n_estimators=300, min_samples_leaf=15,
                                   max_features=0.3, random_state=seed, n_jobs=4))
        m.fit(Xtr_all[:, keep], ytr)
        p.loc[te] = m.predict(
            np.nan_to_num(D.loc[te, cols].to_numpy(dtype=np.float32))[:, keep])
    return p


def grade(d, pred, pct, fade=False):
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    e = (pred + sp).to_numpy(dtype=float)
    take_home = (e < 0) if fade else (e > 0)
    win = np.where(take_home, y > -sp, y < -sp).astype(float)
    dec = np.where(take_home, american_to_dec(d["open_spread_home_price"]),
                   american_to_dec(d["open_spread_away_price"]))
    ok = (y != -sp) & np.isfinite(e) & np.isfinite(dec)
    if ok.sum() < 100:
        return None
    a = np.abs(e)
    m = ok & (a >= np.nanquantile(a[ok], 1 - pct / 100)) if pct < 100 else ok
    if m.sum() < 50:
        return None
    return m.sum(), 100 * win[m].mean(), roi(win[m], dec[m])


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    D["date"] = pd.to_datetime(D["date"])
    D["season"] = D["season"].astype(str)
    dup = set(D.loc[D.duplicated("game.id", keep=False), "game.id"])
    D = D[~D["game.id"].isin(dup)]
    D = D.dropna(subset=["y_fg_margin", "open_spread_home_point"]).sort_values(
        "date").reset_index(drop=True)
    gp = np.minimum(D["h_gp"], D["a_gp"]).to_numpy(dtype=float)
    post = D["game.postseason"].to_numpy(dtype=float) > 0
    D["phase"] = np.where(post, "playoffs",
                          np.where(gp < 15, "early", np.where(gp < 50, "mid", "late")))
    cols = [c for c in D.columns
            if not BAN_PAT.match(c) and c not in BAN_EXACT and D[c].dtype.kind in "fiub"]
    assert not [c for c in cols if BAN_PAT.match(c)]
    print(f"{len(D):,} games, {len(cols)} features, {len(SEEDS)} seeds", flush=True)

    jobs = [("early", "mlp", False), ("playoffs", "rf", False)]
    res = {k: {} for k in jobs}
    for which in ("mlp", "rf"):
        for seed in SEEDS:
            p = run_seed(D, cols, seed, which)
            print(f"  {which} seed {seed} done", flush=True)
            for ph, w, fade in jobs:
                if w != which:
                    continue
                d = D[D["phase"] == ph].reset_index(drop=True)
                pp = p[D["phase"] == ph].reset_index(drop=True)
                for pct in (50, 25):
                    g = grade(d, pp, pct, fade)
                    if g:
                        res[(ph, w, fade)].setdefault(pct, []).append(g)

    L = ["# NBA spread by phase — seed stability", "",
         "The early-season result rests entirely on the MLP and the playoff result "
         "entirely on the random forest. Both are seeded. This refits each across "
         f"{len(SEEDS)} seeds on identical folds and reports the DISTRIBUTION, because a "
         "finding that only exists at seed 0 is a story, not an edge.", "",
         "Breakeven at -110 is 52.4%. The column that matters is `p25 ROI` — if a quarter "
         "of the seed draws are under water, the finding is not bettable regardless of "
         "its mean.", "",
         "| phase | family | cut | seeds | n | median win% | mean ROI | p25 ROI | min ROI | max ROI | % seeds > breakeven |",
         "|---|---|---|---|---|---|---|---|---|---|---|"]
    for key, byc in res.items():
        ph, w, fade = key
        for pct, rows in sorted(byc.items()):
            n = int(np.median([r[0] for r in rows]))
            wins = np.array([r[1] for r in rows])
            rois = np.array([r[2] for r in rows])
            L.append(f"| {ph} | {w} | top{pct}% | {len(rows)} | {n:,} | "
                     f"{np.median(wins):.2f} | {rois.mean():+.2f} | "
                     f"{np.percentile(rois, 25):+.2f} | {rois.min():+.2f} | "
                     f"{rois.max():+.2f} | {100*(wins > 52.4).mean():.0f}% |")

    path = os.path.join(ROOT, "NBA_SPREAD_SEED_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
