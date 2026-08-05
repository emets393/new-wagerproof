#!/usr/bin/env python3
"""CONFERENCE REMATCHES: back the team that won the first meeting.

WHERE THIS CAME FROM, honestly. It was not the hypothesis. The phase-stratified player work
turned up a "back the less experienced roster in late conference play" cell, and the control
for it -- compute the naive angle IN-SUBSET, the law that killed three earlier ports -- showed
the naive angle was carrying it:

    back previous WINNER, all conference rematches   7,774 bets   54.1% vs 50.3 base   +3.4%

That is the finding. The experience filter is an amplifier on top of it, not the source.

WHY IT IS WORTH TAKING SERIOUSLY:
  * It is PARAMETER-FREE. No threshold, no cut, no top-30%. Every conference rematch in the
    sample is a bet, so there is nothing to overfit and nothing to walk forward.
  * n = 7,774 over four seasons, and it is graded at the T-60 close, not the opener.
  * Its mirror image loses at exactly the rate it wins (back the previous loser: 45.9%), which
    is what a real one-directional effect looks like and what a selection artifact does not.
  * The direction is the opposite of the folk angle. "Revenge game" says back the team that
    lost, especially at home. The data says the opposite, which is a reason it might survive:
    public money is on the other side.

WHAT THIS FILE IS FOR: to try to kill it. The rematch pool is not a random pool -- the winner
of the first meeting is on average the better team, the second meeting is usually at the other
building, and conference tournaments add third meetings on neutral floors. Each of those is a
way for a 54% to be something other than an edge, and each gets its own control below.

PHASES ARE CARRIED THROUGHOUT, because a conference rematch in January, one in late February,
and one in a conference tournament are three different games.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, grade, usable
from ncaab_exper_validate import context, frame, meetings
from ncaab_player_regression import signal

ROOT = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(20260801)
SIDES = ("FG spread OPEN", "FG spread T-60", "1H spread")
TOTALS = ("FG total OPEN", "FG total T-60", "1H total")
SPREAD = {"FG spread OPEN": "open_spread_home_point",
          "FG spread T-60": "t60_spread_home_point",
          "1H spread": "h1_spread"}
CONF = ["CONF_EARLY", "CONF_LATE", "CONF_TOURN"]
HDR = ["| variant | bets | win % | base % | edge | ROI % | p | by season |",
       "|---|---|---|---|---|---|---|---|"]


def row(tag, g):
    return (f"| {tag} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


def main():
    G = context(frame())
    M = meetings(G)
    npr = M["n_prior"].to_numpy(float)
    hw = M["home_won_prev"].to_numpy(float)          # 1 = the HOME team won the earlier meeting
    pw = np.where(hw == 1, 1.0, -1.0)                # the side that won it
    prev_marg = M["prev_abs_margin"].to_numpy(float)
    conf = G["phase"].isin(CONF).to_numpy()
    ph = G["phase"].to_numpy()

    L = ["# Conference rematches — back the team that won the first meeting", "",
         "Parameter-free: every conference rematch is a bet, no threshold anywhere. Baselines "
         "are the max blind side INSIDE each slice, never 50%.", ""]

    for mkt in SIDES:
        ok = usable(G, pd.Series(pw, index=G.index), mkt) & conf & np.isfinite(hw)
        rem = ok & (npr >= 1)
        L += ["", f"## {mkt}", "", HDR[0], HDR[1],
              row("**back previous WINNER**", grade(G, mkt, rem, pw, rng=RNG)),
              row("back previous LOSER (mirror)", grade(G, mkt, rem, -pw, rng=RNG))]

        # ---- C1 side and price bias, inside the identical bets ---------------------------
        one = np.ones(len(G))
        sp = pd.to_numeric(G[SPREAD[mkt]], errors="coerce").to_numpy(float)
        fav = np.where(np.isnan(sp), 0.0, np.where(sp < 0, 1.0, np.where(sp > 0, -1.0, 0.0)))
        L.append(row("C1 blind HOME, same bets", grade(G, mkt, rem, one, rng=RNG)))
        L.append(row("C1 blind FAVOURITE, same bets",
                     grade(G, mkt, rem & (fav != 0), fav, rng=RNG)))

        # ---- C2 is the previous winner just the better team? -----------------------------
        # If the edge only exists when the previous winner is ALSO favoured tonight, it is a
        # favourite bias wearing a rematch costume. If it survives when they are the dog, the
        # market is genuinely not carrying the first result forward.
        L.append(row("C2 prev winner is FAVOURED tonight",
                     grade(G, mkt, rem & (pw == fav), pw, rng=RNG)))
        L.append(row("C2 prev winner is the DOG tonight",
                     grade(G, mkt, rem & (fav != 0) & (pw != fav), pw, rng=RNG)))

        # ---- C3 venue. The folk angle is revenge-at-home; this is the direct test ---------
        L.append(row("C3 prev winner is HOME tonight", grade(G, mkt, rem & (pw > 0), pw, rng=RNG)))
        L.append(row("C3 prev winner is AWAY tonight", grade(G, mkt, rem & (pw < 0), pw, rng=RNG)))

        # ---- C4 how decisive was the first meeting? --------------------------------------
        for lo, hi, nm in ((0, 4, "won by 1-3"), (4, 8, "won by 4-7"),
                           (8, 15, "won by 8-14"), (15, 999, "won by 15+")):
            m = rem & (prev_marg >= lo) & (prev_marg < hi)
            if m.sum() >= 60:
                L.append(row(f"C4 {nm}", grade(G, mkt, m, pw, rng=RNG)))

        # ---- C5 phase ---------------------------------------------------------------------
        for p in CONF:
            m = rem & (ph == p)
            if m.sum() >= 60:
                L.append(row(f"C5 {p}", grade(G, mkt, m, pw, rng=RNG)))
        m2, m3 = rem & (npr == 1), rem & (npr >= 2)
        L.append(row("C5 second meeting", grade(G, mkt, m2, pw, rng=RNG)))
        if m3.sum() >= 60:
            L.append(row("C5 third+ meeting", grade(G, mkt, m3, pw, rng=RNG)))

        # ---- C6 the experience interaction that led here ---------------------------------
        d = -signal(G, "exper", mkt)
        young = np.sign(np.nan_to_num(d))
        L.append(row("C6 prev winner is the YOUNGER roster",
                     grade(G, mkt, rem & (pw == young), pw, rng=RNG)))
        L.append(row("C6 prev winner is the OLDER roster",
                     grade(G, mkt, rem & (pw == -young) & (young != 0), pw, rng=RNG)))

        # ---- C7 permutation: shuffle which side won the earlier meeting -------------------
        pool = np.flatnonzero(rem)
        real = grade(G, mkt, rem, pw)["win"]
        draws = np.zeros(500)
        for i in range(500):
            s = pw.copy()
            s[pool] = RNG.permutation(pw[pool])
            draws[i] = grade(G, mkt, rem, s)["win"]
        L.append(f"| C7 winner identity permuted | {int(rem.sum()):,} | {draws.mean():.1f} | "
                 f"— | — | — | pct {100 * (draws < real).mean():.1f} | |")

    # ---- do rematches play differently as TOTALS? ----------------------------------------
    # Familiarity is supposed to depress scoring the second time around. Cheap to check and it
    # is the same pool, so it costs one table.
    L += ["", "## Totals in the same pool — do rematches go under?", "", HDR[0], HDR[1]]
    for mkt in TOTALS:
        ok = usable(G, pd.Series(np.ones(len(G)), index=G.index), mkt) & conf
        rem = ok & (npr >= 1)
        if rem.sum() >= 60:
            L.append(row(f"{mkt}: UNDER every rematch", grade(G, mkt, rem, -np.ones(len(G)), rng=RNG)))
            L.append(row(f"{mkt}: first meetings, UNDER",
                         grade(G, mkt, ok & (npr == 0), -np.ones(len(G)), rng=RNG)))

    path = os.path.join(ROOT, "NCAAB_REMATCH.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
