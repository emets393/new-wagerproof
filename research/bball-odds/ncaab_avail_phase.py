#!/usr/bin/env python3
"""WHERE in the season does the absence edge live?

The absence rule -- fade the team missing more weighted rotation minutes tonight -- was graded
POOLED at +9 to +10% and written up that way. That is exactly the mistake the phase work is
here to stop: a pooled number is a weighted average over parts of the season that price
differently, and S1 already reports 59.5% in conference play against 54.2% out of conference,
which means the pooled figure is understating one half and overstating the other.

This matters for a spending decision, not just a table. Buying a pregame availability feed is
the only item in the college program with money attached. If the edge is concentrated in
conference play, the feed only has to be right from January onward and the November slate --
which is the hardest and most expensive part of the season to cover, hundreds of teams playing
buy-games nobody reports on -- can be skipped. If it is flat across phases, we need everything.

No new signal is proposed here. The rule, the threshold and the direction are the ones already
validated in NCAAB_AVAIL_CONSENSUS.md; only the slicing is new, so the multiplicity is seven
cuts of a known result rather than a search.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import grade, usable
from ncaab_availability import diff, frame
from ncaab_box_players import add_rates, attach, load_box, rectangle, team_rows
from ncaab_player_regression import PHASES, phases

ROOT = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(20260801)
MKTS = ("FG spread OPEN", "FG spread T-60", "1H spread")
TOP = 0.70


def main():
    G = frame(verbose=False)
    G["lin"] = diff(G, "feed_fresh", "mn")
    B, _ = attach(team_rows(add_rates(rectangle(load_box()))))
    d = (B["h_fresh_mn"].fillna(0) - B["a_fresh_mn"].fillna(0)).to_numpy(float)
    B["box"] = np.where(d == 0, np.nan, d)
    G = G.merge(B[["event_id", "box"]], on="event_id", how="left")
    # EITHER: the four-season union, lineup reading preferred where both feeds fire
    s = np.where(np.isfinite(G["lin"].to_numpy(float)),
                 G["lin"].to_numpy(float), G["box"].to_numpy(float))

    G["game_id"] = G["cbbd_id"].astype("int64")
    G = G.merge(phases(), on="game_id", how="left")

    L = ["# The absence edge, phase by phase", "",
         "EITHER feed, fade the shorthanded side, top 30% of |differential| -- the rule from "
         "NCAAB_AVAIL_CONSENSUS.md, unchanged. Only the slicing is new. The threshold is taken "
         "GLOBALLY so no phase is handed a tuned cut.", "",
         "| market | phase | bets | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|"]
    for mkt in MKTS:
        ok = usable(G, pd.Series(s, index=G.index), mkt)
        thr = np.nanquantile(np.abs(s[ok]), TOP)
        base = ok & (np.abs(np.nan_to_num(s)) >= thr)
        side = -np.sign(np.nan_to_num(s))          # FADE the shorthanded team
        for ph in ["ALL"] + PHASES:
            m = base if ph == "ALL" else base & (G["phase"] == ph).to_numpy()
            if m.sum() < 60:
                continue
            g = grade(G, mkt, m, side, rng=RNG)
            L.append(f"| {mkt} | {ph} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")

    path = os.path.join(ROOT, "NCAAB_AVAIL_PHASE.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
