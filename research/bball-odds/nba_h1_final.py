#!/usr/bin/env python3
"""The first-half models, graded once at the settled feature set and the measured half-life.

Everything before this graded the 1H at half-life 180d, carried over from the full-game total
without measuring it. That was wrong for both markets. The sweep in `nba_h1_prune3.py` says a HALF
wants a SHORT memory — 90-120d on the total (28/28 cells profitable, pooled worst on three of four
columns) and 120-240d on the spread (26/28) — where the full-game total wanted 180-240d. Mechanism:
a first half is starters against starters, so it tracks current team strength the way the full-game
SPREAD does, not the slowly-drifting season-long scoring environment the full-game total tracks.
120d is taken for both: it is inside the hill on each and top-two on the tight columns of each.

THE FEATURE SETS ARE WHERE THREE ROUNDS OF PRE-REGISTERED PRUNING STOPPED, not where a search
landed. Each round cut exactly the families with a positive drop-one delta on BOTH selectivities,
re-measured against the newly pruned baseline, and stopped when that set came back empty.

    1H_TOTAL   cut style, adj_eff, ratings, dims, nets, rot_flags, pl_regr        (587 feats)
               round three came back EMPTY -- nothing was positive on both columns
    1H_SPREAD  cut nets, usage, h1_streak, then raw_box, form, h1_form, dims      (475 feats)
               the spread read as a lost cause at -4.24% until `raw_box` came out

TWO HONEST NOTES ON SELECTION. The half-life was chosen after seeing the sweep and the rung is
chosen after seeing the ladder. Both are defensible only because the surfaces are broad — the
total is profitable at all seven half-lives and the spread at five of seven — and neither is
defensible as a single cell.

THE `edge` COLUMN IS BIASED, AND NOW WE KNOW BY HOW MUCH. `pa.grade` sets `base = max(p, 1-p)`
inside the SELECTED rows, which is the max of a noisy proportion and therefore biased UP, so the
printed edge is biased DOWN — about -1.9 points at n=460 and -2.4 at n=291 by simulation, matching
the observed null means of -1.78 and -2.06 almost exactly. Two consequences: the **z is correct**,
because it subtracts the null mean, and a second `edge vs lg` column is printed here against the
LEAGUE rate for the sides actually taken, which carries no max() bias at all.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_H1_ORIG.md")
NULLS = 30
HALF_LIFE = 120.0

CUT = {
    "1H_TOTAL": ["style", "adj_eff", "ratings", "dims", "nets", "rot_flags", "pl_regr"],
    "1H_SPREAD": ["nets", "usage", "h1_streak", "raw_box", "form", "h1_form", "dims"],
}
KS = {"1H_TOTAL": (3, 4, 5, 6, 7, 8, 9, 10),
      "1H_SPREAD": (1, 1.5, 2, 2.5, 3, 4, 5, 6)}


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def edge_lg(pred, yb, k, mask=None):
    """Edge against the LEAGUE rate for the sides actually taken — no max() bias.

    `grade`'s base is the best blind side inside the selected rows, so it is the maximum of a noisy
    proportion and reads too high on small slices. This asks the fair question instead: what would a
    bettor have won taking the SAME sides blind, at the league's own over/under (or home/away) split?
    """
    ok = pred.notna() & yb.notna() & (pred.abs() >= k)
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 25:
        return np.nan
    lg = yb.dropna().mean()
    side = (pred[ok] > 0).astype(float)
    win = np.where(side > 0, yb[ok], 1 - yb[ok]).mean()
    return 100 * (win - (side.mean() * lg + (1 - side.mean()) * (1 - lg)))


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    rng = np.random.default_rng(20260801)

    sections = []
    for mkt, S in hp.markets(pa, P, G).items():
        resid = S["resid"]
        yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
        assert pa.grade(resid, yb, S["po"], S["pu"], 0)["win"] > 99.5, f"{mkt} oracle inverted"
        use = [c for c in cols if fam[c] not in CUT[mkt]]
        print(f"\n=== {mkt} | {len(use)} features | half-life {HALF_LIFE:g}d ===", flush=True)

        nulls_y = [pa.game_shuffle(P, S["y"], rng) for _ in range(NULLS)]
        d = [S["reduce"](p) for p in pa.ridge_multi(
            P[use].astype(float), P["date"], [S["y"]] + nulls_y, half_life=HALF_LIFE)]

        L = [f"## {mkt}", "",
             f"**{len(use)} features**, half-life {HALF_LIFE:g}d, no market column anywhere. "
             f"Cut: `{'`, `'.join(CUT[mkt])}`. corr with the realised residual "
             f"**{d[0].corr(resid):+.4f}**.", "",
             "`edge` is against the best blind side inside the slice and reads LOW on small "
             "samples; `edge vs lg` is against the league rate for the sides actually taken and "
             "carries no such bias. `z` subtracts the null mean, so it is correct either way.", "",
             "| cut (pts) | bets | win% | base% | edge | edge vs lg | ROI | null mean | null sd | z |",
             "|---|---|---|---|---|---|---|---|---|---|"]
        best = None
        for k in KS[mkt]:
            g = pa.grade(d[0], yb, S["po"], S["pu"], k)
            if not g["n"] or g["n"] < 80:
                continue
            ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, S["po"], S["pu"], k))
                           for n in d[1:]], dtype=float)
            mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
            z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
            L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"{g['win']-g['base']:+.1f} | **{edge_lg(d[0], yb, k):+.1f}** | "
                     f"**{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} | **{z:+.2f}** |")
            print(f"[{mkt}] " + L[-1], flush=True)
            if best is None or (not np.isnan(z) and z > best[1]):
                best = (k, z)
        L.append("")

        k = best[0]
        L += [f"### Broken out at ≥{k:g} — the highest-z rung, not the highest-ROI one", "",
              "**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.", "",
              "| slice | bets | win% | edge vs lg | ROI |", "|---|---|---|---|---|"]
        hi, lo = ("OVER", "UNDER") if mkt == "1H_TOTAL" else ("HOME", "AWAY")
        slices = [(str(int(v)), G["season"] == v) for v in sorted(G["season"].dropna().unique())]
        slices += [(p, G["phase"] == p) for p in ("EARLY", "MID", "LATE", "POST")]
        slices += [(f"model {hi}", d[0] > 0), (f"model {lo}", d[0] < 0)]
        for lab, m in slices:
            g = pa.grade(d[0], yb, S["po"], S["pu"], k, mask=m)
            if not g["n"]:
                continue
            # A one-sided mask makes base == win by construction, so the side rows get ROI only.
            e = "—" if lab.startswith("model") else f"{edge_lg(d[0], yb, k, m):+.1f}"
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {e} | **{g['roi']:+.1f}** |")
            print(f"[{mkt} {lab}] " + L[-1], flush=True)
        L.append("")

        # Every season x side cell. The full-game total survived this with one loser out of six;
        # it is the check that catches a model that only works on one side in one year.
        L += [f"### ≥{k:g}, every season x side cell", "",
              "| | " + " | ".join(f"model {s}" for s in (hi, lo)) + " |", "|---|---|---|"]
        for v in sorted(G["season"].dropna().unique()):
            cells = []
            for m in (d[0] > 0, d[0] < 0):
                g = pa.grade(d[0], yb, S["po"], S["pu"], k, mask=m & (G["season"] == v))
                cells.append("—" if not g["n"] else f"{g['roi']:+.1f}% (n={g['n']})")
            L.append(f"| {int(v)} | " + " | ".join(cells) + " |")
            print(f"[{mkt} grid] " + L[-1], flush=True)
        L.append("")
        sections.append("\n".join(L))

    prev = open(OUT).read().split("\n---\n\n# The settled first-half models")[0].rstrip() + "\n"
    open(OUT, "w").write(prev + "\n---\n\n# The settled first-half models\n\n"
                         + "\n".join(sections) + "\n")
    print(f"\nappended to {OUT}", flush=True)


if __name__ == "__main__":
    main()
