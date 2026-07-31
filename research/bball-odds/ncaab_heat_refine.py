#!/usr/bin/env python3
"""Two refinements of college heat, each with a stated mechanism.

R1  SELF-CREATION. When a hot player's makes are increasingly ASSISTED, the heat is the
    offence feeding him -- team context, which decays. When his assisted share is flat or
    falling, he is creating it himself -- closer to skill, which persists. PRE-REGISTERED:
    the fade should be STRONGER where the hot side's assisted share is rising.

R2  SEASON PHASE. College is not one market. November is non-conference games between teams
    with almost no shared history and openers posted on thin information; February is
    conference play where every team has 20 games of book on it. A trailing-10 heat window
    means something different in each. Split on games played, do not pool.

Both are read off the GRADIENT first (one ordered test, ungameable) and only then bet.
Everything runs on the timing-filtered frame from ncaab_heat_validate.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, usable, grade
from ncaab_heat_grade import build
from ncaab_heat_validate import bettable

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(505)
MKTS = ("FG spread OPEN", "FG spread T-60", "FG total OPEN", "FG total T-60")
TOP = 0.20


def phase(G):
    """Games played WITHIN the season, per team -- the season-phase variable. A career
    expanding count would file 90% of games as 'late' and the split would be a split in
    name only; that exact bug bit the NBA luck file.
    """
    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId"]]
    t = G[["event_id", "gameId", "commence_time", "season"]].copy()
    t["ct"] = pd.to_datetime(t["commence_time"], utc=True)
    t = t.merge(H, on="gameId").sort_values(["teamId", "ct"])
    # count within the frame's OWN season label. Deriving a season from the calendar year
    # breaks at New Year and silently restarts every team at zero in January.
    t["gp"] = t.groupby(["teamId", t["season"].astype(str)]).cumcount()
    k = t.groupby("event_id", as_index=False)["gp"].min()      # the less-established team
    return G.merge(k, on="event_id", how="left")


def bet(G, sig, mkt, L, tag, sub=None):
    S = sig if sub is None else np.where(sub, sig, np.nan)
    ok = usable(G, pd.Series(S, index=G.index), mkt) & G["timing_ok"].to_numpy(bool)
    if ok.sum() < 500:
        return
    thr = np.nanquantile(np.abs(S[ok]), 1.0 - TOP)
    m = ok & (np.abs(np.nan_to_num(S)) >= thr)
    if m.sum() < 150:
        return
    g = grade(G, mkt, m, -np.sign(np.nan_to_num(S)), rng=RNG)
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


def main():
    G = phase(bettable(build()))
    s = G["d_p_heat"].to_numpy(float)
    # assist-share drift of the side being faded (the hotter one)
    hot_home = G["h_p_heat"].abs() >= G["a_p_heat"].abs()
    G["ad_drv"] = np.where(hot_home, G["h_p_astdr"], G["a_p_astdr"])
    ad = G["ad_drv"].to_numpy(float)

    L = ["# NCAAB heat — refinements", "",
         "Fade the hotter side, top 20% of |differential|, timing-filtered. `base` is the "
         "max-side rate inside each selection.", "",
         "## R1 — is the hot side being FED, or creating it himself?", "",
         "Split on the driving side's assisted-share drift (recent share of makes assisted, "
         "minus his own baseline). Pre-registered: fade harder when the share is RISING.", "",
         "| slice | market | bets | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|"]
    q = np.nanquantile(ad, [1 / 3, 2 / 3])
    for lab, sub in (("assisted share RISING", ad >= q[1]),
                     ("assisted share FALLING", ad <= q[0])):
        for mkt in MKTS:
            bet(G, s, mkt, L, lab, sub=sub)
        L.append("")

    L += ["## R2 — season phase (games played by the less-established team)", "",
          "| slice | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    gp = G["gp"].to_numpy(float)
    for lab, sub in (("early (< 12 gp)", gp < 12),
                     ("mid (12-21 gp)", (gp >= 12) & (gp < 22)),
                     ("late (22+ gp)", gp >= 22)):
        for mkt in MKTS:
            bet(G, s, mkt, L, lab, sub=sub)
        L.append("")

    path = os.path.join(ROOT, "NCAAB_HEAT_REFINE.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
