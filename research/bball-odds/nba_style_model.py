#!/usr/bin/env python3
"""Ridge on the STYLE frame -- the model route, not the rule route.

WHY THIS FILE EXISTS. Three search designs over this data have now returned nothing:
308,860 marginal cells (nba_hunt_validate.py, held-out excess ROI -0.017%, p=1.0000),
7,675,200 pairwise interaction cells (nba_hunt_pairs.py, held-out excess -0.037%, z=-5.41),
and 76 pre-registered mechanism rules (nba_hunt_style.py, best z=2.21 against an expected
max-of-76 under the null of 2.41 -- i.e. below noise). Cutting features into rules does not
work at 5,000 games, because a 100-game cell has an ROI standard deviation near 10 points.

But the ONE thing that has produced a real edge in this project did not cut anything: the
full-game total ridge (nba_total_v2/v3) reached corr +0.0726 and +3.1% ROI by summing 383
weak features. Its diagnosis was explicit -- the signal is DIFFUSE. Best single |corr| is
0.058, which is noise, yet 32 columns clear 0.04 where the null gives about one. A tree
scored +0.031 on the identical features; a ridge scored +0.067. The estimator was the
binding constraint, not the data.

The FG spread has never been given that treatment on this feature set. nba_spread_v2/v3 ran
on trailing RESULTS -- margin, cover, ATS margin, streaks, standings. It had no pace, no
3PA rate, no opponent 3P% allowed, no rebounding, no turnover rate, no usage concentration,
and no matchup pair terms, because nba_hunt_frame.parquet did not contain them. This file
runs the same diffuse-ridge design over nba_hunt_frame2.parquet's 483 style columns, for
BOTH the spread and the total, and it segments by season phase because a 20-game team and a
60-game team are not the same estimation problem.

WHAT IS BEING PREDICTED. Not the score. The RESIDUAL against the T-60 closing line:
    spread target = ats_margin = home margin + home spread point   (>0 means home covered)
    total target  = ou_margin  = game total - closing total        (>0 means the over hit)
So a prediction of +3.0 reads "I think the home team beats the closing spread by 3 points",
in points, not percentiles. The bet rule is |predicted residual| >= K POINTS.

WALK-FORWARD, not cross-validation. Games are sorted by date and the model at game i is fit
only on games strictly before i, refit every REFIT games. Nothing about the future -- not a
scaler mean, not a feature median, not an alpha -- touches a prediction.

NULL. Within-season label shuffle, refit end to end, so the null carries the same walk-forward
structure and the same feature count. A ridge on 500 columns and 4,000 rows will find
something in pure noise; the question is only whether it finds MORE than that.

Run:  python3 nba_style_model.py --perms 40
"""
import argparse
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

_spec = importlib.util.spec_from_file_location("sweep", os.path.join(ROOT, "nba_hunt_sweep.py"))
sweep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sweep)

# Anything derived from the game itself, plus the prices we grade against. The spread and
# total POINTS stay in -- they are known pregame and the model needs to know what number it
# is arguing with -- but every price and every outcome column is banned.
BAN_EXACT = {
    "margin", "gm_total", "h1_margin", "h1_total", "ats_margin", "ou_margin",
    "home_cover", "over", "home_win", "h1_ats_margin", "h1_ou_margin",
    "h1_home_cover", "h1_over", "tt_home_over", "tt_away_over", "is_ot",
    "home_score", "away_score", "min_gp", "postseason", "season",
}
BAN_PREFIX = ("t60_", "t4_", "t24_", "open_", "c_h1_", "c_tt_", "late_")
KEEP_ANYWAY = {"t60_spread_home_point", "t60_total_point"}

# The feature blocks. b/r/m are the new style columns from nba_hunt_build2; h/a/d/st are the
# trailing-result and standings columns the earlier spread models already had. Running both
# separately answers "did the new data add anything" rather than assuming it did.
BLOCKS = {
    "style": ("hb_", "ab_", "db_", "hr_", "ar_", "dr_", "m_"),
    "result": ("h_", "a_", "d_", "st_", "h2h_", "rt_", "pair_", "gbr_"),
}


def numeric_features(d, prefixes):
    out = []
    for c in d.columns:
        if c in KEEP_ANYWAY:
            out.append(c)
            continue
        if c in BAN_EXACT or c.startswith(BAN_PREFIX):
            continue
        if not c.startswith(prefixes):
            continue
        if not pd.api.types.is_numeric_dtype(d[c]):
            continue
        out.append(c)
    return out


def walk_forward(X, y, order, min_train, refit, alpha):
    """Expanding-window ridge. Returns predictions aligned to the ORIGINAL row order.

    Impute + standardise inside the training window only. Using a global median would leak
    the future through the fill value, which is a small leak that quietly inflates corr.
    """
    n = len(order)
    pred = np.full(n, np.nan)
    model = None
    med = sd = mu = None
    for start in range(min_train, n, refit):
        tr = order[:start]
        te = order[start:start + refit]
        Xtr, ytr = X[tr], y[tr]
        keep = np.isfinite(ytr)
        if keep.sum() < 200:
            continue
        Xtr, ytr = Xtr[keep], ytr[keep]
        med = np.nanmedian(Xtr, axis=0)
        med = np.where(np.isfinite(med), med, 0.0)
        Xf = np.where(np.isfinite(Xtr), Xtr, med)
        mu, sd = Xf.mean(0), Xf.std(0)
        sd = np.where(sd > 1e-9, sd, 1.0)
        model = Ridge(alpha=alpha, fit_intercept=True)
        model.fit((Xf - mu) / sd, ytr)
        Xte = np.where(np.isfinite(X[te]), X[te], med)
        pred[te] = model.predict((Xte - mu) / sd)
    return pred


def grade(mask, side_home, mkt_home, mkt_away):
    """Bet home when the model says home, away when it says away; one row, one bet."""
    yh, ph = mkt_home
    ya, pa = mkt_away
    y = np.where(side_home, yh, ya)
    p = np.where(side_home, ph, pa)
    ok = mask & np.isfinite(y) & np.isfinite(p)
    n = int(ok.sum())
    if n < 25:
        return None
    win = y[ok]
    roi = float((win * (p[ok] - 1) - (1 - win)).mean() * 100)
    return n, float(win.mean() * 100), roi


def base_rate(mask, side_home, mkt_home, mkt_away):
    """The comparator has to be the SAME bets' baseline: what a coin flip that bet the same
    side distribution in the same games would have scored. Otherwise 54% next to 50% is a
    lie about a slice where the favourite covers 52.6%."""
    yh, _ = mkt_home
    ya, _ = mkt_away
    y = np.where(side_home, yh, ya)
    ok = mask & np.isfinite(y)
    # baseline = rate of the chosen side across ALL games in the universe, not just the bet ones
    return float(np.nanmean(np.where(side_home[ok], yh[ok], ya[ok])) * 0 + np.nan)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perms", type=int, default=40)
    ap.add_argument("--min-train", type=int, default=1200)
    ap.add_argument("--refit", type=int, default=100)
    a = ap.parse_args()

    d = pd.read_parquet(f"{OUT}/nba_hunt_frame2.parquet").reset_index(drop=True)
    d["game_date"] = pd.to_datetime(d["game_date"])
    M = sweep.build_markets(d)
    order = np.argsort(d["game_date"].to_numpy(), kind="stable")

    reg = (d["postseason"] == 0).to_numpy()
    gp = d["min_gp"].to_numpy(float)
    phases = {
        "early  (<25 gp)": reg & (gp < 25),
        "mid    (25-49)": reg & (gp >= 25) & (gp < 50),
        "late   (50+)": reg & (gp >= 50),
        "playoffs": (d["postseason"] == 1).to_numpy(),
        "ALL regular": reg,
    }

    targets = {
        "fg_spread": ("ats_margin", "fg_spread_home", "fg_spread_away", (1.5, 2.5, 3.5)),
        "fg_total": ("ou_margin", "fg_total_over", "fg_total_under", (2.0, 3.0, 4.5)),
    }

    rows = []
    stash = {}
    for tname, (ycol, mkt_h, mkt_a, ks) in targets.items():
        y = d[ycol].to_numpy(float)
        for bname, prefixes in BLOCKS.items():
            cols = numeric_features(d, prefixes)
            X = d[cols].to_numpy(float)
            # a column that is missing for most of the file cannot help and destabilises the
            # training-window median; drop below 60% populated.
            keep = np.isfinite(X).mean(0) >= 0.60
            X, cols = X[:, keep], [c for c, k in zip(cols, keep) if k]
            for alpha in (100.0, 300.0, 1000.0, 3000.0):
                pred = walk_forward(X, y, order, a.min_train, a.refit, alpha)
                have = np.isfinite(pred) & np.isfinite(y)
                corr = float(np.corrcoef(pred[have], y[have])[0, 1]) if have.sum() > 100 else np.nan
                stash[(tname, bname, alpha)] = pred
                rows.append(dict(target=tname, block=bname, ncol=len(cols),
                                 alpha=alpha, n_pred=int(have.sum()), corr=round(corr, 4)))
    R = pd.DataFrame(rows)
    print(f"\n== out-of-sample corr(predicted residual, actual residual), walk-forward")
    print(R.to_string(index=False))

    # ---- the honest question: does corr turn into money, and in WHICH phase
    print("\n== bets, by phase and threshold (K = |predicted residual| in POINTS)")
    grid = []
    for (tname, bname, alpha), pred in stash.items():
        ycol, mkt_h, mkt_a, ks = targets[tname]
        side_home = pred > 0
        for pname, pmask in phases.items():
            # the comparator: how the SAME side-choice distribution grades on every game of
            # this phase the model made a prediction for, at any confidence.
            allp = pmask & np.isfinite(pred)
            b = grade(allp, side_home, M[mkt_h], M[mkt_a])
            for k in ks:
                m = allp & (np.abs(pred) >= k)
                g = grade(m, side_home, M[mkt_h], M[mkt_a])
                if g is None or b is None:
                    continue
                grid.append(dict(target=tname, block=bname, alpha=alpha, phase=pname,
                                 K=k, n=g[0], win=round(g[1], 2), base=round(b[1], 2),
                                 edge=round(g[1] - b[1], 2), roi=round(g[2], 2)))
    G = pd.DataFrame(grid)
    G.to_csv(os.path.join(ROOT, "nba_style_model.csv"), index=False)
    for tname in targets:
        sub = G[(G.target == tname)].sort_values("roi", ascending=False)
        print(f"\n-- {tname}: top 18 by ROI")
        print(sub.head(18).to_string(index=False))
        print(f"-- {tname}: ALL regular season, every alpha/block/K")
        print(sub[sub.phase == "ALL regular"].to_string(index=False))

    # ---- null: shuffle the target within season, refit end to end
    print(f"\n== within-season label-shuffle null ({a.perms} draws), corr of the best config")
    rng = np.random.default_rng(11)
    for tname, (ycol, mkt_h, mkt_a, ks) in targets.items():
        best = R[(R.target == tname)].sort_values("corr", ascending=False).iloc[0]
        cols = numeric_features(d, BLOCKS[best.block])
        X = d[cols].to_numpy(float)
        keep = np.isfinite(X).mean(0) >= 0.60
        X = X[:, keep]
        y = d[ycol].to_numpy(float)
        seas = d["season"].to_numpy()
        null = []
        for _ in range(a.perms):
            ysh = y.copy()
            for s in np.unique(seas):
                idx = np.flatnonzero(seas == s)
                v = ysh[idx]
                ysh[idx] = rng.permutation(v)
            p = walk_forward(X, ysh, order, a.min_train, a.refit, float(best.alpha))
            h = np.isfinite(p) & np.isfinite(ysh)
            null.append(np.corrcoef(p[h], ysh[h])[0, 1])
        null = np.array(null)
        z = (best.corr - null.mean()) / null.std(ddof=1)
        print(f"  {tname:10s} block={best.block:6s} alpha={best.alpha:6.0f} "
              f"corr={best.corr:+.4f}  null {null.mean():+.4f} +/- {null.std(ddof=1):.4f}  z={z:+.2f}")

    print("\n-> nba_style_model.csv")


if __name__ == "__main__":
    main()
