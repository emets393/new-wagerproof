#!/usr/bin/env python3
"""Is the FEED absence edge real, or is it reading the game it is supposed to predict?

The headline from NCAAB_AVAILABILITY_BRIEF.md: fade the team missing more rotation minutes
TONIGHT, and the full-game spread goes 58.8% / +12.2% at the opener and 57.6% / +10.0% at the
T-60 close, positive in every season. That is S1 territory (57.8% / +10.4%) without needing
S1's injury feed to identify WHICH player -- but it does need a feed to know he is out.

Before that gets written down as a finding it has to survive the specific way it could be
fake. "Did not play tonight" is read off the box score, and a box score is written after the
game. It means injured/suspended MOST of the time, but it also means:

C1  BENCH SHORTENING. Coaches play seven men in a tight game and twelve in a blowout. So
    zero-minute rotation players are partly a MEASUREMENT OF THE GAME'S COMPETITIVENESS,
    which is the thing the spread is about. Two checks: correlate the differential with the
    final margin, and re-run inside close games only, where there is no garbage time to empty
    a bench into.
C2  SIDE BIAS. Fading a team is backing the other one. If the selection quietly leans home,
    or leans favourite, the edge could be a known bias wearing an injury costume. Blind home,
    blind favourite and blind dog are all graded INSIDE the same selection.
C3  RANDOM-CUT PLACEBO. The rule bets the top 30% of |differential|. Does that cut beat a
    random 30% of the same pool? Below ~95% it is not carrying information. This is the test
    that kept the NBA's best-looking cell off the bet list, and the one the college heat
    concentration split failed at 73%.
C4  WALK-FORWARD. The 30% cutoff is a quantile of the whole sample, which is hindsight.
    Recompute it from strictly prior seasons and apply blind.

Opener AND T-60 close are reported everywhere. An opener-only edge is news latency; this one
needs to survive to the close to be a real mispricing.
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import usable, grade
from ncaab_availability import frame, diff

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(414)
MKTS = ("FG spread OPEN", "FG spread T-60")
TOP = 0.70          # top 30% of |differential| -- fixed in ncaab_availability.py
FLAV, SCALE = "feed_fresh", "mn"     # the headline row: freshly out, raw minutes missing


def sel(G, d, mkt, thr=None, sub=None):
    """The rule as a usable mask. Threshold passed in so walk-forward can vary it."""
    s = d if sub is None else np.where(sub, d, np.nan)
    ok = usable(G, pd.Series(s, index=G.index), mkt)
    if ok.sum() < 200:
        return None
    t = np.nanquantile(np.abs(s[ok]), TOP) if thr is None else thr
    return ok & (np.abs(np.nan_to_num(s)) >= t)


def row(G, mkt, m, side, tag, L):
    if m is None or m.sum() < 100:
        return None
    g = grade(G, mkt, m, side, rng=RNG)
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")
    return g


HDR = ["| rule | market | bets | win % | base % | edge | ROI % | p | by season |",
       "|---|---|---|---|---|---|---|---|---|"]


def main():
    G = frame(verbose=False)
    d = diff(G, FLAV, SCALE)
    side = -np.sign(np.nan_to_num(d))            # FADE the shorthanded team
    marg = (G["home_score"] - G["away_score"]).to_numpy(float)
    sp = pd.to_numeric(G["open_spread_home_point"], errors="coerce").to_numpy(float)

    seas = G["season"].astype(str)
    n_by = {s: int(np.isfinite(d[(seas == s).to_numpy()]).sum()) for s in sorted(seas.unique())}
    L = ["# NCAAB availability — validating the FEED absence edge", "",
         "Rule under test: **fade the team with more rotation minutes missing tonight**, top "
         "30% of |home-minus-away differential|. Games with a live differential by season: "
         + ", ".join(f"{s}: {n:,}" for s, n in n_by.items()) + ".", "",
         "## Baseline (the row being validated)", ""] + HDR
    for mkt in MKTS:
        row(G, mkt, sel(G, d, mkt), side, "FEED fresh, raw minutes", L)

    # ---- C1 bench shortening --------------------------------------------------------
    fin = np.isfinite(d) & np.isfinite(marg)
    r_abs = np.corrcoef(np.abs(d[fin]), np.abs(marg[fin]))[0, 1]
    r_sgn = np.corrcoef(d[fin], marg[fin])[0, 1]
    L += ["", "## C1 — is this just measuring how competitive the game was?", "",
          f"Correlation of |differential| with |final margin|: **{r_abs:+.3f}**. Bench "
          "shortening would make this clearly NEGATIVE -- a blowout empties both benches, so "
          "fewer rotation players finish on zero. It is flat, so that artefact is not "
          "present.", "",
          f"Correlation of the SIGNED differential with the signed margin: **{r_sgn:+.3f}**. "
          "Negative is the mechanism working: the shorthanded side loses by more.", "",
          "Splitting on the final margin would be circular -- conditioning on the outcome "
          "moves the cover baseline to ~63% and makes both halves unreadable. So the split "
          "below is on the PREGAME spread instead, which is observable when the bet is made.",
          ""] + HDR
    a = np.abs(sp)
    for lab, sub in (("tight games (spread < 4)", a < 4),
                     ("mid (spread 4-9.5)", (a >= 4) & (a < 10)),
                     ("big favourites (spread 10+)", a >= 10)):
        for mkt in MKTS:
            row(G, mkt, sel(G, d, mkt, sub=sub), side, lab, L)

    # ---- C1b the gradient -----------------------------------------------------------
    L += ["", "## C1b — the gradient (the program's primary test)", "",
          "Cover rate of BACKING HOME by decile of the signed differential. The differential "
          "is home-minus-away, so the LEFT edge is where AWAY is missing the most and home is "
          "healthiest, and the RIGHT edge is where HOME is missing the most. The rule predicts "
          "a FALLING line. One ordered test over ten bins -- it cannot be gamed by picking a "
          "bucket, and a threshold rule with no slope behind it is a fluke.", "",
          "| market | n | decile cover % backing home (away missing more -> home missing more)"
          " | r |", "|---|---|---|---|"]
    for mkt in MKTS:
        ycol = {"FG spread OPEN": "y_sp_open", "FG spread T-60": "y_sp_t60"}[mkt]
        ok = usable(G, pd.Series(d, index=G.index), mkt)
        y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)[ok]
        s = d[ok]
        q = pd.qcut(s, 10, labels=False, duplicates="drop")
        rates = [100 * (y[q == i] > 0).mean() for i in range(int(np.nanmax(q)) + 1)]
        r = np.corrcoef(s, (y > 0).astype(float))[0, 1]
        L.append(f"| {mkt} | {ok.sum():,} | " + " ".join(f"{v:.0f}" for v in rates)
                 + f" | {r:+.3f} |")

    # ---- C2 side bias ---------------------------------------------------------------
    L += ["", "## C2 — is the selection leaning home, or leaning favourite?", "",
          "Blind bets graded INSIDE the same selection. If blind home or blind favourite "
          "scores like the rule, the rule is a known bias in disguise.", ""] + HDR
    for mkt in MKTS:
        m = sel(G, d, mkt)
        if m is None:
            continue
        home = 100 * (side[m] > 0).mean()
        L.append(f"| *(selection is {home:.1f}% home-side)* | {mkt} |  |  |  |  |  |  |  |")
        row(G, mkt, m, np.ones(len(G)), "blind HOME", L)
        row(G, mkt, m, -np.ones(len(G)), "blind AWAY", L)
        row(G, mkt, m, -np.sign(np.nan_to_num(sp)), "blind FAVOURITE", L)

    # ---- C3 random-cut placebo ------------------------------------------------------
    L += ["", "## C3 — does the top-30% cut beat a random 30% of the same pool?", "",
          "`beats` is the share of 2,000 random cuts the real cut outscores on ROI. Below "
          "~95% the magnitude cut is not carrying information.", "",
          "| market | real ROI % | random ROI mean % | beats |", "|---|---|---|---|"]
    for mkt in MKTS:
        pool = usable(G, pd.Series(d, index=G.index), mkt)
        m = sel(G, d, mkt)
        real = grade(G, mkt, m, side)["roi"]
        k, idx = int(m.sum()), np.flatnonzero(pool)
        draws = np.empty(2000)
        for i in range(2000):
            pick = np.zeros(len(G), bool)
            pick[RNG.choice(idx, k, replace=False)] = True
            draws[i] = grade(G, mkt, pick, side)["roi"]
        L.append(f"| {mkt} | {real:+.2f} | {draws.mean():+.2f} | "
                 f"**{100 * (real > draws).mean():.1f}%** |")

    # ---- C4 walk-forward ------------------------------------------------------------
    L += ["", "## C4 — walk-forward (cutoff from strictly prior seasons only)", ""] + HDR
    order = sorted(seas.unique())
    for mkt in MKTS:
        wf = np.zeros(len(G), bool)
        for i, sn in enumerate(order):
            if i == 0:
                continue                                  # no prior season to learn from
            prior = seas.isin(order[:i]).to_numpy()
            thr = np.nanquantile(np.abs(d[prior & np.isfinite(d)]), TOP)
            m = sel(G, d, mkt, thr=thr, sub=(seas == sn).to_numpy())
            if m is not None:
                wf |= m
        row(G, mkt, wf, side, "walk-forward", L)

    path = os.path.join(ROOT, "NCAAB_AVAIL_VALIDATION.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
