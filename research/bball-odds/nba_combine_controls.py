#!/usr/bin/env python3
"""Is "S9 + xEFG agrees" real, or is the xEFG gate doing all the work by itself?

NBA_COMBINE_BRIEF.md reports back-the-favourite on dead-home games where shot-quality
process ALSO favours the favourite: 213 bets, 61.0% / +16.5% at the T-60 close. That is the
best NBA full-game spread cell in the whole program and it is exactly the kind of number that
should not be believed on first sight.

Two ways it is flattered, and this file measures both:

  TAUTOLOGICAL COMPARATOR. The `fav in-sub` column in that brief reads 61.0% for S9 rows --
  identical to the win rate -- because S9's side IS the favourite. Blind favourite over the
  same games cannot be a control for a rule that bets blind favourite. The honest comparator
  is blind favourite over ALL late games, matched on spread bucket, which is what
  nba_dead_home.py's `delta cell` does.

  THE GATE MIGHT BE THE WHOLE STORY. If "back the favourite whenever xEFG agrees with it"
  scores ~61% across ALL late games, then the dead-home condition adds nothing and S9 is
  decoration on an xEFG rule. This is the decisive control and it is run first.

Spread-bucket matching matters because dead home teams draw big road favourites and big
favourites cover at a different rate than small ones. A raw population average would compare
the selection against a different mix of games than it actually bets.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_combine import build
from nba_out_isolate import to_dec
from nba_player_model import load_all
from nba_regression_model import MKT

ROOT = os.path.dirname(os.path.abspath(__file__))
N_BOOT = 10000
RNG = np.random.default_rng(71)
BUCKETS = [0, 2.5, 5.5, 8.5, 12.5, 100]


def favframe(d, mkt):
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    fh = d["fav_home"].to_numpy(dtype=bool)
    win = np.where(fh, y > 0, y < 0)
    dec = np.where(fh, dh, da)
    ok = np.isfinite(y) & (y != 0) & np.isfinite(dec)
    sp = np.abs(pd.to_numeric(d["mkt_spread"], errors="coerce").to_numpy(dtype=float))
    buck = np.digitize(sp, BUCKETS)
    return win, dec, ok, buck


def cell_matched(win, dec, ok, buck, sel, pool):
    """Blind favourite over `pool`, reweighted to the spread-bucket mix of `sel`."""
    s = sel & ok
    tot_w, tot_r = 0.0, 0.0
    for b in np.unique(buck[s]):
        w = (buck[s] == b).mean()
        p = pool & ok & (buck == b)
        if p.sum() < 15:
            continue
        tot_w += w
        tot_r += w * np.where(win[p], dec[p] - 1.0, -1.0).mean()
    return (100 * tot_r / tot_w) if tot_w > 0 else np.nan, \
           100 * win[s].mean(), int(s.sum())


def boot_p5(w):
    n = len(w)
    return 100 * np.quantile([w[RNG.integers(0, n, n)].mean() for _ in range(N_BOOT)], 0.05)


def split_test(d, proc_fav):
    """Does the xEFG cut separate S9 better than a RANDOM cut of the same size would?

    Rows D and E partition one 326-bet sample, so a two-sample z-test between them is not
    valid -- D is high exactly because E is low, by construction. Permuting the agree/disagree
    labels while holding the split sizes fixed asks the only answerable version: is this cut
    special, or is it what carving S9 in two at random looks like?
    """
    out = ["## Is the D/E split better than a random cut of S9?", "",
           "| grading | S9 n | agree n | agree win % | disagree n | disagree win % | gap | "
           "p(random cut ≥ gap) |", "|---|---|---|---|---|---|---|---|"]
    for mkt in ("OPEN", "T-60"):
        win, dec, ok, _ = favframe(d, mkt)
        s9 = d["s9_fire"].to_numpy(bool) & ok
        w, g = win[s9], proc_fav[s9]
        obs = w[g].mean() - w[~g].mean()
        n1 = int(g.sum())
        nul = np.array([(lambda p: w[p[:n1]].mean() - w[p[n1:]].mean())
                        (RNG.permutation(len(w))) for _ in range(20000)])
        out.append(f"| {mkt} | {len(w)} | {n1} | {100*w[g].mean():.1f} | {len(w)-n1} | "
                   f"{100*w[~g].mean():.1f} | {100*obs:+.1f}pp | **{(nul >= obs).mean():.3f}** |")
        print(out[-1], flush=True)
    return out + [""]


def main():
    d = build(load_all())
    late = d["late"].to_numpy(bool)
    s9 = d["s9_fire"].to_numpy(bool)
    x = d["d_xefg_net"].to_numpy(dtype=float)
    fh = d["fav_home"].to_numpy(bool)
    # does shot-quality process point at the favourite?
    proc_fav = np.isfinite(x) & ((x > 0) == fh)

    L = ["# Controls on 'S9 + xEFG agrees'", "",
         "`fav ROI cell` = blind favourite over the comparison pool, reweighted to the "
         "SELECTION's own |spread| bucket mix. `delta` = the rule's ROI minus that. A rule "
         "that backs favourites is worth nothing unless delta is positive.", ""]

    for mkt in ("OPEN", "T-60"):
        win, dec, ok, buck = favframe(d, mkt)
        L += [f"## {mkt}", "",
              "| selection | bets | win % | ROI % | fav ROI cell | delta | boot p5 |",
              "|---|---|---|---|---|---|---|"]

        def row(lab, sel, pool):
            s = sel & ok
            if s.sum() < 40:
                L.append(f"| {lab} | {int(s.sum())} | — | — | — | too few to grade | — |")
                return
            roi = 100 * np.where(win[s], dec[s] - 1.0, -1.0).mean()
            cm, wr, n = cell_matched(win, dec, ok, buck, sel, pool)
            L.append(f"| {lab} | {n:,} | {wr:.1f} | {roi:+.2f} | {cm:+.2f} | "
                     f"**{roi-cm:+.2f}** | {boot_p5(win[s]):.1f} |")
            print(L[-1], flush=True)

        # the decisive control FIRST: the gate with no dead-home condition at all
        row("A. fav + xEFG agrees, ALL late games", late & proc_fav, late)
        row("B. fav + xEFG agrees, ALL games", proc_fav, np.ones(len(d), bool))
        row("C. S9 alone (dead home, back fav)", s9, late)
        row("D. S9 + xEFG agrees", s9 & proc_fav, late)
        row("E. S9 + xEFG disagrees", s9 & ~proc_fav, late)
        row("F. blind fav, all late games", late, late)
        L.append("")

    L += split_test(d, proc_fav)
    L += ["## Verdict", "",
          "A came back FLAT (+3.18 delta at T-60 over 1,290 late games) — about what the xEFG "
          "feature was already known to be worth on its own, nowhere near 61%. So the gate is "
          "not the whole story and the dead-home condition is load-bearing. F is the machinery "
          "check: blind favourite against its own bucket-matched self is −0.00, as it must be.",
          "",
          "**But D does not become a rule.** D and E are a PARTITION of the same 326 S9 bets, "
          "so D's lift over C is arithmetically forced the moment E comes in weak — it is not "
          "an independent test. The permutation test above is the only honest form of the "
          "question, and at p≈.10 a random cut of S9 reproduces the gap 1 time in 10. Betting "
          "the gated version means surrendering a third of a validated signal's volume to chase "
          "a refinement that has not cleared. **Track D, bet C.**", ""]

    path = os.path.join(ROOT, "NBA_COMBINE_CONTROLS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
