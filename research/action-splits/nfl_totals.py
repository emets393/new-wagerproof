#!/usr/bin/env python3
"""NFL totals, properly, across 2023-2026. ~877 graded over/unders.

Totals have only ever been a side-cell in this directory. This is the dedicated pass.

⛔ NFL ONLY. A CFB result is not evidence about any of this and vice versa.

## The headline test: a recorded finding, finally out of sample

The `action-network-splits` note carries this as the strongest cross-league read on file:
**when the ticket majority and the money majority are on OPPOSITE sides of a total, back
the MONEY side** — logged at NFL 78.6% and CFB 65.2%.

The NFL number came off **n=14**. Three completed seasons now exist for it. That is the
same situation as the heavy-public spread fade, which looked immaculate on 22 games and
died on 281, so this gets the same treatment: the rule is applied UNFITTED and scored
SEASON BY SEASON, because a pooled number one good year can carry is not evidence.

## Everything else asked here, pre-registered

  1. base rate — over vs under, per season (is the market even centred?)
  2. fade the crowd's totals side, by how lopsided it is
  3. the flip rule above, plus its dose (size of the money-minus-tickets gap)
  4. total line level — do big totals go under and small totals go over?
  5. the crowd's over-bias — is "the public loves overs" true, and does it pay?

## Null

Permutation within (season, week), so a week's actual over/under count stays fixed and
only which games carry which label moves. Cells are corrected best-of-N across the family.
A rate compared against 50% rather than against this null is how the last three false
findings in this directory got born.

    python3 nfl_totals.py
"""
import argparse

import numpy as np
import pandas as pd

from nfl_fade_oos import wilson
from nfl_slots import build

NPERM = 3000
RNG = np.random.default_rng(20261016)


def rec(mask, won):
    n = int(mask.sum())
    if not n:
        return None
    k = int(won[mask].sum())
    lo, hi = wilson(k, n)
    roi = (k * 100 - (n - k) * 110) / (n * 110)
    return dict(k=k, n=n, rate=k / n, lo=lo, hi=hi, roi=roi)


def show(label, r, indent=4):
    if not r:
        print(" " * indent + f"{label:<34} —")
        return
    print(" " * indent + f"{label:<34} {r['k']}-{r['n'] - r['k']:<4} {r['rate']:>6.1%}"
          f"  [{r['lo']:.0%},{r['hi']:.0%}]  roi {r['roi']:+6.1%}  n={r['n']}")


def by_season(d, mask, won, label):
    print(f"      {label} season by season:")
    for s, g in d[mask].groupby("season"):
        w = won[mask][d[mask].season.values == s]
        k, n = int(w.sum()), len(w)
        if n:
            print(f"        {s}: {k}-{n - k}  {k / n:5.1%}  (n={n})")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    a = ap.parse_args()

    d = build(a.seasons)
    d = d[d.ou_ok].copy().reset_index(drop=True)
    d["tix_over"] = d.tix_over.astype(float)
    d["mny_over"] = d.mny_over.astype(float)
    d = d[d.mny_over.notna()].reset_index(drop=True)
    over = d.over_hit.values

    print(f"NFL totals {min(a.seasons)}-{max(a.seasons)}: {len(d)} graded over/unders\n")

    print("=" * 94)
    print("1. BASE RATE — is the market centred?")
    print("=" * 94)
    for s, g in d.groupby("season"):
        k = int(g.over_hit.sum())
        lo, hi = wilson(k, len(g))
        print(f"    {s}: over {k}-{len(g) - k}  {k / len(g):.1%}  [{lo:.0%},{hi:.0%}]")
    k = int(over.sum())
    print(f"    ALL : over {k}-{len(d) - k}  {k / len(d):.1%}")

    print("\n" + "=" * 94)
    print("2. FADE THE CROWD'S TOTALS SIDE, by how lopsided it is")
    print("=" * 94)
    pub_won = d.ou_pub_won.values
    for lo_, hi_ in [(50, 55), (55, 60), (60, 65), (65, 70), (70, 101)]:
        m = (d.ou_pub_pct >= lo_) & (d.ou_pub_pct < hi_)
        show(f"crowd {lo_}-{hi_ - 1}% — crowd side hits", rec(m.values, pub_won))
    r = np.corrcoef(d.ou_pub_pct, pub_won.astype(float))[0, 1]
    print(f"    continuous corr(crowd%, crowd side hits) = {r:+.3f}")

    print("\n" + "=" * 94)
    print("3. ★ THE FLIP RULE — tickets and money on OPPOSITE sides, back the MONEY")
    print("=" * 94)
    # tickets majority over, money majority under, or vice versa
    flip = ((d.tix_over > 50) & (d.mny_over < 50)) | ((d.tix_over < 50) & (d.mny_over > 50))
    money_over = d.mny_over > 50
    money_won = np.where(money_over, over, ~over)
    print(f"    flips happen in {flip.mean():.1%} of games ({int(flip.sum())} of {len(d)})")
    show("back the MONEY side on a flip", rec(flip.values, money_won))
    show("back the TICKET side on a flip", rec(flip.values, ~money_won))
    show("control: no flip, back the money", rec((~flip).values, money_won))
    by_season(d, flip.values, money_won, "back the MONEY on a flip")
    print(f"\n    recorded prior: NFL 78.6% on n=14 (2026 wks1-3). Compare the above.")

    print("\n    dose — size of the money-minus-tickets gap on the OVER side:")
    gap = (d.mny_over - d.tix_over).abs()
    for lo_, hi_ in [(0, 5), (5, 10), (10, 15), (15, 100)]:
        m = ((gap >= lo_) & (gap < hi_)).values
        show(f"  |money-tickets| {lo_}-{hi_}", rec(m, money_won))

    print("\n" + "=" * 94)
    print("4. TOTAL LINE LEVEL — do big totals go under?")
    print("=" * 94)
    for lo_, hi_ in [(0, 41), (41, 45), (45, 48), (48, 51), (51, 200)]:
        m = ((d.total_line >= lo_) & (d.total_line < hi_)).values
        show(f"total {lo_}-{hi_ - 1 if hi_ < 200 else '+'}  — over hits", rec(m, over))
    r = np.corrcoef(d.total_line, over.astype(float))[0, 1]
    print(f"    continuous corr(total line, over hits) = {r:+.3f}")

    print("\n" + "=" * 94)
    print("5. THE CROWD'S OVER-BIAS — is it real, and does it pay?")
    print("=" * 94)
    print(f"    crowd is on the OVER in {(d.tix_over > 50).mean():.1%} of games "
          f"(median over-ticket share {d.tix_over.median():.0f}%)")
    show("crowd on OVER — over hits", rec((d.tix_over > 50).values, over))
    show("crowd on UNDER — under hits", rec((d.tix_over < 50).values, ~over))
    show("heavy crowd on OVER (>=65%) — over hits",
         rec((d.tix_over >= 65).values, over))
    show("heavy crowd on UNDER (>=65%) — under hits",
         rec((d.tix_over <= 35).values, ~over))

    print("\n" + "=" * 94)
    print("FAMILY CORRECTION — what does noise look like on this many cells?")
    print("=" * 94)
    # the scored family: the lopsidedness bands, the flip rule, the line bands
    def family(ov):
        out = []
        pw = np.where(d.pub_over.values, ov, ~ov)
        for lo_, hi_ in [(50, 55), (55, 60), (60, 65), (65, 70), (70, 101)]:
            m = ((d.ou_pub_pct >= lo_) & (d.ou_pub_pct < hi_)).values
            if m.sum() >= 30:
                out.append(abs(pw[m].mean() - 0.5))
        mw = np.where(money_over.values, ov, ~ov)
        if flip.sum() >= 30:
            out.append(abs(mw[flip.values].mean() - 0.5))
        for lo_, hi_ in [(0, 41), (41, 45), (45, 48), (48, 51), (51, 200)]:
            m = ((d.total_line >= lo_) & (d.total_line < hi_)).values
            if m.sum() >= 30:
                out.append(abs(ov[m].mean() - 0.5))
        return max(out) if out else np.nan

    obs_best = family(over)
    key = list(zip(d.season.values, d.week.values))
    uniq = {}
    for i, k in enumerate(key):
        uniq.setdefault(k, []).append(i)
    null = []
    for _ in range(NPERM):
        ov = over.copy()
        for idx in uniq.values():
            if len(idx) > 1:
                ov[idx] = RNG.permutation(ov[idx])
        null.append(family(ov))
    null = np.array(null, float)
    null = null[~np.isnan(null)]
    p = (null >= obs_best).mean()
    print(f"    most extreme cell observed: {obs_best * 100:.1f} points off 50%")
    print(f"    a within-week reshuffle gives {null.mean() * 100:.1f} ± "
          f"{null.std() * 100:.1f}   p_family={p:.3f}")
    print(f"    -> {'SOMETHING SURVIVES — check it season by season' if p < 0.05 else 'this is what noise looks like at this many cells'}")


if __name__ == "__main__":
    main()
