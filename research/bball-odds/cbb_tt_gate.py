#!/usr/bin/env python3
"""Does the CBB team total carry information its two parent markets do not? And the halves too.

`derived-market-gating-law`, ported from the NBA. A team total is not a third market: it is the
game total and the spread rotated 45 degrees. `tt_h = (total + margin)/2` almost exactly, so a
team-total disagreement is the AVERAGE of a total disagreement and a margin disagreement. That has
one consequence the NBA had to learn the expensive way:

    A LARGE TEAM-TOTAL DISAGREEMENT WITH BOTH PARENTS UNDER THEIR CUTS IS TWO SUB-THRESHOLD
    OPINIONS STACKED, AND BOTH PARENTS LOSE BELOW THEIR CUTS.

On the NBA that split read +13.1% inside games the full-game total model already bet, against
-12.1% (z -13.18) in games neither parent touched, while the ungated ladder averaged the two into a
misleading +7.1% and read like a standalone market. `NBA_TT_ORIG.md` published the ungated version
first and had to be corrected.

THE LAW HAS THREE STEPS AND THIS FILE RUNS ALL THREE.

  1. MEASURE THE ROTATION BEFORE FITTING ANYTHING. If the book's team totals reconcile with its own
     posted total and spread, there is no third dimension and everything after step 1 is about
     leverage, not about a new edge. Reported as correlations and as the reconciliation gap.
  2. SPLIT THE BETS by whether a PARENT model would already fire on that game.
  3. SWEEP THE GATE, never inherit it. The NBA gate was originally set at 8 points by inheritance
     from the total model's own cut, and the owner caught it: the results showed >=5 was already
     positive. A gate is its own parameter and gets its own ladder.

FIRST HALVES GET THE SAME TREATMENT, and that is new here. A first-half spread is not a rotation of
the full-game spread the way a team total is a rotation of the total -- the halves are a genuinely
different quantity -- but it is still built from the SAME team-points model, so the same question
applies: is a first-half bet paying because the model knows something about the half, or only
because it knows something about the game and the half inherits it?
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "CBB_TT_GATE.md")
GATES = (0, 1, 2, 3, 4, 5, 6)          # parent-model cut, in points
CUTS = (1, 2, 3, 4)                    # derived-market cut, in points


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


cp = _mod("cp", "cbb_panel.py")


def rotation(G):
    """Step 1. Is the posted team total anything other than the posted total and spread?"""
    tt_h = pd.to_numeric(G["tt_h"], errors="coerce")
    tt_a = pd.to_numeric(G["tt_a"], errors="coerce")
    tot = pd.to_numeric(G["t60_total_point"], errors="coerce")
    sp = pd.to_numeric(G["t60_spread_home_point"], errors="coerce")
    ok = tt_h.notna() & tt_a.notna() & tot.notna() & sp.notna()
    s, d = (tt_h + tt_a)[ok], (tt_h - tt_a)[ok]
    L = ["## Step 1 — is the team total a third market, or the other two rotated?", "",
         "Measured on the POSTED lines, before any model is fitted. If the book's own team totals "
         "add back to its own total and subtract back to its own spread, then a team-total model "
         "cannot be learning a new quantity and everything below is about leverage.", "",
         "| relation | corr | within 1 pt | sd of gap | n |", "|---|---|---|---|---|"]
    for lab, a, b in (("`tt_h + tt_a` vs posted total", s, tot[ok]),
                      ("`tt_h - tt_a` vs posted margin", d, -sp[ok])):
        g = a - b
        L.append(f"| {lab} | **{a.corr(b):+.4f}** | {100*(g.abs() <= 1).mean():.1f}% | "
                 f"{g.std():.2f} | {len(g):,} |")
    slack = (s - tot[ok]).abs()
    L += ["", f"The book's team totals reconcile with its own posted total to within half a point "
              f"on **{100*(slack <= 0.5).mean():.1f}%** of games, and by more than a point on "
              f"**{100*(slack > 1).mean():.1f}%**. That second group is the only place a team total "
              f"is not a rotation, and it is swept separately below.", ""]
    return L, slack


def gate_table(S, parent, gates, cuts, lab, note):
    """Steps 2 and 3. Derived-market cut on one axis, parent-model gate on the other."""
    L = [f"## {lab}", "", note, "",
         "| gate (parent ≥) | " + " | ".join(f"cut ≥{c:g}" for c in cuts) + " |",
         "|---|" + "---|" * len(cuts)]
    for g in gates:
        m = parent.abs() >= g
        cells = []
        for c in cuts:
            r = cp.grade(S["d"], S["yb"], S["po"], S["pu"], c, mask=m)
            cells.append("—" if not r["n"] else
                         f"**{r['roi']:+.1f}** ({r['n']:,} · {r['win']:.1f} v {r['base']:.1f})")
        L.append(f"| ≥{g:g} | " + " | ".join(cells) + " |")
    L += ["", "Each cell is ROI, then (bets · win% v base%). The gate is a free parameter and gets "
              "its own ladder rather than inheriting the parent's own betting cut — inheriting it "
              "is the exact mistake the NBA version made.", ""]
    return L


def main():
    P, G, fcols, _ = cp.load()
    preds = cp.fit(P, fcols, cache=cp.PRED)
    mk = cp.markets(P, G, preds["fg"][0], preds["h1"][0])
    cp.oracle_check(mk)

    L = ["# CBB — is a derived market a new bet, or the parent bet with leverage?", "",
         "`cbb_tt_gate.py`. Every number here comes from the same two team-points models as "
         "`CBB_PANEL_ALL.md` and is graded through the same `cbb_panel.markets()`, so a difference "
         "between the two documents can never be a difference in how a bet was scored.", ""]

    rot, slack = rotation(G)
    L += rot

    # The team total lives on the PANEL, so its parent disagreements have to be broadcast from the
    # game index onto both team rows before they can gate anything.
    ev = P["event_id"]
    par_tot = ev.map(mk["fg_total"]["d"]).astype(float)
    par_sp = ev.map(mk["fg_spread"]["d"]).astype(float)
    either = pd.concat([par_tot.abs(), par_sp.abs()], axis=1).max(axis=1)

    L += gate_table(
        mk["tt"], par_tot, GATES, CUTS, "Step 2 — team total, gated on the FULL-GAME TOTAL model",
        "Rows are how far the full-game total model is from the posted GAME total; columns are how "
        "far the team-points model is from the posted TEAM total. **These are two different "
        "thresholds and conflating them is a documented trap** — the gate picks which games a bet "
        "may live in, the cut picks the bet.")
    L += gate_table(
        mk["tt"], par_sp, GATES, CUTS, "Step 2b — team total, gated on the FULL-GAME SPREAD model",
        "The other parent. A team total is the average of a total opinion and a margin opinion, so "
        "either parent firing is in principle enough to make the derived bet a real position.")
    L += gate_table(
        mk["tt"], either, GATES, CUTS, "Step 3 — team total, gated on EITHER parent",
        "The NBA's best-performing gate. Both parents are cheap to compute and a team total "
        "inherits from both, so requiring only one of them to fire keeps more bets without letting "
        "in the games where neither parent has an opinion at all.")

    # First halves gated on their own full-game siblings -- same model, longer horizon.
    for k, par, lab in (("h1_total", mk["fg_total"]["d"], "First-half TOTAL"),
                        ("h1_spread", mk["fg_spread"]["d"], "First-half SPREAD")):
        L += gate_table(
            mk[k], par.astype(float), GATES, (0.75, 1, 1.5, 2),
            f"{lab}, gated on its full-game sibling",
            "A half is not a rotation of the game the way a team total is, so this is a genuine "
            "test rather than a formality: if the first-half bets only pay inside games the "
            "full-game model already likes, the first-half model is not adding a horizon, it is "
            "re-expressing the full-game one.")

    # The one slice where a team total is not a rotation: the book's own numbers disagree.
    L += ["## The reconciliation slice — where the team total is NOT a rotation", "",
          "Games where the book's two team totals do not add back to its own posted total. This is "
          "the only place a team-total model can be looking at something the other two markets do "
          "not already contain, so it is the one slice worth reading without a gate.", "",
          "| slack | cut | bets | win% | base% | ROI |", "|---|---|---|---|---|---|"]
    sl = P["event_id"].map(slack).astype(float)
    for lo, hi, lab in ((0, 0.5, "≤0.5 pts (reconciles)"), (1, 99, ">1 pt"), (2, 99, ">2 pts")):
        for c in (2, 3):
            r = cp.grade(mk["tt"]["d"], mk["tt"]["yb"], mk["tt"]["po"], mk["tt"]["pu"], c,
                         mask=(sl >= lo) & (sl <= hi))
            if r["n"]:
                L.append(f"| {lab} | ≥{c} | {r['n']:,} | {r['win']:.1f} | {r['base']:.1f} | "
                         f"**{r['roi']:+.1f}** |")
    L.append("")
    open(OUT, "w").write("\n".join(L) + "\n")
    print("\n".join(L[len(rot):]), flush=True)
    print(f"wrote {os.path.basename(OUT)}", flush=True)


if __name__ == "__main__":
    main()
