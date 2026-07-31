#!/usr/bin/env python3
"""Controls for the concentrated-heat fade. Try to kill it before believing it.

The candidate: when a team's recent shooting-above-its-own-sustainable-rate is CONCENTRATED
in one or two high-volume players (HHI in the top third), fade that team. 400 bets, 55.2%
vs a 50.7 slice baseline, +5.5% ROI, and unusually the OPEN and T-60 numbers are identical,
so it is not the news-latency artifact the absence signal turned out to be.

Six ways it could still be nothing, each with the control that would show it:

  C1 THRESHOLD FISHING. Top tercile was one of many cuts. Sweep the HHI threshold across
     deciles: a real moderator strengthens monotonically, a fished one spikes at one cut.
  C2 BET-COUNT FISHING. 400 was chosen. Sweep 200/400/600/800.
  C3 IT IS THE TEAM AGGREGATE AFTER ALL. Run the incumbent `d_luck_net` fade inside the SAME
     concentrated cell. If it scores the same, concentration is the whole story and player
     granularity is decoration.
  C4 IT IS A NAIVE HOT-PLAYER RULE. Run `d_p_top` (raw hottest single player, no own-baseline
     correction) in the same cell. If that works too, the career-baseline subtraction that
     justifies the whole build is unnecessary.
  C5 IT IS A MARKET PROXY. Concentration may just flag big favourites or star-led teams.
     Check what conc_drv correlates with, and re-run split by favourite/underdog.
  C6 ONE SEASON OR ONE PHASE. Split by phase inside the cell.

Nothing here re-tunes the rule. Every cell is graded at both the opener and the T-60 close
against a 2,000-permutation within-season null, and every win rate is printed beside the
max-side baseline of its own subset, which a coin flip beats by about -2.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_player_model import PHASES, bet, load_all

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    d = load_all()
    L = ["# Controls on the concentrated-heat fade", ""]

    # ---- C1 threshold sweep --------------------------------------------------------
    L += ["## C1 — HHI threshold sweep (400 bets each, T-60)", "",
          "A real moderator strengthens as the cut tightens. A fished one spikes once.", "",
          "| cut | games | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    for pct in (0.0, 0.3, 0.5, 0.6, 0.7, 0.8):
        thr = d["conc_drv"].quantile(pct)
        s = d[d["conc_drv"] > thr].reset_index(drop=True)
        sig = -s["d_p_heat"].to_numpy(dtype=float)
        n = 400 if len(s) > 900 else 250
        rows = []
        bet(s, sig.copy(), "T-60", n, f"HHI > p{int(pct*100)} ({len(s):,} g)", rows)
        L += [r.replace("| T-60", f"| {len(s):,} | T-60") for r in rows]

    # ---- C2 bet-count sweep in the headline cell -----------------------------------
    q = d["conc_drv"].quantile(2 / 3)
    hi = d[d["conc_drv"] > q].reset_index(drop=True)
    sig_hi = -hi["d_p_heat"].to_numpy(dtype=float)
    L += ["", "## C2 — bet-count sweep inside the top tercile", "",
          "| signal | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for n in (200, 400, 600, 800):
        for mkt in ("OPEN", "T-60"):
            bet(hi, sig_hi.copy(), mkt, n, f"fade conc heat @{n}", L)

    # ---- C3 / C4 rival signals in the SAME cell ------------------------------------
    L += ["", "## C3/C4 — do simpler signals do the same job in this cell?", "",
          "If either matches the headline, the expensive part of the build is unnecessary.",
          "",
          "| signal | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    rivals = [("C3 team aggregate luck", -hi["d_luck_net"].to_numpy(dtype=float)),
              ("C4 raw hottest player (no own baseline)",
               -hi["d_p_top"].to_numpy(dtype=float)),
              ("C4b team xEFG process", hi["d_xefg_net"].to_numpy(dtype=float))]
    for tag, sig in rivals:
        for mkt in ("OPEN", "T-60"):
            bet(hi, sig.copy(), mkt, 400, tag, L)

    # ---- C5 what is concentration actually correlated with? ------------------------
    L += ["", "## C5 — is concentration just a market proxy?", "",
          "| vs | corr with conc_drv |", "|---|---|"]
    for c in ("mkt_spread", "mkt_total", "d_results", "d_talent_m", "n_rot",
              "d_p_heat", "h_gp"):
        if c not in d.columns:
            continue
        a = d["conc_drv"].to_numpy(dtype=float)
        b = pd.to_numeric(d[c], errors="coerce").to_numpy(dtype=float)
        m = np.isfinite(a) & np.isfinite(b)
        L.append(f"| {c} | {100*np.corrcoef(a[m], b[m])[0,1]:+.1f} |")
    print("\n".join(L[-6:]), flush=True)

    L += ["", "### and split by whether the HOT side is favourite or dog", "",
          "| side | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    hot_home = hi["hp_p_heat"].abs() >= hi["ap_p_heat"].abs()
    sp = pd.to_numeric(hi["mkt_spread"], errors="coerce")
    hot_fav = np.where(hot_home, sp < 0, sp > 0)
    for lab, msk in [("hot side is FAVOURITE", hot_fav), ("hot side is DOG", ~hot_fav)]:
        s = hi[msk].reset_index(drop=True)
        for mkt in ("OPEN", "T-60"):
            bet(s, -hi.loc[msk, "d_p_heat"].to_numpy(dtype=float), mkt, 200, lab, L)

    # ---- C6 phase inside the cell ---------------------------------------------------
    L += ["", "## C6 — by season phase inside the concentrated cell", "",
          "| phase | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for name, lo, hi_gp in PHASES:
        m = (hi["gp"] >= lo) & (hi["gp"] <= hi_gp)
        s = hi[m].reset_index(drop=True)
        if len(s) < 250:
            continue
        bet(s, -hi.loc[m, "d_p_heat"].to_numpy(dtype=float), "T-60", 200, name, L)

    path = os.path.join(ROOT, "NBA_CONC_CONTROLS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
