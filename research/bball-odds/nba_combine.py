#!/usr/bin/env python3
"""Do the NBA full-game spread signals combine, or do they collide? Overlap first, math after.

Two validated rules now live on the SAME market in the SAME part of the season:

  S9    late season (both teams 50+ gp) + HOME team eliminated or tanking -> BACK THE
        FAVOURITE. 58.7% / +12.06 at the T-60 close vs a 52.8% blind-favourite comparator.
        Standings only, no feed. (BBALL_SIGNALS.md S9)
  HEAT  concentrated player shooting above each man's OWN career finishing rate -> FADE that
        team. 54.0% / +3.2% at T-60, walk-forward. (NBA_PLAYER_REGRESSION_SUMMARY.md)

Adding their records together would be wrong twice over. They can fire on the SAME game, and
when they do they can pick OPPOSITE sides -- if the road favourite facing a tanking home team
is itself the hot team, S9 says back it and HEAT says fade it. So the first output here is an
overlap and conflict table, not a combined ROI.

Then the two things worth knowing:

  PORTFOLIO   the union. More bets per season at a blended rate. This is nearly free if the
              overlap is small, and it is the realistic product.
  CONFLUENCE  do they reinforce where they agree? The NFL work is the warning here: aligned
              signals that share an information source are REDUNDANT, not confirming, and
              cross-market confluence failed there for exactly that reason
              ([[nfl-prop-model-deepdive]]). These two do not share a source -- one is
              standings/motivation, the other is shot-location regression -- so this is the
              independent case where confluence can legitimately work. That is a reason to
              TEST it, not a reason to expect it.

Comparator law from the vault: any rule picking >85% one naive side must be graded against
that naive rule computed ON THE IDENTICAL GAMES. Every row below therefore carries
`fav in-sub` -- blind favourite over the same games -- alongside the max-side baseline.
Graded at BOTH the opener and the T-60 close.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_player_model import load_all
from nba_regression_model import MKT

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_PERM = 2000
RNG = np.random.default_rng(67)

CONC_Q = 2 / 3      # frozen from the walk-forward run, not re-tuned here
HEAT_Q = 0.60       # bet the top 40% of |heat| inside the concentrated cell


def build(d):
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    d = d.merge(S, on="game.id", how="left", suffixes=("", "_st"))
    sp = pd.to_numeric(d["mkt_spread"], errors="coerce").to_numpy(dtype=float)
    d["fav_home"] = sp < 0
    d["late"] = (d[["h_gp", "a_gp"]].astype(float).min(axis=1) >= 50)

    def dead(pre):
        e = d.get(f"st_{pre}_eliminated")
        t = d.get(f"st_{pre}_tank")
        if e is None or t is None:
            return np.zeros(len(d), dtype=bool)
        return ((pd.to_numeric(e, errors="coerce").fillna(0).to_numpy() > 0)
                | (pd.to_numeric(t, errors="coerce").fillna(0).to_numpy() > 0))

    d["dead_h"], d["dead_a"] = dead("h"), dead("a")

    # ---- S9: fires on the game, side is the favourite -------------------------------
    d["s9_fire"] = d["late"] & d["dead_h"] & np.isfinite(sp)
    d["s9_side"] = np.where(d["fav_home"], 1, -1)          # +1 back home, -1 back away

    # ---- HEAT: fires when concentrated, side fades the hot team ----------------------
    conc = d["conc_drv"].to_numpy(dtype=float)
    heat = d["d_p_heat"].to_numpy(dtype=float)
    ok = np.isfinite(conc) & np.isfinite(heat) & (heat != 0)
    cthr = np.quantile(conc[ok], CONC_Q)
    q = ok & (conc > cthr)
    hthr = np.quantile(np.abs(heat[q]), HEAT_Q)
    d["heat_fire"] = q & (np.abs(heat) >= hthr)
    # d_p_heat is home minus away, so positive = home is the hot side -> back away
    d["heat_side"] = np.where(heat > 0, -1, 1)

    # ---- XEFG: the process feature, as a third weak side-picker ----------------------
    x = d["d_xefg_net"].to_numpy(dtype=float)
    xok = np.isfinite(x)
    xthr = np.quantile(np.abs(x[xok]), 0.80)
    d["xefg_fire"] = xok & (np.abs(x) >= xthr)
    d["xefg_side"] = np.where(x > 0, 1, -1)
    return d


def grade(d, mask, side, mkt):
    """Win/ROI for a set of picks, plus blind favourite over the identical games."""
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    m = mask & np.isfinite(y) & (y != 0)
    if m.sum() < 15:
        return None
    s = side[m]
    win = np.where(s > 0, y[m] > 0, y[m] < 0)
    dec = np.where(s > 0, dh[m], da[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    fh = d["fav_home"].to_numpy(dtype=bool)[m]
    fwin = np.where(fh, y[m] > 0, y[m] < 0)
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * roi, fav=100 * fwin.mean(),
                seas=d["season"].to_numpy()[m], w=win)


def row(d, mask, side, tag, L):
    out = []
    for mkt in ("OPEN", "T-60"):
        r = grade(d, mask, side, mkt)
        if r is None:
            return
        out.append(r)
    o, t = out
    per = " ".join(f"{s}:{100*t['w'][t['seas'] == s].mean():.0f}"
                   for s in sorted(set(t["seas"])))
    L.append(f"| {tag} | {t['n']:,} | {o['win']:.1f} | {o['roi']:+.1f} | {t['win']:.1f} | "
             f"{t['roi']:+.1f} | {t['base']:.1f} | {t['fav']:.1f} | {per} |")
    print(L[-1], flush=True)


HDR = ("| signal | bets | OPEN win% | OPEN ROI | T-60 win% | T-60 ROI | base% | "
       "fav in-sub% | T-60 by season |")
SEP = "|---|---|---|---|---|---|---|---|---|"


def main():
    d = build(load_all())
    s9, ht = d["s9_fire"].to_numpy(bool), d["heat_fire"].to_numpy(bool)
    xf = d["xefg_fire"].to_numpy(bool)
    s9s, hts, xfs = (d[c].to_numpy(int) for c in ("s9_side", "heat_side", "xefg_side"))

    L = ["# Combining the NBA full-game spread signals", "",
         f"n = {len(d):,} games. S9 fires on {s9.sum():,}, HEAT on {ht.sum():,}, "
         f"xEFG on {xf.sum():,}.", "",
         "## Overlap and conflict — before any combined number", "",
         "| pair | co-fire | agree | conflict | overlap as % of the smaller signal |",
         "|---|---|---|---|---|"]
    for a, b, sa, sb, lab in [(s9, ht, s9s, hts, "S9 x HEAT"),
                              (s9, xf, s9s, xfs, "S9 x xEFG"),
                              (ht, xf, hts, xfs, "HEAT x xEFG")]:
        both = a & b
        ag = int((both & (sa == sb)).sum())
        cf = int((both & (sa != sb)).sum())
        small = min(a.sum(), b.sum())
        L.append(f"| {lab} | {both.sum():,} | {ag:,} | {cf:,} | "
                 f"{100*both.sum()/max(small,1):.1f}% |")
    print("\n".join(L[-5:]), flush=True)

    # ---- each alone, for reference on this exact sample ------------------------------
    L += ["", "## Each signal alone, on this sample", "", HDR, SEP]
    row(d, s9, s9s, "S9 dead-home fav", L)
    row(d, ht, hts, "HEAT conc fade", L)
    row(d, xf, xfs, "xEFG process", L)

    # ---- portfolio: the union, deduped, conflicts dropped ----------------------------
    both = s9 & ht
    conflict = both & (s9s != hts)
    # a game where the two disagree has no defensible side, so it is not bet at all
    uni = (s9 | ht) & ~conflict
    uside = np.where(s9 & ~conflict, s9s, hts)
    L += ["", "## Portfolio — the union of S9 and HEAT, contradictions dropped", "",
          "A game where the two disagree has no defensible side and is not bet.", "",
          HDR, SEP]
    row(d, uni, uside, "S9 ∪ HEAT (union)", L)
    row(d, s9 & ~conflict, s9s, "  S9 leg only", L)
    row(d, ht & ~conflict & ~s9, hts, "  HEAT leg only (non-overlapping)", L)

    # ---- confluence: do they reinforce where they agree? -----------------------------
    L += ["", "## Confluence — where both fire and AGREE", "",
          "The NFL lesson is that aligned signals sharing an information source are "
          "redundant, not confirming. These two do not share one (standings vs shot-location "
          "regression), so this is the case where confluence can legitimately work. Small n "
          "is the binding constraint, and it is reported rather than smoothed over.", "",
          HDR, SEP]
    agree = both & (s9s == hts)
    row(d, agree, s9s, "S9 + HEAT agree", L)
    row(d, conflict, s9s, "conflict — S9 side (diagnostic)", L)
    row(d, conflict, hts, "conflict — HEAT side (diagnostic)", L)

    # ---- xEFG as a third confirmer on the S9 cell ------------------------------------
    L += ["", "## Does the process feature add to S9?", "",
          "xEFG is a feature, not a rule. The useful question is whether it GATES S9: back "
          "the favourite only when shot-quality process also favours it.", "", HDR, SEP]
    x = d["d_xefg_net"].to_numpy(dtype=float)
    proc_side = np.where(x > 0, 1, -1)
    row(d, s9 & np.isfinite(x) & (proc_side == s9s), s9s, "S9 + xEFG agrees", L)
    row(d, s9 & np.isfinite(x) & (proc_side != s9s), s9s, "S9 + xEFG disagrees", L)

    L += ["", "## Per-season bet volume of the portfolio", "",
          "| season | S9 | HEAT | union | conflicts dropped |", "|---|---|---|---|---|"]
    for s in sorted(d["season"].unique()):
        m = (d["season"] == s).to_numpy()
        L.append(f"| {s} | {int((s9&m).sum())} | {int((ht&m).sum())} | "
                 f"{int((uni&m).sum())} | {int((conflict&m).sum())} |")
    print("\n".join(L[-6:]), flush=True)

    path = os.path.join(ROOT, "NBA_COMBINE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
