#!/usr/bin/env python3
"""NBA model zoo — every algorithm, every market, walk-forward, graded at the T-60 close.

Design thesis (from BBALL_SIGNALS.md S7/S8 and the NCAAB model post-mortem):

  Modelling the outcome against a SHARP market is a known dead end here — the NCAAB
  v1 models beat nothing and their edge<->actual-residual correlation was 0.006, i.e.
  literally zero information beyond the line. What is NOT dead is the book's
  MECHANICAL half-split: the NBA 1H line is ~0.573x the FG spread and ~0.501x the FG
  total regardless of matchup, and both S7 (shared 1H o/u streaks) and S8 (moderate
  absence) prove that constant is wrong in measurable, repeatable ways.

So this runs BOTH framings and lets the numbers pick:

  RAW      — no market column enters the model at all. It predicts the outcome from
             team/schedule/style/availability state; edge = model number - market line.
             This is the honest "can we beat the close from first principles" test.
  ANCHORED — the market line IS a feature and the target is the RESIDUAL (outcome -
             line). The model can only earn its keep by finding where the line is
             systematically wrong. Fails gracefully: a model with nothing to say
             predicts ~0 and bets nothing.
  SHARE    — 1H markets only. Predicts the 1H's SHARE of the full game, then prices
             the 1H off the (sharp) FG line: implied_1H = share_hat * fg_line. This
             attacks the mechanical constant directly rather than the sharp number.

Grading is percentile-based so regressors (edge in points) and classifiers (edge in
probability) are directly comparable: bet the top X% of the test season by |edge|.

Walk-forward: train on every prior season, test on the next, report TEST SEASONS ONLY.
Stacking weights come from a time-ordered inner split of the training data, never the
test season.
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import (ExtraTreesRegressor, HistGradientBoostingClassifier,
                              HistGradientBoostingRegressor, RandomForestRegressor)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNetCV, LassoCV, LogisticRegression, Ridge, RidgeCV
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import lightgbm as lgb
import xgboost as xgb
from catboost import CatBoostRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
BE = 0.5238  # -110 breakeven
CLF_NAMES = {"lgbm_clf", "hgb_clf", "logit"}

# Market columns are identified by prefix. Team features are all h_/a_/d_/sum_ prefixed,
# so there is no collision with e.g. h1_spread.
MKT_PREFIX = ("open_", "t24_", "t4_", "t60_", "mkt_", "h1_", "tt_")


def market_cols(df):
    return [c for c in df.columns
            if c.startswith(MKT_PREFIX) and not c.startswith(("h_", "a_", "d_", "sum_"))]


# ---------------------------------------------------------------- markets
# resid = outcome - line, oriented so resid > 0 means the HOME / OVER side wins.
MARKETS = {
    "fg_spread":  dict(raw="y_fg_margin", resid="y_fg_marg_resid", line="t60_spread_home_point",
                       ph="t60_spread_home_price", pa="t60_spread_away_price",
                       lsign=+1, side=("HOME", "AWAY")),
    "fg_total":   dict(raw="y_fg_total", resid="y_fg_tot_resid", line="t60_total_point",
                       ph="t60_total_over_price", pa="t60_total_under_price",
                       lsign=-1, side=("OVER", "UNDER")),
    "h1_spread":  dict(raw="y_h1_margin", resid="y_h1_marg_resid", line="h1_spread",
                       ph="h1_sp_h", pa="h1_sp_a",
                       lsign=+1, side=("HOME", "AWAY")),
    "h1_total":   dict(raw="y_h1_total", resid="y_h1_tot_resid", line="h1_total_line",
                       ph="h1_ov", pa="h1_un",
                       lsign=-1, side=("OVER", "UNDER")),
    "tt_home":    dict(raw="y_home_pts", resid="y_tt_h_resid", line="tt_h",
                       ph="tt_h_o", pa="tt_h_u", lsign=-1, side=("OVER", "UNDER")),
    "tt_away":    dict(raw="y_away_pts", resid="y_tt_a_resid", line="tt_a",
                       ph="tt_a_o", pa="tt_a_u", lsign=-1, side=("OVER", "UNDER")),
}


def model_zoo(seed=0):
    """Every regressor we can bring to bear. NaN-native models get the raw matrix;
    the rest get median-imputed + scaled inputs."""
    imp = lambda est: Pipeline([("i", SimpleImputer(strategy="median")),
                                ("s", StandardScaler()), ("m", est)])
    return {
        "ridge":   imp(RidgeCV(alphas=np.logspace(0, 4, 25))),
        "lasso":   imp(LassoCV(n_alphas=40, max_iter=3000, random_state=seed, n_jobs=-1)),
        "enet":    imp(ElasticNetCV(l1_ratio=[.2, .5, .9], n_alphas=30, max_iter=3000,
                                    random_state=seed, n_jobs=-1)),
        "mlp":     imp(MLPRegressor(hidden_layer_sizes=(64, 16), alpha=1.0, max_iter=400,
                                    early_stopping=True, random_state=seed)),
        "rf":      Pipeline([("i", SimpleImputer(strategy="median")),
                             ("m", RandomForestRegressor(n_estimators=250, min_samples_leaf=20,
                                                         max_features=0.3, n_jobs=-1,
                                                         random_state=seed))]),
        "et":      Pipeline([("i", SimpleImputer(strategy="median")),
                             ("m", ExtraTreesRegressor(n_estimators=250, min_samples_leaf=20,
                                                       max_features=0.3, n_jobs=-1,
                                                       random_state=seed))]),
        "hgb":     HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04,
                                                 max_leaf_nodes=15, min_samples_leaf=40,
                                                 l2_regularization=1.0, random_state=seed),
        "lgbm":    lgb.LGBMRegressor(n_estimators=400, learning_rate=0.03, num_leaves=15,
                                     min_child_samples=40, subsample=0.8, subsample_freq=1,
                                     colsample_bytree=0.5, reg_lambda=5.0, random_state=seed,
                                     verbose=-1, n_jobs=-1),
        "xgb":     xgb.XGBRegressor(n_estimators=400, learning_rate=0.03, max_depth=4,
                                    min_child_weight=20, subsample=0.8, colsample_bytree=0.5,
                                    reg_lambda=5.0, random_state=seed, n_jobs=-1,
                                    tree_method="hist"),
        "cat":     CatBoostRegressor(iterations=400, learning_rate=0.04, depth=5,
                                     l2_leaf_reg=6.0, random_seed=seed, verbose=0,
                                     allow_writing_files=False),
    }


def clf_zoo(seed=0):
    """Direct classifiers on the binary cover/over outcome — sometimes a regression on
    points throws away the only thing we care about (which side of the number)."""
    return {
        "lgbm_clf": lgb.LGBMClassifier(n_estimators=400, learning_rate=0.03, num_leaves=15,
                                       min_child_samples=40, subsample=0.8, subsample_freq=1,
                                       colsample_bytree=0.5, reg_lambda=5.0, random_state=seed,
                                       verbose=-1, n_jobs=-1),
        "hgb_clf":  HistGradientBoostingClassifier(max_iter=300, learning_rate=0.04,
                                                   max_leaf_nodes=15, min_samples_leaf=40,
                                                   l2_regularization=1.0, random_state=seed),
        "logit":    Pipeline([("i", SimpleImputer(strategy="median")), ("s", StandardScaler()),
                              ("m", LogisticRegression(C=0.02, max_iter=2000))]),
    }


def prune(tr, te, cols):
    """Drop features that are mostly missing or constant IN THE TRAINING FOLD."""
    keep = []
    for c in cols:
        s = tr[c]
        if s.notna().mean() < 0.60:
            continue
        if s.nunique(dropna=True) < 2:
            continue
        keep.append(c)
    return keep


def grade(win, dec, mask):
    """win: 1/0/nan (nan = push). Returns n, win%, ROI% on masked rows."""
    m = mask & win.notna() & dec.notna()
    n = int(m.sum())
    if n == 0:
        return 0, np.nan, np.nan
    w, d = win[m].values, dec[m].values
    return n, 100 * w.mean(), 100 * (w * (d - 1) - (1 - w)).mean()


def run_market(D, name, cfg, variant, log):
    """variant in {raw, anchored, share}. Returns a list of result dicts."""
    cf = cfg
    need = [cf["resid"], cf["line"], cf["ph"], cf["pa"]]
    G = D[D[need].notna().all(axis=1)].copy()
    if variant == "share":
        G = G[G["t60_total_point"].notna() & (name == "h1_total")]
    if len(G) < 800:
        return []

    seasons = sorted(G["season"].unique())
    tests = seasons[1:]
    if len(tests) == 0:
        return []

    allcols = [c for c in G.columns
               if not c.startswith("y_") and c not in ("game.id", "event_id", "date", "season")]
    mkt = set(market_cols(G))
    feats_anchored = [c for c in allcols if G[c].dtype.kind in "fiub"]
    feats_raw = [c for c in feats_anchored if c not in mkt]

    # target + feature set per variant
    if variant == "raw":
        ycol, fcols = cf["raw"], feats_raw
    elif variant == "anchored":
        ycol, fcols = cf["resid"], feats_anchored
    else:  # share: predict the 1H's share of the full game, price it off the FG line
        G["y_share"] = G["y_h1_total"] / G["y_fg_total"].replace(0, np.nan)
        G = G[G["y_share"].notna()]
        ycol = "y_share"
        fcols = [c for c in feats_anchored if c not in mkt] + ["t60_total_point", "h1_total_line",
                                                               "mkt_h1_tot_ratio"]

    # push-safe binary outcome for the classifiers, oriented HOME/OVER = 1
    G["_resid"] = G[cf["resid"]]
    G["_y01"] = np.where(G["_resid"] > 0, 1.0, np.where(G["_resid"] < 0, 0.0, np.nan))
    dec_h, dec_a = G[cf["ph"]], G[cf["pa"]]

    rows = []
    preds = {}          # model -> series of signed edge over the test seasons
    for ts in tests:
        tr = G[G["season"] < ts]
        te = G[G["season"] == ts]
        if len(tr) < 500 or len(te) < 150:
            continue
        use = prune(tr, te, fcols)
        Xtr, Xte = tr[use], te[use]
        ytr = tr[ycol]
        ok = ytr.notna()
        Xtr, ytr = Xtr[ok.values], ytr[ok]

        # inner time-ordered split for the stack meta-learner
        cut = int(len(Xtr) * 0.75)
        itr, iva = slice(0, cut), slice(cut, len(Xtr))
        inner = {}

        for mname, mk_ in model_zoo().items():
            from sklearn.base import clone
            try:
                m = clone(mk_)
                m.fit(Xtr.iloc[itr], ytr.iloc[itr])
                inner[mname] = m.predict(Xtr.iloc[iva])
                m2 = clone(mk_)
                m2.fit(Xtr, ytr)
                p = m2.predict(Xte)
            except Exception as e:                       # noqa: BLE001
                log(f"    !! {name}/{variant}/{mname}/{ts}: {type(e).__name__} {e}")
                continue
            preds.setdefault(mname, {})[ts] = pd.Series(p, index=te.index)

        # binary classifiers
        y01 = tr["_y01"]
        c_ok = y01.notna()
        for cname, ck in clf_zoo().items():
            from sklearn.base import clone
            try:
                c = clone(ck)
                c.fit(tr[use][c_ok.values], y01[c_ok])
                p = c.predict_proba(Xte)[:, 1]
            except Exception as e:                       # noqa: BLE001
                log(f"    !! {name}/{variant}/{cname}/{ts}: {type(e).__name__} {e}")
                continue
            # rescale prob to a pseudo-edge so it shares the thresholding machinery
            preds.setdefault(cname, {})[ts] = pd.Series((p - 0.5) * 20.0, index=te.index)

        # stack: ridge meta on the inner-validation predictions of every base model
        if len(inner) >= 3:
            from sklearn.base import clone
            names = sorted(inner)
            Z = np.column_stack([inner[n] for n in names])
            meta = Ridge(alpha=1.0).fit(Z, ytr.iloc[iva])
            base_te = [preds[n][ts].values for n in names if n in preds and ts in preds[n]]
            if len(base_te) == len(names):
                preds.setdefault("stack", {})[ts] = pd.Series(
                    meta.predict(np.column_stack(base_te)), index=te.index)
        # simple mean of every base regressor
        reg_names = [n for n in model_zoo() if n in preds and ts in preds[n]]
        if len(reg_names) >= 3:
            preds.setdefault("mean", {})[ts] = pd.Series(
                np.mean([preds[n][ts].values for n in reg_names], axis=0), index=te.index)

    if not preds:
        return []

    # ------------------------------------------------------------------ grade
    TE = G[G["season"].isin(tests)]
    for mname, byseason in preds.items():
        if not byseason:
            continue
        pr = pd.concat(byseason.values()).reindex(G.index)
        # convert the model number into a signed edge: > 0 => bet HOME/OVER
        if mname in CLF_NAMES:
            edge = pr                                   # already centred on 0
        elif variant == "raw":
            edge = (pr - G[cf["line"]]) if cf["lsign"] < 0 else (pr + G[cf["line"]])
        elif variant == "anchored":
            edge = pr
        else:  # share -> implied 1H total vs the posted 1H line
            edge = pr * G["t60_total_point"] - G[cf["line"]]

        home = edge > 0
        win = pd.Series(np.where(G["_y01"].isna(), np.nan,
                                 np.where(home, G["_y01"], 1 - G["_y01"])), index=G.index)
        dec = pd.Series(np.where(home, dec_h, dec_a), index=G.index)
        base = G["season"].isin(tests) & edge.notna()

        # market MAE vs model MAE (regressors only, meaningful in points)
        mae_m = mae_k = np.nan
        if mname not in CLF_NAMES and variant != "share":
            t = G[base]
            yy = t[cf["raw"]]
            pred_pts = (pr[base] if variant == "raw"
                        else t[cf["line"]] * (-cf["lsign"]) + pr[base])
            mae_m = float((pred_pts - yy).abs().mean())
            mae_k = float((t[cf["line"]] * (-cf["lsign"]) - yy).abs().mean())
        cc = pd.DataFrame({"e": edge[base], "r": G.loc[base, "_resid"]}).dropna()
        corr = float(np.corrcoef(cc["e"], cc["r"])[0, 1]) if len(cc) > 50 else np.nan

        for pct in (100, 50, 25, 10, 5):
            thr = edge[base].abs().quantile(1 - pct / 100) if pct < 100 else -1
            m = base & (edge.abs() >= thr)
            n, wp, roi = grade(win, dec, m)
            per = []
            for s in tests:
                ns, ws, _ = grade(win, dec, m & (G["season"] == s))
                per.append(f"{ws:.0f}" if ns >= 25 else "-")
            rows.append(dict(market=name, variant=variant, model=mname, top=f"top{pct}%",
                             n=n, win=wp, roi=roi, corr=corr, mae_model=mae_m,
                             mae_mkt=mae_k, per="/".join(per)))
    return rows


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    logf = open(os.path.join(ROOT, "nba_model_run.log"), "w")

    def log(s):
        print(s, flush=True)
        logf.write(s + "\n")
        logf.flush()

    log(f"features {D.shape[0]:,} x {D.shape[1]:,} | seasons {sorted(D['season'].unique())}")
    log(f"sanity: median t60 spread price {D['t60_spread_home_price'].median():.3f} "
        f"(should be ~1.9 decimal)")

    out = []
    for name, cfg in MARKETS.items():
        variants = ["raw", "anchored"] + (["share"] if name == "h1_total" else [])
        for v in variants:
            log(f"\n=== {name} / {v}")
            r = run_market(D, name, cfg, v, log)
            out += r
            for row in r:
                if row["top"] in ("top100%", "top10%"):
                    log(f"  {row['model']:9s} {row['top']:7s} n={row['n']:5d} "
                        f"win={row['win']:.1f} roi={row['roi']:+.1f} "
                        f"corr={row['corr']:+.3f} per={row['per']}")

    R = pd.DataFrame(out)
    R.to_csv(os.path.join(ROOT, "nba_model_results.csv"), index=False)
    log(f"\nwrote nba_model_results.csv ({len(R)} rows)")
    logf.close()


if __name__ == "__main__":
    main()
