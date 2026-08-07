#!/usr/bin/env python3
"""The FG spread with standings context added. Does the late-season inversion go away?

THE ONE QUESTION

v1/v2 saw 977 features, all box-score derived, and NONE describing where a team sits in the
standings. Graded by phase, the late window was anti-informative: -7.3 / -11.0 / -13.1 /
-16.1 against the naive rule as the model's own confidence cut tightened, averaged over
nine method families. Monotone and wrong-signed.

`nba_dead_home.py` then showed what the model was missing is worth 62.3% -- late-season
games where the HOME team is eliminated or tanking are games where the favourite covers
62.3% instead of its usual 53.05%. That is a hand-built rule on two flags.

So: hand the model the same flags and refit. Three outcomes, all informative.

  The late window turns positive       the inversion was a missing-feature problem, the
                                       model can learn the effect itself, and it will find
                                       more of them than two flags can express.
  The late window stops being wrong    the features inoculate it without adding edge. Use
  but does not turn positive           the hand rule and gate the model out of late games.
  Nothing changes                      the inversion is not about standings and the
                                       dead-home rule works for some other reason. Would
                                       force a rethink of the mechanism story.

WHAT CHANGED FROM v2

  FRAMING     margin, not residual. v2 ran both on identical folds and the residual
              framing lost in all four phases (early +3.60 vs +5.53, playoffs +14.58 vs
              +23.52). That question is settled; only margin is fit here.
  FEATURES    + the 40 `st_*` columns from `nba_standings_features.py`. All built from the
              schedule and final scores of games played strictly before tip.
  FITS        pooled, plus a LATE-ONLY fit. A pooled model spends its capacity on the
              4,000 games where standings mean nothing; the late-only fit sees 1,800 games
              in which they always do. `only_phase` takes a phase NAME, never a mask --
              this function sorts by date and resets the index, so a caller-built mask
              silently reindexes onto different games.

Every number is graded against the OPENING spread and reported next to the naive rule for
that window: blind home early and in the playoffs, blind FAVOURITE late (which covers
53.05%, not 50% -- quoting a late-season favourite-heavy model against a coin overstates
it by three points).
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
SEED = 0
CUTS = (100, 50, 25, 10)
PHASES = ("early", "mid", "late", "playoffs")
NAIVE = {"early": "home", "mid": "home", "late": "fav", "playoffs": "home"}

BAN_PAT = re.compile(r"^(t24_|t4_|t60_|mkt_|y_|h1_|tt_)")
BAN_EXACT = {"game.id", "event_id", "bdl_id", "date", "season", "phase", "_resid"}


def feature_cols(D, ycol=None):
    cols = [c for c in D.columns
            if not BAN_PAT.match(c) and c not in BAN_EXACT and D[c].dtype.kind in "fiub"]
    assert not [c for c in cols if BAN_PAT.match(c)], "POST-OPEN COLUMN IN X"
    assert ycol is None or ycol not in cols, f"TARGET LEAKED INTO X: {ycol}"
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
                                  random_state=SEED, verbose=-1, n_jobs=2),
        "xgb": xgb.XGBRegressor(n_estimators=600, learning_rate=0.03, max_depth=4,
                                min_child_weight=20, subsample=0.8, colsample_bytree=0.5,
                                reg_lambda=10.0, random_state=SEED, n_jobs=2,
                                tree_method="hist", verbosity=0),
        "hgb": HistGradientBoostingRegressor(max_iter=400, learning_rate=0.04,
                                             max_leaf_nodes=31, min_samples_leaf=40,
                                             l2_regularization=5.0, random_state=SEED),
        "rf": RandomForestRegressor(n_estimators=300, min_samples_leaf=15,
                                    max_features=0.3, random_state=SEED, n_jobs=2),
        "et": ExtraTreesRegressor(n_estimators=300, min_samples_leaf=15,
                                  max_features=0.3, random_state=SEED, n_jobs=2),
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=300.0)),
        "enet": make_pipeline(StandardScaler(),
                              ElasticNet(alpha=0.15, l1_ratio=0.4, max_iter=3000)),
        "mlp": make_pipeline(StandardScaler(),
                             MLPRegressor(hidden_layer_sizes=(96, 32), alpha=1.0,
                                          max_iter=400, early_stopping=True,
                                          random_state=SEED)),
    }


def add_phase(D):
    gp = np.minimum(D["h_gp"].to_numpy(dtype=float), D["a_gp"].to_numpy(dtype=float))
    post = D["game.postseason"].to_numpy(dtype=float) > 0
    D["phase"] = np.where(post, "playoffs",
                          np.where(gp < 15, "early", np.where(gp < 50, "mid", "late")))
    D["ph_min_gp"] = gp
    D["ph_is_post"] = post.astype(float)
    D["ph_early"] = (D["phase"] == "early").astype(float)
    D["ph_late"] = (D["phase"] == "late").astype(float)
    return D


def walk_forward(D, ycol, only_phase=None, min_train=1200, tag=""):
    D = D.sort_values("date").reset_index(drop=True)
    idx = D.index if only_phase is None else D.index[D["phase"] == only_phase]
    cols = feature_cols(D, ycol)
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
                                random_state=SEED, verbose=-1, n_jobs=2)
        sel.fit(np.nan_to_num(Xtr_all), ytr)
        keep = np.argsort(sel.feature_importances_)[::-1][:TOPK]
        Xtr = np.nan_to_num(Xtr_all[:, keep])
        Xte = np.nan_to_num(D.loc[te, cols].to_numpy(dtype=np.float32)[:, keep])
        preds = []
        for nm, m in models().items():
            try:
                m.fit(Xtr, ytr)
                D.loc[te, f"p_{nm}"] = m.predict(Xte)
                preds.append(D.loc[te, f"p_{nm}"].to_numpy())
            except Exception as e:                       # noqa: BLE001
                print(f"    {nm} failed {blk}: {e}", flush=True)
        if preds:
            D.loc[te, "p_blend"] = np.mean(preds, axis=0)
        print(f"    {tag} {blk} train={len(tr):,} test={len(te):,}", flush=True)
    return D, names


def report(d, names, seasons, title, L):
    """Grade every family at every cut, against the window's own naive rule."""
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    dh, da = (american_to_dec(d["open_spread_home_price"]),
              american_to_dec(d["open_spread_away_price"]))
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
    ph = d["phase"].iloc[0] if d["phase"].nunique() == 1 else "mixed"
    n_home = (sp < 0) if NAIVE.get(ph, "home") == "fav" else np.ones(len(sp), dtype=bool)
    nwin = np.where(n_home, (y > -sp).astype(float), (y < -sp).astype(float))
    ndec = np.where(n_home, dh, da)
    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    b = np.digitize(np.abs(sp), edges[1:-1])

    def cell(sel):
        tot = wsum = 0.0
        for k in np.unique(b[sel]):
            w = (b[sel] == k).sum()
            pool = live & (b == k)
            if pool.sum() < 40:
                continue
            tot += w * roi(nwin[pool], ndec[pool])
            wsum += w
        return tot / wsum if wsum else np.nan

    L += [f"\n### {title}\n",
          f"naive ({NAIVE.get(ph, 'home')}) covers **{100*nwin[live].mean():.2f}%** here "
          f"on {int(live.sum()):,} games — that is the baseline, not 50%.", "",
          "| method | cut | n | win% | ROI | delta cell | naive share | by season |",
          "|---|---|---|---|---|---|---|---|"]
    best = []
    for nm in names:
        e = (d[f"p_{nm}"] + d["open_spread_home_point"]).to_numpy(dtype=float)
        take = e > 0
        win = np.where(take, (y > -sp).astype(float), (y < -sp).astype(float))
        dec = np.where(take, dh, da)
        ok = live & np.isfinite(e)
        if ok.sum() < 150:
            continue
        a = np.abs(e)
        for pct in CUTS:
            m = ok & (a >= np.nanquantile(a[ok], 1 - pct / 100)) if pct < 100 else ok
            if m.sum() < 60:
                continue
            dc = roi(win[m], dec[m]) - cell(m)
            per = []
            for s in seasons:
                k = d["season"].to_numpy()[m] == s
                per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 20 else "-")
            L.append(f"| {nm} | top{pct}% | {m.sum():,} | {100*win[m].mean():.1f} | "
                     f"{roi(win[m], dec[m]):+.2f} | **{dc:+.2f}** | "
                     f"{100*(take[m] == n_home[m]).mean():.0f}% | {'/'.join(per)} |")
            best.append((pct, dc))
    # the family AVERAGE per cut is the honest summary -- it cannot be cherry-picked
    L.append("")
    for pct in CUTS:
        v = [dc for p, dc in best if p == pct]
        if v:
            L.append(f"- mean delta cell across all families at top{pct}%: "
                     f"**{np.mean(v):+.2f}**")


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    D["date"] = pd.to_datetime(D["date"])
    D["season"] = D["season"].astype(str)
    dup = set(D.loc[D.duplicated("game.id", keep=False), "game.id"])
    D = D[~D["game.id"].isin(dup)].reset_index(drop=True)
    D = D.merge(S, on="game.id", how="left")
    D = add_phase(D)
    seasons = sorted(D["season"].unique())
    nst = len([c for c in D.columns if c.startswith("st_")])
    print(f"{len(D):,} games, {nst} standings features added, seasons {seasons}",
          flush=True)

    L = ["# NBA full-game spread v3 — with standings context", "",
         f"Same folds, same nine families, margin target. The only change from v2 is "
         f"{nst} `st_*` columns describing where each team sits in the standings, built "
         "from games played strictly before tip.", "",
         "**Baselines differ by window.** Blind home covers ~48.7% early and mid; blind "
         "FAVOURITE covers 53.05% late. Each table states its own. Breakeven at -110 is "
         "52.4%. `delta cell` is ROI minus that window's naive rule reweighted to the "
         "selection's own |open spread| bucket mix.", "",
         "The v2 numbers to beat, mean delta cell across all families:", "",
         "| phase | top100% | top50% | top25% | top10% |", "|---|---|---|---|---|",
         "| early | -0.2 | +0.9 | +4.0 | +5.5 |",
         "| mid | +0.8 | +2.2 | +3.1 | +3.0 |",
         "| late | **-7.3** | **-11.0** | **-13.1** | **-16.1** |",
         "| playoffs | +5.5 | +15.2 | +23.5 | +23.5 |", ""]

    print("\n=== pooled fit, margin target, with standings ===", flush=True)
    P, names = walk_forward(D.copy(), "y_fg_margin", tag="pooled")
    P.to_parquet(f"{OUT}/nba_spread_v3_pooled.parquet", index=False)
    L += ["\n## Pooled fit, graded by phase"]
    for ph in PHASES:
        d = P[P["phase"] == ph].reset_index(drop=True)
        if len(d) >= 250:
            report(d, names, seasons, f"{ph} (pooled fit)", L)

    print("\n=== late-only fit ===", flush=True)
    Lt, _ = walk_forward(D.copy(), "y_fg_margin", only_phase="late", min_train=400,
                         tag="late")
    Lt = Lt[Lt["phase"] == "late"].reset_index(drop=True)
    Lt.to_parquet(f"{OUT}/nba_spread_v3_late.parquet", index=False)
    L += ["\n## Late-only fit\n",
          "Trained and tested inside the late window only, so its capacity goes to the "
          "1,800 games where standings always matter instead of the 4,000 where they "
          "never do."]
    report(Lt, names, seasons, "late (late-only fit)", L)

    path = os.path.join(ROOT, "NBA_SPREAD_V3_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
