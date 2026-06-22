"""Walk-forward ATS backtest of the regression MARGIN model (pred_margin).

Question: if we surface a SPREAD pick off the margin model (the side it says covers
the opener), what is the ATS record — overall, by season, and crucially on the
subset where the margin model AGREES with the classification cover model (`ph`)?
That agreement subset is the only set we'd surface as a confident play under the
proposed single-model display.

Grade-line honesty: the pick uses pred_margin vs the OPEN spread, so we grade vs
the OPEN spread (push on exact 0). ROI quoted at -110.
"""
import numpy as np
import pandas as pd
import os
from forecast_harness import build, train_predict, DATA, CONF, REG_EDGE


def roi(res):
    """res: array of 'W'/'L'/'P'. ROI per unit at -110."""
    w = np.sum(res == "W"); l = np.sum(res == "L"); n = w + l
    return (w * 0.9091 - l) / n if n else float("nan")


def line(label, res):
    w = int(np.sum(res == "W")); l = int(np.sum(res == "L")); p = int(np.sum(res == "P"))
    n = w + l
    hit = w / n * 100 if n else float("nan")
    print(f"  {label:30s} n={n:4d}  {w:4d}-{l:4d}-{p:<3d}  hit={hit:5.1f}%  ROI={roi(res)*100:+6.1f}%")


def main():
    m, BASE = build()
    od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
    od = od[["season", "home_ab", "away_ab", "open_spread", "close_spread"]]

    seasons = sorted(s for s in m.season.dropna().unique() if s >= 2021)
    allrows = []
    for target in seasons:
        te = train_predict(m, BASE, target)
        te = te[te.season == target].merge(od, on=["season", "home_ab", "away_ab"], how="left")
        te = te.dropna(subset=["pred_margin", "open_spread", "actual_margin", "ph"])
        if te.empty:
            continue
        # reg_edge vs OPEN: +ve => model expects home to beat the opener
        te["reg_edge_open"] = te.pred_margin + te.open_spread
        te["margin_home"] = te.reg_edge_open > 0                       # margin pick: home covers?
        te["clf_home"] = te.ph >= 0.5                                  # classification pick
        te["agree"] = te.margin_home == te.clf_home
        # ATS grade vs OPEN (push on 0)
        te["home_cov_open"] = te.actual_margin + te.open_spread
        def res(r):
            if r.home_cov_open == 0:
                return "P"
            home_covers = r.home_cov_open > 0
            return "W" if (home_covers == r.margin_home) else "L"
        te["res"] = te.apply(res, axis=1)
        te["target"] = target
        allrows.append(te)

    df = pd.concat(allrows, ignore_index=True)
    R = df.res.values

    print("=" * 72)
    print("MARGIN-MODEL ATS  (bet the side pred_margin says covers the OPENER)")
    print("=" * 72)
    line("ALL games (every pick)", R)
    print("\n  -- by season --")
    for t in seasons:
        sub = df[df.target == t]
        if len(sub):
            line(f"{int(t)}", sub.res.values)

    print("\n  -- by |reg_edge| threshold (points past the opener) --")
    for thr in [0, 1, 1.5, 2, 3, 4, 5]:
        sub = df[df.reg_edge_open.abs() >= thr]
        line(f"|reg_edge| >= {thr}", sub.res.values)

    print("\n  -- AGREEMENT split (margin model vs classification cover model) --")
    line("AGREE (same side)  << play set", df[df.agree].res.values)
    line("DISAGREE", df[~df.agree].res.values)
    print("\n  -- AGREE + |reg_edge| threshold (the surfaced-play candidates) --")
    for thr in [1.5, 2, 3]:
        sub = df[df.agree & (df.reg_edge_open.abs() >= thr)]
        line(f"AGREE & |reg_edge|>={thr}", sub.res.values)
    print("\n  -- for reference: classification (cover model) ATS vs OPEN, all --")
    def clf_res(r):
        if r.home_cov_open == 0:
            return "P"
        return "W" if ((r.home_cov_open > 0) == r.clf_home) else "L"
    df["clf_r"] = df.apply(clf_res, axis=1)
    line("classification ALL", df.clf_r.values)
    line("classification |edge|>=.03", df[(df.ph - 0.5).abs() >= CONF].clf_r.values)
    print(f"\n  agree rate: {df.agree.mean()*100:.1f}%   ({int(df.agree.sum())}/{len(df)})")


if __name__ == "__main__":
    main()
