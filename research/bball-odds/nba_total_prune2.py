#!/usr/bin/env python3
"""Grade the PRUNED originator total — pre-registered cuts, nulls, per-season, per-phase.

`nba_total_prune.py` ranked eighteen families by drop-one ablation on the total. This turns that
ranking into five configurations and grades them properly; the ablation was a ranking with no
nulls and nothing in it was a claim.

THE TOTAL'S ANSWER IS NOT THE SPREAD'S. The spread wanted `rapm` + `pl_regr` and told us to delete
`form` and `adj_eff`. The total's drop-one column says the reverse: `pl_regr` is the fourth-best
thing to CUT (+1.61/+1.60) while `form` and `adj_eff` are the two most expensive families to lose
(−0.96/−3.74 and −0.32/−2.15). Running this fresh instead of inheriting `CORE` is what caught it.

THE CUTS ARE PRE-REGISTERED FROM THE ABLATION, never searched — `nba-blind-sweep-fails`.

    ALL       every family (739)
    T1        cut the three families that improve BOTH columns by ≥2 points
    T2        cut every family with a positive drop-one delta on the top-15% column
    TCORE     keep only the seven families whose MEAN delta is negative — i.e. the ones the
              model is actively worse without
    TCORE_R   TCORE + rapm, because rapm splits (+0.98 loose / −3.74 tight): it is the family
              that carries the tail even though it looks droppable at the looser cut

BASELINE TRAP: the NBA total runs **+0.675 points over the T-60 close** and the over hits 50.7%,
so `pa.grade` must supply the in-slice base rate — nothing here is scored against 50.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_TOTAL_ORIG.md")
NULLS = 20
# Set from nba_total_prune_hl.py, which swept 8 settings x 4 selectivities on T1 and came back
# profitable in 32 of 32 cells. The hill is broad (180/240/365 all score alike) and 180 is the only
# setting in the top two of three of the four columns. NOTE THE TOTAL WANTS A LONGER MEMORY THAN THE
# SPREAD, which peaked at 90-120 -- pace and scoring efficiency drift more slowly than team strength,
# and pooled is not the worst setting here the way it is on the spread.
HALF_LIFE = 180.0
QS = (0.85, 0.91)
# The total ladder runs wider than the spread's: a total is the SUM of two panel rows, so its
# disagreements are roughly twice as spread out and a ≥9 ceiling would cut the tail off.
KS = (1, 2, 3, 4, 5, 6, 7, 8, 10, 12)

KEEP_CORE = ["form", "adj_eff", "absence", "pace_ix", "misc", "dims", "schedule"]
CUT = {
    "ALL": [],
    "T1": ["raw_box", "rot_flags", "travel"],
    # T2 also cuts the four families that are positive on BOTH columns but under +2, plus the two
    # that are positive on top-15% only. It deliberately KEEPS rapm: the first pass had T2 cutting
    # rapm too, which made its keep-set identical to TCORE's and wasted a fit.
    "T2": ["raw_box", "rot_flags", "travel", "pl_regr", "standings", "talent", "ratings", "style"],
    "TCORE": None,            # filled from KEEP_CORE once the family list is known
    "TCORE_R": None,
}


def main():
    tp = _mod("tp", "nba_total_prune.py")
    pa, P, G, cols, fam, y, line, resid, yb, po, pu = tp.setup()
    fams = sorted(set(fam))
    CUT["TCORE"] = [f for f in fams if f not in KEEP_CORE]
    CUT["TCORE_R"] = [f for f in fams if f not in KEEP_CORE + ["rapm"]]

    rng = np.random.default_rng(20260801)
    nulls_y = [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]

    fits, rows = {}, []
    for tag, drop in CUT.items():
        use = [c for c in cols if fam[c] not in drop]
        out = pa.ridge_multi(P[use].astype(float), P["date"], [y] + nulls_y, half_life=HALF_LIFE)
        d = [tp.to_game(pa, P, G, p, line) for p in out]
        fits[tag] = d
        r = dict(tag=tag, k=len(use), corr=float(d[0].corr(resid)))
        for q, lab in zip(QS, ("15", "9")):
            thr = d[0][d[0].notna() & yb.notna()].abs().quantile(q)
            g = pa.grade(d[0], yb, po, pu, thr)
            ng = [pa.grade(n, yb, po, pu, thr) for n in d[1:]]
            ne = np.array([q2["roi"] for q2 in ng], dtype=float)
            edge = np.array([q2["win"] - q2["base"] for q2 in ng], dtype=float)
            r[f"n{lab}"], r[f"roi{lab}"] = g["n"], g["roi"]
            r[f"w{lab}"], r[f"b{lab}"] = g["win"], g["base"]
            r[f"z{lab}"] = (g["win"] - g["base"] - np.nanmean(edge)) / max(
                np.nanstd(ne, ddof=1), 1e-9)
        rows.append(r)
        print(f"[total2] {tag:8s} k={len(use):3d} corr {r['corr']:+.4f} | "
              f"top15% {r['roi15']:+6.2f}% (n={r['n15']:,}) | "
              f"top9% {r['roi9']:+6.2f}% (n={r['n9']:,})", flush=True)

    R = pd.DataFrame(rows)
    win = R.loc[(R["roi15"] + R["roi9"]).idxmax(), "tag"]
    print(f"[total2] winner: {win}", flush=True)
    write(pa, R, win, fits[win], G, yb, po, pu, resid)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def write(pa, R, win, d, G, yb, po, pu, resid):
    # Replace this file's own section rather than appending, so a re-run does not stack copies
    # under the ablation that nba_total_prune.py wrote.
    prev = open(OUT).read() if os.path.exists(OUT) else ""
    prev = prev.split("\n---\n\n# Grading the pruned total")[0].rstrip() + "\n"
    L = ["", "---", "", "# Grading the pruned total", "",
         f"`nba_total_prune2.py`. Five pre-registered configurations, {NULLS} game-level null "
         "shuffles, compared at fixed selectivity so the comparison is between feature sets and "
         "not between strategies.", "",
         "| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {'**'+r['tag']+'**' if r['tag'] == win else r['tag']} | {int(r['k'])} | "
                 f"{r['corr']:+.4f} | {int(r['n15']):,} | {r['w15']:.1f} | {r['b15']:.1f} | "
                 f"**{r['roi15']:+.2f}** | {r['z15']:+.2f} | **{r['roi9']:+.2f}** | {r['z9']:+.2f} |")

    L += ["", f"## {win} on the points ladder", "",
          "Disagreement with the posted total, in points. Nulls are the same 20 game-level "
          "shuffles graded at the same rung.", ""]
    L, best = ladder(pa, L, d[0], yb, po, pu, d[1:], KS)

    k = best[0]
    L += ["", f"## {win} broken out at the ≥{k:g} cut", "",
          "Pooled numbers hide a signal that lives in one season or decays out.", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d[0], yb, po, pu, k, mask=(G[col] == vv))
            if g["n"]:
                t = vv if col == "phase" else str(int(vv))
                L.append(f"| {t} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{col}] " + L[-1], flush=True)
        L.append("")

    # Which SIDE is the edge on? A total model that only works when it says OVER is a different
    # (and more fragile) claim than one that works both ways.
    # NO EDGE COLUMN HERE, ON PURPOSE. Masking to "model OVER" makes every bet an over, so the
    # in-slice base rate IS the win rate and the edge is +0.0 by construction, not by measurement.
    # ROI is the only readable grade on a one-sided mask -- the same reason it is the only readable
    # grade on the moneyline.
    L += ["", f"## {win} at ≥{k:g}, split by which side the model takes", "",
          "| side | bets | win% | ROI |", "|---|---|---|---|"]
    for lab, m in (("model OVER", d[0] > 0), ("model UNDER", d[0] < 0)):
        g = pa.grade(d[0], yb, po, pu, k, mask=m)
        if g["n"]:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | **{g['roi']:+.1f}** |")
            print("[side] " + L[-1], flush=True)
    L.append("")
    open(OUT, "w").write(prev + "\n".join(L) + "\n")
    print(f"\nappended to {OUT}", flush=True)


def ladder(pa, L, d, yb, po, pu, nulls, ks):
    L += ["| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in ks:
        g = pa.grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, po, pu, k))
                       for n in nulls], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} "
                 f"| **{z:+.2f}** |")
        print("[ladder] " + L[-1], flush=True)
        if best is None or g["roi"] > best[1]["roi"]:
            best = (k, g, z)
    L.append("")
    return L, best


if __name__ == "__main__":
    main()
