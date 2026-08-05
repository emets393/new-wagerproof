#!/usr/bin/env python3
"""NBA 1H TOTAL model — the one market the zoo found, pressure-tested.

The zoo (nba_model.py / nba_model_fast.py) swept 6 markets x 3 framings x 13
algorithms. Everything died except the 1H total, where the boosted trees showed a
clean monotone confidence ladder in BOTH derivative framings, and the SHARE framing
carried ~4x the edge<->residual correlation of anything else in the sweep.

That is exactly what S7 and S8 predicted: the book's full-game numbers are sharp, but
it derives the 1H by a near-constant split (~0.501x the FG total) and that constant is
matchup-dependent in learnable ways. So this script models the SPLIT, not the game.

  SHARE     y = 1H_total / FG_total, no market column in the features.
            edge = share_hat * FG_total_line - posted_1H_line
            The FG line supplies the (sharp) level; the model only supplies the split.
  ANCHORED  y = 1H_total - posted_1H_line, market columns allowed as features.

What the fast pass could NOT settle, and this script does:
  * only 2 test seasons -> rolling-origin refits every ~2 weeks, so testing starts
    partway through the first lined season and n roughly doubles
  * n=250 at the top decile is small and boosters are seed-sensitive -> average over
    several seeds, and report the spread ACROSS seeds so seed-luck can't masquerade
    as signal
  * ~980 features on ~2.5k rows is a bad ratio -> train-fold-only correlation
    prefilter (leak-safe: the ranking never sees the test block)
  * is it just betting unders in a high-total era? -> over/under split
  * does it survive real juice, and dropping any one season?
  * is it independent of S7, or the same thing rediscovered?
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
SEEDS = (0, 7, 13)
TOPK = 250          # features kept by the train-fold correlation prefilter
MIN_TRAIN = 700     # rows before the first test block
BLOCK = "14D"       # rolling-origin refit cadence


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


def select(tr, cols, y, k=TOPK):
    """Rank features by |corr| with the target ON THE TRAINING FOLD ONLY."""
    sub = tr[cols]
    keep = [c for c in cols if sub[c].notna().mean() >= 0.60 and sub[c].nunique(dropna=True) > 1]
    if not keep:
        return []
    cc = tr[keep].corrwith(y).abs().replace([np.inf, -np.inf], np.nan).dropna()
    return list(cc.sort_values(ascending=False).head(k).index)


def walk(G, ycol, fcols, label):
    """Rolling-origin: refit every BLOCK, predict the next block, never look forward.
    Returns a DataFrame of per-seed-per-model predictions indexed like G."""
    G = G.sort_values("date")
    blocks = G.groupby(pd.Grouper(key="date", freq=BLOCK)).size()
    edges = pd.DataFrame(index=G.index)
    starts = [d for d in blocks.index if (G["date"] < d).sum() >= MIN_TRAIN]
    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else G["date"].max() + pd.Timedelta(days=1)
        tr = G[G["date"] < d0]
        te = G[(G["date"] >= d0) & (G["date"] < d1)]
        if len(te) == 0:
            continue
        ytr = tr[ycol]
        ok = ytr.notna()
        tr2, ytr = tr[ok.values], ytr[ok]
        use = select(tr2, fcols, ytr)
        if len(use) < 20:
            continue
        for seed in SEEDS:
            for mn, m in boosters(seed).items():
                try:
                    m.fit(tr2[use], ytr)
                    edges.loc[te.index, f"{label}|{mn}|{seed}"] = m.predict(te[use])
                except Exception as e:                      # noqa: BLE001
                    print(f"  !! {label}/{mn}/{seed}/{d0.date()}: {type(e).__name__} {e}")
    return edges


def grade(G, edge, mask, price_o, price_u, flat=False):
    m = mask & edge.notna() & G["_y01"].notna()
    n = int(m.sum())
    if n == 0:
        return 0, np.nan, np.nan
    over = edge[m] > 0
    win = np.where(over, G.loc[m, "_y01"], 1 - G.loc[m, "_y01"])
    dec = np.full(n, 1.909) if flat else np.where(over, price_o[m], price_u[m])
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

    L = ["# NBA 1H TOTAL model — pressure test", "",
         f"{len(G):,} lined games, seasons {sorted(G['season'].unique())}. Rolling-origin "
         f"refit every {BLOCK}, {len(SEEDS)} seeds x 3 boosters, top-{TOPK} train-fold "
         "features. Graded at the T-60 1H line and its real price. BE 52.4%.", ""]
    print(L[2])

    allf = [c for c in G.columns
            if c not in ("game.id", "event_id", "date", "season", "_resid", "_y01", "y_share")
            and not c.startswith("y_") and G[c].dtype.kind in "fiub"]
    f_nomkt = [c for c in allf if not is_mkt(c)]

    print("walking SHARE...")
    E1 = walk(G, "y_share", f_nomkt + ["t60_total_point"], "share")
    print("walking ANCHORED...")
    E2 = walk(G, "_resid", allf, "anch")

    # convert every raw prediction into an edge in 1H points (>0 => bet OVER)
    ED = pd.DataFrame(index=G.index)
    for c in E1.columns:
        ED[c] = E1[c] * G["t60_total_point"] - G["h1_total_line"]
    for c in E2.columns:
        ED[c] = E2[c]

    have = ED.notna().any(axis=1)
    G2, ED = G[have], ED[have]
    po, pu = G2["h1_ov"], G2["h1_un"]
    seasons = sorted(G2["season"].unique())
    L += [f"Test rows: {len(G2):,} " +
          ", ".join(f"{s}:{int((G2['season']==s).sum())}" for s in seasons), ""]

    def ladder(edge, name, lines, extra=""):
        lines += [f"\n### {name}{extra}\n",
                  "| cut | n | win% | ROI | flat-110 ROI | per-season |", "|---|---|---|---|---|---|"]
        for pct in (100, 50, 25, 15, 10, 5):
            thr = edge.abs().quantile(1 - pct / 100) if pct < 100 else -1
            m = edge.abs() >= thr
            n, w, r = grade(G2, edge, m, po, pu)
            _, _, rf = grade(G2, edge, m, po, pu, flat=True)
            per = []
            for s in seasons:
                ns, ws, _ = grade(G2, edge, m & (G2["season"] == s), po, pu)
                per.append(f"{ws:.0f}" if ns >= 25 else "-")
            lines.append(f"| top{pct}% | {n} | {w:.1f} | {r:+.1f} | {rf:+.1f} | "
                         f"{'/'.join(per)} |")

    # ---------------- per-framing and combined ensembles
    sh = [c for c in ED.columns if c.startswith("share|")]
    an = [c for c in ED.columns if c.startswith("anch|")]
    ens_sh, ens_an = ED[sh].mean(axis=1), ED[an].mean(axis=1)
    ens_all = ED[sh + an].mean(axis=1)

    L += ["## A — the three ensembles"]
    ladder(ens_sh, "SHARE ensemble (9 fits: 3 boosters x 3 seeds)", L)
    ladder(ens_an, "ANCHORED ensemble (9 fits)", L)
    ladder(ens_all, "COMBINED ensemble (18 fits)", L)

    # ---------------- seed dispersion: is this seed luck?
    L += ["\n## B — seed dispersion at top10% (share framing)\n",
          "| booster | seed | n | win% | ROI |", "|---|---|---|---|---|"]
    for mn in ("hgb", "lgbm", "xgb"):
        for seed in SEEDS:
            c = f"share|{mn}|{seed}"
            if c not in ED:
                continue
            e = ED[c]
            m = e.abs() >= e.abs().quantile(0.90)
            n, w, r = grade(G2, e, m, po, pu)
            L.append(f"| {mn} | {seed} | {n} | {w:.1f} | {r:+.1f} |")

    # ---------------- direction balance and absolute-edge ladder
    best = ens_sh
    m10 = best.abs() >= best.abs().quantile(0.90)
    L += ["\n## C — direction balance at top10% (share ensemble)\n",
          "| side | n | win% | ROI |", "|---|---|---|---|"]
    for nm, mm in (("model says OVER", m10 & (best > 0)), ("model says UNDER", m10 & (best < 0))):
        n, w, r = grade(G2, best, mm, po, pu)
        L.append(f"| {nm} | {n} | {w:.1f} | {r:+.1f} |")

    L += ["\n## D — absolute edge ladder (share ensemble, points of 1H total)\n",
          "| |edge| >= | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    for t in (0, 1, 2, 3, 4, 5):
        m = best.abs() >= t
        n, w, r = grade(G2, best, m, po, pu)
        per = []
        for s in seasons:
            ns, ws, _ = grade(G2, best, m & (G2["season"] == s), po, pu)
            per.append(f"{ws:.0f}" if ns >= 25 else "-")
        L.append(f"| {t} | {n} | {w:.1f} | {r:+.1f} | {'/'.join(per)} |")

    # ---------------- drop-one-season
    L += ["\n## E — drop-one-season robustness (share ensemble, top10%)\n",
          "| dropped | n | win% | ROI |", "|---|---|---|---|"]
    for s in seasons:
        n, w, r = grade(G2, best, m10 & (G2["season"] != s), po, pu)
        L.append(f"| {s} | {n} | {w:.1f} | {r:+.1f} |")

    ED.assign(season=G2["season"], date=G2["date"], event_id=G2["event_id"],
              resid=G2["_resid"], y01=G2["_y01"], h1_ov=po, h1_un=pu,
              h1_line=G2["h1_total_line"], fg_line=G2["t60_total_point"],
              ens_share=ens_sh, ens_anch=ens_an, ens_all=ens_all
              ).to_parquet(f"{OUT}/nba_h1_total_model_preds.parquet")

    path = os.path.join(ROOT, "NBA_H1_TOTAL_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}")
    print("\n".join(L[-40:]))


if __name__ == "__main__":
    main()
