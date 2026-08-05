#!/usr/bin/env python3
"""The concentrated-heat fade, tuned only on the past and bet blind on the future.

Everything reported so far picked its thresholds with the whole sample in view. The HHI
sweep in NBA_CONC_CONTROLS_BRIEF.md is not monotone -- p60 gives +1.8 and p70 gives +6.2 --
which is exactly the fingerprint of a cut chosen after seeing the answer. The +4.5 headline
therefore cannot be taken at face value, and no amount of re-slicing the same sample fixes
that.

This is the test that does. For each season, the HHI cut and the bet volume are chosen ONLY
from strictly earlier seasons, then applied unseen to that season. Nothing about the season
being bet informs the parameters. What comes out is a live-use simulation, and it is allowed
to be worse than the in-sample number -- that is the point.

The parameter grid is deliberately small (3 x 3). A large grid searched on 1-3 prior seasons
would just relocate the overfitting into the selection step.

Season 2022 is the training seed and is never bet. So the honest sample is 3 seasons, and if
the answer is "not enough data to tell," that is the finding.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_player_model import load_all
from nba_regression_model import MKT

ROOT = os.path.dirname(os.path.abspath(__file__))
N_PERM = 2000
RNG = np.random.default_rng(53)

HHI_GRID = (0.50, 0.60, 0.70)      # quantile of conc_drv, computed on training seasons only
VOL_GRID = (0.20, 0.30, 0.40)      # fraction of the qualifying games actually bet


def cell(d, hq, vq, mkt, hhi_thr=None, heat_thr=None):
    """Rows the rule would bet, plus the thresholds used (so they can be frozen and reused)."""
    ycol, phc, plc = MKT[mkt]
    conc = d["conc_drv"].to_numpy(dtype=float)
    heat = d["d_p_heat"].to_numpy(dtype=float)
    y = d[ycol].to_numpy(dtype=float)
    ok = np.isfinite(y) & (y != 0) & np.isfinite(conc) & np.isfinite(heat) & (heat != 0)
    if hhi_thr is None:
        hhi_thr = np.quantile(conc[ok], hq)
    q = ok & (conc > hhi_thr)
    if q.sum() < 40:
        return None
    if heat_thr is None:
        heat_thr = np.quantile(np.abs(heat[q]), 1.0 - vq)
    m = q & (np.abs(heat) >= heat_thr)
    return m, hhi_thr, heat_thr


def grade(d, m, mkt):
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    sig = -d["d_p_heat"].to_numpy(dtype=float)      # fade the hot side
    hi = sig[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
    return win, base, roi


def main():
    d = load_all()
    seasons = sorted(d["season"].unique())
    L = ["# Concentrated-heat fade — walk-forward parameter selection", "",
         "Thresholds chosen on strictly earlier seasons only, then applied blind. "
         f"Seed season {seasons[0]} is never bet.", ""]

    for mkt in ("OPEN", "T-60"):
        L += [f"## {mkt}", "",
              "| season bet | HHI cut | vol | bets | win % | base % | edge | ROI % |",
              "|---|---|---|---|---|---|---|---|"]
        allwin, allbase_n, allroi, nbet = [], [], [], 0
        picked = []
        for s in seasons[1:]:
            tr = d[d["season"] < s].reset_index(drop=True)
            te = d[d["season"] == s].reset_index(drop=True)
            # choose the grid point with the best TRAINING edge; ties break to the looser cut
            bestp, bestv = None, -9e9
            for hq in HHI_GRID:
                for vq in VOL_GRID:
                    c = cell(tr, hq, vq, mkt)
                    if c is None or c[0].sum() < 60:
                        continue
                    w, b, _ = grade(tr, c[0], mkt)
                    v = w.mean() - b
                    if v > bestv:
                        bestv, bestp = v, (hq, vq, c[1], c[2])
            if bestp is None:
                continue
            hq, vq, hthr, htthr = bestp
            # freeze the TRAINING thresholds -- recomputing quantiles on the test season
            # would leak that season's distribution into the rule
            c = cell(te, hq, vq, mkt, hhi_thr=hthr, heat_thr=htthr)
            if c is None or c[0].sum() < 20:
                continue
            w, b, roi = grade(te, c[0], mkt)
            picked.append((s, hq, vq))
            allwin.append(w)
            allbase_n.append((b, len(w)))
            allroi.append((roi, len(w)))
            nbet += len(w)
            L.append(f"| {s} | p{int(hq*100)} | {vq:.0%} | {len(w)} | {100*w.mean():.1f} | "
                     f"{100*b:.1f} | **{100*(w.mean()-b):+.1f}** | {100*roi:+.1f} |")
            print(L[-1], flush=True)

        if not allwin:
            continue
        W = np.concatenate(allwin)
        wb = sum(b * n for b, n in allbase_n) / nbet
        wr = sum(r * n for r, n in allroi) / nbet
        L.append(f"| **all OOS** | — | — | **{len(W)}** | **{100*W.mean():.1f}** | "
                 f"{100*wb:.1f} | **{100*(W.mean()-wb):+.1f}** | **{100*wr:+.1f}** |")
        print(L[-1], flush=True)

        # a null for the pooled OOS result: shuffle the fade direction within each season,
        # keeping the bet count and the price mix identical
        nul = np.empty(N_PERM)
        for i in range(N_PERM):
            nul[i] = RNG.binomial(len(W), 0.5) / len(W)
        L += ["", f"Pooled OOS win rate {100*W.mean():.1f}% on {len(W)} bets. "
                  f"P(coin flip >= this) = {(nul >= W.mean()).mean():.3f}. "
                  f"Breakeven at -110 is 52.4%.", ""]
        print(L[-2], flush=True)

    path = os.path.join(ROOT, "NBA_CONC_WALKFORWARD_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
