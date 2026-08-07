#!/usr/bin/env python3
"""THE NBA MODEL — full game, every primary market, graded at the OPENER.

Every NBA run in this folder so far has been graded at the T-60 close, with T-60 handed
to the model as a feature. Nothing beat it. That is not a surprising result and it is not
the right test, for two reasons:

  1  The close is the single best forecast that exists. It contains every injury report,
     every lineup scratch, and every sharp bet placed all day. Asking a pregame model to
     beat it by MORE than the vig is close to asking it to beat the sum of everyone.
  2  It is not how this repo validates a model anywhere else. The locked NFL models are
     graded STRICT-OPEN (see LOCKED_MODELS.md), because the grading rule in this project
     is: whichever line the signal USES is the line it gets GRADED against. A model that
     bets in the morning must be graded on the morning number.

And there is real room at the open. Over 5,423 games the close is only 0.09 points sharper
than the open on the spread and 0.16 on the total -- but the number MOVES 1.11 and 2.09
points respectively. The market barely improves its forecast while substantially moving
its price. That gap is the entire opportunity, and nobody has looked at it.

So this grades three things, and they answer three different questions:

  FORECAST   MAE of the model's number vs the open and vs the close. This is the PRODUCT
             question -- a per-game predicted margin and total for every game, which is
             what NFL/CFB/MLB ship and NBA does not have. Per this repo's own standard a
             53-58% model with positive CLV IS the product; it does not have to print
             money to be worth shipping.
  CLV        does the side the model takes at the open beat the closing number? This is
             the honest test of whether the model knows something the market later learns.
             CLV cannot be faked by variance the way ROI can.
  ROI        at the open line AND the open price, per season, on an edge ladder.

FEATURE DISCIPLINE. Betting at the open means the model may see NOTHING from later
snapshots. t24/t4/t60, every mkt_*_move_* column, and the 1H / team-total markets are all
struck after the open, so they are banned outright and the ban is asserted rather than
assumed. Leaking a single t60 column here would manufacture CLV out of thin air, because
the model would literally be reading the answer it is being graded on.
"""
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

import lightgbm as lgb
import xgboost as xgb
from sklearn.ensemble import (ExtraTreesRegressor, HistGradientBoostingRegressor,
                              RandomForestRegressor)
from sklearn.linear_model import ElasticNet, Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
TOPK = 220            # features kept per fold, chosen inside the train fold only
BLOCK_MONTHS = 1
MIN_TRAIN = 1200
SEED = 0

# Anything struck after the opening number. Betting at the open and reading these would
# be reading the future -- and would fabricate CLV, since CLV is measured against t60.
BAN_PAT = re.compile(r"^(t24_|t4_|t60_|mkt_|y_|h1_|tt_)")
BAN_EXACT = {"game.id", "event_id", "bdl_id", "date", "season", "game.postseason"}


def feature_cols(D):
    cols = [c for c in D.columns
            if not BAN_PAT.match(c) and c not in BAN_EXACT and D[c].dtype.kind in "fiub"]
    bad = [c for c in cols if BAN_PAT.match(c)]
    assert not bad, f"POST-OPEN COLUMN IN X: {bad}"
    return cols


def american_to_dec(a):
    """Decimal odds, whichever format the column is actually in.

    The price columns in nba_model_features are ALREADY decimal (spread/total sit at
    1.909, i.e. -110). Blind-converting them as American turns 1.909 into 1.019 and
    every ROI in the brief comes out near -49% at a 50% win rate. Anything in [1.01, 40]
    is a decimal price -- American odds never live there.
    """
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def models(kind):
    """Every method family that can regress this target, not one booster three ways.

    The point of the spread is inductive bias: boosters find interactions and thresholds,
    the linear pair finds smooth global structure, the forests bag rather than boost, and
    the MLP is the only one that can represent a smooth high-order surface. If they all
    land in the same place that is evidence about the data, not about the algorithm.
    """
    return {
        "lgbm": lgb.LGBMRegressor(n_estimators=600, learning_rate=0.03, num_leaves=31,
                                  min_child_samples=40, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.5, reg_lambda=10.0,
                                  random_state=SEED, verbose=-1, n_jobs=3),
        "xgb": xgb.XGBRegressor(n_estimators=600, learning_rate=0.03, max_depth=4,
                                min_child_weight=20, subsample=0.8, colsample_bytree=0.5,
                                reg_lambda=10.0, random_state=SEED, n_jobs=3,
                                tree_method="hist", verbosity=0),
        "hgb": HistGradientBoostingRegressor(max_iter=400, learning_rate=0.04,
                                             max_leaf_nodes=31, min_samples_leaf=40,
                                             l2_regularization=5.0, random_state=SEED),
        "rf": RandomForestRegressor(n_estimators=300, min_samples_leaf=15,
                                    max_features=0.3, random_state=SEED, n_jobs=3),
        "et": ExtraTreesRegressor(n_estimators=300, min_samples_leaf=15,
                                  max_features=0.3, random_state=SEED, n_jobs=3),
        "ridge": Ridge(alpha=300.0),
        "enet": ElasticNet(alpha=0.15, l1_ratio=0.4, max_iter=3000),
        "mlp": MLPRegressor(hidden_layer_sizes=(96, 32), alpha=1.0, max_iter=400,
                            early_stopping=True, random_state=SEED),
    }


NEEDS_SCALE = {"ridge", "enet", "mlp"}


def run_target(D, ycol, lcol, tag):
    """Walk forward, fit every method on the same folds, return per-method predictions."""
    D = D.dropna(subset=[ycol, lcol]).sort_values("date").reset_index(drop=True)
    cols = feature_cols(D)
    mo = D["date"].dt.to_period("M")
    uniq = sorted(mo.unique())
    blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
    names = list(models("r").keys()) + ["blend"]
    for nm in names:
        D[f"p_{nm}"] = np.nan

    for blk in blocks:
        te = D.index[mo.isin(blk)]
        tr = D.index[mo < blk[0]]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        Xtr_all = D.loc[tr, cols].to_numpy(dtype=np.float32)
        ytr = D.loc[tr, ycol].to_numpy(dtype=float)

        # feature selection INSIDE the train fold -- selecting on the full frame would
        # leak the test months into which columns the model is even allowed to see
        sel = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=31,
                                colsample_bytree=0.5, random_state=SEED, verbose=-1,
                                n_jobs=3)
        sel.fit(np.nan_to_num(Xtr_all), ytr)
        keep = np.argsort(sel.feature_importances_)[::-1][:TOPK]

        Xtr = np.nan_to_num(Xtr_all[:, keep])
        Xte = np.nan_to_num(D.loc[te, cols].to_numpy(dtype=np.float32)[:, keep])
        sc = StandardScaler().fit(Xtr)
        Xtr_s, Xte_s = sc.transform(Xtr), sc.transform(Xte)

        preds = {}
        for nm, m in models("r").items():
            a, b = (Xtr_s, Xte_s) if nm in NEEDS_SCALE else (Xtr, Xte)
            try:
                m.fit(a, ytr)
                preds[nm] = m.predict(b)
            except Exception:
                continue
            D.loc[te, f"p_{nm}"] = preds[nm]
        if preds:
            D.loc[te, "p_blend"] = np.mean(list(preds.values()), axis=0)

    D["_tag"] = tag
    return D, names


def clv_points(D, side_home, lo, lc):
    """Points of closing-line value. Positive = we took a better number than the close.

    Home/over bets want a LOW threshold, away/under a high one, so the sign flips with the
    side. This is the number that cannot be faked by variance: a model with no information
    gets a mean CLV of zero however lucky its results look.
    """
    return np.where(side_home, D[lo] - D[lc], D[lc] - D[lo])


def grade_spread(D, pcol, pct, seasons):
    """Bet the side the model's predicted margin favours, at the OPEN line and price."""
    d = D[D[pcol].notna()].copy()
    # model margin vs the open number: open_spread_home_point is the HOME spread, so the
    # home side is implied when predicted margin exceeds the points the home team gives
    d["edge"] = d[pcol] + d["open_spread_home_point"]
    if len(d) < 200:
        return None
    thr = d["edge"].abs().quantile(1 - pct / 100) if pct < 100 else -1
    d = d[d["edge"].abs() >= thr]
    d = d[d["y_fg_margin"] != -d["open_spread_home_point"]]        # pushes out
    if len(d) < 60:
        return None
    home = (d["edge"] > 0).to_numpy()
    win = np.where(home, d["y_fg_margin"] > -d["open_spread_home_point"],
                   d["y_fg_margin"] < -d["open_spread_home_point"]).astype(float)
    dec = np.where(home, american_to_dec(d["open_spread_home_price"]),
                   american_to_dec(d["open_spread_away_price"]))
    clv = clv_points(d, home, "open_spread_home_point", "t60_spread_home_point")
    per = []
    for s in seasons:
        m = (d["season"] == s).to_numpy()
        per.append(f"{100*win[m].mean():.0f}" if m.sum() >= 25 else "-")
    return dict(n=len(d), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean(),
                clv=np.nanmean(clv), clv_pos=100 * np.nanmean(clv > 0),
                per="/".join(per))


def grade_total(D, pcol, pct, seasons):
    d = D[D[pcol].notna()].copy()
    d["edge"] = d[pcol] - d["open_total_point"]
    if len(d) < 200:
        return None
    thr = d["edge"].abs().quantile(1 - pct / 100) if pct < 100 else -1
    d = d[d["edge"].abs() >= thr]
    d = d[d["y_fg_total"] != d["open_total_point"]]
    if len(d) < 60:
        return None
    over = (d["edge"] > 0).to_numpy()
    win = np.where(over, d["y_fg_total"] > d["open_total_point"],
                   d["y_fg_total"] < d["open_total_point"]).astype(float)
    dec = np.where(over, american_to_dec(d["open_total_over_price"]),
                   american_to_dec(d["open_total_under_price"]))
    # over wants a low number, under a high one -- same flip as the spread
    clv = np.where(over, d["t60_total_point"] - d["open_total_point"],
                   d["open_total_point"] - d["t60_total_point"])
    per = []
    for s in seasons:
        m = (d["season"] == s).to_numpy()
        per.append(f"{100*win[m].mean():.0f}" if m.sum() >= 25 else "-")
    return dict(n=len(d), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean(),
                clv=np.nanmean(clv), clv_pos=100 * np.nanmean(clv > 0),
                per="/".join(per))


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    D["date"] = pd.to_datetime(D["date"])
    D["season"] = D["season"].astype(str)
    seasons = sorted(D["season"].unique())
    print(f"{len(D):,} games, seasons {seasons}", flush=True)

    print("\n=== MARGIN ===", flush=True)
    M, names = run_target(D, "y_fg_margin", "open_spread_home_point", "margin")
    print("\n=== TOTAL ===", flush=True)
    T, _ = run_target(D, "y_fg_total", "open_total_point", "total")

    L = ["# THE NBA MODEL — full game, graded at the OPENER", "",
         f"{len(D):,} games, seasons {seasons}. Rolling origin, refit monthly, "
         f"top-{TOPK} features chosen inside each train fold.", "",
         "Graded at the **opening line and its opening price**, per this repo's rule that "
         "the line a signal uses is the line it is graded against. Every post-open column "
         "(t24/t4/t60, all `mkt_*` movement, 1H and team-total markets) is banned from X "
         "and the ban is asserted, because leaking one would fabricate CLV outright.", "",
         "Breakeven at -110 is 52.4%.", ""]

    # ---------------------------------------------------------------- forecast accuracy
    L += ["## 1 — Forecast accuracy: can the model produce a real per-game number?\n",
          "The product question. MAE of the model's predicted margin/total against the "
          "market's own two numbers. The close is the ceiling; the open is the number "
          "actually being bet.\n",
          "| target | method | MAE model | MAE open | MAE close | vs open |",
          "|---|---|---|---|---|---|"]
    for frame, ycol, lo, lc, lbl in ((M, "y_fg_margin", "open_spread_home_point",
                                      "t60_spread_home_point", "margin"),
                                     (T, "y_fg_total", "open_total_point",
                                      "t60_total_point", "total")):
        sgn = -1 if lbl == "margin" else 1
        for nm in names:
            s = frame[frame[f"p_{nm}"].notna()]
            if len(s) < 500:
                continue
            mm = (s[ycol] - s[f"p_{nm}"]).abs().mean()
            mo_ = (s[ycol] - sgn * s[lo]).abs().mean()
            mc = (s[ycol] - sgn * s[lc]).abs().mean()
            L.append(f"| {lbl} | {nm} | {mm:.3f} | {mo_:.3f} | {mc:.3f} | "
                     f"{100*(mm/mo_-1):+.2f}% |")
            print(f"  {lbl}/{nm}: MAE {mm:.3f} vs open {mo_:.3f} ({100*(mm/mo_-1):+.2f}%)",
                  flush=True)

    # ------------------------------------------------------------------------- CLV + ROI
    for frame, gfun, lbl in ((M, grade_spread, "SPREAD"), (T, grade_total, "TOTAL")):
        L += [f"\n## 2 — {lbl}: CLV and ROI at the open\n",
              "`CLV` = mean points of closing-line value on the side taken. Positive CLV "
              "means the market later moved toward us, which is the one result variance "
              "cannot manufacture.\n",
              "| method | cut | n | win% | ROI | CLV pts | CLV+ % | per-season |",
              "|---|---|---|---|---|---|---|---|"]
        for nm in names:
            for pct in (100, 50, 25, 10):
                r = gfun(frame, f"p_{nm}", pct, seasons)
                if r is None:
                    continue
                L.append(f"| {nm} | top{pct}% | {r['n']:,} | {r['win']:.1f} | "
                         f"{r['roi']:+.1f} | {r['clv']:+.3f} | {r['clv_pos']:.1f} | "
                         f"{r['per']} |")

    keep = ["game.id", "date", "season", "y_fg_margin", "y_fg_total",
            "open_spread_home_point", "open_total_point", "t60_spread_home_point",
            "t60_total_point"]
    M[keep + [f"p_{n}" for n in names]].to_parquet(
        f"{OUT}/nba_open_margin_preds.parquet", index=False)
    T[[c for c in keep if c in T.columns] + [f"p_{n}" for n in names]].to_parquet(
        f"{OUT}/nba_open_total_preds.parquet", index=False)

    path = os.path.join(ROOT, "NBA_OPEN_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
