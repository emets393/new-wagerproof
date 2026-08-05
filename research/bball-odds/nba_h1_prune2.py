#!/usr/bin/env python3
"""Grade the pruned originator FIRST-HALF models — pre-registered cuts, nulls, ladder, breakouts.

`nba_h1_prune.py` ranked twenty families by drop-one ablation on both 1H markets after wiring in
the 160 first-half columns that no model had ever seen. This turns those rankings into
configurations and grades them properly. The ablation was a ranking at two fixed selectivities with
no nulls; nothing in it was a claim.

WHY BOTH MARKETS GET GRADED EVEN THOUGH ONE LOOKS BAD. The 1H spread's baseline is NEGATIVE
(−4.24% / −3.80%) and no family cut rescues it — the best available config on paper still lands
near −2%. That is not a reason to skip it: the full-game total scored only +4.9% at the top 15%
and +12.0% once graded on a POINTS ladder, because a percentile cut and a disagreement-size cut
are different questions. The ladder is the check that says whether a tail exists. Running it is
how "the 1H spread does not clear yet" becomes a measurement instead of an assumption.

THE CUTS ARE PRE-REGISTERED FROM THE ABLATION, never searched — `nba-blind-sweep-fails`.

  1H_TOTAL (base +3.25 / +1.12)
    ALL       every family (815)
    HT1       cut the seven families with a positive drop-one delta on BOTH columns
    T1X       the FULL-GAME total's winner transferred verbatim (cut raw_box, rot_flags, travel).
              A genuine out-of-sample test of whether the two halves want the same features.
    HTCORE    keep only the seven families whose MEAN delta is negative — the ones the model is
              measurably worse without
    HTH1      the 1H block plus the three families it would ride on. Tests directly whether the
              newly-attached first-half columns are what is carrying anything.

  1H_SPREAD (base −4.24 / −3.80)
    ALL       every family (815)
    HS1       cut the only three families positive on BOTH columns (nets, usage, h1_streak)
    SCORE     the FULL-GAME spread's answer transferred: rapm + pl_regr only

HALF-LIFE IS NOT TUNED HERE. 180d is carried over from the full-game total as a pre-registered
default rather than swept, so the config comparison is between feature sets and nothing else. The
sweep only earns its keep if a config clears first.

BASELINE TRAP, and it differs from the full game: the 1H total has NO over-bias (mean residual
+0.093 pts, over hits 50.22% in-slice) where the full game runs +0.675 / 50.7%. `pa.grade` supplies
the in-slice base rate either way — nothing here is scored against 50.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_H1_ORIG.md")
NULLS = 20
HALF_LIFE = 180.0
QS = (0.85, 0.91)

# A first half is half a game, so its disagreements are roughly half as wide as the full game's and
# the full-game ladder (1..12) would put every rung above ≥3 in an empty tail. Scaled accordingly,
# and the spread runs narrower still because a margin averages the two panel rows where a total
# adds them.
KS = {"1H_TOTAL": (0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6),
      "1H_SPREAD": (0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3)}

CUTS = {
    "1H_TOTAL": {
        "ALL": [],
        "HT1": ["style", "adj_eff", "ratings", "dims", "nets", "rot_flags", "pl_regr"],
        "T1X": ["raw_box", "rot_flags", "travel"],
        "HTCORE": ("keep", ["rapm", "form", "misc", "absence", "usage", "h1_streak", "schedule"]),
        "HTH1": ("keep", ["h1_form", "h1_streak", "form", "rapm", "adj_eff"]),
    },
    "1H_SPREAD": {
        "ALL": [],
        "HS1": ["nets", "usage", "h1_streak"],
        "SCORE": ("keep", ["rapm", "pl_regr"]),
    },
}


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    rng = np.random.default_rng(20260801)

    sections = []
    for mkt, S in hp.markets(pa, P, G).items():
        resid, yb = S["resid"], None
        yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
        o = pa.grade(resid, yb, S["po"], S["pu"], 0)
        assert o["win"] > 99.5, f"{mkt} oracle {o['win']:.1f}% -- grader sign is inverted"

        nulls_y = [pa.game_shuffle(P, S["y"], rng) for _ in range(NULLS)]
        fits, rows = {}, []
        for tag, spec in CUTS[mkt].items():
            if isinstance(spec, tuple):
                use = [c for c in cols if fam[c] in spec[1]]
            else:
                use = [c for c in cols if fam[c] not in spec]
            out = pa.ridge_multi(P[use].astype(float), P["date"], [S["y"]] + nulls_y,
                                 half_life=HALF_LIFE)
            d = [S["reduce"](p) for p in out]
            fits[tag] = d
            r = dict(tag=tag, k=len(use), corr=float(d[0].corr(resid)))
            for q, lab in zip(QS, ("15", "9")):
                thr = d[0][d[0].notna() & yb.notna()].abs().quantile(q)
                g = pa.grade(d[0], yb, S["po"], S["pu"], thr)
                ng = [pa.grade(n, yb, S["po"], S["pu"], thr) for n in d[1:]]
                ne = np.array([q2["roi"] for q2 in ng], dtype=float)
                edge = np.array([q2["win"] - q2["base"] for q2 in ng], dtype=float)
                r[f"n{lab}"], r[f"roi{lab}"] = g["n"], g["roi"]
                r[f"w{lab}"], r[f"b{lab}"] = g["win"], g["base"]
                r[f"z{lab}"] = (g["win"] - g["base"] - np.nanmean(edge)) / max(
                    np.nanstd(ne, ddof=1), 1e-9)
            rows.append(r)
            print(f"[{mkt}] {tag:7s} k={len(use):3d} corr {r['corr']:+.4f} | "
                  f"top15% {r['roi15']:+6.2f}% (n={r['n15']:,}) | "
                  f"top9% {r['roi9']:+6.2f}% (n={r['n9']:,}) | z {r['z15']:+.2f}", flush=True)

        R = pd.DataFrame(rows)
        win = R.loc[(R["roi15"] + R["roi9"]).idxmax(), "tag"]
        print(f"[{mkt}] best config: {win}", flush=True)
        sections.append(section(pa, mkt, R, win, fits[win], G, yb, S, resid))

    prev = open(OUT).read().split("\n---\n\n# Grading the pruned first-half")[0].rstrip() + "\n"
    open(OUT, "w").write(prev + "\n".join(sections) + "\n")
    print(f"\nappended to {OUT}", flush=True)


def section(pa, mkt, R, win, d, G, yb, S, resid):
    L = ["", "---", "", "# Grading the pruned first-half models", ""] if mkt == "1H_TOTAL" else []
    L += [f"## {mkt} — pre-registered configurations", "",
          f"`nba_h1_prune2.py`, half-life {HALF_LIFE:g}d, {NULLS} game-level null shuffles, "
          "compared at fixed selectivity so the comparison is between feature sets and not "
          "between strategies.", "",
          "| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {'**'+r['tag']+'**' if r['tag'] == win else r['tag']} | {int(r['k'])} | "
                 f"{r['corr']:+.4f} | {int(r['n15']):,} | {r['w15']:.1f} | {r['b15']:.1f} | "
                 f"**{r['roi15']:+.2f}** | {r['z15']:+.2f} | **{r['roi9']:+.2f}** | {r['z9']:+.2f} |")

    L += ["", f"### {win} on the points ladder", "",
          "Disagreement with the posted 1H number, in points. Nulls are the same 20 game-level "
          "shuffles graded at the same rung.", "",
          "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in KS[mkt]:
        g = pa.grade(d[0], yb, S["po"], S["pu"], k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, S["po"], S["pu"], k))
                       for n in d[1:]], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} "
                 f"| **{z:+.2f}** |")
        print(f"[{mkt} ladder] " + L[-1], flush=True)
        if best is None or g["roi"] > best[1]["roi"]:
            best = (k, g, z)
    L.append("")

    k = best[0]
    L += [f"### {win} broken out at the ≥{k:g} cut", "",
          "**Three seasons, not four** — the Odds API has no 1H market before 2023-05-03.", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d[0], yb, S["po"], S["pu"], k, mask=(G[col] == vv))
            if g["n"]:
                t = vv if col == "phase" else str(int(vv))
                L.append(f"| {t} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{mkt} {col}] " + L[-1], flush=True)
        L.append("")

    # ROI ONLY, ON PURPOSE. A one-sided mask makes every bet the same side, so the in-slice base
    # rate IS the win rate and the edge is +0.0 by construction, not by measurement.
    hi, lo = ("model OVER", "model UNDER") if mkt == "1H_TOTAL" else ("model HOME", "model AWAY")
    L += [f"### {win} at ≥{k:g}, split by which side the model takes", "",
          "| side | bets | win% | ROI |", "|---|---|---|---|"]
    for lab, m in ((hi, d[0] > 0), (lo, d[0] < 0)):
        g = pa.grade(d[0], yb, S["po"], S["pu"], k, mask=m)
        if g["n"]:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | **{g['roi']:+.1f}** |")
            print(f"[{mkt} side] " + L[-1], flush=True)
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    main()
