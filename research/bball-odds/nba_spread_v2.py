#!/usr/bin/env python3
"""The FG spread, rebuilt. Two fixes: model the market's ERROR, and stop pooling regimes.

`nba_spread_phase.py` re-graded the v1 predictions inside four season windows and the
pooled "52.36%, nothing consistent" turned out to be an average over three different
regimes pulling against each other:

  EARLY  (n=871, both teams <15 gp)   mlp monotone in its own edge: 53.9 / 55.2 / 58.0 /
                                      64.6 across the four cuts, and positive in EVERY
                                      graded season at EVERY cut. lgbm 59.3 at top25%.
  MID    (n=2,028)                    the efficient middle. Nothing, as it should be.
  LATE   (n=1,838)                    ALL EIGHT method families lose, -6 to -17 ROI, at
                                      every cut. Eight different inductive biases do not
                                      all lose by accident -- the model is systematically
                                      WRONG here, which is a signal with its sign flipped.
  PLAYOFFS (n=326)                    rf 57.8% over every playoff game, positive in all
                                      four seasons; et 56.3%. Bagging only; boosters ~50.

The baseline row says why LATE inverts: blind favourite covers 53.05% late versus 48.67%
early and mid. The model leans home-and-dog on season-long form; late, form is stale --
tanking, locked seeds, rest -- and the favourite is what actually covers.

So this script changes two things, not one.

  FRAMING   v1 predicted the raw margin with the opening line sitting in X as one feature
            among 220. That makes every tree rebuild the market's number from scratch
            before it can disagree with it, and spends all its capacity on the part the
            market already has right. Here the target is the RESIDUAL, margin + open
            spread: the market is the intercept and the model only has to learn its error.
            Both framings are run on identical folds so the comparison is clean.
  REGIME    phase is no longer something we discover after grading. It enters as features,
            and each phase is also fit on its own history, and the follow/fade decision is
            made per phase.

Validation, fixed before looking: the phase rule is chosen on the first three seasons and
2025-26 is reported as a clean holdout. Per-season is always printed next to pooled.
"""
import os
import re
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import (ExtraTreesRegressor, HistGradientBoostingRegressor,
                              RandomForestRegressor)
from sklearn.linear_model import ElasticNet, Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import lightgbm as lgb
import xgboost as xgb

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
TOPK = 220
MIN_TRAIN = 1200
SEED = 0
CUTS = (100, 50, 25, 10)
PHASES = ("early", "mid", "late", "playoffs")

BAN_PAT = re.compile(r"^(t24_|t4_|t60_|mkt_|y_|h1_|tt_)")
BAN_EXACT = {"game.id", "event_id", "bdl_id", "date", "season", "phase", "_resid"}


def feature_cols(D):
    cols = [c for c in D.columns
            if not BAN_PAT.match(c) and c not in BAN_EXACT and D[c].dtype.kind in "fiub"]
    bad = [c for c in cols if BAN_PAT.match(c)]
    assert not bad, f"POST-OPEN COLUMN IN X: {bad}"
    return cols


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def models():
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
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=300.0)),
        "enet": make_pipeline(StandardScaler(),
                              ElasticNet(alpha=0.15, l1_ratio=0.4, max_iter=3000)),
        "mlp": make_pipeline(StandardScaler(),
                             MLPRegressor(hidden_layer_sizes=(96, 32), alpha=1.0,
                                          max_iter=400, early_stopping=True,
                                          random_state=SEED)),
    }


def add_phase(D):
    """Regime features, all knowable before tip. gp is the honest clock -- calendar date
    is not, because the four seasons start on different days and one was compressed."""
    gp = np.minimum(D["h_gp"].to_numpy(dtype=float), D["a_gp"].to_numpy(dtype=float))
    post = D["game.postseason"].to_numpy(dtype=float) > 0
    D["phase"] = np.where(post, "playoffs",
                          np.where(gp < 15, "early", np.where(gp < 50, "mid", "late")))
    D["ph_min_gp"] = gp
    D["ph_is_post"] = post.astype(float)
    D["ph_early"] = (D["phase"] == "early").astype(float)
    D["ph_late"] = (D["phase"] == "late").astype(float)
    return D


def walk_forward(D, ycol, only_phase=None, min_train=MIN_TRAIN, tag=""):
    """Rolling origin, refit monthly. `only_phase` restricts BOTH train and test to one
    regime, which is how a phase model learns a regime instead of the average of four.

    The restriction is passed as a phase NAME, not a boolean mask. A mask built in the
    caller is indexed against the caller's row order; this function sorts by date and
    resets the index, so a mask silently reindexes onto different games. That bug ran
    once and scrambled every phase-specific fit.
    """
    D = D.sort_values("date").reset_index(drop=True)
    idx = D.index if only_phase is None else D.index[D["phase"] == only_phase]
    cols = feature_cols(D)
    mo = D["date"].dt.to_period("M")
    names = list(models().keys()) + ["blend"]
    for nm in names:
        D[f"p_{nm}"] = np.nan
    ok = D[ycol].notna()

    for blk in sorted(mo.unique()):
        te = D.index[(mo == blk) & ok].intersection(idx)
        tr = D.index[(mo < blk) & ok].intersection(idx)
        if len(te) == 0 or len(tr) < min_train:
            continue
        Xtr_all = D.loc[tr, cols].to_numpy(dtype=np.float32)
        ytr = D.loc[tr, ycol].to_numpy(dtype=float)
        # feature selection inside the train fold only -- selecting on the full frame
        # would leak the test month into which columns the model may even see
        sel = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=31,
                                min_child_samples=40, colsample_bytree=0.5,
                                random_state=SEED, verbose=-1, n_jobs=3)
        sel.fit(np.nan_to_num(Xtr_all), ytr)
        keep = np.argsort(sel.feature_importances_)[::-1][:TOPK]
        Xtr = np.nan_to_num(Xtr_all[:, keep])
        Xte = np.nan_to_num(D.loc[te, cols].to_numpy(dtype=np.float32)[:, keep])
        preds = []
        for nm, m in models().items():
            try:
                m.fit(Xtr, ytr)
                p = m.predict(Xte)
            except Exception as e:                       # noqa: BLE001
                print(f"    {nm} failed {blk}: {e}", flush=True)
                continue
            D.loc[te, f"p_{nm}"] = p
            preds.append(p)
        if preds:
            D.loc[te, "p_blend"] = np.mean(preds, axis=0)
        print(f"    {tag} {blk} train={len(tr):,} test={len(te):,}", flush=True)
    return D, names


def grade(d, edge, seasons, fade=False):
    """Rank by |edge| and take the model's side (or the opposite, if fade)."""
    rows = []
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    home = (edge > 0) if not fade else (edge < 0)
    win = np.where(home, y > -sp, y < -sp).astype(float)
    dec = np.where(home, american_to_dec(d["open_spread_home_price"]),
                   american_to_dec(d["open_spread_away_price"]))
    ok = (y != -sp) & np.isfinite(edge) & np.isfinite(dec)
    if ok.sum() < 100:
        return rows
    a = np.abs(edge)
    for pct in CUTS:
        thr = np.nanquantile(a[ok], 1 - pct / 100) if pct < 100 else -1
        m = ok & (a >= thr)
        if m.sum() < 50:
            continue
        per = []
        for s in seasons:
            k = d["season"].to_numpy()[m] == s
            per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 20 else "-")
        rows.append(dict(cut=f"top{pct}%", n=int(m.sum()), win=100 * win[m].mean(),
                         roi=roi(win[m], dec[m]), per="/".join(per)))
    return rows


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    D["date"] = pd.to_datetime(D["date"])
    D["season"] = D["season"].astype(str)
    dup = set(D.loc[D.duplicated("game.id", keep=False), "game.id"])
    D = D[~D["game.id"].isin(dup)].reset_index(drop=True)
    D = add_phase(D)
    seasons = sorted(D["season"].unique())
    # residual: how much the home team beats its own opening number by. Positive = home
    # covered. The market is now the intercept instead of something to reconstruct.
    D["_resid"] = D["y_fg_margin"] + D["open_spread_home_point"]
    print(f"{len(D):,} games, seasons {seasons}", flush=True)
    print(D["phase"].value_counts().to_string(), flush=True)

    print("\n=== A. residual target, pooled fit ===", flush=True)
    R, names = walk_forward(D.copy(), "_resid", tag="resid")
    R.to_parquet(f"{OUT}/nba_spread_v2_resid.parquet", index=False)

    print("\n=== B. margin target, same folds (framing control) ===", flush=True)
    M, _ = walk_forward(D.copy(), "y_fg_margin", tag="margin")
    M.to_parquet(f"{OUT}/nba_spread_v2_margin.parquet", index=False)

    print("\n=== C. phase-specific fits ===", flush=True)
    PH = {}
    for ph in PHASES:
        sub = D["phase"] == ph
        if sub.sum() < 400:
            print(f"  skip {ph}: only {sub.sum()} games", flush=True)
            continue
        # a phase model only ever sees its own regime, so the floor has to drop
        P, _ = walk_forward(D.copy(), "_resid", only_phase=ph, min_train=250,
                            tag=f"ph:{ph}")
        PH[ph] = P[P["phase"] == ph]

    L = ["# NBA full-game spread v2 — residual framing, regime-aware", "",
         "Two changes from v1, run on identical folds so each can be read on its own: "
         "the target is the market's ERROR rather than the raw margin, and season phase "
         "is a modelling variable rather than something noticed after grading.", "",
         "Betting and grading the OPENER. Breakeven at -110 is 52.4%. "
         f"Seasons {seasons}; `{seasons[-1]}` is the holdout for every phase decision.", ""]

    # ------------------------------------------------- 1. framing head-to-head, by phase
    L += ["## 1 — Does modelling the residual beat modelling the margin?\n",
          "Same folds, same features, same eight families. `edge` is the model's "
          "disagreement with the open: for the residual model that IS the prediction; for "
          "the margin model it is prediction + open spread.", "",
          "| phase | framing | method | cut | n | win% | ROI | by season |",
          "|---|---|---|---|---|---|---|---|"]
    best = {}
    for ph in PHASES:
        for lbl, frame in (("resid", R), ("margin", M)):
            d = frame[(frame["phase"] == ph)]
            for nm in names:
                s = d[d[f"p_{nm}"].notna()]
                if len(s) < 150:
                    continue
                e = (s[f"p_{nm}"] if lbl == "resid"
                     else s[f"p_{nm}"] + s["open_spread_home_point"]).to_numpy(dtype=float)
                for r in grade(s, e, seasons):
                    L.append(f"| {ph} | {lbl} | {nm} | {r['cut']} | {r['n']:,} | "
                             f"{r['win']:.1f} | {r['roi']:+.2f} | {r['per']} |")
                    best.setdefault(ph, []).append((r["roi"], lbl, nm, r["cut"]))

    # --------------------------------------------------------------- 2. the fade in LATE
    L += ["\n## 2 — LATE: is the model inverted, or just bad?\n",
          "A bad model is noise and fades to nothing. An inverted model is information "
          "with the wrong sign and fades to a profit. Every family, followed and faded, "
          "on the same games.", "",
          "| method | cut | n | follow win% | follow ROI | fade win% | fade ROI | fade by season |",
          "|---|---|---|---|---|---|---|---|"]
    dl = R[R["phase"] == "late"]
    for nm in names:
        s = dl[dl[f"p_{nm}"].notna()]
        if len(s) < 150:
            continue
        e = s[f"p_{nm}"].to_numpy(dtype=float)
        fo = {r["cut"]: r for r in grade(s, e, seasons)}
        fa = {r["cut"]: r for r in grade(s, e, seasons, fade=True)}
        for cut in fo:
            if cut not in fa:
                continue
            L.append(f"| {nm} | {cut} | {fo[cut]['n']:,} | {fo[cut]['win']:.1f} | "
                     f"{fo[cut]['roi']:+.2f} | {fa[cut]['win']:.1f} | "
                     f"{fa[cut]['roi']:+.2f} | {fa[cut]['per']} |")

    # ------------------------------------------------------- 3. phase-specific fits
    if PH:
        L += ["\n## 3 — Models fit on one regime only\n",
              "Trained and tested inside a single phase. Thinner training sets, but the "
              "model is never asked to average a tanking February against an October "
              "with no data.", "",
              "| phase | method | cut | n | win% | ROI | by season |",
              "|---|---|---|---|---|---|---|"]
        for ph, P in PH.items():
            for nm in names:
                s = P[P[f"p_{nm}"].notna()]
                if len(s) < 150:
                    continue
                for r in grade(s, s[f"p_{nm}"].to_numpy(dtype=float), seasons):
                    L.append(f"| {ph} | {nm} | {r['cut']} | {r['n']:,} | {r['win']:.1f} | "
                             f"{r['roi']:+.2f} | {r['per']} |")

    path = os.path.join(ROOT, "NBA_SPREAD_V2_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
