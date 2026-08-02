#!/usr/bin/env python3
"""Round two on the first-half models: the tail I cut off, a second prune, and the half-life.

THREE THINGS ROUND ONE GOT WRONG OR LEFT UNDONE.

1. **THE LADDER WAS TRUNCATED.** I capped the 1H total at ≥6 points reasoning that a half is half a
   game, so its disagreements should be half as wide. The ladder was still CLIMBING at the ceiling
   — ≥4 edge +0.9 / z +2.18, ≥5 +2.2 / +2.91, ≥6 +3.5 / **+4.52** — so the ceiling was cutting off
   exactly the region where the full-game total makes all of its money. Extended to ≥12 here, and
   the spread to ≥8. This is the same failure the full-game script carries a comment about; I wrote
   the warning and then made the mistake anyway.

2. **PRUNING HELPED MORE THAN EXPECTED, SO PRUNE AGAIN.** `HT1` (drop the seven families with a
   positive drop-one delta on both columns) moved the 1H total from +3.25/+1.12 to +5.83/+7.60 and
   corr +0.0349 → +0.0455. When one round of cutting buys that much, the ranking that produced it
   was measured against a noisier baseline than the one we now have — so the ablation is re-run ON
   TOP OF the pruned set. That is iterative pruning with a pre-registered rule, not a search: round
   three cuts whatever is positive on both columns here, and there is no round four.

3. **HALF-LIFE WAS ASSUMED, NOT MEASURED.** Round two carried 180d over from the full-game total so
   the config comparison would be clean. But the full game already proved the setting is
   market-specific (total 180-240d, spread 90-120d), and a first half is a different scoring process
   again — fewer possessions, starters-only rotations, no garbage time. Swept at FIXED SELECTIVITY
   per `model-regime-drift-law`; read the SHAPE of the sweep, not its argmax.

WHY BOTH MARKETS STAY IN. The 1H spread is at −1.65% after one prune, which is losing money. But
its ladder was truncated too (best rung was the last one, ≥3 at −2.4%), and the full-game total went
from +4.9% at a percentile cut to +12.0% on a points ladder. Truncated-and-negative is not the same
claim as measured-and-negative.
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

# The round-two winners, carried in as the new baseline.
BASE_CUT = {
    "1H_TOTAL": ["style", "adj_eff", "ratings", "dims", "nets", "rot_flags", "pl_regr"],
    "1H_SPREAD": ["nets", "usage", "h1_streak"],
}
# Ladders now run to where the sample actually dies, not to where I assumed it would.
KS = {"1H_TOTAL": (2, 3, 4, 5, 6, 7, 8, 9, 10, 12),
      "1H_SPREAD": (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8)}
HLS = (60, 90, 120, 180, 240, 365, None)
SWEEP_QS = (0.20, 0.15, 0.09, 0.05)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    counts = fam.value_counts()
    rng = np.random.default_rng(20260801)

    sections = []
    for mkt, S in hp.markets(pa, P, G).items():
        resid = S["resid"]
        yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
        assert pa.grade(resid, yb, S["po"], S["pu"], 0)["win"] > 99.5, f"{mkt} oracle inverted"
        keep = [c for c in cols if fam[c] not in BASE_CUT[mkt]]
        kept_fams = [f for f in counts.index if f not in BASE_CUT[mkt]]
        print(f"\n=== {mkt} | pruned base {len(keep)} features, "
              f"{len(kept_fams)} families ===", flush=True)

        L = [f"## {mkt} — round two", "",
             f"Pruned base: **{len(keep)} features** after cutting "
             f"`{'`, `'.join(BASE_CUT[mkt])}`.", ""]

        # --- 1. the tail I cut off -------------------------------------------------------------
        nulls_y = [pa.game_shuffle(P, S["y"], rng) for _ in range(NULLS)]
        out = pa.ridge_multi(P[keep].astype(float), P["date"], [S["y"]] + nulls_y,
                             half_life=HALF_LIFE)
        d = [S["reduce"](p) for p in out]
        L += ["### The full ladder, run out to where the sample dies", "",
              "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        best = None
        for k in KS[mkt]:
            g = pa.grade(d[0], yb, S["po"], S["pu"], k)
            if not g["n"] or g["n"] < 60:
                continue
            ne = np.array([pa.grade(n, yb, S["po"], S["pu"], k)["win"]
                           - pa.grade(n, yb, S["po"], S["pu"], k)["base"] for n in d[1:]],
                          dtype=float)
            mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
            z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
            L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} "
                     f"| **{z:+.2f}** |")
            print(f"[{mkt} ladder] " + L[-1], flush=True)
            # Pick on z, not on the ROI argmax -- the full-game total's ROI peaked at ≥12 on 204
            # bets against a null sd of 1.72, where ≥8 had three times the sample and half the noise.
            if best is None or (not np.isnan(z) and z > best[2]):
                best = (k, g, z)
        L.append("")

        k = best[0]
        L += [f"### Broken out at ≥{k:g} — the highest-z rung, not the highest-ROI one", "",
              "**Three seasons, not four**; the Odds API has no 1H market before 2023-05-03.", ""]
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
        # ROI only: a one-sided mask makes base == win by construction.
        hi, lo = ("model OVER", "model UNDER") if mkt == "1H_TOTAL" else ("model HOME", "model AWAY")
        L += [f"### At ≥{k:g}, by side taken", "", "| side | bets | win% | ROI |", "|---|---|---|---|"]
        for lab, m in ((hi, d[0] > 0), (lo, d[0] < 0)):
            g = pa.grade(d[0], yb, S["po"], S["pu"], k, mask=m)
            if g["n"]:
                L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | **{g['roi']:+.1f}** |")
                print(f"[{mkt} side] " + L[-1], flush=True)
        L.append("")

        # --- 2. prune again, on top of the pruned set ------------------------------------------
        b15, b9 = None, None
        L += ["### Second-round drop-one, measured against the PRUNED baseline", "",
              "Round one ranked families against the unpruned 815. Cutting seven of them moved the "
              "model enough that the ranking deserves re-measuring on the set we now have.", "",
              "| family | cols | ROI top 15% | delta | ROI top 9% | delta |", "|---|---|---|---|---|---|"]
        ab = []
        for tag, use in [("BASE", keep)] + [(f, [c for c in keep if fam[c] != f])
                                            for f in kept_fams]:
            dd = S["reduce"](pa.ridge_multi(P[use].astype(float), P["date"], [S["y"]],
                                            half_life=HALF_LIFE)[0])
            a = dd[dd.notna() & yb.notna()].abs()
            r = {"tag": tag, "k": len(use), "corr": float(dd.corr(resid))}
            for q, lab in zip(QS, ("15", "9")):
                r[f"roi{lab}"] = pa.grade(dd, yb, S["po"], S["pu"], a.quantile(q))["roi"]
            if tag == "BASE":
                b15, b9 = r["roi15"], r["roi9"]
            else:
                ab.append(r)
            print(f"[{mkt} ab2] {tag:11s} k={len(use):3d} corr {r['corr']:+.4f} "
                  f"top15% {r['roi15']:+6.2f}% top9% {r['roi9']:+6.2f}%", flush=True)
        for r in sorted(ab, key=lambda x: -x["roi15"]):
            L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi15']:+.2f} | "
                     f"**{r['roi15']-b15:+.2f}** | {r['roi9']:+.2f} | **{r['roi9']-b9:+.2f}** |")
        again = [r["tag"] for r in ab if r["roi15"] > b15 and r["roi9"] > b9]
        L += ["", f"Positive on both columns, so cut in round three: "
              f"{'`' + '`, `'.join(again) + '`' if again else '**nothing** — the prune is done'}.", ""]
        print(f"[{mkt} ab2] round-three cut: {again or 'NOTHING'}", flush=True)

        if again:
            use = [c for c in keep if fam[c] not in again]
            out3 = pa.ridge_multi(P[use].astype(float), P["date"], [S["y"]] + nulls_y,
                                  half_life=HALF_LIFE)
            d3 = [S["reduce"](p) for p in out3]
            g = pa.grade(d3[0], yb, S["po"], S["pu"], k)
            ne = np.array([pa.grade(n, yb, S["po"], S["pu"], k)["win"]
                           - pa.grade(n, yb, S["po"], S["pu"], k)["base"] for n in d3[1:]],
                          dtype=float)
            sd = np.nanstd(ne, ddof=1)
            z3 = (g["win"] - g["base"] - np.nanmean(ne)) / sd if sd else np.nan
            L += [f"Round-three set: **{len(use)} features**, corr {d3[0].corr(resid):+.4f}, at "
                  f"≥{k:g} → **{g['n']:,} bets, {g['win']:.1f}% vs {g['base']:.1f}%, "
                  f"{g['roi']:+.1f}% ROI, z {z3:+.2f}**.", ""]
            print(f"[{mkt} r3] " + L[-2], flush=True)
            if g["roi"] > pa.grade(d[0], yb, S["po"], S["pu"], k)["roi"]:
                d = d3
                keep = use

        # --- 3. how long a memory does a HALF want? --------------------------------------------
        L += ["### Half-life sweep at fixed selectivity", "",
              "Round two carried 180d over from the full-game total without measuring it. Read the "
              "SHAPE, not the argmax.", "",
              "| half-life | corr | " + " | ".join(f"top {int(q*100)}%" for q in SWEEP_QS) + " |",
              "|---|---|" + "---|" * len(SWEEP_QS)]
        for hl in HLS:
            dd = S["reduce"](pa.ridge_multi(P[keep].astype(float), P["date"], [S["y"]],
                                            half_life=hl)[0])
            a = dd[dd.notna() & yb.notna()].abs()
            cells = [pa.grade(dd, yb, S["po"], S["pu"], a.quantile(1 - q))["roi"] for q in SWEEP_QS]
            L.append(f"| {'pooled' if hl is None else f'{hl:g}d'} | {dd.corr(resid):+.4f} | "
                     + " | ".join(f"**{c:+.2f}**" for c in cells) + " |")
            print(f"[{mkt} hl] " + L[-1], flush=True)
        L.append("")
        sections.append("\n".join(L))

    prev = open(OUT).read().split("\n---\n\n# First-half round two")[0].rstrip() + "\n"
    open(OUT, "w").write(prev + "\n---\n\n# First-half round two\n\n" + "\n".join(sections) + "\n")
    print(f"\nappended to {OUT}", flush=True)


if __name__ == "__main__":
    main()
