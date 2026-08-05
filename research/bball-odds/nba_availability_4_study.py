#!/usr/bin/env python3
"""NBA availability round 4 — the consolidation: one dose ladder, one rule.

Rounds 2-3 produced two findings pointing in OPPOSITE directions:
  - moderate star out (18-25 ppg) → BACK the depleted team (1H 56%, and 64% in
    close games)
  - severe depletion (25+ ppg star, or 2+ regulars) → FADE the depleted team
    (FG 55.6%)

Opposite-signed results from the same feature are usually a sign of scan noise —
UNLESS they line up as a monotone dose ladder, in which case they are one
structure: the market OVER-adjusts small absences and UNDER-adjusts big ones.
This script tests exactly that, on one axis (points removed), one bet (BACK the
depleted team), both markets, with the sign allowed to flip where it wants.

Round 3 also killed two stories that need to stay killed in the write-up:
  - it is not an AWAY effect (the home mirror runs 58.2% in close games); the
    real conditioner is a CLOSE game
  - it is not a pure 1H-derivative edge; the same games pay on the full game
    too (58.9%), just less. The 1H is the better expression, not the only one.
"""
import os

import numpy as np
import pandas as pd

from nba_availability_1h_study import load, markets
from nba_availability_2h_study import synth_2h
from nba_availability_3_study import tt_consensus
from nba_halves_study2 import bet

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    G = load().merge(tt_consensus(), on="event_id", how="left")
    mk = markets(G)
    o2, h2, flat = synth_2h(G)
    h1w, h1d, a1w, a1d = mk["1H spread"]
    fgw, fgd, faw, fad = mk["FG spread"]
    band = G["t60_spread_home_point"].abs()
    F = pd.Series(False, index=G.index)

    L = ["# NBA availability round 4 — the dose ladder and the final rule", "",
         f"{len(G):,} games, 3 seasons, T-60 consensus (decimal). BE 52.4%. Every row BACKS the "
         "depleted team, so a win% below 50 means fade it. 2H is SYNTHETIC/diagnostic.", ""]

    def back(mask_h, mask_a, label, which="1H", lines=None, min_n=40):
        mh, ma = mask_h.fillna(False), mask_a.fillna(False)
        hw, hd, aw, ad = {"1H": (h1w, h1d, a1w, a1d), "FG": (fgw, fgd, faw, fad),
                          "2H": (h2, flat, 1 - h2, flat)}[which]
        win = pd.Series(np.where(mh, hw, np.where(ma, aw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mh, hd, np.where(ma, ad, np.nan)), index=G.index)
        bet(G, mh | ma, win, dec, label, lines if lines is not None else L, min_n=min_n)

    def sides(lo, hi, col="h_fresh_sum_ppg"):
        """One side in [lo,hi) of points removed, the other side essentially clean."""
        hc, ac = col, col.replace("h_", "a_", 1)
        sh = (G[hc] >= lo) & (G[hc] < hi) & (G[ac] < 8)
        sa = (G[ac] >= lo) & (G[ac] < hi) & (G[hc] < 8)
        return sh, sa

    # ---------- A. the dose ladder, both markets, sign free to flip
    L += ["## A — DOSE LADDER: back the depleted team, by total points removed\n",
          "| points removed | market | n | win% | ROI | per-season |", "|---|---|---|---|---|---|"]
    for lo, hi in ((8, 15), (15, 20), (20, 25), (25, 32), (32, 999)):
        sh, sa = sides(lo, hi)
        tag = f"{lo}-{hi if hi < 999 else '∞'}"
        for w in ("1H", "FG"):
            rows = []
            back(sh, sa, f"| {tag} ppg | {w}", w, rows, min_n=30)
            L += [r.replace("| | ", "| ") for r in rows]

    # ---------- B. the same ladder inside CLOSE games only
    L += ["\n## B — the ladder inside CLOSE games (|FG spread| < 8)\n",
          "| points removed | market | n | win% | ROI | per-season |", "|---|---|---|---|---|---|"]
    close = band < 8
    for lo, hi in ((8, 15), (15, 20), (20, 25), (25, 32), (32, 999)):
        sh, sa = sides(lo, hi)
        tag = f"{lo}-{hi if hi < 999 else '∞'}"
        for w in ("1H", "FG"):
            rows = []
            back(sh & close, sa & close, f"| {tag} ppg | {w}", w, rows, min_n=30)
            L += [r.replace("| | ", "| ") for r in rows]

    # ---------- C. the final rule and its controls
    L += ["\n## C — the rule: ONE moderate scorer out, close game\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    mod_h = (G["h_fresh_max_ppg"] >= 18) & (G["h_fresh_max_ppg"] < 25) & (G["a_fresh_max_ppg"] < 18)
    mod_a = (G["a_fresh_max_ppg"] >= 18) & (G["a_fresh_max_ppg"] < 25) & (G["h_fresh_max_ppg"] < 18)
    back(mod_h & close, mod_a & close, "**RULE: moderate star (18-25ppg) out, |spread|<8 → BACK [1H]**")
    back(mod_h & close, mod_a & close, "…same games, FULL GAME", "FG")
    back(mod_h & close, mod_a & close, "…same games, 2H SYNTHETIC", "2H")
    win = pd.Series(np.where((mod_h & close).fillna(False), h1w,
                             np.where((mod_a & close).fillna(False), a1w, np.nan)), index=G.index)
    dec = pd.Series(np.where((mod_h & close).fillna(False), h1d,
                             np.where((mod_a & close).fillna(False), a1d, np.nan)), index=G.index)
    m = (mod_h | mod_a) & close
    bet(G, m, win, pd.Series(1.909, index=G.index), "…graded FLAT -110 [1H]", L)
    for s in sorted(G["season"].unique()):
        bet(G, m & (G["season"] != s), win, dec, f"…DROP {s} [1H]", L, min_n=30)
    for lo, hi, nm in ((0, 25, "first 25 gp"), (25, 99, "games 25+")):
        bet(G, m & (G["min_gp"] >= lo) & (G["min_gp"] < hi), win, dec, f"…{nm} [1H]", L, min_n=30)
    back(mod_h & close & (G["t60_spread_home_point"] < 0),
         mod_a & close & (G["t60_spread_home_point"] > 0), "…depleted team FAVORED [1H]",
         "1H", None, 30)
    back(mod_h & close & (G["t60_spread_home_point"] > 0),
         mod_a & close & (G["t60_spread_home_point"] < 0), "…depleted team DOG [1H]",
         "1H", None, 30)
    back(mod_h & close, F, "…depleted team HOME [1H]", "1H", None, 30)
    back(F, mod_a & close, "…depleted team AWAY [1H]", "1H", None, 30)
    # placebo: STALE absence of the same size in a close game should be priced
    st_h = (G["h_stale_sum_ppg"] >= 18) & (G["h_fresh_n"] == 0) & (G["a_fresh_n"] == 0)
    st_a = (G["a_stale_sum_ppg"] >= 18) & (G["a_fresh_n"] == 0) & (G["h_fresh_n"] == 0)
    back(st_h & close, st_a & close, "PLACEBO: STALE 18+ ppg out, close game → BACK [1H]",
         "1H", None, 30)

    path = os.path.join(ROOT, "NBA_AVAIL_4_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
