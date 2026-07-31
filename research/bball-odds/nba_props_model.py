#!/usr/bin/env python3
"""NBA player-prop model — per market, walk-forward, graded at real T-60 prices.

The baselines this has to beat are NOT 50%. The prop market has a standing over-shade,
so a model that simply learns "take the under" would look skilful while adding nothing:

    blind OVER  @ consensus   47.04%   -9.57 ROI
    blind UNDER @ consensus   52.96%   -3.71 ROI
    blind UNDER @ best line   54.26%   -1.09 ROI

So every cut below is reported alongside BLIND UNDER ON THE SAME ROWS. The only number
that means anything is the delta between them. A model whose top-decile ROI is +2 looks
great until you see blind under makes +2.5 on the identical props.

Two grading venues for the same picks:
  CONSENSUS  median line/price   -> the model's own edge
  BEST       best available      -> model edge + shopping
Reporting only the second would let line shopping masquerade as model skill.

LEAKAGE: the panel carries each prop's settled box score (mins/pts/reb/...) because it
is what grades the bet. Those are hard-blocked and the block is ASSERTED — one of them
slipping into X would make this whole file fiction.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingClassifier
import lightgbm as lgb
import xgboost as xgb

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
SEED = 0
MIN_TRAIN = 4000
BLOCK_MONTHS = 2

LEAK = {"actual", "over", "push", "mins", "pts", "reb", "ast", "fg3m", "blk", "stl",
        "resid_cons", "y_cons", "y_best_over", "y_best_under", "line", "over_dec",
        "under_dec"}
IDS = {"event_id", "player", "pkey", "date", "date_et", "commence_time", "season",
       "season_x", "season_y", "home_team", "away_team", "market", "best_over_book",
       "best_under_book", "game.id", "tid", "pid", "team_id"}


def clfs(seed):
    return {
        "lgbm": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.04, num_leaves=31,
                                   min_child_samples=60, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.6, reg_lambda=5.0,
                                   random_state=seed, verbose=-1, n_jobs=-1),
        "xgb": xgb.XGBClassifier(n_estimators=300, learning_rate=0.04, max_depth=5,
                                 min_child_weight=30, subsample=0.8, colsample_bytree=0.6,
                                 reg_lambda=5.0, random_state=seed, n_jobs=-1,
                                 tree_method="hist", eval_metric="logloss"),
        "hgb": HistGradientBoostingClassifier(max_iter=250, learning_rate=0.04,
                                              max_leaf_nodes=31, min_samples_leaf=60,
                                              l2_regularization=5.0, random_state=seed),
    }


def feature_cols(D):
    cols = [c for c in D.columns
            if c not in LEAK and c not in IDS and D[c].dtype.kind in "fiub"]
    assert not (set(cols) & LEAK), f"LEAK COLUMN IN X: {set(cols) & LEAK}"
    return cols


def walk(D, cols, ycol):
    """Rolling origin: refit every BLOCK_MONTHS on everything strictly earlier."""
    P = pd.DataFrame(index=D.index)
    mo = D["date"].dt.to_period("M")
    uniq = sorted(mo.unique())
    blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
    for blk in blocks:
        te = D.index[mo.isin(blk)]
        tr = D.index[(mo < blk[0]) & D[ycol].notna()]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        Xtr = D.loc[tr, cols].to_numpy(dtype=np.float32)
        ytr = D.loc[tr, ycol].to_numpy()
        Xte = D.loc[te, cols].to_numpy(dtype=np.float32)
        for mn, m in clfs(SEED).items():
            try:
                m.fit(Xtr, ytr)
                P.loc[te, mn] = m.predict_proba(Xte)[:, 1]
            except Exception as e:                                  # noqa: BLE001
                print(f"    !! {mn}/{blk[0]}: {type(e).__name__} {e}", flush=True)
    return P


def _venue(D, venue):
    if venue == "cons":
        return "y_cons", "cons_over_dec", "y_cons", "cons_under_dec"
    return "y_best_over", "best_over_dec", "y_best_under", "best_under_dec"


def grade(D, prob, pct, venue, force=None):
    """Bet the model's side (or force='under' for the blind baseline) on the top-pct rows."""
    yo, do, yu, du = _venue(D, venue)
    conf = (prob - 0.5).abs()
    ok = prob.notna() & D[yo].notna() & D[yu].notna()
    if ok.sum() < 50:
        return 0, np.nan, np.nan
    thr = conf[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (conf >= thr)
    over = (prob[m] > 0.5) if force is None else pd.Series(False, index=D.index[m])
    y = np.where(over, D.loc[m, yo], D.loc[m, yu])
    win = np.where(over, y, 1 - y)
    dec = np.where(over, D.loc[m, do], D.loc[m, du])
    g = ~np.isnan(dec) & ~np.isnan(win)
    win, dec = win[g], dec[g]
    if len(win) < 50:
        return 0, np.nan, np.nan
    return len(win), 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    D = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(columns={"season_x": "season"})
    D["date"] = pd.to_datetime(D["date"])
    D = D[D["gp_prior"] >= 5].sort_values("date").reset_index(drop=True)
    seasons = sorted(D["season"].unique())

    L = ["# NBA player props — model vs the market's own shade", "",
         f"{len(D):,} props (5+ prior games), seasons {seasons}. Rolling origin, refit "
         f"every {BLOCK_MONTHS} months, 3 boosters, per market.", "",
         "**Every model cut is shown against BLIND UNDER on the identical rows.** The "
         "prop market has a standing over-shade, so beating 50% proves nothing; only the "
         "delta vs blind under is the model's contribution.", ""]
    print(L[2], flush=True)

    rows = []
    for mk in sorted(D["market"].unique()):
        M = D[D["market"] == mk].copy().reset_index(drop=True)
        cols = [c for c in feature_cols(M)
                if M[c].notna().mean() >= 0.5 and M[c].nunique() > 1]
        P = walk(M, cols, "y_cons")
        if P.empty or P.notna().sum().sum() == 0:
            print(f"  {mk}: no folds", flush=True)
            continue
        prob = P.mean(axis=1)
        M["_p"] = prob
        M[["event_id", "market", "pkey", "date", "_p"]].to_parquet(
            f"{OUT}/nba_props_pred_{mk}.parquet", index=False)
        for pct in (100, 50, 25, 10, 5):
            for venue in ("cons", "best"):
                n, w, r = grade(M, prob, pct, venue)
                bn, bw, br = grade(M, prob, pct, venue, force="under")
                rows.append(dict(market=mk, cut=f"top{pct}%", venue=venue, n=n, win=w,
                                 roi=r, blind_win=bw, blind_roi=br, delta=r - br))
        n, w, r = grade(M, prob, 25, "best")
        _, bw, br = grade(M, prob, 25, "best", force="under")
        u = 100 * (prob < 0.5).mean()
        print(f"  {mk}: {len(M):,} rows {len(cols)} feats | top25%@best n={n} "
              f"{w:.1f}% {r:+.1f} vs blind {br:+.1f} (delta {r-br:+.1f}) | "
              f"picks under {u:.0f}%", flush=True)

    R = pd.DataFrame(rows)
    R.to_csv(os.path.join(ROOT, "nba_props_model_results.csv"), index=False)

    L += ["## Pooled across markets — model vs blind under on the same rows\n",
          "| cut | venue | n | model win% | model ROI | blind-under ROI | delta |",
          "|---|---|---|---|---|---|---|"]
    for pct in (100, 50, 25, 10, 5):
        for venue in ("cons", "best"):
            s = R[(R["cut"] == f"top{pct}%") & (R["venue"] == venue)].dropna(subset=["roi"])
            n = s["n"].sum()
            if n == 0:
                continue
            wt = lambda c: (s[c] * s["n"]).sum() / n                    # noqa: E731
            L.append(f"| top{pct}% | {venue} | {n:,} | {wt('win'):.2f} | {wt('roi'):+.2f} "
                     f"| {wt('blind_roi'):+.2f} | {wt('roi')-wt('blind_roi'):+.2f} |")

    L += ["\n## Per market at top25%, best line\n",
          "| market | n | model win% | model ROI | blind-under ROI | delta |",
          "|---|---|---|---|---|---|"]
    for mk in sorted(R["market"].unique()):
        s = R[(R["market"] == mk) & (R["cut"] == "top25%") & (R["venue"] == "best")]
        if len(s) and pd.notna(s.iloc[0]["roi"]):
            s = s.iloc[0]
            L.append(f"| {mk} | {s['n']:,} | {s['win']:.2f} | {s['roi']:+.2f} | "
                     f"{s['blind_roi']:+.2f} | {s['delta']:+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
