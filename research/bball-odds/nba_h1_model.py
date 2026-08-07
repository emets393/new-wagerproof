#!/usr/bin/env python3
"""A first-half model fit DIRECTLY on first-half outcomes, plus the classifier framing.

Two things the full-game sweep did not do, both pointed at by its own results.

WHY THE FIRST HALF, SPECIFICALLY.
Every NBA edge this project has ever validated lives in a first-half derivative. S7 (both
teams on the same 3+ game 1H o/u streak -> fade the 1H total, 61.9% / +18.1%) and S8 (one
moderate scorer freshly out, opponent healthy, close game -> back them on the 1H spread,
60.9% / +16.0%) both died when the identical idea was tested on the full-game market. The
mechanism is that the 1H line is not independently handicapped -- it is derived from the
full-game number -- so it inherits the full-game line's error AND adds the derivation's.

`nba_open_markets.py` already tried to exploit that by SCALING the full-game prediction by
a first-half share. That was null across the board. But scaling can only find error in the
derivation, never error the market makes about first halves specifically: pace, starter
minutes patterns, rotation depth, and rest all hit the two halves differently, and a
scaled full-game number is blind to every one of them by construction. So fit the first
half on its own.

WHY A CLASSIFIER.
The regression models optimise MAE against the final score. That is not the betting
objective. A bet only cares about mass on one side of ONE threshold, and the props sweep
already proved these two come apart hard: the forecast-combination blend cut MAE by 8.3%
on blocks and moved the betting delta by +0.40. So fit P(over) / P(cover) directly against
the open line, where the loss function IS the thing being bet.

Graded at the open where an opening price exists; the 1H markets in this data are T-60
only and are labelled as such. Every post-open column stays banned from X.
"""
import os
import re
import warnings

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
for v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(v, "2")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
TOPK = 180
MIN_TRAIN = 1200
SEED = 0
CUTS = (100, 50, 25, 10)

# Same hard post-open ban as the full-game model. h1_/tt_ are banned as FEATURES even
# though they are the targets' own markets: they are struck after the open, so reading
# them would be reading the future relative to the number being bet.
BAN_PAT = re.compile(r"^(t24_|t4_|t60_|mkt_|y_|h1_|tt_)")
# "_y" is the target this script builds for each section. BAN_PAT is anchored `^y_`, which
# does NOT match a leading underscore, so the first run handed every classifier its own
# label as a feature and duly reported a 100% win rate in all four sections. Naming it here
# is not enough on its own -- feature_cols takes the target and refuses to return it, so a
# future rename cannot reintroduce this silently.
BAN_EXACT = {"game.id", "event_id", "bdl_id", "date", "season", "game.postseason", "_y"}


def feature_cols(D, ycol=None):
    cols = [c for c in D.columns
            if not BAN_PAT.match(c) and c not in BAN_EXACT and D[c].dtype.kind in "fiub"]
    bad = [c for c in cols if BAN_PAT.match(c)]
    assert not bad, f"POST-OPEN COLUMN IN X: {bad}"
    assert ycol is None or ycol not in cols, f"TARGET LEAKED INTO X: {ycol}"
    return cols


def as_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def clfs():
    """Classifiers only. The target is a side, so fit a side."""
    return {
        "lgbm": lgb.LGBMClassifier(n_estimators=500, learning_rate=0.03, num_leaves=31,
                                   min_child_samples=40, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.5, reg_lambda=10.0,
                                   random_state=SEED, verbose=-1, n_jobs=3),
        "xgb": xgb.XGBClassifier(n_estimators=500, learning_rate=0.03, max_depth=4,
                                 min_child_weight=20, subsample=0.8, colsample_bytree=0.5,
                                 reg_lambda=10.0, random_state=SEED, n_jobs=3,
                                 tree_method="hist", verbosity=0, eval_metric="logloss"),
        "rf": RandomForestClassifier(n_estimators=400, min_samples_leaf=20,
                                     max_features=0.3, random_state=SEED, n_jobs=3),
        "et": ExtraTreesClassifier(n_estimators=400, min_samples_leaf=20,
                                   max_features=0.3, random_state=SEED, n_jobs=3),
        "logit": LogisticRegression(C=0.05, max_iter=2000, random_state=SEED),
    }


def walk_forward(D, ycol, tag):
    """Rolling origin by month; feature selection inside the train fold, never outside."""
    D = D.sort_values("date").reset_index(drop=True)
    mo = D["date"].dt.to_period("M")
    cols = feature_cols(D, ycol)
    names = list(clfs()) + ["blend"]
    for nm in names:
        D[f"q_{nm}"] = np.nan
    months = sorted(mo.unique())
    for i, m in enumerate(months):
        te = np.where(mo == m)[0]
        tr = np.where(mo < m)[0]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        ytr = D[ycol].to_numpy()[tr]
        if len(np.unique(ytr[~np.isnan(ytr)])) < 2:
            continue
        good = ~np.isnan(ytr)
        tr, ytr = tr[good], ytr[good]
        Xtr = np.nan_to_num(D.loc[D.index[tr], cols].to_numpy(dtype=float))
        # selection inside the fold: choosing columns on the full frame would let the
        # test months decide what the model is even allowed to look at
        sel = lgb.LGBMClassifier(n_estimators=150, learning_rate=0.05, num_leaves=31,
                                 colsample_bytree=0.5, random_state=SEED, verbose=-1,
                                 n_jobs=3)
        sel.fit(Xtr, ytr)
        keep = np.argsort(sel.feature_importances_)[::-1][:TOPK]
        Xtr, Xte = Xtr[:, keep], np.nan_to_num(
            D.loc[D.index[te], cols].to_numpy(dtype=float))[:, keep]
        sc = StandardScaler().fit(Xtr)
        preds = {}
        for nm, mdl in clfs().items():
            a, b = (sc.transform(Xtr), sc.transform(Xte)) if nm == "logit" else (Xtr, Xte)
            try:
                mdl.fit(a, ytr)
                preds[nm] = mdl.predict_proba(b)[:, 1]
            except Exception:
                continue
            D.loc[D.index[te], f"q_{nm}"] = preds[nm]
        if preds:
            D.loc[D.index[te], "q_blend"] = np.mean(list(preds.values()), axis=0)
        print(f"    {tag} {m} train={len(tr):,} test={len(te)}", flush=True)
    return D, names


def grade(D, qcol, win, dec, clv, seasons):
    """Bet the side the classifier prefers, ranked by |p - 0.5|."""
    rows = []
    conf = (D[qcol] - 0.5).abs().to_numpy()
    side = (D[qcol] > 0.5).to_numpy()
    # dec is (n, 2): column 0 is side A's price, column 1 is side B's. Pick the side's own
    # price BEFORE the finite check, or the mask is (n,2) and the & below cannot broadcast
    dec = np.where(side, dec[:, 0], dec[:, 1]) if dec.ndim == 2 else dec
    ok = np.isfinite(conf) & np.isfinite(dec) & np.isfinite(win)
    if ok.sum() < 300:
        return rows
    for pct in CUTS:
        thr = np.nanquantile(conf[ok], 1 - pct / 100) if pct < 100 else -1
        m = ok & (conf >= thr)
        if m.sum() < 80:
            continue
        w = np.where(side[m], win[m], 1 - win[m])
        d = dec[m]
        c = np.where(side[m], clv[m], -clv[m])
        per = []
        for s in seasons:
            k = D["season"].to_numpy()[m] == s
            per.append(f"{100*w[k].mean():.0f}" if k.sum() >= 25 else "-")
        # No -110 market is beatable at 65% over a whole population. If the widest cut
        # clears that, something is leaking and the run must die rather than write a brief.
        assert not (pct == 100 and w.mean() > 0.65), \
            f"IMPLAUSIBLE {100*w.mean():.1f}% on all {m.sum()} rows of {qcol} — leak"
        rows.append(dict(cut=f"top{pct}%", n=int(m.sum()), win=100 * w.mean(),
                         roi=roi(w, d), clv=np.nanmean(c),
                         clv_pos=100 * np.nanmean(c > 0), side=100 * side[m].mean(),
                         per="/".join(per)))
    return rows


def table(L, title, note, res):
    L += [f"\n## {title}\n", note, "",
          "| method | cut | n | win% | ROI | CLV pts | CLV+ % | side A % | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    for nm, rows in res:
        for r in rows:
            L.append(f"| {nm} | {r['cut']} | {r['n']:,} | {r['win']:.1f} | "
                     f"{r['roi']:+.2f} | {r['clv']:+.3f} | {r['clv_pos']:.1f} | "
                     f"{r['side']:.0f} | {r['per']} |")


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    D["date"] = pd.to_datetime(D["date"])
    D["season"] = D["season"].astype(str)
    dup = set(D.loc[D.duplicated("game.id", keep=False), "game.id"])
    D = D[~D["game.id"].isin(dup)].reset_index(drop=True)
    seasons = sorted(D["season"].unique())
    print(f"{len(D):,} games after dropping {len(dup)} ambiguous odds joins", flush=True)

    L = ["# NBA — first-half model and the classifier framing", "",
         f"{len(D):,} games, seasons {seasons}. Rolling origin, refit monthly, top-"
         f"{TOPK} features chosen inside each train fold, every post-open column banned "
         "from X and the ban asserted.", "",
         "Two things the full-game regression sweep did not do. **First half fit "
         "directly**, because both of this project's validated NBA edges (S7, S8) live in "
         "a 1H derivative and both died on the full-game market, and because scaling a "
         "full-game number into the first half -- which `nba_open_markets.py` already "
         "tried, null -- is blind to anything the market gets wrong about first halves "
         "specifically. **Classifiers**, because a bet cares about mass on one side of "
         "one threshold and MAE does not.", "",
         "The full-game sections are graded at the OPEN. The 1H markets exist at T-60 "
         "only in this data and are graded there, which is a strictly harder bar; they "
         "are not open-line results.", ""]

    # ------------------------------------------------ A. full game, classifier framing
    d = D[D["open_total_point"].notna() & D["y_fg_total"].notna()].copy()
    d = d[d["y_fg_total"] != d["open_total_point"]]
    d["_y"] = (d["y_fg_total"] > d["open_total_point"]).astype(float)
    d, names = walk_forward(d, "_y", "FG-TOTAL")
    dec = np.column_stack([as_dec(d["open_total_over_price"]),
                           as_dec(d["open_total_under_price"])])
    clv = (d["t60_total_point"] - d["open_total_point"]).to_numpy()
    table(L, "A — FULL-GAME TOTAL, classifier at the open (side A = over)",
          "P(over the OPENING total), fit directly. `CLV` is signed to the side taken.",
          [(nm, grade(d, f"q_{nm}", d["_y"].to_numpy(), dec, clv, seasons))
           for nm in names])

    d = D[D["open_spread_home_point"].notna() & D["y_fg_margin"].notna()].copy()
    d = d[d["y_fg_margin"] != -d["open_spread_home_point"]]
    d["_y"] = (d["y_fg_margin"] > -d["open_spread_home_point"]).astype(float)
    d, names = walk_forward(d, "_y", "FG-SPREAD")
    dec = np.column_stack([as_dec(d["open_spread_home_price"]),
                           as_dec(d["open_spread_away_price"])])
    clv = (d["open_spread_home_point"] - d["t60_spread_home_point"]).to_numpy()
    table(L, "B — FULL-GAME SPREAD, classifier at the open (side A = home)",
          "P(home covers the OPENING spread), fit directly.",
          [(nm, grade(d, f"q_{nm}", d["_y"].to_numpy(), dec, clv, seasons))
           for nm in names])

    # ------------------------------------------------- C/D. first half, fit directly
    d = D[D["h1_total_line"].notna() & D["y_h1_total"].notna()].copy()
    d = d[d["y_h1_total"] != d["h1_total_line"]]
    if len(d) > 1500:
        d["_y"] = (d["y_h1_total"] > d["h1_total_line"]).astype(float)
        d, names = walk_forward(d, "_y", "H1-TOTAL")
        dec = np.column_stack([as_dec(d["h1_ov"]), as_dec(d["h1_un"])])
        table(L, "C — 1H TOTAL, fit directly — T-60 (side A = over)",
              "P(over the first-half total), fit on first-half outcomes rather than "
              "scaled down from a full-game number. CLV is unavailable: there is no "
              "opening 1H line to move from.",
              [(nm, grade(d, f"q_{nm}", d["_y"].to_numpy(), dec,
                          np.zeros(len(d)), seasons)) for nm in names])

    d = D[D["h1_spread"].notna() & D["y_h1_margin"].notna()].copy()
    d = d[d["y_h1_margin"] != -d["h1_spread"]]
    if len(d) > 1500:
        d["_y"] = (d["y_h1_margin"] > -d["h1_spread"]).astype(float)
        d, names = walk_forward(d, "_y", "H1-SPREAD")
        dec = np.column_stack([as_dec(d["h1_sp_h"]), as_dec(d["h1_sp_a"])])
        table(L, "D — 1H SPREAD, fit directly — T-60 (side A = home)",
              "P(home covers the first-half spread), fit on first-half outcomes.",
              [(nm, grade(d, f"q_{nm}", d["_y"].to_numpy(), dec,
                          np.zeros(len(d)), seasons)) for nm in names])

    path = os.path.join(ROOT, "NBA_H1_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
