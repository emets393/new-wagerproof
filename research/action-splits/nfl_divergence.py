#!/usr/bin/env python3
"""Money% minus tickets% — the sharp-money read — for SPREADS and TOTALS. 2023-2026.

⛔ NFL ONLY. A CFB result is not evidence about any of this and vice versa.

Why this file exists: the divergence between where the BETS are and where the MONEY is
is the single most-cited public-betting indicator, and it had never had a dedicated pass
here. `money_minus_bets_away` has been a column in action_splits.csv since the beginning
with ZERO downstream readers. Totals got a flip test in nfl_totals.py; spreads got
nothing but a passing correlation.

## Two different constructs, and they are not the same thing

  FLIP (strict)     the ticket majority is on one side and the money majority on the
                    other. Rare — roughly one game in seven — and unambiguous.
  TILT  (relative)  money% exceeds tickets% on a side without crossing 50. Far more
                    common, and the thing a "67% of bets but 81% of money" headline is
                    actually describing. Much larger n, so much more power.

Both are tested, per market, with direction (back the money side vs back the ticket
side) and dose (does a bigger gap pay more?). ★ The dose is the part that matters: a
real sharp-money effect must get STRONGER as the divergence widens. That single check is
what killed the recorded totals flip finding — 10-15 point gaps paid 56.5% while 15+
point gaps paid exactly 50.0%.

## Null

Permutation within (season, week): each week keeps its actual number of covers and only
which game carries which result moves. Every cell is then corrected best-of-N across the
whole family, because this file scores ~26 cells and reporting the winner of 26 against
a coin flip is how the last three false findings here were born.

    python3 nfl_divergence.py
"""
import argparse

import numpy as np
import pandas as pd

from nfl_fade_oos import wilson
from nfl_slots import build

NPERM = 3000
RNG = np.random.default_rng(20261016)
BREAK_EVEN = 0.524


def rec(mask, won):
    n = int(mask.sum())
    if not n:
        return None
    k = int(won[mask].sum())
    lo, hi = wilson(k, n)
    return dict(k=k, n=n, rate=k / n, lo=lo, hi=hi,
                roi=(k * 100 - (n - k) * 110) / (n * 110))


def show(label, r, ind=4):
    if not r or r["n"] < 20:
        print(" " * ind + f"{label:<40} {'(thin)' if r else '—'}"
              + (f" n={r['n']}" if r else ""))
        return
    flag = " *" if r["lo"] > BREAK_EVEN else ""
    print(" " * ind + f"{label:<40} {r['k']}-{r['n'] - r['k']:<4} {r['rate']:>6.1%}"
          f"  [{r['lo']:.0%},{r['hi']:.0%}]  roi {r['roi']:+6.1%}  n={r['n']}{flag}")


def market(d, which):
    """Per-market view: the crowd's side, the money's side, and the signed gap.

    Oriented to the AWAY side for spreads and the OVER for totals, then collapsed onto
    'the money side' so every row reads the same direction.
    """
    if which == "spread":
        tix, mny, ok = d.tix_away.astype(float), d.mny_away.astype(float), d.sp_ok
        away_won = ~d.home_covered
    else:
        tix, mny, ok = d.tix_over.astype(float), d.mny_over.astype(float), d.ou_ok
        away_won = d.over_hit
    m = pd.DataFrame(dict(season=d.season, week=d.week, tix=tix, mny=mny,
                          a_won=away_won, ok=ok))
    m = m[m.ok & m.tix.notna() & m.mny.notna() & (m.tix != 50)].reset_index(drop=True)
    m["gap"] = m.mny - m.tix                      # >0 = money leans AWAY/OVER vs tickets
    m["money_a"] = m.gap > 0                      # the relative money side (TILT)
    m["money_won"] = np.where(m.money_a, m.a_won, ~m.a_won)
    m["crowd_a"] = m.tix > 50
    m["crowd_pct"] = np.where(m.crowd_a, m.tix, 100 - m.tix)
    m["flip"] = ((m.tix > 50) & (m.mny < 50)) | ((m.tix < 50) & (m.mny > 50))
    m["flip_money_a"] = m.mny > 50
    m["flip_money_won"] = np.where(m.flip_money_a, m.a_won, ~m.a_won)
    # does the money AGREE with the crowd, and by how much
    m["money_with_crowd"] = m.money_a == m.crowd_a
    return m


def cells(m):
    """The pre-registered family for one market, as {label: boolean mask} + outcome."""
    out = {}
    for lo, hi in [(0, 5), (5, 10), (10, 15), (15, 20), (20, 101)]:
        out[f"TILT back money, gap {lo}-{hi if hi < 101 else '+'}"] = (
            ((m.gap.abs() >= lo) & (m.gap.abs() < hi)).values, m.money_won.values)
    out["FLIP back money"] = (m.flip.values, m.flip_money_won.values)
    out["FLIP back tickets"] = (m.flip.values, ~m.flip_money_won.values)
    heavy = m.crowd_pct >= 65
    out["heavy crowd + money AGAINST it"] = (
        (heavy & ~m.money_with_crowd).values, m.money_won.values)
    out["heavy crowd + money WITH it"] = (
        (heavy & m.money_with_crowd).values, m.money_won.values)
    out["heavy crowd + gap>=10, back money"] = (
        (heavy & (m.gap.abs() >= 10)).values, m.money_won.values)
    out["back money, all games"] = (np.ones(len(m), bool), m.money_won.values)
    return out


def run(d, which):
    m = market(d, which)
    print("\n" + "=" * 96)
    print(f"{which.upper()}  —  {len(m)} graded games")
    print("=" * 96)
    print(f"    flips occur in {m.flip.mean():.1%} of games; "
          f"money sides WITH the crowd in {m.money_with_crowd.mean():.1%}; "
          f"median |gap| {m.gap.abs().median():.0f} pts")
    print(f"    continuous corr(signed gap, away/over side wins) = "
          f"{np.corrcoef(m.gap, m.a_won.astype(float))[0, 1]:+.3f}")
    print(f"    (break-even {BREAK_EVEN:.1%}; * = 95% lower bound clears it)\n")

    cl = cells(m)
    for label, (mask, won) in cl.items():
        show(label, rec(mask, won))

    # family correction: permute outcomes within (season, week)
    key = list(zip(m.season.values, m.week.values))
    uniq = {}
    for i, k in enumerate(key):
        uniq.setdefault(k, []).append(i)
    a_won = m.a_won.values

    def best(aw):
        mm = m.assign(a_won=aw)
        mm["money_won"] = np.where(mm.money_a, aw, ~aw)
        mm["flip_money_won"] = np.where(mm.flip_money_a, aw, ~aw)
        devs = []
        for _lab, (mask, _w) in cells(mm).items():
            if mask.sum() >= 30:
                w2 = cells(mm)[_lab][1]
                devs.append(abs(w2[mask].mean() - 0.5))
        return max(devs) if devs else np.nan

    obs = best(a_won)
    null = []
    for _ in range(NPERM // 3):
        aw = a_won.copy()
        for idx in uniq.values():
            if len(idx) > 1:
                aw[idx] = RNG.permutation(aw[idx])
        null.append(best(aw))
    null = np.array(null, float)
    null = null[~np.isnan(null)]
    p = (null >= obs).mean()
    print(f"\n    FAMILY: most extreme cell {obs * 100:.1f} pts off 50%; "
          f"within-week reshuffle gives {null.mean() * 100:.1f} ± {null.std() * 100:.1f}"
          f"   p_family={p:.3f}")
    print(f"    -> {'SOMETHING SURVIVES' if p < 0.05 else 'inside noise'}")

    # season ledger for the two headline constructs, regardless of significance
    for lab, mask, won in (("TILT back money (all)", np.ones(len(m), bool), m.money_won.values),
                           ("FLIP back money", m.flip.values, m.flip_money_won.values)):
        print(f"\n    {lab}, season by season:")
        for s in sorted(m.season.unique()):
            sm = mask & (m.season.values == s)
            if sm.sum() >= 10:
                k, n = int(won[sm].sum()), int(sm.sum())
                print(f"      {s}: {k}-{n - k}  {k / n:5.1%}  (n={n})")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    a = ap.parse_args()
    d = build(a.seasons)
    print(f"NFL {min(a.seasons)}-{max(a.seasons)}: {len(d)} completed games")
    for which in ("spread", "total"):
        run(d, which)


if __name__ == "__main__":
    main()
