#!/usr/bin/env python3
"""The NBA season broken into phases: volume, percentages, gaps, and every market.

⛔ NBA ONLY.

Plain question: does the public, and the market, behave differently in October than in
March? Everything in one table per season so the shape is visible rather than inferred.

Phases, from the slate date and `game_type`:
    Oct-Nov   opening          Dec-Jan   mid        Feb-Mar   late
    Apr reg   stretch run      playoffs  post-season (game_type == 'post')

Preseason is dropped — different rosters, different market.

⚠ Two things that are NOT comparable across seasons and are shown per season for that
reason: ticket VOLUME (median falls 44,379 -> 23,860 -> 18,036 across the three) and the
money-vs-tickets GAP (AN's NBA money% changed between 2023-24 and 2024-25; see the
README). Comparing a 2023-24 number to a 2025-26 number on either of those is comparing
two different measurements. Comparing phases WITHIN a season is fine, and that is what
this file is for.

    python3 nba_phases.py
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PARQUET = os.path.join(HERE, "data", "nba_splits.parquet")
NPERM = 3000
RNG = np.random.default_rng(20261016)

PHASES = ["Oct-Nov", "Dec-Jan", "Feb-Mar", "Apr reg", "playoffs"]


def phase_of(row):
    if row.game_type == "post":
        return "playoffs"
    m = row.slate_date.month
    if m in (10, 11):
        return "Oct-Nov"
    if m in (12, 1):
        return "Dec-Jan"
    if m in (2, 3):
        return "Feb-Mar"
    return "Apr reg"


def wilson(k, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def main():
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    d = pd.read_parquet(PARQUET)
    d = d[d.game_type != "pre"].copy()
    d["slate_date"] = pd.to_datetime(d.slate_date)
    d["phase"] = d.apply(phase_of, axis=1)
    d["gap_sp"] = (d.mny_away.astype(float) - d.tix_away.astype(float)).abs()
    d["gap_ou"] = (d.mny_over.astype(float) - d.tix_over.astype(float)).abs()

    for season, sd in d.groupby("season"):
        print("=" * 108)
        print(f"SEASON {season - 1}-{str(season)[2:]}   ({len(sd)} games)")
        print("=" * 108)
        print(f"  {'phase':<10}{'games':>7}{'med tickets':>13}{'crowd% sp':>11}"
              f"{'crowd% ou':>11}{'|gap| sp':>10}{'|gap| ou':>10}"
              f"{'home cov':>10}{'over':>8}{'fav cov':>9}")
        for ph in PHASES:
            g = sd[sd.phase == ph]
            if not len(g):
                continue
            sp, ou = g[g.sp_ok], g[g.ou_ok]
            if not len(sp):
                continue
            print(f"  {ph:<10}{len(g):>7}{g.tickets.median():>13,.0f}"
                  f"{sp.pub_pct.median():>10.0f}%{ou.ou_pub_pct.median():>10.0f}%"
                  f"{sp.gap_sp.median():>10.1f}{ou.gap_ou.median():>10.1f}"
                  f"{sp.home_covered.mean():>10.1%}{ou.over_hit.mean():>8.1%}"
                  f"{sp.fav_covered.mean():>9.1%}")

        print(f"\n  how the CROWD did, by phase  (break-even 52.4%)")
        print(f"  {'phase':<10}{'spread side':>26}{'totals side':>26}")
        for ph in PHASES:
            g = sd[sd.phase == ph]
            sp, ou = g[g.sp_ok], g[g.ou_ok]
            if len(sp) < 40:
                continue
            ks, ns = int(sp.pub_covered.sum()), len(sp)
            ko, no = int(ou.ou_pub_won.sum()), len(ou)
            # read from the bet's side: a sub-50% cell is a winning fade
            ss = f"{ks}-{ns - ks} {ks / ns:.1%}" + ("  (FADE)" if ks / ns < .5 else "")
            oo = f"{ko}-{no - ko} {ko / no:.1%}" + ("  (FADE)" if ko / no < .5 else "")
            print(f"  {ph:<10}{ss:>26}{oo:>26}")
        print()

    # ---- pooled phase test, per season to avoid mixing the measurement change ----
    print("=" * 108)
    print("DOES PHASE MATTER? pooled across seasons for the OUTCOME columns only")
    print("(volume and |gap| are NOT pooled — they are different measurements per season)")
    print("=" * 108)
    sp, ou = d[d.sp_ok], d[d.ou_ok]
    print(f"  {'phase':<10}{'n':>6}{'home cover':>12}{'over':>9}{'fav cover':>11}"
          f"{'crowd spread':>14}{'crowd totals':>14}")
    for ph in PHASES:
        a, b = sp[sp.phase == ph], ou[ou.phase == ph]
        if len(a) < 60:
            continue
        print(f"  {ph:<10}{len(a):>6}{a.home_covered.mean():>12.1%}{b.over_hit.mean():>9.1%}"
              f"{a.fav_covered.mean():>11.1%}{a.pub_covered.mean():>14.1%}"
              f"{b.ou_pub_won.mean():>14.1%}")

    # family test: does any phase cell beat a within-night reshuffle?
    for lab, frame, col in (("over", ou, "over_hit"),
                            ("crowd spread", sp, "pub_covered"),
                            ("crowd totals", ou, "ou_pub_won")):
        masks = [(frame.phase == ph).values for ph in PHASES
                 if (frame.phase == ph).sum() >= 60]
        base = frame[col].values.astype(bool)
        # ⛔ THE PERMUTATION UNIT MUST BE ABLE TO MOVE GAMES BETWEEN THE CELLS BEING
        # COMPARED. Phase is derived from the slate DATE, so every game on a night shares
        # a phase and a within-night shuffle cannot move any game between phases — the
        # cell means come back identical and the null has standard deviation exactly 0,
        # which prints as p=1.000 and looks like a clean null. It is not a null, it is a
        # no-op. (Same class as a within-week shuffle on strata holding one game each.)
        # Phase is therefore tested against a within-SEASON shuffle, which preserves each
        # season's base rate while letting games cross phases.
        idx = {}
        for i, k in enumerate(frame.season.values):
            idx.setdefault(k, []).append(i)

        def best(ov):
            return max(abs(ov[m].mean() - 0.5) for m in masks)

        obs = best(base)
        null = []
        for _ in range(NPERM):
            ov = base.copy()
            for ix in idx.values():
                if len(ix) > 1:
                    ov[ix] = RNG.permutation(ov[ix])
            null.append(best(ov))
        null = np.array(null)
        p = (null >= obs).mean()
        print(f"    FAMILY [{lab}]: best {obs * 100:.1f} pts off 50%; null "
              f"{null.mean() * 100:.1f} ± {null.std() * 100:.1f}  p={p:.3f}"
              f"  {'<-- SURVIVES' if p < 0.05 else '(noise)'}")

    print("\n  playoffs vs regular season, the one structural split worth naming:")
    for lab, frame, col in (("over", ou, "over_hit"), ("home cover", sp, "home_covered"),
                            ("crowd spread", sp, "pub_covered")):
        po = frame[frame.phase == "playoffs"][col]
        rg = frame[frame.phase != "playoffs"][col]
        lo, hi = wilson(int(po.sum()), len(po))
        print(f"    {lab:<14} playoffs {po.mean():>6.1%} (n={len(po)}, [{lo:.0%},{hi:.0%}])"
              f"   regular {rg.mean():>6.1%} (n={len(rg)})")


if __name__ == "__main__":
    main()
