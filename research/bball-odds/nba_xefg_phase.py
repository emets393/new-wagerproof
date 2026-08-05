#!/usr/bin/env python3
"""Does the shot-quality edge concentrate by season phase? Pre-registered, not fished.

xEFG (expected eFG from shot coordinates) correlates +4.65 with the T-60 spread residual
where actual eFG correlates +0.05 -- the market prices results and does not fully price
process. But pooled over everything it is worth ~0.6 points of edge, under the vig, and the
per-season split is ugly (2022:46 2023:49 vs 2024:63 2025:61).

THE PREDICTION, made before running: the edge should be LARGEST EARLY IN THE SEASON. Shot
quality stabilises in a handful of games while win-loss records and point differentials stay
noisy for months, so early season is exactly when the market has least information and a
process measure has most to add. If the edge instead concentrates late, the early-season
story is wrong and I should say so rather than retrofitting a new one.

Phase is defined by the TEAM'S GAMES PLAYED, not by calendar date, because teams play
uneven schedules and a date cut would mix a team's 8th game with another's 20th.

Reported per phase: correlation, and a bet table against a 2,000-permutation null with every
win rate beside the baseline of its own slice. A coin flip scores about -2 on `edge`, so the
null column is the comparison, not zero.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_regression_model import MKT, load

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_PERM = 2000
RNG = np.random.default_rng(37)

PHASES = [("early (<=15 gp)", 0, 15), ("mid (16-45)", 16, 45),
          ("late (46-81)", 46, 81), ("playoffs (82+)", 82, 200)]


def games_played(d):
    """Phase = the fewer of the two teams' games played coming in.

    h_gp/a_gp already exist in nba_model_features and count through the playoffs (max 105),
    so a team's 83rd game is its first postseason game. Don't rebuild this from the shot
    table -- an earlier version did and got the season boundary wrong, resetting every count
    at New Year's.
    """
    d["gp"] = d[["h_gp", "a_gp"]].astype(float).min(axis=1)
    return d


def bet(d, sig, mkt, n_target, tag, L):
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    seas = d["season"].to_numpy()
    ok = np.isfinite(y) & (y != 0) & np.isfinite(sig) & (sig != 0)
    if ok.sum() < max(120, n_target):
        return
    idxs = [ix[ok[ix]] for ix in
            (np.where(seas == s)[0] for s in np.unique(seas))]
    idxs = [ix for ix in idxs if len(ix) > 1]

    def score(g):
        thr = np.quantile(np.abs(g[ok]), max(0.0, 1.0 - n_target / ok.sum()))
        m = ok & (np.abs(g) >= thr)
        if m.sum() < 20:
            return None
        hi = g[m] > 0
        win = np.where(hi, y[m] > 0, y[m] < 0)
        base = max((y[m] > 0).mean(), (y[m] < 0).mean())
        roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
        return 100 * (win.mean() - base), 100 * win.mean(), 100 * base, 100 * roi, m, win

    r = score(sig)
    if r is None:
        return
    e, w, b, roi, m, win = r
    per = " ".join(f"{s}:{100*win[seas[m] == s].mean():.0f}"
                   for s in sorted(set(seas[m])))
    null = np.empty(N_PERM)
    pg = sig.copy()
    for i in range(N_PERM):
        for ix in idxs:
            pg[ix] = sig[RNG.permutation(ix)]
        q = score(pg)
        null[i] = q[0] if q else np.nan
    null = null[np.isfinite(null)]
    L.append(f"| {tag} | {mkt} | {m.sum():,} | {w:.1f} | {b:.1f} | **{e:+.1f}** | "
             f"{null.mean():+.1f} | {(null >= e).mean():.3f} | {roi:+.1f} | {per} |")
    print(L[-1], flush=True)


def main():
    d = games_played(load())
    L = ["# xEFG shot-quality edge by season phase", "",
         "`d_xefg_net` = home trailing expected-eFG margin − away, from shot coordinates. "
         "Phase = the fewer of the two teams' games played. `edge` = win% − the max-side "
         "baseline of that same slice; a coin flip scores ≈ −2 on it, so compare to "
         "`null mean`, not to zero.", "",
         "## Correlation with the spread residual by phase", "",
         "| phase | n | corr T-60 | corr OPEN | corr of ACTUAL eFG (control) |",
         "|---|---|---|---|---|"]
    for name, lo, hi in PHASES:
        s = d[(d["gp"] >= lo) & (d["gp"] <= hi)]
        v = s["d_xefg_net"].to_numpy(dtype=float)
        a = s["d_aefg_net"].to_numpy(dtype=float)
        y1 = s[MKT["T-60"][0]].to_numpy(dtype=float)
        y2 = s[MKT["OPEN"][0]].to_numpy(dtype=float)
        m = np.isfinite(v) & np.isfinite(y1) & np.isfinite(y2) & np.isfinite(a)
        if m.sum() < 100:
            continue
        L.append(f"| {name} | {m.sum():,} | {100*np.corrcoef(v[m], y1[m])[0,1]:+.2f} | "
                 f"{100*np.corrcoef(v[m], y2[m])[0,1]:+.2f} | "
                 f"{100*np.corrcoef(a[m], y1[m])[0,1]:+.2f} |")
    print("\n".join(L[-6:]), flush=True)

    L += ["", "## Bet test per phase, betting the xEFG side directly", "",
          "| phase | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for name, lo, hi in PHASES:
        s = d[(d["gp"] >= lo) & (d["gp"] <= hi)].reset_index(drop=True)
        sig = s["d_xefg_net"].to_numpy(dtype=float)
        n = int(min(600, max(200, 0.35 * np.isfinite(sig).sum())))
        for mkt in ("OPEN", "T-60"):
            bet(s, sig.copy(), mkt, n, name, L)

    path = os.path.join(ROOT, "NBA_XEFG_PHASE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
