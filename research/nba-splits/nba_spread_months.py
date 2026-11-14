#!/usr/bin/env python3
"""NBA spreads, month by month, every way the data supports.

⛔ NBA ONLY.

Four crosses, each a family corrected best-of-N:
  1. base rates by month — home, favourite, and favourite-by-location
  2. month x how lopsided the crowd is
  3. month x line size
  4. month x line movement (including reverse line movement)

Null: a WITHIN-SEASON shuffle of the outcome. ⛔ Not within slate date — month is derived
from the date, so every game on a night shares a month and a within-night shuffle cannot
move a game between months. That returns a null with standard deviation exactly 0 and
p=1.000, which reads as a clean null and is a no-op. The permutation unit must be able to
move games between the cells being compared; this bit twice in this directory before it
was written down.

Records are read from the bet's side: a sub-50% cell is a winning fade and is flagged.
Placeholder splits (0%/100%) are excluded upstream by `derive()` — which removes October
2023 entirely, so the October rows carry two seasons, not three.

    python3 nba_spread_months.py
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PARQUET = os.path.join(HERE, "data", "nba_splits.parquet")
NPERM = 3000
RNG = np.random.default_rng(20261016)
BREAK_EVEN = 0.524
MINN = 40

ORDER = [10, 11, 12, 1, 2, 3, 4]
NAME = {10: "Oct", 11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr"}


def wilson(k, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def fmt(won, minn=MINN):
    n = len(won)
    if n == 0:
        return "       —    "
    if n < minn:
        return f"   (n={n})".rjust(12)
    k = int(won.sum())
    rate = k / n
    tag = ""
    if rate < 0.5:
        k, rate, tag = n - k, 1 - rate, "f"
    return f"{k}-{n - k} {rate:.0%}{tag}".rjust(12)


def family(d, masks, base, flip, label):
    """best-of-N over a cross; outcome shuffled WITHIN SEASON (see module docstring)."""
    idx = {}
    for i, k in enumerate(d.season.values):
        idx.setdefault(k, []).append(i)

    def best(ov):
        w = flip(ov)
        devs = [abs(w[m].mean() - 0.5) for m in masks if m.sum() >= MINN]
        return max(devs) if devs else np.nan

    obs = best(base)
    null = []
    for _ in range(NPERM):
        ov = base.copy()
        for ix in idx.values():
            if len(ix) > 1:
                ov[ix] = RNG.permutation(ov[ix])
        null.append(best(ov))
    null = np.array(null, float)
    null = null[~np.isnan(null)]
    p = (null >= obs).mean()
    print(f"    FAMILY [{label}]: best {obs * 100:.1f} pts off 50%; null "
          f"{null.mean() * 100:.1f} ± {null.std() * 100:.1f}  p={p:.3f}"
          f"  {'<-- SURVIVES' if p < 0.05 else '(noise)'}")
    return p


def ledger(d, mask, won, label):
    print(f"      {label} by season:")
    for s in sorted(d.season.unique()):
        m = mask & (d.season.values == s)
        if m.sum() >= 20:
            k, n = int(won[m].sum()), int(m.sum())
            lo, hi = wilson(k, n)
            print(f"        {s}: {k}-{n - k}  {k / n:5.1%}  "
                  f"roi {(k * 100 - (n - k) * 110) / (n * 110):+6.1%}  n={n}")


def main():
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    d = pd.read_parquet(PARQUET)
    d = d[(d.game_type == "reg") & d.sp_ok].copy()
    d["slate_date"] = pd.to_datetime(d.slate_date)
    d["month"] = d.slate_date.dt.month
    d = d.reset_index(drop=True)
    print(f"NBA regular-season spreads: {len(d)} graded games, "
          f"{d.season.nunique()} seasons")
    print(f"⚠ October 2023 is placeholder data and excluded, so Oct rows are 2 seasons\n")

    hc = d.home_covered.values
    fav_away = d.fav_away.values
    fav_cov = d.fav_covered.values
    pub_away = d.pub_away.values

    # ---- 1. base rates ----
    print("=" * 110)
    print("1. BASE RATES BY MONTH")
    print("=" * 110)
    print(f"  {'month':<7}{'n':>6}{'home cover':>13}{'fav cover':>13}"
          f"{'ROAD fav cov':>14}{'HOME fav cov':>14}{'avg ATS marg':>14}")
    for m in ORDER:
        g = d[d.month == m]
        if len(g) < 30:
            continue
        rf = g[g.fav_away]
        hf = g[~g.fav_away]
        print(f"  {NAME[m]:<7}{len(g):>6}{g.home_covered.mean():>13.1%}"
              f"{g.fav_covered.mean():>13.1%}{rf.fav_covered.mean():>14.1%}"
              f"{hf.fav_covered.mean():>14.1%}{g.home_ats.mean():>+14.2f}")
    masks = [(d.month == m).values for m in ORDER]
    family(d, masks, fav_cov.astype(bool),
           lambda ov: ov, "fav cover by month")
    # October favourites were 41.1% earlier; name it from the bet's side
    oct_m = (d.month == 10).values
    if oct_m.sum() >= MINN:
        print(f"\n      Oct — FADE the favourite: {fmt(~fav_cov[oct_m]).strip()}")
        ledger(d, oct_m, ~fav_cov, "Oct fade the favourite")

    # ---- 2. month x crowd lopsidedness ----
    print("\n" + "=" * 110)
    print("2. MONTH x HOW LOPSIDED THE CROWD IS  (cells = the crowd's side covers)")
    print("=" * 110)
    bands = [(50, 60, "50-59%"), (60, 70, "60-69%"), (70, 80, "70-79%"), (80, 101, "80%+")]
    print(f"  {'month':<7}{'n':>6}" + "".join(b[2].rjust(12) for b in bands))
    cross = []
    for m in ORDER:
        g = d[d.month == m]
        if len(g) < 30:
            continue
        row = ""
        for lo, hi, _ in bands:
            mm = ((d.month == m) & (d.pub_pct >= lo) & (d.pub_pct < hi)).values
            cross.append(mm)
            row += fmt(d.pub_covered.values[mm])
        print(f"  {NAME[m]:<7}{len(g):>6}{row}")
    print(f"  {'-' * 54}")
    row = ""
    for lo, hi, _ in bands:
        mm = ((d.pub_pct >= lo) & (d.pub_pct < hi)).values
        row += fmt(d.pub_covered.values[mm])
    print(f"  {'ALL':<7}{len(d):>6}{row}")
    family(d, cross, hc.astype(bool), lambda ov: np.where(pub_away, ~ov, ov),
           "month x lopsidedness")

    # ---- 3. month x line size ----
    print("\n" + "=" * 110)
    print("3. MONTH x LINE SIZE  (cells = the FAVOURITE covers)")
    print("=" * 110)
    sizes = [(0, 4, "0-3.5"), (4, 8, "4-7.5"), (8, 12, "8-11.5"), (12, 99, "12+")]
    print(f"  {'month':<7}{'n':>6}" + "".join(s[2].rjust(12) for s in sizes))
    cross2 = []
    for m in ORDER:
        g = d[d.month == m]
        if len(g) < 30:
            continue
        row = ""
        for lo, hi, _ in sizes:
            mm = ((d.month == m) & (d.mag >= lo) & (d.mag < hi)).values
            cross2.append(mm)
            row += fmt(fav_cov[mm])
        print(f"  {NAME[m]:<7}{len(g):>6}{row}")
    print(f"  {'-' * 54}")
    row = ""
    for lo, hi, _ in sizes:
        mm = ((d.mag >= lo) & (d.mag < hi)).values
        row += fmt(fav_cov[mm])
    print(f"  {'ALL':<7}{len(d):>6}{row}")
    family(d, cross2, fav_cov.astype(bool), lambda ov: ov, "month x line size")

    # ---- 4. month x line movement ----
    print("\n" + "=" * 110)
    print("4. MONTH x LINE MOVEMENT  (cells = back the side the line moved TOWARD)")
    print("=" * 110)
    mv = d[d.home_spread_open.notna()].copy()
    mv["move"] = mv.home_spread - mv.home_spread_open
    mv = mv[mv.move != 0].reset_index(drop=True)
    toward_home = (mv.move < 0).values
    line_won = np.where(toward_home, mv.home_covered.values, (~mv.home_covered).values)
    rlm = ((mv.pub_away.values & toward_home)
           | (~mv.pub_away.values & ~toward_home))
    print(f"  {len(mv)} games with a moved opener; RLM (line against the crowd) in "
          f"{rlm.mean():.0%}")
    print(f"  {'month':<7}{'n':>6}{'back the line':>16}{'RLM only':>16}{'line w/ crowd':>16}")
    cross3 = []
    for m in ORDER:
        mm = (mv.month == m).values
        if mm.sum() < 30:
            continue
        cross3 += [mm & rlm, mm & ~rlm]
        print(f"  {NAME[m]:<7}{int(mm.sum()):>6}{fmt(line_won[mm]):>16}"
              f"{fmt(line_won[mm & rlm]):>16}{fmt(mv.pub_covered.values[mm & ~rlm]):>16}")
    print(f"  {'-' * 54}")
    print(f"  {'ALL':<7}{len(mv):>6}{fmt(line_won):>16}{fmt(line_won[rlm]):>16}"
          f"{fmt(mv.pub_covered.values[~rlm]):>16}")
    family(mv, cross3, mv.home_covered.values.astype(bool),
           lambda ov: np.where(toward_home, ov, ~ov), "month x movement")

    print("\n⛔ Read the FAMILY line before any cell, and the season ledger before any "
          "family.")


if __name__ == "__main__":
    main()
