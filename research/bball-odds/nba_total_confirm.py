#!/usr/bin/env python3
"""NBA full-game total: confirm or kill the one configuration the ablation liked.

WHAT THE ABLATION SAID. Of thirteen feature families, removing the MARKET family was the only
edit that turned the full model's ROI positive (top 25%: 53.4% vs a 51.0% in-slice baseline,
+1.9% ROI, against 51.7% / -1.3% with it in). The market family was also the worst performer
standing alone -- 45.6% at top 25%, i.e. reliably wrong. That is a coherent story: the line
level and its movement teach the classifier a pattern that inverts out of sample.

WHY THIS FILE EXISTS ANYWAY. "Best of thirteen ablations" is a selected result, and a selected
result is not a finding. Two things have to happen before it counts:

  1. LABEL SHUFFLE. Permute the outcome inside each season and rerun the identical pipeline.
     Whatever the shuffled runs achieve IS the null, and because they go through the same
     top-25% selection they price in the multiple comparisons the ablation spent.
  2. PHASES. Early / mid / late / postseason, separately. A pooled number that comes entirely
     from one part of the calendar is a different claim from one that holds all year, and only
     the phase table can tell them apart.

Every win rate is printed next to the best blind side computed INSIDE its own rows. Breakeven
at -110 is 52.4%.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("lab", os.path.join(ROOT, "nba_total_lab.py"))
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)

N_SHUFFLE = 6
SEEDS = (0, 7, 13)


def main():
    D = lab.build()
    F = lab.families(D)

    # NOMKT is the ablation's pick: everything except the line level, its movement, and the
    # book's own derived markets.
    nomkt = sorted({c for k, v in F.items() if k not in ("market", "deriv_mkt") for c in v})
    allc = sorted({c for v in F.values() for c in v})
    print(f"[cfg] NOMKT={len(nomkt)} cols, ALL={len(allc)} cols", flush=True)

    y = pd.Series(np.where(D["y_fg_tot_resid"] > 0, 1.0,
                           np.where(D["y_fg_tot_resid"] < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(lab.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(lab.to_dec(D["t60_total_under_price"]), index=D.index)
    dates = D["date"]

    X = D[nomkt].astype(float)
    X = X.loc[:, X.notna().mean() > 0.30]
    prob = lab.walk(X, dates, y, seeds=SEEDS, kinds=("lgbm", "hgb"))

    L = ["# NBA full-game total — confirming the no-market configuration", "",
         f"{int(y.notna().sum()):,} gradeable games, {X.shape[1]} features, seasons "
         f"{sorted(D['season'].unique())}. Trained on the residual vs the T-60 close. "
         f"Breakeven at -110 is 52.4%. `base` is the best blind side inside the same rows.", ""]

    # ---- phases -------------------------------------------------------------------------
    L += ["## By phase\n", "| phase | cut | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|"]
    for ph in ["EARLY", "MID", "LATE", "POST", "ALL"]:
        mk = None if ph == "ALL" else (D["phase"] == ph)
        for pct in (100, 25, 10):
            g = lab.cut(prob, y, po, pu, pct, mask=mk)
            if g["n"] == 0:
                continue
            L.append(f"| {ph} | top{pct}% | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    # ---- per season ---------------------------------------------------------------------
    # A pooled edge carried by one season is a coincidence with good manners.
    L += ["\n## By season (top 25%)\n", "| season | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|"]
    for s in sorted(D["season"].unique()):
        g = lab.cut(prob, y, po, pu, 25, mask=(D["season"] == s))
        if g["n"] == 0:
            continue
        L.append(f"| {s} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- the null -----------------------------------------------------------------------
    real25 = lab.cut(prob, y, po, pu, 25)
    real10 = lab.cut(prob, y, po, pu, 10)
    rng = np.random.default_rng(11)
    null25, null10 = [], []
    for i in range(N_SHUFFLE):
        ys = y.copy()
        # shuffle WITHIN season, so the null keeps each season's over/under mix and only the
        # game-to-game pairing is destroyed
        for s in D["season"].unique():
            m = (D["season"] == s) & y.notna()
            ys.loc[m] = rng.permutation(y.loc[m].values)
        ps = lab.walk(X, dates, ys, seeds=(i,), kinds=("lgbm",))
        a = lab.cut(ps, ys, po, pu, 25)
        b = lab.cut(ps, ys, po, pu, 10)
        null25.append(a["win"] - a["base"])
        null10.append(b["win"] - b["base"])
        print(f"[null {i+1}/{N_SHUFFLE}] top25 edge {null25[-1]:+.2f}  "
              f"top10 edge {null10[-1]:+.2f}", flush=True)

    def z(real, nulls):
        nulls = np.array(nulls, float)
        sd = nulls.std(ddof=1)
        return (real - nulls.mean()) / sd if sd > 1e-9 else np.nan

    e25, e10 = real25["win"] - real25["base"], real10["win"] - real10["base"]
    L += ["\n## Label-shuffle null\n",
          f"Outcome permuted within season, identical pipeline, {N_SHUFFLE} draws. The spread "
          f"of these is what this search finds on pure noise.", "",
          "| cut | real edge | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| top25% | {e25:+.2f} | {np.mean(null25):+.2f} | {np.std(null25, ddof=1):.2f} | "
          f"**{z(e25, null25):+.2f}** |",
          f"| top10% | {e10:+.2f} | {np.mean(null10):+.2f} | {np.std(null10, ddof=1):.2f} | "
          f"**{z(e10, null10):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    path = os.path.join(ROOT, "NBA_TOTAL_CONFIRM.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
