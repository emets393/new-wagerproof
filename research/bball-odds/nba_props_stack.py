#!/usr/bin/env python3
"""Prop pricing by DISTRIBUTIONAL REGRESSION + STACKING.

The classifier run answers "will this go over?" directly. That throws away the fact that
the target is a NUMBER and the line is a THRESHOLD on that same number: a classifier has
to relearn the shape of the distribution separately at every line it sees, from binary
labels only. Regression sees all of it at once.

So five base learners, deliberately chosen for DIFFERENT inductive biases, each producing
a probability the prop goes over:

  QREG   LGBM quantile regression at 9 quantiles -> interpolate the CDF -> P(X > line).
         The only method here that estimates the conditional distribution directly,
         with no shape assumption at all.
  RESID  LGBM L2 regression for the mean, then P(X > line) from the EMPIRICAL residual
         distribution, bucketed by predicted level. Basketball counts are strongly
         heteroskedastic -- a 30ppg scorer's residual sd is nothing like a 6ppg bench
         guy's -- so a single pooled residual CDF would misprice both ends.
  RIDGE  Ridge on the same features, residual-CDF priced. High bias on purpose: if a
         linear model in these features gets most of the edge, the boosters are fitting
         noise and the whole exercise is overfitting.
  CLF    LGBM classifier on the binary label. The direct approach, kept as a base.
  MLP    Small neural net. Different function class entirely -- smooth and global where
         trees are piecewise-constant and local.

  STACK  Logistic meta-learner over the five base probabilities PLUS the market's own
         de-vigged P(over), then isotonic-calibrated.

STACKING WITHOUT LEAKING: the meta-learner is fitted only on base predictions that were
themselves out-of-sample -- block k's meta trains on the accumulated OOS predictions from
blocks 1..k-1. No nested refit, no in-sample base predictions, no peeking.

EDGE IS MEASURED AGAINST THE MARKET, NOT AGAINST 0.5. This is the correction the
classifier run needed: blocks settle at 0.5 and steals at 0.5, so |p - 0.5| ranks every
low-line prop as maximum confidence when the model is really just agreeing with a market
that already knows. edge = p_model - p_market_novig. Both framings are reported.

Graded at real T-60 prices, and against BLIND UNDER on the identical rows, because the
prop market's standing over-shade makes any comparison to 50% meaningless.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

import lightgbm as lgb
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.pipeline import make_pipeline

from nba_props_model import LEAK, IDS, feature_cols, _venue

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
BLOCK_MONTHS = 3
MIN_TRAIN = 5000
QS = [.1, .2, .3, .4, .5, .6, .7, .8, .9]
BASES = ["qreg", "resid", "ridge", "clf", "mlp"]


def _lgb_reg(objective, alpha=None, n=250):
    kw = dict(objective=objective, n_estimators=n, learning_rate=0.05, num_leaves=31,
              min_child_samples=60, subsample=0.8, subsample_freq=1,
              colsample_bytree=0.6, reg_lambda=5.0, random_state=0, verbose=-1, n_jobs=4)
    if alpha is not None:
        kw["alpha"] = alpha
    return lgb.LGBMRegressor(**kw)


def cdf_from_quantiles(qpred, line):
    """P(X > line) by interpolating a per-row quantile function.

    qpred is (n_rows, n_quantiles) of predicted values at QS. Boosted quantile fits are
    independent so they can cross; sorting each row restores monotonicity, which is the
    standard cheap fix and costs nothing here.
    """
    v = np.sort(qpred, axis=1)
    q = np.asarray(QS)
    out = np.empty(len(line))
    for i in range(len(line)):
        # F(line) via linear interpolation across the quantile ladder, with flat
        # extrapolation outside it (never claim more certainty than the ladder supports)
        out[i] = np.interp(line[i], v[i], q, left=0.02, right=0.98)
    return 1.0 - out


def resid_prob(mu_tr, y_tr, mu_te, line_te, nbuck=8):
    """P(X > line) from the empirical residual CDF, bucketed by predicted level.

    Pooling residuals across all players would price a star and a bench guy with the same
    spread. Bucketing by predicted mean lets the residual width grow with the level, which
    is what actually happens.
    """
    edges = np.unique(np.quantile(mu_tr, np.linspace(0, 1, nbuck + 1)))
    if len(edges) < 3:
        return np.full(len(mu_te), np.nan)
    btr = np.clip(np.digitize(mu_tr, edges[1:-1]), 0, len(edges) - 2)
    bte = np.clip(np.digitize(mu_te, edges[1:-1]), 0, len(edges) - 2)
    res = y_tr - mu_tr
    out = np.full(len(mu_te), np.nan)
    for b in np.unique(bte):
        src = res[btr == b]
        if len(src) < 300:
            continue
        sel = bte == b
        need = line_te[sel] - mu_te[sel]        # over wins when resid > need
        out[sel] = 1.0 - np.searchsorted(np.sort(src), need, side="right") / len(src)
    return out


def run_market(M, cols):
    """Walk forward, returning a DataFrame of out-of-sample base + stacked probabilities."""
    P = pd.DataFrame(index=M.index, columns=BASES + ["stack"], dtype=float)
    mo = M["date"].dt.to_period("M")
    uniq = sorted(mo.unique())
    blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
    done = []                                   # indices already scored out-of-sample

    for blk in blocks:
        te = M.index[mo.isin(blk)]
        tr = M.index[(mo < blk[0]) & M["actual"].notna()]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        Xtr = M.loc[tr, cols].to_numpy(dtype=np.float32)
        Xte = M.loc[te, cols].to_numpy(dtype=np.float32)
        ytr = M.loc[tr, "actual"].to_numpy(dtype=float)
        ctr = M.loc[tr, "y_cons"].to_numpy(dtype=float)
        line_te = M.loc[te, "cons_line"].to_numpy(dtype=float)

        # ---- QREG: the conditional CDF, estimated directly
        try:
            qp = np.column_stack([_lgb_reg("quantile", a).fit(Xtr, ytr).predict(Xte)
                                  for a in QS])
            P.loc[te, "qreg"] = cdf_from_quantiles(qp, line_te)
        except Exception as e:                                      # noqa: BLE001
            print(f"    !! qreg/{blk[0]}: {type(e).__name__} {e}", flush=True)

        # ---- RESID: L2 mean + heteroskedastic empirical residual CDF
        try:
            r = _lgb_reg("regression").fit(Xtr, ytr)
            P.loc[te, "resid"] = resid_prob(r.predict(Xtr), ytr, r.predict(Xte), line_te)
        except Exception as e:                                      # noqa: BLE001
            print(f"    !! resid/{blk[0]}: {type(e).__name__} {e}", flush=True)

        # ---- RIDGE: the high-bias control
        try:
            rg = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                               Ridge(alpha=10.0))
            rg.fit(Xtr, ytr)
            P.loc[te, "ridge"] = resid_prob(rg.predict(Xtr), ytr, rg.predict(Xte), line_te)
        except Exception as e:                                      # noqa: BLE001
            print(f"    !! ridge/{blk[0]}: {type(e).__name__} {e}", flush=True)

        # ---- CLF: the direct binary approach
        try:
            g = ~np.isnan(ctr)
            c = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.04, num_leaves=31,
                                   min_child_samples=60, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.6, reg_lambda=5.0, random_state=0,
                                   verbose=-1, n_jobs=4)
            c.fit(Xtr[g], ctr[g])
            P.loc[te, "clf"] = c.predict_proba(Xte)[:, 1]
        except Exception as e:                                      # noqa: BLE001
            print(f"    !! clf/{blk[0]}: {type(e).__name__} {e}", flush=True)

        # ---- MLP: a different function class entirely
        try:
            g = ~np.isnan(ctr)
            nn = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                               MLPClassifier(hidden_layer_sizes=(64, 32), alpha=1e-3,
                                             max_iter=80, early_stopping=True,
                                             n_iter_no_change=6, random_state=0))
            nn.fit(Xtr[g], ctr[g])
            P.loc[te, "mlp"] = nn.predict_proba(Xte)[:, 1]
        except Exception as e:                                      # noqa: BLE001
            print(f"    !! mlp/{blk[0]}: {type(e).__name__} {e}", flush=True)

        # ---- STACK on accumulated OUT-OF-SAMPLE base predictions from earlier blocks
        if done:
            hist = M.index[M.index.isin(np.concatenate(done))]
            H = P.loc[hist, BASES].copy()
            H["mkt"] = M.loc[hist, "cons_p_over"]
            yh = M.loc[hist, "y_cons"]
            ok = H.notna().all(axis=1) & yh.notna()
            if ok.sum() >= 2000 and yh[ok].nunique() > 1:
                try:
                    lr = LogisticRegression(C=1.0, max_iter=500)
                    lr.fit(H[ok].to_numpy(dtype=float), yh[ok].to_numpy(dtype=int))
                    T = P.loc[te, BASES].copy()
                    T["mkt"] = M.loc[te, "cons_p_over"]
                    good = T.notna().all(axis=1)
                    if good.any():
                        raw = lr.predict_proba(T[good].to_numpy(dtype=float))[:, 1]
                        # isotonic on the SAME out-of-sample history, so the calibration
                        # map never sees a label from the block it is being applied to
                        insample = lr.predict_proba(H[ok].to_numpy(dtype=float))[:, 1]
                        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.02,
                                                 y_max=0.98)
                        iso.fit(insample, yh[ok].to_numpy(dtype=float))
                        P.loc[te[good], "stack"] = iso.predict(raw)
                except Exception as e:                              # noqa: BLE001
                    print(f"    !! stack/{blk[0]}: {type(e).__name__} {e}", flush=True)
        done.append(np.asarray(te))
    return P


def grade(D, prob, pct, venue, mode, force=None):
    """Three ranking framings for the same probabilities.

    mkt    two-sided, ranked by edge over the market's de-vigged price
    abs    two-sided, ranked by |p - 0.5| (flatters low-line markets; shown for contrast)
    under  ONE-SIDED. Always bet the under, ranked by how far below the market's price
           the model sits. This is the framing the shade argues for: blind under is
           already near breakeven at the best line, so the product is not "which side"
           but "which of these unders". Its comparator is blind under on the FULL
           population, not on the selected rows -- selecting rows and then comparing to
           yourself on those same rows is a tautology.
    """
    yo, do, yu, du = _venue(D, venue)
    if mode == "mkt":
        edge = prob - D["cons_p_over"]
        side_over = edge > 0
        conf = edge.abs()
    elif mode == "abs":
        edge = prob - 0.5
        side_over = edge > 0
        conf = edge.abs()
    else:
        conf = D["cons_p_over"] - prob            # model says the line is too high
        side_over = pd.Series(False, index=D.index)
        force = "under"
    ok = prob.notna() & conf.notna() & D[yo].notna() & D[yu].notna()
    if ok.sum() < 100:
        return 0, np.nan, np.nan
    thr = conf[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (conf >= thr)
    over = side_over[m] if force is None else pd.Series(False, index=D.index[m])
    y = np.where(over, D.loc[m, yo], D.loc[m, yu])
    win = np.where(over, y, 1 - y)
    dec = np.where(over, D.loc[m, do], D.loc[m, du])
    g = ~np.isnan(dec) & ~np.isnan(win)
    win, dec = win[g], dec[g]
    if len(win) < 50:
        return 0, np.nan, np.nan
    return len(win), 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    # PANEL/TAG let the same code run against the v2 feature set as a clean A/B instead
    # of overwriting the baseline's brief
    panel = os.environ.get("PANEL", f"{OUT}/nba_props_panel.parquet")
    tag = os.environ.get("TAG", "")
    D = pd.read_parquet(panel).rename(columns={"season_x": "season"})
    D["date"] = pd.to_datetime(D["date"])
    D = D[D["gp_prior"] >= 5].sort_values("date").reset_index(drop=True)
    seasons = sorted(D["season"].unique())

    rows = []
    for mk in sorted(D["market"].unique()):
        M = D[D["market"] == mk].copy().reset_index(drop=True)
        if len(M) < 10000:
            continue
        cols = [c for c in feature_cols(M)
                if M[c].notna().mean() >= 0.5 and M[c].nunique() > 1]
        P = run_market(M, cols)
        for name in BASES + ["stack"]:
            prob = P[name]
            if prob.notna().sum() < 500:
                continue
            M[f"_p_{name}"] = prob
            # blind under over the WHOLE market, per venue — the comparator for the
            # one-sided 'under' framing, which by construction cannot be compared to
            # itself on its own selected rows
            base_u = {v: grade(M, prob, 100, v, "mkt", force="under")[2]
                      for v in ("cons", "best")}
            for mode in ("mkt", "abs", "under"):
                for pct in (100, 25, 10, 5):
                    for venue in ("cons", "best"):
                        n, w, r = grade(M, prob, pct, venue, mode)
                        if mode == "under":
                            br = base_u[venue]
                        else:
                            _, _, br = grade(M, prob, pct, venue, mode, force="under")
                        rows.append(dict(market=mk, model=name, mode=mode,
                                         cut=f"top{pct}%", venue=venue, n=n, win=w,
                                         roi=r, blind_roi=br, delta=r - br))
            n, w, r = grade(M, prob, 10, "best", "mkt")
            _, _, br = grade(M, prob, 10, "best", "mkt", force="under")
            print(f"  {mk}/{name}: top10%@best n={n} {w:.1f}% {r:+.1f} "
                  f"vs blind {br:+.1f} (delta {r-br:+.1f})", flush=True)
        keep = ["event_id", "market", "pkey", "date"] + [f"_p_{b}" for b in BASES + ["stack"]
                                                         if f"_p_{b}" in M.columns]
        M[keep].to_parquet(f"{OUT}/nba_props_stack{tag}_{mk}.parquet", index=False)
        pd.DataFrame(rows).to_csv(os.path.join(ROOT, f"nba_props_stack{tag}_results.csv"),
                                  index=False)

    R = pd.DataFrame(rows)
    R.to_csv(os.path.join(ROOT, f"nba_props_stack{tag}_results.csv"), index=False)

    L = ["# NBA props — distributional regression + stacking", "",
         f"{len(D):,} props from `{os.path.basename(panel)}`, seasons {seasons}. Rolling "
         f"origin every {BLOCK_MONTHS} "
         "months. Five base learners with different inductive biases, plus a logistic "
         "stack fitted only on earlier out-of-sample base predictions.", "",
         "**Delta vs BLIND UNDER is the only number that means anything.** `mkt` ranks "
         "two-sided by edge over the market's de-vigged price; `abs` ranks by |p-0.5|, "
         "which flatters low-line markets and is shown for contrast; `under` is "
         "one-sided under-selection compared against blind under on the FULL market.", ""]

    for mode in ("mkt", "abs", "under"):
        L += [f"\n## Pooled across markets — ranking mode `{mode}`\n",
              "| model | cut | venue | n | win% | ROI | blind ROI | delta |",
              "|---|---|---|---|---|---|---|---|"]
        for name in BASES + ["stack"]:
            for pct in (100, 25, 10, 5):
                for venue in ("cons", "best"):
                    s = R[(R["model"] == name) & (R["mode"] == mode)
                          & (R["cut"] == f"top{pct}%")
                          & (R["venue"] == venue)].dropna(subset=["roi"])
                    n = s["n"].sum()
                    if n == 0:
                        continue
                    wt = lambda c: (s[c] * s["n"]).sum() / n            # noqa: E731
                    L.append(f"| {name} | top{pct}% | {venue} | {n:,} | {wt('win'):.2f} "
                             f"| {wt('roi'):+.2f} | {wt('blind_roi'):+.2f} | "
                             f"{wt('roi')-wt('blind_roi'):+.2f} |")

    L += ["\n## Per market — best model at top10%, best line, `mkt` ranking\n",
          "| market | model | n | win% | ROI | blind ROI | delta |",
          "|---|---|---|---|---|---|---|"]
    s = R[(R["mode"] == "mkt") & (R["cut"] == "top10%")
          & (R["venue"] == "best")].dropna(subset=["delta"])
    for mk in sorted(s["market"].unique()):
        t = s[s["market"] == mk].sort_values("delta", ascending=False).iloc[0]
        L.append(f"| {mk} | {t['model']} | {t['n']:,} | {t['win']:.2f} | {t['roi']:+.2f} "
                 f"| {t['blind_roi']:+.2f} | {t['delta']:+.2f} |")

    L += ["\n## Per market — one-sided UNDER selection, top10% at the best line\n",
          "| market | model | n | win% | ROI | blind under (all rows) | delta |",
          "|---|---|---|---|---|---|---|"]
    s = R[(R["mode"] == "under") & (R["cut"] == "top10%")
          & (R["venue"] == "best")].dropna(subset=["delta"])
    for mk in sorted(s["market"].unique()):
        t = s[s["market"] == mk].sort_values("delta", ascending=False).iloc[0]
        L.append(f"| {mk} | {t['model']} | {t['n']:,} | {t['win']:.2f} | {t['roi']:+.2f} "
                 f"| {t['blind_roi']:+.2f} | {t['delta']:+.2f} |")

    path = os.path.join(ROOT, f"NBA_PROPS_STACK{tag.upper()}_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
