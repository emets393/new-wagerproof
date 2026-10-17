#!/usr/bin/env python3
"""Results BY MONTH, split by the money% − bet% difference. The cross-table.

⛔ NBA ONLY.

The question: in each month of the season, does the gap between where the MONEY is and
where the BETS are predict the result? Rows are months, columns are gap buckets, cells
are the record from backing the MONEY side.

⛔ SPLIT BY REGIME, NOT POOLED. AN's NBA money% changed between 2023-24 and 2024-25:
median |gap| on totals went 12.0 -> 2.0 -> 1.0, and 45.2% of 2023-24 totals had a gap of
15+ against 0.7% and 0.2% after. Those are two different measurements and a pooled
month-by-gap table would be mostly 2023-24 in its wide-gap columns and mostly the later
seasons in its narrow ones — the gap column and the season would be the same variable.
So: one table for 2023-24, one for the current regime (2024-25 + 2025-26).

Placeholder splits (0%/100%) are excluded upstream by `derive()`. ⚠ That matters here:
they carried gap == 0 exactly, so they would have piled into the no-gap column and
dragged its baseline.

Cells show the record backing the money side. A sub-50% cell is a winning FADE of the
same size, flagged as such — records are read from the bet's side.

    python3 nba_gap_months.py
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PARQUET = os.path.join(HERE, "data", "nba_splits.parquet")

ORDER = [10, 11, 12, 1, 2, 3, 4]
NAME = {10: "Oct", 11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr"}
# buckets chosen to span both regimes; thin cells print as n only
BUCKETS = [(0, 0.5, "no gap"), (0.5, 5, "1-4"), (5, 10, "5-9"),
           (10, 20, "10-19"), (20, 999, "20+")]
MINN = 25


def implied(o):
    o = np.asarray(o, float)
    out = np.empty_like(o)
    neg = o < 0
    out[neg] = -o[neg] / (-o[neg] + 100.0)
    out[~neg] = 100.0 / (o[~neg] + 100.0)
    return out


def ml_cell(g):
    """⛔ A MONEYLINE CELL MUST BE SCORED AGAINST ITS PRICE, NOT 50%.

    The raw version of this table showed fading the money side going 51% / 59% / 62% /
    71% across widening gaps — a perfect monotone dose, consistent in 7 of 7 months, and
    almost entirely the fact that a bigger money-share gap means the money sat on a
    longer dog. Scored against the vig-free price the same cells are worth about nothing.
    So ML cells print the EDGE over no-vig, with the win rate in brackets.
    """
    n = len(g)
    if n == 0:
        return "       —   "
    if n < MINN:
        return f"    (n={n})".rjust(11)
    edge = g.won.mean() - g.nv_fade.mean()
    return f"{edge:+.1%} ({g.won.mean():.0%})".rjust(11)


def cell(won):
    n = len(won)
    if n == 0:
        return "       —   "
    if n < MINN:
        return f"    (n={n})".rjust(11)
    k = int(won.sum())
    rate = k / n
    tag = ""
    if rate < 0.5:                      # a losing cell is a winning fade
        k, rate, tag = n - k, 1 - rate, "f"
    return f"{k}-{n - k} {rate:.0%}{tag}".rjust(11)


def table(d, market, label):
    if market == "spread":
        s = d[d.sp_ok].dropna(subset=["tix_away", "mny_away"]).copy()
        gap = s.mny_away.astype(float) - s.tix_away.astype(float)
        a_won = (~s.home_covered).values
    elif market == "total":
        s = d[d.ou_ok].dropna(subset=["tix_over", "mny_over"]).copy()
        gap = s.mny_over.astype(float) - s.tix_over.astype(float)
        a_won = s.over_hit.values
    else:
        s = d[d.ml_ok].dropna(subset=["tix_ml_away", "mny_ml_away"]).copy()
        gap = s.mny_ml_away.astype(float) - s.tix_ml_away.astype(float)
        a_won = (~s.home_won).values
    s["gap"] = gap.values
    s["agap"] = s.gap.abs()
    # the money side: where money% exceeds tickets%. With no gap there is no money side,
    # so that column backs the AWAY/OVER side and is a pure base-rate reference.
    s["won"] = np.where(s.gap > 0, a_won, ~a_won)
    if market == "ml":
        ih, ia = implied(s.ml_home), implied(s.ml_away)
        tot = ih + ia
        nvh, nva = ih / tot, ia / tot
        # we back the money side; its no-vig probability is the yardstick
        s["nv_fade"] = np.where(s.gap > 0, nva, nvh)

    print(f"\n  {label} — {market.upper()}  (n={len(s)})   cells = back the MONEY side; "
          + ("'f' = it lost, so the FADE won by that much" if market != "ml"
             else "ML cells show EDGE over the no-vig price, win rate in brackets"))
    hdr = "".join(b[2].rjust(11) for b in BUCKETS)
    print(f"    {'month':<7}{'n':>6}{hdr}")
    for m in ORDER:
        g = s[s.month == m]
        if len(g) < 30:
            continue
        fn = (lambda x: ml_cell(x)) if market == "ml" else (lambda x: cell(x.won.values))
        row = "".join(fn(g[(g.agap >= lo) & (g.agap < hi)]) for lo, hi, _ in BUCKETS)
        print(f"    {NAME[m]:<7}{len(g):>6}{row}")
    po = s[s.game_type == "post"]
    if len(po) >= 30:
        fn = (lambda x: ml_cell(x)) if market == "ml" else (lambda x: cell(x.won.values))
        row = "".join(fn(po[(po.agap >= lo) & (po.agap < hi)]) for lo, hi, _ in BUCKETS)
        print(f"    {'(post)':<7}{len(po):>6}{row}")
    # column totals, which is the honest place to read a gap effect from
    fn = (lambda x: ml_cell(x)) if market == "ml" else (lambda x: cell(x.won.values))
    row = "".join(fn(s[(s.agap >= lo) & (s.agap < hi)]) for lo, hi, _ in BUCKETS)
    tot = "".join(f"{int(((s.agap >= lo) & (s.agap < hi)).sum()):>11}"
                  for lo, hi, _ in BUCKETS)
    print(f"    {'-' * 60}")
    print(f"    {'ALL':<7}{len(s):>6}{row}")
    print(f"    {'(n)':<7}{'':>6}{tot}")


def main():
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    d = pd.read_parquet(PARQUET)
    d = d[d.game_type != "pre"].copy()
    d["slate_date"] = pd.to_datetime(d.slate_date)
    d["month"] = d.slate_date.dt.month

    for lab, sub in (("2023-24  (OLD money% regime — wide gaps, suspect)",
                      d[d.season == 2024]),
                     ("2024-25 + 2025-26  (CURRENT regime — gaps are small)",
                      d[d.season >= 2025])):
        print("\n" + "=" * 118)
        print(lab)
        print("=" * 118)
        for market in ("spread", "total", "ml"):
            table(sub, market, lab.split("  ")[0])

    print("\n" + "=" * 118)
    print("HOW BIG THE GAPS EVEN ARE, by month and regime (median |gap|)")
    print("=" * 118)
    print(f"    {'month':<7}" + "".join(f"{x:>14}" for x in
                                        ("23-24 sp", "23-24 ou", "now sp", "now ou")))
    for m in ORDER:
        old, new = d[(d.season == 2024) & (d.month == m)], d[(d.season >= 2025) & (d.month == m)]
        if len(old) + len(new) < 30:
            continue
        vals = []
        for frame, t, mo, ok in ((old, "tix_away", "mny_away", "sp_ok"),
                                 (old, "tix_over", "mny_over", "ou_ok"),
                                 (new, "tix_away", "mny_away", "sp_ok"),
                                 (new, "tix_over", "mny_over", "ou_ok")):
            g = frame[frame[ok]]
            v = (g[mo].astype(float) - g[t].astype(float)).abs().median()
            vals.append(f"{v:.1f}" if not np.isnan(v) else "—")
        print(f"    {NAME[m]:<7}" + "".join(f"{v:>14}" for v in vals))


if __name__ == "__main__":
    main()
