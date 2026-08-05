#!/usr/bin/env python3
"""The conjunction the composites destroyed: bad RESULTS on top of bad LUCK.

Every test so far averaged the luck family into one number. That average is the wrong shape
for the owner's actual question. "A team that just played flat-out bad for a stretch and is
due to bounce" is not a team with a low average -- it is a team where two SEPARATE things are
both true at once:

  results luck   they won less than their point differential deserved (pythagorean, close
                 games, ATS margin all below their own baseline)
  shooting luck  the ball did not go in at their own established rate, and/or opponents hit
                 shots against them that normally miss

A team can be low on the average because one of these is very negative while the other is
positive -- and that team is NOT due for anything. Averaging them together files it in the
same bucket as a team where both are true. This file stops averaging and tests the 2x2.

The bet: when BOTH are negative (unlucky twice over), back that team. When BOTH are positive
(lucky twice over), fade it. The two mixed cells are the internal control -- they are the same
teams, the same window, the same market, differing only in whether the two luck channels
agree. If the agree-cells and the disagree-cells look alike, there is no conjunction effect
and the averaging was never the problem.

RATE control runs the identical 2x2 on shot rates, which cannot regress.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_luck_sweep import MARKETS, load
from nba_luck_stage2 import RESULTS_LUCK, SHOOT_LUCK, RATE_CTRL, zseason

ROOT = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(404)
N_PERM = 20000
SIDE_MARKETS = ("FG spread OPEN", "FG spread T-60", "1H spread")
Q = 0.33          # "clearly negative" = bottom third, "clearly positive" = top third


def compose(G, mp, w, kind="d"):
    parts = [sign * zseason(G[f"{kind}_luck{w}_{b}"], G["season"])
             for b, sign in mp.items() if f"{kind}_luck{w}_{b}" in G.columns]
    return pd.concat(parts, axis=1).mean(axis=1)


def grade(G, mkt, m, side):
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    win = np.where(side[m] > 0, y[m] > 0, y[m] < 0)
    dec = np.where(side[m] > 0, dp[m], dn[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    nul = RNG.binomial(len(win), base, N_PERM) / len(win)
    seas = G["season"].astype(str).to_numpy()[m]
    per = " ".join(f"{t[-2:]}:{100*win[seas == t].mean():.0f}"
                   for t in sorted(set(seas)) if (seas == t).sum() >= 20)
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                edge=100 * (win.mean() - base), roi=100 * roi, per=per,
                p=float((nul >= win.mean()).mean()))


def cells(G, res, sho, mkt, name, L):
    """The 2x2. res/sho are HOME-minus-AWAY differentials; positive = home was luckier."""
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    r = pd.to_numeric(res, errors="coerce").to_numpy(float)
    s = pd.to_numeric(sho, errors="coerce").to_numpy(float)
    ok = (np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn)
          & np.isfinite(r) & np.isfinite(s))
    if ok.sum() < 500:
        return
    rlo, rhi = np.nanquantile(r[ok], Q), np.nanquantile(r[ok], 1 - Q)
    slo, shi = np.nanquantile(s[ok], Q), np.nanquantile(s[ok], 1 - Q)

    grid = {
        "home unlucky BOTH  → back home": (ok & (r <= rlo) & (s <= slo), +1),
        "home lucky BOTH    → fade home": (ok & (r >= rhi) & (s >= shi), -1),
        "mixed: results-  shooting+ (ctrl)": (ok & (r <= rlo) & (s >= shi), +1),
        "mixed: results+  shooting- (ctrl)": (ok & (r >= rhi) & (s <= slo), -1),
    }
    for lab, (m, sgn) in grid.items():
        if m.sum() < 50:
            continue
        g = grade(G, mkt, m, np.full(len(G), sgn, float))
        L.append(f"| {name} | {mkt} | {lab} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


def union(G, res, sho, mkt, name, L):
    """Both agree-cells pooled -- the actual bettable rule if the 2x2 shows anything."""
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    r = pd.to_numeric(res, errors="coerce").to_numpy(float)
    s = pd.to_numeric(sho, errors="coerce").to_numpy(float)
    ok = (np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn)
          & np.isfinite(r) & np.isfinite(s))
    if ok.sum() < 500:
        return
    rlo, rhi = np.nanquantile(r[ok], Q), np.nanquantile(r[ok], 1 - Q)
    slo, shi = np.nanquantile(s[ok], Q), np.nanquantile(s[ok], 1 - Q)
    back = ok & (r <= rlo) & (s <= slo)
    fade = ok & (r >= rhi) & (s >= shi)
    m = back | fade
    if m.sum() < 60:
        return
    side = np.where(back, 1.0, np.where(fade, -1.0, 0.0))
    g = grade(G, mkt, m, side)
    L.append(f"| {name} | {mkt} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


def main():
    G = load()
    L = ["# NBA luck DIVERGENCE — bad results AND bad luck, together", "",
         f"{len(G):,} games. Bottom/top third of each channel independently, 10-game window. "
         "Differentials are home-minus-away, so 'home unlucky both' means the home team was "
         "the one shortchanged on both channels.", "",
         "## The 2x2", "",
         "The two `(ctrl)` rows are the internal control: same teams, same market, the two "
         "luck channels DISAGREEING. If they score like the agree-rows, the conjunction is "
         "not doing anything.", "",
         "| family | market | cell | n | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|---|"]

    for w in (10, 5):
        res = compose(G, RESULTS_LUCK, w)
        sho = compose(G, SHOOT_LUCK, w)
        ctl = compose(G, RATE_CTRL, w)
        for mkt in SIDE_MARKETS:
            cells(G, res, sho, mkt, f"luck w{w}", L)
        for mkt in SIDE_MARKETS:
            cells(G, ctl, sho, mkt, f"RATE ctrl w{w}", L)
        L.append("")

    L += ["## The bettable union (both agree-cells pooled)", "",
          "| family | market | n | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    for w in (10, 5):
        res = compose(G, RESULTS_LUCK, w)
        sho = compose(G, SHOOT_LUCK, w)
        ctl = compose(G, RATE_CTRL, w)
        for mkt in SIDE_MARKETS:
            union(G, res, sho, mkt, f"luck w{w}", L)
        for mkt in SIDE_MARKETS:
            union(G, ctl, sho, mkt, f"RATE ctrl w{w}", L)
    L.append("")

    path = os.path.join(ROOT, "NBA_LUCK_DIVERGENCE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
