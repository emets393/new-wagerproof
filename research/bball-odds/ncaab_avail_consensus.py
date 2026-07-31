#!/usr/bin/env python3
"""Two independent absence feeds, graded against each other and combined.

The same rule -- fade the team missing more weighted rotation minutes tonight -- was built
twice from unrelated sources:

  LINEUP  `lineups_ncaab`, five-man units, seconds inferred from stint construction. Three
          seasons (2022-23 has no lineup coverage at all).
  BOX     `cbbd_player_box`, a vendor box feed with an explicit minutes column and a
          different player-id namespace. Four seasons.

Where both fire they agree almost exactly (r = 0.956, 98.1% sign agreement), so they are
measuring the same thing. What differs is COVERAGE: 2,950 games vs 2,476, overlapping on only
1,714. Each feed sees absences the other misses, which makes the pair worth combining rather
than choosing between.

CONSENSUS = both feeds fire AND agree on which side is shorthanded. Fewer bets, highest
confidence.
EITHER    = the union, preferring the lineup reading where both exist. The broadest version
            and the only one covering all four seasons.

CONTEXT, so this is not oversold: BBALL_SIGNALS.md S1 already fades the team whose top
REBOUNDER is freshly out at 57.8% / +10.4% over these same four seasons. This file does not
beat S1. It reaches the same place from a different direction -- whole-rotation minutes rather
than one named player -- which is a replication of the underlying effect, not a new edge.

Every row here reads TONIGHT'S absences and therefore needs a pregame availability feed to be
bettable, exactly as S1 does. The companion result in NCAAB_AVAILABILITY_BRIEF.md is that the
lagged, feed-free version is worth nothing.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import usable, grade
from ncaab_availability import frame, diff
from ncaab_box_players import load_box, rectangle, add_rates, team_rows, attach

ROOT = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(7)
MKTS = ("FG spread OPEN", "FG spread T-60")
TOP = 0.70


def main():
    G = frame(verbose=False)
    G["lin"] = diff(G, "feed_fresh", "mn")
    B, _ = attach(team_rows(add_rates(rectangle(load_box()))))
    d = (B["h_fresh_mn"].fillna(0) - B["a_fresh_mn"].fillna(0)).to_numpy(float)
    B["box"] = np.where(d == 0, np.nan, d)
    G = G.merge(B[["event_id", "box"]], on="event_id", how="left")

    lin, box = G["lin"].to_numpy(float), G["box"].to_numpy(float)
    both = np.isfinite(lin) & np.isfinite(box)
    agree = both & (np.sign(lin) == np.sign(box))
    r = np.corrcoef(lin[both], box[both])[0, 1]

    combos = {
        "LINEUP feed only": lin,
        "BOX feed only": box,
        "CONSENSUS (both agree)": np.where(agree, lin, np.nan),
        "EITHER feed": np.where(np.isfinite(lin), lin, box),
    }
    L = ["# NCAAB absence — two independent feeds", "",
         f"Games where both feeds fire: **{int(both.sum()):,}** (lineup {int(np.isfinite(lin).sum()):,}, "
         f"box {int(np.isfinite(box).sum()):,}). Correlation where both fire: **{r:+.3f}**, "
         f"sign agreement **{100 * agree[both].mean():.1f}%** -- same measurement, different "
         "coverage.", "",
         "Fade the shorthanded side, top 30% of |differential|. Needs a pregame availability "
         "feed. Compare against S1 (big freshly out): 57.8% / +10.4%.", "",
         "| feed | market | bets | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|"]
    for name, s in combos.items():
        for mkt in MKTS:
            ok = usable(G, pd.Series(s, index=G.index), mkt)
            if ok.sum() < 300:
                continue
            thr = np.nanquantile(np.abs(s[ok]), TOP)
            m = ok & (np.abs(np.nan_to_num(s)) >= thr)
            g = grade(G, mkt, m, -np.sign(np.nan_to_num(s)), rng=RNG)
            L.append(f"| {name} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")

    path = os.path.join(ROOT, "NCAAB_AVAIL_CONSENSUS.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
